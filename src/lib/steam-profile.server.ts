import { parseSteamProfile } from './steam-openid';
export async function fetchSteamProfile(steamId:string) {
 const fallback={username:null,avatarUrl:null,profileUrl:`https://steamcommunity.com/profiles/${steamId}/`,profileStatus:'unavailable'};
 try {
  const response=await fetch(`${fallback.profileUrl}?xml=1`,{signal:AbortSignal.timeout(15_000),headers:{Accept:'application/xml'},redirect:'error'});
  if(!response.ok) return fallback;
  return parseSteamProfile(await response.text(),steamId);
 } catch { return fallback; }
}
