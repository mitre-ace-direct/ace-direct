const pfx = (process.env.LOGNAME === undefined) ? '' : process.env.LOGNAME + '_';

module.exports = {
    // REDIS NAMES
    R_STATUS_MAP: pfx + 'statusMap', // Contains login name => JSON data passed from browser
    R_VRS_TO_ZEN_ID: pfx + 'vrsToZenId', // Contains the VRS number mapped to the Zendesk ticket number
    R_CONSUMER_EXTENSIONS: pfx + 'consumerExtensions', // Contains the consumer extension mapped to {"secret":extensionpassword, "inuse":true|false}
    R_EXTENSION_TO_VRS: pfx + 'extensionToVrs', // Contains the consumer extension(nnnnn) mapped to the VRS number (nnnnnnnnnn) Redis will double map these key values meaning both will exist key:value nnnnn:mmmmmmmmmm and mmmmmmmmmm:nnnnn
    R_EXTENSION_TO_LANGUAGE: pfx + 'extensionToLanguage', // Contains the consumer extension(nnnnn) mapped to the preferred language
    R_LINPHONE_TO_AGENT_MAP: pfx + 'linphoneToAgentMap', // Maps Linphone caller extension to agent extension
    R_CONSUMER_TO_CSR: pfx + 'consumerToCsr', // Maps consumer extension to CSR extension
    R_AGENT_INFO_MAP: pfx + 'agentInfoMap', // Map of Agent information, key agent_id value JSON object
    R_TOKEN_MAP: pfx + 'tokenMap' // Map of Token to status, key token value {status, date}.
};


