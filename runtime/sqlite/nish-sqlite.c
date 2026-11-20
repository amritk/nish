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
 * reaching a freed pointer. A slot whose generation reaches 32,767, the
 * generation's width, is retired rather than restarted at 1, so no handle
 * ever names a slot twice and a stale handle can never alias a live one. A
 * table that has retired or filled all 65,535 of its slots answers
 * SQLITE_NOMEM, which takes some two billion opens or prepares.
 *
 * The tables are thread-local under --threads (`NISH_TLS`, ../nish.h). A
 * connection and its statements belong to the thread that opened them: a
 * handle passed to another thread names nothing there and answers
 * SQLITE_MISUSE. That is also why the tables need no lock. SQLite is compiled
 * SQLITE_THREADSAFE=2 under --threads (scripts/build.sh), which allows one
 * connection per thread. A thread's tables are not freed when it exits.
 *
 * Nothing here allocates except a table growing (`slot_take`), a cursor
 * opening (`nishsqlite_cursor_open`, one block for the cursor and its key),
 * a cursor's row buffer growing for a record that spills onto overflow pages
 * (`row_of`), and SQLite itself. Each adapter is a table load and the SQLite call. This file
 * includes the amalgamation, sqlite3.c, and is the one unit of
 * runtime/sqlite/ (scripts/build.sh, `sqlite_units`): the cursor adapter
 * below calls SQLite's B-tree and record functions, which are static there
 * (docs/sqlite-cursor.md). The unit is native code, so the adapters do not
 * inline into the program, but SQLite's own calls inline into them.
 *
 * Results follow SQLite: an `int32_t` result code, extended, because every
 * connection is opened with SQLITE_OPEN_EXRESCODE. Some adapters answer a
 * handle, a length or a cursor move when they succeed and the negated code when they fail.
 * Text and blobs are bound SQLITE_TRANSIENT, so SQLite copies them, because
 * the program lends its bytes for the length of one call
 * (docs/LANGUAGE.md, "Calling C"). */

#include "sqlite3.c"

/* A cursor holds its B-tree's pages by its connection's Btree. With a shared
 * cache another connection could free them under it, so the cursors refuse
 * to build without SQLITE_OMIT_SHARED_CACHE, which scripts/build.sh passes. */
#ifndef SQLITE_OMIT_SHARED_CACHE
#error "nish-sqlite.c needs SQLITE_OMIT_SHARED_CACHE"
#endif

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "../nish.h"

typedef struct nishsqlite_slot {
  void *p;        /* the connection, statement or cursor; NULL while free */
  int32_t gen;    /* 1..32767, the high bits of the slot's handle */
  int32_t owner;  /* the database handle of a statement or cursor; 0 for a database */
  int32_t next;   /* the next free slot, oldest first; 0 ends the list */
  int32_t flags;  /* a statement's NISH_SQLITE_PLAIN */
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
static NISH_TLS nishsqlite_table nishsqlite_cursors;

/* A shape `cursor_build` checked: what the schema check found for one `name`
 * and `columns`, under one schema cookie. It is kept only from a transaction
 * that is a read (`SQLITE_TXN_READ`), whose cookie is a committed one, and
 * answered only to an open whose read sees the same cookie: SQLite's own test
 * of whether a prepared statement still matches the schema. */
#define NISH_SQLITE_SHAPES 8
typedef struct nishsqlite_shape {
  char *name;    /* NULL for an empty entry */
  char *columns;
  u32 cookie;
  int32_t is_index, ncol, nkey, alias;
  Pgno root;
  KeyInfo *ki; /* one reference, the entry's */
} nishsqlite_shape;

/* A connection: the slot of a database handle points at one of these. The
 * authorizer (`nishsqlite_authorize`) gets it as its user data. */
typedef struct nishsqlite_conn {
  sqlite3 *db;
  int32_t self;        /* the connection's own handle */
  int32_t classifying; /* inside nishsqlite_prepare: record what is authorized */
  int32_t seen_select; /* SQLITE_SELECT was authorized while classifying */
  int32_t seen_other;  /* an action off the allowlist was authorized */
  int32_t internal;    /* the adapter's own statements are running */
  int32_t ncursors;    /* open cursors, so invalidating none costs no scan */
  int32_t shape_next;  /* the entry of `shapes` the next miss replaces */
  /* `nishsqlite_begin_read`'s and `nishsqlite_end_read`'s statements,
   * prepared on first use and reset after each run. */
  sqlite3_stmt *begin_st, *schema_st, *commit_st;
  nishsqlite_shape shapes[NISH_SQLITE_SHAPES];
} nishsqlite_conn;

/* A statement that authorized SQLITE_SELECT and nothing off the allowlist: one
 * that may step while the connection's cursors stay open. */
#define NISH_SQLITE_PLAIN 1

/* What the last failed `nishsqlite_open` said, kept because the connection it
 * came from is closed before the open answers. */
static NISH_TLS char nishsqlite_open_message[256];

static inline nishsqlite_slot *slot_of(nishsqlite_table *t, int32_t h) {
  int32_t i = h & NISH_SQLITE_INDEX;
  if (h <= 0 || i >= t->len) return NULL;
  nishsqlite_slot *s = &t->at[i];
  if (s->p == NULL || s->gen != (h >> 16)) return NULL;
  return s;
}

static inline nishsqlite_conn *conn_of(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_dbs, h);
  return s ? (nishsqlite_conn *)s->p : NULL;
}

static inline sqlite3 *db_of(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  return c ? c->db : NULL;
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
      memset(at + t->cap, 0, (size_t)(cap - t->cap) * sizeof *at); /* at[0] stays empty */
      t->at = at;
      t->cap = cap;
    }
    i = t->len++;
    t->at[i].gen = 1;
  }
  t->at[i].p = p;
  t->at[i].owner = owner;
  t->at[i].next = 0;
  t->at[i].flags = 0;
  return (t->at[i].gen << 16) | i;
}

/* Frees the slot `h` names and moves its generation on, so `h` names nothing.
 * A slot at the last generation is retired: it stays empty and off the free
 * list, so its handles are never handed out again. */
static void slot_give(nishsqlite_table *t, int32_t h) {
  int32_t i = h & NISH_SQLITE_INDEX;
  nishsqlite_slot *s = &t->at[i];
  s->p = NULL;
  s->next = 0;
  if (s->gen == NISH_SQLITE_GEN_MAX) return;
  s->gen++;
  if (t->tail != 0) t->at[t->tail].next = i;
  else t->head = i;
  t->tail = i;
}

/* ---- Connections -------------------------------------------------------- */

static void cursors_invalidate(nishsqlite_conn *c);

/* Empties the connection's checked shapes. Before the close: a KeyInfo is
 * freed through its connection. */
static void shapes_clear(nishsqlite_conn *c) {
  sqlite3_mutex *mx = sqlite3_db_mutex(c->db);
  sqlite3_mutex_enter(mx); /* a KeyInfo is freed through its db */
  for (int32_t i = 0; i < NISH_SQLITE_SHAPES; i++) {
    nishsqlite_shape *s = &c->shapes[i];
    sqlite3_free(s->name);
    sqlite3_free(s->columns);
    sqlite3KeyInfoUnref(s->ki);
    memset(s, 0, sizeof *s);
  }
  c->shape_next = 0;
  sqlite3_mutex_leave(mx);
}

/* The connection's authorizer, which the adapter owns: `nish/sqlite` exposes
 * none. It never refuses anything; it only watches. While `nishsqlite_prepare`
 * classifies a statement it records whether the statement authorized
 * SQLITE_SELECT and whether it authorized anything off the allowlist. Outside
 * that, and outside the adapter's own statements, an action off the allowlist
 * is a statement about to run that the classification did not see (one
 * `sqlite3_exec` prepares, a re-prepare inside `sqlite3_step`, the statement a
 * pragma table-valued function prepares), so the connection's cursors are
 * invalidated on the spot (docs/sqlite-cursor.md). */
static int nishsqlite_authorize(void *user, int action, const char *a, const char *b,
                                const char *db_name, const char *trigger) {
  (void)a, (void)b, (void)db_name, (void)trigger;
  nishsqlite_conn *c = user;
  int listed = action == SQLITE_SELECT || action == SQLITE_READ || action == SQLITE_FUNCTION ||
               action == SQLITE_RECURSIVE;
  if (c->internal) return SQLITE_OK;
  if (c->classifying) {
    if (action == SQLITE_SELECT) c->seen_select = 1;
    if (!listed) c->seen_other = 1;
  } else if (!listed) {
    cursors_invalidate(c);
  }
  return SQLITE_OK;
}

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
    nishsqlite_conn *c = calloc(1, sizeof *c);
    int32_t h = c ? slot_take(&nishsqlite_dbs, c, 0) : 0;
    if (h != 0) {
      c->db = db;
      c->self = h;
      sqlite3_set_authorizer(db, nishsqlite_authorize, c);
      return h;
    }
    free(c);
    rc = SQLITE_NOMEM;
  }
  const char *message = db && rc != SQLITE_NOMEM ? sqlite3_errmsg(db) : sqlite3_errstr(rc);
  strncpy(nishsqlite_open_message, message, sizeof nishsqlite_open_message - 1);
  sqlite3_close_v2(db);
  return -rc;
}

/* The message of the last `nishsqlite_open` that failed on this thread. */
const char *nishsqlite_open_errmsg(void) { return nishsqlite_open_message; }

/* Closes every cursor of the connection, then finalizes every statement of
 * it, frees their handles, then closes it. close_v2 rather than close, so a
 * connection something else still holds (none can, today) is closed when that
 * ends instead of staying open. The handle is freed only once the close
 * succeeds, so a close that fails leaves the connection usable and its message
 * readable. */
int32_t nishsqlite_close(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL) return SQLITE_MISUSE;
  sqlite3 *db = c->db;
  cursors_invalidate(c);
  shapes_clear(c);
  sqlite3_finalize(c->begin_st);
  sqlite3_finalize(c->schema_st);
  sqlite3_finalize(c->commit_st);
  nishsqlite_table *t = &nishsqlite_stmts;
  for (int32_t i = 1; i < t->len; i++) {
    if (t->at[i].p != NULL && t->at[i].owner == h) {
      sqlite3_finalize((sqlite3_stmt *)t->at[i].p);
      slot_give(t, (t->at[i].gen << 16) | i);
    }
  }
  int rc = sqlite3_close_v2(db);
  if (rc == SQLITE_OK) {
    slot_give(&nishsqlite_dbs, h);
    free(c);
  }
  return rc;
}

/* Invalidates the connection's cursors first: exec answers no rows, so a plain
 * read through it has no use, and it runs `BEGIN`, `COMMIT` and `ROLLBACK`. */
int32_t nishsqlite_exec(int32_t h, const char *sql) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL) return SQLITE_MISUSE;
  cursors_invalidate(c);
  return sqlite3_exec(c->db, sql, NULL, NULL, NULL);
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
 * SQLite answers OK and no statement, which leaves nothing to hand back. The
 * authorizer classifies the statement while it is prepared: it is plain when
 * it authorized SQLITE_SELECT and nothing off the allowlist. */
int32_t nishsqlite_prepare(int32_t h, const char *sql) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL) return -SQLITE_MISUSE;
  sqlite3_stmt *st = NULL;
  c->classifying = 1;
  c->seen_select = 0;
  c->seen_other = 0;
  int rc = sqlite3_prepare_v3(c->db, sql, -1, SQLITE_PREPARE_PERSISTENT, &st, NULL);
  c->classifying = 0;
  if (rc != SQLITE_OK) return -rc;
  if (st == NULL) return -SQLITE_MISUSE;
  int32_t s = slot_take(&nishsqlite_stmts, st, h);
  if (s != 0) {
    if (c->seen_select && !c->seen_other) nishsqlite_stmts.at[s & NISH_SQLITE_INDEX].flags = NISH_SQLITE_PLAIN;
    return s;
  }
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

/* Invalidates the connection's cursors before a statement that is not plain
 * steps. */
int32_t nishsqlite_step(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_stmts, h);
  if (s == NULL) return SQLITE_MISUSE;
  if (!(s->flags & NISH_SQLITE_PLAIN)) {
    nishsqlite_conn *c = conn_of(s->owner);
    if (c->ncursors != 0) cursors_invalidate(c);
  }
  return sqlite3_step((sqlite3_stmt *)s->p);
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
 * and the step before it already answered whether the statement is good. A
 * column that is not there, or any column when no row is current (before the
 * first step, or after the last), is answered here, before SQLite, which would
 * otherwise record SQLITE_RANGE as the connection's last error. */

/* The statement `h` names, when its current row has a column `c`; NULL
 * otherwise. sqlite3_data_count is 0 when no row is current. */
static inline sqlite3_stmt *column_of(int32_t h, int32_t c) {
  sqlite3_stmt *st = stmt_of(h);
  return st && c >= 0 && c < sqlite3_data_count(st) ? st : NULL;
}

int32_t nishsqlite_column_count(int32_t h) {
  sqlite3_stmt *st = stmt_of(h);
  return st ? sqlite3_column_count(st) : 0;
}

int32_t nishsqlite_column_type(int32_t h, int32_t c) {
  sqlite3_stmt *st = column_of(h, c);
  return st ? sqlite3_column_type(st, c) : SQLITE_NULL;
}

int64_t nishsqlite_column_i64(int32_t h, int32_t c) {
  sqlite3_stmt *st = column_of(h, c);
  return st ? sqlite3_column_int64(st, c) : 0;
}

double nishsqlite_column_f64(int32_t h, int32_t c) {
  sqlite3_stmt *st = column_of(h, c);
  return st ? sqlite3_column_double(st, c) : 0.0;
}

/* The column's length in bytes as `nishsqlite_column_into` would copy it:
 * a blob's bytes, or anything else as text. */
int32_t nishsqlite_column_bytes(int32_t h, int32_t c) {
  sqlite3_stmt *st = column_of(h, c);
  if (st == NULL) return 0;
  if (sqlite3_column_type(st, c) != SQLITE_BLOB) sqlite3_column_text(st, c);
  return sqlite3_column_bytes(st, c);
}

/* The column as text, for a `string` result; NULL for SQL NULL. */
const char *nishsqlite_column_text(int32_t h, int32_t c) {
  sqlite3_stmt *st = column_of(h, c);
  return st ? (const char *)sqlite3_column_text(st, c) : NULL;
}

/* Copies column `c`, a blob's bytes or anything else as text, into `buf` at
 * `at`, `n` the buffer's length, and answers the column's length. It copies
 * only when all of it fits, so a length past `n - at` says how much room the
 * read needs and nothing was written. SQLITE_MISUSE for a bad handle or an
 * `at` outside `0..n`, SQLITE_RANGE for a column that is not there, and
 * SQLITE_NOMEM when SQLite cannot convert a value to text, all negated. Only
 * a NULL or a blob has no pointer and is still read: an empty blob has none.
 * A column of the statement read when no row is current answers 0 and writes
 * nothing, as a NULL does, without asking SQLite. */
int32_t nishsqlite_column_into(int32_t h, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  sqlite3_stmt *st = stmt_of(h);
  if (st == NULL || at < 0 || (uint64_t)at > n) return -SQLITE_MISUSE;
  /* With a row current sqlite3_data_count is the column count, so the row's
   * path asks SQLite once where it would ask twice. */
  int32_t cols = sqlite3_data_count(st);
  if (cols == 0) return c < 0 || c >= sqlite3_column_count(st) ? -SQLITE_RANGE : 0;
  if (c < 0 || c >= cols) return -SQLITE_RANGE;
  int type = sqlite3_column_type(st, c);
  const void *p = type == SQLITE_BLOB ? sqlite3_column_blob(st, c) : (const void *)sqlite3_column_text(st, c);
  if (p == NULL && type != SQLITE_NULL && type != SQLITE_BLOB) return -SQLITE_NOMEM;
  int32_t len = sqlite3_column_bytes(st, c);
  if (p != NULL && (uint64_t)len <= n - (uint64_t)at) memcpy(buf + at, p, (size_t)len);
  return len;
}

/* ---- Cursors ------------------------------------------------------------ */

/* A cursor reads one table or index of `main` through SQLite's own B-tree
 * cursor (`sqlite3BtreeCursor`) and record decoder (`sqlite3VdbeRecordUnpack`),
 * inside a read transaction `nishsqlite_begin_read` opened. Nothing here reads
 * the file format or writes a field of SQLite's structures that its functions
 * do not take: the cursor, the KeyInfo, the decoded row and the seek key are
 * all made by SQLite's functions. The fields set by hand are the ones of the
 * UnpackedRecord a seek passes in, which is how SQLite's own VDBE builds one,
 * and a KeyInfo's `aSortFlags` entry for a DESC key column, which is how
 * SQLite's own `sqlite3KeyInfoOfIndex` fills it (docs/sqlite-cursor.md, "What
 * the adapter calls").
 *
 * A cursor belongs to its connection (the slot's owner) and lives until the
 * program closes it, `nishsqlite_end_read`, or anything that could change what
 * it reads: a statement that is not plain stepping, `nishsqlite_exec`, the
 * authorizer seeing an action off its allowlist, or the transaction ending
 * under it (`cursor_of`). Invalidating frees the cursor and its slot, so its
 * handle answers SQLITE_MISUSE from then on. The moves and reads allocate
 * nothing once the first row has been read: the decoded row and the copy
 * buffer are the cursor's and are reused. */

#define NISH_SQLITE_SEEK_GE 1
#define NISH_SQLITE_SEEK_GT 2
#define NISH_SQLITE_SEEK_LE 3
#define NISH_SQLITE_SEEK_LT 4

/* Bytes past a copied record that are kept zeroed: on a corrupt record the
 * decoder can read a varint and an 8-byte value past its end. 18 is the
 * padding `sqlite3BtreeIndexMoveto` gives the copy it decodes (`nOverrun`). */
#define NISH_SQLITE_SLACK 18

typedef struct nishsqlite_cursor {
  nishsqlite_conn *conn;
  Btree *btree;        /* `main`, from sqlite3DbNameToBtree */
  BtCursor *bt;        /* in the same block, after this struct */
  KeyInfo *ki;         /* the record's fields, for the decoder and a seek */
  UnpackedRecord *row; /* the current row, decoded on the first read of it */
  Mem *key;            /* the seek key's `nkeyfields` values, in the block */
  int32_t nkeyparts;   /* how many of them are set */
  int32_t nkeyfields;  /* an index's key columns; a table's columns */
  u8 *buf;             /* a record that is not all on its page, copied */
  u32 cap;
  int32_t ncol;      /* columns the program reads: a table's, or an index's key and rowid */
  int32_t alias;     /* a table's INTEGER PRIMARY KEY column, -1 when none */
  int32_t is_index;
  int32_t has_row;   /* the last move answered a row */
  int32_t unpacked;  /* `row` holds the current row */
  int32_t nfields;   /* the fields the current row's record holds */
} nishsqlite_cursor;

static void cursor_free(nishsqlite_cursor *cur) {
  sqlite3 *db = cur->conn->db;
  sqlite3BtreeCloseCursor(cur->bt);
  for (int32_t i = 0; i < cur->nkeyfields; i++) sqlite3VdbeMemRelease(&cur->key[i]);
  if (cur->row) sqlite3DbFree(db, cur->row);
  sqlite3KeyInfoUnref(cur->ki);
  sqlite3_free(cur->buf);
  sqlite3_free(cur);
}

static void cursors_invalidate(nishsqlite_conn *c) {
  if (c->ncursors == 0) return;
  sqlite3_mutex *mx = sqlite3_db_mutex(c->db);
  sqlite3_mutex_enter(mx);
  nishsqlite_table *t = &nishsqlite_cursors;
  for (int32_t i = 1; i < t->len; i++) {
    nishsqlite_slot *s = &t->at[i];
    if (s->p == NULL || s->owner != c->self) continue;
    cursor_free(s->p);
    slot_give(t, (s->gen << 16) | i);
  }
  c->ncursors = 0;
  sqlite3_mutex_leave(mx);
}

/* The cursor `h` names, or NULL. A cursor whose transaction has ended, by
 * whatever route, is invalidated here with every other cursor of its
 * connection before anything reads it. */
static inline nishsqlite_cursor *cursor_of(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_cursors, h);
  if (s == NULL) return NULL;
  nishsqlite_cursor *cur = s->p;
  if (sqlite3_get_autocommit(cur->conn->db) || sqlite3BtreeTxnState(cur->btree) == SQLITE_TXN_NONE) {
    cursors_invalidate(cur->conn);
    return NULL;
  }
  return cur;
}

/* Runs the adapter's own SQL, which the authorizer lets through unwatched. */
static int internal_exec(nishsqlite_conn *c, const char *sql) {
  c->internal = 1;
  int rc = sqlite3_exec(c->db, sql, NULL, NULL, NULL);
  c->internal = 0;
  return rc;
}

static int internal_prepare(nishsqlite_conn *c, const char *sql, const char *arg, sqlite3_stmt **st) {
  c->internal = 1;
  int rc = sqlite3_prepare_v2(c->db, sql, -1, st, NULL);
  if (rc == SQLITE_OK && arg) rc = sqlite3_bind_text(*st, 1, arg, -1, SQLITE_TRANSIENT);
  c->internal = 0;
  return rc;
}

static int internal_step(nishsqlite_conn *c, sqlite3_stmt *st) {
  c->internal = 1;
  int rc = sqlite3_step(st);
  c->internal = 0;
  return rc;
}

/* Runs `sql` to its end as the adapter's own SQL, through the statement kept
 * in `*st`: prepared the first time, reset after each run so it holds no
 * lock. A schema change re-prepares it inside `sqlite3_step`, under the same
 * `internal` flag. */
static int internal_run(nishsqlite_conn *c, sqlite3_stmt **st, const char *sql) {
  c->internal = 1;
  int rc = *st ? SQLITE_OK : sqlite3_prepare_v3(c->db, sql, -1, SQLITE_PREPARE_PERSISTENT, st, NULL);
  if (rc == SQLITE_OK) {
    rc = sqlite3_step(*st);
    while (rc == SQLITE_ROW) rc = sqlite3_step(*st);
    rc = rc == SQLITE_DONE ? SQLITE_OK : rc;
    sqlite3_reset(*st);
  }
  c->internal = 0;
  return rc;
}

static int main_in_read(sqlite3 *db) {
  return !sqlite3_get_autocommit(db) && sqlite3_txn_state(db, "main") >= SQLITE_TXN_READ;
}

/* Opens a read transaction on `main`: BEGIN, then a read of the schema table,
 * which is what takes the read lock (BEGIN alone defers it). The transaction
 * is the snapshot every cursor of the connection reads until
 * `nishsqlite_end_read`. A transaction already open is SQLITE_MISUSE. */
int32_t nishsqlite_begin_read(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL || !sqlite3_get_autocommit(c->db)) return SQLITE_MISUSE;
  cursors_invalidate(c);
  int rc = internal_run(c, &c->begin_st, "BEGIN");
  if (rc != SQLITE_OK) return rc;
  rc = internal_run(c, &c->schema_st, "SELECT 1 FROM main.sqlite_schema LIMIT 1");
  if (rc == SQLITE_OK && !main_in_read(c->db)) rc = SQLITE_ERROR;
  if (rc != SQLITE_OK && !sqlite3_get_autocommit(c->db)) internal_exec(c, "ROLLBACK");
  return rc;
}

/* Closes the connection's cursors and commits the transaction. Outside one it
 * is SQLITE_MISUSE. */
int32_t nishsqlite_end_read(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL || sqlite3_get_autocommit(c->db)) return SQLITE_MISUSE;
  cursors_invalidate(c);
  return internal_run(c, &c->commit_st, "COMMIT");
}

/* Appends `name` to the expected column list, after a comma unless first.
 * The list joins names unescaped, so a name it could not spell apart is
 * SQLITE_SCHEMA: one holding a comma, or ending in " DESC" (which reads as a
 * descending key column). */
static int columns_add(sqlite3_str *want, const char *name, int first) {
  if (name == NULL) return SQLITE_SCHEMA;
  size_t len = 0;
  for (; name[len] != 0; len++)
    if (name[len] == ',') return SQLITE_SCHEMA;
  if (len >= 5 && strcmp(name + len - 5, " DESC") == 0) return SQLITE_SCHEMA;
  if (!first) sqlite3_str_appendchar(want, 1, ',');
  sqlite3_str_appendall(want, name);
  return SQLITE_OK;
}

/* Reads what `cursor_open` checks of a table: its columns as the list the
 * program must name, the INTEGER PRIMARY KEY column, and the column count.
 * SQLITE_SCHEMA for a table this adapter cannot read: a hidden or generated
 * column, or a column name the list cannot spell (`columns_add`). */
static int table_shape(nishsqlite_conn *c, const char *table, sqlite3_str *want, int32_t *ncol,
                       int32_t *alias) {
  sqlite3_stmt *st = NULL;
  int rc = internal_prepare(c, "SELECT name, hidden, pk FROM pragma_table_xinfo(?1, 'main')", table, &st);
  int32_t n = 0, npk = 0, pk = -1;
  while (rc == SQLITE_OK && (rc = internal_step(c, st)) == SQLITE_ROW) {
    if (sqlite3_column_int(st, 1) != 0) rc = SQLITE_SCHEMA;
    else {
      if (sqlite3_column_int(st, 2) != 0) npk++, pk = n;
      rc = columns_add(want, (const char *)sqlite3_column_text(st, 0), n == 0);
      n++;
    }
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_DONE) return rc == SQLITE_OK ? SQLITE_SCHEMA : rc;
  if (n == 0) return SQLITE_SCHEMA;
  /* One primary-key column is a rowid alias unless the table made an index
   * for it, which only a primary key that is not INTEGER PRIMARY KEY does. */
  int32_t has_pk_index = 0;
  rc = internal_prepare(c, "SELECT 1 FROM pragma_index_list(?1, 'main') WHERE origin = 'pk'", table, &st);
  if (rc == SQLITE_OK) {
    rc = internal_step(c, st);
    has_pk_index = rc == SQLITE_ROW;
    rc = rc == SQLITE_ROW || rc == SQLITE_DONE ? SQLITE_OK : rc;
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_OK) return rc;
  *ncol = n;
  *alias = npk == 1 && !has_pk_index ? pk : -1;
  return SQLITE_OK;
}

/* Reads what `cursor_open` checks of an index: its key columns, each with
 * " DESC" when descending, then "rowid", and the key's width. SQLITE_SCHEMA
 * for an index this adapter cannot read: one on an expression, with a
 * collation that is not BINARY, on a column name the list cannot spell, or
 * whose record is not the key and a rowid. */
static int index_shape(nishsqlite_conn *c, const char *index, sqlite3_str *want, int32_t *nkey,
                       KeyInfo *ki) {
  sqlite3_stmt *st = NULL;
  int rc = internal_prepare(c, "SELECT cid, name, desc, coll, key FROM pragma_index_xinfo(?1, 'main')",
                            index, &st);
  int32_t n = 0, naux = 0;
  while (rc == SQLITE_OK && (rc = internal_step(c, st)) == SQLITE_ROW) {
    rc = SQLITE_OK;
    int cid = sqlite3_column_int(st, 0);
    const char *name = (const char *)sqlite3_column_text(st, 1);
    if (sqlite3_column_int(st, 4) != 0) {
      const char *coll = (const char *)sqlite3_column_text(st, 3);
      if (naux != 0 || cid < 0 || name == NULL || coll == NULL || strcmp(coll, "BINARY") != 0) {
        rc = SQLITE_SCHEMA;
        break;
      }
      if (ki) {
        if (n >= ki->nKeyField) {
          rc = SQLITE_SCHEMA;
          break;
        }
        if (sqlite3_column_int(st, 2) != 0) ki->aSortFlags[n] = KEYINFO_ORDER_DESC;
      }
      if ((rc = columns_add(want, name, n == 0)) != SQLITE_OK) break;
      if (sqlite3_column_int(st, 2) != 0) sqlite3_str_appendall(want, " DESC");
      n++;
    } else if (cid != -1 || naux++ != 0) {
      rc = SQLITE_SCHEMA;
      break;
    }
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_DONE) return rc == SQLITE_OK || rc == SQLITE_ROW ? SQLITE_SCHEMA : rc;
  if (n == 0 || naux != 1) return SQLITE_SCHEMA;
  (void)columns_add(want, "rowid", 0);
  *nkey = n;
  return SQLITE_OK;
}

/* Looks `name` up in main's schema: whether it is a table or an index, its
 * root page, and the table it belongs to (written to `table`, which the
 * caller frees with sqlite3_free). Anything but an ordinary table of rowids
 * or an index of one is SQLITE_SCHEMA. */
static int object_of(nishsqlite_conn *c, const char *name, int32_t *is_index, Pgno *root, char **table) {
  sqlite3_stmt *st = NULL;
  int rc = internal_prepare(c, "SELECT type, rootpage, tbl_name FROM main.sqlite_schema WHERE name = ?1",
                            name, &st);
  if (rc == SQLITE_OK) {
    rc = internal_step(c, st);
    if (rc == SQLITE_ROW) {
      const char *type = (const char *)sqlite3_column_text(st, 0);
      sqlite3_int64 page = sqlite3_column_int64(st, 1);
      const char *tbl = (const char *)sqlite3_column_text(st, 2);
      int idx = type && strcmp(type, "index") == 0;
      if ((idx || (type && strcmp(type, "table") == 0)) && page > 0 && page <= 0xffffffffLL && tbl) {
        *is_index = idx;
        *root = (Pgno)page;
        *table = sqlite3_mprintf("%s", tbl);
        rc = *table ? SQLITE_OK : SQLITE_NOMEM;
      } else {
        rc = SQLITE_SCHEMA;
      }
    } else if (rc == SQLITE_DONE) {
      rc = SQLITE_SCHEMA;
    }
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_OK) return rc;
  /* A WITHOUT ROWID table, a virtual table or a view is not a table of rowids;
   * `wr` is 1 for WITHOUT ROWID. */
  rc = internal_prepare(c, "SELECT type, wr FROM pragma_table_list WHERE schema = 'main' AND name = ?1", *table, &st);
  if (rc == SQLITE_OK) {
    rc = internal_step(c, st);
    if (rc == SQLITE_ROW) {
      const char *type = (const char *)sqlite3_column_text(st, 0);
      rc = type && strcmp(type, "table") == 0 && sqlite3_column_int(st, 1) == 0 ? SQLITE_OK : SQLITE_SCHEMA;
    } else if (rc == SQLITE_DONE) {
      rc = SQLITE_SCHEMA;
    }
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_OK) {
    sqlite3_free(*table);
    *table = NULL;
  }
  return rc;
}

/* The encoding of `main` is UTF-8: the cursor's reads answer the stored bytes
 * as they are, so text in any other encoding is refused at open. */
static int main_is_utf8(nishsqlite_conn *c) {
  sqlite3_stmt *st = NULL;
  int rc = internal_prepare(c, "PRAGMA main.encoding", NULL, &st);
  if (rc == SQLITE_OK) {
    rc = internal_step(c, st);
    const char *enc = rc == SQLITE_ROW ? (const char *)sqlite3_column_text(st, 0) : NULL;
    rc = rc == SQLITE_ROW ? (enc && strcmp(enc, "UTF-8") == 0 ? SQLITE_OK : SQLITE_SCHEMA) : rc;
  }
  sqlite3_finalize(st);
  return rc;
}

/* Builds a cursor on `name`, a table or index of `main`, once its columns are
 * the ones `columns` names, in order, joined by ",": a table's columns, or an
 * index's key columns (each followed by " DESC" when descending) and then
 * "rowid". Answers its handle, or SQLITE_MISUSE outside a read transaction,
 * SQLITE_SCHEMA when the object is not there, is not one a cursor reads, or
 * has other columns, and SQLITE_NOMEM, all negated. */
static int32_t cursor_build(nishsqlite_conn *c, const char *name, const char *columns) {
  sqlite3 *db = c->db;
  int32_t is_index = 0, ncol = 0, alias = -1, nkey = 0;
  Pgno root = 0;
  char *table = NULL;
  KeyInfo *ki = NULL;
  /* A read transaction's cookie, and a shape checked under it. */
  u32 cookie = 0;
  int cacheable = sqlite3_txn_state(db, "main") == SQLITE_TXN_READ;
  if (cacheable) sqlite3BtreeGetMeta(sqlite3DbNameToBtree(db, "main"), BTREE_SCHEMA_VERSION, &cookie);
  for (int32_t i = 0; cacheable && i < NISH_SQLITE_SHAPES; i++) {
    nishsqlite_shape *s = &c->shapes[i];
    if (s->name && s->cookie == cookie && strcmp(s->name, name) == 0 && strcmp(s->columns, columns) == 0) {
      is_index = s->is_index;
      ncol = s->ncol;
      nkey = s->nkey;
      alias = s->alias;
      root = s->root;
      ki = sqlite3KeyInfoRef(s->ki);
      goto build;
    }
  }
  int rc = main_is_utf8(c);
  if (rc == SQLITE_OK) rc = object_of(c, name, &is_index, &root, &table);
  sqlite3_str *want = sqlite3_str_new(db);
  if (rc == SQLITE_OK && !is_index) {
    rc = table_shape(c, table, want, &ncol, &alias);
    if (rc == SQLITE_OK && (ki = sqlite3KeyInfoAlloc(db, ncol, 0)) == NULL) rc = SQLITE_NOMEM;
  } else if (rc == SQLITE_OK) {
    /* The width first, so the KeyInfo can be made to it; then again into it. */
    rc = index_shape(c, name, want, &nkey, NULL);
    if (rc == SQLITE_OK) {
      sqlite3_str_reset(want);
      ki = sqlite3KeyInfoAlloc(db, nkey, 1);
      rc = ki ? index_shape(c, name, want, &nkey, ki) : SQLITE_NOMEM;
      ncol = nkey + 1;
    }
  }
  sqlite3_free(table);
  if (rc == SQLITE_OK && sqlite3_str_errcode(want) != SQLITE_OK) rc = SQLITE_NOMEM;
  if (rc == SQLITE_OK && strcmp(sqlite3_str_value(want) ? sqlite3_str_value(want) : "", columns) != 0)
    rc = SQLITE_SCHEMA;
  sqlite3_free(sqlite3_str_finish(want));
  if (rc == SQLITE_OK && !main_in_read(db)) rc = SQLITE_MISUSE;
  if (rc != SQLITE_OK) {
    sqlite3KeyInfoUnref(ki);
    return -rc;
  }
  if (cacheable) {
    nishsqlite_shape *s = &c->shapes[c->shape_next];
    char *n = sqlite3_mprintf("%s", name), *cols = sqlite3_mprintf("%s", columns);
    if (n && cols) {
      sqlite3_free(s->name);
      sqlite3_free(s->columns);
      sqlite3KeyInfoUnref(s->ki);
      *s = (nishsqlite_shape){n, cols, cookie, is_index, ncol, nkey, alias, root, sqlite3KeyInfoRef(ki)};
      c->shape_next = (c->shape_next + 1) % NISH_SQLITE_SHAPES;
    } else {
      sqlite3_free(n);
      sqlite3_free(cols);
    }
  }

build:;
  int32_t nkeyfields = is_index ? nkey : ncol;
  size_t head = ROUND8(sizeof(nishsqlite_cursor));
  size_t btsz = ROUND8((size_t)sqlite3BtreeCursorSize());
  nishsqlite_cursor *cur = sqlite3_malloc64(head + btsz + (size_t)nkeyfields * sizeof(Mem));
  if (cur == NULL) {
    sqlite3KeyInfoUnref(ki);
    return -SQLITE_NOMEM;
  }
  memset(cur, 0, head);
  cur->conn = c;
  cur->btree = sqlite3DbNameToBtree(db, "main");
  cur->bt = (BtCursor *)((u8 *)cur + head);
  sqlite3BtreeCursorZero(cur->bt);
  cur->ki = ki;
  cur->key = (Mem *)((u8 *)cur + head + btsz);
  cur->nkeyfields = nkeyfields;
  for (int32_t i = 0; i < nkeyfields; i++) sqlite3VdbeMemInit(&cur->key[i], db, MEM_Null);
  cur->ncol = ncol;
  cur->alias = alias;
  cur->is_index = is_index;
  cur->row = sqlite3VdbeAllocUnpackedRecord(ki);
  rc = cur->row ? SQLITE_OK : SQLITE_NOMEM;
  if (rc == SQLITE_OK) rc = sqlite3BtreeCursor(cur->btree, root, 0, is_index ? ki : NULL, cur->bt);
  int32_t hc = rc == SQLITE_OK ? slot_take(&nishsqlite_cursors, cur, c->self) : 0;
  if (hc == 0) {
    cursor_free(cur);
    return -(rc == SQLITE_OK ? SQLITE_NOMEM : rc);
  }
  c->ncursors++;
  return hc;
}

static int32_t unlocked_cursor_open(int32_t h, const char *name, const char *columns) {
  nishsqlite_conn *c = conn_of(h);
  if (c == NULL || !main_in_read(c->db)) return -SQLITE_MISUSE;
  return cursor_build(c, name, columns);
}

static int32_t unlocked_cursor_close(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL) return SQLITE_MISUSE;
  cur->conn->ncursors--;
  cursor_free(cur);
  slot_give(&nishsqlite_cursors, h);
  return SQLITE_OK;
}

/* ---- Moves -------------------------------------------------------------- */

/* A move answers 1 when the cursor is on a row, 0 when there is none, and the
 * negated code when SQLite fails (a corrupt page, an I/O error). */
static int32_t moved(nishsqlite_cursor *cur, int rc, int row) {
  cur->unpacked = 0;
  cur->has_row = rc == SQLITE_OK && row;
  return rc == SQLITE_OK ? cur->has_row : -rc;
}

static int32_t unlocked_cursor_first(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL) return -SQLITE_MISUSE;
  int empty = 1;
  int rc = sqlite3BtreeFirst(cur->bt, &empty);
  return moved(cur, rc, !empty);
}

static int32_t unlocked_cursor_last(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL) return -SQLITE_MISUSE;
  int empty = 1;
  int rc = sqlite3BtreeLast(cur->bt, &empty);
  return moved(cur, rc, !empty);
}

/* SQLITE_DONE from a step is the end of the table, not a failure. */
static int32_t stepped(nishsqlite_cursor *cur, int rc) {
  return rc == SQLITE_DONE ? moved(cur, SQLITE_OK, 0) : moved(cur, rc, 1);
}

/* Next and previous need a row to move from: with none they are
 * SQLITE_MISUSE, so a loop cannot run past its end and restart. */
static int32_t unlocked_cursor_next(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  return stepped(cur, sqlite3BtreeNext(cur->bt, 0));
}

static int32_t unlocked_cursor_previous(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  return stepped(cur, sqlite3BtreePrevious(cur->bt, 0));
}

/* Moves a table cursor to the row `rowid`: 1 when it is there, 0 when not.
 * An index cursor is SQLITE_MISUSE. */
static int32_t unlocked_cursor_seek_rowid(int32_t h, int64_t rowid) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || cur->is_index) return -SQLITE_MISUSE;
  int res = -1;
  int rc = sqlite3BtreeTableMoveto(cur->bt, rowid, 0, &res);
  return moved(cur, rc, res == 0);
}

/* ---- Seek keys ---------------------------------------------------------- */

/* The index cursor `h` with room for one more key part, or NULL with `*rc`
 * saying why. The caller sets `cur->key[cur->nkeyparts]` and counts it only
 * when the set succeeds, so a failed part leaves the key as it was. */
static nishsqlite_cursor *key_next(int32_t h, int32_t *rc) {
  nishsqlite_cursor *cur = cursor_of(h);
  *rc = cur == NULL || !cur->is_index ? SQLITE_MISUSE : SQLITE_RANGE;
  if (cur == NULL || !cur->is_index || cur->nkeyparts >= cur->nkeyfields) return NULL;
  *rc = SQLITE_OK;
  return cur;
}

static int32_t unlocked_key_reset(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || !cur->is_index) return SQLITE_MISUSE;
  for (int32_t i = 0; i < cur->nkeyparts; i++) sqlite3VdbeMemSetNull(&cur->key[i]);
  cur->nkeyparts = 0;
  return SQLITE_OK;
}

static int32_t unlocked_key_i64(int32_t h, int64_t v) {
  int32_t rc;
  nishsqlite_cursor *cur = key_next(h, &rc);
  if (cur) sqlite3VdbeMemSetInt64(&cur->key[cur->nkeyparts++], v);
  return rc;
}

/* Text values are copied into the key (SQLITE_TRANSIENT), as a bind is. */
static int32_t unlocked_key_text(int32_t h, const char *text) {
  int32_t rc;
  nishsqlite_cursor *cur = key_next(h, &rc);
  if (cur) rc = sqlite3VdbeMemSetStr(&cur->key[cur->nkeyparts], text, -1, SQLITE_UTF8, SQLITE_TRANSIENT);
  if (cur && rc == SQLITE_OK) cur->nkeyparts++;
  return rc;
}

/* `buf[off, off + len)` as text, `n` the buffer's length; a window outside
 * the buffer is SQLITE_MISUSE, as `nishsqlite_bind_bytes` answers. */
static int32_t unlocked_key_bytes(int32_t h, const uint8_t *buf, uint64_t n, int32_t off, int32_t len) {
  if (off < 0 || len < 0 || (uint64_t)off + (uint64_t)len > n) return SQLITE_MISUSE;
  int32_t rc;
  nishsqlite_cursor *cur = key_next(h, &rc);
  const char *p = len == 0 ? "" : (const char *)(buf + off);
  if (cur) rc = sqlite3VdbeMemSetStr(&cur->key[cur->nkeyparts], p, len, SQLITE_UTF8, SQLITE_TRANSIENT);
  if (cur && rc == SQLITE_OK) cur->nkeyparts++;
  return rc;
}

/* Moves an index cursor to the first entry at or past the key (`op` GE or
 * GT), or the last at or before it (LE or LT), comparing only the key's
 * values, so a key shorter than the index is a prefix. This is the VDBE's
 * OP_SeekGE/GT/LE/LT: the record's default answer for an equal prefix decides
 * which side of the equal run the B-tree lands on, and one step corrects it. */
static int32_t unlocked_cursor_seek(int32_t h, int32_t op) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || !cur->is_index || cur->nkeyparts < 1 || op < NISH_SQLITE_SEEK_GE ||
      op > NISH_SQLITE_SEEK_LT)
    return -SQLITE_MISUSE;
  UnpackedRecord key;
  memset(&key, 0, sizeof key);
  key.pKeyInfo = cur->ki;
  key.aMem = cur->key;
  key.nField = (u16)cur->nkeyparts;
  key.default_rc = op == NISH_SQLITE_SEEK_GT || op == NISH_SQLITE_SEEK_LE ? -1 : 1;
  int res = 0;
  int rc = sqlite3BtreeIndexMoveto(cur->bt, &key, &res);
  if (rc != SQLITE_OK) return moved(cur, rc, 0);
  if (op == NISH_SQLITE_SEEK_GE || op == NISH_SQLITE_SEEK_GT) {
    if (res < 0 || (res == 0 && op == NISH_SQLITE_SEEK_GT)) return stepped(cur, sqlite3BtreeNext(cur->bt, 0));
    return moved(cur, SQLITE_OK, 1);
  }
  if (res > 0 || (res == 0 && op == NISH_SQLITE_SEEK_LT)) return stepped(cur, sqlite3BtreePrevious(cur->bt, 0));
  return moved(cur, SQLITE_OK, !sqlite3BtreeEof(cur->bt));
}

/* ---- Cursor columns ----------------------------------------------------- */

/* The current row's record decoded into `row`, once per row. A record that
 * is all on its page is decoded where it lies; one that spills onto overflow
 * pages is copied whole into the cursor's buffer first, with zeroed slack
 * past it. SQLITE_MISUSE with no row, SQLITE_CORRUPT for a record longer than
 * SQLite allows. */
static int row_of(nishsqlite_cursor *cur) {
  if (!cur->has_row) return SQLITE_MISUSE;
  if (cur->unpacked) return SQLITE_OK;
  if (sqlite3BtreeCursorHasMoved(cur->bt)) return SQLITE_ABORT;
  u32 sz = sqlite3BtreePayloadSize(cur->bt);
  if (sz > SQLITE_MAX_LENGTH) return SQLITE_CORRUPT;
  cur->nfields = 0;
  if (sz > 0) {
    u32 amt = 0;
    const void *p = sqlite3BtreePayloadFetch(cur->bt, &amt);
    if (amt < sz) {
      if (cur->cap < sz + NISH_SQLITE_SLACK) {
        u64 cap = (u64)cur->cap * 2;
        if (cap < (u64)sz + NISH_SQLITE_SLACK) cap = (u64)sz + NISH_SQLITE_SLACK;
        u8 *buf = sqlite3_realloc64(cur->buf, cap);
        if (buf == NULL) return SQLITE_NOMEM;
        cur->buf = buf;
        cur->cap = (u32)cap;
      }
      int rc = sqlite3BtreePayload(cur->bt, 0, sz, cur->buf);
      if (rc != SQLITE_OK) return rc;
      memset(cur->buf + sz, 0, NISH_SQLITE_SLACK);
      p = cur->buf;
    }
    cur->row->nField = (u16)(cur->nkeyfields + 1);
    sqlite3VdbeRecordUnpack((int)sz, p, cur->row);
    cur->nfields = cur->row->nField;
  }
  cur->unpacked = 1;
  return SQLITE_OK;
}

/* Column `n` of the current row: NULL with `*rc` set when it cannot be read.
 * The INTEGER PRIMARY KEY column is the row's key, not a field of its record,
 * so it answers NULL with `*alias` set. A row whose record holds fewer fields
 * than `n` (one written before ALTER TABLE added the column) is SQLITE_SCHEMA. */
static Mem *column_mem(int32_t h, int32_t n, nishsqlite_cursor **out, int *alias, int *rc) {
  nishsqlite_cursor *cur = cursor_of(h);
  *out = cur;
  *alias = 0;
  if (cur == NULL || !cur->has_row) {
    *rc = SQLITE_MISUSE;
    return NULL;
  }
  if (n < 0 || n >= cur->ncol) {
    *rc = SQLITE_RANGE;
    return NULL;
  }
  if (n == cur->alias) {
    *alias = 1;
    *rc = SQLITE_OK;
    return NULL;
  }
  *rc = row_of(cur);
  if (*rc != SQLITE_OK) return NULL;
  if (n >= cur->nfields) {
    *rc = SQLITE_SCHEMA;
    return NULL;
  }
  return &cur->row->aMem[n];
}

/* The column's type, SQLITE_INTEGER to SQLITE_NULL, or the negated code. The
 * type is the stored value's: a REAL column holding a whole number stores it
 * as an integer, and answers SQLITE_INTEGER, where a query would convert it. */
static int32_t unlocked_cursor_column_type(int32_t h, int32_t n) {
  nishsqlite_cursor *cur;
  int alias, rc;
  Mem *m = column_mem(h, n, &cur, &alias, &rc);
  if (alias) return sqlite3BtreeCursorHasMoved(cur->bt) ? -SQLITE_ABORT : SQLITE_INTEGER;
  return m ? sqlite3_value_type((sqlite3_value *)m) : -rc;
}

/* The column as an integer, converted as `sqlite3_column_int64` converts; 0
 * when it cannot be read. */
static int64_t unlocked_cursor_column_i64(int32_t h, int32_t n) {
  nishsqlite_cursor *cur;
  int alias, rc;
  Mem *m = column_mem(h, n, &cur, &alias, &rc);
  if (alias) return sqlite3BtreeCursorHasMoved(cur->bt) ? 0 : sqlite3BtreeIntegerKey(cur->bt);
  return m ? sqlite3_value_int64((sqlite3_value *)m) : 0;
}

/* Copies a TEXT or BLOB column's bytes into `buf` at `at`, `n` the buffer's
 * length, and answers their length; as `nishsqlite_column_into`, it copies
 * only when all of them fit. NULL answers 0. An INTEGER or FLOAT column,
 * the INTEGER PRIMARY KEY column among them, is SQLITE_MISMATCH: the cursor
 * answers stored bytes and converts no number to text. Codes are negated. */
static int32_t unlocked_cursor_column_into(int32_t h, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  if (at < 0 || (uint64_t)at > n) return -SQLITE_MISUSE;
  nishsqlite_cursor *cur;
  int alias, rc;
  Mem *m = column_mem(h, c, &cur, &alias, &rc);
  if (alias) return -SQLITE_MISMATCH;
  if (m == NULL) return -rc;
  int type = sqlite3_value_type((sqlite3_value *)m);
  if (type == SQLITE_NULL) return 0;
  if (type != SQLITE_TEXT && type != SQLITE_BLOB) return -SQLITE_MISMATCH;
  const void *p = sqlite3_value_blob((sqlite3_value *)m);
  int32_t len = sqlite3_value_bytes((sqlite3_value *)m);
  if (p != NULL && (uint64_t)len <= n - (uint64_t)at) memcpy(buf + at, p, (size_t)len);
  return len;
}

/* The current row's rowid: a table row's key, or an index entry's last
 * field. 0 when there is no row or it cannot be read. */
static int64_t unlocked_cursor_rowid(int32_t h) {
  nishsqlite_cursor *cur = cursor_of(h);
  if (cur == NULL || !cur->has_row) return 0;
  if (!cur->is_index) return sqlite3BtreeCursorHasMoved(cur->bt) ? 0 : sqlite3BtreeIntegerKey(cur->bt);
  if (row_of(cur) != SQLITE_OK || cur->nfields < cur->ncol) return 0;
  return sqlite3_value_int64((sqlite3_value *)&cur->row->aMem[cur->ncol - 1]);
}

/* ---- Locking ------------------------------------------------------------ */

/* Every cursor entry point holds its connection's `db->mutex` around the
 * work, as SQLite's own API functions do: the internal functions the cursors
 * call (the allocator, the decoder, the B-tree) expect it held. The mutex is
 * recursive, and NULL (a no-op) when the build or the open asks for none. */
static sqlite3_mutex *conn_mutex(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  return c ? sqlite3_db_mutex(c->db) : NULL;
}

static sqlite3_mutex *cur_mutex(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_cursors, h);
  return s ? sqlite3_db_mutex(((nishsqlite_cursor *)s->p)->conn->db) : NULL;
}

#define NISH_SQLITE_LOCKED(type, mutex, call) \
  sqlite3_mutex *mx_ = (mutex);               \
  sqlite3_mutex_enter(mx_);                   \
  type r_ = (call);                           \
  sqlite3_mutex_leave(mx_);                   \
  return r_

int32_t nishsqlite_cursor_open(int32_t h, const char *name, const char *columns) {
  NISH_SQLITE_LOCKED(int32_t, conn_mutex(h), unlocked_cursor_open(h, name, columns));
}

int32_t nishsqlite_cursor_close(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_close(h));
}

int32_t nishsqlite_cursor_first(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_first(h));
}

int32_t nishsqlite_cursor_last(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_last(h));
}

int32_t nishsqlite_cursor_next(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_next(h));
}

int32_t nishsqlite_cursor_previous(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_previous(h));
}

int32_t nishsqlite_cursor_seek_rowid(int32_t h, int64_t rowid) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_seek_rowid(h, rowid));
}

int32_t nishsqlite_key_reset(int32_t h) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_key_reset(h));
}

int32_t nishsqlite_key_i64(int32_t h, int64_t v) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_key_i64(h, v));
}

int32_t nishsqlite_key_text(int32_t h, const char *text) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_key_text(h, text));
}

int32_t nishsqlite_key_bytes(int32_t h, const uint8_t *buf, uint64_t n, int32_t off, int32_t len) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_key_bytes(h, buf, n, off, len));
}

int32_t nishsqlite_cursor_seek(int32_t h, int32_t op) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_seek(h, op));
}

int32_t nishsqlite_cursor_column_type(int32_t h, int32_t n) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_column_type(h, n));
}

int64_t nishsqlite_cursor_column_i64(int32_t h, int32_t n) {
  NISH_SQLITE_LOCKED(int64_t, cur_mutex(h), unlocked_cursor_column_i64(h, n));
}

int32_t nishsqlite_cursor_column_into(int32_t h, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  NISH_SQLITE_LOCKED(int32_t, cur_mutex(h), unlocked_cursor_column_into(h, c, buf, n, at));
}

int64_t nishsqlite_cursor_rowid(int32_t h) {
  NISH_SQLITE_LOCKED(int64_t, cur_mutex(h), unlocked_cursor_rowid(h));
}
