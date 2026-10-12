// bench/json-compare's simdjson comparator, on the On-Demand API, for all
// three workloads:
//
//   tokenize   every value visited in document order, numbers read as doubles
//   typed      citm_catalog's `performances` read into the structs below, a
//              fresh vector per iteration, fields matched by key in any order
//   serialize  the structs written back minified with simdjson's
//              builder::string_builder, cleared and reused per iteration;
//              only the writing is timed, and every byte of every output
//              is folded in outside the clock
//
// Typed reads `performances` and nothing after it: On-Demand never looks at
// the members that follow, where the other typed decoders scan to the end.
//
// The folds and the mutation of the input are bench/json-compare/run.mjs's.
//
//   simdjson-bench <workload> <file> <iterations> <at>
#include <cinttypes>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "simdjson.h"

using namespace simdjson;

static uint64_t fold(uint64_t h, uint64_t v) { return h * 31u + v; }

struct Price {
  int64_t amount = 0;
  int64_t audienceSubCategoryId = 0;
  int64_t seatCategoryId = 0;
};

struct Area {
  int64_t areaId = 0;
  std::vector<int64_t> blockIds;
};

struct SeatCategory {
  std::vector<Area> areas;
  int64_t seatCategoryId = 0;
};

struct Performance {
  int64_t eventId = 0;
  int64_t id = 0;
  std::optional<std::string> logo;
  std::optional<std::string> name;
  std::vector<Price> prices;
  std::vector<SeatCategory> seatCategories;
  std::optional<std::string> seatMapImage;
  int64_t start = 0;
  std::string venueCode;
};

// ---- tokenize -------------------------------------------------------------

struct Sums {
  uint64_t h = 0;
  long tokens = 0;
  double numbers = 0;
  // Fold every byte of a key or string after its length, not only the last:
  // the untimed pass after the loop.
  bool full = false;

  void kind(uint64_t k) {
    h = fold(h, k);
    tokens++;
  }
  void text(uint64_t k, std::string_view s) {
    kind(k);
    h = fold(h, s.size());
    if (full) {
      for (char c : s) {
        h = fold(h, static_cast<unsigned char>(c));
      }
    } else {
      h = fold(h, s.empty() ? 0 : static_cast<unsigned char>(s.back()));
    }
  }
};

static void walk(ondemand::value v, Sums &s) {
  switch (v.type()) {
  case ondemand::json_type::object:
    s.kind(1);
    for (auto field : v.get_object()) {
      s.text(5, field.unescaped_key());
      walk(field.value(), s);
    }
    s.kind(2);
    break;
  case ondemand::json_type::array:
    s.kind(3);
    for (auto el : v.get_array()) {
      walk(el.value(), s);
    }
    s.kind(4);
    break;
  case ondemand::json_type::string:
    s.text(6, v.get_string());
    break;
  case ondemand::json_type::number:
    s.kind(7);
    s.numbers += v.get_double();
    break;
  case ondemand::json_type::boolean:
    s.kind(v.get_bool() ? 8 : 9);
    break;
  default:
    v.is_null();
    s.kind(10);
    break;
  }
}

// ---- typed ----------------------------------------------------------------

static std::optional<std::string> optionalString(ondemand::value v) {
  if (v.is_null()) {
    return std::nullopt;
  }
  return std::string(std::string_view(v.get_string()));
}

static Performance readPerformance(ondemand::object obj) {
  Performance p;
  for (auto field : obj) {
    std::string_view key = field.unescaped_key();
    ondemand::value v = field.value();
    if (key == "eventId") {
      p.eventId = v.get_int64();
    } else if (key == "id") {
      p.id = v.get_int64();
    } else if (key == "logo") {
      p.logo = optionalString(v);
    } else if (key == "name") {
      p.name = optionalString(v);
    } else if (key == "prices") {
      for (ondemand::object po : v.get_array()) {
        Price price;
        for (auto pf : po) {
          std::string_view pk = pf.unescaped_key();
          int64_t n = pf.value().get_int64();
          if (pk == "amount") {
            price.amount = n;
          } else if (pk == "audienceSubCategoryId") {
            price.audienceSubCategoryId = n;
          } else if (pk == "seatCategoryId") {
            price.seatCategoryId = n;
          }
        }
        p.prices.push_back(price);
      }
    } else if (key == "seatCategories") {
      for (ondemand::object so : v.get_array()) {
        SeatCategory sc;
        for (auto sf : so) {
          std::string_view sk = sf.unescaped_key();
          if (sk == "areas") {
            for (ondemand::object ao : sf.value().get_array()) {
              Area area;
              for (auto af : ao) {
                std::string_view ak = af.unescaped_key();
                if (ak == "areaId") {
                  area.areaId = af.value().get_int64();
                } else if (ak == "blockIds") {
                  for (int64_t b : af.value().get_array()) {
                    area.blockIds.push_back(b);
                  }
                }
              }
              sc.areas.push_back(std::move(area));
            }
          } else if (sk == "seatCategoryId") {
            sc.seatCategoryId = sf.value().get_int64();
          }
        }
        p.seatCategories.push_back(std::move(sc));
      }
    } else if (key == "seatMapImage") {
      p.seatMapImage = optionalString(v);
    } else if (key == "start") {
      p.start = v.get_int64();
    } else if (key == "venueCode") {
      p.venueCode = std::string(std::string_view(v.get_string()));
    }
  }
  return p;
}

static std::vector<Performance> readCatalog(ondemand::parser &parser, padded_string &doc) {
  std::vector<Performance> out;
  ondemand::document d = parser.iterate(doc);
  for (ondemand::object obj : d["performances"].get_array()) {
    out.push_back(readPerformance(obj));
  }
  return out;
}

static uint64_t foldBytes(uint64_t h, std::string_view s) {
  for (char c : s) {
    h = fold(h, static_cast<unsigned char>(c));
  }
  return h;
}

// A string field: 0 for null, else its length plus one, then every byte.
static uint64_t foldString(uint64_t h, const std::optional<std::string> &s) {
  return s ? foldBytes(fold(h, s->size() + 1), *s) : fold(h, 0);
}

static uint64_t foldCatalog(const std::vector<Performance> &c) {
  uint64_t h = 0;
  for (const Performance &p : c) {
    h = fold(fold(h, p.eventId), p.id);
    h = foldString(foldString(h, p.logo), p.name);
    h = fold(h, p.prices.size());
    for (const Price &price : p.prices) {
      h = fold(fold(fold(h, price.amount), price.audienceSubCategoryId), price.seatCategoryId);
    }
    h = fold(h, p.seatCategories.size());
    for (const SeatCategory &sc : p.seatCategories) {
      h = fold(h, sc.areas.size());
      for (const Area &area : sc.areas) {
        h = fold(fold(h, area.areaId), area.blockIds.size());
        for (int64_t b : area.blockIds) {
          h = fold(h, b);
        }
      }
      h = fold(h, sc.seatCategoryId);
    }
    h = foldString(h, p.seatMapImage);
    h = foldString(fold(h, p.start), p.venueCode);
  }
  return h;
}

// ---- serialize ------------------------------------------------------------

static void writeOptional(builder::string_builder &b, const char *key, const std::optional<std::string> &s) {
  b.escape_and_append_with_quotes(key);
  b.append_colon();
  if (s) {
    b.escape_and_append_with_quotes(*s);
  } else {
    b.append_null();
  }
}

static void writeCatalog(builder::string_builder &b, const std::vector<Performance> &c) {
  b.start_object();
  b.escape_and_append_with_quotes("performances");
  b.append_colon();
  b.start_array();
  for (size_t i = 0; i < c.size(); i++) {
    const Performance &p = c[i];
    if (i > 0) {
      b.append_comma();
    }
    b.start_object();
    b.append_key_value("eventId", p.eventId);
    b.append_comma();
    b.append_key_value("id", p.id);
    b.append_comma();
    writeOptional(b, "logo", p.logo);
    b.append_comma();
    writeOptional(b, "name", p.name);
    b.append_comma();
    b.escape_and_append_with_quotes("prices");
    b.append_colon();
    b.start_array();
    for (size_t j = 0; j < p.prices.size(); j++) {
      const Price &price = p.prices[j];
      if (j > 0) {
        b.append_comma();
      }
      b.start_object();
      b.append_key_value("amount", price.amount);
      b.append_comma();
      b.append_key_value("audienceSubCategoryId", price.audienceSubCategoryId);
      b.append_comma();
      b.append_key_value("seatCategoryId", price.seatCategoryId);
      b.end_object();
    }
    b.end_array();
    b.append_comma();
    b.escape_and_append_with_quotes("seatCategories");
    b.append_colon();
    b.start_array();
    for (size_t j = 0; j < p.seatCategories.size(); j++) {
      const SeatCategory &sc = p.seatCategories[j];
      if (j > 0) {
        b.append_comma();
      }
      b.start_object();
      b.escape_and_append_with_quotes("areas");
      b.append_colon();
      b.start_array();
      for (size_t k = 0; k < sc.areas.size(); k++) {
        const Area &area = sc.areas[k];
        if (k > 0) {
          b.append_comma();
        }
        b.start_object();
        b.append_key_value("areaId", area.areaId);
        b.append_comma();
        b.escape_and_append_with_quotes("blockIds");
        b.append_colon();
        b.start_array();
        for (size_t m = 0; m < area.blockIds.size(); m++) {
          if (m > 0) {
            b.append_comma();
          }
          b.append(area.blockIds[m]);
        }
        b.end_array();
        b.end_object();
      }
      b.end_array();
      b.append_comma();
      b.append_key_value("seatCategoryId", sc.seatCategoryId);
      b.end_object();
    }
    b.end_array();
    b.append_comma();
    writeOptional(b, "seatMapImage", p.seatMapImage);
    b.append_comma();
    b.append_key_value("start", p.start);
    b.append_comma();
    b.escape_and_append_with_quotes("venueCode");
    b.append_colon();
    b.escape_and_append_with_quotes(p.venueCode);
    b.end_object();
  }
  b.end_array();
  b.end_object();
}

// ---- main -----------------------------------------------------------------

static int64_t now_ns() {
  timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * 1000000000 + ts.tv_nsec;
}

int main(int argc, char **argv) {
  if (argc < 5) {
    std::fprintf(stderr, "usage: simdjson-bench <tokenize|typed|serialize> <file> <iterations> <at>\n");
    return 2;
  }
  std::string_view workload = argv[1];
  padded_string doc;
  if (padded_string::load(argv[2]).get(doc) != SUCCESS) {
    std::fprintf(stderr, "cannot read %s\n", argv[2]);
    return 1;
  }
  long iterations = std::atol(argv[3]);
  long at = std::atol(argv[4]);
  auto mutate = [&](long r) {
    if (at >= 0 && static_cast<size_t>(at) < doc.size()) {
      doc.data()[at] = static_cast<char>('0' + r % 10);
    }
  };
  ondemand::parser parser;
  int64_t t0 = 0;
  if (workload == "tokenize") {
    uint64_t h = 0;
    double numbers = 0;
    long tokens = 0;
    t0 = now_ns();
    for (long r = 0; r < iterations; r++) {
      mutate(r);
      Sums s;
      ondemand::document d = parser.iterate(doc);
      walk(d.get_value(), s);
      h = fold(h, s.h);
      numbers += s.numbers;
      tokens = s.tokens;
    }
    int64_t elapsed = now_ns() - t0;
    Sums verify;
    verify.full = true;
    ondemand::document d = parser.iterate(doc);
    walk(d.get_value(), verify);
    std::printf("tokenize %" PRIu64 " %ld %.17g %" PRIu64 "\nns %" PRId64 "\n", h, tokens, numbers, verify.h, elapsed);
  } else if (workload == "typed") {
    uint64_t h = 0;
    size_t count = 0;
    t0 = now_ns();
    for (long r = 0; r < iterations; r++) {
      mutate(r);
      std::vector<Performance> c = readCatalog(parser, doc);
      h = fold(h, foldCatalog(c));
      count = c.size();
    }
    int64_t elapsed = now_ns() - t0;
    std::printf("typed %" PRIu64 " %zu\nns %" PRId64 "\n", h, count, elapsed);
  } else if (workload == "serialize") {
    std::vector<Performance> c = readCatalog(parser, doc);
    if (c.empty()) {
      std::fprintf(stderr, "serialize: the document has no performances\n");
      return 1;
    }
    builder::string_builder b(doc.size() * 2 + 64);
    uint64_t h = 0;
    size_t len = 0;
    int64_t elapsed = 0;
    for (long r = 0; r < iterations; r++) {
      c[r % c.size()].start += 1;
      t0 = now_ns();
      b.clear();
      writeCatalog(b, c);
      std::string_view out = b.view();
      elapsed += now_ns() - t0;
      h = fold(h, foldBytes(0, out));
      len = out.size();
    }
    std::printf("serialize %" PRIu64 " %zu\nns %" PRId64 "\n", h, len, elapsed);
  } else {
    std::fprintf(stderr, "unknown workload %s\n", argv[1]);
    return 2;
  }
  return 0;
}
