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

define internal noundef zeroext i1 @step(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h, i32 noundef %i) #1 {
entry:
  %0 = icmp eq i32 %i, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = icmp eq i64 %4, 0
  br i1 %5, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %6 = sub i64 %4, 1
  store i64 %6, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  %11 = load i32, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = icmp eq i64 %15, 0
  br i1 %16, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %17 = sub i64 %15, 1
  store i64 %17, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %17
  %22 = load i32, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %23 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp eq i64 %26, 0
  br i1 %27, label %pop.empty.2, label %pop.ok.2

pop.empty.2:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.2:
  %28 = sub i64 %26, 1
  store i64 %28, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %28
  %33 = load i32, i32* %32, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  br label %if.end

if.end:
  ret i1 true
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %12, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = trunc i64 %16 to i32
  %18 = icmp slt i32 %11, %17
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %20 = load i32, i32* %i.addr, align 4
  %21 = call i1 @step(%struct.Holder* %19, i32 %20)
  br label %land.end

land.end:
  %22 = phi i1 [ false, %while.cond ], [ %21, %land.rhs ]
  br i1 %22, label %while.body, label %while.end

while.body:
  %23 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %24 = getelementptr inbounds %struct.Holder, %struct.Holder* %23, i32 0, i32 0
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !4
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  %35 = load i32, i32* %34, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %while.cond

while.end:
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
