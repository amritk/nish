declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i32 @fib(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %6, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %5, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp slt i32 %n, 2
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %n)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = sub nsw i32 %n, 1
  %5 = call i32 @fib(i32 %4)
  %6 = sub nsw i32 %n, 2
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %7 = call i32 @fib(i32 %n)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %9)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %12

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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
