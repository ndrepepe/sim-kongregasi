'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Archive, BookHeart, BookOpen, Building2, CalendarDays, ClipboardCheck, FileClock, FileText, HeartPulse, History, LayoutDashboard, Menu, Network, ScrollText, ShieldCheck, Users, WalletCards, X } from 'lucide-react';
import { api } from '@/lib/api';

type User={sub:string;name:string;email:string;role:string};
const groups=[
  {label:'Utama',items:[['/dashboard','Ringkasan',LayoutDashboard],['/dashboard/anggota','Data Anggota',Users],['/dashboard/organisasi','Struktur Organisasi',Network],['/dashboard/penugasan','Penugasan',ClipboardCheck]]},
  {label:'Pelayanan',items:[['/dashboard/kesehatan','Kesehatan',HeartPulse],['/dashboard/asuransi','Asuransi & Klaim',BookHeart],['/dashboard/formasi','Formasi & Pendidikan',BookOpen],['/dashboard/karya','Unit Karya',Building2]]},
  {label:'Administrasi',items:[['/dashboard/keuangan','Keuangan',WalletCards],['/dashboard/dokumen','Dokumen & Arsip',Archive],['/dashboard/workflow','Persetujuan',FileClock],['/dashboard/kalender','Kalender',CalendarDays]]},
  {label:'Memori & Sistem',items:[['/dashboard/kronik','Kronik',ScrollText],['/dashboard/memorial','Memorial',History],['/dashboard/laporan','Laporan',FileText],['/dashboard/audit','Audit & Keamanan',ShieldCheck]]}
] as const;

export function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();const router=useRouter();const[user,setUser]=useState<User|null>(null);const[open,setOpen]=useState(false);
  useEffect(()=>{api<User>('/auth/me').then(setUser).catch(()=>router.replace('/'))},[router]);
  async function logout(){await api('/auth/logout',{method:'POST'}).catch(()=>undefined);router.replace('/')}
  return <div className="shell"><aside className={`sidebar ${open?'open':''}`}><div className="brand-row"><div className="mark">✦</div><div><strong>SIM Kongregasi</strong><small>Ruang administrasi</small></div><button className="mobile-menu" aria-label="Tutup navigasi" style={{color:'white',marginLeft:'auto'}} onClick={()=>setOpen(false)}><X/></button></div>{groups.map(group=><div key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([href,label,Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className={`nav-item ${path===href?'active':''}`}><Icon size={17}/>{label}</Link>)}</div>)}</aside><main className="main"><header className="topbar"><button className="mobile-menu" aria-label="Buka navigasi" onClick={()=>setOpen(true)}><Menu/></button><span className="muted" style={{fontSize:'.8rem'}}>Sistem aktif lokal <Activity size={12} style={{color:'#39745a',verticalAlign:'middle'}}/></span><div className="user"><div className="avatar">{user?.name?.[0]??'…'}</div><div><strong style={{fontSize:'.82rem'}}>{user?.name??'Memuat…'}</strong><small className="muted" style={{display:'block',fontSize:'.68rem'}}>{user?.role?.replaceAll('_',' ')}</small></div><button className="btn secondary small" onClick={logout}>Keluar</button></div></header><div className="content">{children}</div></main></div>;
}
