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

/* SQLite's page cache, pcache1, with its largest key kept honest.
 *
 * pcache1 keeps `iMaxKey`, the largest page number it has held since the
 * last truncate, so that a truncate after a commit scans only the hash
 * slots from the database's end to `iMaxKey`; when that span is as wide as
 * the hash table, it scans the whole table. When a B-tree split hands its
 * new pages page numbers out of order, `balance_nonroot` swaps two of them
 * through a free key, the lock-byte page's (262,145 at 4 KiB pages), and
 * the rekey into it raises `iMaxKey` there for good. Every commit after
 * such a split then scans every slot of the hash table, which grows with
 * the cache: an index written at random keys splits often enough that, with
 * a 64 MiB cache, that scan measured 1.5% of a write-heavy server's CPU.
 *
 * sqlite3.c is never edited (README.md), so the fix is here: the same
 * pcache1, installed through SQLITE_CONFIG_PCACHE2 before SQLite starts,
 * with three of its methods wrapped. A rekey that raises the largest key
 * parks a page above every other; until the page leaves that key, every
 * fetch and rekey of the cache records the largest key it brings in. When
 * the parked page moves down again and still holds the largest key, the
 * largest key goes back to the larger of what was recorded and the page's
 * new number. Anything else - a fetch above the parked key, a truncate, the
 * cache destroyed, a second cache parking meanwhile - leaves pcache1's own
 * value standing, which is too large at worst, and too large costs only the
 * scan. One record serves a thread: a split's three rekeys run back to back
 * on one connection. */
typedef struct nishsqlite_park {
  PCache1 *cache;   /* the cache with a parked page, NULL when none */
  unsigned int key; /* the parked page's key */
  unsigned int max; /* the cache's largest key apart from the parked page */
} nishsqlite_park;

static NISH_TLS nishsqlite_park nishsqlite_parked;

static sqlite3_pcache_page *nishsqlite_pcache_fetch(sqlite3_pcache *p, unsigned int key, int create) {
  sqlite3_pcache_page *page = pcache1Fetch(p, key, create);
  if (nishsqlite_parked.cache == (PCache1 *)p && page != NULL && key > nishsqlite_parked.max) {
    nishsqlite_parked.max = key;
  }
  return page;
}

static void nishsqlite_pcache_rekey(sqlite3_pcache *p, sqlite3_pcache_page *page, unsigned int from,
                                    unsigned int to) {
  PCache1 *cache = (PCache1 *)p;
  unsigned int before = cache->iMaxKey;
  pcache1Rekey(p, page, from, to);
  if (to > before) {
    nishsqlite_parked.cache = cache;
    nishsqlite_parked.key = to;
    nishsqlite_parked.max = before;
  } else if (nishsqlite_parked.cache == cache) {
    if (from == nishsqlite_parked.key) {
      if (cache->iMaxKey == from) {
        cache->iMaxKey = nishsqlite_parked.max > to ? nishsqlite_parked.max : to;
      }
      nishsqlite_parked.cache = NULL;
    } else if (to > nishsqlite_parked.max) {
      nishsqlite_parked.max = to;
    }
  }
}

static void nishsqlite_pcache_truncate(sqlite3_pcache *p, unsigned int limit) {
  if (nishsqlite_parked.cache == (PCache1 *)p) {
    nishsqlite_parked.cache = NULL;
  }
  pcache1Truncate(p, limit);
}

static void nishsqlite_pcache_destroy(sqlite3_pcache *p) {
  if (nishsqlite_parked.cache == (PCache1 *)p) {
    nishsqlite_parked.cache = NULL;
  }
  pcache1Destroy(p);
}

/* Before main, so before any thread can start SQLite: sqlite3_config is
 * refused once SQLite is initialised and is not itself thread-safe. */
__attribute__((constructor)) static void nishsqlite_pcache_install(void) {
  static const sqlite3_pcache_methods2 methods = {
      1,
      0,
      pcache1Init,
      pcache1Shutdown,
      pcache1Create,
      pcache1Cachesize,
      pcache1Pagecount,
      nishsqlite_pcache_fetch,
      pcache1Unpin,
      nishsqlite_pcache_rekey,
      nishsqlite_pcache_truncate,
      nishsqlite_pcache_destroy,
      pcache1Shrink,
  };
  sqlite3_config(SQLITE_CONFIG_PCACHE2, &methods);
}

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
  int32_t int_first; /* an index whose first key column has INTEGER or NUMERIC affinity */
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

/* The connection's rollback hook. SQLite calls it at the end of every
 * rollback of the connection's transaction, the ones it makes on its own
 * among them: a statement that fails with SQLITE_NOMEM, SQLITE_IOERR or
 * SQLITE_FULL rolls the whole transaction back, a plain SELECT included. Every
 * other way a read can end (`nishsqlite_exec`, a statement that is not plain
 * stepping, `nishsqlite_end_read`, `nishsqlite_close`) invalidates the cursors
 * before it runs, so a cursor call checks nothing but its handle. */
static void nishsqlite_rolled_back(void *user) { cursors_invalidate(user); }

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
      sqlite3_rollback_hook(db, nishsqlite_rolled_back, c);
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
 * authorizer seeing an action off its allowlist, or SQLite rolling the
 * transaction back on its own (`nishsqlite_rolled_back`). Invalidating frees
 * the cursor and its slot, so its handle answers SQLITE_MISUSE from then on.
 * The moves and reads allocate nothing once the first row has been read: the
 * decoded row and the copy buffer are the cursor's and are reused. */

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
  sqlite3_mutex *mutex; /* the connection's `db->mutex`, held around every call */
  Btree *btree;        /* `main`, from sqlite3DbNameToBtree */
  BtCursor *bt;        /* in the same block, after this struct */
  KeyInfo *ki;         /* the record's fields, for the decoder and a seek */
  const u8 *rec;       /* the current row's record, on its page or in `buf` */
  u32 *ftype;          /* its fields' serial types, read from its header on the first read */
  u32 *foff;           /* and where each field's bytes start in `rec` */
  Mem *key;            /* the seek key's `nkeyfields` values, in the block */
  UnpackedRecord seek; /* the key a seek or count hands SQLite: `key`, under `ki` */
  int32_t nkeyparts;   /* how many of them are set */
  int32_t nkeyfields;  /* an index's key columns; a table's columns */
  u8 *buf;             /* a record that is not all on its page, copied */
  u32 cap;
  int64_t *counts;     /* the last `count_range`'s answer, per key */
  uint64_t ncounts;    /* how many of them it answered */
  uint64_t counts_cap;
  int32_t ncol;      /* columns the program reads: a table's, or an index's key and rowid */
  int32_t alias;     /* a table's INTEGER PRIMARY KEY column, -1 when none */
  int32_t is_index;
  int32_t int_first; /* an index whose first key column stores integers as integers */
  int32_t has_row;   /* the last move answered a row */
  int32_t unpacked;  /* `row` holds the current row */
  int32_t nfields;   /* the fields the current row's record holds */
} nishsqlite_cursor;

static void cursor_free(nishsqlite_cursor *cur) {
  sqlite3 *db = cur->conn->db;
  sqlite3BtreeCloseCursor(cur->bt);
  for (int32_t i = 0; i < cur->nkeyfields; i++) sqlite3VdbeMemRelease(&cur->key[i]);
  sqlite3KeyInfoUnref(cur->ki);
  sqlite3_free(cur->buf);
  sqlite3_free(cur->counts);
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

/* The cursor `h` names, or NULL: the one check a cursor call makes. A cursor
 * whose read has ended, by whatever route, is already gone from its slot,
 * because every route invalidates the connection's cursors as it ends the read
 * (`nishsqlite_rolled_back`), so a live slot is a cursor inside its read. */
static inline nishsqlite_cursor *cursor_of(int32_t h) {
  nishsqlite_slot *s = slot_of(&nishsqlite_cursors, h);
  return s ? s->p : NULL;
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
  int32_t is_index = 0, ncol = 0, alias = -1, nkey = 0, int_first = 0;
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
      int_first = s->int_first;
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
    /* A first key column with INTEGER or NUMERIC affinity holds an integer
     * value as an integer, so `count_range`'s integer compare agrees with SQL's
     * `col = k`; TEXT affinity would compare k as text. */
    Index *ix = rc == SQLITE_OK ? sqlite3FindIndex(db, name, "main") : NULL;
    if (ix) {
      char aff = sqlite3TableColumnAffinity(ix->pTable, ix->aiColumn[0]);
      int_first = aff == SQLITE_AFF_INTEGER || aff == SQLITE_AFF_NUMERIC;
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
      *s = (nishsqlite_shape){n, cols, cookie, is_index, ncol, nkey, alias, int_first, root, sqlite3KeyInfoRef(ki)};
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
  size_t keysz = ROUND8((size_t)nkeyfields * sizeof(Mem));
  /* Room for a record's fields: the key's, and an index entry's rowid after them. */
  size_t fieldsz = (size_t)(nkeyfields + 1) * sizeof(u32);
  nishsqlite_cursor *cur = sqlite3_malloc64(head + btsz + keysz + 2 * fieldsz);
  if (cur == NULL) {
    sqlite3KeyInfoUnref(ki);
    return -SQLITE_NOMEM;
  }
  memset(cur, 0, head);
  cur->conn = c;
  cur->mutex = sqlite3_db_mutex(db);
  cur->btree = sqlite3DbNameToBtree(db, "main");
  cur->bt = (BtCursor *)((u8 *)cur + head);
  sqlite3BtreeCursorZero(cur->bt);
  cur->ki = ki;
  cur->key = (Mem *)((u8 *)cur + head + btsz);
  cur->ftype = (u32 *)((u8 *)cur + head + btsz + keysz);
  cur->foff = cur->ftype + nkeyfields + 1;
  cur->nkeyfields = nkeyfields;
  for (int32_t i = 0; i < nkeyfields; i++) sqlite3VdbeMemInit(&cur->key[i], db, MEM_Null);
  cur->ncol = ncol;
  cur->alias = alias;
  cur->is_index = is_index;
  cur->int_first = int_first;
  cur->seek.pKeyInfo = ki;
  cur->seek.aMem = cur->key;
  rc = sqlite3BtreeCursor(cur->btree, root, 0, is_index ? ki : NULL, cur->bt);
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

static int32_t unlocked_cursor_close(nishsqlite_cursor *cur, int32_t h) {
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

static int32_t unlocked_cursor_first(nishsqlite_cursor *cur) {
  if (cur == NULL) return -SQLITE_MISUSE;
  int empty = 1;
  int rc = sqlite3BtreeFirst(cur->bt, &empty);
  return moved(cur, rc, !empty);
}

static int32_t unlocked_cursor_last(nishsqlite_cursor *cur) {
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
static int32_t unlocked_cursor_next(nishsqlite_cursor *cur) {
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  return stepped(cur, sqlite3BtreeNext(cur->bt, 0));
}

static int32_t unlocked_cursor_previous(nishsqlite_cursor *cur) {
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  return stepped(cur, sqlite3BtreePrevious(cur->bt, 0));
}

/* Moves a table cursor to the row `rowid`: 1 when it is there, 0 when not.
 * An index cursor is SQLITE_MISUSE. */
static int32_t unlocked_cursor_seek_rowid(nishsqlite_cursor *cur, int64_t rowid) {
  if (cur == NULL || cur->is_index) return -SQLITE_MISUSE;
  int res = -1;
  int rc = sqlite3BtreeTableMoveto(cur->bt, rowid, 0, &res);
  return moved(cur, rc, res == 0);
}

/* ---- Seek keys ---------------------------------------------------------- */

/* `cur` when it is an index cursor with room for one more key part, or NULL
 * with `*rc` saying why. The caller sets `cur->key[cur->nkeyparts]` and counts
 * it only when the set succeeds, so a failed part leaves the key as it was. */
static nishsqlite_cursor *key_next(nishsqlite_cursor *cur, int32_t *rc) {
  *rc = cur == NULL || !cur->is_index ? SQLITE_MISUSE : SQLITE_RANGE;
  if (cur == NULL || !cur->is_index || cur->nkeyparts >= cur->nkeyfields) return NULL;
  *rc = SQLITE_OK;
  return cur;
}

static int32_t unlocked_key_reset(nishsqlite_cursor *cur) {
  if (cur == NULL || !cur->is_index) return SQLITE_MISUSE;
  for (int32_t i = 0; i < cur->nkeyparts; i++) sqlite3VdbeMemSetNull(&cur->key[i]);
  cur->nkeyparts = 0;
  return SQLITE_OK;
}

static int32_t unlocked_key_i64(nishsqlite_cursor *cur, int64_t v) {
  int32_t rc;
  cur = key_next(cur, &rc);
  if (cur) sqlite3VdbeMemSetInt64(&cur->key[cur->nkeyparts++], v);
  return rc;
}

/* Text values are copied into the key (SQLITE_TRANSIENT), as a bind is. */
static int32_t unlocked_key_text(nishsqlite_cursor *cur, const char *text) {
  int32_t rc;
  cur = key_next(cur, &rc);
  if (cur) rc = sqlite3VdbeMemSetStr(&cur->key[cur->nkeyparts], text, -1, SQLITE_UTF8, SQLITE_TRANSIENT);
  if (cur && rc == SQLITE_OK) cur->nkeyparts++;
  return rc;
}

/* `buf[off, off + len)` as text, `n` the buffer's length; a window outside
 * the buffer is SQLITE_MISUSE, as `nishsqlite_bind_bytes` answers. */
static int32_t unlocked_key_bytes(nishsqlite_cursor *cur, const uint8_t *buf, uint64_t n, int32_t off, int32_t len) {
  if (off < 0 || len < 0 || (uint64_t)off + (uint64_t)len > n) return SQLITE_MISUSE;
  int32_t rc;
  cur = key_next(cur, &rc);
  const char *p = len == 0 ? "" : (const char *)(buf + off);
  if (cur) rc = sqlite3VdbeMemSetStr(&cur->key[cur->nkeyparts], p, len, SQLITE_UTF8, SQLITE_TRANSIENT);
  if (cur && rc == SQLITE_OK) cur->nkeyparts++;
  return rc;
}

/* The kept key, made at open, readied for a compare of its first `nfield`
 * values: an integer seek sets its Mems in place and builds no record. */
static UnpackedRecord *seek_key(nishsqlite_cursor *cur, int32_t nfield, int default_rc) {
  UnpackedRecord *k = &cur->seek;
  k->nField = (u16)nfield;
  k->default_rc = (i8)default_rc;
  k->errCode = 0;
  k->eqSeen = 0;
  return k;
}

/* Moves an index cursor to the first entry at or past the key (`op` GE or
 * GT), or the last at or before it (LE or LT), comparing only the key's
 * values, so a key shorter than the index is a prefix. This is the VDBE's
 * OP_SeekGE/GT/LE/LT: the record's default answer for an equal prefix decides
 * which side of the equal run the B-tree lands on, and one step corrects it. */
static int32_t unlocked_cursor_seek(nishsqlite_cursor *cur, int32_t op) {
  if (cur == NULL || !cur->is_index || cur->nkeyparts < 1 || op < NISH_SQLITE_SEEK_GE ||
      op > NISH_SQLITE_SEEK_LT)
    return -SQLITE_MISUSE;
  int res = 0;
  int rc = sqlite3BtreeIndexMoveto(cur->bt, seek_key(cur, cur->nkeyparts, op == NISH_SQLITE_SEEK_GT || op == NISH_SQLITE_SEEK_LE ? -1 : 1), &res);
  if (rc != SQLITE_OK) return moved(cur, rc, 0);
  if (op == NISH_SQLITE_SEEK_GE || op == NISH_SQLITE_SEEK_GT) {
    if (res < 0 || (res == 0 && op == NISH_SQLITE_SEEK_GT)) return stepped(cur, sqlite3BtreeNext(cur->bt, 0));
    return moved(cur, SQLITE_OK, 1);
  }
  if (res > 0 || (res == 0 && op == NISH_SQLITE_SEEK_LT)) return stepped(cur, sqlite3BtreePrevious(cur->bt, 0));
  return moved(cur, SQLITE_OK, !sqlite3BtreeEof(cur->bt));
}

/* ---- Cursor columns ----------------------------------------------------- */

/* The current entry's record: where it lies when it is all on its page,
 * else copied whole into the cursor's buffer with zeroed slack past it.
 * SQLITE_CORRUPT for a record longer than SQLite allows. */
static int record_of(nishsqlite_cursor *cur, u32 *sz, const void **p) {
  *sz = sqlite3BtreePayloadSize(cur->bt);
  if (*sz > SQLITE_MAX_LENGTH) return SQLITE_CORRUPT;
  u32 amt = 0;
  *p = sqlite3BtreePayloadFetch(cur->bt, &amt);
  if (amt >= *sz) return SQLITE_OK;
  if (cur->cap < *sz + NISH_SQLITE_SLACK) {
    u64 cap = (u64)cur->cap * 2;
    if (cap < (u64)*sz + NISH_SQLITE_SLACK) cap = (u64)*sz + NISH_SQLITE_SLACK;
    u8 *buf = sqlite3_realloc64(cur->buf, cap);
    if (buf == NULL) return SQLITE_NOMEM;
    cur->buf = buf;
    cur->cap = (u32)cap;
  }
  int rc = sqlite3BtreePayload(cur->bt, 0, *sz, cur->buf);
  if (rc != SQLITE_OK) return rc;
  memset(cur->buf + *sz, 0, NISH_SQLITE_SLACK);
  *p = cur->buf;
  return SQLITE_OK;
}

/* The current row's record header read into `ftype` and `foff`, once per
 * row: each field's serial type and where its bytes start. The walk is
 * `sqlite3VdbeRecordUnpack`'s, bound for bound, so it finds the fields that
 * function would and no others, and like it a record whose last field runs
 * past its end reads that field as NULL. What it skips is building a Mem
 * per field: a column is decoded from its serial type when it is read
 * (`field_value`). SQLITE_MISUSE with no row, SQLITE_CORRUPT for a record
 * longer than SQLite allows. */
static int row_of(nishsqlite_cursor *cur) {
  if (!cur->has_row) return SQLITE_MISUSE;
  if (cur->unpacked) return SQLITE_OK;
  if (sqlite3BtreeCursorHasMoved(cur->bt)) return SQLITE_ABORT;
  u32 sz = 0;
  const void *p = NULL;
  int rc = record_of(cur, &sz, &p);
  if (rc != SQLITE_OK) return rc;
  cur->nfields = 0;
  cur->rec = p;
  if (sz > 0) {
    const u8 *a = p;
    u32 hdr, idx, d, u = 0, nfield = (u32)cur->nkeyfields + 1;
    idx = getVarint32(a, hdr);
    d = hdr;
    while (idx < hdr && d <= sz) {
      u32 t;
      idx += getVarint32(&a[idx], t);
      cur->ftype[u] = t;
      cur->foff[u] = d;
      d += sqlite3VdbeSerialTypeLen(t);
      if (++u >= nfield) break;
    }
    if (d > sz && u) cur->ftype[u - 1] = 0;
    cur->nfields = (int32_t)u;
  }
  cur->unpacked = 1;
  return SQLITE_OK;
}

/* Field `n` of the current row's record, which `row_of` has read: its type
 * as `sqlite3_value_type` answers it, with `*v` as `column_value` describes.
 * Integers, NULL and text or blob bytes are read in place, as
 * `sqlite3VdbeSerialGet` reads them; anything else (a REAL, or a text or
 * blob read as an integer) goes through `sqlite3VdbeSerialGet` and SQLite's
 * own conversion, so every answer is the one a Mem would give. */
/* The integer of serial type `t` at `b`: 1 to 6 big-endian and signed, 8
 * and 9 the constants 0 and 1, as `sqlite3VdbeSerialGet` reads them. Any
 * other type is 0; the callers check the type first. */
static int64_t serial_int(u32 t, const u8 *b) {
  switch (t) {
    case 1: return ONE_BYTE_INT(b);
    case 2: return TWO_BYTE_INT(b);
    case 3: return THREE_BYTE_INT(b);
    case 4: return FOUR_BYTE_INT(b);
    case 5: return SIX_BYTE_INT(b);
    case 6: return (int64_t)sqlite3Get8byte(b);
    case 9: return 1;
    default: return 0;
  }
}

static inline int32_t field_value(nishsqlite_cursor *cur, int32_t n, uint64_t *v, int bytes, uint8_t *buf, uint64_t room) {
  u32 t = cur->ftype[n];
  const u8 *b = cur->rec + cur->foff[n];
  if (t >= 12 && bytes) {
    *v = (t - 12) / 2;
    if (*v > 0 && *v <= room) memcpy(buf, b, (size_t)*v);
    return (t & 1) ? SQLITE_TEXT : SQLITE_BLOB;
  }
  if (t == 0 || t == 10 || t == 11) {
    *v = 0;
    return SQLITE_NULL;
  }
  if (t <= 9 && t != 7) {
    *v = (uint64_t)serial_int(t, b);
    return SQLITE_INTEGER;
  }
  Mem m;
  memset(&m, 0, sizeof m);
  m.enc = cur->ki->enc;
  m.db = cur->ki->db;
  sqlite3VdbeSerialGet(b, t, &m);
  *v = (uint64_t)sqlite3_value_int64((sqlite3_value *)&m);
  return sqlite3_value_type((sqlite3_value *)&m);
}

/* Whether column `n` of the current row can be read from its record: 0
 * with `*rc` set when it cannot. The INTEGER PRIMARY KEY column is the row's
 * key, not a field of its record, so it answers 0 with `*alias` set. A row
 * whose record holds fewer fields than `n` (one written before ALTER TABLE
 * added the column) is SQLITE_SCHEMA. */
static int column_field(nishsqlite_cursor *cur, int32_t n, int *alias, int *rc) {
  *alias = 0;
  if (cur == NULL || !cur->has_row) {
    *rc = SQLITE_MISUSE;
    return 0;
  }
  if (n < 0 || n >= cur->ncol) {
    *rc = SQLITE_RANGE;
    return 0;
  }
  if (n == cur->alias) {
    *alias = 1;
    *rc = SQLITE_OK;
    return 0;
  }
  *rc = row_of(cur);
  if (*rc != SQLITE_OK) return 0;
  if (n >= cur->nfields) {
    *rc = SQLITE_SCHEMA;
    return 0;
  }
  return 1;
}

/* Column `n`'s type, SQLITE_INTEGER to SQLITE_NULL, or the negated code, with
 * `*v` its 8 bytes: with `bytes` set, a TEXT or BLOB column's length, else
 * the integer `sqlite3_column_int64` would convert the column to, the
 * INTEGER PRIMARY KEY column's being the row's key. With `bytes` set, a TEXT
 * or BLOB column's bytes are copied to `buf` when all of them fit in its
 * `room`. The type is the stored value's: a REAL column holding a whole
 * number stores it as an integer, and answers SQLITE_INTEGER, where a query
 * would convert it. */
static int32_t column_value(nishsqlite_cursor *cur, int32_t n, uint64_t *v, int bytes, uint8_t *buf, uint64_t room) {
  int alias, rc;
  int ok = column_field(cur, n, &alias, &rc);
  if (alias) {
    if (sqlite3BtreeCursorHasMoved(cur->bt)) return -SQLITE_ABORT;
    *v = (uint64_t)sqlite3BtreeIntegerKey(cur->bt);
    return SQLITE_INTEGER;
  }
  if (!ok) return -rc;
  return field_value(cur, n, v, bytes, buf, room);
}

static int32_t unlocked_cursor_column_type(nishsqlite_cursor *cur, int32_t n) {
  uint64_t v;
  return column_value(cur, n, &v, 1, NULL, 0);
}

/* The column as an integer, converted as `sqlite3_column_int64` converts; 0
 * when it cannot be read. */
static int64_t unlocked_cursor_column_i64(nishsqlite_cursor *cur, int32_t n) {
  uint64_t v;
  return column_value(cur, n, &v, 0, NULL, 0) < 0 ? 0 : (int64_t)v;
}

/* Copies a TEXT or BLOB column's bytes into `buf` at `at`, `n` the buffer's
 * length, and answers their length; as `nishsqlite_column_into`, it copies
 * only when all of them fit. NULL answers 0. An INTEGER or FLOAT column is
 * SQLITE_MISMATCH, the INTEGER PRIMARY KEY column among them unless the row
 * has moved, which is SQLITE_ABORT as columnType answers: the cursor answers
 * stored bytes and converts no number to text. Codes are negated. */
static int32_t unlocked_cursor_column_into(nishsqlite_cursor *cur, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  if (at < 0 || (uint64_t)at > n) return -SQLITE_MISUSE;
  uint64_t len;
  int32_t type = column_value(cur, c, &len, 1, buf + at, n - (uint64_t)at);
  if (type < 0) return type;
  if (type == SQLITE_NULL) return 0;
  if (type != SQLITE_TEXT && type != SQLITE_BLOB) return -SQLITE_MISMATCH;
  return (int32_t)len;
}

/* The current row's rowid: a table row's key, or an index entry's last
 * field. 0 when there is no row or it cannot be read. */
static int64_t unlocked_cursor_rowid(nishsqlite_cursor *cur) {
  if (cur == NULL || !cur->has_row) return 0;
  if (!cur->is_index) return sqlite3BtreeCursorHasMoved(cur->bt) ? 0 : sqlite3BtreeIntegerKey(cur->bt);
  /* An index entry's rowid is its record's last field, so it is read off
   * the record's end, as `sqlite3VdbeIdxRowid` reads it, without walking
   * the header: the header's last byte is the rowid's serial type, an
   * integer's being one byte. Any other record takes the walk below. */
  if (!cur->unpacked) {
    if (sqlite3BtreeCursorHasMoved(cur->bt)) return 0;
    u32 sz = 0;
    const void *p = NULL;
    if (record_of(cur, &sz, &p) != SQLITE_OK) return 0;
    const u8 *a = p;
    u32 hdr = 0;
    if (sz >= 3) getVarint32NR(a, hdr);
    if (hdr >= 3 && hdr <= sz) {
      u32 t = a[hdr - 1];
      if (t >= 1 && t <= 9 && t != 7 && sz >= hdr + sqlite3SmallTypeSizes[t])
        return serial_int(t, a + sz - sqlite3SmallTypeSizes[t]);
    }
  }
  if (row_of(cur) != SQLITE_OK || cur->nfields < cur->ncol) return 0;
  uint64_t v;
  return field_value(cur, cur->ncol - 1, &v, 0, NULL, 0) < 0 ? 0 : (int64_t)v;
}

/* ---- Range counts ------------------------------------------------------- */

/* Counts an index's entries whose first key column is k, for each k in
 * [lo, hi], into the cursor's `counts[k - lo]` (read back with
 * `count_at`), in one seek and one forward walk: each entry's record is
 * compared with k by SQLite's record compare, never unpacked. It uses the
 * kept key's first value, so it leaves no seek key set, and leaves the cursor
 * on no row. `n` is the caller's room, which bounds the buffer: it grows to
 * the largest span asked and is kept. It answers the entries counted, or
 * negated: SQLITE_MISUSE for a table cursor, SQLITE_MISMATCH for an index
 * whose first key column does not store integers as integers, SQLITE_RANGE
 * for lo > hi or a span longer than `n`, SQLITE_NOMEM, SQLITE_TOOBIG past
 * INT32_MAX entries, and SQLite's code when a page cannot be read. */
static int32_t unlocked_cursor_count_range(nishsqlite_cursor *cur, int64_t lo, int64_t hi, uint64_t n) {
  if (cur == NULL || !cur->is_index) return -SQLITE_MISUSE;
  if (!cur->int_first) return -SQLITE_MISMATCH;
  if (lo > hi || (uint64_t)hi - (uint64_t)lo >= n) return -SQLITE_RANGE;
  uint64_t span = (uint64_t)hi - (uint64_t)lo + 1;
  cur->ncounts = 0;
  if (span > cur->counts_cap) {
    int64_t *counts = sqlite3_realloc64(cur->counts, span * sizeof *counts);
    if (counts == NULL) return -SQLITE_NOMEM;
    cur->counts = counts;
    cur->counts_cap = span;
  }
  int64_t *out = cur->counts;
  memset(out, 0, (size_t)span * sizeof *out);
  (void)unlocked_key_reset(cur);
  /* In index order: lo up to hi, or hi down to lo under DESC. */
  int desc = (cur->ki->aSortFlags[0] & KEYINFO_ORDER_DESC) != 0;
  uint64_t at = desc ? span - 1 : 0; /* k - lo for the k the walk is on */
  Mem *k = &cur->key[0];
  sqlite3VdbeMemSetInt64(k, desc ? hi : lo);
  UnpackedRecord *key = seek_key(cur, 1, 1);
  int res = 0;
  int rc = sqlite3BtreeIndexMoveto(cur->bt, key, &res);
  if (rc == SQLITE_OK && res < 0) rc = sqlite3BtreeNext(cur->bt, 0);
  key->default_rc = 0;
  int32_t total = 0;
  while (rc == SQLITE_OK) {
    u32 sz = 0;
    const void *p = NULL;
    if ((rc = record_of(cur, &sz, &p)) != SQLITE_OK) break;
    /* row_of reads an empty record as zero fields, but a compare reads the
     * record's header size from its first byte, which an empty one does not
     * have; and an index entry always holds at least its rowid. */
    if (sz == 0) {
      rc = SQLITE_CORRUPT;
      break;
    }
    int c = sqlite3VdbeRecordCompare((int)sz, p, key);
    if (key->errCode) {
      rc = key->errCode;
      break;
    }
    /* The entry sorts after k: move k on in index order until it does not. */
    while (c > 0) {
      if (desc ? at == 0 : at == span - 1) goto done;
      at = desc ? at - 1 : at + 1;
      sqlite3VdbeMemSetInt64(k, (int64_t)((uint64_t)lo + at));
      c = sqlite3VdbeRecordCompare((int)sz, p, key);
    }
    if (c == 0) {
      if (total == INT32_MAX) {
        rc = SQLITE_TOOBIG;
        break;
      }
      out[at]++;
      total++;
    }
    rc = sqlite3BtreeNext(cur->bt, 0);
  }
done:
  sqlite3VdbeMemSetNull(k);
  moved(cur, SQLITE_OK, 0);
  if (rc != SQLITE_OK && rc != SQLITE_DONE) return -rc;
  cur->ncounts = span;
  return total;
}

/* The last successful count's entry `i`: -1 past its span, and for every
 * `i` after a count that failed past its refusals. */
static int64_t unlocked_cursor_count_at(nishsqlite_cursor *cur, uint64_t i) {
  return cur != NULL && i < cur->ncounts ? cur->counts[i] : -1;
}

/* ---- Locking ------------------------------------------------------------ */

/* Every cursor entry point holds its connection's `db->mutex` around the
 * work, as SQLite's own API functions do: the internal functions the cursors
 * call (the allocator, the decoder, the B-tree) expect it held. The mutex is
 * recursive, and NULL (a no-op) when the build or the open asks for none. A
 * cursor entry point looks its handle up once (`cursor_of`), outside the
 * mutex: the tables are the thread's own, and the lookup reads nothing of
 * SQLite's. The work then gets the cursor, NULL for a handle that names none,
 * which every one of them answers as SQLITE_MISUSE. */
static sqlite3_mutex *conn_mutex(int32_t h) {
  nishsqlite_conn *c = conn_of(h);
  return c ? sqlite3_db_mutex(c->db) : NULL;
}

#define NISH_SQLITE_LOCKED(type, mutex, call) \
  sqlite3_mutex *mx_ = (mutex);               \
  sqlite3_mutex_enter(mx_);                   \
  type r_ = (call);                           \
  sqlite3_mutex_leave(mx_);                   \
  return r_

#define NISH_SQLITE_CURSOR(type, call)        \
  nishsqlite_cursor *cur = cursor_of(h);      \
  NISH_SQLITE_LOCKED(type, cur ? cur->mutex : NULL, call)

int32_t nishsqlite_cursor_open(int32_t h, const char *name, const char *columns) {
  NISH_SQLITE_LOCKED(int32_t, conn_mutex(h), unlocked_cursor_open(h, name, columns));
}

int32_t nishsqlite_cursor_close(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_close(cur, h));
}

int32_t nishsqlite_cursor_first(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_first(cur));
}

int32_t nishsqlite_cursor_last(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_last(cur));
}

int32_t nishsqlite_cursor_next(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_next(cur));
}

int32_t nishsqlite_cursor_previous(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_previous(cur));
}

int32_t nishsqlite_cursor_seek_rowid(int32_t h, int64_t rowid) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_seek_rowid(cur, rowid));
}

int32_t nishsqlite_key_reset(int32_t h) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_key_reset(cur));
}

int32_t nishsqlite_key_i64(int32_t h, int64_t v) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_key_i64(cur, v));
}

int32_t nishsqlite_key_text(int32_t h, const char *text) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_key_text(cur, text));
}

int32_t nishsqlite_key_bytes(int32_t h, const uint8_t *buf, uint64_t n, int32_t off, int32_t len) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_key_bytes(cur, buf, n, off, len));
}

int32_t nishsqlite_cursor_count_range(int32_t h, int64_t lo, int64_t hi, uint64_t n) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_count_range(cur, lo, hi, n));
}
int64_t nishsqlite_cursor_count_at(int32_t h, uint64_t i) {
  NISH_SQLITE_CURSOR(int64_t, unlocked_cursor_count_at(cur, i));
}
int32_t nishsqlite_cursor_seek(int32_t h, int32_t op) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_seek(cur, op));
}

int32_t nishsqlite_cursor_column_type(int32_t h, int32_t n) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_column_type(cur, n));
}

int64_t nishsqlite_cursor_column_i64(int32_t h, int32_t n) {
  NISH_SQLITE_CURSOR(int64_t, unlocked_cursor_column_i64(cur, n));
}

int32_t nishsqlite_cursor_column_into(int32_t h, int32_t c, uint8_t *buf, uint64_t n, int32_t at) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_column_into(cur, c, buf, n, at));
}

int64_t nishsqlite_cursor_rowid(int32_t h) {
  NISH_SQLITE_CURSOR(int64_t, unlocked_cursor_rowid(cur));
}

/* readRow: reads a list of columns of the current row in one call. `io` holds
 * `n / 11` columns: first their indices, a little-endian u16 each, which it
 * leaves as they are, then a slot of 9 bytes per column, in order: the type
 * unlocked_cursor_column_type answers, then 8 bytes, a TEXT or BLOB
 * column's length, or the value unlocked_cursor_column_i64 answers for the
 * rest. No TEXT or BLOB is converted to a number. Each column's Mem is
 * found once, under the one lock the caller holds. The bytes of TEXT and
 * BLOB columns go to `text` in column order while they fit. Answers the
 * length they need, SQLITE_TOOBIG past INT32_MAX, or the code column_type
 * refuses the first bad column with, MISUSE with no row even for an empty
 * list; after a refusal, or a length over `ntext`, the caller reads nothing
 * from `io` or `text`. The slots are stored in the machine's order, which
 * is little-endian on every target the runtime builds for. Codes are
 * negated. */
#if defined(__BYTE_ORDER__) && __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error "readRow's slots are little-endian"
#endif
/* `column_value` for each listed column, with the checks it repeats per
 * column made once a row: the cursor's row, and its record's header, which
 * is read only when a listed column is a field of the record. Each column
 * answers what `column_value` would, in the same order, so the first refusal
 * is the one a column-by-column read would meet. */
static int32_t unlocked_cursor_read_row(nishsqlite_cursor *cur, uint8_t *io, uint64_t n, uint8_t *text, uint64_t ntext) {
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  uint64_t ncols = n / 11, need = 0;
  uint8_t *out = io + 2 * ncols;
  int read = 0;
  for (uint64_t k = 0; k < ncols; k++, out += 9) {
    int32_t c = io[2 * k] | (io[2 * k + 1] << 8);
    uint64_t v;
    int32_t type;
    if (c >= cur->ncol) return -SQLITE_RANGE;
    if (c == cur->alias) {
      if (sqlite3BtreeCursorHasMoved(cur->bt)) return -SQLITE_ABORT;
      v = (uint64_t)sqlite3BtreeIntegerKey(cur->bt);
      type = SQLITE_INTEGER;
    } else {
      if (!read) {
        int rc = row_of(cur);
        if (rc != SQLITE_OK) return -rc;
        read = 1;
      }
      if (c >= cur->nfields) return -SQLITE_SCHEMA;
      type = field_value(cur, c, &v, 1, text + need, need <= ntext ? ntext - need : 0);
      if (type == SQLITE_TEXT || type == SQLITE_BLOB) need += v;
    }
    out[0] = (uint8_t)type;
    memcpy(out + 1, &v, 8);
  }
  return need > INT32_MAX ? -SQLITE_TOOBIG : (int32_t)need;
}

int32_t nishsqlite_cursor_read_row(int32_t h, uint8_t *io, uint64_t n, uint8_t *text, uint64_t ntext) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_read_row(cur, io, n, text, ntext));
}

/* Copies the current row's record, SQLite's record format whole (its header
 * of varints, then its fields' bytes), into `buf`, `n` its length, and
 * answers the record's length. A record longer than `n` copies nothing and
 * answers its length all the same, so the caller grows `buf` and asks again.
 * An index entry's record ends with its rowid; a table row's holds no
 * INTEGER PRIMARY KEY, which is the row's key (`rowid`). SQLITE_MISUSE with
 * no row, SQLITE_ABORT when the row has moved, SQLITE_CORRUPT for a record
 * longer than SQLite allows, negated. */
static int32_t unlocked_cursor_record(nishsqlite_cursor *cur, uint8_t *buf, uint64_t n) {
  if (cur == NULL || !cur->has_row) return -SQLITE_MISUSE;
  if (sqlite3BtreeCursorHasMoved(cur->bt)) return -SQLITE_ABORT;
  u32 sz = sqlite3BtreePayloadSize(cur->bt);
  if (sz > SQLITE_MAX_LENGTH) return -SQLITE_CORRUPT;
  if (sz > n) return (int32_t)sz;
  u32 amt = 0;
  const void *p = sqlite3BtreePayloadFetch(cur->bt, &amt);
  if (amt >= sz) {
    if (sz > 0) memcpy(buf, p, sz);
    return (int32_t)sz;
  }
  int rc = sqlite3BtreePayload(cur->bt, 0, sz, buf);
  return rc == SQLITE_OK ? (int32_t)sz : -rc;
}

int32_t nishsqlite_cursor_record(int32_t h, uint8_t *buf, uint64_t n) {
  NISH_SQLITE_CURSOR(int32_t, unlocked_cursor_record(cur, buf, n));
}
