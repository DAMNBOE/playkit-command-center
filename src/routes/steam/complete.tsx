import { createFileRoute,Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
const messages:Record<string,string>={connected:'Steam identity verified and connected.',cancelled:'Steam login was cancelled.',expired:'Steam login expired or was already used. Start again from Settings.',invalid:'Steam could not verify this login. Start again from Settings.','already-linked':'This Steam account is connected to another AfScripts account.',failed:'Steam connection could not be completed. Please try again.'};
export const Route=createFileRoute('/steam/complete')({
 validateSearch:(s:Record<string,unknown>)=>({status:typeof s['status']==='string' && s['status'] in messages ? s['status'] : 'failed'}),
 head:()=>({meta:[{title:'Steam Connection — AfScripts'},{name:'description',content:'Return to AfScripts after connecting your Steam identity.'},{property:'og:title',content:'Steam Connection — AfScripts'},{property:'og:description',content:'Securely connect your Steam profile with AfScripts.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:Complete,
});
function Complete(){const {status}=Route.useSearch();return <div className="mx-auto max-w-md space-y-4 py-8"><h2 className="text-xl font-semibold">Steam connection</h2><p className="text-sm text-muted-foreground">{messages[status]}</p><Button asChild><Link to="/settings">Return to Settings</Link></Button></div>;}
