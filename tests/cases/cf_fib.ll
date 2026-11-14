declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @fibIter(i32 noundef %n) #0 {
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
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %t.addr, align 4
  %7 = load i32, i32* %b.addr, align 4
  store i32 %7, i32* %a.addr, align 4
  %8 = load i32, i32* %t.addr, align 4
  store i32 %8, i32* %b.addr, align 4
  br label %for.inc

for.inc:
  %9 = load i32, i32* %i.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %11 = load i32, i32* %a.addr, align 4
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @fibRec(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %11, %if.end ]
  %rec.sum = phi i64 [ 0, %entry ], [ %17, %if.end ]
  %rec.min = phi i64 [ 0, %entry ], [ %14, %if.end ]
  %rec.max = phi i64 [ 0, %entry ], [ %16, %if.end ]
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sext i32 %n to i64
  %2 = add i64 %rec.sum, %1
  %3 = sub i64 %2, 2147483647
  %4 = add i64 %2, 2147483648
  %5 = icmp slt i64 %rec.min, %3
  %6 = icmp sgt i64 %rec.max, %4
  %7 = or i1 %5, %6
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = trunc i64 %2 to i32
  ret i32 %8

if.end:
  %9 = sub nsw i32 %n, 1
  %10 = call i32 @fibRec(i32 %9)
  %11 = sub nsw i32 %n, 2
  %12 = sext i32 %10 to i64
  %13 = icmp slt i64 %rec.sum, %rec.min
  %14 = select i1 %13, i64 %rec.sum, i64 %rec.min
  %15 = icmp sgt i64 %rec.sum, %rec.max
  %16 = select i1 %15, i64 %rec.sum, i64 %rec.max
  %17 = add i64 %rec.sum, %12
  br label %rec.head

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @fibIter(i32 20)
  %1 = call i32 @fibRec(i32 15)
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
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
