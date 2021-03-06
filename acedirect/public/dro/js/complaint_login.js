function fnBrowserDetect() {
  const { userAgent } = navigator;
  let isChromeorEdge = false;
  let browserName;
  console.log(`BROWSER IS ${userAgent}`);

  if (userAgent.match(/chrome|chromium|crios/i)) {
    isChromeorEdge = true;
  } else if (userAgent.match(/firefox|fxios/i)) {
    browserName = 'Firefox';
  } else if (userAgent.match(/safari/i)) {
    browserName = 'Safari';
  } else if (userAgent.match(/opr\//i)) {
    browserName = 'Opera';
  } else if (userAgent.match(/edg/i)) {
    isChromeorEdge = true;
  } else {
    browserName = 'Unknown Browser';
  }

  if (!isChromeorEdge) {
    // show modal
    $('#browserType').text(browserName);
    $('#notChromeModal').modal('show');
  }
}

$(window).on('load', () => {
  fnBrowserDetect();
  $('[data-mask]').inputmask();
  $('#form-login').submit((evt) => {
    evt.preventDefault();
    $('#message').hide();
    $('#message').text('');
    $('#input-group').removeClass('has-error');
    const vrsnumber = $('#vrs_number').val().replace(/^1|[^\d]/g, '');
    if (vrsnumber.length === 10) {
      $.ajax({
        url: './consumer_login',
        data: {
          _csrf: '<%= csrfToken %>',
          vrsnumber
        },
        type: 'POST',
        dataType: 'json',
        success(data) {
          // alert(JSON.stringify(data));
          if (data.message === 'success') {
            // sessionStorage.accesstoken = data.token;
            window.location.reload();
          } else {
            $('#message').text(`${data.message} ${$('#vrs_number').val()}`);
            $('#message').show();
            $('#vrs_number').val('');
          }
        },
        error(xhr, _status, _error) {
          if (xhr.responseJSON && xhr.responseJSON.message === 'Number blocked') {
            window.location = xhr.responseJSON.redirectUrl;
          } else {
            $('#message').text('An Error Occured.');
            $('#message').show();
          }
        }
      });
    } else {
      $('#input-group').addClass('has-error');
      $('#message').text('Invalid phone number format');
      $('#message').show();
    }
  });
});

function login() {
  $('#message').hide();
  $('#message').text('');
  $('#input-group').removeClass('has-error');
  const vrsnumber = $('#vrs_number').val().replace(/^1|[^\d]/g, '');
  if (vrsnumber.length === 10) {
    $.ajax({
      url: './consumer_login',
      data: {
        _csrf: '<%= csrfToken %>',
        vrsnumber
      },
      type: 'POST',
      dataType: 'json',
      success(data) {
        // alert(JSON.stringify(data));
        if (data.message === 'success') {
          // sessionStorage.accesstoken = data.token;
          window.location.reload();
        } else {
          $('#message').text(`${data.message} ${$('#vrs_number').val()}`);
          $('#message').show();
          $('#vrs_number').val('');
        }
      },
      error(xhr, _status, _error) {
        if (xhr.responseJSON && xhr.responseJSON.message === 'Number blocked') {
          window.location = xhr.responseJSON.redirectUrl;
        } else {
          $('#message').text('An Error Occured.');
          $('#message').show();
        }
      }
    });
  } else {
    $('#input-group').addClass('has-error');
    $('#message').text('Invalid phone number');
    $('#message').css({ color: 'red' });
    $('#message').show();
  }
}

$('#continueButton').on('click', login);

function copyURL() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    /* clipboard write success */
  }, () => {
    /* clipboard write failure */
  });
}

$('#copy-btn').on('click', copyURL);
