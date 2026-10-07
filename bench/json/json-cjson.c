/* cJSON (the most widely packaged C JSON library): a full tree per line, then
 * three lookups by name. Same fields and checksum as json.ts. */
#include <cjson/cJSON.h>
#include "lines.h"

int main(int argc, char **argv) {
  bench_lines in = bench_read_lines(argv[1], 0);
  int64_t start = bench_nanos();
  int32_t sum = 0;
  for (size_t i = 0; i < in.count; i++) {
    cJSON *doc = cJSON_ParseWithLength(in.text + in.start[i], in.length[i]);
    const cJSON *code = cJSON_GetObjectItemCaseSensitive(doc, "code");
    const cJSON *line = cJSON_GetObjectItemCaseSensitive(doc, "line");
    const cJSON *message = cJSON_GetObjectItemCaseSensitive(doc, "message");
    if (!cJSON_IsString(code) || !cJSON_IsNumber(line) || !cJSON_IsString(message)) {
      fprintf(stderr, "a field is missing\n");
      return 1;
    }
    sum = (int32_t)((sum + (int32_t)strlen(code->valuestring) + line->valueint +
                     (int32_t)strlen(message->valuestring)) & BENCH_MASK);
    cJSON_Delete(doc);
  }
  int64_t elapsed = bench_nanos() - start;
  printf("%d\n%lld\n", sum, (long long)elapsed);
  return 0;
}
