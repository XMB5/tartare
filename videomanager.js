'use strict';

const path = require('path');
const childProcess = require('child_process');
const fs = require('fs');
const {promisify} = require('util');
const readdirPromise = promisify(fs.readdir);
const execFilePromise = promisify(childProcess.execFile);
const mkdirPromise = promisify(fs.mkdir);
const readFilePromise = promisify(fs.readFile);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const crypto = require('crypto');

const THUMBNAIL_SIZE = 200;
const THUMBNAIL_FILE_FORMAT = 'jpeg'; //png or jpeg

const CACHE_HASH_ALGORITHM = 'sha256';

const RESCAN_INTERVAL = 5 * 60 * 1000;

class VideoManager {

    static hash(relPath) {
        const hash = crypto.createHash(CACHE_HASH_ALGORITHM);
        hash.update(relPath);
        return hash.digest('hex');
    }

    static async probe(fileName) {
        console.log('probe', fileName);
        const ffprobeOutput = await execFilePromise('ffprobe', [
            '-loglevel', 'error',
            '-print_format', 'json',
            '-show_entries', 'format=duration,size:stream=codec_name,height,width,avg_frame_rate,sample_rate',
            fileName
        ]);
        return JSON.parse(ffprobeOutput.stdout);
    }

    static async generateThumbnail(fileName, thumbnailFileName, info) {
        console.log('generate thumbnail for', fileName);
        const secondToCapture = Math.min(5, parseFloat(info.format.duration) / 12);
        const outFile = path.join(VideoManager.thumbnailDir, thumbnailFileName);
        await execFilePromise('ffmpeg', [
            '-loglevel', 'error',
            '-i', fileName,
            '-ss', secondToCapture,
            '-vframes', '1',
            '-vf', `scale=-1:${THUMBNAIL_SIZE},crop=${THUMBNAIL_SIZE}:${THUMBNAIL_SIZE}`,
            '-n',
            outFile
        ]);
    }

    static async init(videosDir, cacheDir) {
        VideoManager.videosDir = videosDir;
        VideoManager.cacheDir = cacheDir;
        VideoManager.prevInfosFile = path.join(VideoManager.cacheDir, 'prevInfos.json');
        VideoManager.thumbnailDir = path.join(VideoManager.cacheDir, 'thumbnails');
        await VideoManager.scan();
        fs.watch(VideoManager.videosDir, {
            persistent: false
        }, (eventName) => {
            if (eventName === 'rename') {
                //change event is fired whenever a file's contents is changed
                //so copying a file into the directory triggers change hundreds of times
                VideoManager.rescan();
            }
        });
        setInterval(VideoManager.rescan, RESCAN_INTERVAL);
    }

    static async rescan() {
        if (!VideoManager.scanning) {
            VideoManager.scanning = true;
            await VideoManager.scan();
            VideoManager.scanning = false;
        }
    }

    static async scan() {
        console.log('scan');
        const videos = await readdirPromise(VideoManager.videosDir);
        let prevInfos = VideoManager.dbInfos;
        if (!prevInfos) {
            try {
                prevInfos = JSON.parse(await readFilePromise(VideoManager.prevInfosFile));
            } catch (e) {
                if (e.code === 'ENOENT') {
                    //cache doesn't exist yet
                    prevInfos = {};
                } else {
                    throw e;
                }
            }
        }
        VideoManager.db = {};
        let prevThumbnails = VideoManager.thumbnails;
        if (!prevThumbnails) {
            prevThumbnails = {};
            try {
                const fileList = await readdirPromise(VideoManager.thumbnailDir);
                fileList.forEach(file => {
                    prevThumbnails[file] = true;
                });
            } catch (e) {
                if (e.code === 'ENOENT') {
                    //cache dir doesn't exist yet
                    await mkdirPromise(VideoManager.thumbnailDir);
                } else {
                    throw e;
                }
            }
        }
        VideoManager.thumbnails = {};
        for (let relPath of videos) {
            const fileName = path.join(VideoManager.videosDir, relPath);

            const cacheKey = VideoManager.hash(relPath);
            let info = prevInfos[cacheKey];
            if (!info) {
                try {
                    info = await VideoManager.probe(fileName);
                } catch (e) {
                    console.error('ffprobe error', e);
                    info = {
                        format: {
                            ffprobeError: true
                        }
                    };
                }
            }
            let thumbnailFileName;
            if (info.format.duration) {
                thumbnailFileName = cacheKey + '.' + THUMBNAIL_FILE_FORMAT;
                if (prevThumbnails[thumbnailFileName]) {
                    delete prevThumbnails[thumbnailFileName];
                } else {
                    await VideoManager.generateThumbnail(fileName, thumbnailFileName, info);
                }
                VideoManager.thumbnails[thumbnailFileName] = true;
            } else {
                console.warn('not a video file:', relPath);
            }
            VideoManager.db[cacheKey] = {info, thumbnailFileName, relPath};
        }

        for (let oldThumbnail of Object.keys(prevThumbnails)) {
            //thumbnails for videos that no longer exist
            console.log('unlink', oldThumbnail);
            await unlinkPromise(path.join(VideoManager.thumbnailDir, oldThumbnail));
        }

        await VideoManager.cacheInfos();
        VideoManager.preprocessDb();
    }

    static async cacheInfos() {
        //only save ffprobe info, not other data
        VideoManager.dbInfos = {};
        Object.entries(VideoManager.db).forEach(entry => {
            const [cacheKey, data] = entry;
            VideoManager.dbInfos[cacheKey] = data.info;
        });
        await writeFilePromise(VideoManager.prevInfosFile, JSON.stringify(VideoManager.dbInfos));
    }

    static preprocessDb() {
        VideoManager.dbJson = JSON.stringify(VideoManager.db);
        VideoManager.dbEtag = VideoManager.hash(VideoManager.dbJson);
    }

    static hapiHandler(request, h) {
        h.entity({
            etag: VideoManager.dbEtag
        });
        return VideoManager.dbJson;
    }

}

module.exports = VideoManager;