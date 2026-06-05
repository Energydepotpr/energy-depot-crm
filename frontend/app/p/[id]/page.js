// Server component — fetch backend HTML y renderiza en el cliente sin iframe
import { headers } from 'next/headers';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

export const dynamic = 'force-dynamic';

// La propuesta está diseñada a 210mm (~794px) de ancho. Fijando el viewport a
// ese ancho, el navegador (iPhone/Android) escala toda la página para que quepa
// en la pantalla y permite scroll vertical nativo de un dedo. Sin hacks de zoom.
export const viewport = {
  width: 816,
};

// CSS extra SOLO para Android.
const ANDROID_SCROLL_FIX = `
  html, body {
    overflow-x: hidden !important;
    overflow-y: auto !important;
    height: auto !important;
    min-height: 100% !important;
    touch-action: pan-y !important;
    -webkit-overflow-scrolling: touch;
  }
`;

// El layout raíz pone <meta viewport ... maximum-scale=1, user-scalable=no> que
// IMPIDE a Android escalar la propuesta (794px) para que quepa → se ve gigante.
// iPhone Safari ignora user-scalable=no, por eso allí sí funciona. Solo en Android
// reemplazamos el viewport por uno limpio (width=816) que permite escalar a la pantalla.
const ANDROID_VIEWPORT_FIX = `
(function(){
  try {
    document.querySelectorAll('meta[name="viewport"]').forEach(function(m){ m.parentNode.removeChild(m); });
    var m = document.createElement('meta');
    m.name = 'viewport';
    m.setAttribute('content', 'width=816, user-scalable=yes');
    document.head.appendChild(m);
  } catch(e){}
})();
`;

export default async function PropuestaPublicPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp?.token || '';
  const q = sp?.q || '';
  const url = `${API}/api/public/leads/${id}/propuesta?token=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  const ua = (await headers()).get('user-agent') || '';
  const isAndroid = /Android/i.test(ua);

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
      {isAndroid && <style dangerouslySetInnerHTML={{ __html: ANDROID_SCROLL_FIX }} />}
      {isAndroid && <script dangerouslySetInnerHTML={{ __html: ANDROID_VIEWPORT_FIX }} />}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
