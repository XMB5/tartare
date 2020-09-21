(async function() {
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        const minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        const secondsRounded = Math.round(seconds);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsRounded.toString().padStart(2, '0')}`;
    }

    function formatFrameRate(avgFrameRate) {
        let frameRateNum;
        const slashIndex = avgFrameRate.indexOf('/');
        if (slashIndex) {
            const numerator = parseFloat(avgFrameRate.substring(0, slashIndex));
            const denominator = parseFloat(avgFrameRate.substring(slashIndex + 1));
            frameRateNum = numerator / denominator;
        } else {
            frameRateNum = parseFloat(avgFrameRate);
        }
        let numberFormatted;
        if (Number.isInteger(frameRateNum)) {
            numberFormatted = frameRateNum.toString();
        } else {
            numberFormatted = frameRateNum.toFixed(3);
        }
        return numberFormatted + 'fps';
    }

    const FILE_SIZE_UNITS = [
        {letter: 'T', bytes: 1e12},
        {letter: 'G', bytes: 1e9},
        {letter: 'M', bytes: 1e6},
        {letter: 'K', bytes: 1e3}
    ];
    function formatFileSize(fileSize) {
        for (let unit of FILE_SIZE_UNITS) {
            if (fileSize >= unit.bytes) {
                const roundedNumber = (fileSize / unit.bytes).toPrecision(3);
                return roundedNumber + unit.letter + 'B';
            }
        }
        return fileSize + ' bytes';
    }

    function formatBitRate(bytesPerSec) {
        for (let unit of FILE_SIZE_UNITS) {
            const unitBits = unit.bytes / 8;
            if (bytesPerSec >= unitBits) {
                const roundedNumber = (bytesPerSec / unitBits).toPrecision(3);
                return roundedNumber + ' ' + unit.letter + 'bps';
            }
        }
        return bytesPerSec + 'bps';
    }

    const listPromise = await fetch('/api/list');
    const authPromise = await fetch('/api/auth');
    const [listRes, authRes] = await Promise.all([listPromise, authPromise]);
    const list = Object.values(await listRes.json()).filter(x => x.info.format.duration);
    const authJson = await authRes.json();
    const authStr = authJson.password ? `${authJson.username}:${authJson.password}@` : '';

    const container = $('.container');
    let row;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (i % 3 === 0) {
            //start new row
            if (row) {
                container.append(row);
            }
            row = $('<div class="row">');
        }
        const col = $(`
        <div class="col-md-4">
            <div class="card mb-4 shadow-sm">
                <img class="card-img-top">
                <div class="card-body pb-0">
                    <h5 class="card-title"></h5>
                    <hr>
                    <dl class="row" style="font-size: 0.8rem">
                    </dl>
                </div>
                <div class="card-footer">
                    <input type="text" class="form-control">
                </div>
            </div>
        </div>`);
        col.find('img').attr('src', '/thumb/' + item.thumbnailFileName);
        col.find('.card-title').text(item.relPath);
        let videoStream;
        let audioStream;
        for (let stream of item.info.streams) {
            if (stream.codec_type === 'video' && !videoStream) {
                videoStream = stream;
            } else if (stream.codec_type === 'audio' && !audioStream) {
                audioStream = stream;
            }
        }
        if (!videoStream || !audioStream) {
            console.warn("couldn't find streams for", item.relPath);
            continue;
        }
        const dl = col.find('dl');
        function addInfoRow(key, val) {
            const dt = $('<dt class="col-6">');
            dt.text(key);
            dl.append(dt);
            const dd = $('<dd class="col-6">');
            dd.text(val);
            dl.append(dd);
        }
        addInfoRow('File Size', formatFileSize(item.info.format.size));
        addInfoRow('Duration', formatDuration(item.info.format.duration));
        addInfoRow('Bit Rate', formatBitRate(item.info.format.size / item.info.format.duration));
        addInfoRow('Resolution', videoStream.width + 'x' + videoStream.height);
        addInfoRow('Frame Rate', formatFrameRate(videoStream.avg_frame_rate));
        addInfoRow('Video Codec', videoStream.codec_name);
        addInfoRow('Audio Codec', audioStream.codec_name);
        const videoUrl = window.location.protocol + '//' + authStr + window.location.host + '/videos/' + encodeURIComponent(item.relPath);
        col.find('input').val(videoUrl);
        row.append(col);
    }
    container.append(row);
})();