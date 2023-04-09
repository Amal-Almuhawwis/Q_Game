const { MongoClient } = require('mongodb');

const connectionUrl = 'mongodb://localhost:27017';
const client = new MongoClient(connectionUrl);

const DB_NAME = 'quoridor_db';



async function addUser() {
  await client.connect();

  const db = client.db(DB_NAME);
  const collection = db.collection('user');
}


module.exports = {
  addUser
};