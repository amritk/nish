define internal noundef i32 @classify(i32 noundef %n) #0 {
entry:
  switch i32 %n, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.1
    i32 -1, label %sw.case.2
  ]

sw.case:
  ret i32 10

sw.case.1:
  ret i32 20

sw.case.2:
  ret i32 30

sw.default:
  ret i32 40
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @classify(i32 0)
  %1 = call i32 @classify(i32 1)
  %2 = mul nsw i32 %1, 2
  %3 = add nsw i32 %0, %2
  %4 = call i32 @classify(i32 2)
  %5 = mul nsw i32 %4, 3
  %6 = add nsw i32 %3, %5
  %7 = call i32 @classify(i32 -1)
  %8 = mul nsw i32 %7, 4
  %9 = add nsw i32 %6, %8
  %10 = call i32 @classify(i32 9)
  %11 = mul nsw i32 %10, 5
  %12 = add nsw i32 %9, %11
  ret i32 %12
}

attributes #0 = { nounwind willreturn readnone }
