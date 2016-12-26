'use strict';

const _ = require('lodash');

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

    } else if (params[0] === 'LIST' && params[1] === 'NETWORKS') {
        for (let channelId in client.session.channels) {
            let channel = client.session.channels[channelId];
            let props = [];
            props.push('NAME=' + channel.state.name);
            props.push('CHANNEL=' + channelId);
            props.push('HOST=' + channel.state.connection.host);
            props.push('PORT=' + channel.state.connection.port);
            props.push('TLS=' + (channel.state.connection.tls ? '1' : '0'));
            props.push('NICK=' + channel.state.nick);
            if (channel.state.connection.password) {
                props.push('PASS=' + channel.state.connection.password);
            }

            channel.write('CONTROL LISTING NETWORK ' + props.join(' '), client.socket);

            _.each(channel.state.buffers, buffer => {
                let props = [];
                props.push('CHANNEL=' + channelId);
                props.push('NAME=' + buffer.name);
                props.push('JOINED=' + (buffer.joined ? '1' : '0'));
                channel.write('CONTROL LISTING BUFFER ' + props.join(' '), client.socket);
            });
        }
    }
}
