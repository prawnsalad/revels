'use strict';

const parseIrcLine = require('irc-message').parse;
const preConnectionMessageHandler = require('./messagehandlers/preconnection');
const clientMessageHandler = require('./messagehandlers/client');
const controlMessageHandler = require('./messagehandlers/control');

const defaultChannelId = '1';

module.exports = Client;

function Client(socket, sessionStore) {
	this._eventBinds = [];

	this.socket = socket;
	this.sessionStore = sessionStore;
	this.session = sessionStore.newSession();
	this.channel = null;
	this.cap = {
		isNegotiating: false,
		enabled: [],
		isEnabled: cap => this.cap.enabled.indexOf(cap) > -1,
	};

	if (!socket.hasChannelSupport) {
		this.channel = this.session.addChannel(defaultChannelId);
		this.channel.addSocket(socket);
	}

	this.listenOn(socket, 'data', this.onSocketData.bind(this));
	this.listenOn(socket, 'close', this.onSocketClose.bind(this));
}
Client.prototype.listenOn = function(obj, eventName, fn) {
	obj.on(eventName, fn);
	let unlistenFn = () => {
		obj.removeListener(eventName, fn);
	};
	this._eventBinds.push(unlistenFn);
	return unlistenFn;
};
Client.prototype.unlistenEvents = function() {
	this._eventBinds.forEach(fn => fn());
};
Client.prototype.onSocketClose = function onSocketClose() {
	this.unlistenEvents();
	this.session.removeSocket(this.socket);
	this.sessionStore.removeSession(this.session);

	this.socket = null;
	this.session = null;
	this.channel = null;
};
Client.prototype.onSocketData = function onSocketData(rawLine) {
	let thisChannel = null;
	let line = null;
	console.log('[c]', rawLine);
	// What channel is this line meant for?
	if (!this.socket.hasChannelSupport) {
		thisChannel = this.channel;
		line = rawLine;

	} else {
		let f = parseChanneledLine(rawLine);

		// A channel but no message is the client creating or joining a channel,
		// so acknowledge it.
		if (f.channel && !f.message) {
			thisChannel = this.session.addChannel(f.channel);
			this.socket.write(':' + f.channel);
			thisChannel.addSocket(this.socket);
			console.log('Created channel ' + f.channel);
			return;
		}

		thisChannel = this.session.getChannel(f.channel);
		line = f.message;
	}

	// No channel, ignoring the line
	if (!thisChannel) {
		console.log('No channel, ignoring line');
		return;
	}

	// This point onwards we will always have a channel

	let ircMessage = parseIrcLine(line);

	// Control commands can be used at any time
	if (ircMessage && ircMessage.command === 'CONTROL') {
		controlMessageHandler.handle(this, thisChannel, ircMessage);
	// A select few command only available while not connected upstream
	} else if (!thisChannel.isUpstreamConnected()) {
		preConnectionMessageHandler.handle(this, thisChannel, ircMessage);
	} else {
		clientMessageHandler.handle(this, thisChannel, ircMessage);
	}
};








// Extract the channel ID from a websocket message
function parseChanneledLine(line) {
	if (line[0] !== ':') {
		return {
			channel: '',
			message: line,
		};
	}

	let spacePos = line.indexOf(' ');
	if (spacePos === -1) {
		return {
			channel: line.substr(1),
			message: '',
		};
	}

	return {
		channel: line.substr(1, spacePos - 1),
		message: line.substr(spacePos + 1),
	};
}

