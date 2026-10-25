# Sistema de menú para restaurante

**Menú público:** fotos en carrusel, categorías, orden por precio, recomendaciones de la casa, buscador, etiquetas
(picante, vegetariano, vegano, sin gluten, sin lactosa, alérgenos), pedido por WhatsApp con carrito, ofertas, plato del día,
aviso de promoción, reseñas de Google, redes sociales, español/inglés, instalable como app y funciona sin conexión con lo último visto.

**Panel admin:** platillos y fotos, precios, oferta, agotado, ocultar, recomendar, plato del día, reordenar arrastrando,
categorías, datos del restaurante, tasa BCV, estadísticas y generador de QR imprimible (con tarjetas por mesa).

Sitio estático (`index.html`, `admin.html`) + una función de Vercel (`api/page.js`) que pone título e imagen al compartir el enlace.
Base de datos, login y fotos: Supabase. Hosting: Vercel.

## Probarlo ahora (modo demostración)
`config.js` vacío = datos de ejemplo guardados solo en tu navegador. En la carpeta del proyecto:
`python3 -m http.server 8000` y abre http://localhost:8000 (admin: /admin.html, cualquier correo y clave).
Los módulos JS no funcionan abriendo el archivo con doble clic; hace falta un servidor (o Vercel).

## Ponerlo en producción
1. **Supabase:** crea un proyecto nuevo (o usa uno aparte del de tu inventario).
2. **SQL Editor:** pega todo `supabase/schema.sql` y ejecuta. Crea tablas, seguridad, categorías y el bucket de fotos `dishes`.
3. **Authentication > Users > Add user:** crea tu usuario administrador (correo y contraseña; marca "Auto Confirm").
4. **SQL Editor:** ejecuta el bloque final de `schema.sql` cambiando `TU_CORREO@EJEMPLO.COM` por ese correo.
   Solo las cuentas que estén en la tabla `admins` pueden editar; cualquier otra cuenta es rechazada por la base de datos.
5. **Project Settings > API:** copia *Project URL* y *anon public key* en `js/config.js`.
6. **Vercel:** sube la carpeta (arrastrar a vercel.com/new o con GitHub). No necesita build.
7. Entra a `/admin.html`, ve a **Restaurante** y completa nombre, dirección, horario, tasa BCV y el Place ID de Google.

## Pedidos por WhatsApp
Con un número de WhatsApp guardado y la opción "Permitir pedidos" activa, los clientes arman su pedido (comer aquí, para llevar o delivery)
y se abre WhatsApp con el mensaje listo. No hay pasarela de pago: el restaurante confirma por el chat.
Con `?mesa=5` en el enlace (lo hacen los QR por mesa) el pedido ya viene con la mesa.

## Código QR
Pestaña **Código QR**: escribe la dirección pública del menú (o guárdala en Restaurante > Dirección pública), elige cuántas mesas y descarga PNG/SVG o imprime las tarjetas.

## Estadísticas
Visitas, pedidos enviados, clics en WhatsApp/reseñas/redes y platillos más vistos y pedidos. Son anónimas (sin datos personales).
En modo demostración las cifras son de ejemplo.

## Instalable (PWA) y SEO
El menú se puede "Agregar a pantalla de inicio". `vercel.json` sirve `/` mediante `api/page.js`, que inserta nombre, descripción e imagen
(Open Graph y datos de Google) leyendo la base de datos; si falla, entrega la página normal. `robots.txt` oculta el panel a buscadores.
Los íconos están en `icons/`; reemplázalos por el logo del restaurante (192, 512 y maskable 512 px) cuando lo tengas.

## Reseñas de Google
Pega el **Place ID** del restaurante en Restaurante > Reseñas de Google. Los botones abrirán directo
las reseñas y el formulario para escribir una. Sin Place ID, abren la ficha en Google Maps buscando por nombre y dirección.

## WhatsApp y redes sociales
En el panel, pestaña **Restaurante > Contacto y redes sociales**, llena las que uses: WhatsApp, Instagram, Facebook, TikTok, X, YouTube y sitio web.
Cada una aparece como botón en la sección "Escríbenos y síguenos"; las vacías no se muestran.
Con WhatsApp configurado también aparece un botón flotante "Escríbenos" y puedes definir el mensaje que se escribe al abrir el chat.
Acepta usuario (@mirestaurante) o enlace completo. El WhatsApp va con código de país (584141234567; si empieza por 0 se toma como Venezuela).
**Si ya habías ejecutado una versión anterior de `schema.sql`:** vuelve a ejecutarlo completo (es seguro repetirlo); añade columnas, la tabla de estadísticas y sus funciones.

## Tasa BCV
Se escribe a mano (o con "Traer tasa BCV", que consulta un servicio público de terceros y puede fallar).
Los precios en Bs. se calculan solos a partir del precio en $. Con tasa 0, solo se muestra el precio en $.

## Notas
- Las fotos se comprimen en el navegador (máx. 1400 px) antes de subirse.
- "Ocultar" quita el platillo del menú sin borrarlo; "Eliminar" lo borra con sus fotos.
- La clave anon es pública por diseño; la seguridad está en las políticas RLS del esquema.
