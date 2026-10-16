/* WP38 S3a, depth form 2: bench/scan.ts's state machine in plain C, one byte
   at a time, the C reference for depth-vector.c (docs/wp38-simd.md §2.3).
   It counts closed strings and brackets, answering -1 past depth 64 or below
   0 and -2 for an unterminated document; the separators scan.ts also counts
   are left out, so the vector form's mask holds four bytes, not six. */
#include "depth-doc.h"

#define MAX_DEPTH 64

static int32_t scan(const uint8_t *b, size_t n) {
  int32_t tokens = 0;
  int32_t depth = 0;
  int in = 0;
  int escaped = 0;
  for (size_t i = 0; i < n; i++) {
    uint8_t c = b[i];
    if (in) {
      if (escaped) {
        escaped = 0;
      } else if (c == '\\') {
        escaped = 1;
      } else if (c == '"') {
        in = 0;
        tokens++;
      }
    } else if (c == '"') {
      in = 1;
    } else if (c == '{' || c == '[') {
      if (++depth > MAX_DEPTH) return -1;
      tokens++;
    } else if (c == '}' || c == ']') {
      if (--depth < 0) return -1;
      tokens++;
    }
  }
  return in || depth != 0 ? -2 : tokens;
}

int main(int argc, char **argv) { return run(argc, argv); }
