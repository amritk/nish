// bench/json-compare's RapidJSON comparator: the tokenize workload only, with
// RapidJSON's Reader, the SAX interface, so that no tree is built. Numbers
// are parsed with kParseFullPrecisionFlag, without which a double may be off
// by an ulp and the checksum would not agree. The folds are
// bench/json-compare/run.mjs's.
//
//   rapidjson-bench tokenize <file> <iterations> <at>
#include <cinttypes>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <vector>

#include "rapidjson/reader.h"

static uint64_t fold(uint64_t h, uint64_t v) { return h * 31u + v; }

struct Sums : rapidjson::BaseReaderHandler<rapidjson::UTF8<>, Sums> {
  uint64_t h = 0;
  long tokens = 0;
  double numbers = 0;

  bool kind(uint64_t k) {
    h = fold(h, k);
    tokens++;
    return true;
  }
  bool text(uint64_t k, const char *s, rapidjson::SizeType len) {
    kind(k);
    h = fold(fold(h, len), len > 0 ? (unsigned char)s[len - 1] : 0);
    return true;
  }
  bool number(double d) {
    numbers += d;
    return kind(7);
  }
  bool Null() { return kind(10); }
  bool Bool(bool b) { return kind(b ? 8 : 9); }
  bool Int(int i) { return number(i); }
  bool Uint(unsigned u) { return number(u); }
  bool Int64(int64_t i) { return number(static_cast<double>(i)); }
  bool Uint64(uint64_t u) { return number(static_cast<double>(u)); }
  bool Double(double d) { return number(d); }
  bool String(const char *s, rapidjson::SizeType len, bool) { return text(6, s, len); }
  bool Key(const char *s, rapidjson::SizeType len, bool) { return text(5, s, len); }
  bool StartObject() { return kind(1); }
  bool EndObject(rapidjson::SizeType) { return kind(2); }
  bool StartArray() { return kind(3); }
  bool EndArray(rapidjson::SizeType) { return kind(4); }
};

static int64_t now_ns() {
  timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * 1000000000 + ts.tv_nsec;
}

int main(int argc, char **argv) {
  if (argc < 5 || std::strcmp(argv[1], "tokenize") != 0) {
    std::fprintf(stderr, "usage: rapidjson-bench tokenize <file> <iterations> <at>\n");
    return 2;
  }
  FILE *f = std::fopen(argv[2], "rb");
  if (f == nullptr) {
    std::fprintf(stderr, "cannot read %s\n", argv[2]);
    return 1;
  }
  std::fseek(f, 0, SEEK_END);
  size_t len = static_cast<size_t>(std::ftell(f));
  std::fseek(f, 0, SEEK_SET);
  // StringStream reads to a NUL, so the copy has one after the document.
  std::vector<char> doc(len + 1, 0);
  if (std::fread(doc.data(), 1, len, f) != len) {
    return 1;
  }
  std::fclose(f);
  long iterations = std::atol(argv[3]);
  long at = std::atol(argv[4]);

  uint64_t h = 0;
  double numbers = 0;
  long tokens = 0;
  rapidjson::Reader reader;
  int64_t t0 = now_ns();
  for (long r = 0; r < iterations; r++) {
    if (at >= 0 && static_cast<size_t>(at) < len) {
      doc[at] = static_cast<char>('0' + r % 10);
    }
    Sums s;
    rapidjson::StringStream ss(doc.data());
    if (reader.Parse<rapidjson::kParseFullPrecisionFlag>(ss, s).IsError()) {
      std::fprintf(stderr, "tokenize: the document is not JSON\n");
      return 1;
    }
    h = fold(h, s.h);
    numbers += s.numbers;
    tokens = s.tokens;
  }
  int64_t elapsed = now_ns() - t0;
  std::printf("tokenize %" PRIu64 " %ld %.17g\nns %" PRId64 "\n", h, tokens, numbers, elapsed);
  return 0;
}
