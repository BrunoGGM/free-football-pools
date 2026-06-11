-- Align member RLS for champion selection with the trigger-based lock.
-- Members should be able to update predicted_champion until the first
-- knockout match starts, not only until quiniela.start_date.

drop policy if exists "Members can update own champion before start" on public.quiniela_members;
create policy "Members can update own champion before start"
on public.quiniela_members
for update
to authenticated
using (
  auth.uid() = user_id
  and (
    public.champion_pick_lock_time() is null
    or timezone('utc', now()) < public.champion_pick_lock_time()
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = quiniela_members.quiniela_id
        and q.has_test_data = false
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    public.champion_pick_lock_time() is null
    or timezone('utc', now()) < public.champion_pick_lock_time()
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = quiniela_members.quiniela_id
        and q.has_test_data = false
    )
  )
);
