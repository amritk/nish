%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_free_arena() #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

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

define noundef i32 @sts_main() #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8
  store %struct.sts_array* %1, %struct.sts_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 10
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul i32 %8, %9
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8
  %27 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %24, i64 0, i32 1
  %28 = load i64, i64* %27, align 8
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @sts_array_grow(%struct.sts_array* %24, i64 4)
  br label %push.store.1

push.store.1:
  %30 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %24, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %26
  store i32 100, i32* %33, align 4
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8
  %35 = trunc i64 %34 to i32
  store i32 %35, i32* %n.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = call i8* @sts_str_from_i32(i32 %36)
  call void @sts_print(i8* %37)
  %38 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %39 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = call i8* @sts_str_from_i32(i32 %41)
  call void @sts_print(i8* %42)
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %43 = load i32, i32* %i.addr.1, align 4
  %44 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = icmp slt i32 %43, %47
  br i1 %48, label %for.body.1, label %for.end.1

for.body.1:
  %49 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %50 = load i32, i32* %i.addr.1, align 4
  %51 = sext i32 %50 to i64
  %52 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %49, i64 0, i32 0
  %53 = load i64, i64* %52, align 8
  %54 = icmp ult i64 %51, %53
  br i1 %54, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %51, i64 %53)
  unreachable

bounds.ok:
  %55 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %49, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  %59 = load i32, i32* %58, align 4
  %60 = call i8* @sts_str_from_i32(i32 %59)
  call void @sts_print(i8* %60)
  br label %for.inc.1

for.inc.1:
  %61 = load i32, i32* %i.addr.1, align 4
  %62 = add i32 %61, 1
  store i32 %62, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
