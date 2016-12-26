'use strict';

const _ = require('lodash');
const Client = require('./client');
const SessionStore = require('./sessionstore');


const Storage = require('./storage');
Storage.setBackend('memory');

/**
 * Incoming socket connections from multiple transports
 */
const sessions = new SessionStore();
global.ses = sessions;
function socketHandler(socket) {
	new Client(socket, sessions);
}

const clientTransportSockjs = require('./clienttransports/sockjs');
const clientTransportTcp = require('./clienttransports/tcp');

clientTransportSockjs.startAcceptingClients(socketHandler);
clientTransportTcp.startAcceptingClients(socketHandler);
