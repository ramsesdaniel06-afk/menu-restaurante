-- =====================================================================
--  Sistema de menú para restaurante — esquema de Supabase (v2)
--  Pégalo completo en: Supabase > SQL Editor > New query > Run
--  Es seguro ejecutarlo más de una vez: si ya tenías la versión anterior,
--  solo agrega lo que falta y no toca tus datos.
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.settings (
  id             int primary key default 1 check (id = 1),   -- una sola fila
  name           text not null default 'Mi Restaurante',
  tagline        text default 'Cocina de mar y parrilla',
  address        text default '',
  phone          text default '',
  hours          text default '',
  google_place_id text default '',
  bcv_rate       numeric(12,4) default 0,
  bcv_updated_at timestamptz
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  position  int  not null default 0
);

create table if not exists public.dishes (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references public.categories(id) on delete restrict,
  name         text not null,
  description  text default '',
  price_usd    numeric(10,2) not null check (price_usd >= 0),
  active       boolean not null default true,
  featured     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.dish_photos (
  id        uuid primary key default gen_random_uuid(),
  dish_id   uuid not null references public.dishes(id) on delete cascade,
  url       text not null,
  path      text,
  position  int not null default 0
);
create index if not exists dish_photos_dish_idx on public.dish_photos(dish_id, position);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Columnas añadidas en versiones posteriores ----------
-- Contacto y redes
alter table public.settings add column if not exists whatsapp text default '';
alter table public.settings add column if not exists whatsapp_message text default '';
alter table public.settings add column if not exists instagram text default '';
alter table public.settings add column if not exists facebook text default '';
alter table public.settings add column if not exists tiktok text default '';
alter table public.settings add column if not exists x_twitter text default '';
alter table public.settings add column if not exists youtube text default '';
alter table public.settings add column if not exists website text default '';
-- Inglés, pedidos, promoción y enlace público
alter table public.settings add column if not exists tagline_en text default '';
alter table public.settings add column if not exists hours_en text default '';
alter table public.settings add column if not exists order_enabled boolean not null default true;
alter table public.settings add column if not exists promo_active boolean not null default false;
alter table public.settings add column if not exists promo_text text default '';
alter table public.settings add column if not exists promo_text_en text default '';
alter table public.settings add column if not exists site_url text default '';
alter table public.settings add column if not exists eur_rate numeric(12,4) default 0;
alter table public.settings add column if not exists logo_url text default '';
alter table public.settings add column if not exists logo_path text default '';

alter table public.categories add column if not exists name_en text default '';

alter table public.dishes add column if not exists name_en text default '';
alter table public.dishes add column if not exists description_en text default '';
alter table public.dishes add column if not exists sale_price_usd numeric(10,2) check (sale_price_usd is null or sale_price_usd >= 0);
alter table public.dishes add column if not exists tags text[] not null default '{}';
alter table public.dishes add column if not exists daily boolean not null default false;      -- platillo del día
alter table public.dishes add column if not exists sold_out boolean not null default false;   -- agotado
alter table public.dishes add column if not exists position int not null default 0;           -- orden dentro de la categoría

-- ---------- Estadísticas (eventos anónimos) ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null,
  dish_id     uuid references public.dishes(id) on delete set null,
  qty         int,
  meta        text
);
create index if not exists events_created_idx on public.events(created_at);
create index if not exists events_type_idx on public.events(type, created_at);

-- ---------- Función de permisos ----------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Seguridad por filas (RLS) ----------
alter table public.settings    enable row level security;
alter table public.categories  enable row level security;
alter table public.dishes      enable row level security;
alter table public.dish_photos enable row level security;
alter table public.admins      enable row level security;
alter table public.events      enable row level security;

drop policy if exists "settings: lectura pública"   on public.settings;
drop policy if exists "settings: admin escribe"     on public.settings;
create policy "settings: lectura pública" on public.settings for select using (true);
create policy "settings: admin escribe"   on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories: lectura pública" on public.categories;
drop policy if exists "categories: admin escribe"   on public.categories;
create policy "categories: lectura pública" on public.categories for select using (true);
create policy "categories: admin escribe"   on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "dishes: público ve activos" on public.dishes;
drop policy if exists "dishes: admin todo"         on public.dishes;
create policy "dishes: público ve activos" on public.dishes for select using (active = true);
create policy "dishes: admin todo"         on public.dishes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "photos: lectura pública" on public.dish_photos;
drop policy if exists "photos: admin escribe"   on public.dish_photos;
create policy "photos: lectura pública" on public.dish_photos for select using (true);
create policy "photos: admin escribe"   on public.dish_photos for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins: cada quien ve su fila" on public.admins;
create policy "admins: cada quien ve su fila" on public.admins for select using (user_id = auth.uid());

-- Cualquier visitante puede REGISTRAR eventos de los tipos permitidos; solo el admin puede leerlos.
drop policy if exists "events: público registra" on public.events;
drop policy if exists "events: admin lee"        on public.events;
create policy "events: público registra" on public.events for insert
  with check (
    type in ('visit','dish_view','order_item','order_sent','click_whatsapp','click_review_read','click_review_write','click_social')
    and coalesce(length(meta), 0) <= 60
    and coalesce(qty, 1) between 1 and 99
  );
create policy "events: admin lee" on public.events for select using (public.is_admin());

-- ---------- Resumen de estadísticas para el panel ----------
create or replace function public.admin_stats(days int default 30)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  since timestamptz := now() - make_interval(days => days);
  r jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'totals', coalesce((select jsonb_object_agg(t.type, t.n)
                        from (select type, count(*) n from public.events where created_at >= since group by type) t), '{}'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', t.d, 'visits', t.n) order by t.d)
                       from (select (created_at at time zone 'America/Caracas')::date d, count(*) n
                             from public.events where type = 'visit' and created_at >= since group by 1) t), '[]'::jsonb),
    'top_viewed', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'n', t.n) order by t.n desc)
                            from (select d.name, count(*) n from public.events e join public.dishes d on d.id = e.dish_id
                                  where e.type = 'dish_view' and e.created_at >= since group by d.name order by n desc limit 8) t), '[]'::jsonb),
    'top_ordered', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'n', t.n) order by t.n desc)
                             from (select d.name, sum(coalesce(e.qty, 1)) n from public.events e join public.dishes d on d.id = e.dish_id
                                   where e.type = 'order_item' and e.created_at >= since group by d.name order by n desc limit 8) t), '[]'::jsonb),
    'socials', coalesce((select jsonb_object_agg(t.meta, t.n)
                         from (select meta, count(*) n from public.events
                               where type = 'click_social' and created_at >= since group by meta) t), '{}'::jsonb),
    'orders_usd', coalesce((select sum(nullif(regexp_replace(meta, '[^0-9.]', '', 'g'), '')::numeric)
                            from public.events where type = 'order_sent' and created_at >= since), 0)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;

-- ---------- Almacenamiento de fotos ----------
insert into storage.buckets (id, name, public)
values ('dishes', 'dishes', true)
on conflict (id) do update set public = true;

drop policy if exists "dishes bucket: lectura pública" on storage.objects;
drop policy if exists "dishes bucket: admin sube"      on storage.objects;
drop policy if exists "dishes bucket: admin edita"     on storage.objects;
drop policy if exists "dishes bucket: admin borra"     on storage.objects;
create policy "dishes bucket: lectura pública" on storage.objects for select using (bucket_id = 'dishes');
create policy "dishes bucket: admin sube"  on storage.objects for insert with check (bucket_id = 'dishes' and public.is_admin());
create policy "dishes bucket: admin edita" on storage.objects for update using (bucket_id = 'dishes' and public.is_admin());
create policy "dishes bucket: admin borra" on storage.objects for delete using (bucket_id = 'dishes' and public.is_admin());

-- ---------- Categorías iniciales ----------
insert into public.categories (name, name_en, position)
select v.name, v.name_en, v.position
from (values ('Entradas','Starters',1), ('Platillos fuertes','Main courses',2), ('Especialidades','Specialties',3), ('Postres','Desserts',4)) as v(name, name_en, position)
where not exists (select 1 from public.categories);

-- =====================================================================
--  ÚLTIMO PASO (después de crear tu usuario en Authentication > Users):
--  convierte tu cuenta en administradora. Cambia el correo y ejecuta:
--
--  insert into public.admins (user_id)
--  select id from auth.users where email = 'TU_CORREO@EJEMPLO.COM'
--  on conflict do nothing;
-- =====================================================================
