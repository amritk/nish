"""Chromium soaks examples/wasm-arena (docs/wp50-wasm-host.md §10, W9).

The interop workflow's `arena` job serves the directory
examples/wasm-arena/build.mjs writes on localhost (a secure context, as
WebGPU and WebTransport require) and runs this with Playwright's own
Chromium. The page runs as a player would see it: `requestAnimationFrame`
drives `frame(dtMs)`, and the script types the page's own `scripted` keys
as KeyboardEvents its listeners hear. It checks, for `seconds`:

  memory   `memory.buffer.byteLength` and the arena's mark (`nish_arena_mark`,
           read from the raw exports) are the same after every frame;
  heap     the used JS heap after a forced GC at one tenth of the run and at
           its end differs by at most HEAP_BAND bytes, and a HeapProfiler
           sampling profile over the same span, counting the objects GC
           took, allocated at most FRAME_BAND bytes a frame;

and writes what it saw to `out` as JSON: the figures, the renderer the page
chose (WebGPU when the adapter answers, WebGL 2 when not), and the input it
recorded, run-length coded, with the hash, for the job to replay natively
with build/arena/replay. It exits 1 when a check fails.

It also checks the renderer: the page must choose the one `--expect` names
(the note's §10 records WebGPU on swiftshader), since a silent fall back to
WebGL 2 would soak a path the note does not claim.

Then two checks the note's §5.3 and §8 left to a browser, recorded in the
same JSON, each failing the run when Chromium does not do what the note says:

  datagram  (with --webtransport) a WebTransport datagram write copies its
            bytes: the view is overwritten as soon as `write` returns, before
            its promise settles, and the echo the interop server sends back
            must be the bytes as written, never the overwrite; each try fills
            the view with its own byte, so a late echo is matched to its try;
  loadSync  the generated loader's `loadSync` of client.wasm padded with a
            custom section to just under 8 MiB must load, at the size asked,
            and to just over must be refused with Chromium's RangeError.

An exception in a check is recorded and fails the run; `out` is written
whatever happens.

    python3 chrome-arena.py <page url> <seconds> <out.json>
        [--expect webgpu|webgl2] [--webtransport <quic port> <hash file>]

CHROMIUM names a browser binary to use in place of Playwright's own.
"""

import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

# The used heap may move this much between the two forced GCs: V8's own
# bookkeeping and the compiled code of functions that tier up late.
HEAP_BAND = 256 * 1024
# Bytes a frame may allocate, sampled: the loader's call wrapper and
# requestAnimationFrame's callback bookkeeping, and the renderer's per-frame
# objects (a command encoder and a texture view under WebGPU).
FRAME_BAND = 1024
# The sampling interval, in bytes: small enough that a few minutes of a
# 64-byte-a-frame allocation shows.
SAMPLING = 4096

# Runs before the page's own script: keeps the raw exports the loader keeps to
# itself, and hooks each frame to type the scripted keys and check memory.
WATCH = """
(() => {
  const Real = WebAssembly.Instance;
  let raw = null;
  WebAssembly.Instance = function Instance(module, imports) {
    const made = new Real(module, imports);
    if (raw === null) raw = made.exports;
    return made;
  };
  WebAssembly.Instance.prototype = Real.prototype;
  const watch = { frames: 0, moved: 0, length: -1, mark: -1, renderer: null, page: null };
  globalThis.arenaWatch = watch;
  import("./page.js").then((page) => { watch.page = page; });
  globalThis.arenaAfterFrame = (arena) => {
    if (watch.length < 0) {
      watch.length = arena.module.memory.buffer.byteLength;
      watch.mark = raw.nish_arena_mark();
    } else if (arena.module.memory.buffer.byteLength !== watch.length || raw.nish_arena_mark() !== watch.mark) {
      watch.moved++;
    }
    const page = watch.page;
    if (page !== null) {
      const word = page.scripted(watch.frames);
      for (let bit = 0; bit < 5; bit++) {
        if ((word >> bit) & 1) dispatchEvent(new KeyboardEvent("keydown", { code: page.CODES[bit] }));
        if ((word >> (bit + 8)) & 1) dispatchEvent(new KeyboardEvent("keyup", { code: page.CODES[bit] }));
      }
    }
    watch.frames++;
  };
})();
"""

# The run's record, read between two frames, so the hash and the log agree.
RECORD = """
async () => {
  const arena = await globalThis.arena;
  const watch = globalThis.arenaWatch;
  return {
    frames: watch.frames,
    moved: watch.moved,
    byteLength: watch.length,
    mark: watch.mark,
    webgpu: arena.webgpu,
    ticks: arena.module.ticks(),
    logged: arena.logged(),
    overflow: arena.overflow(),
    hash: arena.hash(),
    runs: watch.page.runs(arena.log, arena.logged()),
  };
}
"""

# §5.3: overwrite the view as soon as `write` returns, before its promise
# settles; the echo of a try must be that try's bytes. Every try fills the
# view with its own byte, one read loop collects every echo, and an echo is
# matched to the try whose byte it carries, so a late one is never taken for
# the wrong try's. An echo of the overwrite byte is a write that did not copy.
DATAGRAM = """
async ({ port, hash }) => {
  const OVERWRITE = 0x7a;
  const TRIES = 25;
  const within = (promise, ms, what) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(what + " took over " + ms + " ms")), ms))]);
  let wt = null;
  try {
    const pinned = new Uint8Array(hash.match(/../g).map((h) => parseInt(h, 16)));
    wt = new WebTransport(`https://127.0.0.1:${port}/echo`, {
      serverCertificateHashes: [{ algorithm: "sha-256", value: pinned }],
    });
    await within(wt.ready, 10000, "WebTransport's ready");
    const writer = wt.datagrams.writable.getWriter();
    const reader = wt.datagrams.readable.getReader();
    const echoes = [];
    let wake = null;
    const reading = (async () => {
      for (;;) {
        const got = await reader.read();
        if (got.done) return;
        echoes.push(Array.from(got.value));
        if (wake !== null) wake();
      }
    })().catch(() => {});
    const view = new Uint8Array(32);
    const written = [];
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const fill = 0x41 + attempt;
      view.fill(fill);
      written.push(fill);
      const settled = writer.write(view);
      view.fill(OVERWRITE);
      await within(settled, 2000, "a datagram write");
      const deadline = performance.now() + 200;
      while (performance.now() < deadline) {
        const bad = echoes.find((e) => e.includes(OVERWRITE));
        if (bad !== undefined) return { copied: false, tries: attempt + 1, detail: "an echo carried the overwrite: " + bad.slice(0, 4).join(",") + "..." };
        const good = echoes.find((e) => e.length === view.length && written.includes(e[0]) && e.every((b) => b === e[0]));
        if (good !== undefined) return { copied: true, tries: attempt + 1, detail: "wrote " + view.length + " bytes of " + good[0] + " (try " + (written.indexOf(good[0]) + 1) + "), overwrote them with " + OVERWRITE + " before the write settled; the echo was the bytes written" };
        await new Promise((resolve) => { wake = resolve; setTimeout(resolve, 20); });
        wake = null;
      }
    }
    const other = echoes.length === 0 ? "" : "; echoes matched no try: " + echoes[0].slice(0, 4).join(",") + "...";
    return { copied: null, tries: TRIES, detail: "no echo of a try came back in " + TRIES + " tries" + other };
  } catch (e) {
    return { copied: null, detail: "threw: " + String(e) };
  } finally {
    if (wt !== null) {
      try { wt.close(); } catch {}
    }
  }
}
"""

# §8: loadSync on the main thread, of client.wasm padded to `size` bytes by a custom section.
LOAD_SYNC = """
async (sizes) => {
  const client = await import("./client.mjs");
  const host = await import("./host.js");
  const base = new Uint8Array(await (await fetch("./client.wasm")).arrayBuffer());
  const leb = (n) => { const out = []; do { let b = n & 127; n >>>= 7; if (n !== 0) b |= 128; out.push(b); } while (n !== 0); return out; };
  const padded = (size) => {
    const name = [0x70, 0x61, 0x64];
    // The section's payload length, for a total of `size`: the LEBs' widths settle in two rounds.
    let payload = size - base.length - 1 - 1 - name.length;
    for (let round = 0; round < 2; round++) {
      payload = size - base.length - 1 - leb(name.length + leb(name.length).length + payload).length - leb(name.length).length - name.length;
    }
    const head = [0, ...leb(leb(name.length).length + name.length + payload), ...leb(name.length), ...name];
    const bytes = new Uint8Array(base.length + head.length + payload);
    bytes.set(base, 0);
    bytes.set(head, base.length);
    return bytes;
  };
  const results = [];
  for (const size of sizes) {
    const bytes = padded(size);
    const t0 = performance.now();
    try {
      const module = client.loadSync(bytes, { host });
      results.push({ size: bytes.length, ok: true, ms: performance.now() - t0, detail: "loaded; memory " + module.memory.buffer.byteLength });
    } catch (e) {
      results.push({ size: bytes.length, ok: false, ms: performance.now() - t0, detail: String(e) });
    }
  }
  return results;
}
"""

MIB = 1024 * 1024


def sampled_bytes(profile):
    """The bytes a sampling profile's tree counts, and its five heaviest frames."""
    total = 0
    by_name = {}
    stack = [profile["head"]]
    while stack:
        node = stack.pop()
        size = node.get("selfSize", 0)
        total += size
        frame = node["callFrame"]
        name = f'{frame["functionName"] or "(anonymous)"} {frame["url"].rsplit("/", 1)[-1]}:{frame["lineNumber"] + 1}'
        by_name[name] = by_name.get(name, 0) + size
        stack.extend(node.get("children", []))
    top = sorted(by_name.items(), key=lambda kv: -kv[1])[:5]
    return total, [{"site": k, "bytes": v} for k, v in top if v > 0]


def used_heap(cdp):
    """The used JS heap after two forced GCs."""
    cdp.send("HeapProfiler.collectGarbage")
    cdp.send("HeapProfiler.collectGarbage")
    return cdp.send("Runtime.getHeapUsage")["usedSize"]


def frames(page):
    return page.evaluate("globalThis.arenaWatch.frames")


def parse(argv):
    """The arguments, or None when they do not parse."""
    if len(argv) < 3:
        return None
    args = {"url": argv[0], "seconds": float(argv[1]), "out": argv[2], "expect": "webgpu", "webtransport": None}
    rest = argv[3:]
    while rest:
        if rest[0] == "--expect" and len(rest) >= 2 and rest[1] in ("webgpu", "webgl2"):
            args["expect"], rest = rest[1], rest[2:]
        elif rest[0] == "--webtransport" and len(rest) >= 3:
            args["webtransport"], rest = (int(rest[1]), rest[2]), rest[3:]
        else:
            return None
    return args


def check_load_sync(results, sizes, failures):
    """§8: the size under 8 MiB loads at the size asked; the one over is refused with a RangeError."""
    if len(results) != len(sizes):
        failures.append(f"loadSync answered {len(results)} results for {len(sizes)} sizes")
        return
    under, over = results
    for r, size in zip(results, sizes):
        if r["size"] != size:
            failures.append(f"loadSync's padded module was {r['size']} bytes, not the {size} asked")
    if not under["ok"]:
        failures.append(f"loadSync of {under['size']} bytes, under 8 MiB, was refused: {under['detail']}")
    if over["ok"] or not over["detail"].startswith("RangeError"):
        failures.append(f"loadSync of {over['size']} bytes, over 8 MiB, was not refused with a RangeError: {over['detail']}")


def soak(args, report, failures):
    """The run: the soak, then the renderer, loadSync and datagram checks, into `report` and `failures`."""
    seconds = args["seconds"]
    early = seconds / 10
    with sync_playwright() as p:
        launch = {"args": ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-webgpu-adapter=swiftshader"]}
        if os.environ.get("CHROMIUM"):
            launch["executable_path"] = os.environ["CHROMIUM"]
        browser = p.chromium.launch(**launch)
        try:
            report["chromium"] = browser.version
            page = browser.new_page()
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.add_init_script(WATCH)
            cdp = page.context.new_cdp_session(page)
            cdp.send("HeapProfiler.enable")
            page.goto(args["url"])
            report["userAgent"] = page.evaluate("navigator.userAgent")
            page.wait_for_function("globalThis.arenaWatch && globalThis.arenaWatch.frames > 0", timeout=30000)
            report["gpu"] = page.evaluate(
                """async () => {
                  if (navigator.gpu === undefined) return "navigator.gpu is undefined";
                  const adapter = await navigator.gpu.requestAdapter();
                  if (adapter === null) return "requestAdapter() answered null";
                  const info = adapter.info ?? {};
                  return "adapter: " + [info.vendor, info.architecture, info.description].filter((s) => s).join(" / ");
                }"""
            )
            start = time.monotonic()

            page.wait_for_timeout(early * 1000)
            heap_early = used_heap(cdp)
            frames_early = frames(page)
            cdp.send(
                "HeapProfiler.startSampling",
                {
                    "samplingInterval": SAMPLING,
                    "includeObjectsCollectedByMajorGC": True,
                    "includeObjectsCollectedByMinorGC": True,
                },
            )

            page.wait_for_timeout(max(0, seconds - (time.monotonic() - start)) * 1000)
            profile = cdp.send("HeapProfiler.stopSampling")["profile"]
            frames_late = frames(page)
            heap_late = used_heap(cdp)
            record = page.evaluate(RECORD)
            elapsed = time.monotonic() - start

            sampled, sites = sampled_bytes(profile)
            span = max(1, frames_late - frames_early)
            report.update(record)
            report["elapsed"] = round(elapsed, 1)
            report["heap"] = {
                "early": heap_early,
                "late": heap_late,
                "delta": heap_late - heap_early,
                "earlyAt": round(early, 1),
                "sampledBytes": sampled,
                "sampledFrames": span,
                "bytesPerFrame": round(sampled / span, 1),
                "heaviest": sites,
            }
            report["renderer"] = "webgpu" if record["webgpu"] else "webgl2"
            if report["renderer"] != args["expect"]:
                failures.append(f"the page drew with {report['renderer']}, not the {args['expect']} expected ({report['gpu']})")
            if record["moved"] != 0:
                failures.append(f"memory's byteLength or the arena's mark moved after {record['moved']} frames")
            if record["overflow"] != 0:
                failures.append(f"{record['overflow']} ticks were stepped past the log's end")
            if abs(heap_late - heap_early) > HEAP_BAND:
                failures.append(f"the used heap moved {heap_late - heap_early} bytes, past the band of {HEAP_BAND}")
            if sampled / span > FRAME_BAND:
                failures.append(f"a frame allocated {sampled / span:.0f} bytes, past the band of {FRAME_BAND}")
            if record["frames"] < 30 * seconds:
                failures.append(f"only {record['frames']} frames in {seconds:.0f} s")

            sizes = [8 * MIB - 4096, 8 * MIB + 4096]
            report["loadSync"] = page.evaluate(LOAD_SYNC, sizes)
            check_load_sync(report["loadSync"], sizes, failures)
            if args["webtransport"] is not None:
                port, hash_file = args["webtransport"]
                with open(hash_file, encoding="ascii") as f:
                    cert_hash = f.read().strip()
                report["datagram"] = page.evaluate(DATAGRAM, {"port": port, "hash": cert_hash})
                if report["datagram"]["copied"] is not True:
                    failures.append(f"the datagram check did not show a copy: {report['datagram']['detail']}")
            if errors:
                report["consoleErrors"] = errors[:10]
                failures.append(f"the page logged {len(errors)} errors; the first: {errors[0]}")
        finally:
            browser.close()


def main(argv):
    args = parse(argv)
    if args is None:
        sys.stderr.write(__doc__)
        return 2
    report = {
        "url": args["url"],
        "seconds": args["seconds"],
        "expect": args["expect"],
        "heapBand": HEAP_BAND,
        "frameBand": FRAME_BAND,
    }
    failures = []
    try:
        soak(args, report, failures)
    except Exception as e:  # noqa: BLE001 - any failure is recorded, and the report still written
        failures.append(f"the run stopped: {type(e).__name__}: {e}")
    finally:
        report["failures"] = failures
        with open(args["out"], "w", encoding="utf-8") as f:
            json.dump(report, f, indent=1)
    summary = {k: v for k, v in report.items() if k != "runs"}
    print(json.dumps(summary, indent=1))
    for failure in failures:
        print("FAIL", failure)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
