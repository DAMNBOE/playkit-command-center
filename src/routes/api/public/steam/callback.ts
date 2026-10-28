import { createFileRoute } from '@tanstack/react-router';
import { STEAM_COOKIE,STEAM_PROVIDER,hashSteamToken,steamReturnUrl,validateSteamAssertion,validSteamVerification } from '@/lib/steam-openid';
export const Route=createFileRoute('/api/public/steam/callback')({server:{handlers:{GET:async ({request}) => {
 const url=new URL(request.url);
 const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 headers.set('Set-Cookie',`${STEAM_COOKIE}=; Path=/api/public/steam; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol==='https:' ? '; Secure' : ''}`);
 const finish=(status:string) => {headers.set('Location',`${url.origin}/steam/complete?status=${status}`);return new Response(null,{status:303,headers});};
 try {
  const attemptId=url.searchParams.get('attempt') ?? '';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) return finish('invalid');
  const token=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(`${STEAM_COOKIE}=`))?.slice(STEAM_COOKIE.length+1);
  if(!token || !/^[0-9a-f]{64}$/.test(token)) return finish('expired');
  const tokenHash=await hashSteamToken(token);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:attempt,error}=await supabaseAdmin.from('steam_link_attempts').select('id,origin,expires_at,consumed_at').eq('id',attemptId).eq('token_hash',tokenHash).maybeSingle();
  if(error || !attempt || attempt.origin!==url.origin || attempt.consumed_at || Date.parse(attempt.expires_at)<Date.now()) return finish('expired');
  if(url.searchParams.get('openid.mode')==='cancel') {await supabaseAdmin.from('steam_link_attempts').update({consumed_at:new Date().toISOString()}).eq('id',attemptId);return finish('cancelled');}
  const {steamId,nonce}=validateSteamAssertion(url.searchParams,steamReturnUrl(attempt.origin,attempt.id));
  const payload=new URLSearchParams();
  for(const [k,v] of url.searchParams) if(k.startsWith('openid.')) payload.set(k,v);
  payload.set('openid.mode','check_authentication');
  const verified=await fetch(STEAM_PROVIDER,{method:'POST',body:payload,signal:AbortSignal.timeout(15_000),redirect:'error'});
  if(!verified.ok || !validSteamVerification(await verified.text())) return finish('invalid');
  const {data:claim,error:claimError}=await supabaseAdmin.rpc('claim_steam_link_attempt',{attempt_id:attempt.id,expected_token_hash:tokenHash,response_nonce:nonce});
  const userId=claim?.[0]?.linked_user_id;
  if(claimError || !userId) return finish('expired');
  const {fetchSteamProfile}=await import('@/lib/steam-profile.server');
  const profile=await fetchSteamProfile(steamId);
  const {error:saveError}=await supabaseAdmin.from('steam_accounts').upsert({user_id:userId,steam_id:steamId,username:profile.username,avatar_url:profile.avatarUrl,profile_url:profile.profileUrl,profile_status:profile.profileStatus,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(saveError) return finish(saveError.code==='23505' ? 'already-linked' : 'failed');
  return finish('connected');
 } catch { return finish('failed'); }
}}}});
