"use strict";

const spawn = require('child_process').spawn;

var glue = (inPath, outName) => {
  return new Promise( (resolve,reject) => {
    const args = '-i ' + inPath + ' -c copy -strict -2 -absf aac_adtstoasc -threads 0 -y ' + outName;
    const ffmpeg = spawn('ffmpeg', args.split(' '));
    
    ffmpeg.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(outName);
    });    
  });
}

module.exports = {
  glue: glue
}
