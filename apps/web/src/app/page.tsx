'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage(){
  const router=useRouter();const[email,setEmail]=useState('admin@simkongregasi.local');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  useEffect(()=>{api('/auth/me').then(()=>router.replace('/dashboard')).catch(()=>undefined)},[router]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const result=await api<{user:{mustChangePassword?:boolean}}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})},false);router.push(result.user.mustChangePassword?'/change-password':'/dashboard')}catch(err){setError(err instanceof Error?err.message:'Gagal masuk.')}finally{setBusy(false)}}
  return <main className="login-shell">
    <section className="login-brand"><div className="mark">✦</div><span className="eyebrow">Administrasi yang melayani perutusan</span><h1>SIM<br/>Kongregasi</h1><p>Satu ruang kerja yang tertib untuk anggota, komunitas, karya, kesehatan, keuangan, arsip, dan pelayanan kongregasi.</p></section>
    <section className="login-panel"><form className="login-card" onSubmit={submit}><span className="eyebrow">Akses aman</span><h2>Selamat datang</h2><p className="muted">Masuk menggunakan akun yang diberikan administrator.</p>{error&&<p className="error">{error}</p>}<div className="field"><label htmlFor="login-email">Email</label><input id="login-email" className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></div><div className="field"><label htmlFor="login-password">Kata sandi</label><input id="login-password" className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="current-password"/></div><button className="btn" style={{width:'100%',marginTop:'.5rem'}} disabled={busy}>{busy?'Memeriksa…':'Masuk ke sistem'}</button><p className="muted" style={{fontSize:'.75rem',textAlign:'center',marginTop:'1.5rem'}}>Data dikelola sesuai peran dan lingkup organisasi.</p></form></section>
  </main>;
}
