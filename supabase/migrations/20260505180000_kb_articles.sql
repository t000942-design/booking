-- Knowledge base for the AI assistant ("Coach"). Free-text Q&A the bot can
-- search when its rule-based intents don't match. Server-only access via the
-- service role; RLS enabled with no policies (deny by default).

create table if not exists public.kb_articles (
  id          text primary key,
  slug        text not null unique,
  title       text not null,
  body        text not null,
  tags        text[] not null default '{}',
  search_tsv  tsvector,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger keeps the tsvector in sync. We can't use a generated column here
-- because to_tsvector(regconfig, text) is only STABLE, not IMMUTABLE.
create or replace function public.kb_articles_tsv_trigger() returns trigger as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.body, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_kb_articles_tsv on public.kb_articles;
create trigger tg_kb_articles_tsv
  before insert or update on public.kb_articles
  for each row execute function public.kb_articles_tsv_trigger();

create index if not exists ix_kb_articles_tsv on public.kb_articles using gin (search_tsv);
create index if not exists ix_kb_articles_tags on public.kb_articles using gin (tags);

alter table public.kb_articles enable row level security;

-- Seed: initial FAQs. Edit/append from the admin panel later.
insert into public.kb_articles (id, slug, title, body, tags) values
  ('kb_hours', 'opening-hours',
   'What are your opening hours?',
   'We''re open every day from 15:00 to 23:00. Slots are 60 minutes long, on the hour. Last booking starts at 22:00.',
   array['hours','opening','closing','timing']),

  ('kb_location', 'location',
   'Where are you located?',
   'Kick Off is in Salmiya, Kuwait. The exact pin is shared on the booking confirmation. If you''re lost, call the owner: +965 9000 0000.',
   array['location','address','where','directions','salmiya']),

  ('kb_parking', 'parking',
   'Is there parking?',
   'Yes — free parking next to the pitches. There''s usually space, but on Friday/Saturday evenings it fills up fast, so arrive 10 minutes early.',
   array['parking','car','vehicle']),

  ('kb_pricing', 'pricing',
   'How much does a slot cost?',
   'Every slot is KWD 25 for 60 minutes, regardless of pitch. Active discounts (if any) are applied automatically at checkout. Ask Coach "any discounts?" to see what''s live.',
   array['price','cost','how much','rates','fees']),

  ('kb_payment', 'payment',
   'How do I pay?',
   'You can pay online with card after booking, or settle on arrival in cash/KNet. Your booking is confirmed either way — but unpaid bookings can be released if the slot is in high demand.',
   array['payment','pay','cash','card','knet','online']),

  ('kb_cancel_policy', 'cancellation',
   'What''s the cancellation policy?',
   'Cancel any time before the slot starts and the slot goes back into the calendar. We don''t charge a cancellation fee. Inside 2 hours of kickoff, please call the owner so we can offer the slot to someone on the waiting list.',
   array['cancel','cancellation','refund','policy']),

  ('kb_food_drink', 'food-drink',
   'Can I bring food and drinks?',
   'Bottled water and isotonic drinks are fine. No glass bottles, no alcohol, no smoking on the pitch. There''s a small kiosk on site for snacks and cold drinks.',
   array['food','drink','water','snack','kiosk','alcohol']),

  ('kb_age', 'age-limit',
   'Is there an age limit?',
   'No minimum age, but under-16 players need an adult on the booking. Adult & junior groups are welcome — we host kids'' birthday games most weekends.',
   array['age','kids','children','junior','minor','birthday']),

  ('kb_group_size', 'group-size',
   'How many players can play?',
   'Each pitch is 7-a-side, so up to 14 players plus subs is comfortable. We can fit 5-a-side games on the same pitch — just bring fewer players.',
   array['group','size','players','team','7-a-side','5-a-side']),

  ('kb_weather', 'weather',
   'What if it rains or the weather is bad?',
   'Pitch 2 is indoor astroturf and unaffected by weather. Pitches 1 & 3 are outdoor — in heavy rain or sandstorm, we''ll move you to Pitch 2 if it''s free, otherwise we cancel the slot at no charge and you can rebook.',
   array['weather','rain','storm','sandstorm','indoor','outdoor']),

  ('kb_equipment', 'equipment',
   'Do you provide balls, bibs, or boots?',
   'Match balls and bibs are included — ask at reception when you arrive. Astroturf-friendly trainers or moulded studs only; metal studs aren''t allowed on any pitch.',
   array['equipment','ball','bibs','boots','studs','shoes','gear']),

  ('kb_changing', 'changing-rooms',
   'Are there changing rooms and showers?',
   'Yes — two changing rooms with showers, lockers (bring a padlock or borrow one at reception), and toilets. Towels aren''t provided.',
   array['changing','shower','toilet','lockers','facilities']),

  ('kb_referee', 'referee',
   'Can we get a referee?',
   'Yes — a referee can be booked for an extra KWD 5 per slot. Mention it when you book or ask Coach to add one.',
   array['referee','ref','official']),

  ('kb_lost', 'lost-and-found',
   'I left something at the pitch — can I get it back?',
   'Anything found is held at reception for 14 days. Call the owner at +965 9000 0000 with your booking ref and a description.',
   array['lost','found','left','missing']),

  ('kb_private_event', 'private-events',
   'Can I book the whole place for a private event?',
   'Yes — we do birthday parties, corporate days, and tournaments. Email owner@kickoff.kw with your date, group size, and any catering needs and we''ll send a quote.',
   array['private','event','party','corporate','tournament','book out']),

  ('kb_pitch_difference', 'pitch-difference',
   'What''s the difference between Pitch 1, 2, and 3?',
   'Pitch 1 is the main floodlit pitch — best for evening games. Pitch 2 is indoor astroturf, all-weather, slightly tighter. Pitch 3 is outdoor on the sunset side, best for late-afternoon games.',
   array['pitch','difference','which','pitch 1','pitch 2','pitch 3','indoor','outdoor','floodlit']),

  ('kb_contact', 'contact',
   'How do I contact the owner?',
   'Owner: Mohamad N · +965 9000 0000 · owner@kickoff.kw. Call for anything urgent (last-minute cancellations, lost items, group bookings).',
   array['contact','owner','phone','email','whatsapp'])

on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      body = excluded.body,
      tags = excluded.tags;
