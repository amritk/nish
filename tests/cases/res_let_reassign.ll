%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_result.str.str = type { i1, i8*, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"three\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"empty: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"0\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"negative \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"odd \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal noundef i32 @pick(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = srem i32 %n, 3
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  %6 = load i1, i1* %5, align 1
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %9, align 8
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ -1, %res.alt ]
  ret i32 %15
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parse(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %s)
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.nish_result.i32.str*
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  store i1 false, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 2
  store i8* %4, i8** %8, align 8
  ret %struct.nish_result.i32.str* %6

if.end:
  %9 = bitcast i8* %s to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call i8* @nish_alloc_struct(i64 16)
  %13 = bitcast i8* %12 to %struct.nish_result.i32.str*
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 0
  store i1 true, i1* %14, align 1
  %15 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 1
  store i32 %11, i32* %15, align 4
  ret %struct.nish_result.i32.str* %13
}

define internal noundef i32 @parseOrZero(i8* noundef nonnull noalias readonly align 8 %s) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @parse(i8* %s)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %r.addr, align 8
  %1 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = call %struct.nish_result.i32.str* @parse(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store %struct.nish_result.i32.str* %5, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %6 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ -1, %res.alt ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %11
}

define internal noundef i32 @keepsOld(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %old.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  store %struct.nish_result.i32.str* %2, %struct.nish_result.i32.str** %old.addr, align 8
  %3 = add nsw i32 %n, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 true, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 1
  store i32 %3, i32* %5, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  %6 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %old.addr, align 8
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ 0, %res.alt ]
  %12 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %16 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %15, i32 0, i32 0
  %17 = load i1, i1* %16, align 1
  br i1 %17, label %res.ok.1, label %res.alt.1

res.ok.1:
  %18 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %15, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %20 = phi i32 [ %19, %res.ok.1 ], [ 0, %res.alt.1 ]
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %res.end ], [ 0, %res.end.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @viaClosure(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %v.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = icmp sgt i32 %n, 2
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 0
  %5 = load i1, i1* %4, align 1
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = mul nsw i32 %n, 2
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 true, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 1
  store i32 %7, i32* %9, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ 0, %res.alt ]
  store i32 %15, i32* %v.addr, align 4
  %16 = load i32, i32* %v.addr, align 4
  %17 = call i32 @apply$fn.17.viaClosure$arrow0(i32 %16)
  ret i32 %17
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @returned(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.str*
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  store i32 %n, i32* %3, align 4
  store %struct.nish_result.i32.str* %1, %struct.nish_result.i32.str** %r.addr, align 8
  %4 = icmp slt i32 %n, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = call i8* @nish_str_from_i32(i32 %n)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8* %9)
  %11 = call i8* @nish_alloc_struct(i64 16)
  %12 = bitcast i8* %11 to %struct.nish_result.i32.str*
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %12, i32 0, i32 0
  store i1 false, i1* %13, align 1
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %12, i32 0, i32 2
  store i8* %10, i8** %14, align 8
  store %struct.nish_result.i32.str* %12, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %15 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  ret %struct.nish_result.i32.str* %15
}

define internal { i1, i32, i32 } @returnedByValue(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %r.addr, align 8
  %2 = icmp slt i32 %n, 0
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %3, i32 0, i32 0
  %5 = load i1, i1* %4, align 1
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 false, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %n, i32* %8, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %r.addr, align 8
  br label %if.end

if.end:
  %9 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %9, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  %12 = insertvalue { i1, i32, i32 } undef, i1 %11, 0
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %9, i32 0, i32 2
  %14 = load i32, i32* %13, align 4
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %9, i32 0, i32 1
  %16 = load i32, i32* %15, align 4
  %17 = insertvalue { i1, i32, i32 } %12, i32 %16, 1
  %18 = insertvalue { i1, i32, i32 } %17, i32 %14, 2
  ret { i1, i32, i32 } %18
}

define internal void @pushInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.str*
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  store i32 %n, i32* %3, align 4
  store %struct.nish_result.i32.str* %1, %struct.nish_result.i32.str** %r.addr, align 8
  %4 = srem i32 %n, 2
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br label %land.end

land.end:
  %9 = phi i1 [ false, %entry ], [ %8, %land.rhs ]
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = call i8* @nish_str_from_i32(i32 %n)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* %10)
  %12 = call i8* @nish_alloc_struct(i64 16)
  %13 = bitcast i8* %12 to %struct.nish_result.i32.str*
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 0
  store i1 false, i1* %14, align 1
  %15 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 2
  store i8* %11, i8** %15, align 8
  store %struct.nish_result.i32.str* %13, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %16 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to %struct.nish_result.i32.str**
  %25 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %24, i64 %18
  store %struct.nish_result.i32.str* %16, %struct.nish_result.i32.str** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  ret void
}

define internal noundef i32 @lastOfLoop(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %prev.addr = alloca %struct.nish_result.i32.str*, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 -1, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  store %struct.nish_result.i32.str* %2, %struct.nish_result.i32.str** %prev.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %prev.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  store %struct.nish_result.i32.str* %8, %struct.nish_result.i32.str** %prev.addr, align 8
  br label %if.end

if.end:
  %9 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %9, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %12, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  %15 = xor i1 %14, true
  br label %lor.end

lor.end:
  %16 = phi i1 [ true, %if.end ], [ %15, %lor.rhs ]
  br i1 %16, label %if.then.1, label %if.end.1

if.then.1:
  %17 = load i32, i32* %i.addr, align 4
  %18 = call i8* @nish_alloc_struct(i64 16)
  %19 = bitcast i8* %18 to %struct.nish_result.i32.str*
  %20 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %19, i32 0, i32 0
  store i1 true, i1* %20, align 1
  %21 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %19, i32 0, i32 1
  store i32 %17, i32* %21, align 4
  store %struct.nish_result.i32.str* %19, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %prev.addr, align 8
  %25 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %24, i32 0, i32 0
  %26 = load i1, i1* %25, align 1
  br i1 %26, label %res.ok, label %res.alt

res.ok:
  %27 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %24, i32 0, i32 1
  %28 = load i32, i32* %27, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %29 = phi i32 [ %28, %res.ok ], [ -9, %res.alt ]
  %30 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %29, i32 100)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %34 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %33, i32 0, i32 0
  %35 = load i1, i1* %34, align 1
  br i1 %35, label %res.ok.1, label %res.alt.1

res.ok.1:
  %36 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %33, i32 0, i32 1
  %37 = load i32, i32* %36, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %38 = phi i32 [ %37, %res.ok.1 ], [ -9, %res.alt.1 ]
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %40

ovf.fail:
  %ovf.op = phi i32 [ 2, %res.end ], [ 0, %res.end.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 i8* @label(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.str.str*, align 8
  %nish_result.str.str.obj = alloca %struct.nish_result.str.str, align 8
  %nish_result.str.str.obj.1 = alloca %struct.nish_result.str.str, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8* %0)
  %2 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %nish_result.str.str.obj, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %nish_result.str.str.obj, i32 0, i32 1
  store i8* %1, i8** %3, align 8
  store %struct.nish_result.str.str* %nish_result.str.str.obj, %struct.nish_result.str.str** %r.addr, align 8
  %4 = icmp sgt i32 %n, 3
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load %struct.nish_result.str.str*, %struct.nish_result.str.str** %r.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = call i8* @nish_str_from_i32(i32 %n)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %9)
  %11 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %nish_result.str.str.obj.1, i32 0, i32 0
  store i1 true, i1* %11, align 1
  %12 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %nish_result.str.str.obj.1, i32 0, i32 1
  store i8* %10, i8** %12, align 8
  store %struct.nish_result.str.str* %nish_result.str.str.obj.1, %struct.nish_result.str.str** %r.addr, align 8
  br label %if.end

if.end:
  %13 = load %struct.nish_result.str.str*, %struct.nish_result.str.str** %r.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  br i1 %15, label %res.ok, label %res.alt

res.ok:
  %16 = getelementptr inbounds %struct.nish_result.str.str, %struct.nish_result.str.str* %13, i32 0, i32 1
  %17 = load i8*, i8** %16, align 8
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %18 = phi i8* [ %17, %res.ok ], [ bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), %res.alt ]
  ret i8* %18
}

define internal noundef i32 @selfAssign(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.str*
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  store i32 %n, i32* %3, align 4
  store %struct.nish_result.i32.str* %1, %struct.nish_result.i32.str** %r.addr, align 8
  %4 = icmp sgt i32 %n, 5
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  br label %cond.end

cond.false:
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.nish_result.i32.str*
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 0
  store i1 true, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 1
  store i32 0, i32* %9, align 4
  br label %cond.end

cond.end:
  %10 = phi %struct.nish_result.i32.str* [ %5, %cond.true ], [ %7, %cond.false ]
  store %struct.nish_result.i32.str* %10, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %12 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %11, i32 0, i32 0
  %13 = load i1, i1* %12, align 1
  br i1 %13, label %res.ok, label %res.alt

res.ok:
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %11, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %16 = phi i32 [ %15, %res.ok ], [ -1, %res.alt ]
  ret i32 %16
}

define internal noundef nonnull align 8 i8* @flat() #1 {
entry:
  %total.addr = alloca i32, align 4
  %before.addr = alloca i64, align 8
  %same.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  %0 = call i64 @nish_arena_used()
  store i64 %0, i64* %before.addr, align 8
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 100000
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %i.addr, align 4
  %4 = srem i32 %3, 1000
  store i32 %4, i32* %n.addr, align 4
  %5 = load i32, i32* %total.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = call i32 @pick(i32 %6)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = load i32, i32* %n.addr, align 4
  %12 = srem i32 %11, 2
  %13 = icmp eq i32 %12, 0
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %14 = phi i8* [ bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), %cond.true ], [ bitcast ({ i64, [4 x i8] }* @.str.9 to i8*), %cond.false ]
  %15 = call i32 @parseOrZero(i8* %14)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = load i32, i32* %n.addr, align 4
  %20 = call i32 @keepsOld(i32 %19)
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %24 = srem i32 %22, 1000003
  store i32 %24, i32* %total.addr, align 4
  %25 = load i32, i32* %total.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = call i32 @viaClosure(i32 %26)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %31 = load i32, i32* %n.addr, align 4
  %32 = srem i32 %31, 4
  %33 = call i32 @lastOfLoop(i32 %32)
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %37 = srem i32 %35, 1000003
  store i32 %37, i32* %total.addr, align 4
  %38 = call i64 @nish_arena_used()
  %39 = load i64, i64* %before.addr, align 8
  %40 = icmp ne i64 %38, %39
  br i1 %40, label %if.then, label %if.end

if.then:
  store i1 false, i1* %same.addr, align 1
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %41 = load i32, i32* %i.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %43 = load i1, i1* %same.addr, align 1
  %44 = select i1 %43, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %46 = load i32, i32* %total.addr, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %45, i8* %47)
  ret i8* %48

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %a.addr = alloca %struct.nish_result.i32.str*, align 8
  %b.addr = alloca %struct.nish_result.i32.str*, align 8
  %c.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %d.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %oks.addr = alloca i32, align 4
  %x.addr = alloca %struct.nish_result.i32.str*, align 8
  %forof.idx = alloca i64, align 8
  %labels.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @pick(i32 4)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %3 = call i32 @pick(i32 6)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @parseOrZero(i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %9 = call i32 @parseOrZero(i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %8, i8* %10)
  call void @nish_print(i8* %11)
  %12 = call i32 @keepsOld(i32 4)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = call i32 @viaClosure(i32 1)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %17 = call i32 @viaClosure(i32 5)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %16, i8* %18)
  call void @nish_print(i8* %19)
  %20 = call %struct.nish_result.i32.str* @returned(i32 7)
  store %struct.nish_result.i32.str* %20, %struct.nish_result.i32.str** %a.addr, align 8
  %21 = call %struct.nish_result.i32.str* @returned(i32 -2)
  store %struct.nish_result.i32.str* %21, %struct.nish_result.i32.str** %b.addr, align 8
  %22 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %a.addr, align 8
  %23 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %22, i32 0, i32 0
  %24 = load i1, i1* %23, align 1
  br i1 %24, label %res.ok, label %res.alt

res.ok:
  %25 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %22, i32 0, i32 1
  %26 = load i32, i32* %25, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %27 = phi i32 [ %26, %res.ok ], [ 0, %res.alt ]
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %30 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %b.addr, align 8
  %31 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %30, i32 0, i32 0
  %32 = load i1, i1* %31, align 1
  %33 = xor i1 %32, true
  %34 = select i1 %33, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %35 = call i8* @nish_str_concat(i8* %29, i8* %34)
  call void @nish_print(i8* %35)
  %36 = call { i1, i32, i32 } @returnedByValue(i32 8)
  %37 = extractvalue { i1, i32, i32 } %36, 0
  %38 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %37, i1* %38, align 1
  %39 = extractvalue { i1, i32, i32 } %36, 1
  %40 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %39, i32* %40, align 4
  %41 = extractvalue { i1, i32, i32 } %36, 2
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %41, i32* %42, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %c.addr, align 8
  %43 = call { i1, i32, i32 } @returnedByValue(i32 -3)
  %44 = extractvalue { i1, i32, i32 } %43, 0
  %45 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %44, i1* %45, align 1
  %46 = extractvalue { i1, i32, i32 } %43, 1
  %47 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %46, i32* %47, align 4
  %48 = extractvalue { i1, i32, i32 } %43, 2
  %49 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %48, i32* %49, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %d.addr, align 8
  %50 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %c.addr, align 8
  %51 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %50, i32 0, i32 0
  %52 = load i1, i1* %51, align 1
  br i1 %52, label %res.ok.1, label %res.alt.1

res.ok.1:
  %53 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %50, i32 0, i32 1
  %54 = load i32, i32* %53, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %55 = phi i32 [ %54, %res.ok.1 ], [ 0, %res.alt.1 ]
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %58 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %d.addr, align 8
  %59 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %58, i32 0, i32 0
  %60 = load i1, i1* %59, align 1
  %61 = xor i1 %60, true
  %62 = select i1 %61, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %63 = call i8* @nish_str_concat(i8* %57, i8* %62)
  call void @nish_print(i8* %63)
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %67 = load i32, i32* %i.addr, align 4
  %68 = icmp slt i32 %67, 5
  br i1 %68, label %for.body, label %for.end

for.body:
  %69 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %70 = load i32, i32* %i.addr, align 4
  call void @pushInto(%struct.nish_array* %69, i32 %70)
  br label %for.inc

for.inc:
  %71 = load i32, i32* %i.addr, align 4
  %72 = add nsw i32 %71, 1
  store i32 %72, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %oks.addr, align 4
  %73 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %74 = load i64, i64* %forof.idx, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = icmp ult i64 %74, %76
  br i1 %77, label %forof.body, label %forof.end

forof.body:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %80 = bitcast i8* %79 to %struct.nish_result.i32.str**
  %81 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %80, i64 %74
  %82 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %81, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_result.i32.str* %82, %struct.nish_result.i32.str** %x.addr, align 8
  %83 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %x.addr, align 8
  %84 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %83, i32 0, i32 0
  %85 = load i1, i1* %84, align 1
  br i1 %85, label %if.then, label %if.end

if.then:
  %86 = load i32, i32* %oks.addr, align 4
  %87 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %x.addr, align 8
  %88 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %87, i32 0, i32 0
  %89 = load i1, i1* %88, align 1
  br i1 %89, label %res.ok.2, label %res.alt.2

res.ok.2:
  %90 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %87, i32 0, i32 1
  %91 = load i32, i32* %90, align 4
  br label %res.end.2

res.alt.2:
  br label %res.end.2

res.end.2:
  %92 = phi i32 [ %91, %res.ok.2 ], [ 0, %res.alt.2 ]
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %92)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %94, i32* %oks.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %96 = load i64, i64* %forof.idx, align 8
  %97 = add i64 %96, 1
  store i64 %97, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %98 = load i32, i32* %oks.addr, align 4
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %101 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = trunc i64 %103 to i32
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %100, i8* %105)
  call void @nish_print(i8* %106)
  %107 = call i32 @lastOfLoop(i32 0)
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %110 = call i32 @lastOfLoop(i32 1)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %109, i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %114 = call i32 @lastOfLoop(i32 5)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  %116 = call i8* @nish_str_concat(i8* %113, i8* %115)
  call void @nish_print(i8* %116)
  %117 = call i32 @selfAssign(i32 9)
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %120 = call i32 @selfAssign(i32 2)
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %119, i8* %121)
  call void @nish_print(i8* %122)
  %123 = call i8* @label(i32 1)
  %124 = call i8* @label(i32 5)
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %127 = bitcast [2 x i8*]* %arr.data to i8*
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %127, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %127 to i8**
  %130 = getelementptr inbounds i8*, i8** %129, i64 0
  store i8* %123, i8** %130, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %131 = getelementptr inbounds i8*, i8** %129, i64 1
  store i8* %124, i8** %131, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %labels.addr, align 8
  %132 = load %struct.nish_array*, %struct.nish_array** %labels.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %134 = load i8*, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %135 = bitcast i8* %134 to i8**
  %136 = getelementptr inbounds i8*, i8** %135, i64 0
  %137 = load i8*, i8** %136, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %labels.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %142 = bitcast i8* %141 to i8**
  %143 = getelementptr inbounds i8*, i8** %142, i64 1
  %144 = load i8*, i8** %143, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %145 = call i8* @nish_str_concat(i8* %138, i8* %144)
  call void @nish_print(i8* %145)
  %146 = call i8* @flat()
  call void @nish_print(i8* %146)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @viaClosure$arrow0(i32 noundef %v) #1 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %v, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @apply$fn.17.viaClosure$arrow0(i32 noundef %cap.0) #1 {
entry:
  %0 = call i32 @viaClosure$arrow0(i32 %cap.0)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
