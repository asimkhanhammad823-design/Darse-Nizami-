-- Switch login from a single access_code to username + password.
-- Existing rows are backfilled from access_code so the first admin can
-- still log in (username = password = their old access_code) and then
-- change them from the panel.
ALTER TABLE app_user ADD COLUMN username TEXT;
ALTER TABLE app_user ADD COLUMN password TEXT;

UPDATE app_user SET username = access_code WHERE username IS NULL;
UPDATE app_user SET password = access_code WHERE password IS NULL;

CREATE UNIQUE INDEX idx_user_username ON app_user(username);
