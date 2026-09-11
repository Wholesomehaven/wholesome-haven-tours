-- Private tour bookings, blocked slots, and house availability.

create table if not exists bookings (
  id            serial primary key,
  guest_name    text not null,
  guest_email   text not null,
  guest_phone   text not null,
  party_size    integer not null default 1,
  relationship  text,
  resident_name text,
  notes         text,
  sms_opt_in    boolean not null default false,
  tour_date     date not null,
  tour_time     text not null,
  status        text not null default 'pending',
  staff_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists bookings_date_idx on bookings (tour_date, tour_time);
create index if not exists bookings_status_idx on bookings (status);

create unique index if not exists bookings_open_slot_idx
  on bookings (tour_date, tour_time)
  where status <> 'cancelled';

create table if not exists blocked_slots (
  id         serial primary key,
  slot_date  date not null,
  slot_time  text,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists blocked_slots_date_idx on blocked_slots (slot_date);

create table if not exists availability_settings (
  id                     integer primary key default 1,
  days_of_week           text not null default '1,2,3,4,5,6',
  slot_times             text not null default '["10:00","11:00","13:00","14:00","15:00"]',
  tour_minutes           integer not null default 45,
  max_party_size         integer not null default 6,
  lead_hours             integer not null default 3,
  horizon_days           integer not null default 90
);

insert into availability_settings (id)
  values (1)
  on conflict (id) do nothing;
