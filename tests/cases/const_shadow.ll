define noundef i32 @inner() #0 {
entry:
  ret i32 1
}

define noundef i32 @test() #0 {
entry:
  %N.addr = alloca i32, align 4
  store i32 2, i32* %N.addr, align 4
  %0 = load i32, i32* %N.addr, align 4
  %1 = mul i32 %0, 10
  %2 = call i32 @inner()
  %3 = add i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone }
