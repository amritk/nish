/* Unit test for runtime/runtime.c: arena semantics, string handling, number
 * formatting (checked against what Node prints for `String(x)`), the random
 * generator, and file I/O. */
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

typedef struct { uint64_t len; char data[]; } amrit_str;
extern struct amrit_arena { char *buf; size_t off; size_t cap; void *chunks; } amrit_arena;
void *amrit_alloc_struct(size_t);
void amrit_reset_arena(void);
void amrit_free_arena(void);
uint64_t amrit_arena_mark(void);
void amrit_arena_release(uint64_t);
uint64_t amrit_arena_used(void);
amrit_str *amrit_str_new(const char *, uint64_t);
amrit_str *amrit_str_concat(const amrit_str *, const amrit_str *);
_Bool amrit_str_eq(const amrit_str *, const amrit_str *);
uint64_t amrit_str_len(const amrit_str *);
amrit_str *amrit_str_from_i32(int32_t);
amrit_str *amrit_str_from_i64(int64_t);
amrit_str *amrit_str_from_f64(double);
double amrit_random(void);
amrit_str *amrit_read_file(const amrit_str *);
void amrit_write_file(const amrit_str *, const amrit_str *);
void amrit_append_file(const amrit_str *, const amrit_str *);

static void expect_str(const amrit_str *s, const char *want, const char *what) {
  if (s->len != strlen(want) || memcmp(s->data, want, s->len) != 0 || s->data[s->len] != 0) {
    fprintf(stderr, "runtime_test: %s: expected \"%s\", got \"%.*s\"\n", what, want, (int)s->len, s->data);
    assert(0);
  }
}

static void expect_f64(double v, const char *want) { expect_str(amrit_str_from_f64(v), want, want); }
/* WP4 */
typedef struct amrit_array { uint64_t len; uint64_t cap; char *data; } amrit_array;
void amrit_array_grow(amrit_array *, uint64_t);
amrit_array *amrit_alloc_array(uint64_t, uint64_t);
/* WP7: process.argv and string parsing */
extern amrit_array *amrit_argv;
void amrit_argv_init(int32_t, char **);
double amrit_parse_number(const amrit_str *, int32_t);

static amrit_str *lit(const char *s) { return amrit_str_new(s, strlen(s)); }
/* Expected text is `node -p "String(<js expression>)"`; a mode-2 result is what `parseInt` sees before saturation. */
static void expect_parse(const char *input, int32_t mode, const char *want) {
  char what[64];
  snprintf(what, sizeof what, "parse(\"%s\", %d)", input, mode);
  expect_str(amrit_str_from_f64(amrit_parse_number(lit(input), mode)), want, what);
}

int main(void) {
  /* Bump allocation: consecutive, 8-byte rounded, 8-byte aligned. */
  char *a = amrit_alloc_struct(12);
  char *b = amrit_alloc_struct(1);
  char *c = amrit_alloc_struct(8);
  assert(((uintptr_t)a & 7) == 0);
  assert(b - a == 16 && c - b == 8);
  size_t used = amrit_arena.off;
  assert(used == 32);

  /* Reset recycles in place: the next allocation lands where `a` was. */
  amrit_reset_arena();
  assert(amrit_arena.off == 0);
  assert((char *)amrit_alloc_struct(4) == a);

  /* Overflow grows into a new chunk and keeps working; reset keeps the newest. */
  char *big = amrit_alloc_struct(1 << 20);
  assert(big != a);
  memset(big, 0xAB, 1 << 20);
  amrit_reset_arena();
  assert(amrit_arena.cap >= (1 << 20) && amrit_arena.chunks != NULL);

  /* WP6 scopes: mark/release rewinds within a chunk, pops chunks pushed since
   * an older mark, and a mark of 0 (empty arena) behaves like a reset. */
  amrit_free_arena();
  assert(amrit_arena_mark() == 0 && amrit_arena_used() == 0);
  char *base = amrit_alloc_struct(16);
  uint64_t m = amrit_arena_mark();
  assert(m == (uint64_t)(uintptr_t)(base + 16) && amrit_arena_used() == 16);
  amrit_alloc_struct(64);
  assert(amrit_arena_used() == 80);
  amrit_arena_release(m);
  assert(amrit_arena_used() == 16 && (char *)amrit_alloc_struct(8) == base + 16);
  void *before = amrit_arena.chunks;
  char *huge = amrit_alloc_struct(1 << 20); /* a second chunk */
  assert(amrit_arena.chunks != before && huge != base);
  amrit_arena_release(m);                    /* pops it, back to the first chunk */
  assert(amrit_arena.chunks == before && amrit_arena.buf == base && amrit_arena_used() == 16);
  amrit_arena_release(0);                    /* like a reset: keeps a chunk, offset 0 */
  assert(amrit_arena_used() == 0 && amrit_arena.chunks == before);
  for (int i = 0; i < 100000; i++) {       /* a scoped hot loop never grows the arena */
    uint64_t mk = amrit_arena_mark();
    amrit_alloc_struct(1000);
    amrit_arena_release(mk);
  }
  assert(amrit_arena_used() == 0 && amrit_arena.chunks == before);

  /* Strings. */
  amrit_str *hello = amrit_str_new("hello", 5);
  amrit_str *world = amrit_str_new(", world", 7);
  amrit_str *hw = amrit_str_concat(hello, world);
  assert(amrit_str_len(hw) == 12 && memcmp(hw->data, "hello, world", 12) == 0 && hw->data[12] == 0);
  assert(amrit_str_eq(hw, amrit_str_new("hello, world", 12)));
  assert(!amrit_str_eq(hello, world));
  assert(((uintptr_t)hw & 7) == 0);

  /* Integers. */
  expect_str(amrit_str_from_i32(-2147483647 - 1), "-2147483648", "i32 min");
  expect_str(amrit_str_from_i32(0), "0", "i32 zero");
  expect_str(amrit_str_from_i64(INT64_MIN), "-9223372036854775808", "i64 min");
  expect_str(amrit_str_from_i64(INT64_MAX), "9223372036854775807", "i64 max");
  expect_str(amrit_str_from_i64(10000000000LL), "10000000000", "i64 10^10");

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
  expect_f64(-1e-7, "-1e-7");
  expect_f64(2.5e-7, "2.5e-7");
  expect_f64(9007199254740992.0, "9007199254740992");
  expect_f64(4.35, "4.35");
  expect_f64(-0.49999999999999994, "-0.49999999999999994");
  expect_f64(0.000001234, "0.000001234");
  expect_f64(123e-20, "1.23e-18");
  expect_f64(1234.5678, "1234.5678");

  /* Math.random: doubles in [0, 1) that are not all equal. */
  double first = amrit_random(), r;
  int distinct = 0;
  for (int i = 0; i < 1000; i++) {
    r = amrit_random();
    assert(r >= 0.0 && r < 1.0);
    if (r != first) distinct++;
  }
  assert(distinct > 990);

  /* Files: write, append, read back. */
  amrit_str *path = amrit_str_new("build/test/runtime_test.txt", 27);
  amrit_write_file(path, amrit_str_new("alpha\n", 6));
  amrit_append_file(path, amrit_str_new("beta\n", 5));
  expect_str(amrit_read_file(path), "alpha\nbeta\n", "read back");
  amrit_write_file(path, amrit_str_new("", 0));
  expect_str(amrit_read_file(path), "", "empty file");
  unlink(path->data);

  /* WP4 arrays: grow doubles cap (4 from empty), keeps len and the elements, 8-aligned. */
  amrit_array arr = { 0, 0, 0 };
  amrit_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 4 && arr.len == 0 && arr.data != NULL && ((uintptr_t)arr.data & 7) == 0);
  for (int i = 0; i < 4; i++) ((int32_t *)arr.data)[i] = i * 10;
  arr.len = 4;
  char *old = arr.data;
  amrit_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 8 && arr.len == 4 && arr.data != old);
  for (int i = 0; i < 4; i++) assert(((int32_t *)arr.data)[i] == i * 10);

  /* WP8 host entry: len == cap, 8-aligned data, elements writable; a zero length allocates only the header. */
  amrit_array *fresh = amrit_alloc_array(sizeof(double), 3);
  assert(fresh->len == 3 && fresh->cap == 3 && ((uintptr_t)fresh->data & 7) == 0);
  ((double *)fresh->data)[2] = 2.5;
  assert(((double *)fresh->data)[2] == 2.5);
  assert(amrit_alloc_array(sizeof(int32_t), 0)->len == 0);
  /* WP7 process.argv: a string array outside the arena (a reset must not touch it). */
  char *argv[] = { "./app", "", "héllo", "42" };
  amrit_argv_init(4, argv);
  assert(amrit_argv->len == 4 && amrit_argv->cap == 4);
  amrit_reset_arena();
  expect_str(((amrit_str **)amrit_argv->data)[0], "./app", "argv[0]");
  expect_str(((amrit_str **)amrit_argv->data)[1], "", "argv[1]");
  expect_str(((amrit_str **)amrit_argv->data)[2], "héllo", "argv[2]");
  assert(((amrit_str **)amrit_argv->data)[2]->len == 6); /* bytes, not code points */
  expect_str(((amrit_str **)amrit_argv->data)[3], "42", "argv[3]");
  amrit_argv_init(0, argv);
  assert(amrit_argv->len == 0);

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
    amrit_str *nul = amrit_str_new("5\0", 2);
    expect_str(amrit_str_from_f64(amrit_parse_number(nul, 1)), "NaN", "Number(\"5\\0\")");
    expect_str(amrit_str_from_f64(amrit_parse_number(nul, 0)), "5", "parseFloat(\"5\\0\")");
  }

  amrit_free_arena();
  assert(amrit_arena.chunks == NULL && amrit_arena.cap == 0);
  puts("runtime_test: ok");
  return 0;
}
