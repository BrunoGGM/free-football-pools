create table if not exists public.api_provider_usage (
  provider text not null,
  usage_date date not null,
  requests_used integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider, usage_date),
  constraint api_provider_usage_requests_non_negative check (requests_used >= 0)
);

create table if not exists public.api_provider_sync_state (
  provider text primary key,
  last_synced_at timestamptz,
  last_status text not null default 'idle',
  last_error text,
  last_response_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint api_provider_sync_state_status_valid check (last_status in ('idle', 'ok', 'error')),
  constraint api_provider_sync_state_response_non_negative check (last_response_count >= 0)
);

drop trigger if exists tr_api_provider_usage_set_updated_at on public.api_provider_usage;
create trigger tr_api_provider_usage_set_updated_at
before update on public.api_provider_usage
for each row
execute function public.set_updated_at();

drop trigger if exists tr_api_provider_sync_state_set_updated_at on public.api_provider_sync_state;
create trigger tr_api_provider_sync_state_set_updated_at
before update on public.api_provider_sync_state
for each row
execute function public.set_updated_at();
