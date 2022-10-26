let socket; // = io.connect('http://' + window.location.host); // opens socket.io connection

// sets the Date Range picker start and end date
// Summary report is shown for start and end based on local time start and end of day.
let start = moment().startOf('day').subtract(6, 'days');
let end = moment().endOf('day'); // today

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

function updateCallStatusLineChart(dataIn) {
  const data = dataIn;
  $(() => {
    if (data.data.length === 1) {
      start = new Date(data.data[0].date);
      end = new Date(start.getTime() + (24 * 60 * 60 * 1000));
      data.data[1] = { ...data.data[0] };
      data.data[1].date = end.toISOString().slice(0, 10);
    }

    // Enhancement - put in check for too much data to chart
    const handled = []; const abandoned = []; const videomail = []; const
      webcall = [];
    for (let i = 0; i < data.data.length; i += 1) {
      const date = new Date(data.data[i].date);
      handled.push([date, data.data[i].callshandled]);
      abandoned.push([date, data.data[i].callsabandoned]);
      videomail.push([date, data.data[i].videomails]);
      webcall.push([date, data.data[i].webcalls]);
    }

    const legendContainer = document.getElementById('legendContainer');
    const legendSettings = {
      position: 'nw',
      show: true,
      noColumns: 2,
      container: legendContainer
    };

    const chartdata = [
      {
        color: 'forestgreen', lines: { show: true, lineWidth: 3 }, data: handled, label: 'Calls Handled'
      },
      {
        color: 'red', lines: { show: true, lineWidth: 3 }, data: abandoned, label: 'Calls Abandoned'
      },
      {
        color: 'blue', lines: { show: true, lineWidth: 3 }, data: videomail, label: 'Videomail'
      },
      {
        color: 'black', lines: { show: true, lineWidth: 3 }, data: webcall, label: 'Webcalls'
      }
    ];

    $.plot('#callSummaryLineChart', chartdata,
      {
        legend: legendSettings,
        xaxis: { mode: 'time', timeBase: 'milliseconds' }
      });
  });
}

function downloadFile(data, fileName) {
  const csvData = data;
  const blob = new Blob([csvData], {
    type: 'application/csv;charset=utf-8;'
  });

  if (window.navigator.msSaveBlob) {
    // FOR IE BROWSER
    navigator.msSaveBlob(blob, fileName);
  } else {
    // FOR OTHER BROWSERS
    const link = document.createElement('a');
    const csvUrl = URL.createObjectURL(blob);
    link.href = csvUrl;
    link.style = 'visibility:hidden';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

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

      // update the version and year in the footer
      socket.on('adversion', (data) => {
        $('#ad-version').text(data.version);
        $('#ad-year').text(data.year);
      });

      socket.on('connect', () => {
        // Emit for Report Data set to be called on page ready.
        socket.emit('reporttable-get-data', {
          format: 'json',
          start,
          end,
          timezone
        });
        socket.emit('vrsreporttable-get-data', {
          format: 'json',
          start,
          end,
          timezone
        });
      });

      // Receives the Report Table data.
      socket.on('reporttable-data', (data) => {
        // Always update totals, even if no data. The values will be zero.
        $('#handled').text(data.handled);
        $('#abandoned').text(data.abandoned);
        $('#videomails').text(data.videomails);
        $('#webcalls').text(data.webcalls);

        // Update the Call Summary Records table
        if (data.message === 'Success') {
          $('#reporttable').dataTable().fnClearTable();
          $('#reporttable').dataTable().fnAddData(data.data);
          $('#reporttable').resize();
        } else {
          $('#reporttable').dataTable().fnClearTable();
          $('#reporttable').resize();
        }

        updateCallStatusLineChart(data);
      });

      // Receives the VRS Report Table data.
      socket.on('vrsreporttable-data', (data) => {
        let i = 0;
        if (data.message === 'Success') {
          let content = '<table style="width:100%"">';
          for (i = 0; i < data.topTenStates.length; i += 1) {
            content += `<tr><td>${data.topTenStates[i][0]}</td><td>${data.topTenStates[i][1]}</td></tr>`;
          }
          content += '</table>';
          $('#topTenStates').empty().append(content);

          content = '<table style="width:100%"">';
          for (i = 0; i < data.topTenAreaCodes.length; i += 1) {
            content += `<tr><td>${data.topTenAreaCodes[i][0]}</td><td>${data.topTenAreaCodes[i][1]}</td></tr>`;
          }
          content += '</table>';
          $('#topTenAreaCodes').empty().append(content);

          content = '<table style="width:100%"">';
          for (i = 0; i < data.topTenVrsNumbers.length; i += 1) {
            const vrsNumber = data.topTenVrsNumbers[i][0];
            const vrsNumerFormatted = `${vrsNumber.substring(0, 3)}-${vrsNumber.substring(3, 6)}-${vrsNumber.substring(6, vrsNumber.length)}`;
            content += `<tr><td>${vrsNumerFormatted}</td><td>${data.topTenVrsNumbers[i][1]}</td></tr>`;
          }
          content += '</table>';
          $('#topTenVrsNumbers').empty().append(content);

          $('#vrsreporttable').dataTable().fnClearTable();
          $('#vrsreporttable').dataTable().fnAddData(data.data);
          $('#vrsreporttable').resize();
        } else {
          $('#topTenStates').empty().append('Data does not exist');
          $('#topTenAreaCodes').empty().append('Data does not exist');
          $('#topTenVrsNumbers').empty().append('Data does not exist');

          $('#vrsreporttable').dataTable().fnClearTable();
          $('#vrsreporttable').resize();
        }
      });

      // Receives the report data in CSV format
      socket.on('reporttable-csv', (data) => {
        downloadFile(data, 'report_info.csv');
      });

      // Receives the vrs report data in CSV format
      socket.on('vrsreporttable-csv', (data) => {
        downloadFile(data, 'vrs_report_info.csv');
      });

      // Handles Error conditions from Report calls.
      socket.on('reporttable-error', (data) => {
        $('#reporttable').dataTable().fnClearTable();
        $('.dataTables_empty').css('color', 'red').html(data.message);
        $('#reporttable').resize();
      });
    } else {
      $('#message').text(successData.message);
    }
  },
  error(_xhr, _status, _error) {
    console.log('Error');
    $('#message').text('An Error Occured.');
  }
});

// initialize the datatable
$('#reporttable').DataTable({
  columns: [{
    data: 'date',
    render(data, type, _full, _meta) {
      if (type === 'display') {
        return moment(data).local().format('YYYY/MM/DD');
      }
      return data;
    }
  },
  {
    data: 'callshandled'
  },
  {
    data: 'callsabandoned'
  },
  {
    data: 'videomails'
  },
  {
    data: 'webcalls'
  }
  ],
  order: [
    [0, 'desc']
  ],
  language: {
    emptyTable: 'Data does not exist.'
  }
});

$('#vrsreporttable').DataTable({
  columns: [{
    data: 'vrs',
    render(data, type, _full, _meta) {
      if (type === 'display') {
        return `${data.substring(0, 3)}-${data.substring(3, 6)}-${data.substring(6, data.length)}`;
      }
      return data;
    }
  },
  {
    data: 'date',
    render(data, type, _full, _meta) {
      if (type === 'display') {
        return moment(data).local().format('YYYY/MM/DD');
      }
      return data;
    }
  },
  {
    data: 'status'
  },
  {
    data: 'stateCode'
  }
  ],
  // "order": [
  //  [0, "desc"]
  // ],
  language: {
    emptyTable: 'Data does not exist.'
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
  $('#reportrange').on('apply.daterangepicker', (evt, picker) => {
    const startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
    const enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
    socket.emit('reporttable-get-data', {
      format: 'json',
      start: startdate,
      end: enddate,
      timezone
    });
    socket.emit('vrsreporttable-get-data', {
      format: 'json',
      start: startdate,
      end: enddate,
      timezone
    });
  });
}

$(document).ready(() => {
  $('#sidebarreport').addClass('active');

  // click event for downloading CSV file
  // Summary report is for start and end based on local time start and end of day.
  $('#reportdownloadbtn').on('click', () => {
    const picker = $('#reportrange').data('daterangepicker');
    const startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
    const enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
    socket.emit('reporttable-get-data', {
      format: 'csv',
      start: startdate,
      end: enddate,
      timezone
    });
  });
  $('#vrsreportdownloadbtn').on('click', () => {
    const picker = $('#reportrange').data('daterangepicker');
    const startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
    const enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
    socket.emit('vrsreporttable-get-data', {
      format: 'csv',
      start: startdate,
      end: enddate,
      timezone
    });
  });

  DateRangePickerSetup();
});
