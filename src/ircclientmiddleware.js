'use strict';

module.exports = clientMiddleware;

function clientMiddleware(channel) {
	return function(client, raw, parsed) {
		raw.use(rawMiddleware);

		client.on('raw socket connected', () => {
			client.is_sock_connected = true;
			channel.write('CONTROL CONNECTED');
		});

		client.on('socket close', () => {
			console.log('IRCd connection closed');
			client.is_sock_connected = false;
			client.has_registered = false;
			channel.state.replay.registration = [];
			channel.writeStatus(`Disconnected from ${channel.state.connection.host}`);
			channel.write('CONTROL CLOSED');
		});

		client.on('connected', () => {
			client.has_registered = true;
			channel.writeStatus(`Now connected to ${channel.state.connection.host}!`);
		});

		client.on('raw', (event) => {
			console.log(event.from_server ? '[S]' : '[C]', event.line);
		});
	};

	function rawMiddleware(command, message, raw, client, next) {
		// The clients and kiwi server ping amongst themselves
		if (message.command === 'PING') {
			channel.upstream.raw('PONG ' + message.params[0]);
			return;
		}
		if (message.command === 'PONG') {
			return next();
		}
		if (message.command === 'CAP') {
			// irc-framework handles this for us
			return next();
		}

		// Some lines on registration to be stored so they can be replayed to clients
		let onRegisteredNumerics = [
			'001',
			'002',
			'003',
			'004',
		];
		if (onRegisteredNumerics.indexOf(command) > -1) {
			channel.state.replay.registration.push(message);
		}

		if (command === '001') {
			console.log('Setting state nick to', message.params[0]);
			channel.state.nick = message.params[0];
		}

		// RPL_ISUPPORT lines
		if (command === '005') {
			channel.state.replay.support.push(message);
			(message.params || []).forEach(param => {
				if (param.indexOf('NETWORK=') === 0) {
					let netName = param.split('=')[1];
					if (netName) {
						channel.state.name = netName;
					}
				}
			});
		}

		// MOTD lines
		let motdEvents = [
			'375',
			'372',
			'376'
		];
		if (motdEvents.indexOf(command) > -1) {
			channel.state.replay.motd.push(message);
		}


		let isUs = (message.nick || '').toLowerCase() === (client.user.nick || '').toLowerCase();

		if (isUs && command === 'NICK') {
			console.log('Setting state nick to', message.params[0]);
			channel.state.nick = message.params[0];
		}

		if (isUs && command === 'JOIN') {
			channel.state.mask = message.prefix;
			let chanName = message.params[0];
			console.log('Joined', chanName);
			let buffer = channel.getOrCreateBuffer(chanName);
			buffer.joined = true;
		}

		if (isUs && (command === 'PART' || command === 'KICK')) {
			let chanName = message.params[0];
			console.log('Left', chanName);
			let buffer = channel.getBuffer(chanName);
			if (buffer) {
				buffer.joined = false;
			}
		}
		//if (!client.has_registered) {
		//	return next();
		//}

		// Pass the line down to connected clients
		channel.write(raw);
		next();
	}
}