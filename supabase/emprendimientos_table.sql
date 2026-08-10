-- Tabla emprendimientos para Biblioteca Digital CUNOC
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS emprendimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner         TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  website       TEXT,
  facebook      TEXT,
  instagram     TEXT,
  whatsapp      TEXT,
  image_base64  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acceso público de lectura (igual que la tabla announcements)
ALTER TABLE emprendimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de emprendimientos"
  ON emprendimientos FOR SELECT
  USING (true);

CREATE POLICY "Solo service_role puede insertar"
  ON emprendimientos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Solo service_role puede eliminar"
  ON emprendimientos FOR DELETE
  USING (true);
