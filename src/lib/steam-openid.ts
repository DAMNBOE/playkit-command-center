import { XMLParser, XMLValidator } from 'fast-xml-parser';
export const STEAM_PROVIDER = 'https://steamcommunity.com/openid/login';
export const OPENID_NS = 'http://specs.openid.net/auth/2.0';
export const STEAM_COOKIE = 'afscripts-steam-link';
export function steamReturnUrl(origin: string, attemptId: string) { return `${origin}/api/public/steam/callback?attempt=${attemptId}`; }
export function steamLoginUrl(returnTo: string) {
 const url=new URL(STEAM_PROVIDER);
 const fields={'openid.ns':OPENID_NS,'openid.mode':'checkid_setup','openid.return_to':returnTo,'openid.realm':new URL(returnTo).origin+'/', 'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select','openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'};
 for(const [k,v] of Object.entries(fields)) url.searchParams.set(k,v);
 return url.toString();
}
export function validateSteamAssertion(params: URLSearchParams, returnTo: string, now=Date.now()) {
 for (const key of new Set(params.keys())) if (params.getAll(key).length!==1) throw new Error('Duplicate Steam callback parameter');
 if(params.get('openid.ns')!==OPENID_NS || params.get('openid.mode')!=='id_res' || params.get('openid.op_endpoint')!==STEAM_PROVIDER) throw new Error('Invalid Steam provider response');
 if(params.get('openid.return_to')!==returnTo) throw new Error('Steam callback address does not match this login');
 const claimed=params.get('openid.claimed_id') ?? '';
 const match=/^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/.exec(claimed);
 const steamId=match?.[1];
 if(!steamId || params.get('openid.identity')!==claimed) throw new Error('Invalid Steam identity');
 const signed=new Set((params.get('openid.signed') ?? '').split(','));
 for(const field of ['op_endpoint','claimed_id','identity','return_to','response_nonce','assoc_handle']) if(!signed.has(field)) throw new Error('Steam response is missing signed identity fields');
 if(!params.get('openid.sig') || !params.get('openid.assoc_handle')) throw new Error('Steam response has no signature');
 const nonce=params.get('openid.response_nonce') ?? '';
 const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.exec(nonce)?.[0];
 const issued=timestamp ? Date.parse(timestamp) : NaN;
 if(!Number.isFinite(issued) || issued>now+60_000 || now-issued>10*60_000 || nonce.length>255) throw new Error('Steam response expired');
 return {steamId,nonce};
}
export function validSteamVerification(text:string) {
 const fields=new Map(text.trim().split(/\r?\n/).map(line => {const i=line.indexOf(':');return [line.slice(0,i),line.slice(i+1)] as const;}));
 return fields.get('ns')===OPENID_NS && fields.get('is_valid')==='true';
}
export function parseSteamProfile(xml: string, steamId: string) {
 if(xml.length>1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('Steam profile response is invalid');
 const parsed=new XMLParser({parseTagValue:false,processEntities:false,trimValues:true}).parse(xml);
 const profile=parsed?.profile;
 if(!profile || String(profile.steamID64)!==steamId) throw new Error('Steam profile identity does not match');
 const username=typeof profile.steamID==='string' ? profile.steamID.slice(0,200) : null;
 let avatarUrl:string|null=null;
 if(typeof profile.avatarFull==='string') {
  const url=new URL(profile.avatarFull);
  if(url.protocol==='https:' && ['avatars.steamstatic.com','avatars.fastly.steamstatic.com','avatars.cloudflare.steamstatic.com','steamcdn-a.akamaihd.net'].includes(url.hostname)) avatarUrl=url.toString();
 }
 return {username,avatarUrl,profileUrl:`https://steamcommunity.com/profiles/${steamId}/`,profileStatus:username ? 'available' : 'unavailable'};
}
export async function hashSteamToken(token:string) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
