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

let messageId = '#message';
const mobileDetect = () => {
  if (window.innerWidth > 500) {
    messageId = '#message';
  } else {
    messageId = '#message-mobile';
  }
};

window.addEventListener('load', () => {
  mobileDetect();
});

window.addEventListener('resize', () => {
  mobileDetect();
});

$(window).on('load', () => {
  fnBrowserDetect();
  $('[data-mask]').inputmask();
  $('#form-login').submit((evt) => {
    evt.preventDefault();
    $(messageId).hide();
    $(messageId).text('');
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
            $(messageId).text(`${data.message} ${$('#vrs_number').val()}`);
            $(messageId).css({ color: 'red' });
            $(messageId).show();
          }
        },
        error(xhr, _status, _error) {
          if (xhr.responseJSON && xhr.responseJSON.message === 'Number blocked') {
            window.location = xhr.responseJSON.redirectUrl;
          } else {
            $(messageId).text('An Error Occured.');
            $(messageId).show();
          }
        }
      });
    } else {
      $('#input-group').addClass('has-error');
      $(messageId).text('Invalid phone number format');
      $(messageId).css({ color: 'red' });
      $(messageId).show();
    }
  });
});

$(document).ready(() => {
  $('#notChromeModal').on('shown.bs.modal', () => {
    window.openDialog('notChromeModal', window);
  });

  $('#notChromeModal').on('hidden.bs.modal', () => {
    window.removeFocus();
  });
});

function hideMessage() {
  $(messageId).hide();
}

function login() {
  $(messageId).hide();
  $(messageId).text('');
  $('#input-group').removeClass('has-error');
  hideMessage();
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
          $(messageId).text(`${data.message} ${$('#vrs_number').val()}`);
          $(messageId).css({ color: 'red' });
          $(messageId).show();
        }
      },
      error(xhr, _status, _error) {
        if (xhr.responseJSON && xhr.responseJSON.message === 'Number blocked') {
          window.location = xhr.responseJSON.redirectUrl;
        } else {
          $(messageId).text('An Error Occured.');
          $(messageId).css({ color: 'red' });
          $(messageId).show();
        }
      }
    });
  } else {
    $('#input-group').addClass('has-error');
    $(messageId).text('Invalid phone number');
    $(messageId).css({ color: 'red' });
    $(messageId).show();
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
