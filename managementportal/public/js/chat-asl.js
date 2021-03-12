// This file is executed in the browser, when people visit /chat/<random id>
let chatarea;
let chatinput;
let socket;
let id;
let chats;
// let realtimearea;
// const realtimetext = false;
let newline = true;
let currentli = null;

function scrollToBottom() {
  chatarea.scrollTop(chatarea[0].scrollHeight - chatarea.height());
}

// Function that creates a new chat message
function createChatMessage(msg, user) {
  // user is either 'you' or 'me'
  /*
    var li = $(
        '<li class=' + user + '>'+
            '<div class="image">' +
                '<img src=' + imgg + ' />'
                '<b></b>' +
                '<i class="timesent" data-time=' + now + '></i> ' +
            '</div>' +
            '<p></p>' +
        '</li>');
    */
  const li = $(
    `<li class=${user}>`
        // '<p></p>' +
        + '</li>'
  );

  // use the 'text' method to escape malicious user input
  li.text(`${user}: ${msg}`);

  chats.append(li);
  chats.scrollTop(chats[0].scrollHeight - chats.height());
}

function processChatMessage(msg, user) {
  currentli = $(
    `<li class=${user}>`
        // '<p></p>' +
        + '</li>'
  );
  currentli.text(msg);
  chats.append(currentli);
  scrollToBottom();
}

function showMessage(status, _data) {
  console.log(`showMesage: ${status}`);
}
function showProperty(msg, obj) {
  console.log(`${msg}========================================`);
  if (!obj) return;

  Object.keys(obj).forEach((key) => {
    console.log(`${key} = ${obj[key]}`);
  });
}

function sendChat(key) {
  if (chatinput.val().length) {
    // Send the message to the other person in the chat
    socket.emit('msg', { msg: chatinput.val(), key });
    if (key === 13) { // enter key
      createChatMessage(chatinput.val(), 'me');
      chatinput.val('');
    } else if (key === 32) { // space key

    }
    scrollToBottom();
  }
}

function socketToken() {
  let token = '';
  $.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    async: false,
    success(data) {
      if (data.message === 'success') {
        token = data.token;
      }
    }
  });
  return token;
}

$(document).ready(() => {
  chatarea = $('#chat_area');
  chatinput = $('#chat_input');
  chats = $('#chats_ul');
  // variables which hold the data for each person
  const name = '';
  const email = '';

  $(document).on('connect-to-chat-server', (evt, url) => {
    console.log(`==============================================================connect-to-chat-server event received - url: ${url}`);

    if (url) {
      socket = io.connect(`http://${window.location.host}`, {
        query: `token=${socketToken()}`,
        forceNew: true
      });
    } else {
      socket = window.socket_chat;
    }

    $(document).on('disconnect-chat-server', (_evt, _room) => {
      socket.disconnect();
    });

    $(document).on('terminate-chat-session', (_evt, room) => {
      socket.emit('leave', room);
    });

    $(document).on('chat-register', (_evt, room) => {
      socket.emit('chat_login', { user: name, avatar: email, id: room });
    });

    $(document).on('chat-unregister', (_evt, room) => {
      socket.emit('leave', room);
    });

    socket.on('opentok', (data) => {
      showProperty('Opentok credentials', data.opentok);
      if (data && data.opentok) {
        window.opentok = data.opentok;
      }
    });

    socket.on('leave', (data) => {
      if (data.boolean && id === data.room) {
        showMessage('Leaving chat room: ', data);
        socket.emit('leave', id);
      }
    });

    socket.on('tooMany', (data) => {
      if (data.boolean && name.length === 0) {
        showMessage('tooManyPeople');
      }
    });

    socket.on('receive', (data) => {
      console.log(`Received message: ${JSON.stringify(data, null, 4, true)}`);
      if (data.msg.key === 13) { // enter key
        newline = true;
      } else if (newline) {
        newline = false;
        processChatMessage(data.msg.msg, 'you');
      } else {
        currentli.text(data.msg.msg);
      }
    });

    // this to prevent the enter key to submit the form on the user side
    chatinput.keypress((e) => {
      if (e.keyCode === 13) {
        return false;
      }
      return true;
    });

    chatinput.keyup((e) => {
      e.preventDefault();
      // Submit the form on enter. e.which 32 = space, 13 = return
      sendChat(e.which);
    });
  });
});
