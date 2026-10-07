// nlohmann/json (the most used C++ JSON library): a full tree per line, then
// three lookups by name. Same fields and checksum as json.ts.
#include <nlohmann/json.hpp>
#include "lines.h"

int main(int argc, char **argv) {
  bench_lines in = bench_read_lines(argv[1], 0);
  int64_t start = bench_nanos();
  int32_t sum = 0;
  for (size_t i = 0; i < in.count; i++) {
    const char *at = in.text + in.start[i];
    nlohmann::json doc = nlohmann::json::parse(at, at + in.length[i]);
    const std::string &code = doc["code"].get_ref<const std::string &>();
    int64_t line = doc["line"].get<int64_t>();
    const std::string &message = doc["message"].get_ref<const std::string &>();
    sum = (int32_t)((sum + (int32_t)code.size() + (int32_t)line + (int32_t)message.size()) & BENCH_MASK);
  }
  int64_t elapsed = bench_nanos() - start;
  printf("%d\n%lld\n", sum, (long long)elapsed);
  return 0;
}
