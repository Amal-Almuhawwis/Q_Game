const http = require('http');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const path = require('path');
const hbs = require('hbs');
const bcrypt = require('bcrypt');
const {createGame, joinGame, getWaitingGamesList, setCurrentlyPlaying, makeMove, makeWall} = require('./lib/game');

const { UsersColl, GamesColl, ObjectId } = require('./lib/database');

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
    const U = await UsersColl.findOne({_id: new ObjectId(req.session.uid)});
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
      page: "home",
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
    //# fetch user information from database
    // uid is the user ID from the database
    const U = await UsersColl.findOne({username});
    if (U && bcrypt.compareSync(password, U.password)) {
      // sign user in
      req.session.uid = U._id.toHexString();
      // redirect to game page
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
    const user = await UsersColl.findOne({username: username});
    if (!user) {
      const hash = bcrypt.hashSync(password, 10);
      const result = await UsersColl.insertOne({username, password: hash, currentlyPlaying: 0});
      if (result.insertedId) {
        // redirecto to signin page
        //res.redirect('/signin');

        // auto signin with username
        req.session.uid = result.insertedId.toHexString();
        res.redirect('/');
        return;
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
    // check if game name is valid string
    if (/^[A-Z0-9_]{2,20}$/i.test(game_name)) {
      const game = await createGame(game_name, req.session.uid);
      if (game && !game.error) {
        req.session.player = 'p1';
        req.session.gid = game.public.gameId;
      }
    }
  }

  res.redirect('/');
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
    socket.emit('init', sess.player);


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

  socket.on('timeout', async (player) => {
    // make an AI move and update
  });


  // socket user is disconnected
  socket.on('disconnect', () => {
    console.log('user disconnected', sess);
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