const https = require('https');
const jwt = require('jsonwebtoken');

const TOKEN = jwt.sign(
  { id: 1, name: 'Admin', email: 'admin@crm.com', role: 'admin' },
  'fixatrip-crm-2026-secret-xyz',
  { expiresIn: '2h' }
);

const BASE = 'crm-ia-production-c247.up.railway.app';
const WM = 'https://upload.wikimedia.org/wikipedia/commons';

const tours = [
  { name: "Icacos 3 in 1 Snorkel Beach & Sunset Adventure", slug: "icacos-3-in-1-snorkel-beach-sunset", price: 110, duration: "4 hrs", location: "Fajardo", rating: 4.9, ratingCount: 280, age: "All Ages", category: "boat-trips", featured: true,
    image: WM+"/9/90/Isle_of_Icacos_I.jpg",
    description: "The ultimate combo: snorkeling, beach time, and a stunning Caribbean sunset at Icacos island.", highlights: ["Icacos island snorkeling","Beach time","Caribbean sunset","Boat tour"], included: ["Snorkel gear","Life jackets","Guide"], notIncluded: ["Lunch","Alcoholic drinks"] },
  { name: "Vieques Island Beach & Snorkel (Full Day)", slug: "vieques-island-full-day", price: 167, duration: "8am-1:30pm", location: "Fajardo", rating: 4.9, ratingCount: 195, age: "All Ages", category: "boat-trips", featured: true,
    image: "https://i0.wp.com/www.latinabroad.com/wp-content/uploads/2012/04/Blue-Beach-Vieques-water.png",
    description: "Full day trip to Vieques Island, home to pristine beaches and wild horses roaming free. Snorkel, swim, and explore paradise.", highlights: ["Vieques pristine beaches","Wild horses","Snorkeling","Full day"], included: ["Transport","Snorkel gear","Guide"], notIncluded: ["Lunch","Drinks"] },
  { name: "ATV Puerto Rico", slug: "atv-puerto-rico", price: 80, duration: "1 hr", location: "Luquillo", rating: 4.7, ratingCount: 142, age: "16+", category: "adventure", featured: false,
    image: "https://carabalirainforestpark.com/wp-content/uploads/sites/5932/2019/04/7R38829.jpg",
    description: "Ride powerful ATVs through the lush terrain near Luquillo and El Yunque. Perfect for thrill-seekers.", highlights: ["Off-road trails","Mountain views","Safety briefing","Small groups"], included: ["ATV rental","Helmet","Guide"], notIncluded: ["Transport","Gratuity"] },
  { name: "Bacardi Distillery & Old San Juan Combo", slug: "bacardi-old-san-juan-combo", price: 99, duration: "3.5 hrs", location: "Old San Juan", rating: 4.8, ratingCount: 167, age: "21+", category: "city-nightlife", featured: false,
    image: WM+"/1/17/Bacardi_Bat_in_the_Bacardi_Building%2C_Puerto_Rico.jpg",
    description: "Visit the world-famous Bacardi Distillery in Catano and explore the colorful streets of Old San Juan in one exciting combo tour.", highlights: ["Bacardi distillery tour","Rum tasting","Old San Juan walk","Historic forts"], included: ["Distillery entrance","Rum samples","Guide","Transport"], notIncluded: ["Lunch","Additional drinks"] },
  { name: "Barrilito Rum Distillery Mixology Class", slug: "barrilito-mixology-class", price: 80, duration: "1.5 hrs", location: "Bayamon", rating: 4.8, ratingCount: 89, age: "21+", category: "city-nightlife", featured: false,
    image: WM+"/3/35/Pina_Colada_Top.JPG",
    description: "Learn to craft classic Puerto Rican cocktails at the legendary Ron del Barrilito distillery.", highlights: ["Mixology class","Premium rum cocktails","Distillery tour","Expert bartender"], included: ["All ingredients","Cocktails","Guide"], notIncluded: ["Transport","Lunch"] },
  { name: "Barrilito Rum Distillery Tasting Tour", slug: "barrilito-tasting-tour", price: 80, duration: "1 hr", location: "Bayamon", rating: 4.7, ratingCount: 76, age: "21+", category: "city-nightlife", featured: false,
    image: WM+"/c/c3/Foursquare_Rum_Distillery_Barrel_Warehouse.jpg",
    description: "Tour the historic Ron del Barrilito distillery and taste their award-winning aged rums.", highlights: ["Distillery tour","Rum tasting","History of PR rum","Expert guide"], included: ["Entrance","Rum tasting","Guide"], notIncluded: ["Transport","Lunch"] },
  { name: "Beach Horseback Ride", slug: "beach-horseback-ride", price: 143, duration: "2.5 hrs", location: "Luquillo", rating: 4.9, ratingCount: 118, age: "All Ages", category: "adventure", featured: false,
    image: "https://carabalirainforestpark.com/wp-content/uploads/sites/5932/2019/04/1-Hour-Rainforest-Horseback-Ride-image-1.jpg",
    description: "Ride majestic horses along the beautiful beaches of Luquillo. A romantic and unforgettable experience for all skill levels.", highlights: ["Beach riding","Tropical scenery","All skill levels","Small group"], included: ["Horse","Helmet","Guide"], notIncluded: ["Transport","Gratuity"] },
  { name: "Culebra Island Beach & Snorkel", slug: "culebra-island-beach-snorkel", price: 153, duration: "8am-3pm", location: "Fajardo", rating: 4.9, ratingCount: 231, age: "All Ages", category: "boat-trips", featured: true,
    image: WM+"/8/8a/Flamenco_Beach%2C_Culebra_Island%2C_Puerto_Rico.jpg",
    description: "Day trip to Culebra Island, home to Flamenco Beach, consistently ranked one of the world's top beaches.", highlights: ["Flamenco Beach","World-class snorkeling","Full day","Boat trip"], included: ["Boat transport","Snorkel gear","Life jackets","Guide"], notIncluded: ["Lunch","Drinks"] },
  { name: "Bioluminescent Bay Experience", slug: "bioluminescent-bay", price: 59, duration: "2 hrs", location: "Fajardo", rating: 4.9, ratingCount: 412, age: "All Ages", category: "nature", featured: true,
    image: "https://kayakingpuertorico.com/wp-content/uploads/2017/04/kpr-biobay-tour-m-01.jpg",
    description: "Paddle through the magical glowing waters of Laguna Grande, one of the world's brightest bioluminescent bays.", highlights: ["Glowing dinoflagellates","Kayak tour","Star gazing","Expert naturalist guide"], included: ["Kayak","Life jacket","Guide"], notIncluded: ["Transport","Dinner"] },
  { name: "Icacos Morning Sailing Catamaran Beach & Snorkel", slug: "icacos-morning-catamaran", price: 115, duration: "9am-2pm", location: "Fajardo", rating: 4.8, ratingCount: 198, age: "All Ages", category: "boat-trips", featured: false,
    image: WM+"/d/dc/Icacos_Sailing.jpg",
    description: "Sail to the stunning Icacos island on a catamaran. Enjoy snorkeling, swimming, and a relaxing beach day.", highlights: ["Icacos island","Catamaran sailing","Snorkeling","Beach time"], included: ["Catamaran","Snorkel gear","Light snacks","Guide"], notIncluded: ["Lunch","Alcoholic drinks"] },
  { name: "Culebra Reefs Dive Excursion", slug: "culebra-reefs-dive", price: 155, duration: "9am-3:30pm", location: "Fajardo", rating: 4.9, ratingCount: 87, age: "18+", category: "boat-trips", featured: false,
    image: WM+"/4/49/Culebra_underwater.jpg",
    description: "Explore the spectacular coral reefs around Culebra Island. A world-class diving experience in the Caribbean.", highlights: ["Culebra coral reefs","2 dive sites","Marine life","Certified dive master"], included: ["Dive equipment","Boat transport","Dive master","Lunch"], notIncluded: ["Certification required"] },
  { name: "Deep Sea Fishing Charter", slug: "deep-sea-fishing", price: 0, duration: "4 hrs", location: "San Juan", rating: 4.8, ratingCount: 64, age: "All Ages", category: "adventure", featured: false,
    image: "https://castillotours.com/wp-content/uploads/sites/4187/2020/05/Deep-Sea-Fishing-Charter-Half-Day-image-1.jpg",
    description: "Head out to the deep blue waters off San Juan for deep sea fishing. Target marlin, mahi-mahi, tuna, and wahoo.", highlights: ["Deep sea fishing","Marlin & mahi-mahi","4h or full day","All equipment"], included: ["Fishing gear","Bait","Captain & crew","Ice cooler"], notIncluded: ["Fishing license","Gratuity"] },
  { name: "Dos Mares UTV Adventure", slug: "dos-mares-utv", price: 165, duration: "1 hr", location: "Fajardo", rating: 4.8, ratingCount: 53, age: "16+", category: "adventure", featured: false,
    image: "https://offroadpr.com/cdn/shop/files/OffroadPR_150res_08-1.jpg",
    description: "Ride side-by-side UTVs through the coastal terrain of Fajardo with views of both the Caribbean and Atlantic.", highlights: ["Dual ocean views","UTV side-by-side","Coastal trails","Scenic overlooks"], included: ["UTV rental","Helmet","Guide","Safety gear"], notIncluded: ["Transport","Gratuity"] },
  { name: "Foodie Tour: Blue Pond & Coffee Plantation", slug: "foodie-tour-blue-pond-coffee", price: 125, duration: "9am-4pm", location: "Cayey", rating: 4.9, ratingCount: 143, age: "All Ages", category: "foodie-culture", featured: false,
    image: WM+"/b/b2/Shrimp_mofongo_from_Rompeolas_restaurant_in_Aguadilla%2C_Puerto_Rico.jpg",
    description: "Explore the Puerto Rican mountains, visit a magical blue pond, tour a local coffee plantation, and taste authentic island cuisine.", highlights: ["Blue Pond swimming","Coffee plantation tour","Local food tasting","Countryside scenery"], included: ["Transport","Guide","Food tastings","Coffee samples"], notIncluded: ["Lunch (additional)","Gratuity"] },
  { name: "Guided Jet Ski Tour", slug: "guided-jet-ski-tour", price: 120, duration: "1-1.5 hrs", location: "San Juan", rating: 4.8, ratingCount: 176, age: "16+", category: "adventure", featured: false,
    image: "https://sanjuantourspr.com/wp-content/uploads/sites/3917/2023/07/000_744439.jpeg",
    description: "Guided jet ski adventure along the San Juan coastline with stunning views of El Morro castle.", highlights: ["San Juan coastline","El Morro views","Guided tour","All skill levels"], included: ["Jet ski","Life jacket","Guide"], notIncluded: ["Gratuity"] },
  { name: "Half Day El Yunque Rainforest", slug: "half-day-el-yunque", price: 85, duration: "4 hrs", location: "El Yunque", rating: 4.9, ratingCount: 342, age: "All Ages", category: "nature", featured: true,
    image: WM+"/a/ac/Flickr_-_ggallice_-_La_Coca_Falls_%281%29.jpg",
    description: "Explore the only tropical rainforest in the US National Forest system. Hike to La Coca Falls and swim in natural pools.", highlights: ["La Coca Falls","Natural swimming pools","Yokahu Tower","Certified guide"], included: ["Certified guide","Round-trip transport","Bottled water"], notIncluded: ["Lunch","Park entrance fee"] },
  { name: "Horseback Riding Puerto Rico", slug: "horseback-riding", price: 63, duration: "1 hr", location: "Luquillo", rating: 4.8, ratingCount: 209, age: "All Ages", category: "adventure", featured: false,
    image: "https://www.puertoricodaytrips.com/wp-images-post/carabali-horseback-1a.jpg",
    description: "Classic Puerto Rican horseback riding on beautiful Luquillo Beach. Perfect for beginners and experienced riders.", highlights: ["Beach riding","Tropical scenery","Beginner friendly","Small group"], included: ["Horse","Helmet","Guide"], notIncluded: ["Transport"] },
  { name: "Icacos Double Dip Power Catamaran Snorkel & Beach", slug: "icacos-double-dip-catamaran", price: 110, duration: "4 hrs", location: "Fajardo", rating: 4.8, ratingCount: 156, age: "All Ages", category: "boat-trips", featured: false,
    image: WM+"/9/90/Isle_of_Icacos_I.jpg",
    description: "Power catamaran to Icacos with two snorkel stops and beach time. Explore the crystal waters and marine life.", highlights: ["Two snorkel stops","Power catamaran","Icacos beach","Coral reefs"], included: ["Catamaran","Snorkel gear","Life jackets","Guide"], notIncluded: ["Food","Alcoholic drinks"] },
  { name: "Icacos Island Beach & Snorkel", slug: "icacos-island-beach-snorkel", price: 99, duration: "4 hrs", location: "Fajardo", rating: 4.8, ratingCount: 287, age: "All Ages", category: "boat-trips", featured: false,
    image: "https://www.snorkelandbeachtour.com/wp-content/uploads/sites/30/2025/12/al-este-4-21.jpg",
    description: "Classic Icacos island experience: snorkel the crystal Caribbean waters, relax on white sand beaches.", highlights: ["Icacos island","Caribbean snorkeling","White sand beach","Boat tour"], included: ["Boat","Snorkel gear","Life jackets","Guide"], notIncluded: ["Lunch","Drinks"] },
  { name: "Icacos Luxury Sailing Catamaran Twilight & Sunset Sail", slug: "icacos-luxury-sunset-sail", price: 100, duration: "3 hrs", location: "Fajardo", rating: 5.0, ratingCount: 74, age: "All Ages", category: "boat-trips", featured: true,
    image: "https://images.squarespace-cdn.com/content/v1/674fa81a3ad3362b0231ea47/0a6a8c07-2d16-4d7d-8d76-0a696c3046bb/1992BE05-8879-443F-BCA7-E28DB1AE2489.jpg",
    description: "Sail into the Caribbean sunset on a luxury catamaran near Icacos island with champagne in hand.", highlights: ["Sunset sailing","Luxury catamaran","Open bar","Romantic atmosphere"], included: ["Open bar","Snacks","Captain & crew","Music"], notIncluded: ["Dinner","Transport"] },
  { name: "Luquillo Beach Guided Jet Ski Trip", slug: "luquillo-jet-ski", price: 80, duration: "30 min", location: "Luquillo", rating: 4.7, ratingCount: 134, age: "16+", category: "adventure", featured: false,
    image: "https://sanjuantourspr.com/wp-content/uploads/sites/3917/2023/07/000_744439.jpeg",
    description: "Guided jet ski tour along the beautiful Luquillo Beach coastline. Fast, fun, and unforgettable.", highlights: ["Luquillo coastline","Guided tour","Wave riding","Stunning views"], included: ["Jet ski","Life jacket","Guide"], notIncluded: ["Gratuity"] },
  { name: "Icacos Luxury All Inclusive Sailing Catamaran", slug: "icacos-luxury-all-inclusive", price: 161, duration: "8:45am-3pm", location: "Fajardo", rating: 4.9, ratingCount: 112, age: "All Ages", category: "boat-trips", featured: true,
    image: "https://images.squarespace-cdn.com/content/v1/674fa81a3ad3362b0231ea47/99e55276-ab63-4f69-a858-1a3649cb5eae/242232978_1672039209662042_7312018537192634641_n.jpeg",
    description: "The ultimate all-inclusive catamaran to Icacos island. Gourmet lunch, open bar, snorkeling, and a full day of Caribbean luxury.", highlights: ["All-inclusive","Gourmet lunch","Open bar","Icacos snorkeling"], included: ["Catamaran","Gourmet lunch","Open bar","Snorkel gear","Guide"], notIncluded: ["Transport to marina"] },
  { name: "El Yunque Rainforest & Luquillo Beach Off the Beaten Path", slug: "yunque-luquillo-off-beaten-path", price: 75, duration: "Full day", location: "Luquillo", rating: 4.8, ratingCount: 98, age: "All Ages", category: "nature", featured: false,
    image: WM+"/2/22/Flickr_-_ggallice_-_La_Coca_falls_and_treefern.jpg",
    description: "Skip the crowds and explore hidden trails of El Yunque rainforest, then unwind at the local side of Luquillo Beach.", highlights: ["Hidden rainforest trails","Local Luquillo beach","Small group","Expert guide"], included: ["Transport","Guide","Bottled water"], notIncluded: ["Lunch","Park entrance fee"] },
  { name: "Old San Juan Historical Walking Tour", slug: "old-san-juan-walking", price: 45, duration: "2 hrs", location: "Old San Juan", rating: 4.8, ratingCount: 321, age: "All Ages", category: "city-nightlife", featured: true,
    image: WM+"/1/15/Old_San_Juan%27s_Blue_Brick_Roads_I.jpg",
    description: "Walk through 500 years of history on the iconic blue cobblestone streets of Old San Juan. Explore historic forts and colonial architecture.", highlights: ["El Morro & San Cristobal","Blue cobblestone streets","500 years of history","Local stories"], included: ["Expert guide","Map"], notIncluded: ["Fort entrance fees","Food","Transport"] },
  { name: "Old San Juan Morning Walk & Taste", slug: "old-san-juan-morning-taste", price: 139, duration: "10am-1pm", location: "Old San Juan", rating: 4.9, ratingCount: 167, age: "All Ages", category: "foodie-culture", featured: false,
    image: WM+"/3/3e/Colourful_colonial-era_houses_and_cobblestone_streets_-_Old_San_Juan_%285421844245%29.jpg",
    description: "Explore Old San Juan while tasting the best local food and drinks along Calle Fortaleza.", highlights: ["Local food tastings","Historic sites","Morning energy","Expert guide"], included: ["Food tastings","Guide","Coffee"], notIncluded: ["Additional drinks","Transport"] },
  { name: "Sunset Walk & Taste Tour", slug: "sunset-walk-taste", price: 149, duration: "4pm-7pm", location: "Old San Juan", rating: 4.9, ratingCount: 189, age: "All Ages", category: "foodie-culture", featured: true,
    image: WM+"/6/6b/Fort_San_Felipe_del_Morro_-_IMG_0249.JPG",
    description: "Experience Old San Juan at its most magical as the sun sets over El Morro fort. Taste Puerto Rican food and watch the sky turn golden.", highlights: ["El Morro sunset","Food & drink tastings","Golden hour","Expert guide"], included: ["Food tastings","Drinks","Guide"], notIncluded: ["Transport","Additional drinks"] },
  { name: "Private Salsa Lesson Experience", slug: "private-salsa-lesson", price: 0, duration: "45-60 min", location: "San Juan", rating: 4.9, ratingCount: 56, age: "All Ages", category: "city-nightlife", featured: false,
    image: "https://boricuaonline.com/wp-content/uploads/2024/01/Salsa.jpg",
    description: "Learn to dance salsa with a professional Puerto Rican dancer. Private, fun, and the perfect way to experience island culture.", highlights: ["Private instruction","Professional dancer","Puerto Rican rhythm","All levels"], included: ["Private instructor","Music"], notIncluded: ["Transport"] },
  { name: "El Yunque & Luquillo Beach Combo", slug: "yunque-luquillo-combo", price: 79, duration: "9am-3pm", location: "El Yunque", rating: 4.9, ratingCount: 378, age: "All Ages", category: "nature", featured: true,
    image: WM+"/a/ac/Flickr_-_ggallice_-_La_Coca_Falls_%281%29.jpg",
    description: "Hike through El Yunque National Rainforest in the morning and relax at Luquillo Beach in the afternoon.", highlights: ["El Yunque hike","Luquillo Beach","Waterfall swimming","Best of both worlds"], included: ["Transport","Guide","Bottled water"], notIncluded: ["Lunch","Park entrance fee"] },
  { name: "Yunque, Luquillo Beach & Bioluminescent Bay Trio", slug: "yunque-luquillo-bio-bay-trio", price: 145, duration: "9am-7pm", location: "El Yunque & Fajardo", rating: 4.9, ratingCount: 143, age: "All Ages", category: "nature", featured: true,
    image: WM+"/6/68/Cascada_Yunque_La_mina.JPG",
    description: "The ultimate Puerto Rico day: El Yunque rainforest, Luquillo Beach, and a magical bioluminescent bay kayak tour at night.", highlights: ["El Yunque rainforest","Luquillo Beach","Bioluminescent bay","Full day adventure"], included: ["Transport","All guides","Kayak","Water"], notIncluded: ["Lunch","Dinner"] },
  { name: "Sunset Jet Ski Tour", slug: "sunset-jet-ski", price: 85, duration: "1 hr", location: "San Juan", rating: 4.8, ratingCount: 98, age: "16+", category: "adventure", featured: false,
    image: "https://sanjuantourspr.com/wp-content/uploads/sites/3917/2023/07/000_744439.jpeg",
    description: "Race through San Juan Bay on a jet ski as the sun sets behind the Old City skyline.", highlights: ["San Juan Bay","Sunset views","Jet ski thrill","El Morro backdrop"], included: ["Jet ski","Life jacket","Guide"], notIncluded: ["Gratuity"] },
  { name: "Surfing Lesson Experience", slug: "surfing-lesson", price: 90, duration: "1.5 hrs", location: "Isla Verde, San Juan", rating: 4.9, ratingCount: 214, age: "All Ages", category: "adventure", featured: false,
    image: WM+"/a/ab/Surfing_in_Puerto_Rico_%282960992457%29.jpg",
    description: "Learn to surf on the beaches of Isla Verde with a professional instructor. Perfect for beginners.", highlights: ["Professional instructor","Beginner friendly","Surfboard & rashguard","Fun guaranteed"], included: ["Surfboard","Rashguard","Instructor"], notIncluded: ["Transport","Lunch"] },
  { name: "Tarpon Fishing", slug: "tarpon-fishing", price: 330, duration: "4 hrs", location: "Isla Verde, San Juan", rating: 4.8, ratingCount: 42, age: "All Ages", category: "adventure", featured: false,
    image: "https://www.puertoricodaytrips.com/wp-images-1000x560/fishing-1.jpg",
    description: "Light tackle fishing targeting the legendary Atlantic Tarpon in the lagoons of Isla Verde. Catch and release only.", highlights: ["Tarpon fishing","Catch & release","Expert guide","Light tackle"], included: ["Fishing gear","Guide","Bait"], notIncluded: ["Fishing license","Gratuity"] },
  { name: "Tropicaleo Bar Hopping Tour", slug: "tropicaleo-bar-hopping", price: 99, duration: "2 hrs", location: "Old San Juan", rating: 4.8, ratingCount: 127, age: "21+", category: "city-nightlife", featured: false,
    image: "https://trvlcollective.com/wp-content/uploads/2019/02/IMG_8625.jpg",
    description: "Hop between Old San Juan's most iconic bars while learning about the island's rum culture.", highlights: ["3-4 bar stops","Rum cocktails","Old San Juan nightlife","Expert guide"], included: ["Drinks at each stop","Guide","Walking tour"], notIncluded: ["Food","Additional drinks"] },
  { name: "UTV Puerto Rico", slug: "utv-puerto-rico", price: 135, duration: "1-2 hrs", location: "Luquillo", rating: 4.7, ratingCount: 89, age: "16+", category: "adventure", featured: false,
    image: "https://offroadpr.com/cdn/shop/files/OffroadPR_150res_12_6a894f29-597e-46dd-8105-4a04182c8310.jpg",
    description: "Side-by-side UTV adventure through the lush terrain near Luquillo. Great for couples and groups.", highlights: ["UTV side-by-side","Jungle trails","Mountain views","Safety training"], included: ["UTV rental","Helmet","Guide","Safety gear"], notIncluded: ["Transport","Gratuity"] },
  { name: "Vieques Island Beach & Snorkel (Half Day)", slug: "vieques-half-day", price: 120, duration: "4 hrs", location: "Ceiba", rating: 4.9, ratingCount: 156, age: "All Ages", category: "boat-trips", featured: false,
    image: "https://i0.wp.com/www.latinabroad.com/wp-content/uploads/2012/04/Bahia-de-la-Chiva-Blue-Beach-Vieques.jpg",
    description: "Half-day trip to Vieques Island. Enjoy pristine beaches and crystal-clear snorkeling.", highlights: ["Vieques beaches","Snorkeling","Wild horses possible","Ferry or speedboat"], included: ["Transport","Snorkel gear","Guide"], notIncluded: ["Lunch","Drinks"] },
  { name: "Waterfall & Waterslide Rainforest Adventure + Luquillo Beach", slug: "waterfall-waterslide-luquillo", price: 65, duration: "5 hrs", location: "El Yunque", rating: 4.9, ratingCount: 267, age: "All Ages", category: "nature", featured: false,
    image: WM+"/6/68/Cascada_Yunque_La_mina.JPG",
    description: "Natural waterfalls and thrilling waterslides in El Yunque rainforest, followed by relaxing at Luquillo Beach.", highlights: ["Natural waterslides","La Mina Waterfall","Luquillo Beach","Swimming"], included: ["Guide","Transport","Bottled water"], notIncluded: ["Lunch","Park entrance fee"] },
  { name: "Zipline Close to San Juan", slug: "zipline-san-juan", price: 129, duration: "2 hrs", location: "El Yunque", rating: 4.8, ratingCount: 178, age: "7+", category: "adventure", featured: false,
    image: "https://www.junglequipr.com/wp-content/uploads/sites/6706/2017/01/IMG_3698.jpg",
    description: "Soar over the Puerto Rican rainforest on a zipline just 45 minutes from San Juan. Multiple cables through the jungle canopy.", highlights: ["Multiple ziplines","Jungle canopy views","45 min from San Juan","Professional guides"], included: ["All safety equipment","Professional guides","Photos"], notIncluded: ["Transport","Lunch"] }
];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: BASE, port: 443, path, method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}`, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } };
    const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Deleting existing tours...');
  const existing = JSON.parse((await request('GET', '/api/tours')).body);
  for (const t of existing) { await request('DELETE', `/api/tours/${t.id}`); process.stdout.write('.'); }
  console.log('\nSeeding', tours.length, 'tours...');
  const r = await request('POST', '/api/tours/seed', { tours });
  console.log('Result:', r.body);
}
main().catch(console.error);
