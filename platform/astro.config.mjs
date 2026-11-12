import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const envFile=fileURLToPath(new URL('./.env',import.meta.url));
if(existsSync(envFile))process.loadEnvFile(envFile);
const site=new URL(process.env.PLATFORM_URL||'http://127.0.0.1:4400');
export default defineConfig({
  output: 'server', adapter: node({ mode: 'standalone' }),
  site: site.href,
  security: { allowedDomains: [{hostname:'127.0.0.1',protocol:'http'},{hostname:'localhost',protocol:'http'},...(!['localhost','127.0.0.1'].includes(site.hostname)?[{hostname:site.hostname,protocol:site.protocol.slice(0,-1),...(site.port?{port:site.port}:{})}]:[])] },
  trailingSlash: 'always', devToolbar: { enabled: false },
});
