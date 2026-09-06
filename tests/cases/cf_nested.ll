declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @countPairs(i32 noundef %n) #0 {
entry:
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body.1, label %for.end.1

for.body.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %j.addr, align 4
  %8 = add i32 %6, %7
  %9 = icmp eq i32 3, 0
  %10 = icmp eq i32 %8, -2147483648
  %11 = icmp eq i32 3, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %9)
  unreachable

div.ok:
  %14 = srem i32 %8, 3
  %15 = icmp eq i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %count.addr, align 4
  %17 = add i32 %16, 1
  store i32 %17, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %18 = load i32, i32* %j.addr, align 4
  %19 = add i32 %18, 1
  store i32 %19, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %count.addr, align 4
  ret i32 %22
}

define noundef i32 @search(i32 noundef %limit) #0 {
entry:
  %found.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %found.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp eq i32 2, 0
  %6 = icmp eq i32 %4, -2147483648
  %7 = icmp eq i32 2, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = srem i32 %4, 2
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  br label %while.cond

if.end:
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  br i1 true, label %while.body.1, label %while.end.1

while.body.1:
  %12 = load i32, i32* %j.addr, align 4
  %13 = add i32 %12, 1
  store i32 %13, i32* %j.addr, align 4
  %14 = load i32, i32* %j.addr, align 4
  %15 = load i32, i32* %j.addr, align 4
  %16 = mul i32 %14, %15
  %17 = load i32, i32* %i.addr, align 4
  %18 = icmp sgt i32 %16, %17
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end.1

if.end.1:
  br label %while.cond.1

while.end.1:
  %19 = load i32, i32* %found.addr, align 4
  %20 = load i32, i32* %j.addr, align 4
  %21 = add i32 %19, %20
  store i32 %21, i32* %found.addr, align 4
  br label %while.cond

while.end:
  %22 = load i32, i32* %found.addr, align 4
  ret i32 %22
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @countPairs(i32 6)
  %1 = mul i32 %0, 100
  %2 = call i32 @search(i32 5)
  %3 = add i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
