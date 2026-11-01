// Download for local use only: operator artwork is not covered by this project's MIT license.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
const source='https://www.free.fr/assets/freebox-showcase/freebox-ultra.png';
const target=process.argv[2]||'artifacts/private/freebox-ultra.png';
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`Operator image: HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Expected a PNG image');
// Trim transparent showcase margins, not the device itself.
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
let cropped;
try {
 const page=await browser.newPage();
 const result=await page.evaluate(async source=>{
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d');context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,top=canvas.height,right=0,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>20){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left||bottom<top)throw new Error('Empty operator image');
  left=Math.max(0,left-20);top=Math.max(0,top-20);right=Math.min(image.width,right+21);bottom=Math.min(image.height,bottom+21);
  canvas.width=right-left;canvas.height=bottom-top;context.drawImage(image,left,top,right-left,bottom-top,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
 },'data:image/png;base64,'+bytes.toString('base64'));
 cropped=Buffer.from(result,'base64');
}finally{await browser.close();}
await mkdir(dirname(target),{recursive:true});await writeFile(target,cropped);
console.log(JSON.stringify({target,source,bytes:cropped.length,width:cropped.readUInt32BE(16),height:cropped.readUInt32BE(20),redistribution:'not included in the release; local-use artwork'},null,2));
