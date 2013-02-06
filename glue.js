var g               = require('./lib/glueUtil');

var arguments       = process.argv.splice(2);
var inName          = arguments[0];

if (arguments < 2) {
	console.log('usage: glue stream.m3u8 or glue http://domain/stream.m3u8');
	process.exit(1);
}

g.getStreamFile(inName, function(err, name, audioName, oname) {
    console.log('getStreamFile callback called');
    if (err) {
        console.log(err); 
        throw err; 
    }
    else {
        g.launchGlue(name,audioName,oname);
    }
}.bind(this));

process.on('uncaughtException', function(err) {
    console.log(err);
});

