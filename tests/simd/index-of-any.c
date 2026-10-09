/* The agreement test for runtime/runtime-simd.c's `nish_str_index_of_any`
 * (WP38 S1): every path the file has for this machine -- scalar, base and,
 * when the CPU has it, AVX2 -- answers a seeded, fuzzed corpus exactly as a
 * plain reference loop does, and the resolver picks the path `NISH_SIMD` and
 * the CPU say it should.
 *
 * The runtime file is included rather than linked, because the paths are
 * `static`: calling each one directly is the only way to know that the one
 * this host would never pick on its own still answers right. tests/run.js
 * builds this natively, for wasm32-wasi with and without `-msimd128` when a
 * WASI sysroot is installed, and as a static AArch64 binary when the host can
 * run one (binfmt_misc and qemu-user), so the NEON and simd128 base paths run
 * too. By hand: `qemu-aarch64 <binary>` runs the AArch64 build anywhere.
 *
 *   index-of-any [seed]   prints one summary line and exits 0, or names the
 *                         first case a path got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv and MAP_ANONYMOUS under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-simd.c"

#if !defined(__wasi__)
#include <sys/mman.h>
#include <unistd.h>
#endif

static uint64_t rng_state;

/* xorshift64*: the corpus is a function of the seed, so a failure printed with
   its seed is a failure anyone can rerun. */
static uint64_t rnd(void) {
  rng_state ^= rng_state >> 12;
  rng_state ^= rng_state << 25;
  rng_state ^= rng_state >> 27;
  return rng_state * 2685821657736338717ull;
}

static int64_t reference(const nish_str *s, const nish_str *set, int64_t from) {
  for (uint64_t i = (uint64_t)from; i < s->len; i++)
    for (uint64_t k = 0; k < set->len; k++)
      if (s->data[i] == set->data[k]) return (int64_t)i;
  return -1;
}

/* A haystack's header, placed so that its terminating NUL is within eight
   bytes of an unmapped page: a path that loads a vector past the end of the
   string faults here instead of reading whatever follows it and passing. The
   header stays eight-byte aligned, so as the length runs over 0..300 the data
   starts at every eight-byte offset of a 32-byte vector, and `from` covers
   the offsets between. WASI has no mmap, so there it is a plain buffer. */
#define HAY_MAX 300
#if !defined(__wasi__)
static unsigned char *hay_end;
#endif

static nish_str *place(const unsigned char *bytes, uint64_t len) {
#if !defined(__wasi__)
  uintptr_t at = ((uintptr_t)hay_end - (uintptr_t)len - 1 - sizeof(nish_str)) & ~(uintptr_t)7;
  nish_str *s = (nish_str *)at;
#else
  static _Alignas(64) unsigned char buf[sizeof(nish_str) + HAY_MAX + 1];
  nish_str *s = (nish_str *)buf;
#endif
  s->len = len;
  memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

/* A string in eight-byte-aligned storage the caller owns: header, bytes and
   NUL, as the arena lays one out. */
static nish_str *str_in(uint64_t *store, const char *bytes, uint64_t len) {
  nish_str *s = (nish_str *)store;
  s->len = len;
  memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

typedef struct {
  const char *name;
  nish_any_path fn;
} path_t;

static path_t paths[3];
static int npaths;
static long cases;

static int check(const nish_str *s, const nish_str *set, int64_t from, uint64_t seed) {
  int64_t want = reference(s, set, from);
  for (int p = 0; p < npaths; p++) {
    int64_t got = paths[p].fn(s, set, from);
    if (got != want) {
      printf("FAIL seed %llu: path %s answered %lld, the reference %lld (len %llu, set %llu bytes, from %lld)\n",
             (unsigned long long)seed, paths[p].name, (long long)got, (long long)want, (unsigned long long)s->len,
             (unsigned long long)set->len, (long long)from);
      printf("  set:");
      for (uint64_t k = 0; k < set->len; k++) printf(" %02x", (unsigned char)set->data[k]);
      printf("\n");
      return 0;
    }
  }
  cases++;
  return 1;
}

/* The resolver, once per pin: reset the pointer to it, make one call, and see
   which path it stored and that the call it forwarded answered right. */
static int resolves(const char *pin, nish_any_path want, const char *want_name) {
  if (pin == NULL) {
    unsetenv("NISH_SIMD");
  } else {
    setenv("NISH_SIMD", pin, 1);
  }
  __atomic_store_n(&nish_any, nish_any_resolve, __ATOMIC_RELAXED);
  uint64_t hay_store[6], set_store[2];
  nish_str *hay = str_in(hay_store, "abcdefghijklmnopqrstuvwxyzabcdef\"x", 34);
  nish_str *set = str_in(set_store, "\"\\", 2);
  int64_t at = nish_str_index_of_any(hay, set, 0);
  nish_any_path got = __atomic_load_n(&nish_any, __ATOMIC_RELAXED);
  if (got != want || at != 32 || nish_str_index_of_any(hay, set, 33) != -1) {
    printf("FAIL resolver: NISH_SIMD=%s did not pick %s (answered %lld)\n", pin ? pin : "<unset>", want_name,
           (long long)at);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261009;
  rng_state = seed | 1;

#if !defined(__wasi__)
  size_t page = (size_t)sysconf(_SC_PAGESIZE);
  unsigned char *map = mmap(NULL, page * 2, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (map == MAP_FAILED || mprotect(map + page, page, PROT_NONE) != 0) {
    perror("index-of-any: mmap");
    return 1;
  }
  hay_end = map + page;
#endif

  paths[npaths++] = (path_t){"scalar", nish_any_scalar};
#if defined(NISH_SIMD_SSE2) || defined(NISH_SIMD_NEON) || defined(NISH_SIMD_WASM)
  paths[npaths++] = (path_t){"base", nish_any_base};
  const char *base_name = "base";
#else
  const char *base_name = "base (the scalar path on this target)";
#endif
  const char *avx2_note;
  nish_any_path best = nish_any_base;
#if defined(NISH_SIMD_SSE2)
  /* The runtime's detector against libgcc's, which the runtime avoids only
     for its start-up constructor (runtime-simd.c, `nish_cpu_has_avx2`) and
     which costs nothing here. A detector that wrongly answered no would
     otherwise drop the AVX2 path from this run without a failure. */
  __builtin_cpu_init();
  if (nish_cpu_has_avx2() != (__builtin_cpu_supports("avx2") != 0)) {
    printf("FAIL detector: nish_cpu_has_avx2 says %d, __builtin_cpu_supports(\"avx2\") says %d\n",
           nish_cpu_has_avx2(), __builtin_cpu_supports("avx2") != 0);
    return 1;
  }
  if (nish_cpu_has_avx2()) {
    paths[npaths++] = (path_t){"avx2", nish_any_avx2};
    best = nish_any_avx2;
    avx2_note = NULL;
  } else {
    avx2_note = "avx2 SKIPPED: this CPU has no AVX2";
  }
#else
  avx2_note = "avx2 not built: not an x86 target";
#endif

  unsigned char bytes[HAY_MAX + 1];
  uint64_t set_store[6]; /* room for the 32-byte sets the fuzzer also asks about */
  nish_str *set = str_in(set_store, "\"\\", 2);

  /* One match planted at every position of every length, searched from every
     start up to two AVX2 blocks before it and one past it: the exhaustive
     half. The set is a quote and a backslash, as std/json's strings ask. */
  for (uint64_t len = 0; len <= HAY_MAX; len++) {
    for (uint64_t at = 0; at <= len; at++) {
      for (uint64_t j = 0; j < len; j++) bytes[j] = (unsigned char)('a' + j % 26);
      if (at < len) bytes[at] = (at & 1) ? '\\' : '"';
      nish_str *s = place(bytes, len);
      int64_t first = at > 64 ? (int64_t)(at - 64) : 0;
      for (int64_t from = first; from <= (int64_t)len && from <= (int64_t)at + 1; from++)
        if (!check(s, set, from, seed)) return 1;
    }
  }

  /* The fuzzed half: random lengths, sets of 1..16 bytes that favour 0x00 and
     bytes at or above 0x80 (where a signed compare would go wrong), haystacks
     made of the set's near misses -- a member with one bit flipped -- with a
     few true members planted, and one set in thirty-two outside 1..16, empty
     or up to 32 bytes, which every vector path hands to the scalar one. */
  for (int trial = 0; trial < 200000; trial++) {
    uint64_t len = rnd() % (HAY_MAX + 1);
    uint64_t r = rnd() % 64;
    uint64_t k = r == 0 ? 0 : r == 1 ? 17 + rnd() % 16 : 1 + rnd() % 16;
    for (uint64_t j = 0; j < k; j++) {
      uint64_t pick = rnd() % 8;
      set->data[j] = (char)(pick == 0 ? 0x00 : pick < 3 ? (0x80 | rnd()) : rnd());
    }
    set->len = k;
    for (uint64_t j = 0; j < len; j++)
      bytes[j] = k ? (unsigned char)(set->data[rnd() % k] ^ (1u << (rnd() % 8))) : (unsigned char)rnd();
    uint64_t plants = rnd() % 4;
    for (uint64_t p = 0; p < plants && len > 0 && k > 0; p++) bytes[rnd() % len] = (unsigned char)set->data[rnd() % k];
    nish_str *s = place(bytes, len);
    if (!check(s, set, (int64_t)(rnd() % (len + 1)), seed) || !check(s, set, 0, seed)) return 1;
  }

  /* The resolver: each pin, and the best path for no pin, `avx2` (which a
     machine without it answers with the base path rather than a fault) and a
     value it does not know. */
  if (!resolves("scalar", nish_any_scalar, "scalar") || !resolves("base", nish_any_base, base_name) ||
      !resolves(NULL, best, "the best path") || !resolves("avx2", best, "the best path") ||
      !resolves("sse9", best, "the best path"))
    return 1;

  printf("index-of-any: %ld cases agree across", cases);
  for (int p = 0; p < npaths; p++) printf(" %s", paths[p].name);
  printf("%s%s; the resolver picks every pin\n", avx2_note ? "; " : "", avx2_note ? avx2_note : "");
  return 0;
}
