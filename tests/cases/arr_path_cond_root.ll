%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @read(%struct.Holder* noundef nonnull align 8 dereferenceable(8) %a, %struct.Holder* noundef nonnull align 8 dereferenceable(8) %b, i32 noundef %i) #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  store %struct.Holder* %a, %struct.Holder** %h.addr, align 8
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %i, %6
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  store %struct.Holder* %b, %struct.Holder** %h.addr, align 8
  %9 = icmp eq %struct.Holder* %b, %b
  br label %land.end

land.end:
  %10 = phi i1 [ false, %land.end.1 ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %11, i32 0, i32 0
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !4
  %14 = sext i32 %i to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  ret i32 %22

if.end:
  %23 = sub nsw i32 0, 1
  ret i32 %23
}

define noundef i32 @nish_main() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Holder*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 6, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 6, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 1, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 2, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 3, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %12 = getelementptr inbounds i32, i32* %8, i64 3
  store i32 4, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %13 = getelementptr inbounds i32, i32* %8, i64 4
  store i32 5, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %14 = getelementptr inbounds i32, i32* %8, i64 5
  store i32 6, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  call void @Holder.constructor(%struct.Holder* %1, %struct.nish_array* %3)
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = bitcast i8* %15 to %struct.Holder*
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 1, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 1, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %21 = call i8* @nish_alloc_struct(i64 4)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %23 = bitcast i8* %21 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  store i32 7, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  call void @Holder.constructor(%struct.Holder* %16, %struct.nish_array* %18)
  %25 = call i32 @read(%struct.Holder* %1, %struct.Holder* %16, i32 5)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
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
