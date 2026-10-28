import { uid, useStore } from './store';
import { getServices } from '@/services';
import { downloadFile } from '@/components/app/bits';
import type { ConfigFile } from './types';

export async function loadNativeConfig(path: string, gameId: string): Promise<ConfigFile> {
  const service = getServices();
  const content = await service.configs.read(path);
  if (content === null) throw new Error('Configuration file no longer exists');
  const { configFormat } = await import('./preset-files');
  const name = path.split(/[\\/]/).pop() ?? path;
  const history = await service.backups.list(path);
  return { id: uid(), gameId, name, path, native: true, format: configFormat(name), content, modifiedAt: new Date().toISOString(), backups: history.map(b => ({ id:b.backupPath, backupPath:b.backupPath, label:'Disk backup', createdAt:b.createdAt, content:b.content })) };
}
/** Native mutations return read-back disk state; imported text is explicitly app-managed. */
export function useConfigActions() {
  const { update, log, notify, fail, settings } = useStore();
  const refresh = async (c: ConfigFile) => {
    if (!c.native) return c;
    const actual = await loadNativeConfig(c.path,c.gameId);
    update('configs',cs => cs.map(x => x.id === c.id ? { ...actual, id:c.id } : x));
    return actual;
  };
  const backup = async (c: ConfigFile, label = 'Manual backup') => {
    try {
      if (c.native) { await getServices().backups.create(c.path,c.content); await refresh(c); }
      else update('configs',cs => cs.map(x => x.id === c.id ? { ...x,backups:[{id:uid(),label,createdAt:new Date().toISOString(),content:c.content},...x.backups].slice(0,settings.backupLimit) } : x));
      log('backup',`${c.native ? 'Disk backup' : 'Workspace snapshot'} created for ${c.name}`,c.gameId);
      notify(c.native ? 'Backup created' : 'Workspace snapshot saved',c.name);
      return true;
    } catch(e) { fail('Backup failed',String(e)); return false; }
  };
  const save = async (c: ConfigFile, content: string) => {
    try {
      if (c.format === 'json') JSON.parse(content);
      if (c.native) {
        await getServices().configs.write(c.path,content);
        await refresh(c);
      } else update('configs',cs => cs.map(x => x.id === c.id ? { ...x,content,modifiedAt:new Date().toISOString(),backups:[{id:uid(),label:'Workspace snapshot before save',createdAt:new Date().toISOString(),content:x.content},...x.backups].slice(0,settings.backupLimit) } : x));
      update('games',gs => gs.map(g => g.id === c.gameId ? { ...g,configStatus:'configured',lastModified:new Date().toISOString() } : g));
      log('config',`Edited ${c.name}`,c.gameId);
      notify(c.native ? 'Configuration saved to disk' : 'Workspace copy saved',c.native ? 'The previous disk version was backed up.' : 'The original file on your PC was not changed.');
      return true;
    } catch(e) { fail('Could not save configuration',String(e)); return false; }
  };
  const restore = async (c: ConfigFile, backupId: string) => {
    const b=c.backups.find(x => x.id === backupId);
    if (!b || !window.confirm(`Restore ${c.name}? This replaces ${c.native ? 'the file on disk' : 'the workspace copy'}. The current version will be preserved.`)) return false;
    try {
      if (c.native) {
        if (!b.backupPath) throw new Error('This snapshot has no native backup file. Export it instead.');
        const content=await getServices().backups.restore(b.backupPath);
        if (content === null) throw new Error('Backup file no longer exists');
        await refresh(c);
      } else update('configs',cs => cs.map(x => x.id === c.id ? { ...x,content:b.content,modifiedAt:new Date().toISOString(),backups:[{id:uid(),label:'Workspace snapshot before restore',createdAt:new Date().toISOString(),content:x.content},...x.backups].slice(0,settings.backupLimit) } : x));
      log('restore',`Restored ${c.name}`,c.gameId); notify('Backup restored',c.name); return true;
    } catch(e) { fail('Restore failed',String(e)); return false; }
  };
  const exportFile = (c: ConfigFile) => {
    try { downloadFile(c.name,c.content); log('export',`Exported ${c.name}`,c.gameId); notify('Configuration exported',c.name); }
    catch(e) { fail('Export failed',String(e)); }
  };
  return { backup,restore,save,refresh,exportFile };
}
