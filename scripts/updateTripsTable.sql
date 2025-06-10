-- Verificar si la tabla trips existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE  table_schema = 'public'
  AND    table_name   = 'trips'
);

-- Verificar columnas actuales de la tabla trips
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'trips';

-- Agregar columnas de coordenadas si no existen
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS origin_coords geometry(Point, 4326),
ADD COLUMN IF NOT EXISTS destination_coords geometry(Point, 4326);

-- Verificar que las columnas se hayan agregado correctamente
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'trips' 
AND column_name IN ('origin_coords', 'destination_coords');
