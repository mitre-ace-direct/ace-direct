const logger = require('./logger');

// These are functions that are not called by code.
// They look like they are called by a person during an interactive debugging session.
// Extracted from server-db.js

/**
 * Find the agent name given the agent information
 * @param {type} Agents
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function findAgentName(Agents, agent) { // eslint-disable-line no-unused-vars
  for (let i = 0; i < Agents.length; i += 1) {
    if (Agents[i].agent === agent) return Agents[i].name;
  }
  return null;
}

/**
 * Find agent by name and queue
 * @param {type} Agents
 * @param {type} agent
 * @param {type} queue
 * @returns {unresolved}
 */
// find agent by name (extension) and queue
function findAgentInQueue(Agents, agent, queue) { // eslint-disable-line no-unused-vars
  logger.debug(`findAgentInQueue() Entering:  agent= ${agent}, queue= ${queue}`);
  for (let i = 0; i < Agents.length; i += 1) {
    logger.debug(Agents[i]);
    if ((Agents[i].agent === agent) && (Agents[i].queue === queue)) {
      logger.debug(`findAgentInQueue(): found Agent ${agent}, queue:${queue}`);
      return Agents[i];
    } if ((Agents[i].agent === agent) && (Agents[i].queue === '--')) { // queue not set
      logger.debug('findAgentInQueue(): empty queue');
      return Agents[i];
    }
  }
  return null;
}

/**
 * Display agent information in the array
 * @param {type} Agents
 * @returns {undefined} Not used
 */
function printAgent(Agents) { // eslint-disable-line no-unused-vars
  logger.debug('Entering printAgent() ');
  for (let i = 0; i < Agents.length; i += 1) {
    logger.debug(Agents[i]);
  }
}

/**
 * Initialize Agent Call map (total calls taken)
 * @param {type} AsteriskQueuenames
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function setCallMap(AsteriskQueuenames, map) { // eslint-disable-line no-unused-vars
  for (let i = 0; i < AsteriskQueuenames.length; i += 1) {
    map.set(AsteriskQueuenames[i], 0); // set the total call to 0
  }
}

/**
 * Display the content of agent call map
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function printCallMap(m) { // eslint-disable-line no-unused-vars
  m.forEach((call, queue) => {
    logger.debug(`printCallMap(): ${queue} ${call}`);
  });
}

/**
 * Display event detail information
 * @param {type} evt Event to display
 * @returns {undefined} Not used
 */
function showEvent(evt) { // eslint-disable-line no-unused-vars
  if (evt) {
    logger.debug(`Event: ${evt.event}`);
  }
}
