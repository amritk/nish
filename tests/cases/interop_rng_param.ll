%struct.Clock = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<1, 7>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 23>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define noundef i32 @pick(i32 noundef %base, i32 noundef %day) #0 {
entry:
  %0 = sub i32 %day, 1
  %1 = icmp ult i32 %0, 7
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %base, i32 10)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %day)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %6

ovf.fail:
  %ovf.op = phi i32 [ 2, %rng.ok ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @twice(i32 noundef %d) #1 {
entry:
  %0 = mul nsw i32 %d, 2
  ret i32 %0
}

define void @Clock.constructor(%struct.Clock* noundef nonnull noalias readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @Clock.set(%struct.Clock* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %h) #0 {
entry:
  %0 = icmp ult i32 %h, 24
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  store i32 %h, i32* %1, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  ret i32 %3
}

define noundef i32 @run(i32 noundef %n) #0 {
entry:
  %clock.addr = alloca %struct.Clock*, align 8
  %Clock.obj = alloca %struct.Clock, align 8
  call void @Clock.constructor(%struct.Clock* %Clock.obj)
  store %struct.Clock* %Clock.obj, %struct.Clock** %clock.addr, align 8
  %0 = call i32 @pick(i32 %n, i32 %n)
  %1 = icmp ult i32 %n, 10
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = call i32 @twice(i32 %n)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = load %struct.Clock*, %struct.Clock** %clock.addr, align 8
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 4)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %10 = call i32 @Clock.set(%struct.Clock* %6, i32 %8)
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = tail call i32 @run(i32 3)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Clock", !2, i64 0}
!4 = !{!3, !2, i64 0}
