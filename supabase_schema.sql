
-- Supabase schema for HannahAI

-- 1) Profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company text,
  phone text,
  plan text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table public.profiles enable row level security;

-- Policies: user can manage only their own row
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles
    for select using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where polname = 'profiles_insert_own') then
    create policy profiles_insert_own on public.profiles
    for insert with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where polname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles
    for update using (auth.uid() = id);
  end if;
end $$;

-- Superuser override policies for profiles and invoices (read access)
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'profiles_select_super') then
    create policy profiles_select_super on public.profiles
    for select using (
      exists (
        select 1 from public.superuser_permissions sup
        where sup.user_id = auth.uid() and sup.is_active = true
      )
    );
  end if;

  if not exists (select 1 from pg_policies where polname = 'invoices_select_super') then
    create policy invoices_select_super on public.invoices
    for select using (
      exists (
        select 1 from public.superuser_permissions sup
        where sup.user_id = auth.uid() and sup.is_active = true
      )
    );
  end if;
end $$;

-- 2) Invoices ---------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default now(),
  amount text not null,
  status text not null default 'Paid',
  file_url text,
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;

-- Policies: user can only see their invoices
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'invoices_select_own') then
    create policy invoices_select_own on public.invoices
    for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where polname = 'invoices_insert_own') then
    create policy invoices_insert_own on public.invoices
    for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Optional helper view for analytics (owner-scoped by RLS on base tables)
create or replace view public.v_user_stats as
select
  p.id as user_id,
  p.full_name,
  p.company,
  coalesce(count(i.*),0) as invoice_count
from profiles p
left join invoices i on i.user_id = p.id
group by p.id, p.full_name, p.company;

-- Trigger to auto-create profile rows when a new auth user is created
-- Note: requires 'supabase_auth_admin' or run this in the SQL editor with superuser
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create function public.handle_new_user() returns trigger as $$
    begin
      insert into public.profiles(id, email, full_name, company, phone)
      values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'company', new.raw_user_meta_data->>'phone')
      on conflict (id) do nothing;
      return new;
    end;
    $$ language plpgsql security definer;

    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- 3) Superuser Permissions ---------------------------------------------------------------
create table if not exists public.superuser_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz default now(),
  is_active boolean default true,
  unique(user_id)
);

alter table public.superuser_permissions enable row level security;

-- Policies: only superusers can read all superuser permissions
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'superuser_permissions_select') then
    create policy superuser_permissions_select on public.superuser_permissions
    for select using (
      exists (
        select 1 from public.superuser_permissions sp 
        where sp.user_id = auth.uid() and sp.is_active = true
      )
    );
  end if;

  if not exists (select 1 from pg_policies where polname = 'superuser_permissions_manage') then
    create policy superuser_permissions_manage on public.superuser_permissions
    for all using (
      exists (
        select 1 from public.superuser_permissions sp 
        where sp.user_id = auth.uid() and sp.is_active = true
      )
    );
  end if;
end $$;

-- Insert initial superuser (ariel.mikulski@gmail.com)
-- Note: This will only work if the user already exists in auth.users
do $$ begin
  insert into public.superuser_permissions (user_id, granted_by, is_active)
  select 
    au.id,
    au.id, -- self-granted
    true
  from auth.users au
  where au.email = 'ariel.mikulski@gmail.com'
  on conflict (user_id) do nothing;
end $$;
