'use strict';

const IrcClient = require('irc-framework').Client;
const ircClientMiddleware = require('./ircClientMiddleware');

module.exports = Channel;

function Channel(session, newId) {
	this.session = session;
	this.id = newId;
	this.sockets = [];
	this.state = {
		name: 'Network',
		nick: '',
		mask: '',
		connection: {
			host: '',
			port: 6667,
			tls: false,
			password: '',
			username: '',
			realname: '',
		},
		buffers: Object.create(null),
		replay: {
			registration: [],
			support: [],
			motd: [],
		},
	};
	this.upstream = false;
}
Channel.prototype.addSocket = function(socket) {
	if (this.sockets.indexOf(socket) === -1) {
		this.sockets.push(socket);
	}
};
Channel.prototype.removeSocket = function(socket) {
	let idx = this.sockets.indexOf(socket);
	if (idx > -1) {
		this.sockets.splice(idx, 1);
	}
};
Channel.prototype.write = function(line, onlyThisSocket) {
	let destSockets = onlyThisSocket ?
		[onlyThisSocket] :
		this.sockets;

	destSockets.forEach(socket => socket.write(line));
};
Channel.prototype.writeStatus = function writeStatus(line, onlyThisSocket) {
	this.write(':*status!bnc@kiwiirc NOTICE * :' + line, onlyThisSocket);
};
Channel.prototype.isUpstreamConnected = function() {
	return (
		this.upstream &&
		this.upstream.connection &&
		this.upstream.connection.connected
	);
};
Channel.prototype.connectIfReady = function() {
	// Already created an IRCd connection? Don't do it again
	if (this.isUpstreamConnected()) {
		console.log('connectIfReady() Upstream already connected');
		return;
	}

	let connection = this.state.connection;
	if (!connection.host || !connection.port || !connection.nick || !connection.username) {
		console.log('Not ready to create upstream');
		return;
	}

	let connect_args = {
		host: connection.host,
		port: connection.port,
		password: connection.password,
		nick: connection.nick,
		tls: connection.tls,
	};
	console.log(connect_args);

	let client = this.upstream;
	if (!client) {
		console.log('Creating upstream');
		client = this.upstream = new IrcClient();
		client.use(ircClientMiddleware(this));
	} else {
		console.log('Reusing upstream');
	}

	client.connect(connect_args);

	return true;
};
Channel.prototype.getBuffer = function getBuffer(bufferName) {
	return this.state.buffers[bufferName.toLowerCase()];
};
Channel.prototype.getOrCreateBuffer = function getOrCreateBuffer(bufferName) {
	let normalisedName = bufferName.toLowerCase();
	let buffer = this.state.buffers[normalisedName];

	if (!buffer) {
		buffer = {
			name: bufferName,
			joined: false
		};
		this.state.buffers[normalisedName] = buffer;
	}

	return buffer;
};
Channel.prototype.removeBuffer = function removeBuffer(bufferName) {
	delete this.state.buffers[bufferName.toLowerCase()];
};