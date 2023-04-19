const {GamesColl, WaitingGamesColl, UsersColl, ObjectId} = require('./database');

const createWaitingGame = async (gameName, gameId, timeout) => {
  const result = await WaitingGamesColl.insertOne({gameName, gameId, timeout});
  return result.insertedId != null;
};

const setCurrentlyPlaying = async (playerId, gameId) => {
  const res = await UsersColl.updateOne({_id: new ObjectId(playerId)}, {
    $set: {
      currentlyPlaying: gameId
    }
  });
  return res.modifiedCount === 1;
};

const createGame = async (gameName, playerId, timeout) => {
  const U = await UsersColl.findOne({_id: new ObjectId(playerId)});
  if (!U || U.currentlyPlaying !== 0) {
    return {
      error: "user can't create a game"
    };
  }

  if (await waitingGameExists(gameName)) {
    return {
      error: 'game already exists'
    };
  }

  const gameId = new ObjectId();
  const game = {
    _id: gameId,
    private: {
      nextPlayer: playerId,
      players: {
        playerOne: playerId
      }
    },
    public: {
      gameId: gameId.toHexString(),
      gameName,
      message: 'waiting for player two to join',
      nextPlayer: U.username,
      timeout: +timeout,
      gameState: {
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
        walls: {
          h: [],
          v: []
        },
        availableWalls: {
          p1: 6,
          p2: 6
        },
        playerName: {
          p1: U.username,
          p2: ''
        },
        playerTurn: 'p1',
        winner: 0,
        history: []
      }
    }
  };

  let res = await GamesColl.insertOne(game);
  if (!res.insertedId) {
    return {
      error: 'failed to create new game'
    };
  }

  if (!(await createWaitingGame(gameName, gameId.toHexString(), +timeout))) {
    return {
      error: 'failed to create waiting game'
    };
  }

  if (!(await setCurrentlyPlaying(playerId, gameId.toHexString()))) {
    return {
      error: 'failed to create assign game to user'
    };
  }


  return game;
};

const isWaitingGame = async (gameId) => {
  const game = await WaitingGamesColl.findOne({gameId});
  return null != game;
};

const deleteWaitingGame = async (gameId) => {
  const res = await WaitingGamesColl.deleteOne({gameId});
  return res.deletedCount === 1;
};

const joinGame = async (gameId, playerId) => {
  if (!isWaitingGame(gameId)) {
    return false;
  }

  const U = await UsersColl.findOne({_id: new ObjectId(playerId)});
  if (!U || U.currentlyPlaying !== 0) {
    return false;
  }

  let res = await GamesColl.updateOne({_id: new ObjectId(gameId)}, {
    $set: {
      'private.players.playerTwo': playerId,
      'public.gameState.playerName.p2': U.username,
      'private.timeStamp': Date.now()
    }
  });

  if (res.modifiedCount !== 1) {
    return false;
  }

  if (!(await setCurrentlyPlaying(playerId, gameId))) {
    return false;
  }


  return await deleteWaitingGame(gameId);
};

const waitingGameExists = async (gameName) => {
  const g = await WaitingGamesColl.findOne({gameName});
  return null != g;
};

const getWaitingGamesList = async () => {
  return await WaitingGamesColl.find().toArray();
};

const isMoveAllowed = (game, playerId, x, y) => {
  // move is out of bound or invalid playerId
  if (x < 0 || x > 8 || y < 0 || y > 8 || !/^p[12]$/.test(playerId)) {
    return false;
  }

  // move is larger than one square
  if (Math.abs(game.public.gameState.pawns[playerId].x - x) > 1 || 
      Math.abs(game.public.gameState.pawns[playerId].y - y) > 1) {
    return false;
  }

  const otherPlayerId = 'p1' === playerId ? 'p2' : 'p1';
  // move is in other pawns position
  if (x === game.public.gameState.pawns[otherPlayerId].x && y === game.public.gameState.pawns[otherPlayerId].y) {
    return false;
  }

  const wallDir = game.public.gameState.pawns[playerId].x === x ? 'h': 'v';
  const x_min = Math.min(game.public.gameState.pawns[playerId].x, x);
  const y_min = Math.min(game.public.gameState.pawns[playerId].y, y);
  const wall = game.public.gameState.walls[wallDir].filter((w) => {
    return w.x === x_min && w.y === y_min;
  });

  if (wall.length > 0) {
    return false;
  }

  return true;
};

const makeMove = async (gameId, playerId, x, y) => {
  let game = await GamesColl.findOne({_id: new ObjectId(gameId)});
  if (!game) {
    return {
      error: "game does not exists"
    };
  }

  if (!isMoveAllowed(game, playerId, x, y)) {
    return {
      error: 'invalid move'
    };
  }



  let isWin = false;

  game.public.gameState.pawns[playerId].x = x;
  game.public.gameState.pawns[playerId].y = y;
  
  game.public.gameState.history.push({
    action: 'move',
    player: playerId,
    x, y
  });

  if ('p1' === playerId) {
    isWin = 8 === +x;
    game.public.gameState.playerTurn = 'p2';
    game.private.nextPlayer = game.private.players.playerTwo;
  }
  else {
    isWin = 0 === +x;
    game.public.gameState.playerTurn = 'p1';
    game.private.nextPlayer = game.private.players.playerOne;
  }

  let player_name = game.public.gameState.playerName[game.public.gameState.playerTurn];
  game.public.message = `it's ${player_name} turn`;

  if (isWin) {
    player_name = game.public.gameState.playerName[playerId];
    game.public.message = `game is finished, and ${player_name} won.`;

    game.public.gameState.winner = game.public.gameState.playerName[playerId];
    await UsersColl.updateOne({_id: new ObjectId(game.private.players.playerOne)}, {
      $set: {
        currentlyPlaying: 0
      }
    });
    await UsersColl.updateOne({_id: new ObjectId(game.private.players.playerTwo)}, {
      $set: {
        currentlyPlaying: 0
      }
    });
  }

  const res = await GamesColl.replaceOne({_id: new ObjectId(gameId)}, game);
  if (res.modifiedCount !== 1) {
    return {
      error: 'failed to make a move'
    };
  }

  return game;
};

const isWallAllowed = (game, playerId, walls) => {
  if (!/^p[12]$/.test(playerId) || !walls.length || walls.length > 2) {
    return false;
  }

  for (let w, i = 0; i < walls.length; i++) {
    w = walls[i];
    if (w.x < 0 || w.y < 0 || !/^[vh]$/.test(w.orientation) || w.orientation !== walls[0].orientation) {
      return false;
    }
    if (game.public.gameState.walls[w.orientation].filter((wall) => wall.x === w.x && wall.y === w.y).length > 0) {
      return false;
    }
    switch(w.orientation) {
      case 'v':
        if (w.x > 7 || w.y > 8) {
          return false;
        }
        break;
      case 'h':
        if (w.x > 8 || w.y > 7) {
          return false;
        }  
        break;
      default:
        return false;
    }
  }

  return true;
};

const makeWall = async (gameId, playerId, walls) => {
  let game = await GamesColl.findOne({_id: new ObjectId(gameId)});
  if (!game) {
    return {
      error: "no game selected"
    };
  }

  if (game.public.gameState.availableWalls[playerId] <= 0) {
    return {
      error: "no available walls"
    };
  }

  if (!isWallAllowed(game, playerId, walls)) {
    return {
      error: 'invalid wall'
    };
  }

  game.public.gameState.availableWalls[playerId]--;

  if (walls) {
    for (let wall, i = 0; i < walls.length; i++) {
      wall = walls[i];
      game.public.gameState.walls[wall.orientation].push({
        x: wall.x,
        y: wall.y
      });

      game.public.gameState.history.push({
        action: 'wall',
        player: playerId,
        orientation: wall.orientation,
        x: wall.x,
        y: wall.y
      });    
    }
  }
  

  if ('p1' === playerId) {
    game.public.gameState.playerTurn = 'p2';
    game.private.nextPlayer = game.private.players.playerTwo;
  }
  else {
    game.public.gameState.playerTurn = 'p1';
    game.private.nextPlayer = game.private.players.playerOne;
  }

  let player_name = game.public.gameState.playerName[game.public.gameState.playerTurn];
  game.public.message = `it's ${player_name} turn`;


  const res = await GamesColl.replaceOne({_id: new ObjectId(gameId)}, game);

  if (res.modifiedCount !== 1) {
    return {
      error: 'failed to make a wall'
    };
  }

  return game;
};

const AI_action = async (gameId, playerId) => {
  let game = await GamesColl.findOne({_id: new ObjectId(gameId)});
  if (!game) {
    return {
      error: "game does not exists"
    };
  }

  let walls, x, y, I = 'p1' === playerId ? 1 : -1;

  x = +game.public.gameState.pawns[playerId].x;
  y = +game.public.gameState.pawns[playerId].y;
  if (isMoveAllowed(game, playerId, x + I, y)) {
    return makeMove(game.public.gameId, playerId, x + I, y);
  }
  if (isMoveAllowed(game, playerId, x, y + I)) {
    return makeMove(game.public.gameId, playerId, x, y + I);
  }
  if (isMoveAllowed(game, playerId, x, y - I)) {
    return makeMove(game.public.gameId, playerId, x, y - I);
  }
  if (isMoveAllowed(game, playerId, x - I, y)) {
    return makeMove(game.public.gameId, playerId, x - I, y);
  }

  for (x = 0; x < 9; x++) {
    for (y = 0; y < 9; y++) {
      walls = [{orientation: 'h', x, y}];
      if (isWallAllowed(game, playerId, walls)) {
        return makeWall(game.public.gameId, playerId, walls);
      }
      walls = [{orientation: 'v', x, y}];
      if (isWallAllowed(game, playerId, walls)) {
        return makeWall(game.public.gameId, playerId, walls);
      }
    }
  }

  //# swap user turn
  if ('p1' === playerId) {
    game.public.gameState.playerTurn = 'p2';
    game.private.nextPlayer = game.private.players.playerTwo;
  }
  else {
    game.public.gameState.playerTurn = 'p1';
    game.private.nextPlayer = game.private.players.playerOne;
  }

  const res = await GamesColl.replaceOne({_id: game._id}, game);

  return {
    error: 'no move|wall available'
  };
};

module.exports = {
  createGame, joinGame, getWaitingGamesList, setCurrentlyPlaying, makeMove, makeWall, AI_action
};