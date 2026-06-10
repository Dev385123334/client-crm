-- Add missing columns to expenses table for cross-device sync

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'carried_over'
  ) THEN
    ALTER TABLE expenses ADD COLUMN carried_over boolean NOT NULL DEFAULT false;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'notes'
  ) THEN
    ALTER TABLE expenses ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
END
$$;
