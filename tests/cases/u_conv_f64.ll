declare i8 @llvm.fptoui.sat.i8.f64(double) #0
declare i32 @llvm.fptoui.sat.i32.f64(double) #0

define noundef double @toDouble(i32 noundef %x) #0 {
entry:
  %0 = uitofp i32 %x to double
  ret double %0
}

define noundef i32 @fromDouble(double noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptoui.sat.i32.f64(double %x)
  ret i32 %0
}

define noundef i8 @byteFromDouble(double noundef %x) #0 {
entry:
  %0 = call i8 @llvm.fptoui.sat.i8.f64(double %x)
  ret i8 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
