-- ══════════════════════════════════════════════════════════════════
--  Biblioteca Digital CUNOC – admin_users (esquema + datos)
--  Pegar TODO este bloque en Supabase → SQL Editor → Correr
-- ══════════════════════════════════════════════════════════════════

-- 1. CREAR TABLA ─────────────────────────────────────────────────
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

-- 2. INSERTAR USUARIOS (upsert seguro – se puede re-ejecutar) ────
insert into admin_users (usuario, password_hash, cargo) values

-- Administrador
('Juan Ribelino Aguilar Lopez',
 '631f4a534c9d7bcc33b0b83fe75c8a72c2aada72b5cf5638e1a61ee09b1d6237',
 'admin'),

-- Docentes
('docente1',  '2852ee30efe5150946e2078b7c23aa7980acdd111fe6b97b480059c660716dff', 'docente'),
('docente2',  '8fbd61f7186d9dffc17747d75b33429246cd8e54ff8285578f26b779ff571adc', 'docente'),
('docente3',  '94d854b1d1c0f9e6e5f920ce95d55bdd4d0cdaca1fd1e096d592b0a5aaa2ffa2', 'docente'),
('docente4',  '106a7f8d9b36b4cb804bde5d39d4e59c6ac4e07fff85c94e2e42a382591ea621', 'docente'),
('docente5',  '2a66cdc0771b800e59a4ce906fabf1e9765e7ab311927cda27646ab8af69e253', 'docente'),
('docente6',  '86d2c7a88f25bec48b9e382859a3e788556c7e73b6ec39bd7c186c50922c542c', 'docente'),
('docente7',  'd37130b1affec18495ef57a4848f0059df060a2c0d3399f654087c6a861b6dfc', 'docente'),
('docente8',  '75b8be38a30082bcc16885c817143f855249c9b53e88970694418c3945921d4d', 'docente'),
('docente9',  '0f38f9b6101c91f8362692600f1d3ceeaf44ac8b1ab6787c651fbb0c6effb7cb', 'docente'),
('docente10', '45d2c4479c503862053491e928b68b99e9311acf95942cbdcc218e5a6288d6d2', 'docente'),

-- Colaboradores / ASO
('colaborador1',  'a1d917b7229f4c633f64e5a1c72ae6d5ab6a02e4d4b44fe21369844af278a6d7', 'aso'),
('colaborador2',  '5b55c349219fc5c053f6b9127d18ebd38c74503560a0d5a91b93df7da52fc324', 'aso'),
('colaborador3',  '14db9d66845854c3579640d875d8a8b5e7316bb3e08d43a3085aef8683205375', 'aso'),
('colaborador4',  '20e3d683342ff87024bff57bb0c963b6473d7bacb85941c52c601747a65e52e4', 'aso'),
('colaborador5',  'e1daa67ffff666ea9126453616c1c4dcd355d66d8a0f68d8d4730852fb04651b', 'aso'),
('colaborador6',  'bfb1b53c6628440a9fbedaab60687ef495fceac9c784f50deb0f9bf31767cc10', 'aso'),
('colaborador7',  '75c97ef216f849d634718c0d234d57b51dfbb65321874fb54039d9771cb7f7a4', 'aso'),
('colaborador8',  'b39e03728950521c2aefc5273cee72d09bb107a6aa2e0737ad04ddc799f49f48', 'aso'),
('colaborador9',  'b2ff4491a60e1a6c34ef91cda609380d74695971c20632285bb882f161804fdf', 'aso'),
('colaborador10', '816914593ba33cc2863e79cfa9689ab143b4cbf8728d53c5c2b6a2e9f171fddb', 'aso')

on conflict (usuario) do update
  set password_hash = excluded.password_hash,
      cargo         = excluded.cargo,
      activo        = true;
