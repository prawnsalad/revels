'use strict';

const db = {
	users: {
		darren: {
			password: 'mypass',
			networks: [
				{
					channel: '1',
					name: 'freenode',
					nick: 'notprawn',
					connection: {
						host: 'irc.freenode.net',
						port: 6667,
						tls: false,
						password: '',
						username: 'notprawn',
						realname: 'notprawn',
					},
					buffers: {
						name: '#kiwiirc-dev',
						data: []
					}
				}
			],
		}
	}
};

function optVal(optsObj, key, defaultVal) {
	return !optsObj || typeof optsObj[key] === 'undefined' ?
		defaultVal :
		optsObj(key);
}

exports.authUser = function authUser(username, password) {
	return new Promise((resolve, reject) => {
		let user = db.users[username.toLowerCase()];
		if (!user || password !== user.password) {
			return resolve(false);
		}

		resolve(true);
	});
};


exports.getNetworks = function getNetworks(username, opts) {
	return new Promise((resolve, reject) => {
		let user = db.users[username.toLowerCase()];
		if (!user) {
			return reject();
		}

		let includeBuffers = optVal(opts, 'includeBuffers', false);
		let networks = user.networks.map(network => {
			let obj = {
				name: network.name,
				channel: network.channel,
				connection: {
					host: network.connection.host,
					port: network.connection.port,
					tls: network.connection.tls,
					password: network.connection.password,
					username: network.connection.username,
					realname: network.connection.realname,
				},
			};

			if (includeBuffers) {
				obj.buffers = network.buffers.map(buffer => {
					return {
						name: buffer.name
					};
				});
			}

			return obj;
		});

		resolve(networks);
	});
};
