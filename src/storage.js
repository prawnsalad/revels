'use strict';

let backend = null;

exports.setBackend = function setBackend(backendType) {
	backend = require('./storagebackends/' + backendType);
};


exports.authUser = function authUser(username, password) {
	return backend.authUser(username, password);
};


exports.getNetworks = function getNetworks(username, opts) {
	return backend.getNetworks(username, opts);
};
