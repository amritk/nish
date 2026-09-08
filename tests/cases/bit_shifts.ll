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
  %1 = sub nsw i32 0, 16
  %2 = call i32 @shiftRight(i32 %1, i32 2)
  %3 = add nsw i32 %0, %2
  %4 = sub nsw i32 0, 1
  %5 = call i32 @shiftRightUnsigned(i32 %4, i32 28)
  %6 = add nsw i32 %3, %5
  %7 = call i32 @shiftLeft(i32 7, i32 32)
  %8 = add nsw i32 %6, %7
  ret i32 %8
}

attributes #0 = { nounwind willreturn readnone }
