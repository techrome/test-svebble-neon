-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION clear_pending_email_on_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  u public."user"%ROWTYPE;
BEGIN
  u := NEW;

  IF u.email_verified IS TRUE
     AND u.pending_email IS NOT NULL
     AND u.pending_email = u.email
  THEN
    u.pending_email := NULL;
    u.pending_email_set_at := NULL;
  END IF;

  NEW := u;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_clear_pending_email_on_verified ON public."user";

CREATE TRIGGER trigger_clear_pending_email_on_verified
BEFORE UPDATE OF "email", "email_verified"
ON public."user"
FOR EACH ROW
EXECUTE FUNCTION clear_pending_email_on_verified();
