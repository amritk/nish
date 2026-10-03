declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i32 @fib(i32 noundef %n) #0 {
entry:
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %n

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @fib(i32 %1)
  %3 = sub nsw i32 %n, 2
  %4 = call i32 @fib(i32 %3)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @countDown(i32 noundef %n) #1 {
entry:
  %steps.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %steps.addr, align 4
  store i32 %n, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %steps.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = xor i32 %2, %3
  store i32 %4, i32* %steps.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = sub nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %steps.addr, align 4
  ret i32 %7
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @fib(i32 10)
  %1 = call i32 @countDown(i32 5)
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
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
