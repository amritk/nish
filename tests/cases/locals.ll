declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  ret i32 %0
}

define internal noundef i32 @polynomial(i32 noundef %x, i32 noundef %k) #1 {
entry:
  %acc.addr = alloca i32, align 4
  %bias.addr = alloca i32, align 4
  %0 = call i32 @square(i32 %x)
  %1 = mul nsw i32 %0, 3
  store i32 %1, i32* %acc.addr, align 4
  %2 = load i32, i32* %acc.addr, align 4
  %3 = mul nsw i32 %k, 2
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %acc.addr, align 4
  store i32 7, i32* %bias.addr, align 4
  %7 = load i32, i32* %acc.addr, align 4
  %8 = load i32, i32* %bias.addr, align 4
  %9 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %10

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %0 = tail call i32 @polynomial(i32 4, i32 5)
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
