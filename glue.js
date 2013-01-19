var g               = require('./lib/glueUtil');

var arguments       = process.argv.splice(2);
var inName          = arguments[0];

g.getStreamFile(inName, function(err, name) {
    if (err) {
        console.log(err); 
        throw err; 
    }
    else {
        g.launchGlue(name);
    }
}.bind(this));

process.on('uncaughtException', function(err) {
    console.log(err);
});

