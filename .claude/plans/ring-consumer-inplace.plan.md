---
name: Ring in place — which half carries the speed
overview: Add a third mode, "consumer", to bench/ring-inplace. Its producer copies through a private buffer and tryPush, and its consumer works in place through peek, sendBody and release. Add a --ring-bytes option and a small-ring run (1 MB, inside one core's L2) to test the cache hypothesis directly. Fix the two #1229 review leftovers. Re-measure and rewrite wp47 §7 and bench/README.md with a verdict on which half of the in-place path is worth adopting, and at which sizes. Refs #1209.
stages:
  - id: consumer-mode
    title: "perf(runtime): benchmark a consumer-only in-place ring mode"
    goal: node bench/ring-inplace/run.mjs measures copy, inplace and consumer, at the default 16 MB ring and with --ring-bytes 1048576, and reports noise bands and inside/outside comparison rows for consumer vs copy and consumer vs inplace. wp47 §7 and bench/README.md carry the full 5×2×50,000 figures, the CPU model, the cache sizes and the pinned cores, and a verdict sentence on which half of the in-place path is worth adopting, at which sizes.
    verification: npm run lint && npm run lint:dead && node docs/check-links.mjs && node bench/ring-inplace/run.mjs --quick && node bench/ring-inplace/run.mjs --quick --ring-bytes 1048576 && (build/ring-inplace/bench bogus 1024 10 -1 -1; test $? -ne 0)
    status: pending
    todos:
      - id: mode-consumer
        content: In bench/ring-inplace/bench.ts add mode "consumer". The producer takes exactly mode copy's path (render into a private u8[], then tryPush) and the consumer takes exactly mode inplace's path (peek, Http1Connection.sendBody, release). The timing window, the FNV-1a content checksum, the sent==heard check, the deadlines and the output line stay identical across the three modes. The bytes-copied accounting counts only the tryPush copy for consumer.
      - id: strict-mode
        content: Validate mode once, in main, before any child starts, against exactly copy, inplace and consumer. An unknown mode exits non-zero with a message. Replace the producer's `mode === "copy"` branch and the consumer's `mode === "inplace"` branch, which treat an unknown mode differently today, with checks that cannot fall through to the wrong path.
      - id: ring-bytes
        content: Make the ring capacity a run-time argument of bench.ts (default 16777216, passed to the producer child too) and add `--ring-bytes N` to run.mjs, validated as a power of two of at least 64 KiB, or whatever SpscRing requires, and large enough for the 10 KB record. Keep the spscRingBytes check in main. The default output is unchanged.
      - id: run-mjs
        content: Add consumer to run.mjs's modes. It is shuffled into the same seeded per-round order, gets same-mode noise bands for p50, p99 and the pipeline like the other two, and gets comparison rows "consumer vs copied" and "consumer vs in place" beside the existing "in place vs copied", each set against the wider of the two modes' bands and marked inside or outside. The header line names the ring size.
      - id: deadlines
        content: Give the `drain` loop and the reader loop in bench.ts the same ten-second deadline as every other wait (fail the run with a message when it passes), so the "every wait has a deadline" comment is true. If a loop cannot take one, correct the comment and the docs instead and say why.
      - id: body-bytes
        content: Print body_bytes to 2 decimals instead of integer division (bodies / n) in bench.ts's output line, and make run.mjs read the decimal value.
      - id: measure
        content: On the session's machine, run the full benchmark (5 rounds × 2 runs × 50,000 messages, 1, 4 and 10 KB, three processes pinned by run.mjs's taskset on CPUs 0, 1 and 2) at the default ring, then again with --ring-bytes 1048576 (at least one round, more if time allows). Record `lscpu` (model, L2 per core, L3). On the planning host, L2 is 2 MiB per core and L3 is 260 MiB shared, so a 16 MB ring is larger than L2 but fits in L3. Report that, rather than assuming the ring misses every cache.
      - id: docs
        content: Rewrite the "Records copied or in place" part of docs/wp47-shared-memory.md §7 and bench/README.md's ring-inplace section with both tables (default and small ring), the noise bands, the three comparison rows per size, the CPU model, the caches and the pinned cores, the corrected deadline claim, and one verdict sentence answering "Which half of the in-place path is worth adopting, at which sizes?". Claim only what the bands support. A difference inside its band is reported as no measured difference. Say whether the small ring closes the inplace-vs-copy pipeline gap, and so whether the cache explanation is supported, not supported or undecided.
---

# Ring in place — which half carries the speed

Follow-up to #1229 (tracking issue #1209). In #1229, in place against copied
measured a consumer p50 gain at 10 KB (−13.7%, outside its band) and a
pipeline loss at 10 KB (+18.3%, outside its band). The untested hypothesis is
that the loss is on the producer side: it renders JSON straight into a 16 MB
shared ring instead of into a cache-hot private buffer followed by one
memmove. Mode `consumer` separates the two halves. The small ring tests the
cache part of the hypothesis directly.

## consumer-mode

**Owns:** `bench/ring-inplace/**`, `docs/wp47-shared-memory.md`, `bench/README.md`

One stage, so there is nothing to split. The measurement depends on the code,
and the docs depend on the measurement. No `std/` change, and no `src/`
change. CI's test shards answer for the full suite. bench/ is not part of the
generated goldens.

Commit message trailers: `Measured:` with figures and noise bands, per
`.claude/testing.md` → "A `Measured:` trailer"; `Refs: #1209`.
