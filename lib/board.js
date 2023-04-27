class Board {
    constructor(game) {
      this.game = game;
      this.board = [];
      for (let x = 0; x < 9; x++) {
        this.board[x] = [];
        for (let y = 0; y < 9; y++) {
          this.board[x][y] = {
            left: 0 === x,
            right: 8 === x,
            top: 0 === y,
            bottom: 8 === y
          };
    
          if (game.public.gameState.pawns.p1.x === x && game.public.gameState.pawns.p1.y === y) {
            this.board[x][y].pawn = 'p1';
          }
          else if (game.public.gameState.pawns.p2.x === x && game.public.gameState.pawns.p2.y === y) {
            this.board[x][y].pawn = 'p2';
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
  
      const curX = this.game.public.gameState.pawns[playerId].x;
      const curY = this.game.public.gameState.pawns[playerId].y;
  
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
      //# invalid move [diagonal move is not allowed]
      else {
        this.error = 'diagonal moves are not allowed';
        return false;
      }
  
      this.error = 'invalid move';
      // return invalid move
      return false;
    }
  
    isWallAllowed(playerId, wall) {
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
        return false;
      }
  
      return true;
    }
  
    shortestPath() {
      
    }
  
  };
  
  
  module.exports = Board;