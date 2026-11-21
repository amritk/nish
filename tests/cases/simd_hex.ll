%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"length \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c" differs: scalar \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", lanes \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"every byte: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"...\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"17 bytes: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"mismatches: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

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

define internal noundef i8 @digit(i32 noundef %nibble) #0 {
entry:
  %0 = icmp slt i32 %nibble, 10
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = add nsw i32 48, %nibble
  br label %cond.end

cond.false:
  %2 = add nsw i32 87, %nibble
  br label %cond.end

cond.end:
  %3 = phi i32 [ %1, %cond.true ], [ %2, %cond.false ]
  %4 = trunc i32 %3 to i8
  ret i8 %4
}

define internal noundef nonnull align 8 i8* @hexScalar(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %n.addr = alloca i32, align 4
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = sext i32 %5 to i64
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 %7)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %10, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = load i32, i32* %n.addr, align 4
  %24 = icmp slt i32 %22, %23
  br i1 %24, label %for.body, label %for.end

for.body:
  %25 = load i32, i32* %i.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %29 = sext i32 %27 to i64
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = bitcast i8* %21 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 %31
  %34 = load i8, i8* %33, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = zext i8 %34 to i32
  %36 = ashr i32 %35, 4
  %37 = call i8 @digit(i32 %36)
  %38 = icmp ult i64 %29, %17
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %29, i64 %17)
  unreachable

bounds.ok:
  %39 = bitcast i8* %19 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 %29
  store i8 %37, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = load i32, i32* %i.addr, align 4
  %42 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %45 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 1)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %48 = sext i32 %46 to i64
  %49 = load i32, i32* %i.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = bitcast i8* %21 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 %50
  %53 = load i8, i8* %52, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = zext i8 %53 to i32
  %55 = and i32 %54, 15
  %56 = call i8 @digit(i32 %55)
  %57 = icmp ult i64 %48, %17
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %48, i64 %17)
  unreachable

bounds.ok.1:
  %58 = bitcast i8* %19 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 %48
  store i8 %56, i8* %59, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %60 = load i32, i32* %i.addr, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %62 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %63 = load i32, i32* %n.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %67 = sext i32 %65 to i64
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = icmp ule i64 0, %67
  %71 = icmp ule i64 %67, %69
  %72 = and i1 %70, %71
  br i1 %72, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %67, i64 %69)
  unreachable

bytes.ok:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = getelementptr inbounds i8, i8* %74, i64 0
  %76 = sub i64 %67, 0
  %77 = call i8* @nish_str_new(i8* %75, i64 %76)
  ret i8* %77

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %for.body ], [ 2, %bounds.ok ], [ 0, %ovf.ok.2 ], [ 2, %for.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 i8* @hexLanes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %n.addr = alloca i32, align 4
  %out.addr = alloca %struct.nish_array*, align 8
  %fifteen.addr = alloca <16 x i8>, align 8
  %ten.addr = alloca <16 x i8>, align 8
  %zeroDigit.addr = alloca <16 x i8>, align 8
  %letterDigit.addr = alloca <16 x i8>, align 8
  %i.addr = alloca i32, align 4
  %v.addr = alloca <16 x i8>, align 8
  %high.addr = alloca <16 x i8>, align 8
  %low.addr = alloca <16 x i8>, align 8
  %highDigits.addr = alloca <16 x i8>, align 8
  %lowDigits.addr = alloca <16 x i8>, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = sext i32 %5 to i64
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 %7)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %10, %struct.nish_array** %out.addr, align 8
  %15 = insertelement <16 x i8> undef, i8 15, i32 0
  %16 = shufflevector <16 x i8> %15, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %16, <16 x i8>* %fifteen.addr, align 8
  %17 = insertelement <16 x i8> undef, i8 10, i32 0
  %18 = shufflevector <16 x i8> %17, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %18, <16 x i8>* %ten.addr, align 8
  %19 = insertelement <16 x i8> undef, i8 48, i32 0
  %20 = shufflevector <16 x i8> %19, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %20, <16 x i8>* %zeroDigit.addr, align 8
  %21 = insertelement <16 x i8> undef, i8 87, i32 0
  %22 = shufflevector <16 x i8> %21, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %22, <16 x i8>* %letterDigit.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %32 = load i32, i32* %i.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 16)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp sle i32 %34, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %i.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %26 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 %39
  %42 = bitcast i8* %41 to <16 x i8>*
  %43 = load <16 x i8>, <16 x i8>* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store <16 x i8> %43, <16 x i8>* %v.addr, align 8
  %44 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %45 = lshr <16 x i8> %44, <i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4, i8 4>
  store <16 x i8> %45, <16 x i8>* %high.addr, align 8
  %46 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %47 = load <16 x i8>, <16 x i8>* %fifteen.addr, align 8
  %48 = and <16 x i8> %46, %47
  store <16 x i8> %48, <16 x i8>* %low.addr, align 8
  %49 = load <16 x i8>, <16 x i8>* %high.addr, align 8
  %50 = load <16 x i8>, <16 x i8>* %ten.addr, align 8
  %51 = icmp ult <16 x i8> %49, %50
  %52 = load <16 x i8>, <16 x i8>* %high.addr, align 8
  %53 = load <16 x i8>, <16 x i8>* %zeroDigit.addr, align 8
  %54 = add <16 x i8> %52, %53
  %55 = load <16 x i8>, <16 x i8>* %high.addr, align 8
  %56 = load <16 x i8>, <16 x i8>* %letterDigit.addr, align 8
  %57 = add <16 x i8> %55, %56
  %58 = select <16 x i1> %51, <16 x i8> %54, <16 x i8> %57
  store <16 x i8> %58, <16 x i8>* %highDigits.addr, align 8
  %59 = load <16 x i8>, <16 x i8>* %low.addr, align 8
  %60 = load <16 x i8>, <16 x i8>* %ten.addr, align 8
  %61 = icmp ult <16 x i8> %59, %60
  %62 = load <16 x i8>, <16 x i8>* %low.addr, align 8
  %63 = load <16 x i8>, <16 x i8>* %zeroDigit.addr, align 8
  %64 = add <16 x i8> %62, %63
  %65 = load <16 x i8>, <16 x i8>* %low.addr, align 8
  %66 = load <16 x i8>, <16 x i8>* %letterDigit.addr, align 8
  %67 = add <16 x i8> %65, %66
  %68 = select <16 x i1> %61, <16 x i8> %64, <16 x i8> %67
  store <16 x i8> %68, <16 x i8>* %lowDigits.addr, align 8
  %69 = load <16 x i8>, <16 x i8>* %highDigits.addr, align 8
  %70 = load <16 x i8>, <16 x i8>* %lowDigits.addr, align 8
  %71 = shufflevector <16 x i8> %69, <16 x i8> %70, <16 x i32> <i32 0, i32 16, i32 1, i32 17, i32 2, i32 18, i32 3, i32 19, i32 4, i32 20, i32 5, i32 21, i32 6, i32 22, i32 7, i32 23>
  %72 = load i32, i32* %i.addr, align 4
  %73 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %72)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %76 = sext i32 %74 to i64
  %77 = add i64 %76, 16
  %78 = icmp ult i64 %76, %29
  %79 = icmp ule i64 %77, %29
  %80 = and i1 %78, %79
  br i1 %80, label %bounds.ok, label %bounds.fail

bounds.fail:
  %81 = add i64 %76, 15
  %82 = select i1 %78, i64 %81, i64 %76
  call void @nish_panic_index(i64 %82, i64 %29)
  unreachable

bounds.ok:
  %83 = bitcast i8* %31 to i8*
  %84 = getelementptr inbounds i8, i8* %83, i64 %76
  %85 = bitcast i8* %84 to <16 x i8>*
  store <16 x i8> %71, <16 x i8>* %85, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = load <16 x i8>, <16 x i8>* %highDigits.addr, align 8
  %87 = load <16 x i8>, <16 x i8>* %lowDigits.addr, align 8
  %88 = shufflevector <16 x i8> %86, <16 x i8> %87, <16 x i32> <i32 8, i32 24, i32 9, i32 25, i32 10, i32 26, i32 11, i32 27, i32 12, i32 28, i32 13, i32 29, i32 14, i32 30, i32 15, i32 31>
  %89 = load i32, i32* %i.addr, align 4
  %90 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %89)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 16)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %96 = sext i32 %94 to i64
  %97 = add i64 %96, 16
  %98 = icmp ult i64 %96, %29
  %99 = icmp ule i64 %97, %29
  %100 = and i1 %98, %99
  br i1 %100, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  %101 = add i64 %96, 15
  %102 = select i1 %98, i64 %101, i64 %96
  call void @nish_panic_index(i64 %102, i64 %29)
  unreachable

bounds.ok.1:
  %103 = bitcast i8* %31 to i8*
  %104 = getelementptr inbounds i8, i8* %103, i64 %96
  %105 = bitcast i8* %104 to <16 x i8>*
  store <16 x i8> %88, <16 x i8>* %105, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %106 = load i32, i32* %i.addr, align 4
  %107 = add nsw i32 %106, 16
  store i32 %107, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %108 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %115 = load i32, i32* %i.addr, align 4
  %116 = load i32, i32* %n.addr, align 4
  %117 = icmp slt i32 %115, %116
  br i1 %117, label %for.body, label %for.end

for.body:
  %118 = load i32, i32* %i.addr, align 4
  %119 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %118)
  %120 = extractvalue { i32, i1 } %119, 0
  %121 = extractvalue { i32, i1 } %119, 1
  br i1 %121, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %122 = sext i32 %120 to i64
  %123 = load i32, i32* %i.addr, align 4
  %124 = sext i32 %123 to i64
  %125 = bitcast i8* %114 to i8*
  %126 = getelementptr inbounds i8, i8* %125, i64 %124
  %127 = load i8, i8* %126, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %128 = zext i8 %127 to i32
  %129 = ashr i32 %128, 4
  %130 = call i8 @digit(i32 %129)
  %131 = icmp ult i64 %122, %110
  br i1 %131, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %122, i64 %110)
  unreachable

bounds.ok.2:
  %132 = bitcast i8* %112 to i8*
  %133 = getelementptr inbounds i8, i8* %132, i64 %122
  store i8 %130, i8* %133, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %134 = load i32, i32* %i.addr, align 4
  %135 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %134)
  %136 = extractvalue { i32, i1 } %135, 0
  %137 = extractvalue { i32, i1 } %135, 1
  br i1 %137, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %138 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %136, i32 1)
  %139 = extractvalue { i32, i1 } %138, 0
  %140 = extractvalue { i32, i1 } %138, 1
  br i1 %140, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %141 = sext i32 %139 to i64
  %142 = load i32, i32* %i.addr, align 4
  %143 = sext i32 %142 to i64
  %144 = bitcast i8* %114 to i8*
  %145 = getelementptr inbounds i8, i8* %144, i64 %143
  %146 = load i8, i8* %145, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %147 = zext i8 %146 to i32
  %148 = and i32 %147, 15
  %149 = call i8 @digit(i32 %148)
  %150 = icmp ult i64 %141, %110
  br i1 %150, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %141, i64 %110)
  unreachable

bounds.ok.3:
  %151 = bitcast i8* %112 to i8*
  %152 = getelementptr inbounds i8, i8* %151, i64 %141
  store i8 %149, i8* %152, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %153 = load i32, i32* %i.addr, align 4
  %154 = add nsw i32 %153, 1
  store i32 %154, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %155 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %156 = load i32, i32* %n.addr, align 4
  %157 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %156)
  %158 = extractvalue { i32, i1 } %157, 0
  %159 = extractvalue { i32, i1 } %157, 1
  br i1 %159, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %160 = sext i32 %158 to i64
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %162 = load i64, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %163 = icmp ule i64 0, %160
  %164 = icmp ule i64 %160, %162
  %165 = and i1 %163, %164
  br i1 %165, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %160, i64 %162)
  unreachable

bytes.ok:
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %167 = load i8*, i8** %166, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %168 = getelementptr inbounds i8, i8* %167, i64 0
  %169 = sub i64 %160, 0
  %170 = call i8* @nish_str_new(i8* %168, i64 %169)
  ret i8* %170

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %while.cond ], [ 2, %while.body ], [ 2, %bounds.ok ], [ 0, %ovf.ok.3 ], [ 2, %for.body ], [ 2, %bounds.ok.2 ], [ 0, %ovf.ok.6 ], [ 2, %for.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @noise(i32 noundef %n, i32 noundef %seed) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %17 = and i32 %16, 255
  %18 = trunc i32 %17 to i8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 1)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 %20
  store i8 %18, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %32 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %32

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %mismatches.addr = alloca i32, align 4
  %lengths.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [9 x i32], align 8
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %scalar.addr = alloca i8*, align 8
  %lanes.addr = alloca i8*, align 8
  %all.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [256 x i8], align 8
  %i.addr = alloca i32, align 4
  %allScalar.addr = alloca i8*, align 8
  %seventeen.addr = alloca %struct.nish_array*, align 8
  %seventeenLanes.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %mismatches.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 9, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [9 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 15, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 16, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 17, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 31, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = getelementptr inbounds i32, i32* %4, i64 7
  store i32 33, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %13 = getelementptr inbounds i32, i32* %4, i64 8
  store i32 100, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %lengths.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %lengths.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %forof.body, label %forof.end

forof.body:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %15
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %23, i32* %n.addr, align 4
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %27 = load i64, i64* %26, align 8
  %28 = load i32, i32* %n.addr, align 4
  %29 = load i32, i32* %n.addr, align 4
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 5)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = call %struct.nish_array* @noise(i32 %28, i32 %31)
  store %struct.nish_array* %33, %struct.nish_array** %xs.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @hexScalar(%struct.nish_array* %34)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  store i8* %37, i8** %scalar.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = call i64 @nish_arena_mark()
  %40 = call i8* @hexLanes(%struct.nish_array* %38)
  %41 = call i8* @nish_arena_keep(i64 %39, i8* %40)
  store i8* %41, i8** %lanes.addr, align 8
  %42 = load i8*, i8** %scalar.addr, align 8
  %43 = load i8*, i8** %lanes.addr, align 8
  %44 = call zeroext i1 @nish_str_eq(i8* %42, i8* %43)
  %45 = xor i1 %44, true
  br i1 %45, label %if.then, label %if.end

if.then:
  %46 = load i32, i32* %mismatches.addr, align 4
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 1)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %48, i32* %mismatches.addr, align 4
  %50 = load i32, i32* %n.addr, align 4
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [18 x i8] }* @.str.2 to i8*))
  %54 = load i8*, i8** %scalar.addr, align 8
  %55 = call i8* @nish_str_concat(i8* %53, i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  %57 = load i8*, i8** %lanes.addr, align 8
  %58 = call i8* @nish_str_concat(i8* %56, i8* %57)
  call void @nish_print(i8* %58)
  br label %if.end

if.end:
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %60 = load i8*, i8** %59, align 8
  %61 = icmp eq i8* %60, %25
  br i1 %61, label %pass.rewind, label %pass.free

pass.rewind:
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %27, i64* %62, align 8
  br label %pass.done

pass.free:
  %63 = ptrtoint i8* %25 to i64
  %64 = add i64 %63, %27
  call void @nish_arena_release(i64 %64)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %65 = load i64, i64* %forof.idx, align 8
  %66 = add i64 %65, 1
  store i64 %66, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 256, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 256, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = bitcast [256 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %69, i8 0, i64 256, i1 false), !alias.scope !4, !noalias !3
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %69, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %all.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %71 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %74 = load i32, i32* %i.addr, align 4
  %75 = icmp slt i32 %74, 256
  br i1 %75, label %for.body, label %for.end

for.body:
  %76 = load i32, i32* %i.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = load i32, i32* %i.addr, align 4
  %79 = trunc i32 %78 to i8
  %80 = bitcast i8* %73 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %77
  store i8 %79, i8* %81, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %82 = load i32, i32* %i.addr, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %84 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %85 = call i64 @nish_arena_mark()
  %86 = call i8* @hexScalar(%struct.nish_array* %84)
  %87 = call i8* @nish_arena_keep(i64 %85, i8* %86)
  store i8* %87, i8** %allScalar.addr, align 8
  %88 = load i8*, i8** %allScalar.addr, align 8
  %89 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @hexLanes(%struct.nish_array* %89)
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call zeroext i1 @nish_str_eq(i8* %88, i8* %92)
  %94 = xor i1 %93, true
  br i1 %94, label %if.then.1, label %if.end.1

if.then.1:
  %95 = load i32, i32* %mismatches.addr, align 4
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %95, i32 1)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %97, i32* %mismatches.addr, align 4
  br label %if.end.1

if.end.1:
  %99 = load i8*, i8** %allScalar.addr, align 8
  %100 = bitcast i8* %99 to i64*
  %101 = load i64, i64* %100, align 8
  %102 = call i64 @llvm.smin.i64(i64 40, i64 %101)
  %103 = call i64 @llvm.smax.i64(i64 %102, i64 0)
  %104 = call i64 @llvm.smin.i64(i64 0, i64 %103)
  %105 = call i64 @llvm.smax.i64(i64 0, i64 %103)
  %106 = sub i64 %105, %104
  %107 = getelementptr inbounds i8, i8* %99, i64 8
  %108 = getelementptr inbounds i8, i8* %107, i64 %104
  %109 = call i8* @nish_str_new(i8* %108, i64 %106)
  %110 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*), i8* %109)
  %111 = call i8* @nish_str_concat(i8* %110, i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*))
  %112 = load i8*, i8** %allScalar.addr, align 8
  %113 = bitcast i8* %112 to i64*
  %114 = load i64, i64* %113, align 8
  %115 = call i64 @llvm.smin.i64(i64 472, i64 %114)
  %116 = call i64 @llvm.smax.i64(i64 %115, i64 0)
  %117 = call i64 @llvm.smin.i64(i64 512, i64 %114)
  %118 = call i64 @llvm.smax.i64(i64 %117, i64 0)
  %119 = call i64 @llvm.smin.i64(i64 %116, i64 %118)
  %120 = call i64 @llvm.smax.i64(i64 %116, i64 %118)
  %121 = sub i64 %120, %119
  %122 = getelementptr inbounds i8, i8* %112, i64 8
  %123 = getelementptr inbounds i8, i8* %122, i64 %119
  %124 = call i8* @nish_str_new(i8* %123, i64 %121)
  %125 = call i8* @nish_str_concat(i8* %111, i8* %124)
  call void @nish_print(i8* %125)
  %126 = call %struct.nish_array* @noise(i32 17, i32 22)
  store %struct.nish_array* %126, %struct.nish_array** %seventeen.addr, align 8
  %127 = load %struct.nish_array*, %struct.nish_array** %seventeen.addr, align 8
  %128 = call i64 @nish_arena_mark()
  %129 = call i8* @hexLanes(%struct.nish_array* %127)
  %130 = call i8* @nish_arena_keep(i64 %128, i8* %129)
  store i8* %130, i8** %seventeenLanes.addr, align 8
  %131 = load i8*, i8** %seventeenLanes.addr, align 8
  %132 = load %struct.nish_array*, %struct.nish_array** %seventeen.addr, align 8
  %133 = call i64 @nish_arena_mark()
  %134 = call i8* @hexScalar(%struct.nish_array* %132)
  %135 = call i8* @nish_arena_keep(i64 %133, i8* %134)
  %136 = call zeroext i1 @nish_str_eq(i8* %131, i8* %135)
  %137 = xor i1 %136, true
  br i1 %137, label %if.then.2, label %if.end.2

if.then.2:
  %138 = load i32, i32* %mismatches.addr, align 4
  %139 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %138, i32 1)
  %140 = extractvalue { i32, i1 } %139, 0
  %141 = extractvalue { i32, i1 } %139, 1
  br i1 %141, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %140, i32* %mismatches.addr, align 4
  br label %if.end.2

if.end.2:
  %142 = load i8*, i8** %seventeenLanes.addr, align 8
  %143 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.6 to i8*), i8* %142)
  call void @nish_print(i8* %143)
  %144 = load i32, i32* %mismatches.addr, align 4
  %145 = call i8* @nish_str_from_i32(i32 %144)
  %146 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.7 to i8*), i8* %145)
  call void @nish_print(i8* %146)
  %147 = load i32, i32* %mismatches.addr, align 4
  %148 = icmp eq i32 %147, 0
  br i1 %148, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %149 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %149

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
