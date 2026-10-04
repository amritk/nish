%struct.Acc = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal void @Acc.constructor(%struct.Acc* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Acc, %struct.Acc* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #1 {
entry:
  %0 = mul nsw i32 %x, %x
  %1 = mul nsw i32 3, %y
  %2 = sub nsw i32 %0, %1
  %3 = sub nsw i32 0, %x
  %4 = add nsw i32 %2, %3
  ret i32 %4
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.Acc* noundef nonnull align 8 dereferenceable(4) nocapture %acc) #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %s.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %s.addr, align 4
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %3 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %21 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %20, i32 2)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %22, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %24 = getelementptr inbounds %struct.Acc, %struct.Acc* %acc, i32 0, i32 0
  %25 = load i32, i32* %24, align 4
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = bitcast i8* %3 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %27
  %30 = load i32, i32* %29, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %31 = sdiv i32 %30, 2
  %32 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %25, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %33, i32* %24, align 4
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = load i32, i32* %s.addr, align 4
  %38 = srem i32 %37, 1000
  ret i32 %38

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 2, %ovf.ok ], [ 1, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @mix(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %m.addr = alloca i32, align 4
  %0 = mul i32 %a, %b
  store i32 %0, i32* %m.addr, align 4
  %1 = load i32, i32* %m.addr, align 4
  %2 = sub i32 %a, %b
  %3 = add i32 %1, %2
  store i32 %3, i32* %m.addr, align 4
  %4 = load i32, i32* %m.addr, align 4
  %5 = sub i32 %4, 1
  store i32 %5, i32* %m.addr, align 4
  %6 = load i32, i32* %m.addr, align 4
  ret i32 %6
}

define noundef i32 @test() #2 {
entry:
  %acc.addr = alloca %struct.Acc*, align 8
  %Acc.obj = alloca %struct.Acc, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %n.addr = alloca i32, align 4
  call void @Acc.constructor(%struct.Acc* %Acc.obj)
  store %struct.Acc* %Acc.obj, %struct.Acc** %acc.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = call i32 @poly(i32 5, i32 2)
  store i32 %9, i32* %n.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %n.addr, align 4
  %14 = load i32, i32* %n.addr, align 4
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %16, i32* %n.addr, align 4
  %18 = load i32, i32* %n.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %21 = call i32 @sum(%struct.nish_array* %19, %struct.Acc* %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %25 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %26 = getelementptr inbounds %struct.Acc, %struct.Acc* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4, !tbaa !4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %31 = call i32 @mix(i32 3, i32 2)
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %33

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Acc", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
