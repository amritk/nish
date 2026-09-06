/* Unit test for runtime/runtime.c: arena semantics and string handling. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef struct { uint64_t len; char data[]; } sts_str;
extern struct sts_arena { char *buf; size_t off; size_t cap; void *chunks; } sts_arena;
void *sts_alloc_struct(size_t);
void sts_reset_arena(void);
void sts_free_arena(void);
sts_str *sts_str_new(const char *, uint64_t);
sts_str *sts_str_concat(const sts_str *, const sts_str *);
_Bool sts_str_eq(const sts_str *, const sts_str *);
uint64_t sts_str_len(const sts_str *);
sts_str *sts_str_from_i32(int32_t);
sts_str *sts_str_from_f64(double);

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

  /* Strings. */
  sts_str *hello = sts_str_new("hello", 5);
  sts_str *world = sts_str_new(", world", 7);
  sts_str *hw = sts_str_concat(hello, world);
  assert(sts_str_len(hw) == 12 && memcmp(hw->data, "hello, world", 12) == 0 && hw->data[12] == 0);
  assert(sts_str_eq(hw, sts_str_new("hello, world", 12)));
  assert(!sts_str_eq(hello, world));
  assert(((uintptr_t)hw & 7) == 0);

  sts_str *neg = sts_str_from_i32(-2147483647 - 1);
  assert(neg->len == 11 && memcmp(neg->data, "-2147483648", 11) == 0);
  sts_str *zero = sts_str_from_i32(0);
  assert(zero->len == 1 && zero->data[0] == '0');
  sts_str *pi = sts_str_from_f64(3.5);
  assert(pi->len == 3 && memcmp(pi->data, "3.5", 3) == 0);

  sts_free_arena();
  assert(sts_arena.chunks == NULL && sts_arena.cap == 0);
  puts("runtime_test: ok");
  return 0;
}
