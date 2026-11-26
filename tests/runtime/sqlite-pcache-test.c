/* The page cache nish-sqlite.c installs keeps its largest key at the
 * database's end across B-tree splits (runtime/sqlite/nish-sqlite.c, "SQLite's
 * page cache, pcache1, with its largest key kept honest").
 *
 * One unit with the adapter, as the adapter is one unit with the amalgamation,
 * so the test reads pcache1's own `iMaxKey`. It writes keys in random order to
 * an index, so splits hand out page numbers out of order and swap them through
 * the lock-byte page's key, and after every commit checks that no key above
 * the database's last page is left: one would make the next commit's truncate
 * scan the whole hash table. Exit 0 when every commit holds, with the number
 * of commits whose split parked a page (above zero, or the test proved
 * nothing) on stdout; any other exit names the step that failed. */

#include "nish-sqlite.c"

#include <stdio.h>

/* The adapter's methods, wrapped once more to count the rekeys that park a
 * page above every other key: proof that the test made splits swap. */
static sqlite3_pcache_methods2 adapter;
static int parked;

static void counting_rekey(sqlite3_pcache *p, sqlite3_pcache_page *page, unsigned int from, unsigned int to) {
  if (to > ((PCache1 *)p)->iMaxKey) parked++;
  adapter.xRekey(p, page, from, to);
}

static unsigned int max_key(sqlite3 *db) {
  Pager *pager = sqlite3BtreePager(db->aDb[0].pBt);
  return ((PCache1 *)pager->pPCache->pCache)->iMaxKey;
}

static unsigned int page_count(sqlite3 *db) {
  sqlite3_stmt *st = NULL;
  unsigned int n = 0;
  if (sqlite3_prepare_v2(db, "PRAGMA page_count", -1, &st, NULL) == SQLITE_OK && sqlite3_step(st) == SQLITE_ROW) {
    n = (unsigned int)sqlite3_column_int64(st, 0);
  }
  sqlite3_finalize(st);
  return n;
}

int main(int argc, char **argv) {
  if (argc != 2) return 2;
  /* Before SQLite starts, as the adapter's own install is. */
  static sqlite3_pcache_methods2 counting;
  if (sqlite3_config(SQLITE_CONFIG_GETPCACHE2, &adapter) != SQLITE_OK || adapter.xRekey != nishsqlite_pcache_rekey) return 13;
  counting = adapter;
  counting.xRekey = counting_rekey;
  if (sqlite3_config(SQLITE_CONFIG_PCACHE2, &counting) != SQLITE_OK) return 14;
  sqlite3 *db = NULL;
  if (sqlite3_open(argv[1], &db) != SQLITE_OK) return 3;
  if (sqlite3_exec(db,
                   "PRAGMA journal_mode=WAL; PRAGMA cache_size=-65536;"
                   "CREATE TABLE t(k BLOB); CREATE INDEX t_k ON t(k);",
                   NULL, NULL, NULL) != SQLITE_OK) {
    return 4;
  }
  sqlite3_stmt *ins = NULL;
  if (sqlite3_prepare_v2(db, "INSERT INTO t(k) VALUES (randomblob(48))", -1, &ins, NULL) != SQLITE_OK) return 5;
  for (int commit = 0; commit < 400; commit++) {
    if (sqlite3_exec(db, "BEGIN", NULL, NULL, NULL) != SQLITE_OK) return 6;
    for (int row = 0; row < 50; row++) {
      if (sqlite3_step(ins) != SQLITE_DONE || sqlite3_reset(ins) != SQLITE_OK) return 7;
    }
    /* Inside the transaction a split may have parked a page and moved it
     * back: the parked key never outlives the split. */
    if (max_key(db) > page_count(db)) return 8;
    if (sqlite3_exec(db, "COMMIT", NULL, NULL, NULL) != SQLITE_OK) return 9;
    if (max_key(db) > page_count(db)) {
      fprintf(stderr, "commit %d: largest key %u past the last page %u\n", commit, max_key(db), page_count(db));
      return 10;
    }
  }
  sqlite3_finalize(ins);
  if (sqlite3_close(db) != SQLITE_OK) return 11;
  printf("%d\n", parked);
  return parked > 0 ? 0 : 12;
}
