@nish_errno_slot = external thread_local(initialexec) global i32, align 4

declare i32 @set_errno_to(i32)
declare nonnull i32* @nish_errno_ptr() #2

define noundef i32 @stage(i32 noundef %e) #0 {
entry:
  %0 = call i32* @nish_errno_ptr()
  store i32 0, i32* %0, align 4
  %1 = call i32 @set_errno_to(i32 %e)
  %2 = load i32, i32* %0, align 4
  store i32 %2, i32* @nish_errno_slot, align 4
  ret i32 %1
}

define noundef i32 @readErrno() #1 {
entry:
  %0 = load i32, i32* @nish_errno_slot, align 4
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
