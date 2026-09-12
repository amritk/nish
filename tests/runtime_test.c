/* Unit test for runtime/runtime.c: arena semantics, string handling, number
 * formatting (checked against what Node prints for `String(x)`), the random
 * generator, and file I/O. */
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

/* WP20 T0: the arena's storage class is part of the ABI, so this file spells it
 * the way runtime.c, nish.h and runtime_wasm.c do. Without the macro a
 * -DNISH_THREADS build would not link at all -- a non-TLS reference to a TLS
 * definition is an error, which is the property the threads section below is
 * really resting on. */
#ifdef NISH_THREADS
#define NISH_TLS _Thread_local
#else
#define NISH_TLS
#endif

typedef struct { uint64_t len; char data[]; } nish_str;
extern NISH_TLS struct nish_arena { char *buf; size_t off; size_t cap; void *chunks; } nish_arena;
void *nish_alloc_struct(size_t);
void nish_reset_arena(void);
void nish_free_arena(void);
uint64_t nish_arena_mark(void);
void nish_arena_release(uint64_t);
uint64_t nish_arena_used(void);
void *nish_arena_keep(uint64_t, void *);
nish_str *nish_str_new(const char *, uint64_t);
nish_str *nish_str_concat(const nish_str *, const nish_str *);
_Bool nish_str_eq(const nish_str *, const nish_str *);
uint64_t nish_str_len(const nish_str *);
nish_str *nish_str_from_i32(int32_t);
nish_str *nish_str_from_i64(int64_t);
nish_str *nish_str_from_f64(double);
int64_t nish_str_index_of(const nish_str *, const nish_str *);
double nish_random(void);
nish_str *nish_read_file(const nish_str *);
void nish_write_file(const nish_str *, const nish_str *);
void nish_append_file(const nish_str *, const nish_str *);

static void expect_str(const nish_str *s, const char *want, const char *what) {
  if (s->len != strlen(want) || memcmp(s->data, want, s->len) != 0 || s->data[s->len] != 0) {
    fprintf(stderr, "runtime_test: %s: expected \"%s\", got \"%.*s\"\n", what, want, (int)s->len, s->data);
    assert(0);
  }
}

static void expect_f64(double v, const char *want) { expect_str(nish_str_from_f64(v), want, want); }

static void expect_i64(int64_t got, int64_t want, const char *what) {
  if (got != want) {
    fprintf(stderr, "runtime_test: %s: expected %lld, got %lld\n", what, (long long)want, (long long)got);
    assert(0);
  }
}
/* WP4 */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;
void nish_array_grow(nish_array *, uint64_t);
nish_array *nish_alloc_array(uint64_t, uint64_t);
/* WP7: process.argv and string parsing */
extern nish_array *nish_argv;
void nish_argv_init(int32_t, char **);
double nish_parse_number(const nish_str *, int32_t);

static nish_str *lit(const char *s) { return nish_str_new(s, strlen(s)); }
/* Expected text is `node -p "String(<js expression>)"`; a mode-2 result is what `parseInt` sees before saturation. */
static void expect_parse(const char *input, int32_t mode, const char *want) {
  char what[64];
  snprintf(what, sizeof what, "parse(\"%s\", %d)", input, mode);
  expect_str(nish_str_from_f64(nish_parse_number(lit(input), mode)), want, what);
}

/* ---- WP20 T0: the thread-local arena -------------------------------------
 * Only compiled into the -DNISH_THREADS build, which is the build where
 * `nish_arena` and the RNG seed are `_Thread_local`. Everything asserted here
 * is deterministic: the worker runs to completion before the parent looks
 * again, so nothing depends on how the two threads interleave.
 *
 * The RNG is exercised but its *values* are not pinned. Both threads seed
 * lazily from `time(0)` and the pid, so two threads starting in the same second
 * start from the same seed — which makes "the streams are independent"
 * indistinguishable from "the streams are identical" without reaching into the
 * seed word, and would make any equality assertion here a test of the clock.
 * What the thread-local seed buys is that neither thread's draw can tear the
 * other's state; the range check is what this file can honestly say about it. */
#ifdef NISH_THREADS
#include <pthread.h>

/* What the worker thread saw in its own arena, read by the parent after join. */
static struct {
  uint64_t used_at_entry;
  char *first;
  uint64_t used_after_two;
  uint64_t used_after_release;
  int random_in_range;
} worker;

static void *thread_body(void *unused) {
  (void)unused;
  /* A fresh thread starts with an empty arena however much the parent has
     bumped, because the arena it bumps is not the parent's. */
  worker.used_at_entry = nish_arena_used();
  worker.first = nish_alloc_struct(12);
  nish_alloc_struct(12);
  worker.used_after_two = nish_arena_used();
  /* WP20 §3.1: scopes are per-thread by construction, so a worker's release
     rewinds its own arena and cannot reach into the parent's. */
  uint64_t mark = nish_arena_mark();
  nish_alloc_struct(4096);
  nish_arena_release(mark);
  worker.used_after_release = nish_arena_used();
  worker.random_in_range = 1;
  for (int i = 0; i < 1000; i++) {
    double r = nish_random();
    if (!(r >= 0.0 && r < 1.0)) worker.random_in_range = 0;
  }
  /* The worker owns its chunks, so it frees them; the parent's are untouched. */
  nish_free_arena();
  return NULL;
}

static void test_threads(void) {
  nish_free_arena();
  nish_str *parent = lit("parent string");
  uint64_t used_before = nish_arena_used();
  char *parent_block = nish_alloc_struct(64);
  parent_block[0] = 'p';
  assert(used_before > 0);

  pthread_t t;
  assert(pthread_create(&t, NULL, thread_body, NULL) == 0);
  assert(pthread_join(t, NULL) == 0);

  assert(worker.used_at_entry == 0);   /* its own arena, not the parent's */
  assert(worker.used_after_two == 32); /* two 12-byte bumps, 8-byte rounded */
  assert(worker.used_after_release == 32);
  assert(worker.random_in_range);
  /* Disjoint storage: the worker never bumped a byte of the parent's chunk. */
  assert(worker.first != parent_block);
  /* And the parent's arena came through the join exactly as it was, contents
     included — which one shared arena would not have survived, because the
     worker released and then freed everything it could see. */
  assert(nish_arena_used() == used_before + 64);
  assert(parent_block[0] == 'p');
  expect_str(parent, "parent string", "the parent's string survives a worker thread");

  double r = nish_random();
  assert(r >= 0.0 && r < 1.0);
  nish_free_arena();
}
#endif

int main(void) {
  /* Bump allocation: consecutive, 8-byte rounded, 8-byte aligned. */
  char *a = nish_alloc_struct(12);
  char *b = nish_alloc_struct(1);
  char *c = nish_alloc_struct(8);
  assert(((uintptr_t)a & 7) == 0);
  assert(b - a == 16 && c - b == 8);
  size_t used = nish_arena.off;
  assert(used == 32);

  /* Reset recycles in place: the next allocation lands where `a` was. */
  nish_reset_arena();
  assert(nish_arena.off == 0);
  assert((char *)nish_alloc_struct(4) == a);

  /* Overflow grows into a new chunk and keeps working; reset keeps the newest. */
  char *big = nish_alloc_struct(1 << 20);
  assert(big != a);
  memset(big, 0xAB, 1 << 20);
  nish_reset_arena();
  assert(nish_arena.cap >= (1 << 20) && nish_arena.chunks != NULL);

  /* WP6 scopes: mark/release rewinds within a chunk, pops chunks pushed since
   * an older mark, and a mark of 0 (empty arena) behaves like a reset. */
  nish_free_arena();
  assert(nish_arena_mark() == 0 && nish_arena_used() == 0);
  char *base = nish_alloc_struct(16);
  uint64_t m = nish_arena_mark();
  assert(m == (uint64_t)(uintptr_t)(base + 16) && nish_arena_used() == 16);
  nish_alloc_struct(64);
  assert(nish_arena_used() == 80);
  nish_arena_release(m);
  assert(nish_arena_used() == 16 && (char *)nish_alloc_struct(8) == base + 16);
  void *before = nish_arena.chunks;
  char *huge = nish_alloc_struct(1 << 20); /* a second chunk */
  assert(nish_arena.chunks != before && huge != base);
  nish_arena_release(m);                    /* pops it, back to the first chunk */
  assert(nish_arena.chunks == before && nish_arena.buf == base && nish_arena_used() == 16);
  nish_arena_release(0);                    /* like a reset: keeps a chunk, offset 0 */
  assert(nish_arena_used() == 0 && nish_arena.chunks == before);
  for (int i = 0; i < 100000; i++) {       /* a scoped hot loop never grows the arena */
    uint64_t mk = nish_arena_mark();
    nish_alloc_struct(1000);
    nish_arena_release(mk);
  }
  assert(nish_arena_used() == 0 && nish_arena.chunks == before);

  /* WP9 call-site reclaim: `nish_arena_keep(mark, p)` releases back to `mark`
   * while preserving the newest block. Five behaviours, and the four refusals
   * matter more than the move, because each of them is a case where relocating
   * would corrupt live memory. */
  nish_free_arena();
  nish_alloc_struct(8); /* something below the mark, which must not move */
  uint64_t k = nish_arena_mark();
  char *garbage = nish_alloc_struct(400);
  nish_str *kept = nish_str_new("keepme", 6);
  nish_str *moved = nish_arena_keep(k, kept);
  assert((uint64_t)(uintptr_t)moved == k);                  /* moved down onto the mark */
  assert(moved->len == 6 && memcmp(moved->data, "keepme", 6) == 0 && moved->data[6] == 0);
  assert(nish_arena_used() == 8 + 16 && garbage != NULL);   /* the 400 bytes are gone */

  /* Across chunks, with room below the mark: the newer chunk is freed. */
  void *one = nish_arena.chunks;
  k = nish_arena_mark();
  nish_alloc_struct(1 << 20); /* pushes a second chunk */
  kept = nish_str_new("across", 6);
  assert(nish_arena.chunks != one);
  moved = nish_arena_keep(k, kept);
  assert((uint64_t)(uintptr_t)moved == k && nish_arena.chunks == one);
  assert(memcmp(moved->data, "across", 6) == 0);

  /* Across chunks with a *full* chunk below: `p` stays where it is and only the
   * chunks between it and the mark's chunk are freed. */
  nish_free_arena();
  nish_alloc_struct(1 << 20); /* chunk A, filled exactly, so the mark sits at its end */
  void *chunk_a = nish_arena.chunks;
  k = nish_arena_mark();
  nish_alloc_struct(1 << 20); /* chunk B: pure garbage */
  nish_alloc_struct(1 << 20); /* chunk C: pure garbage */
  kept = nish_str_new("stay", 4); /* chunk D */
  void *chunk_d = nish_arena.chunks;
  moved = nish_arena_keep(k, kept);
  assert(moved == kept && nish_arena.chunks == chunk_d); /* not relocated: A has no room */
  assert(memcmp(moved->data, "stay", 4) == 0);
  assert(*(void **)chunk_d == chunk_a); /* B and C were freed out of the middle */

  /* Refusals. A pointer that is not the newest arena block — a string literal
   * in read-only data, or anything older than the mark — is answered unchanged
   * and nothing is released. */
  nish_free_arena();
  nish_str *older = nish_str_new("old", 3);
  k = nish_arena_mark();
  nish_alloc_struct(64);
  size_t held = nish_arena_used();
  assert(nish_arena_keep(k, older) == older && nish_arena_used() == held);
  static const struct { uint64_t len; char data[4]; } literal = { 3, "lit" };
  assert(nish_arena_keep(k, (void *)&literal) == (void *)&literal);
  assert(nish_arena_used() == held);
  /* A stale mark (no live chunk holds it) is refused too. */
  kept = nish_str_new("fresh", 5);
  assert(nish_arena_keep(1, kept) == kept);

  /* Strings. */
  nish_str *hello = nish_str_new("hello", 5);
  nish_str *world = nish_str_new(", world", 7);
  nish_str *hw = nish_str_concat(hello, world);
  assert(nish_str_len(hw) == 12 && memcmp(hw->data, "hello, world", 12) == 0 && hw->data[12] == 0);
  assert(nish_str_eq(hw, nish_str_new("hello, world", 12)));
  assert(!nish_str_eq(hello, world));
  assert(((uintptr_t)hw & 7) == 0);

  /* Integers. */
  expect_str(nish_str_from_i32(-2147483647 - 1), "-2147483648", "i32 min");
  expect_str(nish_str_from_i32(0), "0", "i32 zero");
  expect_str(nish_str_from_i64(INT64_MIN), "-9223372036854775808", "i64 min");
  expect_str(nish_str_from_i64(INT64_MAX), "9223372036854775807", "i64 max");
  expect_str(nish_str_from_i64(10000000000LL), "10000000000", "i64 10^10");

  /* Doubles: JS Number.prototype.toString (expected text is `node -p "String(x)"`). */
  expect_f64(3.5, "3.5");
  expect_f64(0.1, "0.1");
  expect_f64(1.0 / 3.0, "0.3333333333333333");
  expect_f64(1e21, "1e+21");
  expect_f64(1e-7, "1e-7");
  expect_f64(0.000001, "0.000001");
  expect_f64(123456789012.0, "123456789012");
  expect_f64(-0.0, "0");
  expect_f64(NAN, "NaN");
  expect_f64(INFINITY, "Infinity");
  expect_f64(-INFINITY, "-Infinity");
  expect_f64(5e-324, "5e-324");
  expect_f64(1.7976931348623157e308, "1.7976931348623157e+308");
  expect_f64(100.0, "100");
  expect_f64(1.5, "1.5");
  expect_f64(-2.5, "-2.5");
  expect_f64(1e20, "100000000000000000000");
  expect_f64(123456789012345680000.0, "123456789012345680000");
  expect_f64(1.5e300, "1.5e+300");
  /* WP15: the shortest string that round-trips at this length is not the
     correctly-rounded one, so the old snprintf/strtod search printed all
     seventeen digits of each of these. Node prints sixteen. */
  /* `indexOf` moved into the runtime (WP15): the edge cases the inline loop
     used to define, and the repeated-first-byte case the memchr fallback
     walks. `tests/run.js` runs this file against both paths. */
  expect_i64(nish_str_index_of(lit("hello world"), lit("world")), 6, "indexOf hit");
  expect_i64(nish_str_index_of(lit("hello"), lit("")), 0, "indexOf empty needle");
  expect_i64(nish_str_index_of(lit("hi"), lit("longer")), -1, "indexOf needle longer than haystack");
  expect_i64(nish_str_index_of(lit(""), lit("")), 0, "indexOf both empty");
  expect_i64(nish_str_index_of(lit(""), lit("x")), -1, "indexOf empty haystack");
  expect_i64(nish_str_index_of(lit("abc"), lit("abc")), 0, "indexOf whole string");
  expect_i64(nish_str_index_of(lit("abc"), lit("c")), 2, "indexOf last byte");
  expect_i64(nish_str_index_of(lit("abc"), lit("d")), -1, "indexOf absent");
  expect_i64(nish_str_index_of(lit("aaaaab"), lit("aab")), 3, "indexOf repeated first byte");
  expect_i64(nish_str_index_of(lit("aaaa"), lit("aaaaa")), -1, "indexOf needle one longer");
  expect_i64(nish_str_index_of(lit("h\xc3\xa9llo"), lit("\xc3\xa9")), 1, "indexOf utf-8 byte offset");

  expect_f64(7.120236347223045e-307, "7.120236347223045e-307");
  expect_f64(7.291122019556398e-304, "7.291122019556398e-304");
  expect_f64(8.209073602596753e-289, "8.209073602596753e-289");
  expect_f64(5.641232424577593e-278, "5.641232424577593e-278");
  expect_f64(-1e-7, "-1e-7");
  expect_f64(2.5e-7, "2.5e-7");
  expect_f64(9007199254740992.0, "9007199254740992");
  expect_f64(4.35, "4.35");
  expect_f64(-0.49999999999999994, "-0.49999999999999994");
  expect_f64(0.000001234, "0.000001234");
  expect_f64(123e-20, "1.23e-18");
  expect_f64(1234.5678, "1234.5678");

  /* Math.random: doubles in [0, 1) that are not all equal. */
  double first = nish_random(), r;
  int distinct = 0;
  for (int i = 0; i < 1000; i++) {
    r = nish_random();
    assert(r >= 0.0 && r < 1.0);
    if (r != first) distinct++;
  }
  assert(distinct > 990);

  /* Files: write, append, read back. */
  nish_str *path = nish_str_new("build/test/runtime_test.txt", 27);
  nish_write_file(path, nish_str_new("alpha\n", 6));
  nish_append_file(path, nish_str_new("beta\n", 5));
  expect_str(nish_read_file(path), "alpha\nbeta\n", "read back");
  nish_write_file(path, nish_str_new("", 0));
  expect_str(nish_read_file(path), "", "empty file");
  unlink(path->data);

  /* WP4 arrays: grow doubles cap (4 from empty), keeps len and the elements, 8-aligned. */
  nish_array arr = { 0, 0, 0 };
  nish_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 4 && arr.len == 0 && arr.data != NULL && ((uintptr_t)arr.data & 7) == 0);
  for (int i = 0; i < 4; i++) ((int32_t *)arr.data)[i] = i * 10;
  arr.len = 4;
  char *old = arr.data;
  nish_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 8 && arr.len == 4 && arr.data != old);
  for (int i = 0; i < 4; i++) assert(((int32_t *)arr.data)[i] == i * 10);

  /* WP8 host entry: len == cap, 8-aligned data, elements writable; a zero length allocates only the header. */
  nish_array *fresh = nish_alloc_array(sizeof(double), 3);
  assert(fresh->len == 3 && fresh->cap == 3 && ((uintptr_t)fresh->data & 7) == 0);
  ((double *)fresh->data)[2] = 2.5;
  assert(((double *)fresh->data)[2] == 2.5);
  assert(nish_alloc_array(sizeof(int32_t), 0)->len == 0);
  /* WP7 process.argv: a string array outside the arena (a reset must not touch it). */
  char *argv[] = { "./app", "", "héllo", "42" };
  nish_argv_init(4, argv);
  assert(nish_argv->len == 4 && nish_argv->cap == 4);
  nish_reset_arena();
  expect_str(((nish_str **)nish_argv->data)[0], "./app", "argv[0]");
  expect_str(((nish_str **)nish_argv->data)[1], "", "argv[1]");
  expect_str(((nish_str **)nish_argv->data)[2], "héllo", "argv[2]");
  assert(((nish_str **)nish_argv->data)[2]->len == 6); /* bytes, not code points */
  expect_str(((nish_str **)nish_argv->data)[3], "42", "argv[3]");
  nish_argv_init(0, argv);
  assert(nish_argv->len == 0);

  /* WP7 parsing. mode 0 = parseFloat, 1 = Number, 2 = parseInt (before the i32 saturation). */
  expect_parse("3.14xyz", 0, "3.14");
  expect_parse("  .5", 0, "0.5");
  expect_parse("-1e3", 0, "-1000");
  expect_parse("1e", 0, "1");
  expect_parse("1.5e+", 0, "1.5");
  expect_parse("+Infinity!", 0, "Infinity");
  expect_parse("-Infinity", 0, "-Infinity");
  expect_parse("Infinit", 0, "NaN");
  expect_parse("inf", 0, "NaN");
  expect_parse("nan", 0, "NaN");
  expect_parse("", 0, "NaN");
  expect_parse(".", 0, "NaN");
  expect_parse("+", 0, "NaN");
  expect_parse("abc", 0, "NaN");
  expect_parse("0.1", 0, "0.1");
  expect_parse("1e400", 0, "Infinity");
  expect_parse("0x1A", 0, "26"); /* documented: strtod reads hex, JS parseFloat would stop at the x */
  expect_parse("42", 1, "42");
  expect_parse("", 1, "0");
  expect_parse(" \t\n", 1, "0");
  expect_parse("  7.5  ", 1, "7.5");
  expect_parse("12px", 1, "NaN");
  expect_parse("1e3", 1, "1000");
  expect_parse("-.5", 1, "-0.5");
  expect_parse("0x1A", 1, "26");
  expect_parse("Infinity", 1, "Infinity");
  expect_parse("-Infinity ", 1, "-Infinity");
  expect_parse("Infinityx", 1, "NaN");
  expect_parse("infinity", 1, "NaN");
  expect_parse("NaN", 1, "NaN");
  expect_parse("1e", 1, "NaN");
  expect_parse("1 2", 1, "NaN");
  expect_parse("42", 2, "42");
  expect_parse("  -17abc", 2, "-17");
  expect_parse("+3.99", 2, "3");
  expect_parse("1e5", 2, "1");
  expect_parse("0x10", 2, "0");
  expect_parse("abc", 2, "0");
  expect_parse("", 2, "0");
  expect_parse("99999999999", 2, "99999999999"); /* the compiler saturates this into an i32 */
  { /* an embedded NUL ends the number for Number, like any other non-space byte */
    nish_str *nul = nish_str_new("5\0", 2);
    expect_str(nish_str_from_f64(nish_parse_number(nul, 1)), "NaN", "Number(\"5\\0\")");
    expect_str(nish_str_from_f64(nish_parse_number(nul, 0)), "5", "parseFloat(\"5\\0\")");
  }

  nish_free_arena();
  assert(nish_arena.chunks == NULL && nish_arena.cap == 0);
#ifdef NISH_THREADS
  test_threads();
  puts("runtime_test: ok (threads)");
#else
  puts("runtime_test: ok");
#endif
  return 0;
}
