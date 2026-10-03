%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"bad \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  br label %cond.end

cond.end:
  %4 = phi i32 [ %3, %cond.true ], [ -1, %cond.false ]
  ret i32 %4
}

define noundef i32 @nish_main() #0 {
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
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  %14 = call %struct.nish_result.i32.str* @parse(i32 -3)
  store %struct.nish_result.i32.str* %14, %struct.nish_result.i32.str** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 3
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %total.addr, align 4
  %18 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %19 = call i32 @take(%struct.nish_result.i32.str* %18)
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %total.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = call %struct.nish_result.i32.str* @parse(i32 %23)
  store %struct.nish_result.i32.str* %24, %struct.nish_result.i32.str** %s.addr, align 8
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %27 = load i32, i32* %total.addr, align 4
  %28 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %s.addr, align 8
  %29 = call i32 @take(%struct.nish_result.i32.str* %28)
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %31, i32* %total.addr, align 4
  %33 = load i32, i32* %total.addr, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }
