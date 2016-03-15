var g               = require('./lib/glue');

var arguments       = process.argv.splice(2);

if (arguments < 2) {
  console.log('usage: glue stream.m3u8 or glue http://domain/stream.m3u8');
  process.exit(1);
}

var inName          = arguments[0];
var outName         = arguments[1];

g.glue(inName, outName).then( (result) => {
  console.log({ action:'stream-glue.success',  outputFile:result });
  process.exit(0);
})
.catch( (err) => {
  console.log({ action:'stream-glue.error', err:err });
  process.exit(1);
});


