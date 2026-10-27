import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync('dist/app.js','utf8'),body=src.slice(src.indexOf('function syncLiveMusic'),src.indexOf('giftAudio.ontimeupdate'));
let plays=0;const audio={paused:false,currentTime:4.2,play(){plays++;return Promise.resolve();}};
const c={giftAudio:audio,$:()=>({checked:true}),musicState(){}};vm.createContext(c);vm.runInContext(body,c);
c.syncLiveMusic('bloom');assert.equal(audio.currentTime,4.2);assert.equal(plays,0);
audio.paused=true;c.syncLiveMusic('still');assert.equal(plays,0);c.syncLiveMusic('rain');assert.equal(plays,1);assert.equal(audio.currentTime,0);
console.log('PASS existing piano phrase survives expression changes; neutral does not start music');
