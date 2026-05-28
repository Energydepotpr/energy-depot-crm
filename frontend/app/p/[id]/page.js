// Server component — fetch backend HTML y renderiza en el cliente sin iframe
const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

export const dynamic = 'force-dynamic';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// CSS responsivo: la propuesta está diseñada en 210mm (~793px). En móvil la
// escalamos al ancho de la pantalla para que se vea completa sin scroll horizontal.
const RESPONSIVE_CSS = `
  html, body { margin: 0; padding: 0; background: #E5E7EB; overflow-x: hidden; }
  .propuesta-wrapper { width: 100%; display: flex; flex-direction: column; align-items: center; }
  /* La propuesta está diseñada a 210mm (~793px). En móvil usamos zoom para
     escalarla y que ocupe el ancho de la pantalla sin scroll horizontal. */
  @media (max-width: 480px) {
    .propuesta-wrapper .page { zoom: 0.45; -ms-zoom: 0.45; -webkit-transform: scale(0.45); -webkit-transform-origin: top center; }
    .propuesta-wrapper { gap: 6px; padding: 6px 0; }
  }
  @media (min-width: 481px) and (max-width: 820px) {
    .propuesta-wrapper .page { zoom: 0.65; -ms-zoom: 0.65; -webkit-transform: scale(0.65); -webkit-transform-origin: top center; }
    .propuesta-wrapper { gap: 10px; padding: 10px 0; }
  }
  /* Fallback Safari iOS antiguo: si el zoom no aplica, neutraliza el scale negativo */
  @supports not (zoom: 1) {
    .propuesta-wrapper .page { width: 100vw !important; }
  }
`;

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />
      <div className="propuesta-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
