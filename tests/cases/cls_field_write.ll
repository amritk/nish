%struct.Counter = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #3 {
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

define void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i32 %step, i32* %1, align 4
  ret void
}

define void @bump(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %4, i32* %5, align 4
  ret void
}

define noundef i32 @bumpTwice(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  call void @bump(%struct.Counter* %c)
  call void @bump(%struct.Counter* %c)
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @sts_main() #0 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Counter*
  call void @Counter.constructor(%struct.Counter* %1, i32 5)
  store %struct.Counter* %1, %struct.Counter** %c.addr, align 8
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %2, i32 0, i32 1
  store i32 7, i32* %3, align 4
  %4 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %5 = call i32 @bumpTwice(%struct.Counter* %4)
  %6 = call i8* @sts_str_from_i32(i32 %5)
  call void @sts_print(i8* %6)
  %7 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %8 = getelementptr inbounds %struct.Counter, %struct.Counter* %7, i32 0, i32 0
  store i32 100, i32* %8, align 4
  %9 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %10 = getelementptr inbounds %struct.Counter, %struct.Counter* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = call i8* @sts_str_from_i32(i32 %11)
  call void @sts_print(i8* %12)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
