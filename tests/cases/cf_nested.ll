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
  %9 = srem i32 %8, 3
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %count.addr, align 4
  %12 = add i32 %11, 1
  store i32 %12, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %13 = load i32, i32* %j.addr, align 4
  %14 = add i32 %13, 1
  store i32 %14, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %count.addr, align 4
  ret i32 %17
}

define noundef i32 @search(i32 noundef %limit) #1 {
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
  %5 = srem i32 %4, 2
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  br label %while.cond

if.end:
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  br i1 true, label %while.body.1, label %while.end.1

while.body.1:
  %7 = load i32, i32* %j.addr, align 4
  %8 = add i32 %7, 1
  store i32 %8, i32* %j.addr, align 4
  %9 = load i32, i32* %j.addr, align 4
  %10 = load i32, i32* %j.addr, align 4
  %11 = mul i32 %9, %10
  %12 = load i32, i32* %i.addr, align 4
  %13 = icmp sgt i32 %11, %12
  br i1 %13, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end.1

if.end.1:
  br label %while.cond.1

while.end.1:
  %14 = load i32, i32* %found.addr, align 4
  %15 = load i32, i32* %j.addr, align 4
  %16 = add i32 %14, %15
  store i32 %16, i32* %found.addr, align 4
  br label %while.cond

while.end:
  %17 = load i32, i32* %found.addr, align 4
  ret i32 %17
}

define noundef i32 @test() #1 {
entry:
  %0 = call i32 @countPairs(i32 6)
  %1 = mul i32 %0, 100
  %2 = call i32 @search(i32 5)
  %3 = add i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind readnone }
