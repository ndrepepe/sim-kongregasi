'use client';
import { X } from 'lucide-react';

export function PageHead({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}){return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted" style={{margin:0}}>{description}</p></div>{action}</div>}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="btn secondary small" onClick={onClose} aria-label="Tutup"><X size={16}/></button></div>{children}</div></div>}
export function Status({value}:{value:string}){const red=/REJECTED|LEFT|DECEASED|VOID/.test(value);const gold=/DRAFT|PENDING|REPORTED|FORMATION|REVIEW|DOCUMENTS/.test(value);return <span className={`badge ${red?'red':gold?'gold':''}`}>{value.replaceAll('_',' ')}</span>}
export function Empty({text='Belum ada data.'}:{text?:string}){return <div className="empty">{text}</div>}
