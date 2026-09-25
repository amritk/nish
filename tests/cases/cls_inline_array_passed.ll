%struct.Counts = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define internal void @Counts.constructor(%struct.Counts* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
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
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %10, align 8, !tbaa !17
  ret void
}

define internal void @hit(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Counts*, align 8
  %Counts.obj = alloca %struct.Counts, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Counts.constructor(%struct.Counts* %Counts.obj)
  store %struct.Counts* %Counts.obj, %struct.Counts** %c.addr, align 8
  %0 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %1 = getelementptr inbounds %struct.Counts, %struct.Counts* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !17
  call void @hit(%struct.nish_array* %2, i32 1)
  %3 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %4 = getelementptr inbounds %struct.Counts, %struct.Counts* %3, i32 0, i32 0
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !17
  call void @hit(%struct.nish_array* %5, i32 1)
  %6 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %7 = getelementptr inbounds %struct.Counts, %struct.Counts* %6, i32 0, i32 0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !17
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 1, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 1
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %20 = getelementptr inbounds %struct.Counts, %struct.Counts* %19, i32 0, i32 0
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !17
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = trunc i64 %23 to i32
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %18, i8* %25)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
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
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Counts", !15, i64 0}
!17 = !{!16, !15, i64 0}
