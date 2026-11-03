// Writes a hand-scheduled x86-64 bcrypt cost-loop body (`body_hand`, GNU as,
// Intel syntax) for `width` lanes, 1 to 6: the ceiling `ceiling.mjs` times
// Nish's `bcryptBodyN` against. It does what `bcryptBodyN` does to the same
// state (slot k's P[18] and S[4][256] at word 1042k, the 521 blocks
// re-encrypted in place), with nothing spilled: each lane's l and r live in
// registers for the whole body, the 8 round pairs are written out so P is
// read at constant offsets, and the block counter alone sits on the stack.
//
// One half-round of one lane is y ^= P[n] ^ F(x), F(x) = ((S0[x >> 24] +
// S1[x >> 16 & 0xff]) ^ S2[x >> 8 & 0xff]) + S3[x & 0xff]. The variants differ
// only in how F's four index bytes are taken out of x:
//   base-shr   each byte from a copy of x shifted down (mov + shr) and movzx
//   base-ah    mov + shr 16, then movzx of ah and al; byte 1 as x's own ah
//   rorx-shr   base-shr with BMI2's rorx for the two middle bytes' copy + shift
//   rorx-ah    base-ah with rorx for the shifted copies
// The base variants use only x86-64 baseline instructions.
//
// Usage: node bench/crypto/bcrypt/kernel/gen.mjs <width> <variant> > kernel.s
export const VARIANTS = ["base-shr", "base-ah", "rorx-shr", "rorx-ah"]

/** The assembly of `body_hand` for `width` lanes in `variant`. */
export const kernel = (width, variant) => {
  if (!Number.isInteger(width) || width < 1 || width > 6 || !VARIANTS.includes(variant)) {
    throw new Error(`no kernel for width ${width}, variant ${variant}`)
  }
  // l and r of lane k; rdi is the state, eax and ecx the scratch.
  const L = ["ebx", "edx", "esi", "ebp", "r8d", "r9d"]
  const Lb = ["bl", "dl", "sil", "bpl", "r8b", "r9b"]
  const R = ["r10d", "r11d", "r12d", "r13d", "r14d", "r15d"]
  const Rb = ["r10b", "r11b", "r12b", "r13b", "r14b", "r15b"]
  const slot = 4168
  const o = []
  const half = (x, xb, y, k, n) => {
    const s0 = `[rdi + rcx*4 + ${slot * k + 72}]`
    const s1 = `[rdi + rax*4 + ${slot * k + 1096}]`
    const s2 = `[rdi + rax*4 + ${slot * k + 2120}]`
    const s3 = `[rdi + rax*4 + ${slot * k + 3144}]`
    const byShift = variant.endsWith("-shr")
    const rorx = variant.startsWith("rorx")
    if (byShift) {
      // Byte 3 by mov + shr 24; bytes 2 and 1 each by a copy shifted down
      // (rorx, or mov + shr) and movzx of its low byte.
      o.push(`mov ecx, ${x}`, "shr ecx, 24", `mov ecx, ${s0}`)
      o.push(
        ...(rorx ? [`rorx eax, ${x}, 16`] : [`mov eax, ${x}`, "shr eax, 16"]),
        "movzx eax, al",
        `add ecx, ${s1}`
      )
      o.push(
        ...(rorx ? [`rorx eax, ${x}, 8`] : [`mov eax, ${x}`, "shr eax, 8"]),
        "movzx eax, al",
        `xor ecx, ${s2}`
      )
    } else {
      // x >> 16 (rorx, or mov + shr) leaves byte 3 in ah and byte 2 in al;
      // byte 1 is then the ah of x itself (rorx-ah: rorx 8 and its al).
      o.push(
        ...(rorx ? [`rorx eax, ${x}, 16`] : [`mov eax, ${x}`, "shr eax, 16"]),
        "movzx ecx, ah",
        `mov ecx, ${s0}`
      )
      o.push("movzx eax, al", `add ecx, ${s1}`)
      o.push(
        ...(rorx ? [`rorx eax, ${x}, 8`, "movzx eax, al"] : [`mov eax, ${x}`, "movzx eax, ah"]),
        `xor ecx, ${s2}`
      )
    }
    o.push(`movzx eax, ${xb}`, `add ecx, ${s3}`)
    // P[n] first, off the chain, as `bcryptBodyN` orders it.
    o.push(`xor ${y}, [rdi + ${slot * k + 4 * n}]`, `xor ${y}, ecx`)
  }
  const lanes = [...Array(width).keys()]
  o.push(".intel_syntax noprefix", ".text", ".globl body_hand", "body_hand:")
  o.push("push rbx", "push rbp", "push r12", "push r13", "push r14", "push r15", "sub rsp, 8")
  for (const k of lanes) {
    o.push(`xor ${L[k]}, ${L[k]}`, `xor ${R[k]}, ${R[k]}`)
  }
  o.push("mov qword ptr [rsp], 0", ".Lblock:")
  for (const k of lanes) {
    o.push(`xor ${L[k]}, [rdi + ${slot * k}]`)
  }
  for (let n = 1; n < 17; n += 2) {
    for (const k of lanes) {
      half(L[k], Lb[k], R[k], k, n)
    }
    for (const k of lanes) {
      half(R[k], Rb[k], L[k], k, n + 1)
    }
  }
  o.push("mov rcx, [rsp]")
  for (const k of lanes) {
    const s = slot * k
    o.push(
      `xor ${R[k]}, [rdi + ${s + 68}]`,
      `mov [rdi + rcx*4 + ${s}], ${R[k]}`,
      `mov [rdi + rcx*4 + ${s + 4}], ${L[k]}`
    )
    o.push(`mov eax, ${L[k]}`, `mov ${L[k]}, ${R[k]}`, `mov ${R[k]}, eax`)
  }
  o.push("add rcx, 2", "mov [rsp], rcx", "cmp rcx, 1042", "jb .Lblock")
  o.push("add rsp, 8", "pop r15", "pop r14", "pop r13", "pop r12", "pop rbp", "pop rbx", "ret")
  o.push('.section .note.GNU-stack,"",@progbits')
  return `${o.join("\n")}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(kernel(Number(process.argv[2]), process.argv[3]))
}
