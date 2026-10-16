define noundef double @doubled(double noundef %x) #0 {
entry:
  %0 = fmul double %x, 0x4000000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
