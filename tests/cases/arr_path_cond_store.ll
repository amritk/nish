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

define internal noundef i32 @read(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %short, i32 noundef %i) #1 {
entry:
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %i, %5
  br label %land.end.1

land.end.1:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs.1 ]
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %short, %struct.nish_array** %8, align 8, !tbaa !4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %short, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9
  %11 = trunc i64 %10 to i32
  %12 = icmp sgt i32 %11, 0
  br label %land.end

land.end:
  %13 = phi i1 [ false, %land.end.1 ], [ %12, %land.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !4
  %16 = sext i32 %i to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !8, !noalias !9
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  ret i32 %24

if.end:
  %25 = sub nsw i32 0, 1
  ret i32 %25
}

define noundef i32 @nish_main() #1 {
entry:
  %Holder.obj = alloca %struct.Holder, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 6, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 6, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 5, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 6, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 1, i64* %15, align 8, !alias.scope !8, !noalias !9
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 1, i64* %16, align 8, !alias.scope !8, !noalias !9
  %17 = call i8* @nish_alloc_struct(i64 4)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !8, !noalias !9
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 7, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %21 = call i32 @read(%struct.Holder* %Holder.obj, %struct.nish_array* %14, i32 5)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
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
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
