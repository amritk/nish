// simdjson On-Demand: no tree, the parser is walked to each field on request,
// which makes it the closest in kind to std/json's reader. `find_field_unordered`
// (what `operator[]` does) so that the lookup order does not have to match the
// document's. Same fields and checksum as json.ts.
#include <simdjson.h>
#include "lines.h"

int main(int argc, char **argv) {
  bench_lines in = bench_read_lines(argv[1], simdjson::SIMDJSON_PADDING);
  simdjson::ondemand::parser parser;
  int64_t start = bench_nanos();
  int32_t sum = 0;
  for (size_t i = 0; i < in.count; i++) {
    const char *at = in.text + in.start[i];
    simdjson::padded_string_view view(at, in.length[i], in.size + simdjson::SIMDJSON_PADDING - in.start[i]);
    simdjson::ondemand::document doc = parser.iterate(view);
    simdjson::ondemand::object object = doc.get_object();
    std::string_view code = object["code"].get_string();
    int64_t line = object["line"].get_int64();
    std::string_view message = object["message"].get_string();
    sum = (int32_t)((sum + (int32_t)code.size() + (int32_t)line + (int32_t)message.size()) & BENCH_MASK);
  }
  int64_t elapsed = bench_nanos() - start;
  printf("%d\n%lld\n", sum, (long long)elapsed);
  return 0;
}
