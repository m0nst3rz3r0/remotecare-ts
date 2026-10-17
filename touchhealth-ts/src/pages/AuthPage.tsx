import { useRef, useState } from 'react';
import { Eye,EyeOff,Lock,UserCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { loadCachedUsers } from '../services/storage';
export default function AuthPage(){
 const signIn=useAuthStore(s=>s.signIn),error=useAuthStore(s=>s.loginError),clearError=useAuthStore(s=>s.clearError),busy=useAuthStore(s=>s.isSigningIn);
 const [username,setUsername]=useState(()=>{const users=loadCachedUsers();return users.length===1?String(users[0].username ?? ''):'';}),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false);
 const active=useRef(false);
 return <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
  <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 w-full max-w-md" aria-labelledby="signin-title">
   <p className="font-bold text-teal-800 text-lg mb-6">RemoteCare</p><h1 id="signin-title" className="text-2xl font-bold text-slate-900">Sign in</h1>
   <p className="text-sm text-slate-600 mt-2 mb-6">Use your facility account. Your facility and device letter are remembered.</p>
   <form onSubmit={async event=>{event.preventDefault();if(active.current||busy||!username.trim()||!password)return;active.current=true;try{await signIn({username:username.trim(),password,role:'auto'});}finally{active.current=false;setPassword('');}}}>
    <label className="block text-sm font-semibold mb-2" htmlFor="username">Username</label>
    <div className="relative mb-4"><UserCircle2 className="absolute left-3 top-3 text-slate-400" size={18}/><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} className="border border-slate-300 rounded-lg py-3 pl-10 pr-3 w-full" value={username} onChange={event=>{setUsername(event.target.value);clearError();}}/></div>
    <label className="block text-sm font-semibold mb-2" htmlFor="password">Password</label>
    <div className="relative mb-4"><Lock className="absolute left-3 top-3 text-slate-400" size={18}/><input id="password" name="password" autoComplete="current-password" type={showPassword?'text':'password'} required disabled={busy} className="border border-slate-300 rounded-lg py-3 pl-10 pr-12 w-full" value={password} onChange={event=>{setPassword(event.target.value);clearError();}}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} className="absolute right-3 top-3 text-slate-500" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
    {error&&<p role="alert" className="text-sm text-red-700 mb-4">{error}</p>}
    <button type="submit" disabled={busy||!username.trim()||!password} className="w-full rounded-lg bg-teal-800 text-white font-bold py-3 disabled:opacity-50">{busy?'Signing in...':'Sign in'}</button>
   </form>
   <p className="text-xs text-slate-500 mt-5">Already set up this device? You can sign in and work offline. Internet is needed for first-time setup, synchronization and SMS.</p>
   <p className="text-xs text-slate-500 mt-3">Forgot your password? Contact your facility administrator.</p>
  </section>
 </main>;
}
