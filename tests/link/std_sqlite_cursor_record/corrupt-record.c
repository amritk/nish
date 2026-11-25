/* The record decoders against corrupt records: tests/run.js (sqlite-link)
   builds this with nish-sqlite.c under AddressSanitizer and runs it. It
   writes a database of small rows, read on their page, and long ones, which
   the adapter copies off their overflow pages into the cursor's buffer, then
   sets each of the 16 bytes before every row's text (the record's header,
   its first field, and the cell's size and rowid) to each of 14 values that
   are serial types, varint prefixes or neither, and walks the table and its
   index with every read a cursor offers. Nothing is checked but that each
   call returns: a read past a record lands outside the buffer, which the
   sanitizer reports. Breaking row_of's `d <= sz` bound makes it report. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int32_t nishsqlite_open(const char *, int32_t);
int32_t nishsqlite_exec(int32_t, const char *);
int32_t nishsqlite_close(int32_t);
int32_t nishsqlite_begin_read(int32_t);
int32_t nishsqlite_end_read(int32_t);
int32_t nishsqlite_cursor_open(int32_t, const char *, const char *);
int32_t nishsqlite_cursor_first(int32_t);
int32_t nishsqlite_cursor_next(int32_t);
int32_t nishsqlite_cursor_close(int32_t);
int64_t nishsqlite_cursor_column_i64(int32_t, int32_t);
int32_t nishsqlite_cursor_column_type(int32_t, int32_t);
int32_t nishsqlite_cursor_column_into(int32_t, int32_t, uint8_t *, uint64_t, int32_t);
int32_t nishsqlite_cursor_read_row(int32_t, uint8_t *, uint64_t, uint8_t *, uint64_t);
int32_t nishsqlite_cursor_record(int32_t, uint8_t *, uint64_t);
int64_t nishsqlite_cursor_rowid(int32_t);
static uint8_t text[1 << 16];
/* Every read a cursor offers, on every row it reaches; nothing is checked
   but that each call returns. */
static void walk(int32_t db, const char *name, const char *cols, int32_t ncol) {
  int32_t c = nishsqlite_cursor_open(db, name, cols);
  if (c <= 0) return;
  uint8_t io[11 * 8];
  for (int32_t k = 0; k < ncol; k++) io[2 * k] = (uint8_t)k, io[2 * k + 1] = 0;
  int steps = 0;
  for (int32_t r = nishsqlite_cursor_first(c); r == 1 && steps < 100; r = nishsqlite_cursor_next(c), steps++) {
    (void)nishsqlite_cursor_rowid(c);
    (void)nishsqlite_cursor_record(c, text, sizeof text);
    (void)nishsqlite_cursor_record(c, text, 3);
    (void)nishsqlite_cursor_read_row(c, io, (uint64_t)ncol * 11, text, sizeof text);
    for (int32_t k = 0; k < ncol; k++) {
      (void)nishsqlite_cursor_column_type(c, k);
      (void)nishsqlite_cursor_column_i64(c, k);
      (void)nishsqlite_cursor_column_into(c, k, text, sizeof text, 0);
    }
  }
  nishsqlite_cursor_close(c);
}
int main(int argc, char **argv) {
  if (argc < 2) return 2;
  const char *path = argv[1];
  remove(path);
  int32_t db = nishsqlite_open(path, 6);
  /* Small rows read on their page, and long ones copied off their overflow
     pages into the cursor's buffer, which is where a read past the record
     would land outside any allocation. */
  if (db <= 0 || nishsqlite_exec(db, "PRAGMA page_size = 1024; CREATE TABLE t (a INTEGER, b TEXT, c BLOB, d REAL);"
      " CREATE INDEX tb ON t (b);"
      " INSERT INTO t VALUES (7, 'MARKERsmall', x'0102', 1.5);"
      " INSERT INTO t VALUES (-300000, 'MARKERlong' || printf('%.*c', 3000, 'y'), zeroblob(40), 2.5);"
      " INSERT INTO t VALUES (1, 'other', NULL, NULL);") != 0 || nishsqlite_close(db) != 0) return 3;
  FILE *f = fopen(path, "rb");
  if (!f) return 4;
  static uint8_t orig[1 << 16], img[1 << 16];
  size_t n = fread(orig, 1, sizeof orig, f);
  fclose(f);
  static const uint8_t values[] = {0x00, 0x01, 0x06, 0x07, 0x08, 0x0a, 0x0c, 0x0d, 0x0e, 0x7f, 0x80, 0x81, 0xc0, 0xff};
  long runs = 0;
  for (size_t p = 0; p + 6 <= n; p++) {
    if (memcmp(orig + p, "MARKER", 6) != 0) continue;
    /* The record's header and first field, and the cell's size and rowid, lie
       in the bytes before its text. */
    for (size_t back = 1; back <= 16 && back <= p; back++) {
      for (size_t v = 0; v < sizeof values; v++) {
        memcpy(img, orig, n);
        img[p - back] = values[v];
        f = fopen(path, "wb");
        if (!f || fwrite(img, 1, n, f) != n) return 5;
        fclose(f);
        db = nishsqlite_open(path, 2);
        if (db <= 0) continue;
        if (nishsqlite_begin_read(db) == 0) {
          walk(db, "t", "a,b,c,d", 4);
          walk(db, "tb", "b,rowid", 2);
          nishsqlite_end_read(db);
        }
        nishsqlite_close(db);
        runs++;
      }
    }
  }
  remove(path);
  printf("%ld", runs);
  return runs > 0 ? 0 : 6;
}
