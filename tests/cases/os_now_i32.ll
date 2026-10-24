declare double @nish_date_now() #0

define noundef i32 @test() #0 {
entry:
  %t.addr = alloca double, align 8
  %0 = call double @nish_date_now()
  store double %0, double* %t.addr, align 8
  %1 = load double, double* %t.addr, align 8
  %2 = fcmp ogt double %1, 0x4278BCFE56800000
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  ret i32 %3
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
