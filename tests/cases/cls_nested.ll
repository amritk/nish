%struct.Point = type { i32, i32 }
%struct.Segment = type { %struct.Point*, %struct.Point*, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"diag\00" }, align 8
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

define void @Segment.constructor(%struct.Segment* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.Point* noundef nonnull align 8 dereferenceable(8) %from, %struct.Point* noundef nonnull align 8 dereferenceable(8) %to, i8* noundef nonnull noalias readonly align 8 %label) #0 {
entry:
  %0 = getelementptr inbounds %struct.Segment, %struct.Segment* %this, i32 0, i32 0
  store %struct.Point* %from, %struct.Point** %0, align 8
  %1 = getelementptr inbounds %struct.Segment, %struct.Segment* %this, i32 0, i32 1
  store %struct.Point* %to, %struct.Point** %1, align 8
  %2 = getelementptr inbounds %struct.Segment, %struct.Segment* %this, i32 0, i32 2
  store i8* %label, i8** %2, align 8
  ret void
}

define noundef i32 @Segment.dx(%struct.Segment* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Segment, %struct.Segment* %this, i32 0, i32 1
  %1 = load %struct.Point*, %struct.Point** %0, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Segment, %struct.Segment* %this, i32 0, i32 0
  %5 = load %struct.Point*, %struct.Point** %4, align 8
  %6 = getelementptr inbounds %struct.Point, %struct.Point* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = sub i32 %3, %7
  ret i32 %8
}

define noundef nonnull align 8 dereferenceable(8) %struct.Point* @endpoint(%struct.Segment* noundef nonnull readonly align 8 dereferenceable(24) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Segment, %struct.Segment* %s, i32 0, i32 1
  %1 = load %struct.Point*, %struct.Point** %0, align 8
  ret %struct.Point* %1
}

define noundef i32 @sts_main() #0 {
entry:
  %s.addr = alloca %struct.Segment*, align 8
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Segment*
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 1, i32 2)
  %4 = call i8* @sts_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Point*
  call void @Point.constructor(%struct.Point* %5, i32 11, i32 22)
  call void @Segment.constructor(%struct.Segment* %1, %struct.Point* %3, %struct.Point* %5, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  store %struct.Segment* %1, %struct.Segment** %s.addr, align 8
  %6 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %7 = call i32 @Segment.dx(%struct.Segment* %6)
  %8 = call i8* @sts_str_from_i32(i32 %7)
  call void @sts_print(i8* %8)
  %9 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %10 = call %struct.Point* @endpoint(%struct.Segment* %9)
  %11 = getelementptr inbounds %struct.Point, %struct.Point* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = call i8* @sts_str_from_i32(i32 %12)
  call void @sts_print(i8* %13)
  %14 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Segment, %struct.Segment* %14, i32 0, i32 0
  %16 = load %struct.Point*, %struct.Point** %15, align 8
  %17 = getelementptr inbounds %struct.Point, %struct.Point* %16, i32 0, i32 0
  store i32 100, i32* %17, align 4
  %18 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %19 = getelementptr inbounds %struct.Segment, %struct.Segment* %18, i32 0, i32 0
  %20 = load %struct.Point*, %struct.Point** %19, align 8
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4
  %23 = call i8* @sts_str_from_i32(i32 %22)
  call void @sts_print(i8* %23)
  %24 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %25 = getelementptr inbounds %struct.Segment, %struct.Segment* %24, i32 0, i32 2
  %26 = load i8*, i8** %25, align 8
  call void @sts_print(i8* %26)
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
