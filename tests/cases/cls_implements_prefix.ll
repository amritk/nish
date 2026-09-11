%struct.Shape = type { i32, i32 }
%struct.Square = type { i32, i32, i32 }
%struct.Circle = type { i32, i32, i32, i1 }
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

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 2
  store i32 %side, i32* %2, align 4
  ret void
}

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %radius) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 2
  store i32 %radius, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 3
  store i1 true, i1* %3, align 1
  ret void
}

define internal noundef i32 @shift(%struct.Shape* noundef nonnull align 8 dereferenceable(8) nocapture %s, i32 noundef %dx) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, %dx
  %3 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  store i32 %2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 1
  %7 = load i32, i32* %6, align 4
  %8 = add nsw i32 %5, %7
  ret i32 %8
}

define noundef i32 @nish_main() #1 {
entry:
  %sq.addr = alloca %struct.Square*, align 8
  %c.addr = alloca %struct.Circle*, align 8
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Shape*], align 8
  %0 = call i8* @nish_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.Square*
  call void @Square.constructor(%struct.Square* %1, i32 1, i32 2, i32 10)
  store %struct.Square* %1, %struct.Square** %sq.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %3, i32 3, i32 4, i32 20)
  store %struct.Circle* %3, %struct.Circle** %c.addr, align 8
  %4 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %5 = bitcast %struct.Square* %4 to %struct.Shape*
  %6 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %7 = bitcast %struct.Circle* %6 to %struct.Shape*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %8, align 8, !alias.scope !3, !noalias !4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast [2 x %struct.Shape*]* %arr.data to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast i8* %10 to %struct.Shape**
  %13 = getelementptr inbounds %struct.Shape*, %struct.Shape** %12, i64 0
  store %struct.Shape* %5, %struct.Shape** %13, align 8, !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.Shape*, %struct.Shape** %12, i64 1
  store %struct.Shape* %7, %struct.Shape** %14, align 8, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = icmp ult i64 0, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4
  %21 = bitcast i8* %20 to %struct.Shape**
  %22 = getelementptr inbounds %struct.Shape*, %struct.Shape** %21, i64 0
  %23 = load %struct.Shape*, %struct.Shape** %22, align 8, !alias.scope !4, !noalias !3
  %24 = call i32 @shift(%struct.Shape* %23, i32 5)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4
  %29 = icmp ult i64 1, %28
  br i1 %29, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %28)
  unreachable

bounds.ok.1:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4
  %32 = bitcast i8* %31 to %struct.Shape**
  %33 = getelementptr inbounds %struct.Shape*, %struct.Shape** %32, i64 1
  %34 = load %struct.Shape*, %struct.Shape** %33, align 8, !alias.scope !4, !noalias !3
  %35 = call i32 @shift(%struct.Shape* %34, i32 5)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
  %37 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %38 = getelementptr inbounds %struct.Square, %struct.Square* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  call void @nish_print(i8* %40)
  %41 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %42 = getelementptr inbounds %struct.Square, %struct.Square* %41, i32 0, i32 2
  %43 = load i32, i32* %42, align 4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  %45 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %46 = getelementptr inbounds %struct.Circle, %struct.Circle* %45, i32 0, i32 2
  %47 = load i32, i32* %46, align 4
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
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
