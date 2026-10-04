declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i32 @score(i32 noundef %limit) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  switch i32 %2, label %sw.default [
    i32 0, label %sw.case
    i32 3, label %sw.case.1
  ]

sw.case:
  %3 = load i32, i32* %total.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 100)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %total.addr, align 4
  br label %sw.end

sw.case.1:
  br label %for.inc

sw.default:
  %7 = load i32, i32* %total.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %9, i32* %total.addr, align 4
  br label %sw.end

sw.end:
  %11 = load i32, i32* %total.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 1000)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %13, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @widen(i64 noundef %w) #1 {
entry:
  %out.addr = alloca i64, align 8
  store i64 0, i64* %out.addr, align 8
  switch i64 %w, label %sw.end [
    i64 1, label %sw.case
    i64 2, label %sw.case.1
  ]

sw.case:
  store i64 11, i64* %out.addr, align 8
  br label %sw.end

sw.case.1:
  store i64 22, i64* %out.addr, align 8
  br label %sw.end

sw.end:
  %0 = load i64, i64* %out.addr, align 8
  ret i64 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @score(i32 6)
  %1 = call i64 @widen(i64 2)
  %2 = trunc i64 %1 to i32
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
