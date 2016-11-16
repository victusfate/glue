'use strict';
const FFMpeg = require('ffmpeg-progress-wrapper');

const spawn = require('child_process').spawn;

var glue = (inPath, outName, fProgressIn) => {
  const sAction = 'glue';
  const fProgress = typeof fProgressIn === 'function' ? fProgressIn : (() => {});
  return new Promise( (resolve,reject) => {
    const sArgs = '-i ' + inPath + ' -c copy -strict -2 -absf aac_adtstoasc -threads 0 -y ' + outName;
    console.log({ action: sAction, args: 'ffmpeg '+sArgs});
    const ffmpeg = new FFMpeg(sArgs);

    ffmpeg.on('progress', (progress) => {
      console.log({ action: sAction + '.progress', progress: progress });
      fProgress(progress.progress,1);
    });

    ffmpeg.once('end', (code) => {
      console.log(`${sAction} child process exited with code ${code}`);
      resolve(outName);
    });

    // if ffmpeg-progress-wrapper ever fails, this works without progress
    // const args = '-i ' + inPath + ' -c copy -strict -2 -absf aac_adtstoasc -threads 0 -y ' + outName;
    // const ffmpeg = spawn('ffmpeg', args.split(' '));
    
    // ffmpeg.stdout.on('data', (data) => {
    //   console.log(`stdout: ${data}`);
    // });

    // ffmpeg.stderr.on('data', (data) => {
    //   console.log(`stderr: ${data}`);
    // });

    // ffmpeg.on('close', (code) => {
    //   console.log(`child process exited with code ${code}`);
    //   resolve(outName);
    // });    
  });
}

module.exports = {
  glue: glue
}
