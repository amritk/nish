%struct.Point = type { i32, i32 }
%struct.Box = type { %struct.Point* }
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @sts_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #5 {
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

define void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Point* noundef nonnull align 8 dereferenceable(8) %item) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.Point* %item, %struct.Point** %0, align 8
  ret void
}

define noundef nonnull align 8 dereferenceable(8) %struct.Point* @keep(%struct.Point* noundef nonnull align 8 dereferenceable(8) %p) #1 {
entry:
  ret %struct.Point* %p
}

define noundef nonnull align 8 dereferenceable(8) %struct.Point* @make() #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 1, i32 2)
  ret %struct.Point* %1
}

define noundef nonnull align 8 dereferenceable(8) %struct.Box* @boxed() #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Box*
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 3, i32 4)
  call void @Box.constructor(%struct.Box* %1, %struct.Point* %3)
  ret %struct.Box* %1
}

define void @stash(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 5, i32 6)
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %xs, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8
  %9 = bitcast i8* %8 to %struct.Point**
  %10 = getelementptr inbounds %struct.Point*, %struct.Point** %9, i64 %3
  store %struct.Point* %1, %struct.Point** %10, align 8
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8
  %12 = trunc i64 %11 to i32
  ret void
}

define void @field(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %b) #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 7, i32 8)
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store %struct.Point* %1, %struct.Point** %2, align 8
  ret void
}

define noundef i32 @captured() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %q.addr = alloca %struct.Point*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 9, i32 10)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = call %struct.Point* @keep(%struct.Point* %2)
  store %struct.Point* %3, %struct.Point** %q.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  ret i32 %6
}

define noundef i32 @reassigned(i1 noundef zeroext %flag) #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 11, i32 12)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  br i1 %flag, label %if.then, label %if.end

if.then:
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 13, i32 14)
  store %struct.Point* %3, %struct.Point** %p.addr, align 8
  br label %if.end

if.end:
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  ret i32 %6
}

define noundef i32 @aliased() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 15, i32 16)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  store %struct.Point* %0, %struct.Point** %q.addr, align 8
  %1 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  ret i32 %3
}

define noundef i32 @sts_main() #2 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %b.addr = alloca %struct.Box*, align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  %3 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  call void @stash(%struct.sts_array* %3)
  %4 = call %struct.Box* @boxed()
  store %struct.Box* %4, %struct.Box** %b.addr, align 8
  %5 = load %struct.Box*, %struct.Box** %b.addr, align 8
  call void @field(%struct.Box* %5)
  %6 = call %struct.Point* @make()
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8
  %15 = bitcast i8* %14 to %struct.Point**
  %16 = getelementptr inbounds %struct.Point*, %struct.Point** %15, i64 0
  %17 = load %struct.Point*, %struct.Point** %16, align 8
  %18 = getelementptr inbounds %struct.Point, %struct.Point* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  %20 = add i32 %8, %19
  %21 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %22 = getelementptr inbounds %struct.Box, %struct.Box* %21, i32 0, i32 0
  %23 = load %struct.Point*, %struct.Point** %22, align 8
  %24 = getelementptr inbounds %struct.Point, %struct.Point* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4
  %26 = add i32 %20, %25
  %27 = call i32 @captured()
  %28 = add i32 %26, %27
  %29 = call i32 @reassigned(i1 true)
  %30 = add i32 %28, %29
  %31 = call i32 @aliased()
  %32 = add i32 %30, %31
  %33 = call i8* @sts_str_from_i32(i32 %32)
  call void @sts_print(i8* %33)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
