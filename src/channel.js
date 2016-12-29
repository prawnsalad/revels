'use strict';

const _ = require('lodash');
const IrcClient = require('irc-framework').Client;
const ircClientMiddleware = require('./ircclientmiddleware');

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

	destSockets.forEach(socket => {
		let out = line;
		if (socket.hasChannelSupport) {
			out = ':' + this.id + ' ' + line;
		}
		socket.write(out);
	});
};
Channel.prototype.writeToOtherSockets = function(line, notThisSocket) {
	this.sockets.forEach(socket => {
		if (socket !== notThisSocket) {
			socket.write(line)
		}
	});
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
Channel.prototype.syncToSocket = function syncToSocket(socket) {
	console.log('Syncing session..');

	// Send any registration related lines
	this.state.replay.registration.forEach(message => {
		message.params[0] = this.state.nick;
		console.log(messageToLine(message));
		this.write(messageToLine(message), socket);
	});

	// Send the ISUPPORT lines
	this.state.replay.support.forEach(message => {
		message.params[0] = this.state.nick;
		console.log(messageToLine(message));
		this.write(messageToLine(message), socket);
	});

	// Send the MOTD
	this.state.replay.motd.forEach(message => {
		message.params[0] = this.state.nick;
		this.write(messageToLine(message), socket);
	});

	// Send buffers
	_.each(this.state.buffers, buffer => {
		console.log('Syncing', buffer.name);
		this.upstream.raw('TOPIC ' + buffer.name);
		this.upstream.raw('NAMES ' + buffer.name);
		this.write(`:${this.state.mask} JOIN ${buffer.name} * :${this.upstream.user.gecos}`, socket);
	});
};



function messageToLine(message) {
	let line = '';
	if (message.prefix) {
		line += ':' + message.prefix + ' ';
	}

	line += message.command;

	for(let i=0; i<message.params.length; i++) {
		if (i === message.params.length - 1) {
			line += ' :' + message.params[i];
		} else {
			line += ' ' + message.params[i];
		}
	}

	return line;
}
