%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define noundef i32 @narrowed(%struct.Holder* noundef readonly align 8 nocapture %h) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  %0 = icmp ne %struct.Holder* %h, null
  br i1 %0, label %if.then, label %if.end

if.then:
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %1, %6
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i32, i32* %s.addr, align 4
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !4
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  %20 = load i32, i32* %19, align 4, !alias.scope !9, !noalias !8
  %21 = add nsw i32 %8, %20
  store i32 %21, i32* %s.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %while.cond

while.end:
  br label %if.end

if.end:
  %24 = load i32, i32* %s.addr, align 4
  ret i32 %24
}

define noundef i32 @plain(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %3 to i32
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %5 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8
  %15 = add nsw i32 %9, %14
  store i32 %15, i32* %s.addr, align 4
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %18 = load i32, i32* %s.addr, align 4
  ret i32 %18
}

define noundef i32 @nish_main() #1 {
entry:
  %other.addr = alloca %struct.Holder*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %i.addr = alloca i32, align 4
  %Holder.obj = alloca %struct.Holder, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Holder*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !8, !noalias !9
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !8, !noalias !9
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 7, i32* %9, align 4, !alias.scope !9, !noalias !8
  call void @Holder.constructor(%struct.Holder* %1, %struct.nish_array* %3)
  store %struct.Holder* %1, %struct.Holder** %other.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Holder*
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 3, i64* %14, align 8, !alias.scope !8, !noalias !9
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 3, i64* %15, align 8, !alias.scope !8, !noalias !9
  %16 = call i8* @nish_alloc_struct(i64 12)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !8, !noalias !9
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 1, i32* %19, align 4, !alias.scope !9, !noalias !8
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 2, i32* %20, align 4, !alias.scope !9, !noalias !8
  %21 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 3, i32* %21, align 4, !alias.scope !9, !noalias !8
  call void @Holder.constructor(%struct.Holder* %11, %struct.nish_array* %13)
  store %struct.Holder* %11, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %22 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %23 = icmp ne %struct.Holder* %22, null
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %i.addr, align 4
  %25 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %26 = getelementptr inbounds %struct.Holder, %struct.Holder* %25, i32 0, i32 0
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !8, !noalias !9
  %30 = trunc i64 %29 to i32
  %31 = icmp slt i32 %24, %30
  br label %land.end

land.end:
  %32 = phi i1 [ false, %while.cond ], [ %31, %land.rhs ]
  br i1 %32, label %while.body, label %while.end

while.body:
  %33 = load i32, i32* %i.addr, align 4
  %34 = icmp eq i32 %33, 1
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load %struct.Holder*, %struct.Holder** %other.addr, align 8
  store %struct.Holder* %35, %struct.Holder** %h.addr, align 8
  br label %if.end

if.end:
  %36 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %37 = icmp ne %struct.Holder* %36, null
  br i1 %37, label %if.then.1, label %if.end.1

if.then.1:
  %38 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %39 = getelementptr inbounds %struct.Holder, %struct.Holder* %38, i32 0, i32 0
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !4
  %41 = load i32, i32* %i.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !8, !noalias !9
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %42
  %50 = load i32, i32* %49, align 4, !alias.scope !9, !noalias !8
  %51 = call i8* @nish_str_from_i32(i32 %50)
  call void @nish_print(i8* %51)
  br label %if.end.1

if.end.1:
  %52 = load i32, i32* %i.addr, align 4
  %53 = add nsw i32 %52, 1
  store i32 %53, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %54 = call i32 @narrowed(%struct.Holder* null)
  %55 = call i8* @nish_alloc_struct(i64 24)
  %56 = bitcast i8* %55 to %struct.nish_array*
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  store i64 0, i64* %57, align 8, !alias.scope !8, !noalias !9
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 1
  store i64 0, i64* %58, align 8, !alias.scope !8, !noalias !9
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  store i8* null, i8** %59, align 8, !alias.scope !8, !noalias !9
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %56)
  %60 = call i32 @plain(%struct.Holder* %Holder.obj)
  %61 = add nsw i32 %54, %60
  ret i32 %61
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
