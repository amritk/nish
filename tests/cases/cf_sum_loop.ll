define noundef i32 @sumTo(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %sum.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = srem i32 %3, 1000
  %5 = add i32 %2, %4
  store i32 %5, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load i32, i32* %sum.addr, align 4
  ret i32 %8
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sumTo(i32 1000)
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
