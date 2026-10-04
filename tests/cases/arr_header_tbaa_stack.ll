%struct.Counter = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sum(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 4, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 5, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 6, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !17
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %12, i32* %14, align 4, !tbaa !17
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %20 = load i32, i32* %i.addr, align 4
  %21 = trunc i64 %17 to i32
  %22 = icmp slt i32 %20, %21
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %total.addr, align 4
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %19 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %25
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %30, i32* %total.addr, align 4
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %19 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  store i32 %36, i32* %37, align 4, !tbaa !18
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %40 = load i32, i32* %total.addr, align 4
  %41 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %40, i32 10)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %44 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %49

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 0, %for.body ], [ 2, %for.end ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @widen(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %n0.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  store i32 %10, i32* %n0.addr, align 4
  %11 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 5, i32* %11, align 4, !tbaa !17
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 4)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  store i32 3, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  store i32 9, i32* %24, align 4, !tbaa !18
  %25 = load i32, i32* %n0.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %25, i32 100)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %32, i32 10)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %34)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 2, %41
  br i1 %42, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %41)
  unreachable

bounds.ok:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 2
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %49

ovf.fail:
  %ovf.op = phi i32 [ 2, %push.store ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %bounds.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !17
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !18
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %3 = call i32 @sum(%struct.Counter* %2)
  store i32 %3, i32* %a.addr, align 4
  %4 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %5 = call i32 @sum(%struct.Counter* %4)
  store i32 %5, i32* %b.addr, align 4
  %6 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %7 = call i32 @widen(%struct.Counter* %6)
  store i32 %7, i32* %w.addr, align 4
  %8 = load i32, i32* %a.addr, align 4
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 1000)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  %12 = load i32, i32* %b.addr, align 4
  %13 = load i32, i32* %a.addr, align 4
  %14 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %15)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %20 = load i32, i32* %w.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %24 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %25 = getelementptr inbounds %struct.Counter, %struct.Counter* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4, !tbaa !17
  %27 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %26, i32 10000000)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %28)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %33 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %34 = getelementptr inbounds %struct.Counter, %struct.Counter* %33, i32 0, i32 1
  %35 = load i32, i32* %34, align 4, !tbaa !18
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  ret i32 %37

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 1, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 2, %ovf.ok.3 ], [ 0, %ovf.ok.4 ], [ 0, %ovf.ok.5 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Counter", !15, i64 0, !15, i64 4}
!17 = !{!16, !15, i64 0}
!18 = !{!16, !15, i64 4}
