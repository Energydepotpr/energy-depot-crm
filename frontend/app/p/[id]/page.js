'use client';
import { useSearchParams, useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

export default function PropuestaPublicPage() {
  const params = useParams();
  const sp = useSearchParams();
  const id = params?.id || '';
  const token = sp.get('token') || '';
  const q = sp.get('q') || '';
  const src = `${API}/api/public/leads/${id}/propuesta?token=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  return (
    <div style={{ position:'fixed', inset:0, background:'#fff' }}>
      <iframe src={src} style={{ width:'100%', height:'100%', border:'none' }} title="Propuesta Energy Depot" />
    </div>
  );
}
