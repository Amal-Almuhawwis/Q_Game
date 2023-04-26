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
        // pawn = document.getElementById(player);
        // // find pawn current position
        // pawn_x = +pawn.getAttribute('data-x');
        // pawn_y = +pawn.getAttribute('data-y');

        // // remove has_pawn from current pawn square
        // document.getElementById(c_square(pawn_x, pawn_y)).classList.remove(HAS_PAWN);

        // // set the new pawn position
        // pawn.setAttribute('data-x', x);
        // pawn.setAttribute('data-y', y);
        // // move the pawn to the new position
        // pawn.setAttribute('cx', x * 10 + 4);
        // pawn.setAttribute('cy', y * 10 + 4);
        // rect.classList.add(HAS_PAWN);

        // make the move from the server
        socket.emit('move', {player: PlayerID, x, y});
        isMyTurn = false;
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
    rect.setAttribute('data-x', x);
    rect.setAttribute('data-y', y);
    rect.setAttribute('data-o', dir);
    rect.classList.add(WALL);

    // semulate hover effect
    rect.addEventListener('mouseenter', function(e){
      var sibling;
      if (isMyTurn && RemainingWalls > 0 && !rect.classList.contains('active')) {
        if ((sibling = findWallSibling(dir, x, y))) {
          sibling.classList.add(HOVER);
        }
        rect.classList.add(HOVER);
      }
    }, false);
    rect.addEventListener('mouseleave', function(e){
      var sibling;
      if (isMyTurn && RemainingWalls > 0 && !rect.classList.contains('active')) {
        if ((sibling = findWallSibling(dir, x, y))) {
          sibling.classList.remove(HOVER);
        }
        rect.classList.remove(HOVER);
      }
    }, false);

    // draw the wall if applicable
    rect.addEventListener('click', function() {
      //TODO:: check if user can draw a wall first
      var sibling, walls;
      if (isMyTurn && RemainingWalls > 0 && !rect.classList.contains('active')) {
        walls = [{orientation: dir, x: x, y: y}];
        if ((sibling = findWallSibling(dir, x, y))) {
          //sibling.classList.add('active');
          walls.push({
            orientation: sibling.getAttribute('data-o'),
            x: sibling.getAttribute('data-x'),
            y: sibling.getAttribute('data-y')
          });
        }
        //rect.classList.add('active');

        // make the wall from the server
        socket.emit('wall', {player: PlayerID, walls: walls});
        isMyTurn = false;
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
    }

    //# draw vertical walls
    for (var i = 0; i < game.gameState.walls.v.length; i++) {
      document.getElementById(c_wall('v', game.gameState.walls.v[i].x, game.gameState.walls.v[i].y)).classList.add('active');
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
                y: I.y
              });
              break;
          }
          isMyTurn = false;
          setInfoWalls(g.gameState.availableWalls.p1, g.gameState.availableWalls.p2);
          setInfoActive(I.player);
          setInfoTimer();
          createBoard(g);
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