(function() {
  if (!document.getElementById('page_main')) return;
  var 
    $availableGamesForm = document.getElementById('available_games_form'),
    $createGameForm = document.getElementById('create_game_form'),
    $noGames = document.getElementById('no_games'),
    $inpCreateGame = document.getElementById('inp_create_game'),
    socket = io();


  $createGameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var isValid = true;

    if ($inpCreateGame.value.trim().length === 0) {
      isValid = false;
      $inpCreateGame.classList.add('err');
    }

    if (isValid) {
      $createGameForm.submit();
    }
  }, false);

  $inpCreateGame.addEventListener('keyup', function (e) {
    if ($inpCreateGame.value.trim().length > 0) {
      $inpCreateGame.classList.remove('err');
    }
    else {
      $inpCreateGame.classList.add('err');
    }
  }, false);


  socket.on('av_game_add', function(g) {
    var 
      div = document.createElement('div'),
      h3 = document.createElement('h3'),
      btn = document.createElement('button');
    
    div.classList.add('game-box');

    h3.innerHTML = g.gameName;
    div.appendChild(h3);

    btn.innerHTML = 'Join';
    btn.setAttribute('type', 'submit');
    btn.setAttribute('name', 'game_id');
    btn.setAttribute('value', g.gameId);
    btn.setAttribute('id', 'g_'+g.gameId);
    btn.classList.add('button');
    div.appendChild(btn);


    $availableGamesForm.appendChild(div);
    $noGames.classList.add('hide');
  });

  socket.on('av_game_rm', function(id) {
    var btn = document.getElementById('g_'+id);
    if (btn) {
      $availableGamesForm.removeChild(btn.parentNode);
    }

    if (0 === document.getElementsByClassName('game-box').length) {
      $noGames.classList.remove('hide');
    }
    else {
      $noGames.classList.add('hide');
    }
  });
})();