const {UsersColl, ObjectId, GamesColl} = require('./database');
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

const setCurrentlyPlaying = async (userId, gameId) => {
  const res = await UsersColl.updateOne({_id: new ObjectId(userId)}, {
    $set: {
      currentlyPlaying: gameId
    }
  });
  return res.modifiedCount === 1;
};

const getGamesPlayed = async (userId) => {
  const U = await find(userId);
  if (!U) return {
    error: 'user does not exists'
  };

  const games = await GamesColl.find({
    $or: [
      {'private.players.playerOne': userId},
      {'private.players.playerTwo': userId}
    ]
  }).toArray();

  let I = {
    username: U.username,
    list: []
  };
  for (let g, i = 0; i < games.length; i++) {
    g = games[i];
    I.list.push({
      gameId: g.public.gameId,
      gameName: g.public.gameName,
      opponent: g.public.gameState.playerName.p1 === U.username ? g.public.gameState.playerName.p2 : g.public.gameState.playerName.p1,
      status: g.public.gameState.winner === U.username ? 'win': 'loss'
    });
  }

  return I;
};




module.exports = {
  find, exists, create, signin, getAll, setCurrentlyPlaying, getGamesPlayed
};