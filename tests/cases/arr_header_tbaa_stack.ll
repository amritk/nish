%struct.Counter = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

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
  %11 = add nsw i32 %10, 1
  %12 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %11, i32* %12, align 4, !tbaa !17
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %18 = load i32, i32* %i.addr, align 4
  %19 = trunc i64 %15 to i32
  %20 = icmp slt i32 %18, %19
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %total.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %17 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %23
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = add nsw i32 %21, %26
  store i32 %27, i32* %total.addr, align 4
  %28 = load i32, i32* %i.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = bitcast i8* %17 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %29
  %32 = load i32, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  store i32 %32, i32* %33, align 4, !tbaa !18
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = load i32, i32* %total.addr, align 4
  %37 = mul nsw i32 %36, 10
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = trunc i64 %40 to i32
  %42 = add nsw i32 %37, %41
  ret i32 %42
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
  %26 = mul nsw i32 %25, 100
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = mul nsw i32 %30, 10
  %32 = add nsw i32 %26, %31
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 2, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 2
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = add nsw i32 %32, %41
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %42
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
  %9 = mul nsw i32 %8, 1000
  %10 = load i32, i32* %b.addr, align 4
  %11 = load i32, i32* %a.addr, align 4
  %12 = sub nsw i32 %10, %11
  %13 = add nsw i32 %9, %12
  %14 = load i32, i32* %w.addr, align 4
  %15 = add nsw i32 %13, %14
  %16 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %17 = getelementptr inbounds %struct.Counter, %struct.Counter* %16, i32 0, i32 0
  %18 = load i32, i32* %17, align 4, !tbaa !17
  %19 = mul nsw i32 %18, 10000000
  %20 = add nsw i32 %15, %19
  %21 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %22 = getelementptr inbounds %struct.Counter, %struct.Counter* %21, i32 0, i32 1
  %23 = load i32, i32* %22, align 4, !tbaa !18
  %24 = add nsw i32 %20, %23
  ret i32 %24
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
