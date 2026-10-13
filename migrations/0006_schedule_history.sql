-- Keep earlier dates on the same booking when staff reschedule a visit.

alter table bookings add column if not exists schedule_history text;
