define noundef i32 @test() #0 {
entry:
  %wrapped.addr = alloca i32, align 4
  %0 = add i32 2147483647, 1
  store i32 %0, i32* %wrapped.addr, align 4
  %1 = load i32, i32* %wrapped.addr, align 4
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
