define noundef i32 @square(i32 noundef %n) #0 {
entry:
  %0 = mul i32 %n, %n
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
