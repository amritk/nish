/* The agreement test for runtime/runtime-bytes.c's byte-class runs (WP38 S6a):
 * `nish_bytes_skip_blank`, `nish_bytes_skip_digits` and
 * `nish_bytes_skip_json_text`. Every path the file has for this machine --
 * scalar, base and, when the CPU has it, AVX2 -- answers every class boundary
 * at every block offset, every UTF-8 lead cut short at every byte by `to`, and
 * a seeded, fuzzed corpus exactly as a plain reference loop does, and the
 * resolver picks the path `NISH_SIMD` and the CPU say it should.
 *
 * The reference is written apart from the kernel: it decodes a sequence's code
 * point and rejects an overlong form, a surrogate and anything past U+10FFFF
 * by value, where the kernel narrows the second byte's range (RFC 3629 §4).
 * The two agreeing is the evidence that the table is the definition.
 *
 * Built and run the way tests/simd/index-of-any.c is: the runtime file is
 * included, natively, for wasm32-wasi with and without `-msimd128`, and as a
 * static AArch64 binary when the host can run one.
 *
 *   byte-runs [seed]   prints one summary line and exits 0, or names the first
 *                      case a path got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv and MAP_ANONYMOUS under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-bytes.c"

#if !defined(__wasi__)
#include <sys/mman.h>
#include <unistd.h>
#endif

static uint64_t rng_state;

/* xorshift64*, as index-of-any.c: a failure printed with its seed reruns. */
static uint64_t rnd(void) {
  rng_state ^= rng_state >> 12;
  rng_state ^= rng_state << 25;
  rng_state ^= rng_state >> 27;
  return rng_state * 2685821657736338717ull;
}

static const char *class_name[3] = {"blank", "digits", "json-text"};

/* The length of the well-formed sequence at `p[i]` that ends by `to`, or 0,
   from the code point it decodes to. */
static int64_t ref_utf8(const uint8_t *p, int64_t i, int64_t to) {
  uint8_t lead = p[i];
  int64_t n;
  uint32_t cp, least;
  if (lead >= 0xc0 && lead < 0xe0) {
    n = 2, cp = lead & 0x1f, least = 0x80;
  } else if (lead >= 0xe0 && lead < 0xf0) {
    n = 3, cp = lead & 0x0f, least = 0x800;
  } else if (lead >= 0xf0 && lead < 0xf8) {
    n = 4, cp = lead & 0x07, least = 0x10000;
  } else {
    return 0;
  }
  if (to - i < n) return 0;
  for (int64_t k = 1; k < n; k++) {
    if ((p[i + k] & 0xc0) != 0x80) return 0;
    cp = (cp << 6) | (p[i + k] & 0x3f);
  }
  if (cp < least || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return 0;
  return n;
}

static int64_t reference(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (i < to) {
    uint8_t b = p[i];
    int in = cls == NISH_RUN_BLANK   ? (b == ' ' || b == '\t' || b == '\n' || b == '\r')
             : cls == NISH_RUN_DIGIT ? (b >= '0' && b <= '9')
                                     : (b >= 0x20 && b <= 0x7f && b != '"' && b != '\\');
    if (in) {
      i++;
      continue;
    }
    if (cls == NISH_RUN_TEXT && b >= 0x80) {
      int64_t n = ref_utf8(p, i, to);
      if (n == 0) return i;
      i += n;
      continue;
    }
    return i;
  }
  return to;
}

/* The bytes are placed so that `p + to` is the first byte of an unmapped
   page: a path that loads a vector past `to` faults here rather than reading
   what follows and passing. WASI has no mmap, so there it is a plain buffer. */
#define RUN_MAX 320
#if !defined(__wasi__)
static uint8_t *page_end;
#endif

static const uint8_t *place(const uint8_t *bytes, int64_t to) {
#if !defined(__wasi__)
  uint8_t *p = page_end - to;
#else
  static _Alignas(64) uint8_t buf[RUN_MAX];
  uint8_t *p = buf;
#endif
  memcpy(p, bytes, (size_t)to);
  return p;
}

typedef struct {
  const char *name;
  nish_run_path fn;
} path_t;

static path_t paths[3];
static int npaths;
static long cases;

/* Every path against the reference on `bytes[from, to)`. */
static int check(int cls, const uint8_t *bytes, int64_t from, int64_t to, uint64_t seed) {
  const uint8_t *p = place(bytes, to);
  int64_t want = reference(cls, p, from, to);
  for (int k = 0; k < npaths; k++) {
    int64_t got = paths[k].fn(cls, p, from, to);
    if (got != want) {
      printf("FAIL seed %llu: %s path %s answered %lld, the reference %lld (from %lld, to %lld)\n  bytes:",
             (unsigned long long)seed, class_name[cls], paths[k].name, (long long)got, (long long)want,
             (long long)from, (long long)to);
      for (int64_t j = from; j < to && j < from + 48; j++) printf(" %02x", p[j]);
      printf("\n");
      return 0;
    }
  }
  cases++;
  return 1;
}

/* A byte inside the class, varied so a path cannot pass on one value. */
static uint8_t member(int cls, uint64_t j) {
  if (cls == NISH_RUN_BLANK) return (const uint8_t[]){' ', '\t', '\n', '\r'}[j % 4];
  if (cls == NISH_RUN_DIGIT) return (uint8_t)('0' + j % 10);
  uint8_t b = (uint8_t)(0x20 + j % 96);
  return b == '"' || b == '\\' ? 'a' : b;
}

/* The bytes on either side of each class's edges, every one a stop for it. */
static const uint8_t blank_stops[] = {0x00, 0x08, 0x0b, 0x0c, 0x0e, 0x1f, 0x21, 0x2c, 0x80, 0xa0, 0xff};
static const uint8_t digit_stops[] = {0x00, 0x2e, 0x2f, 0x3a, 0x45, 0x65, 0xb0, 0xb9, 0xff};
static const uint8_t text_stops[] = {0x00, 0x09, 0x1f, '"', '\\', 0x80, 0xbf, 0xc0, 0xc1, 0xf5, 0xff};

/* Byte sequences for the text class: well formed at every length and at each
   narrowed edge, and malformed just past it. */
static const struct {
  uint8_t len, bytes[4];
} sequences[] = {
    {2, {0xc2, 0x80}}, {2, {0xdf, 0xbf}}, {2, {0xc3, 0xa9}}, {2, {0xc2, 0x7f}}, {2, {0xc2, 0xc0}},
    {3, {0xe0, 0xa0, 0x80}}, {3, {0xe0, 0x9f, 0xbf}}, {3, {0xed, 0x9f, 0xbf}}, {3, {0xed, 0xa0, 0x80}},
    {3, {0xef, 0xbf, 0xbf}}, {3, {0xe2, 0x82, 0xac}}, {3, {0xe4, 0xb8, 0x7f}},
    {4, {0xf0, 0x90, 0x80, 0x80}}, {4, {0xf0, 0x8f, 0xbf, 0xbf}}, {4, {0xf4, 0x8f, 0xbf, 0xbf}},
    {4, {0xf4, 0x90, 0x80, 0x80}}, {4, {0xf1, 0x80, 0x80, 0xc0}}, {4, {0xf3, 0xbf, 0xbf, 0xbf}},
};

/* The resolver, once per pin, as index-of-any.c checks `nish_any`'s. */
static int resolves(const char *pin, nish_run_path want, const char *want_name) {
  if (pin == NULL) {
    unsetenv("NISH_SIMD");
  } else {
    setenv("NISH_SIMD", pin, 1);
  }
  __atomic_store_n(&nish_run, nish_run_resolve, __ATOMIC_RELAXED);
  static const uint8_t text[] = "  \t 1234567890123456789012345678901234567890x";
  int64_t blank = nish_bytes_skip_blank(text, 0, 44);
  nish_run_path got = __atomic_load_n(&nish_run, __ATOMIC_RELAXED);
  if (got != want || blank != 4 || nish_bytes_skip_digits(text, 4, 44) != 44 ||
      nish_bytes_skip_json_text(text, 0, 44) != 2 || nish_bytes_skip_json_text(text, 3, 44) != 44) {
    printf("FAIL resolver: NISH_SIMD=%s did not pick %s\n", pin ? pin : "<unset>", want_name);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261023;
  rng_state = seed | 1;

#if !defined(__wasi__)
  size_t page = (size_t)sysconf(_SC_PAGESIZE);
  uint8_t *map = mmap(NULL, page * 2, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (map == MAP_FAILED || mprotect(map + page, page, PROT_NONE) != 0) {
    perror("byte-runs: mmap");
    return 1;
  }
  page_end = map + page;
#endif

  paths[npaths++] = (path_t){"scalar", nish_run_scalar};
#if defined(NISH_SIMD_SSE2) || defined(NISH_SIMD_NEON) || defined(NISH_SIMD_WASM)
  paths[npaths++] = (path_t){"base", nish_run_base};
  const char *base_name = "base";
#else
  const char *base_name = "base (the scalar path on this target)";
#endif
  const char *avx2_note;
  nish_run_path best = nish_run_base;
#if defined(NISH_SIMD_SSE2)
  if (nish_cpu_has_avx2()) {
    paths[npaths++] = (path_t){"avx2", nish_run_avx2};
    best = nish_run_avx2;
    avx2_note = NULL;
  } else {
    avx2_note = "avx2 SKIPPED: this CPU has no AVX2";
  }
#else
  avx2_note = "avx2 not built: not an x86 target";
#endif

  uint8_t bytes[RUN_MAX];
  const uint8_t *stops[3] = {blank_stops, digit_stops, text_stops};
  const size_t nstops[3] = {sizeof blank_stops, sizeof digit_stops, sizeof text_stops};

  /* Every class's edge bytes planted at every position of every length, run
     from every start up to two AVX2 blocks before it and one past it, and cut
     at the stop and after it: the exhaustive half. */
  for (int cls = 0; cls < 3; cls++) {
    for (int64_t len = 0; len <= 160; len++) {
      for (int64_t at = 0; at <= len; at++) {
        for (int64_t j = 0; j < len; j++) bytes[j] = member(cls, (uint64_t)j);
        if (at < len) bytes[at] = stops[cls][(uint64_t)(at + len) % nstops[cls]];
        int64_t first = at > 64 ? at - 64 : 0;
        for (int64_t from = first; from <= len && from <= at + 1; from++) {
          if (!check(cls, bytes, from, len, seed)) return 1;
          if (at < len && from <= at && !check(cls, bytes, from, at, seed)) return 1;
        }
      }
    }
  }

  /* Each UTF-8 sequence planted at every offset of two AVX2 blocks of ASCII,
     with `to` at every byte of it and past it, and followed by more text, by
     a second sequence or by a stop. */
  for (size_t s = 0; s < sizeof sequences / sizeof sequences[0]; s++) {
    for (int64_t at = 0; at < 64; at++) {
      for (int after = 0; after < 3; after++) {
        int64_t len = at + sequences[s].len + 40;
        for (int64_t j = 0; j < len; j++) bytes[j] = member(NISH_RUN_TEXT, (uint64_t)j * 7);
        memcpy(bytes + at, sequences[s].bytes, sequences[s].len);
        int64_t next = at + sequences[s].len;
        if (after == 1) memcpy(bytes + next, sequences[(s + 1) % (sizeof sequences / sizeof sequences[0])].bytes, 4);
        if (after == 2) bytes[next] = '"';
        for (int64_t to = at; to <= next + 1; to++) {
          if (!check(NISH_RUN_TEXT, bytes, 0, to, seed) || !check(NISH_RUN_TEXT, bytes, at, to, seed)) return 1;
        }
        if (!check(NISH_RUN_TEXT, bytes, 0, len, seed)) return 1;
      }
    }
  }

  /* The fuzzed half: random lengths and ranges over bytes drawn mostly from
     the class, with its edge bytes and UTF-8 lead and continuation bytes mixed
     in at a rate that leaves runs of every length. */
  for (int trial = 0; trial < 150000; trial++) {
    int cls = (int)(rnd() % 3);
    int64_t len = (int64_t)(rnd() % RUN_MAX);
    uint64_t rate = 1 + rnd() % 64;
    for (int64_t j = 0; j < len; j++) {
      uint64_t r = rnd();
      if (r % rate != 0) {
        bytes[j] = member(cls, r >> 8);
      } else if (cls == NISH_RUN_TEXT && (r & 0x100)) {
        size_t s = (size_t)(r >> 16) % (sizeof sequences / sizeof sequences[0]);
        for (int k = 0; k < sequences[s].len && j < len; k++) bytes[j++] = sequences[s].bytes[k];
        j--;
      } else if (r & 0x200) {
        bytes[j] = stops[cls][(r >> 16) % nstops[cls]];
      } else {
        bytes[j] = (uint8_t)(r >> 16);
      }
    }
    int64_t to = len == 0 ? 0 : (int64_t)(rnd() % (uint64_t)(len + 1));
    int64_t from = (int64_t)(rnd() % (uint64_t)(to + 1));
    if (!check(cls, bytes, from, to, seed) || !check(cls, bytes, 0, len, seed)) return 1;
  }

  /* The resolver: each pin, and the best path for no pin, `avx2` and a value
     it does not know. */
  if (!resolves("scalar", nish_run_scalar, "scalar") || !resolves("base", nish_run_base, base_name) ||
      !resolves(NULL, best, "the best path") || !resolves("avx2", best, "the best path") ||
      !resolves("sse9", best, "the best path"))
    return 1;

  printf("byte-runs: %ld cases agree across", cases);
  for (int k = 0; k < npaths; k++) printf(" %s", paths[k].name);
  printf("%s%s; the resolver picks every pin\n", avx2_note ? "; " : "", avx2_note ? avx2_note : "");
  return 0;
}
