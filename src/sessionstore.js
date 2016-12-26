'use strict';

const Session = require('./session');

module.exports = SessionStore;

function SessionStore() {
	this.nextSessionId = 0;

	this.byUser = new Map();
	this.byId = new Map();
}
SessionStore.prototype.newSession = function() {
	let newId = this.nextSessionId++;
	let session = new Session(this, newId);
	this.byId.set(newId, session);
	return session;
};
SessionStore.prototype.removeSession = function(session, force) {
	if (session.userId) {
		this.byUser.delete(session.userId);
	}

	if (!session.persistent) {
		this.byId.delete(session.id);
	}
};
SessionStore.prototype.findUserSession = function(userId) {
	return this.byUser.get(userId);
};