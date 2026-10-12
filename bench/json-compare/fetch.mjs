#!/usr/bin/env node
// Fetches what bench/json-compare needs and the repository does not carry: the
// three nativejson-benchmark corpora and the sources of the C and C++
// comparators. Each file is pinned by a URL at a fixed commit and by its
// sha256, and lands in bench/json-compare/cache/, which git ignores; nothing
// here is vendored. A file already in the cache with the right hash is kept,
// and one with the wrong hash is fetched again; a download whose hash differs
// from the pin is an error, never a file in the cache.
//
//   node bench/json-compare/fetch.mjs        fetch what is missing, print the cache
//
// RapidJSON is fetched header by header, only the ones its Reader includes:
// the repository's bin/jsonchecker files carry the JSON licence ("Good, not
// Evil"), which .claude/licensing.md does not allow, so no archive of the
// repository and none of those files is ever downloaded. serde_json comes
// from crates.io through the committed serde/cargo.lock, and Go's
// encoding/json from the Go installation.
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const CACHE = path.join(import.meta.dirname, "cache")

const RAW = "https://raw.githubusercontent.com"
const CORPORA_AT = `${RAW}/miloyip/nativejson-benchmark/478d5727c2a4048e835a29c65adecc7d795360d5/data`
const SIMDJSON_AT = `${RAW}/simdjson/simdjson/b4a0fd3ff4f00c4a5a9ab86046f06daa471a3b57/singleheader` // v4.4.2
const YYJSON_AT = `${RAW}/ibireme/yyjson/8b4a38dc994a110abaec8a400615567bd996105f/src` // 0.12.0
const RAPIDJSON_AT = `${RAW}/Tencent/rapidjson/24b5e7a8b27f42fa16b96fc70aade9106cf7102f/include/rapidjson`

/** Every pinned file: where it lands under the cache, where it comes from, and its sha256. */
const PINS = [
  {
    file: "corpus/twitter.json",
    url: `${CORPORA_AT}/twitter.json`,
    sha256: "a08b769f32b95f426cbc3abafcec65c1a19d3eb544d4ddf320eae142c99efc5d",
  },
  {
    file: "corpus/citm_catalog.json",
    url: `${CORPORA_AT}/citm_catalog.json`,
    sha256: "a73e7a883f6ea8de113dff59702975e60119b4b58d451d518a929f31c92e2059",
  },
  {
    file: "corpus/canada.json",
    url: `${CORPORA_AT}/canada.json`,
    sha256: "f83b3b354030d5dd58740c68ac4fecef64cb730a0d12a90362a7f23077f50d78",
  },
  {
    file: "simdjson/simdjson.h",
    url: `${SIMDJSON_AT}/simdjson.h`,
    sha256: "80bddfe786818b6f16c74c96d7d06764eb27c9fe13c5440ebec360a4db1a9ae6",
  },
  {
    file: "simdjson/simdjson.cpp",
    url: `${SIMDJSON_AT}/simdjson.cpp`,
    sha256: "ed9562b859fe2bb0faaf286ecb1cb3791774a2aef7d828667f2a6d0dad8739ae",
  },
  {
    file: "yyjson/yyjson.h",
    url: `${YYJSON_AT}/yyjson.h`,
    sha256: "175867c5493a5df648cec566717fa1c29aa2f6096f5f0cf1efad0b65e1f6d7b3",
  },
  {
    file: "yyjson/yyjson.c",
    url: `${YYJSON_AT}/yyjson.c`,
    sha256: "ac2e9bbb2e2d9149d90878d40506a1d624fa0b33c979a11b61075c54782c6d6a",
  },
  ...[
    ["allocators.h", "ee030597b2a6bff53f1a6b7d449e093aa5db8bed510f38ea2d943f63dbeb5aca"],
    ["encodedstream.h", "394710616961270b0e4033c03a22b2e5b411958dc07eb4495ba36131648e3558"],
    ["encodings.h", "e14aaf9b77325443cb9a0ad6c234b52a88df55bf7e353d79bb87cc362b149531"],
    ["error/error.h", "648743428973469227f6b419f80a979809c33bb8d66c409c8f3775f4f7381121"],
    ["internal/biginteger.h", "f6fe43899a4ab84a94415ea08cfb6d3d72a9d86ab3158dcdfd8e78e57f8f0c20"],
    ["internal/clzll.h", "4ca3e63eaae4c67b049e8a6cbb532182e1d9c9023b7d992c556fcab0c2f4c045"],
    ["internal/diyfp.h", "b1c63c28dec8f82f7fdc2a39193d7a09a4c30343c3f008f060adc70e710e0a32"],
    ["internal/ieee754.h", "00757a3dc2aad5b90d915f9c49b378026dc612d49a7f057106d72b1ebd1a0105"],
    ["internal/meta.h", "5fcbfd72da1732926e4d0be2a1d79dce892f98d7b66879f818c57583a82505d3"],
    ["internal/pow10.h", "74cd5ef251a854565a36abe49521be4d8ed17a76e3d27231fd119fb9374a9364"],
    ["internal/stack.h", "1bc01f4623d7b4ed6e890220fa9753375c0f0fb87c8a84f41cd7eecf38a38cd2"],
    ["internal/strtod.h", "bb4045b6484549988ceabd307eabf4e4dd5b7740c876a81c21bed9fb83de8c2d"],
    ["internal/swap.h", "72acfabebd33f44869e7724603e57744da33337998b32443b66eaba58d2bbbfd"],
    ["memorystream.h", "a7bf789978c6d7dda7bb93c0c9555b7d53b3177cbf34c3998c7e18068a3723f5"],
    ["rapidjson.h", "c2ba9c671f6aae7737831ec17d9bc791f11ddae3cb9188c9f3bbae2f072c714c"],
    ["reader.h", "43cd0f9afc832c7011518f4d779022e6c3609df7918e854006252b3b24b30f87"],
    ["stream.h", "a3708a941a130a5679d2302368169852e5c4ca5f54758ea0e94caf61615c8ae0"],
  ].map(([file, sha256]) => ({
    file: `rapidjson/include/rapidjson/${file}`,
    url: `${RAPIDJSON_AT}/${file}`,
    sha256,
  })),
]

const sha256Of = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")

/** Fetches every pin that is missing from the cache or has the wrong hash; throws on a download that fails or does not match. */
export const fetchAll = () => {
  for (const pin of PINS) {
    const dest = path.join(CACHE, pin.file)
    if (fs.existsSync(dest) && sha256Of(dest) === pin.sha256) {
      continue
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const partial = `${dest}.partial`
    // curl rather than fetch(): it honours HTTPS_PROXY, which Node 22's fetch does not.
    const got = spawnSync("curl", ["-sSfL", "--retry", "3", "-o", partial, pin.url], { encoding: "utf8" })
    if (got.error !== undefined || got.status !== 0) {
      fs.rmSync(partial, { force: true })
      throw new Error(`fetching ${pin.url} failed: ${got.error?.message ?? got.stderr.trim()}`)
    }
    const actual = sha256Of(partial)
    if (actual !== pin.sha256) {
      fs.rmSync(partial, { force: true })
      throw new Error(`${pin.url} has sha256 ${actual}, pinned ${pin.sha256}`)
    }
    fs.renameSync(partial, dest)
    process.stderr.write(`fetched ${pin.file}\n`)
  }
}

if (process.argv[1] === import.meta.filename) {
  fetchAll()
  process.stdout.write(`${PINS.length} pinned files in ${path.relative(process.cwd(), CACHE) || "."}\n`)
}
