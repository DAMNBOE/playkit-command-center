import { useEffect,useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ExternalLink,Link2,Loader2,RefreshCw,LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSteamAccount,disconnectSteamAccount,refreshSteamAccount } from '@/lib/steam-account.functions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { isDesktopRuntime } from '@/services';
type Account=Awaited<ReturnType<typeof getSteamAccount>>;
export function SteamAccount(){
 const get=useServerFn(getSteamAccount),disconnect=useServerFn(disconnectSteamAccount),refresh=useServerFn(refreshSteamAccount);
 const [account,setAccount]=useState<Account>(null),[signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const load=async()=>{
  setError('');setBusy(true);
  try {const {data,error:authError}=await supabase.auth.getUser();if(authError || !data.user){setSignedIn(false);setAccount(null);return;}setSignedIn(true);setAccount(await get());}
  catch(e){setError(e instanceof Error ? e.message : 'Could not load Steam account');}
  finally{setBusy(false);}
 };
 useEffect(()=>{void load();const handler=()=>{void load();};window.addEventListener('focus',handler);const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN' || event==='SIGNED_OUT') setTimeout(handler,0);});return()=>{window.removeEventListener('focus',handler);data.subscription.unsubscribe();};},[get]);
 const connect=()=>{
  if(isDesktopRuntime()){setError('Connect Steam from the AfScripts website. Steam sign-in is not available inside this Windows installer.');return;}
  const popup=window.open(`${window.location.origin}/steam/connect`,'afscripts-steam-login','width=760,height=820');
  if(!popup) setError('The login window was blocked. Allow popups for AfScripts and try again.');
 };
 const logout=async()=>{if(!window.confirm('Disconnect this Steam account from AfScripts? This does not sign you out of Steam itself.'))return;setBusy(true);try{await disconnect();setAccount(null);toast.success('Steam disconnected');}catch(e){setError(String(e));}finally{setBusy(false);}};
 const update=async()=>{setBusy(true);try{const result=await refresh();await load();if(!result.available)setError('Steam identity remains connected, but public profile details are unavailable.');}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <div className="space-y-3 px-4 py-3.5 sm:px-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-medium">Steam account</p>{busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>
  {account ? <>
   <div className="flex items-center gap-3">{account.avatar_url && <img src={account.avatar_url} alt="Steam avatar" className="size-12 rounded-md" referrerPolicy="no-referrer" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{account.username || 'Profile name unavailable'}</p><p className="break-all font-mono text-xs text-muted-foreground">SteamID {account.steam_id}</p></div></div>
   {account.profile_status!=='available' && <p className="text-xs text-muted-foreground">Your Steam identity is verified. Public name and avatar are currently unavailable.</p>}
   <a href={account.profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 break-all text-xs text-primary">{account.profile_url}<ExternalLink className="size-3 shrink-0" /></a>
   <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={update}><RefreshCw className="size-3.5" />Refresh profile</Button><Button size="sm" variant="ghost" disabled={busy} onClick={logout}><LogOut className="size-3.5" />Disconnect Steam</Button></div>
  </> : <Button size="sm" variant="secondary" disabled={busy || !signedIn || isDesktopRuntime()} onClick={connect}><Link2 className="size-3.5" />Connect Steam</Button>}
  {!signedIn && !busy && <p className="text-xs text-muted-foreground">Sign in to AfScripts first to link Steam to your account.</p>}
  {isDesktopRuntime() && <p className="text-xs text-muted-foreground">Steam account linking is available on the AfScripts website.</p>}
  {error && <div role="alert" className="text-xs text-destructive">{error}<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void load()}>Retry</Button></div>}
 </div>;
}
