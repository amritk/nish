%struct.Point = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @sumX(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %q) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %q, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @sts_main() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %q.addr = alloca %struct.Point*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 3, i32 4)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 10, i32 20)
  store %struct.Point* %3, %struct.Point** %q.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = call i32 @Point.manhattan(%struct.Point* %4)
  %6 = call i8* @sts_str_from_i32(i32 %5)
  call void @sts_print(i8* %6)
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %8 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %9 = call i32 @sumX(%struct.Point* %7, %struct.Point* %8)
  %10 = call i8* @sts_str_from_i32(i32 %9)
  call void @sts_print(i8* %10)
  %11 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
