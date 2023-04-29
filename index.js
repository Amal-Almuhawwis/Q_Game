const http = require('http');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const path = require('path');
const hbs = require('hbs');
const User = require('./lib/user');
const Game = require('./lib/game');
const Utils = require('./lib/utils');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Constants
const PORT = process.env.NODE_PORT || 3000;
const inProduction = 'production' === process.env.NODE_ENV;

// Paths
const staticPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'templates', 'views');
const partialViewsPath = path.join(__dirname, 'templates', 'partials');


// available Session options
// https://www.npmjs.com/package/express-session
const sessionMiddleware = session({
  secret: '$f-k;5.Z~_80P3og+&DrTj69',
  name: 'SID',
  // required field to allow secure cookie behined proxy [nginx|apache as webserver]
  //proxy: true,
  proxy: inProduction,
  //TODO:: domain value must be set to the used domain
  //       while developing secure can be set to false to allow debuging the code,
  //       since secure will prevent sending cookie if no https is used
  //       maxAge: 1800000 -> 30 minute
  cookie: { path: '/', httpOnly: true, secure: inProduction, sameSite: true, maxAge: null },
  resave: false,
  rolling: true,
  saveUninitialized: true,
  unset: 'destroy'
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
      const game = await Game.find(U.currentlyPlaying);
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
        await User.setCurrentlyPlaying(req.session.uid, 0);
      }
    }

    req.session.gid = null;
    req.session.player = null;


    // user does not have an active game
    const games = await Game.getWaitingList();
    res.render('index', {
      authorized: true,
      page: "main",
      title: 'Game',
      games,
      csrf: (req.session._csrf = Utils.randomString(32))
    });
  }
  else {
    res.redirect('/signin');
  }
});

app.get('/signout', (req, res) => {
  req.session.uid = null;
  req.session.destroy((err) => {
    // any required action after destroying the session

  });
  res.redirect('/signin');
});

app.get('/signin', (req, res) => {
  // user should not be allowed to signin if the user is already signed in
  if (req.session.uid) {
    res.redirect('/');
    return;
  }

  res.render('signin', {
    page: "signin",
    title: 'SignIn',
    username: '',
    csrf: (req.session._csrf = Utils.randomString(32))
  });
});

app.post('/signin', async (req, res) => {
  //# validate user input
  const username = req.body.username.trim().toLowerCase();
  const password = req.body.password.trim();
  
  let error = 'Invalid Username/Password'
  let isValidUsername = /^[A-Z][A-Z0-9]{4,19}$/i.test(username);
  let isValidPassword = password.length >= 8;
  const isValidCSRF = req.session._csrf === req.body.csrf;
  delete req.session._csrf;
  
  if (0 === username.length) {
    error = 'Username field is required';
  }
  else if (0 === password.length) {
    error = 'Password field is required';
  }
  
  if (isValidCSRF && isValidUsername && isValidPassword) {
    // User.signin will return uid or null;
    const uid = await User.signin(username, password);
    if (uid) {
      // regenerate the session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          return;
        }
        // save uid inside the callback
        // to make sure the uid variable
        // is saved in the new generated session id
        req.session.uid = uid;
        // make sure to redirect inside regenerate callback
        // to load the new page with the new session id
        res.redirect('/');
      });
      return;
    }
  }

  res.render('signin', {
    page: "signin",
    title: 'SignIn',
    username: req.body.username,
    error: error,
    csrf: (req.session._csrf = Utils.randomString(32))
  });
});

app.get('/signup', (req, res) => {
  if (req.session.uid) {
    res.redirect('/');
    return;
  }
  res.render('signup', {
    page: "signup",
    title: 'Sign Up',
    username: '',
    errors: [],
    csrf: (req.session._csrf = Utils.randomString(32))
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
  const isValidCSRF = req.session._csrf === req.body.csrf;
  delete req.session._csrf;


  if (isValidCSRF && isValidUsername && isValidPassword && isValidRePassword) {
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
    errors: errors,
    csrf: (req.session._csrf = Utils.randomString(32))
  });
  
});

app.post('/game/join', async (req, res) => {
  const isValidCSRF = req.session._csrf === req.body.csrf;
  delete req.session._csrf;

  if (isValidCSRF && req.session.uid && !req.session.gid) {
    const game_id = req.body.game_id.trim().toLowerCase();
    if (await Game.join(game_id, req.session.uid)) {
      // 
      io.sockets.emit('av_game_rm', game_id);
      req.session.gid = game_id;
      req.session.player = 'p2';
    }
  }

  res.redirect('/');
});

app.post('/game/create', async (req, res) => {
  const isValidCSRF = req.session._csrf === req.body.csrf;
  delete req.session._csrf;

  // create game only for signed in user who do not have an active game
  if (isValidCSRF && req.session.uid && !req.session.gid) {
    const game_name = req.body.game.trim().toLowerCase();
    const timeout = req.body.timeout.trim();
    // check if game name is valid string
    if (/^[A-Z0-9_ \-]{2,20}$/i.test(game_name) && /^[2-6]0$/.test(timeout)) {
      const game = await Game.create(game_name, req.session.uid, +timeout);
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

    info.total = await Game.count({
      $or: [
        {'private.players.playerOne': allUsers[i]._id.toHexString()},
        {'private.players.playerTwo': allUsers[i]._id.toHexString()}
      ]
    });
    info.wins = await Game.count({'public.gameState.winner': allUsers[i].username});
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

  const gamesPlayed = await User.getGamesPlayed(req.session.uid);
  if (gamesPlayed.error) {
    req.session.uid = null;
    res.redirect('/signin');
    return;
  }


  res.render('history', {
    authorized: true,
    page: 'history',
    title: 'Game History',
    player: gamesPlayed.username,
    list: gamesPlayed.list
  });
});

app.get('/game/history/playback', async (req, res) => {
  if (!req.session.uid) {
    res.redirect('/signin');
    return;
  }

  let g;
  // query parameter does not exists
  if (!req.query.g || 
      // invalid query param
      !/^[0-9A-F]{24}$/i.test(req.query.g) ||
      // game does not exists
      !(g = await Game.find(req.query.g)) || 
      // current player does not belong to the selected game
      [g.private.players.playerOne, g.private.players.playerTwo].indexOf(req.session.uid) === -1) {
    res.writeHead(404);
    res.end();
    return;
  }
  
  res.render('board', {
    authorized: true,
    page: 'board',
    title: 'Game PlayBack',
    gameId: g.public.gameId,
    playback: true
  });

});


app.get('*', (req, res) => {
  res.writeHead(404);
  res.end();
});





io.on('connection', async (socket) => {
  const sess = socket.request.session;
  if (!sess || !sess.uid) return;

  // playback will not require an active game in session variable
  socket.on('playback-join', async (gid) => {
    if (!/^[0-9A-F]{24}$/i.test(gid)) {
      console.log('invalid gid')
      return;
    }

    const g = await Game.find(gid);
    if (!g || -1 === [g.private.players.playerOne, g.private.players.playerTwo].indexOf(sess.uid)) {
      console.log('not a game')
      return;
    }


    socket.emit('playback-start', g.public);
  });

  // game play will require an active game in session variable
  if (!sess.gid || !sess.player) return;

  
  socket.on('join', async () => {
    const g = await Game.find(sess.gid);
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
    const g = await Game.makeMove(sess.gid, player, x, y);
    if (g.error) {
      socket.emit('invalid', {error: g.error, player});
      return;
    }

    if (0 !== g.public.gameState.winner) {
      io.to(sess.gid).emit('end', g.public.message);
    }
    else {
      io.to(sess.gid).emit('update', g.public);
    }
  });

  socket.on('wall', async ({player, wall}) => {
    const g = await Game.makeWall(sess.gid, player, wall);
    if (g.error) {
      socket.emit('invalid', {error: g.error, player});
    }
    else {
      io.to(sess.gid).emit('update', g.public);
    }
  });

  socket.on('timeout', async (otherPlayerId) => {
    const playerId = 'p1' === otherPlayerId ? 'p2': 'p1';
    const g = await Game.aiAction(sess.gid, playerId);

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




//# Game Rules
//  https://en.wikipedia.org/wiki/Quoridor

//# HBS helpers
//  https://handlebarsjs.com/guide/builtin-helpers.html

//# MongoDB docs
//  https://www.mongodb.com/docs/drivers/node/current/quick-start/

//# MongoDB Query Operators
//  https://www.mongodb.com/docs/manual/reference/operator/query/

//# Use Session in Socket.io
//  https://socket.io/how-to/use-with-express-session