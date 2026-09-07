define noundef i32 @test() #0 {
entry:
  ret i32 -2147483648
}

attributes #0 = { nounwind willreturn readnone }
