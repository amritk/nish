define noundef double @halve(double noundef %x) #0 {
entry:
  %0 = fdiv double %x, 0x4004000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
