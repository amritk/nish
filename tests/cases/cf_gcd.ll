declare void @nish_panic_div(i1 noundef zeroext) #1

define internal noundef i32 @gcd(i32 noundef %a, i32 noundef %b) #0 {
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
  %5 = icmp eq i32 %4, 0
  %6 = icmp eq i32 %3, -2147483648
  %7 = icmp eq i32 %4, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = srem i32 %3, %4
  store i32 %10, i32* %y.addr, align 4
  %11 = load i32, i32* %t.addr, align 4
  store i32 %11, i32* %x.addr, align 4
  br label %while.cond

while.end:
  %12 = load i32, i32* %x.addr, align 4
  ret i32 %12
}

define noundef i32 @test() #0 {
entry:
  %0 = tail call i32 @gcd(i32 48, i32 18)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
