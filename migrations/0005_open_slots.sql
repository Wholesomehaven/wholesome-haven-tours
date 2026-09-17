-- One-off special hours an admin can open outside the weekly schedule.

create table if not exists open_slots (
  id         serial primary key,
  slot_date  date not null,
  slot_time  text not null,
  reason     text,
  created_at timestamptz not null default now()
);

create unique index if not exists open_slots_unique_idx
  on open_slots (slot_date, slot_time);

create index if not exists open_slots_date_idx on open_slots (slot_date);
