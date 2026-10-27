import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.mp3':'audio/mpeg','.png':'image/png','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+name);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if((await stat(file)).isDirectory())file=path.join(file,'index.html');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':data.length});res.end(data);}catch{res.writeHead(404).end('Not found');}}).listen(8017,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8017 — local camera allowed; mobile requires HTTPS hosting.'));
