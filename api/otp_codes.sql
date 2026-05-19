-- Run this once in the Supabase SQL editor.
-- Backs the passwordless OTP flow in api/auth.js.

create table if not exists otp_codes (
  id bigserial primary key,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists otp_codes_phone_created_idx
  on otp_codes (phone, created_at desc);

create index if not exists otp_codes_lookup_idx
  on otp_codes (phone, consumed, expires_at);
