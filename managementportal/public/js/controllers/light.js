let socket;

/**
 * adds a message below the submit button
*/
function addMessage() {
  document.getElementById('message').innerHTML = 'Click "Save" to submit your changes';
}

/**
 * reders the data in default_color_config.json on the screen.
 * NOTE: does not save the data, user still has to hit "save"
*/

function ResetColorConfig() {
  socket.emit('reset-color-config');
}
/**
 * disables color from all other statuses' selection lists and reenables oldColor.
 * does not disable currently selected color from its correlating status
 * @param {color} is the current color value to disable
 * @param {oldColor} the previous color value that needs to be enabled
 * @param {statusName} the name of the status that called this function
*/
function DisableColors(color, oldColor, statusName) {
  const options = document.getElementsByTagName('option');
  Object.keys(options).forEach((option) => {
    // can select "off" for mutliple statuses
    if (color !== 'off') {
      // to compare option id with status name, so we don't disable an option
      // that is currently selected
      const optionStatusId = `option_${statusName}`;
      if (options[option].value === color && options[option].id !== optionStatusId) {
        options[option].disabled = true;
        options[option].style.color = '#cecece';
      }
    }
    if (options[option].value === oldColor) {
      options[option].disabled = false;
      options[option].style.color = '#333';
    }
  });

  $('.selectpicker').selectpicker('refresh');
}

/**
  * emits a submit message with the form data to the server
 */
function SubmitForm() {
  document.getElementById('message').innerHTML = '';
  const inputs = $('#form_input :input').not(':button'); // all input fields (not button because bootstrap-select makes them into buttons)
  const parsedInputs = []; // only the values of the statuses
  inputs.each(function PushParsedInputs() {
    parsedInputs.push(this.value);
  });

  socket.emit('submit', parsedInputs);
}

/**
 * returns string with first letter capitalized
 * @param {string} the string to capitalize
 * @return the new string
*/
function CapitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * calculates and returns the html id of the selected color/action in the json file
 * @param {jsonData} a json object of the color_config.json file
 * @param {status} the status index to get the correct status info in the json file
 * @return the selected color id in the form "green_solid" or "red_blinking"
*/
function GetSelectedOptionId(jsonData, status) {
  const { color } = jsonData.statuses[status];
  const blinking = (jsonData.statuses[status].blink) ? '_blinking' : '_solid';
  let selectedOption = color + blinking;
  if (color === 'off') selectedOption = 'off'; // to avoid "off_solid" and "off_blinking"
  return selectedOption;
}

/**
 *reads the data from the json file and creates the html form with the correct statuses and colors
 *@param {jsonData} a json object of the color_config.json file
*/
function AppendHtml(jsonData) {
  Object.keys(jsonData.statuses).forEach((status) => {
    const statusId = jsonData.statuses[status].id;
    const statusName = CapitalizeFirstLetter(jsonData.statuses[status].name);

    // append <label> and <select>
    //  <select> has unique id (id from jsonData)
    $('#form_table').append(
      `${'<tr>'
            + '<th style=" font-weight: normal; min-width:140px;">'
            + '<p style = "margin-right: 10px; margin-top: 10px;" for="'}${statusId}">${statusName}:</p>`
            + '</th>'
            + '<th style=" font-weight: normal; min-width:215px; width: 100%; max-width: 50%;">'
            + `<select class="form-control selectpicker" aria-hidden="true" id="${statusId}" name ="${statusId}" onfocus = "this.old_value" onchange = "DisableColors(this.value,this.old_value,this.id);this.old_value=this.value; addMessage();">`
    );

    // append <option>
    // "<option> value" is the color and action concatinated, "green_blinking" for example
    // "<option> id" is the word option concatinated with the status id, "option_away" for example
    // the div class name in "data-content" is for the circle icon,
    // "green-blinking" or "green-solid"
    Object.keys(jsonData.colors).forEach((color) => {
      Object.keys(jsonData.actions).every((action) => {
        const circleIconClass = `${jsonData.colors[color].toLowerCase()}-${jsonData.actions[action].toLowerCase()}`;
        const nameShown = `${CapitalizeFirstLetter(jsonData.colors[color])} - ${jsonData.actions[action]}`;
        const value = `${jsonData.colors[color].toLowerCase()}_${jsonData.actions[action].toLowerCase()}`;
        // don't want off-solid and off-blinking, so we break out of the loop
        if (jsonData.colors[color] === 'off') {
          $(`#${statusId}`).append(
            `<option data-content="<span class='circle gray'></span><div style='font-size:20px;'> Off </div>" value = "off" id = "option_${statusId}"> </option>`
          );
          return false;
        }
        $(`#${statusId}`).append(
          `<option data-content="<span class='circle ${circleIconClass}'></span><div style='font-size:20px;'>${nameShown}</div>" value = "${value}" id = "option_${statusId}"> </option>`
        );
        return true;
      });
    });

    // finish appending html
    $('#form_table').append(
      '</select">'
            + '</th>'
            + '</tr>'
    );
  });

  $('.selectpicker').selectpicker('refresh');
}

/**
 *sets up the html document dynamically based on the json data received
 *@param {data}  the unparsed color_config.json file
*/
function SetupHtml(data) {
  const jsonData = JSON.parse(data);
  AppendHtml(jsonData);

  Object.keys(jsonData.statuses).forEach((status) => {
    // set currently selected color
    const selectedOption = GetSelectedOptionId(jsonData, status);
    document.getElementById(jsonData.statuses[status].id).value = selectedOption;
    document.getElementById(jsonData.statuses[status].id).old_value = selectedOption;

    // disable selected color from other menues
    DisableColors(selectedOption, '', jsonData.statuses[status].id);
  });

  $('.selectpicker').selectpicker('refresh');
}

$('#ResetColorButton').on('click', () => {
  ResetColorConfig();
});

$('#SubmitForm').on('click', () => {
  SubmitForm();
});

$(document).ready(() => {
  $('#sidebarlight').addClass('active');

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
        socket.emit('get_color_config');

        // sets up the html page dynmically via the json file received
        socket.on('html_setup', (data) => {
          SetupHtml(data);
        });

        // update version in footer
        socket.on('adversion', (data) => {
          $('#ad-version').text(data.version);
          $('#ad-year').text(data.year);
        });

        // updates the colors shown on the page (does not resave them, just changes the display)
        socket.on('update-colors', (data) => {
          document.getElementById('form_table').innerHTML = '';
          $('#form_table').append(
            '<tr style="height:20px;">'
                        + '<th style = "text-decoration: underline; padding-bottom: 5px;"> Status </th>'
                        + '<th style = "text-decoration: underline; padding-bottom: 5px;"> Color </th>'
                        + '</tr>)'
          );
          addMessage();
          SetupHtml(data);
        });
      }
    },
    error(_xhr, _status, _error) {
      console.log('Error');
      $('#message').text('An Error Occured.');
    }
  });
});
