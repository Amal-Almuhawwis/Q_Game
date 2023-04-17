(function() {
  if (!document.getElementById('page_signin')) return;
  
  var 
    $form = document.getElementById('signin_form'),
    $username = document.getElementById('username'),
    $password = document.getElementById('password');

  $form.addEventListener('submit', function(e) {
    e.preventDefault();
    var isValid = true;

    if ($username.value.trim().length === 0) {
      isValid = false;
      $username.focus();
    }
    else if ($password.value.trim().length === 0) {
      isValid = false;
      $password.focus();
    }

    if (isValid) {
      e.target.submit();
    }
  }, false);

  $username.addEventListener('keyup', function(e) {
    if ($username.value.trim().length === 0) {
      $username.classList.add('err');
    }
    else {
      $username.classList.remove('err');
    }
  }, false);
  $password.addEventListener('keyup', function(e) {
    if ($password.value.trim().length === 0) {
      $password.classList.add('err');
    }
    else {
      $password.classList.remove('err');
    }
  }, false);
})();