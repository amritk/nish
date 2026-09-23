%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"negative\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"no value, \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  br i1 %3, label %res.ok, label %res.panic

res.panic:
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %k.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.2 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  call void @nish_write(i8* %10, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

res.ok:
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  store i32 %12, i32* %v.addr, align 4
  store i32 50, i32* %i.addr, align 4
  %13 = sub nsw i32 0, 1
  store i32 %13, i32* %c.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load i32, i32* %i.addr, align 4
  %17 = load i32, i32* %k.addr, align 4
  %18 = icmp slt i32 %16, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %res.ok ], [ %18, %land.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i8*, i8** %s.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %20 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %22, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds i8, i8* %20, i64 8
  %27 = getelementptr inbounds i8, i8* %26, i64 %22
  %28 = load i8, i8* %27, align 1
  %29 = zext i8 %28 to i32
  store i32 %29, i32* %c.addr, align 4
  br label %if.end

if.end:
  %30 = load i32, i32* %v.addr, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %33 = load i32, i32* %c.addr, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  call void @nish_print(i8* %35)
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
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
