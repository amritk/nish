// Hand x86-64 bcrypt BF_body for W lanes (W <= 6), fully unrolled rounds, no spills.
// VARIANT=bmi2 uses rorx; VARIANT=base uses mov+shr / mov+movzx-high.
const W = Number(process.argv[2]), V = process.argv[3]
const L = ["ebx", "edx", "esi", "ebp", "r8d", "r9d"], Lb = ["bl", "dl", "sil", "bpl", "r8b", "r9b"]
const R = ["r10d", "r11d", "r12d", "r13d", "r14d", "r15d"], Rb = ["r10b", "r11b", "r12b", "r13b", "r14b", "r15b"]
const o = []
const S = 4168
const LOOP = process.env.LOOP === "1"
const P = (k, n) => LOOP ? `[rdi + r9*4 + ${S * k + 4 * (n % 2 ? 0 : 1)}]` : `[rdi + ${S * k + 4 * n}]`
const half = (x, xb, y, k, n) => {
  if (V === "nohbase") {
    o.push(`mov ecx, ${x}`, `shr ecx, 24`, `mov ecx, [rdi + rcx*4 + ${S * k + 72}]`, `mov eax, ${x}`, `shr eax, 16`, `movzx eax, al`, `add ecx, [rdi + rax*4 + ${S * k + 1096}]`,
      `mov eax, ${x}`, `shr eax, 8`, `movzx eax, al`, `xor ecx, [rdi + rax*4 + ${S * k + 2120}]`, `movzx eax, ${xb}`, `add ecx, [rdi + rax*4 + ${S * k + 3144}]`, `xor ${y}, ${P(k, n)}`, `xor ${y}, ecx`)
    return
  }
  if (V === "noh") {
    o.push(`mov ecx, ${x}`, `shr ecx, 24`, `mov ecx, [rdi + rcx*4 + ${S * k + 72}]`, `rorx eax, ${x}, 16`, `movzx eax, al`, `add ecx, [rdi + rax*4 + ${S * k + 1096}]`,
      `rorx eax, ${x}, 8`, `movzx eax, al`, `xor ecx, [rdi + rax*4 + ${S * k + 2120}]`, `movzx eax, ${xb}`, `add ecx, [rdi + rax*4 + ${S * k + 3144}]`, `xor ${y}, ${P(k, n)}`, `xor ${y}, ecx`)
    return
  }
  if (V === "bmi2") o.push(`rorx eax, ${x}, 16`)
  else o.push(`mov eax, ${x}`, `shr eax, 16`)
  o.push(`movzx ecx, ah`, `mov ecx, [rdi + rcx*4 + ${S * k + 72}]`, `movzx eax, al`, `add ecx, [rdi + rax*4 + ${S * k + 1096}]`)
  if (V === "bmi2") o.push(`rorx eax, ${x}, 8`, `movzx eax, al`)
  else o.push(`mov eax, ${x}`, `movzx eax, ah`)
  o.push(`xor ecx, [rdi + rax*4 + ${S * k + 2120}]`, `movzx eax, ${xb}`, `add ecx, [rdi + rax*4 + ${S * k + 3144}]`)
  o.push(`xor ${y}, ${P(k, n)}`, `xor ${y}, ecx`)
}
o.push(".intel_syntax noprefix", ".text", `.globl body_hand`, `body_hand:`, "push rbx", "push rbp", "push r12", "push r13", "push r14", "push r15", "sub rsp, 8")
for (let k = 0; k < W; k++) o.push(`xor ${L[k]}, ${L[k]}`, `xor ${R[k]}, ${R[k]}`)
o.push("mov qword ptr [rsp], 0", ".Lblock:")
for (let k = 0; k < W; k++) o.push(`xor ${L[k]}, [rdi + ${S * k}]`)
if (LOOP) { o.push("mov r9d, 1", ".Lround:"); for (let k = 0; k < W; k++) half(L[k], Lb[k], R[k], k, 1); for (let k = 0; k < W; k++) half(R[k], Rb[k], L[k], k, 2); o.push("add r9d, 2", "cmp r9d, 17", "jb .Lround") }
else for (let n = 1; n < 17; n += 2) {
  for (let k = 0; k < W; k++) half(L[k], Lb[k], R[k], k, n)
  for (let k = 0; k < W; k++) half(R[k], Rb[k], L[k], k, n + 1)
}
o.push("mov rcx, [rsp]")
for (let k = 0; k < W; k++) {
  o.push(`xor ${R[k]}, [rdi + ${S * k + 68}]`, `mov [rdi + rcx*4 + ${S * k}], ${R[k]}`, `mov [rdi + rcx*4 + ${S * k + 4}], ${L[k]}`)
  o.push(`mov eax, ${L[k]}`, `mov ${L[k]}, ${R[k]}`, `mov ${R[k]}, eax`)
}
o.push("add rcx, 2", "mov [rsp], rcx", "cmp rcx, 1042", "jb .Lblock")
o.push("add rsp, 8", "pop r15", "pop r14", "pop r13", "pop r12", "pop rbp", "pop rbx", "ret", '.section .note.GNU-stack,"",@progbits')
console.log(o.join("\n"))
