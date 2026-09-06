define noundef i64 @mask(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = and i64 %a, %b
  %1 = xor i64 %a, %b
  %2 = or i64 %0, %1
  ret i64 %2
}

define noundef i64 @shift(i64 noundef %a, i64 noundef %n) #0 {
entry:
  %0 = and i64 %n, 63
  %1 = shl i64 %a, %0
  %2 = ashr i64 %a, 4
  %3 = add i64 %1, %2
  %4 = lshr i64 %a, 1
  %5 = add i64 %3, %4
  ret i64 %5
}

define noundef i32 @test() #0 {
entry:
  %0 = call i64 @mask(i64 255, i64 15)
  %1 = trunc i64 %0 to i32
  %2 = call i64 @shift(i64 1024, i64 3)
  %3 = trunc i64 %2 to i32
  %4 = add i32 %1, %3
  ret i32 %4
}

attributes #0 = { nounwind willreturn readnone }
