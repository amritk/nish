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
  %4 = sub nsw i32 0, 1
  br label %cond.end

cond.end:
  %5 = phi i32 [ %3, %cond.true ], [ %4, %cond.false ]
  ret i32 %5
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
  %12 = sub nsw i32 0, 3
  %13 = call %struct.nish_result.i32.str* @parse(i32 %12)
  store %struct.nish_result.i32.str* %13, %struct.nish_result.i32.str** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp slt i32 %14, 3
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %total.addr, align 4
  %17 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %18 = call i32 @take(%struct.nish_result.i32.str* %17)
  %19 = add nsw i32 %16, %18
  store i32 %19, i32* %total.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  %21 = call %struct.nish_result.i32.str* @parse(i32 %20)
  store %struct.nish_result.i32.str* %21, %struct.nish_result.i32.str** %s.addr, align 8
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %24 = load i32, i32* %total.addr, align 4
  %25 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %26 = call i32 @take(%struct.nish_result.i32.str* %25)
  %27 = add nsw i32 %24, %26
  store i32 %27, i32* %total.addr, align 4
  %28 = load i32, i32* %total.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
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
