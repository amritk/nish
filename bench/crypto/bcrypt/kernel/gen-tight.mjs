// Writes `body_hand` (as kernel/gen.mjs does, for kernel/harness.c) in the two
// tightest ways of taking a half-round's index bytes that the
// multicore-server-challenge's leading entries use. Only the ideas are taken;
// the assembly is written here:
//   shrx   11 instructions a lane half-round, BMI2. One `rorx x, 8` gives
//          bytes 2 and 1 as ah and al, `shrx` by a count held in ecx gives
//          byte 3 without a copy, and every S-box and P word is read as
//          rdi + index*4 + a fixed displacement. The idea of
//          submissions/zig-iouring-nick-potts (src/bcrypt/asm_gen.zig, its
//          `shrx` style), which rust-epoll-theCatWisel's build.rs also
//          generates. Five lanes at most: eax, ecx, edx, esi, rdi and ten
//          halves are the 15 registers.
//   dh     12 instructions, baseline x86-64. One copy of x into edx gives byte
//          1 as dh, then `shr edx, 16` byte 2 as dl and `shr edx, 8` byte 3:
//          the idea of submissions/asm-epoll-nickita-khylkouski (src/bcrypt.s,
//          its FF macro). Up to five lanes read the state in place through
//          rdi; six copy it to the stack and read it through rsp, as that
//          entry keeps its contexts on the stack, so twelve halves, eax, ecx
//          and edx are the 16 registers and the block counter is a stack word.
// Both write the 8 round pairs out, so P is read at constant offsets, and
// keep every lane's halves in registers.
//
// Usage: node bench/crypto/bcrypt/kernel/gen-tight.mjs <width> <variant> > kernel.s
export const TIGHT_VARIANTS = ["shrx", "dh"]

/** Whether `variant` has a kernel of `width` lanes. */
export const tightFits = (width, variant) =>
  Number.isInteger(width) && width >= 1 && width <= (variant === "shrx" ? 5 : 6)

const WORDS = 1042
const STRIDE = WORDS * 4
// rsp-based frame: the block counter at [rsp], the caller's rsp at [rsp + 8]
// and the state pointer at [rsp + 16]; the lanes from FRAME on.
const FRAME = 64

const low = (r) => ({ ebx: "bl", ebp: "bpl", edi: "dil", esi: "sil" })[r] ?? r.replace(/d$/, "b")

/** The assembly of `body_hand` for `width` lanes in `variant`. */
export const tightKernel = (width, variant) => {
  if (!TIGHT_VARIANTS.includes(variant) || !tightFits(width, variant)) {
    throw new Error(`no kernel for width ${width}, variant ${variant}`)
  }
  const onStack = variant === "dh" && width === 6
  const base = onStack ? "rsp" : "rdi"
  const [L, R] =
    variant === "shrx"
      ? [
          ["ebx", "r8d", "r10d", "r12d", "r14d"],
          ["ebp", "r9d", "r11d", "r13d", "r15d"],
        ]
      : [
          ["r8d", "r9d", "r10d", "r11d", "ebx", "edi"],
          ["r12d", "r13d", "r14d", "r15d", "ebp", "esi"],
        ]
  const at = (k) => (onStack ? FRAME : 0) + k * STRIDE
  const o = []
  const half = (x, y, k, n) => {
    const s = at(k) + 72
    o.push(`xor ${y}, dword ptr [${base} + ${at(k) + 4 * n}]`)
    if (variant === "shrx") {
      o.push(
        `shrx esi, ${x}, ecx`,
        `mov edx, dword ptr [rdi + rsi*4 + ${s}]`,
        `rorx eax, ${x}, 8`,
        "movzx esi, ah",
        `add edx, dword ptr [rdi + rsi*4 + ${s + 1024}]`,
        "movzx esi, al",
        `xor edx, dword ptr [rdi + rsi*4 + ${s + 2048}]`,
        `movzx esi, ${low(x)}`,
        `add edx, dword ptr [rdi + rsi*4 + ${s + 3072}]`
      )
    } else {
      o.push(
        `mov edx, ${x}`,
        "movzx ecx, dh",
        "shr edx, 16",
        "movzx eax, dl",
        "shr edx, 8",
        `mov edx, dword ptr [${base} + rdx*4 + ${s}]`,
        `add edx, dword ptr [${base} + rax*4 + ${s + 1024}]`,
        `xor edx, dword ptr [${base} + rcx*4 + ${s + 2048}]`,
        `movzx ecx, ${low(x)}`,
        `add edx, dword ptr [${base} + rcx*4 + ${s + 3072}]`
      )
    }
    o.push(`xor ${y}, edx`)
  }
  const lanes = [...Array(width).keys()]
  o.push(".intel_syntax noprefix", ".text", ".globl body_hand", ".p2align 6", "body_hand:")
  o.push("push rbx", "push rbp", "push r12", "push r13", "push r14", "push r15")
  if (onStack) {
    o.push("mov rax, rsp", `sub rsp, ${FRAME + width * STRIDE + 64}`, "and rsp, -64")
    o.push("mov [rsp + 8], rax", "mov [rsp + 16], rdi", "mov rsi, rdi")
    for (const k of lanes) {
      o.push(`lea rdi, [rsp + ${at(k)}]`, `mov ecx, ${WORDS}`, "rep movsd")
    }
  } else {
    o.push("sub rsp, 8")
  }
  if (variant === "shrx") {
    o.push("mov ecx, 24")
  }
  o.push("mov qword ptr [rsp], 0")
  for (const k of lanes) {
    o.push(`xor ${L[k]}, ${L[k]}`, `xor ${R[k]}, ${R[k]}`)
  }
  o.push(".p2align 4", ".Lblock:")
  for (const k of lanes) {
    o.push(`xor ${L[k]}, dword ptr [${base} + ${at(k)}]`)
  }
  for (let n = 1; n < 17; n += 2) {
    for (const k of lanes) {
      half(L[k], R[k], k, n)
    }
    for (const k of lanes) {
      half(R[k], L[k], k, n + 1)
    }
  }
  // The block (r ^ P[17], l) over words 2j and 2j + 1, then the halves swapped.
  const j = variant === "shrx" ? "rsi" : "rax"
  o.push(`mov ${j}, qword ptr [rsp]`)
  for (const k of lanes) {
    o.push(
      `xor ${R[k]}, dword ptr [${base} + ${at(k) + 68}]`,
      `mov dword ptr [${base} + ${j}*8 + ${at(k)}], ${R[k]}`,
      `mov dword ptr [${base} + ${j}*8 + ${at(k) + 4}], ${L[k]}`,
      `mov edx, ${L[k]}`,
      `mov ${L[k]}, ${R[k]}`,
      `mov ${R[k]}, edx`
    )
  }
  o.push(`add ${j}, 1`, `mov qword ptr [rsp], ${j}`, `cmp ${j}, ${WORDS / 2}`, "jb .Lblock")
  if (onStack) {
    // The lanes are contiguous in the caller's state, so one destination walks them all.
    o.push("mov rdi, [rsp + 16]")
    for (const k of lanes) {
      o.push(`lea rsi, [rsp + ${at(k)}]`, `mov ecx, ${WORDS}`, "rep movsd")
    }
    o.push("mov rsp, [rsp + 8]")
  } else {
    o.push("add rsp, 8")
  }
  o.push("pop r15", "pop r14", "pop r13", "pop r12", "pop rbp", "pop rbx", "ret")
  o.push('.section .note.GNU-stack,"",@progbits')
  return `${o.join("\n")}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(tightKernel(Number(process.argv[2]), process.argv[3]))
}
