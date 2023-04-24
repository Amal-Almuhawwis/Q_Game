const http = require('http');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const path = require('path');
const hbs = require('hbs');
const User = require('./lib/user');
const {createGame, joinGame, getWaitingGamesList, setCurrentlyPlaying, makeMove, makeWall, AI_action} = require('./lib/game');

const { GamesColl, ObjectId } = require('./lib/database');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Constants
const PORT = process.env.PORT || 3000;

// Paths
const staticPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'templates', 'views');
const partialViewsPath = path.join(__dirname, 'templates', 'partials');


const sessionMiddleware = session({
  secret: 'abcdEFaBCD68390872674',
  name: 'SID',
  resave: false,
  saveUninitialized: true
});

const wrapSessionMiddleware = middleware => (socket, next) => middleware(socket.request, {}, next);

app.use(sessionMiddleware);
io.use(wrapSessionMiddleware(sessionMiddleware));

// allow only authenticated user to use socket
io.use((socket, next) => {
  const sess = socket.request.session;
  if (sess && sess.uid) {
    next();
  }
  else {
    next(new Error('unauthorized'));
  }
});

// to serve static assets from public directory
app.use(express.static(staticPath));

// to render templates from view directory
app.set('view engine', 'hbs');
app.set('views', viewsPath);
hbs.registerPartials(partialViewsPath);

// to read post data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.get('/', async (req, res) => {
  // check if user is signed in
  if (req.session.uid) {
    const U = await User.find(req.session.uid);
    // confirm user info
    if (!U) {
      // reset session information
      req.session.uid = null;
      req.session.gid = null;
      req.session.player = null;

      res.redirect('/signin');
      return;
    }

    // user have an active game
    if (U.currentlyPlaying !== 0) {
      const game = await GamesColl.findOne({_id: new ObjectId(U.currentlyPlaying)});
      // game exists, and does not have a winner
      if (game && game.public.gameState.winner === 0) {
        // save game information in the session
        req.session.gid = U.currentlyPlaying;
        req.session.player = game.private.players.playerOne === req.session.uid ? 'p1' : 'p2';

        res.render('board', {
          authorized: true,
          page: "board"
        });
        return;
      }
      else {
        // remove currentlyPlaying from user
        await setCurrentlyPlaying(req.session.uid, 0);
      }
    }

    req.session.gid = null;
    req.session.player = null;


    // user does not have an active game
    const games = await getWaitingGamesList();
    res.render('index', {
      authorized: true,
      page: "main",
      title: 'Game',
      games
    });
  }
  else {
    res.redirect('/signin');
  }
});

app.get('/signout', (req, res) => {
  req.session.uid = null;
  res.redirect('/signin');
});

app.get('/signin', (req, res) => {
  // user should not be allowed to signin if the user is already signed in
  if (req.session.uid) {
    res.redirect('/');
  }
  else {
    res.render('signin', {
      page: "signin",
      title: 'SignIn',
      username: ''
    });
  }
});

app.post('/signin', async (req, res) => {
  //# validate user input
  const username = req.body.username.trim().toLowerCase();
  const password = req.body.password.trim();
  
  let error = 'Invalid Username/Password'
  let isValidUsername = /^[A-Z][A-Z0-9]{4,19}$/i.test(username);
  let isValidPassword = password.length >= 8;

  if (0 === username.length) {
    error = 'Username field is required';
  }
  else if (0 === password.length) {
    error = 'Password field is required';
  }
  
  if (isValidUsername && isValidPassword) {
    // User.signin will return uid or null;
    if ((req.session.uid = await User.signin(username, password))) {
      res.redirect('/');
      return;
    }
  }

  res.render('signin', {
    page: "signin",
    title: 'SignIn',
    username: req.body.username,
    error: error
  });
});

app.get('/signup', (req, res) => {
  res.render('signup', {
    page: "signup",
    title: 'Sign Up',
    username: '',
    errors: undefined
  });
});

app.post('/signup', async (req, res) => {
  let errors = [];
  const username = req.body.username.trim().toLowerCase();
  const password = req.body.password.trim();
  const re_password = req.body.repassword.trim();

  let isValidUsername = /^[A-Z][A-Z0-9]{4,19}$/i.test(username);
  let isValidPassword = password.length >= 8;
  let isValidRePassword = password === re_password;

  if (isValidUsername && isValidPassword && isValidRePassword) {
    if (!(await User.exists(username))) {
      const id = await User.create(username, password);
      if (id) {
        req.session.uid = id.toHexString();
        res.redirect('/');
        return;
      }
      else {
        errors.push('failed to create new user, please try again later.');
      }
    }
    else {
      errors.push(`${username} already exists, try another one.`);
    }
  }


  if (!isValidUsername) {
    errors.push('Username must start with a letter and may contain numbers, and at least 5 characters long, and at most 20 characters');
  }
  
  if (!isValidPassword)
    errors.push('Password must be at least 8 characters');
  
  if (!isValidRePassword)
    errors.push('Password does not match');
  
  
  // display error messages
  res.render('signup', {
    page: "signup",
    title: 'Sign Up',
    username: req.body.username,
    errors: errors
  });
  
});

app.post('/game/join', async (req, res) => {
  if (req.session.uid && !req.session.gid) {
    const game_id = req.body.game_id.trim().toLowerCase();
    if (await joinGame(game_id, req.session.uid)) {
      // 
      io.sockets.emit('av_game_rm', game_id);
      req.session.gid = game_id;
      req.session.player = 'p2';
    }
  }

  res.redirect('/');
});

app.post('/game/create', async (req, res) => {
  // create game only for signed in user who do not have an active game
  if (req.session.uid && !req.session.gid) {
    const game_name = req.body.game.trim().toLowerCase();
    const timeout = req.body.timeout.trim();
    // check if game name is valid string
    if (/^[A-Z0-9_ \-]{2,20}$/i.test(game_name) && /^[2-6]0$/.test(timeout)) {
      const game = await createGame(game_name, req.session.uid, +timeout);
      if (game && !game.error) {
        io.sockets.emit('av_game_add', {gameId: game.public.gameId, gameName: game.public.gameName, timeout: game.public.timeout});
        req.session.player = 'p1';
        req.session.gid = game.public.gameId;
      }
    }
  }

  res.redirect('/');
});

app.get('/leaderboard', async (req, res) => {
  if (!req.session.uid) {
    res.redirect('/signin');
    return;
  }

  let I = [];
  const allUsers = await User.getAll();
  for (let i = 0; i < allUsers.length; i++) {
    let info = {
      username: allUsers[i].username
    };

    info.total = await GamesColl.countDocuments({
      $or: [
        {'private.players.playerOne': allUsers[i]._id.toHexString()},
        {'private.players.playerTwo': allUsers[i]._id.toHexString()}
      ]
    });
    info.wins = await GamesColl.countDocuments({'public.gameState.winner': allUsers[i].username});
    info.losses = info.total - info.wins;
    I.push(info);
  }

  // sort descending
  I.sort((a, b) => a.total > b.total ? -1 : (a.total < b.total ? 1 : 0) );

  res.render('leaderboard', {
    authorized: true,
    page: 'leaderboard',
    title: 'Leader Board',
    users: I
  })
});

app.get('/game/history', async (req, res) => {
  if (!req.session.uid) {
    res.redirect('/signin');
    return;
  }

  const U = await User.find(req.session.uid);
  if (!U) {
    res.redirect('/signin');
    return;
  }

  res.render('history', {
    authorized: true,
    page: 'history',
    title: 'Game History',
    player: U.username
  });
});


app.get('*', (req, res) => {
  res.writeHead(404);
  res.end();
});





io.on('connection', async (socket) => {
  const sess = socket.request.session;
  if (!sess || !sess.uid || !sess.gid || !sess.player) {
    return;
  }

  
  socket.on('join', async () => {
    const g = await GamesColl.findOne({_id: new ObjectId(sess.gid)});
    if (!g) {
      return;
    }

    socket.join(sess.gid);

    // send the id [p1|p2] to the joined user
    socket.emit('init', {player: sess.player, timeout: g.public.timeout});


    // two players is ready to play the game
    if (g.private.players.playerOne && g.private.players.playerTwo) {
      io.to(sess.gid).emit('start', g.public);
    }
    else {
      io.to(sess.gid).emit('waiting', g.public.message);
    }
  });

  socket.on('move', async ({player, x, y}) => {
    const g = await makeMove(sess.gid, player, x, y);
    if (g.error) {
      socket.emit('error', g.error);
      return;
    }

    if (0 !== g.public.gameState.winner) {
      io.to(sess.gid).emit('end', g.public.message);
    }
    else {
      io.to(sess.gid).emit('update', g.public);
    }
  });

  socket.on('wall', async ({player, walls}) => {
    const g = await makeWall(sess.gid, player, walls);
    io.to(sess.gid).emit('update', g.error ? g : g.public);
  });

  socket.on('timeout', async (otherPlayerId) => {
    const playerId = 'p1' === otherPlayerId ? 'p2': 'p1';
    const g = await AI_action(sess.gid, playerId);

    if (g.error) {
      socket.emit('error', g.error);
      return;
    }

    if (0 !== g.public.gameState.winner) {
      io.to(sess.gid).emit('end', g.public.message);
    }
    else {
      io.to(sess.gid).emit('update', g.public);
    }
  });


  // socket user is disconnected
  socket.on('disconnect', () => {

  });
});




server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});





//# HBS helpers
//  https://handlebarsjs.com/guide/builtin-helpers.html

//# MongoDB docs
//  https://www.mongodb.com/docs/drivers/node/current/quick-start/

//# MongoDB Query Operators
//  https://www.mongodb.com/docs/manual/reference/operator/query/

//# Use Session in Socket.io
//  https://socket.io/how-to/use-with-express-session