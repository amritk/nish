define internal noundef i32 @shiftLeft(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = shl i32 %a, %0
  ret i32 %1
}

define internal noundef i32 @shiftRight(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = ashr i32 %a, %0
  ret i32 %1
}

define internal noundef i32 @shiftRightUnsigned(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = lshr i32 %a, %0
  ret i32 %1
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @shiftLeft(i32 1, i32 4)
  %1 = call i32 @shiftRight(i32 -16, i32 2)
  %2 = add nsw i32 %0, %1
  %3 = call i32 @shiftRightUnsigned(i32 -1, i32 28)
  %4 = add nsw i32 %2, %3
  %5 = call i32 @shiftLeft(i32 7, i32 32)
  %6 = add nsw i32 %4, %5
  ret i32 %6
}

attributes #0 = { nounwind willreturn readnone }
