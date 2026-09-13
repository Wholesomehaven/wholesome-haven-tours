-- Persist Gmail OAuth refresh token for tour-desk mail.

create table if not exists mail_oauth (
  id                 integer primary key default 1,
  refresh_token      text not null,
  access_token       text,
  access_expires_at  timestamptz,
  mailbox            text,
  updated_at         timestamptz not null default now()
);
