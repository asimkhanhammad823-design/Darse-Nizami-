-- Optional page image for a marker: when set, the app shows this image
-- (a scan/photo of the page) instead of just the page number.
ALTER TABLE page_marker ADD COLUMN image_key TEXT;
