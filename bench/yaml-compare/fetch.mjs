#!/usr/bin/env node
// Fetches what bench/yaml-compare needs and the repository does not carry:
// five YAML streams of different shapes and @amritk/yaml, the parser it is
// compared with. Each file is pinned by a URL at a fixed commit, tag or
// version and by its sha256, and lands in bench/yaml-compare/cache/, which
// git ignores; nothing here is vendored, and @amritk/yaml is not a dependency
// in package.json. A file already in the cache with the right hash is kept,
// and one with the wrong hash is fetched again; a download whose hash differs
// from the pin is an error, never a file in the cache.
//
//   node bench/yaml-compare/fetch.mjs        fetch what is missing, print the cache
//
// The fixtures and their licences (every one in .claude/licensing.md's list):
//
//   openapi.yaml          GitHub's REST API description, one 10 MB document  MIT
//   cert-manager.yaml     cert-manager's release manifest, 55 Kubernetes
//                         documents, CRD schemas mostly                       Apache-2.0
//   citm_catalog.json     nativejson-benchmark's citm_catalog, JSON read as
//                         YAML: flow collections only                         MIT
//   deno-ci.yml           Deno's generated CI workflow, 300 block scalars     MIT
//   airflow-compose.yaml  Airflow's docker-compose file, anchors, aliases and
//                         `<<` merge keys                                     Apache-2.0
//
// @amritk/yaml 0.8.0 (MIT) comes from the npm registry as its tarball, which
// tar unpacks into cache/amritk-yaml/; node-bench.mjs imports its
// dist/index.js.
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const CACHE = path.join(import.meta.dirname, "cache")

const RAW = "https://raw.githubusercontent.com"

/** The fixtures, in the order run.mjs reports them: the file under cache/fixtures/, its URL and its sha256. */
export const FIXTURES = [
  {
    file: "openapi.yaml",
    url: `${RAW}/github/rest-api-description/755ee33b4a81d51f6f07a902cce26cbec3b822f2/descriptions/api.github.com/api.github.com.yaml`,
    sha256: "258505f253efda24d0c3156203a8d632fa055154d5f16a8327043f4e0ceea7bc",
  },
  {
    file: "cert-manager.yaml",
    url: "https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml",
    sha256: "1d51cdecd442f1f5f89783e9e0169b95d372724da203cc75dd7a5c4e50a10ce6",
  },
  {
    file: "citm_catalog.json",
    url: `${RAW}/miloyip/nativejson-benchmark/478d5727c2a4048e835a29c65adecc7d795360d5/data/citm_catalog.json`,
    sha256: "a73e7a883f6ea8de113dff59702975e60119b4b58d451d518a929f31c92e2059",
  },
  {
    file: "deno-ci.yml",
    url: `${RAW}/denoland/deno/d7205acbed60f68414d1485407a5b50bc867131e/.github/workflows/ci.generated.yml`,
    sha256: "06f8c50a4c3706d9045aba6ce79e62eea32c62182d5741dba76ddfe17a184aa0",
  },
  {
    file: "airflow-compose.yaml",
    url: `${RAW}/apache/airflow/7e02d460c8a75d58fb3ebc0c9833844eec429c78/airflow-core/docs/howto/docker-compose/docker-compose.yaml`,
    sha256: "96806d5e14083947e8f3c16fe1d677a2953e8053e591cf58ce890112de8323d9",
  },
]

const AMRITK_YAML = {
  version: "0.8.0",
  url: "https://registry.npmjs.org/@amritk/yaml/-/yaml-0.8.0.tgz",
  sha256: "f1f502da0d46de7a0a9f095a1d2d9b9c50c08b9a0513e003109b5ff55fcb8ae6",
}

/** The path of a fixture in the cache. */
export const fixturePath = (file) => path.join(CACHE, "fixtures", file)

/** The entry point node-bench.mjs imports @amritk/yaml from. */
export const AMRITK_YAML_ENTRY = path.join(CACHE, "amritk-yaml", "package", "dist", "index.js")

export const AMRITK_YAML_VERSION = AMRITK_YAML.version

const sha256Of = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")

/** Fetches `url` to `dest` unless it is already there with `sha256`; returns whether it fetched. */
const pin = (dest, url, sha256) => {
  if (fs.existsSync(dest) && sha256Of(dest) === sha256) {
    return false
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const partial = `${dest}.partial`
  // curl rather than fetch(): it honours HTTPS_PROXY, which Node 22's fetch does not.
  const got = spawnSync("curl", ["-sSfL", "--retry", "3", "-o", partial, url], { encoding: "utf8" })
  if (got.error !== undefined || got.status !== 0) {
    fs.rmSync(partial, { force: true })
    throw new Error(`fetching ${url} failed: ${got.error?.message ?? got.stderr.trim()}`)
  }
  const actual = sha256Of(partial)
  if (actual !== sha256) {
    fs.rmSync(partial, { force: true })
    throw new Error(`${url} has sha256 ${actual}, pinned ${sha256}`)
  }
  fs.renameSync(partial, dest)
  process.stderr.write(`fetched ${path.relative(CACHE, dest)}\n`)
  return true
}

/**
 * Fetches every fixture and @amritk/yaml that is missing from the cache or has
 * the wrong hash, and unpacks the tarball when it was fetched or never
 * unpacked; throws on a download that fails or does not match.
 */
export const fetchAll = () => {
  for (const f of FIXTURES) {
    pin(fixturePath(f.file), f.url, f.sha256)
  }
  const tgz = path.join(CACHE, `amritk-yaml-${AMRITK_YAML.version}.tgz`)
  const fetched = pin(tgz, AMRITK_YAML.url, AMRITK_YAML.sha256)
  if (fetched || !fs.existsSync(AMRITK_YAML_ENTRY)) {
    const dir = path.join(CACHE, "amritk-yaml")
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const tar = spawnSync("tar", ["-xzf", tgz, "-C", dir], { encoding: "utf8" })
    if (tar.error !== undefined || tar.status !== 0 || !fs.existsSync(AMRITK_YAML_ENTRY)) {
      throw new Error(`unpacking ${tgz} failed: ${tar.error?.message ?? tar.stderr.trim()}`)
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  fetchAll()
  process.stdout.write(
    `${FIXTURES.length} fixtures and @amritk/yaml ${AMRITK_YAML.version} in ${path.relative(process.cwd(), CACHE) || "."}\n`
  )
}
