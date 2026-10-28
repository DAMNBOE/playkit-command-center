import { describe,it,expect } from 'vitest';
import { mergeDetectedGames } from '@/lib/desktop-state';
import { parsePresetFile } from '@/lib/preset-files';
import type { Game } from '@/lib/types';
const game: Game={id:'old',appId:730,name:'Old sample',installed:true,configStatus:'none',lastModified:'',installPath:'C:/sample',sizeGb:999,genre:'',hue:0,favorite:false,developer:''};
describe('verified device state',() => {
 it('never treats saved or sample installed flags as detection',() => { const g=mergeDetectedGames([game],[])[0]; expect(g?.installed).toBe(false); expect(g?.verified).toBe(false); expect(g?.sizeGb).toBe(0); });
 it('uses measured disk size and Steam manifest identity',() => { const g=mergeDetectedGames([game],[{appId:730,name:'Counter-Strike 2',installPath:'C:/Steam/common/CS2',sizeBytes:1073741824}])[0]; expect(g?.sizeGb).toBe(1); expect(g?.verified).toBe(true); expect(g?.name).toBe('Counter-Strike 2'); });
 it('deduplicates matching App IDs',() => { const found={appId:730,name:'CS2',installPath:'C:/Steam',sizeBytes:1}; expect(mergeDetectedGames([], [found,found])).toHaveLength(1); });
});
const preset={app:'AfScripts',version:1,appId:730,name:'My setup',description:'',files:[{name:'autoexec.cfg',content:'fps_max 144'}]};
describe('preset files',() => {
 it('retains real file contents across import/export',() => { expect(parsePresetFile(JSON.stringify(preset)).files[0]?.content).toBe('fps_max 144'); });
 it('rejects binary preset targets',() => { expect(() => parsePresetFile(JSON.stringify({...preset,files:[{name:'unlock.exe',content:'bad'}]}))).toThrow(); });
 it('rejects imported path traversal',() => { expect(() => parsePresetFile(JSON.stringify({...preset,files:[{name:'../autoexec.cfg',content:'bad'}]}))).toThrow(); });
 it('rejects metadata-only presets',() => { expect(() => parsePresetFile(JSON.stringify({...preset,files:[]}))).toThrow(); });
});
