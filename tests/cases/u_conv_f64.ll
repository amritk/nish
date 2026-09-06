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

attributes #0 = { nounwind willreturn readnone }
