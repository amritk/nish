%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.10.scratchSum(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.8.schedule(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Secret$arr.u8$i32$fn.6.digest(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare i64 @llvm.smax.i64(i64, i64) #4
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

define hidden noundef i32 @scratchSum$(i32 noundef %n) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %buf.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = sub i64 %10, 0
  %12 = call i64 @llvm.smax.i64(i64 %11, i64 0)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  call void @llvm.memset.p0i8.i64(i8* %16, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %i.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = trunc i64 %19 to i32
  %24 = icmp slt i32 %22, %23
  br i1 %24, label %for.body, label %for.end

for.body:
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  %29 = trunc i32 %28 to i8
  %30 = bitcast i8* %21 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %26
  store i8 %29, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %t.addr, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %forof.body, label %forof.end

forof.body:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %35
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store i8 %43, i8* %b.addr, align 1
  %44 = load i32, i32* %t.addr, align 4
  %45 = load i8, i8* %b.addr, align 1
  %46 = zext i8 %45 to i32
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %48, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %50 = load i64, i64* %forof.idx, align 8
  %51 = add i64 %50, 1
  store i64 %51, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %52 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  call void @nish.wipe$arr.u8(%struct.nish_array* %52)
  %53 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %53

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @expand(i32 noundef %seed, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %table) #0 {
entry:
  %key.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %key.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = sub i64 %6, 0
  %8 = call i64 @llvm.smax.i64(i64 %7, i64 0)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 0
  call void @llvm.memset.p0i8.i64(i8* %12, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %i.addr, align 4
  %13 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %18 = load i32, i32* %i.addr, align 4
  %19 = trunc i64 %15 to i32
  %20 = icmp slt i32 %18, %19
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %i.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %seed, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  %27 = trunc i32 %25 to i8
  %28 = bitcast i8* %17 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 %22
  store i8 %27, i8* %29, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %41 = load i32, i32* %i.addr.1, align 4
  %42 = trunc i64 %33 to i32
  %43 = icmp slt i32 %41, %42
  br i1 %43, label %for.body.1, label %for.end.1

for.body.1:
  %44 = load i32, i32* %i.addr.1, align 4
  %45 = sext i32 %44 to i64
  %46 = load i32, i32* %i.addr.1, align 4
  %47 = srem i32 %46, 4
  %48 = sext i32 %47 to i64
  %49 = icmp ult i64 %48, %38
  br i1 %49, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %48, i64 %38)
  unreachable

bounds.ok:
  %50 = bitcast i8* %40 to i8*
  %51 = getelementptr inbounds i8, i8* %50, i64 %48
  %52 = load i8, i8* %51, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = zext i8 %52 to i32
  %54 = load i32, i32* %i.addr.1, align 4
  %55 = add nsw i32 %54, 1
  %56 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %53, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %59 = bitcast i8* %35 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %45
  store i32 %57, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc.1

for.inc.1:
  %61 = load i32, i32* %i.addr.1, align 4
  %62 = add nsw i32 %61, 1
  store i32 %62, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %63 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  call void @nish.wipe$arr.u8(%struct.nish_array* %63)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 2, %bounds.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @schedule$(i32 noundef %seed) #0 {
entry:
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %fill.at = alloca i64, align 8
  %t.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %8 = load i64, i64* %fill.at, align 8
  %9 = icmp slt i64 %8, %7
  br i1 %9, label %fill.body, label %fill.end

fill.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %8
  store i32 0, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %14 = add i64 %8, 1
  store i64 %14, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %15 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  call void @expand(i32 %seed, %struct.nish_array* %15)
  store i32 0, i32* %t.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %17 = load i64, i64* %forof.idx, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %forof.body, label %forof.end

forof.body:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %25, i32* %w.addr, align 4
  %26 = load i32, i32* %t.addr, align 4
  %27 = load i32, i32* %w.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  call void @nish.wipe$arr.u32(%struct.nish_array* %33)
  %34 = load i32, i32* %t.addr, align 4
  ret i32 %34

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @mixed$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %key) #0 {
entry:
  %copy.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %key, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = call i8* @nish_alloc_struct(i64 %3)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %3, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %copy.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = sub i64 %13, 0
  %15 = call i64 @llvm.smax.i64(i64 %14, i64 0)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  call void @llvm.memset.p0i8.i64(i8* %19, i8 0, i64 %15, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %i.addr, align 4
  %20 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %key, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %key, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %22 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %for.body, label %for.end

for.body:
  %32 = load i32, i32* %i.addr, align 4
  %33 = trunc i64 %26 to i32
  %34 = icmp slt i32 %32, %33
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %i.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %28 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 %38
  %41 = load i8, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %24 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %36
  store i8 %41, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %44 = load i32, i32* %i.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = trunc i64 %48 to i32
  %53 = icmp slt i32 %51, %52
  br i1 %53, label %for.body.1, label %for.end.1

for.body.1:
  %54 = load i32, i32* %t.addr, align 4
  %55 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %54, i32 31)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok

ovf.ok:
  %58 = load i32, i32* %i.addr.1, align 4
  %59 = sext i32 %58 to i64
  %60 = bitcast i8* %50 to i8*
  %61 = getelementptr inbounds i8, i8* %60, i64 %59
  %62 = load i8, i8* %61, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = zext i8 %62 to i32
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %65, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %67 = load i32, i32* %i.addr.1, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %69 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  call void @nish.wipe$arr.u8(%struct.nish_array* %69)
  %70 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %70

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @digest$(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #0 {
entry:
  %0 = call i32 @nish.expose$arr.u8$i32$fn.5.mixed(%struct.Secret$arr.u8* %k)
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %sums.addr = alloca %struct.nish_array*, align 8
  %tables.addr = alloca %struct.nish_array*, align 8
  %digests.addr = alloca %struct.nish_array*, align 8
  %pw.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %1, %struct.nish_array** %sums.addr, align 8
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 0, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %10, %struct.nish_array** %tables.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 2, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 2, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = call i8* @nish_alloc_struct(i64 8)
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %22 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  store i32 0, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = getelementptr inbounds i32, i32* %24, i64 1
  store i32 0, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %19, %struct.nish_array** %digests.addr, align 8
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 6, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 6, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = call i8* @nish_alloc_struct(i64 6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %31, i8 0, i64 6, i1 false), !alias.scope !4, !noalias !3
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %28, %struct.nish_array** %pw.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %pw.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = sub i64 %35, 0
  %37 = call i64 @llvm.smax.i64(i64 %36, i64 0)
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 0
  call void @llvm.memset.p0i8.i64(i8* %41, i8 65, i64 %37, i1 false), !alias.scope !4, !noalias !3
  %42 = load %struct.nish_array*, %struct.nish_array** %pw.addr, align 8
  %43 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %42)
  store %struct.Secret$arr.u8* %43, %struct.Secret$arr.u8** %k.addr, align 8
  %44 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %44, %struct.ThreadScope** %s.addr, align 8
  %45 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %46 = bitcast %struct.ThreadScope* %45 to i8*
  %47 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.10.scratchSum(%struct.ThreadScope* %47, i32 10, %struct.nish_array* %48, i32 0)
  %49 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.10.scratchSum(%struct.ThreadScope* %49, i32 200, %struct.nish_array* %50, i32 1)
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %tables.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.8.schedule(%struct.ThreadScope* %51, i32 1, %struct.nish_array* %52, i32 0)
  %53 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %tables.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.8.schedule(%struct.ThreadScope* %53, i32 9, %struct.nish_array* %54, i32 1)
  %55 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %56 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %digests.addr, align 8
  call void @nish.ThreadScope.spawn$$Secret$arr.u8$i32$fn.6.digest(%struct.ThreadScope* %55, %struct.Secret$arr.u8* %56, %struct.nish_array* %57, i32 0)
  %58 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %59 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %60 = load %struct.nish_array*, %struct.nish_array** %digests.addr, align 8
  call void @nish.ThreadScope.spawn$$Secret$arr.u8$i32$fn.6.digest(%struct.ThreadScope* %58, %struct.Secret$arr.u8* %59, %struct.nish_array* %60, i32 1)
  call void @nish_scope_join(i8* %46)
  %61 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %61)
  %62 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ult i64 0, %64
  br i1 %65, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %64)
  unreachable

bounds.ok:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  %70 = load i32, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %73 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = icmp ult i64 1, %75
  br i1 %76, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %75)
  unreachable

bounds.ok.1:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 1
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %82 = call i8* @nish_str_from_i32(i32 %81)
  %83 = call i8* @nish_str_concat(i8* %72, i8* %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %85 = load %struct.nish_array*, %struct.nish_array** %tables.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 0, %87
  br i1 %88, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %87)
  unreachable

bounds.ok.2:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 0
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %84, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %97 = load %struct.nish_array*, %struct.nish_array** %tables.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = icmp ult i64 1, %99
  br i1 %100, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %99)
  unreachable

bounds.ok.3:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 1
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %96, i8* %106)
  call void @nish_print(i8* %107)
  %108 = load %struct.nish_array*, %struct.nish_array** %digests.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = icmp ult i64 0, %110
  br i1 %111, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %110)
  unreachable

bounds.ok.4:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = bitcast i8* %113 to i32*
  %115 = getelementptr inbounds i32, i32* %114, i64 0
  %116 = load i32, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = call i8* @nish_str_from_i32(i32 %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %119 = load %struct.nish_array*, %struct.nish_array** %digests.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = icmp ult i64 1, %121
  br i1 %122, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %121)
  unreachable

bounds.ok.5:
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %124 = load i8*, i8** %123, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %125 = bitcast i8* %124 to i32*
  %126 = getelementptr inbounds i32, i32* %125, i64 1
  %127 = load i32, i32* %126, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %118, i8* %128)
  call void @nish_print(i8* %129)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !19
  ret void
}

define internal void @nish.wipe$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %_target) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 1
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 2
  %3 = load i8*, i8** %2, align 8
  call void @llvm.memset.p0i8.i64(i8* %3, i8 0, i64 %1, i1 true)
  ret void
}

define internal void @nish.wipe$arr.u32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %_target) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 1
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 2
  %3 = load i8*, i8** %2, align 8
  %4 = mul i64 %1, 4
  call void @llvm.memset.p0i8.i64(i8* %3, i8 0, i64 %4, i1 true)
  ret void
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.5.mixed(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !19
  %2 = call i32 @mixed$(%struct.nish_array* %1)
  ret i32 %2
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!17 = !{!"ptr", !6, i64 0}
!18 = !{!"Secret$arr.u8", !17, i64 0}
!19 = !{!18, !17, i64 0}
