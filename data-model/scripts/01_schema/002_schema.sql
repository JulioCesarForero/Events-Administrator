-- Esquema de aplicación: todas las tablas del MVP viven bajo `events`.
CREATE SCHEMA IF NOT EXISTS events;

COMMENT ON SCHEMA events IS 'Modelo de datos MVP: reserva de cupos en mesas para eventos';
