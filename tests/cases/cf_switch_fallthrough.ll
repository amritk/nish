declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @grade(i32 noundef %n) #0 {
entry:
  %points.addr = alloca i32, align 4
  store i32 0, i32* %points.addr, align 4
  switch i32 %n, label %sw.default [
    i32 3, label %sw.case
    i32 2, label %sw.case.1
    i32 1, label %sw.case.2
  ]

sw.case:
  %0 = load i32, i32* %points.addr, align 4
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 100)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %points.addr, align 4
  br label %sw.case.1

sw.case.1:
  %4 = load i32, i32* %points.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 10)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %6, i32* %points.addr, align 4
  br label %sw.case.2

sw.case.2:
  %8 = load i32, i32* %points.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %10, i32* %points.addr, align 4
  br label %sw.end

sw.default:
  store i32 -1, i32* %points.addr, align 4
  br label %sw.end

sw.end:
  %12 = load i32, i32* %points.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @last(i32 noundef %n) #0 {
entry:
  %out.addr = alloca i32, align 4
  store i32 0, i32* %out.addr, align 4
  switch i32 %n, label %sw.default [
    i32 0, label %sw.case
  ]

sw.case:
  store i32 5, i32* %out.addr, align 4
  br label %sw.default

sw.default:
  %0 = load i32, i32* %out.addr, align 4
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %out.addr, align 4
  br label %sw.end

sw.end:
  %4 = load i32, i32* %out.addr, align 4
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @grade(i32 3)
  %1 = call i32 @grade(i32 2)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @grade(i32 1)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call i32 @grade(i32 9)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call i32 @last(i32 0)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %17 = call i32 @last(i32 4)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %19

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
