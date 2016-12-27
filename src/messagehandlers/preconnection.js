'use strict';

const _ = require('lodash');
const Storage = require('../storage');

module.exports.handle = handlePreConnectionMessage;

function handlePreConnectionMessage(client, channel, message) {
	if (!message) {
		return;
	}

	if (message.command === 'HOST') {
		// Default IRC connection details
		let server_host = '';
		let server_port = '6667';
		let server_tls = false;

		// HOST irc.freenode.net:+6697
		// HOST irc.freenode.net:6667
		// HOST irc.freenode.net

		let server_addr_str = message.params[0];

		// Split server:+port into parts
		let server_addr_parts = server_addr_str.split(':');
		server_host = server_addr_parts[0];
		server_port = server_addr_parts[1] || '6667';
		server_tls = false;

		if (server_port[0] === '+') {
			server_tls = true;
			server_port = server_port.substr(1);
		}

		let connection = channel.state.connection;
		connection.host = server_host;
		connection.port = parseInt(server_port);
		connection.tls = server_tls;

		// HOST always comes before NICK and USER. Reset those so we don't
		// accidently connect before receiving them again
		connection.nick = '';
		connection.username = '';
		connection.realname = '';

	} else if (message.command === 'PASS') {
		let pass = message.params[0] || '';
		// Matching for user/network:password
		let local_account_match = pass.match(/^([a-z0-9_]+)\/([a-z0-9_]+):(.+)$/);

		if (!local_account_match) {

			let connection = channel.state.connection;
			connection.password = pass;

		} else {
			// Attempting to log into a local user (Mostly used by non channel
			// supporting tranports)
			let user = local_account_match[1];
			let network = local_account_match[2];
			let local_pass = local_account_match[3];

			authUser(user, local_pass)
				.then(() => {
					let existingSession = client.sessionStore.findUserSession(user);
					if (existingSession) {
						client.session = existingSession;
						console.log('Authed session found');

					} else {
						// No existing session found so use the current one and load any
						// stored networks into it
						client.session.setUser(user);
						return client.session.updateFromStorage();
					}
				})
				.then(() => {
					// Find the channel we're trying to log into
					let channel = client.session.getChannelFromNetworkName(network);
					if (!channel) {
						return Promise.reject('Network not found in user');
					}

					client.channel = channel;
					client.channel.addSocket(client.socket);
					channel.connectIfReady();
					syncChannelToClient(channel, client.socket);
				})
				.catch((err) => {
					let isError = err && err.stack;
					if (isError) {
						console.error(err.stack);
						channel.writeStatus('There was an error logging in');
					} else {
						console.log('Session or channel not found');
						channel.writeStatus('No account or network with that login could be found', client.socket);
					}
				});

			return;
		}

	} else if (message.command === 'USER') {
		// USER notaq notaq localhost :notaq
		channel.state.connection.username = message.params[1];
		channel.state.connection.realname = message.params[3];

	} else if (message.command === 'NICK' && message.params[0]) {
		channel.state.connection.nick = message.params[0];
	} else if (message.command === 'CAP') {
		let serverName = 'bnc.kiwiirc.com';
		let supportedCaps = [
			// Some CAPs that irc-framework supports
			'multi-prefix',
			'away-notify',
			'server-time',
			'znc.in/server-time',
			'extended-join'
		];

		if (message.params[0] === 'LS') {
			client.cap.isNegotiating = true;
			channel.write(`:${serverName} CAP * LS :${supportedCaps.join(' ')}`, client.socket);
		} else if (message.params[1] === 'REQ') {
			let requestedCaps = message.params.slice(2);
			let commonCaps = _.intersection(supportedCaps, requestedCaps);
			client.cap.enabled = commonCaps;
			channel.write(`:${serverName} CAP * ACK :${commonCaps.join(' ')}`, client.socket);
		} else if (message.params[1] === 'END') {
			client.cap.isNegotiating = false;
		}

		return;
	}

	channel.connectIfReady();
}







function authUser(userId, password) {
	console.log('authUser()', userId, password);
	return Storage.authUser(userId, password).then(is_success =>  {
		if (!is_success) {
			console.log('Auth failed. Rejecting.');
			return Promise.reject();
		}

		return true;
	});
}


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


function syncChannelToClient(channel, socket) {
	console.log('Syncing session..');

	console.log('Registration lines:', channel.state.replay.registration.length);
	channel.state.replay.registration.forEach(message => {
		message.params[0] = channel.state.nick;
		console.log(messageToLine(message));
		channel.write(messageToLine(message), socket);
	});

	console.log('Support lines:', channel.state.replay.support.length);
	channel.state.replay.support.forEach(message => {
		message.params[0] = channel.state.nick;
		console.log(messageToLine(message));
		channel.write(messageToLine(message), socket);
	});

	console.log('MOTD:', channel.state.replay.motd.length);
	channel.state.replay.motd.forEach(message => {
		message.params[0] = channel.state.nick;
		channel.write(messageToLine(message), socket);
	});

	console.log('Channels:', Object.keys(channel.state.buffers).length);
	_.each(channel.state.buffers, buffer => {
		console.log('Syncing', buffer.name);
		channel.upstream.raw('TOPIC ' + buffer.name);
		channel.upstream.raw('NAMES ' + buffer.name);
		channel.write(`:${channel.state.mask} JOIN ${buffer.name} * :${channel.upstream.user.gecos}`, socket);
	});
}