%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"negative\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.str*
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8** %4, align 8
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.nish_result.i32.str*
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  store i1 true, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 1
  store i32 %n, i32* %8, align 4
  br label %cond.end

cond.end:
  %9 = phi %struct.nish_result.i32.str* [ %2, %cond.true ], [ %6, %cond.false ]
  ret %struct.nish_result.i32.str* %9
}

define noundef i32 @nish_main() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %v.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %s.addr, align 8
  store i32 100, i32* %k.addr, align 4
  %0 = call %struct.nish_result.i32.str* @parse(i32 1)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %r.addr, align 8
  %1 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  br i1 %3, label %res.ok, label %res.alt

res.ok:
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  %5 = load i32, i32* %4, align 4
  br label %res.end

res.alt:
  %6 = load i8*, i8** %s.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %k.addr, align 4
  br label %res.end

res.end:
  %10 = phi i32 [ %5, %res.ok ], [ %9, %res.alt ]
  store i32 %10, i32* %v.addr, align 4
  store i32 50, i32* %i.addr, align 4
  %11 = sub nsw i32 0, 1
  store i32 %11, i32* %c.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %i.addr, align 4
  %15 = load i32, i32* %k.addr, align 4
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %res.end ], [ %16, %land.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i8*, i8** %s.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %18 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds i8, i8* %18, i64 8
  %25 = getelementptr inbounds i8, i8* %24, i64 %20
  %26 = load i8, i8* %25, align 1
  %27 = zext i8 %26 to i32
  store i32 %27, i32* %c.addr, align 4
  br label %if.end

if.end:
  %28 = load i32, i32* %v.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %31 = load i32, i32* %c.addr, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %30, i8* %32)
  call void @nish_print(i8* %33)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
