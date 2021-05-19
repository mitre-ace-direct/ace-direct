$('#sidebaroperatinghours').addClass('active');
let socket = null;

$('#business_mode_dropdown').select2({
  minimumResultsForSearch: Infinity
});

function formatTime(timeStr) {
  const d = new Date();
  d.setUTCHours(timeStr.split(':')[0]);
  let mins = timeStr.split(':')[1];
  mins = mins.substring(0, 3);
  d.setUTCMinutes(mins);

  return `${(d.getHours() < 10 ? '0' : '') + d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
}

function formatTimeToUTC(timeStr) {
  const d = new Date();
  let hours = timeStr.split(':')[0];
  const mins = (timeStr.split(':')[1]).substring(0, 3);
  const ampm = (timeStr.split(':')[1]).slice(-2);
  if ((ampm === 'PM' && parseInt(hours, 10) === 12) || (ampm === 'AM' && parseInt(hours, 10) === 12)) hours = parseInt(hours, 10) + 12;

  d.setHours(hours);
  d.setMinutes(mins);

  return `${d.getUTCHours()}:${d.getUTCMinutes() < 10 ? '0' : ''}${d.getUTCMinutes()}`;
}

const updateTime = function UpdateTime() {
  const timeFormat = 'h:mm A';
  $('#current_local').html(moment().format(timeFormat));

  let dst = 0;
  if (moment().isDST()) dst = 1;

  $('#current_est').html(moment().utcOffset(-5 + dst).format(timeFormat));
  $('#current_cst').html(moment().utcOffset(-6 + dst).format(timeFormat));
  $('#current_mst').html(moment().utcOffset(-7 + dst).format(timeFormat));
  $('#current_pst').html(moment().utcOffset(-8 + dst).format(timeFormat));
};

updateTime();
setInterval(updateTime, 1000);

function updateHoursOfOperation() {
  $('#updateBtn').attr('disabled', 'disabled');

  const data = {};
  data.start = formatTimeToUTC($('#start_time').val());
  data.end = formatTimeToUTC($('#end_time').val());
  data.business_mode = $('#business_mode_dropdown').val();
  // alert(JSON.stringify(data) )

  socket.emit('hours-of-operation-update', data);
}

function SetOperatingHours(data) {
  /*
    $("#start_time").wickedpicker({
        now: formatTime(data.start)
    });

    $("#end_time").wickedpicker({
        now: formatTime(data.end)
    });
    */
  $('#start_time').val(formatTime(data.start));
  $('#end_time').val(formatTime(data.end));

  $('#business_mode_dropdown').val(data.business_mode).change();
}

function SetOperatingStatus(isOpen) {
  if (isOpen) {
    $('#opStatus').html('Open').addClass('badge-success').removeClass('badge-danger');
  } else {
    $('#opStatus').html('Closed').addClass('badge-danger').removeClass('badge-success');
  }
}

$('#updateBtn').on('click', () => {
  updateHoursOfOperation();
});

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
      socket.emit('hours-of-operation');

      // update version,hours in footer
      socket.on('adversion', (data) => {
        $('#ad-version').text(data.version);
        $('#ad-year').text(data.year);
      });

      socket.on('hours-of-operation-response', (data) => {
        SetOperatingHours(data);
        SetOperatingStatus(data.isOpen);
      }).on('hours-of-operation-update-response', (_data) => {
        $('#updateBtn').removeAttr('disabled');
        $('#updateMessage').show();
        $('#updateMessage').fadeOut(2000);
        socket.emit('hours-of-operation');
      });
    }
  },
  error(_xhr, _status, _error) {
    console.log('Error');
    $('#message').text('An Error Occured.');
  }
});

function getTimezoneAdjustment(time, timezone) {
  return moment(time).utcOffset(timezone).format('h:mm A');
}

function formatTimeRange(start, end) {
  return `${start} - ${end}`;
}

$('.timepicker').change(() => {
  const tStart = $('#start_time').val();
  const tEnd = $('#end_time').val();

  if (tStart !== '' && tEnd !== '') {
    const sTimeUTC = formatTimeToUTC(tStart);
    const eTimeUTC = formatTimeToUTC(tEnd);

    const shour = sTimeUTC.split(':')[0];
    const smin = sTimeUTC.split(':')[1];
    const ehour = eTimeUTC.split(':')[0];
    const emin = eTimeUTC.split(':')[1];

    const openUtc = moment.utc().hour(shour).minutes(smin);
    const closeUtc = moment.utc().hour(ehour).minutes(emin);

    $('#opHrsEST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -5), getTimezoneAdjustment(closeUtc, -5)));
    $('#opHrsCST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -6), getTimezoneAdjustment(closeUtc, -6)));
    $('#opHrsMST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -7), getTimezoneAdjustment(closeUtc, -7)));
    $('#opHrsPST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -8), getTimezoneAdjustment(closeUtc, -8)));

    $('#opHrsESTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -5), getTimezoneAdjustment(closeUtc, -5)));
    $('#opHrsCSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -6), getTimezoneAdjustment(closeUtc, -6)));
    $('#opHrsMSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -7), getTimezoneAdjustment(closeUtc, -7)));
    $('#opHrsPSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -8), getTimezoneAdjustment(closeUtc, -8)));
  }
});
