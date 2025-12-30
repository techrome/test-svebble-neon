-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION clear_pending_email_on_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."email_verified" = TRUE
     AND NEW."pending_email" IS NOT NULL
     AND NEW."pending_email" = NEW."email"
  THEN
    NEW."pending_email" := NULL;
    NEW."pending_email_set_at" := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_clear_pending_email_on_verified ON "user";

CREATE TRIGGER trigger_clear_pending_email_on_verified
BEFORE UPDATE OF "email", "email_verified"
ON "user"
FOR EACH ROW
EXECUTE FUNCTION clear_pending_email_on_verified();
