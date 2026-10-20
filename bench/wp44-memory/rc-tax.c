/* What counting every heap value costs a program that keeps nothing long:
   a walk over `n` arena objects, each step a reference loaded from an array
   and a field read through it, which is what most Nish code does. `plain` is
   today's load; `rc` adds the retain and release a counted reference makes
   when it is copied into a local and dropped, inlined, where the optimiser
   may fold the pair; `call` makes them calls into the runtime, as Swift's
   swift_retain/swift_release are; `atomic` makes them atomic, as values that
   may cross threads need. The index changes every step and the
   fields read fold into a printed checksum.

     cc -O2 rc-tax.c runtime.o -o rc-tax && ./rc-tax <plain|plain2|rc|call|atomic> <n> <steps> */
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

void *nish_alloc_struct(uint64_t size);

typedef struct obj { int64_t rc; int64_t value; } obj;

__attribute__((noinline)) void nish_retain(obj *o) { o->rc++; }
__attribute__((noinline)) void nish_release(obj *o) { if (--o->rc == 0) abort(); }

#define WALK(NAME, RETAIN, RELEASE)                                            \
  static uint64_t NAME(obj **objs, uint64_t n, uint64_t steps) {               \
    uint64_t x = 2463534242u, sum = 0;                                         \
    for (uint64_t s = 0; s < steps; s++) {                                     \
      x ^= x << 13; x ^= x >> 7; x ^= x << 17;                                 \
      obj *o = objs[x & (n - 1)];                                              \
      RETAIN;                                                                  \
      sum = sum * 31 + (uint64_t)o->value;                                     \
      RELEASE;                                                                 \
    }                                                                          \
    return sum;                                                                \
  }
WALK(walk_plain, (void)0, (void)0)
WALK(walk_plain2, (void)0, (void)0)
WALK(walk_rc, o->rc++, if (--o->rc == 0) abort())
WALK(walk_call, nish_retain(o), nish_release(o))
WALK(walk_atomic, atomic_fetch_add_explicit((_Atomic int64_t *)&o->rc, 1, memory_order_relaxed),
     if (atomic_fetch_sub_explicit((_Atomic int64_t *)&o->rc, 1, memory_order_acq_rel) == 1) abort())

int main(int argc, char **argv) {
  if (argc < 4) { fprintf(stderr, "usage: rc-tax <plain|plain2|rc|call|atomic> <n> <steps>\n"); return 2; }
  uint64_t n = 1;
  while (n < (uint64_t)atoll(argv[2])) n <<= 1;
  uint64_t steps = (uint64_t)atoll(argv[3]);
  obj **objs = nish_alloc_struct(n * sizeof *objs);
  for (uint64_t i = 0; i < n; i++) {
    objs[i] = nish_alloc_struct(sizeof(obj));
    *objs[i] = (obj){ 1, (int64_t)(i * 7 + 3) };
  }
  struct timespec t0, t1;
  clock_gettime(CLOCK_MONOTONIC, &t0);
  uint64_t sum = !strcmp(argv[1], "rc")       ? walk_rc(objs, n, steps)
                 : !strcmp(argv[1], "call")   ? walk_call(objs, n, steps)
                 : !strcmp(argv[1], "atomic") ? walk_atomic(objs, n, steps)
                 : !strcmp(argv[1], "plain2") ? walk_plain2(objs, n, steps)
                                              : walk_plain(objs, n, steps);
  clock_gettime(CLOCK_MONOTONIC, &t1);
  double ns = ((double)(t1.tv_sec - t0.tv_sec) * 1e9 + (double)(t1.tv_nsec - t0.tv_nsec)) / (double)steps;
  printf("%s ns/step %.2f checksum %llu\n", argv[1], ns, (unsigned long long)sum);
  return 0;
}
