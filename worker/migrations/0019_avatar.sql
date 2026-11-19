-- The learner's avatar (docs/AVATAR.md): the parts they picked, never a photo.
-- avatar is JSON of only the choices that differ from the defaults in src/lib/avatar/person.ts
-- ({"hair":"bob","glasses":"round"}); NULL means no avatar (the initial shows).
-- avatar_asked_at is when they answered the one-time "Make your avatar" prompt (saved or "Not now").
ALTER TABLE accounts ADD COLUMN avatar TEXT;
ALTER TABLE accounts ADD COLUMN avatar_asked_at INTEGER;
