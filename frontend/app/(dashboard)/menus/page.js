'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../../lib/auth';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  surface2:'var(--surface2)',
  border:  'var(--border)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  accent:  'var(--accent)',
  success: 'var(--success)',
};

// ── Menu Data ─────────────────────────────────────────────────────────────────
const MENUS = [
  {
    id: 'bbq', label: 'BBQ', icon: '🔥',
    sections: [
      { id: 'snacks', title: 'Snacks', hint: 'Pick 2', items: ['Veggie platter','Cold Cuts','Cheese sampler tray','Peanuts and nuts','Chorizos parrilleros (Argentinian grilled sausages)','Puerto Rican longaniza (local spiced sausage)'] },
      { id: 'grill', title: 'From the Grill', hint: 'Pick 2', items: ['Grilled Skirt steak with creole sauce','Grilled Chicken breast with garlic and parsley mojo','Grilled Pork Chops with spicy guava sauce','Smoked and tangy Pork Ribs with honey and paprika glaze','Shrimp/Pork/Chicken Puerto Rican style kebab with Sobao bread','Tequila and ancho chile marinated Arrachera (skirt steak)','Chicken or beef fajitas with melted cheese and bacon, fresh guacamole and passion fruit pico de gallo','Rack of Lamb with garlic and rosemary rub with black beer glace','Homemade beef hamburger with bacon cheese garlic mayo-ketchup','A la talla red snapper with guajillo peppers coconut and cilantro sauce','T-bone steak with roasted Mexican salsa'] },
      { id: 'vegetarian', title: 'Vegetarian 🌱', hint: null, items: ['Sweet plantain Canoa stuffed with veggies 🌱','Veggie paella 🌱','Cassava root Pastelón with vegan meat and mushroom marinara 🌱','Avocado stuffed with beans 🌱','Eggplant lasagna 🌱','Vegetable stew 🌱'] },
      { id: 'sides', title: 'Sides', hint: 'Pick 2', items: ['Rice with beans or chickpeas','Grilled corn on the cob with Mayo and fresh cheese','Grilled potatoes with chives butter','Mashed Cassava','Potato Wedges','Grilled eggplant zucchini bell pepper and onion salad','Sweet potato fries','Arugula baby corn bell peppers olives and parmesan salad with Dijon mustard and agave honey vinaigrette','Grain Salad (Beans corn and chick peas)','Homemade guacamole with pork rinds','Mango Pico de Gallo with tortilla chips','Caprese Salad','Cobb Salad','Caesar Salad','Roasted garlic 🌱','Mixed veggies 🌱','Mojo roasted veggie kebabs 🌱','Guacamole & pico de gallo with tortilla chips 🌱'] },
      { id: 'desserts', title: 'Desserts', hint: null, items: ['Quesitos (Cheese and guava stuffed puff pastry)','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque coconut milk based','Creme brûlée cake with Almond Toffee','Passion fruit pie (Parcha pie)','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
    ],
  },
  {
    id: 'chef', label: "Chef's", icon: '👨‍🍳',
    sections: [
      { id: 'appetizers', title: 'Appetizers', hint: null, items: ['Fresh mozzarella basil and tomato crostini','Mojito shrimp/chicken/beef/pork or Caprese pinchos (kebabs)','Crab cakes with aioli','Passion fruit ceviche with fresh fish or shrimp topped with avocado and plantain chips','Prosciutto Manchego cheese and melon with balsamic reduction','Garlic Hummus with baked pita chips','Chicken/pork/beef or crab empanadas','Carnitas quesadilla with guacamole pico de gallo and Mexican cream','Serrano ham and Dutch cheese risotto arancini topped with cilantro aioli','Roasted garlic 🌱','Mixed veggies 🌱','Mojo roasted veggie kebabs 🌱','Guacamole & pico de gallo with tortilla chips 🌱'] },
      { id: 'soups_salads', title: '1st Course — Soups & Salads', hint: null, items: ['Mixed greens with mango vinaigrette','Classic Caesar salad with ranch dressing','Cucumber mango and peanuts salad with ginger-coconut and lime dressing','Heart of palm artichoke arugula chives cherry tomato cucumber and walnut salad','Traditional onion soup','Creamy pumpkin and corn soup'] },
      { id: 'chicken_pork', title: '2nd Course — Chicken & Pork', hint: null, items: ['Grilled chicken breast with garlic and recao mojo','Chicken and shrimp sautéed with pancetta chimichurri','Roasted pork loin with tamarind and cilantrillo sauce','Guava-glazed pork ribs','Paella: Serrano ham Spanish chorizo pork ribs and chicken'] },
      { id: 'beef_lamb', title: '2nd Course — Beef & Lamb', hint: null, items: ['Grilled Angus skirt steak / New York striploin / Ribeye with chimichurri','Filet Mignon with creamy mushroom wine reduction','Lamb chops with rosemary and thyme au jus','Rack of lamb with Dijon mustard and rosemary sauce','Pan-seared duck breast with piquillo pepper butter','Turkey breast with orange ginger and honey sauce'] },
      { id: 'fish_seafood', title: '2nd Course — Fish & Seafood', hint: null, items: ['Seafood Paella (calamari mussels shrimp clams & fish)','Mahi-Mahi filet with wild mushroom duxelle','Tiger shrimp or prawns with lime and garlic butter','Pan seared catch of the day with ajillo sauce','Pan-seared salmon with cherry tomatoes & Creole white wine reduction','Caribbean spiny lobster with guava beurre blanc sauce'] },
      { id: 'pasta', title: 'Pasta', hint: null, items: ['Tagliolini with broccoli cream smoked bacon and cherry tomatoes','Tomato and pesto gnocchi','Smoked brisket cannelloni with Parmesan and white wine béchamel'] },
      { id: 'vegetarian', title: 'Vegetarian 🌱', hint: null, items: ['Veggie stuffed sweet plantain canoa 🌱','Veggie paella 🌱','Cassava root pastelón with vegan meat and mushroom marinara 🌱','Avocado stuffed with beans 🌱','Eggplant lasagna 🌱','Vegetable stew 🌱'] },
      { id: 'sides_rice', title: 'Sides — Rice', hint: null, items: ['Mamposteado de gandules','Arroz con longaniza y amarillos','Rice and beans','Arroz con gandules','Arroz con Cilantro','Plantain or cassava mofongo','Boiled Cassava with pickled onions'] },
      { id: 'sides_salads', title: 'Sides — Salads', hint: null, items: ["Puerto Rican Macarroni salad","Chef salad","Special Chef's Salad","Grain salad","Red potato salad with recao aioli","Mixed greens with mango vinaigrette","Mashed potatoes with bacon and chives","Mexican-style corn on the cob","Potato au gratin"] },
      { id: 'desserts', title: 'Desserts', hint: null, items: ['Quesitos','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque','Creme brûlée cake with Almond Toffee','Passion fruit pie','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
    ],
  },
  {
    id: 'brunch', label: 'Brunch', icon: '🥂', note: 'Ver menú completo con coordinador',
    sections: [
      { id: 'eggs', title: 'Huevos & Platos Principales', hint: null, items: ['Eggs Benedict con hollandaise','Huevos revueltos con hierbas frescas','Frittata de vegetales','Omelette con queso y jamón','French toast con maple y frutas','Crêpes con Nutella y fresas'] },
      { id: 'pancakes_waffles', title: 'Pancakes & Waffles', hint: null, items: ['Pancakes clásicos con mantequilla y maple','Waffles belgas con crema y frutas del bosque','Pancakes de banana y avena','Waffles de red velvet con cream cheese'] },
      { id: 'beverages', title: 'Bebidas', hint: null, items: ['Mimosas (prosecco + jugo de naranja)','Bloody Mary','Jugo de naranja natural','Café americano / espresso','Café con leche','Té variado','Smoothies de frutas tropicales'] },
      { id: 'sides_brunch', title: 'Acompañantes', hint: null, items: ['Bandeja de frutas frescas de temporada','Ensalada de frutas tropicales','Tocino crocante','Salchichas artesanales','Hash browns','Tostadas artesanales con mantequilla'] },
      { id: 'pastries', title: 'Repostería', hint: null, items: ['Croissants de mantequilla','Muffins variados','Scones con clotted cream y mermelada','Danesas de frutas','Bagels con cream cheese y salmón ahumado','Donuts artesanales glaseados'] },
    ],
  },
  {
    id: 'kids', label: 'Kids', icon: '🧒', note: 'Ver menú completo con coordinador',
    sections: [
      { id: 'mains_kids', title: 'Platos Principales', hint: null, items: ['Mac & Cheese casero','Hot dogs a la parrilla','Mini hamburguesas con papas fritas','Nuggets de pollo crujientes','Pizza personal de queso','Pasta con salsa marinara','Quesadillas de queso'] },
      { id: 'sides_kids', title: 'Acompañantes', hint: null, items: ['Papas fritas','Zanahorias y apio con ranch dip','Maíz en mazorca','Fruta fresca en trozos','Arroz blanco'] },
      { id: 'desserts_kids', title: 'Postres', hint: null, items: ['Helado de vainilla / chocolate / fresa','Brownies de chocolate','Mini cupcakes decorados','Algodón de azúcar','Paletas de frutas'] },
      { id: 'drinks_kids', title: 'Bebidas', hint: null, items: ['Jugo de frutas natural','Leche fría o chocolate','Limonada rosada','Agua saborizada'] },
    ],
  },
  {
    id: 'pr', label: 'Puerto Rican', icon: '🇵🇷', note: 'Ver menú completo con coordinador',
    sections: [
      { id: 'appetizers_pr', title: 'Aperitivos', hint: null, items: ['Alcapurrias de carne o jueyes','Bacalaítos fritos','Sorullitos de maíz con mayo-ketchup','Rellenos de papa','Empanadillas de carne','Mofongo frito con caldo de pollo'] },
      { id: 'mains_pr', title: 'Platos Principales', hint: null, items: ['Lechón asado al horno con mojo','Pernil de cerdo con gandules','Pollo guisado puertorriqueño','Carne guisada con papas','Bacalao guisado con viandas','Camarones al ajillo estilo PR','Chuletas de cerdo fritas a la criolla'] },
      { id: 'rice_pr', title: 'Arroz & Viandas', hint: null, items: ['Arroz con gandules (arroz de fiesta)','Arroz mamposteado','Arroz con longaniza y amarillos','Tostones con mayo-ketchup','Amarillos fritos','Yuca hervida con mojo de ajo','Mofongo de ajo con chicharrón','Pasteles de masa (wrapped in banana leaf)'] },
      { id: 'salads_pr', title: 'Ensaladas', hint: null, items: ['Ensalada de macarrones puertorriqueña','Ensalada verde con aguacate y tomate','Ensalada de papas con recao aioli'] },
      { id: 'desserts_pr', title: 'Postres', hint: null, items: ['Tembleque de coco','Flan de queso','Arroz con leche','Quesitos de guayaba','Budín de pan','Brazo gitano','Majarete'] },
    ],
  },
  {
    id: 'desserts', label: 'Desserts', icon: '🍰',
    sections: [
      { id: 'cakes_pastries', title: 'Cakes & Pastries', hint: null, items: ['Quesitos (Cheese and guava stuffed puff pastry)','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque coconut milk based','Creme brûlée cake with Almond Toffee','Passion fruit pie (Parcha pie)','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
      { id: 'custom_cakes', title: 'Custom Cakes', hint: null, items: ['Vanilla bean layer cake (custom design)','Red velvet cake with cream cheese frosting','Carrot cake with walnut cream cheese','Naked cake with fresh seasonal fruit','Drip cake with ganache and decorations','Gluten-free chocolate cake'] },
    ],
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
const MENU_LABELS = { bbq: 'BBQ', chef: "Chef's", brunch: 'Brunch', kids: 'Kids', pr: 'Puerto Rican', desserts: 'Desserts' };

export default function MenusPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('menu');

  if (!user || (user.role !== 'admin' && user.role !== 'agent')) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Acceso restringido</h2>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'menu',       label: '🍽️ Constructor' },
    { id: 'respuestas', label: '📬 Respuestas' },
    { id: 'bot',        label: '👨‍🍳 Bot Chef' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Tab bar ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? C.text : C.muted, borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, marginBottom: -1, transition: 'color 0.12s' }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* ── Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {tab === 'menu'       && <MenuBuilder />}
        {tab === 'respuestas' && <SubmissionsPanel />}
        {tab === 'bot'        && <BotPanel />}
      </div>
    </div>
  );
}

function MenuBuilder() {
  const [activeMenu, setActiveMenu] = useState('bbq');
  const [guests, setGuests] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // quantities: { [menuId]: { [sectionId]: { [item]: number } } }
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState({});

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactDrop, setShowContactDrop] = useState(false);
  const contactRef = useRef(null);

  // Modals
  const [proposalOpen, setProposalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const currentMenu = MENUS.find(m => m.id === activeMenu);

  // ── Quantity helpers ────────────────────────────────────────────────────────
  const getQty = (menuId, sectionId, item) =>
    quantities[menuId]?.[sectionId]?.[item] || 0;

  const adjustQty = (menuId, sectionId, item, delta) => {
    setQuantities(prev => {
      const menuQ = { ...(prev[menuId] || {}) };
      const sectionQ = { ...(menuQ[sectionId] || {}) };
      const newQty = Math.max(0, (sectionQ[item] || 0) + delta);
      if (newQty === 0) delete sectionQ[item];
      else sectionQ[item] = newQty;
      if (Object.keys(sectionQ).length === 0) delete menuQ[sectionId];
      else menuQ[sectionId] = sectionQ;
      if (Object.keys(menuQ).length === 0) {
        const { [menuId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [menuId]: menuQ };
    });
  };

  const totalItems = useMemo(() => {
    let t = 0;
    for (const mQ of Object.values(quantities))
      for (const sQ of Object.values(mQ))
        for (const q of Object.values(sQ)) t += q;
    return t;
  }, [quantities]);

  const menuTotalQty = (menuId) => {
    let t = 0;
    for (const sQ of Object.values(quantities[menuId] || {}))
      for (const q of Object.values(sQ)) t += q;
    return t;
  };

  const sectionTotalQty = (menuId, sectionId) =>
    Object.values(quantities[menuId]?.[sectionId] || {}).reduce((a, b) => a + b, 0);

  const clearAll = () => { setQuantities({}); setNotes({}); setGuests(''); setSelectedContact(null); setContactSearch(''); };

  // ── Contact search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2) { setContactResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('crm_token');
        const res = await fetch(`${BACKEND}/api/contacts?search=${encodeURIComponent(contactSearch)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setContactResults(Array.isArray(data.contacts) ? data.contacts.slice(0, 6) : []);
        setShowContactDrop(true);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (contactRef.current && !contactRef.current.contains(e.target))
        setShowContactDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Proposal text ──────────────────────────────────────────────────────────
  const proposalText = useMemo(() => {
    const lines = [];
    lines.push('══════════════════════════════════════');
    lines.push('       PROPUESTA FIX A TRIP PR        ');
    lines.push('══════════════════════════════════════');
    if (selectedContact) lines.push(`Cliente: ${selectedContact.name}`);
    if (guests) lines.push(`Número de personas: ${guests}`);
    lines.push('');

    MENUS.forEach(menu => {
      const menuQ = quantities[menu.id] || {};
      const hasAny = Object.values(menuQ).some(sQ => Object.keys(sQ).length > 0);
      if (!hasAny) return;
      lines.push(`▶ MENÚ ${menu.label.toUpperCase()} ${menu.icon}`);
      lines.push('──────────────────────────────────────');
      menu.sections.forEach(section => {
        const sQ = menuQ[section.id] || {};
        const entries = Object.entries(sQ);
        if (!entries.length) return;
        lines.push(`  ${section.title}:`);
        entries.forEach(([item, qty]) => lines.push(`    • ${qty > 1 ? qty + 'x ' : ''}${item}`));
        lines.push('');
      });
      const note = notes[menu.id];
      if (note?.trim()) { lines.push(`  Notas: ${note.trim()}`); lines.push(''); }
    });

    lines.push('══════════════════════════════════════');
    lines.push('Energy Depot PR');
    lines.push('energydepotpr.com | +1 787 627 8585');
    lines.push('══════════════════════════════════════');
    return lines.join('\n');
  }, [quantities, notes, guests, selectedContact]);

  const handleCopy = () => {
    navigator.clipboard.writeText(proposalText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Propuesta Fix a Trip PR</title>
      <style>body{font-family:'Courier New',monospace;font-size:13px;max-width:600px;margin:40px auto;line-height:1.6;color:#1a1f38;}pre{white-space:pre-wrap;word-wrap:break-word;}@media print{body{margin:20px;}}</style>
      </head><body><pre>${proposalText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
      <script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
    win.document.close();
  };

  // ── Share link ─────────────────────────────────────────────────────────────
  const handleGenerateLink = async () => {
    setShareLoading(true);
    setShareLink('');
    try {
      const menusWithItems = MENUS.filter(m => menuTotalQty(m.id) > 0).map(m => m.id);
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${BACKEND}/api/menu-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contact_id: selectedContact?.id || null,
          contact_name: selectedContact?.name || '',
          menu_types: menusWithItems.length > 0 ? menusWithItems : MENUS.map(m => m.id),
          expires_hours: 72,
        }),
      });
      const data = await res.json();
      if (data.url) setShareLink(data.url);
      else alert('Error: ' + (data.error || 'No se pudo generar el enlace'));
    } catch (e) {
      alert('Error generando enlace. Verifica la conexión.');
    }
    setShareLoading(false);
  };

  const handleShareCopy = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareCopied(true); setTimeout(() => setShareCopied(false), 2500);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'system-ui, sans-serif', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Top Bar ── */}
      <div style={{ padding: isMobile ? '10px 12px' : '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexWrap: 'wrap' }}>
        {!isMobile && (
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>🍽️ Menús Fix a Trip</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Selecciona opciones para el cliente durante la llamada</p>
          </div>
        )}

        {/* Contact search */}
        <div ref={contactRef} style={{ position: 'relative', flex: 1, minWidth: isMobile ? 0 : 200, maxWidth: isMobile ? '100%' : 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${selectedContact ? C.accent : C.border}`, borderRadius: 8, padding: '6px 10px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
            </svg>
            {selectedContact ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{selectedContact.name}</span>
                <button onClick={() => { setSelectedContact(null); setContactSearch(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
              </div>
            ) : (
              <input
                value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); setShowContactDrop(true); }}
                onFocus={() => contactSearch.length >= 2 && setShowContactDrop(true)}
                placeholder="Buscar contacto..."
                style={{ flex: 1, background: 'none', border: 'none', color: C.text, fontSize: 13, outline: 'none' }}
              />
            )}
          </div>
          {showContactDrop && contactResults.length > 0 && !selectedContact && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {contactResults.map(c => (
                <button key={c.id} onClick={() => { setSelectedContact(c); setContactSearch(''); setShowContactDrop(false); }}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.name}</span>
                  {c.company && <span style={{ fontSize: 11, color: C.muted }}>{c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Guests */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isMobile && <label style={{ color: C.muted, fontSize: 13, whiteSpace: 'nowrap' }}>Personas:</label>}
          <input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} placeholder={isMobile ? '👥' : '50'}
            style={{ width: isMobile ? 56 : 70, padding: '7px 8px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, outline: 'none', textAlign: 'center' }} />
        </div>
      </div>

      {/* ── Mobile: horizontal menu type selector ── */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0, scrollbarWidth: 'none' }}>
          {MENUS.map(menu => {
            const active = menu.id === activeMenu;
            const qty = menuTotalQty(menu.id);
            return (
              <button key={menu.id} onClick={() => setActiveMenu(menu.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${active ? C.accent : C.border}`, background: active ? `${C.accent}20` : C.surface2, color: active ? C.accent : C.muted, fontSize: 12, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}>
                <span>{menu.icon}</span>
                <span>{menu.label}</span>
                {qty > 0 && <span style={{ background: C.accent, color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '0 5px', minWidth: 16, textAlign: 'center' }}>{qty}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: menu tabs — hidden on mobile (replaced by horizontal pills above) */}
        <aside style={{ width: isMobile ? 0 : 210, flexShrink: 0, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, background: C.surface, overflowY: 'auto', padding: isMobile ? 0 : '12px 0', display: isMobile ? 'none' : 'block' }}>
          <div style={{ padding: '0 12px 8px', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tipo de Menú</div>
          {MENUS.map(menu => {
            const active = menu.id === activeMenu;
            const qty = menuTotalQty(menu.id);
            return (
              <button key={menu.id} onClick={() => setActiveMenu(menu.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: active ? `${C.accent}15` : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: `3px solid ${active ? C.accent : 'transparent'}`, transition: 'background 0.12s' }}>
                <span style={{ fontSize: 18 }}>{menu.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>{menu.label}</span>
                {qty > 0 && (
                  <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: C.accent, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{qty}</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Right: items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Menu header */}
          <div style={{ padding: '14px 24px 10px', borderBottom: `1px solid ${C.border}`, background: C.surface2, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{currentMenu?.icon}</span>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>Menú {currentMenu?.label}</h2>
                {currentMenu?.note && (
                  <span style={{ display: 'inline-block', marginTop: 3, fontSize: 11, color: C.success, background: `${C.success}18`, borderRadius: 5, padding: '1px 8px' }}>ℹ️ {currentMenu.note}</span>
                )}
              </div>
              <span style={{ fontSize: 12, color: C.muted }}>Usa +/− para indicar cantidad</span>
            </div>
          </div>

          {/* Scrollable items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px 20px' : '16px 24px 24px' }}>
            {currentMenu?.sections.map(section => {
              const secQty = sectionTotalQty(activeMenu, section.id);
              return (
                <div key={section.id} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{section.title}</span>
                    {section.hint && (
                      <span style={{ fontSize: 11, color: C.accent, background: `${C.accent}18`, borderRadius: 5, padding: '1px 7px', fontWeight: 500 }}>{section.hint}</span>
                    )}
                    {secQty > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.success, fontWeight: 600 }}>{secQty} unidad{secQty !== 1 ? 'es' : ''}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {section.items.map(item => {
                      const qty = getQty(activeMenu, section.id, item);
                      const active = qty > 0;
                      return (
                        <div key={item}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: active ? `${C.accent}12` : 'transparent', border: `1px solid ${active ? C.accent + '40' : 'transparent'}`, transition: 'background 0.1s' }}>
                          {/* Item name */}
                          <span style={{ flex: 1, fontSize: 13, color: active ? C.text : C.muted, fontWeight: active ? 500 : 400, lineHeight: 1.4 }}>{item}</span>
                          {/* Counter */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => adjustQty(activeMenu, section.id, item, -1)}
                              disabled={qty === 0}
                              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${qty > 0 ? C.accent : C.border}`, background: qty > 0 ? `${C.accent}20` : C.surface2, color: qty > 0 ? C.accent : C.muted, fontSize: 16, fontWeight: 700, cursor: qty === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.1s' }}
                            >−</button>
                            <span style={{ minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 700, color: qty > 0 ? C.text : C.muted }}>{qty}</span>
                            <button
                              onClick={() => adjustQty(activeMenu, section.id, item, 1)}
                              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.accent}`, background: `${C.accent}20`, color: C.accent, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.1s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}20`; e.currentTarget.style.color = C.accent; }}
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Notes */}
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Notas para este menú:</label>
              <textarea value={notes[activeMenu] || ''} onChange={e => setNotes(prev => ({ ...prev, [activeMenu]: e.target.value }))}
                placeholder="Alergias, preferencias, instrucciones especiales..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div style={{ padding: isMobile ? '8px 12px' : '12px 24px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, fontSize: isMobile ? 11 : 13, color: C.muted }}>
              <span style={{ color: C.text, fontWeight: 700 }}>{totalItems}</span> sel.
              {selectedContact && <> · <span style={{ color: C.success, fontWeight: 500 }}>{selectedContact.name}</span></>}
              {guests && <> · <span style={{ color: C.text, fontWeight: 600 }}>{guests}</span> 👥</>}
            </div>
            <button onClick={clearAll}
              style={{ padding: isMobile ? '6px 10px' : '7px 13px', borderRadius: 7, fontSize: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontWeight: 500 }}>
              🗑️
            </button>
            <button onClick={() => { setShareOpen(true); setShareLink(''); setShareCopied(false); }}
              style={{ padding: isMobile ? '6px 10px' : '7px 14px', borderRadius: 7, fontSize: isMobile ? 12 : 13, background: `${C.success}20`, border: `1px solid ${C.success}50`, color: C.success, cursor: 'pointer', fontWeight: 600 }}>
              🔗 {isMobile ? 'Enviar' : 'Enviar al cliente'}
            </button>
            <button onClick={() => { setProposalOpen(true); setCopied(false); }} disabled={totalItems === 0}
              style={{ padding: isMobile ? '6px 12px' : '8px 18px', borderRadius: 7, fontSize: isMobile ? 12 : 13, background: totalItems === 0 ? C.surface2 : C.accent, color: totalItems === 0 ? C.muted : '#fff', border: 'none', cursor: totalItems === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {isMobile ? '📋 Propuesta' : 'Generar Propuesta'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Proposal Modal ── */}
      {proposalOpen && (
        <div onClick={() => setProposalOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Propuesta generada</h3>
                {selectedContact && <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Para: {selectedContact.name}</p>}
              </div>
              <button onClick={() => setProposalOpen(false)}
                style={{ background: C.surface2, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', color: C.muted, fontSize: 18 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              <pre style={{ margin: 0, fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: C.surface2, borderRadius: 8, padding: '14px 16px', border: `1px solid ${C.border}` }}>
                {proposalText}
              </pre>
            </div>
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={handleCopy}
                style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, background: copied ? `${C.success}20` : C.surface2, border: `1px solid ${copied ? C.success : C.border}`, color: copied ? C.success : C.text, cursor: 'pointer', fontWeight: 500 }}>
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
              <button onClick={handlePrint}
                style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareOpen && (
        <div onClick={() => setShareOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 480, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>🔗 Enviar menú al cliente</h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
                El cliente podrá ver el menú, seleccionar sus platos y enviarte la lista. El enlace expira en 72 horas.
              </p>
            </div>

            {/* Contact info */}
            <div style={{ background: C.surface2, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Cliente</div>
              <div style={{ fontSize: 14, color: selectedContact ? C.text : C.muted, fontWeight: selectedContact ? 500 : 400 }}>
                {selectedContact ? selectedContact.name : 'Sin contacto seleccionado — el cliente puede escribir su nombre'}
              </div>
            </div>

            {/* Menu types to share */}
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Menús a incluir en el enlace</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MENUS.map(m => {
                  const hasItems = menuTotalQty(m.id) > 0;
                  return (
                    <div key={m.id} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: hasItems ? `${C.accent}20` : C.surface2, border: `1px solid ${hasItems ? C.accent + '50' : C.border}`, color: hasItems ? C.accent : C.muted }}>
                      {m.icon} {m.label}{hasItems ? ` (${menuTotalQty(m.id)})` : ''}
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.muted }}>
                {MENUS.filter(m => menuTotalQty(m.id) > 0).length > 0
                  ? 'Solo se mostrarán los menús con items seleccionados.'
                  : 'Se mostrarán todos los menús (ninguno tiene items aún).'}
              </p>
            </div>

            {/* Generated link */}
            {shareLink && (
              <div style={{ background: `${C.success}10`, border: `1px solid ${C.success}40`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: C.success, fontWeight: 600, marginBottom: 6 }}>✓ Enlace generado</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: 12, color: C.text, wordBreak: 'break-all', fontFamily: 'monospace' }}>{shareLink}</span>
                  <button onClick={handleShareCopy}
                    style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 7, fontSize: 12, background: shareCopied ? `${C.success}20` : C.surface2, border: `1px solid ${shareCopied ? C.success : C.border}`, color: shareCopied ? C.success : C.text, cursor: 'pointer', fontWeight: 500 }}>
                    {shareCopied ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShareOpen(false)}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>
                Cerrar
              </button>
              <button onClick={handleGenerateLink} disabled={shareLoading}
                style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, background: shareLoading ? C.surface2 : C.success, border: 'none', color: shareLoading ? C.muted : '#fff', cursor: shareLoading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {shareLoading ? 'Generando...' : shareLink ? '🔄 Nuevo enlace' : '🔗 Generar enlace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PANEL: Respuestas de clientes
// ══════════════════════════════════════════════════════
function SubmissionsPanel() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${BACKEND}/api/menu-links`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLinks(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh each 30s to catch new submissions
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const renderSelections = (selections) => {
    if (!selections) return null;
    return Object.entries(selections).map(([menuId, sections]) => {
      const items = Object.entries(sections).flatMap(([, itemsObj]) =>
        Object.entries(itemsObj).map(([item, qty]) => ({ item, qty }))
      );
      if (!items.length) return null;
      return (
        <div key={menuId} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>
            {MENU_LABELS[menuId] || menuId}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {items.map(({ item, qty }) => (
              <span key={item} style={{ fontSize: 12, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px', color: C.text }}>
                {qty > 1 ? <strong style={{ color: C.accent }}>{qty}× </strong> : ''}{item}
              </span>
            ))}
          </div>
        </div>
      );
    });
  };

  const submitted = links.filter(l => l.submitted);
  const pending   = links.filter(l => !l.submitted);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>📬 Respuestas de clientes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Selecciones enviadas por clientes vía enlace compartido</p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>
          ↻ Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 14, textAlign: 'center', padding: 40 }}>Cargando...</div>
      ) : submitted.length === 0 && pending.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15 }}>Aún no hay enlaces generados</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Crea un enlace desde la pestaña Constructor y compártelo con el cliente.</div>
        </div>
      ) : (
        <>
          {/* Submitted */}
          {submitted.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.success, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                ✓ Enviadas ({submitted.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {submitted.map(link => {
                  const name = link.contact_real_name || link.contact_name || 'Cliente sin nombre';
                  const isOpen = expanded === link.id;
                  const menuTypes = (link.menu_types || []).map(m => MENU_LABELS[m] || m).join(', ');
                  return (
                    <div key={link.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpanded(isOpen ? null : link.id)}
                        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 18, background: `${C.success}20`, border: `1px solid ${C.success}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{menuTypes} · {link.submitted_at ? new Date(link.submitted_at).toLocaleString('es-PR') : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, color: C.success, background: `${C.success}15`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Enviado</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`¿Eliminar el menú de "${name}"?`)) return;
                            const token = localStorage.getItem('crm_token');
                            await fetch(`${BACKEND}/api/menu-links/${link.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                            load();
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid #ef444440', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          🗑
                        </button>
                        <span style={{ color: C.muted, fontSize: 16 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.border}` }}>
                          <div style={{ paddingTop: 14 }}>
                            {renderSelections(link.selections)}
                            {link.client_notes && (
                              <div style={{ marginTop: 10, padding: '10px 12px', background: C.surface2, borderRadius: 8, fontSize: 13, color: C.muted }}>
                                <strong style={{ color: C.text }}>Notas del cliente:</strong> {link.client_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                ⏳ Pendientes — cliente aún no respondió ({pending.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(link => {
                  const name = link.contact_real_name || link.contact_name || 'Sin nombre';
                  const menuTypes = (link.menu_types || []).map(m => MENU_LABELS[m] || m).join(', ');
                  const expired = new Date(link.expires_at) < new Date();
                  return (
                    <div key={link.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: expired ? C.muted : C.text }}>{name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{menuTypes} · {new Date(link.created_at).toLocaleString('es-PR')}</div>
                      </div>
                      <span style={{ fontSize: 11, color: expired ? '#ef4444' : C.muted, background: expired ? '#ef444415' : C.surface2, borderRadius: 20, padding: '3px 10px' }}>
                        {expired ? 'Expirado' : 'Pendiente'}
                      </span>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el enlace de "${name}"?`)) return;
                          const token = localStorage.getItem('crm_token');
                          await fetch(`${BACKEND}/api/menu-links/${link.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                          load();
                        }}
                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: 'transparent', border: `1px solid #ef444440`, color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Preview de factura del chef bot ──────────────────────────────────────────
function ChefInvoicePreview({ invoice, onDownload, downloading }) {
  if (!invoice) return null;
  const items = invoice.items || [];
  const subtotal = Number(invoice.subtotal || 0);
  const service = Number(invoice.service || 0);
  const tax = Number(invoice.tax || 0);
  const total = Number(invoice.total || 0);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', margin: '12px 24px 0' }}>
      <div style={{ background: '#1877f2', padding: '14px 18px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Energy Depot PR</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>energydepotpr.com</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, opacity: 0.7 }}>N° Factura</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{invoice.invoice_number}</div>
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 2 }}>CLIENTE</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{invoice.client_name}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', borderRadius: '6px 0 0 0', fontWeight: 600 }}>Descripción</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'center' }}>Cant.</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Precio</th>
              <th style={{ textAlign: 'right', padding: '6px 10px', borderRadius: '0 6px 0 0', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)' }}>
                <td style={{ padding: '6px 10px' }}>{item.description}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.quantity || item.qty || 1}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>${Number(item.unit_price || 0).toFixed(2)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                  ${(Number(item.unit_price || 0) * Number(item.quantity || item.qty || 1)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12, marginBottom: 3 }}>
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {service > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12, marginBottom: 3 }}>
                <span>Cargo por servicio</span><span>${service.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12, marginBottom: 3 }}>
                <span>IVU (11.5%)</span><span>${tax.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1877f2', color: '#fff', padding: '7px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 6 }}>
              <span>TOTAL</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        {invoice.id && (
          <button
            onClick={() => onDownload(invoice.id)}
            disabled={downloading}
            style={{ width: '100%', background: downloading ? '#6b7280' : '#1877f2', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: downloading ? 'not-allowed' : 'pointer' }}>
            {downloading ? 'Generando...' : '⬇️ Descargar PDF'}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PANEL: Bot Chef
// ══════════════════════════════════════════════════════
function BotPanel() {
  const INIT = { role: 'assistant', content: '¡Hola! Soy el Bot Chef de Fix a Trip PR. Conozco todos los pedidos de menú enviados por los clientes, los precios internos y puedo generar facturas. ¿En qué te puedo ayudar?\n\nEjemplos:\n• "¿Qué pidió [nombre del cliente]?"\n• "¿Cuánto costaría su pedido para 20 personas?"\n• "Genera la factura para [nombre]"' };
  const [messages, setMessages] = useState([INIT]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLastInvoice(null);
    const newMsgs = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${BACKEND}/api/chat/gigi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history: newMsgs.slice(-14) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error al conectar con el bot.' }]);
      if (data.invoice_created) setLastInvoice(data.invoice);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const downloadInvoicePdf = async (invoiceId) => {
    setDownloadingPdf(true);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${BACKEND}/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok || !data.pdf_base64) throw new Error('Sin PDF');
      const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'factura.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      alert('Error al descargar PDF: ' + e.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👨‍🍳</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Bot Chef</div>
          <div style={{ fontSize: 12, color: C.muted }}>Conoce todos los pedidos · Precios internos · Genera facturas</div>
        </div>
        <button onClick={() => { setMessages([INIT]); setLastInvoice(null); }}
          style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>
          Nueva conversación
        </button>
      </div>

      {/* Invoice preview */}
      {lastInvoice && (
        <div style={{ position: 'relative' }}>
          <ChefInvoicePreview invoice={lastInvoice} onDownload={downloadInvoicePdf} downloading={downloadingPdf} />
          <button onClick={() => setLastInvoice(null)} style={{ position: 'absolute', top: 20, right: 30, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: '24px', textAlign: 'center' }}>×</button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 30, height: 30, borderRadius: 15, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👨‍🍳</div>
            )}
            <div style={{
              maxWidth: '74%', padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              background: m.role === 'user' ? C.accent : C.surface,
              border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
              fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👨‍🍳</div>
            <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px', background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>●</span>
              <span style={{ opacity: 0.6 }}>●</span>
              <span style={{ opacity: 0.3 }}>●</span>
              <span style={{ marginLeft: 6 }}>Calculando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ padding: '8px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['¿Qué pedidos hay?', '¿Cuáles son los precios?', 'Genera una factura'].map(q => (
          <button key={q} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
            style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 24px 14px', background: C.bg, flexShrink: 0, display: 'flex', gap: 10 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Pregúntale al Bot Chef... (Enter para enviar, Shift+Enter nueva línea)"
          rows={2}
          style={{ flex: 1, padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ padding: '10px 20px', borderRadius: 10, background: (!input.trim() || loading) ? C.surface2 : 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', color: (!input.trim() || loading) ? C.muted : '#fff', cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          ➤
        </button>
      </div>
    </div>
  );
}
