// Textos del menú público en español e inglés. Los textos que escribe el administrador
// (platillos, categorías, frase, horario, promoción) tienen su versión *_en en la base de datos.
const KEY = 'rm_lang';

const D = {
  es: {
    nav_menu: 'Menú', nav_reviews: 'Reseñas', skip: 'Saltar al menú',
    house_picks: 'Recomendaciones de la casa', daily_dish: 'Platillo del día',
    all: 'Todo', sort: 'Ordenar', sort_menu: 'Orden del menú', sort_asc: 'Precio: de menor a mayor', sort_desc: 'Precio: de mayor a menor',
    search: 'Buscar platillo', search_ph: 'Buscar por nombre o ingrediente', clear: 'Limpiar',
    diet: 'Dieta y alérgenos', cats: 'Categorías',
    badge_house: 'De la casa', badge_offer: 'Oferta', badge_daily: 'Platillo del día', badge_soldout: 'Agotado',
    t_picante: 'Picante', t_vegetariano: 'Vegetariano', t_vegano: 'Vegano', t_sin_gluten: 'Sin gluten', t_sin_lactosa: 'Sin lactosa',
    t_mariscos: 'Contiene mariscos', t_frutos_secos: 'Contiene frutos secos', t_huevo: 'Contiene huevo',
    f_mariscos: 'Sin mariscos', f_frutos_secos: 'Sin frutos secos', f_huevo: 'Sin huevo',
    no_results: 'No encontramos platillos con esos filtros.', no_results_hint: 'Prueba con otra búsqueda o quita algún filtro.',
    preparing: 'El menú se está preparando. Vuelve en un momento.', empty_cat: 'No hay platillos en esta categoría por ahora.',
    load_error: 'No pudimos cargar el menú. Revisa tu conexión e intenta de nuevo.', offline: 'Sin conexión: mostrando la última versión guardada del menú.',
    add: 'Agregar', in_cart: 'en tu pedido', less: 'Quitar uno', more: 'Agregar uno',
    view_order: 'Ver pedido', order_title: 'Tu pedido', order_empty: 'Aún no has agregado platillos.', order_empty_hint: 'Toca “Agregar” en los platillos que quieras.',
    your_name: 'Tu nombre', order_type: '¿Cómo lo quieres?', dine_in: 'Comer aquí', takeaway: 'Para llevar', delivery: 'A domicilio',
    table: 'Mesa', address: 'Dirección de entrega', notes: 'Notas para la cocina', notes_ph: 'Sin picante, sin cebolla, alergias…',
    total: 'Total', send_wa: 'Enviar pedido por WhatsApp', order_help: 'Se abre WhatsApp con tu pedido listo. El restaurante lo confirma por ahí.',
    clear_order: 'Vaciar pedido', close: 'Cerrar', remove: 'Quitar',
    table_banner: 'Mesa {n}', hours: 'Horario',
    res_title: '¿Qué tal estuvo todo?', res_text: 'Lee lo que dicen nuestros comensales en Google o cuéntanos tu experiencia. Tu reseña nos ayuda a mejorar.',
    write_review: 'Dejar una reseña', read_reviews: 'Leer reseñas en Google',
    contact_title: 'Escríbenos y síguenos', website: 'Sitio web', message_float: 'Escríbenos',
    rate_note: 'Precios en bolívares a tasa BCV de Bs. {rate} ({date}).', demo_note: 'Modo demostración: datos de ejemplo guardados solo en este navegador.',
    admin: 'Administración', lang_toggle: 'Cambiar idioma', lang_name: 'Español',
    order_msg_title: 'Pedido', order_msg_client: 'Cliente', order_msg_type: 'Tipo', order_msg_table: 'Mesa', order_msg_address: 'Dirección', order_msg_notes: 'Notas', order_msg_total: 'Total',
    order_msg_hello: 'Hola, quiero hacer este pedido:', dismiss: 'Cerrar aviso', foto_alt: 'foto',
  },
  en: {
    nav_menu: 'Menu', nav_reviews: 'Reviews', skip: 'Skip to menu',
    house_picks: 'House recommendations', daily_dish: 'Dish of the day',
    all: 'All', sort: 'Sort', sort_menu: 'Menu order', sort_asc: 'Price: low to high', sort_desc: 'Price: high to low',
    search: 'Search dishes', search_ph: 'Search by name or ingredient', clear: 'Clear',
    diet: 'Diet & allergens', cats: 'Categories',
    badge_house: 'House pick', badge_offer: 'Special', badge_daily: 'Dish of the day', badge_soldout: 'Sold out',
    t_picante: 'Spicy', t_vegetariano: 'Vegetarian', t_vegano: 'Vegan', t_sin_gluten: 'Gluten-free', t_sin_lactosa: 'Lactose-free',
    t_mariscos: 'Contains shellfish', t_frutos_secos: 'Contains nuts', t_huevo: 'Contains egg',
    f_mariscos: 'No shellfish', f_frutos_secos: 'No nuts', f_huevo: 'No egg',
    no_results: 'No dishes match those filters.', no_results_hint: 'Try another search or remove a filter.',
    preparing: 'The menu is being prepared. Please check back soon.', empty_cat: 'No dishes in this category right now.',
    load_error: 'We could not load the menu. Check your connection and try again.', offline: 'Offline: showing the last saved version of the menu.',
    add: 'Add', in_cart: 'in your order', less: 'Remove one', more: 'Add one',
    view_order: 'View order', order_title: 'Your order', order_empty: 'You have not added any dishes yet.', order_empty_hint: 'Tap “Add” on the dishes you want.',
    your_name: 'Your name', order_type: 'How would you like it?', dine_in: 'Dine in', takeaway: 'Takeaway', delivery: 'Delivery',
    table: 'Table', address: 'Delivery address', notes: 'Notes for the kitchen', notes_ph: 'No spice, no onion, allergies…',
    total: 'Total', send_wa: 'Send order on WhatsApp', order_help: 'WhatsApp opens with your order ready. The restaurant confirms it there.',
    clear_order: 'Clear order', close: 'Close', remove: 'Remove',
    table_banner: 'Table {n}', hours: 'Hours',
    res_title: 'How was everything?', res_text: 'Read what our guests say on Google or tell us about your visit. Your review helps us improve.',
    write_review: 'Leave a review', read_reviews: 'Read reviews on Google',
    contact_title: 'Message us and follow us', website: 'Website', message_float: 'Message us',
    rate_note: 'Bolívar prices at the BCV rate of Bs. {rate} ({date}).', demo_note: 'Demo mode: sample data stored only in this browser.',
    admin: 'Admin', lang_toggle: 'Change language', lang_name: 'English',
    order_msg_title: 'Order', order_msg_client: 'Name', order_msg_type: 'Type', order_msg_table: 'Table', order_msg_address: 'Address', order_msg_notes: 'Notes', order_msg_total: 'Total',
    order_msg_hello: 'Hi, I would like to place this order:', dismiss: 'Dismiss', foto_alt: 'photo',
  },
};

export const TAGS = ['picante', 'vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa', 'mariscos', 'frutos_secos', 'huevo'];
export const ALLERGEN_TAGS = ['mariscos', 'frutos_secos', 'huevo'];

let lang = 'es';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'es' || saved === 'en') lang = saved;
  else if ((navigator.language || '').toLowerCase().startsWith('en')) lang = 'en';
} catch { /* sin almacenamiento */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
}
export function t(key, vars) {
  let s = D[lang][key] ?? D.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
/** Campo escrito por el administrador, en el idioma activo (con respaldo al español). */
export function L(obj, field) {
  if (!obj) return '';
  if (lang === 'en') { const v = obj[field + '_en']; if (v && String(v).trim()) return v; }
  return obj[field] ?? '';
}
export const locale = () => (lang === 'en' ? 'en-US' : 'es-VE');
