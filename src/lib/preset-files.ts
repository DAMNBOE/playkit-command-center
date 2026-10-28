import { z } from 'zod';
const fileSchema = z.object({ name: z.string().min(1).max(255).refine(n => !/[\\/]/.test(n) && /\.(ini|cfg|json|xml|lua|txt|lsx|settings|yaml|yml|toml|vdf)$/i.test(n), 'Unsupported config filename'), content: z.string().refine(s => new TextEncoder().encode(s).length <= 4 * 1024 * 1024, 'File exceeds 4 MB') });
export const presetFileSchema = z.object({ app: z.literal('AfScripts'), version: z.literal(1), appId: z.number().int().positive(), name: z.string().min(3).max(48), description: z.string().max(200), files: z.array(fileSchema).min(1).max(100).refine(fs => new Set(fs.map(f => f.name.toLowerCase())).size === fs.length, 'Duplicate filenames') });
export type PresetSnapshot = z.infer<typeof fileSchema>;
export function parsePresetFile(text: string) { if (new TextEncoder().encode(text).length > 16 * 1024 * 1024) throw new Error('Preset exceeds 16 MB'); return presetFileSchema.parse(JSON.parse(text)); }
export function configFormat(name: string): 'ini'|'json'|'cfg'|'lua'|'xml' {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'json' ? 'json' : ext === 'lua' ? 'lua' : ext === 'xml' || ext === 'lsx' ? 'xml' : ext === 'ini' || ext === 'settings' ? 'ini' : 'cfg';
}
export function isSupportedConfig(name: string) { return /\.(ini|cfg|json|xml|lua|txt|lsx|settings|yaml|yml|toml|vdf)$/i.test(name); }
