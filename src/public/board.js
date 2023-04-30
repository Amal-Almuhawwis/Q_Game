(function() {
  if (!document.getElementById('page_board')) return;

  var 
    PlayerID, isMyTurn, RemainingWalls, TimerIV,
    $gameContainer = document.getElementById('game_container'),
    isPlayBackMode = document.getElementsByClassName('playback-mode').length === 1 && $gameContainer && $gameContainer.getAttribute('data-gid'),
    TIMEOUT = 60,
    HAS_PAWN = 'has_pawn',
    HOVER = 'hov',
    SQUARE = 'square',
    WALL = 'wall',
    VERTICAL = 'v',
    HORIZONTAL = 'h',
    isTouchEnabled = ('ontouchstart' in window),
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
      if (isMyTurn && rect.classList.contains(HOVER) && (player = rect.getAttribute('data-player'))) {
        // make the move from the server
        socket.emit('move', {player: PlayerID, x, y});
        isMyTurn = false;
      }
      // make sure to remove all hover effect
      removeHover();
    }, false);

    return rect;
  }

  // check if horizontal wall intersect with a vertical wall or viceversa
  function isWallIntersecting(dir, x, y) {
    var elem1, elem2;
    if (VERTICAL === dir) {
      if ((elem1 = document.getElementById(c_wall('h', x, y))) && 
          (elem2 = document.getElementById(c_wall('h', x + 1, y))) &&
          elem1.classList.contains('active') &&
          elem2.classList.contains('active')) {
        return true;
      }
    }
    else {
      if ((elem1 = document.getElementById(c_wall('v', x, y))) && 
          (elem2 = document.getElementById(c_wall('v', x, y + 1))) &&
          elem1.classList.contains('active') &&
          elem2.classList.contains('active')) {
        return true;
      }
    }
    return false;
  }

  // find the wall sibling,
  // if current wall at the end will detect the previous one
  // method will return ordered by place pair of walls [rect0, rect1] or null
  function findWallSibling(dir, pos_x, pos_y, rect) {
    var sibling, isBefore = false, x = pos_x, y = pos_y;
    if (VERTICAL === dir) {
      // find next available wall
      sibling = document.getElementById( c_wall(VERTICAL, pos_x, pos_y + 1));
      // check if wall exists, and is not active
      if (!sibling || sibling.classList.contains('active') || isWallIntersecting(dir, x, y)) {
        sibling = document.getElementById( c_wall(VERTICAL, pos_x, pos_y -1));
        y--;
        isBefore = true;
      }
    }
    else {
      sibling = document.getElementById(c_wall(HORIZONTAL, pos_x + 1, pos_y));
      if (!sibling || sibling.classList.contains('active') || isWallIntersecting(dir, x, y)) {
        sibling = document.getElementById(c_wall(HORIZONTAL, pos_x - 1, pos_y));
        x--;
        isBefore = true;
      }
    }
    // make sure to not apply hover to an active wall
    if (sibling && (sibling.classList.contains('active') || isWallIntersecting(dir, x, y))) {
      sibling = null;
    }

    if (sibling) {
      if (isBefore) {
        return [sibling, rect];
      }
      return [rect, sibling];
    }
    return null;
  }

  // create a gap between squares, to draw walls on it
  function createWallHolder(x, y, dir) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.id = c_wall(dir, x, y);

    rect.setAttribute('width', VERTICAL === dir ? '2' : '8');
    rect.setAttribute('height', VERTICAL === dir ? '8' : '2');
    rect.setAttribute('x', VERTICAL === dir ? (x * 10 + 8) : (x * 10));
    rect.setAttribute('y', VERTICAL === dir ? (y * 10) : (y * 10 + 8));
    rect.setAttribute('data-x', x);
    rect.setAttribute('data-y', y);
    rect.setAttribute('data-o', dir);
    rect.classList.add(WALL);

    // semulate hover effect
    rect.addEventListener('mouseenter', function(e){
      var Rs;
      if (isMyTurn && RemainingWalls > 0 && 
        // current wallPlace is not assigned
        !rect.classList.contains('active') && 
        // find sibling and order with current rect
        (Rs = findWallSibling(dir, x, y, rect))) {

        Rs[0].classList.add(HOVER);
        Rs[1].classList.add(HOVER);
      }
    }, false);
    rect.addEventListener('mouseleave', function(e){
      var Rs;
      if (isMyTurn && RemainingWalls > 0 && !rect.classList.contains('active') && (Rs = findWallSibling(dir, x, y, rect))) {
        Rs[0].classList.remove(HOVER);
        Rs[1].classList.remove(HOVER);
      }
    }, false);

    // draw the wall if applicable
    rect.addEventListener('click', function() {
      var Rs, wall;
      if (isMyTurn && RemainingWalls > 0) {
        if (isTouchEnabled && !rect.classList.contains(HOVER)) {
          removeHover();
          if ((Rs = findWallSibling(dir, x, y, rect))) {
            Rs[0].classList.add(HOVER);
            Rs[1].classList.add(HOVER);    
          }
        }
        else if (!rect.classList.contains('active') && (Rs = findWallSibling(dir, x, y, rect))) {
          wall = {
            orientation: dir,
            // first item x
            x: +Rs[0].getAttribute('data-x'),
            // first item y
            y: +Rs[0].getAttribute('data-y'),
            // second item x|y [h|v]
            w: +Rs[1].getAttribute('data-' + (VERTICAL === dir ? 'y': 'x'))
          };
  
          // make the wall from the server
          socket.emit('wall', {player: PlayerID, wall: wall});
          isMyTurn = false;
  
          removeHover();
        }
        else {
          // make sure to remove any hover if not valid click
          removeHover();
        }
      }
    }, false);

    return rect;
  }


  // helper method to hover on allowed pawn move
  function applyHover(dir, player, x, y, sibling) {
    var wall,
      orientation = ['right', 'left'].indexOf(dir) > -1 ? VERTICAL : HORIZONTAL,
      _x = 'right' === dir ? x - 1 : x,
      _y = 'bottom' === dir ? y - 1 : y;
    if (sibling || (sibling = document.getElementById(c_square(x, y)))) {
      if (!(wall = document.getElementById(c_wall(orientation, _x, _y))) || !wall.classList.contains('active')) {
        sibling.classList.add(HOVER);
        sibling.setAttribute('data-player', player);
      }
      sibling = null;
    }
    return sibling;
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

      var sibling, wall, _x, _y,
        x = +pawn.getAttribute('data-x'),
        y = +pawn.getAttribute('data-y');


      //# top
      _x = x;
      _y = y - 1;
      if ((sibling = document.getElementById( c_square(_x, _y)))) {
        // top square contains the other player pawns
        if (sibling.classList.contains(HAS_PAWN)) {
          _y = y - 2;
          if (_y < 0) {
            sibling = applyHover('left', player, _x - 1, _y + 1);
            sibling = applyHover('right', player, _x + 1, _y + 1);
        }
          else if ((sibling = document.getElementById(c_square(_x, _y)))) {

            // the square on top of opponent pawn is blocked by a wall
            if ((wall = document.getElementById(c_wall(HORIZONTAL, _x, _y))) && wall.classList.contains('active')) {
              // find the square at the left
              sibling = applyHover('left', player, _x - 1, _y + 1);
              // find the square at the right
              sibling = applyHover('right', player, _x + 1, _y + 1);
            }
          }
        }

        if (sibling) {
          applyHover('top', player, _x, _y, sibling);
        }
      }

      //# bottom
      _x = x;
      _y = y + 1;
      if ((sibling = document.getElementById(c_square(_x, _y)))) {
        if (sibling.classList.contains(HAS_PAWN)) {
          _y = y + 2;
          if (_y > 8) {
            sibling = applyHover('left', player, _x - 1, _y -1);
            sibling = applyHover('right', player, _x + 1, _y -1);
        }
          else if ((sibling = document.getElementById(c_square(_x, _y)))) {
            // square below opponent pawn has a horizontal wall below
            if ((wall = document.getElementById(c_wall(HORIZONTAL, _x, _y - 1))) && wall.classList.contains('active')) {
              // find square at the left
              sibling = applyHover('left', player, _x - 1, _y -1);
              // square at the right
              sibling = applyHover('right', player, _x + 1, _y -1);
            }
          }
        }
        if (sibling) {
          applyHover('bottom', player, _x, _y, sibling);
        }
      }

      //# right
      _x = x + 1;
      _y = y;
      if ((sibling = document.getElementById(c_square(_x, _y)))) {
        if (sibling.classList.contains(HAS_PAWN)) {
          _x = x + 2;
          if (_x > 8) {
              // find square at the top
              sibling = applyHover('top', player, _x - 1, _y - 1);
              // find square at the bottom
              sibling = applyHover('bottom', player, _x - 1, _y + 1);
          }
          else if ((sibling = document.getElementById(c_square(_x, _y)))) {
            if ((wall = document.getElementById(c_wall(VERTICAL, _x - 1, _y))) && wall.classList.contains('active')) {
              // find square at the top
              sibling = applyHover('top', player, _x - 1, _y - 1);

              // find square at the bottom
              sibling = applyHover('bottom', player, _x - 1, _y + 1);
            }
          }
        }

        if (sibling) {
          applyHover('right', player, _x, _y, sibling);
        }
      }

      //# left
      _x = x - 1;
      _y = y;
      if ((sibling = document.getElementById(c_square(_x, _y)))) {
        if (sibling.classList.contains(HAS_PAWN)) {
          _x = x - 2;
          if (_x < 0) {
            sibling = applyHover('top', player, _x + 1, _y -1);
            sibling = applyHover('bottom', player, _x + 1, _y + 1);
          }
          else if ((sibling = document.getElementById(c_square(_x, _y)))) {
            if ((wall = document.getElementById(c_wall(VERTICAL, _x, _y))) && wall.classList.contains('active')) {
              // find square at the top
              sibling = applyHover('top', player, _x + 1, _y -1);

              // find square at the bottom
              sibling = applyHover('bottom', player, _x + 1, _y + 1);
            }
          }
        }

        if (sibling) {
          applyHover('left', player, _x, _y, sibling);
        }
      }

    }, false);
    
    return pawn;
  }

  function removeBoard() {
    var 
      svg = document.getElementById('game_board');

    if (svg) {
      $gameContainer.removeChild(svg);
    }
  }

  function setSVGDimen(svg) {
    svg = svg || document.getElementById('game_board');
    if (!svg) return;
    var 
      size = Math.min(window.innerWidth, window.innerHeight) - 40,
      header = document.getElementsByTagName('header')[0];

    if (header) {
      size -= header.clientHeight;
    }

    svg.setAttribute('width', size + 'px');
    svg.setAttribute('height', size + 'px');
  }

  function createBoard(game) {
    if (!game || !game.gameState) {
      return;
    }
    var
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'game_board';
    svg.setAttribute('viewBox', '-.5 -.5 89 89');

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

    // remove old svg [if exists] and append new game board
    removeBoard();
    $gameContainer.appendChild(svg);

    setSVGDimen(svg);

    //# draw horizontal walls
    for (var i = 0; i < game.gameState.walls.h.length; i++) {
      document.getElementById(c_wall('h', game.gameState.walls.h[i].x, game.gameState.walls.h[i].y)).classList.add('active');
      document.getElementById(c_wall('h', game.gameState.walls.h[i].w, game.gameState.walls.h[i].y)).classList.add('active');
    }

    //# draw vertical walls
    for (var i = 0; i < game.gameState.walls.v.length; i++) {
      document.getElementById(c_wall('v', game.gameState.walls.v[i].x, game.gameState.walls.v[i].y)).classList.add('active');
      document.getElementById(c_wall('v', game.gameState.walls.v[i].x, game.gameState.walls.v[i].w)).classList.add('active');
    }

    //# draw pawns
    svg.appendChild(createPawn(game.gameState.pawns.p1.x, game.gameState.pawns.p1.y, 'p1'));
    svg.appendChild(createPawn(game.gameState.pawns.p2.x, game.gameState.pawns.p2.y, 'p2'));
  }



  function setInfoWalls(p1, p2) {
    document.getElementById('p1_walls').innerHTML = 'Available Walls: <b>'+p1+'</b>';
    document.getElementById('p2_walls').innerHTML = 'Available Walls: <b>'+p2+'</b>';
  }

  function setInfoActive(player) {
    Array.from(document.querySelectorAll('.player_box')).forEach(function(box) {
      box.classList.remove('active');
      box.classList.remove('current');
    });
    var box = document.querySelectorAll('.player_box.'+player)[0];
    if (box) {
      box.classList.add('active');
    }
    if (isMyTurn) {
      box.classList.add('current');
    }
  }

  function setMessage(msg) {
    document.getElementById('message').innerHTML = msg;
  }

  function setInfoTimer(removeTimer) {
    if (TimerIV) clearInterval(TimerIV);
    var time = TIMEOUT,
    elem = document.getElementById('timer');

    if (removeTimer) {
      clearInterval(TimerIV);
      elem.innerHTML = '';
    }
    else {
      TimerIV = setInterval(() => {
        time--;
        if (time < 0) {
          clearInterval(TimerIV);
          // send timeout
          // to let the server make a random move for the other player
          if (!isMyTurn) {
            socket.emit('timeout', PlayerID);
          }
          return;
        }
        elem.innerHTML = time;
      }, 1000);
    }
  }

  function updateGlobals(game) {
    isMyTurn = game.gameState.playerTurn === PlayerID;
    RemainingWalls = game.gameState.availableWalls[PlayerID];
  }


  if (isPlayBackMode) {

    socket.emit('playback-join', $gameContainer.getAttribute('data-gid'));

    socket.on('playback-start', function (g) {
      var H = g.gameState.history, i = 0;
      
      setMessage('PlayBack for: <b>'+g.gameName+'</b>');
      TIMEOUT = 5;

      // reset game
      g.gameState.walls.v = [];
      g.gameState.walls.h = [];
      g.gameState.availableWalls.p1 = 6;
      g.gameState.availableWalls.p2 = 6;
      g.gameState.pawns.p1 = {x: 0, y: 4};
      g.gameState.pawns.p2 = {x: 8, y: 4};

      document.getElementById('p1_name').innerHTML = g.gameState.playerName.p1;
      document.getElementById('p2_name').innerHTML = g.gameState.playerName.p2;

      function play() {
        var I = H[i];
        if (I) {
          switch(I.action) {
            case 'move':
              g.gameState.pawns[I.player].x = I.x;
              g.gameState.pawns[I.player].y = I.y;
              break;
            case 'wall':
              g.gameState.availableWalls[I.player]--;
              g.gameState.walls[I.orientation].push({
                x: I.x,
                y: I.y,
                w: I.w
              });
              break;
          }
          isMyTurn = false;
          setInfoWalls(g.gameState.availableWalls.p1, g.gameState.availableWalls.p2);
          setInfoActive(I.player);
          setInfoTimer();
          setTimeout(() => {
            createBoard(g);
          }, 1000);
          setTimeout(play, TIMEOUT * 1000);
        }
        else {
          setInfoTimer(true);
          setMessage('<b>'+g.gameState.winner+'</b> won the game.');
        }
        i++;
      }
      play();
    });

  }
  else {

    socket.emit('join');
  
    socket.on('init', function (I) {
      PlayerID = I.player;
      TIMEOUT = I.timeout;
      RemainingWalls = 6;
    });
  
    socket.on('error', function (err) {
      setMessage(err);
    });
  
    socket.on('waiting', function (msg) {
      // load spinner to inform user is waiting player two to join
      setMessage(msg);
    });
  
    socket.on('start', function (game) {
      if (game.error) {
        return setInfoTimer(game.error);
      }
  
      updateGlobals(game);
      document.getElementById('p1_name').innerHTML = game.gameState.playerName.p1;
      document.getElementById('p2_name').innerHTML = game.gameState.playerName.p2;
      setInfoWalls(game.gameState.availableWalls.p1, game.gameState.availableWalls.p2);
      setInfoActive(game.gameState.playerTurn);
      createBoard(game);
      setInfoTimer();
      setMessage(game.message);
    });
  
    socket.on('update', function (game) {
      if (game.error) {
        return setInfoTimer(game.error);
      }
  
      updateGlobals(game);
  
      setInfoWalls(game.gameState.availableWalls.p1, game.gameState.availableWalls.p2);
      setInfoActive(game.gameState.playerTurn);
      createBoard(game);
      setInfoTimer();
      setMessage(game.message);
    });

    socket.on('invalid', function (I) {
      isMyTurn = I.player === PlayerID;
      setMessage(I.error);
    });
  
    socket.on('end', function (message) {
      setInfoTimer(true);
      setMessage(message);
      var a = document.createElement('a');
      a.setAttribute('href', window.location.href);
      a.innerHTML = 'Play again';
      removeBoard();
      $gameContainer.appendChild(a);
    });
  
  }


})();