-- Add image/jpg to allowed MIME types (some browsers report JPEG as image/jpg)
-- Also remove the MIME type restriction entirely to be more forgiving,
-- since the frontend already validates. But better to just add image/jpg.
UPDATE storage.buckets
SET allowed_mime_types = '{"image/jpeg","image/jpg","image/png","image/webp"}'
WHERE id = 'payment-screenshots';
