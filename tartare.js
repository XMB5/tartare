'use strict';

const Hapi = require('@hapi/hapi');
const path = require('path');
const inert = require('@hapi/inert');
const VideoManager = require('./videomanager.js');

const staticDir = path.join(__dirname, 'static');

const init = async () => {

    const videosDir = process.argv[2];
    const cacheDir = process.argv[3];
    if (!videosDir || !cacheDir) {
        console.error('usage: tartare.js <videos_dir> <cache_dir>');
        process.exit(1);
    }

    await VideoManager.init(videosDir, cacheDir);

    const server = Hapi.server({
        port: 3000,
        host: 'localhost'
    });

    await server.register(inert);

    server.route({
        method: 'GET',
        path: '/{any*}',
        handler: {
            directory: {
                path: staticDir,
                redirectToSlash: true,
                index: true
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/thumb/{any*}',
        handler: {
            directory: {
                path: VideoManager.thumbnailDir
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/api/list.json',
        handler: VideoManager.hapiHandler
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);

};

process.on('unhandledRejection', err => {
    console.log(err);
    process.exit(1);
});

init();