import { useEffect,useRef,useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getLastSync,syncPatientsWithCloud } from '../../services/storage';
import { OnlineAccessError,requireOnlineSession } from '../../services/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import Button from './Button';
function formatLastSync(iso:string|null){return iso?new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Not synced yet';}
export default function SyncBar(){
 const user=useAuthStore(s=>s.currentUser),signIn=useAuthStore(s=>s.signIn);
 const [online,setOnline]=useState(()=>navigator.onLine),[cloud,setCloud]=useState(false),[phase,setPhase]=useState<'idle'|'checking'|'signing'|'syncing'>('idle');
 const [showLogin,setShowLogin]=useState(false),[password,setPassword]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lastSync,setLastSync]=useState(getLastSync);
 const active=useRef(false),busy=phase!=='idle';
 useEffect(()=>{
  const connected=()=>setOnline(true),disconnected=()=>{setOnline(false);setCloud(false);};
  window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
  return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);};
 },[]);
 useEffect(()=>{
  let live=true;
  if(!online||!user)return;
  // Session refresh is allowed; patient synchronization always needs a click.
  void requireOnlineSession().then(()=>{if(live)setCloud(true);}).catch(()=>{if(live)setCloud(false);});
  return()=>{live=false;};
 },[online,user]);
 const sync=async()=>{
  setPhase('syncing');const result=await syncPatientsWithCloud();
  if(!result.success){
   if('needsSignIn'in result&&result.needsSignIn){setCloud(false);setShowLogin(true);setNotice('Please confirm your password to sync.');}
   else setError(result.error??'Sync did not finish. Your local work is saved. Please retry.');
   return;
  }
  usePatientStore.getState().loadFromStorage();setLastSync(getLastSync());setCloud(true);setNotice('Sync complete.');
 };
 const run=async(passwordEntry=false)=>{
  if(active.current||!user)return;active.current=true;setError('');setNotice('');
  try{
   if(!navigator.onLine)throw new OnlineAccessError('offline','You are offline. Keep working; sync when connected.');
   if(passwordEntry){
    setPhase('signing');const result=await signIn({username:user.username,password,role:'auto',mode:'online',expectedUserId:user.id});
    if(!result.success){setError(result.error);return;}
    if(result.offline){setError('Online sign-in could not finish. Local work remains available.');return;}
    setShowLogin(false);setCloud(true);
   }
   setPhase('checking');await requireOnlineSession();
   if(useAuthStore.getState().currentUser?.id!==user.id)return;
   await sync();
  }catch(e){
   if(e instanceof OnlineAccessError&&e.reason==='signin'){setCloud(false);setShowLogin(true);setNotice('Please confirm your password to sync.');}
   else setError(e instanceof Error?e.message:'Could not connect. Your local work is saved. Please retry.');
  }finally{active.current=false;setPassword('');setPhase('idle');}
 };
 return <section aria-label="Synchronization" className="border border-slate-200 rounded-lg bg-white px-4 py-3 mb-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex gap-2 items-center"><span aria-hidden="true" className={'w-2.5 h-2.5 rounded-full '+(cloud&&online?'bg-emerald-600':'bg-amber-500')}/><div>
    <p className="text-sm font-semibold text-slate-800">{busy?(phase==='signing'?'Signing in...':phase==='checking'?'Connecting...':'Syncing...'):!online?'Working offline':cloud?'Cloud connected':'Working on this device'}</p>
    <p className="text-xs text-slate-500">Last sync: {formatLastSync(lastSync)}</p>
   </div></div>
   {!showLogin&&<Button size="sm" variant="ghost" icon={<RefreshCw size={14}/>} label={busy?'Please wait...':'Sync now'} disabled={busy||!online} onClick={()=>void run()}/>}
  </div>
  {showLogin&&user&&<form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();if(password)void run(true);}}>
   <div><p className="text-xs text-slate-500 mb-1">{user.displayName} ({user.username})</p><input className="sr-only" readOnly tabIndex={-1} aria-label="Account username" name="username" autoComplete="username" value={user.username}/>
    <label className="block text-xs font-semibold" htmlFor="sync-password">Password<input id="sync-password" name="password" type="password" autoComplete="current-password" autoFocus required disabled={busy} value={password} onChange={e=>{setPassword(e.target.value);setError('');}} className="block border border-slate-300 rounded px-3 py-2 mt-1"/></label>
   </div>
   <Button type="submit" size="sm" label={busy?'Please wait...':'Sign in & sync'} disabled={busy||!password||!online}/>
   <button type="button" disabled={busy} className="text-sm text-slate-600 py-2" onClick={()=>{setShowLogin(false);setPassword('');setError('');setNotice('');}}>Keep working locally</button>
  </form>}
  {!online&&<p className="text-xs text-slate-600 mt-2">Your records stay on this device. Reconnecting will not start a sync or send SMS.</p>}
  {notice&&!error&&<p role="status" className="text-xs text-teal-800 mt-2">{notice}</p>}
  {error&&<p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
 </section>;
}
