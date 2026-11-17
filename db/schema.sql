-- Wishing list schema. Idempotent: safe to re-run.
create extension if not exists pgcrypto;

create table if not exists lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references neon_auth."user"(id) on delete cascade,
  title       text not null check (length(title) between 1 and 120),
  description text check (length(description) <= 1000),
  emoji       text not null default '🎁',
  event_date  date,
  share_slug  text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lists_owner_idx on lists(owner_id, created_at desc);

create table if not exists images (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references neon_auth."user"(id) on delete cascade,
  mime       text not null,
  data       bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  description text check (length(description) <= 2000),
  url         text check (length(url) <= 2000),
  price       numeric(10,2) check (price >= 0),
  image_url   text check (length(image_url) <= 2000),
  priority    smallint check (priority between 1 and 3), -- 1 alta, 2 media, 3 baja
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_list_idx on items(list_id, position, created_at);
-- Optional size (talla), e.g. "M", "42", "6-12 meses".
alter table items add column if not exists size text check (length(size) <= 40);
-- Optional colour, e.g. "Azul marino".
alter table items add column if not exists color text check (length(color) <= 40);
-- Set when the list owner marks the gift as already bought/received (independent of guest purchases).
alter table items add column if not exists owner_purchased_at timestamptz;

-- One purchase per item. Anonymous buyers keep claim_token in their browser to undo.
create table if not exists purchases (
  item_id          uuid primary key references items(id) on delete cascade,
  buyer_name       text check (length(buyer_name) <= 80),
  buyer_user_id    uuid references neon_auth."user"(id) on delete set null,
  claim_token_hash text not null,
  created_at       timestamptz not null default now()
);

create table if not exists follows (
  user_id    uuid not null references neon_auth."user"(id) on delete cascade,
  list_id    uuid not null references lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index if not exists follows_list_idx on follows(list_id);
