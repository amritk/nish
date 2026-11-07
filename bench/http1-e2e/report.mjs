// Prints README.md's tables from the raw results round.mjs wrote.
//
//   node bench/http1-e2e/report.mjs bench/http1-e2e/results
//
// results/<machine>/<arm>-<n>.json are measured rounds, cg-<arm>.json the
// cachegrind rounds. Every figure is per request: the HTTP workers' counts over
// the sample window divided by the requests loadgen counted as completed in it.
import fs from "node:fs";
import path from "node:path";
import { pick } from "./cachegrind.mjs";

const root =
  process.argv[2] ??
  path.join(path.dirname(new URL(import.meta.url).pathname), "results");
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const f0 = (x) =>
  x === undefined || Number.isNaN(x)
    ? "–"
    : Math.round(x).toLocaleString("en-US");
const f1 = (x) => (x === undefined || Number.isNaN(x) ? "–" : x.toFixed(1));
const f2 = (x) => (x === undefined || Number.isNaN(x) ? "–" : x.toFixed(2));
const signed = (x) => (x > 0 ? "+" : "") + f0(x);
const table = (head, rows) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map((_, i) => (i ? "---:" : "---")).join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
const out = [];
const say = (s = "") => out.push(s);

/**
 * The stages README.md names, matched in order against cachegrind's function
 * names (file:function; an inlined body carries its caller's name). The
 * submission's own handler code (body JSON, plan keys, queries) counts with
 * onHead; libc memcpy/memset, called from every stage, stays in "other".
 * Matched in this order (respond before head parse, so http1Write* is a
 * respond), printed in the README's.
 */
const STAGES = [
  [
    "accept/epoll dispatch",
    /epoll|accept|nish_poll|nish_run|Http1Server\.(next|serve|poll|run|wait|settle|expire)|ConduitWorker\.(drive|run|ready|pump)|clock_gettime/,
  ],
  ["recv", /netRead|recv|inputRoom|Http1Connection\.(fill|read|lend)/i],
  [
    "respond + sendBody",
    /respond|sendBody|netWrite|writev|sendto|__send|http1(Write|Put)|Http1Server\.send|Http1OutputPool|Http1Connection\.(write|end|flush)|answer\b|ConduitWorker\.answer/,
  ],
  ["head parse", /http1[A-Z]|Http1Parser|Http1Connection\.(parse|head|header)/],
  [
    "onHead + Jwt.verify",
    /ConduitWorker\.(onHead|onEnd|decodeInto|query|planKind|fieldOf|store|parseTags)|JsonTokenizer|isText|bytesAre|Jwt|jwt|hmac|Hmac|sha256|Sha256|base64|Base64/,
  ],
  [
    "ring push",
    /ConduitWorker\.(submit|sendRead|wait)|ReadLink\.push|SpscRing\.(push|tryPush)/,
  ],
  ["ring peek", /tryPop|takeAnswers|SpscRing\.peek/],
  ["park/release", /park|release|futex|Lent|lend/i],
];
const stageOf = (fn) => STAGES.find(([, re]) => re.test(fn))?.[0] ?? "other";

const machines = fs.existsSync(root)
  ? fs
      .readdirSync(root)
      .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
      .sort()
  : [];
const verdicts = [];

for (const m of machines) {
  const dir = path.join(root, m);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const rounds = files
    .filter((f) => !f.startsWith("cg-"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  const cgs = files
    .filter((f) => f.startsWith("cg-"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  const byArm = new Map();
  for (const r of rounds.filter((r) => r.kind === "round" && !r.tracing)) {
    if (!byArm.has(r.arm)) byArm.set(r.arm, []);
    byArm.get(r.arm).push(r);
  }
  const arms = [...byArm.keys()].sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  );
  const mach = rounds[0]?.machine ?? cgs[0]?.machine ?? {};
  say(
    `### ${m}: ${mach.cpu ?? ""}, ${mach.cpus ?? "?"} CPUs, kernel ${mach.kernel ?? "?"}`,
  );
  say();
  if (arms.length) {
    const hasPerf = rounds.some((r) => r.perf?.per_request);
    const r0 = rounds[0];
    say(
      `Step 1, per request, ${r0.http_workers} HTTP workers, ${r0.load.users} users, window [${r0.load.window.join(", ")}) s of loadgen's clock; requests = loadgen's completed count in that window.`,
    );
    say(
      `On-CPU ns: schedstat (substitute, not a counter), split user/kernel by utime/stime.${hasPerf ? " Instructions, cycles and misses: hardware counters (perf stat)." : ""}`,
    );
    say();
    const stat = {};
    for (const arm of arms) {
      const rs = byArm.get(arm);
      const on = rs.map((r) => r.per_request.oncpu_ns);
      stat[arm] = {
        n: rs.length,
        med: median(on),
        min: Math.min(...on),
        max: Math.max(...on),
        rs,
      };
    }
    const base = stat.A?.med;
    const head = [
      "arm",
      "nish",
      "rounds",
      "on-CPU ns median",
      "same-arm spread",
      "Δ vs A",
      "user ns",
      "kernel ns",
      "req/s",
      "vol. switches",
    ];
    const perfKeys = [];
    if (hasPerf) {
      const ks = Object.keys(
        rounds.find((r) => r.perf?.per_request).perf.per_request,
      );
      for (const k of ks) perfKeys.push(k);
      head.push(...perfKeys);
    }
    const rows = arms.map((arm) => {
      const s = stat[arm];
      const med = (fn) => median(s.rs.map(fn));
      const row = [
        arm,
        s.rs[0].nish,
        String(s.n),
        f0(s.med),
        `${f0(s.min)}–${f0(s.max)} (${f0(s.max - s.min)})`,
        base === undefined || arm === "A" ? "" : signed(s.med - base),
        f0(med((r) => r.per_request.user_ns)),
        f0(med((r) => r.per_request.kernel_ns)),
        f0(med((r) => r.rps)),
        f2(med((r) => r.per_request.vcsw)),
      ];
      for (const k of perfKeys)
        row.push(
          f0(
            median(
              s.rs
                .filter((r) => r.perf?.per_request)
                .map((r) => r.perf.per_request[k]),
            ),
          ),
        );
      return row;
    });
    say(table(head, rows));
    say();
    if (hasPerf) {
      const ll = rounds
        .find((r) => r.perf?.events)
        ?.perf.events.find((e) => !/cycles|instructions|L1/.test(e));
      say(
        `Last-level event: \`${ll ?? "none counted"}\` (the generic LLC-load-misses is not counted on this core).`,
      );
      say();
    }
    for (const arm of ["B", "C"]) {
      if (!stat[arm] || !stat.A) continue;
      const saved = stat.A.med - stat[arm].med;
      const noise = Math.max(
        stat.A.max - stat.A.min,
        stat[arm].max - stat[arm].min,
      );
      verdicts.push({
        machine: m,
        arm,
        saved,
        noise,
        hw: hasPerf,
        stop: saved >= 3000 && saved > noise,
      });
    }
  }

  // Step 2: the stage table from cachegrind.
  if (cgs.length) {
    cgs.sort((a, b) => a.arm.localeCompare(b.arm));
    const ev = cgs[0].events;
    say(
      `Step 2, per request, cachegrind on the one HTTP worker (substitute: simulated caches ${cgs[0].caches.map((d) => d.replace(/\s+/g, " ")).join("; ")}), ${cgs[0].load.users} users; an idle start's counts subtracted.`,
    );
    say();
    const per = cgs.map((c) => {
      const st = {};
      for (const [fn, v] of Object.entries(c.fns)) {
        const s = stageOf(fn);
        const p = pick(c.events, v);
        st[s] ??= { ir: 0, d1: 0, ll: 0 };
        st[s].ir += p.ir;
        st[s].d1 += p.d1;
        st[s].ll += p.ll;
      }
      // What fell under the 0.05% cut is "other" too.
      const t = pick(c.events, c.totals);
      const listed = Object.values(st).reduce(
        (a, x) => ({ ir: a.ir + x.ir, d1: a.d1 + x.d1, ll: a.ll + x.ll }),
        { ir: 0, d1: 0, ll: 0 },
      );
      st.other ??= { ir: 0, d1: 0, ll: 0 };
      st.other.ir += t.ir - listed.ir;
      st.other.d1 += t.d1 - listed.d1;
      st.other.ll += t.ll - listed.ll;
      return { c, st, t };
    });
    const head = [
      "stage",
      ...per.flatMap(({ c }) => [
        `${c.arm} Ir`,
        `${c.arm} D1 miss`,
        `${c.arm} LL miss`,
      ]),
    ];
    const names = [
      "accept/epoll dispatch",
      "recv",
      "head parse",
      "onHead + Jwt.verify",
      "ring push",
      "ring peek",
      "respond + sendBody",
      "park/release",
      "other",
    ];
    const rows = names.map((n) => [
      n,
      ...per.flatMap(({ c, st }) => {
        const s = st[n] ?? { ir: 0, d1: 0, ll: 0 };
        return [
          f0(s.ir / c.requests),
          f1(s.d1 / c.requests),
          f2(s.ll / c.requests),
        ];
      }),
    ]);
    rows.push([
      "**total**",
      ...per.flatMap(({ c, t }) => [
        `**${f0(t.ir / c.requests)}**`,
        `**${f1(t.d1 / c.requests)}**`,
        `**${f2(t.ll / c.requests)}**`,
      ]),
    ]);
    say(table(head, rows));
    say();
    say(
      `Requests: ${per.map(({ c }) => `${c.arm} ${c.requests.toLocaleString("en-US")}`).join(", ")}. Events: ${ev.join(" ")}.`,
    );
    say();
    if (process.env.STAGE_FNS) {
      for (const { c } of per) {
        const top = Object.entries(c.fns)
          .map(([fn, v]) => [fn, pick(c.events, v).ir / c.requests])
          .sort((a, b) => b[1] - a[1])
          .slice(0, Number(process.env.STAGE_FNS));
        say(`${c.arm} top functions (Ir/request, stage):`);
        for (const [fn, ir] of top)
          say(`  ${f0(ir).padStart(7)}  ${stageOf(fn).padEnd(22)} ${fn}`);
        say();
      }
    }
  }

  // Step 4: kernel time by syscall, from the tracing rounds.
  const traced = rounds.filter((r) => r.trace?.calls && r.trace.requests);
  if (traced.length) {
    say(
      "Step 4, kernel CPU per request by syscall (tracefs raw_syscalls, minus the time the thread was switched out inside the call; substitute, and tracing adds its own cost to each call, so read the split, not the sum):",
    );
    say();
    traced.sort((a, b) => a.arm.localeCompare(b.arm));
    const calls = [
      ...new Set(traced.flatMap((r) => Object.keys(r.trace.calls))),
    ]
      .map((c) => [
        c,
        Math.max(
          ...traced.map(
            (r) => (r.trace.calls[c]?.cpu_ns ?? 0) / r.trace.requests,
          ),
        ),
      ])
      .filter(([, v]) => v >= 20)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
    const head = [
      "syscall",
      ...traced.flatMap((r) => [`${r.arm} calls`, `${r.arm} CPU ns`]),
    ];
    const rows = calls.map((c) => [
      c,
      ...traced.flatMap((r) => {
        const v = r.trace.calls[c];
        return v
          ? [f2(v.n / r.trace.requests), f0(v.cpu_ns / r.trace.requests)]
          : ["–", "–"];
      }),
    ]);
    rows.push([
      "on-CPU, whole window (schedstat)",
      ...traced.flatMap((r) => [
        "",
        `${f0(r.per_request.oncpu_ns)} (kernel ${f0(r.per_request.kernel_ns)})`,
      ]),
    ]);
    say(table(head, rows));
    say();
    const sw = [
      ...new Set(traced.flatMap((r) => Object.keys(r.trace.switches))),
    ].sort();
    say(
      `Switch-outs per request, by the syscall the thread was in and its state (S parked, R preempted): ${traced
        .map(
          (r) =>
            `${r.arm}: ${sw
              .filter((k) => r.trace.switches[k] / r.trace.requests >= 0.01)
              .map((k) => `${k} ${f2(r.trace.switches[k] / r.trace.requests)}`)
              .join(", ")}`,
        )
        .join("; ")}.`,
    );
    say();
  }
}

for (const v of verdicts) {
  say(
    `${v.machine} (${v.hw ? "hardware counters available" : "substitute"}): arm ${v.arm} saves ${f0(v.saved)} ns/request against A; same-arm spread ${f0(v.noise)} ns${v.stop ? " — beyond noise and ≥ 3 µs" : ""}.`,
  );
}
// aarch64 decides step 1; x86 only when no aarch64 results exist.
const deciding = verdicts.filter((v) => v.machine === "aarch64").length
  ? verdicts.filter((v) => v.machine === "aarch64")
  : verdicts;
if (deciding.length) {
  say();
  say(`Verdict: ${deciding.some((v) => v.stop) ? "STOP" : "GO"}`);
}
console.log(out.join("\n"));
