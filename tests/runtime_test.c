/* Unit test for runtime/runtime.c: arena semantics, string handling, number
 * formatting (checked against what Node prints for `String(x)`), the random
 * generator, and file I/O. */
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

typedef struct { uint64_t len; char data[]; } sts_str;
extern struct sts_arena { char *buf; size_t off; size_t cap; void *chunks; } sts_arena;
void *sts_alloc_struct(size_t);
void sts_reset_arena(void);
void sts_free_arena(void);
uint64_t sts_arena_mark(void);
void sts_arena_release(uint64_t);
uint64_t sts_arena_used(void);
sts_str *sts_str_new(const char *, uint64_t);
sts_str *sts_str_concat(const sts_str *, const sts_str *);
_Bool sts_str_eq(const sts_str *, const sts_str *);
uint64_t sts_str_len(const sts_str *);
sts_str *sts_str_from_i32(int32_t);
sts_str *sts_str_from_i64(int64_t);
sts_str *sts_str_from_f64(double);
double sts_random(void);
sts_str *sts_read_file(const sts_str *);
void sts_write_file(const sts_str *, const sts_str *);
void sts_append_file(const sts_str *, const sts_str *);

static void expect_str(const sts_str *s, const char *want, const char *what) {
  if (s->len != strlen(want) || memcmp(s->data, want, s->len) != 0 || s->data[s->len] != 0) {
    fprintf(stderr, "runtime_test: %s: expected \"%s\", got \"%.*s\"\n", what, want, (int)s->len, s->data);
    assert(0);
  }
}

static void expect_f64(double v, const char *want) { expect_str(sts_str_from_f64(v), want, want); }
/* WP4 */
typedef struct sts_array { uint64_t len; uint64_t cap; char *data; } sts_array;
void sts_array_grow(sts_array *, uint64_t);

int main(void) {
  /* Bump allocation: consecutive, 8-byte rounded, 8-byte aligned. */
  char *a = sts_alloc_struct(12);
  char *b = sts_alloc_struct(1);
  char *c = sts_alloc_struct(8);
  assert(((uintptr_t)a & 7) == 0);
  assert(b - a == 16 && c - b == 8);
  size_t used = sts_arena.off;
  assert(used == 32);

  /* Reset recycles in place: the next allocation lands where `a` was. */
  sts_reset_arena();
  assert(sts_arena.off == 0);
  assert((char *)sts_alloc_struct(4) == a);

  /* Overflow grows into a new chunk and keeps working; reset keeps the newest. */
  char *big = sts_alloc_struct(1 << 20);
  assert(big != a);
  memset(big, 0xAB, 1 << 20);
  sts_reset_arena();
  assert(sts_arena.cap >= (1 << 20) && sts_arena.chunks != NULL);

  /* WP6 scopes: mark/release rewinds within a chunk, pops chunks pushed since
   * an older mark, and a mark of 0 (empty arena) behaves like a reset. */
  sts_free_arena();
  assert(sts_arena_mark() == 0 && sts_arena_used() == 0);
  char *base = sts_alloc_struct(16);
  uint64_t m = sts_arena_mark();
  assert(m == (uint64_t)(uintptr_t)(base + 16) && sts_arena_used() == 16);
  sts_alloc_struct(64);
  assert(sts_arena_used() == 80);
  sts_arena_release(m);
  assert(sts_arena_used() == 16 && (char *)sts_alloc_struct(8) == base + 16);
  void *before = sts_arena.chunks;
  char *huge = sts_alloc_struct(1 << 20); /* a second chunk */
  assert(sts_arena.chunks != before && huge != base);
  sts_arena_release(m);                    /* pops it, back to the first chunk */
  assert(sts_arena.chunks == before && sts_arena.buf == base && sts_arena_used() == 16);
  sts_arena_release(0);                    /* like a reset: keeps a chunk, offset 0 */
  assert(sts_arena_used() == 0 && sts_arena.chunks == before);
  for (int i = 0; i < 100000; i++) {       /* a scoped hot loop never grows the arena */
    uint64_t mk = sts_arena_mark();
    sts_alloc_struct(1000);
    sts_arena_release(mk);
  }
  assert(sts_arena_used() == 0 && sts_arena.chunks == before);

  /* Strings. */
  sts_str *hello = sts_str_new("hello", 5);
  sts_str *world = sts_str_new(", world", 7);
  sts_str *hw = sts_str_concat(hello, world);
  assert(sts_str_len(hw) == 12 && memcmp(hw->data, "hello, world", 12) == 0 && hw->data[12] == 0);
  assert(sts_str_eq(hw, sts_str_new("hello, world", 12)));
  assert(!sts_str_eq(hello, world));
  assert(((uintptr_t)hw & 7) == 0);

  /* Integers. */
  expect_str(sts_str_from_i32(-2147483647 - 1), "-2147483648", "i32 min");
  expect_str(sts_str_from_i32(0), "0", "i32 zero");
  expect_str(sts_str_from_i64(INT64_MIN), "-9223372036854775808", "i64 min");
  expect_str(sts_str_from_i64(INT64_MAX), "9223372036854775807", "i64 max");
  expect_str(sts_str_from_i64(10000000000LL), "10000000000", "i64 10^10");

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
  double first = sts_random(), r;
  int distinct = 0;
  for (int i = 0; i < 1000; i++) {
    r = sts_random();
    assert(r >= 0.0 && r < 1.0);
    if (r != first) distinct++;
  }
  assert(distinct > 990);

  /* Files: write, append, read back. */
  sts_str *path = sts_str_new("build/test/runtime_test.txt", 27);
  sts_write_file(path, sts_str_new("alpha\n", 6));
  sts_append_file(path, sts_str_new("beta\n", 5));
  expect_str(sts_read_file(path), "alpha\nbeta\n", "read back");
  sts_write_file(path, sts_str_new("", 0));
  expect_str(sts_read_file(path), "", "empty file");
  unlink(path->data);

  /* WP4 arrays: grow doubles cap (4 from empty), keeps len and the elements, 8-aligned. */
  sts_array arr = { 0, 0, 0 };
  sts_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 4 && arr.len == 0 && arr.data != NULL && ((uintptr_t)arr.data & 7) == 0);
  for (int i = 0; i < 4; i++) ((int32_t *)arr.data)[i] = i * 10;
  arr.len = 4;
  char *old = arr.data;
  sts_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 8 && arr.len == 4 && arr.data != old);
  for (int i = 0; i < 4; i++) assert(((int32_t *)arr.data)[i] == i * 10);

  sts_free_arena();
  assert(sts_arena.chunks == NULL && sts_arena.cap == 0);
  puts("runtime_test: ok");
  return 0;
}
