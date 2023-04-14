(function() {
  if (!document.getElementById('page_board')) return;

  var 
    PlayerID, isMyTurn,
    HAS_PAWN = 'has_pawn',
    HOVER = 'hov',
    SQUARE = 'square',
    WALL = 'wall',
    VERTICAL = 'v',
    HORIZONTAL = 'h',
    socket = io();

  // generate square id from x,y position
  function c_square(x, y) {
    // square_0x0
    // square_0x1
    // ....
    return SQUARE + '_' + x + 'x' + y;
  }

  // generate wall id from orientation and x,y position
  function c_wall(dir, x, y) {
    // wall_v_0x0
    // wall_h_0x0
    // ....
    return WALL + '_' + dir + '_' + x + 'x' + y;
  }

  // helper function to remove hover class from all rect
  function removeHover() {
    Array.from(document.querySelectorAll('rect.'+HOVER)).forEach(function(elem) {
      elem.removeAttribute('data-player');
      elem.classList.remove(HOVER);
    });
  }

  // helper function to create rect element
  function createSquare(x, y) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.id = c_square(x, y);

    rect.setAttribute('width', '8');
    rect.setAttribute('height', '8');
    rect.setAttribute('x', x * 10);
    rect.setAttribute('y', y * 10);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'blue');
    rect.setAttribute('stroke-width', '.5');
    rect.classList.add(SQUARE);
    rect.addEventListener('click', function(e) {
      var pawn, player, pawn_x, pawn_y;
      //TODO:: check if user is allowed to make a move
      // move the pawn if click on an active(has hover) rect
      if (isMyTurn && rect.classList.contains(HOVER) && (player = rect.getAttribute('data-player'))) {
        pawn = document.getElementById(player);
        // find pawn current position
        pawn_x = +pawn.getAttribute('data-x');
        pawn_y = +pawn.getAttribute('data-y');

        // remove has_pawn from current pawn square
        document.getElementById(c_square(pawn_x, pawn_y)).classList.remove(HAS_PAWN);

        // set the new pawn position
        pawn.setAttribute('data-x', x);
        pawn.setAttribute('data-y', y);
        // move the pawn to the new position
        pawn.setAttribute('cx', x * 10 + 4);
        pawn.setAttribute('cy', y * 10 + 4);
        rect.classList.add(HAS_PAWN);

        socket.emit('move', {player: PlayerID, x, y});
      }
      // make sure to remove all hover effect
      removeHover();
    }, false);

    return rect;
  }

  // find the wall sibling,
  // if current wall at the end will return the previous one
  function findWallSibling(dir, pos_x, pos_y) {
    var sibling;
    if (VERTICAL === dir) {
      // find next available wall
      sibling = document.getElementById( c_wall(VERTICAL, pos_x, pos_y + 1));
      // check if wall exists, and is not active
      if (!sibling || sibling.classList.contains('active')) {
        sibling = document.getElementById( c_wall(VERTICAL, pos_x, pos_y -1));
      }
    }
    else {
      sibling = document.getElementById(c_wall(HORIZONTAL, pos_x + 1, pos_y));
      if (!sibling || sibling.classList.contains('active')) {
        sibling = document.getElementById(c_wall(HORIZONTAL, pos_x - 1, pos_y));
      }
    }
    // make sure to not apply hover to an active wall
    if (sibling && sibling.classList.contains('active')) {
      sibling = null;
    }
    return sibling;
  }

  // create a gap between squares, to draw walls on it
  function createWallHolder(x, y, dir) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.id = c_wall(dir, x, y);

    rect.setAttribute('width', VERTICAL === dir ? '2' : '8');
    rect.setAttribute('height', VERTICAL === dir ? '8' : '2');
    rect.setAttribute('x', VERTICAL === dir ? (x * 10 + 8) : (x * 10));
    rect.setAttribute('y', VERTICAL === dir ? (y * 10) : (y * 10 + 8));
    rect.classList.add(WALL);

    // semulate hover effect
    rect.addEventListener('mouseenter', function(e){
      var sibling;
      if (isMyTurn && !rect.classList.contains('active')) {
        if ((sibling = findWallSibling(dir, x, y))) {
          sibling.classList.add(HOVER);
        }
        rect.classList.add(HOVER);
      }
    }, false);
    rect.addEventListener('mouseleave', function(e){
      var sibling;
      if (isMyTurn && !rect.classList.contains('active')) {
        if ((sibling = findWallSibling(dir, x, y))) {
          sibling.classList.remove(HOVER);
        }
        rect.classList.remove(HOVER);
      }
    }, false);

    // draw the wall if applicable
    rect.addEventListener('click', function() {
      //TODO:: check if user can draw a wall first
      var sibling;
      if (isMyTurn && !rect.classList.contains('active')) {
        if ((sibling = findWallSibling(dir, x, y))) {
          sibling.classList.add('active');
        }
        rect.classList.add('active');

        socket.emit('wall', {player: PlayerID, orientation: dir, x, y});
      }
      removeHover();
    }, false);

    return rect;
  }

  // draw a pawn in x,y position
  function createPawn(pos_x, pos_y, player) {
    var pawn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pawn.id = player;
    pawn.setAttribute('r', '3');
    pawn.setAttribute('cx', pos_x * 10 + 4);
    pawn.setAttribute('cy', pos_y * 10 + 4);
    pawn.setAttribute('data-x', pos_x);
    pawn.setAttribute('data-y', pos_y);

    // mark the square as contain a pawn
    document.getElementById(c_square(pos_x, pos_y)).classList.add(HAS_PAWN);

    // find available moves to the selected pawn
    pawn.addEventListener('click', function() {
      if (!isMyTurn || PlayerID !== player) return;

      var sibling, wall,
        x = +pawn.getAttribute('data-x'),
        y = +pawn.getAttribute('data-y');
      //# top
      if ((sibling = document.getElementById( c_square(x, y -1))) && !sibling.classList.contains(HAS_PAWN)) {
        if (!(wall = document.getElementById(c_wall(HORIZONTAL, x, y -1))) || !wall.classList.contains('active')) {
          sibling.classList.add(HOVER);
          sibling.setAttribute('data-player', player);
        }
      }
      //# right
      if ((sibling = document.getElementById(c_square(x + 1, y))) && !sibling.classList.contains(HAS_PAWN)) {
        if (!(wall = document.getElementById(c_wall(VERTICAL, x, y))) || !wall.classList.contains('active')) {
          sibling.classList.add(HOVER);
          sibling.setAttribute('data-player', player);
        }
      }
      //# bottom
      if ((sibling = document.getElementById(c_square(x, y + 1))) && !sibling.classList.contains(HAS_PAWN)) {
        if (!(wall = document.getElementById(c_wall(HORIZONTAL, x, y))) || !wall.classList.contains('active')) {
          sibling.classList.add(HOVER);
          sibling.setAttribute('data-player', player);
        }
      }
      //# left
      if ((sibling = document.getElementById(c_square(x - 1, y))) && !sibling.classList.contains(HAS_PAWN)) {
        if (!(wall = document.getElementById(c_wall(VERTICAL, x-1, y))) || !wall.classList.contains('active')) {
          sibling.classList.add(HOVER);
          sibling.setAttribute('data-player', player);
        }
      }

    }, false);
    
    return pawn;
  }

  function createBoard(game) {
    var old_svg,
      size = Math.min(window.innerWidth, window.innerHeight) - 80,
      container = document.getElementById('game_container'),
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'game_board';
    svg.setAttribute('viewBox', '-.5 -.5 88.5 88.5');
    svg.setAttribute('width', size +'px');
    svg.setAttribute('height', size +'px');

    // build the board
    for (var x = 0; x < 9; x++) {
      for (var y = 0; y < 9; y++) {
        //# build squares
        svg.appendChild(createSquare(x, y));
        //# build Vertical walls
        if (x < 8) {
          svg.appendChild(createWallHolder(x, y, VERTICAL));
        }
        //# build Horizontal walls
        if (y < 8) {
          svg.appendChild(createWallHolder(x, y, HORIZONTAL));
        }
      }
    }

    // remove old svg#game_board if exists
    if ((old_svg = document.getElementById('game_board'))) {
      container.removeChild(old_svg);
    }
    // append new game board
    container.appendChild(svg);

    if (game) {
      svg.appendChild(createPawn(game.gameStatus.pawns.p1.x, game.gameStatus.pawns.p1.y, 'p1'));
      svg.appendChild(createPawn(game.gameStatus.pawns.p2.x, game.gameStatus.pawns.p2.y, 'p2'));
    }
  }

  socket.emit('join');
  socket.on('init', function (id) {
    PlayerID = id;
  });

  socket.on('waiting', function () {
    console.log('waiting for player to join the room');
  });

  socket.on('start', function (game) {  
    isMyTurn = game.gameStatus.playerTurn === PlayerID;
    createBoard(game);
  });

  socket.on('update', function (game) {
    isMyTurn = game.gameStatus.playerTurn === PlayerID;
    createBoard(game);
  });

})();