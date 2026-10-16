/* WP38 S3a, depth form 1: the kernel nish:simd would write, in C's generic
   vectors (docs/wp38-simd.md §2.3). Each 16-byte block is compared against
   the four structural bytes at once; a block with none is skipped whole, and
   a block with some walks its set bits in order through depth-scalar.c's
   state machine. An escape is held as the position it consumes, so a `\` at
   the end of one block still escapes the first byte of the next. Only
   element-wise compares, a reduction and a conversion to a bool vector: no
   <immintrin.h>, no <arm_neon.h>, and bench/simd-s3a.mjs refuses to time this
   file if its IR calls an llvm.x86 or llvm.aarch64 intrinsic. */
#include "depth-doc.h"

#define MAX_DEPTH 64

typedef uint8_t u8x16 __attribute__((vector_size(16)));
typedef _Bool b16 __attribute__((ext_vector_type(16)));

typedef struct {
  int32_t tokens;
  int32_t depth;
  int in;
  size_t escAt;
} State;

/* One structural byte at p; nonzero means the depth left its range. */
static inline int step(State *s, uint8_t c, size_t p) {
  if (s->in) {
    if (p == s->escAt) return 0;
    if (c == '\\') {
      s->escAt = p + 1;
    } else if (c == '"') {
      s->in = 0;
      s->tokens++;
    }
  } else if (c == '"') {
    s->in = 1;
  } else if (c == '{' || c == '[') {
    if (++s->depth > MAX_DEPTH) return 1;
    s->tokens++;
  } else if (c == '}' || c == ']') {
    if (--s->depth < 0) return 1;
    s->tokens++;
  }
  return 0;
}

static int32_t scan(const uint8_t *b, size_t n) {
  State s = {0, 0, 0, SIZE_MAX};
  size_t p = 0;
  for (; p + 16 <= n; p += 16) {
    u8x16 x;
    memcpy(&x, b + p, 16);
    /* `[` and `]` differ from `{` and `}` only in bit 5. */
    u8x16 folded = x | 0x20;
    u8x16 hit = (u8x16)((x == '"') | (x == '\\') | (folded == '{') | (folded == '}'));
    if (!__builtin_reduce_or(hit)) continue;
    b16 mask = __builtin_convertvector(hit, b16);
    uint16_t bits;
    memcpy(&bits, &mask, sizeof bits);
    while (bits) {
      unsigned k = (unsigned)__builtin_ctz(bits);
      bits &= bits - 1;
      if (step(&s, b[p + k], p + k)) return -1;
    }
  }
  for (; p < n; p++) {
    uint8_t c = b[p];
    if ((c == '"' || c == '\\' || (c | 0x20) == '{' || (c | 0x20) == '}') && step(&s, c, p)) return -1;
  }
  return s.in || s.depth != 0 ? -2 : s.tokens;
}

int main(int argc, char **argv) { return run(argc, argv); }
