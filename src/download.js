var fs = require('fs'),
  request = require('request');

var download = module.exports = function download(url, dest, callback, silent, retries) {
  var mkdirp;

  if (dest) {
    // Make sure the dir exists
    mkdirp = require('mkdirp');
    mkdirp.sync(dest.split('/').slice(0, -1).join('/'));
  }
  var file = dest ? fs.createWriteStream(dest) : null,
    totalSize,
    cur = 0,
    req = request(url, function(error, resp, body) {
      if (error) throw error;
      if (file) {
        file.on('finish', function() {
          file.close(callback);
        });
      } else {
        callback(error, body);
      }
    });

  req.on('response', function(response) {
    console.log('File: ' + url + '\n');
    totalSize = Number(response.headers['content-length']);
  });

  req.on('data', function(chunk) {
    cur += chunk.length;
    if (!silent) {
      if (totalSize) {
        console.log('Downloading:' + (100.0 * cur / totalSize).toFixed(2) + '% ' + (cur / 1048576).toFixed(2) + ' mb' + '. Total size: ' + (totalSize / 1048576).toFixed(2) + ' mb\r');
      } else {
        console.log('Downloading ' + (cur / 1048576).toFixed(2) + ' mb\r');
      }
    }
  });

  req.on('end', function() {
    if (!silent) {
      console.log('Download complete (' + url + ')                                                 \n\r');
    }

  });

  req.on('error', function(e) {
    if (retries && typeof(retries) === 'number') {
      if (!silent)(console.log('Download failure, retrying #' + (retries - 1).toString()));
      download(url, dest, callback, silent, retries - 1);
    } else {
      callback(e);
      console.log('Error: ' + e.message);
    }
  });

  if (file) {
    req.pipe(file);
  }

};
