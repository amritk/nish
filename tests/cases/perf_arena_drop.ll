%struct.Point = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  ret void
}

define noundef i32 @test() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 1)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 2)
  store %struct.Point* %3, %struct.Point** %p.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %8 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 1, i32* %11, align 4, !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds i32, i32* %10, i64 1
  store i32 2, i32* %12, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %5, %struct.nish_array** %xs.addr, align 8
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 2, i64* %15, align 8, !alias.scope !3, !noalias !4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 2, i64* %16, align 8, !alias.scope !3, !noalias !4
  %17 = call i8* @nish_alloc_struct(i64 8)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 3, i32* %20, align 4, !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds i32, i32* %19, i64 1
  store i32 4, i32* %21, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %14, %struct.nish_array** %xs.addr, align 8
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %22, i8** %s.addr, align 8
  %23 = load i8*, i8** %s.addr, align 8
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %24, i8** %s.addr, align 8
  %25 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %26 = getelementptr inbounds %struct.Point, %struct.Point* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4
  %31 = icmp ult i64 0, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3
  %37 = add nsw i32 %27, %36
  %38 = load i8*, i8** %s.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = add nsw i32 %37, %41
  ret i32 %42
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
