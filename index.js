const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();

app.use(session({
  secret: 'abcdEFaBCD68390872674',
  name: 'SID',
  resave: false,
  saveUninitialized: true
}));

// to serve static assets from public directory
app.use(express.static('public'));

// to render templates from view directory
app.set('view engine', 'pug');

// to read post data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = 5000;

app.get('/', (req, res) => {
  if (req.session.uid) {
    res.render('index', {title: 'Game Home', header: 'Game page'});
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
    res.render('signin', {title: 'Signin'});
  }
});

app.post('/signin', (req, res) => {
  //# validate user input
  const username = req.body.username.trim().toLowerCase();
  const password = req.body.password.trim();
  
  let isValidUsername = /^[A-Z][A-Z0-9]{4,19}$/i.test(username);
  let isValidPassword = password.length >= 8;

  
  if (isValidUsername && isValidPassword) {
    //# fetch user information from database
    // uid is the user ID from the database
    req.session.uid = 1;
    res.redirect('/');
  }
  else {
    res.render('signin', {title: 'Signin', usernameValue: req.body.username});
  }
});

app.get('/signup', (req, res) => {
  res.render('signup', {title: 'Sign Up', usernameValue: '', form_error: ''});
});

app.post('/signup', (req, res) => {
  let error = '';
  const username = req.body.username.trim().toLowerCase();
  const password = req.body.password.trim();
  const re_password = req.body.repassword.trim();

  let isValidUsername = /^[A-Z][A-Z0-9]{4,19}$/i.test(username);
  let isValidPassword = password.length >= 8 && password === re_password;

  if (isValidUsername && isValidPassword) {

  }
  else {
    if (!isValidUsername) {
      console.log('!isValidUsername');
      error += 'Username must start with a letter and may contain numbers, and at least 5 characters long, and at most 20 characters';
    }
    
    if (!isValidPassword)
      error += 'Password must be at least 8 characters';
    
    
    // display error messages
    res.render('signup', {title: 'Sign Up', usernameValue: req.body.username, form_error: error});
  }
  
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});