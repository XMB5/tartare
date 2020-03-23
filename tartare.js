'use strict';

const Hapi = require('@hapi/hapi');
const path = require('path');
const inert = require('@hapi/inert');
const VideoManager = require('./videomanager.js');

const staticDir = path.join(__dirname, 'static');

const init = async () => {

    const videosDir = process.env['TARTARE_VIDEOS'];
    if (!videosDir) {
        console.error('must set TARTARE_VIDEOS environment variable');
        process.exit(1);
    }
    const cacheDir = process.env['TARTARE_CACHE'];
    if (!cacheDir) {
        console.error('must set TARTARE_CACHE environment variable');
        process.exit(1);
    }

    await VideoManager.init(videosDir, cacheDir);

    const port = parseInt(process.env.TARTARE_PORT) || 3000;
    const host = process.env.TARTARE_HOST || 'localhost';

    const server = Hapi.server({port, host});

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
        path: '/videos/{any*}',
        handler: {
            directory: {
                path: VideoManager.videosDir,
                etagMethod: 'simple'
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/thumb/{any*}',
        handler: {
            directory: {
                path: VideoManager.thumbnailDir,
                etagMethod: 'simple',
                index: false
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

    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });

};

process.on('unhandledRejection', err => {
    console.log(err);
    process.exit(1);
});

init();