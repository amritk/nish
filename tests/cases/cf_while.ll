declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @countDigits(i32 noundef %n) #0 {
entry:
  %digits.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %digits.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %rest.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %rest.addr, align 4
  %3 = icmp eq i32 10, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 10, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = sdiv i32 %2, 10
  store i32 %8, i32* %rest.addr, align 4
  %9 = load i32, i32* %digits.addr, align 4
  %10 = add i32 %9, 1
  store i32 %10, i32* %digits.addr, align 4
  br label %while.cond

while.end:
  %11 = load i32, i32* %digits.addr, align 4
  ret i32 %11
}

define noundef i32 @firstPowerOver(i32 noundef %limit) #1 {
entry:
  %x.addr = alloca i32, align 4
  store i32 1, i32* %x.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %x.addr, align 4
  %1 = mul i32 %0, 2
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = icmp sgt i32 %2, %limit
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %x.addr, align 4
  ret i32 %4

if.end:
  br label %while.cond

while.end:
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @countDigits(i32 12345)
  %1 = mul i32 %0, 1000
  %2 = call i32 @firstPowerOver(i32 100)
  %3 = add i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readnone }
attributes #2 = { nounwind noreturn cold }
