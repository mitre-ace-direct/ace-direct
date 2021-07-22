var socket;
var extensionMe;
var extensionMePassword;
var queueNameMe;
var channelMe;
var ticketTabFade;
var busylight = new Busylight();
var agentStatus = 'OFF';
var away_color;
var ready_color;
var in_call_color;
var hold_color;
var incoming_call_color;
var transferred_call_color;
var wrap_up_color;
var need_assistance_color;
var missed_call_color;
var away_blinking;
var ready_blinking;
var in_call_blinking;
var hold_blinking;
var incoming_call_blinking;
var transferred_call_blinking;
var wrap_up_blinking;
var need_assistance_blinking;
var missed_call_blinking;
//var videomail_status_buttons = document.getElementById("videomail-status-buttons");
var videomail_status_buttons = document.getElementById("videomail-status-buttons-footer");
var record_status_buttons = document.getElementById("record-status-buttons-footer");
var sortFlag = "id desc";
var filter = "ALL";
var recordSortFlag = "timestamp desc";
var recordFilter = "ALL";
var telNumber;
var playingVideomail = false;
var acekurento;
var privacy_video_url = window.location.origin + "/" + nginxPath + "/media/videoPrivacy.webm";
var calibrate_video_url = window.location.origin + "/" + nginxPath + "/media/calibrate.webm";
var recipientNumber;
//Used for tracking new videomail
var storedData = document.getElementById("unread-mail-count").innerHTML;
//Used for DTMFpad toggle
var DTMFpad = false;
//Call history values
var callerName = "";
var callerNumber;
var direction;
var duration;
var callDate;
var endpoint;
var meterelem = null;
var meterelemval = null;
var packetsLostElem = null;
var packetsLostValElem = null;

//shortcut table variables
var originalShortcuts = [];

//missed call variables
var maxMissedCalls;
var totalMissedCalls = 0;

//agent to agent chat variables
var agentChatOpen = false;
var unreadAgentChats = 0;
var hasUnreadAgentChats = false;
var isChatListOpen = false;
var isAgentChatSaved;
var tempSavedMessages = [[]];

//transfer call variables
var isTransfer = false;
var originalExt;
var transferExt;
var transferVRS;
var transferAccepted = false;
var isColdTransfer;

// multiparty hangup variables
var hostAgent;
var backupHostAgent;
var transitionExt;
var transitionAgent;

var autoAnswer= false;
var multipartyTransition = false;
var isMultipartyTransfer = false;
var allAgentCall = false;
var consumerType;

// call monitoring 
var isMonitoring = false;
var beingMonitored = false;
var monitorExt;
var extensionBeingMonitored;
var monitorTransition = false;

setInterval(function () {
	busylight.light(this.agentStatus);
}, 2000);

$(document).ready(function () {
        
        // connection elements
        meterelem = document.getElementById('speedMeter');
        meterelemval = document.getElementById('speedval');
        packetsLostElem = document.getElementById('packets-lost-a');
        packetsLostValElem = document.getElementById('connection-packets-lost');
        meterelem.high = fpsHigh;
        meterelem.low = fpsLow; 
        meterelem.max = fpsMax; 
        meterelem.min = fpsMin
        meterelem.optimum = fpsOptimum;

	connect_socket();
	$("#debugtab").hide();
	$('#scriptstab').hide();
	$("#geninfotab").hide();
	$("#complaintstab").hide();
	$("[data-mask]").inputmask();

	// chat-transcript toggle
	$('#chat-tab').on('click', function(){
	  $('#chat-body').css('display', 'block');
	  $('#chat-footer').css('display', 'block');
	  $('#trans-body').css('display', 'none');
	});
	$('#trans-tab').on('click', function(){
	  $('#chat-body').css('display', 'none');
	  $('#chat-footer').css('display', 'none');
	  $('#trans-body').css('display', 'block');
	});

	clearScreen();

	$.getJSON("./resources/licenses.json", function (data) {
		$.each(data.license, function (i) {
			$("#licModalBody").append("<h3>" + data.license[i].name + "<h3><pre>" + data.license[i].pre + "</pre>");
		});
	});

	//store the default shortcut values
	var taskArray = $("[accesskey]").map(function(){
		return $(this).attr('id');
	}).get();

	for (var i = 0; i < taskArray.length; i++) {
		originalShortcuts[i] = getShortcut(taskArray[i]);
	}

	enable_persist_view();
	$('a[data-toggle="tab"]').on('shown.bs.tab', function(e){
		alignDataTableHeaders();
	 });
});

function connect_socket() {
	console.log('connect_socket to ');
	console.log(window.location.host);
	$.ajax({
		url: './token',
		type: 'GET',
		dataType: 'json',
		success: function (data) {
			console.log(JSON.stringify(data));
			if (data.message === "success") {
				socket = io.connect('https://' + window.location.host, {
					path: nginxPath+'/socket.io',
					query: 'token=' + data.token,
					forceNew: true
				});


				loadCallHistory();

				updateShortcutTable();

				//update the version and year in the footer
				socket.on('adversion', function (data) {
					$('#ad-version').text(data.version);
					$('#ad-year').text(data.year);
				});

				socket.on('connect', function () {
					debugtxt('connect', {
						"no": "data"
					});
					console.log('authenticated');

					socket.emit("get_color_config");

					//get the payload from the token
					var payload = jwt_decode(data.token);
					var signaling_url = payload.signalingServerUrl;
					signaling_url = signaling_url.trim();
				    acekurento = new ACEKurento({acekurentoSignalingUrl: signaling_url  });

					acekurento.remoteStream = document.getElementById('remoteView');
					acekurento.selfStream = document.getElementById('selfView');

					$('#loginModal').modal('hide');
					$('#statusmsg').text(""); //clear status text

					//populate call agent information
					$('#displayname').val("CSR " + payload.first_name);
					$('#agentname-sidebar').html(payload.first_name + " " + payload.last_name);
					$('#agentname-header').html(payload.first_name + " " + payload.last_name);
					$('#agentname-headerdropdown').html(payload.first_name + " " + payload.last_name);
					$('#agentrole-headerdropdown').html("<small>" + payload.role + "</small>");
					$('#sip_password').attr("name", payload.extensionPassword);
					$("#pc_config").attr("name", "stun:" + payload.stunServer);
					$("#complaints-queue-num").text(payload.complaint_queue_count);
					$("#general-queue-num").text(payload.general_queue_count);

					if (payload.queue_name === "ComplaintsQueue" || payload.queue2_name === "ComplaintsQueue") {
						$('#sidebar-complaints').show();
					}
					if (payload.queue_name === "GeneralQuestionsQueue" || payload.queue2_name === "GeneralQuestionsQueue") {
						$('#sidebar-geninfo').show();
					}

					if (payload.layout || sessionStorage.layout) {
						var layout = typeof sessionStorage.layout !== "undefined" ? sessionStorage.layout : payload.layout;
						loadGridLayout(JSON.parse(layout));
					}

					socket.emit('register-client', {
						"hello": "hello"
					});
					socket.emit('register-agent', {
						"hello": "hello"
					});

					extensionMe = payload.extension; //e.g. 6001
					extensionMePassword = payload.extensionPassword;
					queueNameMe = payload.queue_name; //e.g. InboundQueue
					channelMe = payload.channel; //e.g. SIP/7001
					register_jssip();
					pauseQueues();
					socket.emit('get-videomail', {
						"extension": extensionMe,
						"sortBy": "id desc",
						"filter": "ALL"
					});
					setInterval(function () {
						socket.emit('get-videomail', {
							"extension": extensionMe,
							"sortBy": sortFlag,
							"filter": filter
						});
					}, 5000);
					socket.emit('get-recordings', {
						"extension": extensionMe,
						"sortBy": "timestamp desc",
						"filter": "ALL"
					});
					setInterval(function () {
						console.log("Interval recording sort");
						socket.emit('get-recordings', {
							"extension": extensionMe,
							"sortBy": recordSortFlag,
							"filter": recordFilter
						});
					}, 5000)
					toggle_videomail_buttons(false);
					toggle_recording_buttons(false);
					console.log('Sent a get-videomail event');

					// Initialize agent language to English
					console.log('Initializing agent language to English');
					socket.emit('set-agent-language', {
						"language":'en',
						"extension": extensionMe
					});
					socket.emit('get-dial-in-number', {'extension':extensionMe});
				}).on('disconnect', function () {
					debugtxt('disconnect');
					console.log('disconnected');
					unregister_jssip();
					changeStatusLight('OFF_DUTY');
				}).on("unauthorized", function (error) {
					debugtxt('unauthorized', error);
					if (error.data.type === "UnauthorizedError" || error.data.code === "invalid_token") {
						console.log("EXPIRED session");
						logout("Session has expired");
					}
				}).on('error', function (reason) {
					debugtxt('error', reason);

					if (reason.code === "invalid_token") {
						//logout("Session has expired");
						location.reload();
					} else {
						logout("An Error Occurred: " + JSON.stringify(reason));
					}
				}).on("call-center-closed", function (data) {
                                  if (data.closed) {
                                    $("#closed-label").text('Call Center Closed');
                                  } else {
                                    $("#closed-label").text('');
                                  }
                }).on('typing', function (data) {
					debugtxt('typing', data);
					if ($("#displayname").val() !== data.displayname) {
						$("#rtt-typing").html(data.displayname + ": " + data.rttmsg).addClass("direct-chat-text").addClass("direct-chat-timestamp text-bold");
						$("#rtt-typing").appendTo($("#chat-messages"));
					}
				}).on('typing-clear', function (data) {
					debugtxt('typing-clear', data);
					if ($("#displayname").val() !== data.displayname) {
						$("#chat-messages").remove($("#rtt-typing"));
						$('#rtt-typing').html('').removeClass("direct-chat-text");
					}
				}).on('new-caller-general', function (endpoint_type) { // a new general caller has connected
					debugtxt('new-caller-general', data);
					$('#duration').timer('reset');
					inCallADGeneral(endpoint_type);
				}).on('new-caller-complaints', function (endpoint_type) {
					// a new complaints caller has connected
					debugtxt('new-caller-complaints', data);
					if(isTransfer && !transferVRS) {
					    //provider call bring transferred
						endpoint_type = "Provider_Complaints";
					}
					$('#duration').timer('reset');
					inCallADComplaints(endpoint_type);
				}).on('no-ticket-info', function (data) {
					debugtxt('no-ticket-info', data);
					$('#notickettxt').show();
					$('#ticketTab').addClass("bg-pink");
				}).on('chat-leave', function (data) {
                    if (acekurento.activeAgentList)
					  console.log(acekurento.activeAgentList.length + " is number of agents.");
					if(acekurento.activeAgentList  && acekurento.activeAgentList.length < 2){
						debugtxt('chat-leave', data);
						$('#duration').timer('pause');
						$('#user-status').text('Wrap Up');
						$('#complaintsInCall').hide();
						$('#geninfoInCall').hide();
						socket.emit('wrapup', null);
						changeStatusIcon(wrap_up_color, "wrap-up", wrap_up_blinking);
						changeStatusLight('WRAP_UP');
						socket.emit('chat-leave-ack', data);
					} else {
						// consumer left multiparty call-- agents still in call together
						socket.emit('chat-leave-ack', data);
					  	clearScreen();
					}
				}).on('chat-message-new', function (data) {
					debugtxt('chat-message-new', data);

					//Translate incoming message
					var localLanguage = $('#language-select').val();
					console.log('Selected language is ' + $('#language-select').val());
					//var localLanguage = "es";
					data["toLanguage"] = localLanguage;
					if(localLanguage == data.fromLanguage){
						newChatMessage(data);
					}else{
						socket.emit('translate', data);
					}
				}).on('chat-message-new-translated', function (data){
					//console.log('translated', data)
					newChatMessage(data);
				}).on('translate-language-error', function (error){
					console.error('Translation error:', error);
				}).on('script-data', function (data) {
					debugtxt('script-data', data);
					for (var i in data.data) {
						if (data.data[i].id === 1)
							$('#info_script_content').val(data.data[i].text);
						if (data.data[i].id === 2)
							$('#complaints_script_content').val(data.data[i].text);
					}
				}).on('ad-zendesk', function (data) {
					debugtxt('ad-zendesk', data);
					$('#ticketId').val(data.id);
					$('#lastupdated').val(data.updated_at);
					$('#subject').val(data.subject);
					$('#problemdesc').val(data.description);
				}).on('ad-vrs', function (data) {
					debugtxt('ad-vrs', data);
					$('#callerFirstName').val(data.data[0].first_name);
					$('#callerLastName').val(data.data[0].last_name);
					$('#callerPhone').val(data.data[0].vrs);
					$('#callerAddress1').val(data.data[0].address);
					$('#callerCity').val(data.data[0].city);
					$('#callerState').val(data.data[0].state);
					$('#callerZipcode').val(data.data[0].zip_code);
					$('#callerEmail').val(data.data[0].email);

					$('#duration').timer('reset');
					socket.emit('register-vrs', {
						"vrs": data.data[0].vrs
					});
					var vrs = $('#callerPhone').val();
					var agent_name = $("#agentname-sidebar").text();
					socket.emit('send-name', {
						"agent_name": agent_name,
						"vrs": vrs
					});
				}).on('ad-zendesk-update-success', function (data) {
					debugtxt('ad-zendesk-update-success', data);
					$('#alertPlaceholder').html('<div id="saveAlert" class="alert alert-success alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>Success!</div>');
					$('#lastupdated').val(data.updated_at);
				}).on('ad-ticket-created', function (data) {
					debugtxt('ad-ticket-created', data);
					$('#alertPlaceholder').html('<div id="saveAlert" class="alert alert-success alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>Success!</div>');
					$('#lastupdated').val("");
					$('#subject').val(data.subject);
					$('#problemdesc').val(data.description);
					$('#ticketId').val(data.zendesk_ticket);
				}).on('agent-status-list', function (data) {
					if (data.message === "success") {
						var tabledata = {
							data: []
						};
						//Table for multi party invite
						$('#availableAgents').empty();
						$('#availableAgents').append(
							"<tr><td>Name</td>" +
							"<td>Extension</td>" +
							"<td>Status</td>" +
							"<td>Monitor Call</td>" + 
							"<td>Transfer Call</td>" + 
							"<td>Multi-Party Invite</td>"+
							"<td>Chat</td></tr>"
						);
						for (var i = 0; i < data.agents.length; i++) {
							var statusTxt, sColor, queues = "";
							var sBlinking = false;
							switch (data.agents[i].status) {
								case "READY":
									sColor = ready_color;
									sBlinking = ready_blinking;
									statusTxt = "Ready";
									break;
								case "AWAY":
									sColor = away_color;
									sBlinking = away_blinking;
									statusTxt = "Away";
									break;
								case "INCALL":
									sColor = in_call_color;
									sBlinking = in_call_blinking;
									statusTxt = "In Call";
									break;
								case "WRAPUP":
									sColor = wrap_up_color;
									sBlinking = wrap_up_blinking;
									statusTxt = "Wrap Up";
									break;
								case "INCOMINGCALL":
									var inThirdParty = false;

									if(acekurento && acekurento.activeAgentList){
										for(var j = 0; j < acekurento.activeAgentList.length; j++){
											if(acekurento.activeAgentList[j].ext == data.agents[i].extension){
												inThirdParty = true;
											}
										}
									}
									if(inThirdParty){
										sColor = in_call_color;
										sBlinking = in_call_blinking;
										statusTxt = "In Call";
										break;
									} else {
										sColor = incoming_call_color;
										sBlinking = incoming_call_blinking;
										statusTxt = "Incoming Call";
										break;
									}
								case "MISSEDCALL":
									sColor = missed_call_color;
									sBlinking = missed_call_blinking;
									statusTxt = "Missed Call";
									break;
								case "TRANSFERRED_CALL":
									sColor = transferred_call_color;
									sBlinking = transferred_call_blinking;
									statusTxt = "Transfer Call";
									break;
								default:
									sColor = "gray";
									statusTxt = "Unknown";
							}

							var statusDiv = document.createElement('div');
							var statusLightIcon = document.createElement('i');

							$(statusDiv).css('display:inline-block');
							$(statusLightIcon).addClass(getStatusIconClasses(sColor, sBlinking));
							$(statusDiv).append(statusLightIcon);
							$(statusDiv).append("&nbsp;&nbsp;" + statusTxt);

							for (var j = 0; j < data.agents[i].queues.length; j++) {
								queues += data.agents[i].queues[j].queuename + "<br>";
							}

							queues = queues.replace(/<br>\s*$/, "");
							tabledata['data'].push({
								"status": $(statusDiv).html(),
								"name": data.agents[i].name,
								"extension": data.agents[i].extension,
								"queues": queues,
								"monitorCall": monitorAvailability(data.agents[i].status, data.agents[i].name, data.agents[i].extension),
								"transferCall": transferAvailability(data.agents[i].status, data.agents[i].name, data.agents[i].extension),
								"multipartyInvite" : (data.agents[i].status == 'READY' && $('#user-status').text() == 'In Call' && $("#agentname-sidebar").text() != data.agents[i].name)
								? "<Button class=\"demo-btn\" onClick=multipartyinvite(" + data.agents[i].extension + ")><i class=\"fa fa-users\"></i></Button>"
								: "<Button class=\"secondary\" disabled><i class=\"fa fa-users\"></i></Button>",
								"chat": '<Button class=\"demo-btn\" onClick="showChatMessage(\'' + data.agents[i].extension + '\',\'' + data.agents[i].name + '\')"><i class=\"fa fa-comments\"></i></Button>'
							});
							$('#availableAgents').append(
								"<tr><td>" + data.agents[i].name + "</td>" +
								"<td>" + data.agents[i].extension + "</td>" +
								"<td>" + $(statusDiv).html() + "</td>"
							);
							if(data.agents[i].status == "READY" && $('#user-status').text() == 'In Call' && $('agentname-sidebar').text() != data.agents[i].name){
								$('#availableAgents').append(
									"<td><Button class=\"btn btn-default\" onClick=multipartyinvite(" + data.agents[i].extension + ")>Invite to Call</Button></td></tr>"
								);
							}else{
								$('#availableAgents').append("</tr>");
							}
						}

						$('#agenttable').dataTable().fnClearTable();
						if (tabledata.data.length > 0) {
							$('#agenttable').dataTable().fnAddData(tabledata.data);
						}
						alignDataTableHeaders();	
					}
				}).on('new-caller-ringing', function (data) {
					debugtxt('new-caller-ringing', data);
					$('#myRingingModal').addClass('fade');

					if (isTransfer) {
						//automatically accept the incoming call so the agent doesn't have to do it twice
						
						if(data.phoneNumber){
							$('#myRingingModalPhoneNumber').html(data.phoneNumber);
							recipientNumber = data.phoneNumber;
							callerNumber = data.phoneNumber;
						} else{
							$('#myRingingModalPhoneNumber').html(data.callerNumber);
						}
						
						$('#myRingingModal').modal({
							show: false,
							backdrop: 'static',
							keyboard: false
						});

						if (data.vrs) {
							//get the consumer vrs
							$('#callerPhone').val(data.vrs);
						}

						setTimeout(() => {
							$('#accept-btn').trigger('click');
						}, 1000);
					} else {
						$('#incoming-header').html('Incoming Call');
						changeStatusLight('INCOMING_CALL');
						changeStatusIcon(incoming_call_color, "incoming-call", incoming_call_blinking);
						$('#user-status').text('Incoming Call');
						if(data.phoneNumber){
							$('#myRingingModalPhoneNumber').html(data.phoneNumber);
							recipientNumber = data.phoneNumber;
							callerNumber = data.phoneNumber;
						} else{
							$('#myRingingModalPhoneNumber').html(data.callerNumber);
						}
						if (autoAnswer) {
							console.log('autoAnswer')
							// multiparty transition
							$('#myRingingModal').modal({
								show: false,
								backdrop: 'static',
								keyboard: false
								});
								setTimeout(() => {
									$('#accept-btn').trigger('click');
								}, 1000);
								autoAnswer = false;
						} else {
							// standard incoming call
							$('#myRingingModal').modal({
							show: true,
							backdrop: 'static',
							keyboard: false
							});

							if (data.vrs) {
								console.log('webrtc call');
								//get the consumer vrs
								$('#callerPhone').val(data.vrs);
							}
						}
						//Did come with null
						socket.emit('incomingcall', null);
					}
				}).on('new-missed-call', function (data) {
					maxMissedCalls = data.max_missed;
					if (maxMissedCalls == '') {
						//the config file doesn't have the param
						maxMissedCalls = 3;
					}
					totalMissedCalls++;
					if (totalMissedCalls >= maxMissedCalls) {
						//set agent status to away
						pauseQueues();
						totalMissedCalls = 0;
					} else {
						unpauseQueues();
					}
					debugtxt('new-missed-call', data);
					$('#myRingingModal').modal('hide');
				}).on('outbound-answered', function (data) {
					debugtxt('outbound-answered', data);
					$('#modalOutboundCall').modal('hide');
					console.log("ANSWER -- Option 2: Added asterisk AMI event listener to catch outboud answers. Good: fires when asterisk detects the call has been answered. Bad: not sure what happens if call is never answered. Not sure about multiparty calls.");
					//setTimeout(() => {
					//	calibrateVideo(2000);
					//}, 1000);
				}).on('new-peer', function (data) {
					//new peer is required for out going videomail on purple and zrvs networks
					// if this is done on a convo provider call it could cause black/green video issues.
					//console.log("New peer joined the call for purple and zvrs only");
					//toggleSelfview(200);
					calibrateVideo(200);
				}).on('request-assistance-response', function (data) {
					debugtxt('request-assistance-response', data);
                                        window.setTimeout(function() {
                                          $("#helpalert_placeholder").append('<div id="helpalert" class="alert alert-info" role="alert" >Request received.</div>');
                                          $("#helpalert").show();
                                          $("#helpalert").fadeTo(3000, 0).slideUp(500, function(){
                                            $(this).remove();
                                          });
                                        }, 0);
				}).on('lightcode-configs', function (data) {
					debugtxt('lightcode-configs', data);
					updateColors(data);
					busylight.updateConfigs(data);
				}).on('caption-config', function (data) {
					if(data == 'false') {
						console.log('captions off');
						$('.config-hide').css('display', 'none');
						$('#transcriptoverlay').css('display', 'none');
						$('#mute-captions').css('display', 'none');
					}
				}).on('skinny-config', function (data) {
					if (data === "true") {
						$("#gsscriptbox").attr("hidden", true);
						$("#gsdetailsbox").attr("hidden", true);
					} else {
						$("#gsscriptbox").removeAttr("hidden");
						$("#gsdetailsbox").removeAttr("hidden");
					}
				}).on('got-videomail-recs', function (data) {
					updateVideomailTable(data);
				}).on('got-unread-count', function (data) {
					updateVideomailNotification(data);
				}).on('got-call-recordings', function (data) {
					updateCallRecordingTable(data);
				}).on('got-call-recordings-by-number', function (data) {
					updateCallRecordingTable(data);
				}).on('changed-status', function () {
					getVideomailRecs();
				}).on('record-changed-status', function (data) {
					getRecordingVideos();
				}).on('videomail-retrieval-error', function (data) {
					$('#videomailErrorBody').html('Unable to locate videomail with ID ' + data + '.');
					$('#videomailErrorModal').modal('show');
					stopVideomail();
				}).on('queue-caller-join', function (data) {
					if (data.queue === "ComplaintsQueue") {
						$("#complaints-queue-num").text(data.count);
					} else if (data.queue === "GeneralQuestionsQueue") {
						$("#general-queue-num").text(data.count);
					}
				}).on('queue-caller-leave', function (data) {
					if (data.queue === "ComplaintsQueue") {
						$("#complaints-queue-num").text(data.count);
					} else if (data.queue === "GeneralQuestionsQueue") {
						$("#general-queue-num").text(data.count);
					}
				}).on('force-logout', function(){
					console.log("FORCED logout");
					logout('Forcefully logging out');
				}).on('agent-resp', function(data) { //Load the agent table in the multi party modal
					console.log("The agents are " + JSON.stringify(data));
				}).on('fileListAgent', function(data){
					//$('#fileSent').hide();
					addFileToAgentDownloadList(data);
				}).on('fileListConsumer', function(data) {
					//file confirmation
					//$('#fileSent').show();
					$('#fileInput').val('');
				}).on('screenshareRequest', function(data){
					//$('#screenshareButtons').show()
					if (!isMonitoring) {
						$('#screenshareRequest').modal({
							show: true,
							backdrop: 'static',
							keyboard: false
						});
					}
				}).on('caption-translated', function (transcripts) {
						console.log('received translation', transcripts.transcript, transcripts.msgid, transcripts.final);
					if(acekurento.isMultiparty || isMonitoring){
						updateCaptionsMultiparty(transcripts);
					}else{
						updateCaptions(transcripts); // in jssip_agent.js
					}
				}).on('multiparty-caption', function (transcripts) {
					// console.log(JSON.stringify(transcripts))
					socket.emit('translate-caption', {
						"transcripts": transcripts,
						"callerNumber": extensionMe,
						"displayname": transcripts.displayname
					});
				}).on('new-agent-chat', function(data) {
					var count = 0;
					if(!isAgentChatSaved && $('#chatHeader').html() !== data.displayname) {
						if (count == 0) {
							var isNewChat = true;

							showAlert('info', 'New message from ' + data.displayname);

							if(tempSavedMessages[0].length == 0) {
								//first message
								tempSavedMessages[0].push(data);
							} else {
								for (var i = 0; i < tempSavedMessages.length; i++) {
									if (tempSavedMessages[i][0].senderext == data.senderext) {
										tempSavedMessages[i].push(data);
										isNewChat = false;
									}
								}

								if (isNewChat) {
									tempSavedMessages.push([]);
									tempSavedMessages[tempSavedMessages.length-1].push(data);
								}
							}
							$('#agent-chat-list').html('');

							for (var i = 0; i < tempSavedMessages.length; i++) {
								//populate the chat list with the last element of each convo
								var lastmsg = tempSavedMessages[i][tempSavedMessages[i].length-1];

								addChat(lastmsg.displayname,lastmsg.timestamp, lastmsg.message,lastmsg.senderext, false);
								$('#unread-chat-count').html(tempSavedMessages.length);
							}
							count++;
						}

					} else {
						if (!agentChatOpen || $('#agent-ext').html() != data.senderext){
							showAlert('info', 'New message from ' + data.displayname);
							getMyChats();
						} else {
							socket.emit('chat-read', {'ext': data.senderext, 'destext':extensionMe});
							getMyChats();
						}
					}
					//check if the chat window is the same window
					if ($('#agent-ext').html() == data.senderext) {
						debugtxt('new-agent-chat', data);
						var msg = data.message;
						var displayname = data.displayname;
						var timestamp = data.timestamp;

						msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
						msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

						var msgblock = document.createElement('div');
						var msginfo = document.createElement('div');
						var msgsender = document.createElement('span');
						var msgtime = document.createElement('span');
						var msgtext = document.createElement('div');

						if ((data.senderext) == data.destext) {
							// sending message to themselves
							socket.emit('chat-read', {'ext': data.senderext, 'destext':extensionMe});

						} else {
							$('#agent-chat-messages').remove($("#rtt-typing"));
							$("#agent-rtt-typing").html('').removeClass("direct-chat-text");

							$(msgsender).addClass("direct-chat-name pull-left").html(displayname).appendTo(msginfo);
							$(msgtime).addClass("direct-chat-timestamp pull-right").html(timestamp).appendTo(msginfo);
							$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
							$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
							$(msgblock).addClass("direct-chat-msg").appendTo($("#agent-chat-messages"));
						}
						$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);
					} else {
						$('#agent-chat-messages').remove($("#rtt-typing"));
						$("#agent-rtt-typing").html('').removeClass("direct-chat-text");
					}
				}).on('agent-typing', function (data) {
					if ($('#chatHeader').html() == data.displayname && $('#chatHeader').html() != $('#agentname-sidebar').html()) {
						$("#agent-rtt-typing").html(data.displayname + ": " + data.rttmsg).addClass("direct-chat-text").addClass("direct-chat-timestamp text-bold");
						$("#agent-rtt-typing").appendTo($("#agent-chat-messages"));
						$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);
					}
				}).on('agent-typing-clear', function (data) {
					if ($('#chatHeader').html() == data.displayname && $('#chatHeader').html() != $('#agentname-sidebar').html()) {
						$("#agent-chat-messages").remove($("#agent-rtt-typing"));
						$('#agent-rtt-typing').html('').removeClass("direct-chat-text");
					}
				}).on('broadcast', function(data) {
					if (!isAgentChatSaved && $('#chatHeader').html() !== data.displayname) {
						//recieved broadcast. not saving to db
						if (data.senderext == extensionMe) {
							//recieving own broadcast
							showAlert('info', 'Successfully sent broadcast');
						} else {
							var count = 0;
							if (count == 0) {
								var isNewChat = true;

								showAlert('info', 'New broadcast from ' + data.displayname);

								if(tempSavedMessages[0].length == 0) {
									//first message
									tempSavedMessages[0].push(data);
								} else {
									for (var i = 0; i < tempSavedMessages.length; i++) {
										if (tempSavedMessages[i][0].senderext == data.senderext) {
											tempSavedMessages[i].push(data);
											isNewChat = false;
										}
									}

									if (isNewChat) {
										tempSavedMessages.push([]);
										tempSavedMessages[tempSavedMessages.length-1].push(data);
									}
								}

								$('#agent-chat-list').html('');

								for (var i = 0; i < tempSavedMessages.length; i++) {
									//populate the chat list with the last element of each convo
									var lastmsg = tempSavedMessages[i][tempSavedMessages[i].length-1];

									addChat(lastmsg.displayname,lastmsg.timestamp, lastmsg.message,lastmsg.senderext, false);
									$('#unread-chat-count').html(tempSavedMessages.length);
								}
								count++;
							}
						}

					} else {
						//update the db with the recipient's name
						socket.emit('update-broadcast-name', {'destext': extensionMe, 'senderext':data.senderext, 'name': $('#agentname-sidebar').text(), 'sendername':data.displayname, 'time':data.timeSent});

						data.destext = extensionMe;

						//check is the chat window is the same window
						if ($('#chatHeader').html() == data.displayname) {

							debugtxt('new-agent-chat', data);
							var msg = data.message;
							var displayname = data.displayname;
							var timestamp = data.timestamp;

							msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
							msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

							var msgblock = document.createElement('div');
							var msginfo = document.createElement('div');
							var msgsender = document.createElement('span');
							var msgtime = document.createElement('span');
							var msgtext = document.createElement('div');
							socket.emit('chat-read', {'ext': data.senderext, 'destext':extensionMe});

							if ((data.senderext) == extensionMe) {
								// receiving own broadcast
								showAlert('info', 'Successfully sent broadcast');
								socket.emit('chat-read', {'ext': data.senderext, 'destext':extensionMe});

							} else {
								showAlert('info', 'New broadcast from ' + data.displayname);

								$('#agent-chat-messages').remove($("#rtt-typing"));
								$("#agent-rtt-typing").html('').removeClass("direct-chat-text");

								$(msgsender).addClass("direct-chat-name pull-left").html(displayname).appendTo(msginfo);
								$(msgtime).addClass("direct-chat-timestamp pull-right").html(timestamp).appendTo(msginfo);
								$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
								$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
								$(msgblock).addClass("direct-chat-msg").appendTo($("#agent-chat-messages"));
							}
							$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);
						}
						getMyChats();
					}
				}).on('save-chat-value', function(data) {
                    console.log('saving agent chats: ');
                    console.log(data.isSaved);
                    if (data.isSaved == 'true') {
                        isAgentChatSaved = true;
                        getMyChats();
                    } else {
                        isAgentChatSaved = false;
                        $('#agent-chat-list').html('');
                        $('#agent-chat-list').append(
                            '<li><a href=\"#\">\
                                <p>Your messages will not be saved</p>\
                            </a>\
                            </li>'
                        );
                    }
				}).on('dialin-number', function(data) {
					console.log('got dial-in number: ' + JSON.stringify(data.number));
					$('#dial-in-number').html(data.number);
				}).on('mute-options', function(data) {
					//default is false
					if (data.isMuted == 'true') {
						$('#muteAudio').prop('checked', true);
					} else {
						$('#muteAudio').prop('checked', false);
					}
				}).on('enable-translation', function() {
					$('.language-select-li').show();
					$("#language-select").msDropDown();
				}).on('gotRecordingURL', function(data) {
					console.log("Assigning file " + data.file);
					const blob = new Blob([data.file]);
					const url = URL.createObjectURL( blob);
					//remoteView.setAttribute("content", "media-src 'self' blob: data:;");
					remoteView.setAttribute("src", url);
					//remoteView.setAttribute("src", './getVideomail?fileName=rec_33003_20210331_200114.mp4');
				}).on('receiveTransferInvite', function(data) {
					isTransfer = true;
					originalExt = data.originalExt;
					transferVRS = data.vrs;
					transferExt = data.transferExt;
                    
					$('#modalTransferCall').show();
					$('#modalTransferCall').addClass('fade');
					$('#incomingTransferExtension').html(data.originalExt)
					$('#modalTransferCall').modal({
						backdrop: 'static',
						keyboard: false
					});
					changeStatusLight('TRANSFERRED_CALL');
					changeStatusIcon(transferred_call_color, "transferred_call", transferred_call_blinking);
					$('#user-status').text('Transfer Call');
					socket.emit('incomingtransferredcall', null);
				}).on('transferDenied', function() {
                    if ($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#shortcuts-tab').hasClass('active')) {
                        $('#agents-btn').trigger('click');
                    }
                    showAlert('info', 'Transfer Denied. Please try again.');
                    //reset transfer variables
					$('#transferExtension').val('');
                    isTransfer = false;
					originalExt = null;
					transferVRS = null;
					transferAccepted = false;
					isColdTransfer = false;
                }).on('beginTransfer', function() {
					// initiate the call transfer in the signaling server
					if (isColdTransfer) {
						if (beingMonitored) {
							// remove monitor first
							socket.emit('force-monitor-leave', {'monitorExt': monitorExt, 'reinvite':false});
							setTimeout(() => {
								acekurento.callTransfer(transferExt.toString(), true);
							}, 500);
						} else {
						acekurento.callTransfer(transferExt.toString(), true);
						}
					} else {
						// warm transfers are multiparty calls
						multipartyinvite(transferExt);
					}
				}).on('transferJoined', function() {

                    //close the sidebar if it's open
                    if ($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#shortcuts-tab').hasClass('active')) {
                        $('#agents-btn').trigger('click');
					}

					showTransferModal = true;
					if (isColdTransfer) {
						//we terminate the call for the original agent
						setTimeout(() => {
							terminate_call();
							socket.emit('call-ended', {'agentExt': extensionMe}); //stop allowing file share between consumer and original agent
						}, 1200);
					} else {
						console.log('warm transfer success!')
					}
                }).on ('multiparty-transfer', function(data) {
					// backup host is becoming the new host of the call
					multipartyCaptionsEnd();
					if (consumerType == 'provider') {
						terminate_call();
						unpauseQueues();
						autoAnswer = true;
					}
					
					isTransfer = true;
					isMultipartyTransfer = true;
					hostAgent = extensionMe;
					transitionAgent = data.transitionAgent;
					transferVRS = data.vrs;

					$('#multipartyTransitionModal').modal('show');
					$('#multipartyTransitionModal').modal({
						backdrop: 'static',
						keyboard: false
					});
				}).on('multiparty-reinvite', function(){
					// transition agent
					autoAnswer = true;
					multipartyTransition = true;
					terminate_call();
					$('#multipartyTransitionModal').modal('show');
					$('#multipartyTransitionModal').modal({
						backdrop: 'static',
						keyboard: false
					});
				}).on('initiateMonitor', function(data) {
                    console.log('inviting ' +data.monitorExt.toString()+' to monitor this call');
                    acekurento.invitePeer(data.monitorExt.toString(), true);
                    socket.emit('monitor-invite', {'monitorExt': data.monitorExt, 'vrs': $('#callerPhone').val()});
					if ($('#callerPhone').val()) {
						// tell web consumer there's a monitor
						socket.emit('start-monitoring-consumer', {'vrs': $('#callerPhone').val()});
					}
                    beingMonitored = true;
					monitorExt = data.monitorExt;
					if (!isMultipartyCall && !monitorCaptions) {
						multipartyCaptionsStart();
						monitorCaptions = true;
					}
                }).on('monitor-join-session', function(data) {
                    //accept the call to monitor the session
					if (data.vrs) {
						console.log('webrtc call');
						$('#callerPhone').val(data.vrs);
					}
                    $('#myRingingModal').modal({
                        show: false,
                        backdrop: 'static',
                        keyboard: false
                    });
                    setTimeout(() => {
                        $('#accept-btn').trigger('click');
                    }, 1000);
					$('#multipartyTransitionModal').modal('hide');
                }).on('monitor-left', function() {
					acekurento.isMonitoring = false;
					beingMonitored = false;
					monitorExt = null;
					if(!acekurento.isMultiparty) {
						multipartyCaptionsEnd();
					}
				}).on('monitor-leave-session', function(data) {
					terminate_call();
					if (data.reinvite) {
						monitorTransition = true;
                        $('#multipartyTransitionModal').modal('show');
                        $('#multipartyTransitionModal').modal({
                            backdrop: 'static',
                            keyboard: false
                        });
						if (data.multipartyTransition) {
							// do nothing
						} else if (data.multipartyHangup) {
							setTimeout(() => {
								startMonitoringCall(extensionBeingMonitored);
							}, 1000);
						}
                    } else {
						// remove monitor variables
						extensionBeingMonitored = null;
						isMonitoring = false;
						monitorTransition = false;
						socket.emit('stopMonitoringCall', {'originalExt':extensionBeingMonitored, 'vrs': $('#callerPhone').val()});
					}
				}).on('monitor-rejoin-session', function() {
					startMonitoringCall(extensionBeingMonitored);
                });

			} else {
				//we do nothing with bad connections
			}
		},
		error: function (xhr, status, error) {
			console.log('Error');
			$('#message').text('An Error Occured.');
		}
	});

}

$('#agenttable').DataTable({
	aaData: null,
	aoColumns: [{
			"mDataProp": "status"
		},
		{
			"mDataProp": "name"
		},
		{
			"mDataProp": "extension"
		},
		{
			"mDataProp": "queues"
		},
		{
            "mDataProp": "monitorCall"
        },
		{
            "mDataProp": "transferCall"
        },
		{
			"mDataProp": "multipartyInvite"
		},
		{
			"mDataProp": "chat"
		}
	],
	searching: false,
	paging: false,
	scrollY: 600,
	scrollX: '100%',
	order: []
});

function alignDataTableHeaders() {
	$($.fn.dataTable.tables(true)).DataTable().columns.adjust();
}

function monitorAvailability(status, name, ext) {
	return (($('#user-status').text() == 'Ready' || $('#user-status').text() == 'Away') && status == 'INCALL' && $("#agentname-sidebar").text() != name) 
	? "<Button class=\"demo-btn\" onClick=startMonitoringCall(" + ext + ")><i class=\"fa fa-eye\"></i></Button>"
	: "<Button class=\"secondary\" disabled><i class=\"fa fa-eye\"></i></Button>"
}

function transferAvailability(status, name, ext) {
	return (status == 'READY' && $('#user-status').text() == 'In Call' && $("#agentname-sidebar").text() != name) 
  	? '<Button class=\"demo-btn\" onClick="getTransferType(' + ext + ')"><i class=\"fa fa-share-square\"></i></Button>' 
	: "<Button class=\"secondary\" disabled><i class=\"fa fa-share-square\"></i></Button>"
}

$("#ivrsnum").keyup(function (event) {
	if (event.keyCode === 13) {
		$("#submitvrs").click();
	}
});

$('#submitvrs').on('click', function (event) {
	event.preventDefault(); // To prevent following the link (optional)
	var ivrsnum = $('#ivrsnum').val().replace(/^1|[^\d]/g, '');
	if (ivrsnum.length === 10) {
		$(".modal-backdrop").remove();
		socket.emit('input-vrs', {
			"vrs": ivrsnum,
			"extension": extensionMe
		});
		$('#ivrsnum').removeClass('has-error');
		$('#ivrsmessage').text('');
		$('#ivrsmessage').hide();
		$('#myVrsModal').modal('hide');
	} else {
		$('#ivrsnum').addClass('has-error');
		$('#ivrsmessage').text('Invalid phone number format');
		$('#ivrsmessage').show();
	}
});

function startMonitoringCall(ext) {
    isMonitoring = true;
	extensionBeingMonitored = ext;
    socket.emit('askMonitor', {'monitorExt': extensionMe, 'originalExt': ext})
}

function stopMonitoringCall(ext) {
	monitorTransition = false;
    terminate_call();
	acekurento.isMonitoring = false;
	extensionBeingMonitored = null;

    socket.emit('stopMonitoringCall', {'originalExt':ext, 'vrs': $('#callerPhone').val()});
}

$("#newchatmessage").on('change keydown paste input', function () {
	var value = $("#newchatmessage").val();
	var displayname = $('#displayname').val();
	var vrs = $('#callerPhone').val();

	if (value.length > 0) {
		socket.emit('chat-typing', {
			"displayname": displayname,
			"vrs": vrs,
			rttmsg: value
		});
	} else {
		socket.emit('chat-typing-clear', {
			"displayname": displayname,
			"vrs": vrs
		});
	}
});

$('#chatsend').submit(function (evt) {
	evt.preventDefault();

	var msg = $('#newchatmessage').val();
	var displayname = $('#displayname').val();
	var vrs = $('#callerPhone').val();
	var date = moment();
	var timestamp = date.format("D MMM h:mm a");

	//var language = 'en';
	var language = $('#language-select').val();
	console.log('Sending translated text with language', language);
	$('#newchatmessage').val('');
	socket.emit('chat-message', {
		"message": msg,
		"timestamp": timestamp,
		"displayname": displayname,
		"vrs": vrs,
		"fromLanguage": language
	});
});

$("#agentnewchatmessage").on('change keydown paste input', function () {
	var value = $("#agentnewchatmessage").val();
	var displayname = $('#agentname-sidebar').html();
	var ext = $('#agent-ext').html();

	if (value.length > 0) {
		socket.emit('agent-chat-typing', {
			"displayname": displayname,
			"ext": ext,
			rttmsg: value
		});
	} else {
		socket.emit('agent-chat-typing-clear', {
			"displayname": displayname,
			"ext": ext
		});
	}
});

$('#agent-chat-send').on('click',function (evt) {
	evt.preventDefault();
	if($('#agentnewchatmessage').val() =='') {
		//do nothing
	} else {
		var msg = $('#agentnewchatmessage').val();
		var displayname = $('#agentname-sidebar').html();
		var ext = $('#agent-ext').html();
		var date = moment();
		var timestamp = date.format("D MMM h:mm a");
		var destname = $('#chatHeader').html();
		var exactTime = Date.now();

		var msgblock = document.createElement('div');
		var msginfo = document.createElement('div');
		var msgsender = document.createElement('span');
		var msgtime = document.createElement('span');
		var msgtext = document.createElement('div');

		msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
		msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

		$(msgsender).addClass("direct-chat-name pull-right").html(displayname).appendTo(msginfo);
		$(msgtime).addClass("direct-chat-timestamp pull-left").html(timestamp).appendTo(msginfo);
		$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
		$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
		$(msgblock).addClass("direct-chat-msg right").appendTo($("#agent-chat-messages"));

		$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);

		socket.emit('upload-agent-message', {
			'senderext':extensionMe,
			'destext':ext,
			'displayname':displayname,
			'destname': destname,
			'timestamp': timestamp,
			'message': msg,
			'hasBeenOpened': false,
			'timeSent':exactTime
		});

		$('#agentnewchatmessage').val('');
	}
});

$('#ticketTabTitle').click(function () {
	$('#ticketTab').removeClass("bg-pink");
	clearInterval(ticketTabFade);
});

function addEmoji(emoji) {
	var value = $('#newchatmessage').val();
	var displayname = $('#displayname').val();
	var vrs = $('#callerPhone').val();

	value = value+emoji;
	$('#newchatmessage').val(value);

	socket.emit('chat-typing', {
		"displayname": displayname,
		"vrs": vrs,
		rttmsg: value
	});
	$('#newchatmessage').focus();
}

function requestAssistance() {
	socket.emit('request-assistance', null);
}

function getStatusIconClasses(color, blinking) {
	return (blinking) ? "status-margin-small text-" + color + "-blinking" : "fa fa-circle text-" + color;
}

function logout(msg) {
        console.log('logout(): ' + msg);
	busylight.light('OFF_DUTY');
	changeStatusLight('OFF_DUTY');
	//clear the token from session storage
	sessionStorage.clear();
	//disconnect socket.io connection
	if (socket)
		socket.disconnect();
	//display the login screen to the user.
	window.location.href = './logout';

}

function modifyTicket() {
	$('#notickettxt').hide();
	var id = $('#ticketId').val();
	var subject = $('#subject').val();
	var description = $('#problemdesc').val();
	var resolution = $('#resolution').val();
	var fname = $('#callerFirstName').val();
	var email = $('#callerEmail').val();
	var phone = $('#callerPhone').val();
	var lname = $('#callerLastName').val();

	if (id.trim() === "") {
		var ticket = {
			"destexten": extensionMe,
			"vrs": phone,
			"status": "new",
			"ticketId": id,
			"subject": subject,
			"description": description,
			"name": fname,
			"email": email,
			"phone": phone,
			"last_name": lname,
			"resolution": resolution,
			"comment": {
				"public": true,
				"body": description
			}
		};
		socket.emit('ad-ticket', ticket);
	} else {
		socket.emit('modify-ticket', {
			"destexten": extensionMe,
			"vrs": phone,
			"status": "new",
			"ticketId": id,
			"subject": subject,
			"description": description,
			"name": fname,
			"email": email,
			"phone": phone,
			"last_name": lname,
			"resolution": resolution,
			"comment": {
				"public": true,
				"body": description
			}
		});
	}

}

function inCallADComplaints(endpoint_type) {
	socket.emit('pause-queues', null);
	$('#myRingingModalPhoneNumber').html('');
	$('#myRingingModal').modal('hide');
	$('#user-status').text('In Call');
	$('#complaintsInCall').show();
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	changeStatusLight('IN_CALL');
	var vrs = $('#callerPhone').val();
	socket.emit('incall', {'vrs' : vrs});
	if (endpoint_type === "Provider_Complaints") {
		endpoint = "provider";
		disable_chat_buttons();
		$("#newchatmessage").attr("placeholder", "Chat disabled for Provider endpoints");
		$('#remoteView').css('object-fit', ' contain');

		//disable filesharing buttons
		document.getElementById("fileInput").disabled = true;
		document.getElementById("sendFileButton").className = "btn btn-primary";
		document.getElementById("sendFileButton").disabled = true;
		document.getElementById("sendFileButton").removeAttribute('style');
		clearAgentDownloadList();

	} else { //should be webrtc
		endpoint = "webrtc";
		enable_chat_buttons();
		$('#remoteView').css('object-fit', ' contain');

		//allow file sharing
		socket.emit('begin-file-share', {'vrs': vrs, 'agentExt': extensionMe});
	}


}

function inCallADGeneral(endpoint_type) {
	socket.emit('pause-queues', null);
	$('#myRingingModalPhoneNumber').html('');
	$('#myRingingModal').modal('hide');
	$('#user-status').text('In Call');
	$('#geninfoInCall').show();
	changeStatusLight('IN_CALL');
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	var vrs = $('#callerPhone').val();
	socket.emit('incall', {'vrs' : vrs});
	if ( endpoint_type === "Provider_General_Questions" || endpoint_type === "General_Questions" ) {
		endpoint = "provider";
		disable_chat_buttons();
		$("#newchatmessage").attr("placeholder", "Chat disabled for provider endpoints");
		$('#remoteView').css('object-fit', ' contain');

		//disable file sharing buttons
		document.getElementById("fileInput").disabled = true;
		document.getElementById("sendFileButton").className = "btn btn-primary";
		document.getElementById("sendFileButton").disabled = true;
		document.getElementById("sendFileButton").removeAttribute('style');
		clearAgentDownloadList();
	} else { //should be webrtc
		endpoint = "webrtc";
		enable_chat_buttons();
		$('#remoteView').css('object-fit', ' contain');

		//allow file sharing
		socket.emit('begin-file-share', {'vrs': vrs, 'agentExt': extensionMe});
	}
}

function pauseQueues() {
	$('#user-status').text('Away');
	changeStatusIcon(away_color, "away", away_blinking);
	changeStatusLight('AWAY');
	socket.emit('pause-queues', null);
	socket.emit('away', null);
}

function unpauseQueues() {
	$('#user-status').text('Ready');
	changeStatusIcon(ready_color, "ready", ready_blinking);
	changeStatusLight('READY');
	socket.emit('unpause-queues', null);
	socket.emit('ready', null);
	if(this.agentStatus == 'READY'){
		exitVideomail();
	}
}

//i == 1: go to Ready; i == 0: go to Away
function finished(i) {
	$('#destexten').val('');
	clearScreen();
	if (i === 1)
		unpauseQueues();
	else
		pauseQueues();
	$('#alertPlaceholder').html('');
}

function clearScreen() {
	$('#userform').find('input:text').val('');
	$('#callerEmail').val('');

	$('#callinfodiv').find('input:text').val('');

	$('#inbounddhohlabel').hide();
	$('#outbounddhohlabel').hide();

	$('#outboundnumber').text('');
	$('#inboundnumber').text('');

	$('#duration').timer('reset');
	$('#duration').timer('pause');

	$('#caption-messages').html('');
        $('#transcriptoverlay').html('');
	$('#chat-messages').html('<div id="rtt-typing"></div>');
	$('#newchatmessage').val('');

	$('#ticketForm').find('input:text').val('');
	$('#ticketForm').find('textarea').val('');

	$('#complaintsInCall').hide();
	$('#geninfoInCall').hide();

	$('#ivrsnum').val('');
	$('#ivrsmessage').hide();

	$('#notickettxt').hide();
	$('#ticketTab').removeClass("bg-pink");
	clearInterval(ticketTabFade);

	$('#modalWrapupTransfer').modal('hide');
	$('#modalWrapup').modal('hide');
	$('#modalOutboundCall').modal('hide');

	// clear file share elements
	clearAgentDownloadList();
	$('#fileInput').val('');
	$('#fileSent').hide();
	$('#fileSentError').hide();

	$('#transferExtension').val('');
	consumerType = '';
}

function changeStatusLight(state) {
	this.agentStatus = state;
	busylight.light(state);
}

// Debug Functions for sidebar.
function cleardbgtxt() {
	$('#dbgtxt').html('');
}

function debugtxt(title, data) {
	var dt = new Date();
	var time = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
	$('#dbgtxt').html('<span style="color:green">' + time + ": " + title + '</span><br>' + JSON.stringify(data) + '<br>----------------<br>' + $('#dbgtxt').html());
}

//update colors to custom config colors.
//NOTE: text has the class "text-colorname" and buttons have the class "btn-colorname"
function updateColors(data) {
	//remove colors from status icons
	$("#away-icon").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#ready-icon").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#status-icon").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});

	//remove colors from wrapup modal
	$("#away-btn").removeClass(function (index, className) {
		return (className.match(/\bbtn-\S+/g) || []).join(' ');
	});
	$("#away-color").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#ready-color").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#ready-btn").removeClass(function (index, className) {
		return (className.match(/\bbtn-\S+/g) || []).join(' ');
	});
	$("#wrapup-color").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});

	//remove colors from transfer wrapup modal 
	$("#away-btn-transfer").removeClass(function (index, className) {
		return (className.match(/\bbtn-\S+/g) || []).join(' ');
	});
	$("#away-color-transfer").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#ready-color-transfer").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#ready-btn-transfer").removeClass(function (index, className) {
		return (className.match(/\bbtn-\S+/g) || []).join(' ');
	});
	$("#wrapup-color-transfer").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});

	//get new colors from json config file, save to local variables
	for (var status in data) {
		if (data[status].color.toLowerCase() === "off") {
			data[status].color = "gray";
			data[status].blink = false;
		}

		if (data[status].id.toLowerCase() === "away") {
			away_color = data[status].color;
			away_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "ready") {
			ready_color = data[status].color;
			ready_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "in_call") {
			in_call_color = data[status].color;
			in_call_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "hold") {
			hold_color = data[status].color;
			hold_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "incoming_call") {
			incoming_call_color = data[status].color;
			incoming_call_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "transferred_call") {
			transferred_call_color = data[status].color;
			transferred_call_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "wrap_up") {
			wrap_up_color = data[status].color;
			wrap_up_blinking = data[status].blink;
		} else if (data[status].id.toLowerCase() === "need_assistance") {
			need_assistance_color = data[status].color;
			need_assistance_blinking = data[status].blink;
		} else {
			missed_call_color = data[status].color;
			missed_call_blinking = data[status].blink;
		}
	}

	//add new text-colors to away and ready icons
	if (away_blinking) {
		$('#away-icon').addClass("text-" + away_color + "-blinking");
		if (!($("#away-icon").hasClass("status-margin"))) $('#away-icon').addClass("status-margin");
		$("#away-icon").removeClass("fa");
		$("#away-icon").removeClass("fa-circle");
	} else {
		$('#away-icon').addClass("text-" + away_color);
		if (!($("#away-icon").hasClass("fa"))) $("#away-icon").addClass("fa");
		if (!($("#away-icon").hasClass("fa-circle"))) $("#away-icon").addClass("fa-circle");
		$("#away-icon").removeClass("status-margin");
	}
	if (ready_blinking) {
		if (!($("#ready-icon").hasClass("status-margin"))) $('#ready-icon').addClass("status-margin");
		$('#ready-icon').addClass("text-" + ready_color + "-blinking");
		$("#ready-icon").removeClass("fa");
		$("#ready-icon").removeClass("fa-circle");
	} else {
		$('#ready-icon').addClass("text-" + ready_color);
		if (!($("#ready-icon").hasClass("fa"))) $("#ready-icon").addClass("fa");
		if (!($("#ready-icon").hasClass("fa-circle"))) $("#ready-icon").addClass("fa-circle");
		$("#ready-icon").removeClass("status-margin");
	}
	//add colors to wrapup model
	if (wrap_up_color === "white") $('#wrapup-color').addClass("text-gray");
	else $('#wrapup-color').addClass("text-" + wrap_up_color);
	if (away_color === "white") $('#away-color').addClass("text-gray");
	else $('#away-color').addClass("text-" + away_color);
	if (ready_color === "white") $('#ready-color').addClass("text-gray");
	else $('#ready-color').addClass("text-" + ready_color);
	$('#away-btn').addClass("btn-" + away_color);
	$('#ready-btn').addClass("btn-" + ready_color);

	//add colors to transfer wrapup modal
	if (wrap_up_color === "white") $('#wrapup-color-transfer').addClass("text-gray");
	else $('#wrapup-color-transfer').addClass("text-" + wrap_up_color);
	if (away_color === "white") $('#away-color-transfer').addClass("text-gray");
	else $('#away-color-transfer').addClass("text-" + away_color);
	if (ready_color === "white") $('#ready-color-transfer').addClass("text-gray");
	else $('#ready-color-transfer').addClass("text-" + ready_color);
	$('#away-btn-transfer').addClass("btn-" + away_color);
	$('#ready-btn-transfer').addClass("btn-" + ready_color);

	//add new color to status-icon element
	if ($("#status-icon").hasClass("currently-away")) changeStatusIcon(away_color, "away", away_blinking);
	else if ($("#status-icon").hasClass("currently-ready")) changeStatusIcon(ready_color, "ready", ready_blinking);
	else if ($("#status-icon").hasClass("currently-in-call")) changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	else if ($("#status-icon").hasClass("currently-hold")) changeStatusIcon(hold_color, "hold", hold_blinking);
	else if ($("#status-icon").hasClass("currently-incoming-call")) changeStatusIcon(incoming_call_color, "incoming-call", incoming_call_blinking);
	else if ($("#status-icon").hasClass("currently-transferred-call")) changeStatusIcon(transferred_call_color, "transferred-call", transferred_blinking);
	else if ($("#status-icon").hasClass("currently-wrap-up")) changeStatusIcon(wrap_up_color, "wrap-up", wrap_up_blinking);
	else if ($("#status-icon").hasClass("currently-need-assistance")) changeStatusIcon(need_assistance_color, "need-assistance", need_assistance_blinking);
	else changeStatusIcon(missed_call_color, "missed-call", missed_call_blinking);

	socket.emit('update-agent-list');
}

function changeStatusIcon(newColor, statusName, blinking) {
	$("#status-icon").removeClass(function (index, className) {
		return (className.match(/\btext-\S+/g) || []).join(' ');
	});
	$("#status-icon").removeClass(function (index, className) {
		return (className.match(/\bcurrently-\S+/g) || []).join(' ');
	});
	if (blinking) {
		$('#status-icon').addClass("text-" + newColor + "-blinking");
		$("#status-icon").removeClass("fa");
		$("#status-icon").removeClass("fa-circle");
		if (!($("#status-icon").hasClass("status-margin-small"))) $("#status-icon").addClass("status-margin-small");

	} else {
		$('#status-icon').addClass("text-" + newColor);
		if (!($("#status-icon").hasClass("fa"))) $("#status-icon").addClass("fa");
		if (!($("#status-icon").hasClass("fa-circle"))) $("#status-icon").addClass("fa-circle");
		$("#status-icon").removeClass("status-margin-small");
	}
	$('#status-icon').addClass("currently-" + statusName);
}


function newChatMessage(data) {
	console.log('Data is ' + JSON.stringify(data));

	var msg = data.message;
	var displayname = data.displayname;
	var timestamp = data.timestamp;
	console.log('Also ' + data.displayname + ' ' + data.timestamp);

	msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
	msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

	var msgblock = document.createElement('div');
	var msginfo = document.createElement('div');
	var msgsender = document.createElement('span');
	var msgtime = document.createElement('span');
	var msgtext = document.createElement('div');
	if ($("#displayname").val() === displayname) {
		$(msgsender).addClass("direct-chat-name pull-right").html(displayname).appendTo(msginfo);
		$(msgtime).addClass("direct-chat-timestamp pull-left").html(timestamp).appendTo(msginfo);
		$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
		$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
		$(msgblock).addClass("direct-chat-msg right").appendTo($("#chat-messages"));
	} else {
		$('#chat-messages').remove($("#rtt-typing"));
		$("#rtt-typing").html('').removeClass("direct-chat-text");

		$(msgsender).addClass("direct-chat-name pull-left").html(displayname).appendTo(msginfo);
		$(msgtime).addClass("direct-chat-timestamp pull-right").html(timestamp).appendTo(msginfo);
		$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
		$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
		$(msgblock).addClass("direct-chat-msg").appendTo($("#chat-messages"));

	}
	$("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
}


//####################################################################
//Videomail functionality: mostly sending socket.io events to adserver

function getVideomailRecs() {
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
}

//Play selected videomail when a row of the table is clicked
$('#Videomail_Table tbody').on('click', 'tr', function () {
	var tableData = $(this).children("td").map(function () {
		return $(this).text();
	}).get();

	console.log('Click event for playing video');
	
	console.log('vidId: ' + tableData[4]);
	$("#videomailId").attr("name", tableData[4]);
	$("#callbacknum").attr("name", tableData[0]);
	if(agentStatus != 'IN_CALL'){
		console.log("Table is "+tableData[4]+" "+tableData[2]+" "+tableData[3]);
		playVideomail(tableData[4], tableData[2], tableData[3]); //vidId, vidDuration vidStatus);
	}
});

//Sorting the videomail table
$('#vmail-vrs-number').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "callbacknumber asc";
	} else if (sort === "desc") {
		sortFlag = "callbacknumber desc";
	}
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-date').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "received asc";
	} else if (sort === "desc") {
		sortFlag = "received desc";
	}
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-duration').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "video_duration asc";
	} else if (sort === "desc") {
		sortFlag = "video_duration desc";
	}
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-status').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "status asc";
	} else if (sort === "desc") {
		sortFlag = "status desc";
	}
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

function sortButtonToggle(buttonid) {
	if ($(buttonid).attr("class") === 'fa fa-sort') {
		$(buttonid).addClass('fa-sort-asc').removeClass('fa-sort');
		return ("asc");
	} else if ($(buttonid).attr("class") === 'fa fa-sort-desc') {
		$(buttonid).addClass('fa-sort-asc').removeClass('fa-sort-desc');
		return ("asc");
	} else if ($(buttonid).attr("class") === 'fa fa-sort-asc') {
		$(buttonid).addClass('fa-sort-desc').removeClass('fa-sort-asc');
		return ("desc");
	}
}

//Update the records in the videomail table
function updateVideomailTable(data) {
	$("#videomailTbody").html("");
	var table;
	var row;
	var numberCell;
	var receivedCell;
	var durationCell;
	var statusCell;
	var callbackCell;
	for (var i = 0; i < data.length; i++) {
		var vidId = data[i].id;
		var vidNumber = data[i].callbacknumber;
		if (vidNumber) {
			vidNumber = vidNumber.toString();
			if (vidNumber[0] === '1') vidNumber = vidNumber.slice(1, vidNumber.length);
			vidNumber = '(' + vidNumber.substring(0, 3) + ') ' + vidNumber.substring(3, 6) + '-' + vidNumber.substring(6, vidNumber.length);
		}

                //convert videomail received time to client browser timezone
		var vidReceived = data[i].received;
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                vidReceived = new Date(vidReceived).toLocaleString('en-US', { timeZone: tz });

		var vidDuration = data[i].video_duration;
		var vidStatus = data[i].status;
		var vidFilepath = data[i].video_filepath;
		var vidFilename = data[i].video_filename;
		table = document.getElementById("videomailTbody");
		row = table.insertRow(table.length);
		numberCell = row.insertCell(0);
		receivedCell = row.insertCell(1);
		durationCell = row.insertCell(2);
		statusCell = row.insertCell(3);
		idCell = row.insertCell(4);
		idCell.setAttribute('hidden', true);
		callbackCell = row.insertCell(5);
		//filepathCell = row.insertCell(5);
		//filepathCell.setAttribute('hidden', true);
		//filepathCell.innerHTML = vidFilepath + vidFilename;
		idCell.innerHTML = vidId;
		numberCell.innerHTML = vidNumber;
		receivedCell.innerHTML = vidReceived;
		durationCell.innerHTML = vidDuration;

		callbackCell.innerHTML = '<button class=\"demo-btn\" onclick="outbound_call(\'' + data[i].callbacknumber + '\')"><i class="fa fa-phone-square"></i></button>';
		

		if (vidStatus === 'UNREAD')
			statusCell.innerHTML = '<span style="font-weight:bold">' + vidStatus + '</span>';
		else
			statusCell.innerHTML = vidStatus;
	}
}

/**
 * Call Recording Logic 
 */

function updateCallRecordingTable(data){
	$("#callRecordingTbody").html("");
	//console.log("GOT RECORDING DATA " + JSON.stringify(data));
	var table;
	var row;

	var fileNameCell;
	var consumerNumberCell;
	var timeStampCell;
	var lengthCell;
	
	for (var i = 0; i < data.length; i++) {
		var recordFilename = data[i].fileName;
		var recordConsumer = data[i].participants;
		var recordTimestamp = data[i].timeStamp;
		var recordLength = data[i].duration;
		var recordStatus = data[i].status;
		table = document.getElementById("callRecordingTbody");
		row = table.insertRow(table.length);
		fileNameCell = row.insertCell(0);
		consumerNumberCell = row.insertCell(1);
		timeStampCell = row.insertCell(2);
		lengthCell = row.insertCell(3);
		statusCell = row.insertCell(4);

		fileNameCell.innerHTML = recordFilename;
		consumerNumberCell.innerHTML = recordConsumer;
		timeStampCell.innerHTML = recordTimestamp;
		lengthCell.innerHTML = recordLength;
		statusCell.innerHTML = recordStatus;
	}
}

//Play selected videomail when a row of the table is clicked
$('#callRecordingTbody').on('click', 'tr', function () {
	var tableData = $(this).children("td").map(function () {
		return $(this).text();
	}).get();
	
	$("#recordId").attr("name", tableData[0]);

	if(agentStatus != 'IN_CALL'){
		playCallRecording(tableData[0]);
	}
});

function playCallRecording(filename){
	//Start by removing the persist camera and sending agent to away
	disable_persist_view();
	document.getElementById("persistCameraCheck").disabled = true;

	remoteView.removeAttribute("poster");
	console.log("Assigning file");
	remoteView.setAttribute("src", './getRecording?fileName=' + filename);
	//New attribute for control
	remoteView.setAttribute("controls","controls");
	/*remoteView.setAttribute("onended", "change_play_button()");
	if (document.getElementById("play-video-icon").classList.contains("fa-pause")) {
		document.getElementById("play-video-icon").classList.add("fa-play");
		document.getElementById("play-video-icon").classList.remove("fa-pause");
	}*/
	toggle_incall_buttons(false);
	toggle_recording_buttons(true);
	//toggle_videomail_buttons(true);
	recording_status_change(filename,'IN PROGRESS');
	seekBar.value = 0;
	remoteView.currentTime = 0;
	
	//Add the event listener for when the videomail finishes playing
	document.getElementById('remoteView').addEventListener('ended', (event) => {
		console.log("Finished playing recording");
		recording_status_change(filename,'READ');
	});
}

//Socket emit for changing status of a videomail
function recording_status_change(fileName, recordStatus) {
	console.log("Changing status with " + fileName + " " + recordStatus);
	socket.emit('recording-status-change', {
		"fileName": fileName,
		"status": recordStatus
	});
}

//Exit videomail view and return to call view
function exitRecording() {
	console.log("exiting recording");
	stopRecording();
	document.getElementById("persistCameraCheck").disabled = false;
	if (document.getElementById("persistCameraCheck").checked == true) {
		enable_persist_view();
	}
	//close right sidebar if it's open
	if ($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#shortcuts-tab').hasClass('active')) {
		$('#mail-btn').trigger('click');
	}
}

function stopRecording() {
	console.log("Videomail view has been stopped, back to call view");
	remoteView.setAttribute("src", "");
	remoteView.removeAttribute("src");
	remoteView.removeAttribute("onended");
	remoteView.removeAttribute("controls");
	remoteView.setAttribute("autoplay", "autoplay");
	remoteView.setAttribute("poster", "images/acedirect-logo.png");
	toggle_recording_buttons(false);
	//playingVideomail = false;
}

//Display the videomail control buttons
function toggle_recording_buttons(make_visible) {
	console.log("Toggling record buttons");
	if (make_visible) record_status_buttons.style.display = "block";
	else record_status_buttons.style.display = "none";
}

//Socket emit for deleting a videomail
function recording_deleted(id) {
	socket.emit('recording-deleted', {
		"fileName": id,
		"extension": extensionMe
	});
}

//Recording Sorting
//Sorting the videomail table
$('#recording-filename').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		recordSortFlag = "fileName asc";
	} else if (sort === "desc") {
		recordSortFlag = "fileName desc";
	}
	recordFilter = "";
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
});

$('#recording-date').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		recordSortFlag = "timestamp asc";
	} else if (sort === "desc") {
		recordSortFlag = "timestamp desc";
	}
	recordFilter = "";
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
});

$('#recording-length').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		recordSortFlag = "length asc";
	} else if (sort === "desc") {
		recordSortFlag = "length desc";
	}
	recordFilter = "";
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
});

$('#recording-status').on('click', function () {
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		recordSortFlag = "status asc";
	} else if (sort === "desc") {
		recordSortFlag = "status desc";
	}
	recordFilter = "";
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
});

function ShowRecordFilterModal(){
	$('#callRecordingNumberFilter').modal({
		backdrop: 'static',
		keyboard: false
	});
}

function filterRecordNumber(){
	var filterNumber = $('#RecordNumberInput').val();
	$('#callRecordingNumberFilter').modal('hide');
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		recordSortFlag = "status asc";
	} else if (sort === "desc") {
		recordSortFlag = "status desc";
	}
	recordFilter = "participants LIKE '%" + filterNumber + "%'";
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
}

function getRecordingVideos(){
	socket.emit('get-recordings', {
		"extension": extensionMe,
		"sortBy": recordSortFlag,
		"filter": recordFilter
	});
}

/**
 * End recording section
 */

//Notification for unread videomail
function updateVideomailNotification(data) {
	if(data != storedData){
		if(data > storedData){
			showAlert('info', 'You have a new unread videomail');
		}
		storedData = data;
	}
	$("#unread-mail-count").html(data);
	if (data === 0){
		$("#unread-mail-count").html("");
	}
}

//Filter videomail by status
function filterVideomail(mailFilter) {
	filter = mailFilter;
	socket.emit('get-videomail', {
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
}

function processFilter(filter) {
	if (filter === 'ALL') {
		return ('');
	} else {
		return ('AND status = ' + filter);
	}
}

//Show videomail sidebar tab
function showVideoMailTab() {
	if ($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#recordings-tab').hasClass('active')) {
		// if the sidebar is closing, remove the shortcuts of the tabs
		$('#videomail-tab').attr("accesskey", '');
		$('#agents-tab').attr("accesskey", '');
		$('#recordings-tab').attr("accesskey", '');
		$('#shortcuts-tab').attr("accesskey", '');
		$('#clear-shortcuts').attr("accesskey", '');
		$('#reset-shortcuts').attr("accesskey", '');
		updateShortcutTable();

		$('#agents-tab').removeClass('active');
		$('#videomail-tab').removeClass('active');
		$('#recordings-tab').removeClass('active');

	} else {
		// sidebar is opening, re-add the tab shortcuts
		$('#videomail-tab').attr("accesskey", 'm');
		$('#agents-tab').attr("accesskey", 'a');
		$('#shortcuts-tab').attr("accesskey", 'k');
		updateShortcutTable();

		if ($('#agents-tab').hasClass('active')) {
			if (document.getElementById("ctrl-sidebar").hasAttribute('control-sidebar-open')) {
				$('.nav-tabs a[href="#control-sidebar-agents-tab"]').removeClass('active');

				$('#agents-tab').removeClass('active');

			}
		}
		$('.nav-tabs a[href="#control-sidebar-videomail-tab"]').tab('show');
		$('.nav-tabs a[href="#control-sidebar-videomail-tab"]').addClass('active');
		$('#videomail-tab').addClass('active');

		$('#shortcuts-tab').on('click', function() {
			//give clear and reset buttons their shortcuts
			$('#clear-shortcuts').attr("accesskey", '`');
			$('#reset-shortcuts').attr("accesskey", '-');
			updateShortcutTable();
		});
		$('#videomail-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
		$('#agents-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
	}

}

//Show agent info sidebar tab
function showAgentsTab() {
	if ( $('#agents-tab').hasClass('active') || $('#videomail-tab').hasClass('active') || $('#recordings-tab').hasClass('active')) {
		// if the sidebar is closing, remove the tab shortcuts
		$('#videomail-tab').attr("accesskey", '');
		$('#agents-tab').attr("accesskey", '');
		$('#recordings-tab').attr("accesskey", '');
		$('#shortcuts-tab').attr("accesskey", '');
		$('#clear-shortcuts').attr("accesskey", '');
		$('#reset-shortcuts').attr("accesskey", '');
		updateShortcutTable();

		$('#agents-tab').removeClass('active');
		$('#videomail-tab').removeClass('active');
		$('#recordings-tab').removeClass('active');

	} else {
		// sidebar is opening, re-add the tab shortcuts
		$('#videomail-tab').attr("accesskey", 'm');
		$('#agents-tab').attr("accesskey", 'a');
		$('#shortcuts-tab').attr("accesskey", 'k');
		updateShortcutTable();

		if ($('#videomail-tab').hasClass('active')) {
			if (document.getElementById("ctrl-sidebar").hasAttribute('control-sidebar-open')) {
				$('.nav-tabs a[href="#control-sidebar-agents-tab"]').removeClass('active');
				$('#videomail-tab').removeClass('active');

			}
		}
		$('.nav-tabs a[href="#control-sidebar-videomail-tab"]').removeClass('active')
		$('.nav-tabs a[href="#control-sidebar-agents-tab"]').tab('show');
		$('.nav-tabs a[href="#control-sidebar-agents-tab"]').addClass('active');
		$('#agents-tab').addClass('active');

		$('#shortcuts-tab').on('click', function() {
			//give clear and reset buttons their shortcuts
			$('#clear-shortcuts').attr("accesskey", '`');
			$('#reset-shortcuts').attr("accesskey", '-');
			updateShortcutTable();
		});
		$('#videomail-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
		$('#agents-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
	}

}

//Loads the call recordings
function showCallRecordingTab(){
	// was agents tab
	if ( $('#agents-tab').hasClass('active') || $('#videomail-tab').hasClass('active') || $('#recordings-tab').hasClass('active')) {
		// if the sidebar is closing, remove the tab shortcuts
		$('#videomail-tab').attr("accesskey", '');
		$('#agents-tab').attr("accesskey", '');
		$('#recordings-tab').attr("accesskey", '');
		$('#shortcuts-tab').attr("accesskey", '');
		$('#clear-shortcuts').attr("accesskey", '');
		$('#reset-shortcuts').attr("accesskey", '');
		updateShortcutTable();

		$('#agents-tab').removeClass('active');
		$('#videomail-tab').removeClass('active');
		$('#recordings-tab').removeClass('active');

	} else {
		// sidebar is opening, re-add the tab shortcuts
		$('#videomail-tab').attr("accesskey", 'm');
		$('#agents-tab').attr("accesskey", 'a');
		//$('#recordings-tab').attr("accesskey", '');
		$('#shortcuts-tab').attr("accesskey", 'k');
		updateShortcutTable();

		if ($('#videomail-tab').hasClass('active')) {
			if (document.getElementById("ctrl-sidebar").hasAttribute('control-sidebar-open')) {
				$('.nav-tabs a[href="#control-sidebar-agents-tab"]').removeClass('active');
				$('#videomail-tab').removeClass('active');

			}
		}
		$('.nav-tabs a[href="#control-sidebar-videomail-tab"]').removeClass('active')
		$('.nav-tabs a[href="#control-sidebar-recordings-tab"]').tab('show');
		$('.nav-tabs a[href="#control-sidebar-recordings-tab"]').addClass('active');
		$('#agents-tab').addClass('active');

		$('#shortcuts-tab').on('click', function() {
			//give clear and reset buttons their shortcuts
			$('#clear-shortcuts').attr("accesskey", '`');
			$('#reset-shortcuts').attr("accesskey", '-');
			updateShortcutTable();
		});
		$('#videomail-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
		$('#agents-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
		$('#recordings-tab').on('click', function() {
			//remove shortcuts
			$('#clear-shortcuts').attr("accesskey", '');
			$('#reset-shortcuts').attr("accesskey", '');
		});
	}
	/*s3.listObjects(bucketParams, function(err, data){
		if(err){
			console.log("Error", err);
		} else {
			console.log("Success", "Loading recordings " + data); 
		}
	})*/
}

//Play the selected videomail
function playVideomail(id, duration, vidStatus) {
	//Start by removing the persist camera and sending agent to away
	disable_persist_view();
	document.getElementById("persistCameraCheck").disabled = true;
	playingVideomail = true;

	//console.log('Playing video mail with id ' + id);
	//remoteView.removeAttribute("autoplay");
	remoteView.removeAttribute("poster");
	remoteView.setAttribute("src", './getVideomail?id=' + id + '&ext=' + extensionMe);
	//New attribute for control
	remoteView.setAttribute("controls","controls");
	/*remoteView.setAttribute("onended", "change_play_button()");
	if (document.getElementById("play-video-icon").classList.contains("fa-pause")) {
		document.getElementById("play-video-icon").classList.add("fa-play");
		document.getElementById("play-video-icon").classList.remove("fa-pause");
	}*/
	toggle_incall_buttons(false);
	toggle_videomail_buttons(true);
	updateVideoTime(duration, "vmail-total-time");
	videomail_status_change(document.getElementById('videomailId').getAttribute('name'),'IN PROGRESS');
	seekBar.value = 0;
	remoteView.currentTime = 0;
	
	//Add the event listener for when the videomail finishes playing
	document.getElementById('remoteView').addEventListener('ended', (event) => {
		console.log("Finished playing videomail");
		videomail_status_change(document.getElementById('videomailId').getAttribute('name'),'READ');
	});
}

//Update the time progress in the videomail seekbar
function updateVideoTime(time, elementId) {
	var minutes = Math.floor(time / 60);
	var seconds = Math.round(time - minutes * 60);
	var timeStr = "";
	if (seconds < 10) {
		timeStr = minutes.toString() + ":0" + seconds.toString();
	} else if (seconds === 60) {
		timeStr = (minutes + 1).toString() + ":00";
	} else {
		timeStr = minutes.toString() + ":" + seconds.toString();
	}
	document.getElementById(elementId).innerHTML = timeStr;
}

//Display the videomail control buttons
function toggle_videomail_buttons(make_visible) {
	if (make_visible) videomail_status_buttons.style.display = "block";
	else videomail_status_buttons.style.display = "none";
}

//Exit videomail view and return to call view
function exitVideomail() {
	stopVideomail();
	document.getElementById("persistCameraCheck").disabled = false;
	if (document.getElementById("persistCameraCheck").checked == true) {
		enable_persist_view();
	}
	//close right sidebar if it's open
	if ($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#shortcuts-tab').hasClass('active')) {
		$('#mail-btn').trigger('click');
	}
}

function stopVideomail() {
	console.log("Videomail view has been stopped, back to call view");
	remoteView.setAttribute("src", "");
	remoteView.removeAttribute("src");
	remoteView.removeAttribute("onended");
	remoteView.removeAttribute("controls");
	remoteView.setAttribute("autoplay", "autoplay");
	remoteView.setAttribute("poster", "images/acedirect-logo.png");
	toggle_videomail_buttons(false);
	playingVideomail = false;
}

//Callback for videomail
function videomailCallback(callbacknum) {
	stopVideomail();
	var videophoneNumber = callbacknum.match(/\d/g);
	videophoneNumber = videophoneNumber.join('');
	direction = 'outgoing';
	start_call(videophoneNumber);
	$('#duration').timer('reset');
	$('#outboundCallAlert').show();
	$('#user-status').text('In Call');
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	changeStatusLight('IN_CALL');
	var vrs = $('#callerPhone').val();
	socket.emit('incall', {'vrs' : vrs});
}

//Socket emit for changing status of a videomail
function videomail_status_change(id, videoStatus) {
	socket.emit('videomail-status-change', {
		"id": id,
		"extension": extensionMe,
		"status": videoStatus
	});
}

//Socket emit for deleting a videomail
function videomail_deleted(id) {
	socket.emit('videomail-deleted', {
		"id": id,
		"extension": extensionMe
	});
}

//Videomail play button functionality
function play_video() {
	if (remoteView.paused == true) { // play the video
		remoteView.play();
		document.getElementById("play-video-icon").classList.remove("fa-play");
		document.getElementById("play-video-icon").classList.add("fa-pause");
	} else { // pause the video
		remoteView.pause();
		document.getElementById("play-video-icon").classList.add("fa-play");
		document.getElementById("play-video-icon").classList.remove("fa-pause");
	}
}

function change_play_button() {
	document.getElementById("play-video-icon").classList.add("fa-play");
	document.getElementById("play-video-icon").classList.remove("fa-pause");
}

//Seekbar functionality
var seekBar = document.getElementById("seek-bar");

// Event listener for the seek bar
seekBar.addEventListener("change", function() {
	// Calculate the new time
	var time = remoteView.duration * (seekBar.value / 100);

	// Update the video time
	remoteView.currentTime = time;
});

// Update the seek bar as the video plays
remoteView.addEventListener("timeupdate", function () {
	// Calculate the slider value
	var value = (100 / remoteView.duration) * remoteView.currentTime;

	// Update the slider value
	seekBar.value = value;

	//update the current time info
	updateVideoTime(remoteView.currentTime, "vmail-current-time");
});

// Pause the video when the seek handle is being dragged
seekBar.addEventListener("mousedown", function() {
	//remoteView.pause();
	play_video()
});

// Play the video when the seek handle is dropped
seekBar.addEventListener("mouseup", function() {
	//remoteView.play();
	play_video();
});

// Event listener for the full-screen button
function enterFullscreen() {
	var webcam_container = document.getElementById("fullscreen-element");

	if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {

		if (webcam_container.requestFullscreen) {
			webcam_container.requestFullscreen();
		} else if (webcam_container.msRequestFullscreen) {
			webcam_container.msRequestFullscreen();
		} else if (webcam_container.mozRequestFullScreen) {
			webcam_container.mozRequestFullScreen();
		} else if (webcam_container.webkitRequestFullscreen) {
			webcam_container.webkitRequestFullscreen();
		}
	} else {

		if (document.exitFullscreen) {
		  	document.exitFullscreen();
		} else if (document.msExitFullscreen) {
		  	document.msExitFullscreen();
		} else if (document.mozCancelFullScreen) {
		  	document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) {
		  	document.webkitExitFullscreen();
		}
	}
}

function toggleDisplay(){
	var video_display = $('#remoteView');

	if(video_display.css('object-fit') == 'contain') {
		video_display.css('object-fit: cover');
	} else {
		video_display.css('object-fit: contain');
	}
}

var fade_timer = null;
function clearFadeTimer(){
	if(fade_timer) {
		clearTimeout(fade_timer);
		fade_timer = 0;
	}
}

function fade(type='out'){
	$('#call-option-buttons button').each(function(i){
		$(this).css('animation', `fade-${type} 0.${i+2}s ease-out forwards`);
	});

	// Videomail status controls. It looks better when button, span, and input are animated separately.
	// Otherwise they animate out of order.
	$('#videomail-status-buttons button').each(function(i){
		$(this).css('animation', `fade-${type} 0.${i+2}s ease-out forwards`);
	});

	$('#videomail-status-buttons span').each(function(i){
		$(this).css('animation', `fade-${type} 0.${i+2}s ease-out forwards`);
	});

	$('#videomail-status-buttons input').each(function(i){
		$(this).css('animation', `fade-${type} 0.${i+2}s ease-out forwards`);
	});

	if(type == 'out') {
		$('#transcriptoverlay').css('bottom', '10px');
	} else {
		$('#transcriptoverlay').css('bottom', '65px');
	}
}

$('#fullscreen-element').mousemove(function(){
	clearFadeTimer();
	fade('in');
	fade_timer = setTimeout(fade, 3000);
});

$('#fullscreen-element').mouseleave(function(){
	clearFadeTimer();
	fade_timer = setTimeout(fade, 500);
});

function showDialpad() {
	$('#modalDialpad').modal({
		backdrop: 'static',
		keyboard: false
	});

	$("#dialpad-tab").trigger("click");

	$('#modalDialpad').on('shown.bs.modal', function() {
		$('#phone-number').focus();
	});
}

function showCallHistory() {
	$('#modalDialpad').modal({
		backdrop: 'static',
		keyboard: false
	});

	$("#callhistory-tab").trigger("click");
}

function showOutboundRinging() {
	$('#modalOutboundCall').modal({
		backdrop: 'static',
		keyboard: false
	});
}

function transferCallModal() {
	$('#modalCallTransfer').modal({
		backdrop: 'static',
		keyboard: false
	});
}

function showChatMessage(ext, destname) {
	agentChatOpen = true;
	getMyChats();

	//socket call to announce chat between the two callers
	socket.emit('check-agent-chat-status', {"destext":ext, "senderext": extensionMe});

	$('#agentchat').modal({
		backdrop: false,
		show: true
	});
	$('#agent-chat-content').resizable({
		maxHeight: 450,
		minHeight: 150,
		maxWidth: 850,
		minWidth: 250
	});
	$('#agent-chat-dialog').draggable({
		containment: 'window',
		handle: '.modal-header'
	});

	$('#agent-ext').html(ext);
	$('#chatHeader').html(destname);
	$('#agent-chat-messages').html('<div id="agent-rtt-typing"></div>');
	$('#agentnewchatmessage').val('');
	$('#agent-rtt-typing').html('');

	//if collection does not exist, create one
	//if it does, load the old messages

	//check if the messages are saved in the db
	if(!isAgentChatSaved) {
		if (tempSavedMessages[0][0] == undefined) {
			//console.log('No messages to load');
		} else {
			for (var i = 0; i < tempSavedMessages.length; i++) {
				if (tempSavedMessages[i][0].senderext == ext) {
					removeChatList(tempSavedMessages[i][0].displayname);
					var numOfMessages = tempSavedMessages[i].length;

					for(var j = 0; j < numOfMessages; j++){
						var msg = tempSavedMessages[i][j].message;
						var displayname = tempSavedMessages[i][j].displayname;
						var timestamp = tempSavedMessages[i][j].timestamp;

						msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
						msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

						var msgblock = document.createElement('div');
						var msginfo = document.createElement('div');
						var msgsender = document.createElement('span');
						var msgtime = document.createElement('span');
						var msgtext = document.createElement('div');

						$(msgsender).addClass("direct-chat-name pull-left").html(displayname).appendTo(msginfo);
						$(msgtime).addClass("direct-chat-timestamp pull-right").html(timestamp).appendTo(msginfo);
						$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
						$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
						$(msgblock).addClass("direct-chat-msg").appendTo($("#agent-chat-messages"));

						if (j == tempSavedMessages[i].length-1) {
							$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);
							$('#agentnewchatmessage').focus();

							tempSavedMessages.splice(i, 1);
							$('#unread-chat-count').html(tempSavedMessages.length);

							if (tempSavedMessages == undefined || tempSavedMessages == '') {
								tempSavedMessages = [[]];
								$('#unread-chat-count').html('');
								$('#agent-chat-list').append(
									'<li><a>\
										<p>Your messages will not be saved</p>\
									</a>\
									</li>'
								);
							}
						}
					}
				}
			}
		}
	}

	var count=0;

	socket.on('begin-agent-chat', function() {
		if (count == 0) {
			console.log('beginning new chat with ' +destname);
			count++;
		}
	});

	socket.on('continue-agent-chat', function(data) {
		if (count == 0) {
			console.log('continuing chatting with ' +destname);
			if (data.destExt == ext) {
				//good to go
				loadAgentChats(ext,extensionMe);
			}
			count++;
		}
	});
}

$('#agent-chat-content').on('resize', function() {
	//resizes the draggable element so it can't be moved off the screen
	$('#agent-chat-dialog').width( $('#agent-chat-content').width() );
	$('#agent-chat-dialog').height( $('#agent-chat-content').height() );

	var contentHeight = $("#agent-chat-content").height();

	var agentchatheaderHeight = $("#agent-chat-header").outerHeight();
	var agentrtttypinHeight = $("#agent-rtt-typing").outerHeight();
	var agentchatfooterheight = $("#agent-chat-footer").outerHeight();
	var agentParts = agentchatheaderHeight + agentrtttypinHeight + agentchatfooterheight;
	var padding = 30;

	$('#agent-modal-body').css("height", contentHeight - agentParts + "px");
	$('#agent-chat-body').css("height", contentHeight - agentParts - padding + "px");
	$('#agent-chat-messages').css("height", contentHeight - agentParts - (padding+10) + "px");
});

function loadAgentChats(destExt, selfExt) {
	var count=0;
	socket.emit('get-agent-chat', {'destext': destExt, 'senderext':selfExt});
	socket.on('load-agent-chat-messages', function(data){

		if (count == 0) {
			if (data.length == 0) {
				//chat exists, but there are no messages
				console.log('no data');
			} else {
				if (data[0].destext == extensionMe) {
					//mark the message as read
					socket.emit('chat-read', {"ext":destExt, "destext": extensionMe});
					getMyChats();
				}

				//data is loaded in reverse order
				for(var i = data.length-1; i >=0; i--){
					var msg = data[i].message;
					var displayname = data[i].displayname;
					var timestamp = data[i].timestamp;

					msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
					msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

					var msgblock = document.createElement('div');
					var msginfo = document.createElement('div');
					var msgsender = document.createElement('span');
					var msgtime = document.createElement('span');
					var msgtext = document.createElement('div');

					if (data[i].senderext === selfExt) {
						$(msgsender).addClass("direct-chat-name pull-right").html(displayname).appendTo(msginfo);
						$(msgtime).addClass("direct-chat-timestamp pull-left").html(timestamp).appendTo(msginfo);
						$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
						$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
						$(msgblock).addClass("direct-chat-msg right").appendTo($("#agent-chat-messages"));
					} else {
						$(msgsender).addClass("direct-chat-name pull-left").html(displayname).appendTo(msginfo);
						$(msgtime).addClass("direct-chat-timestamp pull-right").html(timestamp).appendTo(msginfo);
						$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
						$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
						$(msgblock).addClass("direct-chat-msg").appendTo($("#agent-chat-messages"));
					}

					if (i == 0) {
						$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);
						$('#agentnewchatmessage').focus();
					}
				}
				count++;
			}
		}
	});
}

function closeAgentChat() {
	$('#agent-chat-messages').html('<div id="agent-rtt-typing"></div>');
	$('#chatHeader').html('');
	$('#agent-ext').html('');
	agentChatOpen = false;
}

function clearChat() {
	socket.emit('clear-chat-messages');
	$('#agent-chat-messages').html('<div id="agent-rtt-typing"></div>');
	$('#agent-ext').html('');
}

//able to type to consumer during call when agent chat is open
$('#newchatmessage').on('click', function() {
	$('#newchatmessage').focus();
});

function addEmojiAgentChat(emoji) {
	var value = $('#agentnewchatmessage').val();
	var displayname = $('#agentname-sidebar').html();
	var ext = $('#agent-ext').html();

	value = value+emoji;
	$('#agentnewchatmessage').val(value);

	socket.emit('agent-chat-typing', {
		"displayname": displayname,
		"ext": ext,
		rttmsg: value
	});
	$('#agentnewchatmessage').focus();
}

function sendBroadcast() {
	if ($('#agentnewchatmessage').val() == '') {
		//do nothing
	} else {
		var msg = 'BROADCAST: ' +$('#agentnewchatmessage').val();
		var displayname = $('#agentname-sidebar').html();
		var date = moment();
		var timestamp = date.format("D MMM h:mm a");
		var exactTime = Date.now();

		var msgblock = document.createElement('div');
		var msginfo = document.createElement('div');
		var msgsender = document.createElement('span');
		var msgtime = document.createElement('span');
		var msgtext = document.createElement('div');

		msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
		msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

		$(msgsender).addClass("direct-chat-name pull-right").html(displayname).appendTo(msginfo);
		$(msgtime).addClass("direct-chat-timestamp pull-left").html(timestamp).appendTo(msginfo);
		$(msginfo).addClass("direct-chat-info clearfix").appendTo(msgblock);
		$(msgtext).addClass("direct-chat-text").html(msg).appendTo(msgblock);
		$(msgblock).addClass("direct-chat-msg right").appendTo($("#agent-chat-messages"));

		$("#agent-chat-messages").scrollTop($("#agent-chat-messages")[0].scrollHeight);

		socket.emit('broadcast-agent-chat', {
			'senderext':extensionMe,
			'displayname':displayname,
			'destname': '',
			'destext': '',
			'timestamp': timestamp,
			'message': msg,
			'hasBeenOpened': false,
			'timeSent':exactTime,
			'isBroadcast':true
		});

		$('#agentnewchatmessage').val('');
	}
}

function getMyChats() {
	if (isAgentChatSaved) {
		var populateCount = 0;
		var lastMessages = [];
		var isDuplicate = false;
		var count = 0;
		var buffer = 0;
		socket.emit('get-my-chats', {'ext': extensionMe});

		socket.on('my-chats', function(data) {
			if (data.doc == null) {
				//catches chats that have no messages
				buffer++;
			} else {
				var limit = data.total;

				if (count < limit) {
					isDuplicate = false;
					for (var i =0; i < lastMessages.length; i++) {
						if (data.doc._id ==lastMessages[i]._id) {
							//duplicate
							isDuplicate = true;
						}
					}

					if (!isDuplicate) {
						lastMessages.push(data.doc);
					}
					count++;
				}

				var totalLength = lastMessages.length+buffer;
				if (totalLength == limit) {
					if (populateCount == 0) {
						//prevent this from being called too many times
						populateChats(lastMessages);
						populateCount++;
					}
				}
			}
		});
	}
}

function populateChats(lastMessages) {
	$('#agent-chat-list').html('');

	//sort the messages so the most recent message is on top
	lastMessages = lastMessages.sort((a, b) => {return b.timeSent - a.timeSent;});

	hasUnreadAgentChats = false;
	unreadAgentChats = 0;

	for (var i=0; i < lastMessages.length; i++) {
		if (lastMessages[i] == null) {
			//empty message
			//this shouldnt be needed
		} else {
			var name= lastMessages[i].displayname;
			var time = lastMessages[i].timestamp;
			var message = lastMessages[i].message;
			var ext = lastMessages[i].senderext;
			var opened= lastMessages[i].hasBeenOpened;

			if (lastMessages[i].displayname == $('#agentname-sidebar').html() && lastMessages[i].displayname != lastMessages[i].destname) {
				name = lastMessages[i].destname;
				ext = lastMessages[i].destext;
				opened = true;
			}
			if (lastMessages[i].displayname == $('#agentname-sidebar').html() && lastMessages[i].isBroadcast) {
				opened = true;
			}
			addChat(name, time, message, ext, opened);
			if (!opened) {
				hasUnreadAgentChats = true;
				unreadAgentChats++;
			}
		}
	}

	if (hasUnreadAgentChats) {
		$("#unread-chat-count").html(unreadAgentChats);
	} else {
		$("#unread-chat-count").html('');
	}
}

function addChat(displayname, time, message, ext, opened) {
	if (!isAgentChatSaved) {
		$('#agent-chat-list').append(
			'<li><a href=\"#\" onclick="showChatMessage(\'' + ext + '\',\'' + displayname + '\')">\
				<div class=\"pull-left\">\
					<!-- User Image -->\
					<img src=\"images/anon.png\" class=\"img-circle\" alt="User Image">\
				</div>\
				<!-- Message title and timestamp -->\
				<h4><b>'+displayname+'</b><small><i class=\"fa fa-clock-o\"></i> '+time+'</small></h4>\
				<!-- The message -->\
					<p style="overflow: hidden; white-space: nowrap;text-overflow: ellipsis;"><b>'+message+'</b></p>\
			</a>\
			</li>'
		);
	} else if ( $( "#agent-chat-list" ).is( ":visible" ) ) {
		// agent chat list is opening
		if (opened) {
			$('#agent-chat-list').append(
				'<li><a href=\"#\" onclick="showChatMessage(\'' + ext + '\',\'' + displayname + '\')">\
					<div class=\"pull-left\">\
						<!-- User Image -->\
						<img src=\"images/anon.png\" class=\"img-circle\" alt="User Image">\
					</div>\
					<!-- Message title and timestamp -->\
					<h4>'+displayname+'<small><i class=\"fa fa-clock-o\"></i> '+time+'</small></h4>\
					<!-- The message -->\
						<p style="overflow: hidden; white-space: nowrap;text-overflow: ellipsis;">'+message+'</p>\
				</a>\
				</li>'
			);
		} else {
			$('#agent-chat-list').append(
				'<li><a href=\"#\" onclick="showChatMessage(\'' + ext + '\',\'' + displayname + '\')">\
					<div class=\"pull-left\">\
						<!-- User Image -->\
						<img src=\"images/anon.png\" class=\"img-circle\" alt="User Image">\
					</div>\
					<!-- Message title and timestamp -->\
					<h4><b>'+displayname+'</b><small><i class=\"fa fa-clock-o\"></i> '+time+'</small></h4>\
					<!-- The message -->\
						<p style="overflow: hidden; white-space: nowrap;text-overflow: ellipsis;"><b>'+message+'</b></p>\
				</a>\
				</li>'
			);
		}
	}
}

//used when mongoDB is disabled in agent chat
function removeChatList(name) {
	$("ul#agent-chat-list li:contains("+name+")").remove();
}

//Logic for multi part calls
function multipartyModal(){
	socket.emit('ami-req', 'agent');
	$('#modalMultiPartyExt').modal({
		backdrop: 'static',
		keyboard: false
	})
}

function transferResponse(isAccepted) {
	$('#modalTransferCall').hide();

	if (!isAccepted) {
		socket.emit('denyingTransfer', {'originalExt':originalExt})
		unpauseQueues();
	 
		isTransfer = false;
		originalExt = null;
		transferExt = null;
		transferVRS = null;
		transferAccepted = false;
	} else {
		socket.emit('transferInviteAccepted', {
			'originalExt': originalExt,
			'transferVRS': transferVRS
		});
	}
}

//Check if status needs to be changed
$('#accept-btn').click(function () {
	if($('#videomail-tab').hasClass('active') || $('#agents-tab').hasClass('active') || $('#shortcuts-tab').hasClass('active')) {
		$('#mail-btn').trigger('click');
	}
	$('#user-status').text('In Call');
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	changeStatusLight('IN_CALL');
	totalMissedCalls = 0; // reset missed calls count
	//Added for multiparty status
	var vrs = $('#callerPhone').val();
	socket.emit('incall', {'vrs' : vrs});
})


function multiPartyClick(){
	multipartyinvite(document.getElementById('inviteExtension').value);
}

//Logic for multi part calls
function retreiveFiles(){
	socket.emit('get-file-list', {vrs : recipientNumber});
}

$("#sidebar-dialpad .dropdown-menu").click(function (e) {
	e.stopPropagation();
});
$("#accept-btn").click(function () {
	$('#myRingingModalPhoneNumber').html('');
	$('#myRingingModal').modal('hide');
	$("#hide-video-icon").css("display", "none");
});

$("#decline-btn").click(function () {
	$('#myRingingModalPhoneNumber').html('');
	$('#myRingingModal').modal('hide');
	unpauseQueues();
	$('#callerPhone').val('');
});

//Dialpad functionality
$(".keypad-button").click(function (e) {
	var etemp = $(e.currentTarget);
	etemp.css("background-color", "Gray");
	setTimeout(() => {
		etemp.css("background-color", "White");
	}, 500);
	var el = etemp.find('.big');
	var text = el.text().trim();
	telNumber = $('#phone-number');
	$(telNumber).val(telNumber.val() + text);
        $("#phone-number").focus();
});

$('#phone-number-delete-btn').click(function (e) {
	$('#phone-number').val(
		function (index, value) {
			return value.substr(0, value.length - 1);
		});
  $("#phone-number").focus();
});

//pressing Enter in dialpad will dial
// pressing ESC will close
$("#phone-number").keyup(function(event) {
    if (event.keyCode === 13) {
        $("#button-call").click();
    } else if (event.keyCode == 27) {
		$('#dismiss-dialpad-btn').click();
	}
});

$("#button-call").click(function () {
	if($('#phone-number').val().length < 10){
		//Phone number is not valid
		$('#invalidNumber').show();
	}else {
		direction = 'outgoing';
		$('#modalDialpad').modal('hide');
		$('#invalidNumber').hide();
		showOutboundRinging();
		telNumber = $('#phone-number');
		callerNumber = $('#phone-number').val();
		start_call($(telNumber).val());
		$(telNumber).val('');
		$('#duration').timer('reset');
		$('#user-status').text('In Call');
		changeStatusIcon(in_call_color, "in-call", in_call_blinking);
		changeStatusLight('IN_CALL');
		var vrs = $('#callerPhone').val();
		socket.emit('incall', {'vrs' : vrs});
		toggle_incall_buttons(true);
		$('#outboundCallAlert').show();
	}
});

//Functionality for videomail hover while in call
$("#videomailTbody").hover(function(){
    if(agentStatus == 'IN_CALL'){
        document.getElementById("videomailTbody").style.cursor = "not-allowed";
    }else{
        document.getElementById("videomailTbody").style.cursor = "pointer";
    }
});

//Functionality for persist camera
$("#persistCameraCheck").click(function(){
	if(document.getElementById("persistCameraCheck").checked == true){
		enable_persist_view();
	}else if(document.getElementById("persistCameraCheck").checked == false){
		disable_persist_view();
	}
});

//Functionality for screenshare
$("#screenShareButton").click(function(){
	if(agentStatus == 'IN_CALL'){
		document.getElementById("screenShareButton").style.cursor = "pointer";
	}else{
		document.getElementById("screenShareButton").style.cursor = "not-allowed";
	}
});

function allowScreenShare(){
	socket.emit('screenshareResponse', {'permission' : true, 'number' : recipientNumber});
	$('#screenshareRequest').modal('hide');
}

function disallowScreenShare(){
	socket.emit('screenshareResponse', {'permission' : false, 'number' : recipientNumber});
	$('#screenshareRequest').modal('hide');
}

//Functionality for fileshare
function ShareFile(){
	if (agentStatus == 'IN_CALL' && document.getElementById("fileInput").files[0]) {
		$('#fileSentError').hide();
		$('#fileSent').hide();
		console.log("Sending file " + document.getElementById("fileInput").files[0]);
		var vrs = $('#callerPhone').val();
		var formData = new FormData();
		formData.append('uploadfile', $("#fileInput")[0].files[0]);
		formData.append("vrs", vrs);
		$.ajax({
			url: './fileUpload',
			type: "POST",
			data: formData,
			contentType: false,
			processData: false,
			success: function (data) {
				console.log(JSON.stringify(data, null, 2))
				socket.emit('get-file-list-agent', {"vrs" : vrs});
				$('#fileSent').show();
			},
			error: function (jXHR, textStatus, errorThrown) {
				console.log("ERROR");
				$('#fileSentError').show();
			}
		});
	}
}

$("#fullscreen-element").dblclick(function(){
	enterFullscreen();
})

//Alert message function
function showAlert(alertType, alertText){
	$('#generalAlert').attr('class','alert alert-' + alertType + ' alert-dismissible');
	$('#alertText').html(alertText);
	$('#generalAlert').show();
	setTimeout(function(){
		$('#generalAlert').hide();
	},4000)
}

//Keypress for DTMF toggle
$(document).on('keypress', function(e){
	if(e.which == 'k' && agentStatus == 'IN_CALL'){
		if(DTMFpad){
			$('#dtmfpad').hide();
			DTMFpad = false;
		}else{
			$('#dtmfpad').show();
			DTMFpad = true;
		}
	}
})

//Button press for DTMF toggle
$("#toggleDTMF").click(function(){
	if(DTMFpad){
		$('#dtmfpad').hide();
		DTMFpad = false;
	}else{
		$('#dtmfpad').show();
		DTMFpad = true;
	}
})

function DTMFpress(number){
	showAlert('info', 'You pressed key number ' + number);
	acekurento.sendDTMF(number);
}

function changeTabs(id){
	if(id == "callhistory-tab"){
		$('#callCard').hide();
		$('#callhistory').show();
		$('#contact-tab').hide();
		$('#callHistoryBody').show();
		$("#callhistory").height(600);

		//pressing esc closes the modal
		$(document).on('keyup.close-dialpad',function (evt) {
			if (evt.keyCode == 27) {
				$('#dismiss-dialpad-btn').click();
			}
		});

		//pressing the up and down arrows scrolls through callback buttons
		//pressing enter calls the selected number
		let buttonPosition=1;
		let buttonTestID = 'callback-btn' + buttonPosition;
		$('#'+buttonTestID).css('border', '5px solid black');

		$(document).on('keydown.scroll',function (evt) {
			let scrollPosition= ( $('#callhistory').scrollTop() ); //current height of modal

			//hitting enter calls
			if (evt.keyCode == 13) {
				$('#'+buttonTestID).trigger('click');
			}

			if (evt.keyCode == 40) {
				//scroll down
				scrollPosition += 40;
				$('#callhistory').scrollTop(scrollPosition);

				if (buttonPosition >= show_records) {
					//do nothing
				} else {
					$('#'+buttonTestID).css('border', 'none');

					buttonPosition++;
					buttonTestID = 'callback-btn' + buttonPosition;
					$('#'+buttonTestID).css('border', '5px solid black');
				}

			} else if (evt.keyCode == 38) {
				//scroll up
				scrollPosition -= 40;
				$('#callhistory').scrollTop(scrollPosition);

				if (buttonPosition <= 1) {
					//do nothing
				} else {
					$('#'+buttonTestID).css('border', 'none');

					buttonPosition--;
					buttonTestID = 'callback-btn' + buttonPosition;
					$('#'+buttonTestID).css('border', '5px solid black');
				}
			}
		});
	} else if (id == "dialpad-tab") {
		$('#callCard').show();
		$('#callhistory').hide();
		$('#contact-tab').hide();
		$('#callHistoryBody').hide();
		$("#callhistory").height(0);

		//remove key bindings
		closeDialpadModal();

		//focus on the input box
		$('#phone-number').focus();
	} else if (id == "contact-tab") {
		$('#callCard').hide();
		$('#callhistory').hide();
		$('#contact-tab').show();
		$('#callHistoryBody').hide();

		//remove key bindings
		closeDialpadModal();
	}
}
var show_records = 20; //num call history records to show
function loadCallHistory(){

	var endpointType;
	socket.emit('getCallHistory');
	socket.on('returnCallHistory', function(result){

                $("#callHistoryBody").html("");

                var count_recs = 0;
		for(var i = result.length - 1; i >= 0; i--){
                        count_recs++;
			if(result[i].endpoint == "webrtc"){
				endpointType = '<i class="fa fa-globe"></i>';
			} else{
				endpointType = '<i class="fa fa-phone"></i>';
			}
				$("#callHistoryBody").append(
					'<tr>' +
						'<th>' + result[i].callerName + '</th>' +
						'<th>' + result[i].callerNumber + '</th>' +
						'<th>' + result[i].direction + '</th>' +
						'<th>' + result[i].duration + '</th>' +
						'<th>' + endpointType + '</th>' +
						'<th>' + result[i].callDate + '</th>' +
						'<th><button class=\"demo-btn\" onclick="outbound_call(\'' + result[i].callerNumber + '\')" id=\'callback-btn' + count_recs + '\'><i class="fa fa-phone-square"></i></button></th>' +
					"</tr>"
				)
				if (count_recs >= show_records)
					break;
		}
	});
}

function closeDialpadModal() {
	//remove esc and arrow key binding events
	$(document).off("keydown.scroll");
	$(document).off("keyup.close-dialpad");

	//remove style from selected callback button
	$('.demo-btn').css('border', '');

	//reset scrollbar to top
	$("#callhistory").scrollTop(0);
}

//Callback method
function outbound_call(number){
	$('#modalDialpad').modal('hide');
	showOutboundRinging();
	direction = 'outgoing';
	callerNumber = number;
	endpoint = 'provider';
	start_call(number);
	$('#duration').timer('reset');
	$('#user-status').text('In Call');
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	changeStatusLight('IN_CALL');
	var vrs = $('#callerPhone').val();
	socket.emit('incall', {'vrs' : vrs});
	toggle_incall_buttons(true);
	$('#outboundCallAlert').show();
	closeDialpadModal(); //remove key bindings
}

var options = {
	cellHeight: 40,
	verticalMargin: 10
};
//var grid = $('.grid-stack').gridstack(options);
var grid = GridStack.init(options);

var serializedGridData = [];
var loadingGridLayout = false;

function saveGridLayout() {
	serializedGridData = _.map($('.grid-stack > .grid-stack-item:visible'), function (el) {
		el = $(el);
		var node = el.data('_gridstack_node');
		return {
			id: el[0].id,
			visible: el[0].visible,
			x: node.x,
			y: node.y,
			width: node.width,
			height: node.height
		};
	});

	sessionStorage.layout = JSON.stringify(serializedGridData);
	socket.emit('save-grid-layout', {
		'gridLayout': serializedGridData
	});
}

function loadGridLayout(layout) {
	sessionStorage.layout = JSON.stringify(layout);
	loadingGridLayout = true;
	//var grid = $('.grid-stack').data('gridstack');
	grid.batchUpdate();

	layout.forEach(function (el) {
		grid.update($('#' + el.id), el.x, el.y, el.width, el.height);
	});

	grid.commit();
	resizeVideo();
	resizeChat();
	loadingGridLayout = false;
}
resizeVideo();
resizeChat();

//$('.grid-stack').on('change', function (event, items) {
grid.on('change', function (event, items) {
	if (!loadingGridLayout) {
		saveGridLayout();
	}
	resizeVideo();
	resizeChat();
});

function resizeVideo() {
	var contentHeight = $("#gsvideobox").height() - 50;
	$('#VideoBox').css("height", contentHeight + "px");
	$('#remoteView').css("height", contentHeight - 125 + "px");
	$('#fullscreen-element').css("height", contentHeight-100+ "px");

	//$('#persistView').css({"height": '100%', "width": '100%', 'object-fit':'cover'});
	$('#persistView').css({"height": '100%', "width": '100%', 'object-fit':'contain'});

	$('#VideoBox').attr('style', "background-color:white;"); //doesn't open box if it's collapsed
}

function resizeChat() {
	var contentHeight = $("#gschatbox").height();

	var chatheaderHeight = $("#chat-header").outerHeight();
	var rtttypinHeight = $("#rtt-typing").outerHeight();
	var chatfooterheight = $("#chat-footer").outerHeight();
	var parts = chatheaderHeight + rtttypinHeight + chatfooterheight;

	var padding = 30;

	// userchat is overall chat box content, chatmessages is only the messages area
	$('#userchat').css("height", contentHeight - padding + "px");
	$('#chat-messages').css("height", contentHeight - parts - padding + "px");
	$('#userchat').attr('style', "background-color:white;"); //doesn't open box if it's collapsed
}

function resetLayout() {
	var defaultLayout = [
		{
			"id": "gsvideobox",
			"x": 0,
			"y": 0,
			"width": 8,
			"height": 16
		}, 
		{
			"id": "gschatbox",
			"x": 8,
			"y": 0,
			"width": 4,
			"height": 10
		},
		{
			"id": "gsfilebox",
			"x": 8,
			"y": 11,
			"width": 4,
			"height": 10
		},
	];
	loadGridLayout(defaultLayout);
	if (!loadingGridLayout) {
		saveGridLayout();
	}
	resizeVideo();
	resizeChat();
}

//enables chat buttons on a webrtc call when it is accepted
function enable_chat_buttons() {
	$("#newchatmessage").removeAttr("disabled");
	$("#chat-send").removeAttr("disabled");
	$("#chat-emoji").removeAttr("disabled");
	$("#newchatmessage").attr("placeholder", "Type Message ...");
	$("#characters-left").show();

}

//disables chat buttons
function disable_chat_buttons() {
	$("#newchatmessage").attr("disabled", "disabled");
	$("#chat-send").attr("disabled", "disabled");
	$("#chat-emoji").attr("disabled", "disabled");
	$("#newchatmessage").attr("placeholder", "Chat disabled");
	$("#characters-left").hide();

}

function enable_initial_buttons() {}
$("#helpalert").hide();

/* use Enter or ESC keys in change shortcut modal */
$("#modalChangeShortcut").keyup(function(event) {
	if (event.keyCode === 13) {
		$("#update-shortcut-btn").click();
	} else if (event.keyCode == 27) {
		$('#close-shortcut-btn').click();
	}
});

/* click on a row in the shortcuts table to customize shortcut
*	CANNOT CUSTOMIZE SIDEBAR TAB SHORTCUTS
*/
$('#shortcutsBody').on('click','tr',function() {
	var clickedValue = $(this).find("th").text();
	console.log("clicked value: " + clickedValue);

	var currentShortcut = $(this).find("td").text();
	console.log("current shortcut: " + currentShortcut);

	var clickedID = $("[name="+clickedValue+"]").attr("id");

	if (clickedID == "agents-tab" || clickedID == "videomail-tab" || clickedID == "recordings-tab" || clickedID == "shortcuts-tab" || clickedID == "clear-shortcuts" || clickedID == "reset-shortcuts") {

		//error modal
		console.log("cannot customize tab shortcuts or shortcut buttons")
		$('#shortcutsErrorModal').modal({
			backdrop: 'static',
			keyboard: true
		});

		$('#shortcutsErrorModalBody').html("Cannot customize sidebar tab shortcuts or shortcut buttons");

		//pressing Enter or ESC will close modal
		$("#shortcutsErrorModal").keyup(function(event) {
			if (event.keyCode === 13) {
				$("#shortcuts-error-btn").click();
			} else if (event.keyCode == 27) {
				$("#shortcuts-error-btn").click();
			}
		});
	} else {

		$('#modalChangeShortcut').modal({
			backdrop: 'static',
			keyboard: true
		});
		//cursor is automatically in textbox
		$('#modalChangeShortcut').on('shown.bs.modal', function() {
			$('#new-shortcut').focus();
		});

		$('#current-action').html(clickedValue);
		$('#current-action').attr("value", clickedID);
		$('#new-shortcut').val(currentShortcut);
	}
});

/**
 * @param {string} task task id
 * @param {string} shortcut not case sensitive
 */
function setShortcut(task, shortcut) {
	//multiple tasks can have no shortcut
	if (shortcut == undefined || shortcut == "") {
		shortcut = "";
		$('#'+task).attr("accesskey", shortcut);
		socket.emit('set-shortcuts', {_id: task,'task': task, 'shortcut':shortcut});
		updateShortcutTable();
	} else {
		//check if the shortcut is already being used
		var isShortcutUsed = checkShortcutUse(task, shortcut);

		if (isShortcutUsed) {
			//error modal
			$('#shortcutsErrorModal').modal({
				backdrop: 'static',
				keyboard: true
			});

			$('#shortcutsErrorModalBody').html("Shortcut in use");

			//pressing Enter or ESC will close modal
			$("#shortcutsErrorModal").keyup(function(event) {
				if (event.keyCode === 13) {
					$("#shortcuts-error-btn").click();
				}  else if (event.keyCode == 27) {
					$("#shortcuts-error-btn").click();
				}
			});
		} else {
			//good to go
			$('#'+task).attr("accesskey", shortcut);
			socket.emit('set-shortcuts', {_id: task,'task': task, 'shortcut':shortcut});
			updateShortcutTable();
		}
	}
}
/**
 *
 * @param {string} task task id
 */
function getShortcut(task) {
	return ($('#'+task).attr("accesskey"))
}

function updateShortcutTable() {
	//populate table from db
	//use default to populate anything not in db
	console.log("UPDATE SHORTCUTS");

	//array of all elements with an accesskey
	var taskArray = $("[accesskey]").map(function(){
		return $(this).attr('id');
	}).get();

	 var tableLength = taskArray.length;

	socket.emit('get-shortcuts');
	socket.on('receive-shortcuts', function(data) {
		$('#shortcutsTable tbody').html("");

		for(let i = 0; i < tableLength; i++){
			for (let j = 0; j < data.length; j++){
				//console.log('comparing ' +taskArray[i]+ ' to ' +data[j].task);
				if (taskArray[i] == data[j].task) {
					//console.log(taskArray[i] + ' in database');
					$('#'+taskArray[i]).attr("accesskey", data[j].shortcut);
					break;
				}
			}

			var taskValue = $('#' + taskArray[i]).attr('name');

			$('#shortcutsBody').append(
				"<tr><th>" +taskValue+ "</th>" +
				"<td>" + getShortcut(taskArray[i]).toUpperCase() + "</td>"
			);
			$('#shortcutsBody').append("<br>"); //spaces the elements
		}
		$('#shortcutsTable').append($('#shortcutsBody'));
	});
}

/**
 * Check if the shortcut is already in use.
 *
 * Returns true if shortcut is in use, false if not
 * @param {string} task	element's shortcut we are changing
 * @param {string} shortcut not case sensitive
 */
function checkShortcutUse(task, shortcut) {
	var isUsed = false;
	shortcut = shortcut.toUpperCase();

	var accesskeyArray = $("[accesskey]").map(function(){
		return $(this).attr('id');
	}).get();

	var arrayLength = accesskeyArray.length;
	for (var i = 0; i <= arrayLength; i++) {
		if (accesskeyArray[i] != undefined) {
			//console.log('shortcut: ' + shortcut+ ' vs: ' + (getShortcut(accesskeyArray[i])));
			if (getShortcut(accesskeyArray[i]).toUpperCase() == shortcut) {
				if (accesskeyArray[i] == task) {
					//shortcut being used by itself
					isUsed = false;
					return isUsed;
				} else {
					isUsed = true;
					console.log('shortcut being used by ' +accesskeyArray[i]);
					console.log(task);
					return isUsed;
				}
			}
		}
	}

	return isUsed;
}

function clearShortcutsTable() {
	$('#shortcutsTable tbody').html("");
}

function clearShortcuts() {
	console.log('clearing');
	var taskArray = $("[accesskey]").map(function () {
		return $(this).attr('id');
	}).get();
	var arrayLength = taskArray.length;

	for (var i = 0; i <= arrayLength; i++) {
		if (taskArray[i] != undefined) {
			if (taskArray[i] == 'agents-tab' || taskArray[i] == "videomail-tab" || taskArray[i] == "shortcuts-tab") {
				//do nothing
			} else if (taskArray[i] == 'clear-shortcuts' || taskArray[i] == "reset-shortcuts"){
				//do nothing
			} else {
				//setShortcut(taskArray[i], "");
				socket.emit('set-shortcuts', {_id: taskArray[i], 'task':taskArray[i], 'shortcut': ''});
				$('#'+taskArray[i]).attr("accesskey", "");
			}
		}
	}
	updateShortcutTable();
}

function resetShortcuts() {
	socket.emit('reset-shortcuts');

	console.log('reseting shortcuts');
	var taskArray = $("[accesskey]").map(function(){
		return $(this).attr('id');
	}).get();

	var reachedTabs = false;
	reachedButtons = false;

	for (var i = 0; i < taskArray.length; i++) {
		if (taskArray[i] == 'agents-tab' || taskArray[i] == "videomail-tab" || taskArray[i] == "shortcuts-tab") {
			//do nothing
			reachedTabs = true;
		} else if (taskArray[i] == 'clear-shortcuts' || taskArray[i] == "reset-shortcuts") {
			//do nothing
			reachedButtons = true;
		} else {
			//calling setShortcuts crashes acedirect
			if (reachedTabs) {
				//originalShortcuts doesn't store the sidebar tabs' shortcuts
				//so we skip over them
				$('#'+taskArray[i]).attr("accesskey", originalShortcuts[i-3]);
			} else if (reachedButtons) {
				// originalShortcuts doesn't store the shortcuts buttons
				// we will only need this if we add more elements with accesskeys in the future
				$('#'+taskArray[i]).attr("accesskey", originalShortcuts[i-5]);
			} else {
				$('#'+taskArray[i]).attr("accesskey", originalShortcuts[i]);
			}
		}
	}
	updateShortcutTable();
}

function collapseVideoBox() {
    console.log('collapse video box');
    $('#VideoBox').attr('style', "background-color:white;"); //removes the background when collapsing the box
}

function collapseFilesBox(){
	$('#filesbox').attr('style', "background-color:white;");
}

function collapseChatBox() {
    console.log('collapse chat box');
    $('#userchat').attr('style', "background-color:white;"); //removes the background when collapsing the box
}

function clearAgentDownloadList() {
	$('#agent-file-list').empty();
	$("#agent-file-group").hide();
}

function addFileToAgentDownloadList(data) {
	$("#agent-file-group").show();
	$('#agent-file-list').append(
		$('<li class="list-group-item btn-primary btn btn-flat">')
		.append('<a style="color:white;display:block;" target="_blank" href="./downloadFile?id=' + data.id + '">' + data.original_filename + '</a>')
	);
}
