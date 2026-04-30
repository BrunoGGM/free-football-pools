alter table public.quinielas
add column if not exists logo_url text;

alter table public.quinielas
drop constraint if exists quinielas_logo_url_length;

alter table public.quinielas
add constraint quinielas_logo_url_length
check (logo_url is null or char_length(logo_url) <= 2048);
