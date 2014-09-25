module.exports = function(args, mainCallback) {
  var argv = makeAlias(args, {
      alias: {
        t: 'type',
        w: 'width',
        h: 'height',
        d: 'dpi',
        q: 'quality',
        f: 'file',
        u: 'url',
        o: 'output'
      }
    }),
    types = require('./types.json'),
    gm = require('gm'),
    fs = require('fs'),
    exec = require('child_process').exec,
    download = require('./src/download.js'),
    params,
    id = Math.floor((Math.random() * 10000000000000) + 1),
    temp = {
      'resize': __dirname + '/tmp/resize_' + id + '.png',
      'mask': __dirname + '/tmp/mask_' + id + '.png',
      'download': __dirname + '/tmp/download_' + id + '.png'
    },
    tasks = {
      readParams: function(args) {
        var type = this.readTypes(['initial']);
        if (args.type || args._) {
          type = this.merge(type, this.readTypes([].concat(args.type || [], args._)));
        }
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
        var crop = {
          width: origSize.width < origSize.height ? origSize.width : origSize.height * (newSize.width / newSize.height),
          height: origSize.width > origSize.height ? origSize.height : origSize.width * (newSize.width / newSize.height),
        };
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
        var gmComposite = 'gm composite -compose in "' + source + '" "' + mask + '" "' + dest + '"';
        //console.log(gmComposite);
        exec(gmComposite, function(err) {
          if (err) throw err;
          callback();
        });
      },
      runParams: function() {
        tasks.getSize(params.file, function(err, res) {
          tasks.resizeAndCenter(params.file, temp.resize, tasks.getCrop(res, params), params, params.quality, function(e) {
            if (e) {
              //END with error
              mainCallback(1);
            } else {
              if (params.mask === 'circle') {
                var dim = [
                  (params.width / 2), (params.height / 2), (params.width < params.height ? params.width - 2 : (params.width / 2)), (params.width < params.height ? (params.height / 2) : params.height - 2)
                ];
                gm(params.width, params.height, '#000')
                  .fill('#fff')
                  .transparent('#000')
                  .drawCircle(dim[0], dim[1], dim[2], dim[3])
                  .write(
                    temp.mask, function() {
                      tasks.compositeMask(temp.resize, temp.mask, params.output, function() {
                        fs.unlink(temp.resize, function() {
                          fs.unlink(temp.mask, function() {
                            if (temp.downloaded) {
                              fs.unlink(temp.download, function() {
                                //END no error
                                mainCallback(0);
                              });
                            } else {
                              //END no error
                              mainCallback(0);
                            }
                          });
                        });
                      });
                    });
              } else {
                fs.renameSync(temp.resize, params.output);
                fs.unlink(temp.download, function() {
                  //END no error
                  mainCallback(0);
                });
              }
            }
          });
        });
      }
    };
  params = tasks.readParams(argv);
  if (params.url) {
    //Download
    params.file = temp.download;
    temp.downloaded = true;
    download(params.url, temp.download, function(a, b, c) {
      tasks.runParams();
    });
  } else {
    tasks.runParams();
  }
};
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
