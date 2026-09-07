define noundef float @arith(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fadd float %a, %b
  %1 = fsub float %a, %b
  %2 = fmul float %0, %1
  %3 = fdiv float %2, %b
  ret float %3
}

define noundef float @rem(float noundef %a, float noundef %b) #0 {
entry:
  %0 = frem float %a, %b
  ret float %0
}

define noundef zeroext i1 @cmp(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fcmp olt float %a, %b
  ret i1 %0
}

define noundef float @neg(float noundef %a) #0 {
entry:
  %0 = fneg float %a
  ret float %0
}

attributes #0 = { nounwind willreturn readnone }
