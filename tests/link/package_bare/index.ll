declare noundef i32 @pkg_bare.twice(i32 noundef) #1

define internal noundef i32 @pkg_bare.helper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define noundef i32 @pkg_bare.scale(i32 noundef %n) #1 {
entry:
  %0 = call i32 @pkg_bare.helper(i32 %n)
  %1 = tail call i32 @pkg_bare.twice(i32 %0)
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
