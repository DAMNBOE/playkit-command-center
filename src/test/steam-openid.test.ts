import {describe,it,expect} from 'vitest';
import {validateSteamAssertion,validSteamVerification,steamLoginUrl,parseSteamProfile,STEAM_PROVIDER,OPENID_NS} from '@/lib/steam-openid';
const now=Date.parse('2026-10-28T17:00:00Z'),returnTo='https://afscripts.example/api/public/steam/callback?attempt=abc';
function assertion(){return new URLSearchParams({'openid.ns':OPENID_NS,'openid.mode':'id_res','openid.op_endpoint':STEAM_PROVIDER,'openid.claimed_id':'https://steamcommunity.com/openid/id/76561197960287930','openid.identity':'https://steamcommunity.com/openid/id/76561197960287930','openid.return_to':returnTo,'openid.signed':'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle','openid.sig':'signature','openid.assoc_handle':'handle','openid.response_nonce':'2026-10-28T16:59:30Zrandom'});}
describe('Steam OpenID identity validation',()=>{
 it('extracts SteamID only from a complete signed Steam assertion',()=>{expect(validateSteamAssertion(assertion(),returnTo,now).steamId).toBe('76561197960287930');});
 it('rejects an untrusted provider',()=>{const a=assertion();a.set('openid.op_endpoint','https://evil.example/openid');expect(()=>validateSteamAssertion(a,returnTo,now)).toThrow();});
 it('rejects callback substitution',()=>{expect(()=>validateSteamAssertion(assertion(),'https://evil.example',now)).toThrow();});
 it('rejects unsigned identity fields',()=>{const a=assertion();a.set('openid.signed','op_endpoint');expect(()=>validateSteamAssertion(a,returnTo,now)).toThrow();});
 it('rejects expired assertions',()=>{expect(()=>validateSteamAssertion(assertion(),returnTo,now+11*60_000)).toThrow();});
 it('rejects duplicate parameters',()=>{const a=assertion();a.append('openid.identity','https://evil.example');expect(()=>validateSteamAssertion(a,returnTo,now)).toThrow();});
 it('requires positive Steam server verification',()=>{expect(validSteamVerification(`ns:${OPENID_NS}\nis_valid:true\n`)).toBe(true);expect(validSteamVerification(`ns:${OPENID_NS}\nis_valid:false\n`)).toBe(false);});
 it('uses only Steam for login',()=>{const u=new URL(steamLoginUrl(returnTo));expect(u.origin).toBe('https://steamcommunity.com');expect(u.searchParams.get('openid.return_to')).toBe(returnTo);});
});
describe('public Steam profile parsing',()=>{
 const xml='<profile><steamID64>76561197960287930</steamID64><steamID><![CDATA[Real Steam Name]]></steamID><avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/avatar.jpg]]></avatarFull></profile>';
 it('reads CDATA name and Steam avatar without an API key',()=>{const p=parseSteamProfile(xml,'76561197960287930');expect(p.username).toBe('Real Steam Name');expect(p.avatarUrl).toBe('https://avatars.fastly.steamstatic.com/avatar.jpg');});
 it('rejects mismatching profile identities',()=>{expect(()=>parseSteamProfile(xml,'76561198000000000')).toThrow();});
 it('rejects XML entity declarations',()=>{expect(()=>parseSteamProfile('<!DOCTYPE x>'+xml,'76561197960287930')).toThrow();});
 it('does not render untrusted avatar hosts',()=>{expect(parseSteamProfile(xml.replace('avatars.fastly.steamstatic.com','evil.example'),'76561197960287930').avatarUrl).toBe(null);});
});
