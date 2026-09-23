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

define internal noundef zeroext i1 @Holder.shrink(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  br label %while.cond

while.cond:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 1
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9
  %10 = icmp eq i64 %9, 0
  br i1 %10, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %11 = sub i64 %9, 1
  store i64 %11, i64* %8, align 8, !alias.scope !8, !noalias !9
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %11
  %16 = load i32, i32* %15, align 4, !alias.scope !9, !noalias !8
  br label %while.cond

while.end:
  ret i1 false
}

define internal noundef i32 @read(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h, i32 noundef %i) #1 {
entry:
  %0 = icmp slt i32 %i, 0
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %i, %5
  br label %lor.end.1

lor.end.1:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs.1 ]
  br i1 %7, label %lor.end, label %lor.rhs

lor.rhs:
  %8 = call i1 @Holder.shrink(%struct.Holder* %h)
  br label %lor.end

lor.end:
  %9 = phi i1 [ true, %lor.end.1 ], [ %8, %lor.rhs ]
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = sub nsw i32 0, 1
  ret i32 %10

if.end:
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !4
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %13
  %21 = load i32, i32* %20, align 4, !alias.scope !9, !noalias !8
  ret i32 %21
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
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 5, i32* %11, align 4, !alias.scope !9, !noalias !8
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 6, i32* %12, align 4, !alias.scope !9, !noalias !8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  %13 = call i32 @read(%struct.Holder* %Holder.obj, i32 5)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
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
