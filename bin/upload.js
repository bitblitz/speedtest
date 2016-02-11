/* upload to the upload end point and measure speed */

var http = require('http'),
    fs = require('fs');

// arguments: IP, size(MB), count, repeat
// node ./upload.js 10.6.1.203 2
process.argv.shift(); // skip node
process.argv.shift(); // skip script name

var opts = {
    ip: process.argv.shift(),
    size: process.argv.shift(),
    maxUploadIterations: process.argv.shift(),
    uploadIterations : 0,
    cycleLength: process.argv.shift(),
};
if (opts.size == 0 || isNaN(opts.size))
{
    opts.size = 1
}

if (opts.maxUploadIterations == 0 || isNaN(opts.maxUploadIterations))
{
    opts.maxUploadIterations = 3
}
if (opts.cycleLength == 0 || isNaN(opts.cycleLength))
{
    opts.cycleLength = 20
}

opts.size = opts.size * 1024 * 1024; // convert to MB

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function bufferOfSize(size)
{
    var b = new Buffer(size);

    for(var i = 0; i < b.length ; i++) {
        b[i] = randomInt(0,256);
    }
    return b;
}

function sendOne(iteration, size, whendone)
{
    var post_options = {
        host: opts.ip,
        path: '/upload?size=' + size,
        port: 8080,
        timeout: 120000,
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-length': size
        }
    }

    var b = bufferOfSize(size);
    var _startTime = Date.now();

    var sender = http.request(post_options, function(res) {
        if (res.statusCode < 399) {
            var text = ""
            res.on('data', function(chunk) {
                text += chunk
            })
            res.on('error', function(err) {
                    // handle the error safely
                    console.log("response error:" + err);
            });
            res.on('end', function(data) {
                var p = 100
                var addi = {
                  percent: p
                  ,i: size
                  ,size: size
                  ,startTime: _startTime
                  ,endTime: Date.now()
                  ,speed: {}
                };
                addi.runningTime = addi.endTime - addi.startTime;

                addi.speed.Bps = (addi.i/(addi.runningTime/1000));
                addi.speed.KBps = (addi.speed.Bps/1024).toFixed(2);
                addi.speed.MBps = (addi.speed.Bps/1024/1024).toFixed(2);

                addi.speed.bps = addi.speed.Bps*8;
                addi.speed.Kbps = (addi.speed.bps/1024).toFixed(2);
                addi.speed.Mbps = (addi.speed.bps/1024/1024).toFixed(2);
                addi.speed.bitrate = function () {
                  if(addi.speed.Bps < 1024) return addi.speed.Kbps + "bps";
                  if(addi.speed.Bps >= 1024 && addi.speed.Bps < 1048576) return addi.speed.Kbps + "Kbps";
                  if(addi.speed.Bps >= 1048576 && addi.speed.Bps < 1073741824) return addi.speed.Mbps + "Mbps";
                  return "too large."
                };
                addi.speed.byterate = function() { return addi.speed.bitrate().toUpperCase() };

                addi.friendlySize = function () {
                  if(addi.size < 1024) return addi.size + "b";
                  if(addi.size >= 1024 && addi.size < 1048576) return (addi.size/1024) + "KB";
                  if(addi.size >= 1048576 && addi.size < 1073741824) return (addi.size/1048576) + "MB";
                };

                console.log("T:" + iteration + " Size:" + (addi.size/1048576) + " TimeMs:" + addi.runningTime + " Rate:" + addi.speed.Mbps);
                //console.log(text);
                whendone();
            })
        } else {
            console.log("ERROR", res.statusCode)
            whendone()
        }
    })

    sender.on('error', function(err) {
            // handle the error safely
            console.log("send error:" + err);
            console.log("buffer len: " + b.length);
    });

    sender.write(b)
    sender.end()
    return sender;
}

var maxUploadIterations = 10;
function next(index, size) {
    // termination condition
    if (index >= opts.maxUploadIterations) {
        return;
    }

    // setup next callback
    var newsize = (1+((index+1) % opts.cycleLength)) * opts.size;
    var nextCallback = next.bind(null, index + 1, newsize);

    sendOne(index, size, nextCallback);
}

next(0, opts.size);
