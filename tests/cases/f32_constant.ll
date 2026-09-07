define noundef float @tenth() #0 {
entry:
  ret float 0x3FB99999A0000000
}

define noundef double @tenthF64() #0 {
entry:
  ret double 0x3FB999999999999A
}

define noundef float @one() #0 {
entry:
  ret float 0x3FF0000000000000
}

attributes #0 = { nounwind willreturn readnone }
