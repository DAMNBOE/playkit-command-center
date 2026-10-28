import { describe,expect,it } from 'vitest';
import { tickDownloads } from '@/lib/downloads';
import { applyDownloadProgress,reconcileDownloads } from '@/lib/desktop-state';
import type { Download } from '@/lib/types';
const d: Download={id:'a',name:'user.cfg',url:'https://example.org/user.cfg',sizeMb:10,progress:0,speedMbps:0,status:'active',addedAt:''};
describe('actual downloads',() => {
 it('does not simulate progress or completion',() => { expect(tickDownloads([d],2,() => 1)[0]?.progress).toBe(0); expect(tickDownloads([d],2)[0]?.status).toBe('active'); });
 it('tracks actual bytes',() => { const out=applyDownloadProgress(d,{id:'a',received:512,total:1024,status:'active',path:''}); expect(out.progress).toBe(50); expect(out.receivedBytes).toBe(512); });
 it('only completes on a native completed event',() => { const out=applyDownloadProgress(d,{id:'a',received:1024,total:1024,status:'completed',path:'C:/Downloads/file'}); expect(out.status).toBe('completed'); expect(out.savedTo).toBe('C:/Downloads/file'); });
 it('reconciles interrupted transfers and discards simulated files',() => { expect(reconcileDownloads([d,{...d,id:'sample',url:undefined}])).toHaveLength(1); expect(reconcileDownloads([d])[0]?.status).toBe('failed'); });
 it('records native cancellation',() => { expect(applyDownloadProgress(d,{id:'a',received:0,total:0,status:'cancelled',path:''}).status).toBe('cancelled'); });
});
