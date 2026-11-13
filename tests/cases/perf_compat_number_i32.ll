define internal noundef i32 @scale(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 3
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = tail call i32 @scale(i32 14)
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!nish.compat = !{!5}
!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
!5 = !{!"i32"}
