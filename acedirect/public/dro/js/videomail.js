let recordingPaused = false;

function setVideoSize() {
  const a1 = document.getElementById('greeting-controls');
  const a2 = document.getElementById('recording-timer-bar');
  const b = document.getElementById('footer-container-consumer');
  const top = a1.getBoundingClientRect().bottom || a2.getBoundingClientRect().bottom;
  const videoHeight = b.getBoundingClientRect().top - top;
  console.log(videoHeight);
  $('.video-element').height(videoHeight);

  // transition countdown page
    const navbar = document.getElementById('consumerNavbar');
    const countdownTop = navbar.getBoundingClientRect().bottom;
    const countdownHeight = b.getBoundingClientRect().top - countdownTop
    $('#countDownDiv').height(countdownHeight)
}

const selfVideo = document.querySelector('#selfVideo');
selfVideo.recTime = 0;
function startWebcam() {
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        selfVideo.srcObject = stream;
      })
      .catch((_error) => {
        console.log('Something went wrong!');
      });
  }
}

function startVideomail() {
  startWebcam();
  setVideoSize();
}

function gotoRecording() {
  $('#greetingDiv').hide();
  $('#countDownDiv').hide();
  $('#recordingDiv').show();
  startVideomail();
}

function countdown() {
  let s = $('#recordingCountdown').html();
  setTimeout(() => {
    if (s > 0) {
      s -= 1;
      $('#recordingCountdown').html(s);
      countdown(s);
    } else {
      gotoRecording();
    }
  }, 1000);
}

function gotoCountDown() {
  $('#greetingDiv').hide();
  $('#countDownDiv').show();
  countdown();
}

function skipGreeting() {
  gotoCountDown();
}

function goToCallPage() {
  window.location.href = './call';
}

$('#skipGreetingButton').on('click', () => {
  skipGreeting();
});

$('#custom-seekbar').on('click', function changeSeekbarTime(e) {
  const offset = $(this).offset();
  const left = (e.pageX - offset.left);
  const totalWidth = $('#custom-seekbar').width();
  const percentage = (left / totalWidth);
  const vidTime = $('#greetingVideo')[0].duration * percentage;
  $('#greetingVideo')[0].currentTime = vidTime;
});

$('#greetingPlayPauseBtn').on('click', () => {
  if (document.getElementById('greetingVideo').paused) {
    document.getElementById('greetingVideo').play();
  } else {
    document.getElementById('greetingVideo').pause();
  }
});

$('#greetingVideo')
  .on('play', (_evt) => {
    console.log('playing');
    $('#greetingVideo').attr('title', 'Pause Video');
    $('#greetingPlayPauseBtnIcon').removeClass('fa-play').addClass('fa-pause').attr('aria-label', 'Pause Greeting');
  })
  .on('pause', (_evt) => {
    console.log('pause');
    $('#greetingVideo').attr('title', 'Play Video');
    $('#greetingPlayPauseBtnIcon').removeClass('fa-pause').addClass('fa-play').attr('aria-label', 'Play Greeting');
  })
  .on('ended', (_evt) => {
    console.log('ended');
    gotoCountDown();
  })
  .on('timeupdate', (_evt) => {
    const cTime = $('#greetingVideo')[0].currentTime;
    const dur = $('#greetingVideo')[0].duration;
    const percentage = (cTime / dur) * 100;
    $('#custom-seekbar span').css('width', `${percentage}%`);
    const date = new Date(0);
    date.setSeconds(cTime); // specify value for SECONDS here
    const timeString = date.toISOString().substr(15, 4);
    $('#greetingCurrentTime').html(timeString);
  })
  .on('loadedmetadata', (_evt) => {
    const date = new Date(0);
    date.setSeconds($('#greetingVideo')[0].duration); // specify value for SECONDS here
    const timeString = date.toISOString().substr(15, 4);
    $('#greetingDuration').html(timeString);
  })
  .on('click', (_evt) => {
    if ($('#greetingVideo').get(0).paused === false) {
      $('#greetingVideo').get(0).pause();
    } else {
      $('#greetingVideo').get(0).play();
    }
  });

let recorder = null;
function startRecording() {
  recordingPaused = false;
  if (recorder == null) {
    // eslint-disable-next-line no-undef
    recorder = new RecordRTCPromisesHandler(selfVideo.srcObject, {
      type: 'video'
    });
    recorder.startRecording();
  }
}

function redirect() {
  const req = new XMLHttpRequest();
  req.open('GET', './logout', true);
  req.send();
  sessionStorage.clear();
  window.location = $('#redirectSiteURL').html();
}

function endVideomail() {
  if (selfVideo) {
    selfVideo.pause();
    selfVideo.src = '';
    if (selfVideo.srcObject) {
      selfVideo.srcObject.getTracks()[0].stop();
    }
  }

  $('#recordingDiv').hide();
  $('#goodbyeModal').modal();
  setTimeout(() => {
    redirect();
  }, 10000);
}

async function pauseAndShowModal() {
  await recorder.pauseRecording();
  selfVideo.pause();
  recordingPaused = true;
  $('#recordingTime').html((_index, html) => html.replace('Recording', 'Paused').replace('circle', 'pause'));
  $('#pauseModal').modal();
  // eslint-disable-next-line no-undef
  // openDialog('pauseModal', window);
}

$('#pauseAndShowModal').on('click', () => {
  pauseAndShowModal();
});

async function resumeAndCloseModal() {
  await recorder.resumeRecording();
  selfVideo.play();
  recordingPaused = false;
  $('#recordingTime').html((_index, html) => html.replace('Paused', 'Recording').replace('pause', 'circle'));
  $('#pauseModal').modal('toggle');
}

$('#resumeAndCloseModalButton').on('click', () => {
  resumeAndCloseModal();
});

async function sendVideomail() {
  console.log('sendVideomail');
  console.log(`selfVideo.currentTime${selfVideo.recTime}`);
  if (recorder != null) {
    await recorder.stopRecording();
    const blob = await recorder.getBlob();
    console.log(blob);
    const formData = new FormData();
    const file = new File([blob], 'videomailfile.webm', {
      type: 'video/webm'
    });
    formData.append('file', file);
    formData.append('duration', selfVideo.recTime);
    const request = new XMLHttpRequest();
    request.onreadystatechange = function readyStateChange() {
      if (request.readyState === 4 && request.status === 200) {
        console.log(window.location.href + request.responseText);
        endVideomail();
      }
    };
    endVideomail();
    request.open('POST', './videomailupload');
    request.send(formData);
  } else {
    console.log('Recorder never set up');
  }
}

function startVideomailTimer() {
  let rTime = 0;
  const maxTime = parseInt($('#maxTime').text(), 10);
  console.log(`maxTime ${maxTime}`);

  const d = new Date(0);
  d.setSeconds(maxTime); // specify value for SECONDS here
  const mTimeFormatted = d.toISOString().substr(15, 4);
  $('#recordingTime').html(`<i class='fa fa-circle' aria-hidden='true'></i> Recording  0:00 / ${mTimeFormatted}`);

  let lastAriaPercentage = 0;
  const recTimerInterval = setInterval(() => {
    if (!recordingPaused) {
      rTime += 0.1;
      const percentage = (rTime / maxTime) * 100;
      $('#recordingTimer span').css('width', `${percentage}%`);

      const intPercentage = Math.trunc(percentage);
      if ((intPercentage % 5 === 0) && (intPercentage > lastAriaPercentage)) {
        const percentComplete = `${intPercentage}% complete `;
        $('#recordingTimer').attr('aria-label', percentComplete);
        $('#recordingTimer').attr('aria-valuenow', intPercentage);
        lastAriaPercentage = intPercentage;

        console.log(percentComplete);
      }

      if (rTime % 1 !== 0) {
        selfVideo.recTime = rTime;
        const date = new Date(0);
        date.setSeconds(rTime); // specify value for SECONDS here
        const timeString = date.toISOString().substr(15, 4);
        $('#recordingTime').html(`<i class='fa fa-circle' aria-hidden='true'></i> Recording &nbsp;&nbsp; ${timeString} / ${mTimeFormatted}`);
        if (rTime > maxTime) {
          clearInterval(recTimerInterval);
          sendVideomail();
        }
      }
    }
  }, 100);
}

$('#selfVideo').on('play', (_evt) => {
  console.log('playing');
  startVideomailTimer();
  startRecording();
});

function logout() {
  console.log('logout');
  sessionStorage.clear();
  window.location.href = './logout';
}

$('#goodbyeExit').on('click', () => {
  logout();
});

setVideoSize();
window.addEventListener('resize', setVideoSize);
