let socket; // = io.connect('http://' + window.location.host); // opens socket.io connection

// sets the Date Range picker start and end date
// Summary report is shown for start and end based on local time start and end of day.
let start = moment().startOf('day').subtract(6, 'days');
let end = moment().endOf('day'); // today

const plots = {}; // Map of plots for each chart

function getTimeZoneOffset() {
  const mins = moment().utcOffset();
  const h = Math.trunc(Math.abs(mins) / 60);
  const m = Math.trunc(Math.abs(mins) % 60);

  let offset = '00:00';
  if (mins !== 0) {
    offset = moment.utc().hours(h).minutes(m).format('hh:mm');
  }
  return (mins < 0 ? `-${offset}` : `+${offset}`);
}

const timezone = getTimeZoneOffset();

function test(_dataIn) {
  const chart = ({ title, shortName }) => `
  <div class="col-xl-3 col-lg-4 col-md-4">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <div class="card-tools">
          <button type="button" class="btn btn-tool" data-card-widget="collapse"><i
              class="fa fa-minus"></i>
          </button>
          <button type="button" class="btn btn-tool" data-card-widget="maximize"><i class="fas fa-expand"></i></button>
        </div>
      </div>
      <div class="card-body">
        <div id="${shortName}-LineChart" style="height:150px"></div>
        <!-- <div id="${shortName}-legend" class="legend"></div> -->
      </div>
    </div>
  </div>
  `;

  const chartsArray = [
    { title: 'pliCount', shortName: 'pliCount' },
    { title: 'packetsReceived', shortName: 'packetsReceived' },
    { title: 'packetsReceived/s', shortName: 'packetsReceived-per-s' },
    { title: 'bytesReceived_in_bits/s', shortName: 'bytesReceived_in_bits-per-s' },
    // { title: 'headerBytesReceived_in_bits/s', shortName: 'headerBytesReceived_in_bits-per-s' },
    { title: 'jitter', shortName: 'jitter' },
    { title: 'framesReceived/s', shortName: 'framesReceived-per-s' },
    { title: 'framesDecoded/s', shortName: 'framesDecoded-per-s' },
    // {
    //   title: 'totalDecodeTime/framesDecoded_in_ms',
    //   shortName: 'totalDecodeTime/framesDecoded_in_ms'
    // },
    // {
    //   title: 'totalInterFrameDelay/framesDecoded_in_ms',
    //   shortName: 'totalInterFrameDelay/framesDecoded_in_ms'
    // },
    // { title: 'interFrameDelayStDev_in_ms', shortName: 'interFrameDelayStDev_in_ms' },
    { title: 'framesPerSecond', shortName: 'framesPerSecond' }
  ];

  $('#charts-row').html(chartsArray.map(chart).join(''));

  // console.log($('#charts-row'));
}

// Calc the rate per second from data returned from mongodb.
function calcRate(data) {
  const rate = [];

  let previousDate;
  let previousResult;
  for (let i = 0; i < data.data.length; i += 1) {
    if (data.data[i].date !== undefined) {
      const date = new Date(data.data[i].date);
      // console.log(date - previousDate);
      // console.log(data.data[i].result - previousResult);
      const statPerSecond = (data.data[i].result - previousResult)
        / (date - previousDate);
      // console.log(statPerSecond);
      previousDate = date;
      previousResult = data.data[i].result;

      rate.push([date, statPerSecond]);
    }
  }
  return rate;
}

function updateLineChart(dataIn) {
  const data = dataIn;
  $(() => {
    if (data.data.length === 1) {
      start = new Date(data.data[0].date);
      end = new Date(start.getTime() + (24 * 60 * 60 * 1000));
      data.data[1] = { ...data.data[0] };
      data.data[1].date = end.toISOString().slice(0, 10);
    }

    if (data.shortname == null) {
      return;
    }

    let webrtcstat = [];
    if (data.shortname === 'packetsReceived-per-s' || data.shortname === 'bytesReceived_in_bits-per-s') {
      webrtcstat = calcRate(data);
    } else {
      for (let i = 0; i < data.data.length; i += 1) {
        const date = new Date(data.data[i].date);
        webrtcstat.push([date, data.data[i].result]);
      }
    }

    // Chart data in webrtcstat in this format
    // [
    //   [
    //     "2021-03-30T16:31:45.184Z",
    //     "0"
    //   ],
    //   [
    //     "2021-03-30T16:31:46.193Z",
    //     "63"
    //   ]
    // }

    // const legendName = `${data.shortname}-legend`;
    // const legendContainer = document.getElementById(legendName); // fixme

    // const legendSettings = {
    //   position: 'nw',
    //   show: true,
    //   noColumns: 2,
    //   container: legendContainer
    // };

    const chartdata = [
      {
        color: 'black',
        lines: { show: true, lineWidth: 1 },
        // points: { show: true },
        data: webrtcstat,
        label: data.title
      }
    ];

    const options = {
      // legend: legendSettings,
      xaxis: { mode: 'time', timeBase: 'milliseconds' },
      selection: {
        mode: 'x'
      }
    };

    // console.log(`Data to frontend: ${JSON.stringify(webrtcstat, null, '\t')}`);
    // const chart = `#${data.shortname}-LineChart`;
    const chart = $(`#${data.shortname}-LineChart`);
    plots[data.shortname] = $.plot(chart, chartdata, options);
    // console.log(chart)
    const buttonId = `${data.shortname}-clear-button`;

    chart.bind('plotselected', (event, ranges) => {
      // $("#selection").text(ranges.xaxis.from.toFixed(1) + " to " + ranges.xaxis.to.toFixed(1));
      // console.log(ranges.xaxis.from.toFixed(1) + " to " + ranges.xaxis.to.toFixed(1))

      $.each(plots[data.shortname].getXAxes(), (_, axis) => {
        const opts = axis.options;
        opts.min = ranges.xaxis.from;
        opts.max = ranges.xaxis.to;
      });
      plots[data.shortname].setupGrid();
      plots[data.shortname].draw();
      plots[data.shortname].clearSelection();
      $(`#${buttonId}`).show();
    });

    chart.after(`<a style="display:none" id="${buttonId}" class="refresh-button">Reset</a>`);
    // chart.after('<span style="display:none"
    // id="' + buttonId +
    // '" class="refresh-button"><i title="Refresh" class="nav-icon fas fa-undo"></i></span>');
    $(`#${buttonId}`).click(() => {
      plots[data.shortname] = $.plot(chart, chartdata, options);
      $(`#${buttonId}`).hide();
    });
  });
}

function startLoadingIndicator() {
  $('.loading-indicator').css('display', 'flex');
}

function stopLoadingIndicator() {
  $('.loading-indicator').css('display', 'none');
}

const charts = ['pliCount', 'packetsReceived', 'packetsReceived-per-s', 'bytesReceived_in_bits-per-s',
  'jitter', 'framesReceived-per-s', 'framesDecoded-per-s', 'framesPerSecond'];

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
        socket.emit('webrtcstats-get-agents-data', {});
      });

      // update the version and year in the footer
      socket.on('adversion', (data) => {
        $('#ad-version').text(data.version);
        $('#ad-year').text(data.year);
      });

      socket.on('webrtcstats-agents-data', (data) => {
        data.data.forEach((agent) => {
          $('#agent_dropdown').append(new Option(agent, agent));
        });
      });

      socket.on('webrtcstats-calls-data', (data) => {
        stopLoadingIndicator();
        if (data.message === 'Success') {
          $('#callstable').dataTable().fnClearTable();
          $('#callstable').dataTable().fnAddData(data.data);
          $('#callstable').resize();
        } else {
          $('#callstable').dataTable().fnClearTable();
          $('#callstable').resize();
        }
      });

      socket.on('webrtcstats-data', (data) => {
        updateLineChart(data);
      });

      // Handles Error conditions from Report calls.
      // socket.on('reporttable-error', (data) => {
      //   $('#reporttable').dataTable().fnClearTable();
      //   $('.dataTables_empty').css('color', 'red').html(data.message);
      //   $('#reporttable').resize();
      // });
    } else {
      $('#message').text(successData.message);
    }
  },
  error(_xhr, _status, _error) {
    console.log('Error');
    $('#message').text('An Error Occured.');
  }
});

function DateRangePickerSetup() {
  // Call back funtion for setting report range <div> value
  function cb(startDRPSetup, endDRPSetup) {
    $('#reportrange span:first').html(`${startDRPSetup.format('MMMM D, YYYY')} - ${endDRPSetup.format('MMMM D, YYYY')}`);
  }

  // controls for the date range picker
  $('#reportrange').daterangepicker({
    startDate: start,
    endDate: end,
    ranges: {
      Today: [moment(), moment()],
      Yesterday: [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
      'Last 7 Days': [moment().subtract(6, 'days'), moment()],
      'Last 30 Days': [moment().subtract(29, 'days'), moment()],
      'This Month': [moment().startOf('month'), moment().endOf('month')],
      'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
      'All Time': [moment('2020-03-01'), end] // This is a new management portal feature starting March 2020. No data before then.
    }
  }, cb);

  // sets initial value for report range <div>
  cb(start, end);

  // Click event for new date range selected
  // Summary report is shown for start and end based on local time start and end of day.

  // Clear all charts
  $('#reportrange').on('apply.daterangepicker', (evt, picker) => {
    // charts.forEach((data) => {
    //   const chart = `#${data}-LineChart`;
    //   $.plot(chart, {}, {});
    // });

    const startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
    const enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();

    // console.log(' getting call data', startdate,enddate, timezone)
    startLoadingIndicator();
    socket.emit('webrtcstats-get-calls-data', {
      start: startdate,
      end: enddate,
      timezone,
      username: $('#agent_dropdown').val()
    });
  });
}

function pad(numIn, size) {
  let num = numIn;
  num = num.toString();
  while (num.length < size) num = `0${num}`;
  return num;
}

function msToTime(duration) {
  const milliseconds = pad(Math.floor(duration % 1000), 3);
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? `0${hours}` : hours;
  minutes = (minutes < 10) ? `0${minutes}` : minutes;
  seconds = (seconds < 10) ? `0${seconds}` : seconds;

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

$(document).ready(() => {
  $('#sidebarwebrtcstats').addClass('active');

  // initialize the datatable
  const table = $('#callstable').DataTable({
    pageLength: 5,
    columns: [{
      data: 'start',
      render(data, type, _full, _meta) {
        if (type === 'display') {
          return moment(data).local().format('YYYY/MM/DD h:mm:ss a');
        }
        return data;
      }
    },
    {
      data: 'end',
      render(data, type, _full, _meta) {
        if (type === 'display') {
          return moment(data).local().format('YYYY/MM/DD h:mm:ss a');
        }
        return data;
      }
    },
    {
      data: null, // data is null since we want to access ALL data
      // for the sake of our calculation below
      render(data, _type, _row) {
        const startTime = moment(data.start);
        const endTime = moment(data.end);

        const ms = endTime.diff(startTime);
        const s = msToTime(ms);
        return s;
      }
    },
    {
      data: 'id'
    }

    ],
    // order: [
    //   [0, 'desc']
    // ],
    language: {
      emptyTable: 'Data does not exist.'
    },
    select: {
      style: 'single'
      // selector: 'td:not(:last-child)'
    }
    // rowCallback(row, data) {
    // $('input.editor-active', row).prop('checked', data.selected === 1);
    // console.log("selected row: " + (data.selected == 1));
    // }
  });

  $('#callstable tbody').on('click', 'td', function ClickOnRow() {
    // const data = table.row(this).data();
    const data = table.row($(this).parents('tr')).data();
    // const col = table.cell(this).index().column;

    charts.forEach((name) => {
      const chart = `#${name}-LineChart`;
      $.plot(chart, {}, {});
    });

    socket.emit('webrtcstats-get-data', {
      start: data.start,
      end: data.end,
      timezone,
      username: $('#agent_dropdown').val(),
      callId: data.id,
      charts
    });
  });

  DateRangePickerSetup();

  test('');

  // fixme for debugging, remove:
  //   setTimeout(() => {
  //     console.log('fixme getting chart data for debugging')

  // socket.emit('webrtcstats-get-data', {
  //   start: '2021-04-06T19:15:12.466Z',
  //   end:'2021-04-06T19:15:40.475Z',
  //   timezone:'-04:00',
  //   username: 'dagent1',
  //   callId: 'ssrc_361970875_recv',
  //   charts
  // });

  //   }, 5000);
});
