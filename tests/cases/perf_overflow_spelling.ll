define noundef i32 @test() #0 {
entry:
  %hexShift.addr = alloca i32, align 4
  %0 = shl i32 1, 0
  store i32 %0, i32* %hexShift.addr, align 4
  %1 = load i32, i32* %hexShift.addr, align 4
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }
