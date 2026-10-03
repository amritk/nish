%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"bad \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parse(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.str*
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 0
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 1
  store i32 %n, i32* %4, align 4
  br label %cond.end

cond.false:
  %5 = call i8* @nish_str_from_i32(i32 %n)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %5)
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 2
  store i8* %6, i8** %10, align 8
  br label %cond.end

cond.end:
  %11 = phi %struct.nish_result.i32.str* [ %2, %cond.true ], [ %8, %cond.false ]
  ret %struct.nish_result.i32.str* %11
}

define internal noundef i32 @take(%struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) readonly nocapture %r) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 0
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ %3, %cond.true ], [ -1, %cond.false ]
  ret i32 %4
}

define noundef i32 @nish_main() #2 {
entry:
  %total.addr = alloca i32, align 4
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %s.addr = alloca %struct.nish_result.i32.str*, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  %0 = call %struct.nish_result.i32.str* @parse(i32 1)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %r.addr, align 8
  %1 = load i32, i32* %total.addr, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %total.addr, align 4
  %4 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %5 = call i32 @take(%struct.nish_result.i32.str* %4)
  %6 = add nsw i32 %3, %5
  store i32 %6, i32* %total.addr, align 4
  br label %if.end

if.end:
  %7 = call %struct.nish_result.i32.str* @parse(i32 2)
  store %struct.nish_result.i32.str* %7, %struct.nish_result.i32.str** %r.addr, align 8
  %8 = load i32, i32* %total.addr, align 4
  %9 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %10 = call i32 @take(%struct.nish_result.i32.str* %9)
  %11 = add nsw i32 %8, %10
  store i32 %11, i32* %total.addr, align 4
  %12 = call %struct.nish_result.i32.str* @parse(i32 -3)
  store %struct.nish_result.i32.str* %12, %struct.nish_result.i32.str** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp slt i32 %13, 3
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %total.addr, align 4
  %16 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %17 = call i32 @take(%struct.nish_result.i32.str* %16)
  %18 = add nsw i32 %15, %17
  store i32 %18, i32* %total.addr, align 4
  %19 = load i32, i32* %i.addr, align 4
  %20 = call %struct.nish_result.i32.str* @parse(i32 %19)
  store %struct.nish_result.i32.str* %20, %struct.nish_result.i32.str** %s.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %23 = load i32, i32* %total.addr, align 4
  %24 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %25 = call i32 @take(%struct.nish_result.i32.str* %24)
  %26 = add nsw i32 %23, %25
  store i32 %26, i32* %total.addr, align 4
  %27 = load i32, i32* %total.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  call void @nish_arena_release(i64 %arena.mark)
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
