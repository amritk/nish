#!/usr/bin/env node
/**
 * `nish-cmp` — one corpus, two compilers, byte for byte (WP19 §3 gate G2.1).
 *
 *   node tests/nish-cmp.js --help
 *   node tests/nish-cmp.js --reference <released nish> --candidate build/self/compile
 *   NISH_BOOTSTRAP=/usr/local/bin/nish node tests/nish-cmp.js
 *   node tests/nish-cmp.js -r <ref> -c <cand> tests/cases/str_concat.ts
 *   node tests/nish-cmp.js -r <ref> -c <cand> --verbose --lines 10
 *
 * This is Go's `toolstash -cmp`. Compile the whole corpus with the compiler
 * that is trusted — the last released `nish` — and with the compiler HEAD
 * builds, and require every byte of every file they write to be the same. It
 * is the successor to `tests/self/ir_oracle.js` and
 * `tests/self/interop_oracle.js`, which compared stage0 with stage1 and were
 * deleted with stage0 (`docs/wp19-stage0-retirement.md` §2B), so it compares
 * what the two of them compared together: the IR of every module of every program, and
 * the four WP8 sidecars derived from the same checked program.
 *
 * **Both compilers are parameters, and neither is assumed to exist.** Nish has
 * never been tagged — 0.1.0 is about to be its first release — so a tool that
 * assumed a released `nish` was on disk could not run at all today, and one
 * that quietly compared HEAD with itself would be worse than not running.
 * `--reference` therefore defaults to `$NISH_BOOTSTRAP`, the variable
 * `scripts/bootstrap.sh` reads for the seed (G3), and when there is no seed
 * anywhere the run **skips and says why**, in the runner's own words, because
 * a green line that proved nothing is the failure mode `.claude/orientation.md`
 * warns about.
 *
 * Either compiler may be a native binary or a Node entry point: the seed after
 * 0.1.0 is a binary and today's compiler is a Node program, so both have to be
 * spellable. The rule is the file's extension — `.js`, `.mjs` and `.cjs` run
 * under `node`, anything else is executed directly.
 *
 * **What is compared, and what is deliberately not.**
 *
 *   - every file the compilers write, byte for byte: one `.ll` per module, and
 *     `<stem>.h`, `<stem>.d.ts`, its companion `<stem>.mjs` and `<stem>.napi.c`
 *     unless `--no-sidecars`. The *set* of files counts too, so a version that
 *     wrote one module fewer has not agreed about the rest;
 *   - whether the program compiles at all. A program the reference accepts and
 *     the candidate refuses is the regression this tool exists to catch, and a
 *     program the reference refuses and the candidate accepts is a language
 *     change, which is a CHANGELOG line rather than a silent improvement;
 *   - not the wording of diagnostics, and not the dumps. A program both
 *     compilers refuse is counted and named apart (there is no artefact on
 *     either side); its message is pinned by the `.err` fragments checked in
 *     beside it, which `tests/self/reject-oracle.js` reads. A program compiled with `--emit-ast` or `--emit-checked` writes
 *     no artefact either, and its stdout is pinned by the `<name>.stdout`
 *     golden beside it. Both are counted in the summary rather than folded
 *     into a skip count;
 *   - not **where each compiler's own standard library lives**. A module
 *     reached as `nish/<name>` is resolved against the compiler's own package
 *     root and then named by the path it was found at, so the seed writes
 *     `; ModuleID = '<where the seed is unpacked>/std/text.ts'` and HEAD writes
 *     `std/text.ts` — the same module, named by each compiler's own install.
 *     Two compilers are never installed in one place, so this is a property no
 *     run of this tool can compare rather than a difference it may forgive:
 *     each side's own root is removed before the bytes are compared, which
 *     leaves the module's path *relative to its own package* on both sides, and
 *     the summary says how many files needed it. The same goes for a file's
 *     *name*: a module whose basename another shares is written under its
 *     path, and that path starts with the compiler's own root.
 *     `packageRootOf` derives each root the way the compilers do,
 *     `withoutOwnRoot` and `withoutOwnRootNames` remove it, and
 *     `selfCheckRoots` drives them over fabricated inputs on every run, because
 *     a comparison whose own logic nothing exercises is the gap
 *     `docs/wp19-stage0-retirement.md` §5a records about every other oracle
 *     here. What is *not* set aside is anything else on those lines: a path
 *     that is not under the compiler's own root is compared as it stands;
 *   - not **each compiler's own version in the DWARF `producer`**. A `-g`
 *     build records `producer: "nish <version>"`, and the reference is the
 *     *last* release while HEAD already carries the next version number from
 *     the moment the release pull request bumps it — so without this, every
 *     `-g` case goes red at every release, on the release pull request and on
 *     every branch after it until the release is published and becomes the
 *     seed. `tests/run.js`'s `normaliseProducer` lets the same digits go for
 *     the goldens. It is removed the way the root is: each side's *own*
 *     version, as its `--version` prints it, and only inside a `producer:`
 *     string, so a candidate that records any version but its own — the
 *     reference's, a stale constant — still differs. `withoutOwnVersion` does
 *     it, `selfCheckVersions` drives it over fabricated inputs on every run,
 *     and the summary counts the files that needed it.
 *
 * **A difference must be named in the release notes.** `DECLARED` below is
 * how: an entry names the program and the file that may differ, the sentence
 * saying why, and the words the notes have to carry for the declaration to
 * hold. It names at least a program, a file or an `undo`: one naming none
 * would excuse every difference in every program, and `selfCheckDeclarations`
 * refuses it before anything is compiled. The notes are `CHANGELOG.md` for what has been released, and for what
 * has not, the section `scripts/changelog-gen.mjs` would render from the
 * commits since the last release tag — the words a pull request's own subject
 * will land as. `CHANGELOG.md` is written by that generator when a release is
 * cut, so a hand-written line there is duplicated by the next release; reading
 * the generator's pending section instead lets a pull request name its change
 * without touching the file. A difference no entry covers fails the run; an
 * entry whose words are in neither fails the run as well, so the release note
 * and the tool cannot drift apart. The intent is that the list stays short: it
 * is a record of intended output changes for one release, not an allowlist to
 * grow.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { extraArgs, linkPrograms, programs, root } from "./self/corpus.js"

/** The two `--emit-header` comment lines the 0.37.0 seed writes. */
const SEED_HEADER_LINES = [
  " * C ABI of the Nish modules listed below. Link the .ll module(s) and",
  " * runtime/runtime.c next to your C code; include runtime/nish.h's",
].join("\n")

/**
 * The five lines WP50 writes in their place: stage 4 names `runtime-text.c`
 * and `runtime-os.c`, stage 5 the `-ffp-contract=off` every unit is compiled with.
 */
const STAGE4_HEADER_LINES = [
  " * C ABI of the Nish modules listed below. Link the .ll module(s),",
  " * runtime/runtime.c, runtime/runtime-text.c (strings and number formatting)",
  " * and runtime/runtime-os.c, compiled with -ffp-contract=off, next to your C",
  " * code, or hand runtime/runtime.c to scripts/build.sh, which does both;",
  " * include runtime/nish.h's",
].join("\n")

/**
 * `text` with the stage 4 header comment put back as the seed wrote it. A
 * declaration's `undo`: it touches only those five lines, so any other change
 * to a `.h` still differs.
 */
const withoutStage4Header = (text) => text.split(STAGE4_HEADER_LINES).join(SEED_HEADER_LINES)

/** The `--emit-dts` preamble lines the 0.37.0 seed writes about string functions. */
const SEED_DTS_PREAMBLE = [
  "// String functions are not callable from the freestanding wasm profile and",
  "// are listed below as comments.",
].join("\n")

/** The two lines WP50 stage 4 writes in their place. */
const STAGE4_DTS_PREAMBLE = [
  "// A string result is decoded into a JS string; a function that takes a",
  "// string, or answers what needs the full runtime, is listed below as a comment.",
].join("\n")

/** The reason the 0.37.0 seed gives for leaving a string argument out of the wasm bridge. */
const SEED_DTS_STRING_ARG = "which needs the Nish runtime the freestanding wasm profile does not include"

/** The reason WP50 stage 4 gives for the same argument, naming the page's way in. */
const STAGE4_DTS_STRING_ARG =
  "which the wasm bridge carries only as a result: have the page `encodeInto` module storage and pass the byte count (`nish/host/text`)"

/**
 * `text` with the stage 4 `--emit-dts` comments put back as the seed wrote
 * them: the preamble and the reason a string argument is left out. A
 * declaration's `undo`: a `.d.ts` that also gained an export, such as a string
 * result the bridge now decodes, still differs and is named below.
 */
const withoutStage4Dts = (text) =>
  text
    .split(STAGE4_DTS_PREAMBLE)
    .join(SEED_DTS_PREAMBLE)
    .split(`\`string\`, ${STAGE4_DTS_STRING_ARG}`)
    .join(`\`string\`, ${SEED_DTS_STRING_ARG}`)

/**
 * The programs with a function that returns a `string` and so, since WP50
 * stage 4, export it to the page: the `--emit-dts` reading gains the function
 * (and `nish_reset_arena` / `nish_free_arena`, since the module now links
 * `runtime-wasm.c`), and the `.mjs` loader gains the decoder, the arena
 * helpers and the build line naming `runtime-wasm.c`. Each is declared for
 * those two files only, so its IR and header are still compared.
 */
const STAGE4_STRING_EXPORTS = [
  "bench/http1-parse/main.ts",
  "bench/lexer.ts",
  "docs/cookbook/mem-join-parts.ts",
  "docs/cookbook/mem-return-array.ts",
  "examples/label.ts",
  "examples/relay/main.ts",
  "src/annotations.ts",
  "src/arena-report.ts",
  "src/arrays.ts",
  "src/assignment.ts",
  "src/ast-text.ts",
  "src/async-check.ts",
  "src/attributes.ts",
  "src/bounds.ts",
  "src/break-game.ts",
  "src/break-intro.ts",
  "src/break-levels.ts",
  "src/break-menu.ts",
  "src/break-sound.ts",
  "src/break.ts",
  "src/build-cache.ts",
  "src/builtins.ts",
  "src/capabilities.ts",
  "src/capability-lock.ts",
  "src/capability-report.ts",
  "src/checker.ts",
  "src/cli-style.ts",
  "src/compilation.ts",
  "src/compile.ts",
  "src/constants.ts",
  "src/context.ts",
  "src/debug.ts",
  "src/declarations.ts",
  "src/diagnostics.ts",
  "src/dump-ast.ts",
  "src/dump-checked.ts",
  "src/dump-tokens.ts",
  "src/dump.ts",
  "src/emit-arrays.ts",
  "src/emit-async.ts",
  "src/emit-builtins.ts",
  "src/emit-classes.ts",
  "src/emit-control.ts",
  "src/emit-json.ts",
  "src/emit-map.ts",
  "src/emit-ops.ts",
  "src/emit-parallel.ts",
  "src/emit-region.ts",
  "src/emit-result.ts",
  "src/emit-secret.ts",
  "src/emit-shm-window.ts",
  "src/emit-strings.ts",
  "src/emit-ts-control.ts",
  "src/emit-ts-edits.ts",
  "src/emit-ts-numbers.ts",
  "src/emit-ts-records.ts",
  "src/emit-ts-storage.ts",
  "src/emit-ts-strings.ts",
  "src/emit-ts.ts",
  "src/emit-util.ts",
  "src/emit.ts",
  "src/escape.ts",
  "src/expressions.ts",
  "src/fix.ts",
  "src/fusion.ts",
  "src/generics.ts",
  "src/handles.ts",
  "src/host-module.ts",
  "src/ice.ts",
  "src/inline-arrays.ts",
  "src/interop-abi.ts",
  "src/interop-dts.ts",
  "src/interop-header.ts",
  "src/interop-napi.ts",
  "src/interop-wasm.ts",
  "src/ir.ts",
  "src/json-typed.ts",
  "src/kernels.ts",
  "src/lexer.ts",
  "src/loop-flow.ts",
  "src/manifest.ts",
  "src/members.ts",
  "src/module-storage.ts",
  "src/nish-modules.ts",
  "src/nodes.ts",
  "src/options.ts",
  "src/packages.ts",
  "src/panics.ts",
  "src/parallel.ts",
  "src/parents.ts",
  "src/parser.ts",
  "src/paths.ts",
  "src/portability-numbers.ts",
  "src/portability-records.ts",
  "src/portability-strings.ts",
  "src/portability.ts",
  "src/program.ts",
  "src/ranges.ts",
  "src/region-check.ts",
  "src/region-rules.ts",
  "src/region.ts",
  "src/result.ts",
  "src/run-cache.ts",
  "src/script.ts",
  "src/secret.ts",
  "src/shm-window.ts",
  "src/simd.ts",
  "src/statements.ts",
  "src/std-modules.ts",
  "src/strings.ts",
  "src/structs.ts",
  "src/symbols.ts",
  "src/tbaa.ts",
  "src/tokens.ts",
  "src/types.ts",
  "src/validator.ts",
  "src/visibility.ts",
  "src/watch.ts",
  "tests/cases/ct_asm_refused.ts",
  "tests/cases/diag_order.ts",
  "tests/cases/diag_order_pass1.ts",
  "tests/differential/corpus/const_modules/main.ts",
  "tests/link/async_await_all_lanes/main.ts",
  "tests/link/break_intro/main.ts",
  "tests/link/break_menu/main.ts",
  "tests/link/break_settings/main.ts",
  "tests/link/break_sound/main.ts",
  "tests/link/crypto_held_derive/main.ts",
  "tests/link/crypto_hkdf_expand_label/main.ts",
  "tests/link/crypto_hkdf_expand_label_f64/main.ts",
  "tests/link/crypto_hkdf_expand_label_long_label/main.ts",
  "tests/link/crypto_x509/main.ts",
  "tests/link/crypto_x509_audit/main.ts",
  "tests/link/crypto_x509_f64/main.ts",
  "tests/link/crypto_x509_malformed/main.ts",
  "tests/link/generic_method_import/main.ts",
  "tests/link/generic_two_importers/main.ts",
  "tests/link/module_stem_clash/main.ts",
  "tests/link/net_fetch_async/main.ts",
  "tests/link/net_fetch_async_flat/main.ts",
  "tests/link/net_fetch_async_https/main.ts",
  "tests/link/net_fetch_async_https_flat/main.ts",
  "tests/link/net_fetch_async_overlap/main.ts",
  "tests/link/net_fetch_async_policy/main.ts",
  "tests/link/net_hpack/main.ts",
  "tests/link/net_hpack_f64/main.ts",
  "tests/link/net_http1_parse_diff/main.ts",
  "tests/link/net_http1_server/main.ts",
  "tests/link/net_http1_server_f64/main.ts",
  "tests/link/net_http2/main.ts",
  "tests/link/net_http2_bad_config_tls/main.ts",
  "tests/link/net_http2_errors/main.ts",
  "tests/link/net_http2_errors_f64/main.ts",
  "tests/link/net_http2_f64/main.ts",
  "tests/link/net_http2_frame/main.ts",
  "tests/link/net_http2_frame_f64/main.ts",
  "tests/link/net_http2_hpack_bomb/main.ts",
  "tests/link/net_http2_hpack_bomb_f64/main.ts",
  "tests/link/net_http2_hpack_table/main.ts",
  "tests/link/net_http2_hpack_table_f64/main.ts",
  "tests/link/net_http2_reset/main.ts",
  "tests/link/net_http2_tls/main.ts",
  "tests/link/net_http2_tls_f64/main.ts",
  "tests/link/net_http3/main.ts",
  "tests/link/net_http3_bad_body_chunk/main.ts",
  "tests/link/net_http3_bad_config/main.ts",
  "tests/link/net_http3_bad_credit/main.ts",
  "tests/link/net_http3_bad_local_limit/main.ts",
  "tests/link/net_http3_bad_uni_limit/main.ts",
  "tests/link/net_http3_bad_write_chunk/main.ts",
  "tests/link/net_http3_ecn/main.ts",
  "tests/link/net_http3_ecn_f64/main.ts",
  "tests/link/net_http3_errors/main.ts",
  "tests/link/net_http3_errors_f64/main.ts",
  "tests/link/net_http3_f64/main.ts",
  "tests/link/net_http3_frame/main.ts",
  "tests/link/net_http3_frame_f64/main.ts",
  "tests/link/net_http3_server/main.ts",
  "tests/link/net_http3_server_bad_config/main.ts",
  "tests/link/net_http3_server_f64/main.ts",
  "tests/link/net_http3_write_window/main.ts",
  "tests/link/net_http_fetch_tls/main.ts",
  "tests/link/net_interop_server/main.ts",
  "tests/link/net_interop_server_f64/main.ts",
  "tests/link/net_loopback/main.ts",
  "tests/link/net_loopback_f64/main.ts",
  "tests/link/net_qpack/main.ts",
  "tests/link/net_qpack_f64/main.ts",
  "tests/link/net_quic_conn/main.ts",
  "tests/link/net_quic_conn_f64/main.ts",
  "tests/link/net_quic_conn_parts/main.ts",
  "tests/link/net_quic_conn_parts_f64/main.ts",
  "tests/link/net_quic_conn_replay/main.ts",
  "tests/link/net_quic_conn_replay_f64/main.ts",
  "tests/link/net_quic_datagram/main.ts",
  "tests/link/net_quic_datagram_f64/main.ts",
  "tests/link/net_quic_ecn/main.ts",
  "tests/link/net_quic_ecn_f64/main.ts",
  "tests/link/net_quic_frame/main.ts",
  "tests/link/net_quic_frame_f64/main.ts",
  "tests/link/net_quic_lifecycle/main.ts",
  "tests/link/net_quic_lifecycle_f64/main.ts",
  "tests/link/net_quic_lifecycle_replay/main.ts",
  "tests/link/net_quic_lifecycle_replay_f64/main.ts",
  "tests/link/net_quic_listener/main.ts",
  "tests/link/net_quic_listener_bad_window/main.ts",
  "tests/link/net_quic_listener_f64/main.ts",
  "tests/link/net_quic_memory/main.ts",
  "tests/link/net_quic_memory_f64/main.ts",
  "tests/link/net_quic_packet/main.ts",
  "tests/link/net_quic_packet_f64/main.ts",
  "tests/link/net_quic_path/main.ts",
  "tests/link/net_quic_path_f64/main.ts",
  "tests/link/net_quic_recovery/main.ts",
  "tests/link/net_quic_recovery_f64/main.ts",
  "tests/link/net_quic_server_wipes/main.ts",
  "tests/link/net_quic_server_wipes_f64/main.ts",
  "tests/link/net_quic_stream/main.ts",
  "tests/link/net_quic_stream_f64/main.ts",
  "tests/link/net_quic_wipes/main.ts",
  "tests/link/net_quic_wipes_f64/main.ts",
  "tests/link/net_relay/main.ts",
  "tests/link/net_relay_bad_hello/main.ts",
  "tests/link/net_relay_bad_idle/main.ts",
  "tests/link/net_relay_bad_path/main.ts",
  "tests/link/net_relay_bad_per_peer/main.ts",
  "tests/link/net_relay_bad_pool/main.ts",
  "tests/link/net_relay_bad_rate/main.ts",
  "tests/link/net_relay_bad_sessions/main.ts",
  "tests/link/net_relay_bad_spare/main.ts",
  "tests/link/net_relay_bad_stats/main.ts",
  "tests/link/net_relay_f64/main.ts",
  "tests/link/net_relay_forged/main.ts",
  "tests/link/net_relay_soak/main.ts",
  "tests/link/net_tls_client_handshake/main.ts",
  "tests/link/net_tls_client_record/main.ts",
  "tests/link/net_tls_client_refusals/main.ts",
  "tests/link/net_tls_client_tcp/main.ts",
  "tests/link/net_tls_ecdsa/main.ts",
  "tests/link/net_tls_ecdsa_f64/main.ts",
  "tests/link/net_tls_ext_alpn/main.ts",
  "tests/link/net_tls_ext_f64/main.ts",
  "tests/link/net_tls_ext_hrr/main.ts",
  "tests/link/net_tls_ext_quic/main.ts",
  "tests/link/net_tls_ext_refusals/main.ts",
  "tests/link/net_tls_ext_sni/main.ts",
  "tests/link/net_tls_memory/main.ts",
  "tests/link/net_tls_memory_f64/main.ts",
  "tests/link/net_tls_psk_wire/main.ts",
  "tests/link/net_tls_psk_wire_f64/main.ts",
  "tests/link/net_tls_record_f64/main.ts",
  "tests/link/net_tls_record_refusals/main.ts",
  "tests/link/net_tls_record_rfc8448/main.ts",
  "tests/link/net_tls_record_tcp/main.ts",
  "tests/link/net_tls_record_tcp_f64/main.ts",
  "tests/link/net_tls_resume/main.ts",
  "tests/link/net_tls_resume_bench/main.ts",
  "tests/link/net_tls_resume_f64/main.ts",
  "tests/link/net_tls_rfc8448/main.ts",
  "tests/link/net_tls_rfc8448_f64/main.ts",
  "tests/link/net_tls_wipes/main.ts",
  "tests/link/net_tls_wipes_f64/main.ts",
  "tests/link/net_webtransport/main.ts",
  "tests/link/net_webtransport_bad_datagrams/main.ts",
  "tests/link/net_webtransport_bad_datagrams_off/main.ts",
  "tests/link/net_webtransport_bad_layer/main.ts",
  "tests/link/net_webtransport_bad_pending/main.ts",
  "tests/link/net_webtransport_bad_pending_high/main.ts",
  "tests/link/net_webtransport_bad_sessions/main.ts",
  "tests/link/net_webtransport_bad_streams/main.ts",
  "tests/link/net_webtransport_bad_streams_high/main.ts",
  "tests/link/net_webtransport_close_window/main.ts",
  "tests/link/net_webtransport_datagram_window/main.ts",
  "tests/link/net_webtransport_f64/main.ts",
  "tests/link/net_webtransport_stream_window/main.ts",
  "tests/link/net_webtransport_whole_window/main.ts",
  "tests/link/std_json_conformance/main.ts",
  "tests/link/std_json_value/main.ts",
  "tests/link/std_json_writer/main.ts",
  "tests/link/std_regex_unicode/main.ts",
  "tests/link/std_testing/main.ts",
  "tests/link/std_yaml/main.ts",
  "tests/link/tfb_entry/main.ts",
]

/** One declaration per program and sidecar `STAGE4_STRING_EXPORTS` names. */
const declareStringExports = (moved, changelog, why) =>
  moved.flatMap((program) => {
    const stem = path.basename(program, ".ts")
    return [`${stem}.d.ts`, `${stem}.mjs`].map((file) => ({
      program,
      file,
      changelog,
      why,
    }))
  })

/**
 * Output differences that are decided rather than broken, each with the words
 * `CHANGELOG.md` must carry before this run can go green. Shape:
 *
 *   {
 *     program: "tests/cases/str_concat.ts",  // omit only with a `file` or an `undo`
 *     file: "str_concat.ll",                 // omit for every file of it
 *     changelog: "string concatenation now calls `nish_str_concat2`",
 *     why: "one sentence somebody is willing to sign, in their own words",
 *   }
 *
 * `changelog` is matched against `CHANGELOG.md` and against the pending
 * release section (`pendingNotes`), so for an unreleased change it is the
 * pull request's subject as the generator renders it: the scope dropped, the
 * first letter raised, and no `(#N)`.
 *
 * A declaration is deliberately narrow — one program, one file — so that the
 * *next* difference in the same place is still reported. A change that moves
 * the IR of the whole corpus names the programs it moves, or carries an `undo`
 * that turns the candidate's file back into the reference's and so excuses
 * nothing else; an entry naming neither a program, a file nor an `undo` would
 * excuse every difference, and `selfCheckDeclarations` refuses it. The list is
 * for one release: the reseed that ships a change makes its entries match
 * nothing, the full run says so, and they go.
 */
const DNS_FALLBACK =
  "A DNS search fallback no longer masks a later NODATA, and resolveHost keeps an answered family at its timeout"
const dnsFallback = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: DNS_FALLBACK, why }))
  )
const ASYNC_FETCH = "Async fetch speaks https and resolves names without blocking"
const asyncFetch = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: ASYNC_FETCH, why }))
  )
const RESULT_LOOP =
  "Keep a Result made in a loop body and stored in an outer let alive past the pass's arena rewind"
const resultLoop = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: RESULT_LOOP, why }))
  )
const AWAIT_ALL_LANES = "Give each awaitAll lane its own region"
const awaitAllLanes = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: AWAIT_ALL_LANES, why }))
  )
const PAGE_MATH = "transcendentals"
const pageMath = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: PAGE_MATH, why }))
  )
const SERVE_CANCEL = "Cancel a task on hang-up, deadline or shutdown"
const serveCancel = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: SERVE_CANCEL, why }))
  )
const PIPELINED_WRITE = "answers pipelined requests in one write"
const pipelinedWrite = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: PIPELINED_WRITE, why }))
  )
const DATE_SINGLETON = "Refuse a response that carries two Date fields"
const dateSingleton = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: DATE_SINGLETON, why }))
  )
const TAGGED_UNIONS = "Typed JSON decodes and encodes tagged unions"
const taggedUnions = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: TAGGED_UNIONS, why }))
  )
const POOL_PIPELINE = "async Postgres pool pipelines queries across tasks"
const poolPipeline = (why, filesByProgram) =>
  Object.entries(filesByProgram).flatMap(([program, files]) =>
    files.map((file) => ({ program, file, changelog: POOL_PIPELINE, why }))
  )
const MSS_UNSET = "explicitly set enc.mss wins over the socket MSS"
const mssUnset = (why, moved) =>
  moved.map((program) => ({ program, file: "http-compress.ll", changelog: MSS_UNSET, why }))
/** The changelog line of the stage that adds `spawnPipedWithin`. */
const SPAWN_PIPED_WITHIN = "spawnPipedWithin, a captured run with a deadline"
/** The changelog line of the fix that arms a held HTTP/1 write for writing. */
const HELD_WRITE = "held HTTP/1 write keeps the write bit once a flush empties the output"
const heldWrite = (why, moved) =>
  moved.map((program) => ({ program, file: "http1-server.ll", changelog: HELD_WRITE, why }))

const DECLARED = [
  // The hygiene rules found a dead local in std/compress/deflate.ts.
  {
    file: "deflate.ll",
    changelog: "Refuse the mistakes every type accepts",
    why: "the hygiene rules found a local in std/compress/deflate.ts's Huffman length limiter that nothing read, and deleting it renumbers that function's allocas, so the module every importer of nish/compress writes moves; no importer's own module does",
  },
  // std/text.ts gains split, asciiUpper, asciiLower, padStart and padEnd.
  {
    file: "text.ll",
    changelog: "Split, asciiUpper, asciiLower, padStart and padEnd in nish/text",
    why: "std/text.ts gains split, asciiUpper, asciiLower, padStart and padEnd, so the module every importer of nish/text writes has new functions and renumbered string constants; no importer's own module moves",
  },
  {
    program: "tests/link/std_text_camel_case/main.ts",
    file: "exit",
    changelog: "Split, asciiUpper, asciiLower, padStart and padEnd in nish/text",
    why: "the program imports asciiLower, asciiUpper and split from nish/text, which the 0.37.0 seed's std/text.ts does not export, so only the candidate compiles it",
  },
  // #1362: std/regex.ts makes its tables through regexZeros/regexZeroBytes,
  // which moves regex.ll in the five corpus programs importing nish/regex.
  ...[
    "bench/regex/main.ts",
    "tests/link/caps_dep_std_not_refused/main.ts",
    "tests/link/std_json_format/main.ts",
    "tests/link/std_regex_node/main.ts",
    "tests/link/std_text_camel_case/main.ts",
  ].map((program) => ({
    program,
    file: "regex.ll",
    changelog: "regex no longer hangs under Node",
    why: "std/regex.ts zero-fills every table it reads before writing through two new helpers, regexZeros and regexZeroBytes, so the program's nish/regex module has new functions and calls; its own module does not move",
  })),
  // Stage 5a: an --emit-dts compile is a page module, so Math.sin, cos, exp,
  // log, pow and a float % in it call std/math.ts's copies (`@nish.<name>F64`)
  // instead of an intrinsic or `frem` a page could not link.
  ...pageMath(
    "on a page module (here the --emit-dts compile) Math.sin, cos, exp, log, pow and float % call copies of std/math.ts instead of an LLVM intrinsic or frem",
    {
      "bench/math.ts": ["math.ll"],
      "bench/pg-batch-clock.ts": ["pg-batch-clock.ll"],
      "examples/tasks.ts": ["tasks.ll"],
      "src/annotations.ts": ["constants.ll", "expressions.ll"],
      "src/arena-report.ts": ["constants.ll", "expressions.ll"],
      "src/arrays.ts": ["constants.ll", "expressions.ll"],
      "src/assignment.ts": ["constants.ll", "expressions.ll"],
      "src/async-check.ts": ["constants.ll", "expressions.ll"],
      "src/attributes.ts": ["constants.ll", "expressions.ll"],
      "src/bounds.ts": ["constants.ll", "expressions.ll"],
      "src/break-game.ts": ["break-game.ll", "break-levels.ll"],
      "src/break-intro.ts": ["break-game.ll", "break-levels.ll", "break-menu.ll"],
      "src/break-levels.ts": ["break-levels.ll"],
      "src/break-menu.ts": ["break-menu.ll"],
      "src/break-sound.ts": ["break-game.ll", "break-levels.ll", "break-sound.ll"],
      "src/break.ts": ["break-game.ll", "break-levels.ll", "break-menu.ll", "break-sound.ll"],
      "src/build-cache.ts": ["constants.ll", "expressions.ll"],
      "src/builtins.ts": ["constants.ll", "expressions.ll"],
      "src/capability-report.ts": ["constants.ll", "expressions.ll"],
      "src/checker.ts": ["constants.ll", "expressions.ll"],
      "src/compilation.ts": ["constants.ll", "expressions.ll"],
      "src/compile.ts": [
        "break-game.ll",
        "break-levels.ll",
        "break-menu.ll",
        "break-sound.ll",
        "constants.ll",
        "expressions.ll",
      ],
      "src/constants.ts": ["constants.ll", "expressions.ll"],
      "src/context.ts": ["constants.ll", "expressions.ll"],
      "src/debug.ts": ["constants.ll", "expressions.ll"],
      "src/declarations.ts": ["constants.ll", "expressions.ll"],
      "src/dump-checked.ts": ["constants.ll", "expressions.ll"],
      "src/dump.ts": ["constants.ll", "expressions.ll"],
      "src/emit-arrays.ts": ["constants.ll", "expressions.ll"],
      "src/emit-async.ts": ["constants.ll", "expressions.ll"],
      "src/emit-builtins.ts": ["constants.ll", "expressions.ll"],
      "src/emit-classes.ts": ["constants.ll", "expressions.ll"],
      "src/emit-control.ts": ["constants.ll", "expressions.ll"],
      "src/emit-json.ts": ["constants.ll", "expressions.ll"],
      "src/emit-map.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ops.ts": ["constants.ll", "expressions.ll"],
      "src/emit-parallel.ts": ["constants.ll", "expressions.ll"],
      "src/emit-region.ts": ["constants.ll", "expressions.ll"],
      "src/emit-result.ts": ["constants.ll", "expressions.ll"],
      "src/emit-secret.ts": ["constants.ll", "expressions.ll"],
      "src/emit-shm-window.ts": ["constants.ll", "expressions.ll"],
      "src/emit-strings.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-control.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-edits.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-numbers.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-records.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-storage.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts-strings.ts": ["constants.ll", "expressions.ll"],
      "src/emit-ts.ts": ["constants.ll", "expressions.ll"],
      "src/emit-util.ts": ["constants.ll", "expressions.ll"],
      "src/emit.ts": ["constants.ll", "expressions.ll"],
      "src/escape.ts": ["constants.ll", "expressions.ll"],
      "src/expressions.ts": ["constants.ll", "expressions.ll"],
      "src/fix.ts": ["constants.ll", "expressions.ll"],
      "src/fusion.ts": ["constants.ll", "expressions.ll"],
      "src/generics.ts": ["constants.ll", "expressions.ll"],
      "src/handles.ts": ["constants.ll", "expressions.ll"],
      "src/inline-arrays.ts": ["constants.ll", "expressions.ll"],
      "src/interop-abi.ts": ["constants.ll", "expressions.ll"],
      "src/interop-dts.ts": ["constants.ll", "expressions.ll"],
      "src/interop-header.ts": ["constants.ll", "expressions.ll"],
      "src/interop-napi.ts": ["constants.ll", "expressions.ll"],
      "src/interop-wasm.ts": ["constants.ll", "expressions.ll"],
      "src/json-typed.ts": ["constants.ll", "expressions.ll"],
      "src/kernels.ts": ["constants.ll", "expressions.ll"],
      "src/loop-flow.ts": ["constants.ll", "expressions.ll"],
      "src/members.ts": ["constants.ll", "expressions.ll"],
      "src/module-storage.ts": ["constants.ll", "expressions.ll"],
      "src/options.ts": ["constants.ll", "expressions.ll"],
      "src/panics.ts": ["constants.ll", "expressions.ll"],
      "src/parallel.ts": ["constants.ll", "expressions.ll"],
      "src/portability-numbers.ts": ["constants.ll", "expressions.ll"],
      "src/portability-records.ts": ["constants.ll", "expressions.ll"],
      "src/portability-strings.ts": ["constants.ll", "expressions.ll"],
      "src/portability.ts": ["constants.ll", "expressions.ll"],
      "src/program.ts": ["constants.ll", "expressions.ll"],
      "src/ranges.ts": ["constants.ll", "expressions.ll"],
      "src/region-check.ts": ["constants.ll", "expressions.ll"],
      "src/region-rules.ts": ["constants.ll", "expressions.ll"],
      "src/result.ts": ["constants.ll", "expressions.ll"],
      "src/run-cache.ts": ["constants.ll", "expressions.ll"],
      "src/secret.ts": ["constants.ll", "expressions.ll"],
      "src/shm-window.ts": ["constants.ll", "expressions.ll"],
      "src/simd.ts": ["constants.ll", "expressions.ll"],
      "src/statements.ts": ["constants.ll", "expressions.ll"],
      "src/structs.ts": ["constants.ll", "expressions.ll"],
      "src/tbaa.ts": ["constants.ll", "expressions.ll"],
      "src/validator.ts": ["constants.ll", "expressions.ll"],
      "src/visibility.ts": ["constants.ll", "expressions.ll"],
      "src/watch.ts": ["constants.ll", "expressions.ll"],
      "tests/cases/arr_sort_cmp_f64.ts": ["arr_sort_cmp_f64.ll"],
      "tests/cases/arr_sort_edge.ts": ["arr_sort_edge.ll"],
      "tests/cases/f32_arith.ts": ["f32_arith.ll"],
      "tests/cases/map_iter_compaction_deferred.ts": ["map_iter_compaction_deferred.ll"],
      "tests/cases/math_intrinsics.ts": ["math_intrinsics.ll"],
      "tests/cases/math_split_member.ts": ["math_split_member.ll"],
      "tests/cases/math_std_edges.ts": ["math_std_edges.ll"],
      "tests/cases/math_tan.ts": ["math_tan.ll"],
      "tests/cases/math_ulp_samples.ts": ["math_ulp_samples.ll"],
      "tests/cases/wasm_math_exp.ts": ["wasm_math_exp.ll"],
      "tests/cases/wasm_math_rem.ts": ["wasm_math_rem.ll"],
      "tests/differential/corpus/f32_round.ts": ["f32_round.ll"],
      "tests/differential/corpus/f64_arith.ts": ["f64_arith.ll"],
      "tests/differential/corpus/f64_format.ts": ["f64_format.ll"],
      "tests/differential/corpus/f64_libm.ts": ["f64_libm.ll"],
      "tests/differential/corpus/f64_math.ts": ["f64_math.ll"],
      "tests/differential/corpus/f64_pow_spec.ts": ["f64_pow_spec.ll"],
      "tests/link/break_intro/main.ts": ["break-game.ll", "break-levels.ll", "break-menu.ll"],
      "tests/link/break_menu/main.ts": ["break-menu.ll"],
      "tests/link/break_settings/main.ts": ["break-menu.ll"],
      "tests/link/break_sound/main.ts": ["break-game.ll", "break-levels.ll", "break-sound.ll"],
    }
  ),
  ...pageMath(
    "the reference's std/math.ts does not export the six functions the program imports from nish/math, so only the candidate compiles it",
    {
      "tests/cases/wasm_math_std.ts": ["exit"],
    }
  ),
  // WP49 stage 5, part 7: `Http1Connection` gains `ended()` and
  // `HttpHandler` `hungUp()`, so every program that reaches
  // std/net/http1-server.ts or std/net/handler.ts lays both out again.
  ...serveCancel(
    "Http1Connection gains ended() and HttpHandler hungUp(), so serve can cancel a task whose client hung up; both modules' IR moves",
    {
      "examples/http-app/main.ts": ["app.ll", "handler.ll", "http1-server.ll", "main.ll"],
      "examples/prefork-server.ts": ["http1-server.ll", "prefork-server.ll"],
      "examples/relay/main.ts": ["http1-server.ll"],
      "bench/http-app-carrier.ts": ["http-app-carrier.ll", "http1-server.ll"],
      "bench/http1-request/main.ts": ["http1-server.ll", "main.ll"],
      "bench/http1-server.ts": ["handler.ll", "http1-server.ll", "std_net_http1-server.ll"],
      "bench/techempower/main.ts": ["http1-server.ll", "main.ll", "server.ll"],
      "tests/link/net_handler/main.ts": ["handler.ll", "http1-server.ll", "main.ll"],
      "tests/link/net_handler_descriptors/main.ts": ["handler.ll", "http1-server.ll", "main.ll"],
      "tests/link/net_handler_overlong/main.ts": ["handler.ll", "http1-server.ll", "main.ll", "taken.ll"],
      "tests/link/net_handler_short/main.ts": ["handler.ll", "http1-server.ll", "main.ll", "taken.ll"],
      "tests/link/net_handler_unbegun/main.ts": ["handler.ll", "http1-server.ll", "main.ll", "taken.ll"],
      "tests/link/net_http1_server/main.ts": [
        "checks.ll",
        "conn.ll",
        "harness.ll",
        "http1-server.ll",
        "main.ll",
      ],
      "tests/link/net_http1_server_bad_config/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_bad_head/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_bad_head_timeout/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_bad_message/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_f64/main.ts": [
        "checks.ll",
        "http1-server.ll",
        "net_http1_server_harness.ll",
      ],
      "tests/link/net_http1_server_feed_window/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_frame_window/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_send_body/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_send_body_window/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http1_server_write_window/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/net_http2_bad_config_tls/main.ts": ["http1-server.ll"],
      "tests/link/net_http2_tls/main.ts": ["http1-server.ll"],
      "tests/link/net_http2_tls_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_http3/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_body_chunk/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_config/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_credit/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_local_limit/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_uni_limit/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_bad_write_chunk/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_ecn/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_ecn_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_errors/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_errors_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_server/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_server_bad_config/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_server_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_http3_write_window/main.ts": ["http1-server.ll"],
      "tests/link/net_http_app/main.ts": ["app.ll", "handler.ll", "http1-server.ll", "main.ll"],
      "tests/link/net_http_date/main.ts": ["http1-server.ll"],
      "tests/link/net_http_date_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_interop_server/main.ts": [
        "checks.ll",
        "cli.ll",
        "client.ll",
        "http1-server.ll",
        "load.ll",
        "net_http1_server_checks.ll",
        "net_http1_server_harness.ll",
        "server.ll",
      ],
      "tests/link/net_interop_server_f64/main.ts": [
        "cli.ll",
        "http1-server.ll",
        "net_http1_server_checks.ll",
        "net_http1_server_harness.ll",
        "net_interop_server_checks.ll",
        "net_interop_server_client.ll",
        "net_interop_server_server.ll",
      ],
      "tests/link/net_loopback/main.ts": [
        "apps.ll",
        "carrier-http1.ll",
        "carrier-http2.ll",
        "carrier-tls.ll",
        "carrier-websocket.ll",
        "http1-server.ll",
        "net_http1_server_harness.ll",
        "tcp.ll",
        "tls-client.ll",
      ],
      "tests/link/net_loopback_f64/main.ts": [
        "apps.ll",
        "carrier-http1.ll",
        "carrier-http2.ll",
        "carrier-tls.ll",
        "carrier-websocket.ll",
        "http1-server.ll",
        "net_http1_server_harness.ll",
        "tcp.ll",
        "tls-client.ll",
      ],
      "tests/link/net_quic_server_wipes/main.ts": ["http1-server.ll"],
      "tests/link/net_quic_server_wipes_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_relay/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_hello/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_idle/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_path/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_per_peer/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_pool/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_rate/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_sessions/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_spare/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_bad_stats/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_forged/main.ts": ["http1-server.ll"],
      "tests/link/net_relay_soak/main.ts": ["http1-server.ll"],
      "tests/link/net_upstream/main.ts": ["handler.ll", "http1-server.ll", "main.ll", "upstream.ll"],
      "tests/link/net_upstream_release/main.ts": ["handler.ll", "http1-server.ll", "main.ll", "upstream.ll"],
      "tests/link/net_webtransport/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_datagrams/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_datagrams_off/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_layer/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_pending/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_pending_high/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_sessions/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_streams/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_bad_streams_high/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_close_window/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_datagram_window/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_f64/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_stream_window/main.ts": ["http1-server.ll"],
      "tests/link/net_webtransport_whole_window/main.ts": ["http1-server.ll"],
      "tests/link/std_http1_end_head/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/std_http1_mss/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/std_http_compress/main.ts": ["http1-server.ll", "main.ll"],
      "tests/link/std_postgres_carrier/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_attach_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_batcher_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_connection_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_limits_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_next_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_request_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_carrier_send_panic/main.ts": [
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/tfb_db/main.ts": [
        "db-server.ll",
        "handler.ll",
        "http1-server.ll",
        "main.ll",
        "postgres-carrier.ll",
      ],
      "tests/link/tfb_entry/main.ts": ["bench_techempower_server.ll", "http1-server.ll", "main.ll"],
    }
  ),
  {
    program: "tests/link/net_fetch_async_deadline/main.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the program imports cancelAfter from nish:async, which the 0.37.0 seed does not have, so only the candidate compiles it (WP49 stage 5, part 7)",
  },
  {
    program: "tests/link/net_serve_deadline/main.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 5, part 7)",
  },
  {
    program: "tests/link/net_serve_hangup/main.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 5, part 7)",
  },
  {
    program: "tests/link/net_serve_shutdown/main.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 5, part 7)",
  },
  {
    program: "tests/link/tfb_async_entry/main.ts",
    file: "exit",
    changelog: "TechEmpower plaintext and json entry as serve handlers",
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 6, part 1)",
  },
  {
    program: "tests/link/tfb_async_db/main.ts",
    file: "exit",
    changelog: "TechEmpower database entry on the async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 6, part 2)",
  },
  {
    program: "tests/link/net_serve_server_field/main.ts",
    file: "exit",
    changelog: "TechEmpower plaintext and json entry as serve handlers",
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 6, part 1)",
  },
  {
    program: "tests/link/net_serve_server_panic/main.ts",
    file: "exit",
    changelog: "TechEmpower plaintext and json entry as serve handlers",
    why: "the 0.37.0 seed's std has no `std/net/serve.ts`, so only the candidate compiles the program (WP49 stage 6, part 1)",
  },
  {
    program: "tests/link/std_postgres_async_cancel/main.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, so only the candidate compiles the program (WP49 stage 5, part 7)",
  },
  {
    program: "tests/cases/async_cancel.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the case imports cancel, cancelAfter and the bounded waits from nish:async, which the 0.37.0 seed does not have, so only the candidate compiles it (WP49 stage 5, part 7)",
  },
  {
    program: "docs/cookbook/async-cancel.ts",
    file: "exit",
    changelog: SERVE_CANCEL,
    why: "the cookbook entry imports cancel, cancelAfter and the bounded waits from nish:async, which the 0.37.0 seed does not have, so only the candidate compiles it (WP49 stage 5, part 7)",
  },
  {
    program: "tests/cases/async_spawn_handler_reach.ts",
    file: "exit",
    changelog: "reaches its spawner's state and awaits the async Postgres pool",
    why: "the 0.37.0 seed refuses a task call's argument the answer cannot reach; the candidate leaves it out, so only the candidate compiles the case (WP49 stage 5, part 8)",
  },
  {
    program: "tests/link/net_serve_pg/main.ts",
    file: "exit",
    changelog: "reaches its spawner's state and awaits the async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, so only the candidate compiles the program (WP49 stage 5, part 8)",
  },
  // #1304 merged with its nish-cmp run cancelled. It adds `settle` to
  // `DnsResolver` and `DnsClient`, so dns-resolver.ll and dns.ll move in every
  // program that reaches them. These come first: dns.ll also carries this
  // PR's `dnsLoadSystem` change, and the first entry that matches is the one
  // reported, so #1304's line is never swallowed by the async fetch line.
  ...dnsFallback(
    "#1304 adds settle to DnsResolver and DnsClient so a search fallback waits out a NODATA, which moves both DNS modules' IR",
    {
      "examples/http-get-json.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async_flat/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async_https/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async_https_flat/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async_overlap/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_fetch_async_policy/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_http_fetch/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_http_fetch_f64/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_http_fetch_tls/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_outbound/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_outbound_f64/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_upstream/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/net_upstream_release/main.ts": ["dns-resolver.ll", "dns.ll"],
      "tests/link/std_dns/main.ts": ["dns-resolver.ll", "dns.ll", "main.ll"],
      "tests/link/std_dns_caps/main.ts": ["dns-resolver.ll", "dns.ll", "main.ll"],
      "tests/link/std_dns_soak/main.ts": ["dns-resolver.ll", "dns.ll", "main.ll"],
    }
  ),
  ...dnsFallback(
    "#1304's test calls DnsResolver.settle, a method the reference's std/net/dns-resolver.ts does not have, so only the candidate compiles it",
    {
      "tests/link/std_dns_resolver/main.ts": ["exit"],
    }
  ),
  // `HttpOptions` gains `dns` and `HttpClientConn` the TLS session, so every
  // program that reaches std/net/fetch.ts lays both out again. dns.ts's
  // `dnsLoadSystem` change lands in dns.ll, which #1304 moves too; that file
  // is declared above under #1304's line.
  ...asyncFetch(
    "async fetch speaks https and takes a DNS config, so HttpOptions and HttpClientConn grow fields",
    {
      "examples/http-get-json.ts": ["fetch.ll", "http-get-json.h", "http-get-json.ll"],
      "tests/link/net_fetch_async/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_fetch_async_flat/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_fetch_async_https/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_fetch_async_https_flat/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_fetch_async_overlap/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_fetch_async_policy/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_http_fetch/main.ts": ["checks.ll", "fetch.ll", "main.h"],
      "tests/link/net_http_fetch_f64/main.ts": ["checks.ll", "fetch.ll", "main.h"],
      "tests/link/net_http_fetch_tls/main.ts": ["fetch.ll", "main.h", "main.ll"],
      "tests/link/net_outbound/main.ts": ["checks.ll", "fetch.ll", "main.h"],
      "tests/link/net_outbound_f64/main.ts": ["checks.ll", "fetch.ll", "main.h"],
    }
  ),
  ...asyncFetch(
    "the program sets HttpOptions.dns, a field the reference's std/net/fetch.ts does not have, so only the candidate compiles it",
    {
      "tests/link/net_fetch_async_dns_slow/main.ts": ["exit"],
    }
  ),
  {
    program: "tests/cases/async_spawn_fn_arg.ts",
    file: "exit",
    changelog: "spawned task may reach the objects its spawner owns",
    why: "the 0.37.0 seed refuses an object or function argument to `spawn`, which this release shares with the task (WP49 stage 5, part 3)",
  },
  {
    program: "tests/cases/async_spawn_shared.ts",
    file: "exit",
    changelog: "spawned task may reach the objects its spawner owns",
    why: "the 0.37.0 seed refuses an object or function argument to `spawn`, which this release shares with the task (WP49 stage 5, part 3)",
  },
  {
    program: "tests/link/async_spawn_shared_outlives/main.ts",
    file: "exit",
    changelog: "spawned task may reach the objects its spawner owns",
    why: "the 0.37.0 seed refuses an object or function argument to `spawn`, which this release shares with the task (WP49 stage 5, part 3)",
  },
  {
    program: "tests/cases/async_await_all_arrays.ts",
    file: "exit",
    changelog: "awaitAlls whose lanes return arrays no longer crash the compiler",
    why: "the 0.37.0 seed lifts an `a[0]` header load above the `awaitAll` that binds `a` in a loop and stops with an internal compiler error (#1326)",
  },
  {
    program: "tests/link/std_postgres_async/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_flat/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_caps_panic/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_double_release_panic/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_release_closed_panic/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_release_panic/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "tests/link/std_postgres_async_size_panic/main.ts",
    file: "exit",
    changelog: "async Postgres pool",
    why: "the 0.37.0 seed's std has no `std/net/postgres-async.ts`, which this release adds, so only the candidate compiles the program (WP49 stage 5, part 5)",
  },
  {
    program: "docs/cookbook/async-spawn-shared.ts",
    file: "exit",
    changelog: "spawned task may reach the objects its spawner owns",
    why: "the 0.37.0 seed refuses an object or function argument to `spawn`, which this release shares with the task (WP49 stage 5, part 3)",
  },
  {
    program: "tests/link/net_serve/main.ts",
    file: "exit",
    changelog: "one task and one region per request",
    why: "`nish/net/serve` is new in this release, so the 0.37.0 seed's standard library has no such module (WP49 stage 5, part 4)",
  },
  {
    program: "tests/link/net_serve_pipelined_flat/main.ts",
    file: "exit",
    changelog: "one task and one region per request",
    why: "`nish/net/serve` is new in this release, so the 0.37.0 seed's standard library has no such module (WP49 stage 5, part 4)",
  },
  // #899: a loop pass now keeps its arena scope where a register `Result`
  // leaves it, so these loops gain the pass's mark and rewind.
  ...resultLoop(
    "a loop pass keeps its rewind when the Result it builds is packed into a register or returned, so these loops gain a pass scope",
    {
      "tests/cases/result_loop_outer_let.ts": ["result_loop_outer_let.ll"],
      "tests/cases/result_loop_payloads.ts": ["result_loop_payloads.ll"],
      "tests/cases/result_loop_return_alloc.ts": ["result_loop_return_alloc.ll"],
    }
  ),
  // WP49 stage 5: an awaitAll member that waits runs in a region of its own,
  // so every function holding an awaitAll of a suspending call gains a lane
  // slot per member, the region calls and the lane poll.
  ...awaitAllLanes(
    "an awaitAll member that waits gets a region its poll enters and adopts, so each awaiting function gains lane slots and region calls",
    {
      "tests/cases/async_await_all.ts": ["async_await_all.ll"],
      "tests/cases/async_await_all_lanes_large.ts": ["async_await_all_lanes_large.ll"],
      "tests/link/async_await_all_lanes/main.ts": ["lib.ll", "main.ll"],
      "tests/link/async_await_all_retain/main.ts": ["main.ll"],
      "tests/link/async_await_all_small/main.ts": ["main.ll"],
      "tests/link/async_across_modules/main.ts": ["main.ll"],
      "docs/cookbook/async-await-all.ts": ["async-await-all.ll"],
      "docs/cookbook/runtime-prelude.ts": ["runtime-prelude.ll"],
    }
  ),
  {
    changelog: "Strings cross between a wasm module and its page",
    why: "the --emit-header comment names the three core runtime files a C caller links, since runtime.c alone no longer defines nish_str_new",
    undo: (text) => withoutStage4Header(text),
  },
  {
    changelog: "Strings cross between a wasm module and its page",
    why: "the --emit-dts comments say a string result now crosses to the page and how a string argument is passed instead",
    undo: (text) => withoutStage4Dts(text),
  },
  ...declareStringExports(
    STAGE4_STRING_EXPORTS,
    "Strings cross between a wasm module and its page",
    "a string result is decoded into a JS string, so a function returning one is exported to the page instead of listed as a comment"
  ),
  {
    program: "tests/cases/deterministic_bits.ts",
    file: "exit",
    changelog: "the same float bits on every target",
    why: "the case is compiled with --deterministic, a flag the seed does not know",
  },
  {
    program: "tests/cases/deterministic_parse.ts",
    file: "exit",
    changelog: "the same float bits on every target",
    why: "the case is compiled with --deterministic, a flag the seed does not know",
  },
  {
    program: "examples/file-server.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "docs/cookbook/builtin-file-window.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/caps_file_read.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_open_errors.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_read_at.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_read_at_bounds.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_read_at_eof.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_read_at_pos.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/file_size_large.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/mem_file_stream_flat.ts",
    file: "exit",
    changelog: "fileOpen, fileReadAt, fileSize and fileClose",
    why: "fileOpen, fileReadAt, fileSize and fileClose are new builtins (WP44), which the seed does not know",
  },
  {
    program: "tests/cases/host_import_string.ts",
    file: "exit",
    changelog: "Strings cross between a wasm module and its page",
    why: "a host function may now take a string parameter, which the seed refused until stage 4",
  },
  {
    program: "tests/cases/storage_lend_bytes.ts",
    file: "exit",
    changelog: "Strings cross between a wasm module and its page",
    why: "byte module storage may now be lent to a u8[] or readonly u8[] parameter, which the seed refused until stage 4",
  },
  {
    program: "tests/link/reject_host_manifest_absolute/main.ts",
    file: "exit",
    changelog: "nish.host",
    why: "a `nish.host` entry that is an absolute path is refused where package.json writes it (NL2695), which the 0.37.0 seed, reading no `host` field, compiled",
  },
  {
    program: "tests/link/reject_host_manifest_empty/main.ts",
    file: "exit",
    changelog: "nish.host",
    why: "a `nish.host` entry that is empty is refused where package.json writes it (NL2695), which the 0.37.0 seed, reading no `host` field, compiled",
  },
  {
    program: "tests/link/reject_host_manifest_missing/main.ts",
    file: "exit",
    changelog: "nish.host",
    why: "a `nish.host` entry that names no file is refused where package.json writes it (NL2696), which the 0.37.0 seed, reading no `host` field, compiled",
  },
  {
    program: "tests/link/reject_host_manifest_not_string/main.ts",
    file: "exit",
    changelog: "nish.host",
    why: "a `nish.host` entry that is not a string is refused where package.json writes it (NL2694), which the 0.37.0 seed, reading no `host` field, compiled",
  },
  {
    program: "tests/link/reject_host_manifest_escape/main.ts",
    file: "exit",
    changelog: "nish.host",
    why: "a `nish.host` entry that climbs out of the package's directory is refused where package.json writes it (NL2695), which the 0.37.0 seed, reading no `host` field, compiled",
  },
  // A Map or Set read in a parallel map: the 0.38.0 seed walks a table's
  // private arrays and refuses a body that reaches one beside a `dst`.
  ...[
    "tests/link/par_map_read_capture/main.ts",
    "tests/link/par_map_read_into/main.ts",
    "tests/link/par_map_read_into_keys/main.ts",
  ].map((program) => ({
    program,
    file: "exit",
    changelog: "Read a Map or Set reached through a parallelMapInto element",
    why: "the 0.38.0 seed counts a Map's private entry arrays as reaching `dst` and refuses the program, so only the candidate compiles it",
  })),
  // Parent/child regions: the 0.38.0 seed's nish:region has no child or
  // childWith, so only the candidate compiles these programs.
  ...[
    "tests/cases/region_child_builder_list.ts",
    "tests/cases/region_child_chain.ts",
    "tests/cases/region_child_fresh_list.ts",
    "tests/cases/region_child_keep.ts",
    "tests/cases/region_child_local_map.ts",
    "tests/cases/region_child_map.ts",
    "tests/cases/region_child_plain.ts",
    "docs/cookbook/mem-region-child.ts",
    "tests/link/region_child_stale/main.ts",
  ].map((program) => ({
    program,
    file: "exit",
    changelog: "Add parent/child regions",
    why: "the program imports child or childWith from nish:region, which the 0.38.0 seed does not have, so only the candidate compiles it",
  })),
  ...[
    "tests/cases/fnref_array.ts",
    "tests/cases/fnref_array_callback.ts",
    "tests/cases/fnref_capture.ts",
    "tests/cases/fnref_capture_ctor.ts",
    "tests/cases/fnref_capture_method.ts",
    "tests/cases/fnref_capture_param.ts",
    "tests/cases/fnref_debug_check.ts",
    "tests/cases/fnref_empty_set.ts",
    "tests/cases/fnref_eq.ts",
    "tests/cases/fnref_generic.ts",
    "tests/cases/fnref_place_set.ts",
    "tests/cases/fnref_row_assign.ts",
    "tests/cases/fnref_row_index_store.ts",
  ].map((program) => ({
    program,
    file: "exit",
    changelog: "references to capture-free top-level functions",
    why: "the 0.38.0 seed refuses a function type outside a parameter, so only the candidate compiles the program (WP51 stage 1)",
  })),
  {
    program: "tests/cases/obj_spread_class.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/obj_spread_narrowed.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/obj_spread_nested.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/obj_spread_twin.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/obj_spread_override_type.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/obj_spread_order.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "docs/cookbook/obj-spread.ts",
    file: "exit",
    changelog: "object literals, lowered to field copies",
    why: "the 0.38.0 seed refuses every object spread (NL1061), so only the candidate compiles the program",
  },
  {
    program: "tests/cases/arr_filter.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `filter` and `map` on an array, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_find_index.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `findIndex` on an array, which the 0.37.0 seed refuses as an unknown method, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_map.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `map` on an array, which the 0.37.0 seed refuses as an unknown method, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_map_f64.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `map` on an f64 array, which the 0.37.0 seed refuses as an unknown method, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_map_template.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case imports `map` from nish/array, a module the 0.37.0 seed's std does not have, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_slice.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `slice` and `map` on an array, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_slice_bounds.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `slice` and `map` on an array, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_slice_saturate.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `slice` on an array, which the 0.37.0 seed refuses as an unknown method, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_named_predicates.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case passes named functions to `some`, `every` and `findIndex` on an array, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/deny_panics_arr_map.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `map`, `filter`, `some`, `every` and `findIndex` on an array under `--deny-panics`, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/storage_lend_methods_after.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case lends module storage to functions that call `slice`, `map` and the other methods, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/storage_lend_methods_before.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case lends module storage to functions that call `slice`, `map` and the other methods, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "tests/cases/arr_some_every.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the case calls `some` and `every` on an array, which the 0.37.0 seed refuses as unknown methods, so only the candidate compiles it",
  },
  {
    program: "docs/cookbook/arr-map.ts",
    file: "exit",
    changelog: "methods map, filter, some, every, findIndex and slice",
    why: "the cookbook entry calls `map` on an array, which the 0.37.0 seed refuses as an unknown method, so only the candidate compiles it",
  },
  // #696 item 1: httpFieldsCheckOutgoing and the HTTP/1.1 response writers
  // refuse a second `date` field, so every program that reaches
  // std/net/http-fields.ts or std/net/http1-codec.ts lays both out again.
  ...dateSingleton(
    "httpFieldsCheckOutgoing and the HTTP/1.1 response writers refuse a second Date field; both modules' IR moves",
    {
      "examples/http-app/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "examples/http-get-json.ts": ["http-fields.ll", "http1-codec.ll"],
      "examples/prefork-server.ts": ["http-fields.ll", "http1-codec.ll"],
      "examples/relay/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "bench/http-app-carrier.ts": ["http-fields.ll", "http1-codec.ll"],
      "bench/http1-parse/main.ts": ["http1-codec.ll"],
      "bench/http1-request/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "bench/http1-server.ts": ["http-fields.ll", "http1-codec.ll"],
      "bench/router.ts": ["http-fields.ll"],
      "bench/techempower/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async_flat/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async_https/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async_https_flat/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async_overlap/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_fetch_async_policy/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_handler/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_handler_descriptors/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_handler_overlong/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_handler_short/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_handler_unbegun/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_chunk_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_client/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_client_f64/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_client_feed_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_client_feed_window_len/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_client_feed_window_off/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_f64/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_feed_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_parse_diff/main.ts": ["http1-codec.ll"],
      "tests/link/net_http1_server/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_bad_config/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_bad_head/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_bad_head_timeout/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_bad_message/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_feed_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_frame_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_send_body/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_send_body_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_server_write_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http1_write_chunk_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_http2/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_bad_config/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_bad_config_tls/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http2_errors/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_errors_f64/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_f64/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_hpack_bomb/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_hpack_bomb_f64/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_hpack_table/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_hpack_table_f64/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_reset/main.ts": ["http-fields.ll"],
      "tests/link/net_http2_tls/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http2_tls_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_body_chunk/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_config/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_credit/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_local_limit/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_uni_limit/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_bad_write_chunk/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_ecn/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_ecn_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_errors/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_errors_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_server/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_server_bad_config/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_server_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http3_write_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http_app/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http_date/main.ts": ["http-fields.ll", "http1-codec.ll", "main.d.ts", "main.mjs"],
      "tests/link/net_http_date_f64/main.ts": ["http-fields.ll", "http1-codec.ll", "main.d.ts", "main.mjs"],
      "tests/link/net_http_fetch/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http_fetch_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_http_fetch_tls/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_interop_server/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_interop_server_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_loopback/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_loopback_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_outbound/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_outbound_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_quic_server_wipes/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_quic_server_wipes_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_hello/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_idle/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_path/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_per_peer/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_pool/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_rate/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_sessions/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_spare/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_bad_stats/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_encode_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_relay_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_forged/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_relay_frame_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_relay_grant_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_relay_json_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_relay_soak/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_router/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_router_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_router_negative_too_many_params/main.ts": ["http-fields.ll"],
      "tests/link/net_upstream/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_upstream_release/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_websocket/main.ts": ["http1-codec.ll"],
      "tests/link/net_websocket_f64/main.ts": ["http1-codec.ll"],
      "tests/link/net_websocket_feed_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_websocket_frame_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_websocket_utf8_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_websocket_write_window/main.ts": ["http1-codec.ll"],
      "tests/link/net_webtransport/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_datagrams/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_datagrams_off/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_layer/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_pending/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_pending_high/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_sessions/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_streams/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_bad_streams_high/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_close_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_datagram_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_f64/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_stream_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/net_webtransport_whole_window/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_http1_end_head/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_http1_mss/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_http_compress/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_attach_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_batcher_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_connection_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_limits_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_next_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_request_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/std_postgres_carrier_send_panic/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/tfb_db/main.ts": ["http-fields.ll", "http1-codec.ll"],
      "tests/link/tfb_entry/main.ts": ["http-fields.ll", "http1-codec.ll"],
    }
  ),
  ...dateSingleton(
    "the 0.37.0 seed's std/net/http-fields.ts has no HTTP_FIELDS_DATE_REPEATED, so only the candidate compiles the program",
    {
      "tests/link/net_http_fields/main.ts": ["exit"],
      "tests/link/net_http_fields_f64/main.ts": ["exit"],
    }
  ),
  // HttpCompressor.mss starts at 0, unset, instead of HTTP_DEFAULT_MSS, so
  // every program that reaches std/net/http-compress.ts stores 0 in its
  // constructor; http1-server.ll moves too, where serveCancel already covers it.
  ...mssUnset("HttpCompressor's constructor stores 0 (unset) in mss instead of HTTP_DEFAULT_MSS", [
    "examples/http-app/main.ts",
    "examples/prefork-server.ts",
    "examples/relay/main.ts",
    "bench/http-app-carrier.ts",
    "bench/http1-request/main.ts",
    "bench/http1-server.ts",
    "bench/techempower/main.ts",
    "tests/link/net_handler/main.ts",
    "tests/link/net_handler_descriptors/main.ts",
    "tests/link/net_handler_overlong/main.ts",
    "tests/link/net_handler_short/main.ts",
    "tests/link/net_handler_unbegun/main.ts",
    "tests/link/net_http1_server/main.ts",
    "tests/link/net_http1_server_bad_config/main.ts",
    "tests/link/net_http1_server_bad_head/main.ts",
    "tests/link/net_http1_server_bad_head_timeout/main.ts",
    "tests/link/net_http1_server_bad_message/main.ts",
    "tests/link/net_http1_server_f64/main.ts",
    "tests/link/net_http1_server_feed_window/main.ts",
    "tests/link/net_http1_server_frame_window/main.ts",
    "tests/link/net_http1_server_send_body/main.ts",
    "tests/link/net_http1_server_send_body_window/main.ts",
    "tests/link/net_http1_server_write_window/main.ts",
    "tests/link/net_http2_bad_config_tls/main.ts",
    "tests/link/net_http2_tls/main.ts",
    "tests/link/net_http2_tls_f64/main.ts",
    "tests/link/net_http3/main.ts",
    "tests/link/net_http3_bad_body_chunk/main.ts",
    "tests/link/net_http3_bad_config/main.ts",
    "tests/link/net_http3_bad_credit/main.ts",
    "tests/link/net_http3_bad_local_limit/main.ts",
    "tests/link/net_http3_bad_uni_limit/main.ts",
    "tests/link/net_http3_bad_write_chunk/main.ts",
    "tests/link/net_http3_ecn/main.ts",
    "tests/link/net_http3_ecn_f64/main.ts",
    "tests/link/net_http3_errors/main.ts",
    "tests/link/net_http3_errors_f64/main.ts",
    "tests/link/net_http3_f64/main.ts",
    "tests/link/net_http3_server/main.ts",
    "tests/link/net_http3_server_bad_config/main.ts",
    "tests/link/net_http3_server_f64/main.ts",
    "tests/link/net_http3_write_window/main.ts",
    "tests/link/net_http_app/main.ts",
    "tests/link/net_http_date/main.ts",
    "tests/link/net_http_date_f64/main.ts",
    "tests/link/net_interop_server/main.ts",
    "tests/link/net_interop_server_f64/main.ts",
    "tests/link/net_loopback/main.ts",
    "tests/link/net_loopback_f64/main.ts",
    "tests/link/net_quic_server_wipes/main.ts",
    "tests/link/net_quic_server_wipes_f64/main.ts",
    "tests/link/net_relay/main.ts",
    "tests/link/net_relay_bad_hello/main.ts",
    "tests/link/net_relay_bad_idle/main.ts",
    "tests/link/net_relay_bad_path/main.ts",
    "tests/link/net_relay_bad_per_peer/main.ts",
    "tests/link/net_relay_bad_pool/main.ts",
    "tests/link/net_relay_bad_rate/main.ts",
    "tests/link/net_relay_bad_sessions/main.ts",
    "tests/link/net_relay_bad_spare/main.ts",
    "tests/link/net_relay_bad_stats/main.ts",
    "tests/link/net_relay_f64/main.ts",
    "tests/link/net_relay_forged/main.ts",
    "tests/link/net_relay_soak/main.ts",
    "tests/link/net_upstream/main.ts",
    "tests/link/net_upstream_release/main.ts",
    "tests/link/net_webtransport/main.ts",
    "tests/link/net_webtransport_bad_datagrams/main.ts",
    "tests/link/net_webtransport_bad_datagrams_off/main.ts",
    "tests/link/net_webtransport_bad_layer/main.ts",
    "tests/link/net_webtransport_bad_pending/main.ts",
    "tests/link/net_webtransport_bad_pending_high/main.ts",
    "tests/link/net_webtransport_bad_sessions/main.ts",
    "tests/link/net_webtransport_bad_streams/main.ts",
    "tests/link/net_webtransport_bad_streams_high/main.ts",
    "tests/link/net_webtransport_close_window/main.ts",
    "tests/link/net_webtransport_datagram_window/main.ts",
    "tests/link/net_webtransport_f64/main.ts",
    "tests/link/net_webtransport_stream_window/main.ts",
    "tests/link/net_webtransport_whole_window/main.ts",
    "tests/link/std_compress_f64/main.ts",
    "tests/link/std_http1_end_head/main.ts",
    "tests/link/std_http1_mss/main.ts",
    "tests/link/std_http_compress/main.ts",
    "tests/link/std_postgres_carrier/main.ts",
    "tests/link/std_postgres_carrier_attach_panic/main.ts",
    "tests/link/std_postgres_carrier_batcher_panic/main.ts",
    "tests/link/std_postgres_carrier_connection_panic/main.ts",
    "tests/link/std_postgres_carrier_limits_panic/main.ts",
    "tests/link/std_postgres_carrier_next_panic/main.ts",
    "tests/link/std_postgres_carrier_request_panic/main.ts",
    "tests/link/std_postgres_carrier_send_panic/main.ts",
    "tests/link/tfb_db/main.ts",
    "tests/link/tfb_entry/main.ts",
  ]),
  ...poolPipeline(
    "the pool's slots gain a send queue, a parse cache and abandoned-seat state, so every program that links `std/net/postgres-async.ts` lays out and walks the pool differently (WP49 stage 6, part 5)",
    {
      "tests/link/net_serve_pg/main.ts": ["main.h", "main.ll", "postgres-async.ll", "serve.ll"],
      "tests/link/std_postgres_async_cancel/main.ts": ["main.h", "main.ll", "postgres-async.ll"],
      "tests/link/std_postgres_async_caps_panic/main.ts": ["main.h", "main.ll", "postgres-async.ll"],
      "tests/link/std_postgres_async_double_release_panic/main.ts": [
        "main.h",
        "main.ll",
        "postgres-async.ll",
      ],
      "tests/link/std_postgres_async_flat/main.ts": ["main.h", "main.ll", "postgres-async.ll"],
      "tests/link/std_postgres_async_release_closed_panic/main.ts": [
        "main.h",
        "main.ll",
        "postgres-async.ll",
      ],
      "tests/link/std_postgres_async_release_panic/main.ts": ["main.h", "main.ll", "postgres-async.ll"],
      "tests/link/std_postgres_async_size_panic/main.ts": ["main.h", "main.ll", "postgres-async.ll"],
    }
  ),
  ...poolPipeline(
    "the program calls the pipelined API (`pgAsyncPrepare`, `pgAsyncSeat`, `pgAsyncAnswer`) the 0.38.0 seed's std does not export, so only the candidate compiles it (WP49 stage 6, part 5)",
    {
      "tests/link/std_postgres_async_depth_panic/main.ts": ["exit"],
      "tests/link/std_postgres_async_pipeline/main.ts": ["exit"],
      "tests/link/std_postgres_async_seat_statement_panic/main.ts": ["exit"],
      "tests/link/std_postgres_async_seat_ticket_panic/main.ts": ["exit"],
    }
  ),
  // WP49 stage 6, part 3: `HttpHandler` holds owed sends (`flush`, `sends`),
  // so every program that reaches std/net/handler.ts lays it out again.
  ...pipelinedWrite(
    "HttpHandler gains owed sends, flush() and sends(), so serve answers a pipelined burst in one write; the handler struct grows and every module that reaches it moves",
    {
      "bench/http1-server.ts": ["http1-server.h"],
      "examples/http-app/main.ts": ["main.h"],
      "tests/link/net_handler/main.ts": ["main.h"],
      "tests/link/net_handler_descriptors/main.ts": ["main.h"],
      "tests/link/net_handler_overlong/main.ts": ["main.h"],
      "tests/link/net_handler_short/main.ts": ["main.h"],
      "tests/link/net_handler_unbegun/main.ts": ["main.h"],
      "tests/link/net_http_app/main.ts": ["main.h"],
      "tests/link/net_serve/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_deadline/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_hangup/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_pg/main.ts": [
        "handler.ll",
        "main.h",
        "main.ll",
        "postgres-carrier.ll",
        "serve.ll",
      ],
      "tests/link/net_serve_pipelined_flat/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_server_field/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_server_panic/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_serve_shutdown/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/net_upstream/main.ts": ["main.h"],
      "tests/link/net_upstream_release/main.ts": ["main.h"],
      "tests/link/std_postgres_async/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_async_cancel/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_async_caps_panic/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_async_double_release_panic/main.ts": [
        "handler.ll",
        "main.h",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_async_flat/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_async_release_closed_panic/main.ts": [
        "handler.ll",
        "main.h",
        "postgres-carrier.ll",
      ],
      "tests/link/std_postgres_async_release_panic/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_async_size_panic/main.ts": ["handler.ll", "main.h", "postgres-carrier.ll"],
      "tests/link/std_postgres_carrier/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_attach_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_batcher_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_connection_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_limits_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_next_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_request_panic/main.ts": ["main.h"],
      "tests/link/std_postgres_carrier_send_panic/main.ts": ["main.h"],
      "tests/link/tfb_async_db/main.ts": [
        "async-db-server.ll",
        "db-server.ll",
        "handler.ll",
        "main.h",
        "main.ll",
        "postgres-carrier.ll",
        "serve.ll",
      ],
      "tests/link/tfb_async_entry/main.ts": ["handler.ll", "main.h", "main.ll", "serve.ll"],
      "tests/link/tfb_db/main.ts": ["main.h"],
    }
  ),
  {
    program: "tests/link/net_serve_burst/main.ts",
    file: "exit",
    changelog: PIPELINED_WRITE,
    why: "the program reads ServeStats.sends, which the 0.38.0 seed does not have, so only the candidate compiles it (WP49 stage 6, part 3)",
  },
  {
    program: "tests/link/net_serve_queued_wait/main.ts",
    file: "exit",
    changelog: PIPELINED_WRITE,
    why: "the program calls HttpHandler.deferSends, which the 0.38.0 seed does not have, so only the candidate compiles it (WP49 stage 6, part 3)",
  },
  ...taggedUnions(
    "JsonTokenizer gains rewindObject and JsonDecoder two trailing i32 fields (`unionStart`, where a read-ahead union object began, and `unionReread`, the bytes read again to reach a tag that is not the first key), so every program that links nish/json-tokenizer or nish/json-typed declares one more function and lays the decoder out 8 bytes wider; a program reading the tokenizer's header re-declares it",
    {
      "bench/http-app-carrier.ts": [
        "http-app-carrier.h",
        "json-tokenizer.ll",
        "json-typed.ll",
        "json-value.ll",
      ],
      "bench/http1-server.ts": ["json-tokenizer.ll", "json-typed.ll", "json-value.ll"],
      "bench/json-compare/main.ts": ["json-tokenizer.ll", "json-typed.ll", "main.h", "main.ll"],
      "bench/json-tokenizer/main.ts": ["json-tokenizer.ll", "main.ll"],
      "bench/json-value/main.ts": ["json-tokenizer.ll", "json-value.ll", "loop.ll", "main.ll"],
      "bench/yaml-json/main.ts": ["json-tokenizer.ll", "json-value.ll", "main.ll", "yaml-json.ll"],
      "docs/cookbook/json-presence.ts": [
        "json-presence.h",
        "json-presence.ll",
        "json-tokenizer.ll",
        "json-typed.ll",
      ],
      "docs/cookbook/json-tokenizer.ts": ["json-tokenizer.ll", "std_json-tokenizer.ll"],
      "docs/cookbook/json-typed.ts": [
        "json-tokenizer.ll",
        "json-typed.h",
        "json-typed.ll",
        "std_json-typed.ll",
      ],
      "docs/cookbook/json-value.ts": ["json-tokenizer.ll", "json-value.ll", "std_json-value.ll"],
      "examples/merge-patch.ts": ["json-tokenizer.ll", "json-typed.ll", "merge-patch.h", "merge-patch.ll"],
      "tests/link/json_merge_patch/main.ts": ["json-tokenizer.ll", "json-typed.ll", "main.h", "main.ll"],
      "tests/link/json_presence/main.ts": ["json-tokenizer.ll", "json-typed.ll", "main.h", "main.ll"],
      "tests/link/std_json_conformance/main.ts": ["conformance.ll", "json-tokenizer.ll", "rewrite.ll"],
      "tests/link/std_json_equal/main.ts": [
        "json-equal.ll",
        "json-pointer.ll",
        "json-tokenizer.ll",
        "json-value.ll",
        "suite.ll",
        "units.ll",
      ],
      "tests/link/std_json_number/main.ts": [
        "json-equal.ll",
        "json-pointer.ll",
        "json-tokenizer.ll",
        "json-value.ll",
        "suite.ll",
      ],
      "tests/link/std_json_pointer/main.ts": [
        "json-equal.ll",
        "json-pointer.ll",
        "json-tokenizer.ll",
        "json-value.ll",
        "suite.ll",
        "units.ll",
      ],
      "tests/link/std_json_typed/main.ts": [
        "checks.ll",
        "json-tokenizer.ll",
        "json-typed.ll",
        "kinds.ll",
        "main.h",
        "main.ll",
        "options.ll",
        "renamed.ll",
        "support.ll",
        "tag.ll",
      ],
      "tests/link/std_json_value/main.ts": [
        "alloc.ll",
        "common.ll",
        "corpus.ll",
        "json-tokenizer.ll",
        "json-value.ll",
        "units.ll",
      ],
      "tests/link/std_json_value_ranges/main.ts": ["json-tokenizer.ll", "json-value.ll", "main.ll"],
      "tests/link/std_json_writer/main.ts": ["common.ll", "json-tokenizer.ll", "json-typed.ll", "main.h"],
      "tests/link/std_yaml_json/main.ts": ["json-tokenizer.ll", "json-value.ll", "main.ll", "yaml-json.ll"],
    }
  ),
  {
    program: "tests/cases/caps_process_spawn_piped_within.ts",
    file: "exit",
    changelog: SPAWN_PIPED_WITHIN,
    why: '`spawnPipedWithin` is new in this release, so the 0.38.0 seed refuses it with "Unknown function" (#1387)',
  },
  {
    program: "tests/cases/io_spawn_piped_within.ts",
    file: "exit",
    changelog: SPAWN_PIPED_WITHIN,
    why: '`spawnPipedWithin` is new in this release, so the 0.38.0 seed refuses it with "Unknown function" (#1387)',
  },
  {
    program: "docs/cookbook/builtin-spawn-piped-within.ts",
    file: "exit",
    changelog: SPAWN_PIPED_WITHIN,
    why: '`spawnPipedWithin` is new in this release, so the 0.38.0 seed refuses it with "Unknown function" (#1387)',
  },
  ...heldWrite(
    "Http1Server.flush and Http1TlsServer.flush answer the write bit while a write is held, even once the send emptied the output, so http1-server.ll's flush and settle move",
    [
      "tests/link/net_serve/main.ts",
      "tests/link/net_serve_deadline/main.ts",
      "tests/link/net_serve_hangup/main.ts",
      "tests/link/net_serve_pg/main.ts",
      "tests/link/net_serve_pipelined_flat/main.ts",
      "tests/link/net_serve_server_field/main.ts",
      "tests/link/net_serve_server_panic/main.ts",
      "tests/link/net_serve_shutdown/main.ts",
      "tests/link/std_postgres_async_cancel/main.ts",
      "tests/link/std_postgres_async_caps_panic/main.ts",
      "tests/link/std_postgres_async_double_release_panic/main.ts",
      "tests/link/std_postgres_async_flat/main.ts",
      "tests/link/std_postgres_async_release_closed_panic/main.ts",
      "tests/link/std_postgres_async_release_panic/main.ts",
      "tests/link/std_postgres_async_size_panic/main.ts",
      "tests/link/tfb_async_entry/main.ts",
    ]
  ),
]

/**
 * The programs that reach one `std/` module by two routes: by a relative path
 * into the checkout's `std/` (`../../../std/term`), and through another `std/`
 * module's `nish/<name>` import. HEAD's compiler is built in the checkout, so
 * its own package root is the checkout and both routes name one file. The
 * seed's is where the seed is unpacked, so `nish/term` is the seed's copy, the
 * program declares `Screen` twice, and the seed refuses it as two packages
 * declaring one class. That is where each compiler is installed, not what it
 * does, so no release retires it and these are not `DECLARED` entries: each is
 * set aside only for that one refusal (`TWO_STDS_REFUSAL`), counted in the
 * summary, and a full run notes one that stops needing it.
 */
const TWO_STDS = new Set([
  "tests/link/break_game/main.ts",
  "tests/link/std_json_tokenizer/main.ts",
  "tests/link/std_yaml_conformance/main.ts",
  "tests/link/std_yaml_write/main.ts",
])

/** The reference's refusal of a class or interface reached once through each copy of `std/`. */
const TWO_STDS_REFUSAL =
  /^the candidate compiles it and the reference refuses it \(reference: error: (?:Class|Interface) `[^`]+` is declared in package (?:`nish`|the program itself) and again in package (?:`nish`|the program itself);/

/**
 * Whether one difference is the two-copies refusal in a program `TWO_STDS` names.
 *
 * @param {string} program the program, relative to the repository root
 * @param {{ surface: string, detail: string }} difference one difference `compare` reported
 * @param {Set<string>} allowed the programs allowed it
 * @returns {boolean} true only for that refusal in a listed program
 */
const isTwoStds = (program, difference, allowed = TWO_STDS) =>
  allowed.has(program) && difference.surface === "exit" && TWO_STDS_REFUSAL.test(difference.detail)

/** Differing files printed in full before the rest are only counted. */
const MAX_ROWS = 20

/** The dump flags: they print instead of writing IR, so there is no artefact to compare. */
const DUMP_FLAGS = new Set(["--emit-ast", "--emit-checked"])

/**
 * `.js` / `.mjs` / `.cjs` is a Node entry point and everything else is a
 * native binary. This is `scripts/bootstrap.sh`'s rule for `NISH_BOOTSTRAP`
 * (WP19 G3), character for character, so that one path spells a seed in both
 * places: the kind is the suffix, deliberately not the executable bit, because
 * the bit describes the download — a binary out of a release tarball can
 * arrive without `+x` — and the suffix is what
 * whoever built the seed chose.
 */
const NODE_ENTRY = /\.(?:js|mjs|cjs)$/

/**
 * The package root a compiler will answer for itself: the directory holding
 * `scripts/`, `runtime/` and `std/`.
 *
 * Derived the way the compilers derive it rather than guessed, because the
 * point of removing it is that it is *their* answer: `<dirname(argv[0])>/..`,
 * then the same for the real path — a compiler reached through a symlink
 * resolves the link (`src/compile.ts`'s `packageRootCandidates`) — and then
 * the working directory, which is where `compile` below spawns both of them.
 * The first candidate holding `scripts/build.sh` wins, which is the predicate
 * the compilers use, checked here against the filesystem instead of assumed.
 */
const packageRootOf = (file) => {
  const candidates = [path.join(path.dirname(file), "..")]
  try {
    candidates.push(path.join(path.dirname(fs.realpathSync(file)), ".."))
  } catch {
    // A compiler that cannot be realpath'd is one `resolveCompiler` has already
    // refused; there is simply no second candidate for it.
  }
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "scripts", "build.sh"))) {
      return path.resolve(candidate)
    }
  }
  return path.resolve(root)
}

/**
 * `text` with one compiler's own package root removed, so a path under it is
 * left relative to that package — `<seed>/std/text.ts` becomes `std/text.ts`,
 * which is what a compiler standing in its own root writes for the same module.
 *
 * The separator is part of what is removed, so a directory whose name merely
 * begins with the root's — `/opt/nish` against `/opt/nish-old/std/a.ts` — is
 * left alone. Nothing else is rewritten.
 */
const withoutOwnRoot = (text, ownRoot) => {
  if (ownRoot === undefined || ownRoot === null || ownRoot.length === 0) {
    return text
  }
  const prefix = ownRoot.endsWith(path.sep) ? ownRoot : `${ownRoot}${path.sep}`
  return text.split(prefix).join("")
}

/**
 * The files one compiler wrote, keyed by name with its own package root removed
 * from the front of each name, and the names that needed it.
 *
 * A module's `.ll` is named by its basename unless two modules of the program
 * share one; then it is named by its path from the entry's directory, each
 * segment joined with `_` (`outputStems` in `src/compilation.ts`). A module of
 * a compiler's own `std/` lives under that compiler's own root, so the
 * reference, unpacked somewhere else, writes `home_user_nish_build_seed_std_crypto_x25519.ll`
 * where the candidate writes `std_crypto_x25519.ll`: the same module, named by
 * each install, which is `withoutOwnRoot`'s case in a file name rather than in
 * a file. The root is removed only as a whole run of segments at the front and
 * only up to an `_`, and a name it would make collide with another is left as
 * it was, so the difference is still reported.
 */
const withoutOwnRootNames = (files, ownRoot) => {
  const renamed = new Set()
  if (ownRoot === undefined || ownRoot === null || ownRoot.length === 0) {
    return { files, renamed }
  }
  const segments = ownRoot.split(path.sep).filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return { files, renamed }
  }
  const prefix = `${segments.join("_")}_`
  const out = new Map()
  for (const [name, bytes] of files) {
    const bare = name.startsWith(prefix) ? name.slice(prefix.length) : name
    if (bare !== name && !files.has(bare) && !out.has(bare)) {
      out.set(bare, bytes)
      renamed.add(bare)
    } else {
      out.set(name, bytes)
    }
  }
  return { files: out, renamed }
}

/**
 * `withoutOwnRoot` over inputs a corpus cannot produce, on every run.
 *
 * It is four lines of string handling standing between a real difference and a
 * green summary, and §5a's last section names "no sibling oracle self-tests its
 * comparison logic" as a stage of its own. This is that check for the one piece
 * of comparison logic here that can *hide* something, and it costs microseconds.
 * Returns the reason it failed, or null.
 */
const selfCheckRoots = () => {
  const sep = path.sep
  const cases = [
    [
      `; ModuleID = '${sep}opt${sep}nish${sep}std${sep}text.ts'`,
      `${sep}opt${sep}nish`,
      "; ModuleID = 'std/text.ts'".replace(/\//g, sep),
    ],
    // Already relative: a compiler standing in its own root writes this, and it
    // is the form the other side is being brought to.
    [`; ModuleID = 'std${sep}text.ts'`, `${sep}opt${sep}nish`, `; ModuleID = 'std${sep}text.ts'`],
    // A neighbour whose name starts with the root's is not under it.
    [
      `${sep}opt${sep}nish-old${sep}std${sep}a.ts`,
      `${sep}opt${sep}nish`,
      `${sep}opt${sep}nish-old${sep}std${sep}a.ts`,
    ],
    // A trailing separator on the root must not remove one character more.
    [`${sep}opt${sep}nish${sep}std${sep}a.ts`, `${sep}opt${sep}nish${sep}`, `std${sep}a.ts`],
    // No root at all: every caller's fallback, and it must change nothing.
    [`${sep}opt${sep}nish${sep}std${sep}a.ts`, null, `${sep}opt${sep}nish${sep}std${sep}a.ts`],
  ]
  for (const [text, ownRoot, want] of cases) {
    const got = withoutOwnRoot(text, ownRoot)
    if (got !== want) {
      return `withoutOwnRoot(${JSON.stringify(text)}, ${JSON.stringify(ownRoot)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`
    }
  }
  const nishRoot = `${sep}opt${sep}nish`
  const names = [
    // The seed's own module, named by its path: the root goes, the rest stays.
    [["opt_nish_std_crypto_x25519.ll"], nishRoot, ["std_crypto_x25519.ll"]],
    // A neighbour whose name starts with the root's is not under it.
    [["opt_nish-old_std_a.ll"], nishRoot, ["opt_nish-old_std_a.ll"]],
    // The root is removed from the front only, never from the middle.
    [["tests_opt_nish_a.ll"], nishRoot, ["tests_opt_nish_a.ll"]],
    // A name the removal would make collide with another is left alone.
    [["opt_nish_a.ll", "a.ll"], nishRoot, ["opt_nish_a.ll", "a.ll"]],
    // No root at all changes nothing, and nor does the filesystem's root.
    [["opt_nish_a.ll"], null, ["opt_nish_a.ll"]],
    [["_a.ll"], sep, ["_a.ll"]],
  ]
  for (const [given, ownRoot, want] of names) {
    const got = [
      ...withoutOwnRootNames(new Map(given.map((n) => [n, Buffer.alloc(0)])), ownRoot).files.keys(),
    ]
    if (got.join(",") !== want.join(",")) {
      return `withoutOwnRootNames(${JSON.stringify(given)}, ${JSON.stringify(ownRoot)}) names ${JSON.stringify(got)}, not ${JSON.stringify(want)}`
    }
  }
  return null
}

/**
 * `text` with one compiler's own version removed from the DWARF `producer`, so
 * `producer: "nish 0.6.0"` from the 0.6.0 seed and `producer: "nish 0.7.0"`
 * from a 0.7.0 HEAD both read `producer: "<own version>"`.
 *
 * `ownVersion` is the compiler's whole `--version` line, which is the string
 * `src/debug.ts` writes (`${CLI} ${VERSION}`), and the match carries both
 * quotes: a version that merely begins with it (`nish 0.6.0-rc.1`), the other
 * compiler's version, and the same words anywhere but a `producer:` are all
 * left alone. Nothing else is rewritten.
 */
const withoutOwnVersion = (text, ownVersion) => {
  if (ownVersion === undefined || ownVersion === null || ownVersion.length === 0) {
    return text
  }
  return text.split(`producer: "${ownVersion}"`).join('producer: "<own version>"')
}

/** The module flags `hardeningModuleFlags` in `src/target.ts` gives every native module, as each line reads. */
const HARDENING_FLAGS = new Set([
  '!{i32 8, !"cf-protection-branch", i32 1}',
  '!{i32 8, !"cf-protection-return", i32 1}',
  '!{i32 8, !"branch-target-enforcement", i32 1}',
  '!{i32 8, !"sign-return-address", i32 1}',
  '!{i32 4, !"probe-stack", !"inline-asm"}',
])

/**
 * `text` without what the binary hardening adds to a native module: the five
 * module flags, their references on the `!llvm.module.flags` line (and that
 * line when nothing else is left on it), and the `"probe-stack"="inline-asm"`
 * every definition carries. The flags are numbered last, so no other `!N`
 * moved for them and removing them leaves the module the reference wrote.
 * A declaration's `undo`: it is applied to the candidate alone, so a
 * reference that already carries the flags still differs.
 */
const withoutHardening = (text) => {
  const ids = new Set()
  const kept = []
  for (const line of text.split("\n")) {
    const m = /^(!\d+) = (.*)$/.exec(line)
    if (m !== null && HARDENING_FLAGS.has(m[2])) {
      ids.add(m[1])
    } else {
      kept.push(line)
    }
  }
  const flagsLine = "!llvm.module.flags = !{"
  const out = []
  for (const [i, line] of kept.entries()) {
    if (line.startsWith(flagsLine) && line.endsWith("}")) {
      const refs = line
        .slice(flagsLine.length, -1)
        .split(", ")
        .filter((ref) => !ids.has(ref))
      if (refs.length > 0) {
        out.push(`${flagsLine}${refs.join(", ")}}`)
      } else if (out.at(-1) === "" && !kept[i + 1]?.startsWith("!")) {
        // A module with no metadata of its own: the blank line before the
        // flags opened a section the hardening alone wrote.
        out.pop()
      }
    } else {
      out.push(line.split(' "probe-stack"="inline-asm"').join(""))
    }
  }
  return out.join("\n")
}

/**
 * `withoutHardening` over fabricated modules, for the reason
 * `selfCheckVersions` gives: it can make two differing files look equal.
 * Returns the reason it failed, or null.
 */
const selfCheckHardening = () => {
  const flags = [...HARDENING_FLAGS]
  const plain = "define i32 @f() #0 {\n  ret i32 0\n}\nattributes #0 = { nounwind }"
  const hardened =
    'define i32 @f() #0 {\n  ret i32 0\n}\nattributes #0 = { nounwind "probe-stack"="inline-asm" }\n' +
    "!llvm.module.flags = !{!0, !1, !2, !3, !4}\n" +
    flags.map((flag, i) => `!${i} = ${flag}`).join("\n")
  const debug = (extra) =>
    `!llvm.module.flags = !{!2, !3${extra}}\n!2 = !{i32 7, !"Dwarf Version", i32 5}\n` +
    '!3 = !{i32 2, !"Debug Info Version", i32 3}'
  const cases = [
    [hardened, plain],
    // The blank line before flags that end the module goes with them; one
    // before metadata of the module's own stays.
    [`${plain}\n\n${hardened.slice(hardened.indexOf("!llvm"))}\n`, `${plain}\n`],
    [
      `${plain}\n\n!llvm.module.flags = !{!1}\n!0 = !{!"nish TBAA"}\n!1 = ${flags[4]}`,
      `${plain}\n\n!0 = !{!"nish TBAA"}`,
    ],
    // The debug flags stay, and so does their line.
    [`${debug(", !9")}\n!9 = ${flags[0]}`, debug("")],
    // An attribute with no group, on the definition itself.
    ['define void @g() "probe-stack"="inline-asm" {', "define void @g() {"],
    // A flag with another value is not one of these, and stays.
    ['!llvm.module.flags = !{!0}\n!0 = !{i32 8, !"cf-protection-branch", i32 0}', null],
    // Anything else is left alone.
    [plain, plain],
    ["", ""],
  ]
  for (const [text, want] of cases) {
    const got = withoutHardening(text)
    if (got !== (want ?? text)) {
      return `withoutHardening(${JSON.stringify(text)}) gave ${JSON.stringify(got)}`
    }
  }
  return null
}

/**
 * `withoutOwnVersion` over inputs a corpus cannot produce, on every run, for
 * the reason `selfCheckRoots` gives: it is the other piece of comparison logic
 * here that can make two differing files look equal. Returns the reason it
 * failed, or null.
 */
const selfCheckVersions = () => {
  const unit = (producer) =>
    `!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "${producer}", isOptimized: false)`
  const cases = [
    [unit("nish 0.6.0"), "nish 0.6.0", unit("<own version>")],
    // Another compiler's version is not this one's to forgive: a candidate
    // that records the reference's version, or a stale one, must still differ.
    [unit("nish 0.6.0"), "nish 0.7.0", unit("nish 0.6.0")],
    // A version that only begins with this one's is a different version.
    [unit("nish 0.6.0-rc.1"), "nish 0.6.0", unit("nish 0.6.0-rc.1")],
    // The same words outside a `producer:` are the program's, not the compiler's.
    [
      '@.str = private constant [10 x i8] c"nish 0.6.0"',
      "nish 0.6.0",
      '@.str = private constant [10 x i8] c"nish 0.6.0"',
    ],
    // No version at all: every caller's fallback, and it must change nothing.
    [unit("nish 0.6.0"), null, unit("nish 0.6.0")],
    ["", "", ""],
  ]
  for (const [text, ownVersion, want] of cases) {
    const got = withoutOwnVersion(text, ownVersion)
    if (got !== want) {
      return `withoutOwnVersion(${JSON.stringify(text)}, ${JSON.stringify(ownVersion)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`
    }
  }
  return null
}

/** `git` in the repository, as `spawnSync` answers it: the caller reads the status. */
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

/**
 * The release section `scripts/changelog-gen.mjs` would write for the commits
 * since the last release, as `{ text }`, or `{ error }` saying why it cannot
 * be read.
 *
 * It is the generator's own collect-and-render path, run as the generator's
 * own command line — without `--write`, which is the only flag that writes
 * anything — so the words a declaration is held to are the words the release
 * will print, and no second reading of a commit subject exists here to drift
 * from the first.
 *
 * The range is `<last v* tag>..HEAD`, which needs the history back to that tag
 * and the tag itself. A CI checkout has neither (`actions/checkout` fetches one
 * commit and no tags), and there the generator would not fail: `git describe`
 * would find no tag and it would render the fetched commits as a first
 * release. So the history is fetched when it is shallow, the tags when none is
 * reachable, and the answer is an error — never an empty section — when either
 * is still missing afterwards. A run with no release tag at all has no seed to
 * compare with either, since the seed *is* the last release.
 */
const pendingNotes = () => {
  const describe = () => git(["describe", "--tags", "--abbrev=0", "--match", "v*"])
  const shallow = () => git(["rev-parse", "--is-shallow-repository"]).stdout.trim() === "true"
  if (shallow()) {
    git(["fetch", "--quiet", "--unshallow", "--tags", "origin"])
  } else if (describe().status !== 0) {
    git(["fetch", "--quiet", "--tags", "origin"])
  }
  if (shallow()) {
    return {
      error:
        "the checkout is shallow and `git fetch --unshallow` did not deepen it, so the commits since the last release cannot be read",
    }
  }
  const tag = describe()
  if (tag.status !== 0) {
    return {
      error: `no v* release tag is reachable from HEAD, even after fetching the tags: ${tag.stderr.trim()}`,
    }
  }
  const rendered = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "changelog-gen.mjs"), "--stdout", "md"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  if (rendered.status !== 0) {
    return {
      error: `scripts/changelog-gen.mjs could not render ${tag.stdout.trim()}..HEAD: ${rendered.stderr.trim()}`,
    }
  }
  return { text: rendered.stdout }
}

/**
 * Whether a declaration's words are in the release notes: `CHANGELOG.md`, or
 * the pending section.
 *
 * `pending` is `pendingNotes()`'s answer, or null when it was never asked for
 * because every declaration was already named in `CHANGELOG.md`. Only its
 * rendered `text` counts: an error message that happens to quote the words —
 * the generator lists the unconventional subjects it skipped — is not the
 * release notes carrying them.
 */
const isNamed = (words, changelogText, pending) =>
  changelogText.includes(words) || (pending?.text?.includes(words) ?? false)

/**
 * `isNamed` over inputs no repository produces, on every run, for the reason
 * `selfCheckRoots` gives: it decides whether a declared difference is excused,
 * so a mistake in it passes a difference nobody wrote up. Returns the reason it
 * failed, or null.
 */
const selfCheckNotes = () => {
  const words = "Prove bounds through toI32(length)"
  const released = `## [0.7.0] - 2026-09-22\n\n### Performance\n\n- checker: ${words} (#154)\n`
  const pending = { text: `### Performance\n\n- checker: ${words} (\`72a4b16\`)\n` }
  const cases = [
    // Released: the file carries it, whatever the pending notes say.
    [words, released, null, true],
    [words, released, { error: "shallow" }, true],
    // Unreleased: only the section the generator would render carries it.
    [words, "## [Unreleased]\n", pending, true],
    // In neither: the declaration does not hold.
    [words, "## [Unreleased]\n", { text: "### Tests\n\n- Something else\n" }, false],
    // The pending notes could not be read: never a pass, even though the
    // error text quotes the words the way the generator's stderr would.
    [words, "## [Unreleased]\n", { error: `skipped 1 commit: abc1234 ${words}` }, false],
    // Not asked for at all.
    [words, "## [Unreleased]\n", null, false],
  ]
  for (const [w, changelogText, notes, want] of cases) {
    const got = isNamed(w, changelogText, notes)
    if (got !== want) {
      return `isNamed(${JSON.stringify(w)}, ${JSON.stringify(changelogText)}, ${JSON.stringify(notes)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`
    }
  }
  return null
}

/**
 * Why a list of declarations may not stand, or null. `declaredFor` matches an
 * entry on whatever it names, so one that names no `program`, no `file` and no
 * `undo` matches every difference in every program, a refusal included: with
 * it in the list nothing the candidate emits can fail the run. Its words being
 * in the release notes says the change was meant, not that this difference is
 * that change, so such an entry is refused however true its `why` is.
 */
const declarationsProblem = (entries) => {
  for (const entry of entries) {
    if (entry.program === undefined && entry.file === undefined && entry.undo === undefined) {
      return `the declaration for "${entry.changelog}" names no program, file or undo, so it excuses every difference in every program`
    }
  }
  return null
}

/**
 * `declarationsProblem` over fabricated lists, then over `DECLARED` itself, on
 * every run, for the reason `selfCheckRoots` gives: an entry that covers
 * everything turns the comparison into a pass whatever HEAD emits. The
 * fabricated half first shows that such an entry really does excuse an
 * arbitrary difference, so the refusal is guarding a hole that exists. Returns
 * the reason it failed, or null.
 */
const selfCheckDeclarations = () => {
  const words = { changelog: "Stand-in change", why: "a stand-in" }
  const everything = { ...words }
  if (declaredFor("tests/cases/add.ts", "exit", [everything]) !== everything) {
    return "an entry naming no program, file or undo no longer matches every difference, so the refusal below guards nothing"
  }
  const cases = [
    [[{ ...words, program: "tests/cases/add.ts" }], true],
    [[{ ...words, file: "add.ll" }], true],
    [[{ ...words, undo: (text) => text }], true],
    [[], true],
    [[everything], false],
    [[{ ...words, program: "tests/cases/add.ts" }, everything], false],
  ]
  for (const [entries, want] of cases) {
    const got = declarationsProblem(entries) === null
    if (got !== want) {
      return `declarationsProblem(${JSON.stringify(entries)}) ${got ? "accepts" : "refuses"} it`
    }
  }
  // The two-copies allowance is a second door past `DECLARED`, so its edges are
  // driven too: only the one refusal, only on the exit, only in a listed program.
  const listed = new Set(["tests/link/x/main.ts"])
  const twice =
    "the candidate compiles it and the reference refuses it (reference: error: Class `Screen` is declared in " +
    "package `nish` and again in package the program itself; a class or interface name is still program-wide)"
  const doors = [
    ["tests/link/x/main.ts", { surface: "exit", detail: twice }, true],
    ["tests/link/y/main.ts", { surface: "exit", detail: twice }, false],
    ["tests/link/x/main.ts", { surface: "main.ll", detail: twice }, false],
    [
      "tests/link/x/main.ts",
      {
        surface: "exit",
        detail: "the candidate compiles it and the reference refuses it (reference: error: x)",
      },
      false,
    ],
    ["tests/link/x/main.ts", { surface: "exit", detail: "the candidate refuses it: error: x" }, false],
  ]
  for (const [program, difference, want] of doors) {
    if (isTwoStds(program, difference, listed) !== want) {
      return `isTwoStds(${JSON.stringify(program)}, ${JSON.stringify(difference)}) is ${!want}, not ${want}`
    }
  }
  return declarationsProblem(DECLARED)
}

/**
 * A compiler as something spawnable: `cmd` plus the arguments that come before
 * the program's own. `label` is what the report calls it — the path as the
 * caller spelled it rather than the absolute one, so a summary line stays
 * readable and can be pasted back. `version` is its `--version` line, which
 * `withoutOwnVersion` removes from the DWARF `producer`.
 *
 * A compiler that cannot answer `--version` is refused here rather than three
 * hundred compilations later: a binary built for another platform or a `.js`
 * that is not a compiler fails in a way that names the path the caller gave.
 */
const resolveCompiler = (spec, role) => {
  const file = path.resolve(root, spec)
  const refuse = (why) => ({ error: `${role} ${spec} ${why}` })
  if (!fs.existsSync(file)) {
    return refuse("does not exist")
  }
  if (!fs.statSync(file).isFile()) {
    return refuse("is not a file")
  }
  const compiler = NODE_ENTRY.test(file)
    ? { label: spec, cmd: process.execPath, prefix: [file], packageRoot: packageRootOf(file) }
    : { label: spec, cmd: file, prefix: [], packageRoot: packageRootOf(file) }
  if (compiler.prefix.length === 0) {
    try {
      fs.accessSync(file, fs.constants.X_OK)
    } catch {
      return refuse("is not executable (only .js/.mjs/.cjs are run under node)")
    }
  }
  const version = compile(compiler, ["--version"])
  if (version.status !== 0) {
    return refuse("is not runnable (`--version` failed)")
  }
  return { ...compiler, version: (version.stdout ?? "").trim() }
}

/**
 * The seed `NISH_BOOTSTRAP` names, or null when there is none. An empty value
 * counts as none: `NISH_BOOTSTRAP= npm test` is how a caller turns the seed
 * off for one run, and reading it as a path would refuse to start instead.
 */
const seedFromEnvironment = () => {
  const seed = process.env.NISH_BOOTSTRAP
  return seed === undefined || seed === "" ? null : seed
}

/** Both compilers, or the first error. */
const resolvePair = (referenceSpec, candidateSpec) => {
  const reference = resolveCompiler(referenceSpec, "reference")
  if (reference.error !== undefined) {
    return { error: reference.error }
  }
  const candidate = resolveCompiler(candidateSpec, "candidate")
  if (candidate.error !== undefined) {
    return { error: candidate.error }
  }
  return { reference, candidate }
}

const compile = (compiler, args) =>
  spawnSync(compiler.cmd, [...compiler.prefix, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

/** `compile` as a promise, answering the same `{ status, stdout, stderr }` shape `spawnSync` does. */
const compileAsync = (compiler, args) =>
  new Promise((resolve) => {
    const child = spawn(compiler.cmd, [...compiler.prefix, ...args], { cwd: root })
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    // A compiler that cannot be started answers as `spawnSync` would: no
    // status, and the reason where a diagnostic would be.
    child.on("error", (error) => resolve({ status: null, stdout: "", stderr: String(error) }))
    child.on("close", (status) =>
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      })
    )
  })

/**
 * `task(item, slot)` over every item with at most `jobs` in flight, answers in
 * the items' order. `slot` is the worker's index, below `jobs`, so a task can
 * own a directory no other task in flight writes to.
 */
const pooled = async (items, jobs, task) => {
  const results = new Array(items.length)
  let next = 0
  const worker = async (slot) => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index], slot)
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, (_, slot) => worker(slot)))
  return results
}

/** `--emit-header <dir>/<stem>.h ...`: the flags that ask for all four WP8 sidecars. */
const sidecarFlags = (dir, stem) => [
  "--emit-header",
  path.join(dir, `${stem}.h`),
  "--emit-dts",
  path.join(dir, `${stem}.d.ts`),
  "--emit-napi",
  path.join(dir, `${stem}.napi.c`),
]

const fresh = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Every file under `dir` as `relative path -> bytes`, so a missing file is a difference too. */
const tree = (dir) => {
  const out = new Map()
  const walk = (at, prefix) => {
    for (const entry of fs
      .readdirSync(at, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(at, entry.name)
      const rel = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(full, rel)
      } else {
        out.set(rel, fs.readFileSync(full))
      }
    }
  }
  if (fs.existsSync(dir)) {
    walk(dir, "")
  }
  return out
}

/** The first diagnostic of a compiler's stderr, without its file:line:col prefix. */
const firstLine = (output) => {
  const line = output.trim().split("\n")[0] ?? ""
  return line.replace(/^[^:]*:\d+:\d+: /, "")
}

/**
 * Where two texts differ, as at most `limit` lines with both spellings — the
 * shape `ir_oracle.js` reports, bounded because a release that changes one
 * attribute changes it in every module and the useful part of that report is
 * the first line of it, not the two million after.
 */
const excerpt = (want, got, limit) => {
  const wantLines = want.split("\n")
  const gotLines = got.split("\n")
  const total = Math.max(wantLines.length, gotLines.length)
  const shown = []
  let differing = 0
  for (let i = 0; i < total; i++) {
    if (wantLines[i] === gotLines[i]) {
      continue
    }
    differing++
    if (shown.length < limit) {
      shown.push(
        `line ${i + 1}: reference \`${wantLines[i] ?? "<end>"}\`\n` +
          `${" ".repeat(String(i + 1).length + 7)}candidate \`${gotLines[i] ?? "<end>"}\``
      )
    }
  }
  if (differing === 0) {
    return { differing, total, text: "the bytes differ but no line does" }
  }
  const more = differing > shown.length ? `\n... ${differing - shown.length} more differing line(s)` : ""
  return { differing, total, text: `${shown.join("\n")}${more}` }
}

/**
 * Compile one program with both compilers and compare everything they wrote.
 *
 * Returns exactly one of:
 *   `{ dump }`         — its own flags ask for a dump, so neither side writes an artefact
 *   `{ refused }`      — both compilers refuse it; the message is `reject-oracle.js`'s
 *   `{ differences }`  — `[{ surface, detail }]`, where `surface` is the file name or "exit"
 *   `{ files, lines, rooted, versioned }` — they agree, over this many files
 *                      and IR lines, this many of them only once each side's
 *                      own root, or own version, was removed
 *
 * The program is given the flags it is compiled with everywhere else, from its
 * `.args` sidecar or its `// smoke: args` line (`tests/self/corpus.js`): two
 * versions of one compiler disagree about a flag exactly as readily as about a
 * construct, and a program nobody compiles the way it is meant to be compiled
 * is not in the comparison at all.
 */
const compare = (pair, work, file, options = {}) => {
  const job = prepare(work, file, options)
  if (job.dump !== undefined) {
    return job
  }
  const reference = compile(pair.reference, job.argv(job.referenceDir))
  const candidate = compile(pair.candidate, job.argv(job.candidateDir))
  return judge(pair, job, reference, candidate, options.lines ?? 3)
}

/**
 * `compare`, with each compiler run as a child the event loop waits on rather
 * than one that blocks it, so `main` can keep several programs in flight. The
 * two compilers still run one after the other within a program: the heaviest
 * entries (`src/*.ts` reaches most of the compiler) peak at about 1.6 GiB each,
 * and a pair at a time per slot is what keeps four slots inside a 16 GB runner.
 */
const compareAsync = async (pair, work, file, options = {}) => {
  const job = prepare(work, file, options)
  if (job.dump !== undefined) {
    return job
  }
  const reference = await compileAsync(pair.reference, job.argv(job.referenceDir))
  const candidate = await compileAsync(pair.candidate, job.argv(job.candidateDir))
  return judge(pair, job, reference, candidate, options.lines ?? 3)
}

/** The output directories and the argv for one program, or `{ dump }` when it writes no artefact. */
const prepare = (work, file, options) => {
  const flags = extraArgs(file)
  const dump = flags.find((flag) => DUMP_FLAGS.has(flag))
  if (dump !== undefined) {
    return { dump: `${dump}: no artefact; the <name>.stdout golden pins it` }
  }

  // Both compilers name each module by the path they resolved it to and write
  // that path into the module header, so the entry has to be spelled the same
  // for both. The output directories differ and may: nothing either compiler
  // writes carries the directory it was written to.
  const named = path.relative(root, file)
  const stem = path.basename(file, ".ts")
  const referenceDir = fresh(path.join(work, "reference"))
  const candidateDir = fresh(path.join(work, "candidate"))
  // `--sandbox` refuses `--emit-napi`, so a sandboxed program
  // (`tests/cases/sandbox_hello`) is compared on its IR alone.
  const sandboxed = flags.some((flag) => flag === "--sandbox" || flag.startsWith("--sandbox="))
  const argv = (dir) => [
    named,
    "-o",
    `${dir}${path.sep}`,
    ...flags,
    ...(options.extraFlags ?? []),
    ...(options.sidecars === false || sandboxed ? [] : sidecarFlags(dir, stem)),
  ]
  return { referenceDir, candidateDir, argv }
}

/** What the two compilers' runs over one prepared program say: agreement, a refusal by both, or the differences. */
const judge = (pair, job, reference, candidate, limit) => {
  const { referenceDir, candidateDir } = job
  if (reference.status !== 0 && candidate.status !== 0) {
    return { refused: firstLine(reference.stderr) || `exit ${reference.status}` }
  }
  if (reference.status !== 0) {
    // A construct HEAD has and the seed does not is what the rolling freeze
    // *is*, and it is a difference like any other: `DECLARED` names it with
    // the CHANGELOG line that ships it, and the entry goes one release later,
    // when the seed has the construct.
    return {
      differences: [
        {
          surface: "exit",
          detail:
            "the candidate compiles it and the reference refuses it " +
            `(reference: ${firstLine(reference.stderr) || `exit ${reference.status}`})`,
        },
      ],
    }
  }
  if (candidate.status !== 0) {
    return {
      differences: [
        {
          surface: "exit",
          detail: `the candidate refuses it: ${firstLine(candidate.stderr) || `exit ${candidate.status}`}`,
        },
      ],
    }
  }

  const wantNames = withoutOwnRootNames(tree(referenceDir), pair.reference.packageRoot)
  const gotNames = withoutOwnRootNames(tree(candidateDir), pair.candidate.packageRoot)
  const want = wantNames.files
  const got = gotNames.files
  if (want.size === 0) {
    return { refused: "the reference wrote no files" }
  }
  const differences = []
  let lines = 0
  let rooted = 0
  let versioned = 0
  for (const name of [...new Set([...want.keys(), ...got.keys()])].sort()) {
    const a = want.get(name)
    const b = got.get(name)
    if (a === undefined) {
      differences.push({ surface: name, detail: "the candidate wrote it and the reference did not" })
      continue
    }
    if (b === undefined) {
      differences.push({ surface: name, detail: "the reference wrote it and the candidate did not" })
      continue
    }
    if (a.equals(b)) {
      if (wantNames.renamed.has(name) || gotNames.renamed.has(name)) {
        rooted++
      }
      if (name.endsWith(".ll")) {
        lines += a.toString("utf8").split("\n").length
      }
      continue
    }
    // The two compilers are installed in different directories — they have to
    // be — so a module either of them reached through its OWN package is named
    // by a path only that install can spell. Removing each side's own root
    // leaves the module's path relative to its own package, which is the
    // identity the comparison is actually about. Counted rather than folded in:
    // the summary says how many files agreed only this way, because a number
    // that says a comparison happened must say what it set aside.
    const wantText = a.toString("utf8")
    const gotText = b.toString("utf8")
    const wantRooted = withoutOwnRoot(wantText, pair.reference.packageRoot)
    const gotRooted = withoutOwnRoot(gotText, pair.candidate.packageRoot)
    if (wantRooted === gotRooted) {
      rooted++
      if (name.endsWith(".ll")) {
        lines += wantText.split("\n").length
      }
      continue
    }
    // The reference is the last release and the candidate is HEAD, which
    // carries the next version from the commit that bumps it, so a `-g` build
    // records a different `producer` on each side. Counted apart for the same
    // reason as the root.
    if (
      withoutOwnVersion(wantRooted, pair.reference.version) ===
      withoutOwnVersion(gotRooted, pair.candidate.version)
    ) {
      versioned++
      if (name.endsWith(".ll")) {
        lines += wantText.split("\n").length
      }
      continue
    }
    const wantPlain = withoutOwnVersion(wantRooted, pair.reference.version)
    const gotPlain = withoutOwnVersion(gotRooted, pair.candidate.version)
    const undone = DECLARED.find((entry) => entry.undo !== undefined && entry.undo(gotPlain) === wantPlain)
    const where = excerpt(wantText, gotText, limit)
    differences.push({
      surface: name,
      detail: `differs (${where.differing} of ${where.total} lines)\n${where.text}`,
      ...(undone === undefined ? {} : { undone }),
    })
  }
  if (differences.length > 0) {
    return { differences }
  }
  return { files: want.size, lines, rooted, versioned }
}

/**
 * The declaration covering one difference, or null. Keyed on the program and
 * the file, both optional, so a declaration says exactly as much as its author
 * meant it to and no more.
 */
const declaredFor = (program, surface, entries = DECLARED) => {
  for (const entry of entries) {
    // An `undo` covers a file only when it turns one side into the other,
    // which `compare` decides with both texts in hand.
    if (entry.undo !== undefined) {
      continue
    }
    if (entry.program !== undefined && entry.program !== program) {
      continue
    }
    if (entry.file !== undefined && entry.file !== surface) {
      continue
    }
    return entry
  }
  return null
}

/**
 * Every positive whole program of the corpus, plus the whole programs of
 * `tests/link/`, which is where the multi-module shapes live — the same set
 * `ir_oracle.js` walks, from the same module, so the successor compares no
 * less than the oracle it replaces.
 */
const corpus = () => [...programs(), ...linkPrograms().map((program) => program.main)]

/**
 * The compiler HEAD builds: `src/compile.ts` linked into `build/self/compile`
 * by the seed, which is the arrangement G3 puts in `scripts/bootstrap.sh`.
 * There is no second answer: this is only called with a reference in hand,
 * and the reference is the seed (R6 took out the stage0 fallback that used to
 * sit here, which nothing could reach). Always rebuilt rather than
 * reused: a stale binary from an earlier checkout would be compared against
 * the release and reported as agreement, which is the one answer this tool
 * must never give by accident. Pass `--candidate` to compare a binary you
 * built yourself and skip this.
 */
const buildCandidate = (seedSpec) => {
  const out = path.join(root, "build", "self", "compile")
  const builder = resolveCompiler(seedSpec, "candidate builder")
  if (builder.error !== undefined) {
    return { error: builder.error }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const built = compile(builder, [path.join("src", "compile.ts"), "--link", out])
  if (built.status !== 0) {
    return { error: `could not build the candidate with ${builder.label}\n${built.stderr}` }
  }
  return { path: path.relative(root, out) }
}

const HELP = `nish-cmp — compile the corpus with two compilers and compare every byte.

usage: node tests/nish-cmp.js [options] [program.ts ...]

  -r, --reference <compiler>  the compiler that is trusted: the last released
                              nish (default: $NISH_BOOTSTRAP; without one the
                              run skips, because there is nothing to compare to)
  -c, --candidate <compiler>  the compiler under test (default: src/ built into
                              build/self/compile by the reference)
      --changelog <file>      where a released difference is named (default:
                              CHANGELOG.md); an unreleased one is named by the
                              section scripts/changelog-gen.mjs would render
                              for the commits since the last v* tag
      --no-sidecars           compare only the IR, not the four WP8 sidecars
      --lines <n>             differing lines to print per file (default: 3)
  -j, --jobs <n>              programs compiled at once (default: the number
                              of cores; each compile uses one, and the largest
                              peak at about 1.6 GiB per compiler)
      --verbose               name every program, not only the differences
  -h, --help                  this text

A compiler is a native binary, or a .js/.mjs/.cjs entry point run under node —
the same rule scripts/bootstrap.sh applies to NISH_BOOTSTRAP.

With no programs named, the whole corpus is compared (tests/self/corpus.js).

exit codes: 0 agreed (or skipped for want of a seed), 1 undeclared difference,
2 usage or a compiler that would not build`

const main = async (argv) => {
  const options = { lines: 3, sidecars: true }
  let jobs = os.availableParallelism()
  let referenceSpec = seedFromEnvironment()
  let candidateSpec = null
  let changelog = "CHANGELOG.md"
  let verbose = false
  const named = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${HELP}\n`)
      return 0
    }
    if (arg === "-r" || arg === "--reference") {
      referenceSpec = argv[++i]
    } else if (arg === "-c" || arg === "--candidate") {
      candidateSpec = argv[++i]
    } else if (arg === "--changelog") {
      changelog = argv[++i]
    } else if (arg === "--no-sidecars") {
      options.sidecars = false
    } else if (arg === "--lines") {
      options.lines = Number(argv[++i])
    } else if (arg === "-j" || arg === "--jobs") {
      jobs = Number(argv[++i])
    } else if (arg === "--verbose") {
      verbose = true
    } else if (arg.startsWith("-")) {
      process.stderr.write(`nish-cmp: unknown option: ${arg}\n${HELP}\n`)
      return 2
    } else {
      named.push(arg)
    }
  }
  if (
    referenceSpec === undefined ||
    candidateSpec === undefined ||
    Number.isNaN(options.lines) ||
    !Number.isInteger(jobs) ||
    jobs < 1
  ) {
    process.stderr.write(`nish-cmp: an option is missing its value\n${HELP}\n`)
    return 2
  }

  // The skip, in the runner's own idiom (`tests/run.js`'s `skip`): one SKIP
  // line carrying the reason, and a summary that counts it rather than
  // reporting a comparison that did not happen as a pass. Nish has no release
  // yet, so this is the answer on every machine until 0.1.0 is tagged.
  if (referenceSpec === null) {
    process.stdout.write(
      "SKIP  nish-cmp: no seed available (no --reference and NISH_BOOTSTRAP is unset), " +
        "so HEAD was compared against nothing\n"
    )
    process.stdout.write("nish-cmp: 0 programs compared, 1 skipped (no seed available)\n")
    return 0
  }

  // Before anything is compiled: the two pieces of comparison logic here that
  // can make two differing files look equal — each side's own root and each
  // side's own producer version — driven over inputs no corpus produces. A run whose own comparison is broken must say so instead of
  // agreeing about three hundred programs.
  const selfCheck = selfCheckRoots()
  if (selfCheck !== null) {
    process.stderr.write(`nish-cmp: its own package-root comparison is wrong: ${selfCheck}\n`)
    return 2
  }
  const selfCheckVersion = selfCheckVersions()
  if (selfCheckVersion !== null) {
    process.stderr.write(`nish-cmp: its own producer-version comparison is wrong: ${selfCheckVersion}\n`)
    return 2
  }
  const selfCheckUndo = selfCheckHardening()
  if (selfCheckUndo !== null) {
    process.stderr.write(`nish-cmp: its own hardening undo is wrong: ${selfCheckUndo}\n`)
    return 2
  }
  const selfCheckNote = selfCheckNotes()
  if (selfCheckNote !== null) {
    process.stderr.write(`nish-cmp: its own release-note lookup is wrong: ${selfCheckNote}\n`)
    return 2
  }
  const selfCheckDeclaration = selfCheckDeclarations()
  if (selfCheckDeclaration !== null) {
    process.stderr.write(`nish-cmp: its own declarations are wrong: ${selfCheckDeclaration}\n`)
    return 2
  }

  // The corpus is settled before a compiler is built, so that a mistyped
  // program name costs a message rather than the link that precedes it.
  const inputs = named.length > 0 ? named.map((file) => path.resolve(file)) : corpus()
  const missing = inputs.filter((file) => !fs.existsSync(file))
  if (missing.length > 0) {
    process.stderr.write(
      `nish-cmp: no such program: ${missing.map((f) => path.relative(root, f)).join(", ")}\n`
    )
    return 2
  }

  if (candidateSpec === null) {
    // The seed builds HEAD: that is the arrangement G3 wires into CI, and it
    // is why the reference is what gets passed on here. A seed too old to
    // compile HEAD's `src/` fails here, naming itself, which is the G4 policy
    // being enforced rather than discovered halfway through a comparison.
    const built = buildCandidate(referenceSpec)
    if (built.error !== undefined) {
      process.stderr.write(`nish-cmp: ${built.error}\n`)
      return 2
    }
    candidateSpec = built.path
  }
  const pair = resolvePair(referenceSpec, candidateSpec)
  if (pair.error !== undefined) {
    process.stderr.write(`nish-cmp: ${pair.error}\n`)
    return 2
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nish-cmp-"))
  const undeclared = []
  const declared = []
  const dumps = []
  const refused = []
  const twoStds = []
  let agreed = 0
  let files = 0
  let lines = 0
  let rooted = 0
  let versioned = 0
  // Each compile is one process on one core, so the corpus runs `jobs` programs
  // at a time, each in its own slot's directory. The results come back in the
  // corpus's order, so the report reads the same at any `--jobs`.
  const results = await pooled(inputs, jobs, (file, slot) =>
    compareAsync(pair, path.join(work, String(slot)), file, options)
  )
  for (const [index, file] of inputs.entries()) {
    const program = path.relative(root, file)
    const result = results[index]
    if (result.dump !== undefined) {
      dumps.push(`${program}: ${result.dump}`)
    } else if (result.refused !== undefined) {
      refused.push(`${program}: both refuse it: ${result.refused}`)
    } else if (result.differences !== undefined) {
      for (const difference of result.differences) {
        if (isTwoStds(program, difference)) {
          twoStds.push(program)
          continue
        }
        const entry = difference.undone ?? declaredFor(program, difference.surface)
        const row = { program, ...difference, declared: entry }
        ;(entry === null ? undeclared : declared).push(row)
      }
    } else {
      agreed++
      files += result.files
      lines += result.lines
      rooted += result.rooted ?? 0
      versioned += result.versioned ?? 0
      if (verbose) {
        process.stdout.write(`  ok   ${program} (${result.files} files)\n`)
      }
    }
  }
  fs.rmSync(work, { recursive: true, force: true })

  // A release that changes one attribute changes it in every module, so the
  // report is bounded twice over: `--lines` lines per file, and this many
  // files before the rest are counted rather than printed. The summary still
  // counts every one of them, and naming one program with a larger `--lines`
  // is how to look at a single difference closely.
  for (const row of undeclared.slice(0, MAX_ROWS)) {
    process.stdout.write(
      `  FAIL ${row.program}: ${row.surface} ${row.detail}\n`.replace(/\n(?=.)/g, "\n       ")
    )
  }
  if (undeclared.length > MAX_ROWS) {
    process.stdout.write(`  ... ${undeclared.length - MAX_ROWS} more differing file(s), not printed\n`)
  }
  // A declaration is a claim that the release notes name the difference. The
  // claim is checked here rather than trusted, because the whole point of G2's
  // sentence is that the release note and the compiler's output cannot drift
  // apart: a declaration whose words have gone fails the run exactly as an
  // undeclared difference does. The pending section is only rendered when
  // `CHANGELOG.md` leaves a declaration unnamed, since it may have to fetch
  // history to do it.
  const changelogText = fs.existsSync(path.resolve(root, changelog))
    ? fs.readFileSync(path.resolve(root, changelog), "utf8")
    : ""
  const byReason = new Map()
  for (const row of declared) {
    byReason.set(row.declared, (byReason.get(row.declared) ?? 0) + 1)
  }
  const reasons = [...byReason.keys()]
  const pending = reasons.some((r) => !changelogText.includes(r.changelog)) ? pendingNotes() : null
  const unnamed = reasons.filter((r) => !isNamed(r.changelog, changelogText, pending))
  for (const [reason, count] of byReason) {
    const where = `${reason.program ?? "every program"} ${reason.file ?? ""}`.trim()
    process.stdout.write(`declared: ${count} × ${where} — ${reason.why}\n`)
  }
  for (const reason of unnamed) {
    process.stdout.write(
      `  FAIL neither ${changelog} nor the pending release notes name this difference: the declaration asks ` +
        `for "${reason.changelog}"\n`
    )
  }
  if (unnamed.length > 0 && pending?.error !== undefined) {
    process.stdout.write(`  FAIL the pending release notes could not be read: ${pending.error}\n`)
  }
  // A declaration that covers nothing is not a failure — a single-program run
  // is entitled to match none of them — but it is worth saying on a full run,
  // because an allowlist nobody prunes is how the next real difference gets
  // waved through.
  if (named.length === 0) {
    for (const entry of DECLARED) {
      if (!byReason.has(entry)) {
        const where = `${entry.program ?? "every program"} ${entry.file ?? ""}`.trim()
        process.stdout.write(`note: nothing differs at ${where}; the declaration can go\n`)
      }
    }
    for (const program of TWO_STDS) {
      if (!twoStds.includes(program)) {
        process.stdout.write(`note: ${program} no longer reaches two copies of std/; it can leave TWO_STDS\n`)
      }
    }
  }
  if (verbose) {
    for (const row of refused) {
      process.stdout.write(`  refused ${row}\n`)
    }
    for (const row of dumps) {
      process.stdout.write(`  dump ${row}\n`)
    }
  }

  // Said on its own line rather than only inside the summary, because it is the
  // one thing this run compared less than literally, and a reader deciding what
  // a green line is worth should not have to know the flag names to find it.
  if (rooted > 0) {
    process.stdout.write(
      `note: ${rooted} file(s) agree once each compiler's own package root is removed ` +
        `(reference ${pair.reference.packageRoot}, candidate ${pair.candidate.packageRoot}): a module reached ` +
        `as \`nish/<name>\` is named by where that compiler's own \`std/\` is, which two installs cannot agree ` +
        "about. Every other byte of those files is compared as it stands.\n"
    )
  }

  if (versioned > 0) {
    process.stdout.write(
      `note: ${versioned} file(s) agree once each compiler's own version is removed from the DWARF ` +
        `producer (reference "${pair.reference.version}", candidate "${pair.candidate.version}"): a \`-g\` build ` +
        "records the version of the compiler that wrote it. Every other byte of those files is compared as it stands.\n"
    )
  }

  const compared = inputs.length - refused.length - dumps.length - twoStds.length
  // Each outcome is counted apart and named, for the reason the oracles count
  // their skips apart (`.claude/selfhost.md`): a program neither compiler
  // compiles proves nothing about either, and must not be able to hide inside
  // a number that reads like agreement.
  const refusedNote = refused.length > 0 ? `, ${refused.length} refused by both` : ""
  const dumpNote = dumps.length > 0 ? `, ${dumps.length} dumps (no artefact)` : ""
  const twoStdsNote =
    twoStds.length > 0 ? `, ${twoStds.length} refused by the reference for two copies of std/` : ""
  const declaredNote = declared.length > 0 ? `, ${declared.length} declared difference(s)` : ""
  const rootedNote = rooted > 0 ? `, ${rooted} equal after each compiler's own root` : ""
  const versionedNote = versioned > 0 ? `, ${versioned} equal after each compiler's own producer version` : ""
  process.stdout.write(
    `nish-cmp: ${agreed}/${compared} programs agree (${files} files, ${lines} IR lines) — ` +
      `reference ${pair.reference.label}, candidate ${pair.candidate.label}` +
      `${refusedNote}${twoStdsNote}${dumpNote}${rootedNote}${versionedNote}${declaredNote}, ${undeclared.length} undeclared difference(s)\n`
  )
  return undeclared.length === 0 && unnamed.length === 0 ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)))
}
export {
  buildCandidate,
  compare,
  corpus,
  packageRootOf,
  pendingNotes,
  resolveCompiler,
  resolvePair,
  seedFromEnvironment,
  selfCheckDeclarations,
  selfCheckHardening,
  selfCheckNotes,
  selfCheckRoots,
  selfCheckVersions,
  isNamed,
  withoutHardening,
  withoutOwnRoot,
  withoutOwnVersion,
}
