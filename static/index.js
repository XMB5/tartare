(async function() {
    function formatFileName(fileName) {
        //remove directory and extension from file name
        const slashIndex = fileName.lastIndexOf('/');
        const dotIndex = fileName.lastIndexOf('.');
        return fileName.substring(slashIndex + 1, dotIndex);
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        const minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        const secondsRounded = Math.round(seconds);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsRounded.toString().padStart(2, '0')}`;
    }

    const FILE_SIZE_UNITS = [
        {name: 'TB', bytes: 1e12},
        {name: 'GB', bytes: 1e9},
        {name: 'MB', bytes: 1e6},
        {name: 'KB', bytes: 1e3},
        {name: ' bytes', bytes: 1}
    ];
    function formatFileSize(fileSize) {
        for (let unit of FILE_SIZE_UNITS) {
            if (fileSize >= unit.bytes) {
                const roundedNumber = (fileSize / unit.bytes).toPrecision(3);
                return roundedNumber + unit.name;
            }
        }
        return '0 bytes';
    }

    const fetchRes = await fetch("/api/list.json");
    const list = Object.values(await fetchRes.json());
    const container = $('.container');
    let row;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item.info.format.duration) continue;
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
                <div class="card-body">
                    <h5 class="card-title"></h5>
                    <p class="card-text"></p>
                </div>
            </div>
        </div>`);
        col.find('img').attr('src', '/thumb/' + item.thumbnailFileName);
        col.find('h5').text(formatFileName(item.fileName));
        const info = col.find('p');
        info.append('Duration: ' + formatDuration(item.info.format.duration));
        info.append($('<br>'));
        info.append('Resolution: ' + item.width + 'x' + item.height);
        info.append($('<br>'));
        info.append('File Size: ' + formatFileSize(item.fileSize));
        row.append(col);
    }
    container.append(row);
})();