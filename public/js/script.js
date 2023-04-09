(function() {
  

  //# signin page
  (function(){
    if (!document.getElementById('signin_form')) return;

    document.getElementById('signin_btn').addEventListener('click', function(e) {
      e.preventDefault();
      var valid_form = true,
        username_inp = document.getElementById('username'),
        password_inp = document.getElementById('password');
  
      // {4,19} must not contain any whitespace
      if (!(/^[a-z][a-z0-9]{4,19}$/i.test(username_inp.value.trim()))) {
        valid_form = false;
        username_inp.style.borderColor = 'red';
      }
      if (password_inp.value.trim().length < 8) {
        valid_form = false;
      }
  
      if (valid_form) {
        console.log('form is valid');
        document.getElementById('signin_form').submit();
      }
    }, false);

  })();


  //# signup page
  (function() {

  })();

  

})();