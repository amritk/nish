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

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %g.addr = alloca %struct.Holder*, align 8
  %short.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  store %struct.Holder* %10, %struct.Holder** %g.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !8, !noalias !9
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !8, !noalias !9
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 7, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.nish_array* %12, %struct.nish_array** %short.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %19 = load i32, i32* %i.addr, align 4
  %20 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %21 = getelementptr inbounds %struct.Holder, %struct.Holder* %20, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9
  %25 = trunc i64 %24 to i32
  %26 = icmp slt i32 %19, %25
  br i1 %26, label %while.body, label %while.end

while.body:
  %27 = load i32, i32* %i.addr, align 4
  %28 = icmp eq i32 %27, 1
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %31 = getelementptr inbounds %struct.Holder, %struct.Holder* %29, i32 0, i32 0
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !4
  br label %if.end

if.end:
  %32 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %33 = getelementptr inbounds %struct.Holder, %struct.Holder* %32, i32 0, i32 0
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !4
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9
  %39 = icmp ult i64 %36, %38
  br i1 %39, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %36, i64 %38)
  unreachable

bounds.ok:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !8, !noalias !9
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  %44 = load i32, i32* %43, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store i32 %44, i32* %x.addr, align 4
  %45 = load i32, i32* %x.addr, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  call void @nish_print(i8* %46)
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
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
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
