/* The C twin of bench/sqlite/main.ts, and the seed that makes the database
 * both read. `bench/sqlite/run.mjs` builds it against the vendored
 * runtime/sqlite/sqlite3.c with the flags scripts/build.sh compiles SQLite
 * with for a `--link` build, so the two sides run the same SQLite.
 *
 *   twin seed <db> <schema.sql>    the challenge's 50,000 users, 500,000 posts
 *                                  and 2,000,000 likes, in WAL mode
 *   twin <workload> <db> <count>   lookup | feed | insert | insert-txn
 *
 * A workload prints `rows R checksum S failed F count N ns T`, the same line
 * main.ts prints for the same arguments; T is the timed loop alone. Each call
 * is what main.ts does through nish/sqlite, written against SQLite's own API:
 * bind, step, every column read (text copied into one reused buffer), reset.
 *
 * The seed is a port of the twelve-dollar server challenge's
 * seed/generate.mjs (https://github.com/arjaythedev/twelve-dollar-server-challenge):
 * its mulberry32 generator and seed 42, its table sizes, its users, posts
 * and bodies, and its ADJECTIVES and NOUNS lists verbatim; WORDS is part of
 * its word list with "sqlite" added, and the likes are this file's own. The
 * workloads' SQL is the challenge's SPEC.md queries; the loops are this
 * file's own. bench/sqlite/LICENSE.md says what is ported in full.
 * Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
 * see bench/sqlite/LICENSE.md. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "sqlite3.h"

#define USERS 50000
#define POSTS 500000
#define LIKES 2000000

#define POST_SQL                                                                                   \
  "SELECT p.id, p.body, p.created_at, u.username,"                                                 \
  " (SELECT count(*) FROM likes l WHERE l.post_id = p.id)"                                         \
  " FROM posts p JOIN users u ON u.id = p.user_id"
#define INSERT_SQL "INSERT INTO posts (user_id, body) VALUES (?, ?) RETURNING id, created_at"

static void die(sqlite3 *db, const char *what) {
  fprintf(stderr, "twin: %s: %s\n", what, db ? sqlite3_errmsg(db) : "out of memory");
  exit(2);
}

static void exec(sqlite3 *db, const char *sql) {
  if (sqlite3_exec(db, sql, NULL, NULL, NULL) != SQLITE_OK) die(db, sql);
}

static sqlite3_stmt *prepare(sqlite3 *db, const char *sql) {
  sqlite3_stmt *st = NULL;
  if (sqlite3_prepare_v3(db, sql, -1, SQLITE_PREPARE_PERSISTENT, &st, NULL) != SQLITE_OK) die(db, sql);
  return st;
}

/* ---- The seed ----------------------------------------------------------- */

/* mulberry32, the challenge's generator, seeded with its 42: a value in [0, 1). */
static uint32_t mul_state = 42;
static double rnd(void) {
  uint32_t t = mul_state += 0x6d2b79f5u;
  t = (t ^ (t >> 15)) * (t | 1u);
  t ^= t + (t ^ (t >> 7)) * (t | 61u);
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}
static int pick(int n) { return (int)(rnd() * n); }

/* `ms` since the epoch in the schema's wire format, 2025-01-01T00:00:00.000Z. */
static void iso(int64_t ms, char out[32]) {
  time_t s = (time_t)(ms / 1000);
  struct tm tm;
  gmtime_r(&s, &tm);
  snprintf(out, 32, "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ", tm.tm_year + 1900, tm.tm_mon + 1,
           tm.tm_mday, tm.tm_hour, tm.tm_min, tm.tm_sec, (int)(ms % 1000));
}

static const char *const ADJECTIVES[] = {"quiet", "brave", "clever", "sunny",  "rusty",   "swift", "lazy",
                                         "mellow", "sharp", "wild",  "cosmic", "tiny",    "golden", "silver",
                                         "happy", "grumpy", "curious", "lucky", "salty", "zesty"};
static const char *const NOUNS[] = {"otter",   "falcon",  "badger",  "comet",  "river",  "maple",  "pixel",
                                    "walrus",  "ember",   "glacier", "lantern", "meadow", "nebula", "orchid",
                                    "pebble",  "quartz",  "raven",   "sparrow", "thistle", "willow"};
static const char *const WORDS[] = {
    "the",     "a",        "and",       "but",      "because", "just",     "really",  "maybe",
    "server",  "database", "request",   "latency",  "cache",   "index",    "query",   "benchmark",
    "cpu",     "memory",   "disk",      "network",  "users",   "coffee",   "deploy",  "release",
    "bug",     "feature",  "rewrite",   "refactor", "commit",  "review",   "shipping", "measuring",
    "fast",    "slow",     "cheap",     "simple",   "boring",  "weird",    "honest",  "tired",
    "today",   "tonight",  "again",     "finally",  "never",   "always",   "nginx",   "sqlite"};
#define COUNT(a) ((int)(sizeof(a) / sizeof((a)[0])))

/* One to three sentences of four to fourteen words, at most 500 bytes. */
static int body(char *out) {
  int n = 0;
  int sentences = 1 + pick(3);
  for (int s = 0; s < sentences; s++) {
    int words = 4 + pick(11);
    for (int w = 0; w < words; w++) {
      const char *word = WORDS[pick(COUNT(WORDS))];
      n += snprintf(out + n, (size_t)(600 - n), "%s%s", n > 0 ? " " : "", word);
    }
    out[n++] = ".!?"[pick(3)];
  }
  if (out[0] >= 'a' && out[0] <= 'z') out[0] = (char)(out[0] - 32);
  if (n > 500) n = 500;
  out[n] = 0;
  return n;
}

static int seed(const char *path, const char *schema_path) {
  remove(path);
  FILE *f = fopen(schema_path, "rb");
  if (f == NULL) {
    fprintf(stderr, "twin: cannot read %s\n", schema_path);
    return 2;
  }
  static char schema[1 << 16];
  size_t len = fread(schema, 1, sizeof schema - 1, f);
  fclose(f);
  schema[len] = 0;

  sqlite3 *db = NULL;
  if (sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, NULL) != SQLITE_OK) die(db, path);
  exec(db, "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF");
  exec(db, schema);
  exec(db, "BEGIN");
  const int64_t end = 1767225600000; /* 2026-01-01T00:00:00Z */
  const int64_t day = 86400000;
  char ts[32], text[640];

  sqlite3_stmt *u = prepare(db, "INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)");
  for (int i = 1; i <= USERS; i++) {
    /* Drawn in two statements: C leaves the order of a call's arguments open. */
    const char *adjective = ADJECTIVES[pick(COUNT(ADJECTIVES))];
    const char *noun = NOUNS[pick(COUNT(NOUNS))];
    int n = snprintf(text, sizeof text, "%s_%s_%d", adjective, noun, i);
    iso(end - 730 * day + (int64_t)(rnd() * 365 * day), ts);
    sqlite3_bind_int(u, 1, i);
    sqlite3_bind_text(u, 2, text, n, SQLITE_STATIC);
    sqlite3_bind_text(u, 3, ts, -1, SQLITE_STATIC);
    if (sqlite3_step(u) != SQLITE_DONE) die(db, "users");
    sqlite3_reset(u);
  }
  sqlite3_finalize(u);

  /* Posts spread evenly over 2025 in id order, authorship skewed toward low
   * user ids, as the challenge's generator spreads them. */
  sqlite3_stmt *p = prepare(db, "INSERT INTO posts (id, user_id, body, created_at) VALUES (?, ?, ?, ?)");
  const double step = 365.0 * day / POSTS;
  for (int i = 0; i < POSTS; i++) {
    int user = 1 + (int)(USERS * rnd() * rnd());
    int n = body(text);
    iso(end - 365 * day + (int64_t)(i * step + rnd() * step * 0.9), ts);
    sqlite3_bind_int(p, 1, i + 1);
    sqlite3_bind_int(p, 2, user);
    sqlite3_bind_text(p, 3, text, n, SQLITE_STATIC);
    sqlite3_bind_text(p, 4, ts, -1, SQLITE_STATIC);
    if (sqlite3_step(p) != SQLITE_DONE) die(db, "posts");
    sqlite3_reset(p);
  }
  sqlite3_finalize(p);

  /* Likes on uniformly random posts by uniformly random users, one per pair,
   * until there are LIKES of them: four a post on average. */
  sqlite3_stmt *l = prepare(db, "INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)");
  for (int have = 0; have < LIKES;) {
    int user = 1 + pick(USERS);
    int post = 1 + pick(POSTS);
    iso(end - 365 * day + (int64_t)((post - 1) * step + rnd() * 7 * day), ts);
    sqlite3_bind_int(l, 1, user);
    sqlite3_bind_int(l, 2, post);
    sqlite3_bind_text(l, 3, ts, -1, SQLITE_STATIC);
    if (sqlite3_step(l) != SQLITE_DONE) die(db, "likes");
    have += sqlite3_changes(db);
    sqlite3_reset(l);
  }
  sqlite3_finalize(l);
  exec(db, "COMMIT");
  exec(db, "ANALYZE");
  exec(db, "PRAGMA journal_mode=WAL");
  if (sqlite3_close(db) != SQLITE_OK) die(db, "close");
  printf("seeded %s: %d users, %d posts, %d likes\n", path, USERS, POSTS, LIKES);
  return 0;
}

/* ---- The workloads ------------------------------------------------------ */

static int64_t nanos(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}

static uint8_t buf[1024];

/* The checksum is a local of main's, passed in and handed back, so it stays
 * in a register as main.ts's stays in a local. */
static uint32_t fold(uint32_t sum, uint32_t v) { return sum * 31u + v; }

/* Column `c` copied into `buf` as nishsqlite_column_into copies it, its
 * length and every byte folded into the checksum. */
static uint32_t fold_text(uint32_t sum, sqlite3_stmt *st, int c) {
  const unsigned char *p = sqlite3_column_text(st, c);
  int n = sqlite3_column_bytes(st, c);
  if (p != NULL && (size_t)n <= sizeof buf) memcpy(buf, p, (size_t)n);
  sum = fold(sum, (uint32_t)n);
  for (int k = 0; k < n && k < (int)sizeof buf; k++) sum = fold(sum, buf[k]);
  return sum;
}

/* One row of POST_SQL: id, body, created_at, username, like count. */
static uint32_t fold_post(uint32_t sum, sqlite3_stmt *st) {
  sum = fold(sum, (uint32_t)sqlite3_column_int64(st, 0));
  sum = fold_text(sum, st, 1);
  sum = fold_text(sum, st, 2);
  sum = fold_text(sum, st, 3);
  return fold(sum, (uint32_t)sqlite3_column_int64(st, 4));
}

/* The 64 bodies the inserts cycle through, body k at k * 256, built as
 * main.ts builds them. */
static uint8_t bodies[64 * 256];
static int body_len(int k) { return 40 + (k * 37) % 200; }
static void make_bodies(void) {
  for (int k = 0; k < 64; k++)
    for (int j = 0; j < body_len(k); j++) bodies[k * 256 + j] = j % 6 == 5 ? ' ' : (uint8_t)('a' + (j * 7 + k) % 26);
}

int main(int argc, char **argv) {
  if (argc == 4 && strcmp(argv[1], "seed") == 0) return seed(argv[2], argv[3]);
  if (argc != 4) {
    fprintf(stderr, "usage: twin seed <db> <schema.sql> | twin <lookup|feed|insert|insert-txn> <db> <count>\n");
    return 2;
  }
  const char *mode = argv[1];
  int count = atoi(argv[3]);
  sqlite3 *db = NULL;
  if (sqlite3_open_v2(argv[2], &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_EXRESCODE, NULL) != SQLITE_OK) die(db, argv[2]);
  exec(db, "PRAGMA synchronous=NORMAL");
  int rows = 0, failed = 0;
  uint32_t sum = 0;
  int64_t t0 = 0, t1 = 0;

  if (strcmp(mode, "lookup") == 0) {
    sqlite3_stmt *st = prepare(db, POST_SQL " WHERE p.id = ?");
    uint32_t x = 2463534242u;
    t0 = nanos();
    for (int i = 0; i < count; i++) {
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      if (sqlite3_bind_int64(st, 1, (int64_t)(x % POSTS) + 1) != SQLITE_OK) failed++;
      if (sqlite3_step(st) == SQLITE_ROW) {
        rows++;
        sum = fold_post(sum, st);
      } else {
        failed++;
      }
      sqlite3_reset(st);
    }
    t1 = nanos();
    sqlite3_finalize(st);
  } else if (strcmp(mode, "feed") == 0) {
    sqlite3_stmt *st = prepare(db, POST_SQL " ORDER BY p.created_at DESC, p.id DESC LIMIT 20");
    t0 = nanos();
    for (int i = 0; i < count; i++) {
      int rc;
      while ((rc = sqlite3_step(st)) == SQLITE_ROW) {
        rows++;
        sum = fold_post(sum, st);
      }
      if (rc != SQLITE_DONE) failed++;
      sqlite3_reset(st);
    }
    t1 = nanos();
    sqlite3_finalize(st);
  } else if (strcmp(mode, "insert") == 0 || strcmp(mode, "insert-txn") == 0) {
    int txn = mode[6] == '-';
    make_bodies();
    /* The rows a run adds go again before and after it, untimed, so every
     * run starts from the seed and RETURNING answers the same ids. */
    exec(db, "DELETE FROM posts WHERE id > 500000");
    sqlite3_stmt *st = prepare(db, INSERT_SQL);
    t0 = nanos();
    if (txn) exec(db, "BEGIN");
    for (int i = 0; i < count; i++) {
      int k = i % 64;
      if (sqlite3_bind_int64(st, 1, 1 + i % USERS) != SQLITE_OK) failed++;
      if (sqlite3_bind_text(st, 2, (const char *)bodies + k * 256, body_len(k), SQLITE_TRANSIENT) != SQLITE_OK)
        failed++;
      if (sqlite3_step(st) == SQLITE_ROW) {
        rows++;
        sum = fold(sum, (uint32_t)sqlite3_column_int64(st, 0));
        /* created_at is the clock's: its length is folded, not its bytes. */
        const unsigned char *p = sqlite3_column_text(st, 1);
        int n = sqlite3_column_bytes(st, 1);
        if (p != NULL && (size_t)n <= sizeof buf) memcpy(buf, p, (size_t)n);
        sum = fold(sum, (uint32_t)n);
      } else {
        failed++;
      }
      sqlite3_reset(st);
    }
    if (txn) exec(db, "COMMIT");
    t1 = nanos();
    sqlite3_finalize(st);
    exec(db, "DELETE FROM posts WHERE id > 500000");
    exec(db, "PRAGMA wal_checkpoint(TRUNCATE)");
  } else {
    fprintf(stderr, "twin: unknown workload %s\n", mode);
    return 2;
  }
  if (sqlite3_close(db) != SQLITE_OK) die(db, "close");
  printf("rows %d checksum %u failed %d count %d ns %lld\n", rows, sum, failed, count, (long long)(t1 - t0));
  return 0;
}
