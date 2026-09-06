define noundef i32 @sumDigits(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %sum.addr, align 4
  %1 = load i32, i32* %rest.addr, align 4
  %2 = srem i32 %1, 10
  %3 = add i32 %0, %2
  store i32 %3, i32* %sum.addr, align 4
  %4 = load i32, i32* %rest.addr, align 4
  %5 = sdiv i32 %4, 10
  store i32 %5, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %6 = load i32, i32* %rest.addr, align 4
  %7 = icmp sgt i32 %6, 0
  br i1 %7, label %do.body, label %do.end

do.end:
  %8 = load i32, i32* %sum.addr, align 4
  ret i32 %8
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sumDigits(i32 0)
  %1 = call i32 @sumDigits(i32 9876)
  %2 = add i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind readnone }
