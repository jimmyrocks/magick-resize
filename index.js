module.exports = function(args, mainCallback) {
  var makeAlias = function(input, params) {
    var output = {};
    var aliases = params.alias;
    for (var alias in aliases) {
      if (input[alias] || input[aliases[alias]]) {
        output[alias] = input[alias] || input[aliases[alias]];
        output[aliases[alias]] = input[alias] || input[aliases[alias]];
      }
    }
    return output;
  };
  var argv = makeAlias(args, {
      alias: {
        d: 'dpi',
        e: 'extension',
        f: 'file',
        h: 'height',
        o: 'output',
        m: 'mask',
        q: 'quality',
        t: 'type',
        u: 'url',
        w: 'width'
      }
    }),
    types = require('./types.json'),
    gm = require('gm'),
    fs = require('fs'),
    exec = require('child_process').exec,
    download = require('./src/download.js'),
    mkdirp = require('mkdirp'),
    moveAsync = require('./src/moveAsync'),
    params,
    temp,
    id = Math.floor((Math.random() * 10000000000000) + 1).toString(),
    tasks = {
      createMask: function(params, temp, mainCallback) {

        var compileMask = function() {
          tasks.compositeMask(temp.resize, temp.mask, params.output, function(err) {
            if (!err) {
              fs.unlink(temp.resize, function() {
                fs.unlink(temp.mask, function() {
                  if (temp.downloaded) {
                    fs.unlink(temp.download, function() {
                      //END no error
                      mainCallback(null, true);
                    });
                  } else {
                    //END no error
                    mainCallback(null, true);
                  }
                });
              });
            } else {
              //END with error
              mainCallback(err, false);
            }
          });
        };

        if (params.mask === 'circle') {
          // Draw a circle
          var dim = [
            (params.width / 2), (params.height / 2), (params.width < params.height ? params.width - 2 : (params.width / 2)), (params.width < params.height ? (params.height / 2) : params.height - 2)
          ];
          gm(params.width, params.height, '#000')
            .fill('#fff')
            .transparent('#000')
            .drawCircle(dim[0], dim[1], dim[2], dim[3])
            .write(
              temp.mask,
              compileMask
            );
        } else {
          // Assume a file mask
          download(params.mask, temp.mask, function() {
            compileMask();
          }, false, 2);
        }
      },
      readParams: function(args) {
        var type = this.readTypes(['initial']);
        if (args.type || args._) {
          type = this.merge(type, this.readTypes([].concat(args.type || [], args._)));
        }
        args.reqestWidth = args.reqestWidth || args.width;
        args.reqestWidth = args.reqestHeight || args.height;
        return this.merge(type, args);
      },
      readTypes: function(typeList) {
        for (var i = 0; i < typeList.length; i++) {
          if (types[typeList[i]]) {
            return types[typeList[i]];
          }
        }
        return false;
      },
      merge: function(mainObj, newObj) {
        var returnValue = {};
        for (var mainValue in mainObj) {
          returnValue[mainValue] = mainObj[mainValue];
        }
        for (var newValue in newObj) {
          returnValue[newValue] = newObj[newValue];
        }
        return returnValue;
      },
      getSize: function(path, callback) {
        gm(path)
          .size(callback);
      },
      getCrop: function(origSize, newSize) {
        var newRatio = newSize.width / newSize.height;
        var possibleWidths = [origSize.height * newRatio, origSize.width];
        var possibleHeights = [origSize.width * newRatio, origSize.height];
        var crop = {};
        if (possibleWidths[0] / possibleHeights[1] === newRatio) {
          crop.width = possibleWidths[0];
          crop.height = possibleHeights[1];
        } else {
          crop.width = possibleWidths[1];
          crop.height = possibleHeights[0];
        }
        crop.x = origSize.width < origSize.height ? 0 : (origSize.width - crop.width) / 2;
        crop.y = origSize.width > origSize.height ? 0 : (origSize.height - crop.height) / 2;

        return crop;

      },
      resizeAndCenter: function(inPath, outPath, crop, newSize, quality, callback) {
        gm(inPath)
          .crop(crop.width, crop.height, crop.x, crop.y)
          .resize(newSize.width, newSize.height)
          .quality(quality)
          .write(outPath, function(writeErr) {
            callback(writeErr);
          });
      },
      compositeMask: function(source, mask, dest, callback) {
        var gmComposite = 'gm composite -gravity north -compose in "' + source + '" "' + mask + '" "' + dest + '"';
        exec(gmComposite, callback);
      },
      runParams: function() {
        tasks.getSize(params.file, function(err, res) {
          if (err) {
            console.log('Error with the following params:');
            console.log(JSON.stringify(params, null, 2));
            //END with error
            mainCallback(err, null);
          } else {
            tasks.resizeAndCenter(params.file, temp.resize, tasks.getCrop(res, params), params, params.quality, function(e) {
              if (e) {
                //END with error
                mainCallback(e, null);
              } else {
                // Make the containing directory if it doesn't already exist
                mkdirp.sync(params.output.split('/').slice(0, -1).join('/'));
                if (params.mask) {
                  tasks.createMask(params, temp, mainCallback);
                } else {
                  moveAsync(temp.resize, params.output, function(renameError) {
                    if (renameError) {
                      mainCallback(renameError, false);
                    } else {
                      fs.unlink(temp.download, function() {
                        //END no error
                        mainCallback(null, true);
                      });
                    }
                  });
                }
              }
            });
          }
        });
      }
    };
  params = tasks.readParams(argv);
  temp = {
    'resize': __dirname + '/tmp/resize_' + id + params.extension,
    'mask': __dirname + '/tmp/mask_' + id + params.extension,
    'download': __dirname + '/tmp/download_' + id + params.extension
  };
  if (params.url) {
    //Download
    params.file = temp.download;
    temp.downloaded = true;
    console.log('Downloading:', params.url);
    download(params.url, temp.download, function() {
      tasks.runParams();
    }, false, 2);
  } else {
    tasks.runParams();
  }
};
