declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @factorial(i32 noundef %n) #0 {
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
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i32, i32* %acc.addr, align 4
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @countEven(i32 noundef %n) #1 {
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
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %c.addr, align 4
  br label %for.inc

for.inc:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 2
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
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readnone }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
