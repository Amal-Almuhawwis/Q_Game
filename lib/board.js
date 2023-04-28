class Board {
  constructor(game) {
    this.board = [];
    for (let x = 0; x < 9; x++) {
      this.board[x] = [];
      for (let y = 0; y < 9; y++) {
        this.board[x][y] = {
          left: 0 === x,
          top: 0 === y,
          right: 8 === x,
          bottom: 8 === y
        };
  
        if (game.public.gameState.pawns.p1.x === x && game.public.gameState.pawns.p1.y === y) {
          this.board[x][y].pawn = 'p1';
          this.p1 = { x: x, y: y };
        }
        else if (game.public.gameState.pawns.p2.x === x && game.public.gameState.pawns.p2.y === y) {
          this.board[x][y].pawn = 'p2';
          this.p2 = { x: x, y: y };
        }
      }
    }
  
    for (let w, i = 0; i < game.public.gameState.walls.h.length; i++) {
      w = game.public.gameState.walls.h[i];
      this.board[w.x][w.y].bottom = true;
      this.board[w.x][w.y + 1].top = true;
      this.board[w.w][w.y].bottom = true;
      this.board[w.w][w.y + 1].top = true;
    }
  
    for (let w, i = 0; i < game.public.gameState.walls.v.length; i++) {
      w = game.public.gameState.walls.v[i];
      this.board[w.x][w.y].right = true;
      this.board[w.x + 1][w.y].left = true;
      this.board[w.x][w.w].right = true;
      this.board[w.x + 1][w.w].left = true;
    }

    this.user1 = game.public.gameState.playerName.p1;
    this.user2 = game.public.gameState.playerName.p2;
  }

  getError() {
    return this.error;
  }

  isMoveAllowed(playerId, x, y) {
      // move is out of bound or invalid playerId
    if (x < 0 || x > 8 || y < 0 || y > 8 || !/^p[12]$/.test(playerId)) {
      this.error = 'move is on non-existing square';
      return false;
    }

    const otherPlayer = 'p1' === playerId ? 'p2': 'p1';

    const curX = this[playerId].x;
    const curY = this[playerId].y;

    const xMove = Math.abs(curX - x);
    const yMove = Math.abs(curY - y);

    //# move left
    if (0 === yMove && curX > x) {
          // current square does not contain a wall at left
      if (!this.board[curX][curY].left && 
          // there is a square at the left
          this.board[curX -1][curY] && 
          // the square at the left does not contain a wall at the right position
          !this.board[curX -1][curY].right) {

        
            // single move
        if (1 === xMove && 
            // the square at the left does not contain a pawn for other player
            !this.board[curX -1][curY].pawn) {
          return true;
        }
                // double move
        else if (2 === xMove &&
                // the square at the left contains the other player pawn
                otherPlayer === this.board[curX -1][curY].pawn && 
                // the square at the left does not contain a wall at the left
                !this.board[curX -1][curY].left &&
                // the desired square exists
                this.board[curX - 2][curY] &&
                // the desired square does not contain a wall at the right
                !this.board[curX - 2][curY].right &&
                !this.board[curX - 2][curY].pawn) {
          return true;
        }
      }
    }
    //# move right
    else if (0 === yMove && curX < x) {
      // current square does not contains a wall at the right
      if (!this.board[curX][curY].right && 
          // there is a square at the right
          this.board[curX +1][curY] && 
          // the square at the right does not contain a wall at the left position
          !this.board[curX +1][curY].left) {

        
            // single move
        if (1 === xMove && 
            // the square at the right does not contain a pawn for other player
            !this.board[curX +1][curY].pawn) {
          return true;
        }
                // double move
        else if (2 === xMove &&
                // the square at the right contains the other player pawn
                otherPlayer === this.board[curX +1][curY].pawn && 
                // the square at the right does not contain a wall at the right
                !this.board[curX +1][curY].right &&
                // the desired square exists
                this.board[curX + 2][curY] &&
                // the desired square does not contain a wall at the right
                !this.board[curX + 2][curY].left &&
                !this.board[curX + 2][curY].pawn) {
          return true;
        }
      }

    }
    //# move top
    else if (0 === xMove && curY > y) {
      if (!this.board[curX][curY].top && 
          this.board[curX][curY - 1] && 
          !this.board[curX][curY - 1].bottom) {


        if (1 === yMove && !this.board[curX][curY - 1].pawn) {
          return true;
        }
        else if (2 === yMove &&
                otherPlayer === this.board[curX][curY - 1].pawn &&
                !this.board[curX][curY - 1].top &&
                this.board[curX][curY - 2] &&
                !this.board[curX][curY - 2].bottom &&
                !this.board[curX][curY - 2].pawn) {
          return true;
        }
      }
    }
    //# move bottom
    else if (0 === xMove && curY < y) {
      if (!this.board[curX][curY].bottom &&
          this.board[curX][curY + 1] &&
          !this.board[curX][curY + 1].top) {


        if (1 === yMove && !this.board[curX][curY + 1].pawn) {
          return true;
        }
        else if (2 === yMove &&
                otherPlayer === this.board[curX][curY + 1].pawn &&
                !this.board[curX][curY + 1].bottom &&
                this.board[curX][curY + 2] &&
                !this.board[curX][curY + 2].top &&
                !this.board[curX][curY + 2].pawn) {
          return true;
        }
      }
    }
    //# diagonal move
    else if (1 === xMove && 1 === yMove) {

      const othX = this[otherPlayer].x;
      const othY = this[otherPlayer].y;
      const othB = this.board[othX][othY];

      //# top-right
      if (curX < x && curY > y) {
        // allowed if
        // # opponent at the top square and top square contains wall at top and no wall right
        if ((curX === othX) &&  (curY > othY) &&
            othB.top && !othB.right) {
          return true;
        }
        // # opponent at the right square and it contains a wall at the right and no wall at the top
        else if ((curX < othX) && (curY === othY) &&
                  othB.right && !othB.top) {
          return true;
        }
      }
      //# top-left
      else if (curX > x && curY > y) {
        // # opponent at the top square and top square contains wall at top and no wall left
        if ((curX === othX) &&  (curY > othY) &&
            othB.top && !othB.left) {
          return true;
        }
        // # opponent at the left square and it contains a wall at the left and no wall at the top
        else if ((curX > othX) && (curY === othY) &&
                othB.left && !othB.top) {
          return true;
        }

      }
      //# bottom-right
      else if (curX < x && curY < y) {
        // # opponent at the bottom square and contains a wall at bottom and no wall at right
        if ((curX === othX) && (curY < othY) && 
            othB.bottom && !othB.right) {
          return true;
        }
        // # opponent at the right square and contains a wall at the right and no wall at bottom
        else if ((curX < othX) && (curY === curY) && 
                  othB.right && !othB.bottom) {
          return true;
        }
      }
      //# bottom-left
      else if (curX > x && curY < y) {
        // # opponent at the bottom square and contains a wall at bottom and no wall at left
        if ((curX === othX) && (curY < othY) && 
            othB.bottom && !othB.left) {
          return true;
        }
        // # opponent at the left square and contains a wall at the left and no wall at bottom
        else if ((curX > othX) && (curY === curY) && 
                  othB.left && !othB.bottom) {
          return true;
        }
      }

    }

    this.error = 'invalid move';
    return false;
  }

  isWallAllowed(wall) {
    // validate required wall information
    if (!wall || !/^[hv]$/.test(wall.orientation) ||
      undefined === wall.x || undefined === wall.y || undefined === wall.w ||
      wall.x < 0 || wall.y < 0 ||
      ('h' === wall.orientation && (wall.x > 8 || wall.y > 7) && 1 !== (wall.w - wall.x)) ||
      ('v' === wall.orientation && (wall.x > 7 || wall.y > 8) && 1 !== (wall.w - wall.y))) {
      this.error = 'invalid wall';
      return false;
    }

    // validate intersecting walls
    if (('h' === wall.orientation && this.board[wall.x][wall.y].right && this.board[wall.w][wall.y].right) ||
        ('v' === wall.orientation && this.board[wall.x][wall.y].bottom && this.board[wall.x][wall.w].bottom)) {
      const dir = 'h' === wall.orientation ? 'vertical' : 'horizontal';
      this.error = `wall will intersect with a ${dir} wall`;
      return false;
    }

    // apply the wall to current board
    if ('h' === wall.orientation) {
      this.board[wall.x][wall.y].bottom = true;
      this.board[wall.x][wall.y + 1].top = true;
      this.board[wall.w][wall.y].bottom = true;
      this.board[wall.w][wall.y + 1].top = true;
    }
    else {
      this.board[wall.x][wall.y].right = true;
      this.board[wall.x + 1][wall.y].left = true;
      this.board[wall.x][wall.w].right = true;
      this.board[wall.x + 1][wall.w].left = true;
    }
    
    // wall will constrict a player 
    if (null === this.shortestPath('p1')) {
      this.error = `wall will constrict ${this.user1}`;
      return false;
    }
    else if (null === this.shortestPath('p2')) {
      this.error = `wall will constrict ${this.user2}`;
      return false;
    }

    return true;
  }

  _cloneBoard() {
    let _board = [];
    for (let x = 0; x < 9; x++) {
      _board[x] = [];
      for (let y = 0; y < 9; y++) {
        _board[x][y] = {
          x: x, y: y, distance: 81, parent: null
        };

        _board[x][y].left    = this.board[x][y].left;
        _board[x][y].top     = this.board[x][y].top;
        _board[x][y].right   = this.board[x][y].right;
        _board[x][y].bottom  = this.board[x][y].bottom;

        _board[x][y].pawn    = this.board[x][y].pawn;
      }
    }
    return _board;
  }

  _visit(node, q) {
    if (!q) return null;

    if ((node.distance + 1) < q.distance) {
      q.distance = node.distance + 1;
      q.parent = node;
      return q;
    }
    return null;
  }

  shortestPath(playerId) {
    let _board = this._cloneBoard();
    let Q = [];
    let node;
    const destX = 'p1' === playerId ? 8 : 0;
    let final = null;

    // set the distance to 0 for the start node
    _board[this[playerId].x][this[playerId].y].distance  = 0;

    Q.push(_board[this[playerId].x][this[playerId].y]);
    while (Q.length > 0) {
      // remove first node from the queue
      node = Q.shift();

      // reach the desired edge
      if (node.x === destX) {
        final = node;
        break;
      }

      let n;
      // visit top
      if ((node.y - 1) >= 0 && !node.top) {
        if ((n = this._visit(node, _board[node.x][node.y - 1])) && !n.pawn) {
          Q.push(n);
        }
      }

      // visit bottom
      if ((node.y + 1) < 9 && !node.bottom) {
        if ((n = this._visit(node, _board[node.x][node.y + 1])) && !n.pawn) {
          Q.push(n);
        }
      }

      // visit right
      if ((node.x + 1) < 9 && !node.right) {
        if ((n = this._visit(node, _board[node.x + 1][node.y])) && !n.pawn) {
          Q.push(n);
        }
      }

      // visit left
      if ((node.x - 1) >= 0 && !node.left) {
        if ((n = this._visit(node, _board[node.x - 1][node.y])) && !n.pawn) {
          Q.push(n);
        }
      }
    }

    if (null === final) {
      return null;
    }

    let path = [];
    do {
      path.unshift(final);
    } while ((final = final.parent) !== null);
    return path;
  }

};


module.exports = Board;