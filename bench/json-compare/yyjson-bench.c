// bench/json-compare's yyjson comparator: the tokenize workload only, since
// yyjson has no typed layer. Each iteration reads the document into a yyjson
// tree, walks every value in document order and frees the tree. The tree
// and yyjson's copy of the input come from one pool allocated before the
// clock starts, as yyjson's documentation shows for repeated reads, so no
// iteration pays for malloc. The folds are bench/json-compare/run.mjs's.
//
//   yyjson-bench tokenize <file> <iterations> <at>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "yyjson.h"

static uint64_t fold(uint64_t h, uint64_t v) { return h * 31u + v; }

typedef struct {
  uint64_t h;
  long tokens;
  double numbers;
} sums;

static void kind(sums *s, uint64_t k) {
  s->h = fold(s->h, k);
  s->tokens++;
}

static void text(sums *s, uint64_t k, const char *str, size_t len) {
  kind(s, k);
  s->h = fold(fold(s->h, len), len > 0 ? (unsigned char)str[len - 1] : 0);
}

static void walk(yyjson_val *v, sums *s) {
  switch (yyjson_get_type(v)) {
  case YYJSON_TYPE_OBJ: {
    kind(s, 1);
    yyjson_obj_iter it = yyjson_obj_iter_with(v);
    yyjson_val *key;
    while ((key = yyjson_obj_iter_next(&it)) != NULL) {
      text(s, 5, yyjson_get_str(key), yyjson_get_len(key));
      walk(yyjson_obj_iter_get_val(key), s);
    }
    kind(s, 2);
    break;
  }
  case YYJSON_TYPE_ARR: {
    kind(s, 3);
    yyjson_arr_iter it = yyjson_arr_iter_with(v);
    yyjson_val *el;
    while ((el = yyjson_arr_iter_next(&it)) != NULL) {
      walk(el, s);
    }
    kind(s, 4);
    break;
  }
  case YYJSON_TYPE_STR:
    text(s, 6, yyjson_get_str(v), yyjson_get_len(v));
    break;
  case YYJSON_TYPE_NUM:
    kind(s, 7);
    s->numbers += yyjson_get_num(v);
    break;
  case YYJSON_TYPE_BOOL:
    kind(s, yyjson_get_bool(v) ? 8 : 9);
    break;
  default:
    kind(s, 10);
    break;
  }
}

static int64_t now_ns(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

int main(int argc, char **argv) {
  if (argc < 5 || strcmp(argv[1], "tokenize") != 0) {
    fprintf(stderr, "usage: yyjson-bench tokenize <file> <iterations> <at>\n");
    return 2;
  }
  FILE *f = fopen(argv[2], "rb");
  if (f == NULL) {
    fprintf(stderr, "cannot read %s\n", argv[2]);
    return 1;
  }
  fseek(f, 0, SEEK_END);
  size_t len = (size_t)ftell(f);
  fseek(f, 0, SEEK_SET);
  char *doc = malloc(len);
  if (fread(doc, 1, len, f) != len) {
    return 1;
  }
  fclose(f);
  long iterations = atol(argv[3]);
  long at = atol(argv[4]);

  size_t pool_size = yyjson_read_max_memory_usage(len, 0);
  void *pool = malloc(pool_size);
  yyjson_alc alc;
  yyjson_alc_pool_init(&alc, pool, pool_size);

  uint64_t h = 0;
  double numbers = 0;
  sums s = {0, 0, 0};
  int64_t t0 = now_ns();
  for (long r = 0; r < iterations; r++) {
    if (at >= 0 && (size_t)at < len) {
      doc[at] = (char)('0' + r % 10);
    }
    yyjson_doc *d = yyjson_read_opts(doc, len, 0, &alc, NULL);
    if (d == NULL) {
      fprintf(stderr, "tokenize: the document is not JSON\n");
      return 1;
    }
    s = (sums){0, 0, 0};
    walk(yyjson_doc_get_root(d), &s);
    yyjson_doc_free(d);
    h = fold(h, s.h);
    numbers += s.numbers;
  }
  int64_t elapsed = now_ns() - t0;
  printf("tokenize %" PRIu64 " %ld %.17g\nns %" PRId64 "\n", h, s.tokens, numbers, elapsed);
  return 0;
}
