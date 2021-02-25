// 'use strict';
let selectedUser = 0;
$(document).ready(() => {
  $('#sidebaragentmanagement').addClass('active');
  $('#admin_treeview').addClass('active');
  $('#admin_users_treeview').addClass('active');

  const table = $('#usertable').DataTable({
    order: [],
    columnDefs: [{
      targets: [0],
      visible: false,
      searchable: false
    }, {
      targets: [4],
      render(data, _type, _row) {
        if (data.length === 0) {
          return 'Never';
        }
        return data;
      }
    }, {
      targets: [5],
      data: 'selected',
      orderable: false,
      render(data, type, _row) {
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
    // "tableTools": {
    // "sRowSelect": "os",
    // "sRowSelector": 'td:not(:last-child)' // no row selection on last column
    // }
    // "select": {
    // "style": 'os',
    // "sRowSelector": 'td:not(:last-child)'
    // },
    rowCallback(row, data) {
      $('input.editor-active', row).prop('checked', data.selected === 1);
      // console.log("selected row: " + (data.selected == 1));
    }
  });

  $('#usertable tbody').on('change', 'input.editor-active', function CheckboxClicked() {
    const data = table.row($(this).parents('tr')).data();
    // console.log("checkbox clicked with data: " + JSON.stringify(data));

    data.selected = $(this).prop('checked') ? 1 : 0;
    // console.log("checkbox data: " + data.selected);
  });

  $('#usertable tbody').on('click', 'td', function () {
    const data = table.row($(this).parents('tr')).data();
    const col = table.cell(this).index().column;
    // console.log("cell clicked with col: " + col + " data: " + JSON.stringify(data));

    if (col !== 5) { // do not load agent info if the clicked cell is the checkbox
      const url = `./GetAgent/${data[3]}`;
      console.log(`GetAgent url: ${url}`);
      selectedUser = data[0];
      $.get('./GetAgent', {
        username: data[3]
      },
      (result, _status) => {
        console.log(`GetAgent returned: ${JSON.stringify(result)}`);
        $('#inputUsername').val(result.username);
        $('#inputFirstname').val(result.first_name);
        $('#inputLastname').val(result.last_name);
        $('#inputEmail').val(result.email);
        $('#inputPhone').val(result.phone);
        $('#inputOrganization').val(result.organization);
        $('#inputExtension').val(result.extension);
        if (result.queue_name != null) {
          $('#inputComplaintsQueue').prop('checked', true);
        }
        if (result.queue2_name != null) {
          $('#inputGeneralQueue').prop('checked', true);
        }
        console.log(`complaintsQueue value is: ${$('#inputComplaintsQueue').val()}`);
        console.log(`generalQueue value is: ${$('#inputGeneralQueue').val()}`);
      });

      $('#inputUsername').prop('disabled', true);
      $('#inputPassword').prop('disabled', true);
      $('#confirmPassword').hide();

      $('#btnUpdateAgent').show();
      $('.glyphicon-eye-open').css('display', 'none'); // HERE
      $('#btnDeleteAgent').show();
      $('#btnAddAgent').hide();
      $('#configModal').modal();
    }
  });

  $('#btnAddAgent').on('click', (event) => {
    event.preventDefault();
    /* check if both password inputs match */
    const pass = $('#inputPassword').val();
    const pass2 = $('#inputPassword2').val();
    if (pass !== pass2) {
      alert('Re-entered password does not match!');
      return;
    }

    $.post('./AddAgent', {
      username: $('#inputUsername').val(),
      password: $('#inputPassword').val(),
      first_name: $('#inputFirstname').val(),
      last_name: $('#inputLastname').val(),
      email: $('#inputEmail').val(),
      phone: $('#inputPhone').val(),
      organization: $('#inputOrganization').val(),
      extension: $('#inputExtension').val(),
      queue_id: ($('#inputComplaintsQueue').prop('checked')) ? ($('#inputComplaintsQueue').val()) : 0,
      queue2_id: ($('#inputGeneralQueue').prop('checked')) ? ($('#inputGeneralQueue').val()) : 0
    },
    (data, _status) => {
      if (data.result === 'success') {
        console.log('Saved!!!!');
        location.reload();
      } else {
        console.log(`POST failed: ${JSON.stringify(data)}`);
        alert(data.message);
      }
    });
  });

  $('#btnDeleteAgent').on('click', (event) => {
    event.preventDefault();
    console.log(`AgentId selected to delete: ${selectedUser}`);
    $('#confirm-delete').modal();
  });

  $('#btnUpdateAgent').on('click', (event) => {
    event.preventDefault();

    $.post('./UpdateAgent', {
      agent_id: selectedUser,
      username: $('#inputUsername').val(),
      first_name: $('#inputFirstname').val(),
      last_name: $('#inputLastname').val(),
      email: $('#inputEmail').val(),
      phone: $('#inputPhone').val(),
      organization: $('#inputOrganization').val(),
      extension: $('#inputExtension').val(),
      queue_id: ($('#inputComplaintsQueue').prop('checked')) ? ($('#inputComplaintsQueue').val()) : 0,
      queue2_id: ($('#inputGeneralQueue').prop('checked')) ? ($('#inputGeneralQueue').val()) : 0
    },
    (data, _status) => {
      if (data.result === 'success') {
        console.log(`POST succ: ${JSON.stringify(data)}`);
        location.reload();
      } else {
        console.log(`POST failed: ${JSON.stringify(data)}`);
        alert(data.message);
      }
    });
  });

  $('#delete_user_btn').on('click', () => {
    getBulkDeleteAgentList();
    $('#confirm-bulk-delete').modal();
  });

  $('#bulk_delete_btn').on('click', (event) => {
    event.preventDefault();

    const data = table.rows().data();
    data.each((value, _index) => {
      if (value.selected === 1) {
        // console.log("Bulk delete: checked at index: ", index)
        // console.log("agent id checked is: " + value[0] + " agent username is: " + value[3]);

        // Issue delete at backend
        $.post('./DeleteAgent', {
          id: value[0],
          username: value[3]
        },
        (data, _status) => {
          if (data.result !== 'success') {
            console.log(`DeleteAgent ${value[3]} failed: ${JSON.stringify(data)}`);
            alert(data.message);
          }
        });
      }
    });

    location.reload();
  });

  function getBulkDeleteAgentList() {
    // console.log("getBulkDeleteAgentList() invoked");

    let agentNames = '';
    const data = table.rows().data();
    data.each((value, _index) => {
      if (value.selected === 1) {
        // console.log("Bulk delete: checked at index: ", index)
        // console.log("agent id checked is: " + value[0] + " agent username is: " + value[3]);
        agentNames += `  ${value[3]}`;
      }
    });

    // present dynamically generated agentlist
    document.getElementById('agentlist').innerHTML = agentNames;
  }
});

function addUserModal() {
  $('#addUserForm').trigger('reset');
  $('#btnUpdateAgent').hide();
  $('.glyphicon-eye-open').css('display', ''); // HERE
  $('#btnDeleteAgent').hide();
  $('#btnAddAgent').show();
  $('#configModal').modal();

  $('#inputUsername').prop('disabled', false);
  $('#inputPassword').prop('disabled', false);
  $('#confirmPassword').show();
  $('#inputPassword2').prop('disabled', false);
}

function deleteUser() {
  $.post('./DeleteAgent', {
    id: selectedUser,
    username: $('#inputUsername').val()
  },
  (_data, _status) => {
    console.log('Deleted!!!!');
    location.reload();
  });
}

$('.glyphicon-eye-open').on('mouseover mouseout', function (_e) {
  $(this).toggleClass('glyphicon-eye-close');
  const field = $(this).parent().children('input');
  const type = $(field).attr('type');

  if (type === 'text') {
    $(field).prop('type', 'password');
  } else {
    $(field).prop('type', 'text');
  }
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

      // update version in footer
      socket.on('adversion', (data) => {
        $('#ad-version').text(data.version);
        $('#ad-year').text(data.year);
      });
    }
  },
  error(_xhr, _status, _error) {
    console.log('Error');
    $('#message').text('An Error Occured.');
  }
});
