import { createFileRoute,Link } from '@tanstack/react-router';
import { useEffect,useState,useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { beginSteamLink } from '@/lib/steam-account.functions';
import { Button } from '@/components/ui/button';
import { isDesktopRuntime } from '@/services';
export const Route=createFileRoute('/steam/connect')({head:()=>({meta:[{title:'Connect Steam — AfScripts'},{name:'description',content:'Securely link your Steam identity to your AfScripts account.'},{property:'og:title',content:'Connect Steam — AfScripts'},{property:'og:description',content:'Sign in on Steam to verify your identity. No Steam API key is required.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Connect});
function Connect(){
 const start=useServerFn(beginSteamLink),started=useRef(false);
 const [error,setError]=useState(''),[needsSignIn,setNeedsSignIn]=useState(false);
 const begin=async()=>{setError('');try{if(isDesktopRuntime())throw new Error('Use the AfScripts website to connect Steam.');const {data}=await supabase.auth.getUser();if(!data.user){setNeedsSignIn(true);return;}const result=await start();window.location.assign(result.url);}catch(e){setError(e instanceof Error ? e.message : 'Could not start Steam sign-in');}};
 useEffect(()=>{if(started.current)return;started.current=true;void begin();},[start]);
 return <div className="mx-auto max-w-md space-y-4 py-8"><h2 className="text-xl font-semibold">Connect Steam</h2>{needsSignIn ? <><p className="text-sm text-muted-foreground">Sign in to AfScripts before connecting your Steam account.</p><Button asChild><Link to="/auth">Sign in to AfScripts</Link></Button></> : error ? <><p role="alert" className="text-sm text-destructive">{error}</p><Button onClick={()=>void begin()}>Retry Steam login</Button></> : <p className="text-sm text-muted-foreground">Opening Steam sign-in…</p>}</div>;
}
