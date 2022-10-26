let socket;
let selectedCallBlock = 0;
let selectedCallBlockVrs = 0;

function formatModelVRS(vrs) {
  let vrsFormatted = vrs;
  if (vrsFormatted) {
    vrsFormatted = vrs.toString();
    if (vrs[0] === '1') vrsFormatted = vrsFormatted.slice(1, vrsFormatted.length);
    vrsFormatted = `${vrsFormatted.substring(0, 3)}-${vrsFormatted.substring(3, 6)}-${vrsFormatted.substring(6, vrsFormatted.length)}`;
  }
  return vrsFormatted;
}

function formatVRS(vrs) {
  let vrsFormatted = vrs;
  if (vrsFormatted) {
    vrsFormatted = vrs.toString();
    if (vrsFormatted[0] === '1') vrsFormatted = vrsFormatted.slice(1, vrsFormatted.length);
    vrsFormatted = `(${vrsFormatted.substring(0, 3)}) ${vrsFormatted.substring(3, 6)}-${vrsFormatted.substring(6, vrsFormatted.length)}`;
  }
  return vrsFormatted;
}

function ConnectSocket() {
  $('#cbmsg').text('');
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

        socket.emit('get-callblocks', {
        }).on('got-callblocks-recs', (data) => {
          if (data.message === 'Success') {
            if (data.data.length > 0) {
              $('#callblocktable').dataTable().fnClearTable();
              $('#callblocktable').dataTable().fnAddData(data.data);
              $('#callblocktable').resize();
            } else {
              $('#callblocktable').dataTable().fnClearTable();
              $('#callblocktable').resize();
            }
          } else {
            $('#callblocktable').dataTable().fnClearTable();
            $('#callblocktable').resize();
          }
        }).on('add-callblock-rec', (data) => {
          if (data.message === 'Success') {
            console.log('Saved!!!!');
            socket.emit('get-callblocks', {});
          } else {
            $('#cbmsg').text(data.message);
          }
        }).on('delete-callblock-rec', (data) => {
          if (data.message === 'Success') {
            console.log('Deleted!!!!');
            socket.emit('get-callblocks', {});
          } else {
            $('#cbmsg').text(data.message);
          }
        })
          .on('update-callblock-rec', (data) => {
            if (data.message === 'Success') {
              socket.emit('get-callblocks', {});
            } else {
              $('#cbmsg').text(data.message);
            }
          });

        // update version in footer
        socket.on('adversion', (data) => {
          $('#ad-version').text(data.version);
          $('#ad-year').text(data.year);
        });
      }
    },
    error() {
      console.log('Error');
      $('#message').text('An Error Occured.');
    }
  });
}

$(document).ready(() => {
  $('#cbmsg').text('');
  $('#sidebarcallblocking').addClass('active');
  $('#admin_treeview').addClass('active');
  // $('#admin_users_treeview').addClass('active');

  const table = $('#callblocktable').DataTable({
    order: [],
    columnDefs: [{
      targets: [0],
      data: 'call_block_id',
      visible: false,
      searchable: false
    }, {
      targets: [1],
      data: 'timeUpdated',
      render(data, type) {
        if (type === 'display') {
          return moment(data).local().format('YYYY/MM/DD LTS');
        }
        return data;
      },
      width: '20%'
    }, {
      targets: [2],
      data: 'vrs',
      render(data, type) {
        if (type === 'display') {
          const vidNumber = formatVRS(data);
          return vidNumber;
        }
        return data;
      },
      width: '15%'
    }, {
      targets: [3],
      data: 'reason',
      visible: true,
      width: '45%'
    }, {
      targets: [4],
      data: 'admin_username',
      visible: true,
      width: '15%'
    }, {
      targets: [5],
      data: 'selected',
      width: '5%',
      orderable: false,
      render(data, type) {
        if (type === 'display') {
          return '<input type="checkbox" class="editor-active">';
        }
        return data;
      },
      className: 'dt-body-center'
    }],
    select: {
      style: 'os',
      selector: 'td:not(:last-child)'
    },
    rowCallback(row, data) {
      $('input.editor-active', row).prop('checked', data.selected === 1);
      // console.log("selected row: " + (data.selected == 1));
    }
  });

  $('#callblocktable tbody').on('change', 'input.editor-active', function CheckboxClick() {
    const data = table.row($(this).parents('tr')).data();
    // console.log("checkbox clicked with data: " + JSON.stringify(data));

    data.selected = $(this).prop('checked') ? 1 : 0;
    // console.log("checkbox data: " + data.selected);
  });

  $('#callblocktable tbody').on('click', 'td', function ClickOnRow() {
    $('#cbmsg').text('');
    const data = table.row($(this).parents('tr')).data();
    const col = table.cell(this).index().column;

    if (col !== 5) {
      selectedCallBlock = data.call_block_id;
      selectedCallBlockVrs = data.vrs;

      const vidNumber = formatModelVRS(data.vrs);

      $('#inputVRS').val(vidNumber);
      $('#inputReason').val(data.reason);
      $('#inputVRS').prop('disabled', true);

      $('#btnUpdateCallBlock').show();
      $('#btnDeleteCallBlock').show();
      $('#btnAddCallBlock').hide();
      $('#configModal').modal();
    }
  });

  function addCallBlock(event) {
    event.preventDefault();

    $('#inputVRS').prop('disabled', false);

    const data = {};
    data.vrs = $('#inputVRS').val().replace(/-/g, '');
    data.reason = $('#inputReason').val();

    // TODO put in check to alert user if vrs number already in DB

    socket.emit('add-callblock', {
      data
    });

    $('#configModal').modal('hide');
  }

  function getBulkDeleteCallBlockList() {
    let callBlockVrsNumbers = '';
    const data = table.rows().data();
    let count = 0;
    data.each((value, _index) => {
      if (value.selected === 1) {
        count += 1;
        // console.log("Bulk delete: checked at index: ", index)
        // console.log("agent id checked is: " + value[0] + " call block username is: " + value[3]);
        callBlockVrsNumbers += `  ${formatVRS(value.vrs)}`;
      }
    });

    document.getElementById('callblocklist').innerHTML = callBlockVrsNumbers;
    return count;
  }

  function addCallBlockModal() {
    $('#cbmsg').text('');
    $('#inputVRS').prop('disabled', false);
    $('#addCallBlockForm').trigger('reset');
    $('#btnUpdateCallBlock').hide();
    $('#btnDeleteCallBlock').hide();
    $('#btnAddCallBlock').show();
    $('#configModal').modal();
  }

  function deleteCallBlock(event) {
    $('#cbmsg').text('');
    event.preventDefault();

    const data = {};
    data.id = selectedCallBlock;
    data.vrs = selectedCallBlockVrs;

    socket.emit('delete-callblock', {
      data
    });

    $('#confirm-delete').modal('hide');
    $('#configModal').modal('hide');
  }

  $('#btnAddCallBlock').on('click', (event) => {
    $('#cbmsg').text('');
    addCallBlock(event);
  });
  $('#inputVRS').keyup((event) => {
    if (event.keyCode === 13) {
      $('#btnAddCallBlock').click();
    }
  });
  $('#inputReason').keyup((event) => {
    if (event.keyCode === 13) {
      $('#btnAddCallBlock').click();
    }
  });

  $('#btnDeleteCallBlock').on('click', (event) => {
    $('#cbmsg').text('');
    event.preventDefault();
    console.log(`CallBlockId selected to delete: ${selectedCallBlock}`);
    $('#confirm-delete').modal();
  });

  $('#btnUpdateCallBlock').on('click', (event) => {
    $('#cbmsg').text('');
    event.preventDefault();

    const data = {};
    data.id = selectedCallBlock;
    data.reason = $('#inputReason').val();

    socket.emit('update-callblock', {
      data
    });

    $('#configModal').modal('hide');
  });

  $('#delete_callblock_btn').on('click', () => {
    $('#cbmsg').text('');
    const count = getBulkDeleteCallBlockList();
    if (count <= 0) return;
    $('#confirm-bulk-delete').modal();
    $('#confirm-delete').modal('hide');
  });

  $('#bulk_delete_btn').on('click', (event) => {
    $('#cbmsg').text('');
    event.preventDefault();

    let ids = '';
    let vrs = '';
    let data = table.rows().data();
    data.each((value, _index) => {
      if (value.selected === 1) {
        ids += `${value.call_block_id},`;
        vrs += `${value.vrs},`;
      }
    });

    data = {};
    data.bulk = true;
    data.id = ids.slice(0, -1);
    data.vrs = vrs.slice(0, -1);

    socket.emit('delete-callblock', {
      data
    });

    $('#confirm-bulk-delete').modal('hide');
    $('#configModal').modal('hide');
  });

  $('#DeleteCallBlockConfirmButton').on('click', (event) => {
    deleteCallBlock(event);
  });

  $('#add_callblock_btn').on('click', () => {
    addCallBlockModal();
  });

  ConnectSocket();
});
