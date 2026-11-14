# WP49 stage 6 — profile scratch notes (not for merge)

Main 2763199c. Raw per-frame buckets from callgrind (Ir/req), then the /queries runs.

#### nish.serveOn$fn.9.tfbHandle.resume (plaintext-async) — self 459 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| serveAnswer: slot reads, status/length/type checks, typed header value | 67 |  |
| serveFreeSlot | 12 |  |
| finished loop: recycle slot k (busy/done/cancelled/tasks/free, stats) | 65 |  |
| queue: ready/take | 53 |  |
| slot claim: reqs/slots/gens/busy/done/cancelled/tasks/listed | 85 |  |
| spawn(serveTask(...)) + inline first resume call | 13 | nish_async_spawn 1.00x 42; resume 1.00x (frame); nish_async_done 1.00x 181 |
| executor: async_enter/leave inlined | 10 |  |
| region enter/leave inlined (slot_of check + arena swap x2) | 94 |  |
| running-list sweep | 2 |  |
| frame: prologue/state switch/spills (line 0) | 36 | nish.Http1Server.settle 0.06x 8; send 1.00x (frame) |
| other | 20 | clock_gettime@@GLIBC_2.17 0.06x 1; clock_gettime@@GLIBC_2.17 0.06x 1; nish.Http1Connection.inputRoom 0.06x 2; 0x000000000012de70 0.06x 1; nish.Http1Connection.feed 0.06x 30; drive 0.06x (frame) |

#### nish.serveTask$fn.9.tfbHandle.resume (plaintext-async) — self 432 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| frame: coroutine entry/state switch | 36 |  |
| taskId, tasks[k], stopping/deadline | 22 |  |
| request copy (HttpRequest, head, spans, fields) | 245 | nish.HttpRequest.constructor 1.00x 65; __memset_avx2_unaligned_erms 1.00x 26; __memcpy_avx_unaligned_erms 1.00x 30; __memset_avx2_unaligned_erms 1.00x 12 |
| await handle(new Request(r)) | 5 |  |
| handler (inlined tfbHandle) | 10 | tfbText 1.00x 110 |
| answer copy: status, body set into slot, length | 42 | __memcpy_avx_unaligned_erms 1.00x 13 |
| type lookup by text into slot | 50 | __memcmp_avx2_movbe 1.00x 19 |
| finished list + wake | 21 |  |

#### nish.ServeConns.send (plaintext-async) — self 400 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| live check + connection | 23 | nish.Http1Server.connection 1.00x 16 |
| respond (inlined Http1Connection.respond) | 286 | nish.Http1Connection.bodyRoom 0.01x 1; nish.http1ServerReason 0.01x 0; nish.http1WriteResponseHead 0.01x 14; nish.Http1Connection.keepHead 0.01x 2; nish.http1ServerKept 1.99x 215; nish.http1ServerKept 1.99x 215; nish.Http1Connection.bodyRoom 0.99x 29; nish.copyBytes 0.99x 43 |
| Date clock read per respond (date not held) | 12 | clock_gettime@@GLIBC_2.17 1.00x 11 |
| body write (Http1Connection.write call) | 28 | nish.Http1Connection.write 1.00x 167 |
| finish/end | 24 |  |
| re-drive (drive(s) after every send) | 8 | drive 1.00x (frame) |
| frame (line 0) | 12 |  |
| other | 7 |  |

#### nish.ServeConns.drive (plaintext-async) — self 237 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| drive: connection, reqs[s], server.next loop | 46 | nish.Http1Server.connection 1.07x 17; nish.Http1Server.next 1.07x 2907 |
| inlined Http1Server.next/holds | 71 | nish.Http1Connection.nextRequest 2.01x 111 |
| event dispatch + enqueue | 10 | nish.ServeConns.enqueue 1.00x 65 |
| owe the send to turn end / settle | 30 | nish.ServeConns.settle 0.06x 12 |
| begin: point request at parser head + route | 58 | nish.Router.match 1.00x 429 |
| frame (line 0) | 22 |  |

#### TfbServer.resume (plaintext-explicit) — self 446 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| frame (line 0) | 19 |  |
| owed-reply bookkeeping (tracks, owes, body pick) | 67 |  |
| respond (inlined Http1Connection.respond) | 262 | nish.http1ServerKept 1.99x 216; nish.http1ServerKept 1.99x 216; nish.Http1Connection.bodyRoom 0.99x 29 |
| body write (inlined Http1Connection.write) | 82 | nish_arena_release 1.00x 34; nish.Http1Connection.bodyRoom 1.00x 26; __memcpy_avx_unaligned_erms 2.00x 35 |
| finish/end | 16 |  |

#### tfbMain$fn.16.nish_main$arrow0$fn.16.nish_main$arrow1 (plaintext-explicit) — self 366 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| answer(): route by methodIs/targetIs, owes | 32 |  |
| inlined Http1Server.next/holds/nextRequest | 316 | nish.Http1Connection.inputRoom 0.06x 2; nish.Http1Connection.feed 0.06x 30; nish.http1Next 2.07x 2854; nish.Http1Server.settle 0.06x 16 |
| other | 18 | clock_gettime@@GLIBC_2.17 0.06x 1; 0x00000000001245e0 0.06x 1; clock_gettime@@GLIBC_2.17 0.06x 1; nish.Http1Server.settle 0.06x 8; resume 1.00x (frame) |

#### nish.serveOn$fn.9.tfbHandle.resume (json-async) — self 646 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| serveAnswer: slot reads, status/length/type checks, typed header value | 67 |  |
| serveFreeSlot | 12 |  |
| finished loop: recycle slot k (busy/done/cancelled/tasks/free, stats) | 66 |  |
| queue: ready/take | 53 |  |
| slot claim: reqs/slots/gens/busy/done/cancelled/tasks/listed | 100 |  |
| spawn(serveTask(...)) + inline first resume call | 15 | nish_async_spawn 1.00x 42; resume 1.00x (frame); nish_async_done 1.00x 180 |
| executor: async_enter/leave inlined | 11 |  |
| region enter/leave inlined (slot_of check + arena swap x2) | 94 |  |
| running-list sweep | 26 | nish.ServeConns.flush 0.02x 367 |
| frame: prologue/state switch/spills (line 0) | 48 | nish.Http1Server.settle 1.00x 134; send 1.00x (frame) |
| other | 154 | nish.ServeConns.flush 0.02x 0; epoll_wait 0.02x 0; clock_gettime@@GLIBC_2.17 1.02x 11; clock_gettime@@GLIBC_2.17 1.00x 11; nish.Http1Connection.inputRoom 1.00x 25; 0x000000000012de70 1.00x 13; nish.Http1Connection.feed 1.00x 234; drive 1.00x (frame); nish_async_wait_fd 0.02x 2 |

#### nish.serveTask$fn.9.tfbHandle.resume (json-async) — self 489 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| frame: coroutine entry/state switch | 36 |  |
| taskId, tasks[k], stopping/deadline | 22 |  |
| request copy (HttpRequest, head, spans, fields) | 244 | nish.HttpRequest.constructor 1.00x 65; __memset_avx2_unaligned_erms 1.00x 26; __memcpy_avx_unaligned_erms 1.00x 30; __memset_avx2_unaligned_erms 1.00x 12 |
| await handle(new Request(r)) | 5 |  |
| handler (inlined tfbHandle) | 57 | nish.JsonWriter.beginObject 1.00x 34; nish.JsonWriter.key 1.00x 195; nish.JsonWriter.string 1.00x 294; nish.JsonWriter.endObject 1.00x 40; nish.Response.bytes 1.00x 9 |
| answer copy: status, body set into slot, length | 42 | __memcpy_avx_unaligned_erms 1.00x 12 |
| type lookup by text into slot | 50 | __memcmp_avx2_movbe 1.00x 19 |
| finished list + wake | 21 |  |
| other | 12 |  |

#### nish.ServeConns.send (json-async) — self 399 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| live check + connection | 23 | nish.Http1Server.connection 1.00x 16 |
| respond (inlined Http1Connection.respond) | 285 | nish.http1ServerKept 1.99x 216; nish.http1ServerKept 1.99x 167; nish.Http1Connection.bodyRoom 1.00x 83; nish.copyBytes 1.00x 43 |
| Date clock read per respond (date not held) | 12 | clock_gettime@@GLIBC_2.17 1.00x 11 |
| body write (Http1Connection.write call) | 28 | nish.Http1Connection.write 1.00x 164 |
| finish/end | 24 |  |
| re-drive (drive(s) after every send) | 8 | drive 1.00x (frame) |
| frame (line 0) | 12 |  |
| other | 7 |  |

#### nish.ServeConns.drive (json-async) — self 298 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| drive: connection, reqs[s], server.next loop | 74 | nish.Http1Server.connection 2.00x 32; nish.Http1Server.next 2.00x 3079 |
| inlined Http1Server.next/holds | 74 | nish.Http1Connection.nextRequest 2.00x 111 |
| event dispatch + enqueue | 10 | nish.ServeConns.enqueue 1.00x 65 |
| owe the send to turn end / settle | 53 | nish.ServeConns.settle 1.00x 187 |
| begin: point request at parser head + route | 58 | nish.Router.match 1.00x 327 |
| frame (line 0) | 29 |  |

#### TfbServer.resume (json-explicit) — self 448 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| frame (line 0) | 19 |  |
| owed-reply bookkeeping (tracks, owes, body pick) | 69 |  |
| respond (inlined Http1Connection.respond) | 262 | nish.http1ServerKept 1.99x 216; nish.http1ServerKept 1.99x 167; nish.Http1Connection.bodyRoom 1.00x 83 |
| body write (inlined Http1Connection.write) | 82 | nish_arena_release 1.00x 34; nish.Http1Connection.bodyRoom 1.00x 26; __memcpy_avx_unaligned_erms 2.00x 33 |
| finish/end | 16 |  |

#### tfbMain$fn.16.nish_main$arrow0$fn.16.nish_main$arrow1 (json-explicit) — self 568 Ir/req

| part | self Ir/req | calls (incl Ir/req) |
| --- | ---: | --- |
| answer(): route by methodIs/targetIs, owes | 37 |  |
| inlined Http1Server.next/holds/nextRequest | 326 | nish.Http1Connection.inputRoom 1.00x 25; nish.Http1Connection.feed 1.00x 234; nish.http1Next 3.00x 2980; nish.Http1Server.settle 1.00x 252 |
| json body (inlined JsonWriter) | 114 | nish.jsonWriterPutString 1.00x 163; nish.jsonWriterPutString 1.00x 271 |
| other | 90 | epoll_wait 0.02x 0; clock_gettime@@GLIBC_2.17 1.00x 11; 0x00000000001245e0 1.00x 13; clock_gettime@@GLIBC_2.17 1.00x 11; nish.Http1Server.settle 1.00x 134; resume 1.00x (frame) |

## /queries?queries=20 runs (run.sh --only db --rounds 1 --duration 6, interleaved)

### db-main-1

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 22100 (22100) | 26971 (26971) | 34778 (34778) | 66.5 |
| db-entry-copy | 24884 (24884) | 24424 (24424) | 34776 (34776) | 66.6 |
| async-db | 26820 (26820) | 26352 (26352) | 29871 (29871) | 25.0 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 12.6% 64: 9.4% 256: 0.0%

### db-old-1

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 27039 (27039) | 30595 (30595) | 29508 (29508) | 66.5 |
| db-entry-copy | 24301 (24301) | 27982 (27982) | 34748 (34748) | 66.6 |
| async-db | 26175 (26175) | 26812 (26812) | 29321 (29321) | 25.4 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 10.1% 64: 8.5% 256: 17.8%

### db-main-2

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 21958 (21958) | 27508 (27508) | 32336 (32336) | 66.5 |
| db-entry-copy | 26491 (26491) | 29014 (29014) | 34400 (34400) | 66.6 |
| async-db | 24140 (24140) | 30242 (30242) | 26523 (26523) | 26.6 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 20.6% 64: 5.5% 256: 6.4%

### db-old-2

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 23855 (23855) | 23314 (23314) | 34465 (34465) | 66.6 |
| db-entry-copy | 24204 (24204) | 25787 (25787) | 35757 (35757) | 66.6 |
| async-db | 26424 (26424) | 24399 (24399) | 25276 (25276) | 25.9 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 1.5% 64: 10.6% 256: 3.7%

### db-main-3

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 26915 (26915) | 24982 (24982) | 38296 (38296) | 66.5 |
| db-entry-copy | 25792 (25792) | 23659 (23659) | 34009 (34009) | 66.5 |
| async-db | 24108 (24108) | 27730 (27730) | 30780 (30780) | 25.4 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 4.2% 64: 5.3% 256: 11.2%

### db-old-3

| contestant | 16 | 64 | 256 | peak RSS, MiB |
| --- | ---: | ---: | ---: | ---: |
| db-entry | 23522 (23522) | 27057 (27057) | 36816 (36816) | 66.5 |
| db-entry-copy | 25009 (25009) | 26004 (26004) | 40276 (40276) | 66.5 |
| async-db | 26998 (26998) | 28162 (28162) | 29986 (29986) | 25.3 |
noise band (|db-entry - db-entry-copy| / db-entry, medians): 16: 6.3% 64: 3.9% 256: 9.4%

## Posted comment

## WP49 stage 6 — profile: async serve vs explicit `TfbServer.resume`, line by line

Main at 2763199c, measured in one container. The tool is `bench/techempower/profile.sh` (callgrind), and every figure is Ir per request. Each frame's own Ir is grouped by source line into parts. Call entries read *count per request × inclusive Ir per call*. **S** marks structural work: a second task, a second resume, a region. **L** marks library work that explicit does not do.

| test | explicit | async | async − explicit |
| --- | ---: | ---: | ---: |
| plaintext c=256, 16 pipelined | 4,291 | 6,345 | **2,054** (#1608: 2,043) |
| json c=64 | 5,676 | 8,101 | **2,425** (#1608: 2,429) |

**Bounds checks.** Compiling `async-main.ts` gives exactly one `NL9007`, at `serve.ts:736`. It is the per-byte copy of a content type the server has not sent before, and that branch is cold here: the hot path finds the type by text at 723–727. `main.ts` gives none. **None of the four frames keeps an undischarged bounds check on its hot path.**

**Copies per request:** async makes 4 memcpy/memset calls that explicit does not (head copy, two memsets for the new `HttpRequest`'s arrays, body into the slot). They appear in serveTask below.

### 1. `serveOn`'s resume (plaintext 459 self, json 646 self)

| part | plain | json | calls / req | |
| --- | ---: | ---: | --- | --- |
| frame prologue, state switch, spills (line 0) | 36 | 48 | → send 1.00×, drive 1.00× | S |
| inlined `serveAnswer` (573–601): slot/gen/status/length/type reads, typed header value | 67 | 67 | | L |
| `serveFreeSlot` (522–535) | 12 | 12 | | L |
| finished loop (1424–1441): recycle slot k, clear busy/done/cancelled/tasks, stats | 65 | 66 | | S (task completion) + L (slot record) |
| queue `ready`/`take` (1183–1207, 1442–1443) | 53 | 53 | | L |
| slot claim (1444–1463): reqs/slots/gens/busy/done/cancelled/tasks/listed | 85 | 100 | | L |
| `spawn(serveTask(...))` (1464) | 13 | 15 | `nish_async_spawn` 1.00× 42 · serveTask resume 1.00× · `nish_async_done` 1.00× 181 (of which region enter+leave 114) | **S** |
| inlined `nish_async_enter/leave` (runtime-async.c 304–314) | 10 | 11 | | **S** |
| inlined region enter/leave (runtime-region.c 190–292: `slot_of` check, arena swap ×2) | 94 | 94 | | **S** |
| running-list sweep (1465–1500) | 2 | 26 | `ServeConns.flush` 0.02× | — |
| other (inlined readable/feed: same path as explicit's loop) | 20 | 154 | json: `feed` 1.00× 234, `clock_gettime` 2.02× 11 | = explicit |

### 2. `serveTask`'s resume (plaintext 432 self, json 489 self)

| part | plain | json | calls / req | |
| --- | ---: | ---: | --- | --- |
| coroutine entry, state switch (line 0, 651) | 36 | 36 | | **S** |
| `taskId`, `tasks[k]`, stopping/deadline (656–662) | 22 | 22 | | **S** |
| request copy (666–698): `new HttpRequest(-1)`, head array + `copyBytes`, spans array and element loop (671–672: 105 by itself), 12 field copies | 245 | 244 | `HttpRequest.constructor` 1.00× 65 · memset 1.00× 26 · memset 1.00× 12 · memcpy 1.00× 30 | **L** (≈378 incl.) |
| `await handle(new Request(r))` (699, 240–245) | 5 | 5 | | S |
| handler (inlined `tfbHandle`) | 10 | 57 | plain: `tfbText` 110 · json: JsonWriter 572 | = explicit (its body pick / inlined JsonWriter) |
| answer copy (700–718): status, body `set` into the slot, length | 42 | 42 | memcpy 1.00× 13 | **L** |
| content type found by text into the slot (719–739) | 50 | 50 | memcmp 1.00× 19 | **L** |
| finished list + wake (740–747) | 21 | 21 | | **S** |

### 3. `ServeConns.send` (plaintext 400 self, json 399 self) vs explicit `TfbServer.resume` (446 / 448 self)

| part | async plain/json | explicit plain/json | calls / req (async) | |
| --- | ---: | ---: | --- | --- |
| live check + connection (1204–1207, 1232–1238) | 23 / 23 | — | `Http1Server.connection` 1.00× 16 | **L** |
| owed-reply bookkeeping (server.ts 150–201) | — | 67 / 69 | | explicit only |
| inlined `Http1Connection.respond` (http1-server 470–560, 1490–1700) | 286 / 285 | 262 / 262 | `http1ServerKept` 2× and `bodyRoom` are identical on both sides; async adds `copyBytes` 1.00× 43 | ≈ same; +24 self, +43 copy **L** |
| **`Date` clock read per response** (runtime-host.c 55–56) | 12 / 12 | — | `clock_gettime` **1.00×** 11 (explicit: 0.06× plaintext) | **L** |
| body write (1239–1267) | 28 / 28 (call) | 82 / 82 (inlined) | async `Http1Connection.write` 1.00× 167 / 164 · explicit callees 95 / 93 | ≈ same (+18) |
| finish/end (1268, 1272–1291, http1-server 1850–1890) | 24 / 24 | 16 / 16 | | L (+8) |
| re-drive: `this.drive(s)` after every send (1269) | 8 / 8 | — | drive 1.00× | **L** |
| frame + other | 19 / 19 | 19 / 19 | | |

`send` reads the clock once per response. `Http1Server.flush` `unhold`s the date at the end of the serve call, and the loop's sends run after it, so each `respond`'s `date.current()` reads the wall clock. That costs ≈23 Ir/req and one `clock_gettime` per response. Explicit writes its responses inside `readable`'s `hold`.

### 4. `ServeConns.drive` (plaintext 237 self, json 298 self) vs explicit main-loop arrow1 (366 / 568 self)

| part | async plain/json | explicit plain/json | calls / req (async) | |
| --- | ---: | ---: | --- | --- |
| connection, `reqs[s]`, `server.next` loop (1028–1032, 1054–1055) | 46 / 74 | | `connection` 1.07× / 2.00× 16, `next` 1.07× / 2.00× | L (json reaches `next` twice) |
| inlined `Http1Server.next`/holds | 71 / 74 | 316 / 326 (incl. `nextRequest`) | `nextRequest` 2.01× / 2.00× 111 | = explicit |
| event dispatch + `enqueue` (1033–1053) | 10 / 10 | — | `enqueue` 1.00× 65 | **L** |
| owe the send to turn end / settle (1056–1077, 1102–1105) | 30 / 53 | | `settle` 0.06× 12 / 1.00× 187 (explicit: `settle` 1.00× 252 in json) | ≈ same |
| `begin` (1107–1160): point the request at the parser's head, then route | 58 / 58 | `answer()` 32 / 37 | **`Router.match` 1.00× 429 / 327** | **L** (≈455 / 348 net) |
| frame (line 0) | 22 / 29 | | | S (second resume through send → drive) |

### Totals

| | plaintext | json |
| --- | ---: | ---: |
| **S**: spawn 42 + done 181 + enter/leave 10 + region 94 + task entry 36 + 1464 line 13 + taskId 22 + wake 21 + await 5 | **424** | **426** |
| **L**: request copy (378), answer copy + type by text (124), slot claim / queue / free / serveAnswer (217), routing `begin` + `Router.match` − explicit `answer` (455 / 348), `enqueue` (75), send extras: live/conn 39, clock 23, copyBytes 43, re-drive 8, finish 8, respond +24 | **≈1,394** | **≈1,290** |
| shared slot-recycle loop (S + L) | 65 | 66 |
| left over: frame spills, `drive` re-entry, json's extra `next` pass, rounding | ≈170 | ≈640 |

Json's leftover is larger because async `drive` reaches `next` twice per request (2.00× against plaintext's 1.07×), and `serveOn`'s readable/feed branch (154 self) inlines differently from explicit's loop. Those lines are matched only at the frame level. The clock reads add up to 3.02 per request async against 2.00 explicit, so the only extra read is `send`'s.

### `/queries?queries=20` at c=64: the −9.3% of #1608 does not reproduce

`run.sh --only db --rounds 1 --duration 6` ran on main (2763199c) and on #1601's parent (7699d971), interleaved, three times each, in this container. The duration was cut from 10 s to 6 s because one 10 s round per head does not fit the 10-minute foreground limit. Async-db figures, req/s:

| round | main | 7699d971 | main / old |
| --- | ---: | ---: | ---: |
| 1 | 26,352 | 26,812 | −1.7% |
| 2 | 30,242 | 24,399 | +23.9% |
| 3 | 27,730 | 28,162 | −1.5% |
| **median** | **27,730** | **26,812** | **+3.4%** |
| VmHWM, MiB | 25.0 / 26.6 / 25.4 | 25.4 / 25.9 / 25.3 | |

The same runs' own noise band (`|db-entry − db-entry-copy|` at c=64, the same binary built twice) was 9.4 / 5.5 / 5.3% on main and 8.5 / 10.6 / 3.9% on the old head. #1608's −9.3% sits inside that band, and the medians move the other way. **No frame grew.** No callgrind run per /queries request was needed, and there is no fix PR.

### Upper bounds on paper (Ir/req saved; plaintext / json; share of the gap)

- **(a) inline start + detach on first suspend.** It removes spawn, done (including its region reset), the inlined executor and region enter/leave, the coroutine entry, the 1464 call, the wake, and the slot-recycle work tied to the task. That is 42 + 181 + 10 + 94 + 36 + 13 + 21 + 65 = **≤ 462 / 465** (22% / 19% of the gap; 7.3% / 5.7% of async's total). That is the ceiling only if a non-suspending handler needs no region at all. If it keeps the region reset, subtract 114.
- **(b) a library cut of `ServeConns.send`/`drive`.** It removes the send extras (connection/live 39, per-response clock 23, `copyBytes` 43, re-drive 8, finish 8, respond 24), `enqueue` (75) and the `drive` frame (22 / 29). That gives **≤ 242 / 249**. Adding routing to that cut (`Router.match` against explicit's `methodIs`/`targetIs`) adds 455 / 348, for **≤ 697 / 597** (34% / 25%).
- **(c) the request record held only between parse and copy.** It removes the request copy: 245 self, plus `HttpRequest` construction 65, two memsets 38 and the head memcpy 30. That is **≤ 378 / 377** (18% / 16%). It does not remove the answer copy or the type lookup by text (124).

The three bounds overlap only in the slot-record lines. Their sum, ≈1,537 / 1,439, leaves ≈517 / 986 Ir/req that no spike reaches: slot claim/queue/serveAnswer (217), the answer copy and type lookup (124), and json's second `next` pass and its differently inlined readable path.
