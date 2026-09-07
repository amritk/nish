define noundef i32 @hashStep(i32 noundef %h, i32 noundef %byte) #0 {
entry:
  %0 = xor i32 %h, %byte
  %1 = shl i32 %0, 5
  %2 = lshr i32 %h, 27
  %3 = or i32 %1, %2
  ret i32 %3
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @hashStep(i32 7, i32 3)
  %1 = and i32 %0, 1023
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }
