const {UsersColl, ObjectId} = require('./database');
const bcrypt = require('bcrypt');


const find = async (id) => {
  const U = await UsersColl.findOne({_id: new ObjectId(id)});
  return U;
};

const exists = async (username, getUser = false) => {
  username = username.trim().toLowerCase();
  const U = await UsersColl.findOne({username});
  return getUser ? U : null != U;
};

const signin = async (username, password) => {
  const U = await exists(username, true);
  if (U && bcrypt.compareSync(password, U.password)) {
    return U._id.toHexString();
  }
  return null;
};

const create = async (username, password) => {
  const hash = bcrypt.hashSync(password, 10);
  const res = await UsersColl.insertOne({
    username,
    password: hash,
    currentlyPlaying: 0
  });

  return res.insertedId;
};

const getAll = async (filter) => {
  return await UsersColl.find(filter).toArray();
}




module.exports = {
  find, exists, create, signin, getAll
};