-- The rows the `conduit` scenario of live.ts reads, over schema.sql's tables.
-- Each is chosen for an edge of the decoding: a title with a quote and a
-- backslash, a tag the array literal must quote and escape, an article with
-- no tags, a NULL bio, and timestamps whose microseconds the millisecond
-- format cuts rather than rounds.
INSERT INTO users (id, username, email, password_hash, bio, image) VALUES
  (1, 'ada', 'ada@example.com', 'x', 'Writes the engines'' notes.', 'https://example.com/ada.png'),
  (2, 'brendan', 'brendan@example.com', 'x', NULL, NULL),
  (3, 'grace', 'grace@example.com', 'x', 'Line one.
Line two.', NULL);
INSERT INTO follows (follower_id, followee_id) VALUES (1, 3), (2, 1);
INSERT INTO articles (id, slug, author_id, title, description, body, created_at, updated_at) VALUES
  (1, 'notes-1', 1, 'Notes', 'On the engine', 'body', '2024-01-02 03:04:05.123999+00', '2024-01-02 03:04:05.999999+00'),
  (2, 'quotes-2', 3, 'Say "hi" \ back', 'A tab:	here', 'body', '2025-12-31 23:59:59.000001+00', '2026-01-01 00:00:00+00'),
  (3, 'bare-3', 2, 'Untagged', 'No tags at all', 'body', '1999-06-07 08:09:10.5+00', '1999-06-07 08:09:10.5+00');
INSERT INTO tags (id, name) VALUES (1, 'engines'), (2, 'say "hi"'), (3, 'back\slash'), (4, 'a,b');
INSERT INTO article_tags (article_id, tag_id) VALUES (1, 1), (2, 2), (2, 3), (2, 4), (1, 4);
INSERT INTO favorites (user_id, article_id) VALUES (1, 2), (2, 2), (3, 1);
