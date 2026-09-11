declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef i32 @firstMultipleOver(i32 noundef %n, i32 noundef %limit) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %k.addr, align 4
  %1 = add nsw i32 %0, 1
  store i32 %1, i32* %k.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = mul nsw i32 %2, %n
  %4 = icmp sgt i32 %3, %limit
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  br label %while.cond

while.end:
  %5 = load i32, i32* %k.addr, align 4
  ret i32 %5
}

define internal noundef i32 @sumOdd(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp eq i32 2, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 2, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = srem i32 %2, 2
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %10 = load i32, i32* %s.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %10, %11
  store i32 %12, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %s.addr, align 4
  ret i32 %15
}

define internal noundef i32 @largestPowerOfTwo(i32 noundef %limit) #0 {
entry:
  %p.addr = alloca i32, align 4
  store i32 1, i32* %p.addr, align 4
  br label %for.body

for.body:
  %0 = load i32, i32* %p.addr, align 4
  %1 = mul nsw i32 %0, 2
  %2 = icmp sgt i32 %1, %limit
  br i1 %2, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %3 = load i32, i32* %p.addr, align 4
  %4 = mul nsw i32 %3, 2
  store i32 %4, i32* %p.addr, align 4
  br label %for.body

for.end:
  %5 = load i32, i32* %p.addr, align 4
  ret i32 %5
}

define noundef i32 @test() #1 {
entry:
  %0 = call i32 @firstMultipleOver(i32 7, i32 30)
  %1 = mul nsw i32 %0, 1000
  %2 = call i32 @sumOdd(i32 10)
  %3 = mul nsw i32 %2, 10
  %4 = add nsw i32 %1, %3
  %5 = call i32 @largestPowerOfTwo(i32 100)
  %6 = add nsw i32 %4, %5
  ret i32 %6
}

attributes #0 = { nounwind readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
