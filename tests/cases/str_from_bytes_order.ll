%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @grow(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %bytes, i64 1)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 %1
  store i8 33, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  ret i32 %13
}

define internal noundef i32 @shrink(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp eq i64 %4, 0
  br i1 %5, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %6 = sub i64 %4, 1
  store i64 %6, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %6
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = load i32, i32* %n.addr, align 4
  ret i32 %12
}

define noundef i32 @grown() #1 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 104, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 105, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %9 = call i32 @grow(%struct.nish_array* %8)
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ule i64 0, %10
  %14 = icmp ule i64 %10, %12
  %15 = and i1 %13, %14
  br i1 %15, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %10, i64 %12)
  unreachable

bytes.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds i8, i8* %17, i64 0
  %19 = sub i64 %10, 0
  %20 = call i8* @nish_str_new(i8* %18, i64 %19)
  store i8* %20, i8** %s.addr, align 8
  %21 = load i8*, i8** %s.addr, align 8
  %22 = bitcast i8* %21 to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  %25 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %24, i32 1000)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  %28 = load i8*, i8** %s.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = icmp ult i64 2, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds i8, i8* %28, i64 8
  %33 = getelementptr inbounds i8, i8* %32, i64 2
  %34 = load i8, i8* %33, align 1
  %35 = zext i8 %34 to i32
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %37

ovf.fail:
  %ovf.op = phi i32 [ 2, %bytes.ok ], [ 0, %bounds.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @shrunk() #1 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 104, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 105, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %9 = call i32 @shrink(%struct.nish_array* %8)
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ule i64 0, %10
  %14 = icmp ule i64 %10, %12
  %15 = and i1 %13, %14
  br i1 %15, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %10, i64 %12)
  unreachable

bytes.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds i8, i8* %17, i64 0
  %19 = sub i64 %10, 0
  %20 = call i8* @nish_str_new(i8* %18, i64 %19)
  %21 = bitcast i8* %20 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = trunc i64 %22 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %23
}

define noundef i32 @test() #1 {
entry:
  %0 = tail call i32 @grown()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
