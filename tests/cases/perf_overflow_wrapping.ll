define noundef i32 @test() #0 {
entry:
  %wrapped.addr = alloca i32, align 4
  %0 = add i32 2147483647, 1
  store i32 %0, i32* %wrapped.addr, align 4
  %1 = load i32, i32* %wrapped.addr, align 4
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }
