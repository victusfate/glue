var fs              = require('fs');
var exec            = require('child_process').exec;
var spawn           = require('child_process').spawn;
var async           = require('async');

var regex           = /^#EXTINF:([0-9\.]+)/;
var regexVariable   = /^#EXT-X-STREAM-INF:.*BANDWIDTH=([0-9\.]+)/; 


var getFile = function(elem,cb) {

    var streamRemote = elem.remote.match(/http/g);

    if (streamRemote) {
        exec('curl -L ' + elem.remote + ' -o ' + elem.local, function(err, oStdOut, oStdErr) {
            if (err) {
                console.log(err);
                cb(err);
            }
            else {
                console.log('got ' + elem.local);
                cb(null)
            }
        });
    }
    else {
        console.log('local file. no need to get it, ' + elem.local);
        cb(null)        
    } 
}

var getLocal = function(streamName, cb) {

    if (streamName.match(/http/g)) { // remote

        var urlArray = streamName.split('/');
        var t;
        t = '' + urlArray.splice(urlArray.length - 1, 1);
       
        t = t.replace('?raw=true',''); // github cruft removed

        console.log('getLocal streamName',streamName,'t',t);

        if (fs.exists(t)) {
            var err = "can't get overwrite local file" + t;
            console.log(err);
            cb(err);
            // fs.unlinkSync(t);
        }
        
        console.log('calling getLocal remote',streamName, 'local', t);

        getFile({remote: streamName, local: t}, function(err) {
            if (err) {
                console.log(err); 
                throw err; 
            }
            else {
                cb(null,t,urlArray.join('/') + '/');
            }
        }.bind(this));
    }
    else { // local
        cb(null,streamName,null);
    }
}


var getStreamFile = function(streamName,cb) {
    getLocal(streamName, function(err, name, urlPath) {
        var streamRemote = (urlPath !== undefined && urlPath !== null);

        if (err) {
            console.log(err); 
            throw err; 
        }
        else {
            var farr = fs.readFileSync(name).toString().split('\n');
            var hiUrl, hiStream;

            for(var ikey in farr) {
                var i = parseInt(ikey,10);
                var largs = farr[i].match(regexVariable);

                if (largs) {
                    tsLine = true;
                    console.log('identified variable bitrate container stream',streamName,'next line',farr[i+1]);
                    var newRate = parseInt(largs[1],10);
                    if (hiStream !== undefined && hiStream !== null) {
                        if (newRate > hiStream) {
                            hiStream = newRate;
                            hiUrl = farr[i+1];
                        }
                    }
                    else {
                        hiStream = newRate;
                        hiUrl = farr[i+1];
                    }
                }
            }
            console.log('hiUrl',hiUrl,'streamRemote?',streamRemote,'hiStream',hiStream);

            if (hiUrl !== undefined && hiUrl !== null) {
                var remoteCheck = hiUrl.match(/http/g);
                console.log("!remoteCheck?",!remoteCheck);
                if (streamRemote && !remoteCheck) { // streamRemote but hibitrate url is local
                    // remove any leading path ./ ../../stuff/, no guarantee this will work
                    var s = hiUrl.split('/');
                    var hiUrl = s[s.length-1];
                    if (urlPath !== undefined) {
                        hiUrl = urlPath + hiUrl; // preappend urlPath to hiUrl
                    }
                    else {
                        console.log("streamRemote true, bitrate local ref, but no urlPath, streamName:",streamName);
                        throw err;
                    }
                }

                // variable bit rate file use master files name
                var sName = streamName;
                var sNameArray = streamName.split('/');
                if (streamRemote) sName = '' + sNameArray.splice(sNameArray.length - 1, 1);

                if (remoteCheck) {

                    getLocal(hiUrl, function(err, name, urlPath) {
                        console.log('got bitrate file',name);
                        if (err) {
                            console.log(err); 
                            throw err; 
                        }                    
                        else {
                            console.log('found variable stream file, hiUrl',hiUrl,'local name',name);
                            cb(null,name,sName.split('.')[0] + '_' + hiStream);                                  
                        }
                    }.bind(this));
                }
                else {
                    console.log('found local hi bitrate file',hiUrl);
                    cb(null,hiUrl,sName.split('.')[0] + '_' + hiStream);                                  
                }

            }
            else { // regular stream file
                cb(null,streamName);
            }
            
        }

    }.bind(this));  
}


var launchGlue = function(localName, oname) {

    console.log('calling launchGlue with local file Name',localName,'outputname',oname);

    var outName = localName;
    if (oname !== undefined && oname != null) outName = oname;


    var array = fs.readFileSync(localName).toString().split('\n');
    var ffmpegArg = '';

    var tsLine = false;
    var list =  [];

    for(var i in array) {

        if (tsLine) {
            var stuff = array[i].split('/');
            var base = stuff[stuff.length - 1].replace('?raw=true',''); // replace is for github binary urls
            if (ffmpegArg.length) ffmpegArg += '|' + base;
            else ffmpegArg = '"concat:' + base;
            list.push({ remote: array[i], local: base});
        }

        var result = array[i].match(regex);
        if (result && i < array.length) {
            tsLine = true;
        }
        else {
            tsLine = false;
        }
    }

    ffmpegArg += '"';
    console.log(ffmpegArg);
    
    async.forEach(list, getFile, function(err) { 
        if (err) {
            console.log(err); 
            throw err; 
        }
        else {
            var commandLine = 'ffmpeg -i ' + ffmpegArg + ' -sameq -vcodec copy -acodec copy -absf aac_adtstoasc -threads 0 -y ' + outName.split('.')[0] + '.mp4';
            console.log(commandLine)
            exec(commandLine, { maxBuffer: 50000 * 1024 }, function(err, oStdOut, oStdErr) {
                if (err) {
                    console.log(err);
                    throw err;
                }
                console.log('ffmpeg process exited ' + oStdOut);
            });
        }

    });
}

module.exports = {
    getFile: getFile,
    getLocal: getLocal,
    getStreamFile: getStreamFile,
    launchGlue: launchGlue
}
