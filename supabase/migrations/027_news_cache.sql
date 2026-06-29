-- Cache table for Currents API news responses.
-- One row per cache key; we use 'wc26_news' for the World Cup news feed.
-- The API route checks fetched_at and skips the upstream call if within 15 min.
create table if not exists news_cache (
  id          text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now()
);
