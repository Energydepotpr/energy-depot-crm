// Server component — fetch backend HTML y renderiza en el cliente sin iframe
const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

export const dynamic = 'force-dynamic';

export default async function PropuestaPublicPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp?.token || '';
  const q = sp?.q || '';
  const url = `${API}/api/public/leads/${id}/propuesta?token=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  let html = '';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const txt = await res.text();
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center', color: '#475569' }}>
          <h1 style={{ color: '#1a3c8f' }}>Link inválido</h1>
          <p>{res.status === 403 ? 'El link expiró o no es válido.' : 'No se pudo cargar la propuesta.'}</p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16 }}>Contacta a Energy Depot LLC al 787-627-8585.</p>
        </div>
      );
    }
    html = await res.text();
  } catch (e) {
    return <div style={{ padding: 40, color: '#ef4444' }}>Error: {e.message}</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
