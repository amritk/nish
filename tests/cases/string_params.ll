define internal noundef nonnull align 8 i8* @identity(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @pick(i1 noundef zeroext %flag, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @identity(i8* %a)
  ret i8* %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
