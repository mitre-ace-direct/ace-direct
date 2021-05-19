let socket;
let sortFlag = 'id desc';
let filter = 'ALL';
const remoteView = document.getElementById('remoteView');

const videomailStatusButtons = document.getElementById('videomail-status-buttons');
let extensionMe;

function debugtxt(title, data) {
  console.log(`${title} ${JSON.stringify(data)}`);
}

// Videomail play button functionality
function PlayVideo() {
  console.log(`video paused: ${remoteView.paused}`);
  if (remoteView.paused === true) { // play the video
    remoteView.play();
    document.getElementById('play-video-icon').classList.remove('fa-play');
    document.getElementById('play-video-icon').classList.add('fa-pause');
  } else { // pause the video
    remoteView.pause();
    document.getElementById('play-video-icon').classList.add('fa-play');
    document.getElementById('play-video-icon').classList.remove('fa-pause');
  }
}

// Update the records in the videomail table
function updateVideomailTable(data) {
  $('#videomailTbody').html('');
  let table;
  let row;
  let numberCell;
  let receivedCell;
  let durationCell;
  let statusCell;
  let agentCell;

  for (let i = 0; i < data.length; i += 1) {
    const vidId = data[i].id;
    let vidNumber = data[i].callbacknumber;
    if (vidNumber) {
      vidNumber = vidNumber.toString();
      if (vidNumber[0] === '1') vidNumber = vidNumber.slice(1, vidNumber.length);
      vidNumber = `(${vidNumber.substring(0, 3)}) ${vidNumber.substring(3, 6)}-${vidNumber.substring(6, vidNumber.length)}`;
    }
    const vidReceived = moment.utc(data[i].received).local().format('ddd MM/DD/YYYY hh:mm A');
    const vidDuration = data[i].video_duration;
    const vidAgent = data[i].processing_agent;
    const vidStatus = data[i].status;
    const vidFilepath = data[i].video_filepath;
    const vidFilename = data[i].video_filename;
    table = document.getElementById('videomailTbody');

    row = table.insertRow(table.length);
    numberCell = row.insertCell(0);
    receivedCell = row.insertCell(1);
    durationCell = row.insertCell(2);
    agentCell = row.insertCell(3);
    statusCell = row.insertCell(4);
    const filepathCell = row.insertCell(5);
    filepathCell.setAttribute('hidden', true);
    const idCell = row.insertCell(6);
    idCell.setAttribute('hidden', true);

    filepathCell.innerHTML = vidFilepath + vidFilename;
    idCell.innerHTML = vidId;
    numberCell.innerHTML = vidNumber;
    receivedCell.innerHTML = vidReceived;
    durationCell.innerHTML = vidDuration;
    agentCell.innerHTML = vidAgent;

    if (vidStatus === 'UNREAD') statusCell.innerHTML = `<span style="font-weight:bold">${vidStatus}</span>`;
    else statusCell.innerHTML = vidStatus;
  }
}

// Update the time progress in the videomail seekbar
function updateVideoTime(time, elementId) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.round(time - minutes * 60);
  let timeStr = '';
  if (seconds < 10) {
    timeStr = `${minutes.toString()}:0${seconds.toString()}`;
  } else if (seconds === 60) {
    timeStr = `${(minutes + 1).toString()}:00`;
  } else {
    timeStr = `${minutes.toString()}:${seconds.toString()}`;
  }
  document.getElementById(elementId).innerHTML = timeStr;
}

// Display the videomail control buttons
function ToggleVideomailButtons(makeVisible) {
  if (makeVisible) videomailStatusButtons.style.display = 'block';
  else videomailStatusButtons.style.display = 'none';
}

// Marks the videomail read when the agent clicks it and doesn't close the videomail view
function VideomailReadOnclick(id) {
  socket.emit('videomail-read-onclick', {
    id,
    extension: extensionMe
  });
  console.log('Emitted a socket videomail-read-onclick');
}

function ChangePlayButton() {
  console.log('Video ended');
  document.getElementById('play-video-icon').classList.add('fa-play');
  document.getElementById('play-video-icon').classList.remove('fa-pause');
}

// More videomail functionality//Play the selected videomail
function playVideomail(id, duration, vidStatus) {
  console.log(`Playing video mail with id ${id}`);
  $('#videoBox').removeAttr('hidden');
  remoteView.removeAttribute('poster');
  remoteView.setAttribute('src', `./getVideomail?id=${id}&agent=${socket.id}`);
  remoteView.onended = ChangePlayButton();
  if (document.getElementById('play-video-icon').classList.contains('fa-pause')) {
    document.getElementById('play-video-icon').classList.add('fa-play');
    document.getElementById('play-video-icon').classList.remove('fa-pause');
  }
  ToggleVideomailButtons(true);
  updateVideoTime(duration, 'vmail-total-time');
  if (vidStatus === 'UNREAD') {
    VideomailReadOnclick(id);
  }
}

// Exit videomail view and return to call view
function stopVideomail() {
  console.log('Videomail view has been stopped');
  $('#videoBox').attr('hidden', true);
  remoteView.setAttribute('src', '');
  remoteView.removeAttribute('src');
  remoteView.removeAttribute('onended');
  remoteView.setAttribute('autoplay', 'autoplay');
  remoteView.setAttribute('poster', 'images/acedirect-logo.png');
  ToggleVideomailButtons(false);
}

function getVideomailRecs() {
  socket.emit('get-videomail', {
    extension: extensionMe,
    sortBy: sortFlag,
    filter
  });
  console.log('Sent a get-videomail event');
}

// Socket emit for changing status of a videomail
function VideomailStatusChange(videoStatus) {
  const id = document.getElementById('videomailId').getAttribute('name');
  socket.emit('videomail-status-change', {
    id,
    status: videoStatus
  });
  console.log('Emitted a socket videomail-status-change');
}

$('#ChangeVideomailStatus').on('click', 'li', function Selected() {
  const videoStatus = $(this).attr('value');

  VideomailStatusChange(videoStatus);
});

// Socket emit for deleting a videomail
// function VideomailDeleted(id) {
function VideomailDeleted() {
  const id = document.getElementById('videomailId').getAttribute('name');
  socket.emit('videomail-deleted', {
    id,
    extension: extensionMe
  });
  console.log('Emitted a socket videomail-deleted');
  stopVideomail();
}

$('#VideomailDelete').on('click', () => {
  VideomailDeleted();
});

$('#play-video').on('click', () => {
  PlayVideo();
});

function ConnectSocket() {
  $.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    success(successData) {
      if (successData.message === 'success') {
        socket = io.connect(`https://${window.location.host}`, {
          path: `${nginxPath}/socket.io`,
          query: `token=${successData.token}`,
          forceNew: true
        });

        socket.on('connect', () => {
          debugtxt('connect', {
            no: 'data'
          });

          $('#loginModal').modal('hide');

          $('#statusmsg').text(''); // clear status text

          socket.emit('register-manager', {
            hello: 'hello'
          });
          socket.emit('get-videomail', {
            sortBy: sortFlag,
            filter: 'ALL'
          });

          setInterval(() => {
            socket.emit('get-videomail', {
              sortBy: sortFlag,
              filter
            });
          }, 5000);

          ToggleVideomailButtons(false);
        })
          .on('got-videomail-recs', (data) => {
            updateVideomailTable(data);
          })
          .on('changed-status', () => {
            getVideomailRecs();
          })
          .on('videomail-retrieval-error', (data) => {
            $('#videomailErrorBody').html(`Unable to locate videomail with ID ${data}.`);
            $('#videomailErrorModal').modal('show');
            stopVideomail();
          })
          .on('videomail-status', (data) => {
            let showLabel = true;
            let dataToPlot = data;
            if (data.length === 0) {
              dataToPlot = [{ data: 1, label: 'No Messages' }];
              showLabel = false;
            }
            $.plot('#videomailStatusPieChart', dataToPlot, {
              series: {
                pie: {
                  show: true,
                  label: {
                    show: showLabel,
                    formatter(label, series) {
                      return (series.data[0][1]);
                    }
                  }
                },
                lines: {
                  show: true,
                  fill: true
                }
              },
              legend: {
                show: true,
                position: 'ne',
                noColumns: 2
              }
            });
          });
      } else {
        // TODO: handle bad connections
      }
    },
    error(_xhr, _status, _error) {
      console.log('Error');
      $('#message').text('An Error Occured.');
    }
  });
}

$(document).ready(() => {
  ConnectSocket();
});

// ####################################################################
// Videomail functionality: mostly sending socket.io events to adserver

// Play selected videomail when a row of the table is clicked
$('#Videomail_Table tbody').on('click', 'tr', function PlaySelectedVideomail() {
  const tableData = $(this).children('td').map(function MapFunction() {
    return $(this).text();
  }).get();

  console.log('Click event for playing video');
  console.log(`vidId: ${tableData[6]}`);
  $('#videomailId').attr('name', tableData[6]);
  $('#callbacknum').attr('name', tableData[0]);
  playVideomail(tableData[6], tableData[2], tableData[3]);// vidId, vidDuration vidStatus);
});

function sortButtonToggle(buttonid) {
  if ($(buttonid).attr('class') === 'fa fa-sort') {
    $(buttonid).addClass('fa-sort-up').removeClass('fa-sort');
    return ('asc');
  } if ($(buttonid).attr('class') === 'fa fa-sort-down') {
    $(buttonid).addClass('fa-sort-up').removeClass('fa-sort-down');
    return ('asc');
  } if ($(buttonid).attr('class') === 'fa fa-sort-up') {
    $(buttonid).addClass('fa-sort-down').removeClass('fa-sort-up');
    return ('desc');
  }
  // Default to 'acs' if none of the ones above.
  return ('asc');
}

// Sorting the videomail table
$('#vmail-vrs-number').on('click', function SortVRSNumber() {
  const sort = sortButtonToggle($(this).children('i'));
  if (sort === 'asc') {
    sortFlag = 'callbacknumber asc';
  } else if (sort === 'desc') {
    sortFlag = 'callbacknumber desc';
  }
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
});

$('#vmail-date').on('click', function SortDate() {
  const sort = sortButtonToggle($(this).children('i'));
  if (sort === 'asc') {
    sortFlag = 'received asc';
  } else if (sort === 'desc') {
    sortFlag = 'received desc';
  }
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
});

$('#vmail-duration').on('click', function SortDuration() {
  const sort = sortButtonToggle($(this).children('i'));
  if (sort === 'asc') {
    sortFlag = 'video_duration asc';
  } else if (sort === 'desc') {
    sortFlag = 'video_duration desc';
  }
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
});

$('#vmail-status').on('click', function SortStatus() {
  const sort = sortButtonToggle($(this).children('i'));
  if (sort === 'asc') {
    sortFlag = 'status asc';
  } else if (sort === 'desc') {
    sortFlag = 'status desc';
  }
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
});

$('#vmail-agent').on('click', function SortAgent() {
  const sort = sortButtonToggle($(this).children('i'));
  if (sort === 'asc') {
    sortFlag = 'processing_agent asc';
  } else if (sort === 'desc') {
    sortFlag = 'processing_agent desc';
  }
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
});

// Filter videomail by status
function filterVideomail(mailFilter) {
  filter = mailFilter;
  socket.emit('get-videomail', {
    sortBy: sortFlag,
    filter
  });
}

$('#videomailFilter').on('click', 'a', function Selected() {
  const mailFilter = $(this).attr('value');
  filterVideomail(mailFilter);
});

// Seekbar functionality
const seekBar = document.getElementById('seek-bar');
// Event listener for the seek bar
seekBar.addEventListener('change', () => {
  // Calculate the new time
  const time = remoteView.duration * (seekBar.value / 100);

  // Update the video time
  remoteView.currentTime = time;
});

// Update the seek bar as the video plays
remoteView.addEventListener('timeupdate', () => {
  // Calculate the slider value
  const value = (100 / remoteView.duration) * remoteView.currentTime;

  // Update the slider value
  seekBar.value = value;

  // update the current time info
  updateVideoTime(remoteView.currentTime, 'vmail-current-time');
});

// Event listener for the full-screen button
function enterFullscreen() {
  if (remoteView.requestFullscreen) {
    remoteView.requestFullscreen();
  } else if (remoteView.mozRequestFullScreen) {
    remoteView.mozRequestFullScreen(); // Firefox
  } else if (remoteView.webkitRequestFullscreen) {
    remoteView.webkitRequestFullscreen(); // Chrome and Safari
  }
}

$('#enter-fullscreen').on('click', () => {
  enterFullscreen();
});
