'use client';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api, dateId } from '@/lib/api';
import { Empty, PageHead } from '@/components/ui';
type Chronicle={id:string;event_date:string;title:string;content:string;location?:string;tags:string[];created_by_name:string};
export default function Chronicles(){const[data,setData]=useState<Chronicle[]>([]);const[error,setError]=useState('');useEffect(()=>{api<Chronicle[]>('/chronicles').then(setData).catch(e=>setError(e.message))},[]);return <><PageHead eyebrow="Memori kelembagaan" title="Kronik Kongregasi" description="Peristiwa penting disimpan sebagai sejarah yang dapat ditelusuri."/>{error&&<p className="error">{error}</p>}<section className="grid">{data.map(c=><article className="card" key={c.id}><span className="eyebrow">{dateId(c.event_date)}</span><h2 style={{marginTop:'.55rem'}}>{c.title}</h2><p>{c.content}</p><small className="muted">{c.location&&<><MapPin size={12} style={{verticalAlign:'middle'}}/> {c.location} · </>}{c.created_by_name}</small><div style={{marginTop:'.8rem'}}>{c.tags?.map(t=><span className="badge gray" style={{marginRight:5}} key={t}>{t}</span>)}</div></article>)}{!data.length&&!error&&<Empty/>}</section></>}
