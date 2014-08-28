var argv = require('minimist')(process.argv.slice(2), {
    alias: {
      t: 'type',
      w: 'width',
      h: 'height',
      d: 'dpi',
      q: 'quality',
      f: 'file',
      l: 'list'
    }
  }),
  types = require('./types.json'),
  gm = require('gm');

var tasks = {
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
  }
};

var params = tasks.readParams(argv);
tasks.getSize(params.file, function(err, res) {
  console.log(err, res);
  tasks.resizeAndCenter(params.file, params.file + '_resized.jpg', tasks.getCrop(res, params), params, params.quality, function(e) {
    console.log('e', e);
  });
});
