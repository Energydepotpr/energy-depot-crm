// Server component — fetch backend HTML y renderiza en el cliente sin iframe
const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

export const dynamic = 'force-dynamic';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// CSS responsivo: la propuesta está diseñada en 210mm (~793px). En móvil usamos
// `zoom` (no transform) porque zoom SÍ reduce la altura real del layout, así el
// scroll vertical funciona bien en Android/Chrome. El zoom exacto lo calcula el
// script de abajo según el ancho real de la pantalla.
const RESPONSIVE_CSS = `
  html, body { margin: 0; padding: 0; background: #E5E7EB; overflow-x: hidden; }
  body { -webkit-overflow-scrolling: touch; }
  @media (max-width: 820px) {
    body { padding: 0 !important; gap: 8px !important; align-items: flex-start !important; }
    .propuesta-wrapper { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 0; }
    .propuesta-wrapper .page { box-shadow: none !important; margin: 0 !important; }
  }
`;

// Aplica zoom = anchoPantalla / anchoPagina a cada .page. zoom reflowa el layout
// (a diferencia de transform), por eso el documento tiene la altura correcta y
// el scroll funciona en móvil. Se reaplica al rotar/redimensionar.
const FIT_SCRIPT = `
(function(){
  function fit(){
    if (window.innerWidth > 820) return;
    var pages = document.querySelectorAll('.propuesta-wrapper .page');
    if (!pages.length) return;
    var pw = pages[0].getBoundingClientRect().width / (pages[0].style.zoom ? parseFloat(pages[0].style.zoom) : 1);
    if (!pw || pw < 100) pw = 793;
    var z = Math.min(1, (window.innerWidth - 8) / pw);
    pages.forEach(function(p){ p.style.zoom = z; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit);
  else fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function(){ setTimeout(fit, 300); });
  setTimeout(fit, 400); setTimeout(fit, 1200);
})();
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
      <script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />
    </>
  );
}
