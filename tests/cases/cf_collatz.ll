define noundef i32 @collatzSteps(i32 noundef %n) #0 {
entry:
  %steps.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  store i32 0, i32* %steps.addr, align 4
  store i32 %n, i32* %x.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %x.addr, align 4
  %1 = icmp ne i32 %0, 1
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %x.addr, align 4
  %3 = srem i32 %2, 2
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.else

if.then:
  %5 = load i32, i32* %x.addr, align 4
  %6 = sdiv i32 %5, 2
  store i32 %6, i32* %x.addr, align 4
  br label %if.end

if.else:
  %7 = load i32, i32* %x.addr, align 4
  %8 = mul i32 3, %7
  %9 = add i32 %8, 1
  store i32 %9, i32* %x.addr, align 4
  br label %if.end

if.end:
  %10 = load i32, i32* %steps.addr, align 4
  %11 = add i32 %10, 1
  store i32 %11, i32* %steps.addr, align 4
  br label %while.cond

while.end:
  %12 = load i32, i32* %steps.addr, align 4
  ret i32 %12
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @collatzSteps(i32 27)
  ret i32 %0
}

attributes #0 = { nounwind readnone }
