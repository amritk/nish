define noundef float @tenth() #0 {
entry:
  ret float 0x3FB99999A0000000
}

define noundef double @tenthF64() #0 {
entry:
  ret double 0x3FB999999999999A
}

define noundef float @one() #0 {
entry:
  ret float 0x3FF0000000000000
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
