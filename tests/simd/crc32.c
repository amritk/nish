/* The agreement test for runtime/runtime-checksum.c (WP38 §3.1): every CRC-32
 * path the file has for this machine -- PCLMULQDQ folding on x86-64; the ARMv8
 * CRC32 instructions, and PMULL folding in front of them, on AArch64 -- answers
 * exactly as a textbook reference does, and `nish_crc32_hw` answers what
 * `NISH_CRC32` and the CPU say it should.
 *
 * The reference is test-only: the register advanced one bit at a time by the
 * reflected polynomial (RFC 1952 §8), and a byte table built from it for the
 * long inputs, the table first held to the bit loop on every byte. It is held
 * to the published check value, CRC-32("123456789") = 0xCBF43926, and to the
 * empty input's 0. The fold constants are computed again from P, each as the
 * header comment of runtime-checksum.c defines it, and held to the file's.
 *
 * Then, under a seeded generator, against every path this machine runs:
 * every length 0..4,096 at every offset 0..15 from an aligned block, each from
 * a random register; inputs of 1 to 16 MiB; and a 4,096-byte input streamed in
 * pieces of 1..16, 63/64/65 and 127/128/129 bytes, which must give the
 * one-call answer. And every length 0..256 ending at the last byte before a
 * page no access is allowed to, so a path that reads one byte past its input
 * faults rather than passing on whatever lay there. That last check is native
 * only: wasm32-wasi has no mmap or page protection to fault with, and no kernel
 * there to over-read, so its build runs every other case on the reference.
 *
 * The runtime file is included rather than linked, as tests/simd/aes-gcm.c
 * includes runtime-aes.c, so the resolver's stored answer can be reset and
 * asked again under each pin.
 *
 *   crc32 [seed]   prints one summary line and exits 0, or names the first
 *                  case a path got wrong and exits 1
 *   crc32 bench    prints each path's throughput at 64 B, 4 KiB, 64 KiB and
 *                  1 MiB, in MB/s, the table reference's among them
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

#define POLY 0xedb88320u /* P bit-reflected, without its x^32 */

/* The register (not inverted) advanced over p[0..n), one bit at a time. */
static uint32_t ref_bits(uint32_t c, const uint8_t *p, size_t n) {
  for (size_t i = 0; i < n; i++) {
    c ^= p[i];
    for (int b = 0; b < 8; b++) c = (c >> 1) ^ (POLY & (0u - (c & 1)));
  }
  return c;
}

static uint32_t table[256];

static uint32_t ref(uint32_t c, const uint8_t *p, size_t n) {
  for (size_t i = 0; i < n; i++) c = (c >> 8) ^ table[(c ^ p[i]) & 0xff];
  return c;
}

/* ---- The paths ------------------------------------------------------------- */

typedef uint32_t (*crc_fn)(uint32_t c, const uint8_t *p, uint64_t n);

typedef struct {
  const char *name;
  crc_fn fn;
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

static int agree(const path *pa, uint32_t c, const uint8_t *p, size_t n, size_t off, const char *what) {
  uint32_t want = ref(c, p, n);
  uint32_t got = pa->fn(c, p, n);
  if (got != want) {
    printf("FAIL %s: %s, length %zu at offset %zu from register %08x gave %08x, not %08x\n", pa->name, what, n, off,
           c, got, want);
    return 0;
  }
  cases++;
  return 1;
}

#if defined(NISH_CRC32_X86) || defined(NISH_CRC32_ARM)
/* x^e mod P in the normal bit order, a polynomial of degree below 32. */
static uint32_t xpow_mod(int e) {
  uint32_t r = 1;
  for (int i = 0; i < e; i++) r = (r << 1) ^ (r & 0x80000000u ? 0x04c11db7u : 0);
  return r;
}

static uint64_t reflect(uint64_t v, int bits) {
  uint64_t r = 0;
  for (int i = 0; i < bits; i++) r |= ((v >> i) & 1) << (bits - 1 - i);
  return r;
}

/* floor(x^64 / P), a polynomial of degree 32, by long division. */
static uint64_t barrett_mu(void) {
  const unsigned __int128 p = 0x104c11db7ull;
  unsigned __int128 rem = (unsigned __int128)1 << 64;
  uint64_t q = 0;
  for (int d = 64; d >= 32; d--)
    if ((rem >> d) & 1) {
      rem ^= p << (d - 32);
      q |= 1ull << (d - 32);
    }
  return q;
}

static int constants(void) {
  const struct {
    const char *name;
    uint64_t file, want;
  } k[] = {
      {"K1", NISH_CRC32_K1, reflect(xpow_mod(512 + 32), 32) << 1},
      {"K2", NISH_CRC32_K2, reflect(xpow_mod(512 - 32), 32) << 1},
      {"K3", NISH_CRC32_K3, reflect(xpow_mod(128 + 32), 32) << 1},
      {"K4", NISH_CRC32_K4, reflect(xpow_mod(128 - 32), 32) << 1},
      {"K5", NISH_CRC32_K5, reflect(xpow_mod(64), 32) << 1},
      {"P", NISH_CRC32_P, reflect(0x104c11db7ull, 33)},
      {"U", NISH_CRC32_U, reflect(barrett_mu(), 33)},
  };
  for (size_t i = 0; i < sizeof k / sizeof k[0]; i++)
    if (k[i].file != k[i].want) {
      printf("FAIL constants: %s is %09llx in runtime-checksum.c, but computes to %09llx\n", k[i].name,
             (unsigned long long)k[i].file, (unsigned long long)k[i].want);
      return 0;
    }
  return 1;
}
#else
/* No kernel, so no constants to hold to anything. */
static int constants(void) {
  return 1;
}
#endif

static int vectors(void) {
  for (int b = 0; b < 256; b++) {
    uint8_t byte = (uint8_t)b;
    table[b] = ref_bits(0, &byte, 1);
  }
  static const uint8_t check[] = "123456789";
  if (~ref_bits(~0u, check, 9) != 0xcbf43926u || ~ref(~0u, check, 9) != 0xcbf43926u) {
    printf("FAIL reference: the check value is not 0xcbf43926\n");
    return 0;
  }
  cases += 2;
  for (int i = 0; i < npaths; i++) {
    if (~paths[i].fn(~0u, check, 9) != 0xcbf43926u) {
      printf("FAIL %s: CRC-32(\"123456789\") is %08x, not cbf43926\n", paths[i].name, ~paths[i].fn(~0u, check, 9));
      return 0;
    }
    if (~paths[i].fn(~0u, check, 0) != 0) {
      printf("FAIL %s: the empty input's CRC-32 is not 0\n", paths[i].name);
      return 0;
    }
    cases += 2;
  }
  return 1;
}

static int differential(uint8_t *big, size_t big_len) {
  for (size_t i = 0; i < big_len; i++) big[i] = (uint8_t)rnd();
  for (int i = 0; i < npaths; i++) {
    for (size_t len = 0; len <= 4096; len++)
      for (size_t off = 0; off < 16; off++)
        if (!agree(&paths[i], (uint32_t)rnd(), big + off, len, off, "a short input")) return 0;
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
  static const size_t pieces[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 63, 64, 65, 127, 128, 129};
  uint32_t whole = ~ref(~0u, data, 4096);
  for (int i = 0; i < npaths; i++)
    for (size_t s = 0; s < sizeof pieces / sizeof pieces[0]; s++) {
      uint32_t c = ~0u;
      for (size_t at = 0; at < 4096; at += pieces[s])
        c = paths[i].fn(c, data + at, 4096 - at < pieces[s] ? 4096 - at : pieces[s]);
      if (~c != whole) {
        printf("FAIL %s: 4,096 bytes in pieces of %zu gave %08x, not %08x\n", paths[i].name, pieces[s], ~c, whole);
        return 0;
      }
      cases++;
    }
  return 1;
}

#ifndef __wasi__
static int edges(void) {
  size_t page = (size_t)sysconf(_SC_PAGESIZE);
  uint8_t *map = mmap(NULL, 2 * page, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (map == MAP_FAILED || mprotect(map + page, page, PROT_NONE) != 0) {
    printf("FAIL: no guard page for the edge cases\n");
    return 0;
  }
  for (size_t i = 0; i < page; i++) map[i] = (uint8_t)rnd();
  for (int i = 0; i < npaths; i++)
    for (size_t len = 0; len <= 256; len++)
      if (!agree(&paths[i], (uint32_t)rnd(), map + page - len, len, page - len, "an input ending at a guard page"))
        return 0;
  munmap(map, 2 * page);
  return 1;
}
#else
/* No page to guard: wasm32-wasi has no mmap, and no kernel to over-read. */
static int edges(void) { return 1; }
#endif

/* ---- The resolver ----------------------------------------------------------- */

#if defined(NISH_CRC32_X86) || defined(NISH_CRC32_ARM)

static int resolves(const char *pin, int32_t want) {
  if (pin == NULL) {
    unsetenv("NISH_CRC32");
  } else {
    setenv("NISH_CRC32", pin, 1);
  }
  __atomic_store_n(&nish_crc32_answer, NISH_CRC32_UNSET, __ATOMIC_RELAXED);
  int32_t got = nish_crc32_path();
  int hw = nish_crc32_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_CRC32", want == NISH_CRC32_SOFT ? "hw" : "soft", 1);
  if (got != want || nish_crc32_path() != want || hw != (want != NISH_CRC32_SOFT)) {
    printf("FAIL resolver: NISH_CRC32=%s answered %d, not %d\n", pin ? pin : "<unset>", got, want);
    return 0;
  }
  return 1;
}

/* The runtime's entry itself, through a `nish_array` at an offset, as compiled
   code calls it: the first byte read is data[off], the register is the
   finished (inverted) CRC in and out. */
static int entry(const uint8_t *data) {
  nish_array a = {4096, 4096, (char *)data};
  for (int32_t off = 0; off < 16; off++)
    for (int32_t len = 0; len < 300; len += 7) {
      uint32_t want = ~ref(~0x12345678u, data + off, (size_t)len);
      uint32_t got = nish_crc32_update(0x12345678u, &a, off, len);
      if (got != want) {
        printf("FAIL nish_crc32_update: length %d at offset %d gave %08x, not %08x\n", len, off, got, want);
        return 0;
      }
      cases++;
    }
  return 1;
}
#endif

/* ---- The benchmark ---------------------------------------------------------- */

static uint32_t ref_path(uint32_t c, const uint8_t *p, uint64_t n) {
  return ref(c, p, (size_t)n);
}

static double now(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (double)t.tv_sec + (double)t.tv_nsec * 1e-9;
}

static int bench(uint8_t *data) {
  static const size_t sizes[] = {64, 4096, 65536, 1u << 20};
  paths[npaths++] = (path){"table (reference)", ref_path};
  volatile uint32_t sink = 0;
  for (int i = 0; i < npaths; i++)
    for (size_t s = 0; s < sizeof sizes / sizeof sizes[0]; s++) {
      size_t reps = (256u << 20) / sizes[s];
      if (i == npaths - 1) reps /= 8;
      double t0 = now();
      uint32_t c = 0;
      for (size_t r = 0; r < reps; r++) c = paths[i].fn(c, data, sizes[s]);
      double t = now() - t0;
      sink ^= c;
      printf("crc32 bench: %-28s %8zu B  %9.1f MB/s\n", paths[i].name, sizes[s],
             (double)reps * (double)sizes[s] / t / 1e6);
    }
  (void)sink;
  return 0;
}

int main(int argc, char **argv) {
  int benching = argc > 1 && strcmp(argv[1], "bench") == 0;
  uint64_t seed = argc > 1 && !benching ? strtoull(argv[1], NULL, 10) : 20261030;
  rng_state = seed | 1;

  const char *summary;
#if defined(NISH_CRC32_X86) || defined(NISH_CRC32_ARM)
  int32_t cpu = nish_crc32_cpu();
#endif
#if defined(NISH_CRC32_X86)
  /* The runtime's detector against libgcc's: a detector that wrongly answered
     no would otherwise drop the kernel from this run without a failure. */
  __builtin_cpu_init();
  int libgcc = __builtin_cpu_supports("pclmul") && __builtin_cpu_supports("sse4.1");
  if ((cpu == NISH_CRC32_KERNEL) != libgcc) {
    printf("FAIL detector: nish_crc32_cpu says %d, __builtin_cpu_supports says %d\n", cpu, libgcc);
    return 1;
  }
  if (cpu == NISH_CRC32_KERNEL) paths[npaths++] = (path){"pclmul", nish_crc32_clmul};
  /* The bytes the folds leave over run this loop, so it is a path of its own. */
  paths[npaths++] = (path){"pclmul's byte tail", nish_crc32_bytes};
  summary = cpu == NISH_CRC32_KERNEL ? "pclmul"
                                     : "the byte tail alone (pclmul SKIPPED: this CPU has no PCLMULQDQ and SSE4.1)";
#elif defined(NISH_CRC32_ARM)
  if (cpu != NISH_CRC32_SOFT) paths[npaths++] = (path){"armv8-crc32", nish_crc32_arm};
  if (cpu == NISH_CRC32_PMULL) paths[npaths++] = (path){"armv8-pmull", nish_crc32_pmull};
  summary = cpu == NISH_CRC32_PMULL ? "armv8-crc32 and armv8-pmull"
            : cpu == NISH_CRC32_KERNEL
                ? "armv8-crc32 (armv8-pmull SKIPPED: this CPU reports no PMULL)"
                : "the reference alone (armv8-crc32 SKIPPED: this CPU reports no CRC32 instructions)";
#else
  summary = "the reference alone (this target has no kernel)";
#endif

  size_t big_len = (16u << 20) + 64;
  uint8_t *big = malloc(big_len);
  if (big == NULL) {
    printf("FAIL: no memory for the corpus\n");
    return 1;
  }
  if (benching) {
    for (size_t i = 0; i < big_len; i++) big[i] = (uint8_t)rnd();
    return bench(big);
  }

  if (!constants() || !vectors() || !differential(big, big_len) || !streaming(big) || !edges()) return 1;
#if defined(NISH_CRC32_X86) || defined(NISH_CRC32_ARM)
  /* The pin, and the best this machine has for no pin, `hw`, and a value it
     does not know. */
  if (!resolves("soft", NISH_CRC32_SOFT) || !resolves(NULL, cpu) || !resolves("hw", cpu) ||
      !resolves("softer", cpu))
    return 1;
  if (cpu != NISH_CRC32_SOFT) {
    __atomic_store_n(&nish_crc32_answer, NISH_CRC32_UNSET, __ATOMIC_RELAXED);
    unsetenv("NISH_CRC32");
    if (!entry(big)) return 1;
  }
#else
  if (nish_crc32_hw() != 0) {
    printf("FAIL resolver: a target with no kernel says it has one\n");
    return 1;
  }
#endif
  free(big);

  printf("crc32: %ld cases agree across %s; the resolver picks every pin\n", cases, summary);
  return 0;
}
