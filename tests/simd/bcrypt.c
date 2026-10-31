/* The agreement test for runtime/runtime-bcrypt.c: every kernel the generator
 * writes -- both index styles, `ah` and `bextr`, at every width from 1 to 6 --
 * leaves each lane's state exactly as bcrypt's expand0 body written out in C
 * does, `nish_bcrypt_body_n` refuses every width and short state the Nish
 * function would not run, each kernel leaves no secret in its frame or in the
 * caller-saved registers it wrote, and `nish_bcrypt_hw` answers what
 * `NISH_BCRYPT` and the CPU say it should.
 *
 * The reference is the loop std/crypto/bcrypt.ts's `bcryptBody` runs on one
 * lane: from a zero block, 521 Blowfish encryptions, each output written over
 * the next two words of P then the S-boxes and fed back as the next input.
 * The kernels are compared with it on random states, lane by lane, so a
 * kernel that mixed up two lanes' strides fails. The reference itself is held
 * to published hashes elsewhere: every bcrypt program under tests/link prints the
 * same known hashes with the kernel and under `NISH_BCRYPT=soft`.
 *
 * The runtime file is included rather than linked, as tests/simd/sha256.c
 * includes runtime-sha256.c, so the resolver's stored answer can be reset and
 * asked again under each pin.
 *
 *   bcrypt [seed]   prints one summary line and exits 0, or names the first
 *                   case a kernel got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-bcrypt.c"

#define WORDS NISH_BCRYPT_WORDS
#define LANES 6

static long cases;

static uint64_t rng_state;
static uint32_t rnd(void) {
  rng_state ^= rng_state << 13;
  rng_state ^= rng_state >> 7;
  rng_state ^= rng_state << 17;
  return (uint32_t)rng_state;
}

/* ---- The reference --------------------------------------------------------- */

static uint32_t f(const uint32_t *s, uint32_t x) {
  return ((s[x >> 24] + s[256 + ((x >> 16) & 255)]) ^ s[512 + ((x >> 8) & 255)]) + s[768 + (x & 255)];
}

/* Blowfish's encryption of (l, r) under the P-array and S-boxes in `st`. */
static void encrypt(const uint32_t *st, uint32_t *l, uint32_t *r) {
  uint32_t x = *l, y = *r;
  for (int i = 0; i < 16; i += 2) {
    x ^= st[i];
    y ^= f(st + 18, x);
    y ^= st[i + 1];
    x ^= f(st + 18, y);
  }
  *l = y ^ st[17];
  *r = x ^ st[16];
}

/* bcryptBody on one lane: 521 chained encryptions written over the state. */
static void ref_body(uint32_t *st) {
  uint32_t l = 0, r = 0;
  for (int i = 0; i < WORDS; i += 2) {
    encrypt(st, &l, &r);
    st[i] = l;
    st[i + 1] = r;
  }
}

#if defined(__x86_64__)

/* ---- The kernels -------------------------------------------------------------- */

typedef void (*kernel)(uint32_t *);
static const kernel kernels[2][LANES + 1] = {
    {0, nish_bcrypt_x86_ah_1, nish_bcrypt_x86_ah_2, nish_bcrypt_x86_ah_3, nish_bcrypt_x86_ah_4, nish_bcrypt_x86_ah_5,
     nish_bcrypt_x86_ah_6},
    {0, nish_bcrypt_x86_bextr_1, nish_bcrypt_x86_bextr_2, nish_bcrypt_x86_bextr_3, nish_bcrypt_x86_bextr_4,
     nish_bcrypt_x86_bextr_5, nish_bcrypt_x86_bextr_6},
};
static const char *const styles[2] = {"ah", "bextr"};

static uint32_t got[LANES * WORDS], want[LANES * WORDS];

/* One random state of `n` lanes through kernel `k` and through the reference. */
static int agrees(int style, int n, int trial) {
  for (int i = 0; i < n * WORDS; i++) got[i] = want[i] = rnd();
  kernels[style][n](got);
  for (int u = 0; u < n; u++) ref_body(want + u * WORDS);
  for (int i = 0; i < n * WORDS; i++) {
    if (got[i] != want[i]) {
      printf("FAIL %s_%d: trial %d, lane %d word %d is %08x, not %08x\n", styles[style], n, trial, i / WORDS,
             i % WORDS, got[i], want[i]);
      return 0;
    }
  }
  cases++;
  return 1;
}

/* ---- The guard ------------------------------------------------------------------ */

/* One call `nish_bcrypt_body_n` must refuse: the answer 0 and the state as it was. */
static int refuses(const char *what, uint64_t len, int32_t width) {
  for (int i = 0; i < LANES * WORDS; i++) got[i] = (uint32_t)i;
  nish_array st = {len, LANES * WORDS, (char *)got};
  int32_t r = nish_bcrypt_body_n(&st, width);
  for (int i = 0; i < LANES * WORDS; i++)
    if (got[i] != (uint32_t)i) r = -1;
  if (r != 0) {
    printf("FAIL guard: %s was not refused untouched (answered %d)\n", what, r);
    return 0;
  }
  cases++;
  return 1;
}

static int guard(void) {
  for (int32_t n = 2; n <= LANES; n++) {
    for (int i = 0; i < n * WORDS; i++) got[i] = want[i] = rnd();
    nish_array st = {(uint64_t)n * WORDS, LANES * WORDS, (char *)got};
    for (int u = 0; u < n; u++) ref_body(want + u * WORDS);
    if (nish_bcrypt_body_n(&st, n) != 1 || memcmp(got, want, (size_t)n * WORDS * 4) != 0) {
      printf("FAIL guard: width %d on a state of exactly %d lanes was refused or differs\n", n, n);
      return 0;
    }
    cases++;
  }
  return refuses("width 1, which bcryptHash runs in Nish", WORDS, 1) &&
         refuses("width 0", LANES * WORDS, 0) && refuses("width -1", LANES * WORDS, -1) &&
         refuses("width 7", LANES * WORDS, 7) && refuses("width INT32_MIN", LANES * WORDS, INT32_MIN) &&
         refuses("width 2 on a state one word short", 2 * WORDS - 1, 2) &&
         refuses("width 6 on a state of five lanes", 5 * WORDS, 6) && refuses("width 3 on an empty state", 0, 3);
}

/* ---- The wipe -------------------------------------------------------------------- */

/* nish_test_bcrypt_probe(state, kernel, out) calls the kernel, then writes
   what it left behind to out[0..9]: rax, rcx, rdx, rsi and r8-r11 as they
   came back, then the two quadwords below the probe's stack pointer where the
   kernel's frame was. The probe pushes nothing after the call, so nothing
   overwrites that memory before it is read; it sits in the red zone, which a
   signal handler leaves alone. */
__asm__(".text\n"
        ".intel_syntax noprefix\n"
        ".p2align 4\n"
        "nish_test_bcrypt_probe:\n"
        "  push rbx\n"
        "  mov rbx, rdx\n"
        "  call rsi\n"
        "  mov qword ptr [rbx], rax\n"
        "  mov qword ptr [rbx + 8], rcx\n"
        "  mov qword ptr [rbx + 16], rdx\n"
        "  mov qword ptr [rbx + 24], rsi\n"
        "  mov qword ptr [rbx + 32], r8\n"
        "  mov qword ptr [rbx + 40], r9\n"
        "  mov qword ptr [rbx + 48], r10\n"
        "  mov qword ptr [rbx + 56], r11\n"
        "  mov rax, qword ptr [rsp - 64]\n"
        "  mov qword ptr [rbx + 64], rax\n"
        "  mov rax, qword ptr [rsp - 72]\n"
        "  mov qword ptr [rbx + 72], rax\n"
        "  xor eax, eax\n"
        "  pop rbx\n"
        "  ret\n"
        ".att_syntax prefix\n");
void nish_test_bcrypt_probe(uint32_t *state, kernel k, uint64_t out[10]);

static const char *const left[] = {"rax", "rcx", "rdx", "rsi", "r8", "r9", "r10", "r11"};

/* After the call the probe's rsp is where it was just after its push; the
   kernel's return address sat at rsp - 8, its six saved registers from rsp - 56
   up, and its frame below them: the counter at rsp - 64, or at width 6 the
   stack lane's halves there and the counter at rsp - 72. */
static int wiped(int style, int n) {
  uint64_t out[10];
  for (int i = 0; i < n * WORDS; i++) got[i] = rnd();
  nish_test_bcrypt_probe(got, kernels[style][n], out);
  for (int i = 0; i < 8; i++) {
    if (out[i] != 0) {
      printf("FAIL wipe %s_%d: %s came back as %016llx, not 0\n", styles[style], n, left[i],
             (unsigned long long)out[i]);
      return 0;
    }
  }
  int frame = n > 5 ? 2 : 1;
  for (int i = 0; i < frame; i++) {
    if (out[8 + i] != 0) {
      printf("FAIL wipe %s_%d: the frame's quadword %d is %016llx, not 0\n", styles[style], n, i,
             (unsigned long long)out[8 + i]);
      return 0;
    }
  }
  cases++;
  return 1;
}

#endif

/* ---- The resolver ----------------------------------------------------------- */

static int resolves(const char *pin, int want_answer) {
  if (pin == NULL) {
    unsetenv("NISH_BCRYPT");
  } else {
    setenv("NISH_BCRYPT", pin, 1);
  }
#if defined(__x86_64__)
  __atomic_store_n(&nish_bcrypt_answer, 0, __ATOMIC_RELAXED);
#endif
  int answer = nish_bcrypt_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_BCRYPT", want_answer ? "soft" : "hw", 1);
  if (answer != want_answer || nish_bcrypt_hw() != want_answer) {
    printf("FAIL resolver: NISH_BCRYPT=%s answered %d, not %d\n", pin ? pin : "<unset>", answer, want_answer);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261031;
  rng_state = seed | 1;

  const char *path;
  int hw = 0;
#if defined(__x86_64__)
  hw = nish_bcrypt_cpu();
  path = hw ? "bmi2" : "the reference alone (bmi2 SKIPPED: this CPU has no BMI1 and BMI2)";
  if (hw) {
    for (int style = 0; style < 2; style++) {
      for (int n = 1; n <= LANES; n++) {
        for (int trial = 0; trial < 40; trial++)
          if (!agrees(style, n, trial)) return 1;
        if (!wiped(style, n)) return 1;
      }
    }
    if (!guard()) return 1;
  }
#else
  path = "the reference alone (no kernel on this target)";
#endif

  if (!resolves("soft", 0) || !resolves(NULL, hw) || !resolves("hw", hw) || !resolves("softer", hw)) return 1;

  printf("bcrypt: %ld cases agree across %s; the resolver picks every pin\n", cases, path);
  return 0;
}
