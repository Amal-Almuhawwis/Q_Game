(function() {
  if (!document.getElementById('page_signin')) return;
  
  var 
    $signinForm = document.getElementById('signin_form'),
    $usernameInp = document.getElementById('username'),
    $passwordInp = document.getElementById('password');

  $signinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var isValid = true;

    if ($usernameInp.value.trim().length === 0) {
      isValid = false;
      $usernameInp.classList.add('err');
      $usernameInp.focus();
    }
    else if ($passwordInp.value.trim().length === 0) {
      isValid = false;
      $passwordInp.classList.add('err');
      $passwordInp.focus();
    }

    if (isValid) {
      $signinForm.submit();
    }
  }, false);

  $usernameInp.addEventListener('keyup', function(e) {
    if ($usernameInp.value.trim().length === 0) {
      $usernameInp.classList.add('err');
    }
    else {
      $usernameInp.classList.remove('err');
    }
  }, false);
  $passwordInp.addEventListener('keyup', function(e) {
    if ($passwordInp.value.trim().length === 0) {
      $passwordInp.classList.add('err');
    }
    else {
      $passwordInp.classList.remove('err');
    }
  }, false);
})();