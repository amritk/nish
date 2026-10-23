/* The agreement test for runtime/runtime-simd.c's `nish_regex_scan`, the
 * search `nish/regex` starts its matches with: every path the file has for
 * this machine -- scalar, base and, when the CPU has it, AVX2 -- answers a
 * seeded corpus exactly as a plain reference loop does, and the resolver
 * picks the path `NISH_SIMD` and the CPU say it should.
 *
 * Built and run the way tests/simd/index-of-any.c is, and for the same
 * reason: the paths are `static`, so the file is included and each path is
 * called directly. tests/run.js runs it natively, for wasm32-wasi with and
 * without `-msimd128`, and as a static AArch64 binary where the host can run
 * one.
 *
 *   regex-scan [seed]   prints one summary line and exits 0, or names the
 *                       first case a path got wrong and exits 1
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

/* xorshift64*, as index-of-any.c's: a failure printed with its seed reruns. */
static uint64_t rnd(void) {
  rng_state ^= rng_state >> 12;
  rng_state ^= rng_state << 25;
  rng_state ^= rng_state >> 27;
  return rng_state * 2685821657736338717ull;
}

#define DEPTH_MAX 8
#define HAY_MAX 300

/* The sets as the caller means them, one 256-entry table a position, and the
   288-byte-a-position `masks` std/regex.ts builds from them. */
static unsigned char member[DEPTH_MAX][256];
static unsigned char mask_bytes[288 * DEPTH_MAX];
static nish_array masks = {0, 0, (char *)mask_bytes};

/* Write `depth` positions' sets in both of nish.h's forms. */
static void pack(uint64_t depth) {
  memset(mask_bytes, 0, sizeof mask_bytes);
  for (uint64_t j = 0; j < depth; j++)
    for (unsigned b = 0; b < 256; b++)
      if (member[j][b]) {
        mask_bytes[32 * j + ((b >> 7) << 4) + (b & 15)] |= (unsigned char)(1u << ((b >> 4) & 7));
        mask_bytes[32 * depth + 256 * j + b] = 1;
      }
  masks.len = masks.cap = 288 * depth;
}

static int64_t reference(const nish_str *s, uint64_t depth, int64_t from) {
  for (uint64_t i = (uint64_t)from; i + depth <= s->len; i++) {
    uint64_t j = 0;
    while (j < depth && member[j][(unsigned char)s->data[i + j]]) j++;
    if (j == depth) return (int64_t)i;
  }
  return -1;
}

/* A haystack whose NUL is within eight bytes of an unmapped page, so a path
   that loads past the string faults; see index-of-any.c. */
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

typedef struct {
  const char *name;
  nish_scan_path fn;
} path_t;

static path_t paths[3];
static int npaths;
static long cases;

static int check(const nish_str *s, uint64_t depth, uint64_t off, uint64_t width, int64_t from, uint64_t seed) {
  int64_t want = reference(s, depth, from);
  for (int p = 0; p < npaths; p++) {
    int64_t got = paths[p].fn(s, &masks, (int64_t)depth, (int64_t)off, (int64_t)width, from);
    if (got != want) {
      printf("FAIL seed %llu: path %s answered %lld, the reference %lld (len %llu, depth %llu, off %llu, width %llu, "
             "from %lld)\n",
             (unsigned long long)seed, paths[p].name, (long long)got, (long long)want, (unsigned long long)s->len,
             (unsigned long long)depth, (unsigned long long)off, (unsigned long long)width, (long long)from);
      return 0;
    }
  }
  cases++;
  return 1;
}

/* One position's set: one byte, a handful, a range such as `[A-Z]`, or most
   of the 256, with the bytes at and above 0x80 favoured. */
static void random_set(unsigned char *set) {
  memset(set, 0, 256);
  uint64_t kind = rnd() % 4;
  if (kind == 0) {
    set[rnd() % 8 == 0 ? 0x80 | rnd() % 128 : rnd() % 256] = 1;
  } else if (kind == 1) {
    for (uint64_t k = 1 + rnd() % 8; k > 0; k--) set[rnd() % 4 == 0 ? 0x80 | rnd() % 128 : rnd() % 256] = 1;
  } else if (kind == 2) {
    uint64_t lo = rnd() % 256, n = 1 + rnd() % 40;
    for (uint64_t b = lo; b < lo + n && b < 256; b++) set[b] = 1;
  } else {
    for (unsigned b = 0; b < 256; b++) set[b] = rnd() % 8 != 0;
  }
}

/* A byte of position `j`'s set, or of none of it when the set is full. */
static unsigned char some_member(uint64_t j) {
  for (int tries = 0; tries < 512; tries++) {
    unsigned b = (unsigned)(rnd() % 256);
    if (member[j][b]) return (unsigned char)b;
  }
  return 0;
}

static int resolves(const char *pin, nish_scan_path want, const char *want_name) {
  if (pin == NULL) {
    unsetenv("NISH_SIMD");
  } else {
    setenv("NISH_SIMD", pin, 1);
  }
  __atomic_store_n(&nish_scan, nish_scan_resolve, __ATOMIC_RELAXED);
  /* `ab` from position 0, a 32-byte block and the tail after it. */
  memset(member, 0, sizeof member);
  member[0]['a'] = 1;
  member[1]['b'] = 1;
  pack(2);
  uint64_t store[8];
  nish_str *hay = (nish_str *)store;
  hay->len = 40;
  memset(hay->data, 'x', 40);
  memcpy(hay->data + 34, "ab", 2);
  hay->data[40] = 0;
  int64_t at = nish_regex_scan(hay, &masks, 2, 0, 2, 0);
  nish_scan_path got = __atomic_load_n(&nish_scan, __ATOMIC_RELAXED);
  if (got != want || at != 34 || nish_regex_scan(hay, &masks, 2, 0, 2, 35) != -1) {
    printf("FAIL resolver: NISH_SIMD=%s did not pick %s (answered %lld)\n", pin ? pin : "<unset>", want_name,
           (long long)at);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261023;
  rng_state = seed | 1;

#if !defined(__wasi__)
  size_t page = (size_t)sysconf(_SC_PAGESIZE);
  unsigned char *map = mmap(NULL, page * 2, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (map == MAP_FAILED || mprotect(map + page, page, PROT_NONE) != 0) {
    perror("regex-scan: mmap");
    return 1;
  }
  hay_end = map + page;
#endif

  paths[npaths++] = (path_t){"scalar", nish_scan_scalar};
#if defined(NISH_SIMD_NEON) || defined(NISH_SIMD_WASM)
  paths[npaths++] = (path_t){"base", nish_scan_base};
  const char *base_name = "base";
#else
  const char *base_name = "base (the scalar path on this target)";
#endif
  const char *avx2_note;
  nish_scan_path best = nish_scan_base;
#if defined(NISH_SIMD_SSE2)
  if (nish_cpu_has_avx2()) {
    paths[npaths++] = (path_t){"avx2", nish_scan_avx2};
    best = nish_scan_avx2;
    avx2_note = NULL;
  } else {
    avx2_note = "avx2 SKIPPED: this CPU has no AVX2";
  }
#else
  avx2_note = "avx2 not built: not an x86 target";
#endif

  unsigned char bytes[HAY_MAX + 1];

  /* `conta` planted once at every position of every length, with every
     window the caller can pick, searched from up to two AVX2 blocks before it
     and one past it: the exhaustive half. */
  memset(member, 0, sizeof member);
  for (int j = 0; j < 5; j++) member[j][(unsigned char)"conta"[j]] = 1;
  pack(5);
  for (uint64_t len = 0; len <= HAY_MAX; len++) {
    for (uint64_t at = 0; at <= len; at++) {
      for (uint64_t j = 0; j < len; j++) bytes[j] = (unsigned char)"contbcoa"[j % 8];
      if (at + 5 <= len) memcpy(bytes + at, "conta", 5);
      nish_str *s = place(bytes, len);
      int64_t first = at > 64 ? (int64_t)(at - 64) : 0;
      for (int64_t from = first; from <= (int64_t)len && from <= (int64_t)at + 1; from++) {
        uint64_t width = 1 + (uint64_t)from % 4, off = (uint64_t)from % (5 - width + 1);
        if (!check(s, 5, off, width, from, seed)) return 1;
      }
    }
  }

  /* The fuzzed half: 1..8 positions of random sets, a window anywhere in
     them, haystacks of each position's members and near misses -- a member
     with one bit flipped -- and a few whole matches planted. */
  for (int trial = 0; trial < 200000; trial++) {
    uint64_t depth = 1 + rnd() % DEPTH_MAX;
    uint64_t width = 1 + rnd() % (depth < 4 ? depth : 4);
    uint64_t off = rnd() % (depth - width + 1);
    for (uint64_t j = 0; j < depth; j++) random_set(member[j]);
    pack(depth);
    uint64_t len = rnd() % (HAY_MAX + 1);
    for (uint64_t i = 0; i < len; i++) {
      unsigned char b = some_member(i % depth);
      bytes[i] = rnd() % 3 == 0 ? (unsigned char)(b ^ (1u << (rnd() % 8))) : b;
    }
    uint64_t plants = rnd() % 3;
    for (uint64_t p = 0; p < plants && len >= depth; p++) {
      uint64_t at = rnd() % (len - depth + 1);
      for (uint64_t j = 0; j < depth; j++) bytes[at + j] = some_member(j);
    }
    nish_str *s = place(bytes, len);
    if (!check(s, depth, off, width, (int64_t)(rnd() % (len + 1)), seed) || !check(s, depth, off, width, 0, seed))
      return 1;
  }

  if (!resolves("scalar", nish_scan_scalar, "scalar") || !resolves("base", nish_scan_base, base_name) ||
      !resolves(NULL, best, "the best path") || !resolves("avx2", best, "the best path") ||
      !resolves("sse9", best, "the best path"))
    return 1;

  printf("regex-scan: %ld cases agree across", cases);
  for (int p = 0; p < npaths; p++) printf(" %s", paths[p].name);
  printf("%s%s; the resolver picks every pin\n", avx2_note ? "; " : "", avx2_note ? avx2_note : "");
  return 0;
}
