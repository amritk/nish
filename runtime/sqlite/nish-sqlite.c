/* The C half of `nish/sqlite` (std/sqlite.ts): the handle tables, and one
 * adapter per SQLite call that a Nish declaration cannot make by itself.
 *
 * A Nish program cannot hold an `sqlite3 *` in a value it exports, take an
 * out-pointer (`sqlite3 **`) or name `SQLITE_TRANSIENT`, so this file keeps
 * every connection and every prepared statement in a table and hands the
 * program an `int32_t` handle into it. A handle is the slot's index in the low
 * 16 bits and the slot's generation in the 15 above them, so it is never 0
 * or negative. Freeing a slot moves its generation on, and a handle whose
 * generation is not the slot's answers SQLITE_MISUSE, so a statement used
 * after `finalize`, or after its database's `close`, is refused rather than
 * reaching a freed pointer. Freed slots are reused oldest first, so a stale
 * handle could name a live slot again only after 32,767 reuses of every free
 * slot in turn. That is the generation's width, and it is the one way a stale
 * handle can alias.
 *
 * The tables are thread-local under --threads (`NISH_TLS`, ../nish.h). A
 * connection and its statements belong to the thread that opened them: a
 * handle passed to another thread names nothing there and answers
 * SQLITE_MISUSE. That is also why the tables need no lock. SQLite is compiled
 * SQLITE_THREADSAFE=2 under --threads (scripts/build.sh), which allows one
 * connection per thread. A thread's tables are not freed when it exits.
 *
 * Nothing here allocates except a table growing (`slot_take`) and SQLite
 * itself. Each adapter is a table load and the SQLite call, compiled to LTO
 * bitcode (scripts/build.sh, `sqlite_units`), so it inlines into the program.
 *
 * Results follow SQLite: an `int32_t` result code, extended, because every
 * connection is opened with SQLITE_OPEN_EXRESCODE. Two adapters answer a
 * handle or a length when they succeed and the negated code when they fail.
 * Text and blobs are bound SQLITE_TRANSIENT, so SQLite copies them, because
 * the program lends its bytes for the length of one call
 * (docs/LANGUAGE.md, "Calling C"). */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "../nish.h"
#include "sqlite3.h"

typedef struct nishsqlite_slot {
  void *p;        /* the sqlite3 * or sqlite3_stmt *, NULL while free */
  int32_t gen;    /* 1..32767, the high bits of the slot's handle */
  int32_t owner;  /* a statement's database handle; 0 for a database */
  int32_t next;   /* the next free slot, oldest first; 0 ends the list */
} nishsqlite_slot;

typedef struct nishsqlite_table {
  nishsqlite_slot *at; /* at[0] is never used, so no handle is 0 */
  int32_t len;
  int32_t cap;
  int32_t head; /* the oldest free slot, 0 when none */
  int32_t tail;
} nishsqlite_table;

#define NISH_SQLITE_INDEX 0xffff
#define NISH_SQLITE_GEN_MAX 0x7fff

static NISH_TLS nishsqlite_table nishsqlite_dbs;
static NISH_TLS nishsqlite_table nishsqlite_stmts;

/* What the last failed `nishsqlite_open` said, kept because the connection it
 * came from is closed before the open answers. */
static NISH_TLS char nishsqlite_open_message[256];

static inline nishsqlite_slot *slot_of(nishsqlite_table *t, int32_t h) {
  int32_t i = h & NISH_SQLITE_INDEX;
  if (h <= 0 || i == 0 || i >= t->len) return NULL;
  nishsqlite_slot *s = &t->at[i];
  if (s->p == NULL || s->gen != (h >> 16)) return NULL;
  return s;
}

static inline sqlite3 *db_of(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_dbs, h);
  return s ? (sqlite3 *)s->p : NULL;
}

static inline sqlite3_stmt *stmt_of(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_stmts, h);
  return s ? (sqlite3_stmt *)s->p : NULL;
}

/* A slot for `p`, and its handle; 0 when the table is full or cannot grow. */
static int32_t slot_take(nishsqlite_table *t, void *p, int32_t owner) {
  int32_t i = t->head;
  if (i != 0) {
    t->head = t->at[i].next;
    if (t->head == 0) t->tail = 0;
  } else {
    if (t->len == 0) t->len = 1;
    if (t->len > NISH_SQLITE_INDEX) return 0;
    if (t->len >= t->cap) {
      int32_t cap = t->cap ? t->cap * 2 : 16;
      nishsqlite_slot *at = realloc(t->at, (size_t)cap * sizeof *at);
      if (at == NULL) return 0;
      t->at = at;
      t->cap = cap;
    }
    i = t->len++;
    t->at[i].gen = 1;
  }
  t->at[i].p = p;
  t->at[i].owner = owner;
  t->at[i].next = 0;
  return (t->at[i].gen << 16) | i;
}

/* Frees the slot `h` names and moves its generation on, so `h` names nothing. */
static void slot_give(nishsqlite_table *t, int32_t h) {
  int32_t i = h & NISH_SQLITE_INDEX;
  nishsqlite_slot *s = &t->at[i];
  s->p = NULL;
  s->gen = s->gen == NISH_SQLITE_GEN_MAX ? 1 : s->gen + 1;
  s->next = 0;
  if (t->tail != 0) t->at[t->tail].next = i;
  else t->head = i;
  t->tail = i;
}

/* ---- Connections -------------------------------------------------------- */

#define NISH_SQLITE_OPEN_FLAGS                                                 \
  (SQLITE_OPEN_READONLY | SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE |         \
   SQLITE_OPEN_URI | SQLITE_OPEN_MEMORY | SQLITE_OPEN_NOFOLLOW)

/* A handle, or the negated extended code with its message kept for
 * `nishsqlite_open_errmsg`. The flags are SQLite's, less those this build
 * has no use for, and must hold READONLY, READWRITE or READWRITE|CREATE:
 * anything else is SQLITE_MISUSE, where SQLite leaves it undefined. */
int32_t nishsqlite_open(const char *path, int32_t flags) {
  int32_t mode = flags & 7;
  if ((flags & ~NISH_SQLITE_OPEN_FLAGS) != 0 || (mode != 1 && mode != 2 && mode != 6)) {
    strcpy(nishsqlite_open_message, sqlite3_errstr(SQLITE_MISUSE));
    return -SQLITE_MISUSE;
  }
  sqlite3 *db = NULL;
  int rc = sqlite3_open_v2(path, &db, flags | SQLITE_OPEN_EXRESCODE, NULL);
  if (rc == SQLITE_OK) {
    int32_t h = slot_take(&nishsqlite_dbs, db, 0);
    if (h != 0) return h;
    rc = SQLITE_NOMEM;
  }
  const char *message = db && rc != SQLITE_NOMEM ? sqlite3_errmsg(db) : sqlite3_errstr(rc);
  strncpy(nishsqlite_open_message, message, sizeof nishsqlite_open_message - 1);
  sqlite3_close_v2(db);
  return -rc;
}

/* The message of the last `nishsqlite_open` that failed on this thread. */
const char *nishsqlite_open_errmsg(void) { return nishsqlite_open_message; }

/* Finalizes every statement of the connection, frees their handles, then
 * closes it. close_v2 rather than close, so a connection something else still
 * holds (none can, today) is closed when that ends instead of staying open. */
int32_t nishsqlite_close(int32_t h) {
  sqlite3 *db = db_of(h);
  if (db == NULL) return SQLITE_MISUSE;
  nishsqlite_table *t = &nishsqlite_stmts;
  for (int32_t i = 1; i < t->len; i++) {
    if (t->at[i].p != NULL && t->at[i].owner == h) {
      sqlite3_finalize((sqlite3_stmt *)t->at[i].p);
      slot_give(t, (t->at[i].gen << 16) | i);
    }
  }
  slot_give(&nishsqlite_dbs, h);
  return sqlite3_close_v2(db);
}

int32_t nishsqlite_exec(int32_t h, const char *sql) {
  sqlite3 *db = db_of(h);
  return db ? sqlite3_exec(db, sql, NULL, NULL, NULL) : SQLITE_MISUSE;
}

/* The connection's message for its last failure, or SQLITE_MISUSE's own for
 * a handle that names no connection. */
const char *nishsqlite_errmsg(int32_t h) {
  sqlite3 *db = db_of(h);
  return db ? sqlite3_errmsg(db) : sqlite3_errstr(SQLITE_MISUSE);
}

int64_t nishsqlite_last_insert_rowid(int32_t h) {
  sqlite3 *db = db_of(h);
  return db ? sqlite3_last_insert_rowid(db) : 0;
}

int64_t nishsqlite_changes(int32_t h) {
  sqlite3 *db = db_of(h);
  return db ? sqlite3_changes64(db) : 0;
}

/* ---- Statements --------------------------------------------------------- */

/* A statement handle for the first statement of `sql`, or the negated code.
 * Text with no statement in it, only space or comments, is SQLITE_MISUSE:
 * SQLite answers OK and no statement, which leaves nothing to hand back. */
int32_t nishsqlite_prepare(int32_t h, const char *sql) {
  sqlite3 *db = db_of(h);
  if (db == NULL) return -SQLITE_MISUSE;
  sqlite3_stmt *st = NULL;
  int rc = sqlite3_prepare_v3(db, sql, -1, SQLITE_PREPARE_PERSISTENT, &st, NULL);
  if (rc != SQLITE_OK) return -rc;
  if (st == NULL) return -SQLITE_MISUSE;
  int32_t s = slot_take(&nishsqlite_stmts, st, h);
  if (s != 0) return s;
  sqlite3_finalize(st);
  return -SQLITE_NOMEM;
}

/* The message of the statement's connection, as `nishsqlite_errmsg`. */
const char *nishsqlite_stmt_errmsg(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_errmsg(sqlite3_db_handle(st)) : sqlite3_errstr(SQLITE_MISUSE);
}

int32_t nishsqlite_finalize(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL) return SQLITE_MISUSE;
  sqlite3_finalize(st);
  slot_give(&nishsqlite_stmts, h);
  return SQLITE_OK;
}

int32_t nishsqlite_step(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_step(st) : SQLITE_MISUSE;
}

/* SQLite's reset answers the last step's failure again; the program has seen
 * that from `step`, so this answers only whether the handle is good. */
int32_t nishsqlite_reset(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL) return SQLITE_MISUSE;
  sqlite3_reset(st);
  return SQLITE_OK;
}

int32_t nishsqlite_clear_bindings(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_clear_bindings(st) : SQLITE_MISUSE;
}

int32_t nishsqlite_bind_i64(int32_t h, int32_t i, int64_t v) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_bind_int64(st, i, v) : SQLITE_MISUSE;
}

int32_t nishsqlite_bind_f64(int32_t h, int32_t i, double v) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_bind_double(st, i, v) : SQLITE_MISUSE;
}

int32_t nishsqlite_bind_null(int32_t h, int32_t i) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_bind_null(st, i) : SQLITE_MISUSE;
}

int32_t nishsqlite_bind_text(int32_t h, int32_t i, const char *text) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_bind_text(st, i, text, -1, SQLITE_TRANSIENT) : SQLITE_MISUSE;
}

/* Binds `buf[off, off + len)`, `n` the buffer's length: as text when `blob` is
 * 0, as a blob otherwise. A window outside the buffer is SQLITE_MISUSE. A
 * window of no bytes binds the empty value, never NULL, which is what SQLite
 * would bind for the pointer of an empty array. */
int32_t nishsqlite_bind_bytes(int32_t h, int32_t i, const uint8_t *buf, uint64_t n, int32_t off,
                               int32_t len, int32_t blob) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL || off < 0 || len < 0 || (uint64_t)off + (uint64_t)len > n) return SQLITE_MISUSE;
  const void *p = len == 0 ? (const void *)"" : (const void *)(buf + off);
  return blob ? sqlite3_bind_blob(st, i, p, len, SQLITE_TRANSIENT)
              : sqlite3_bind_text(st, i, (const char *)p, len, SQLITE_TRANSIENT);
}

/* ---- Columns ------------------------------------------------------------ */

/* These answer what SQLite does for a column that is not there, 0 and
 * SQLITE_NULL, for a handle that names no statement too: a read cannot fail,
 * and the step before it already answered whether the statement is good. */

int32_t nishsqlite_column_count(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_column_count(st) : 0;
}

int32_t nishsqlite_column_type(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_column_type(st, c) : SQLITE_NULL;
}

int64_t nishsqlite_column_i64(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_column_int64(st, c) : 0;
}

double nishsqlite_column_f64(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_column_double(st, c) : 0.0;
}

/* The column's length in bytes as `nishsqlite_column_into` would copy it:
 * a blob's bytes, or anything else as text. */
int32_t nishsqlite_column_bytes(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL) return 0;
  if (sqlite3_column_type(st, c) != SQLITE_BLOB) sqlite3_column_text(st, c);
  return sqlite3_column_bytes(st, c);
}

/* The column as text, for a `string` result; NULL for SQL NULL. */
const char *nishsqlite_column_text(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? (const char *)sqlite3_column_text(st, c) : NULL;
}

/* Copies column `c`, a blob's bytes or anything else as text, into `buf` at
 * `at`, `n` the buffer's length, and answers the column's length. It copies
 * only when all of it fits, so a length past `n - at` says how much room the
 * read needs and nothing was written. SQLITE_MISUSE for a bad handle or an
 * `at` outside `0..n`, SQLITE_RANGE for a column that is not there, negated. */
int32_t nishsqlite_column_into(int32_t h, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL || at < 0 || (uint64_t)at > n) return -SQLITE_MISUSE;
  if (c < 0 || c >= sqlite3_column_count(st)) return -SQLITE_RANGE;
  const void *p = sqlite3_column_type(st, c) == SQLITE_BLOB ? sqlite3_column_blob(st, c)
                                                            : (const void *)sqlite3_column_text(st, c);
  int32_t len = sqlite3_column_bytes(st, c);
  if (p != NULL && (uint64_t)len <= n - (uint64_t)at) memcpy(buf + at, p, (size_t)len);
  return len;
}
