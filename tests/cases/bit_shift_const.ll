define internal noundef i32 @byThree(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 3
  ret i32 %0
}

define internal noundef i32 @byThirtyTwo(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 0
  ret i32 %0
}

define internal noundef i32 @byThirtyThree(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 1
  ret i32 %0
}

define internal noundef i32 @byMinusOne(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 31
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @byThree(i32 1)
  %1 = call i32 @byThirtyTwo(i32 7)
  %2 = add nsw i32 %0, %1
  %3 = call i32 @byThirtyThree(i32 1)
  %4 = add nsw i32 %2, %3
  %5 = call i32 @byMinusOne(i32 1)
  %6 = add nsw i32 %4, %5
  ret i32 %6
}

attributes #0 = { nounwind willreturn readnone }
