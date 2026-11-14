@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"10\00" }, align 8

declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @spin(i32 noundef %x) #0 {
entry:
  %0 = call i32 @spin(i32 %x)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 3)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %x)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @ping(i32 noundef %x) #0 {
entry:
  %0 = call i32 @pong(i32 %x)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 3)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %x)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @pong(i32 noundef %x) #0 {
entry:
  %0 = call i32 @ping(i32 %x)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 5)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %x)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @countdown(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %9, %rec.false ]
  %rec.sum = phi i64 [ 0, %entry ], [ %15, %rec.false ]
  %rec.min = phi i64 [ 0, %entry ], [ %12, %rec.false ]
  %rec.max = phi i64 [ 0, %entry ], [ %14, %rec.false ]
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %rec.true, label %rec.false

rec.true:
  %1 = sext i32 0 to i64
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

rec.false:
  %9 = sub nsw i32 %n, 1
  %10 = sext i32 1 to i64
  %11 = icmp slt i64 %rec.sum, %rec.min
  %12 = select i1 %11, i64 %rec.sum, i64 %rec.min
  %13 = icmp sgt i64 %rec.sum, %rec.max
  %14 = select i1 %13, i64 %rec.sum, i64 %rec.max
  %15 = add i64 %rec.sum, %10
  br label %rec.head

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @selfSpin() #0 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = call i32 @spin(i32 %1)
  ret i32 1
}

define noundef i32 @mutualSpin() #0 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = call i32 @ping(i32 %1)
  ret i32 2
}

define noundef i32 @test() #0 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = tail call i32 @countdown(i32 %1)
  ret i32 %2
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
