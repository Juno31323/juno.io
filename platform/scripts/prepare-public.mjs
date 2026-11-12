import {mkdir,copyFile,cp,readdir} from 'node:fs/promises';
await mkdir('platform/public/platform',{recursive:true});
await cp('public/fonts','platform/public/fonts',{recursive:true});
await copyFile('platform/favicon.svg','platform/public/favicon.svg');
await copyFile('public/platform/og.png','platform/public/platform/og.png');
async function verify(directory,prefix=''){for(const entry of await readdir(directory,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())await verify(`${directory}/${entry.name}`,path+'/');else if(path!=='favicon.svg'&&path!=='platform/og.png'&&!/^fonts\/[^/]+\.(woff2?|ttf|otf|txt|md)$/i.test(path))throw new Error(`Unexpected public asset: ${path}. Personal images belong in private Storage.`);}}
await verify('platform/public');
console.log('Prepared fonts, favicon and generic OG image. Personal images are not public assets.');
