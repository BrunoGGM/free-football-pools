alter table public.profiles enable row level security;
alter table public.quinielas enable row level security;
alter table public.quiniela_members enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

create or replace function public.is_admin_of_quiniela(p_quiniela_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.quinielas q
    where q.id = p_quiniela_id
      and q.admin_id = p_user_id
  );
$$;

create or replace function public.is_member_of_quiniela(p_quiniela_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.quiniela_members qm
    where qm.quiniela_id = p_quiniela_id
      and qm.user_id = p_user_id
  );
$$;

grant execute on function public.is_admin_of_quiniela(uuid, uuid) to authenticated, anon;
grant execute on function public.is_member_of_quiniela(uuid, uuid) to authenticated, anon;

-- profiles
drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
create policy "Profiles are visible to authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- quinielas
drop policy if exists "Authenticated users can read quinielas" on public.quinielas;
create policy "Authenticated users can read quinielas"
on public.quinielas
for select
to authenticated
using (true);

drop policy if exists "Users can create own quiniela" on public.quinielas;
create policy "Users can create own quiniela"
on public.quinielas
for insert
to authenticated
with check (auth.uid() = admin_id);

drop policy if exists "Admins can update own quiniela" on public.quinielas;
create policy "Admins can update own quiniela"
on public.quinielas
for update
to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

drop policy if exists "Admins can delete own quiniela" on public.quinielas;
create policy "Admins can delete own quiniela"
on public.quinielas
for delete
to authenticated
using (auth.uid() = admin_id);

-- quiniela_members
drop policy if exists "Members can read their quiniela roster" on public.quiniela_members;
create policy "Members can read their quiniela roster"
on public.quiniela_members
for select
to authenticated
using (public.is_member_of_quiniela(quiniela_id, auth.uid()));

drop policy if exists "Users can join themselves" on public.quiniela_members;
create policy "Users can join themselves"
on public.quiniela_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Admins can add members" on public.quiniela_members;
create policy "Admins can add members"
on public.quiniela_members
for insert
to authenticated
with check (public.is_admin_of_quiniela(quiniela_id, auth.uid()));

drop policy if exists "Members can update own champion before start" on public.quiniela_members;
create policy "Members can update own champion before start"
on public.quiniela_members
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quinielas q
    where q.id = quiniela_members.quiniela_id
      and timezone('utc', now()) < q.start_date
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quinielas q
    where q.id = quiniela_members.quiniela_id
      and timezone('utc', now()) < q.start_date
  )
);

drop policy if exists "Admins can manage members" on public.quiniela_members;
create policy "Admins can manage members"
on public.quiniela_members
for update
to authenticated
using (public.is_admin_of_quiniela(quiniela_id, auth.uid()))
with check (public.is_admin_of_quiniela(quiniela_id, auth.uid()));

drop policy if exists "Members can leave quiniela" on public.quiniela_members;
create policy "Members can leave quiniela"
on public.quiniela_members
for delete
to authenticated
using (auth.uid() = user_id or public.is_admin_of_quiniela(quiniela_id, auth.uid()));

-- matches
drop policy if exists "Matches are readable by authenticated users" on public.matches;
create policy "Matches are readable by authenticated users"
on public.matches
for select
to authenticated
using (true);

-- predictions
drop policy if exists "Users can read own predictions" on public.predictions;
create policy "Users can read own predictions"
on public.predictions
for select
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
);

drop policy if exists "Users can create predictions before kickoff" on public.predictions;
create policy "Users can create predictions before kickoff"
on public.predictions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
);

drop policy if exists "Users can update predictions before kickoff" on public.predictions;
create policy "Users can update predictions before kickoff"
on public.predictions
for update
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
)
with check (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
);

drop policy if exists "Users can delete predictions before kickoff" on public.predictions;
create policy "Users can delete predictions before kickoff"
on public.predictions
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
);
