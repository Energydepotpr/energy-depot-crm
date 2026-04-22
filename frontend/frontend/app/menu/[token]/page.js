'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

const MENUS = [
  {
    id: 'bbq', label: 'BBQ', icon: '🔥',
    sections: [
      { id: 'snacks', title: 'Snacks', items: ['Veggie platter','Cold Cuts','Cheese sampler tray','Peanuts and nuts','Chorizos parrilleros (Argentinian grilled sausages)','Puerto Rican longaniza (local spiced sausage)'] },
      { id: 'grill', title: 'From the Grill', items: ['Grilled Skirt steak with creole sauce','Grilled Chicken breast with garlic and parsley mojo','Grilled Pork Chops with spicy guava sauce','Smoked and tangy Pork Ribs with honey and paprika glaze','Shrimp/Pork/Chicken Puerto Rican style kebab with Sobao bread','Tequila and ancho chile marinated Arrachera (skirt steak)','Chicken or beef fajitas with melted cheese and bacon, fresh guacamole and passion fruit pico de gallo','Rack of Lamb with garlic and rosemary rub with black beer glace','Homemade beef hamburger with bacon cheese garlic mayo-ketchup','A la talla red snapper with guajillo peppers coconut and cilantro sauce','T-bone steak with roasted Mexican salsa'] },
      { id: 'vegetarian', title: 'Vegetarian 🌱', items: ['Sweet plantain Canoa stuffed with veggies 🌱','Veggie paella 🌱','Cassava root Pastelón with vegan meat and mushroom marinara 🌱','Avocado stuffed with beans 🌱','Eggplant lasagna 🌱','Vegetable stew 🌱'] },
      { id: 'sides', title: 'Sides', items: ['Rice with beans or chickpeas','Grilled corn on the cob with Mayo and fresh cheese','Grilled potatoes with chives butter','Mashed Cassava','Potato Wedges','Grilled eggplant zucchini bell pepper and onion salad','Sweet potato fries','Arugula baby corn bell peppers olives and parmesan salad with Dijon mustard and agave honey vinaigrette','Grain Salad (Beans corn and chick peas)','Homemade guacamole with pork rinds','Mango Pico de Gallo with tortilla chips','Caprese Salad','Cobb Salad','Caesar Salad','Roasted garlic 🌱','Mixed veggies 🌱','Mojo roasted veggie kebabs 🌱','Guacamole & pico de gallo with tortilla chips 🌱'] },
      { id: 'desserts', title: 'Desserts', items: ['Quesitos (Cheese and guava stuffed puff pastry)','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque coconut milk based','Creme brûlée cake with Almond Toffee','Passion fruit pie (Parcha pie)','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
    ],
  },
  {
    id: 'chef', label: "Chef's", icon: '👨‍🍳',
    sections: [
      { id: 'appetizers', title: 'Appetizers', items: ['Fresh mozzarella basil and tomato crostini','Mojito shrimp/chicken/beef/pork or Caprese pinchos (kebabs)','Crab cakes with aioli','Passion fruit ceviche with fresh fish or shrimp topped with avocado and plantain chips','Prosciutto Manchego cheese and melon with balsamic reduction','Garlic Hummus with baked pita chips','Chicken/pork/beef or crab empanadas','Carnitas quesadilla with guacamole pico de gallo and Mexican cream','Serrano ham and Dutch cheese risotto arancini topped with cilantro aioli','Roasted garlic 🌱','Mixed veggies 🌱','Mojo roasted veggie kebabs 🌱','Guacamole & pico de gallo with tortilla chips 🌱'] },
      { id: 'soups_salads', title: '1st Course — Soups & Salads', items: ['Mixed greens with mango vinaigrette','Classic Caesar salad with ranch dressing','Cucumber mango and peanuts salad with ginger-coconut and lime dressing','Heart of palm artichoke arugula chives cherry tomato cucumber and walnut salad','Traditional onion soup','Creamy pumpkin and corn soup'] },
      { id: 'chicken_pork', title: '2nd Course — Chicken & Pork', items: ['Grilled chicken breast with garlic and recao mojo','Chicken and shrimp sautéed with pancetta chimichurri','Roasted pork loin with tamarind and cilantrillo sauce','Guava-glazed pork ribs','Paella: Serrano ham Spanish chorizo pork ribs and chicken'] },
      { id: 'beef_lamb', title: '2nd Course — Beef & Lamb', items: ['Grilled Angus skirt steak / New York striploin / Ribeye with chimichurri','Filet Mignon with creamy mushroom wine reduction','Lamb chops with rosemary and thyme au jus','Rack of lamb with Dijon mustard and rosemary sauce','Pan-seared duck breast with piquillo pepper butter','Turkey breast with orange ginger and honey sauce'] },
      { id: 'fish_seafood', title: '2nd Course — Fish & Seafood', items: ['Seafood Paella (calamari mussels shrimp clams & fish)','Mahi-Mahi filet with wild mushroom duxelle','Tiger shrimp or prawns with lime and garlic butter','Pan seared catch of the day with ajillo sauce','Pan-seared salmon with cherry tomatoes & Creole white wine reduction','Caribbean spiny lobster with guava beurre blanc sauce'] },
      { id: 'pasta', title: 'Pasta', items: ["Tagliolini with broccoli cream smoked bacon and cherry tomatoes","Tomato and pesto gnocchi","Smoked brisket cannelloni with Parmesan and white wine béchamel"] },
      { id: 'vegetarian', title: 'Vegetarian 🌱', items: ['Veggie stuffed sweet plantain canoa 🌱','Veggie paella 🌱','Cassava root pastelón with vegan meat and mushroom marinara 🌱','Avocado stuffed with beans 🌱','Eggplant lasagna 🌱','Vegetable stew 🌱'] },
      { id: 'sides_rice', title: 'Sides — Rice', items: ['Mamposteado de gandules','Arroz con longaniza y amarillos','Rice and beans','Arroz con gandules','Arroz con Cilantro','Plantain or cassava mofongo','Boiled Cassava with pickled onions'] },
      { id: 'sides_salads', title: 'Sides — Salads', items: ["Puerto Rican Macarroni salad","Chef salad","Special Chef's Salad","Grain salad","Red potato salad with recao aioli","Mixed greens with mango vinaigrette","Mashed potatoes with bacon and chives","Mexican-style corn on the cob","Potato au gratin"] },
      { id: 'desserts', title: 'Desserts', items: ['Quesitos','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque','Creme brûlée cake with Almond Toffee','Passion fruit pie','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
    ],
  },
  {
    id: 'brunch', label: 'Brunch', icon: '🥂',
    sections: [
      { id: 'eggs', title: 'Huevos & Platos Principales', items: ['Eggs Benedict con hollandaise','Huevos revueltos con hierbas frescas','Frittata de vegetales','Omelette con queso y jamón','French toast con maple y frutas','Crêpes con Nutella y fresas'] },
      { id: 'pancakes_waffles', title: 'Pancakes & Waffles', items: ['Pancakes clásicos con mantequilla y maple','Waffles belgas con crema y frutas del bosque','Pancakes de banana y avena','Waffles de red velvet con cream cheese'] },
      { id: 'beverages', title: 'Bebidas', items: ['Mimosas (prosecco + jugo de naranja)','Bloody Mary','Jugo de naranja natural','Café americano / espresso','Café con leche','Té variado','Smoothies de frutas tropicales'] },
      { id: 'sides_brunch', title: 'Acompañantes', items: ['Bandeja de frutas frescas de temporada','Ensalada de frutas tropicales','Tocino crocante','Salchichas artesanales','Hash browns','Tostadas artesanales con mantequilla'] },
      { id: 'pastries', title: 'Repostería', items: ['Croissants de mantequilla','Muffins variados','Scones con clotted cream y mermelada','Danesas de frutas','Bagels con cream cheese y salmón ahumado','Donuts artesanales glaseados'] },
    ],
  },
  {
    id: 'kids', label: 'Kids', icon: '🧒',
    sections: [
      { id: 'mains_kids', title: 'Platos Principales', items: ['Mac & Cheese casero','Hot dogs a la parrilla','Mini hamburguesas con papas fritas','Nuggets de pollo crujientes','Pizza personal de queso','Pasta con salsa marinara','Quesadillas de queso'] },
      { id: 'sides_kids', title: 'Acompañantes', items: ['Papas fritas','Zanahorias y apio con ranch dip','Maíz en mazorca','Fruta fresca en trozos','Arroz blanco'] },
      { id: 'desserts_kids', title: 'Postres', items: ['Helado de vainilla / chocolate / fresa','Brownies de chocolate','Mini cupcakes decorados','Algodón de azúcar','Paletas de frutas'] },
      { id: 'drinks_kids', title: 'Bebidas', items: ['Jugo de frutas natural','Leche fría o chocolate','Limonada rosada','Agua saborizada'] },
    ],
  },
  {
    id: 'pr', label: 'Puerto Rican', icon: '🇵🇷',
    sections: [
      { id: 'appetizers_pr', title: 'Aperitivos', items: ['Alcapurrias de carne o jueyes','Bacalaítos fritos','Sorullitos de maíz con mayo-ketchup','Rellenos de papa','Empanadillas de carne','Mofongo frito con caldo de pollo'] },
      { id: 'mains_pr', title: 'Platos Principales', items: ['Lechón asado al horno con mojo','Pernil de cerdo con gandules','Pollo guisado puertorriqueño','Carne guisada con papas','Bacalao guisado con viandas','Camarones al ajillo estilo PR','Chuletas de cerdo fritas a la criolla'] },
      { id: 'rice_pr', title: 'Arroz & Viandas', items: ['Arroz con gandules (arroz de fiesta)','Arroz mamposteado','Arroz con longaniza y amarillos','Tostones con mayo-ketchup','Amarillos fritos','Yuca hervida con mojo de ajo','Mofongo de ajo con chicharrón','Pasteles de masa (wrapped in banana leaf)'] },
      { id: 'salads_pr', title: 'Ensaladas', items: ["Puerto Rican Macarroni salad","Ensalada verde con aguacate y tomate","Ensalada de papas con recao aioli"] },
      { id: 'desserts_pr', title: 'Postres', items: ['Tembleque de coco','Flan de queso','Arroz con leche','Quesitos de guayaba','Budín de pan','Brazo gitano','Majarete'] },
    ],
  },
  {
    id: 'desserts', label: 'Desserts', icon: '🍰',
    sections: [
      { id: 'cakes_pastries', title: 'Cakes & Pastries', items: ['Quesitos (Cheese and guava stuffed puff pastry)','Flan de Vainilla y queso','Tres leches cake','Mini cheesecake','Fruit tart','Bizcocho de chocolate','Ginger & turmeric Tembleque coconut milk based','Creme brûlée cake with Almond Toffee','Passion fruit pie (Parcha pie)','Chocolate on chocolate cake with salty caramel','Lemon vanilla bean mascarpone cake'] },
      { id: 'custom_cakes', title: 'Custom Cakes', items: ['Vanilla bean layer cake (custom design)','Red velvet cake with cream cheese frosting','Carrot cake with walnut cream cheese','Naked cake with fresh seasonal fruit','Drip cake with ganache and decorations','Gluten-free chocolate cake'] },
    ],
  },
];

export default function MenuPublico() {
  const { token } = useParams();

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [contactName, setContactName]   = useState('');
  const [menuTypes, setMenuTypes]       = useState([]);
  const [activeTab, setActiveTab]       = useState(null);
  const [quantities, setQuantities]     = useState({});
  const [clientNotes, setClientNotes]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [submitError, setSubmitError]   = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/public/menu/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setContactName(data.contact_name || '');
        const types = Array.isArray(data.menu_types) ? data.menu_types : [];
        setMenuTypes(types);
        if (types.length > 0) setActiveTab(types[0]);
        setLoading(false);
      })
      .catch(() => { setError('Error al cargar el menú'); setLoading(false); });
  }, [token]);

  const activeMenus = MENUS.filter(m => menuTypes.includes(m.id));
  const activeMenu  = activeMenus.find(m => m.id === activeTab);

  function getQty(menuId, sectionId, item) {
    return quantities?.[menuId]?.[sectionId]?.[item] || 0;
  }

  function setQty(menuId, sectionId, item, delta) {
    setQuantities(prev => {
      const next = { ...prev };
      if (!next[menuId]) next[menuId] = {};
      if (!next[menuId][sectionId]) next[menuId][sectionId] = {};
      const cur = next[menuId][sectionId][item] || 0;
      const val = Math.max(0, cur + delta);
      if (val === 0) {
        delete next[menuId][sectionId][item];
      } else {
        next[menuId][sectionId][item] = val;
      }
      return next;
    });
  }

  function totalItems() {
    let count = 0;
    for (const menu of Object.values(quantities)) {
      for (const section of Object.values(menu)) {
        for (const qty of Object.values(section)) {
          count += qty;
        }
      }
    }
    return count;
  }

  function buildSelections() {
    const sel = {};
    for (const [menuId, sections] of Object.entries(quantities)) {
      for (const [sectionId, items] of Object.entries(sections)) {
        if (Object.keys(items).length === 0) continue;
        if (!sel[menuId]) sel[menuId] = {};
        sel[menuId][sectionId] = { ...items };
      }
    }
    return sel;
  }

  async function handleSubmit() {
    if (totalItems() === 0) {
      setSubmitError('Por favor selecciona al menos un ítem antes de enviar.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${BACKEND}/api/public/menu/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: buildSelections(), client_notes: clientNotes }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Error al enviar'); setSubmitting(false); return; }
      setSubmitted(true);
    } catch {
      setSubmitError('Error de conexión. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#1e293b',
      paddingBottom: '100px',
    },
    header: {
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    },
    logoText: {
      fontSize: '22px',
      fontWeight: '800',
      color: '#1e293b',
      letterSpacing: '-0.5px',
    },
    logoAccent: { color: '#1b9af5' },
    tagline: {
      fontSize: '13px',
      color: '#64748b',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    greetingBar: {
      background: '#eff6ff',
      borderBottom: '1px solid #bfdbfe',
      padding: '12px 24px',
      textAlign: 'center',
    },
    greetingText: {
      fontSize: '15px',
      color: '#1e40af',
      fontWeight: '500',
    },
    tabsWrapper: {
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 16px',
      display: 'flex',
      overflowX: 'auto',
      gap: '4px',
    },
    tab: (active) => ({
      padding: '12px 18px',
      fontSize: '14px',
      fontWeight: active ? '700' : '500',
      color: active ? '#1b9af5' : '#64748b',
      borderBottom: active ? '2px solid #1b9af5' : '2px solid transparent',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid #1b9af5' : '2px solid transparent',
      transition: 'all 0.15s',
    }),
    content: {
      maxWidth: '720px',
      margin: '0 auto',
      padding: '20px 16px',
    },
    sectionCard: {
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: '16px',
      overflow: 'hidden',
    },
    sectionTitle: {
      padding: '14px 18px',
      fontSize: '14px',
      fontWeight: '700',
      color: '#475569',
      background: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    itemRow: (selected) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 18px',
      borderBottom: '1px solid #f1f5f9',
      background: selected ? '#eff6ff' : 'white',
      transition: 'background 0.15s',
    }),
    itemName: (selected) => ({
      flex: 1,
      fontSize: '14px',
      color: selected ? '#1d4ed8' : '#334155',
      fontWeight: selected ? '600' : '400',
      paddingRight: '12px',
    }),
    counter: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    counterBtn: (variant) => ({
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      border: variant === 'minus' ? '1.5px solid #cbd5e1' : '1.5px solid #1b9af5',
      background: variant === 'minus' ? 'white' : '#1b9af5',
      color: variant === 'minus' ? '#64748b' : 'white',
      fontSize: '18px',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: '1',
      padding: '0',
    }),
    qtyDisplay: {
      minWidth: '24px',
      textAlign: 'center',
      fontSize: '15px',
      fontWeight: '700',
      color: '#1e293b',
    },
    notesSection: {
      marginTop: '8px',
    },
    notesCard: {
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      padding: '18px',
    },
    notesLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px',
    },
    notesTextarea: {
      width: '100%',
      minHeight: '80px',
      border: '1.5px solid #e2e8f0',
      borderRadius: '8px',
      padding: '10px 12px',
      fontSize: '14px',
      color: '#374151',
      resize: 'vertical',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    stickyBar: {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      background: 'white',
      borderTop: '1px solid #e2e8f0',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      zIndex: 50,
    },
    totalBadge: {
      display: 'flex',
      flexDirection: 'column',
    },
    totalLabel: {
      fontSize: '11px',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    totalCount: {
      fontSize: '20px',
      fontWeight: '800',
      color: '#1e293b',
    },
    submitBtn: (disabled) => ({
      padding: '12px 28px',
      background: disabled ? '#94a3b8' : '#1b9af5',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.15s',
      whiteSpace: 'nowrap',
    }),
    errorText: {
      fontSize: '13px',
      color: '#ef4444',
      textAlign: 'center',
      padding: '8px 0',
    },
    // Thank you screen
    thankYouWrapper: {
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    },
    thankYouCard: {
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
      padding: '48px 40px',
      maxWidth: '460px',
      width: '100%',
      textAlign: 'center',
    },
    checkCircle: {
      width: '72px',
      height: '72px',
      background: '#dcfce7',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 24px',
      fontSize: '36px',
    },
    thankYouTitle: {
      fontSize: '26px',
      fontWeight: '800',
      color: '#1e293b',
      marginBottom: '12px',
    },
    thankYouMsg: {
      fontSize: '15px',
      color: '#64748b',
      lineHeight: '1.6',
      marginBottom: '32px',
    },
    thankYouDivider: {
      borderTop: '1px solid #e2e8f0',
      paddingTop: '24px',
    },
    contactInfo: {
      fontSize: '14px',
      color: '#475569',
      lineHeight: '2',
    },
    contactLink: {
      color: '#1b9af5',
      textDecoration: 'none',
      fontWeight: '600',
    },
    // Loading / error screens
    centerScreen: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
    },
    errorCard: {
      background: 'white',
      borderRadius: '16px',
      padding: '40px 32px',
      maxWidth: '400px',
      textAlign: 'center',
      boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    },
    errorIcon: { fontSize: '48px', marginBottom: '16px' },
    errorTitle: { fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' },
    errorDesc:  { fontSize: '14px', color: '#64748b' },
  };

  // ── Thank you screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={styles.thankYouWrapper}>
        <div style={styles.thankYouCard}>
          <div style={styles.checkCircle}>✅</div>
          <div style={styles.thankYouTitle}>
            {contactName ? `¡Gracias, ${contactName.split(' ')[0]}!` : '¡Gracias!'}
          </div>
          <p style={styles.thankYouMsg}>
            Tu selección fue enviada exitosamente. Nuestro equipo la revisará y se pondrá en contacto contigo muy pronto para confirmar todos los detalles.
          </p>
          <div style={styles.thankYouDivider}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fix A Trip Puerto Rico
            </div>
            <div style={styles.contactInfo}>
              <a href="tel:+17874880202" style={styles.contactLink}>+1 (787) 488-0202</a><br />
              <a href="mailto:info@fixatrippuertorico.com" style={styles.contactLink}>info@fixatrippuertorico.com</a><br />
              <a href="https://fixatrippr.com" target="_blank" rel="noreferrer" style={styles.contactLink}>fixatrippr.com</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.centerScreen}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🍽️</div>
          <div style={{ fontSize: '16px' }}>Cargando menú...</div>
        </div>
      </div>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>
            {error.includes('expirado') ? '⏰' : error.includes('enviado') ? '✅' : '❌'}
          </div>
          <div style={styles.errorTitle}>
            {error.includes('expirado') ? 'Link expirado' : error.includes('enviado') ? 'Ya enviado' : 'Enlace no válido'}
          </div>
          <div style={styles.errorDesc}>{error}</div>
          <div style={{ marginTop: '24px', fontSize: '13px', color: '#94a3b8' }}>
            Contacta a Fix A Trip PR para obtener un nuevo enlace.
          </div>
        </div>
      </div>
    );
  }

  const total = totalItems();

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoText}>
          Fix A <span style={styles.logoAccent}>Trip</span> PR
        </div>
        <div style={styles.tagline}>Catering & Private Chef Services</div>
      </div>

      {/* Greeting */}
      {contactName && (
        <div style={styles.greetingBar}>
          <div style={styles.greetingText}>
            Hola, <strong>{contactName}</strong>! Selecciona los platos que deseas incluir en tu evento.
          </div>
        </div>
      )}

      {/* Tabs */}
      {activeMenus.length > 1 && (
        <div style={styles.tabsWrapper}>
          {activeMenus.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              style={styles.tab(activeTab === m.id)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Menu content */}
      <div style={styles.content}>
        {activeMenu && activeMenu.sections.map(section => (
          <div key={section.id} style={styles.sectionCard}>
            <div style={styles.sectionTitle}>{section.title}</div>
            {section.items.map(item => {
              const qty = getQty(activeMenu.id, section.id, item);
              return (
                <div key={item} style={styles.itemRow(qty > 0)}>
                  <div style={styles.itemName(qty > 0)}>{item}</div>
                  <div style={styles.counter}>
                    <button
                      onClick={() => setQty(activeMenu.id, section.id, item, -1)}
                      style={styles.counterBtn('minus')}
                      disabled={qty === 0}
                      aria-label="Reducir cantidad"
                    >
                      −
                    </button>
                    <span style={styles.qtyDisplay}>{qty}</span>
                    <button
                      onClick={() => setQty(activeMenu.id, section.id, item, 1)}
                      style={styles.counterBtn('plus')}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Notes */}
        <div style={styles.notesSection}>
          <div style={styles.notesCard}>
            <label style={styles.notesLabel}>Notas adicionales (opcional)</label>
            <textarea
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Alergias, restricciones dietéticas, preferencias especiales..."
              style={styles.notesTextarea}
            />
          </div>
        </div>
      </div>

      {/* Sticky submit bar */}
      <div style={styles.stickyBar}>
        <div style={styles.totalBadge}>
          <span style={styles.totalLabel}>Ítems seleccionados</span>
          <span style={styles.totalCount}>{total}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {submitError && <div style={styles.errorText}>{submitError}</div>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={styles.submitBtn(submitting)}
          >
            {submitting ? 'Enviando...' : 'Enviar mi selección'}
          </button>
        </div>
      </div>
    </div>
  );
}
