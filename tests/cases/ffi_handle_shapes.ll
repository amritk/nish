%struct.Sure = type { i8* }
%struct.Quiet = type { i8* }
%struct.Maybe = type { i8* }
%struct.Lying = type { i8* }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare i8* @sure_open()
declare i32 @sure_close(i8*)
declare void @quiet_close(i8*)
declare i8* @maybe_open(i32)
declare i32 @maybe_close(i8*)
declare i8* @lying_open(i32)
declare i32 @peek(i8*)
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Sure.constructor(%struct.Sure* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @sure_open()
  %1 = getelementptr inbounds %struct.Sure, %struct.Sure* %this, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @Sure.num(%struct.Sure* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Sure, %struct.Sure* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !4
  %2 = call i32 @peek(i8* %1)
  ret i32 %2
}

define internal void @Quiet.constructor(%struct.Quiet* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @sure_open()
  %1 = getelementptr inbounds %struct.Quiet, %struct.Quiet* %this, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !6
  ret void
}

define internal noundef i32 @Quiet.num(%struct.Quiet* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Quiet, %struct.Quiet* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !6
  %2 = call i32 @peek(i8* %1)
  ret i32 %2
}

define internal void @Maybe.constructor(%struct.Maybe* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %fail) #0 {
entry:
  %0 = call i8* @maybe_open(i32 %fail)
  %1 = getelementptr inbounds %struct.Maybe, %struct.Maybe* %this, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !8
  ret void
}

define internal void @Lying.constructor(%struct.Lying* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %fail) #0 {
entry:
  %0 = call i8* @lying_open(i32 %fail)
  %1 = getelementptr inbounds %struct.Lying, %struct.Lying* %this, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !10
  ret void
}

define internal { i1, i32, i32 } @pathFor(i32 noundef %fail) #1 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = icmp eq i32 %fail, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 true, i1* %1, align 1
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 10, i32* %2, align 4
  br label %cond.end

cond.false:
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %fail, i32* %4, align 4
  br label %cond.end

cond.end:
  %5 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %cond.false ]
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = insertvalue { i1, i32, i32 } undef, i1 %7, 0
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = insertvalue { i1, i32, i32 } %8, i32 %12, 1
  %14 = insertvalue { i1, i32, i32 } %13, i32 %10, 2
  ret { i1, i32, i32 } %14
}

define noundef i32 @sureEarly(i32 noundef %k) #0 {
entry:
  %s.addr = alloca %struct.Sure*, align 8
  %Sure.obj = alloca %struct.Sure, align 8
  call void @Sure.constructor(%struct.Sure* %Sure.obj)
  store %struct.Sure* %Sure.obj, %struct.Sure** %s.addr, align 8
  %0 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  %1 = icmp sgt i32 %k, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Sure, %struct.Sure* %0, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !4
  %4 = call i32 @sure_close(i8* %3)
  ret i32 %k

if.end:
  %5 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  %6 = call i32 @Sure.num(%struct.Sure* %5)
  %7 = getelementptr inbounds %struct.Sure, %struct.Sure* %0, i32 0, i32 0
  %8 = load i8*, i8** %7, align 8, !tbaa !4
  %9 = call i32 @sure_close(i8* %8)
  ret i32 %6
}

define noundef i32 @quietEarly(i32 noundef %k) #0 {
entry:
  %q.addr = alloca %struct.Quiet*, align 8
  %Quiet.obj = alloca %struct.Quiet, align 8
  call void @Quiet.constructor(%struct.Quiet* %Quiet.obj)
  store %struct.Quiet* %Quiet.obj, %struct.Quiet** %q.addr, align 8
  %0 = load %struct.Quiet*, %struct.Quiet** %q.addr, align 8
  %1 = icmp sgt i32 %k, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Quiet, %struct.Quiet* %0, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !6
  call void @quiet_close(i8* %3)
  ret i32 %k

if.end:
  %4 = load %struct.Quiet*, %struct.Quiet** %q.addr, align 8
  %5 = call i32 @Quiet.num(%struct.Quiet* %4)
  %6 = getelementptr inbounds %struct.Quiet, %struct.Quiet* %0, i32 0, i32 0
  %7 = load i8*, i8** %6, align 8, !tbaa !6
  call void @quiet_close(i8* %7)
  ret i32 %5
}

define noundef i32 @maybeEither(i32 noundef %fail) #0 {
entry:
  %m.addr = alloca %struct.Maybe*, align 8
  %Maybe.obj = alloca %struct.Maybe, align 8
  call void @Maybe.constructor(%struct.Maybe* %Maybe.obj, i32 %fail)
  store %struct.Maybe* %Maybe.obj, %struct.Maybe** %m.addr, align 8
  %0 = load %struct.Maybe*, %struct.Maybe** %m.addr, align 8
  %1 = getelementptr inbounds %struct.Maybe, %struct.Maybe* %0, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8, !tbaa !8
  %3 = call i32 @maybe_close(i8* %2)
  ret i32 %fail
}

define noundef i32 @lyingEither(i32 noundef %fail) #0 {
entry:
  %l.addr = alloca %struct.Lying*, align 8
  %Lying.obj = alloca %struct.Lying, align 8
  call void @Lying.constructor(%struct.Lying* %Lying.obj, i32 %fail)
  store %struct.Lying* %Lying.obj, %struct.Lying** %l.addr, align 8
  %0 = load %struct.Lying*, %struct.Lying** %l.addr, align 8
  %1 = getelementptr inbounds %struct.Lying, %struct.Lying* %0, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8, !tbaa !10
  %3 = icmp eq i8* %2, null
  br i1 %3, label %handle.closed, label %handle.close

handle.close:
  %4 = call i32 @sure_close(i8* %2)
  br label %handle.closed

handle.closed:
  ret i32 %fail
}

define noundef i32 @beforeLoop(i32 noundef %n) #0 {
entry:
  %s.addr = alloca %struct.Sure*, align 8
  %Sure.obj = alloca %struct.Sure, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @Sure.constructor(%struct.Sure* %Sure.obj)
  store %struct.Sure* %Sure.obj, %struct.Sure** %s.addr, align 8
  %0 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp eq i32 %3, 1
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp eq i32 %5, 3
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  %9 = call i32 @Sure.num(%struct.Sure* %8)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %total.addr, align 4
  %16 = getelementptr inbounds %struct.Sure, %struct.Sure* %0, i32 0, i32 0
  %17 = load i8*, i8** %16, align 8, !tbaa !4
  %18 = call i32 @sure_close(i8* %17)
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal { i1, i32, i32 } @body(i32 noundef %fail) #0 {
entry:
  %s.addr = alloca %struct.Sure*, align 8
  %Sure.obj = alloca %struct.Sure, align 8
  %extra.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  call void @Sure.constructor(%struct.Sure* %Sure.obj)
  store %struct.Sure* %Sure.obj, %struct.Sure** %s.addr, align 8
  %0 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  %1 = call { i1, i32, i32 } @pathFor(i32 %fail)
  %2 = extractvalue { i1, i32, i32 } %1, 0
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = extractvalue { i1, i32, i32 } %1, 1
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = extractvalue { i1, i32, i32 } %1, 2
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %6, i32* %7, align 4
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  br i1 %9, label %res.ok, label %res.propagate

res.propagate:
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %11 = load i32, i32* %10, align 4
  %12 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %11, 2
  %13 = getelementptr inbounds %struct.Sure, %struct.Sure* %0, i32 0, i32 0
  %14 = load i8*, i8** %13, align 8, !tbaa !4
  %15 = call i32 @sure_close(i8* %14)
  ret { i1, i32, i32 } %12

res.ok:
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  store i32 %17, i32* %extra.addr, align 4
  %18 = load %struct.Sure*, %struct.Sure** %s.addr, align 8
  %19 = call i32 @Sure.num(%struct.Sure* %18)
  %20 = load i32, i32* %extra.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  %24 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %22, 1
  %25 = getelementptr inbounds %struct.Sure, %struct.Sure* %0, i32 0, i32 0
  %26 = load i8*, i8** %25, align 8, !tbaa !4
  %27 = call i32 @sure_close(i8* %26)
  ret { i1, i32, i32 } %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @bodyOrReturn(i32 noundef %fail) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @body(i32 %fail)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ -1, %res.alt ]
  ret i32 %11
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Sure", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Quiet", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"Maybe", !2, i64 0}
!8 = !{!7, !2, i64 0}
!9 = !{!"Lying", !2, i64 0}
!10 = !{!9, !2, i64 0}
