# Http1Server CPU per request, end to end: 0.34.1 against 0.35.0

This bench asks whether Nish 0.35.0 saves CPU per request end to end against
0.34.1. It also shows where an HTTP worker's time goes, in user space and in
the kernel. The workload is the multicore-server-challenge submission
`submissions/nish-std-amritk` at ref `ccr-54288e72-j5sj3b`, under the
challenge's own load generator:

```
loadgen run -users 15000 -think-scale 0.25 -articles 500000 -ramp 60s -measure 120s -tail 5s
```

It runs against a fresh copy of the full seed database each round.

**Verdict: GO.** Neither 0.35.0 arm saves CPU per request beyond the noise on
either machine. The ~3 µs a STOP needed is not there. Every difference is
inside one arm's own spread:

- aarch64: B +9 ns, C +32 ns against a spread of ~500 ns.
- x86: B +265 ns, C +304 ns against a spread of ~640 ns.

The CPU goes to the stages listed under "Where the time goes" below.

## Arms

| arm | compiler | source |
| --- | --- | --- |
| A | nish 0.34.1 | the submission as pushed |
| B | nish 0.35.0 | the same source, unpatched |
| C | nish 0.35.0 | [`patches/arm-c-sendbody.patch`](patches/arm-c-sendbody.patch): `ConduitWorker.answer` sends with `conn.sendBody` (one `writev` of head and body) where it used `conn.write` |
| K-*name* | nish 0.35.0 | arm B, with [`patches/knob-<name>.patch`](patches/) applied to that arm's own copy of the installed `std/` |

The baseline arm A is fetched from the npm registry, not from a git tag:
`run.sh setup` runs `npm install -g nish@0.34.1` into its own prefix (and
`nish@0.35.0` for B, C and the knob arms), so a fresh clone needs no tag.
`ARM_NISH=<version|tarball>` overrides an arm's compiler.

Every arm is built with the submission's `build.sh` plus `-g`. That way perf
and cachegrind can name its functions, and the code they measure is the code
that runs.

## Method

- **Rounds alternate** A B C A B C …. There are 5 per arm on aarch64 and 4 per
  arm on x86. Each round starts the server fresh, on a fresh database.
- **The window** is [70, 170) s of loadgen's clock. It starts past the ramp
  and ends before the tail.
- **The denominator** is loadgen's own `completed` count inside the window,
  from its timeline. It is not the server's count.
- **CPU** is the two HTTP worker threads' CPU over the window. It is read from
  `/proc/<pid>/task/<tid>/schedstat` (on-CPU ns), split user/kernel by
  `utime`/`stime`.
- **Spread** is one arm's min–max over its rounds. A difference between arms
  counts only when it is larger than that.

**Every figure is labelled with its source.** On **aarch64** (a GitHub-hosted
`ubuntu-24.04-arm` runner, Neoverse-N2, 4 CPUs) the **hardware counters**
come from `perf stat` and `perf record` ([`perf-stat.sh`](perf-stat.sh)). The
counters are cycles and instructions, user and kernel, L1-dcache-load-misses,
and `ll_cache_miss_rd`. The generic LLC-load-misses is not counted on that
core. The runner job is
[run 42417089767, job 128537427657](https://github.com/amritk/nish/actions/runs/42417089767/job/128537427657).
The workflow lives on the throwaway branch
`feature/http1-cpu-per-request/e2e-runner`.

The **x86** box (Xeon @ 2.10GHz VM, 4 CPUs) has no PMU. Its figures are
**substitutes**:

- schedstat CPU time (step 1);
- cachegrind's simulated instructions and cache misses (step 2,
  [`cachegrind.mjs`](cachegrind.mjs));
- a tracefs `raw_syscalls` + `sched_switch` trace (step 4,
  [`trace.mjs`](trace.mjs)).

Nothing here changes a kernel setting that the challenge box could not
change. On the runner, `perf_event_paranoid` is lowered and tracefs is
mounted. Neither changes what the server does.

## Reproducing

```
WORK=~/http1-e2e-work PGPASSWORD=… bash bench/http1-e2e/run.sh setup
bash bench/http1-e2e/run.sh seed
for a in A B C; do bash bench/http1-e2e/run.sh build $a; done
bash bench/http1-e2e/run.sh rounds "A B C" 4             # step 1 (PERF=1 adds counters)
bash bench/http1-e2e/run.sh cachegrind B                 # step 2 (x86)
TRACE=20 RESULTS=bench/http1-e2e/results/x86-64/trace bash bench/http1-e2e/run.sh round B 1   # step 4
for k in maxevents rcvlowat read; do bash bench/http1-e2e/run.sh build K-$k; done
RESULTS=bench/http1-e2e/results/x86-64/knobs bash bench/http1-e2e/run.sh rounds "B K-maxevents K-rcvlowat K-read" 3
node bench/http1-e2e/report.mjs bench/http1-e2e/results  # the tables below
```

The cachegrind rounds run one HTTP worker (`HTTP_WORKERS=1`) at 300 users,
with a 10 s ramp and a 40 s measure. Under valgrind the worker cannot keep up
with 15,000. Counts from an idle start are subtracted. At that load there is
less batching per wakeup than in the step 1 rounds. So the dispatch and
syscall shares are larger than at full load. The per-request library
stages do the same work at either load.

## Results

`node bench/http1-e2e/report.mjs bench/http1-e2e/results` prints this section.

### aarch64: unknown, 4 CPUs, kernel 7.0.0-1017-azure

Step 1, per request, 2 HTTP workers, 15000 users, window [70, 170) s of loadgen's clock; requests = loadgen's completed count in that window.
On-CPU ns: schedstat (substitute, not a counter), split user/kernel by utime/stime. Instructions, cycles and misses: hardware counters (perf stat).

| arm | nish | rounds | on-CPU ns median | same-arm spread | Δ vs A | user ns | kernel ns | req/s | vol. switches | cycles:u | cycles:k | instructions:u | instructions:k | L1-dcache-load-misses | ll_cache_miss_rd:u | ll_cache_miss_rd:k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 0.34.1 | 5 | 14,410 | 14,220–14,634 (414) |  | 4,347 | 10,066 | 14,853 | 0.27 | 13,419 | 26,120 | 22,268 | 33,963 | 586 | 27 | 28 |
| B | 0.35.0 | 5 | 14,419 | 14,040–14,555 (515) | +9 | 4,306 | 10,131 | 14,853 | 0.27 | 13,216 | 26,365 | 22,310 | 33,993 | 566 | 26 | 29 |
| C | 0.35.0 | 5 | 14,442 | 14,100–14,736 (636) | +32 | 4,151 | 10,317 | 14,863 | 0.27 | 12,842 | 26,752 | 21,877 | 34,713 | 546 | 26 | 31 |

Last-level event: `ll_cache_miss_rd:u` (the generic LLC-load-misses is not counted on this core).

Step 2 by sampling, 20 s of `perf record -g -F 999` on the HTTP workers (hardware cycles), self time by symbol. Kernel symbols print as addresses: the runner's kptr_restrict hides them, and the bench does not change it.

| A symbol | % | stage | B symbol | % | stage | C symbol | % | stage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| nish.http1Next | 4.03 | head parse | nish.http1Next | 4.50 | head parse | ConduitWorker.drive | 3.77 | accept/epoll dispatch |
| ConduitWorker.drive | 3.50 | accept/epoll dispatch | ConduitWorker.drive | 3.14 | accept/epoll dispatch | nish.http1Next | 3.38 | head parse |
| jwtDecode | 2.30 | onHead + Jwt.verify | jwtDecode | 2.01 | onHead + Jwt.verify | nish.http1TakeLine | 2.26 | head parse |
| nish.http1TakeLine | 2.15 | head parse | nish.http1TakeLine | 1.79 | head parse | jwtDecode | 2.08 | onHead + Jwt.verify |
| ConduitWorker.answer | 1.75 | respond + sendBody | ConduitWorker.answer | 1.63 | respond + sendBody | ConduitWorker.answer | 1.81 | respond + sendBody |
| nish.Http1Connection.inputRoom | 1.60 | recv | 0x0000000000000578 | 1.45 | other | nish.Http1Connection.respond | 1.45 | respond + sendBody |
| nish.Http1Connection.feed | 1.51 | recv | nish.Http1Connection.inputRoom | 1.43 | recv | 0x0000000000000578 | 1.18 | other |
| nish.Http1Connection.respond | 1.31 | respond + sendBody | nish.Http1Connection.respond | 1.20 | respond + sendBody | Jwt.verify | 1.11 | onHead + Jwt.verify |
| 0x0000000000000578 | 1.22 | other | nish_poll_wait | 1.16 | accept/epoll dispatch | nish.Http1Connection.inputRoom | 1.06 | recv |
| ConduitReq.room | 1.13 | onHead + Jwt.verify | nish.Http1Connection.feed | 0.98 | recv | nish.Http1Connection.feed | 0.98 | recv |
| ConduitWorker.run | 1.05 | accept/epoll dispatch | Jwt.verify | 0.95 | onHead + Jwt.verify | ConduitWorker.run | 0.84 | accept/epoll dispatch |
| Jwt.verify | 0.95 | onHead + Jwt.verify | nish.http1HeadAppend | 0.79 | head parse | ConduitReq.room | 0.79 | onHead + Jwt.verify |
| nish_poll_wait | 0.92 | accept/epoll dispatch | ConduitReq.room | 0.71 | onHead + Jwt.verify | nish.http1HeadAppend | 0.78 | head parse |
| nish.http1HeadAppend | 0.91 | head parse | ConduitWorker.takeAnswers | 0.69 | ring peek | nish.Sha256.digest | 0.73 | onHead + Jwt.verify |
| nish.Sha256.digest | 0.63 | onHead + Jwt.verify | ConduitWorker.run | 0.69 | accept/epoll dispatch | nish_poll_wait | 0.72 | accept/epoll dispatch |

Kernel ([k]) share of the top 60 symbols: A 34.9%, B 34.6%, C 34.1%.

### x86-64: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 CPUs, kernel 6.18.44-fc-v310

Step 1, per request, 2 HTTP workers, 15000 users, window [70, 170) s of loadgen's clock; requests = loadgen's completed count in that window.
On-CPU ns: schedstat (substitute, not a counter), split user/kernel by utime/stime.

| arm | nish | rounds | on-CPU ns median | same-arm spread | Δ vs A | user ns | kernel ns | req/s | vol. switches |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 0.34.1 | 4 | 17,818 | 17,455–18,099 (644) |  | 7,770 | 10,048 | 14,604 | 0.30 |
| B | 0.35.0 | 4 | 18,084 | 17,764–18,402 (638) | +265 | 7,976 | 10,157 | 14,549 | 0.30 |
| C | 0.35.0 | 4 | 18,122 | 17,907–19,086 (1,179) | +304 | 7,956 | 10,208 | 14,583 | 0.29 |

Step 2, per request, cachegrind on the one HTTP worker (substitute: simulated caches I1 cache: 32768 B, 64 B, 8-way associative; D1 cache: 49152 B, 64 B, 12-way associative; LL cache: 276824064 B, 64 B, 33-way associative), 300 users; an idle start's counts subtracted.

| stage | A Ir | A D1 miss | A LL miss | B Ir | B D1 miss | B LL miss | C Ir | C D1 miss | C LL miss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| accept/epoll dispatch | 2,545 | 11.6 | 0.05 | 2,573 | 11.9 | 0.05 | 2,551 | 10.9 | 0.05 |
| recv | 247 | 4.6 | 0.00 | 248 | 3.2 | 0.00 | 248 | 3.1 | 0.00 |
| head parse | 5,317 | 8.0 | 0.02 | 5,323 | 7.8 | 0.02 | 5,322 | 7.0 | 0.02 |
| onHead + Jwt.verify | 19,796 | 4.0 | 0.05 | 19,766 | 4.0 | 0.05 | 19,894 | 3.7 | 0.05 |
| ring push | 734 | 0.4 | 0.00 | 739 | 0.4 | 0.00 | 745 | 0.4 | 0.00 |
| ring peek | 320 | 1.0 | 0.00 | 403 | 1.2 | 0.00 | 403 | 1.0 | 0.00 |
| respond + sendBody | 1,620 | 6.3 | 0.00 | 1,619 | 5.9 | 0.00 | 1,604 | 6.2 | 0.00 |
| park/release | 157 | 3.5 | 0.00 | 159 | 3.7 | 0.00 | 157 | 3.3 | 0.00 |
| other | 2,313 | 70.7 | 20.58 | 2,405 | 71.8 | 20.42 | 1,928 | 62.0 | 20.98 |
| **total** | **33,048** | **110.3** | **20.70** | **33,235** | **109.9** | **20.53** | **32,851** | **97.6** | **21.11** |

Requests: A 15,109, B 15,332, C 14,826. Events: Ir I1mr ILmr Dr D1mr DLmr Dw D1mw DLmw.

Step 4, kernel CPU per request by syscall (tracefs raw_syscalls, minus the time the thread was switched out inside the call; substitute, and tracing adds its own cost to each call, so read the split, not the sum):

| syscall | A calls | A CPU ns | B calls | B CPU ns | C calls | C CPU ns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sendto | 1.24 | 7,546 | 1.25 | 7,500 | 0.24 | 2,178 |
| sendmsg | – | – | – | – | 1.00 | 5,864 |
| epoll_wait | 0.41 | 1,673 | 0.42 | 1,627 | 0.42 | 1,603 |
| recvfrom | 1.05 | 948 | 1.05 | 953 | 1.05 | 956 |
| epoll_ctl | 0.00 | 4 | 0.00 | 4 | 0.00 | 3 |
| on-CPU, whole window (schedstat) |  | 18,174 (kernel 10,029) |  | 18,511 (kernel 10,205) |  | 18,586 (kernel 10,499) |

Switch-outs per request, by the syscall the thread was in and its state (S parked, R preempted): A: epoll_wait/S 0.29, user/R 0.07; B: epoll_wait/S 0.29, user/R 0.07; C: epoll_wait/S 0.29, user/R 0.07.

Step 4, the knobs, one at a time on arm B (on-CPU ns per request, schedstat; interleaved rounds):

| arm | rounds | median | against B | user/kernel ns |
| --- | ---: | ---: | ---: | ---: |
| B | 18,716, 18,678, 18,347 | 18,678 |  | 8,288/10,343 |
| K-maxevents | 18,502, 18,808, 18,219 | 18,502 | -176 | 8,332/10,267 |
| K-rcvlowat | 19,529, 19,085, 19,179 | 19,179 | +500 | 8,698/10,774 |
| K-read | 19,206, 19,547, 17,841 | 19,206 | +527 | 8,465/10,741 |

aarch64 (hardware counters available): arm B saves -9 ns/request against A; same-arm spread 515 ns.
aarch64 (hardware counters available): arm C saves -32 ns/request against A; same-arm spread 636 ns.
x86-64 (substitute): arm B saves -265 ns/request against A; same-arm spread 644 ns.
x86-64 (substitute): arm C saves -304 ns/request against A; same-arm spread 1,179 ns.

Verdict: GO

## Reading the results

### Step 1: no saving

Both machines tell the same story. On aarch64:

- B's user instructions match A's (22,310 against 22,268 per request).
- C trades about 430 user instructions per request for about 720 kernel
  ones: one `writev` in place of a head `send` and a body `send`.
- Kernel time is 70% of the workers' CPU on aarch64 and 56% on x86. No
  library change can move the larger share.

### Step 2: where the user time goes

Cachegrind (x86, substitute) gives about 33,000 instructions per request. By
module, for arm B:

| module | Ir/request |
| --- | ---: |
| std/crypto sha256 + hmac (Jwt.verify's HMAC-SHA256, once per authenticated request) | 12,362 |
| the submission's own code (routing, ConduitWorker, ConduitReq) | 7,572 |
| http1 codec (head parse, take line, head append) | 6,296 |
| JSON tokenizer | 2,013 |
| Http1Server | 1,394 |
| libc memcpy/memset | 1,268 |
| SPSC ring | 290 |
| runtime net | 69 |
| rest | 1,915 |

The "other" row is mostly libc `memcpy`: 954 Ir, but 40.8 D1 and 17.1 LL
misses per request, which is almost all of the LL misses. This bench did
not attribute those copies to a caller.

The aarch64 profile ranks things differently. `nish.http1Next`,
`ConduitWorker.drive` and `jwtDecode` lead it. `Sha256.update` and
`Sha256.digest` together are under 1.5%, and the block compress function is
not among the top 60 symbols. This bench did not find out why sha256 weighs
so much less there. Both figures are reported as measured. The
instruction-count estimate (x86, about 0.24 ns per Ir) is rough.

### Step 4: the kernel

- **`sendto` dominates.** It costs about 7.5 µs of kernel CPU per request on
  A and B. Over loopback that figure includes delivering the bytes into
  loadgen's socket, because the receiver's TCP input runs inline in the
  sender's `send`. On a real NIC it would be smaller.
- **`writev` against one send is C against B.** It costs 2,178 + 5,864 =
  8,042 ns against 7,500, about +540 ns of kernel time per request. The same
  shift shows on aarch64: C has ~700 more kernel instructions and ~430 fewer
  user ones.
- **`recvfrom`** costs about 950 ns per request at 1.05 calls.
- **`epoll_ctl`** is negligible: connections stay registered.
- **`finish_task_switch`** is the return from a context switch, not work of
  its own. The trace attributes the switch-outs:
  - 0.29 per request are the worker parking in `epoll_wait` (state S) and
    being woken;
  - 0.07 per request are preemptions in user code (state R).

  So its weight is the price of sleeping in `epoll_wait` when the ready list
  is empty.
- **A gap in the trace.** About one in seven switch-ins never reaches the
  trace buffer. [`trace.mjs`](trace.mjs) infers each missing one at the
  thread's next syscall event. Without that, `epoll_wait` read as 22 µs per
  request, more than the whole on-CPU time.

### Step 4: the knobs, one at a time on B

Three of the four knobs ran as patch arms ([`patches/`](patches/)), three
rounds each, interleaved with B. None clears the ~600 ns noise band.

- **Read into the lent buffer** (`knob-read`: `Http1Parser.readFrom` calls
  `recv` straight into the connection's input buffer). Result: +527 ns, inside
  the noise. `recv` is 248 Ir of user time per request, so there is little to
  save.
- **`epoll_wait` maxevents and when it is called** (`knob-maxevents`: the
  runtime's poll chunk goes from 64 to 512). Result: −176 ns, inside the
  noise. `epoll_wait` runs 0.41 times per request, about 2.4 ready events per
  call, far below 64. The submission's loop calls it only after draining the
  answer ring and the connections it has, so the call is already as late as
  it can be.
- **SO_RCVLOWAT** (`knob-rcvlowat`: 64 bytes on each accepted socket).
  Result: +500 ns. Requests arrive whole in one segment, so it saves no
  wakeups and adds a check to each one.
- **`writev` against one send.** This is arm C above: +540 ns kernel and
  −0.4 µs user on x86, and no net change on either machine.

## Stage-cut targets

Library stages over ~0.5 µs per request:

| stage | estimate | source |
| --- | ---: | --- |
| Jwt.verify's HMAC-SHA256 (`std/crypto` sha256/hmac) | ~2.9 µs | x86 cachegrind Ir; ~1.5% of cycles on aarch64 |
| http1 head parse (`http1Next`, `http1TakeLine`, `http1HeadAppend`) | ~1.25 µs x86 / ~1 µs aarch64 | cachegrind / perf record |
| JSON tokenizer | ~0.47 µs | x86 cachegrind |
| response body copy (`memcpy`, 17 LL misses per request) | memory-bound | x86 cachegrind |

The kernel send path (`sendto`, ~7.5 µs, inflated by loopback) is the largest
single cost. It is not a library stage.
