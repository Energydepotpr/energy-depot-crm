'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';

// ─── Knowledge Base data (embedded for seeding) ─────────────────────────────
const KB_DATA = {
  sections: [
    {
      id: 'accesos_web', titulo: 'Accesos & Sitios Web', icon: '🔑',
      items: [
        { nombre: 'fixatrippuertorico.com — Admin', tipo: 'Sitio Web Principal', info: 'Home page, contact form y link principal para cada tour.', links: [{ label: 'Admin WP', url: 'https://fixatrippuertorico.com/admin' }, { label: 'Editar Tours', url: 'https://fixatrippuertorico.com/wp-admin/edit.php?post_type=to_book' }, { label: 'Editar Header', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=6724&action=elementor' }, { label: 'Editar Footer', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=7376&action=elementor' }, { label: 'Google Spreadsheet Tours', url: 'https://docs.google.com/spreadsheets/d/1VV4YSkayaQ0Dr4_S94iFTUZv6PcHKbZzraGTghQhfoU/edit?usp=sharing' }], credenciales: 'Usuario: fixatrip | Pass: Fix@2025@_ | Hosting: wnpower.com (fixatrip@komunikacion.com.ar / Coderhouse21@) | GoDaddy: 224506078 / Lanumero12' },
        { nombre: 'fixatrippr.com — Admin', tipo: 'Sitio Web Secundario', info: 'Redirige automáticamente a fixatrippuertorico.com via plugin 301 Redirects. Booking Request de tours.', links: [{ label: 'Admin WP', url: 'https://fixatrippr.com/wp-login.php' }, { label: 'Editar Tours (Booking Request)', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_tours' }, { label: 'Editar Botes Privados', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_activity' }, { label: 'Fix a Chef', url: 'https://fixatrippr.com/fix-a-chef/' }, { label: 'Fix a Transport', url: 'https://fixatrippr.com/fix-a-transport/' }, { label: 'Fix a Wellness', url: 'https://fixatrippr.com/fix-a-wellness/' }], credenciales: 'Usuario: fixatrip | Pass: Coderhouse21 | Hosting: wnpower.com (tomas@fixatrippr.com / Coderhouse21@)' }
      ]
    },
    {
      id: 'drivers_guias_chefs', titulo: 'Drivers, Guías & Chefs', icon: '🚐',
      items: [
        { nombre: 'Jaime', tipo: 'Driver — Nuestra Guagua', telefono: '787 399 0152', capacidad: '14pp sin equipaje / 10pp con equipaje', costo: '$60/hr espera + $15 c/15min. 8 horas sueldo $120, overtime $15/hora.' },
        { nombre: 'Lusito', tipo: 'Guía y Driver', zona: 'RAINFOREST', telefono: '(939) 375-0993', capacidad: '6 pasajeros en su auto' },
        { nombre: 'Christian', tipo: 'Guía y Driver', telefono: '787 632 7652', info: 'Disponibilidad depende de hijos' },
        { nombre: 'Melba', tipo: 'Instructora Yoga & Driver con nuestra guagua', zona: 'YOGA', telefono: '1 (787) 274-0061' },
        { nombre: 'Mike', tipo: 'Driver', telefono: '1 (787) 674-3766', capacidad: '14pp sin equipaje / 10pp con equipaje', info: 'VIVE EN RIO GRANDE — más barato para viajes a Fajardo.' },
        { nombre: 'Miguel y Mike hijo', tipo: 'Driver', telefono: '860 234 8316', capacidad: 'Hasta 25 pasajeros con equipaje', zona: 'Area Este / no noche tarde', info: 'A Fajardo mínimo $200 o $25 round trip / $12.50 one way. Resuelve mucho pero se ofende rápido.' },
        { nombre: 'Hector lindo taxi (White Ford Van)', tipo: 'Driver', telefono: '787-366-6354', capacidad: '14 pasajeros sin equipaje, 10 con maletas', zona: 'Desde Transit-Metro Area - Late night', info: 'ESTÁ EN SAN JUAN — para transfers a Fajardo NO. Asientos individuales.' },
        { nombre: 'Dario (Honda Odyssey white)', tipo: 'Driver', telefono: '787-320-2523', capacidad: '6pp / 4 con maletas', zona: 'Área metro' },
        { nombre: 'Pablo (Tico)', tipo: 'Solo Guía', telefono: '787-420-8809' },
        { nombre: 'Pepo', tipo: 'Driver (cobra por hora)', telefono: '(787) 594-2881', capacidad: '30 pasajeros', info: 'De 10 PP y va a ser a Fajardo. Cobra $75 p/hs la espera. CARABALI (ATV) tiene transporte.' },
        { nombre: 'Mario Acevedo (CARABALI Transport)', tipo: 'Driver', telefono: '787-547-6941', info: 'Book por app + 24hs inmediata anticipación. Pick-up 1.5 hora antes del booking. Viaje 30-45 min a Carabali.', links: [{ label: 'Formulario', url: 'https://forms.zohopublic.com/greattourspr/form/Transportationrequest/formperma/ppV-tv-urnP45uHG5SBI_2wNmcnByi-YHQSP0DmeUSw' }] },
        { nombre: 'Alvin (SEA VENTURE / YUNQUE ZIP)', tipo: 'Driver', telefono: '787-209-2127', info: 'Sea venture - Alvin es el transportista de esa excursión. $60 la hora de stop desde que llega al lugar, después $15 c/15min.' },
        { nombre: 'Uli', tipo: 'Driver (amigo de Sergio)', info: 'Los viernes no puede, solo de noche.' },
        { nombre: 'Osorio', tipo: 'Driver', telefono: '787 635 9786' },
        { nombre: 'Luz', tipo: 'Driver (tiene empresa)', telefono: '787-685-9666' },
        { nombre: 'Janice', tipo: 'Chef', info: 'Demora en contestar. Comida más tranquila, puertorriqueña. No hace más de 17 personas.', links: [{ label: 'Google Drive (Menús)', url: 'https://drive.google.com/drive/folders/1C5wicbjg-TDGFk6xxqjzVP9fL7p1nLY5?usp=share_link' }], costo: 'Chef fee $375 por servicio (depende del grupo), menús desde $35 pp.' },
        { nombre: 'Zuli', tipo: 'Chef', info: 'No hace más de 17 personas, comida más exótica. NO PASARLE EVENTOS MÁS DE 30 DÍAS PARA ADELANTE DE LAS 18HS. LUNES DÍA LIBRE Y VIERNES MÁS TEMPRANO.' },
        { nombre: 'Party Bus Vida Nauta', tipo: 'Transport', contacto: 'Jose Peña', telefono: '787 226 9683' }
      ]
    },
    {
      id: 'botes', titulo: 'Botes & Yachts', icon: '⛵',
      items: [
        { nombre: 'ANANDA — Marine Trader 42\'', contacto: 'Bebo/Adriana', telefono: '787 447 1682', muelle: 'Pier B30 - Puerto Chico', capacidad: 'Hasta 12pp', link_mapa: 'https://maps.app.goo.gl/69Pk8zJx3LAPvSUE8' },
        { nombre: 'VIDA NAUTA — Cruiser Yacht 54\'', contacto: 'Jose Peña', telefono: '787 226 9683', muelle: 'Muelle 1430 - Marina Puerto del Rey', capacidad: 'Hasta 12pp', costo: '4hs $2,750 (incl. crew fee $350) | 6hs $3,250 | 8hs $4,500 | Hora extra $300', incluye: '2 proteins: chicken/steak/pork/salmon/shrimp. Coke, Sprite, water, Tito\'s Vodka, Don Q Rum. Fruit cocktail, chips with cheese dip.', jetski: 'Jetski $400 VN / $450 Fix a Trip | Seabob $300 VN / $350 Fix a Trip', link_mapa: 'https://maps.app.goo.gl/W3APJkLA7NANQXaV9' },
        { nombre: 'VIDA NAUTA — Riviera 40\' Mordidita', muelle: 'Muelle 926', costo: '4hs $1,450 + $350 crew (total $1,800) | 6hs $1,850 + $350 crew | Hora extra $175', cancelacion: '10 días para refund', incluye_4hs: '1 protein: chicken/grain salad/pork. Sides: Caesar salad, chips, garlic bread, tacos. Sodas, water, beers, 1 bottle rum. Fruit cocktail. Floats, snorkeling, paddleboard, BBQ.', incluye_6hs: '2 proteins: chicken/fish/seafood/grain salad/pork/steak. Coke, Sprite, water, Medalla case, rum, whiskey, vodka. Fruit cocktail. Floats, snorkeling, paddleboard, BBQ.' },
        { nombre: 'VIDA NAUTA — Wellcraft', muelle: 'Muelle 310', capacidad: 'Hasta 6pp ($80pp adicional, 8pax máx.)', costo: '4hs $1,200 + $350 crew | Hora extra $150', incluye_4hs: 'Chips with salsa and cheese, fruit cocktail, Coke, Sprite, water, local beer. Sin almuerzo.', incluye_6hs: 'Coke, Sprite, water, Medalla case, 1L Don Q, BBQ chicken, salad, chips, fruit cocktail.' },
        { nombre: 'TYARA 39\'', muelle: 'Marina Sardinera', costo: '$1,950 + $350 crew', incluye: 'Coke, Sprite, water, 1L Don Q Rum, 1L vodka, Medallion case, chips, fruit cocktail. Elegir 1 almuerzo: seafood/steak/chicken/pork + Caesar salad + garlic bread.', link_mapa: 'https://maps.app.goo.gl/E7BvJuKUdQeQ7Wqb6' },
        { nombre: 'VIDA NAUTA — Lagoon 42 Yammuy', muelle: 'Muelle T del Muelle 3 - Marina Puerto del Rey, Fajardo', costo: 'Icacos/Palomino 4hs $2,000 + $350 | 6hs $2,250 | Culebra/Vieques $3,150 + $350 | Hora extra $250', incluye_4hs: '2 proteins: BBQ chicken o pork soft tacos. Caesar salad, chips, garlic bread, grain salad, fruit cocktail. Sodas, local beer case, 1 bottle rum.', incluye_6hs: 'Coke, Sprite, water, 1L Don Q, 1L vodka, Medallion case, chips, fruit cocktail. 2 proteins advance: seafood/steak/chicken/pork. Caesar salad, garlic bread.' },
        { nombre: 'RICHY Navarro — Grady White 30\'', telefono: '787-313-6513', muelle: 'Puerto del Rey (Larissa E)', capacidad: 'Hasta 6pp', costo: '$995 / 7 horas | 12pp $2,000 (6hs, 2 proteins, salad, tacos, Coke, Sprite, agua, Medalla case, Don Q 1L, Tito Vodka 1L, 2 islas) | Culebra/Vieques +$1,000 | Culebrita +$300', paquete_4hs: '$1,600 (9am-1pm o 2pm-6pm) incl. Coke, Sprite, agua, cervezas, tacos de pollo, chips, fruit cocktail.' },
        { nombre: 'PLAYERO — Sea Ray 51\'', contacto: 'Davnia', muelle: 'Villa Marina', incluye: 'Floats, snorkeling gear, paddleboard, music, air a/c, BBQ grill.', overnight: '$3,500 overnight Culebra/Vieques/Culebrita/St Thomas/St Jones. Sin comida. 3 cuartos. Mínimo 2 días para reservar.', link_mapa: 'https://maps.app.goo.gl/qzYaHYwAN8kGJ57X8' },
        { nombre: 'MICHAEL SIERRA — Tourquesa (Grady White 33\')', telefono: '787-377-4937', capacidad: '6 personas', costo: '$995 / 5-6 horas / 3 islas', info: 'Captain and crew fee $350 pagado al crew al check-in, NO incluido en invoice.' },
        { nombre: '787 Yachts — Ocean 49"', capacidad: '12 personas', info: 'Payment: 50% depósito requerido. Balance 10 días antes del charter.' },
        { nombre: 'SAIL GETAWAYS — Newton 32, 48" & Catamarán', telefono: '(787) 863-3483', muelle: 'M-20 Villa Marina Yacht Harbor / Dock M-21, Fajardo', precios: 'Culebra Snorkel: $2,495 / 25pp ($100 adicional pp). Public catamaran 30pp: $2,995. Shared from San Juan: $60pp / $195 privado.', cancelacion: 'Mínimo 7 días antes para refund completo. Weather: refund completo o fecha alternativa (solo capitán autoriza).', links: [{ label: 'Ver todos los tours', url: 'https://sailgetaway.com/all-charters/' }, { label: 'Instrucciones', url: 'https://sailgetaway.com/driving-directions/' }] },
        { nombre: 'WATERTIME — Azimut 68\' (Culebra)', contacto: 'Juliana', telefono: '787 692 6782 / 305-310-4979', muelle: 'Puerto Chico Leopard - Emilia', incluye: 'Snacks, dips, charcuterie board, fruit cocktail, sodas, water, beer, ice and cooler. You can bring your own (no coolers).', link_mapa: 'https://maps.app.goo.gl/8a3bSnyY9TiqDuhw9' }
      ]
    },
    {
      id: 'operadores_tours', titulo: 'Operadores de Tours', icon: '🗺️',
      items: [
        { nombre: 'ACCESS TOURS', contacto: 'Alex y Alvinio', telefono: '787-421-1800', zona: 'Yunque, Bio Bay', info: 'No aceptan Non-swimmers para el Bio. Máx 230 lbs. Pick-up: La Concha 8:45am, Fairmont 9:15am. Afternoon 4:30pm La Concha, 4:45pm Fairmont.', precios: '1- Bio bay desde La Concha o Fairmont: $115pp (tour + transporte). 2- Trio Yunque/Biobay/Luquillo con transporte: $165pp', link_mapa: 'https://maps.app.goo.gl/1JrgUJWWTkcXZ7Z16' },
        { nombre: 'Tours2PR', contacto: 'Harry', telefono: '787 223 2777', zona: 'Yunque, San Juan', info: 'Meeting: Al lado de Don Pepe 12:55pm.', precios: '1/2 day Yunque Afternoon' },
        { nombre: 'PR Experiences', contacto: 'Lesley', telefono: '402 709 0654', zona: 'Yunque, Off the beaten path', info: 'Meeting: Supermax 9:15am-12:15pm / RALPH\'S 10:20am-1:30pm.', precios: 'OFF the beaten path: $30 sin transporte / $50pp con transporte', links: [{ label: 'Web', url: 'https://prexperiencetours.com/product-category/el-yunque-tour/' }] },
        { nombre: 'PR TourDesk', contacto: 'Frankie', telefono: '787-309-9826', zona: 'Yunque 1/2 day Morning, Yunque Zip' },
        { nombre: 'Pure Adventure', telefono: '788 202 6551', zona: 'Snorkeling Culebra/Vieques', info: 'Para el Bio mínimo 220 lbs.' },
        { nombre: 'Getaways / Sail Getaways', telefono: '787-860-7327', zona: 'Fajardo, Bio Bay, Catamarán', info: 'Dock M-21, Catamaran, Getaway. Buscan por Hotels y Kasalta bakery.', link_mapa: 'https://maps.app.goo.gl/SukbLnvdRa1zSpy79' },
        { nombre: 'Carabalí', zona: 'ATV, ECO Ziplining, Horseback', info: 'Donde se hacen los ATV. También tiene transporte.' },
        { nombre: 'Paradise Seekers', zona: 'Horseback Ride, Bio Bay, Kayak', precios: '$45pp sin transporte / $65 con transporte (Rainforest Horseback Ride)' },
        { nombre: 'Barrilito', contacto: 'Virgen', zona: 'Rum Distillery Tour & Mixology', info: 'Enviar email a Virgen cc: con detalles del booking request. Ver TEMPLATE del INVOICE en email.', link_mapa: 'https://maps.app.goo.gl/vnUNXrn8ktHSNTHT6' },
        { nombre: 'JM (Off the Beaten Path)', telefono: '939 475 6100', zona: 'Yunque / Rainforest', precios: '$40pp | $150 JM + $120 Driver', info: 'JM quiere 2 guías para 8 o más pax. Meeting: Frutera Luquillo.', link_mapa: 'https://maps.app.goo.gl/S3oZwckGm4Z5nfRa7' },
        { nombre: 'Fotógrafo — Alfonso', telefono: '787-717-7925', zona: 'Fotografía', precios: '1 hora: $195 | Segunda hora: $150' }
      ]
    },
    {
      id: 'otros_servicios', titulo: 'Otros Servicios', icon: '🌟',
      items: [
        { nombre: 'Masajistas (Servicio a Villa)', tipo: 'Masajes', info: 'Massage Therapists $125/hora, van a la villa del cliente.', contactos: [{ nombre: 'Lucia', telefono: '787-923-3464' }, { nombre: 'Juneilis', telefono: '787-923-9281' }, { nombre: 'Yashira', telefono: '787-446-4362', nota: 'Conocida de Juneilis' }] },
        { nombre: 'Instructoras de Salsa', tipo: 'Clases de Salsa', precios: '$30-$35pp según tamaño del grupo', contactos: [{ nombre: 'Yaliris', telefono: '+1 (939) 274-3967' }, { nombre: 'Flor', telefono: '+1 (787) 932-1725' }, { nombre: 'Carmen', telefono: '1 (787) 631-8818' }] },
        { nombre: 'Pastelerías', tipo: 'Pastelerías', contactos: [{ nombre: 'Ozzie Forbes', telefono: '(787) 565-0423' }, { nombre: "Lulo's", telefono: '1 (787) 514-5823' }, { nombre: 'Poliniza', telefono: '1 (787) 613-7227', info: '57 Cjón. Báez' }] },
        { nombre: 'Restaurantes', tipo: 'Restaurantes', lista: [{ nombre: 'FOGO DE CHAO', zona: 'Fajardo', link_mapa: 'https://maps.app.goo.gl/DX3QPnTUnihiWZJr5' }, { nombre: 'Sábalos Marina Grill & Rooftop', zona: 'Fajardo', link_mapa: 'https://maps.app.goo.gl/mMCkg8c3xc4hMkCw8' }, { nombre: 'Metropol Restaurant - Sheraton Hotel', zona: 'San Juan', link_mapa: 'https://maps.app.goo.gl/RkfMMw6ytqpMmf2K6' }, { nombre: 'Pescaito', zona: 'San Juan', link_mapa: 'https://maps.app.goo.gl/42i47HrA9didiid28' }] },
        { nombre: 'Rental de Vans', tipo: 'Rental', contactos: [{ nombre: 'Flagship (Carolina)', info: '15pp, depósito $500' }, { nombre: 'Cabrera Auto', nota: 'No alquilan más' }] },
        { nombre: 'VIP Jet Skis', tipo: 'Jet Skis', link_mapa: 'https://maps.app.goo.gl/jK37hsfq5VCeXpCm9' }
      ]
    },
    {
      id: 'fareharbor', titulo: 'FareHarbor & Booking Links', icon: '🎟️',
      items: [
        {
          nombre: 'Spreadsheet completo de Tours + FareHarbor',
          tipo: 'Referencia principal',
          info: 'Contiene TODOS los tours del sitio web, su link a FareHarbor (booking online), link para booking request, y el operador utilizado.',
          links: [{ label: 'Abrir Spreadsheet', url: 'https://docs.google.com/spreadsheets/d/1VV4YSkayaQ0Dr4_S94iFTUZv6PcHKbZzraGTghQhfoU/edit?usp=sharing' }]
        },
        { nombre: '3 in 1 Icacos Snorkel Beach & Sunset Adventure', tipo: 'FareHarbor Online Booking', operador: 'Sail Getaways', link_web: 'https://fixatrippuertorico.com/to_book/3-in-1-icacos-snorkel-beach-sunset-adventure/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/sailgetaway/items/371460/calendar/2025/12/?ref=asn&sheet-uuid=d301e62e-d8ff-42fd-a7c5-f31784c43925&asn=fixatrippuertorico&flow=no&language=en-us&full-items=yes' }] },
        { nombre: 'ATV Adventure Puerto Rico', tipo: 'FareHarbor Online Booking', operador: 'Carabali FHDNetwork', link_web: 'https://fixatrippuertorico.com/to_book/atv-puerto-rico/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/carabalirainforestpark/items/?flow=748317&asn=fhdn&asn-ref=fixatrippuertorico&ref=fixatrippuertorico&language=en-us&full-items=yes' }] },
        { nombre: 'Bacardi Distillery and Old San Juan Combo', tipo: 'FareHarbor Online Booking', operador: 'San Juan Tours and Transfers', link_web: 'https://fixatrippuertorico.com/to_book/bacardi-distillery-and-old-san-juan-combo-tour/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/sanjuantoursandtransfers/items/171686/?button-tags=fixatrip-asn&ref=fixatrip-asn&asn=fixatrippuertorico&full-items=yes' }] },
        { nombre: 'Barrilito Rum Distillery Mixology Class', tipo: 'FareHarbor Online Booking', link_web: 'https://fixatrippuertorico.com/to_book/barrilito-rum-distilery-mixology-class/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/fixatrippuertorico/items/577943/?full-items=yes&flow=no' }] },
        { nombre: 'Barrilito Rum Distillery Tasting Tour', tipo: 'FareHarbor Online Booking', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/fixatrippuertorico/items/577957/?full-items=yes&flow=no' }] },
        { nombre: 'Beach Horseback Ride', tipo: 'FareHarbor Online Booking', operador: 'Carabali', link_web: 'https://fixatrippuertorico.com/to_book/beach-horseback-ride/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/carabalirainforestpark/items/15920/?asn=fhdn&asn-ref=fixatrippuertorico&full-items=yes&flow=no&ref=fixatrippuertorico' }] },
        { nombre: 'Bioluminescent Bay Experience', tipo: 'FareHarbor Online Booking', operador: 'Access Tour', link_web: 'https://fixatrippuertorico.com/to_book/bioluminescent-bay-experience/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/accesstourspr/items/8754/?button-tags=fixatrip-asn&ref=fixatrip-asn&asn=fixatrippuertorico&full-items=yes&flow=no' }] },
        { nombre: 'Bioluminescent Bay Experience with Transportation', tipo: 'FareHarbor Online Booking', operador: 'Access Tour', link_web: 'https://fixatrippuertorico.com/to_book/bioluminescent-bay-experience-transport/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/accesstourspr/items/211394/?button-tags=fixatrip-asn&ref=fixatrip-asn&asn=fixatrippuertorico&full-items=yes&flow=no' }] },
        { nombre: 'Culebra Island Beach & Snorkel', tipo: 'FareHarbor Online Booking', operador: 'Sail Getaways', link_web: 'https://fixatrippuertorico.com/to_book/beach-snorkel-dive-tour-to-culebra-island-puerto-rico/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/sailgetaway/items/34807/calendar/2025/05/?flow=no&language=en-us&asn=fixatrippuertorico&full-items=yes' }] },
        { nombre: 'Deep Sea Fishing Charter', tipo: 'FareHarbor Online Booking', operador: 'Castillo', link_web: 'https://fixatrippuertorico.com/to_book/deep-sea-fishing-charter/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/castillotours/items/?flow=201717&asn=fixatrippuertorico&full-items=yes' }] },
        { nombre: 'El Yunque + Luquillo Beach Combo', tipo: 'FareHarbor Online Booking', operador: 'Access Tour', link_web: 'https://fixatrippuertorico.com/to_book/rainforest-nature-walk-luquillo-beach-combo/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/accesstourspr/items/8752/?button-tags=fixatrip-asn&ref=fixatrip-asn&asn=fixatrippuertorico&full-items=yes&flow=no' }] },
        { nombre: 'Foodie Tour Countryside, Blue Pond & Coffee Plantation', tipo: 'FareHarbor Online Booking', link_web: 'https://fixatrippuertorico.com/to_book/foodie-tour-in-the-countryside-blue-pond-and-coffe-tour/', links: [{ label: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/fixatrippuertorico/items/562911/?full-items=yes&flow=no' }] },
        { nombre: 'Half Day Yunque AM', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/half-day-rainforest-tour-am/' },
        { nombre: 'Half Day Yunque PM', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/half-day-rainforest-tour-pm/' },
        { nombre: 'Icacos Double Dip Power Catamaran Snorkel & Beach', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/double-dip-power-catamaran-snorkelling-and-beach-tour/' },
        { nombre: 'Icacos Island Beach & Snorkel AM', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/icacos-island-beach-snorkel-am/' },
        { nombre: 'Icacos Island Beach & Snorkel PM', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/icacos-island-beach-snorkel-pm/' },
        { nombre: 'Icacos Luxury All Inclusive Sailing Catamaran', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/icacos-luxury-all-inclusive-sailing-catamaran/' },
        { nombre: 'Icacos Luxury Sailing Catamaran Twilight Beach & Sunset Sail', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/icacos-luxury-sailing-catamaran-twighlight-beach-sunset-sail/' },
        { nombre: 'Icacos Morning Sailing Catamaran Beach & Snorkel', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/cordillera-cays-sailing-catamaran-beach-snorkeling-tour/' },
        { nombre: 'Luquillo Beach Guided Jet Ski Trip', tipo: 'FareHarbor — Booking Request', link_web: 'https://fixatrippuertorico.com/to_book/luquillo-beach-guided-jet-ski-trip/' }
      ]
    },
    {
      id: 'wp_tips', titulo: 'Tips WordPress & Aclaraciones', icon: '💡',
      items: [
        {
          nombre: 'Aclaraciones del sistema de Tours (fixatrippuertorico.com)',
          tipo: 'WordPress Tips',
          info: 'Sección "Phone" se utiliza para mostrar la DURACIÓN del tour. Sección "Número máximo de invitados" se utiliza para mostrar la EDAD MÍNIMA. Si se coloca el número 100 se mostrará "All Ages".',
          links: [
            { label: 'Editar Tours (to_book)', url: 'https://fixatrippuertorico.com/wp-admin/edit.php?post_type=to_book' },
            { label: 'Search del Home (WPCode)', url: 'https://fixatrippuertorico.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=7796' },
            { label: 'Editar Header', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=6724&action=elementor' },
            { label: 'Editar Footer', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=7376&action=elementor' }
          ],
          credenciales: 'Usuario: fixatrip | Pass: Fix@2025@_'
        },
        {
          nombre: 'Aclaraciones del sistema de Tours (fixatrippr.com)',
          tipo: 'WordPress Tips',
          info: 'La palabra "Passenger" se puede cambiar por otra creando un código externo con el ID del post. Lo mismo para modificar la edad mínima del tour.',
          links: [
            { label: 'Editar Tours (st_tours)', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_tours' },
            { label: 'WPCode — Cambiar Passenger', url: 'https://fixatrippr.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=14952' },
            { label: 'WPCode — Modificar edad', url: 'https://fixatrippr.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=16576' },
            { label: 'WPCode — Menú custom', url: 'https://fixatrippr.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=20214' },
            { label: 'Editar Botes Privados', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_activity' }
          ],
          credenciales: 'Usuario: fixatrip | Pass: Coderhouse21'
        },
        {
          nombre: 'Booking Request — Cómo funciona',
          tipo: 'Flujo de trabajo',
          info: 'Cuando se hace un booking request a través del plugin Woocommerce/Zapier, ingresa automáticamente al CRM. También llega aviso por correo.'
        },
        {
          nombre: 'GoDaddy — Renovación dominio .com',
          tipo: 'Dominio',
          credenciales: 'godaddy.com | Usuario: 224506078 | Pass: Lanumero12',
          links: [{ label: 'GoDaddy', url: 'https://godaddy.com' }]
        }
      ]
    },
    {
      id: 'tours_web', titulo: 'Tours Web (con Links)', icon: '🏄',
      items: [
        { nombre: 'ATV Puerto Rico', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/atv-puerto-rico/' },
        { nombre: 'Beach Horseback Ride', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/beach-horseback-ride/' },
        { nombre: 'Dos Mares UTV Adventure', categoria: 'Adventure', operador: 'Off Road', link_web: 'https://fixatrippr.com/st_tour/dos-mares-utv-adventure/' },
        { nombre: 'Horseback Riding Puerto Rico', categoria: 'Adventure', link_web: 'https://fixatrippr.com/st_tour/horseback-riding-puerto-rico/' },
        { nombre: 'UTV Puerto Rico', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/utv-puerto-rico/' },
        { nombre: 'Yunque Rainforest Adventure & Luquillo Beach', categoria: 'Nature', operador: 'ACCESS TOUR', link_web: 'https://fixatrippr.com/st_tour/yunque-rainforest-adventure-luquillo-beach/' },
        { nombre: 'Zipline close to San Juan', categoria: 'Adventure', operador: 'Yunque Ziplining', link_web: 'https://fixatrippr.com/st_tour/zipline-close-to-san-juan/' },
        { nombre: 'Bioluminescent Bay Experience', categoria: 'Adventure', operador: 'Access Tour / Pure Adventure / Island Kayaking', info: 'Dom: Access es el único. Sáb: Access no lo hace. CON TRANSPORTE hasta 4pp: Access Tour. +4pp: transporte propio. SIN TRANSPORTE: siempre tratar Access Tour, 2da opción Pure Adventure.', link_web: 'https://fixatrippr.com/st_tour/bioluminescent-bay-experience/' },
        { nombre: 'Off the Beaten Path @ Yunque (Full Day)', categoria: 'Nature', operador: 'PR Experience / Paradise Seekers / Wonderlust', link_web: 'https://fixatrippr.com/st_tour/off-the-beaten-path-yunque-rainforest-hike-2/' },
        { nombre: '3 in 1 Icacos Snorkel Beach & Sunset Adventure', categoria: 'Boat Trips', operador: 'Sail Getaways', link_web: 'https://fixatrippr.com/st_tour/3-in-1-icacos-snorkel-beach-sunset-adventure/' },
        { nombre: 'Culebra Island Beach & Snorkel', categoria: 'Boat Trips', operador: 'Sea Ventures / Pure Adventure / Sail Gateway', info: 'Sea Ventures suele cancelar/cambiar tour.', link_web: 'https://fixatrippr.com/st_tour/beach-snorkel-dive-tour-to-culebra-island-puerto-rico/' },
        { nombre: 'Deep Sea Fishing Charter', categoria: 'Boat Trips', operador: 'Castillo', link_web: 'https://fixatrippr.com/st_tour/deep-sea-fishing-charter-4hs/' },
        { nombre: 'Icacos Double Dip Power Catamaran Snorkel & Beach', categoria: 'Boat Trips', info: 'Fajardo Afternoon, check-in by 1:00pm. $110 + taxes. Ages 2+.', link_web: 'https://fixatrippr.com/st_tour/icacos-double-dip-power-catamaran-snorkel-beach-tour/' },
        { nombre: 'Icacos Island Beach & Snorkel', categoria: 'Boat Trips', operador: 'Sail Gateways', link_web: 'https://fixatrippr.com/st_tour/icacos-island-beach-snorkel/' },
        { nombre: 'Luxury Inclusive Sailing Catamaran', categoria: 'Boat Trips', info: 'Icacos. 8:45am-3:00pm. $161+taxes pp. Máx 49 guests. No embarazadas, lesiones de espalda, niños menores 6.', link_web: 'https://fixatrippr.com/st_tour/luxury--inclusive-sailing-catamaran-2/' },
        { nombre: 'Morning Sailing Catamaran Icacos Beach & Snorkel', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/cordillera-cays-sailing-catamaran-beach-snorkeling-tour/' },
        { nombre: 'Vieques Island Beach & Snorkel (1/2 Day)', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/vieques-island-snorkel-beach-tour/' },
        { nombre: 'Vieques Island Beach & Snorkel (Full Day)', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/-inclusive-vieques-excursion-swim-with-turtles-and-enjoy-pristine-beaches/' },
        { nombre: 'Bacardi Distillery and Old San Juan Combo Tour', categoria: 'City & Nightlife', operador: 'San Juan Tour and Transfers', link_web: 'https://fixatrippr.com/st_tour/bacardi-distillery-and-old-san-juan-combo-tour/' },
        { nombre: 'Old San Juan Historical Walking Trip', categoria: 'City & Nightlife', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-historical-walking-trip/' },
        { nombre: 'Private Salsa Lesson Experience', categoria: 'City & Nightlife', info: 'Llamar a Melba', link_web: 'https://fixatrippr.com/st_tour/private-salsa-lesson-experience/' },
        { nombre: 'Old San Juan Morning Walk & Taste', categoria: 'City & Nightlife / Foodie', operador: 'Spoon', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-morning-walk-taste/' },
        { nombre: 'Sunset Walk & Taste Tour', categoria: 'City & Nightlife / Foodie', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-sunset-walk/' },
        { nombre: 'Tropicaleo Bar Hopping Tour', categoria: 'City & Nightlife', link_web: 'https://fixatrippr.com/st_tour/tropicaleo-bar-hopping-tour/' },
        { nombre: 'Barrilito Rum Distillery Mixology Class', categoria: 'Foodie', info: 'Se bookea por mail', link_web: 'https://fixatrippr.com/st_tour/barrilito-rum-distilery-mixology-class/' },
        { nombre: 'Barrilito Rum Distillery Tasting Tour', categoria: 'Foodie', link_web: 'https://fixatrippr.com/st_tour/barrilito-rum-distilery-tasting-tour/' },
        { nombre: 'Foodie Tour Countryside, Blue Pond & Coffee Plantation', categoria: 'Foodie / Nature', link_web: 'https://fixatrippr.com/st_tour/foodie-tour-in-the-countryside-blue-pond-and-coffe-tour/' },
        { nombre: 'El Yunque National Forest Park & Luquillo Beach Combo', categoria: 'Nature', info: 'Incluye tickets yunque. CONSULTAR A SERGIO.', link_web: 'https://fixatrippr.com/st_tour/rainforest-nature-walk-luquillo-beach-combo-2/' },
        { nombre: 'Half Day Yunque National Forest Park (con transporte)', categoria: 'Nature', operador: 'Puerto Rico Tour Desk / Tours 2 PR (Harry)', link_web: 'https://fixatrippr.com/st_tour/half-day-rainforest-tour-4hrs/' },
        { nombre: 'Guided Jet Ski Tour', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/guided-jet-ski-tour/' },
        { nombre: 'LED Night Kayak Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/led-night-kayak-experience/' },
        { nombre: 'Luquillo Beach Guided Jet Ski Trip', categoria: 'Water', operador: 'Puerto Rico Jet Ski', link_web: 'https://fixatrippr.com/st_tour/luquillo-beach-guided-jet-ski-trip-30/' },
        { nombre: 'Paddleboard Rental', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/paddleboard-rental/' },
        { nombre: 'San Juan Sunset Party Boat', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sunset-party-boat-san-juan/' },
        { nombre: 'Snorkeling Experience Tour', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/snorkeling-experience-tour/' },
        { nombre: 'Sunset Jet Ski Tour Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sunset-jet-ski-tour-experience/' },
        { nombre: 'Surfing Lesson Experience', categoria: 'Water', info: 'Llamar a Richard', link_web: 'https://fixatrippr.com/st_tour/surf-lessons-and-rentals-in-san-juan/' },
        { nombre: 'Tarpon Fishing', categoria: 'Water', operador: 'Magic Tarpon', link_web: 'https://fixatrippr.com/st_tour/tarpon-fishing/' },
        { nombre: 'Bicycle Kayak', categoria: 'Water in San Juan', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/bicycle-kayak/' },
        { nombre: 'Big Paddleboard', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/big-paddleboard/' },
        { nombre: 'Double Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/double-kayak/' },
        { nombre: 'Sea Scooter Guided Tour Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sea-scooter-guided-tour-experience/' },
        { nombre: 'Single Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/single-kayak/' },
        { nombre: 'Triple Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/triple-kayak/' },
        { nombre: 'Bike Rental', categoria: 'City', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/bike-rental/' }
      ]
    }
  ]
};

// ─── Prompt Editor ──────────────────────────────────────────────────────────
const VARIABLES = [
  { label: '{{nombre}}', desc: 'Nombre del lead' },
  { label: '{{telefono}}', desc: 'Teléfono' },
  { label: '{{email}}', desc: 'Email' },
  { label: '{{fecha}}', desc: 'Fecha actual' },
  { label: '{{agente}}', desc: 'Agente asignado' },
  { label: '{{INTENCION_COMPRA}}', desc: 'Marca intención de compra' },
];

function PromptEditor({ prompt, onSave, saving }) {
  const [text, setText] = useState(prompt || '');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setText(prompt || ''); setDirty(false); }, [prompt]);

  const insertVar = (v) => {
    const ta = document.getElementById('gigi-prompt-ta');
    if (!ta) { setText(t => t + v); setDirty(true); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    const next = text.slice(0, s) + v + text.slice(e);
    setText(next); setDirty(true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 10);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {VARIABLES.map(v => (
          <button key={v.label} onClick={() => insertVar(v.label)} title={v.desc}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {v.label}
          </button>
        ))}
      </div>
      <textarea id="gigi-prompt-ta" value={text} onChange={e => { setText(e.target.value); setDirty(true); }}
        rows={18} className="input w-full font-mono text-xs leading-relaxed" style={{ resize: 'vertical', minHeight: 300 }}
        placeholder="Escribe aquí el prompt del sistema para GIGI..." />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{text.length.toLocaleString()} caracteres</span>
        <button onClick={() => onSave(text)} disabled={saving || !dirty} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
          {saving ? 'Guardando...' : 'Guardar prompt'}
        </button>
      </div>
    </div>
  );
}

// ─── Welcome Email Editor ────────────────────────────────────────────────────
function WelcomeEditor({ template, onSave, saving }) {
  const [text, setText] = useState(template || '');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { setText(template || ''); setDirty(false); }, [template]);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {['HTML', 'Vista previa'].map((t, i) => (
          <button key={t} onClick={() => setPreview(i === 1)}
            className="px-3 py-1.5 text-xs rounded"
            style={{ background: preview === (i === 1) ? 'var(--accent)' : 'var(--surface)', color: preview === (i === 1) ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>
      {preview ? (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)', background: '#fff' }}>
          <iframe srcDoc={text.replace(/\{\{name\}\}/g, 'Cliente')} className="w-full" style={{ minHeight: 400, border: 'none' }} title="Preview" />
        </div>
      ) : (
        <textarea value={text} onChange={e => { setText(e.target.value); setDirty(true); }}
          rows={16} className="input w-full font-mono text-xs leading-relaxed" style={{ resize: 'vertical', minHeight: 280 }}
          placeholder="HTML del email de bienvenida... usa {{name}} para el nombre del cliente." />
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{text.length.toLocaleString()} caracteres</span>
        <button onClick={() => onSave(text)} disabled={saving || !dirty} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
          {saving ? 'Guardando...' : 'Guardar plantilla'}
        </button>
      </div>
    </div>
  );
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────
function KBCard({ item, section }) {
  const [open, setOpen] = useState(false);

  const fields = Object.entries(item).filter(([k]) =>
    !['nombre', 'tipo', 'telefono', 'link_web', 'link_mapa', 'links', 'contactos', 'lista', 'credenciales'].includes(k)
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button className="w-full text-left p-3 flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.nombre}</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {item.tipo && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>{item.tipo}</span>}
            {item.categoria && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>{item.categoria}</span>}
            {item.zona && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d' }}>{item.zona}</span>}
            {item.telefono && <span className="text-xs" style={{ color: 'var(--muted)' }}>📞 {item.telefono}</span>}
            {item.muelle && <span className="text-xs" style={{ color: 'var(--muted)' }}>⚓ {item.muelle}</span>}
            {item.capacidad && <span className="text-xs" style={{ color: 'var(--muted)' }}>👥 {item.capacidad}</span>}
          </div>
        </div>
        <span className="text-xs shrink-0 mt-1" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Credenciales (accesos web) */}
          {item.credenciales && (
            <div className="mt-2 p-2 rounded text-xs font-mono" style={{ background: 'rgba(255,255,255,0.04)', color: '#fcd34d' }}>
              🔑 {item.credenciales}
            </div>
          )}
          {/* Info fields */}
          {fields.map(([k, v]) => (
            <div key={k} className="text-xs" style={{ color: 'var(--muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text)' }}>{k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: </span>
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </div>
          ))}
          {/* Contactos array */}
          {item.contactos && (
            <div className="space-y-1">
              {item.contactos.map((c, i) => (
                <div key={i} className="text-xs flex gap-2" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)' }}>{c.nombre}</span>
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.nota && <span>— {c.nota}</span>}
                  {c.info && <span>— {c.info}</span>}
                </div>
              ))}
            </div>
          )}
          {/* Lista de sub-items (restaurantes, etc) */}
          {item.lista && (
            <div className="space-y-1">
              {item.lista.map((l, i) => (
                <div key={i} className="text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)' }}>{l.nombre}</span>
                  {l.zona && <span>({l.zona})</span>}
                  {l.link_mapa && <a href={l.link_mapa} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>📍 Mapa</a>}
                </div>
              ))}
            </div>
          )}
          {/* Links */}
          <div className="flex flex-wrap gap-2 mt-1">
            {item.link_web && (
              <a href={item.link_web} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', textDecoration: 'none' }}>
                🌐 Web
              </a>
            )}
            {item.link_mapa && (
              <a href={item.link_mapa} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', textDecoration: 'none' }}>
                📍 Mapa
              </a>
            )}
            {item.links && item.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', textDecoration: 'none' }}>
                🔗 {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeBase({ data, loading }) {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all');

  const sections = data?.sections || [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sections.map(sec => ({
      ...sec,
      items: sec.items.filter(item => {
        if (activeSection !== 'all' && sec.id !== activeSection) return false;
        if (!q) return activeSection === 'all' || sec.id === activeSection;
        const haystack = JSON.stringify(item).toLowerCase();
        return haystack.includes(q);
      })
    })).filter(sec => sec.items.length > 0);
  }, [sections, search, activeSection]);

  const totalResults = filtered.reduce((a, s) => a + s.items.length, 0);

  if (loading) return <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando conocimiento...</div>;

  if (!sections.length) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📚</div>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Base de conocimiento vacía</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Los datos se cargan automáticamente desde el servidor.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>🔍</span>
        <input
          className="input pl-8 w-full"
          placeholder="Buscar drivers, tours, botes, precios, teléfonos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {/* Section filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveSection('all')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
          style={{ background: activeSection === 'all' ? 'var(--accent)' : 'var(--surface)', color: activeSection === 'all' ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          Todo
        </button>
        {sections.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{ background: activeSection === sec.id ? 'var(--accent)' : 'var(--surface)', color: activeSection === sec.id ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            {sec.icon} {sec.titulo}
          </button>
        ))}
      </div>

      {search && (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {totalResults} resultado{totalResults !== 1 ? 's' : ''} para "{search}"
        </div>
      )}

      {/* Results */}
      {filtered.map(sec => (
        <div key={sec.id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{sec.icon}</span>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{sec.titulo}</h3>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>({sec.items.length})</span>
          </div>
          <div className="space-y-2">
            {sec.items.map((item, i) => (
              <KBCard key={i} item={item} section={sec} />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && search && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
          No se encontraron resultados para "{search}"
        </div>
      )}
    </div>
  );
}

// ─── Seed Panel ─────────────────────────────────────────────────────────────
function SeedPanel({ onSeeded, showToast }) {
  const [seeding, setSeeding] = useState(false);
  const seed = async () => {
    setSeeding(true);
    try {
      const r = await api.seedKnowledgeBase(KB_DATA, false);
      if (r.ok) onSeeded(KB_DATA);
      else showToast(r.message || 'Error', '#ef4444');
    } catch (e) { showToast(e.message || 'Error', '#ef4444'); }
    setSeeding(false);
  };
  return (
    <div className="text-center py-10 space-y-4">
      <div className="text-4xl">📂</div>
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Base de conocimiento no cargada</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          Carga toda la información operativa de Fix A Trip: drivers, botes, tours, operadores y accesos web.
        </div>
      </div>
      <div className="text-xs p-3 rounded-lg text-left space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {KB_DATA.sections.map(s => (
          <div key={s.id} className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <span>{s.icon}</span>
            <span>{s.titulo}</span>
            <span className="ml-auto text-xs">{s.items.length} entradas</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <span>Total</span>
          <span className="ml-auto font-medium" style={{ color: 'var(--text)' }}>
            {KB_DATA.sections.reduce((a, s) => a + s.items.length, 0)} entradas
          </span>
        </div>
      </div>
      <button onClick={seed} disabled={seeding} className="btn-primary px-6 py-2.5 text-sm">
        {seeding ? 'Cargando...' : '📚 Cargar base de conocimiento'}
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function BibliotecaGigiPage() {
  const [tab, setTab] = useState('conocimiento');
  const [prompt, setPrompt] = useState('');
  const [welcomeTemplate, setWelcomeTemplate] = useState('');
  const [kbData, setKbData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kbLoading, setKbLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [botActivo, setBotActivo] = useState(true);
  const [savingBot, setSavingBot] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, color = '#10b981') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await api.settings();
        setPrompt(cfg.prompt_sistema || '');
        setWelcomeTemplate(cfg.welcome_email_template || '');
        setBotActivo(cfg.bot_activo !== 'false');
        setKbLoading(true);
        try {
          const kb = JSON.parse(cfg.gigi_knowledge_base || 'null');
          setKbData(kb);
        } catch { setKbData(null); }
        setKbLoading(false);
      } catch { showToast('Error cargando configuración', '#ef4444'); }
      setLoading(false);
    };
    load();
  }, []);

  const savePrompt = async (text) => {
    setSaving(true);
    try { await api.saveSetting('prompt_sistema', text); setPrompt(text); showToast('Prompt guardado'); }
    catch { showToast('Error guardando prompt', '#ef4444'); }
    setSaving(false);
  };

  const saveWelcome = async (text) => {
    setSavingWelcome(true);
    try { await api.saveSetting('welcome_email_template', text); setWelcomeTemplate(text); showToast('Plantilla guardada'); }
    catch { showToast('Error guardando plantilla', '#ef4444'); }
    setSavingWelcome(false);
  };

  const toggleBot = async () => {
    setSavingBot(true);
    const next = !botActivo;
    try { await api.saveSetting('bot_activo', String(next)); setBotActivo(next); showToast(next ? 'GIGI activada' : 'GIGI desactivada'); }
    catch { showToast('Error', '#ef4444'); }
    setSavingBot(false);
  };

  const TABS = [
    { id: 'conocimiento', label: '📚 Conocimiento' },
    { id: 'prompt',       label: '🤖 Prompt GIGI' },
    { id: 'welcome',      label: '✉️ Bienvenida' },
    { id: 'config',       label: '⚙️ Config' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Biblioteca GIGI</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Base de conocimiento, prompt y configuración de la asistente virtual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>GIGI</span>
          <button onClick={toggleBot} disabled={savingBot}
            className={`relative w-11 h-6 rounded-full transition-colors ${botActivo ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: botActivo ? '24px' : '2px' }} />
          </button>
          <span className="text-xs font-medium" style={{ color: botActivo ? '#10b981' : 'var(--muted)' }}>
            {botActivo ? 'Activa' : 'Inactiva'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap px-1"
            style={{ background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--muted)', border: 'none', cursor: 'pointer', minWidth: 80 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conocimiento Tab */}
      {tab === 'conocimiento' && (
        <div className="card p-4">
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Base de conocimiento operativa</div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Toda la información de Fix A Trip: drivers, botes, tours, operadores, servicios y accesos web.
          </div>
            <KnowledgeBase data={kbData || KB_DATA} loading={kbLoading} />
        </div>
      )}

      {/* Prompt Tab */}
      {tab === 'prompt' && (
        <div className="card p-5">
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Prompt del sistema</div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Define la personalidad, reglas y comportamiento de GIGI. Los cambios aplican al próximo mensaje.
          </div>
          <PromptEditor prompt={prompt} onSave={savePrompt} saving={saving} />
        </div>
      )}

      {/* Welcome Email Tab */}
      {tab === 'welcome' && (
        <div className="card p-5">
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Plantilla de email de bienvenida</div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            HTML del email que se envía manualmente desde el perfil del lead. Usa <code className="px-1 rounded" style={{ background: 'var(--border)' }}>{'{{name}}'}</code> para el nombre del cliente.
          </div>
          <WelcomeEditor template={welcomeTemplate} onSave={saveWelcome} saving={savingWelcome} />
        </div>
      )}

      {/* Config Tab */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Estado del bot</div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div>
                <div className="text-sm" style={{ color: 'var(--text)' }}>GIGI responde automáticamente</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Cuando está activa, GIGI responde todos los mensajes entrantes</div>
              </div>
              <button onClick={toggleBot} disabled={savingBot}
                className={`relative w-12 h-6 rounded-full transition-colors ${botActivo ? 'bg-green-500' : 'bg-white/10'}`}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: botActivo ? '26px' : '2px' }} />
              </button>
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Información del sistema</div>
            <div className="space-y-0 text-xs" style={{ color: 'var(--muted)' }}>
              {[
                ['Modelo IA', 'claude-sonnet-4-6'],
                ['Canal principal', 'SMS + WhatsApp'],
                ['Email saliente', 'bookings@fixatrippr.com'],
                ['Clave prompt en DB', 'prompt_sistema'],
                ['Clave knowledge base', 'gigi_knowledge_base'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span>{k}</span>
                  <span className="font-mono" style={{ color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50"
          style={{ background: toast.color }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
