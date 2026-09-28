define internal noundef i32 @mix(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = and i32 %a, %b
  %1 = or i32 %a, %b
  %2 = add nsw i32 %0, %1
  %3 = xor i32 %a, %b
  %4 = add nsw i32 %2, %3
  ret i32 %4
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @mix(i32 12, i32 10)
  %1 = call i32 @mix(i32 -1, i32 255)
  %2 = add nsw i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
