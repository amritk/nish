/* yyjson (the fastest C DOM reader): an immutable tree per line, then three
 * lookups by name. Same fields and checksum as json.ts. */
#include <yyjson.h>
#include "lines.h"

int main(int argc, char **argv) {
  bench_lines in = bench_read_lines(argv[1], 0);
  int64_t start = bench_nanos();
  int32_t sum = 0;
  for (size_t i = 0; i < in.count; i++) {
    yyjson_doc *doc = yyjson_read(in.text + in.start[i], in.length[i], 0);
    yyjson_val *root = yyjson_doc_get_root(doc);
    yyjson_val *code = yyjson_obj_get(root, "code");
    yyjson_val *line = yyjson_obj_get(root, "line");
    yyjson_val *message = yyjson_obj_get(root, "message");
    if (!yyjson_is_str(code) || !yyjson_is_int(line) || !yyjson_is_str(message)) {
      fprintf(stderr, "a field is missing\n");
      return 1;
    }
    sum = (int32_t)((sum + (int32_t)yyjson_get_len(code) + (int32_t)yyjson_get_int(line) +
                     (int32_t)yyjson_get_len(message)) & BENCH_MASK);
    yyjson_doc_free(doc);
  }
  int64_t elapsed = bench_nanos() - start;
  printf("%d\n%lld\n", sum, (long long)elapsed);
  return 0;
}
