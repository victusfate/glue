var g               = require('./lib/glueUtil');

var arguments       = process.argv.splice(2);
var inName          = arguments[0];

if (arguments < 2) {
	console.log('usage: glue stream.m3u8 or glue http://domain/stream.m3u8');
	process.exit(1);
}

g.getStreamFile({ inName: inName, localPath: './' }, function(err, name, audioName, oname, urlPath) {
    console.log('getStreamFile callback called',name);
    if (err) {
        console.log(err); 
        throw err; 
    }
    else {
        g.launchGlue({ urlPath: urlPath, localPath: './', name: name, audioName: audioName, oname:oname }, function(err, outputFile) {
            if (err) {
                console.log(err);
                throw err;
            } 
            else {
                console.log('stream-glue success outputFile ' + outputFile);
            }
        });
    }
}.bind(this));

process.on('uncaughtException', function(err) {
    console.log(err);
});

