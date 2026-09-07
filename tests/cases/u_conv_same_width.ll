define noundef i32 @asUnsigned(i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define noundef i64 @asSigned(i64 noundef %x) #0 {
entry:
  ret i64 %x
}

attributes #0 = { nounwind willreturn readnone }
