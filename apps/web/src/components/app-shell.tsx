'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Archive, BookHeart, BookOpen, Building2, CalendarDays, ClipboardCheck, FileClock, FileText, HeartPulse, History, LayoutDashboard, Menu, Network, ScrollText, ShieldCheck, UserCog, Users, WalletCards, X } from 'lucide-react';
import { api } from '@/lib/api';

type User={sub:string;name:string;email:string;role:string};
type NavItem={href:string;label:string;Icon:typeof Users;roles?:string[]};
const LEADERS=['SUPER_ADMIN','PIMPINAN','DEWAN'];
const MEMBER_ROLES=['SUPER_ADMIN','PIMPINAN','DEWAN','SUPERIOR_LOCAL','SEKRETARIS','BENDAHARA','MAGISTRA','KESEHATAN','ARSIPARIS','AUDITOR','SUSTER','UNIT_ADMIN','VIEWER'];
const groups:{label:string;items:NavItem[]}[]=[
  {label:'Utama',items:[
    {href:'/dashboard',label:'Ringkasan',Icon:LayoutDashboard},
    {href:'/dashboard/anggota',label:'Data Anggota',Icon:Users,roles:MEMBER_ROLES},
    {href:'/dashboard/organisasi',label:'Struktur Organisasi',Icon:Network,roles:MEMBER_ROLES},
    {href:'/dashboard/penugasan',label:'Penugasan',Icon:ClipboardCheck,roles:[...LEADERS,'SUPERIOR_LOCAL','SEKRETARIS','MAGISTRA','KESEHATAN','AUDITOR','SUSTER','UNIT_ADMIN','VIEWER']},
  ]},
  {label:'Pelayanan',items:[
    {href:'/dashboard/kesehatan',label:'Kesehatan',Icon:HeartPulse,roles:['SUPER_ADMIN','PIMPINAN','KESEHATAN']},
    {href:'/dashboard/asuransi',label:'Asuransi & Klaim',Icon:BookHeart,roles:['SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','UNIT_ADMIN']},
    {href:'/dashboard/formasi',label:'Formasi & Pendidikan',Icon:BookOpen,roles:['SUPER_ADMIN','PIMPINAN','MAGISTRA']},
    {href:'/dashboard/karya',label:'Unit Karya',Icon:Building2,roles:MEMBER_ROLES},
  ]},
  {label:'Administrasi',items:[
    {href:'/dashboard/keuangan',label:'Keuangan',Icon:WalletCards,roles:['SUPER_ADMIN','PIMPINAN','BENDAHARA','AUDITOR']},
    {href:'/dashboard/dokumen',label:'Dokumen & Arsip',Icon:Archive,roles:['SUPER_ADMIN','PIMPINAN','SEKRETARIS','ARSIPARIS']},
    {href:'/dashboard/workflow',label:'Persetujuan',Icon:FileClock,roles:[...LEADERS,'SUPERIOR_LOCAL','SEKRETARIS','BENDAHARA','MAGISTRA','UNIT_ADMIN']},
    {href:'/dashboard/kalender',label:'Kalender',Icon:CalendarDays,roles:MEMBER_ROLES},
  ]},
  {label:'Memori & Sistem',items:[
    {href:'/dashboard/kronik',label:'Kronik',Icon:ScrollText,roles:MEMBER_ROLES},
    {href:'/dashboard/memorial',label:'Memorial',Icon:History,roles:MEMBER_ROLES},
    {href:'/dashboard/laporan',label:'Laporan',Icon:FileText,roles:[...LEADERS,'SEKRETARIS','BENDAHARA','AUDITOR']},
    {href:'/dashboard/audit',label:'Audit & Keamanan',Icon:ShieldCheck,roles:['SUPER_ADMIN','PIMPINAN','ADMIN_TI','AUDITOR']},
    {href:'/dashboard/administrasi',label:'Administrasi Pengguna',Icon:UserCog,roles:['SUPER_ADMIN','PIMPINAN','ADMIN_TI','AUDITOR']},
  ]},
];

export function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();const router=useRouter();const[user,setUser]=useState<User|null>(null);const[open,setOpen]=useState(false);
  useEffect(()=>{api<User>('/auth/me').then(setUser).catch(()=>router.replace('/'))},[router]);
  async function logout(){await api('/auth/logout',{method:'POST'}).catch(()=>undefined);router.replace('/')}
  const visibleGroups=groups.map(group=>({...group,items:group.items.filter(item=>!item.roles||!!user&&item.roles.includes(user.role))})).filter(group=>group.items.length);
  return <div className="shell"><aside className={`sidebar ${open?'open':''}`}><div className="brand-row"><div className="mark">✦</div><div><strong>SIM Kongregasi</strong><small>Ruang administrasi</small></div><button className="mobile-menu" aria-label="Tutup navigasi" style={{color:'white',marginLeft:'auto'}} onClick={()=>setOpen(false)}><X/></button></div>{visibleGroups.map(group=><div key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(({href,label,Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className={`nav-item ${path===href?'active':''}`}><Icon size={17}/>{label}</Link>)}</div>)}</aside><main className="main"><header className="topbar"><button className="mobile-menu" aria-label="Buka navigasi" onClick={()=>setOpen(true)}><Menu/></button><span className="muted" style={{fontSize:'.8rem'}}>Sistem aktif lokal <Activity size={12} style={{color:'#39745a',verticalAlign:'middle'}}/></span><div className="user"><div className="avatar">{user?.name?.[0]??'…'}</div><div><strong style={{fontSize:'.82rem'}}>{user?.name??'Memuat…'}</strong><small className="muted" style={{display:'block',fontSize:'.68rem'}}>{user?.role?.replaceAll('_',' ')}</small></div><button className="btn secondary small" onClick={logout}>Keluar</button></div></header><div className="content">{children}</div></main></div>;
}
