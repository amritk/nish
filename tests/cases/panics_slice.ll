%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"abcd\00" }, align 8

declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3

define internal noundef nonnull align 8 i8* @middle(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ule i64 1, 3
  %3 = icmp ule i64 3, %1
  %4 = and i1 %2, %3
  br i1 %4, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 1, i64 3, i64 %1)
  unreachable

slice.ok:
  %5 = sub i64 3, 1
  %6 = getelementptr inbounds i8, i8* %s, i64 8
  %7 = getelementptr inbounds i8, i8* %6, i64 1
  %8 = call i8* @nish_str_new(i8* %7, i64 %5)
  ret i8* %8
}

define internal noundef nonnull align 8 i8* @clamped(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @llvm.smin.i64(i64 1, i64 %1)
  %3 = call i64 @llvm.smax.i64(i64 %2, i64 0)
  %4 = call i64 @llvm.smin.i64(i64 30, i64 %1)
  %5 = call i64 @llvm.smax.i64(i64 %4, i64 0)
  %6 = call i64 @llvm.smin.i64(i64 %3, i64 %5)
  %7 = call i64 @llvm.smax.i64(i64 %3, i64 %5)
  %8 = sub i64 %7, %6
  %9 = getelementptr inbounds i8, i8* %s, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 %6
  %11 = call i8* @nish_str_new(i8* %10, i64 %8)
  ret i8* %11
}

define internal void @copyInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = add i64 1, %1
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ule i64 1, %2
  %6 = icmp ule i64 %2, %4
  %7 = and i1 %5, %6
  br i1 %7, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 1, i64 %2, i64 %4)
  unreachable

set.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 1
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %11, i8* %15, i64 %1, i1 false), !alias.scope !4, !noalias !3
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @middle(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @clamped(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast [4 x i8]* %arr.data to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %8 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 0
  store i8 0, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %10, i64 1
  store i8 0, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8, i8* %10, i64 2
  store i8 0, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i8, i8* %10, i64 3
  store i8 0, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast [2 x i8]* %arr.data.1 to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %17 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 0
  store i8 7, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i8, i8* %19, i64 1
  store i8 8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %src.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @copyInto(%struct.nish_array* %22, %struct.nish_array* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 1, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 1
  %32 = load i8, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 2, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %38 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 2
  %41 = load i8, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = add i8 %32, %41
  %43 = zext i8 %42 to i64
  %44 = call i8* @nish_str_from_u64(i64 %43)
  call void @nish_print(i8* %44)
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
!11 = !{!9, !8, i64 16}
!12 = !{!9, !7, i64 8}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
