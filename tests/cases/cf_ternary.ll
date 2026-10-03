declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef i32 @max(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp sgt i32 %a, %b
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ %a, %cond.true ], [ %b, %cond.false ]
  ret i32 %1
}

define internal noundef i32 @sign(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = icmp sgt i32 %x, 0
  br i1 %1, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %2 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  br label %cond.end

cond.end:
  %3 = phi i32 [ -1, %cond.true ], [ %2, %cond.end.1 ]
  ret i32 %3
}

define noundef i32 @test() #1 {
entry:
  %0 = call i32 @max(i32 3, i32 8)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 10)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i32 @sign(i32 -5)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = call i32 @sign(i32 0)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %12 = call i32 @sign(i32 9)
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 2)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %14)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %17

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
