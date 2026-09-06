define noundef i32 @gcd(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  store i32 %a, i32* %x.addr, align 4
  store i32 %b, i32* %y.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %y.addr, align 4
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %y.addr, align 4
  store i32 %2, i32* %t.addr, align 4
  %3 = load i32, i32* %x.addr, align 4
  %4 = load i32, i32* %y.addr, align 4
  %5 = srem i32 %3, %4
  store i32 %5, i32* %y.addr, align 4
  %6 = load i32, i32* %t.addr, align 4
  store i32 %6, i32* %x.addr, align 4
  br label %while.cond

while.end:
  %7 = load i32, i32* %x.addr, align 4
  ret i32 %7
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @gcd(i32 48, i32 18)
  ret i32 %0
}

attributes #0 = { nounwind readnone }
