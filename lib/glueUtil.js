var fs              = require('fs');
var exec            = require('child_process').exec;
var spawn           = require('child_process').spawn;
var async           = require('async');

var regex           = /^#EXTINF:([0-9\.]+)/;
var regexVariable   = /^#EXT-X-STREAM-INF:.*BANDWIDTH=([0-9\.]+)/; 
var regexAudio      = /^#EXT-X-MEDIA:.*URI="(.+)",.*TYPE=AUDIO.*/;
var regexAudioFile  = /^#EXT-X-BYTERANGE:.*/;


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

var handleAudioStream = function(audioStream,audioRemoteCheck,cb) {
    if (audioStream) {
        if (audioRemoteCheck) {
            getLocal(audioStream, function(err, audioName, audioUrlPath) {
                console.log('got audio file',audioName);
                if (err) {
                    console.log(err); 
                    throw err; 
                }                    
                else {
                    console.log('found audio stream file, audioStream',audioStream,'local name',audioName);
                    cb(audioName);
                }
            });
        }
        else {
            cb(audioStream);
        }
    }
    else {
        // no audio stream, explicit null
        cb(null);
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
            var hiUrl, hiStream, audioStream =  null;

            for(var ikey in farr) {
                var i = parseInt(ikey,10);
                var largs  = farr[i].match(regexVariable);

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

                // grab audio stream
                var laudio = farr[i].match(regexAudio);
                if (laudio) {
                    audioStream = laudio[1];
                }
            }
            console.log('hiUrl',hiUrl,'streamRemote?',streamRemote,'hiStream',hiStream,'audioStream',audioStream);

            if (hiUrl !== undefined && hiUrl !== null) {
                var remoteCheck = hiUrl.match(/http/g);
                var audioRemoteCheck = false;
                if (audioStream) audioRemoteCheck = audioStream.match(/http/g);

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
                            handleAudioStream(audioStream,audioRemoteCheck,function(localAudioName) {
                                console.log('localAudioName',localAudioName);
                                cb(null,name,localAudioName,sName.split('.')[0] + '_' + hiStream);                                                                  
                            });
                        }
                    }.bind(this));
                }
                else {
                    console.log('found local hi bitrate file',hiUrl);
                    handleAudioStream(audioStream,audioRemoteCheck,function(localAudioName) {
                        console.log('localAudioName',localAudioName);
                        cb(null,hiUrl,localAudioName,sName.split('.')[0] + '_' + hiStream);
                    });
                }

            }
            else { // regular stream file
                handleAudioStream(audioStream,audioRemoteCheck,function(localAudioName) {
                    console.log('localAudioName',localAudioName);
                    cb(null,streamName,localAudioName);
                });               
            }
            
        }

    }.bind(this));  
}


var launchGlue = function(localName, audioName, oname) {

    console.log('calling launchGlue with local file Name',localName,'audio file',audioName,'outputname',oname);

    var outName = localName;
    if (oname !== undefined && oname != null) outName = oname;

    // handle video
    var ffmpegArg = '';

    var array = fs.readFileSync(localName).toString().split('\n');
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

    // handle audio
    if (audioName !== null) {
        var audioArray = fs.readFileSync(audioName).toString().split('\n');
        var aLine = false;
        for(var i in audioArray) {

            if (aLine) {
                var stuff = audioArray[i].split('/');
                var base = stuff[stuff.length - 1].replace('?raw=true',''); // replace is for github binary urls
                ffmpegArg += ' -i ' + base + ' ';
                list.push({ remote: audioArray[i], local: base});
                break; // assume single audio file for simplicity at this point
            }

            var result = audioArray[i].match(regexAudioFile);
            if (result && i < audioArray.length) {
                aLine = true;
            }
            else {
                aLine = false;
            }
        }
    }


    console.log(ffmpegArg);
    
    async.forEach(list, getFile, function(err) { 
        if (err) {
            console.log(err); 
            throw err; 
        }
        else {
            var commandLine = 'ffmpeg -i ' + ffmpegArg + ' -qscale 0 -vcodec copy -acodec copy -absf aac_adtstoasc -threads 0 -y ' + outName.split('.')[0] + '.mp4';
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
