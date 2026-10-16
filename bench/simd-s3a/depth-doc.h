/* WP38 S3a: the two documents the depth-count forms scan, and the rounds that
   change them, shared by depth-scalar.c and depth-vector.c; depth-checked.ts
   and depth-unchecked.ts build the same bytes. "s0" repeats docs/wp38-simd.md
   S0's piece, dense with structural bytes; "log" repeats a record whose long
   message leaves most 16-byte blocks with none. Each round turns the next
   piece's "[1,2" into "[[,]", two more tokens and still balanced, so no
   round scans the document the last one did. A second argument "setup"
   builds the document and scans it no times, so bench/simd-s3a.mjs can say
   how much of a run is the scan. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define DOC_BYTES (1 << 20)
#define ROUNDS 500

static const char *PIECE_S0 = "{\"id\":\"a\\\"b\",\"n\":[1,2,3],\"s\":\"x,y:z\",\"d\":{\"k\":[true,null]}},";
static const char *PIECE_LOG =
  "{\"code\":404,\"line\":1234,\"tags\":[1,2,3],\"message\":\"GET /api/v1/items?page=2 returned an "
  "empty page after one retry; the upstream said \\\"no rows\\\" and the cache was cold\"},";

static int32_t scan(const uint8_t *b, size_t n);

static int run(int argc, char **argv) {
  const char *piece = argc > 1 && strcmp(argv[1], "log") == 0 ? PIECE_LOG : PIECE_S0;
  size_t len = strlen(piece);
  size_t pieces = DOC_BYTES / len;
  size_t n = pieces * len;
  size_t flip = (size_t)(strstr(piece, "[1") - piece) + 1;
  uint8_t *bytes = malloc(n);
  if (!bytes) return 1;
  for (size_t i = 0; i < n; i++) bytes[i] = (uint8_t)piece[i % len];
  int32_t rounds = argc > 2 && strcmp(argv[2], "setup") == 0 ? 0 : ROUNDS;
  int64_t checksum = 0;
  for (int32_t r = 0; r < rounds; r++) {
    size_t at = (size_t)r % pieces * len + flip;
    bytes[at] = '[';
    bytes[at + 2] = ']';
    checksum = (checksum * 31 + scan(bytes, n) + r) % 1000003;
  }
  printf("%lld\n", (long long)checksum);
  free(bytes);
  return 0;
}
