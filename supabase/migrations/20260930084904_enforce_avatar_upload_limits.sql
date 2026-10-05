/*
# Enforce profile photo limits in storage itself

The `avatars` bucket had no size limit and no MIME allowlist; the only checks were in
the browser, so a signed-in user could upload an arbitrarily large file, or an HTML or
SVG document, and have it served from a permanent public URL.

Changes: set a 5 MB size limit and restrict uploads to JPEG, PNG, WebP and GIF images.
SVG is intentionally excluded because it can carry script.
*/

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'avatars';
