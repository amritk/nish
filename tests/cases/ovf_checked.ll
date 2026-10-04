declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #1

define noundef i64 @mix(i32 noundef %a, i32 noundef %b, i64 noundef %c) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %diff.addr = alloca i32, align 4
  %product.addr = alloca i64, align 8
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %sum.addr, align 4
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %a, i32 %b)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %4, i32* %diff.addr, align 4
  %6 = load i32, i32* %sum.addr, align 4
  %7 = load i32, i32* %diff.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %11 = sext i32 %9 to i64
  store i64 %11, i64* %product.addr, align 8
  %12 = load i64, i64* %product.addr, align 8
  %13 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %12, i64 %c)
  %14 = extractvalue { i64, i1 } %13, 0
  %15 = extractvalue { i64, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %16 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %14)
  %17 = extractvalue { i64, i1 } %16, 0
  %18 = extractvalue { i64, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i64 %17

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 3, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @wraps(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = mul i32 %a, %b
  %1 = add i32 %0, %a
  %2 = sub i32 %1, %b
  ret i32 %2
}

define noundef i32 @test() #0 {
entry:
  %0 = sext i32 2 to i64
  %1 = call i64 @mix(i32 7, i32 3, i64 %0)
  %2 = trunc i64 %1 to i32
  %3 = call i32 @wraps(i32 3, i32 2)
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
