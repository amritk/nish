/* The compact-class range (runtime.c, `-DNISH_ARENA_RANGE`), driven from C:
 * `node tests/run.js arena-range` links the whole runtime with the define, in the
 * default build and with -DNISH_THREADS, and runs it once per mode. The
 * sanitizer reruns (`node tests/run.js runtime_sanitize`) build it with
 * `-DNISH_RANGE_TEST_BASED` as well: their shadow memory lies where the fixed
 * range would be, so they take the shape macOS has.
 *
 * With no argument it runs the positive checks, prints "range ok" and exits
 * 0: every chunk of 2 MiB or less lies in the range, past its first 64 bytes,
 * with a power-of-two `cap` from 4 KiB to 2 MiB; a chunk a release frees is
 * the next one its class hands out; a larger chunk lies outside the range; a
 * region's and a worker thread's chunks lie in it; keep and the cross-thread
 * copies still work, a copied block adopted as a chunk is freed by malloc and
 * not put on a class list. The plain Linux build checks the range starts at
 * 1 GiB.
 *
 * `exhaust` (built with a small `-DNISH_RANGE_TEST_SIZE`) takes chunks until
 * the range is used up: it must exit 1 and never print "reached". `busy`
 * (with NISH_RANGE_TEST_BUSY=1 in the environment) maps the fixed address in
 * a constructor that runs before the runtime's: the reservation must exit 1
 * before main prints anything. `unreserved` (built with -DNISH_ASAN as well,
 * by `node tests/run.js runtime_sanitize`) checks that build reserves nothing:
 * the ABI symbol is there, the base is null, and the arena and a region still
 * work. */

#define _GNU_SOURCE
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#ifdef NISH_THREADS
#include <pthread.h>
#endif

#include "../../runtime/nish.h"

extern char *nish_ref_base;
extern const int nish_arena_range_abi;

#ifndef NISH_RANGE_TEST_SIZE
#define RANGE_SIZE ((uint64_t)15 << 30)
#else
#define RANGE_SIZE ((uint64_t)(NISH_RANGE_TEST_SIZE))
#endif

/* runtime.c's chunk header. */
struct chunk {
  struct chunk *next;
  uint64_t cap;
};

static int failures;
#define CHECK(cond, ...)                                    \
  do {                                                      \
    if (!(cond)) {                                          \
      failures++;                                           \
      fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__); \
      fprintf(stderr, __VA_ARGS__);                         \
      fputc('\n', stderr);                                  \
    }                                                       \
  } while (0)

/* Maps the fixed address first, so the runtime's reservation finds it busy. */
__attribute__((constructor(101))) static void busy_first(void) {
  const char *e = getenv("NISH_RANGE_TEST_BUSY");
  if (!e || strcmp(e, "1") != 0) return;
  void *p = mmap((void *)((uintptr_t)1 << 30), 4096, PROT_READ, MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED_NOREPLACE, -1, 0);
  if (p != (void *)((uintptr_t)1 << 30)) {
    fputs("busy: could not map 0x40000000 first\n", stderr);
    exit(3);
  }
}

static int in_range(const void *p) {
  uintptr_t a = (uintptr_t)p, base = (uintptr_t)nish_ref_base;
  return a >= base + 64 && a - base < RANGE_SIZE;
}

static int is_class(uint64_t cap) {
  return cap >= 4096 && cap <= ((uint64_t)1 << 21) && (cap & (cap - 1)) == 0;
}

/* The arena's newest chunk is in the range, of a class, and holds `p`. */
static void check_chunk(const char *what, const void *p) {
  struct chunk *c = (struct chunk *)nish_arena.chunks;
  CHECK(c != 0, "%s: no chunk", what);
  if (!c) return;
  CHECK(in_range(c), "%s: chunk %p outside the range at %p", what, (void *)c, (void *)nish_ref_base);
  CHECK(is_class(c->cap), "%s: cap %llu is not a class", what, (unsigned long long)c->cap);
  CHECK((const char *)p >= (const char *)(c + 1) && (const char *)p < (const char *)(c + 1) + c->cap,
        "%s: block %p not in its chunk", what, p);
}

#ifdef NISH_THREADS
static void *worker(void *out) {
  void *p = nish_alloc_struct(100000);
  memset(p, 1, 100000);
  *(void **)out = (void *)nish_arena.chunks;
  nish_free_arena();
  return 0;
}
#endif

static nish_str *make_str(uint64_t len, char fill) {
  nish_str *s = nish_alloc_struct(8 + len + 1);
  s->len = (int64_t)len;
  memset(s->data, fill, (size_t)len);
  s->data[len] = 0;
  return s;
}

static int positive(void) {
  CHECK(nish_arena_range_abi == 1, "the ABI symbol is %d", nish_arena_range_abi);
  CHECK(nish_ref_base != 0, "no range reserved before main");
#if defined __linux__ && !defined NISH_RANGE_TEST_BASED
  CHECK(nish_ref_base == (char *)((uintptr_t)1 << 30), "the fixed range is at %p, not 0x40000000", (void *)nish_ref_base);
#endif

  /* The first chunk, and every class from 4 KiB to 2 MiB in a region (whose
     chunks start at the first allocation's size). */
  void *p = nish_alloc_struct(24);
  check_chunk("first", p);
  CHECK((char *)nish_arena.chunks >= nish_ref_base + 64, "the first 64 bytes were handed out");
  CHECK(nish_arena.chunks != 0 && ((struct chunk *)nish_arena.chunks)->cap == 65536, "the first chunk is not 64 KiB");

  for (uint64_t want = 4096; want <= ((uint64_t)1 << 21); want *= 2) {
    /* A fresh region's first chunk is its first allocation's size, so a
       request of exactly a class takes a chunk of that class; one byte less
       than half the next class rounds up to it. */
    uint64_t r = nish_region_new();
    nish_region_enter(r);
    void *q = nish_alloc_struct(want);
    memset(q, 2, (size_t)want);
    struct chunk *c = (struct chunk *)nish_arena.chunks;
    CHECK(c && c->cap == want, "a %llu-byte request took cap %llu", (unsigned long long)want,
          c ? (unsigned long long)c->cap : 0ull);
    check_chunk("class", q);
    nish_region_leave(r, q);
    nish_region_free(r);
    r = nish_region_new();
    nish_region_enter(r);
    q = nish_alloc_struct(want / 2 + 8);
    c = (struct chunk *)nish_arena.chunks;
    CHECK(c && c->cap == (want / 2 + 8 <= 4096 ? 4096 : want), "a %llu-byte request took cap %llu",
          (unsigned long long)(want / 2 + 8), c ? (unsigned long long)c->cap : 0ull);
    check_chunk("rounded class", q);
    nish_region_leave(r, q);
    nish_region_free(r);
  }

  /* A released chunk is the next one its class hands out. */
  {
    uint64_t mark = nish_arena_mark();
    nish_alloc_struct(300000);
    struct chunk *first = (struct chunk *)nish_arena.chunks;
    nish_arena_release(mark);
    nish_alloc_struct(300000);
    CHECK((struct chunk *)nish_arena.chunks == first, "the released 512 KiB chunk %p was not reused (got %p)",
          (void *)first, nish_arena.chunks);
    nish_arena_release(mark);
  }

  /* Past 2 MiB a chunk is malloc's, outside the range, and freed by malloc. */
  {
    uint64_t mark = nish_arena_mark();
    void *big = nish_alloc_struct(((uint64_t)1 << 21) + 64);
    memset(big, 3, 64);
    CHECK(!in_range(nish_arena.chunks), "a chunk over 2 MiB is in the range");
    nish_arena_release(mark);
  }

  /* `keep` copies a block past its release. */
  {
    uint64_t mark = nish_arena_mark();
    nish_alloc_struct(70000);
    int64_t *v = nish_alloc_struct(16);
    v[0] = 41;
    v[1] = 42;
    int64_t *kept = nish_arena_keep(mark, v);
    CHECK(kept[0] == 41 && kept[1] == 42, "keep lost the block");
    check_chunk("keep", kept);
  }

  /* A region's chunks come from the range, and freeing it gives them back. */
  {
    uint64_t r = nish_region_new();
    nish_region_enter(r);
    void *q = nish_alloc_struct(5000);
    memset(q, 4, 5000);
    check_chunk("region", q);
    void *q2 = nish_alloc_struct(200000);
    check_chunk("region's second", q2);
    nish_region_leave(r, q);
    nish_region_free(r);
    uint64_t again = nish_region_new();
    nish_region_enter(again);
    void *q3 = nish_alloc_struct(5000);
    check_chunk("region after a free", q3);
    nish_region_leave(again, q3);
    nish_region_free(again);
  }

  /* The cross-thread copies: a small value comes back into the arena, a large
     one becomes a chunk of it (malloc's), which a release frees by malloc. */
  {
    uint64_t mark = nish_arena_mark();
    nish_str *s = make_str(10, 'a');
    void *out = nish_cross_out(s, 0, 0);
    nish_str *back = nish_cross_in(out, 0);
    CHECK(back->len == 10 && back->data[9] == 'a', "a small copy came back wrong");
    check_chunk("cross_in small", back);
    nish_str *b = make_str(100000, 'b');
    nish_str *bback = nish_cross_in(nish_cross_out(b, 0, 0), 0);
    CHECK(bback->len == 100000 && bback->data[99999] == 'b', "a large copy came back wrong");
    CHECK(!in_range(nish_arena.chunks), "an adopted copy block is in the range");
    nish_arena_release(mark);
    void *after = nish_alloc_struct(64);
    check_chunk("after a release past an adopted block", after);
    nish_arena_release(mark);
  }

#ifdef NISH_THREADS
  {
    pthread_t t;
    void *chunk = 0;
    CHECK(pthread_create(&t, 0, worker, &chunk) == 0, "pthread_create");
    pthread_join(t, 0);
    CHECK(chunk && in_range(chunk), "a worker's chunk %p is outside the range", chunk);
  }
#endif

  nish_free_arena();
  if (failures) return 1;
  puts("range ok");
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) return positive();
  if (strcmp(argv[1], "exhaust") == 0) {
    for (int i = 0; i < 1 << 20; i++) nish_alloc_struct(65536);
    puts("reached");
    return 0;
  }
  if (strcmp(argv[1], "unreserved") == 0) {
    /* Built with -DNISH_ASAN: the range is on, and nothing is reserved. */
    CHECK(nish_arena_range_abi == 1, "the ABI symbol is %d", nish_arena_range_abi);
    CHECK(nish_ref_base == 0, "the ASan build reserved a range at %p", (void *)nish_ref_base);
    uint64_t mark = nish_arena_mark();
    memset(nish_alloc_struct(24), 1, 24);
    memset(nish_alloc_struct(300000), 2, 300000);
    nish_arena_release(mark);
    uint64_t r = nish_region_new();
    nish_region_enter(r);
    void *q = nish_alloc_struct(5000);
    memset(q, 3, 5000);
    nish_region_leave(r, q);
    nish_region_free(r);
    nish_free_arena();
    if (failures) return 1;
    puts("unreserved ok");
    return 0;
  }
  if (strcmp(argv[1], "busy") == 0) {
    puts("reached");
    return 0;
  }
  fprintf(stderr, "unknown mode %s\n", argv[1]);
  return 2;
}
