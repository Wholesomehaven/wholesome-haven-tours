-- Store the Google Calendar event id so we can update or remove a tour.
alter table bookings add column if not exists google_event_id text;
