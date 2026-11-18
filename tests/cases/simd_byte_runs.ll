%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_const_0_LENGTHS.data = private unnamed_addr constant [12 x i32] [i32 0, i32 1, i32 2, i32 7, i32 15, i32 16, i32 17, i32 31, i32 32, i32 33, i32 47, i32 100], align 16
@nish_const_0_LENGTHS = internal constant %struct.nish_array { i64 12, i64 12, i8* bitcast ([12 x i32]* @nish_const_0_LENGTHS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"scan \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c" at length \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c", byte \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c": scalar \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", lanes \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"agreed: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" of \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"first difference: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"length 33, z at 32: index \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c", count of a \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"run of 31 before a b at 31: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #6
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #6
declare i32 @llvm.ctlz.i32(i32, i1) #6
declare i32 @llvm.vector.reduce.add.v16i32(<16 x i32>) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal noundef i32 @lowestBit(i32 noundef %bits) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %bits)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = and i32 %bits, %1
  %4 = call i32 @llvm.ctlz.i32(i32 %3, i1 false)
  %5 = sub nsw i32 31, %4
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @indexOfScalar(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = icmp eq i8 %11, %byte
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %i.addr, align 4
  ret i32 %13

if.end:
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef i32 @indexOfLanes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #0 {
entry:
  %n.addr = alloca i32, align 4
  %needle.addr = alloca <16 x i8>, align 8
  %i.addr = alloca i32, align 4
  %bits.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = insertelement <16 x i8> undef, i8 %byte, i32 0
  %4 = shufflevector <16 x i8> %3, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %4, <16 x i8>* %needle.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 16)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp sle i32 %11, %13
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %8 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %16
  %19 = bitcast i8* %18 to <16 x i8>*
  %20 = load <16 x i8>, <16 x i8>* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = load <16 x i8>, <16 x i8>* %needle.addr, align 8
  %22 = icmp eq <16 x i8> %20, %21
  %23 = bitcast <16 x i1> %22 to i16
  %24 = zext i16 %23 to i32
  store i32 %24, i32* %bits.addr, align 4
  %25 = load i32, i32* %bits.addr, align 4
  %26 = icmp ne i32 %25, 0
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %i.addr, align 4
  %28 = load i32, i32* %bits.addr, align 4
  %29 = call i32 @lowestBit(i32 %28)
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %31

if.end:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 16
  store i32 %34, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %37 = load i32, i32* %i.addr, align 4
  %38 = load i32, i32* %n.addr, align 4
  %39 = icmp slt i32 %37, %38
  br i1 %39, label %for.body, label %for.end

for.body:
  %40 = load i32, i32* %i.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %36 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %41
  %44 = load i8, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %45 = icmp eq i8 %44, %byte
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  %46 = load i32, i32* %i.addr, align 4
  ret i32 %46

if.end.1:
  br label %for.inc

for.inc:
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @countScalar(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #0 {
entry:
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = icmp eq i8 %11, %byte
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %count.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %count.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @countLanes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #0 {
entry:
  %n.addr = alloca i32, align 4
  %needle.addr = alloca <16 x i8>, align 8
  %one.addr = alloca <16 x i8>, align 8
  %zero.addr = alloca <16 x i8>, align 8
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = insertelement <16 x i8> undef, i8 %byte, i32 0
  %4 = shufflevector <16 x i8> %3, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %4, <16 x i8>* %needle.addr, align 8
  %5 = insertelement <16 x i8> undef, i8 1, i32 0
  %6 = shufflevector <16 x i8> %5, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %6, <16 x i8>* %one.addr, align 8
  %7 = insertelement <16 x i8> undef, i8 0, i32 0
  %8 = shufflevector <16 x i8> %7, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %8, <16 x i8>* %zero.addr, align 8
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 16)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = load i32, i32* %n.addr, align 4
  %18 = icmp sle i32 %15, %17
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = load i32, i32* %count.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %12 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 %21
  %24 = bitcast i8* %23 to <16 x i8>*
  %25 = load <16 x i8>, <16 x i8>* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = load <16 x i8>, <16 x i8>* %needle.addr, align 8
  %27 = icmp eq <16 x i8> %25, %26
  %28 = load <16 x i8>, <16 x i8>* %one.addr, align 8
  %29 = load <16 x i8>, <16 x i8>* %zero.addr, align 8
  %30 = select <16 x i1> %27, <16 x i8> %28, <16 x i8> %29
  %31 = zext <16 x i8> %30 to <16 x i32>
  %32 = call i32 @llvm.vector.reduce.add.v16i32(<16 x i32> %31)
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %34, i32* %count.addr, align 4
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 16
  store i32 %37, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %40 = load i32, i32* %i.addr, align 4
  %41 = load i32, i32* %n.addr, align 4
  %42 = icmp slt i32 %40, %41
  br i1 %42, label %for.body, label %for.end

for.body:
  %43 = load i32, i32* %i.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = bitcast i8* %39 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 %44
  %47 = load i8, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %48 = icmp eq i8 %47, %byte
  br i1 %48, label %if.then, label %if.end

if.then:
  %49 = load i32, i32* %count.addr, align 4
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 1)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %51, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %53 = load i32, i32* %i.addr, align 4
  %54 = add nsw i32 %53, 1
  store i32 %54, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %55 = load i32, i32* %count.addr, align 4
  ret i32 %55

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @runScalar(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = icmp eq i8 %11, %byte
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16
}

define internal noundef i32 @runLanes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %byte) #0 {
entry:
  %n.addr = alloca i32, align 4
  %needle.addr = alloca <16 x i8>, align 8
  %i.addr = alloca i32, align 4
  %bits.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = insertelement <16 x i8> undef, i8 %byte, i32 0
  %4 = shufflevector <16 x i8> %3, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %4, <16 x i8>* %needle.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 16)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp sle i32 %11, %13
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %8 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %16
  %19 = bitcast i8* %18 to <16 x i8>*
  %20 = load <16 x i8>, <16 x i8>* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = load <16 x i8>, <16 x i8>* %needle.addr, align 8
  %22 = icmp ne <16 x i8> %20, %21
  %23 = bitcast <16 x i1> %22 to i16
  %24 = zext i16 %23 to i32
  store i32 %24, i32* %bits.addr, align 4
  %25 = load i32, i32* %bits.addr, align 4
  %26 = icmp ne i32 %25, 0
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %i.addr, align 4
  %28 = load i32, i32* %bits.addr, align 4
  %29 = call i32 @lowestBit(i32 %28)
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %31

if.end:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 16
  store i32 %34, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %37 = load i32, i32* %i.addr, align 4
  %38 = load i32, i32* %n.addr, align 4
  %39 = icmp slt i32 %37, %38
  br i1 %39, label %land.rhs, label %land.end

land.rhs:
  %40 = load i32, i32* %i.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %36 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %41
  %44 = load i8, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %45 = icmp eq i8 %44, %byte
  br label %land.end

land.end:
  %46 = phi i1 [ false, %while.cond.1 ], [ %45, %land.rhs ]
  br i1 %46, label %while.body.1, label %while.end.1

while.body.1:
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %49 = load i32, i32* %i.addr, align 4
  ret i32 %49

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @letters(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 %seed, i32* %x.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %x.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 75)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 74)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = srem i32 %12, 65537
  store i32 %14, i32* %x.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = load i32, i32* %x.addr, align 4
  %17 = and i32 %16, 7
  %18 = add nsw i32 97, %17
  %19 = trunc i32 %18 to i8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 1)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %21
  store i8 %19, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %33

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @runOfA(i32 noundef %n, i32 noundef %at) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp eq i32 %8, %at
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 98, %cond.true ], [ 97, %cond.false ]
  %11 = trunc i32 %10 to i8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 1)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %13
  store i8 %11, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %25
}

define noundef i32 @nish_main() #0 {
entry:
  %z.addr = alloca i8, align 1
  %a.addr = alloca i8, align 1
  %tried.addr = alloca i32, align 4
  %agreed.addr = alloca i32, align 4
  %first.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %at.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %runs.addr = alloca %struct.nish_array*, align 8
  %pairs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %k.addr = alloca i32, align 4
  %long.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = trunc i32 122 to i8
  store i8 %0, i8* %z.addr, align 1
  %1 = trunc i32 97 to i8
  store i8 %1, i8* %a.addr, align 1
  store i32 0, i32* %tried.addr, align 4
  store i32 0, i32* %agreed.addr, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %first.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_LENGTHS, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_LENGTHS, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %10, i32* %n.addr, align 4
  store i32 -1, i32* %at.addr, align 4
  br label %for.cond

for.cond:
  %11 = load i32, i32* %at.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %n.addr, align 4
  %15 = load i32, i32* %n.addr, align 4
  %16 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %15, i32 7)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 3)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = call %struct.nish_array* @letters(i32 %14, i32 %20)
  store %struct.nish_array* %22, %struct.nish_array** %xs.addr, align 8
  %23 = load i32, i32* %at.addr, align 4
  %24 = icmp sge i32 %23, 0
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = load i32, i32* %at.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = load i8, i8* %z.addr, align 1
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ult i64 %27, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 %27
  store i8 %28, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  %36 = load i32, i32* %n.addr, align 4
  %37 = load i32, i32* %at.addr, align 4
  %38 = call %struct.nish_array* @runOfA(i32 %36, i32 %37)
  store %struct.nish_array* %38, %struct.nish_array** %runs.addr, align 8
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %40 = load i8, i8* %z.addr, align 1
  %41 = call i32 @indexOfScalar(%struct.nish_array* %39, i8 %40)
  %42 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %43 = load i8, i8* %z.addr, align 1
  %44 = call i32 @indexOfLanes(%struct.nish_array* %42, i8 %43)
  %45 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %46 = load i8, i8* %a.addr, align 1
  %47 = call i32 @countScalar(%struct.nish_array* %45, i8 %46)
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = load i8, i8* %a.addr, align 1
  %50 = call i32 @countLanes(%struct.nish_array* %48, i8 %49)
  %51 = load %struct.nish_array*, %struct.nish_array** %runs.addr, align 8
  %52 = load i8, i8* %a.addr, align 1
  %53 = call i32 @runScalar(%struct.nish_array* %51, i8 %52)
  %54 = load %struct.nish_array*, %struct.nish_array** %runs.addr, align 8
  %55 = load i8, i8* %a.addr, align 1
  %56 = call i32 @runLanes(%struct.nish_array* %54, i8 %55)
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %59 = bitcast [6 x i32]* %arr.data to i8*
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %61 = bitcast i8* %59 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  store i32 %41, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %63 = getelementptr inbounds i32, i32* %61, i64 1
  store i32 %44, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %64 = getelementptr inbounds i32, i32* %61, i64 2
  store i32 %47, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %65 = getelementptr inbounds i32, i32* %61, i64 3
  store i32 %50, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %66 = getelementptr inbounds i32, i32* %61, i64 4
  store i32 %53, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = getelementptr inbounds i32, i32* %61, i64 5
  store i32 %56, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pairs.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %pairs.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %73 = load i32, i32* %k.addr, align 4
  %74 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %73, i32 1)
  %75 = extractvalue { i32, i1 } %74, 0
  %76 = extractvalue { i32, i1 } %74, 1
  br i1 %76, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %77 = trunc i64 %70 to i32
  %78 = icmp slt i32 %75, %77
  br i1 %78, label %for.body.1, label %for.end.1

for.body.1:
  %79 = load i32, i32* %tried.addr, align 4
  %80 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 1)
  %81 = extractvalue { i32, i1 } %80, 0
  %82 = extractvalue { i32, i1 } %80, 1
  br i1 %82, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %81, i32* %tried.addr, align 4
  %83 = load i32, i32* %k.addr, align 4
  %84 = sext i32 %83 to i64
  %85 = bitcast i8* %72 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 %84
  %87 = load i32, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %88 = load i32, i32* %k.addr, align 4
  %89 = add nsw i32 %88, 1
  %90 = sext i32 %89 to i64
  %91 = bitcast i8* %72 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 %90
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %94 = icmp eq i32 %87, %93
  br i1 %94, label %if.then.1, label %if.else

if.then.1:
  %95 = load i32, i32* %agreed.addr, align 4
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %95, i32 1)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %97, i32* %agreed.addr, align 4
  br label %if.end.1

if.else:
  %99 = load i8*, i8** %first.addr, align 8
  %100 = call zeroext i1 @nish_str_eq(i8* %99, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br i1 %100, label %if.then.2, label %if.end.2

if.then.2:
  %101 = load i32, i32* %k.addr, align 4
  %102 = sdiv i32 %101, 2
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*))
  %106 = load i32, i32* %n.addr, align 4
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %105, i8* %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %110 = load i32, i32* %at.addr, align 4
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %109, i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %114 = load i32, i32* %k.addr, align 4
  %115 = sext i32 %114 to i64
  %116 = bitcast i8* %72 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 %115
  %118 = load i32, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %119 = call i8* @nish_str_from_i32(i32 %118)
  %120 = call i8* @nish_str_concat(i8* %113, i8* %119)
  %121 = call i8* @nish_str_concat(i8* %120, i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*))
  %122 = load i32, i32* %k.addr, align 4
  %123 = add nsw i32 %122, 1
  %124 = sext i32 %123 to i64
  %125 = bitcast i8* %72 to i32*
  %126 = getelementptr inbounds i32, i32* %125, i64 %124
  %127 = load i32, i32* %126, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %121, i8* %128)
  store i8* %129, i8** %first.addr, align 8
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %130 = load i32, i32* %k.addr, align 4
  %131 = add nsw i32 %130, 2
  store i32 %131, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %132 = load i32, i32* %at.addr, align 4
  %133 = add nsw i32 %132, 1
  store i32 %133, i32* %at.addr, align 4
  br label %for.cond

for.end:
  br label %forof.inc

forof.inc:
  %134 = load i64, i64* %forof.idx, align 8
  %135 = add i64 %134, 1
  store i64 %135, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %136 = load i32, i32* %agreed.addr, align 4
  %137 = call i8* @nish_str_from_i32(i32 %136)
  %138 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.6 to i8*), i8* %137)
  %139 = call i8* @nish_str_concat(i8* %138, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*))
  %140 = load i32, i32* %tried.addr, align 4
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %139, i8* %141)
  call void @nish_print(i8* %142)
  %143 = load i8*, i8** %first.addr, align 8
  %144 = call zeroext i1 @nish_str_eq(i8* %143, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  %145 = xor i1 %144, true
  br i1 %145, label %if.then.3, label %if.end.3

if.then.3:
  %146 = load i8*, i8** %first.addr, align 8
  %147 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.8 to i8*), i8* %146)
  call void @nish_print(i8* %147)
  br label %if.end.3

if.end.3:
  %148 = call %struct.nish_array* @letters(i32 33, i32 9)
  store %struct.nish_array* %148, %struct.nish_array** %long.addr, align 8
  %149 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %150 = load i8, i8* %z.addr, align 1
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  %152 = load i64, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %153 = icmp ult i64 32, %152
  br i1 %153, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 32, i64 %152)
  unreachable

bounds.ok.1:
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %156 = bitcast i8* %155 to i8*
  %157 = getelementptr inbounds i8, i8* %156, i64 32
  store i8 %150, i8* %157, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %158 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %159 = load i8, i8* %z.addr, align 1
  %160 = call i32 @indexOfLanes(%struct.nish_array* %158, i8 %159)
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* bitcast ({ i64, [27 x i8] }* @.str.9 to i8*), i8* %161)
  %163 = call i8* @nish_str_concat(i8* %162, i8* bitcast ({ i64, [14 x i8] }* @.str.10 to i8*))
  %164 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %165 = load i8, i8* %a.addr, align 1
  %166 = call i32 @countLanes(%struct.nish_array* %164, i8 %165)
  %167 = call i8* @nish_str_from_i32(i32 %166)
  %168 = call i8* @nish_str_concat(i8* %163, i8* %167)
  call void @nish_print(i8* %168)
  %169 = call %struct.nish_array* @runOfA(i32 40, i32 31)
  %170 = load i8, i8* %a.addr, align 1
  %171 = call i32 @runLanes(%struct.nish_array* %169, i8 %170)
  %172 = call i8* @nish_str_from_i32(i32 %171)
  %173 = call i8* @nish_str_concat(i8* bitcast ({ i64, [29 x i8] }* @.str.11 to i8*), i8* %172)
  call void @nish_print(i8* %173)
  %174 = load i32, i32* %agreed.addr, align 4
  %175 = load i32, i32* %tried.addr, align 4
  %176 = icmp eq i32 %174, %175
  br i1 %176, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %177 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %177

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ], [ 0, %for.cond.1 ], [ 0, %for.body.1 ], [ 0, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
