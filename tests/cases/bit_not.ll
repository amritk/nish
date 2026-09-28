define internal noundef i32 @invert32(i32 noundef %a) #0 {
entry:
  %0 = xor i32 %a, -1
  ret i32 %0
}

define internal noundef i64 @invert64(i64 noundef %a) #0 {
entry:
  %0 = xor i64 %a, -1
  ret i64 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @invert32(i32 0)
  %1 = call i32 @invert32(i32 5)
  %2 = add nsw i32 %0, %1
  %3 = call i64 @invert64(i64 -1)
  %4 = trunc i64 %3 to i32
  %5 = add nsw i32 %2, %4
  ret i32 %5
}

attributes #0 = { nounwind willreturn readnone }
