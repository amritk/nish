%struct.Ring = type { %struct.nish_array* }
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

define internal void @Ring.constructor(%struct.Ring* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds %struct.Ring, %struct.Ring* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !17
  ret void
}

define internal noundef i32 @Ring.swap(%struct.Ring* noundef nonnull align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 40, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds %struct.Ring, %struct.Ring* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !17
  ret i32 1
}

define internal noundef i32 @Ring.step(%struct.Ring* noundef nonnull align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i32 @Ring.swap(%struct.Ring* %this)
  ret i32 %0
}

define internal noundef i32 @Ring.readDuring(%struct.Ring* noundef nonnull align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Ring, %struct.Ring* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = call i32 @Ring.step(%struct.Ring* %this)
  %3 = sext i32 %2 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %11
}

define noundef i32 @nish_main() #1 {
entry:
  %r.addr = alloca %struct.Ring*, align 8
  %Ring.obj = alloca %struct.Ring, align 8
  %during.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Ring.constructor(%struct.Ring* %Ring.obj)
  store %struct.Ring* %Ring.obj, %struct.Ring** %r.addr, align 8
  %0 = load %struct.Ring*, %struct.Ring** %r.addr, align 8
  %1 = call i32 @Ring.readDuring(%struct.Ring* %0)
  store i32 %1, i32* %during.addr, align 4
  %2 = load i32, i32* %during.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load %struct.Ring*, %struct.Ring** %r.addr, align 8
  %6 = getelementptr inbounds %struct.Ring, %struct.Ring* %5, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 1, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 1
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %4, i8* %16)
  call void @nish_print(i8* %17)
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
!16 = !{!"Ring", !15, i64 0}
!17 = !{!16, !15, i64 0}
