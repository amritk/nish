/* The agreement test for runtime/runtime-checksum.c's Adler-32 half (WP38 S8):
 * every Adler-32 path the file has for this machine -- SSSE3 on x86-64, NEON
 * on little-endian AArch64 -- answers exactly as std/compress/checksum.ts's
 * loop does, and `nish_adler32_hw` answers what `NISH_ADLER32` and the CPU say
 * it should.
 *
 * The reference is test-only and is that loop: s1 and s2 advanced one byte at a
 * time in 32 bits and reduced every NMAX (5,552) bytes, so an unreduced start
 * such as 0xffffffff gives what the Nish code gives. It is held first to the
 * textbook definition (RFC 1950 §9, both sums reduced after every byte) on
 * reduced starts, to the published check value, Adler-32("123456789") =
 * 0x091e01de, and to the empty input's 1.
 *
 * Then, under a seeded generator, against every path this machine runs:
 * every length 0..4,096 at every offset 0..15 from an aligned block, each from
 * a random 32-bit start, most of them unreduced; the lengths either side of a
 * kernel stretch (5,536 = 173 blocks of 32) and of the loop's (5,552), and of
 * twice each, over random bytes and over all-0xff bytes (the bytes that bring
 * the sums nearest 2^32), from 1, from 0xffffffff and from a random start;
 * inputs of 1 to 16 MiB; and a 4,096-byte input streamed in pieces of 1..16,
 * 31/32/33, 63/64/65 and 127/128/129 bytes, or split once after each of those
 * counts (over 4,096 bytes and over 4,093), which must give the one-call
 * answer. And every length 0..256 ending at the last byte before a page no
 * access is allowed to, and starting at the first byte after one, so a path
 * that reads one byte outside its input faults rather than passing on whatever
 * lay there. That last check is native only: wasm32-wasi has no mmap or page
 * protection to fault with, and no kernel there to over-read, so its build
 * runs every other case on the reference.
 *
 * The runtime file is included rather than linked, as tests/simd/crc32.c does,
 * so the resolver's stored answer can be reset and asked again under each pin.
 *
 *   adler32 [seed]   prints one summary line and exits 0, or names the first
 *                    case a path got wrong and exits 1
 *   adler32 bench    prints each path's throughput at 64 B, 4 KiB, 64 KiB and
 *                    1 MiB, in MB/s, the reference's among them
 */
#define _DEFAULT_SOURCE /* setenv under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifndef __wasi__
#include <sys/mman.h>
#include <unistd.h>
#endif

#include "../../runtime/runtime-checksum.c"

/* ---- The reference --------------------------------------------------------- */

#define BASE 65521u
#define NMAX 5552

/* RFC 1950 §9 as written: both sums reduced after every byte. */
static uint32_t ref_text(uint32_t a, const uint8_t *p, size_t n) {
  uint32_t s1 = a & 0xffff, s2 = a >> 16;
  for (size_t i = 0; i < n; i++) {
    s1 = (s1 + p[i]) % BASE;
    s2 = (s2 + s1) % BASE;
  }
  return (s2 << 16) | s1;
}

/* std/compress/checksum.ts's loop: 32-bit sums, reduced every NMAX bytes, and
   an empty input's start handed back as it came. */
static uint32_t ref(uint32_t a, const uint8_t *p, size_t n) {
  uint32_t s1 = a & 0xffff, s2 = a >> 16;
  size_t i = 0;
  while (i < n) {
    size_t stop = n - i < NMAX ? n : i + NMAX;
    for (; i < stop; i++) {
      s1 += p[i];
      s2 += s1;
    }
    s1 %= BASE;
    s2 %= BASE;
  }
  return (s2 << 16) | s1;
}

/* ---- The paths ------------------------------------------------------------- */

typedef uint32_t (*adler_fn)(uint32_t a, const uint8_t *p, uint64_t n);

typedef struct {
  const char *name;
  adler_fn fn;
} path;

static path paths[3];
static int npaths;

static long cases;

static uint64_t rng_state;

static uint64_t rnd(void) {
  rng_state ^= rng_state << 13;
  rng_state ^= rng_state >> 7;
  rng_state ^= rng_state << 17;
  return rng_state;
}

/* Each kernel as `nish_adler32_update` calls it: an empty window never reaches
   it, and comes back as it went in. */
#if defined(NISH_ADLER32_X86)
static uint32_t ssse3_path(uint32_t a, const uint8_t *p, uint64_t n) {
  return n == 0 ? a : nish_adler32_ssse3(a, p, n);
}
#elif defined(NISH_ADLER32_ARM)
static uint32_t neon_path(uint32_t a, const uint8_t *p, uint64_t n) {
  return n == 0 ? a : nish_adler32_neon(a, p, n);
}
#endif

static int agree(const path *pa, uint32_t a, const uint8_t *p, size_t n, size_t off, const char *what) {
  uint32_t want = ref(a, p, n);
  uint32_t got = pa->fn(a, p, n);
  if (got != want) {
    printf("FAIL %s: %s, length %zu at offset %zu from %08x gave %08x, not %08x\n", pa->name, what, n, off, a, got,
           want);
    return 0;
  }
  cases++;
  return 1;
}

static int vectors(uint8_t *big) {
  static const uint8_t check[] = "123456789";
  if (ref_text(1, check, 9) != 0x091e01deu || ref(1, check, 9) != 0x091e01deu || ref(1, check, 0) != 1 ||
      ref(0xffffffffu, check, 0) != 0xffffffffu) {
    printf("FAIL reference: the check value is not 0x091e01de, or the empty input moves its start\n");
    return 0;
  }
  cases += 4;
  /* The NMAX loop against the textbook on reduced starts, across a reduction. */
  for (size_t len = 0; len <= 12000; len += 997) {
    uint32_t a = (uint32_t)(rnd() % BASE) << 16 | (uint32_t)(rnd() % BASE);
    if (ref(a, big, len) != ref_text(a, big, len)) {
      printf("FAIL reference: length %zu from %08x is not the textbook's\n", len, a);
      return 0;
    }
    cases++;
  }
  for (int i = 0; i < npaths; i++) {
    if (paths[i].fn(1, check, 9) != 0x091e01deu) {
      printf("FAIL %s: Adler-32(\"123456789\") is %08x, not 091e01de\n", paths[i].name, paths[i].fn(1, check, 9));
      return 0;
    }
    if (paths[i].fn(1, check, 0) != 1) {
      printf("FAIL %s: the empty input's Adler-32 is not 1\n", paths[i].name);
      return 0;
    }
    cases += 2;
  }
#if defined(NISH_ADLER32_X86)
  if (nish_adler32_ssse3(0x12345678u, check, 0) != 0x12345678u) {
#elif defined(NISH_ADLER32_ARM)
  if (nish_adler32_neon(0x12345678u, check, 0) != 0x12345678u) {
#else
  if (0) {
#endif
    printf("FAIL kernel: an empty input moves a reduced start\n");
    return 0;
  }
  return 1;
}

static int differential(uint8_t *big, size_t big_len) {
  for (size_t i = 0; i < big_len; i++) big[i] = (uint8_t)rnd();
  static uint8_t ff[3 * NMAX];
  memset(ff, 0xff, sizeof ff);
  static const size_t stretches[] = {5535, 5536, 5537, 5551, 5552, 5553, 11071, 11072, 11073, 11103, 11104, 11105};
  for (int i = 0; i < npaths; i++) {
    for (size_t len = 0; len <= 4096; len++)
      for (size_t off = 0; off < 16; off++)
        if (!agree(&paths[i], (uint32_t)rnd(), big + off, len, off, "a short input")) return 0;
    for (size_t s = 0; s < sizeof stretches / sizeof stretches[0]; s++) {
      const uint32_t starts[] = {1, 0xffffffffu, (uint32_t)rnd()};
      for (size_t k = 0; k < 3; k++)
        for (size_t off = 0; off < 16; off += 3) {
          if (!agree(&paths[i], starts[k], big + off, stretches[s], off, "random bytes across a stretch")) return 0;
          if (!agree(&paths[i], starts[k], ff + off, stretches[s], off, "0xff bytes across a stretch")) return 0;
        }
    }
    static const size_t mib[] = {1, 3, 16};
    for (size_t m = 0; m < sizeof mib / sizeof mib[0]; m++)
      for (size_t off = 0; off < 16; off += 5) {
        size_t len = (mib[m] << 20) - off * 3;
        if (off + len > big_len) len = big_len - off;
        if (!agree(&paths[i], (uint32_t)rnd(), big + off, len, off, "a long input")) return 0;
      }
  }
  return 1;
}

static int streaming(const uint8_t *data) {
  static const size_t pieces[] = {1,  2,  3,  4,  5,  6,  7,  8,  9,   10,  11, 12, 13,
                                  14, 15, 16, 31, 32, 33, 63, 64, 65, 127, 128, 129};
  uint32_t whole = ref(1, data, 4096);
  for (int i = 0; i < npaths; i++)
    for (size_t s = 0; s < sizeof pieces / sizeof pieces[0]; s++) {
      uint32_t a = 1;
      for (size_t at = 0; at < 4096; at += pieces[s])
        a = paths[i].fn(a, data + at, 4096 - at < pieces[s] ? 4096 - at : pieces[s]);
      if (a != whole) {
        printf("FAIL %s: 4,096 bytes in pieces of %zu gave %08x, not %08x\n", paths[i].name, pieces[s], a, whole);
        return 0;
      }
      cases++;
    }
  /* Split once: the first `k` bytes, then the rest from the value they left,
     over 4096 bytes and over 4093, whose length is no multiple of 32. */
  static const size_t totals[] = {4096, 4093};
  for (int i = 0; i < npaths; i++)
    for (size_t t = 0; t < sizeof totals / sizeof totals[0]; t++) {
      uint32_t all = ref(1, data, totals[t]);
      for (size_t s = 0; s < sizeof pieces / sizeof pieces[0]; s++) {
        size_t k = pieces[s];
        uint32_t a = paths[i].fn(paths[i].fn(1, data, k), data + k, totals[t] - k);
        if (a != all) {
          printf("FAIL %s: %zu bytes then %zu gave %08x, not %08x\n", paths[i].name, k, totals[t] - k, a, all);
          return 0;
        }
        cases++;
      }
    }
  return 1;
}

#ifndef __wasi__
static int edges(void) {
  /* Three pages, the outer two PROT_NONE: an input that ends where the middle
     page does and one that starts where it does, so a read past either end
     faults. */
  size_t page = (size_t)sysconf(_SC_PAGESIZE);
  uint8_t *map = mmap(NULL, 3 * page, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (map == MAP_FAILED || mprotect(map, page, PROT_NONE) != 0 || mprotect(map + 2 * page, page, PROT_NONE) != 0) {
    printf("FAIL: no guard pages for the edge cases\n");
    return 0;
  }
  uint8_t *mid = map + page;
  for (size_t i = 0; i < page; i++) mid[i] = (uint8_t)rnd();
  for (int i = 0; i < npaths; i++)
    for (size_t len = 0; len <= 256; len++) {
      if (!agree(&paths[i], (uint32_t)rnd(), mid + page - len, len, page - len, "an input ending at a guard page"))
        return 0;
      if (!agree(&paths[i], (uint32_t)rnd(), mid, len, 0, "an input starting after a guard page")) return 0;
    }
  munmap(map, 3 * page);
  return 1;
}
#else
/* No page to guard: wasm32-wasi has no mmap, and no kernel to over-read. */
static int edges(void) { return 1; }
#endif

/* ---- The resolver ----------------------------------------------------------- */

#if defined(NISH_ADLER32_X86) || defined(NISH_ADLER32_ARM)

static int resolves(const char *pin, int32_t want) {
  if (pin == NULL) {
    unsetenv("NISH_ADLER32");
  } else {
    setenv("NISH_ADLER32", pin, 1);
  }
  __atomic_store_n(&nish_adler32_answer, NISH_ADLER32_UNSET, __ATOMIC_RELAXED);
  int32_t got = nish_adler32_path();
  int hw = nish_adler32_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_ADLER32", want == NISH_ADLER32_SOFT ? "hw" : "soft", 1);
  if (got != want || nish_adler32_path() != want || hw != (want != NISH_ADLER32_SOFT)) {
    printf("FAIL resolver: NISH_ADLER32=%s answered %d, not %d\n", pin ? pin : "<unset>", got, want);
    return 0;
  }
  return 1;
}

/* The runtime's entry itself, through a `nish_array` at an offset, as compiled
   code calls it: the first byte read is data[off], and an empty window hands
   back an unreduced start untouched, as the Nish loop does. */
static int entry(const uint8_t *data) {
  nish_array a = {4096, 4096, (char *)data};
  static const uint32_t starts[] = {1, 0x12345678u, 0xffffffffu};
  for (size_t k = 0; k < 3; k++)
    for (int32_t off = 0; off < 16; off++)
      for (int32_t len = 0; len < 300; len += 7) {
        uint32_t want = ref(starts[k], data + off, (size_t)len);
        uint32_t got = nish_adler32_update(starts[k], &a, off, len);
        if (got != want) {
          printf("FAIL nish_adler32_update: length %d at offset %d from %08x gave %08x, not %08x\n", len, off,
                 starts[k], got, want);
          return 0;
        }
        cases++;
      }
  return 1;
}
#endif

/* ---- The benchmark ---------------------------------------------------------- */

static uint32_t ref_path(uint32_t a, const uint8_t *p, uint64_t n) {
  return ref(a, p, (size_t)n);
}

static double now(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (double)t.tv_sec + (double)t.tv_nsec * 1e-9;
}

static int bench(uint8_t *data) {
  static const size_t sizes[] = {64, 4096, 65536, 1u << 20};
  paths[npaths++] = (path){"the loop (reference)", ref_path};
  volatile uint32_t sink = 0;
  for (int i = 0; i < npaths; i++)
    for (size_t s = 0; s < sizeof sizes / sizeof sizes[0]; s++) {
      size_t reps = (256u << 20) / sizes[s];
      if (i == npaths - 1) reps /= 8;
      double t0 = now();
      uint32_t a = 1;
      for (size_t r = 0; r < reps; r++) a = paths[i].fn(a, data, sizes[s]);
      double t = now() - t0;
      sink ^= a;
      printf("adler32 bench: %-28s %8zu B  %9.1f MB/s\n", paths[i].name, sizes[s],
             (double)reps * (double)sizes[s] / t / 1e6);
    }
  (void)sink;
  return 0;
}

int main(int argc, char **argv) {
  int benching = argc > 1 && strcmp(argv[1], "bench") == 0;
  uint64_t seed = argc > 1 && !benching ? strtoull(argv[1], NULL, 10) : 20261111;
  rng_state = seed | 1;

  const char *summary;
  /* What the run proved of the resolver: every pin, or, with no kernel, that it says so. */
  const char *resolver = "the resolver picks every pin";
#if defined(NISH_ADLER32_X86) || defined(NISH_ADLER32_ARM)
  int32_t cpu = nish_adler32_cpu();
#endif
#if defined(NISH_ADLER32_X86)
  /* The runtime's detector against libgcc's: a detector that wrongly answered
     no would otherwise drop the kernel from this run without a failure. */
  __builtin_cpu_init();
  int libgcc = __builtin_cpu_supports("ssse3");
  if ((cpu == NISH_ADLER32_KERNEL) != libgcc) {
    printf("FAIL detector: nish_adler32_cpu says %d, __builtin_cpu_supports says %d\n", cpu, libgcc);
    return 1;
  }
  if (cpu == NISH_ADLER32_KERNEL) paths[npaths++] = (path){"ssse3", ssse3_path};
  summary = cpu == NISH_ADLER32_KERNEL ? "ssse3" : "the reference alone (ssse3 SKIPPED: this CPU has no SSSE3)";
#elif defined(NISH_ADLER32_ARM)
  paths[npaths++] = (path){"neon", neon_path};
  summary = "neon";
#else
  summary = "the reference alone (this target has no kernel)";
  resolver = "the resolver says there is no kernel";
#endif

  size_t big_len = (16u << 20) + 64;
  uint8_t *big = malloc(big_len);
  if (big == NULL) {
    printf("FAIL: no memory for the corpus\n");
    return 1;
  }
  for (size_t i = 0; i < big_len; i++) big[i] = (uint8_t)rnd();
  if (benching) return bench(big);

  if (!vectors(big) || !differential(big, big_len) || !streaming(big) || !edges()) return 1;
#if defined(NISH_ADLER32_X86) || defined(NISH_ADLER32_ARM)
  /* The pin, and the best this machine has for no pin, `hw`, and a value it
     does not know. */
  if (!resolves("soft", NISH_ADLER32_SOFT) || !resolves(NULL, cpu) || !resolves("hw", cpu) ||
      !resolves("softer", cpu))
    return 1;
  if (cpu != NISH_ADLER32_SOFT) {
    __atomic_store_n(&nish_adler32_answer, NISH_ADLER32_UNSET, __ATOMIC_RELAXED);
    unsetenv("NISH_ADLER32");
    if (!entry(big)) return 1;
  }
#else
  if (nish_adler32_hw() != 0) {
    printf("FAIL resolver: a target with no kernel says it has one\n");
    return 1;
  }
#endif
  free(big);

  printf("adler32: %ld cases agree across %s; %s\n", cases, summary, resolver);
  return 0;
}
