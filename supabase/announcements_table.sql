-- Tabla: announcements (Muro de Noticias)
-- Ejecutar en Supabase → SQL Editor → New query → Run

create table if not exists announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  type          text not null default 'general' check (type in ('general', 'urgente', 'academico')),
  image         text,                  -- base64 o URL de imagen opcional
  pinned        boolean not null default false,
  is_student_contribution boolean not null default false,
  student_name  text,                  -- nombre del estudiante si lo publicó
  created_at    timestamptz not null default now()
);

create index if not exists announcements_created_at_idx on announcements (created_at desc);
create index if not exists announcements_pinned_idx on announcements (pinned);
alter table announcements enable row level security;
-- Sin políticas públicas: solo la API (service_role) accede a esta tabla.
