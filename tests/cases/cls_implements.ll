%struct.Shape = type { i32, i32 }
%struct.Rect = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal void @Rect.constructor(%struct.Rect* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %width, i32 noundef %height) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rect, %struct.Rect* %this, i32 0, i32 0
  store i32 %width, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Rect, %struct.Rect* %this, i32 0, i32 1
  store i32 %height, i32* %1, align 4
  ret void
}

define internal noundef i32 @Rect.area(%struct.Rect* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Rect, %struct.Rect* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Rect, %struct.Rect* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = mul nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @perimeter(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add nsw i32 %1, %3
  %5 = mul nsw i32 2, %4
  ret i32 %5
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Shape* @widest(%struct.Shape* noundef nonnull align 8 dereferenceable(8) %a, %struct.Shape* noundef nonnull align 8 dereferenceable(8) %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %a, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Shape, %struct.Shape* %b, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = icmp sge i32 %1, %3
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi %struct.Shape* [ %a, %cond.true ], [ %b, %cond.false ]
  ret %struct.Shape* %5
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Shape* @grow(%struct.Rect* noundef nonnull align 8 dereferenceable(8) %r, i32 noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rect, %struct.Rect* %r, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, %by
  store i32 %2, i32* %0, align 4
  %3 = bitcast %struct.Rect* %r to %struct.Shape*
  ret %struct.Shape* %3
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca %struct.Rect*, align 8
  %s.addr = alloca %struct.Shape*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Rect*
  call void @Rect.constructor(%struct.Rect* %1, i32 3, i32 4)
  store %struct.Rect* %1, %struct.Rect** %r.addr, align 8
  %2 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %3 = bitcast %struct.Rect* %2 to %struct.Shape*
  %4 = call i32 @perimeter(%struct.Shape* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %7 = bitcast %struct.Rect* %6 to %struct.Shape*
  store %struct.Shape* %7, %struct.Shape** %s.addr, align 8
  %8 = load %struct.Shape*, %struct.Shape** %s.addr, align 8
  %9 = getelementptr inbounds %struct.Shape, %struct.Shape* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %13 = bitcast %struct.Rect* %12 to %struct.Shape*
  %14 = call i8* @nish_alloc_struct(i64 8)
  %15 = bitcast i8* %14 to %struct.Shape*
  %16 = getelementptr inbounds %struct.Shape, %struct.Shape* %15, i32 0, i32 0
  store i32 10, i32* %16, align 4
  %17 = getelementptr inbounds %struct.Shape, %struct.Shape* %15, i32 0, i32 1
  store i32 1, i32* %17, align 4
  %18 = call %struct.Shape* @widest(%struct.Shape* %13, %struct.Shape* %15)
  %19 = getelementptr inbounds %struct.Shape, %struct.Shape* %18, i32 0, i32 0
  %20 = load i32, i32* %19, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %23 = call %struct.Shape* @grow(%struct.Rect* %22, i32 2)
  %24 = getelementptr inbounds %struct.Shape, %struct.Shape* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  %27 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %28 = call i32 @Rect.area(%struct.Rect* %27)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
