'use client';
import { useEffect, useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { Empty, PageHead, Status } from '@/components/ui';
type Org={id:string;code:string;name:string;type:string;city?:string;is_active:boolean};
export default function Organizations(){const[data,setData]=useState<Org[]>([]);const[error,setError]=useState('');useEffect(()=>{api<Org[]>('/organizations').then(setData).catch(e=>setError(e.message))},[]);return <><PageHead eyebrow="Tata kelola" title="Struktur Organisasi" description="Generalat, provinsi, delegasi, komunitas, dan unit karya dalam satu hierarki."/>{error&&<p className="error">{error}</p>}<section className="grid module-grid">{data.map(o=><article className="card module-card" key={o.id}><Building2 size={22}/><h3>{o.name}</h3><p>{o.code} · {o.type.replaceAll('_',' ')}</p>{o.city&&<p><MapPin size={13} style={{verticalAlign:'middle'}}/> {o.city}</p>}<Status value={o.is_active?'ACTIVE':'NONACTIVE'}/></article>)}</section>{!data.length&&!error&&<Empty/>}</>}
