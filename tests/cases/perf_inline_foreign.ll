declare i32 @abs(i32)

define noundef i32 @step(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  %1 = add nsw i32 %0, 1
  ret i32 %1
}

define noundef i32 @test() #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = sub nsw i32 0, %3
  %5 = call i32 @abs(i32 %4)
  %6 = add nsw i32 %2, %5
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i32 @step(i32 %7)
  %9 = add nsw i32 %6, %8
  store i32 %9, i32* %total.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %12 = load i32, i32* %total.addr, align 4
  ret i32 %12
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
