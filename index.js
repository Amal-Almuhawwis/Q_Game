const http = require('http');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const path = require('path');
const hbs = require('hbs');
const bcrypt = require('bcrypt');
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
  if (req.session.uid) {
    // user have an active game
    if (req.session.gid) {
      res.render('board', {
        page: "board",
        title: 'Game'
      });
    }
    // user does not have an active game
    else {
      // find a list of all available games
      const games = await GamesColl.find({'public.gameStatus.winner': null}).toArray();
      let availableGames = [];
      games.forEach((g) => {
        availableGames.push({id: g._id.toHexString(), game: g.public.gameName});
      });

      res.render('index', {
        page: "home",
        title: 'Game',
        games: availableGames
      });
    }
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
    const user = await UsersColl.findOne({username});
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.uid = user._id.toHexString();
      let game = await GamesColl.findOne({'private.players.playerOne': req.session.uid, 'public.gameStatus.winner': null});
      if (game) {
        req.session.gid = game._id.toHexString();
        req.session.player = 'p1';
      }
      else {
        game = await GamesColl.findOne({'private.players.playerTwo': req.session.uid, 'public.gameStatus.winner': null});
        if (game) {
          req.session.gid = game._id.toHexString();
          req.session.player = 'p2';
        }
      }
      //const game = await GamesColl.findOne({active: true, });
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
      const result = await UsersColl.insertOne({username, password: hash});
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
    const g = await GamesColl.findOne({_id: new ObjectId(game_id)});
    const U = await UsersColl.findOne({_id: new ObjectId(req.session.uid)});
    // make sure the game is not finished [does not have a winner]
    if (g && U && !g.public.gameStatus.winner) {
      g.private.players.playerTwo = req.session.uid;
      g.public.gameStatus.playerName.p2 = U.username;
      g.public.message = `Game Started, ${g.public.gameStatus.playerName.p1} turn`;

      const result = await GamesColl.replaceOne({_id: g._id}, g);
      if (result.acknowledged) {
        req.session.gid = g._id.toHexString();
        req.session.player = 'p2';
      }
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
      // check if the given name is already exists
      const U = await UsersColl.findOne({_id: new ObjectId(req.session.uid)});
      let g = await GamesColl.findOne({game: game_name, active: true});
      if (!g && U) {
        const id = new ObjectId();
        g = {
          _id: id,
          private: {
            nextPlayer: req.session.uid,
            players: {
              playerOne: req.session.uid
            },
            timeStamp: Date.now()
          },
          public: {
            gameId: id.toHexString(),
            gameName: game_name,
            gameStatus: {
              availableWalls: {
                p1: 6,
                p2: 6
              },
              history: [],
              pawns: {
                p1: {
                  x: 0,
                  y: 4
                },
                p2: {
                  x: 8,
                  y: 4
                }
              },
              playerName: {
                p1: U.username
              },
              playerTurn: "p1",
              winner: null
            },
            message: 'Waiting another player to join',
            nextPlayer: U.username
          }
        };
        const result = await GamesColl.insertOne(g);

        if (result.acknowledged) {
          req.session.gid = id.toHexString();
          req.session.player = 'p1';
        }
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
    console.log('io. no session')
    return;
  }

  let g = await GamesColl.findOne({_id: new ObjectId(sess.gid)});
  if (!g) {
    console.log('io. no game')
    return;
  }

  socket.on('join', () => {
    socket.join(sess.gid);
    // send the id [p1|p2] to the joined user
    socket.emit('init', sess.player);

    // two players is ready to play the game
    if (g.private.players.playerOne && g.private.players.playerTwo) {
      io.to(sess.gid).emit('start', g.public);
    }
    else {
      io.to(sess.gid).emit('waiting', {player: sess.player});
    }
  });

  socket.on('move', async ({player, x, y}) => {
    // swap user turn
    // add move to history
    g = await GamesColl.findOne({_id: new ObjectId(sess.gid)});
    g.public.gameStatus.playerTurn = g.public.gameStatus.playerTurn === 'p1' ? 'p2': 'p1';
    g.public.nextPlayer = g.public.gameStatus.playerName[g.public.gameStatus.playerTurn];
    g.public.gameStatus.pawns[player].x = x;
    g.public.gameStatus.pawns[player].y = y;

    const result = await GamesColl.replaceOne({_id: g._id}, g);

    if (result.acknowledged) {
      io.to(sess.gid).emit('update', g.public);
    }
  });

  socket.on('wall', ({player, x, y}) => {
    // swap user turn
    // add move to history

    io.to(sess.gid).emit('update', g.public);
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