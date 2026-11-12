import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
export function supabaseBinary(){const platform=process.platform==='win32'?'windows':process.platform;const path=resolve(`node_modules/@supabase/cli-${platform}-${process.arch}/bin/supabase${process.platform==='win32'?'.exe':''}`);if(!existsSync(path))throw new Error('Run npm ci to install the platform-specific Supabase CLI.');return path;}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(!args.includes('--workdir'))args.push('--workdir','platform');if(!args.includes('--agent'))args.push('--agent','no');if(args[0]==='start')args.push('-x','realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor');
 const hideKeys=args[0]==='start';
 const child=spawn(supabaseBinary(),args,{stdio:hideKeys?['inherit','pipe','pipe']:'inherit',env:{...process.env,SUPABASE_INTERNAL_IMAGE_REGISTRY:process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY||'ghcr.io'}});
 let output='';if(hideKeys){console.log('Starting the isolated local Supabase services…');child.stdout.on('data',chunk=>output=(output+chunk).slice(-2000000));child.stderr.on('data',chunk=>output=(output+chunk).slice(-2000000));}
 child.on('exit',code=>{if(hideKeys)console.log(output.split('\n').filter(line=>!/eyJ|sb_secret|sb_publishable|access key|secret key|service_role|anon key|jwt secret|".*KEY"/i.test(line)).join('\n'));process.exitCode=code??1;});
}
