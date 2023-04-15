const { MongoClient, ObjectId } = require('mongodb');

const DB_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'quoridor_db';

const client = new MongoClient(DB_URL);

const db = client.db(DB_NAME);

const UsersColl = db.collection('users');
UsersColl.createIndex({username: 1}, {unique: true});
const GamesColl = db.collection('games');
const WaitingGamesColl = db.collection('waiting_games');

module.exports = {UsersColl, GamesColl, WaitingGamesColl, ObjectId}