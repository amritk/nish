define internal noundef i32 @inner() #0 {
entry:
  ret i32 1
}

define noundef i32 @test() #0 {
entry:
  %N.addr = alloca i32, align 4
  store i32 2, i32* %N.addr, align 4
  %0 = load i32, i32* %N.addr, align 4
  %1 = mul nsw i32 %0, 10
  %2 = call i32 @inner()
  %3 = add nsw i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
