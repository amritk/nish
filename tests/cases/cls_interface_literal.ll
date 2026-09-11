%struct.Pair = type { i32, i32 }
%struct.Tagged = type { i8*, i1, %struct.Pair* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal noundef nonnull align 8 dereferenceable(8) %struct.Pair* @swap(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
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

define internal noundef i32 @describe(%struct.Tagged* noundef nonnull readonly align 8 dereferenceable(24) nocapture %t) #0 {
entry:
  %0 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 1
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8
  call void @nish_print(i8* %3)
  br label %if.end

if.end:
  %4 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 2
  %5 = load %struct.Pair*, %struct.Pair** %4, align 8
  %6 = getelementptr inbounds %struct.Pair, %struct.Pair* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = mul nsw i32 %7, 10
  %9 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %t, i32 0, i32 2
  %10 = load %struct.Pair*, %struct.Pair** %9, align 8
  %11 = getelementptr inbounds %struct.Pair, %struct.Pair* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = add nsw i32 %8, %12
  ret i32 %13
}

define noundef i32 @nish_main() #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %q.addr = alloca %struct.Pair*, align 8
  %second.addr = alloca i32, align 4
  %t.addr = alloca %struct.Tagged*, align 8
  %Tagged.obj = alloca %struct.Tagged, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
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
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  store i32 9, i32* %second.addr, align 4
  %10 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %10, align 8
  %11 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 1
  store i1 true, i1* %11, align 1
  %12 = call i8* @nish_alloc_struct(i64 8)
  %13 = bitcast i8* %12 to %struct.Pair*
  %14 = getelementptr inbounds %struct.Pair, %struct.Pair* %13, i32 0, i32 0
  store i32 4, i32* %14, align 4
  %15 = load i32, i32* %second.addr, align 4
  %16 = getelementptr inbounds %struct.Pair, %struct.Pair* %13, i32 0, i32 1
  store i32 %15, i32* %16, align 4
  %17 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 2
  store %struct.Pair* %13, %struct.Pair** %17, align 8
  store %struct.Tagged* %Tagged.obj, %struct.Tagged** %t.addr, align 8
  %18 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %19 = call i32 @describe(%struct.Tagged* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %22 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %23 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %21, i32 0, i32 2
  store %struct.Pair* %22, %struct.Pair** %23, align 8
  %24 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %25 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %24, i32 0, i32 2
  %26 = load %struct.Pair*, %struct.Pair** %25, align 8
  %27 = getelementptr inbounds %struct.Pair, %struct.Pair* %26, i32 0, i32 0
  store i32 7, i32* %27, align 4
  %28 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %29 = getelementptr inbounds %struct.Pair, %struct.Pair* %28, i32 0, i32 0
  %30 = load i32, i32* %29, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
