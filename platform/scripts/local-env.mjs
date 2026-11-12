import {execFileSync} from 'node:child_process';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {supabaseBinary} from './supabase.mjs';
const output=execFileSync(supabaseBinary(),['status','--workdir','platform','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const data=JSON.parse(output.slice(output.indexOf('{')));
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(data.API_URL))throw new Error('Refusing non-local Supabase project');
if(existsSync('platform/.env')){const current=readFileSync('platform/.env','utf8').match(/^SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];if(current&&!/^http:\/\/(127\.0\.0\.1|localhost):/.test(current))throw new Error('Refusing to overwrite a non-local platform/.env. Keep production configuration separately.');}
writeFileSync('platform/.env',`SUPABASE_URL=${data.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${data.ANON_KEY||data.PUBLISHABLE_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${data.SERVICE_ROLE_KEY||data.SECRET_KEY}\nLOCAL_DB_URL=${data.DB_URL}\nPLATFORM_URL=http://127.0.0.1:4400\nHOST=127.0.0.1\nPORT=4400\n`);
console.log('Wrote platform/.env with local-only keys. No credentials printed.');
