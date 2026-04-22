/**
 * Seed script: popula la Biblioteca GIGI con toda la información operativa de Fix A Trip.
 * Ejecutar: node backend/seed-biblioteca-gigi.js
 */
const { pool } = require('./services/db');

const KNOWLEDGE_BASE = {
  sections: [
    {
      id: 'accesos_web',
      titulo: 'Accesos & Sitios Web',
      icon: '🔑',
      items: [
        {
          nombre: 'fixatrippuertorico.com — Admin',
          tipo: 'Sitio Web Principal',
          info: 'Home page, contact form y link principal para cada tour.',
          links: [
            { label: 'Admin WP', url: 'https://fixatrippuertorico.com/admin' },
            { label: 'Editar Tours', url: 'https://fixatrippuertorico.com/wp-admin/edit.php?post_type=to_book' },
            { label: 'Editar Header', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=6724&action=elementor' },
            { label: 'Editar Footer', url: 'https://fixatrippuertorico.com/wp-admin/post.php?post=7376&action=elementor' },
            { label: 'Google Spreadsheet Tours', url: 'https://docs.google.com/spreadsheets/d/1VV4YSkayaQ0Dr4_S94iFTUZv6PcHKbZzraGTghQhfoU/edit?usp=sharing' }
          ],
          credenciales: 'Usuario: fixatrip | Pass: Fix@2025@_ | Hosting: wnpower.com (fixatrip@komunikacion.com.ar / Coderhouse21@) | GoDaddy: 224506078 / Lanumero12'
        },
        {
          nombre: 'fixatrippr.com — Admin',
          tipo: 'Sitio Web Secundario',
          info: 'Redirige automáticamente a fixatrippuertorico.com via plugin 301 Redirects. Booking Request de tours.',
          links: [
            { label: 'Admin WP', url: 'https://fixatrippr.com/wp-login.php' },
            { label: 'Editar Tours (Booking Request)', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_tours' },
            { label: 'Editar Botes Privados', url: 'https://fixatrippr.com/wp-admin/edit.php?post_type=st_activity' },
            { label: 'Fix a Chef', url: 'https://fixatrippr.com/fix-a-chef/' },
            { label: 'Fix a Transport', url: 'https://fixatrippr.com/fix-a-transport/' },
            { label: 'Fix a Wellness', url: 'https://fixatrippr.com/fix-a-wellness/' }
          ],
          credenciales: 'Usuario: fixatrip | Pass: Coderhouse21 | Hosting: wnpower.com (tomas@fixatrippr.com / Coderhouse21@)'
        }
      ]
    },
    {
      id: 'drivers_guias_chefs',
      titulo: 'Drivers, Guías & Chefs',
      icon: '🚐',
      items: [
        {
          nombre: 'Jaime',
          tipo: 'Driver — Nuestra Guagua',
          telefono: '787 399 0152',
          capacidad: '14pp sin equipaje / 10pp con equipaje',
          costo: '$60/hr espera + $15 c/15min. 8 horas sueldo $120, overtime $15/hora.',
          disponibilidad: 'Con disponibilidad'
        },
        {
          nombre: 'Lusito',
          tipo: 'Guía y Driver',
          zona: 'RAINFOREST',
          telefono: '(939) 375-0993',
          capacidad: '6 pasajeros en su auto'
        },
        {
          nombre: 'Christian',
          tipo: 'Guía y Driver',
          telefono: '787 632 7652',
          info: 'Disponibilidad depende de hijos'
        },
        {
          nombre: 'Melba',
          tipo: 'Instructora Yoga & Driver con nuestra guagua',
          zona: 'YOGA',
          telefono: '1 (787) 274-0061'
        },
        {
          nombre: 'Mike',
          tipo: 'Driver',
          telefono: '1 (787) 674-3766',
          capacidad: '14pp sin equipaje / 10pp con equipaje',
          info: 'VIVE EN RIO GRANDE — más barato para viajes a Fajardo.'
        },
        {
          nombre: 'Miguel y Mike hijo',
          tipo: 'Driver',
          telefono: '860 234 8316',
          capacidad: 'Hasta 25 pasajeros con equipaje',
          zona: 'Area Este / no noche tarde',
          info: 'A Fajardo mínimo $200 o $25 round trip / $12.50 one way. Resuelve mucho pero se ofende rápido.'
        },
        {
          nombre: 'Hector lindo taxi (White Ford Van)',
          tipo: 'Driver',
          telefono: '787-366-6354',
          capacidad: '14 pasajeros sin equipaje, 10 con maletas',
          zona: 'Desde Transit-Metro Area - Late night',
          info: 'ESTÁ EN SAN JUAN — para transfers a Fajardo NO. Asientos individuales.'
        },
        {
          nombre: 'Dario (Honda Odyssey white)',
          tipo: 'Driver',
          telefono: '787-320-2523',
          capacidad: '6pp / 4 con maletas',
          zona: 'Área metro'
        },
        {
          nombre: 'Pablo (Tico)',
          tipo: 'Solo Guía',
          telefono: '787-420-8809'
        },
        {
          nombre: 'Pepo',
          tipo: 'Driver (cobra por hora)',
          telefono: '(787) 594-2881',
          capacidad: '30 pasajeros',
          info: 'De 10 PP y va a ser a Fajardo. Cobra $75 p/hs la espera. CARABALI (ATV) tiene transporte.'
        },
        {
          nombre: 'Mario Acevedo (CARABALI Transport)',
          tipo: 'Driver',
          telefono: '787-547-6941',
          info: 'Book por app + 24hs inmediata anticipación. Pick-up 1.5 hora antes del booking. Viaje 30-45 min a Carabali.',
          links: [{ label: 'Formulario', url: 'https://forms.zohopublic.com/greattourspr/form/Transportationrequest/formperma/ppV-tv-urnP45uHG5SBI_2wNmcnByi-YHQSP0DmeUSw' }]
        },
        {
          nombre: 'Alvin (SEA VENTURE / YUNQUE ZIP)',
          tipo: 'Driver',
          telefono: '787-209-2127',
          info: 'Sea venture - Alvin es el transportista de esa excursión. $60 la hora de stop desde que llega al lugar, después $15 c/15min.'
        },
        {
          nombre: 'Uli',
          tipo: 'Driver (amigo de Sergio)',
          info: 'Los viernes no puede, solo de noche.'
        },
        {
          nombre: 'Osorio',
          tipo: 'Driver',
          telefono: '787 635 9786'
        },
        {
          nombre: 'Luz',
          tipo: 'Driver (tiene empresa)',
          telefono: '787-685-9666'
        },
        {
          nombre: 'Janice',
          tipo: 'Chef',
          info: 'Demora en contestar. Comida más tranquila, puertorriqueña. No hace más de 17 personas.',
          links: [{ label: 'Google Drive (Menús)', url: 'https://drive.google.com/drive/folders/1C5wicbjg-TDGFk6xxqjzVP9fL7p1nLY5?usp=share_link' }],
          costo: 'Chef fee $375 por servicio (depende del grupo), menús desde $35 pp.'
        },
        {
          nombre: 'Zuli',
          tipo: 'Chef',
          info: 'No hace más de 17 personas, comida más exótica. NO PASARLE EVENTOS MÁS DE 30 DÍAS PARA ADELANTE DE LAS 18HS. LUNES DÍA LIBRE Y VIERNES MÁS TEMPRANO.'
        },
        {
          nombre: 'Party Bus Vida Nauta',
          tipo: 'Transport',
          contacto: 'Jose Peña',
          telefono: '787 226 9683'
        }
      ]
    },
    {
      id: 'botes',
      titulo: 'Botes & Yachts',
      icon: '⛵',
      items: [
        {
          nombre: 'ANANDA — Marine Trader 42\'',
          contacto: 'Bebo/Adriana',
          telefono: '787 447 1682',
          muelle: 'Pier B30 - Puerto Chico',
          capacidad: 'Hasta 12pp',
          link_mapa: 'https://maps.app.goo.gl/69Pk8zJx3LAPvSUE8'
        },
        {
          nombre: 'VIDA NAUTA — Cruiser Yacht 54\'',
          contacto: 'Jose Peña',
          telefono: '787 226 9683',
          muelle: 'Muelle 1430 - Marina Puerto del Rey',
          capacidad: 'Hasta 12pp',
          costo: '4hs $2,750 (incl. crew fee $350) | 6hs $3,250 | 8hs $4,500 | Hora extra $300',
          incluye: '2 proteins: chicken/steak/pork/salmon/shrimp. Coke, Sprite, water, Tito\'s Vodka, Don Q Rum. Fruit cocktail, chips with cheese dip.',
          jetski: 'Jetski $400 VN / $450 Fix a Trip | Seabob $300 VN / $350 Fix a Trip',
          link_mapa: 'https://maps.app.goo.gl/W3APJkLA7NANQXaV9'
        },
        {
          nombre: 'VIDA NAUTA — Riviera 40\' "Mordidita"',
          muelle: 'Muelle 926',
          costo: '4hs $1,450 + $350 crew (total $1,800) | 6hs $1,850 + $350 crew | Hora extra $175',
          cancelacion: '10 días para refund',
          incluye_4hs: '1 protein: chicken/grain salad/pork. Sides: Caesar salad, chips, garlic bread, tacos. Sodas, water, beers, 1 bottle rum. Fruit cocktail. Floats, snorkeling, paddleboard, BBQ.',
          incluye_6hs: '2 proteins: chicken/fish/seafood/grain salad/pork/steak. Coke, Sprite, water, Medalla case, rum, whiskey, vodka. Fruit cocktail. Floats, snorkeling, paddleboard, BBQ.'
        },
        {
          nombre: 'VIDA NAUTA — Wellcraft',
          muelle: 'Muelle 310',
          capacidad: 'Hasta 6pp ($80pp adicional, 8pax máx.)',
          costo: '4hs $1,200 + $350 crew | Hora extra $150 | ($500 si es 2do bote de VN)',
          incluye_4hs: 'Chips with salsa and cheese, fruit cocktail, Coke, Sprite, water, local beer. Sin almuerzo.',
          incluye_6hs: 'Coke, Sprite, water, Medalla case, 1L Don Q, BBQ chicken, salad, chips, fruit cocktail.'
        },
        {
          nombre: 'TYARA 39\'',
          muelle: 'Marina Sardinera',
          costo: '$1,950 + $350 crew',
          incluye: 'Coke, Sprite, water, 1L Don Q Rum, 1L vodka, Medallion case, chips, fruit cocktail. Elegir 1 almuerzo: seafood/steak/chicken/pork + Caesar salad + garlic bread.',
          link_mapa: 'https://maps.app.goo.gl/E7BvJuKUdQeQ7Wqb6'
        },
        {
          nombre: 'VIDA NAUTA — Lagoon 42 "Yammuy"',
          muelle: 'Muelle T del Muelle 3 - Marina Puerto del Rey, Fajardo',
          costo: 'Icacos/Palomino 4hs $2,000 + $350 | 6hs $2,250 | Culebra/Vieques $3,150 + $350 | Hora extra $250',
          incluye_4hs: '2 proteins: BBQ chicken o pork soft tacos. Caesar salad, chips, garlic bread, grain salad, fruit cocktail. Sodas, local beer case, 1 bottle rum.',
          incluye_6hs: 'Coke, Sprite, water, 1L Don Q, 1L vodka, Medallion case, chips, fruit cocktail. 2 proteins advance: seafood/steak/chicken/pork. Caesar salad, garlic bread.'
        },
        {
          nombre: 'RICHY Navarro — Grady White 30\'',
          telefono: '787-313-6513',
          muelle: 'Puerto del Rey (Larissa E)',
          capacidad: 'Hasta 6pp',
          costo: '$995 / 7 horas | Paquete completo 12pp: $2,000 (6hs, 2 proteins, salad, tacos, Coke, Sprite, agua, Medalla case, Don Q 1L, Tito Vodka 1L, 2 islas) | Culebra/Vieques +$1,000 | Culebrita +$300',
          paquete_4hs: '$1,600 (9am-1pm o 2pm-6pm) incl. Coke, Sprite, agua, cervezas, tacos de pollo, chips, fruit cocktail.'
        },
        {
          nombre: 'PLAYERO — Sea Ray 51\'',
          contacto: 'Davnia',
          muelle: 'Villa Marina',
          incluye: 'Floats, snorkeling gear, paddleboard, music, air a/c, BBQ grill.',
          overnight: '$3,500 overnight Culebra/Vieques/Culebrita/St Thomas/St Jones. Sin comida. 3 cuartos. Mínimo 2 días para reservar.',
          link_mapa: 'https://maps.app.goo.gl/qzYaHYwAN8kGJ57X8'
        },
        {
          nombre: 'MICHAEL SIERRA — Tourquesa (Grady White 33\')',
          telefono: '787-377-4937',
          capacidad: '6 personas',
          costo: '$995 / 5-6 horas / 3 islas',
          info: 'Captain and crew fee $350 pagado al crew al check-in, NO incluido en invoice.'
        },
        {
          nombre: '787 Yachts — Ocean 49"',
          capacidad: '12 personas',
          info: 'Payment: 50% depósito requerido. Balance 10 días antes del charter.'
        },
        {
          nombre: 'SAIL GETAWAYS — Newton 32, 48" & Catamarán',
          telefono: '(787) 863-3483',
          muelle: 'M-20 Villa Marina Yacht Harbor / Dock M-21, Fajardo',
          precios: 'Culebra Snorkel: $2,495 / 25pp ($100 adicional pp). Public catamaran 30pp: $2,995. Shared from San Juan: $60pp / $195 privado.',
          cancelacion: 'Mínimo 7 días antes para refund completo. Weather: refund completo o fecha alternativa (solo capitán autoriza).',
          links: [{ label: 'Ver todos los tours', url: 'https://sailgetaway.com/all-charters/' }, { label: 'Instrucciones para llegar', url: 'https://sailgetaway.com/driving-directions/' }]
        },
        {
          nombre: 'WATERTIME — Azimut 68\' (Culebra)',
          contacto: 'Juliana',
          telefono: '787 692 6782 / 305-310-4979',
          muelle: 'Puerto Chico Leopard - Emilia',
          incluye: 'Snacks, dips, charcuterie board, fruit cocktail, sodas, water, beer, ice and cooler. You can bring your own (no coolers).',
          link_mapa: 'https://maps.app.goo.gl/8a3bSnyY9TiqDuhw9'
        }
      ]
    },
    {
      id: 'operadores_tours',
      titulo: 'Operadores de Tours & Actividades',
      icon: '🗺️',
      items: [
        {
          nombre: 'ACCESS TOURS',
          contacto: 'Alex y Alvinio',
          telefono: '787-421-1800',
          zona: 'Yunque, Bio Bay',
          info: 'No aceptan Non-swimmers para el Bio. Máx 230 lbs. Pick-up: La Concha 8:45am, Fairmont 9:15am. Afternoon 4:30pm La Concha, 4:45pm Fairmont.',
          precios: '1- Bio bay desde La Concha o Fairmont: $115pp (tour + transporte). 2- Trio Yunque/Biobay/Luquillo con transporte: $165pp',
          link_mapa: 'https://maps.app.goo.gl/1JrgUJWWTkcXZ7Z16'
        },
        {
          nombre: 'Tours2PR',
          contacto: 'Harry',
          telefono: '787 223 2777',
          zona: 'Yunque, San Juan',
          info: 'Meeting: Al lado de Don Pepe 12:55pm. Liquor Store Las Picuas.',
          precios: '1/2 day Yunque Afternoon',
          link_mapa: 'https://maps.app.goo.gl/w5pBp8j4BFBmxgRt8'
        },
        {
          nombre: 'PR Experiences',
          contacto: 'Lesley',
          telefono: '402 709 0654',
          zona: 'Yunque, Off the beaten path',
          info: 'Meeting: Supermax 9:15am-12:15pm / RALPH\'S 10:20am-1:30pm.',
          precios: 'OFF the beaten path: $30 sin transporte / $50pp con transporte',
          links: [{ label: 'Web', url: 'https://prexperiencetours.com/product-category/el-yunque-tour/' }]
        },
        {
          nombre: 'PR TourDesk',
          contacto: 'Frankie',
          telefono: '787-309-9826',
          zona: 'Yunque 1/2 day Morning, Yunque Zip'
        },
        {
          nombre: 'Pure Adventure',
          telefono: '788 202 6551',
          zona: 'Snorkeling Culebra/Vieques',
          info: 'Para el Bio mínimo 220 lbs.',
          link_mapa: 'https://maps.app.goo.gl/aXPuM9xJA1Yk5eQk8'
        },
        {
          nombre: 'Getaways / Sail Getaways',
          telefono: '787-860-7327',
          zona: 'Fajardo, Bio Bay, Catamarán',
          info: 'Dock M-21, Catamaran, Getaway. Buscan por Hotels y Kasalta bakery.',
          link_mapa: 'https://maps.app.goo.gl/SukbLnvdRa1zSpy79'
        },
        {
          nombre: 'VIP Jet Skis',
          zona: 'Jet Skis',
          link_mapa: 'https://maps.app.goo.gl/jK37hsfq5VCeXpCm9'
        },
        {
          nombre: 'Carabalí',
          zona: 'ATV, ECO Ziplining, Horseback',
          info: 'Donde se hacen los ATV. También tiene transporte.'
        },
        {
          nombre: 'Paradise Seekers',
          zona: 'Horseback Ride, Bio Bay, Kayak',
          precios: '$45pp sin transporte / $65 con transporte (Rainforest Horseback Ride)'
        },
        {
          nombre: 'Barrilito',
          contacto: 'Virgen',
          zona: 'Rum Distillery Tour & Mixology',
          info: 'Enviar email a Virgen cc: con detalles del booking request. Ver TEMPLATE del INVOICE en email.',
          link_mapa: 'https://maps.app.goo.gl/vnUNXrn8ktHSNTHT6'
        },
        {
          nombre: 'JM (Off the Beaten Path)',
          telefono: '939 475 6100',
          zona: 'Yunque / Rainforest',
          precios: '$40pp | $150 JM + $120 Driver',
          info: 'JM quiere 2 guías para 8 o más pax. Meeting: Frutera Luquillo.',
          link_mapa: 'https://maps.app.goo.gl/S3oZwckGm4Z5nfRa7'
        },
        {
          nombre: 'FOTOGRAFO — Alfonso',
          telefono: '787-717-7925',
          zona: 'Fotografía',
          precios: '1 hora: $195 | Segunda hora: $150'
        }
      ]
    },
    {
      id: 'otros_servicios',
      titulo: 'Otros Servicios',
      icon: '🌟',
      items: [
        {
          nombre: 'Masajistas (Servicio a Villa)',
          tipo: 'Masajes',
          info: 'Massage Therapists $125/hora, van a la villa del cliente.',
          contactos: [
            { nombre: 'Lucia', telefono: '787-923-3464' },
            { nombre: 'Juneilis', telefono: '787-923-9281' },
            { nombre: 'Yashira', telefono: '787-446-4362', nota: 'Conocida de Juneilis' }
          ]
        },
        {
          nombre: 'Instructoras de Salsa',
          tipo: 'Clases de Salsa',
          precios: '$30-$35pp según tamaño del grupo',
          contactos: [
            { nombre: 'Yaliris', telefono: '+1 (939) 274-3967' },
            { nombre: 'Flor', telefono: '+1 (787) 932-1725' },
            { nombre: 'Carmen', telefono: '1 (787) 631-8818' }
          ]
        },
        {
          nombre: 'Guía Old San Juan',
          tipo: 'Tour Old SJ'
        },
        {
          nombre: 'Pastelerías',
          tipo: 'Pastelerías',
          contactos: [
            { nombre: 'Ozzie Forbes', telefono: '(787) 565-0423' },
            { nombre: "Lulo's", telefono: '1 (787) 514-5823' },
            { nombre: 'Poliniza', telefono: '1 (787) 613-7227', direccion: '57 Cjón. Báez' }
          ]
        },
        {
          nombre: 'Rental de Vans',
          tipo: 'Rental',
          contactos: [
            { nombre: 'Flagship (Carolina)', telefono: '368', info: '15pp, depósito $500' },
            { nombre: 'Cabrera Auto', info: 'No alquilan más' }
          ]
        },
        {
          nombre: 'Restaurantes',
          tipo: 'Restaurantes',
          lista: [
            { nombre: 'FOGO DE CHAO', zona: 'Fajardo', link_mapa: 'https://maps.app.goo.gl/DX3QPnTUnihiWZJr5' },
            { nombre: 'Sábalos Marina Grill & Rooftop', zona: 'Fajardo', link_mapa: 'https://maps.app.goo.gl/mMCkg8c3xc4hMkCw8' },
            { nombre: 'Metropol Restaurant - Sheraton Hotel Convention Center', zona: 'San Juan', link_mapa: 'https://maps.app.goo.gl/RkfMMw6ytqpMmf2K6' },
            { nombre: 'Pescaito', zona: 'San Juan', link_mapa: 'https://maps.app.goo.gl/42i47HrA9didiid28' }
          ]
        }
      ]
    },
    {
      id: 'tours_web',
      titulo: 'Tours Web (con Links)',
      icon: '🏄',
      items: [
        { nombre: 'ATV Puerto Rico', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/atv-puerto-rico/' },
        { nombre: 'Beach Horseback Ride', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/beach-horseback-ride/' },
        { nombre: 'Dos Mares UTV Adventure', categoria: 'Adventure', operador: 'Off Road', link_web: 'https://fixatrippr.com/st_tour/dos-mares-utv-adventure/' },
        { nombre: 'Horseback Riding Puerto Rico', categoria: 'Adventure', link_web: 'https://fixatrippr.com/st_tour/horseback-riding-puerto-rico/' },
        { nombre: 'UTV Puerto Rico', categoria: 'Adventure', operador: 'Carabali', link_web: 'https://fixatrippr.com/st_tour/utv-puerto-rico/' },
        { nombre: 'Yunque Rainforest Adventure & Luquillo Beach', categoria: 'Adventure / Nature', operador: 'ACCESS TOUR', link_web: 'https://fixatrippr.com/st_tour/yunque-rainforest-adventure-luquillo-beach/' },
        { nombre: 'Zipline close to San Juan', categoria: 'Adventure', operador: 'Yunque Ziplining', link_web: 'https://fixatrippr.com/st_tour/zipline-close-to-san-juan/' },
        { nombre: 'Bioluminescent Bay Experience', categoria: 'Adventure', operador: 'Access Tour (Dom.) / Pure Adventure / Island Kayaking', link_web: 'https://fixatrippr.com/st_tour/bioluminescent-bay-experience/', info: 'Dom: Access es el único que lo hace. Sáb: Access no lo hace. CON TRANSPORTE hasta 4pp: Access Tour. +4pp: transporte propio. SIN TRANSPORTE: siempre tratar Access Tour, 2da opción Pure Adventure, 3ra Island Kayaking.' },
        { nombre: 'Off the beaten path @ Yunque Rainforest & Luquillo Beach (Full Day)', categoria: 'Nature', operador: 'PR Experience (<4pp) / Paradise Seekers / Wonderlust', link_web: 'https://fixatrippr.com/st_tour/off-the-beaten-path-yunque-rainforest-hike-2/' },
        { nombre: '3 in 1 Icacos Snorkel Beach & Sunset Adventure', categoria: 'Boat Trips', operador: 'Sail Getaways', link_web: 'https://fixatrippr.com/st_tour/3-in-1-icacos-snorkel-beach-sunset-adventure/' },
        { nombre: 'Culebra Island Beach & Snorkel', categoria: 'Boat Trips / All Inclusive', operador: 'Sea Ventures / Pure Adventure / Sail Gateway', link_web: 'https://fixatrippr.com/st_tour/beach-snorkel-dive-tour-to-culebra-island-puerto-rico/', info: 'Sea Ventures suele cancelar/cambiar tour.' },
        { nombre: 'Culebra Reefs Dive Excursion', categoria: 'Boat Trips', operador: 'SEA VENTURES', link_web: 'https://fixatrippr.com/st_tour/culebra-reefs-dive-excursion/' },
        { nombre: 'Culebra Flamingo Beach (Sail Getaways)', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/' },
        { nombre: 'Deep Sea Fishing Charter', categoria: 'Boat Trips', operador: 'Castillo', link_web: 'https://fixatrippr.com/st_tour/deep-sea-fishing-charter-4hs/' },
        { nombre: 'Icacos Double Dip Power Catamaran Snorkel & Beach', categoria: 'Boat Trips', info: 'Fajardo Afternoon, check-in by 1:00pm. $110 + taxes. Ages 2+.', link_web: 'https://fixatrippr.com/st_tour/icacos-double-dip-power-catamaran-snorkel-beach-tour/' },
        { nombre: 'Icacos Island Beach & Snorkel', categoria: 'Boat Trips', operador: 'Sail Gateways', link_web: 'https://fixatrippr.com/st_tour/icacos-island-beach-snorkel/' },
        { nombre: 'Luxury Inclusive Sailing Catamaran', categoria: 'Boat Trips', info: 'Icacos. 8:45am–3:00pm. $161+taxes pp. Máx 49 guests. No pregnant women, back injuries, or children under 6.', link_web: 'https://fixatrippr.com/st_tour/luxury--inclusive-sailing-catamaran-2/' },
        { nombre: 'Morning Sailing Catamaran Icacos Beach & Snorkel', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/cordillera-cays-sailing-catamaran-beach-snorkeling-tour/' },
        { nombre: 'Vieques Island Beach & Snorkel (1/2 Day)', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/vieques-island-snorkel-beach-tour/' },
        { nombre: 'Vieques Island Beach & Snorkel (Full Day)', categoria: 'Boat Trips', link_web: 'https://fixatrippr.com/st_tour/-inclusive-vieques-excursion-swim-with-turtles-and-enjoy-pristine-beaches/' },
        { nombre: 'Bacardi Distillery and Old San Juan Combo Tour', categoria: 'City & Nightlife', operador: 'San Juan Tour and Transfers', link_web: 'https://fixatrippr.com/st_tour/bacardi-distillery-and-old-san-juan-combo-tour/' },
        { nombre: 'Old San Juan Historical Walking Trip', categoria: 'City & Nightlife', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-historical-walking-trip/' },
        { nombre: 'Private Salsa Lesson Experience', categoria: 'City & Nightlife', info: 'Llamar a Melba', link_web: 'https://fixatrippr.com/st_tour/private-salsa-lesson-experience/' },
        { nombre: 'Sea Scooter Guided Tour Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sea-scooter-guided-tour-experience/' },
        { nombre: 'Old San Juan Morning Walk & Taste', categoria: 'City & Nightlife / Foodie', operador: 'Spoon', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-morning-walk-taste/' },
        { nombre: 'Sunset Walk & Taste Tour', categoria: 'City & Nightlife / Foodie', link_web: 'https://fixatrippr.com/st_tour/old-san-juan-sunset-walk/' },
        { nombre: 'Tropicaleo Bar Hopping Tour', categoria: 'City & Nightlife', link_web: 'https://fixatrippr.com/st_tour/tropicaleo-bar-hopping-tour/' },
        { nombre: 'Barrilito Rum Distillery Mixology Class', categoria: 'Foodie', info: 'Se bookea por mail', link_web: 'https://fixatrippr.com/st_tour/barrilito-rum-distilery-mixology-class/' },
        { nombre: 'Barrilito Rum Distillery Tasting Tour', categoria: 'Foodie', link_web: 'https://fixatrippr.com/st_tour/barrilito-rum-distilery-tasting-tour/' },
        { nombre: 'Foodie Tour Countryside, Blue Pond & Coffee Plantation', categoria: 'Foodie / Nature', link_web: 'https://fixatrippr.com/st_tour/foodie-tour-in-the-countryside-blue-pond-and-coffe-tour/' },
        { nombre: 'El Yunque National Forest Park & Luquillo Beach Combo', categoria: 'Nature', info: 'Incluye tickets yunque. CONSULTAR A SERGIO.', link_web: 'https://fixatrippr.com/st_tour/rainforest-nature-walk-luquillo-beach-combo-2/' },
        { nombre: 'Half Day Yunque National Forest Park (con transporte)', categoria: 'Nature', operador: 'Puerto Rico Tour Desk / Tours 2 PR (Harry)', link_web: 'https://fixatrippr.com/st_tour/half-day-rainforest-tour-4hrs/' },
        { nombre: 'Bicycle Kayak', categoria: 'Water in San Juan', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/bicycle-kayak/' },
        { nombre: 'Big Paddleboard', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/big-paddleboard/' },
        { nombre: 'Double Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/double-kayak/' },
        { nombre: 'Double Paddle Board', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/double-paddle-board/' },
        { nombre: 'Guided Jet Ski Tour', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/guided-jet-ski-tour/' },
        { nombre: 'LED Night Kayak Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/led-night-kayak-experience/' },
        { nombre: 'Luquillo Beach Guided Jet Ski Trip', categoria: 'Water', operador: 'Puerto Rico Jet Ski', link_web: 'https://fixatrippr.com/st_tour/luquillo-beach-guided-jet-ski-trip-30/' },
        { nombre: 'Paddleboard Rental', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/paddleboard-rental/' },
        { nombre: 'San Juan Sunset Party Boat', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sunset-party-boat-san-juan/' },
        { nombre: 'Single Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/single-kayak/' },
        { nombre: 'Snorkeling Experience Tour', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/snorkeling-experience-tour/' },
        { nombre: 'Sunset Jet Ski Tour Experience', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/sunset-jet-ski-tour-experience/' },
        { nombre: 'Surfing Lesson Experience', categoria: 'Water', info: 'Llamar a Richard', link_web: 'https://fixatrippr.com/st_tour/surf-lessons-and-rentals-in-san-juan/' },
        { nombre: 'Tarpon Fishing', categoria: 'Water', operador: 'Magic Tarpon', link_web: 'https://fixatrippr.com/st_tour/tarpon-fishing/' },
        { nombre: 'Triple Kayak', categoria: 'Water', link_web: 'https://fixatrippr.com/st_tour/triple-kayak/' },
        { nombre: 'Bike Rental', categoria: 'City', operador: 'VIP Adventure', link_web: 'https://fixatrippr.com/st_tour/bike-rental/' }
      ]
    }
  ]
};

async function seed() {
  try {
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ('gigi_knowledge_base', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(KNOWLEDGE_BASE)]
    );
    console.log('✅ Biblioteca GIGI — Knowledge base seeded successfully.');
    console.log(`   Sections: ${KNOWLEDGE_BASE.sections.length}`);
    KNOWLEDGE_BASE.sections.forEach(s => {
      console.log(`   - ${s.titulo}: ${s.items.length} items`);
    });
  } catch (err) {
    console.error('❌ Error seeding:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
