const {GamesColl, WaitingGamesColl, ObjectId} = require('./database');
const User = require('./user');
const Board = require('./board');

const G_WALLS = 20;
const G_PLAYERS = 2;

const createWaitingGame = async (gameName, gameId, timeout) => {
  const result = await WaitingGamesColl.insertOne({gameName, gameId, timeout});
  return result.insertedId != null;
};

const create = async (gameName, playerId, timeout) => {
  const U = await User.find(playerId);
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

  if (!(await User.setCurrentlyPlaying(playerId, gameId.toHexString()))) {
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

const join = async (gameId, playerId) => {
  if (!isWaitingGame(gameId)) {
    return false;
  }

  const U = await User.find(playerId);
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

  if (!(await User.setCurrentlyPlaying(playerId, gameId))) {
    return false;
  }


  return await deleteWaitingGame(gameId);
};

const waitingGameExists = async (gameName) => {
  const g = await WaitingGamesColl.findOne({gameName});
  return null != g;
};

const getWaitingList = async () => {
  return await WaitingGamesColl.find().toArray();
};

const swapPlayer = (game) => {
  if ('p1' === game.public.gameState.playerTurn) {
    game.public.gameState.playerTurn = 'p2';
    game.private.nextPlayer = game.private.players.playerTwo;
  }
  else {
    game.public.gameState.playerTurn = 'p1';
    game.private.nextPlayer = game.private.players.playerOne;
  }

  const player_name = game.public.gameState.playerName[game.public.gameState.playerTurn];
  game.public.message = `it's ${player_name} turn`;

  return game;
};

const makeMove = async (gameId, playerId, x, y) => {
  let game;
  if (gameId.public) {
    game = gameId;
    gameId = game.public.gameId;
  }
  else {
    game = await GamesColl.findOne({_id: new ObjectId(gameId)});
    if (!game) {
      return {
        error: "game does not exists"
      };
    }
  }

  const board = new Board(game);
  if (!board.isMoveAllowed(playerId, x, y)) {
    return {
      error: board.getError()
    };
  }

  // update pawn position
  game.public.gameState.pawns[playerId].x = x;
  game.public.gameState.pawns[playerId].y = y;
  
  // add move history
  game.public.gameState.history.push({
    action: 'move',
    player: playerId,
    x, y
  });

  // swap players
  game = swapPlayer(game);

  // check if move is a win
  const isWin = ('p1' === playerId && 8 === +x) || ('p2' === playerId && 0 === +x);
  if (isWin) {
    const player_name = game.public.gameState.playerName[playerId];
    game.public.message = `game is finished, and ${player_name} won.`;

    game.public.gameState.winner = game.public.gameState.playerName[playerId];
    await User.setCurrentlyPlaying(game.private.players.playerOne, 0);
    await User.setCurrentlyPlaying(game.private.players.playerTwo, 0);
  }

  const res = await GamesColl.replaceOne({_id: new ObjectId(gameId)}, game);
  if (res.modifiedCount !== 1) {
    return {
      error: 'failed to make a move'
    };
  }

  return game;
};

const makeWall = async (gameId, playerId, wall) => {
  let game = await GamesColl.findOne({_id: new ObjectId(gameId)});
  if (!game || !wall || !/^p[12]$/.test(playerId)) {
    return {
      error: "bad request"
    };
  }

  if (game.public.gameState.availableWalls[playerId] <= 0) {
    return {
      error: "no available walls"
    };
  }

  const board = new Board(game);

  if (!board.isWallAllowed(wall)) {
    return {
      error: board.getError()
    };
  }

  // decrease available walls by one
  game.public.gameState.availableWalls[playerId]--;


  // wall history
  game.public.gameState.history.push({
    action: 'wall',
    player: playerId,
    orientation: wall.orientation,
    x: wall.x,
    y: wall.y,
    w: wall.w
  });

  // save the wall
  game.public.gameState.walls[wall.orientation].push({
    x: wall.x,
    y: wall.y,
    w: wall.w
  });


  game = swapPlayer(game);

  const res = await GamesColl.replaceOne({_id: new ObjectId(gameId)}, game);

  if (res.modifiedCount !== 1) {
    return {
      error: 'failed to make a wall'
    };
  }

  return game;
};

const aiAction = async (gameId, playerId) => {
  const game = await GamesColl.findOne({_id: new ObjectId(gameId)});
  if (!game) {
    return {
      error: "game does not exists"
    };
  }

  const board = new Board(game);
  const path = board.shortestPath(playerId);
  if (null !== path && path[1]) {
    let t, p = path[1];
    //# handle pawn jum|diagonal cases
    if (p.pawn) {

      // player needs to move right
      if ('p1' === playerId) {
        if (!p.right && board.get(p.x + 1, p.y)) {
          p.x++;
        }
        // last move to win
        else if (p.x === 8 && (t = board.get(p.x, p.y - 1)) && !p.top) {
            p.y--;
        }
        else if (p.x === 8 && (t = board.get(p.x, p.y + 1)) && !p.bottom) {
          p.y++;
        }
        else {
          p = path[0];
          if ((t = board.get(p.x, p.y - 1)) && !p.top) {
            p.y--;
          }
          else if ((t = board.get(p.x, p.y + 1)) && !p.bottom) {
            p.y++;
          }
          else if ((t = board.get(p.x -1, p.y)) && !p.left) {
            p.x--;
          }
        }

      }
      // player needs to move left
      else {
        if (!p.left && board.get(p.x - 1, p.y)) {
          p.x--;
        }
        // last move to win
        else if (p.x === 0 && (t = board.get(p.x, p.y - 1)) && !p.top) {
            p.y--;
        }
        else if (p.x === 0 && (t = board.get(p.x, p.y + 1)) && !p.bottom) {
          p.y++;
        }
        else {
          p = path[0];
          if ((t = board.get(p.x, p.y - 1)) && !p.top) {
            p.y--;
          }
          else if ((t = board.get(p.x, p.y + 1)) && !p.bottom) {
            p.y++;
          }
          else if ((t = board.get(p.x + 1, p.y)) && !p.right) {
            p.x++;
          }
        }

      }
    }

    return await makeMove(game, playerId, p.x, p.y);
  }

  return {
    error: 'no move available'
  };
};







const find = async (gameId) => {
  return await GamesColl.findOne({_id: new ObjectId(gameId)});
};

const count = async (filter) => {
  return await GamesColl.countDocuments(filter);
};


module.exports = {
  find, count, create, join, getWaitingList, makeMove, makeWall, aiAction
};