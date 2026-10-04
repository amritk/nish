declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i32, align 4
  %product.addr = alloca i32, align 4
  %nested.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 2147483647, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %big.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 100000, i32 100000)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %4, i32* %product.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 100000, i32 100000)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %10, i32* %nested.addr, align 4
  %12 = load i32, i32* %big.addr, align 4
  %13 = load i32, i32* %product.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %17 = load i32, i32* %nested.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %19

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
