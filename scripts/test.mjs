import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const f of readdirSync('tests').filter(f=>/^test-.*\.(mjs|cjs)$/.test(f)).sort()){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
