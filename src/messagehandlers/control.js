'use strict';

const _ = require('lodash');
const Storage = require('../storage');

module.exports.handle = handleControlMessage;

function handleControlMessage(client, channel, message) {
    let params = message.params;

    if (params[0] === 'SESSION') {
        if (sessions[params[1]]) {
            console.log('CONTINUE SESSION ' + params[1]);
            setSession(sessions[params[1]]);
            ws.findAndSetChannelFromAuth();
        } else {
            console.log('UNKNOWN SESSION, CREATING NEW');
            ws.startNewSession();
        }

    } else if (params[0] === 'AUTH') {
        let userId = params[1] || '';
        let password = params[2] || '';
        Storage.authUser(userId, password).then(isSuccess => {
            if (!isSuccess) {
                channel.write('CONTROL AUTH FAIL', client.socket);
                return Promise.reject();
            }

            let existingSession = client.sessionStore.findUserSession(userId);
            if (existingSession) {
                client.session = existingSession;
                console.log('Authed session found');

            } else {
                // No existing session found so use the current one and load any
                // stored networks into it
                client.session.setUser(userId);
                return client.session.updateFromStorage();
            }
        }).then(() => {
            channel.write('CONTROL AUTH OK', channel.socket);
            channel.writeStatus('Another user has logged into this account. For more information, /msg *status list clients');
        })
        .catch(err => {
            if (err) {
                console.error(err.stack);
                channel.write('CONTROL AUTH ERROR', channel.socket);
            }
        });

    } else if (params[0] === 'LIST' && params[1] === 'NETWORKS') {
        for (let channelId in client.session.channels) {
            if (channelId === '0') continue;
            let chan = client.session.channels[channelId];
            let props = [];
            props.push('NAME=' + chan.state.name);
            props.push('CHANNEL=' + channelId);
            props.push('CONNECTED=' + (chan.isUpstreamConnected() ? '1' : '0'));
            props.push('HOST=' + chan.state.connection.host);
            props.push('PORT=' + chan.state.connection.port);
            props.push('TLS=' + (chan.state.connection.tls ? '1' : '0'));
            props.push('NICK=' + chan.state.nick);
            if (chan.state.connection.password) {
                props.push('PASS=' + chan.state.connection.password);
            }

            channel.write('CONTROL LISTING NETWORK ' + props.join(' '), client.socket);

            _.each(chan.state.buffers, buffer => {
                let props = [];
                props.push('CHANNEL=' + channelId);
                props.push('NAME=' + buffer.name);
                props.push('JOINED=' + (buffer.joined ? '1' : '0'));
                channel.write('CONTROL LISTING BUFFER ' + props.join(' '), client.socket);
            });
        }

        channel.write('CONTROL LISTING NETWORK END', client.socket);
    }
}
