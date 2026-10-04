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
 * hold. The notes are `CHANGELOG.md` for what has been released, and for what
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
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { extraArgs, linkPrograms, programs, root } from "./self/corpus.js"

/**
 * #382: the programs each codegen fix moves, one list per finding, so that a
 * program none of them names is still compared byte for byte. A fix that
 * changes an attribute or a lowering everywhere it applies moves most of the
 * corpus, and naming the programs rather than declaring every one keeps the
 * other half watched. Each list holds only what its own commit newly moved:
 * a program an earlier list already names is covered by that declaration.
 * The words are the finding's id, which both the fix's own commit subject and
 * the pull request's subject carry.
 */
const declareMoved = (moved, changelog, why) => moved.map((program) => ({ program, changelog, why }))

/** CG-8: the calls that can exit or block are no longer `willreturn`, nor is any caller of one. */
const CG8_MOVED = [
  "bench/awfy/main.ts",
  "bench/cursor.ts",
  "bench/getbyte.ts",
  "bench/map-presize.ts",
  "bench/map-proto-ordered-fp.ts",
  "bench/map-proto-ordered-fp32.ts",
  "bench/map-proto-ordered.ts",
  "bench/map-proto-unordered.ts",
  "bench/map-vs-stringmap.ts",
  "bench/map-wordcount.ts",
  "bench/par-alloc.ts",
  "bench/par-compute.ts",
  "bench/par-nbody.ts",
  "bench/par-short.ts",
  "bench/substr.ts",
  "docs/cookbook/builtin-capabilities.ts",
  "docs/cookbook/builtin-driver.ts",
  "docs/cookbook/builtin-env.ts",
  "docs/cookbook/builtin-files.ts",
  "docs/cookbook/builtin-host.ts",
  "docs/cookbook/builtin-nish-modules.ts",
  "docs/cookbook/builtin-read-bytes.ts",
  "docs/cookbook/builtin-realpath.ts",
  "docs/cookbook/builtin-streams.ts",
  "docs/cookbook/decl-const.ts",
  "docs/cookbook/decl-enum.ts",
  "docs/cookbook/decl-type-alias.ts",
  "docs/cookbook/mem-arena-scope.ts",
  "docs/cookbook/mem-reclaim.ts",
  "docs/cookbook/mem-tail-release.ts",
  "docs/cookbook/par-alloc.ts",
  "docs/cookbook/par-map.ts",
  "docs/cookbook/runtime-prelude.ts",
  "docs/cookbook/str-ops.ts",
  "docs/cookbook/str-template.ts",
  "docs/cookbook/thread-scope.ts",
  "examples/argv.ts",
  "examples/tasks.ts",
  "tests/cases/argv_echo.ts",
  "tests/cases/arr_bounds_continue_proven.ts",
  "tests/cases/arr_bounds_ranged.ts",
  "tests/cases/arr_for_of.ts",
  "tests/cases/arr_header_hoist_record_class.ts",
  "tests/cases/arr_path_callee_pop.ts",
  "tests/cases/arr_range_call_countdown.ts",
  "tests/cases/arr_range_call_loop.ts",
  "tests/cases/arr_sort.ts",
  "tests/cases/bytes_fill.ts",
  "tests/cases/bytes_offset_float.ts",
  "tests/cases/bytes_read.ts",
  "tests/cases/bytes_read_import.ts",
  "tests/cases/bytes_set_end.ts",
  "tests/cases/caps_fs_read.ts",
  "tests/cases/caps_fs_write.ts",
  "tests/cases/caps_generic.ts",
  "tests/cases/cf_return_void_call.ts",
  "tests/cases/cg_sec_exiting_runtime.ts",
  "tests/cases/cg_sec_new_array_guard.ts",
  "tests/cases/cg_sec_readdir_pass.ts",
  "tests/cases/cg_sec_readdir_return.ts",
  "tests/cases/cls_inline_array.ts",
  "tests/cases/cls_inline_array_call.ts",
  "tests/cases/cls_inline_array_dynamic.ts",
  "tests/cases/cls_inline_array_local.ts",
  "tests/cases/cls_inline_array_order.ts",
  "tests/cases/cls_inline_array_passed.ts",
  "tests/cases/cls_inline_array_push.ts",
  "tests/cases/cls_readonly_ok.ts",
  "tests/cases/ct_asm_p256.ts",
  "tests/cases/ct_asm_x25519.ts",
  "tests/cases/ct_eq_u32.ts",
  "tests/cases/ct_select_u32.ts",
  "tests/cases/ct_u64.ts",
  "tests/cases/dbg_locals.ts",
  "tests/cases/div_checked.ts",
  "tests/cases/f32_print.ts",
  "tests/cases/f32_struct.ts",
  "tests/cases/fn_arrow_concise_flow.ts",
  "tests/cases/fnarg_arrow.ts",
  "tests/cases/fnarg_forward.ts",
  "tests/cases/fnarg_generic.ts",
  "tests/cases/fnarg_named.ts",
  "tests/cases/gen_method_generic_class.ts",
  "tests/cases/i64_basic.ts",
  "tests/cases/int_min_literal.ts",
  "tests/cases/io_files.ts",
  "tests/cases/io_getenv.ts",
  "tests/cases/io_host.ts",
  "tests/cases/io_is_directory.ts",
  "tests/cases/io_mkdir.ts",
  "tests/cases/io_monotonic.ts",
  "tests/cases/io_nish_import.ts",
  "tests/cases/io_nish_import_global.ts",
  "tests/cases/io_nish_rename.ts",
  "tests/cases/io_readdir.ts",
  "tests/cases/io_readdir_null.ts",
  "tests/cases/io_realpath.ts",
  "tests/cases/io_spawn_to.ts",
  "tests/cases/io_spawn_to_inherit.ts",
  "tests/cases/io_streams.ts",
  "tests/cases/leading_zero_legal.ts",
  "tests/cases/map_fused_no_alias.ts",
  "tests/cases/map_fused_no_assign.ts",
  "tests/cases/map_fused_no_call.ts",
  "tests/cases/map_fused_no_element_receiver.ts",
  "tests/cases/map_fused_no_key_spelling.ts",
  "tests/cases/map_fused_no_other_map.ts",
  "tests/cases/map_fused_no_statement_before.ts",
  "tests/cases/map_fused_no_template.ts",
  "tests/cases/map_type_param_shadow.ts",
  "tests/cases/map_value_result.ts",
  "tests/cases/map_value_result_by_value.ts",
  "tests/cases/math_literal_operand_forms.ts",
  "tests/cases/math_numeric_separators.ts",
  "tests/cases/mem_loop_scope.ts",
  "tests/cases/mem_loop_scope_control.ts",
  "tests/cases/mem_loop_scope_escape.ts",
  "tests/cases/mem_loop_scope_forof.ts",
  "tests/cases/mem_loop_scope_interior.ts",
  "tests/cases/mem_loop_scope_threads.ts",
  "tests/cases/mem_read_bytes_scope.ts",
  "tests/cases/mem_read_import_scope.ts",
  "tests/cases/mem_read_or_null_scope.ts",
  "tests/cases/mem_reclaim_argument.ts",
  "tests/cases/mem_reclaim_guards.ts",
  "tests/cases/mem_reclaim_no_stack_alloc.ts",
  "tests/cases/mem_scope_string_temp.ts",
  "tests/cases/mem_scope_tail_call.ts",
  "tests/cases/mem_scope_tail_call_guards.ts",
  "tests/cases/neg_literal_i64_min.ts",
  "tests/cases/neg_literal_int_min_hex.ts",
  "tests/cases/neg_literal_unsigned.ts",
  "tests/cases/net_dual_stack.ts",
  "tests/cases/net_loop_calls.ts",
  "tests/cases/net_loop_two.ts",
  "tests/cases/net_tcp_echo.ts",
  "tests/cases/net_tcp_import.ts",
  "tests/cases/net_udp_calls.ts",
  "tests/cases/net_udp_echo.ts",
  "tests/cases/net_udp_offload.ts",
  "tests/cases/panics_io_exit.ts",
  "tests/cases/parse_numbers.ts",
  "tests/cases/perf_arena_drop.ts",
  "tests/cases/perf_clamp_order.ts",
  "tests/cases/perf_clamp_rebind.ts",
  "tests/cases/perf_rng_getbyte.ts",
  "tests/cases/perf_rng_loop.ts",
  "tests/cases/perf_str_concat_loop.ts",
  "tests/cases/perf_str_concat_quiet.ts",
  "tests/cases/port_num_div_quiet.ts",
  "tests/cases/port_num_libm.ts",
  "tests/cases/port_num_wrap.ts",
  "tests/cases/port_num_wrap_quiet.ts",
  "tests/cases/port_str_ascii_literal_quiet.ts",
  "tests/cases/port_str_length_printed.ts",
  "tests/cases/res_result_store.ts",
  "tests/cases/res_result_store_flow.ts",
  "tests/cases/rng_bitwise.ts",
  "tests/cases/rng_entries.ts",
  "tests/cases/rng_generic.ts",
  "tests/cases/rng_param.ts",
  "tests/cases/rng_widen.ts",
  "tests/cases/stage1_probe.ts",
  "tests/cases/str_concat.ts",
  "tests/cases/str_f64_mode.ts",
  "tests/cases/str_template.ts",
  "tests/cases/u_arith_wrap.ts",
  "tests/cases/u_compare_above_intmax.ts",
  "tests/cases/u_conv_roundtrip.ts",
  "tests/cases/u_print.ts",
  "tests/cases/u_struct_pack.ts",
  "tests/cases/u_udiv_urem.ts",
  "tests/differential/corpus/argv_words.ts",
  "tests/differential/corpus/arr_bounds_edge.ts",
  "tests/differential/corpus/arr_for_of.ts",
  "tests/differential/corpus/arr_methods.ts",
  "tests/differential/corpus/arr_push_growth.ts",
  "tests/differential/corpus/bit_compound_target.ts",
  "tests/differential/corpus/bit_fnv1a.ts",
  "tests/differential/corpus/bit_ops.ts",
  "tests/differential/corpus/bit_shifts.ts",
  "tests/differential/corpus/bool_logic.ts",
  "tests/differential/corpus/cf_switch.ts",
  "tests/differential/corpus/collatz.ts",
  "tests/differential/corpus/const_modules/main.ts",
  "tests/differential/corpus/exit_code.ts",
  "tests/differential/corpus/f32_round.ts",
  "tests/differential/corpus/f64_arith.ts",
  "tests/differential/corpus/f64_format.ts",
  "tests/differential/corpus/f64_i32_mixed.ts",
  "tests/differential/corpus/f64_libm.ts",
  "tests/differential/corpus/f64_math.ts",
  "tests/differential/corpus/i64_arith.ts",
  "tests/differential/corpus/int_div_overflow.ts",
  "tests/differential/corpus/int_div_zero.ts",
  "tests/differential/corpus/int_divmod.ts",
  "tests/differential/corpus/int_incdec.ts",
  "tests/differential/corpus/int_wrap.ts",
  "tests/differential/corpus/io_missing_file.ts",
  "tests/differential/corpus/io_panic.ts",
  "tests/differential/corpus/io_streams.ts",
  "tests/differential/corpus/loops_break_continue.ts",
  "tests/differential/corpus/loops_nested.ts",
  "tests/differential/corpus/main_return_code.ts",
  "tests/differential/corpus/modules_basic/main.ts",
  "tests/differential/corpus/modules_diamond/main.ts",
  "tests/differential/corpus/parse_argv_sum.ts",
  "tests/differential/corpus/parse_strings.ts",
  "tests/differential/corpus/prng_lcg.ts",
  "tests/differential/corpus/recursion.ts",
  "tests/differential/corpus/scopes_shadow.ts",
  "tests/differential/corpus/short_circuit.ts",
  "tests/differential/corpus/str_large.ts",
  "tests/differential/corpus/str_nul_escapes.ts",
  "tests/differential/corpus/str_slice.ts",
  "tests/differential/corpus/str_unicode.ts",
  "tests/differential/corpus/u_convert_shift.ts",
  "tests/differential/corpus/u_div_cmp.ts",
  "tests/link/alias_export_array/main.ts",
  "tests/link/alias_export_chain/main.ts",
  "tests/link/alias_export_class/main.ts",
  "tests/link/alias_export_imported_class/main.ts",
  "tests/link/alias_export_nullable/main.ts",
  "tests/link/alias_export_result/main.ts",
  "tests/link/argv_import/main.ts",
  "tests/link/caps_package/main.ts",
  "tests/link/caps_parallel/main.ts",
  "tests/link/cg_sec_new_array_f64/main.ts",
  "tests/link/cg_sec_new_array_i64/main.ts",
  "tests/link/cg_sec_push_limit/main.ts",
  "tests/link/cls_inline_array_exported/main.ts",
  "tests/link/cls_inline_array_header/main.ts",
  "tests/link/crypto_aes/main.ts",
  "tests/link/crypto_aes_f64/main.ts",
  "tests/link/crypto_base64url/main.ts",
  "tests/link/crypto_base64url_encode_long_f64/main.ts",
  "tests/link/crypto_base64url_k1_copies/main.ts",
  "tests/link/crypto_base64url_long_f64/main.ts",
  "tests/link/crypto_chacha20poly1305/main.ts",
  "tests/link/crypto_chacha20poly1305_f64/main.ts",
  "tests/link/crypto_ct/main.ts",
  "tests/link/crypto_ct_k1_copies/main.ts",
  "tests/link/crypto_ct_long_f64/main.ts",
  "tests/link/crypto_hkdf/main.ts",
  "tests/link/crypto_hkdf_f64/main.ts",
  "tests/link/crypto_hkdf_k1_bounds/main.ts",
  "tests/link/crypto_hkdf_k1_bounds_f64/main.ts",
  "tests/link/crypto_hkdf_long_f64/main.ts",
  "tests/link/crypto_hmac/main.ts",
  "tests/link/crypto_hmac_f64/main.ts",
  "tests/link/crypto_hmac_k1_verify/main.ts",
  "tests/link/crypto_hmac_k1_verify_f64/main.ts",
  "tests/link/crypto_hmac_sha256_digest_twice/main.ts",
  "tests/link/crypto_hmac_sha256_long_f64/main.ts",
  "tests/link/crypto_hmac_sha256_update_after_digest/main.ts",
  "tests/link/crypto_hmac_sha384_digest_twice/main.ts",
  "tests/link/crypto_hmac_sha384_long_f64/main.ts",
  "tests/link/crypto_hmac_sha384_update_after_digest/main.ts",
  "tests/link/crypto_p256/main.ts",
  "tests/link/crypto_p256_f64/main.ts",
  "tests/link/crypto_sha256/main.ts",
  "tests/link/crypto_sha256_copy_after_digest/main.ts",
  "tests/link/crypto_sha256_digest_twice/main.ts",
  "tests/link/crypto_sha256_f64/main.ts",
  "tests/link/crypto_sha256_long_f64/main.ts",
  "tests/link/crypto_sha256_update_after_digest/main.ts",
  "tests/link/crypto_sha2_lengths/main.ts",
  "tests/link/crypto_sha2_lengths_f64/main.ts",
  "tests/link/crypto_sha384_long_f64/main.ts",
  "tests/link/crypto_sha512/main.ts",
  "tests/link/crypto_sha512_digest_twice/main.ts",
  "tests/link/crypto_sha512_f64/main.ts",
  "tests/link/crypto_sha512_long_f64/main.ts",
  "tests/link/crypto_sha512_spent/main.ts",
  "tests/link/crypto_x25519/main.ts",
  "tests/link/crypto_x25519_f64/main.ts",
  "tests/link/crypto_x509/main.ts",
  "tests/link/crypto_x509_audit/main.ts",
  "tests/link/crypto_x509_f64/main.ts",
  "tests/link/crypto_x509_malformed/main.ts",
  "tests/link/enum_export_uses/main.ts",
  "tests/link/fnarg_private/main.ts",
  "tests/link/map_extras_user_names/main.ts",
  "tests/link/module_stem_clash/main.ts",
  "tests/link/package_symlink/main.ts",
  "tests/link/package_workspace/main.ts",
  "tests/link/panics_parallel_length/main.ts",
  "tests/link/par_alloc/main.ts",
  "tests/link/par_dst_short/main.ts",
  "tests/link/par_map/main.ts",
  "tests/link/par_map_large/main.ts",
  "tests/link/par_reduce/main.ts",
  "tests/link/par_reduce_blocks/main.ts",
  "tests/link/reachable_struct_return/main.ts",
  "tests/link/rt_sec_path_nul/main.ts",
  "tests/link/rt_sec_read_cap/main.ts",
  "tests/link/rt_sec_wasm_arena/main.ts",
  "tests/link/std_package_scope/main.ts",
  "tests/link/std_pair_array/main.ts",
  "tests/link/std_pair_f64/main.ts",
  "tests/link/std_pair_scalar/main.ts",
  "tests/link/std_testing/main.ts",
  "tests/link/tail_call_depth/main.ts",
  "tests/link/thread_scope_basic/main.ts",
  "tests/link/thread_scope_exit_paths/main.ts",
  "tests/link/thread_scope_many_arrays/main.ts",
  "tests/link/thread_scope_nested_arena/main.ts",
  "tests/parser/names-bindings.ts",
  "tests/parser/names-classes.ts",
  "tests/parser/names-declaration-calls.ts",
  "tests/parser/names-declarations.ts",
  "tests/parser/names-meta.ts",
  "tests/parser/names-object-literals.ts",
  "tests/parser/names-operator-calls.ts",
  "tests/parser/names-operators.ts",
]

/** CG-4: a function on a call-graph cycle, and every caller of one, is no longer `willreturn`. */
const CG4_MOVED = [
  "bench/fib.ts",
  "tests/cases/arr_range_call.ts",
  "tests/cases/cf_fib.ts",
  "tests/cases/cg_sec_recursion_willreturn.ts",
  "tests/cases/cls_this_method_call.ts",
  "tests/cases/fn_arrow.ts",
  "tests/cases/fn_arrow_hoisting.ts",
  "tests/cases/gen_recursive_ground.ts",
  "tests/cases/mem_callee_scope.ts",
  "tests/link/tail_call_depth_debug/main.ts",
]

/** CG-2: `new Array(n)` checks an `i32` `n`, and a ranged one that reaches below zero, before it allocates. */
const CG2_MOVED = [
  "bench/sieve.ts",
  "docs/cookbook/arr-new.ts",
  "docs/cookbook/arr-range-call.ts",
  "examples/arrays.ts",
  "tests/cases/arr_new_zeroed.ts",
  "tests/cases/arr_repeat_check.ts",
  "tests/cases/arr_sum.ts",
  "tests/cases/arr_typed_views.ts",
  "tests/cases/cg_sec_new_array_negative.ts",
  "tests/cases/cg_sec_new_array_negative_f64.ts",
  "tests/cases/map_fused_no_two_gets.ts",
  "tests/cases/mem_loop_scope_chunk.ts",
  "tests/cases/mem_scope_dynamic_array.ts",
  "tests/cases/port_array_quiet.ts",
  "tests/cases/port_array_zero_fill.ts",
  "tests/link/cg_sec_new_array_negative/main.ts",
  "tests/link/crypto_hmac_sha256_window/main.ts",
  "tests/link/crypto_hmac_sha384_window/main.ts",
  "tests/link/crypto_sha256_window/main.ts",
  "tests/link/crypto_sha256_window_wrap/main.ts",
  "tests/link/crypto_sha512_window/main.ts",
  "tests/link/crypto_sha512_window_wrap/main.ts",
]

/** CG-3: `join` refuses a result past 2^31 - 1 bytes before it allocates. */
const CG3_MOVED = [
  "docs/cookbook/arr-join.ts",
  "tests/cases/arr_join.ts",
  "tests/cases/arr_readonly_param.ts",
  "tests/cases/bytes_offset_u64.ts",
  "tests/cases/bytes_set_disjoint.ts",
  "tests/cases/bytes_set_self.ts",
  "tests/cases/cg_sec_join_limit.ts",
  "tests/cases/net_tcp_calls.ts",
  "tests/cases/os_random.ts",
  "tests/link/caps_package_named_nish/main.ts",
  "tests/link/cg_sec_join_limit/main.ts",
]

/** CG-10: a compound element assignment whose right side can resize the array takes the slot again after it. */
const CG10_MOVED = ["tests/cases/cg_sec_compound_element_order.ts", "tests/cases/panics_index_recheck.ts"]

/**
 * Output differences that are decided rather than broken, each with the words
 * `CHANGELOG.md` must carry before this run can go green. Shape:
 *
 *   {
 *     program: "tests/cases/str_concat.ts",  // omit for every program
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
 * *next* difference in the same place is still reported. A release that
 * changes the IR of the whole corpus is a declaration with no `program` and a
 * paragraph in `CHANGELOG.md` to match, and it should feel like a bigger thing
 * to write than five narrow ones, because it is.
 */
/**
 * The no-panic scope's proofs: a divisor proven to be neither 0 nor -1 (a
 * constant, a declared range, or a guard such as `d !== 0 && d !== -1`), and a
 * `pop` behind a test that its array holds an element, are left unchecked, so
 * the `div.fail` or `pop.empty` block goes, and with it the `nish_panic_*`
 * callee its function no longer reaches.
 */
const DENY_PANICS_MOVED = [
  "bench/result.ts",
  "docs/cookbook/expr-logical.ts",
  "docs/cookbook/stmt-break-continue.ts",
  "docs/cookbook/stmt-do.ts",
  "docs/cookbook/stmt-result-by-value.ts",
  "docs/cookbook/stmt-result.ts",
  "docs/cookbook/stmt-while.ts",
  "docs/cookbook/types-i64.ts",
  "tests/cases/arr_path_cond_call.ts",
  "tests/cases/arr_path_cond_f64.ts",
  "tests/cases/arr_path_cond_generic.ts",
  "tests/cases/arr_path_cond_or.ts",
  "tests/cases/arr_path_cond_ternary.ts",
  "tests/cases/arr_pop_index.ts",
  "tests/cases/cf_break_continue.ts",
  "tests/cases/cf_collatz.ts",
  "tests/cases/cf_compound_assign.ts",
  "tests/cases/cf_do_while.ts",
  "tests/cases/cf_logical.ts",
  "tests/cases/cf_nested.ts",
  "tests/cases/cf_sum_loop.ts",
  "tests/cases/cf_while.ts",
  "tests/cases/cls_compound_field.ts",
  "tests/cases/dbg_result.ts",
  "tests/cases/gen_result_payload.ts",
  "tests/cases/interop_rng_host.ts",
  "tests/cases/mem_stack_loop.ts",
  "tests/cases/opt_nsw.ts",
  "tests/cases/opt_target_triple.ts",
  "tests/cases/panics_divide.ts",
  "tests/cases/panics_pop.ts",
  "tests/cases/perf_overflow_quiet.ts",
  "tests/cases/port_num_div.ts",
  "tests/cases/res_basic.ts",
  "tests/cases/res_by_value.ts",
  "tests/cases/res_by_value_propagate.ts",
  "tests/cases/res_export.ts",
  "tests/cases/res_stack.ts",
  "tests/differential/corpus/digits.ts",
  "tests/differential/corpus/int_literal_edges.ts",
  "tests/link/std_pair_held/main.ts",
]

/** Programs new with the no-panic scope, whose exit the reference cannot share: it does not know the flag or the field. */
const DENY_PANICS_NEW = [
  "tests/cases/deny_panics_clean.ts",
  "tests/link/no_panic_module/main.ts",
  "tests/link/no_panic_transitive/main.ts",
  "tests/link/no_panic_unknown_entry/main.ts",
]

/** Programs new with the capability policy (WP36), whose exit the reference cannot share: it does not know the flags or the field. */
const CAPABILITY_POLICY_NEW = [
  "tests/link/caps_policy_granted/main.ts",
  "tests/link/caps_policy_manifest_both/main.ts",
  "tests/link/caps_policy_manifest_shape/main.ts",
  "tests/link/caps_policy_manifest_unknown/main.ts",
  "tests/link/caps_policy_manifest_unsafe/main.ts",
]

const DECLARED = [
  {
    program: "tests/link/net_hpack/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_f64/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_bad_huffman_window/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_bad_indexing/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_bad_prefix_decode/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_bad_prefix_encode/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_bad_window/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_negative_list_limit/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_negative_resize/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_negative_settings_limit/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/link/net_hpack_negative_table_size/main.ts",
    changelog: "Nish/net/hpack — HPACK with Huffman (WP34 H2, first part)",
    why: "a new program: it imports `nish/net/hpack`, which the reference compiler's standard library does not have",
  },
  {
    program: "tests/cases/entry_shebang.ts",
    changelog: "shebang line",
    why: "it opens with `#!/usr/bin/env -S nish run`, which the reference lexes as a `#` token and refuses",
  },
  {
    program: "docs/cookbook/decl-shebang.ts",
    changelog: "shebang line",
    why: "it opens with `#!/usr/bin/env -S nish run`, which the reference lexes as a `#` token and refuses",
  },
  {
    program: "tests/cases/asi_statements.ts",
    changelog: "Make semicolons optional, by TypeScript's insertion rule",
    why: "it leaves out semicolons TypeScript would insert, which the reference refuses as a syntax error",
  },
  {
    program: "tests/cases/asi_continuation.ts",
    changelog: "Make semicolons optional, by TypeScript's insertion rule",
    why: "it leaves out semicolons TypeScript would insert, which the reference refuses as a syntax error",
  },
  {
    program: "docs/cookbook/fn-add-no-semicolons.ts",
    changelog: "Make semicolons optional, by TypeScript's insertion rule",
    why: "it leaves out semicolons TypeScript would insert, which the reference refuses as a syntax error",
  },
  {
    program: "tests/cases/map_fused_generic.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_guard_has.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_guard_not_has.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_literal_key.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_no_else_branch.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_set_insert.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_this_field.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_update_has.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_walk.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_fused_wordcount.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_get_nullish.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "its word count, `counts.set(w, (counts.get(w) ?? 0) + 1)`, is now one probe",
  },
  {
    program: "docs/cookbook/map-get.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "its `bump` is the word-count update, now one probe",
  },
  {
    program: "tests/link/map_two_modules/main.ts",
    file: "tally.ll",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "`tally.ts` is a guarded insert, `if (!m.has(w)) { m.set(w, 1); }`, now one probe",
  },
  {
    program: "docs/cookbook/map-fused.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it asks the global `Map` or `Set` about one key twice, which is now one probe and a write through its answer where the reference makes two",
  },
  {
    program: "tests/cases/map_dbg.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "under `-g` the `Set` methods' DWARF lines move: `Map.reserveSlots` now sits above `Set` in `std/collections.ts`",
  },
  {
    program: "tests/cases/map_extras_generic.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "tests/cases/map_extras_get_or_insert.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "tests/cases/map_extras_reserve.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "tests/cases/map_extras_walk.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "tests/link/map_extras_two_modules/main.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "examples/wordcount.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "docs/cookbook/map-fused-extras.ts",
    changelog: "One probe for has/get/set on one key, and nish/map's reserve and getOrInsert",
    why: "it imports `nish/map`, which the reference compiler does not have",
  },
  {
    program: "tests/cases/map_iter_exit_edges.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/link/map_walk_two_modules/main.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_generic.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/dbg_map_iter.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_break.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_callee.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_clear.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_compaction_deferred.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_delete_ahead.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_delete_reset.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_growth.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_keys.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_nested.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_or_return.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_return.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_set_existing.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_set_new.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_iter_values.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/set_iter.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/set_iter_keys.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/set_iter_values.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "docs/cookbook/map-iter.ts",
    changelog: "For...of over Map keys() and values() and over a Set",
    why: "a new program: it walks the global `Map` or `Set` with `for...of`, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_default_escapes.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_narrow.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_nullish.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_pointer_value.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_value_bool.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_value_f64.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_value_i32.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_value_string.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_interface.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_narrowed_again.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/dbg_map_get.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_get_value_widths.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "docs/cookbook/map-get.ts",
    changelog: "Map.get, typed V | undefined and narrowed as TypeScript does",
    why: "a new program: it calls `get` on the global `Map`, or uses `??` or `=== undefined` on its result, which the reference compiler refuses",
  },
  {
    program: "tests/cases/map_annotated_new.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_arena_callee.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_compaction.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_dbg.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_delete_reinsert.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_fingerprint_miss.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_growth.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_bool.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_class.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_enum.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_f32.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_f64.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_f32_negzero.ts",
    changelog: "Store a -0 Map key or Set element as +0, as JavaScript does",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_negzero.ts",
    changelog: "Store a -0 Map key or Set element as +0, as JavaScript does",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_i32.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_i64.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_str.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_u16.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_u32.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_u64.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/map_key_u8.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/set_i32.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/set_str.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "examples/sets.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "docs/cookbook/map-has.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/link/map_two_modules/main.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: it names the global `Map` or `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/link/map_own_class/main.ts",
    changelog: "The global Map and Set, backed by std/collections.ts",
    why: "a new program: its entry declares its own `Map` and `unique.ts` names the global `Set`, which the reference compiler refuses as an unknown class",
  },
  {
    program: "tests/cases/perf_bounds_toi32.ts",
    file: "perf_bounds_toi32.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program: the `toI32(w.length)` hoist proven in i32 mode, which the reference compiler still checks",
  },
  {
    program: "tests/cases/perf_bounds_toi32_f64.ts",
    file: "perf_bounds_toi32_f64.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program: the same hoist under --number-mode f64, which the reference compiler still checks",
  },
  {
    program: "tests/cases/perf_bounds_toi32_loop.ts",
    file: "perf_bounds_toi32_loop.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program; its two loop checks stay, but `xs[0]` loses its check: the builtin `toI32` calls before it no longer drop the length its array literal proved",
  },
  {
    program: "docs/cookbook/str-bounds-toi32.ts",
    file: "str-bounds-toi32.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the cookbook snippet for the `toI32(s.length)` hoist, whose check the reference compiler keeps",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)` too, so its checks are now proven",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "main.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the imported std/text and std/testing functions' attributes change with their dropped panics",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven under --number-mode f64 as well",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing's `toI32(x.length)` hoists are proven under --number-mode f64 as well",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "main.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the imported std/text and std/testing functions' attributes change with their dropped panics",
  },
  {
    program: "tests/link/std_testing/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_testing_fail/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_package_scope/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "json.ll",
    changelog: "Fold a negated integer literal into its constant",
    why: "std/json's `return -1` is the constant `-1` rather than a `sub nsw i32 0, 1`, and the values after it renumber",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "json.ll",
    changelog: "Fold a negated integer literal into its constant",
    why: "the same std/json constants under --number-mode f64",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "json.ll",
    changelog: "Hold std/ and examples/ to zero performance warnings and ratchet src/",
    why: "std/json's reads and `substring` clamps are proven by the guards it now states, through `toI32(w.length)`, which the reference compiler still checks",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "json.ll",
    changelog: "Hold std/ and examples/ to zero performance warnings and ratchet src/",
    why: "the same std/json proofs under --number-mode f64",
  },
  {
    program: "tests/cases/gen_constraint.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: `<T extends Shape>` at two implementers, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_class.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a generic class with a constrained parameter, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_generic_bound.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a constraint that is an instantiation, `T extends Container<i32>`, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_method.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a method called through a class constraint, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_two.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: two parameters with different constraints, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_write.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a field written through a constrained parameter, which the reference compiler refuses to parse",
  },
  {
    program: "docs/cookbook/gen-constraint.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new cookbook snippet: the constrained-parameter lowering, which the reference compiler refuses to parse",
  },
  {
    program: "tests/link/generic_constraint_import/main.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: constrained templates imported from another module, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/link/generic_constraint_import_back/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_constraint_same_name_fields/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: a class implementing the importer's own same-named `Shape`, with lib's fields, which the reference compiler took for lib's `Shape` and compiled",
  },
  {
    program: "tests/link/generic_constraint_same_name_itself/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: the importer's own same-named `Shape` passed as the argument, which shares lib's type id and which the reference compiler compiled",
  },
  {
    program: "tests/link/generic_constraint_same_name_class/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: the importer's own same-named `Base` class passed to a `T extends Base` bound on lib's class, which shares its type id and which the reference compiler compiled",
  },
  {
    program: "tests/link/iface_same_name_class/main.ts",
    file: "exit",
    changelog: "Same-named interfaces and classes across modules keep their identity",
    why: "a new negative: lib's `Circle` converted to the importer's own same-named `Shape`, which shares lib's `Shape`'s type id and which the reference compiler compiled, reading `Circle`'s layout as the wrong `Shape`'s",
  },
  {
    program: "tests/link/package_engines_floor/main.ts",
    file: "exit",
    changelog: "WP21 S3 — specific diagnostics at the package boundary",
    why: "a new negative: a package whose `engines.nish` floor is above this compiler, which the reference compiler does not read and so compiled",
  },
  {
    program: "tests/link/package_engines_range/main.ts",
    file: "exit",
    changelog: "WP21 S3 — specific diagnostics at the package boundary",
    why: "a new negative: an `engines.nish` range that is not a floor, refused rather than taken as met, which the reference compiler does not read and so compiled",
  },
  {
    program: "tests/cases/dbg_generic.ts",
    file: "dbg_generic.ll",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "a new program: with -g the reference compiler names the class `Box$i32` and its methods `Box$i32.get`, where HEAD writes `Box<i32>`, `Box<i32>.get` and `identity<Box<i32>>`",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_constraint_import/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.d.ts",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "the comment above the exported `Cell<f64>` constructor names it as written, where the reference wrote the symbol `Cell$f64.constructor`",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.napi.c",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "the comment above the exported `Cell<f64>` constructor names it as written, where the reference wrote the symbol `Cell$f64.constructor`",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword; and the comments above the methods of `Box<i32>` and `Box<Point>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`; and the comments above the methods of `Box<i32>` and `Box<Point>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword; and the comments above the methods of `Box<Pair<i32>>` and `Pair<i32>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/cases/gen_method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Chooser.pick<T>` on a non-generic class, which the reference compiler refuses at the `<` after the method name (`a type annotation is required`) and HEAD compiles to `@Chooser.pick$i32` and `@Chooser.pick$str`",
  },
  {
    program: "tests/cases/gen_method_generic_class.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Box<T>.pair<U>` at two receivers and two method tuples, which the reference compiler refuses at the method's type parameter list and HEAD compiles to four defines",
  },
  {
    program: "tests/cases/gen_method_constraint.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `apply<U extends Shape>` on a plain class and `plus<U extends Shape>` on a generic one, which the reference compiler refuses at the method's type parameter list and HEAD compiles to direct field reads",
  },
  {
    program: "tests/cases/gen_method_export.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: an exported class's generic methods, which the reference compiler refuses at the method's type parameter list and HEAD compiles, with each instantiation in the header as `nish_gen_Holder_pick_i32` and the like",
  },
  {
    program: "tests/cases/dbg_generic_method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Box<i32>.pair<U>` under -g, which the reference compiler refuses at the method's type parameter list and HEAD compiles with `DISubprogram`s named `Box<i32>.pair<string>` and `Box<i32>.pair<i32>`",
  },
  {
    program: "docs/cookbook/gen-method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "the cookbook snippet for a generic method, which the reference compiler refuses at the method's type parameter list and HEAD compiles to `@Chooser.pick$i32`, `@Chooser.pick$str` and `@Box$i32.keep$str`",
  },
  {
    program: "tests/link/generic_method_import/main.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: an exported class's generic methods called from two importers, which the reference compiler refuses at the method's type parameter list in lib.ts and HEAD compiles with one `define` per instantiation, in lib.ll",
  },
  // #106: `src/bounds.ts` proves `h.xs[i]` from `h.xs.length`, so the compiler's
  // own accesses through a field lose their checks and every module of it moves,
  // bounds checks and the attributes a dropped panic frees alike. One entry per
  // `src/` program, read from the corpus rather than listed, because the reason
  // is the same for all of them.
  ...programs()
    .map((file) => path.relative(root, file))
    .filter((program) => program.startsWith("src/"))
    .map((program) => ({
      program,
      changelog: "Key bounds length facts by property path",
      why: "the compiler's own field-held accesses are proven by property-path length facts, so their checks and the attributes a dropped panic frees move in every module",
    })),
  {
    program: "bench/hoist-field.ts",
    file: "hoist-field.ll",
    changelog: "Key bounds length facts by property path",
    why: "`fieldScan`'s `h.xs[i]` is proven by `i < h.xs.length`, the check the reference compiler keeps and the 2.38x this change measures",
  },
  {
    program: "tests/cases/arr_header_hoist.ts",
    file: "arr_header_hoist.ll",
    changelog: "Key bounds length facts by property path",
    why: "`@fieldScale`'s `h.xs[i]` loses its check, so its loop is `@constScale`'s register for register",
  },
  {
    program: "tests/cases/arr_path_hold.ts",
    file: "arr_path_hold.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: the accesses a property-path fact proves, whose checks the reference compiler keeps",
  },
  {
    program: "tests/cases/arr_path_nullable.ts",
    file: "arr_path_nullable.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `@plain`'s path from a `Holder` is proven where the reference compiler keeps the check; `@narrowed`'s, from a `Holder | null`, keeps it in both",
  },
  {
    program: "tests/link/reachable_struct/main.ts",
    changelog: "Key bounds length facts by property path",
    why: "`this.entries.length > 0 ? this.entries[0] : null` in lib.ts is proven by the guard on the path, so lib.ll drops its `nish_panic_index` and main.ll's declarations of lib's methods regroup their attributes",
  },
  // The local forms of the two ordering holes #179's review found. The seed
  // proves each of these accesses and reads or writes past the array; HEAD keeps
  // the check, so the difference is the fix.
  {
    program: "tests/cases/arr_bounds_cond_effect.ts",
    file: "arr_bounds_cond_effect.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `i < xs.length && drain(xs) > 0` no longer proves `xs[i]`, which the reference compiler proves and reads past",
  },
  {
    program: "tests/cases/arr_bounds_cond_assign.ts",
    file: "arr_bounds_cond_assign.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `i < xs.length && (xs = short).length > 0` no longer proves `xs[i]`, which the reference compiler proves and reads past",
  },
  {
    program: "tests/cases/arr_bounds_store_rhs.ts",
    file: "arr_bounds_store_rhs.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `xs[i] = (i = 0)` keeps its check, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_path_continue_for.ts",
    file: "arr_path_continue_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that stores `h.xs` keeps the check on the `for` update's `h.xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_path_continue_do.ts",
    file: "arr_path_continue_do.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a call before `continue` keeps the check on the `do/while` condition's `h.xs[i]`, which the reference compiler drops and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_for.ts",
    file: "arr_bounds_continue_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that rebinds `xs` keeps the check on the `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_do.ts",
    file: "arr_bounds_continue_do.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that rebinds `xs` keeps the check on the `do/while` condition's `xs[i]`, which the reference compiler drops and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_lazy_unwrap_or.ts",
    file: "arr_bounds_lazy_unwrap_or.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an `unwrapOr` fallback that never ran proves nothing, so `s.charCodeAt(i)` keeps the check the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_lazy_expect.ts",
    file: "arr_bounds_lazy_expect.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an `expect` message that never ran proves nothing, so `s.charCodeAt(i)` keeps the check the reference compiler drops",
  },
  {
    program: "tests/cases/arr_header_hoist_record_store.ts",
    file: "arr_header_hoist_record_store.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a whole-record store into `rs` keeps `r.xs` from being hoisted, where the reference compiler hoists it and reads the replaced array",
  },
  {
    program: "tests/cases/arr_bounds_continue_nested.ts",
    file: "arr_bounds_continue_nested.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an outer `continue` that rebinds `xs`, followed by an inner loop with its own `continue`, keeps the check on the outer `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_switch.ts",
    file: "arr_bounds_continue_switch.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` in a `switch` clause that rebinds `xs` keeps the check on the `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_break_for.ts",
    file: "arr_bounds_break_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body moves `i` keeps the check on `xs[i]` after the `for`, which the reference compiler drops because the condition proved it",
  },
  {
    program: "tests/cases/arr_bounds_break_while.ts",
    file: "arr_bounds_break_while.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body rebinds `xs` keeps the check on `xs[5]` after the `while`, which the reference compiler drops because the condition proved it",
  },
  {
    program: "tests/cases/arr_bounds_break_for_string.ts",
    file: "arr_bounds_break_for_string.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a guarded `break` after the body moves `k` keeps the check on `s.charCodeAt(i)` under `i < k`, which the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_break_while_string.ts",
    file: "arr_bounds_break_while_string.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body moves `k` keeps the check on `s.charCodeAt(i)` under `i < k`, which the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances.ts",
    file: "arr_bounds_generic_instances.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk<Box>` proves `r.xs[i]` and `walk<Rec>`, whose whole-record store replaces the array under `r`, keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_prim.ts",
    file: "arr_bounds_generic_instances_prim.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk<i32>` proves `r.xs[i]` and `walk<Rec>` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_method.ts",
    file: "arr_bounds_generic_instances_method.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `Store<Box>.walk` proves `r.xs[i]` and `Store<Rec>.walk` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_iface.ts",
    file: "arr_bounds_generic_instances_iface.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk` over `Cell<string>` proves `r.xs[i]` and over `Cell<Rec>` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_header_hoist_record_view.ts",
    file: "arr_header_hoist_record_view.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a whole-record store into `rs` keeps `c.rec.xs`, read off a `Rec` view in a class field, from being hoisted and keeps its check, where the reference compiler hoists it and reads the replaced array",
  },
  {
    program: "docs/cookbook/arr-bounds-path.ts",
    file: "arr-bounds-path.ll",
    changelog: "Key bounds length facts by property path",
    why: "the cookbook snippet for a property-path fact, whose `h.xs[i]` check the reference compiler keeps",
  },
  {
    program: "tests/link/std_pair_scalar/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32, boolean>` returned across a module boundary, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_f64/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<string, f64>` under --number-mode f64, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_array/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32[], string>`, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_nested/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a nested `Pair<Pair<i32, i32>, string>`, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_held/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32, boolean>` held in a class field and pushed into an array, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/cases/attr_panic_charcodeat.ts",
    file: "attr_panic_charcodeat.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "a new program: `@at` and `@nish_main` reach `nish_panic_index` through an unproven `charCodeAt` and are not `willreturn`, where the reference compiler marks both and the speed profile deletes the panic",
  },
  {
    program: "tests/cases/str_bytes.ts",
    file: "str-bytes.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@firstByte`'s unproven `charCodeAt(0)` can reach `nish_panic_index`, so it and `@test` lose `willreturn`, and `@firstByte` its `readonly`, as an unproven `a[i]` already does",
  },
  {
    program: "docs/cookbook/str-bytes.ts",
    file: "str-bytes.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@firstByte`'s unproven `charCodeAt(0)` can reach `nish_panic_index`, so it loses `willreturn` and `readonly` and the attribute groups renumber",
  },
  {
    program: "tests/cases/arr_path_cond_string.ts",
    file: "arr_path_cond_string.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@code`'s unproven `t.s.charCodeAt(i)` can reach `nish_panic_index`, so it and `@nish_main` lose `willreturn`",
  },
  {
    program: "tests/differential/corpus/str_methods.ts",
    file: "str_methods.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@nish_main`'s unproven `charCodeAt` can reach `nish_panic_index`, so it loses `willreturn` and the attribute groups renumber",
  },
  {
    program: "tests/link/result_import/main.ts",
    file: "lib.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@parseDigit`'s unproven `text.charCodeAt(at)` can reach `nish_panic_index`, so it loses `willreturn`",
  },
  {
    program: "tests/link/result_import/main.ts",
    file: "main.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "the importer's `declare` of `@parseDigit` loses `willreturn` with its definition, and the attribute groups renumber",
  },
  {
    program: "tests/link/class_clash_fields/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: #193's two same-named classes with fields only, which the reference compiler merges into one type and compiles, and HEAD refuses at the second declaration",
  },
  {
    program: "tests/link/iface_clash_private/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: #193's private interface passed across modules as a same-named one, which the reference compiler compiles and HEAD refuses at the second declaration",
  },
  {
    program: "tests/link/class_dollar_name/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: a declared `class Box$i32` beside the instantiation `Box<i32>`, which the reference compiler merges into one type and compiles, and HEAD refuses for its `$`",
  },
  {
    program: "tests/link/class_dollar_name_imported/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: `class_dollar_name` in the other load order, which the reference compiler compiles and HEAD refuses for the `$` in the name it was written with",
  },
  {
    program: "tests/link/package_symlink/main.ts",
    file: "exit",
    changelog: "Module and package identity is the real path",
    why: "pnpm's layout, one package reached through a symlink, which the reference compiler loads as two copies and refuses as a clash on `val`, and HEAD compiles as one package (#198)",
  },
  {
    program: "tests/link/identity_symlink_cwd/main.ts",
    file: "exit",
    changelog: "Module and package identity is the real path",
    why: "a new program: one file named as a root through a linked directory beside an import of it, which the reference compiler loads as two modules and refuses as a duplicate export, and HEAD loads once (#198)",
  },
  {
    program: "tests/link/identity_symlink_dotdot/main.ts",
    file: "types.ll",
    changelog: "Module and package identity is the real path",
    why: "a new program: `types.ts` and `far/../types.ts` are two files whose stems meet, and the reference compiler writes the second over the first, so its `types.ll` is the root's where HEAD's is the import's (#198)",
  },
  {
    program: "tests/link/identity_symlink_dotdot/main.ts",
    file: "types_2.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: HEAD names the second module `types_2.ll` rather than overwriting the first, and the reference compiler writes no such file (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "index.ll",
    changelog: "Module and package identity is the real path",
    why: "a new program: a workspace link `node_modules/foo -> ../packages/foo`, whose modules HEAD names under the package's real directory, `packages/foo/index.ts`, where the reference compiler names them through the link (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "node_modules_foo_helper.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: the reference compiler stems `foo`'s own `helper.ts` from the link's spelling, and HEAD writes it as `packages_foo_helper.ll` (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "packages_foo_helper.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: HEAD stems `foo`'s own `helper.ts` from the package's real directory, a file the reference compiler does not write (#198)",
  },
  {
    program: "tests/cases/fnarg_named.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: a function-typed parameter given two named callees, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/fnarg_arrow.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: arrows written as function arguments, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/fnarg_generic.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: generic templates whose function argument binds a type parameter, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/fnarg_forward.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: a function parameter passed on to another template, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/dbg_fnarg_arrow.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: a lifted arrow under -g, which the reference compiler refuses to parse",
  },
  {
    program: "tests/parser/fnarg.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new parser fixture for the function type and the arrow expression, which the reference compiler refuses to parse",
  },
  {
    program: "tests/link/fnarg_private/main.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: a private function and arrows passed to another module's templates, which the reference compiler refuses to parse",
  },
  {
    program: "docs/cookbook/fnarg-named.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "the cookbook snippet for a function parameter given two named callees, which the reference compiler refuses to parse",
  },
  {
    program: "docs/cookbook/fnarg-arrow.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "the cookbook snippet for a lifted arrow argument, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/fnarg_loop_hoist.ts",
    file: "exit",
    changelog: "Compile-time function parameters, monomorphised per callee",
    why: "a new program: an arrow argument written inside a loop whose headers are hoisted, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/arr_readonly_field.ts",
    file: "arr_readonly_field.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/arr_strings.ts",
    file: "arr_strings.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/cls_interface_literal.ts",
    file: "cls_interface_literal.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/conv_f64_context.ts",
    file: "conv_f64_context.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/diag_order.ts",
    file: "diag_order.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/diag_order_pass1.ts",
    file: "diag_order_pass1.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/fn_arrow_concise.ts",
    file: "fn_arrow_concise.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/io_spawn.ts",
    file: "io_spawn.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "docs/cookbook/mem-callee-scope.ts",
    file: "mem-callee-scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "the cookbook snippet for the callee scope: `size` brackets itself, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_callee_scope.ts",
    file: "mem-callee-scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `List.benchmark` brackets itself with the callee scope, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_callee_scope_escape.ts",
    file: "mem_callee_scope_escape.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose functions correctly get no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_nested.ts",
    file: "mem_callee_scope_nested.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose `keep` correctly gets no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_return.ts",
    file: "mem_callee_scope_return.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose `summary` correctly gets no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_tree.ts",
    file: "mem_callee_scope_tree.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `Storage.benchmark` brackets itself with the callee scope, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_getenv_scope.ts",
    file: "mem_getenv_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_nullable.ts",
    file: "mem_nullable.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_readdir_scope.ts",
    file: "mem_readdir_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_reclaim_call.ts",
    file: "mem_reclaim_call.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_stack_ctor_capture.ts",
    file: "mem_stack_ctor_capture.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_stack_escape.ts",
    file: "mem_stack_escape.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_threads_arena.ts",
    file: "mem_threads_arena.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/perf_arena_loop.ts",
    file: "perf_arena_loop.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `quiet` gets the callee scope, and the two functions the new warning names do not",
  },
  {
    program: "tests/cases/perf_arena_quiet.ts",
    file: "perf_arena_quiet.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/perf_padding_suffix_gap.ts",
    file: "perf_padding_suffix_gap.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_by_value_param.ts",
    file: "res_by_value_param.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_propagate.ts",
    file: "res_propagate.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_struct_error.ts",
    file: "res_struct_error.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "bench/strbuild.ts",
    file: "strbuild.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/arr_2d.ts",
    file: "arr_2d.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/arr_sort_reverse.ts",
    file: "arr_sort_reverse.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/class_prefix.ts",
    file: "class_prefix.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/io_roundtrip.ts",
    file: "io_roundtrip.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_basic.ts",
    file: "str_basic.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_build_loop.ts",
    file: "str_build_loop.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_template.ts",
    file: "str_template.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/ternary_chain.ts",
    file: "ternary_chain.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/reachable_struct_chain/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_array/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_held/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_nested/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_testing/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_testing_fail/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/struct_array_field/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/arr_repeat_check.ts",
    file: "arr-repeat-check.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "a new program: AWFY Permute's `swap` on a field array keeps two of its four checks, and `double`'s repeated `this.v[i]` one of three",
  },
  {
    program: "tests/cases/arr_repeat_check_local.ts",
    file: "arr_repeat_check_local.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "a new program: a repeated `xs[i]`, `s.charCodeAt(k)` and literal `xs[0]`/`xs[1]` after `xs[2]` are proven by the check before them",
  },
  {
    program: "tests/cases/arr_repeat_check_field_store.ts",
    file: "arr_repeat_check_field_store.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "a new program: `elementStore`'s repeat is proven by the read before it, and the repeats after `this.v = fresh` and `other.v = fresh` keep their checks",
  },
  {
    program: "tests/cases/arr_repeat_check_flow.ts",
    file: "arr_repeat_check_flow.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "a new program: only `inCondition`'s repeats, dominated by the check in the condition, lose their checks",
  },
  {
    program: "tests/cases/arr_element_bitwise_assign.ts",
    file: "arr_element_bitwise_assign.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`a[2] >>>= 1` and `a[0]` are proven by the checked `a[2] <<= 33` before them, with no call between",
  },
  {
    program: "tests/cases/arr_header_hoist_record_class_root.ts",
    file: "arr_header_hoist_record_class_root.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`rs[0].b` and `rs[1].b` are proven by the checked `rs[0].a` and `rs[1].a` in the same template",
  },
  {
    program: "tests/cases/arr_strings.ts",
    file: "arr_strings.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: '`words[0]` is proven by the checked store `words[0] = "goodbye"` before it',
  },
  {
    program: "tests/cases/arr_u8.ts",
    file: "arr_u8.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`bytes[3]` is proven by the checked store `bytes[3] = bytes[0] + one` before it",
  },
  {
    program: "tests/cases/cls_parenthesized_type.ts",
    file: "cls_parenthesized_type.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`slots[0]` is proven by the checked store `slots[0] = first` before it",
  },
  {
    program: "tests/cases/opt_wrapping.ts",
    file: "opt_wrapping.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "under --wrapping `xs[i]` keeps its first check, and `xs[i] *= 2` and `xs[i] / 2` after it are proven by it",
  },
  {
    program: "tests/cases/perf_alloc_loop.ts",
    file: "perf_alloc_loop.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "the reads `row[0]` and `row[1]` are proven by the checked stores to them",
  },
  {
    program: "tests/cases/perf_alloc_quiet.ts",
    file: "perf_alloc_quiet.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`once[0]` in the `return` is proven by the checked store `once[0] = 7` before it",
  },
  {
    program: "docs/cookbook/arr-repeat-check.ts",
    file: "arr-repeat-check.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "the cookbook snippet for the rule: `swap` keeps two of its four checks",
  },
  {
    program: "bench/nbody.ts",
    file: "nbody.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "the momentum loop's `bodies[i].mass` reads are proven by the checked `bodies[i].vx`/`vy`/`vz` before them",
  },
  {
    program: "bench/spectral.ts",
    file: "spectral.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "the final loop's second and third `v[i]` are proven by the checked first one",
  },
  {
    program: "tests/differential/corpus/arr_2d.ts",
    file: "arr_2d.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "`grid[1]` in `console.log(grid[1][1])` is proven by the checked `grid[1][1] = true` before it",
  },
  {
    program: "tests/differential/corpus/arr_sort_reverse.ts",
    file: "arr_sort_reverse.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "the swaps: `xs[j]` after the condition's check and `xs[lo]`/`xs[hi]` after the reads of them are proven",
  },
  {
    program: "tests/differential/corpus/int_compound.ts",
    file: "int_compound.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "under --wrapping `xs[i] += i` is proven by the checked `xs[i] *= 1000000` before it",
  },
  {
    program: "tests/cases/arr_repeat_check_call.ts",
    file: "arr_repeat_check_call.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `test` only calls allocating functions and gets the arena scope; its bounds checks are the reference compiler's",
  },
  {
    program: "tests/cases/arr_repeat_check_panic.ts",
    file: "arr_repeat_check_panic.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `test`, `callStorePastEnd` and `fieldStorePastEnd` only call allocating functions and get the arena scope; its bounds checks are the reference compiler's",
  },
  {
    program: "tests/cases/arr_repeat_check_push.ts",
    file: "arr_repeat_check_push.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `test` only calls allocating functions and gets the arena scope; its bounds checks are the reference compiler's",
  },
  {
    program: "bench/awfy/main.ts",
    file: "list.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program, the Are We Fast Yet ports: `List.benchmark` brackets itself with the callee scope, which the reference compiler does not give it",
  },
  {
    program: "bench/awfy/main.ts",
    file: "storage.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program, the Are We Fast Yet ports: `Storage.benchmark`, its manual `Arena` calls removed, brackets itself with the callee scope",
  },
  {
    program: "bench/awfy/main.ts",
    file: "bounce.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program, the Are We Fast Yet ports: `Bounce.innerBenchmarkLoop` brackets itself with the callee scope, the balls each run makes dying with the call",
  },
  {
    program: "bench/awfy/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program, the Are We Fast Yet ports: the harness's `innerBenchmarkLoop` brackets itself with the callee scope around the benchmark object it makes",
  },
  {
    program: "bench/awfy/main.ts",
    file: "permute.ll",
    changelog: "A passed bounds check proves the same index on the same array",
    why: "a new program, the Are We Fast Yet ports: `Permute.swap` keeps two of its four checks",
  },
  // Issue #246: a high-surrogate escape before a low one is now the one code
  // point it spells, four UTF-8 bytes, where the reference encodes each half
  // on its own. Only the three cases that spell a surrogate escape move.
  {
    program: "tests/cases/str_surrogate_pair.ts",
    changelog: "A surrogate-pair escape is the code point it spells",
    why: "its pair escapes are the four bytes of U+1F600 and share the emoji's constant, where the reference writes six bytes of two lone surrogates",
  },
  {
    program: "tests/cases/str_surrogate_map_key.ts",
    changelog: "A surrogate-pair escape is the code point it spells",
    why: "its pair-escape key is the four bytes of U+1F600 and shares the emoji's constant, where the reference writes six bytes of two lone surrogates",
  },
  {
    program: "tests/cases/str_surrogate_lone.ts",
    changelog: "A surrogate-pair escape is the code point it spells",
    why: "the one pair escape it compares against is the four bytes of U+1F600, where the reference writes six bytes of two lone surrogates; its lone surrogates are the reference's bytes",
  },
  {
    program: "tests/cases/reject_surrogate_escape_too_large.ts",
    changelog: "A surrogate-pair escape is the code point it spells",
    why: "a `\\u{...}` escape above 0x10FFFF is refused with TypeScript's words, where the reference encodes it",
  },
  {
    program: "tests/cases/reject_surrogate_escape_wraps.ts",
    changelog: "A surrogate-pair escape is the code point it spells",
    why: "`\\u{10000D800}` is refused as above 0x10FFFF, where the reference wraps it in i32 to a lone high surrogate",
  },
  // WP34 H1: three std/ modules the released compiler does not ship, so it
  // refuses every program that imports one. These go one release later,
  // when the seed carries the modules.
  {
    program: "tests/link/crypto_sha1/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/crypto/sha1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/crypto_sha1_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/crypto/sha1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/crypto_sha1_long_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/crypto/sha1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_http1/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/http1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_http1_chunk_window/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/http1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_http1_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/http1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_http1_feed_window/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/http1`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_websocket/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/websocket`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_websocket_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/websocket`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_websocket_feed_window/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/websocket`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_websocket_frame_window/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/websocket`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/link/net_websocket_utf8_window/main.ts",
    file: "exit",
    changelog: "Nish/net/http1 and nish/net/websocket — the HTTP/1.1 parser and RFC 6455 framing (WP34 H1)",
    why: "it imports `nish/net/websocket`, which the reference does not ship and so refuses",
  },
  {
    program: "tests/cases/obj_lit_nullable_ternary.ts",
    changelog: "Type an object literal in an `I | null` context as the struct, not the union",
    why: "it builds an object literal in a ternary arm beside `null` where `Box | null` is declared, which the reference types as the union and stops on with an internal error (`unknown struct`)",
  },
  {
    program: "tests/cases/obj_lit_nullable_return.ts",
    changelog: "Type an object literal in an `I | null` context as the struct, not the union",
    why: "it builds an object literal in a `return` in a function returning `E | null`, which the reference types as the union and stops on with an internal error (`unknown struct`)",
  },
  {
    program: "tests/cases/obj_lit_nullable_arrow.ts",
    changelog: "Type an object literal in an `I | null` context as the struct, not the union",
    why: "it builds an object literal in an arrow's concise body returning `E | null`, alone and as a ternary arm, which the reference types as the union and stops on with an internal error (`unknown struct`)",
  },
  {
    program: "tests/cases/obj_lit_nullable_local.ts",
    changelog: "Type an object literal in an `I | null` context as the struct, not the union",
    why: "it builds an object literal in a local declared `E | null`, which the reference types as the union and stops on with an internal error (`unknown struct`)",
  },
  {
    program: "tests/cases/obj_lit_nullable_field.ts",
    changelog: "Type an object literal in an `I | null` context as the struct, not the union",
    why: "it builds an object literal in a parameter, an enclosing literal's field and a field store that expect `E | null`, which the reference types as the union and stops on with an internal error (`unknown struct`)",
  },
  {
    program: "tests/link/crypto_hkdf/main.ts",
    file: "hkdf.ll",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "std/crypto/hkdf.ts gains `hkdfLabel` and the two `hkdfExpandLabel` functions, so its module carries their code and strings; with this tree's hkdf.ts the reference compiler writes the same bytes",
  },
  {
    program: "tests/link/crypto_hkdf_f64/main.ts",
    file: "hkdf.ll",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "std/crypto/hkdf.ts gains `hkdfLabel` and the two `hkdfExpandLabel` functions, so its module carries their code and strings under --number-mode f64; with this tree's hkdf.ts the reference compiler writes the same bytes",
  },
  {
    program: "tests/link/crypto_hkdf_k1_bounds/main.ts",
    file: "hkdf.ll",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "std/crypto/hkdf.ts gains `hkdfLabel` and the two `hkdfExpandLabel` functions, so its module carries their code and strings; with this tree's hkdf.ts the reference compiler writes the same bytes",
  },
  {
    program: "tests/link/crypto_hkdf_k1_bounds_f64/main.ts",
    file: "hkdf.ll",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "std/crypto/hkdf.ts gains `hkdfLabel` and the two `hkdfExpandLabel` functions, so its module carries their code and strings under --number-mode f64; with this tree's hkdf.ts the reference compiler writes the same bytes",
  },
  {
    program: "tests/link/crypto_hkdf_long_f64/main.ts",
    file: "hkdf.ll",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "std/crypto/hkdf.ts gains `hkdfLabel` and the two `hkdfExpandLabel` functions, so its module carries their code and strings under --number-mode f64; with this tree's hkdf.ts the reference compiler writes the same bytes",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: the RFC 8448 and RFC 9001 vectors through `hkdfExpandLabelSha256` and `hkdfExpandLabelSha384`, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_f64/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: the same vectors under --number-mode f64, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_empty_label/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: an empty label's panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_long_context/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a context past 255 bytes' panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_long_context_f64/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a context past 255 bytes' panic under --number-mode f64, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_long_label/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a label past 249 bytes' panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_long_length/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a length past 255's panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_negative_length/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a negative length's panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_short_secret/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a secret shorter than HashLen's panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/link/crypto_hkdf_expand_label_short_secret_sha384/main.ts",
    file: "exit",
    changelog: "HKDF-Expand-Label for TLS 1.3 and QUIC",
    why: "a new program: a SHA-256 secret handed to `hkdfExpandLabelSha384`'s panic, which the reference compiler refuses because its std/crypto/hkdf.ts has no HKDF-Expand-Label",
  },
  {
    program: "tests/cases/mem_using_arena.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new program: a `using a = arena()` block whose allocations are released when it ends, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/cases/mem_using_arena_or_return.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new program: `orReturn()` out of a `using a = arena()` block, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/cases/mem_using_arena_tail.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new program: a tail call out of a `using a = arena()` block, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/cases/perf_arena_using.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new program: the arena-loop warning's shape with the loop body in a `using a = arena()` block, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "docs/cookbook/mem-using-arena.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new cookbook snippet: a `using a = arena()` block in a scoped loop pass, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/link/arena_using_exit_paths/main.ts",
    file: "exit",
    changelog: "a checked arena bracket",
    why: "a new program: every exit of a `using a = arena()` block, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/cases/mem_loop_scope.ts",
    file: "exit",
    changelog: "Arena.release and Arena.reset in favour of using a = arena()",
    why: "measures the arena inside a `using a = arena()` block instead of between `Arena.mark` and the deprecated `Arena.release`, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/cases/mem_loop_scope_forof.ts",
    file: "exit",
    changelog: "Arena.release and Arena.reset in favour of using a = arena()",
    why: "measures the arena inside two `using a = arena()` blocks instead of between `Arena.mark` and the deprecated `Arena.release`, which the reference compiler refuses because it has no `arena()` builtin",
  },
  {
    program: "tests/link/reject_typed_push_alias/main.ts",
    file: "exit",
    changelog: "push and pop on typed arrays reached through Map/Set reads, generics and imported aliases",
    why: "a new negative: `pop` on a return type and a field spelled through another module's `Float64Array` alias, which the reference compiler compiled",
  },
  {
    program: "tests/cases/unsafe_get_set.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "a new program that imports `nish:unsafe`, which the reference compiler does not have and refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/unsafe_wrapping.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "a new program that imports `nish:unsafe`, which the reference compiler does not have and refuses as an unknown builtin module",
  },
  {
    program: "docs/cookbook/unsafe-unchecked-get.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "a new program that imports `nish:unsafe`, which the reference compiler does not have and refuses as an unknown builtin module",
  },
  {
    program: "docs/cookbook/unsafe-wrapping.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "a new program that imports `nish:unsafe`, which the reference compiler does not have and refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_aes.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_chacha20poly1305.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_k1_base64url.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_k1_ct.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_mac.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_p256.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_refused.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/cases/ct_asm_x25519.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "its indexing moved from `--unchecked-indexing` to `uncheckedGet` and `uncheckedSet` from `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_aes/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_aes_f64/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_base64url_k1_copies/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_chacha20poly1305/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_chacha20poly1305_f64/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/crypto_ct_k1_copies/main.ts",
    file: "exit",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "it imports a `tests/cases/ct_asm_*` copy whose indexing moved to `nish:unsafe`, which the reference compiler refuses as an unknown builtin module",
  },
  {
    program: "tests/link/unsafe_flag_scope/main.ts",
    changelog: "Add nish:unsafe and scope the unsafe flags to the entry package",
    why: "a new program compiled with `--unchecked-indexing --wrapping`, which the reference compiler applies to its `node_modules` dependency and to `nish/text` as well, and HEAD to the entry package alone",
  },
  {
    program: "tests/cases/secret_wipe.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "a new program: `nish:secret`'s `secret`, `expose`, `exposeWith` and `wipe`, which the reference compiler refuses because it has no `nish:secret`",
  },
  {
    program: "tests/cases/secret_flow.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "a new program: the ownership shapes `nish:secret` accepts, which the reference compiler refuses because it has no `nish:secret`",
  },
  {
    program: "tests/cases/secret_wipe_o2.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "a new program: a `wipe` of bytes nothing reads again, whose volatile store survives `opt -O2`; the reference compiler refuses it because it has no `nish:secret`",
  },
  {
    program: "docs/cookbook/builtin-secret.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "a new cookbook entry for `nish:secret`, which the reference compiler refuses because it has no `nish:secret`",
  },
  {
    program: "tests/link/crypto_p256/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_p256_f64/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x25519/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x25519_f64/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x509/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x509_audit/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x509_f64/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/link/crypto_x509_malformed/main.ts",
    changelog: "key material the checker keeps in and wipes",
    why: "std/crypto's private keys are `Secret<u8[]>` now, so the program reaches the module through an adapter that imports `nish:secret`, which the reference compiler refuses because it has no `nish:secret`; the vectors and the answers are unchanged",
  },
  {
    program: "tests/cases/wipe_bytes.ts",
    changelog: "A secure-wipe builtin the optimiser cannot drop",
    why: "it calls `secureZero`, which this tree adds and the reference does not know, so the reference refuses it with `Unknown function` and this tree lowers it to a call to `nish_wipe`",
  },
  {
    program: "docs/cookbook/builtin-wipe.ts",
    changelog: "A secure-wipe builtin the optimiser cannot drop",
    why: "the cookbook entry for `secureZero`, which this tree adds and the reference refuses with `Unknown function`",
  },
  {
    program: "tests/cases/net_tcp_connect.ts",
    file: "exit",
    changelog: "Nish:net tcpConnect — the client half of TCP",
    why: "a new program: a Nish client and server in one loop through `tcpConnect` and `connectResult`, which the reference compiler refuses because it has neither builtin",
  },
  {
    program: "tests/cases/net_tcp_connect_import.ts",
    file: "exit",
    changelog: "Nish:net tcpConnect — the client half of TCP",
    why: "a new program: `tcpConnect` and `connectResult` imported from `nish:net`, which the reference compiler refuses because the module exports neither",
  },
  {
    program: "docs/cookbook/runtime-prelude.ts",
    file: "runtime-prelude.ll",
    changelog: "A secure-wipe builtin the optimiser cannot drop",
    why: "`--runtime-decls` declares every runtime function, and this tree's runtime gains `nish_wipe`, so the prelude has one more `declare` line and every line after it moves down one",
  },
  {
    program: "docs/cookbook/runtime-prelude.ts",
    file: "runtime-prelude.ll",
    changelog: "Nish:net tcpConnect — the client half of TCP",
    why: "`--runtime-decls` declares every runtime function in table order, and the table gains `nish_tcp_connect` and `nish_connect_result` after `nish_net_close`, which moves every declaration after them",
  },
  {
    program: "tests/cases/owner_checks.ts",
    changelog: "for the owner checks, and a cryptographic run-cache name",
    why: "it calls `geteuid`, `lstatOwnerModeSync` and `isExecutableSync`, which this tree adds and the reference does not know, so the reference refuses it with `Unknown function` and this tree lowers each to one call into runtime-host.c",
  },
  {
    program: "docs/cookbook/builtin-owner.ts",
    changelog: "for the owner checks, and a cryptographic run-cache name",
    why: "the cookbook entry for the owner builtins, which this tree adds and the reference refuses with `Unknown function`",
  },
  {
    program: "tests/link/net_tls_rfc8448/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: RFC 8448 §3 replayed through the server, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_rfc8448_f64/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: RFC 8448 §3 replayed through the server under --number-mode f64, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ecdsa/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: a P-256-signed handshake under the three suites, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ecdsa_f64/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: a P-256-signed handshake under the three suites, under --number-mode f64, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_alpn/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: ALPN negotiation, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_sni/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: server_name read and acknowledged, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_quic/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: quic_transport_parameters carried for QUIC only, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_hrr/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: HelloRetryRequest and its transcript, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_refusals/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: every refusal as its alert, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_ext_f64/main.ts",
    file: "exit",
    changelog: "the TLS 1.3 server handshake",
    why: "a new program: the extension, retry and refusal checks under --number-mode f64, which the reference compiler refuses because its std/ has no nish/net/tls",
  },
  {
    program: "tests/link/net_tls_record_rfc8448/main.ts",
    file: "exit",
    changelog: "records over TCP (WP34 T2)",
    why: "a new program: RFC 8448 §3's records sealed, opened and replayed through the record server, which the reference compiler refuses because its std/ has no nish/net/tls/record",
  },
  {
    program: "tests/link/net_tls_record_refusals/main.ts",
    file: "exit",
    changelog: "records over TCP (WP34 T2)",
    why: "a new program: every refusal of the record layer and the record server as its alert, which the reference compiler refuses because its std/ has no nish/net/tls/record",
  },
  {
    program: "tests/link/net_tls_record_f64/main.ts",
    file: "exit",
    changelog: "records over TCP (WP34 T2)",
    why: "a new program: the record layer's RFC 8448 and refusal checks under --number-mode f64, which the reference compiler refuses because its std/ has no nish/net/tls/record",
  },
  {
    program: "tests/link/net_tls_record_tcp/main.ts",
    file: "exit",
    changelog: "records over TCP (WP34 T2)",
    why: "a new program: a Nish client against the TLS-over-TCP carrier over loopback, which the reference compiler refuses because its std/ has no nish/net/tls-tcp",
  },
  {
    program: "tests/link/net_tls_record_tcp_f64/main.ts",
    file: "exit",
    changelog: "records over TCP (WP34 T2)",
    why: "a new program: the TLS-over-TCP loopback checks under --number-mode f64, which the reference compiler refuses because its std/ has no nish/net/tls-tcp",
  },
  ...declareMoved(
    CG8_MOVED,
    "CG-8",
    "a string concatenation, a file read or write, or a call that reaches one is no longer `willreturn`, because each can exit or block"
  ),
  ...declareMoved(
    CG4_MOVED,
    "CG-4",
    "a recursive function, or a caller of one, is no longer `willreturn`: nothing proves that a recursion ends"
  ),
  ...declareMoved(
    CG2_MOVED,
    "CG-2",
    "its `new Array(n)` takes an `i32` `n`, which is now compared against the length limit, so a negative one panics with `array length out of range`"
  ),
  ...declareMoved(
    CG3_MOVED,
    "CG-3",
    "it calls `join`, whose allocation size is now selected against 2^31 - 1 bytes so that a longer result fails as an allocation does"
  ),
  ...declareMoved(
    CG10_MOVED,
    "CG-10",
    "a new program: its compound element assignments resize the array on their right side, and the reference stores into the old block"
  ),
  {
    program: "tests/link/net_quic_packet/main.ts",
    file: "exit",
    changelog: "Nish/net/quic-packet — QUIC packets, Initial secrets and header protection (WP34 Q1)",
    why: "a new program over the new `nish/net/quic-packet` module, which the released compiler's library does not have",
  },
  {
    program: "tests/link/net_quic_packet_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/quic-packet — QUIC packets, Initial secrets and header protection (WP34 Q1)",
    why: "a new program over the new `nish/net/quic-packet` module, which the released compiler's library does not have",
  },
  {
    program: "tests/link/net_quic_frame/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: every frame of RFC 9000 §19 read and written, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_frame_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: the frame checks under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn_parts/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: transport parameters, ACK ranges and the connection-ID table, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn_parts_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: the transport-parameter, ACK and connection-ID checks under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: the QUIC connection's handshakes, data path and refusals, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: the QUIC connection checks under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn_replay/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: an aioquic handshake and echo replayed over loopback, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_conn_replay_f64/main.ts",
    file: "exit",
    changelog: "Nish/net/quic — QUIC connections, the handshake and stream data (WP34 Q2, first part)",
    why: "a new program: the aioquic replay under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic",
  },
  {
    program: "tests/link/net_quic_lifecycle/main.ts",
    file: "exit",
    changelog:
      "Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update (WP34 Q2, second part)",
    why: "a new program: Version Negotiation, Retry tokens, stateless resets, the idle timeout and key update, which the released compiler refuses because its std/ has no nish/net/quic-listener",
  },
  {
    program: "tests/link/net_quic_lifecycle_f64/main.ts",
    file: "exit",
    changelog:
      "Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update (WP34 Q2, second part)",
    why: "a new program: the lifecycle checks under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic-listener",
  },
  {
    program: "tests/link/net_quic_lifecycle_replay/main.ts",
    file: "exit",
    changelog:
      "Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update (WP34 Q2, second part)",
    why: "a new program: five aioquic scenarios replayed over loopback, which the released compiler refuses because its std/ has no nish/net/quic-listener",
  },
  {
    program: "tests/link/net_quic_lifecycle_replay_f64/main.ts",
    file: "exit",
    changelog:
      "Nish/net/quic — Retry, version negotiation, stateless reset, idle timeout and key update (WP34 Q2, second part)",
    why: "a new program: the aioquic lifecycle replay under --number-mode f64, which the released compiler refuses because its std/ has no nish/net/quic-listener",
  },
  ...declareMoved(
    DENY_PANICS_MOVED,
    "--deny-panics and noPanic refuse every remaining panic site",
    "a divisor proven to be neither 0 nor -1, or a `pop` behind a test that its array holds an element, is left unchecked, so its `div.fail` or `pop.empty` block is gone"
  ),
  ...declareMoved(
    DENY_PANICS_NEW,
    "--deny-panics and noPanic refuse every remaining panic site",
    "a new program: it is compiled under `--deny-panics` or a `noPanic` list, which the reference compiler does not read"
  ),
  ...declareMoved(
    CAPABILITY_POLICY_NEW,
    "a program that reaches a capability its policy does not grant",
    "a new program: it is compiled under `--allow`, or its root `package.json` carries a `capabilities` policy, which the reference compiler does not read"
  ),
]

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
  const limit = options.lines ?? 3
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
  const argv = (dir) => [
    named,
    "-o",
    `${dir}${path.sep}`,
    ...flags,
    ...(options.sidecars === false ? [] : sidecarFlags(dir, stem)),
  ]

  const reference = compile(pair.reference, argv(referenceDir))
  const candidate = compile(pair.candidate, argv(candidateDir))
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
    const where = excerpt(wantText, gotText, limit)
    differences.push({
      surface: name,
      detail: `differs (${where.differing} of ${where.total} lines)\n${where.text}`,
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
const declaredFor = (program, surface) => {
  for (const entry of DECLARED) {
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
      --verbose               name every program, not only the differences
  -h, --help                  this text

A compiler is a native binary, or a .js/.mjs/.cjs entry point run under node —
the same rule scripts/bootstrap.sh applies to NISH_BOOTSTRAP.

With no programs named, the whole corpus is compared (tests/self/corpus.js).

exit codes: 0 agreed (or skipped for want of a seed), 1 undeclared difference,
2 usage or a compiler that would not build`

const main = (argv) => {
  const options = { lines: 3, sidecars: true }
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
    } else if (arg === "--verbose") {
      verbose = true
    } else if (arg.startsWith("-")) {
      process.stderr.write(`nish-cmp: unknown option: ${arg}\n${HELP}\n`)
      return 2
    } else {
      named.push(arg)
    }
  }
  if (referenceSpec === undefined || candidateSpec === undefined || Number.isNaN(options.lines)) {
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
  const selfCheckNote = selfCheckNotes()
  if (selfCheckNote !== null) {
    process.stderr.write(`nish-cmp: its own release-note lookup is wrong: ${selfCheckNote}\n`)
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
  let agreed = 0
  let files = 0
  let lines = 0
  let rooted = 0
  let versioned = 0
  for (const file of inputs) {
    const program = path.relative(root, file)
    const result = compare(pair, work, file, options)
    if (result.dump !== undefined) {
      dumps.push(`${program}: ${result.dump}`)
    } else if (result.refused !== undefined) {
      refused.push(`${program}: both refuse it: ${result.refused}`)
    } else if (result.differences !== undefined) {
      for (const difference of result.differences) {
        const entry = declaredFor(program, difference.surface)
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

  const compared = inputs.length - refused.length - dumps.length
  // Each outcome is counted apart and named, for the reason the oracles count
  // their skips apart (`.claude/selfhost.md`): a program neither compiler
  // compiles proves nothing about either, and must not be able to hide inside
  // a number that reads like agreement.
  const refusedNote = refused.length > 0 ? `, ${refused.length} refused by both` : ""
  const dumpNote = dumps.length > 0 ? `, ${dumps.length} dumps (no artefact)` : ""
  const declaredNote = declared.length > 0 ? `, ${declared.length} declared difference(s)` : ""
  const rootedNote = rooted > 0 ? `, ${rooted} equal after each compiler's own root` : ""
  const versionedNote = versioned > 0 ? `, ${versioned} equal after each compiler's own producer version` : ""
  process.stdout.write(
    `nish-cmp: ${agreed}/${compared} programs agree (${files} files, ${lines} IR lines) — ` +
      `reference ${pair.reference.label}, candidate ${pair.candidate.label}` +
      `${refusedNote}${dumpNote}${rootedNote}${versionedNote}${declaredNote}, ${undeclared.length} undeclared difference(s)\n`
  )
  return undeclared.length === 0 && unnamed.length === 0 ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
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
  selfCheckNotes,
  selfCheckRoots,
  selfCheckVersions,
  isNamed,
  withoutOwnRoot,
  withoutOwnVersion,
}
