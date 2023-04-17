(function() {
  if (!document.getElementById('page_signup')) return;
  var 
    $signupForm = document.getElementById('signup_form'),
    $usernameInp = document.getElementById('username'),
    $passwordInp = document.getElementById('password'),
    $rePasswordInp = document.getElementById('repassword');

  $signupForm.addEventListener('submit', function (e) {
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
    else if ($rePasswordInp.value.trim().length === 0 ||
            $passwordInp.value !== $rePasswordInp.value) {
      isValid = false;
      $rePasswordInp.classList.add('err');
      $rePasswordInp.focus();
    }

    if (isValid) {
      $signupForm.submit();
    }
  }, false);


  $usernameInp.addEventListener('keyup', function (e) {
    if ($usernameInp.value.trim().length === 0) {
      $usernameInp.classList.add('err');
    }
    else {
      $usernameInp.classList.remove('err');
    }
  }, false);
  
  $passwordInp.addEventListener('keyup', function (e) {
    if ($passwordInp.value.trim().length === 0) {
      $passwordInp.classList.add('err');
    }
    else {
      $passwordInp.classList.remove('err');
    }
  }, false);

  $rePasswordInp.addEventListener('keyup', function (e) {
    if ($rePasswordInp.value.trim().length === 0 || 
        $passwordInp.value.trim() !== $rePasswordInp.value.trim()) {
      $rePasswordInp.classList.add('err');
    }
    else {
      $rePasswordInp.classList.remove('err');
    }
  }, false);

})();