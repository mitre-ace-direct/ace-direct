function fnBrowserDetect() {
  const { userAgent } = navigator;
  let isChrome = false;
  let browserName;
  console.log(`BROWSER IS ${userAgent}`);

  if (userAgent.match(/chrome|chromium|crios/i)) {
    isChrome = true;
  } else if (userAgent.match(/firefox|fxios/i)) {
    browserName = 'Firefox';
  } else if (userAgent.match(/safari/i)) {
    browserName = 'Safari';
  } else if (userAgent.match(/opr\//i)) {
    browserName = 'Opera';
  } else if (userAgent.match(/edg/i)) {
    browserName = 'Edge';
  } else {
    browserName = 'Unknown Browser';
  }

  if (!isChrome) {
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

function copyURL() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    /* clipboard write success */
    $('#clipboardStatus').text('Successfully copied support portal link to clipboard.');
    $('#clipboardStatus').show();
  }, () => {
    /* clipboard write failure */
    $('#clipboardStatus').text('Error copying support portal link to clipboard.');
    $('#clipboardStatus').show();
  });
}

$('#continueButton').on('click', login);

$('#copy-btn').on('click', copyURL);

// Every time a modal is shown, if it has an autofocus element, focus on it.
$('#notChromeModal').on('shown.bs.modal', () => {
  $('#continue-btn').focus();
  console.log('shown.bs.modal');
});

// Add all the elements inside modal which you want to make focusable
const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const modal = document.querySelector('#notChromeModal'); // select the modal by it's id

// get first element to be focused inside modal
const firstFocusableElement = modal.querySelectorAll(focusableElements)[0];
const focusableContent = modal.querySelectorAll(focusableElements);
// Get last element to be focused inside modal
const lastFocusableElement = focusableContent[focusableContent.length - 1];

document.addEventListener('keydown', (e) => {
  const isTabPressed = e.key === 'Tab' || e.keyCode === 9;

  if (!isTabPressed) {
    return;
  }

  if (e.shiftKey) { // if shift key pressed for shift + tab combination
    if (document.activeElement === firstFocusableElement) {
      lastFocusableElement.focus(); // add focus for the last focusable element
      e.preventDefault();
    }
  } else if (document.activeElement === lastFocusableElement) {
    // if focused has reached to last focusable element then focus first focusable
    // element after pressing tab
    firstFocusableElement.focus(); // add focus for the first focusable element
    e.preventDefault();
  }
});

firstFocusableElement.focus();
