declare i32 @llvm.fptosi.sat.i32.f32(float) #0
declare i32 @llvm.fptoui.sat.i32.f32(float) #0

define noundef float @narrow(double noundef %x) #0 {
entry:
  %0 = fptrunc double %x to float
  ret float %0
}

define noundef double @widen(float noundef %x) #0 {
entry:
  %0 = fpext float %x to double
  ret double %0
}

define noundef float @fromSigned(i32 noundef %i) #0 {
entry:
  %0 = sitofp i32 %i to float
  ret float %0
}

define noundef float @fromUnsigned(i32 noundef %u) #0 {
entry:
  %0 = uitofp i32 %u to float
  ret float %0
}

define noundef i32 @toSigned(float noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptosi.sat.i32.f32(float %x)
  ret i32 %0
}

define noundef i32 @toUnsigned(float noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptoui.sat.i32.f32(float %x)
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
