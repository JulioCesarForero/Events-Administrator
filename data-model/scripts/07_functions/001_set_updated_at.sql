CREATE OR REPLACE FUNCTION events.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION events.set_updated_at() IS 'Trigger genérico para mantener updated_at en filas modificadas';
