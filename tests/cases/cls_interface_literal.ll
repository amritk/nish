%struct.Pair = type { i32, i32 }
%struct.Tagged = type { i8*, i1, %struct.Pair* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
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

define noundef nonnull align 8 dereferenceable(8) %struct.Pair* @swap(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  ret %struct.Pair* %1
}

define noundef i32 @describe(%struct.Tagged* noundef nonnull readonly align 8 dereferenceable(24) nocapture %t) #0 {
entry:
  %0 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 1
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8
  call void @sts_print(i8* %3)
  br label %if.end

if.end:
  %4 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 2
  %5 = load %struct.Pair*, %struct.Pair** %4, align 8
  %6 = getelementptr inbounds %struct.Pair, %struct.Pair* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = mul i32 %7, 10
  %9 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 2
  %10 = load %struct.Pair*, %struct.Pair** %9, align 8
  %11 = getelementptr inbounds %struct.Pair, %struct.Pair* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %8, %12
  ret i32 %13
}

define noundef i32 @sts_main() #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %q.addr = alloca %struct.Pair*, align 8
  %second.addr = alloca i32, align 4
  %t.addr = alloca %struct.Tagged*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 1, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 2, i32* %3, align 4
  store %struct.Pair* %1, %struct.Pair** %p.addr, align 8
  %4 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %5 = call %struct.Pair* @swap(%struct.Pair* %4)
  store %struct.Pair* %5, %struct.Pair** %q.addr, align 8
  %6 = load %struct.Pair*, %struct.Pair** %q.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = call i8* @sts_str_from_i32(i32 %8)
  call void @sts_print(i8* %9)
  store i32 9, i32* %second.addr, align 4
  %10 = call i8* @sts_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.Tagged*
  %12 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %11, i32 0, i32 0
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %12, align 8
  %13 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %11, i32 0, i32 1
  store i1 true, i1* %13, align 1
  %14 = call i8* @sts_alloc_struct(i64 8)
  %15 = bitcast i8* %14 to %struct.Pair*
  %16 = getelementptr inbounds %struct.Pair, %struct.Pair* %15, i32 0, i32 0
  store i32 4, i32* %16, align 4
  %17 = load i32, i32* %second.addr, align 4
  %18 = getelementptr inbounds %struct.Pair, %struct.Pair* %15, i32 0, i32 1
  store i32 %17, i32* %18, align 4
  %19 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %11, i32 0, i32 2
  store %struct.Pair* %15, %struct.Pair** %19, align 8
  store %struct.Tagged* %11, %struct.Tagged** %t.addr, align 8
  %20 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %21 = call i32 @describe(%struct.Tagged* %20)
  %22 = call i8* @sts_str_from_i32(i32 %21)
  call void @sts_print(i8* %22)
  %23 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %24 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %25 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %23, i32 0, i32 2
  store %struct.Pair* %24, %struct.Pair** %25, align 8
  %26 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %27 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %26, i32 0, i32 2
  %28 = load %struct.Pair*, %struct.Pair** %27, align 8
  %29 = getelementptr inbounds %struct.Pair, %struct.Pair* %28, i32 0, i32 0
  store i32 7, i32* %29, align 4
  %30 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %31 = getelementptr inbounds %struct.Pair, %struct.Pair* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4
  %33 = call i8* @sts_str_from_i32(i32 %32)
  call void @sts_print(i8* %33)
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
