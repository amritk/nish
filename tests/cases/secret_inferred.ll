%struct.Pair = type { i32, i32 }
%struct.Counter = type { i64, i64 }
%struct.Secret$arr.i32 = type { %struct.nish_array* }
%struct.Secret$arr.u32 = type { %struct.nish_array* }
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.Secret$$Pair = type { %struct.Pair* }
%struct.Secret$$Counter = type { %struct.Counter* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #5

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

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i64 noundef %hits, i64 noundef %misses) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i64 %hits, i64* %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i64 %misses, i64* %1, align 8, !tbaa !5
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytes(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
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
  store i64 %0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %0, i1 false), !alias.scope !10, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %3, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %10 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  %20 = trunc i32 %19 to i8
  %21 = bitcast i8* %12 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %17
  store i8 %20, i8* %22, align 1, !alias.scope !10, !noalias !9, !tbaa !18
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

define internal noundef nonnull align 4 dereferenceable(8) %struct.Pair* @pairOf(i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %lo, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %hi, i32* %3, align 4
  store %struct.Pair* %1, %struct.Pair** %p.addr, align 8
  %4 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  ret %struct.Pair* %4
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %s.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %s.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !10, !noalias !9, !tbaa !18
  store i8 %8, i8* %b.addr, align 1
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i8, i8* %b.addr, align 1
  %11 = zext i8 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %s.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @words$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define hidden noundef i32 @total$(%struct.Pair* noundef nonnull readonly align 4 dereferenceable(8) nocapture %p) #2 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define hidden noundef i64 @seen$(%struct.Counter* noundef nonnull readonly align 8 dereferenceable(16) nocapture %c) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i64, i64* %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  %3 = load i64, i64* %2, align 8, !tbaa !5
  %4 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %1, i64 %3)
  %5 = extractvalue { i64, i1 } %4, 0
  %6 = extractvalue { i64, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Counter* @counterOf(i64 noundef %hits, i64 noundef %misses) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Counter*
  call void @Counter.constructor(%struct.Counter* %1, i64 %hits, i64 %misses)
  ret %struct.Counter* %1
}

define noundef i32 @nish_main() #1 {
entry:
  %literal.addr = alloca %struct.Secret$arr.i32*, align 8
  %fresh.addr = alloca %struct.Secret$arr.u32*, align 8
  %called.addr = alloca %struct.Secret$arr.u8*, align 8
  %raw.addr = alloca %struct.nish_array*, align 8
  %moved.addr = alloca %struct.Secret$arr.u8*, align 8
  %n.addr = alloca i32, align 4
  %picked.addr = alloca %struct.Secret$arr.u8*, align 8
  %plain.addr = alloca %struct.Pair*, align 8
  %record.addr = alloca %struct.Secret$$Pair*, align 8
  %made.addr = alloca %struct.Secret$$Pair*, align 8
  %counter.addr = alloca %struct.Secret$$Counter*, align 8
  %held.addr = alloca %struct.Counter*, align 8
  %aliased.addr = alloca %struct.Secret$$Counter*, align 8
  %answered.addr = alloca %struct.Secret$$Counter*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %10 = call %struct.Secret$arr.i32* @nish.secret$arr.i32(%struct.nish_array* %1)
  store %struct.Secret$arr.i32* %10, %struct.Secret$arr.i32** %literal.addr, align 8
  %11 = load %struct.Secret$arr.i32*, %struct.Secret$arr.i32** %literal.addr, align 8
  %12 = call i32 @nish.expose$arr.i32$i32$fn.16.nish_main$arrow0(%struct.Secret$arr.i32* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.Secret$arr.i32*, %struct.Secret$arr.i32** %literal.addr, align 8
  call void @nish.wipe$$Secret$arr.i32(%struct.Secret$arr.i32* %14)
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 5, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 5, i64* %18, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %19 = mul i64 5, 4
  %20 = call i8* @nish_alloc_struct(i64 %19)
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 %19, i1 false), !alias.scope !10, !noalias !9
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %22 = call %struct.Secret$arr.u32* @nish.secret$arr.u32(%struct.nish_array* %16)
  store %struct.Secret$arr.u32* %22, %struct.Secret$arr.u32** %fresh.addr, align 8
  %23 = load %struct.Secret$arr.u32*, %struct.Secret$arr.u32** %fresh.addr, align 8
  %24 = call i32 @nish.expose$arr.u32$i32$fn.5.words(%struct.Secret$arr.u32* %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.Secret$arr.u32*, %struct.Secret$arr.u32** %fresh.addr, align 8
  call void @nish.wipe$$Secret$arr.u32(%struct.Secret$arr.u32* %26)
  %27 = call %struct.nish_array* @bytes(i32 4)
  %28 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %27)
  store %struct.Secret$arr.u8* %28, %struct.Secret$arr.u8** %called.addr, align 8
  %29 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %called.addr, align 8
  %30 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %29)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
  %32 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %called.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %32)
  %33 = call %struct.nish_array* @bytes(i32 3)
  store %struct.nish_array* %33, %struct.nish_array** %raw.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %raw.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 0
  store i8 9, i8* %38, align 1, !alias.scope !10, !noalias !9, !tbaa !18
  %39 = load %struct.nish_array*, %struct.nish_array** %raw.addr, align 8
  %40 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %39)
  store %struct.Secret$arr.u8* %40, %struct.Secret$arr.u8** %moved.addr, align 8
  %41 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %moved.addr, align 8
  %42 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %41)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  %44 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %moved.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %44)
  %45 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %48 = trunc i64 %47 to i32
  store i32 %48, i32* %n.addr, align 4
  %49 = load i32, i32* %n.addr, align 4
  %50 = icmp sgt i32 %49, 0
  br i1 %50, label %cond.true, label %cond.false

cond.true:
  %51 = call %struct.nish_array* @bytes(i32 2)
  br label %cond.end

cond.false:
  %52 = call %struct.nish_array* @bytes(i32 5)
  br label %cond.end

cond.end:
  %53 = phi %struct.nish_array* [ %51, %cond.true ], [ %52, %cond.false ]
  %54 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %53)
  store %struct.Secret$arr.u8* %54, %struct.Secret$arr.u8** %picked.addr, align 8
  %55 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %picked.addr, align 8
  %56 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %55)
  %57 = call i8* @nish_str_from_i32(i32 %56)
  call void @nish_print(i8* %57)
  %58 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %picked.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %58)
  %59 = call i8* @nish_alloc_struct(i64 8)
  %60 = bitcast i8* %59 to %struct.Pair*
  %61 = getelementptr inbounds %struct.Pair, %struct.Pair* %60, i32 0, i32 0
  store i32 2, i32* %61, align 4
  %62 = getelementptr inbounds %struct.Pair, %struct.Pair* %60, i32 0, i32 1
  store i32 40, i32* %62, align 4
  store %struct.Pair* %60, %struct.Pair** %plain.addr, align 8
  %63 = load %struct.Pair*, %struct.Pair** %plain.addr, align 8
  %64 = call %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* %63)
  store %struct.Secret$$Pair* %64, %struct.Secret$$Pair** %record.addr, align 8
  %65 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %record.addr, align 8
  %66 = call i32 @nish.expose$$Pair$u32$fn.5.total(%struct.Secret$$Pair* %65)
  %67 = zext i32 %66 to i64
  %68 = call i8* @nish_str_from_u64(i64 %67)
  call void @nish_print(i8* %68)
  %69 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %record.addr, align 8
  call void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* %69)
  %70 = call %struct.Pair* @pairOf(i32 7, i32 8)
  %71 = call %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* %70)
  store %struct.Secret$$Pair* %71, %struct.Secret$$Pair** %made.addr, align 8
  %72 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %made.addr, align 8
  %73 = call i32 @nish.expose$$Pair$u32$fn.5.total(%struct.Secret$$Pair* %72)
  %74 = zext i32 %73 to i64
  %75 = call i8* @nish_str_from_u64(i64 %74)
  call void @nish_print(i8* %75)
  %76 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %made.addr, align 8
  call void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* %76)
  %77 = call i8* @nish_alloc_struct(i64 16)
  %78 = bitcast i8* %77 to %struct.Counter*
  call void @Counter.constructor(%struct.Counter* %78, i64 3, i64 4)
  %79 = call %struct.Secret$$Counter* @nish.secret$$Counter(%struct.Counter* %78)
  store %struct.Secret$$Counter* %79, %struct.Secret$$Counter** %counter.addr, align 8
  %80 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %counter.addr, align 8
  %81 = call i64 @nish.expose$$Counter$i64$fn.4.seen(%struct.Secret$$Counter* %80)
  %82 = call i8* @nish_str_from_i64(i64 %81)
  call void @nish_print(i8* %82)
  %83 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %counter.addr, align 8
  call void @nish.wipe$$Secret$$Counter(%struct.Secret$$Counter* %83)
  %84 = call i8* @nish_alloc_struct(i64 16)
  %85 = bitcast i8* %84 to %struct.Counter*
  call void @Counter.constructor(%struct.Counter* %85, i64 5, i64 6)
  store %struct.Counter* %85, %struct.Counter** %held.addr, align 8
  %86 = load %struct.Counter*, %struct.Counter** %held.addr, align 8
  %87 = call %struct.Secret$$Counter* @nish.secret$$Counter(%struct.Counter* %86)
  store %struct.Secret$$Counter* %87, %struct.Secret$$Counter** %aliased.addr, align 8
  %88 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %aliased.addr, align 8
  %89 = call i64 @nish.expose$$Counter$i64$fn.4.seen(%struct.Secret$$Counter* %88)
  %90 = call i8* @nish_str_from_i64(i64 %89)
  call void @nish_print(i8* %90)
  %91 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %aliased.addr, align 8
  call void @nish.wipe$$Secret$$Counter(%struct.Secret$$Counter* %91)
  %92 = call %struct.Counter* @counterOf(i64 10, i64 1)
  %93 = call %struct.Secret$$Counter* @nish.secret$$Counter(%struct.Counter* %92)
  store %struct.Secret$$Counter* %93, %struct.Secret$$Counter** %answered.addr, align 8
  %94 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %answered.addr, align 8
  %95 = call i64 @nish.expose$$Counter$i64$fn.4.seen(%struct.Secret$$Counter* %94)
  %96 = call i8* @nish_str_from_i64(i64 %95)
  call void @nish_print(i8* %96)
  %97 = load %struct.Secret$$Counter*, %struct.Secret$$Counter** %answered.addr, align 8
  call void @nish.wipe$$Secret$$Counter(%struct.Secret$$Counter* %97)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.i32.constructor(%struct.Secret$arr.i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.i32, %struct.Secret$arr.i32* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !23
  ret void
}

define internal void @nish.Secret$arr.u32.constructor(%struct.Secret$arr.u32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u32, %struct.Secret$arr.u32* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !25
  ret void
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !27
  ret void
}

define internal void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Pair* noundef nonnull align 4 dereferenceable(8) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %this, i32 0, i32 0
  store %struct.Pair* %value, %struct.Pair** %0, align 8, !tbaa !29
  ret void
}

define internal void @nish.Secret$$Counter.constructor(%struct.Secret$$Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Counter* noundef nonnull align 8 dereferenceable(16) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Counter, %struct.Secret$$Counter* %this, i32 0, i32 0
  store %struct.Counter* %value, %struct.Counter** %0, align 8, !tbaa !31
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.i32* @nish.secret$arr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.i32*
  call void @nish.Secret$arr.i32.constructor(%struct.Secret$arr.i32* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.i32* %1
}

define internal noundef i32 @nish.expose$arr.i32$i32$fn.16.nish_main$arrow0(%struct.Secret$arr.i32* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.i32, %struct.Secret$arr.i32* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = call i32 @nish_main$arrow0(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.i32(%struct.Secret$arr.i32* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.i32, %struct.Secret$arr.i32* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = mul i64 %3, 4
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %6, i1 true)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u32* @nish.secret$arr.u32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u32*
  call void @nish.Secret$arr.u32.constructor(%struct.Secret$arr.u32* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u32* %1
}

define internal noundef i32 @nish.expose$arr.u32$i32$fn.5.words(%struct.Secret$arr.u32* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u32, %struct.Secret$arr.u32* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = call i32 @words$(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u32(%struct.Secret$arr.u32* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u32, %struct.Secret$arr.u32* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = mul i64 %3, 4
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %6, i1 true)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @sum$(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
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

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* noundef nonnull align 4 dereferenceable(8) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$$Pair*
  call void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* %1, %struct.Pair* %value)
  ret %struct.Secret$$Pair* %1
}

define internal noundef i32 @nish.expose$$Pair$u32$fn.5.total(%struct.Secret$$Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %s, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8, !tbaa !29
  %2 = call i32 @total$(%struct.Pair* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %_target, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8
  %2 = bitcast %struct.Pair* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* %2, i8 0, i64 8, i1 true)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$$Counter* @nish.secret$$Counter(%struct.Counter* noundef nonnull align 8 dereferenceable(16) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$$Counter*
  call void @nish.Secret$$Counter.constructor(%struct.Secret$$Counter* %1, %struct.Counter* %value)
  ret %struct.Secret$$Counter* %1
}

define internal noundef i64 @nish.expose$$Counter$i64$fn.4.seen(%struct.Secret$$Counter* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Counter, %struct.Secret$$Counter* %s, i32 0, i32 0
  %1 = load %struct.Counter*, %struct.Counter** %0, align 8, !tbaa !31
  %2 = call i64 @seen$(%struct.Counter* %1)
  ret i64 %2
}

define internal void @nish.wipe$$Secret$$Counter(%struct.Secret$$Counter* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Counter, %struct.Secret$$Counter* %_target, i32 0, i32 0
  %1 = load %struct.Counter*, %struct.Counter** %0, align 8
  %2 = bitcast %struct.Counter* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* %2, i8 0, i64 16, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!32, !33, !34, !35, !36}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i64", !1, i64 0}
!3 = !{!"Counter", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element i8", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"ptr", !1, i64 0}
!22 = !{!"Secret$arr.i32", !21, i64 0}
!23 = !{!22, !21, i64 0}
!24 = !{!"Secret$arr.u32", !21, i64 0}
!25 = !{!24, !21, i64 0}
!26 = !{!"Secret$arr.u8", !21, i64 0}
!27 = !{!26, !21, i64 0}
!28 = !{!"Secret$$Pair", !21, i64 0}
!29 = !{!28, !21, i64 0}
!30 = !{!"Secret$$Counter", !21, i64 0}
!31 = !{!30, !21, i64 0}
!32 = !{i32 8, !"cf-protection-branch", i32 1}
!33 = !{i32 8, !"cf-protection-return", i32 1}
!34 = !{i32 8, !"branch-target-enforcement", i32 1}
!35 = !{i32 8, !"sign-return-address", i32 1}
!36 = !{i32 4, !"probe-stack", !"inline-asm"}
