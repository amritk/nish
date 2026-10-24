#!/usr/bin/env node
/**
 * The software bill of materials a release attaches, as SPDX 2.3 JSON.
 *
 *   node scripts/sbom.mjs toolchain --asset <asset> --runner <label> --out <file>
 *   node scripts/sbom.mjs spdx --dir <release-dir> --version <v> --created <iso-time> --out <file>
 *
 * `release.yml` runs it twice. Each `binaries` row runs `toolchain` after it
 * builds, which writes down what built that row's compiler: the runner image,
 * clang (and so the LLVM version), the linker, Node and the seed. Only the row
 * itself can answer that, because the `release` job runs on one machine and
 * the compilers were built on four. The `release` job then runs `spdx` over
 * the directory every row's files were downloaded into, and attaches what it
 * writes beside the assets it describes.
 *
 * The document names four kinds of package. The npm package and the platform
 * packages it installs, and the native tarballs, each with the SHA-256 of the
 * file the release attaches. The code copied in from elsewhere that those
 * files carry, read from THIRD_PARTY_NOTICES.md's `## Files` table rather
 * than from a second list here: `node tests/run.js third-party-licence`
 * already keeps that table true to the tree, so reading it is what keeps
 * this document true as well. And each row's toolchain, as a build tool of
 * the tarball it built. Nothing is fetched and nothing is guessed: a field
 * this script cannot fill from those sources says NOASSERTION, which is
 * SPDX's own word for "not stated", rather than something plausible.
 */
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { platformPackageName } from "../bin/packaging.js"

const root = path.resolve(import.meta.dirname, "..")
const REPO = "amritk/nish"

const usage = () => {
  console.error(
    "usage: sbom.mjs toolchain --asset <asset> --runner <label> --out <file>\n" +
      "       sbom.mjs spdx --dir <release-dir> --version <v> --created <iso-time> --out <file>"
  )
  process.exit(2)
}

const [mode, ...args] = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? null : (args[i + 1] ?? null)
}
const required = (name) => {
  const value = flag(name)
  if (value === null || value === "") {
    console.error(`sbom.mjs ${mode}: ${name} is required`)
    usage()
  }
  return value
}

// The first line a command prints, on stdout or stderr. Apple's `ld -v` answers
// on stderr, which is why both are read; a tool that is not there is recorded as
// missing rather than failing the row, because the build that used it already
// passed and this record is about it, not a gate on it.
const firstLine = (command, commandArgs) => {
  const run = spawnSync(command, commandArgs, { encoding: "utf8" })
  if (run.error !== undefined) {
    return null
  }
  const line = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.split("\n").find((l) => l.trim() !== "")
  return line === undefined ? null : line.trim()
}

const toolchain = () => {
  const asset = required("--asset")
  const out = required("--out")
  // scripts/build.sh links with lld on Linux and with the system's ld64 on macOS,
  // so the linker worth naming is a different command on each.
  const linker = process.platform === "darwin" ? firstLine("ld", ["-v"]) : firstLine("ld.lld", ["--version"])
  const record = {
    asset,
    runner: required("--runner"),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    image:
      [process.env.ImageOS, process.env.ImageVersion].filter((v) => v !== undefined && v !== "").join(" ") ||
      null,
    clang: firstLine("clang", ["--version"]),
    linker,
    node: process.version,
    seed: firstLine(path.join(root, "build", "seed", "bin", "nish"), ["--version"]),
  }
  fs.writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`)
  console.log(`sbom.mjs: ${asset} was built with ${record.clang ?? "an unrecorded clang"}`)
}

// SPDX identifiers are letters, digits, `.` and `-` only.
const spdxId = (kind, name) => `SPDXRef-${kind}-${name.replace(/[^A-Za-z0-9.-]+/g, "-")}`

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")

// The upstream projects THIRD_PARTY_NOTICES.md names, each with the files of
// ours it is copied into. A `### \`<licence text>\`` section names the project
// in its first link and, when the copy was taken from a fixed revision, says
// which; the `## Files` table maps each of our files to its licence and its
// licence text, which is how a file finds its section.
const vendored = (noticesText, ships) => {
  const sections = new Map()
  const rows = []
  let section = ""
  let licenceText = null
  for (const line of noticesText.split("\n")) {
    if (line.startsWith("## ")) {
      section = line
      licenceText = null
    }
    const heading = /^### `([^`]+)`$/.exec(line)
    if (heading !== null) {
      licenceText = heading[1]
      sections.set(licenceText, "")
      continue
    }
    if (licenceText !== null) {
      sections.set(licenceText, `${sections.get(licenceText)}${line}\n`)
    }
    const row = section === "## Files" ? /^\| `([^`]+)` \|.*\| ([^|]+) \| `([^`]+)` \|$/.exec(line) : null
    if (row !== null) {
      rows.push({ file: row[1], licence: row[2].trim(), licenceText: row[3] })
    }
  }
  const components = new Map()
  for (const { file, licence, licenceText: text } of rows) {
    if (!ships(file)) {
      continue
    }
    const prose = (sections.get(text) ?? "").replace(/\s+/g, " ")
    const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(prose)
    if (link === null) {
      throw new Error(`THIRD_PARTY_NOTICES.md: the section for ${text} names no upstream project to link to`)
    }
    const revision = /at (?:commit|tag) `([^`]+)`/.exec(prose)
    const component = components.get(text) ?? {
      name: link[1],
      url: link[2],
      revision: revision === null ? null : revision[1],
      licence,
      licenceText: text,
      files: [],
    }
    if (!component.files.includes(file)) {
      component.files.push(file)
    }
    components.set(text, component)
  }
  return [...components.values()]
}

// The version a `--version` line states, or NOASSERTION when it states none we
// can read: "Ubuntu clang version 18.1.3 (1ubuntu1)", "Ubuntu LLD 18.1.3
// (compatible with GNU linkers)", "@(#)PROGRAM:ld PROJECT:ld-1115.7.3", "nish 0.20.0".
const versionOf = (line) => {
  const match = /(?:version |LLD |PROJECT:ld-|^nish )v?([0-9][^\s)]*)/.exec(line ?? "")
  return match === null ? "NOASSERTION" : match[1]
}
const toolName = (line, fallback) => {
  if (/PROJECT:ld/.test(line ?? "")) {
    return "Apple ld64"
  }
  if (/\bLLD\b/.test(line ?? "")) {
    return "LLD"
  }
  if (/clang/.test(line ?? "")) {
    return "clang (LLVM)"
  }
  return fallback
}

const spdx = () => {
  const dir = required("--dir")
  const version = required("--version")
  const created = new Date(required("--created"))
  const out = required("--out")
  if (Number.isNaN(created.getTime())) {
    console.error(`sbom.mjs spdx: --created ${flag("--created")} is not a time`)
    process.exit(2)
  }
  const tag = `v${version}`
  const releaseUrl = (file) => `https://github.com/${REPO}/releases/download/${tag}/${file}`
  const files = fs.readdirSync(dir).sort()

  const packages = []
  const relationships = []
  const relate = (a, type, b) =>
    relationships.push({ spdxElementId: a, relationshipType: type, relatedSpdxElement: b })
  const fileFacts = (file) => ({
    packageFileName: file,
    checksums: [{ algorithm: "SHA256", checksumValue: sha256(path.join(dir, file)) }],
  })

  const main = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const mainId = spdxId("Package", "npm-nish")
  const packed = `${main.name}-${version}.tgz`
  if (!files.includes(packed)) {
    console.error(`sbom.mjs spdx: ${dir} has no ${packed}; pack the npm package before describing it`)
    process.exit(1)
  }
  packages.push({
    SPDXID: mainId,
    name: main.name,
    versionInfo: version,
    downloadLocation: releaseUrl(packed),
    ...fileFacts(packed),
    homepage: `https://github.com/${REPO}`,
    supplier: "Organization: the nish authors",
    licenseConcluded: "NOASSERTION",
    licenseDeclared: main.license,
    copyrightText: "NOASSERTION",
    filesAnalyzed: false,
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:npm/${main.name}@${version}`,
      },
    ],
  })
  relate("SPDXRef-DOCUMENT", "DESCRIBES", mainId)

  // Everything that carries runtime/ and std/: the npm package, each native
  // tarball and each platform package. Each contains every vendored component
  // below, because each copies those two directories whole.
  const carriers = [mainId]
  const assets = files
    .map((file) => new RegExp(`^nish-${version.replace(/\./g, "\\.")}-(.+)\\.tar\\.gz$`).exec(file))
    .filter((m) => m !== null)
    .map((m) => m[1])
  if (assets.length === 0) {
    console.error(`sbom.mjs spdx: ${dir} has no nish-${version}-<asset>.tar.gz to describe`)
    process.exit(1)
  }
  const tools = new Map()
  for (const asset of assets) {
    const tarball = `nish-${version}-${asset}.tar.gz`
    const assetId = spdxId("Package", `nish-${asset}`)
    packages.push({
      SPDXID: assetId,
      name: `nish-${asset}`,
      versionInfo: version,
      downloadLocation: releaseUrl(tarball),
      ...fileFacts(tarball),
      supplier: "Organization: the nish authors",
      licenseConcluded: "NOASSERTION",
      licenseDeclared: main.license,
      copyrightText: "NOASSERTION",
      filesAnalyzed: false,
      comment: `The native compiler for ${asset}, with the runtime/, std/ and scripts/build.sh it links with.`,
    })
    relate("SPDXRef-DOCUMENT", "DESCRIBES", assetId)
    carriers.push(assetId)

    const platform = platformPackageName(asset)
    const platformFile = `${platform.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`
    if (files.includes(platformFile)) {
      const platformId = spdxId("Package", `npm-${platform}`)
      packages.push({
        SPDXID: platformId,
        name: platform,
        versionInfo: version,
        downloadLocation: releaseUrl(platformFile),
        ...fileFacts(platformFile),
        supplier: "Organization: the nish authors",
        licenseConcluded: "NOASSERTION",
        licenseDeclared: main.license,
        copyrightText: "NOASSERTION",
        filesAnalyzed: false,
        externalRefs: [
          {
            referenceCategory: "PACKAGE-MANAGER",
            referenceType: "purl",
            referenceLocator: `pkg:npm/${platform.replace(/^@/, "%40")}@${version}`,
          },
        ],
        comment: `The npm package that installs ${tarball}'s contents; the same files, with a package.json.`,
      })
      relate(platformId, "OPTIONAL_DEPENDENCY_OF", mainId)
      carriers.push(platformId)
    }

    // A tarball with no record of what built it would be a gap in exactly the
    // part of this document nothing else can fill, so it is refused here
    // rather than published with the gap.
    const recordFile = `toolchain-${asset}.json`
    if (!files.includes(recordFile)) {
      console.error(`sbom.mjs spdx: ${dir} has ${tarball} but no ${recordFile} saying what built it`)
      process.exit(1)
    }
    const record = JSON.parse(fs.readFileSync(path.join(dir, recordFile), "utf8"))
    const used = [
      { line: record.clang, fallback: "clang (LLVM)" },
      { line: record.linker, fallback: "linker" },
      {
        line: `node ${record.node}`,
        fallback: "Node.js",
        name: "Node.js",
        version: String(record.node).replace(/^v/, ""),
      },
      { line: record.seed, fallback: "nish (the seed)", name: "nish (the seed)" },
    ]
    for (const tool of used) {
      const name = tool.name ?? toolName(tool.line, tool.fallback)
      const toolVersion = tool.version ?? versionOf(tool.line)
      const id = spdxId("Tool", `${name}-${toolVersion}`)
      if (!tools.has(id)) {
        tools.set(id, {
          SPDXID: id,
          name,
          versionInfo: toolVersion,
          downloadLocation: "NOASSERTION",
          licenseConcluded: "NOASSERTION",
          licenseDeclared: "NOASSERTION",
          copyrightText: "NOASSERTION",
          filesAnalyzed: false,
          comment: tool.line ?? "not recorded on the runner that built it",
        })
      }
      relate(id, "BUILD_TOOL_OF", assetId)
    }
    packages[packages.findIndex((p) => p.SPDXID === assetId)].comment +=
      ` Built on ${record.runner} (${[record.image, record.os, record.arch].filter((v) => v).join(", ")}).`
  }
  packages.push(...tools.values())

  const pkgFiles = main.files
  const ships = (file) =>
    pkgFiles.some((entry) => !entry.startsWith("!") && (file === entry || file.startsWith(`${entry}/`))) &&
    !pkgFiles.includes(`!${file}`)
  for (const component of vendored(
    fs.readFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8"),
    ships
  )) {
    const id = spdxId("Vendored", component.name)
    packages.push({
      SPDXID: id,
      name: component.name,
      versionInfo: component.revision ?? "NOASSERTION",
      downloadLocation: component.url,
      homepage: component.url,
      licenseConcluded: component.licence,
      licenseDeclared: component.licence,
      copyrightText: "NOASSERTION",
      filesAnalyzed: false,
      comment: `Copied into ${component.files.join(", ")}; the licence text ships as ${component.licenceText} (THIRD_PARTY_NOTICES.md).`,
    })
    for (const carrier of carriers) {
      relate(carrier, "CONTAINS", id)
    }
  }

  const document = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `nish-${version}`,
    documentNamespace: `https://github.com/${REPO}/releases/tag/${tag}/sbom.spdx.json`,
    creationInfo: {
      created: created.toISOString().replace(/\.\d{3}Z$/, "Z"),
      creators: ["Tool: scripts/sbom.mjs", "Organization: the nish authors"],
    },
    packages,
    relationships,
  }
  fs.writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`)
  console.log(
    `sbom.mjs: ${out} names ${packages.length} packages (${assets.length} native, ${tools.size} build tools)`
  )
}

if (mode === "toolchain") {
  toolchain()
} else if (mode === "spdx") {
  spdx()
} else {
  usage()
}
