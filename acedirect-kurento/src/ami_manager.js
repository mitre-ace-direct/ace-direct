const debug = require('debug')('ace:ami-man');
const Events = require('events');
const param = require('param');
const util = require('util');
const astm = require('asterisk-manager');

class AmiManager extends Events {
  constructor(ami) {
    super();
    this.ami = ami;
  }

  /**
   * Instantiate the Asterisk connection.
   * @returns {nothing} Not used
   */
  async init_ami() {
    let ami = null;
    const id = param('asterisk.ami.id');
    const port = param('app_ports.asterisk_ami').toString();
    const ip = param('servers.asterisk_private_ip');
    const pass = param('asterisk.ami.passwd');

    try {
      this.ami = new astm(parseInt(port), ip, id, pass, true);
      ami = this.ami;
      ami.keepConnected();

      // Define event handlers here
      // add only the manager ami events we care about
      ami.on('dialend', handle_manager_event);
      ami.on('hangup', handle_manager_event);
      ami.on('attendedtransfer', handle_manager_event);
      ami.on('newstate', handle_manager_event);
      ami.on('queuecallerabandon', handle_manager_event);
      ami.on('queuecallerjoin', handle_manager_event);
      ami.on('queuecallerleave', handle_manager_event);

      // handle the response
      ami.on('response', handle_manager_event);
    } catch (exp) {
      debug('Init AMI error:');
      debug(exp);
    }

    /**
     * Event handler to catch the incoming AMI events. Note, these are the
     * events that are auto-generated by Asterisk (don't require any AMI actions
     * sent by this node server). Only concerned with the DialEnd and Hangup events.
     *
     * @param {type} evt Incoming Asterisk event.
     * @returns {undefined} Not used
     */
    function handle_manager_event(evt) {
      debug('\n######################################');
      debug('Received an AMI event: ' + util.inspect(evt, false, null));
      //  TODO SOME HANDLE AMI EVENTS
    }
  }

  /*
   * Add callee to queue
   */
  async queueAdd(ext, queue) {
    if (queue) {
      debug(ext);
      debug('ADDING TO QUEUE: PJSIP/' + ext + ', queue name ' + queue);

      return this.ami.action({
        "Action": "QueueAdd",
        "ActionId": "1000",
        "Interface": "PJSIP/" + ext,
        "Paused": "true",
        "Queue": queue
      }, function (err, res) {
        return res;
      });
    }
  }

  /*
   * Handler catches and we are pausing queue
   */
  pauseQueue(ext, queue, cb) {
    if (queue) {
      debug(ext);
      debug('PAUSING QUEUE: PJSIP/' + ext + ', queue name ' + queue);

      this.ami.action({
        "Action": "QueuePause",
        "ActionId": "1000",
        "Interface": "PJSIP/" + ext,
        "Paused": "true",
        "Queue": queue,
        "Reason": "QueuePause in pause-queue event handler"
      }, function (err, res) {
        if (err) {
          return err;
        }
        cb(res);
      });
    }
  }

  /*
   * Handler catches and we are unpausing queue
   */
  unpauseQueue(ext, queue, cb) {
    if (queue) {
      debug(ext);
      debug('UNPAUSING QUEUE: PJSIP/' + ext + ', queue name ' + queue);

      this.ami.action({
        "Action": "QueuePause",
        "ActionId": "1000",
        "Interface": "PJSIP/" + ext,
        "Paused": "false",
        "Queue": queue,
        "Reason": "QueuePause in pause-queue event handler"
      }, function (err, res) {
        if (err) {
          return err;
        }
        cb(res);
      });
    }
  }

  /*
   * Queue remove from queue
   */
  async queueRemove(ext, queue) {
    if (queue) {
      debug(ext);
      debug('REMOVING FROM QUEUE: PJSIP/' + ext + ', queue name ' + queue);

      return this.ami.action({
        "Action": "QueueRemove",
        "ActionId": "1000",
        "Interface": "PJSIP/" + ext,
        "Paused": "true",
        "Queue": queue
      }, function (err, res) {
        return res;
      });
    }
  }
}

module.exports = AmiManager;
