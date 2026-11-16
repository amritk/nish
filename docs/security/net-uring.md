# Security record: the io_uring ring layer

The record of `runtime/runtime-uring.c`, the io_uring rings that WP63 puts
under `nish:net`: one accepting job spread over a set of rings, each ring
holding up to `slots` connections as direct descriptors, a provided-buffer
ring for receives, and queued sends. Every byte a connection carries comes
from a remote peer, and every completion the layer reads comes from the
kernel's shared rings, so both are attacker-facing.

It says what is checked, what each failure answers, and the test that pins
each answer. The design is
[`wp63-iouring-net.md`](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md).
It was written on top of `main` at `307dcca`, in the change that adds the
layer (WP63 S1), and names functions rather than lines, so it has no
`file:line` anchors to move. In this stage nothing in `nish:net` calls the
layer: it is linked into every Linux runtime and reached only by its C test.

**Result.** No completion the kernel writes and no byte or reset a peer
sends can make the layer index outside its tables: an accepted slot, a
buffer id and a receive's slot are each checked against the size the set was
made with, and a completion for a slot closed since is recognised by its
generation and only gives back its buffer. A slot handle a caller passes is
checked before use and answers `-EBADF`. A double free a peer could cause by
resetting a connection during a send (NURING-1) was found in review and
fixed before landing. One finding is open: queued sends to a peer that never
reads are not bounded (NURING-2), which S2's surface must bound. Five
findings (NURING-1 to NURING-5): one fixed, one open, three decided.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-uring.c` | the probe (`nish_uring_probe`, `ur_probe_once`, `ur_setup_flags`); the set and its rings (`nish_uring_open` and its option checks, `ur_add_ring`, `ur_free_ring`, `nish_uring_destroy`); the accepting job (`ur_top_up`); completions (`ur_complete`, `ur_reap`, `ur_service`, `ur_catch_up`, `nish_uring_wait`); receives and buffers (`ur_arm`, `ur_recycle`); sends (`nish_uring_send`, `ur_send_head`, `ur_drop_sends`, `ur_unlink_all`); slots (`ur_open_slot`, `nish_uring_close`); and the stubs a native build off Linux links (a wasm build compiles none of the file) |
| `tests/runtime/uring-test.c` | the test: an echo server on the layer in a forked child, driven by plain-socket clients, one mode a check |

Out of scope: `runtime/runtime-net.c`, whose epoll path does not call the
layer, and `bench/fd-limit/`, the prototype the design measured. The rule for
rings under `--sandbox` is S3's and lands with `sandbox.md`.

## Threat model

**Who is trusted.** The program's own code, the person who runs it, and the
kernel. The layer reads the kernel's completion queue as input and checks the
indices in it, but a kernel that lies about which buffer it filled is not an
adversary this record defends against.

**Who is the adversary.** A remote peer, or many of them. A peer can open
connections at any rate, up to and past the process's descriptor limit; send
any bytes in any split; stop reading; and close or reset at any moment,
including while a receive or a send for its connection is in the kernel. Its
aim is to make the layer read or write outside its tables or buffers, free a
record twice, hand one connection's bytes to another, or stop it accepting.

**What is not claimed.** How many connections a peer may hold, and for how
long, is the server's policy, not the layer's: the layer holds what fits in
its slots and stops accepting while they are full. The bytes are not
authenticated or encrypted; that is TLS's job, above this.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| NURING-1 | High | `runtime/runtime-uring.c` (`ur_complete`) | A send that failed for good (a peer's reset answers `-ECONNRESET` or `-EPIPE`) cleared the record's in-flight mark and then called `ur_drop_sends`, which frees every queued record that is not in flight, the failed one included, and then freed the record a second time with `ur_unlink_all`. A peer could cause it by resetting while a large send was in the kernel: heap corruption from the network. | **Fixed before landing**: the second free is gone, and `ur_drop_sends` frees the record with the rest of the slot's queue. Before: the "reset" mode's server died of a signal (glibc's double-free abort) on every run. After: "uring: runtime-uring.c reset: a send the peer resets fails once as SEND_FAILED, and its record is freed once". |
| NURING-2 | Low | `runtime/runtime-uring.c` (`nish_uring_send`) | Each send copies its bytes into a record that is queued until the kernel takes them. A peer that never reads leaves every later send for its slot queued, so a server that keeps answering it grows without bound. | **Open**, for S2: the layer reports nothing a caller could use as backpressure, and `nish:net`'s surface must bound the bytes queued per connection, or expose them, before a program can reach the layer. Tracked in #1648. |
| NURING-3 | Low | `runtime/runtime-uring.c` (`ur_complete`, `nish_uring_wait`) | A DATA event's bytes are the provided buffer the kernel filled, lent, not copied: they are given back to the kernel at the start of the next `nish_uring_wait`, and a caller that keeps the pointer past it reads bytes another connection's receive may have written. | **Decided.** The copy would cost every receive; the contract is in the header comment ("valid until the next wait"), and S2's surface copies the bytes into the program's array before the next wait. |
| NURING-4 | Low | `runtime/runtime-uring.c` (`ur_tag`, `nish_uring_close`) | A slot's generation is 24 bits, so a recv's completion that arrives after 2^24 closes of the same slot would match a newer connection's generation. | **Decided.** `nish_uring_close` cancels the slot's recv before it closes it, in the same submission, so no recv of the slot outlives the close by more than one completion; 2^24 closes and re-accepts of one slot in that window cannot happen. |
| NURING-5 | Low | `runtime/runtime-uring.c` (`ur_complete`) | A send the kernel answers with 0 bytes, for a record with bytes left, is taken as complete, and the bytes left are not sent. | **Decided.** A stream socket's send does not answer 0 for a non-empty buffer; re-arming on 0 would spin on a kernel that did. The connection's next send or recv reports any real failure. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
tests are the modes of `tests/runtime/uring-test.c`, run by `tests/run.js`'s
`uring` section, each as one check: "uring: tests/runtime/uring-test.c
compiles with runtime-uring.c under -Werror", then "uring: runtime-uring.c
${mode}: ${what}". Each mode's server also requires that its set ends with no
live connection, no bound violation and no accept error, and that `destroy`
closes every descriptor the set opened. A mode that needs io_uring skips
where the probe says it is refused.

- **Past the descriptor limit.** "uring: runtime-uring.c beyond: 3,000
  connections held at once under RLIMIT_NOFILE 1,024, in three rings, fewer
  than 64 descriptors": the direct descriptors are not in the process's
  table, and a full ring opens the next one.
- **The accept bound.** "uring: runtime-uring.c bound: a full one-ring set
  of 8 slots serves 50 clients and drops none (the accept bound)": the layer
  never has more accepts in the kernel than free slots, so an accept never
  lands past the table, and a closed slot goes back to the accepting job.
  An accepted slot at or past `slots` is counted as a bound violation, never
  used.
- **The kernel's re-entry flags.** "uring: runtime-uring.c taskrun: a burst
  of 500 over four rings completes, entering again while IORING_SQ_TASKRUN
  is up" and "uring: runtime-uring.c overflow: a CQ of 8 under 256 clients
  overflows and is drained": completions the kernel held back are taken, not
  lost.
- **Buffers run out.** "uring: runtime-uring.c nobufs: a recv that runs out
  of provided buffers is re-armed, not closed": a peer that fills every
  buffer delays the others' receives and closes nothing.
- **Sends.** "uring: runtime-uring.c short: an 8 MiB send the kernel takes
  short arrives whole and in order", and NURING-1's "reset" check.
- **Stale handles.** Every mode that closes a slot checks, once, that a send
  and a second close on the closed slot answer `-EBADF`.
- **Refused io_uring.** "uring: runtime-uring.c fallback: a seccomp-refused
  io_uring_setup or io_uring_register answers its errno, with no descriptor
  left": the probe and `nish_uring_open` answer the refusal, and the caller
  keeps the epoll path.
- **The unit builds into every runtime.** "runtime.c, runtime-os.c,
  runtime-text.c, runtime-parallel.c, runtime-cross.c, runtime-host.c,
  runtime-net.c, runtime-uring.c, runtime-simd.c, runtime-aes.c,
  runtime-sha256.c, runtime-chacha20.c, runtime-checksum.c, runtime-term.c,
  runtime-bytes.c, runtime-sandbox.c, runtime-shm.c and runtime-region.c
  compile warning-free together and pass the runtime unit test", and its
  `.text` budget, "runtime-uring.c: .text* at -Oz fits the 6144 byte
  budget".

## Notes

**The checks on the kernel's indices.** A receive's buffer id is checked
against `buf_count` before its buffer is touched, and a completion whose slot
is past `slots`, not open, or of an older generation only gives its buffer
back. These are cheap and keep a kernel bug from becoming a write outside
the buffer ring; they are not a defence against a hostile kernel.

**`destroy` with sends in flight.** `nish_uring_destroy` closes the rings
first, which cancels every request the kernel held, and then frees every
send record, in flight or not, and unmaps the buffers. Nothing can copy from
a freed record or into an unmapped buffer meanwhile: the rings are made with
`IORING_SETUP_DEFER_TASKRUN`, so a send or receive waiting on its socket is
retried only as task work on the thread that owns the ring, which is the one
running `destroy`. This rests on one assumption about the kernel: that
closing a ring cancels the task work still queued on it rather than running
it, from a fallback worker, after `close` returns. The code cannot show that
window closed on every kernel the probe accepts; S2, which makes `destroy`
reachable from a program, revisits it.

**Options.** `nish_uring_open` refuses a `buf_count` that is not a power of
two or is past 32,768, a `buf_size` past 1 MiB, a `rings_max` past 4,096
and `slots` past 2^20, with `-EINVAL`, before it maps anything.
