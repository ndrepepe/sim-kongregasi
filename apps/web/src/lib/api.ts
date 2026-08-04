export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export async function api<T>(path:string, init:RequestInit = {}, retry=true):Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type','application/json');
  let response=await fetch(`${API_URL}${path}`,{...init,headers,credentials:'include'});
  if(response.status===401 && retry && path!=='/auth/login'){
    const refreshed=await fetch(`${API_URL}/auth/refresh`,{method:'POST',credentials:'include'});
    if(refreshed.ok) response=await fetch(`${API_URL}${path}`,{...init,headers,credentials:'include'});
  }
  if(!response.ok){const detail=await response.json().catch(()=>({message:'Permintaan gagal.'}));const message=Array.isArray(detail.message)?detail.message.join(', '):detail.message;throw new Error(message||`HTTP ${response.status}`);}
  if(response.status===204) return undefined as T;
  return response.json() as Promise<T>;
}

export const rupiah=(value:number|string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value||0));
export const dateId=(value?:string)=>value?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—';
