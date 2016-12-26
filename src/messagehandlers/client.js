'use strict';

module.exports.handle = handleClientMessage;

function handleClientMessage(client, channel, message) {
	let line = message.raw;

	// Invalid message? Just forward it upstream
	if (!message) {
		return maybeSendDataToIrcServer(channel, line);
	}

	// The IRCd and kiwi server ping amongst themselves
	if (message.command === 'PING') {
		channel.write('PONG ' + message.params[0], client.socket);
		return;
	}
	if (message.command === 'PONG') {
		return;
	}

	if (message.command === 'NICK' && message.params[0]) {
		channel.state.nick = message.params[0];
	}

	if (message.command === 'PRIVMSG' && message.params[0] === '*status') {
		if (message.params[1] === 'disconnect') {
			channel.upstream.quit();
		} else if (message.params[1] === 'connect') {
			channel.upstream.connect();
		} else if (message.params[1] === 'debug') {
			channel.writeStatus('Enabled CAPS: ' + client.cap.enabled.join(' '));
		}
		return;
	} else if (message.command === 'PRIVMSG' && client.cap.isEnabled('echo-message')) {
		let line = `:${channel.state.mask} PRIVMSG ${message.params[0]} :${message.params[1]}`;
		channel.writeToOtherSockets(line, client.socket);
	}

	if (message.command === 'QUIT') {
		// Some clients send QUIT when they close, we want to stay connected.
		// TODO: Provide a way to actually force a quit. How does ZNC manage it?
		return;
	}

	if (message.command === 'USER') {
		// irc-framework handles this for us
		return;
	}

	if (message.command === 'CAP') {
		// Any CAP messages after being connected should be ignored
		return;
	}

	// Not done anything at this point? Forward it upstream
	maybeSendDataToIrcServer(channel, line);
}



function maybeSendDataToIrcServer(channel, line) {
	if (channel.upstream) {
		console.log('raw to server', line);
		channel.upstream.raw(line);
	}
}

