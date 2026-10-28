import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getRequest,setCookie,setResponseHeader } from '@tanstack/react-start/server';
import { STEAM_COOKIE,hashSteamToken,steamReturnUrl,steamLoginUrl } from './steam-openid';
import { fetchSteamProfile } from './steam-profile.server';
export const getSteamAccount=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 setResponseHeader('Cache-Control','no-store');
 const {data,error}=await context.supabase.from('steam_accounts').select('steam_id,username,avatar_url,profile_url,profile_status,connected_at,updated_at').eq('user_id',context.userId).maybeSingle();
 if(error) throw new Error('Could not load your connected Steam account');
 return data;
});
export const beginSteamLink=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const origin=new URL(getRequest().url).origin;
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const random=crypto.getRandomValues(new Uint8Array(32));
 const token=Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
 const tokenHash=await hashSteamToken(token);
 const {data,error}=await supabaseAdmin.from('steam_link_attempts').insert({user_id:context.userId,origin,token_hash:tokenHash}).select('id').single();
 if(error || !data) throw new Error('Could not start Steam login. Try again.');
 setCookie(STEAM_COOKIE,token,{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',maxAge:600,path:'/api/public/steam'});
 setResponseHeader('Cache-Control','no-store');
 return {url:steamLoginUrl(steamReturnUrl(origin,data.id))};
});
export const disconnectSteamAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const {error}=await context.supabase.from('steam_accounts').delete().eq('user_id',context.userId);
 if(error) throw new Error('Could not disconnect your Steam account');
 // Invalidate outstanding attempts too, preventing a late callback from reconnecting.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 await supabaseAdmin.from('steam_link_attempts').update({consumed_at:new Date().toISOString()}).eq('user_id',context.userId).is('consumed_at',null);
 return {success:true};
});
export const refreshSteamAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const {data,error}=await context.supabase.from('steam_accounts').select('steam_id').eq('user_id',context.userId).maybeSingle();
 if(error || !data) throw new Error('No connected Steam account');
 const profile=await fetchSteamProfile(data.steam_id);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {error:saveError}=await supabaseAdmin.from('steam_accounts').update({username:profile.username,avatar_url:profile.avatarUrl,profile_status:profile.profileStatus,updated_at:new Date().toISOString()}).eq('user_id',context.userId).eq('steam_id',data.steam_id);
 if(saveError) throw new Error('Could not update Steam profile');
 return {available:profile.profileStatus==='available'};
});
