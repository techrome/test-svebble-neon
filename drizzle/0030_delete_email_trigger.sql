-- Custom SQL migration file, put your code below! --
DROP TRIGGER IF EXISTS trigger_clear_pending_email_on_verified ON "user";
DROP FUNCTION IF EXISTS clear_pending_email_on_verified();