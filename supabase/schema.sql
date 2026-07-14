-- Biblioteca Digital CUNOC
-- Ejecutar en Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════
--  TABLA: students  (usuarios estudiantes)
-- ══════════════════════════════════════════
create table if not exists students (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  carne         text not null unique,
  password_hash text not null,
  role          text not null default 'student' check (role = 'student'),
  muted         boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists students_carne_idx on students (carne);
alter table students enable row level security;
-- Sin políticas públicas: solo la API (service_role) accede a esta tabla.

-- ══════════════════════════════════════════
--  TABLA: admin_users  (admin, docente, aso)
-- ══════════════════════════════════════════
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  usuario       text not null unique,
  password_hash text not null,
  cargo         text not null check (cargo in ('admin', 'docente', 'aso')),
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists admin_users_usuario_idx on admin_users (usuario);
create index if not exists admin_users_cargo_idx   on admin_users (cargo);
alter table admin_users enable row level security;
-- Sin políticas públicas: solo la API (service_role) accede a esta tabla.
