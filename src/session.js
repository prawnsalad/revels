'use strict';

const _ = require('lodash');
const Storage = require('./storage');
const Channel = require('./channel');

module.exports = Session;

function Session(sessions, newId) {
	this.sessions = sessions;
	this.id = newId;
	this.userId = 0;
	this.channels = Object.create(null);
	this.persistent = false;
}
Session.prototype.setUser = function(userId) {
	this.userId = userId;
	this.sessions.byUser.delete(userId);
	this.sessions.byUser.set(userId, this);
};
Session.prototype.addChannel = function(newId) {
	if (!this.channels[newId]) {
		this.channels[newId] = new Channel(this, newId);
	}

	return this.channels[newId];
};
Session.prototype.getChannel = function(channelId) {
	return this.channels[channelId];
};
Session.prototype.getChannelFromNetworkName = function(networkName) {
	return _.find(this.channels, (channel) => {
		return channel.state.name.toLowerCase() === networkName.toLowerCase();
	});
};
Session.prototype.removeSocket = function(ws) {
	let chanIds = Object.keys(this.channels);
	chanIds.forEach(chanId => this.channels[chanId].removeSocket(ws));
};
Session.prototype.updateFromStorage = function() {
	return Storage.getNetworks(this.userId).then(networks => {
		for (let i=0; i<networks.length; i++) {
			let network = networks[i];
			let channel = this.addChannel(network.channel);
			channel.state.name = network.name;
			channel.state.connection.host = network.connection.host;
			channel.state.connection.port = network.connection.port;
			channel.state.connection.tls = network.connection.tls;
			channel.state.connection.password = network.connection.password;
			channel.state.connection.username = network.connection.username;
			channel.state.connection.realname = network.connection.realname;
		}
	});
};