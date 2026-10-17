import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe,it,expect,vi } from 'vitest';
it('provisions bundled app/PDF scripts before first offline restart',async()=>{
 const handlers:Record<string,(event:{waitUntil:(task:Promise<unknown>)=>void})=>void>={};
 const shell='<script src="/assets/app.js"></script><link href="/assets/vendor.js" rel="modulepreload"><link href="/assets/app.css"><script src="https://example.com/tracker.js"></script>';
 const addAll=vi.fn().mockResolvedValue(undefined);
 const cache={addAll,match:vi.fn().mockResolvedValue({text:async()=>shell})};
 runInNewContext(readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8'),{URL,Set,Response,self:{location:{origin:'https://clinic.test'},addEventListener:(name:string,handler:typeof handlers[string])=>handlers[name]=handler,skipWaiting:vi.fn()},caches:{open:async()=>cache}});
 let done:Promise<unknown>=Promise.resolve();handlers.install({waitUntil:task=>{done=task;}});await done;
 expect(addAll).toHaveBeenCalledTimes(2);expect(addAll.mock.calls[1][0]).toEqual(['https://clinic.test/assets/app.js','https://clinic.test/assets/vendor.js','https://clinic.test/assets/app.css']);
});
describe('service worker data boundaries',()=>{
 it('never includes authenticated API URLs in the provision list',()=>{
  const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
  expect(source).toContain('if (isApiRequest(request)) return;');
 });
});
