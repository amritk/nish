%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"after\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %src.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = call i8* @nish_alloc_struct(i64 8)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 0, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %11, %struct.nish_array** %dst.addr, align 8
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %19 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* %19, %struct.nish_array* %20)
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %x) #1 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
