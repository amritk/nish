define noundef i32 @factorial(i32 noundef %n) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %acc.addr, align 4
  store i32 2, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sle i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %acc.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = mul i32 %2, %3
  store i32 %4, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %acc.addr, align 4
  ret i32 %7
}

define noundef i32 @countEven(i32 noundef %n) #0 {
entry:
  %c.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %c.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %c.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %c.addr, align 4
  br label %for.inc

for.inc:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add i32 %4, 2
  store i32 %5, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %6 = load i32, i32* %c.addr, align 4
  ret i32 %6
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @factorial(i32 6)
  %1 = call i32 @countEven(i32 9)
  %2 = add i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind readnone }
