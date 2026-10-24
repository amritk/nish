define internal noundef i32 @hashStep(i32 noundef %h, i32 noundef %byte) #0 {
entry:
  %0 = xor i32 %h, %byte
  %1 = shl i32 %0, 5
  %2 = lshr i32 %h, 27
  %3 = or i32 %1, %2
  ret i32 %3
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @hashStep(i32 7, i32 3)
  %1 = and i32 %0, 1023
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
