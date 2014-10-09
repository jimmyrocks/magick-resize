var argv = require('minimist')(process.argv.slice(2), {
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
  magickResize = require('./index');

magickResize(argv, function(e, r) {
 console.log(e,r);
});
