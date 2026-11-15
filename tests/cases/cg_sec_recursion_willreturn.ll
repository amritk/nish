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
  %n = phi i32 [ %n.in, %entry ], [ %4, %rec.false ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %rec.false ]
  %rec.last = phi i32 [ 0, %entry ], [ 1, %rec.false ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %rec.false

rec.true:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 0)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

rec.false:
  %4 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %rec.true

rec.call:
  %5 = call i32 @countdown(i32 %n)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %7)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %10

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
