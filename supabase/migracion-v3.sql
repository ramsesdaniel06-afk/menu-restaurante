-- =====================================================================
--  Migración v3 — extras en platillos, combos, horarios, menú por horario,
--  equipo con permisos. Pégalo completo en Supabase > SQL Editor > Run.
--  Es seguro ejecutarlo varias veces y no toca tus datos.
-- =====================================================================

-- ---------- Platillos ----------
alter table public.dishes add column if not exists options    jsonb    not null default '[]';   -- extras y opciones
alter table public.dishes add column if not exists is_combo   boolean  not null default false;
alter table public.dishes add column if not exists suggest    boolean  not null default false; -- se sugiere al hacer el pedido
alter table public.dishes add column if not exists dayparts   text[]   not null default '{}';  -- breakfast / lunch / dinner (vacío = todo el día)
alter table public.dishes add column if not exists avail_days smallint[] not null default '{}'; -- 0=domingo … 6=sábado (vacío = todos)
alter table public.dishes add column if not exists sale_days  smallint[] not null default '{}'; -- días en que rige la oferta (vacío = todos)
alter table public.dishes add column if not exists sale_from  text default '';                  -- hora de inicio de la oferta, ej. 14:00
alter table public.dishes add column if not exists sale_to    text default '';

-- ---------- Datos del restaurante ----------
alter table public.settings add column if not exists hours_week      jsonb not null default '{}';  -- {"1":["11:00","22:00"],"2":null,…}
alter table public.settings add column if not exists tz              text  not null default 'America/Caracas';
alter table public.settings add column if not exists dayparts_on     boolean not null default false;
alter table public.settings add column if not exists dayparts        jsonb not null default '{}';
alter table public.settings add column if not exists promo_days      smallint[] not null default '{}';
alter table public.settings add column if not exists order_modes     text  not null default 'dine_in,takeaway,delivery';
alter table public.settings add column if not exists payment_methods text  default '';

-- ---------- Equipo y permisos ----------
alter table public.admins add column if not exists role text not null default 'owner';
do $$ begin
  alter table public.admins add constraint admins_role_chk check (role in ('owner','manager','staff'));
exception when duplicate_object then null; end $$;

create or replace function public.admin_role()
returns text language sql security definer set search_path = public stable as $$
  select role from public.admins where user_id = auth.uid();
$$;
create or replace function public.is_manager()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select role in ('owner','manager') from public.admins where user_id = auth.uid()), false);
$$;
create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select role = 'owner' from public.admins where user_id = auth.uid()), false);
$$;

-- Políticas: dueño y gerente editan todo; el empleado solo puede marcar platillos agotados.
drop policy if exists "settings: admin escribe" on public.settings;
create policy "settings: admin escribe" on public.settings for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "categories: admin escribe" on public.categories;
create policy "categories: admin escribe" on public.categories for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "dishes: admin todo" on public.dishes;
drop policy if exists "dishes: gerente todo" on public.dishes;
drop policy if exists "dishes: empleado ve" on public.dishes;
drop policy if exists "dishes: empleado marca agotado" on public.dishes;
create policy "dishes: gerente todo" on public.dishes for all using (public.is_manager()) with check (public.is_manager());
create policy "dishes: empleado ve" on public.dishes for select using (public.is_admin());
create policy "dishes: empleado marca agotado" on public.dishes for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.dishes_staff_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() and (to_jsonb(new) - 'sold_out') is distinct from (to_jsonb(old) - 'sold_out') then
    raise exception 'Tu rol solo permite marcar platillos como agotados.';
  end if;
  return new;
end $$;
drop trigger if exists dishes_staff_guard on public.dishes;
create trigger dishes_staff_guard before update on public.dishes
  for each row execute function public.dishes_staff_guard();

drop policy if exists "photos: admin escribe" on public.dish_photos;
create policy "photos: admin escribe" on public.dish_photos for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "dishes bucket: admin sube"  on storage.objects;
drop policy if exists "dishes bucket: admin edita" on storage.objects;
drop policy if exists "dishes bucket: admin borra" on storage.objects;
create policy "dishes bucket: admin sube"  on storage.objects for insert with check (bucket_id = 'dishes' and public.is_manager());
create policy "dishes bucket: admin edita" on storage.objects for update using (bucket_id = 'dishes' and public.is_manager());
create policy "dishes bucket: admin borra" on storage.objects for delete using (bucket_id = 'dishes' and public.is_manager());

-- Gestión del equipo (solo el dueño). El usuario debe existir antes en Authentication > Users.
create or replace function public.team_list()
returns table (user_id uuid, email text, role text) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Solo el dueño puede ver el equipo.'; end if;
  return query select a.user_id, u.email::text, a.role from public.admins a join auth.users u on u.id = a.user_id order by a.role, u.email;
end $$;

create or replace function public.team_add(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_owner() then raise exception 'Solo el dueño puede agregar personas.'; end if;
  if p_role not in ('owner','manager','staff') then raise exception 'Rol no válido.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'Ese correo aún no existe. Créalo primero en Supabase > Authentication > Users > Add user.'; end if;
  insert into public.admins (user_id, role) values (uid, p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

create or replace function public.team_remove(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Solo el dueño puede quitar personas.'; end if;
  if p_user = auth.uid() then raise exception 'No puedes quitarte a ti mismo.'; end if;
  delete from public.admins where user_id = p_user;
end $$;

revoke all on function public.team_list() from public, anon;
revoke all on function public.team_add(text, text) from public, anon;
revoke all on function public.team_remove(uuid) from public, anon;
grant execute on function public.team_list() to authenticated;
grant execute on function public.team_add(text, text) to authenticated;
grant execute on function public.team_remove(uuid) to authenticated;
