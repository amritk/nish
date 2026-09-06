define noundef i32 @fibIter(i32 noundef %n) #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  store i32 0, i32* %a.addr, align 4
  store i32 1, i32* %b.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %a.addr, align 4
  %3 = load i32, i32* %b.addr, align 4
  %4 = add i32 %2, %3
  store i32 %4, i32* %t.addr, align 4
  %5 = load i32, i32* %b.addr, align 4
  store i32 %5, i32* %a.addr, align 4
  %6 = load i32, i32* %t.addr, align 4
  store i32 %6, i32* %b.addr, align 4
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i32, i32* %a.addr, align 4
  ret i32 %9
}

define noundef i32 @fibRec(i32 noundef %n) #0 {
entry:
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %n

if.end:
  %1 = sub i32 %n, 1
  %2 = call i32 @fibRec(i32 %1)
  %3 = sub i32 %n, 2
  %4 = call i32 @fibRec(i32 %3)
  %5 = add i32 %2, %4
  ret i32 %5
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @fibIter(i32 20)
  %1 = call i32 @fibRec(i32 15)
  %2 = add i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
