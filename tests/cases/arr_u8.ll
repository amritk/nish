%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i8 noundef %v) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  store i8 %v, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = zext i8 %12 to i32
  %14 = add nsw i32 %7, %13
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %one.addr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  call void @fill(%struct.nish_array* %4, i8 200)
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = call i32 @sum(%struct.nish_array* %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 0
  store i8 255, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 1
  store i8 255, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 2
  store i8 255, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 3
  store i8 0, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %29 = call i32 @sum(%struct.nish_array* %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  store i8 1, i8* %one.addr, align 1
  %31 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 0
  %37 = load i8, i8* %36, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = load i8, i8* %one.addr, align 1
  %39 = add i8 %37, %38
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 3
  store i8 %39, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %44 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 3
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %50 = zext i8 %49 to i32
  %51 = call i8* @nish_str_from_i32(i32 %50)
  call void @nish_print(i8* %51)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
