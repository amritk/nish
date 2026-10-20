%struct.Box = type { %struct.nish_array* }
%struct.Holder = type { %struct.nish_array*, i8*, %struct.Box*, %struct.Tag* }
%struct.Tag = type { i8* }
%struct.Map$i32$str = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [56 x i8] } { i64 55, [56 x i8] c"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"counted \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"field \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"array \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"returned \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"returnedArray \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"captured \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"pushed \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"mapped \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"boxed \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"tagged \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"second \00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"aliased \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"relayed \00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"nested \00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.19.keepCaptured$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.19.keepCaptured$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.12.field$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.12.array$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.15.returned$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.20.returnedArray$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.15.captured$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.pushed$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.mapped$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.12.boxed$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.tagged$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.second$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.aliased$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.relayed$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.nested$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.counted$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define internal noundef i32 @churn() #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 6000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [56 x i8] }* @.str.0 to i8*), i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %9 = load i8*, i8** %s.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load i32, i32* %t.addr, align 4
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load i32, i32* %t.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %39 = sub nsw i32 %37, 6000
  ret i32 %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @wordsSum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %t.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %8, i8** %w.addr, align 8
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i8*, i8** %w.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = load i8*, i8** %w.addr, align 8
  %18 = load i8*, i8** %w.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %17 to i64*
  %25 = load i64, i64* %24, align 8
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok:
  %27 = getelementptr inbounds i8, i8* %17, i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 %23
  %29 = load i8, i8* %28, align 1
  %30 = zext i8 %29 to i32
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %34 = srem i32 %32, 1000003
  store i32 %34, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %37 = load i32, i32* %t.addr, align 4
  ret i32 %37

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @word(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %0)
  ret i8* %1
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %ws, %struct.nish_array** %0, align 8, !tbaa !17
  ret void
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !19
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %6, align 8, !tbaa !20
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Box*
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* null, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @Box.constructor(%struct.Box* %8, %struct.nish_array* %10)
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 2
  store %struct.Box* %8, %struct.Box** %14, align 8, !tbaa !21
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 3
  store %struct.Tag* null, %struct.Tag** %15, align 8, !tbaa !22
  ret void
}

define internal void @Tag.constructor(%struct.Tag* noundef nonnull noalias align 8 dereferenceable(8) %this, %struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 0
  store i8* %12, i8** %13, align 8, !tbaa !24
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 3
  store %struct.Tag* %this, %struct.Tag** %14, align 8, !tbaa !22
  ret void
}

define internal noundef i32 @keepField(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store i8* %12, i8** %13, align 8, !tbaa !20
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  ret i32 %16
}

define internal noundef i32 @keepArray(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %ws, %struct.nish_array** %0, align 8, !tbaa !19
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  ret i32 %3
}

define internal noundef nonnull align 8 i8* @last(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %12
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @same(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #2 {
entry:
  ret %struct.nish_array* %ws
}

define internal noundef i32 @keepCaptured(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %idx.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = call %struct.nish_array* @nish.parallelFrom$i32$fn.19.keepCaptured$arrow0(i32 %2)
  store %struct.nish_array* %3, %struct.nish_array** %idx.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %idx.addr, align 8
  %5 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.19.keepCaptured$arrow1(%struct.nish_array* %4, %struct.nish_array* %ws)
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %5, %struct.nish_array** %6, align 8, !tbaa !19
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define internal noundef i32 @keepPushed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  ret i32 %26
}

define internal noundef i32 @keepMapped(%struct.Map$i32$str* noundef nonnull align 8 dereferenceable(56) %m, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ws, i32 noundef %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = call %struct.Map$i32$str* @nish.Map$i32$str.set(%struct.Map$i32$str* %m, i32 %k, i8* %12)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  ret i32 %16
}

define internal noundef i32 @keepNew(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Box*
  call void @Box.constructor(%struct.Box* %1, %struct.nish_array* %ws)
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 2
  store %struct.Box* %1, %struct.Box** %2, align 8, !tbaa !21
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  ret i32 %5
}

define internal noundef i32 @keepThis(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %t.addr = alloca %struct.Tag*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Tag*
  call void @Tag.constructor(%struct.Tag* %1, %struct.Holder* %h, %struct.nish_array* %ws)
  store %struct.Tag* %1, %struct.Tag** %t.addr, align 8
  %2 = load %struct.Tag*, %struct.Tag** %t.addr, align 8
  %3 = getelementptr inbounds %struct.Tag, %struct.Tag* %2, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !24
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  ret i32 %7
}

define internal noundef i32 @keepSecond(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %7, i8** %a.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = sub nsw i32 %10, 1
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %20, i8** %b.addr, align 8
  %21 = load i8*, i8** %b.addr, align 8
  %22 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store i8* %21, i8** %22, align 8, !tbaa !20
  %23 = load i8*, i8** %a.addr, align 8
  %24 = bitcast i8* %23 to i64*
  %25 = load i64, i64* %24, align 8
  %26 = trunc i64 %25 to i32
  ret i32 %26
}

define internal noundef i32 @keepAliased(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %v.addr = alloca %struct.nish_array*, align 8
  store %struct.nish_array* %ws, %struct.nish_array** %v.addr, align 8
  %0 = load %struct.nish_array*, %struct.nish_array** %v.addr, align 8
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %0, %struct.nish_array** %1, align 8, !tbaa !19
  %2 = load %struct.nish_array*, %struct.nish_array** %v.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  ret i32 %5
}

define internal noundef i32 @relay(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = call i32 @keepField(%struct.Holder* %h, %struct.nish_array* %ws)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @keepNested(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %wss) #0 {
entry:
  %n.addr = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %n.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %wss, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %wss, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to %struct.nish_array**
  %7 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %6, i64 %0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %8, %struct.nish_array** %ws.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  %14 = sub nsw i32 %13, 1
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 %15
  %23 = load i8*, i8** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %24 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store i8* %23, i8** %24, align 8, !tbaa !20
  %25 = load i32, i32* %n.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %31, i32* %n.addr, align 4
  br label %forof.inc

forof.inc:
  %33 = load i64, i64* %forof.idx, align 8
  %34 = add i64 %33, 1
  store i64 %34, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %35 = load i32, i32* %n.addr, align 4
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @field(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.12.field$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepField(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @array(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.12.array$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepArray(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @returned(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.15.returned$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i8* @last(%struct.nish_array* %1)
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store i8* %2, i8** %3, align 8, !tbaa !20
  %4 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  ret i32 %7
}

define internal noundef i32 @returnedArray(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.20.returnedArray$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call %struct.nish_array* @same(%struct.nish_array* %1)
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %3, align 8, !tbaa !19
  %4 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  ret i32 %7
}

define internal noundef i32 @captured(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.15.captured$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepCaptured(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @pushed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.pushed$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepPushed(%struct.nish_array* %out, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @mapped(%struct.Map$i32$str* noundef nonnull align 8 dereferenceable(56) %m, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.mapped$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepMapped(%struct.Map$i32$str* %m, %struct.nish_array* %1, i32 %k)
  ret i32 %2
}

define internal noundef i32 @boxed(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.12.boxed$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepNew(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @tagged(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.tagged$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepThis(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @second(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.second$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepSecond(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @aliased(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.aliased$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @keepAliased(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @relayed(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.relayed$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @relay(%struct.Holder* %h, %struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @nested(%struct.Holder* noundef nonnull align 8 dereferenceable(32) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %wss.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.nish_array*], align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.nested$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast [1 x %struct.nish_array*]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to %struct.nish_array**
  %7 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %6, i64 0
  store %struct.nish_array* %1, %struct.nish_array** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %wss.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %wss.addr, align 8
  %9 = call i32 @keepNested(%struct.Holder* %h, %struct.nish_array* %8)
  ret i32 %9
}

define internal noundef i32 @counted(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.counted$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @wordsSum(%struct.nish_array* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @show(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(32) nocapture %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8, !tbaa !20
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !19
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %2, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !19
  %13 = call i32 @wordsSum(%struct.nish_array* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %10, i8* %14)
  ret i8* %15
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %m.addr = alloca %struct.Map$i32$str*, align 8
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %k.addr.2 = alloca i32, align 4
  %k.addr.3 = alloca i32, align 4
  %k.addr.4 = alloca i32, align 4
  %k.addr.5 = alloca i32, align 4
  %k.addr.6 = alloca i32, align 4
  %k.addr.7 = alloca i32, align 4
  %k.addr.8 = alloca i32, align 4
  %k.addr.9 = alloca i32, align 4
  %tag.addr = alloca %struct.Tag*, align 8
  %k.addr.10 = alloca i32, align 4
  %k.addr.11 = alloca i32, align 4
  %k.addr.12 = alloca i32, align 4
  %k.addr.13 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 37, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 70000, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %7 = load i64, i64* %forof.idx, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %forof.body, label %forof.end

forof.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  store i32 %15, i32* %n.addr, align 4
  %16 = load i32, i32* %n.addr, align 4
  %17 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %xs.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %out.addr, align 8
  %21 = call i8* @nish_alloc_struct(i64 56)
  %22 = bitcast i8* %21 to %struct.Map$i32$str*
  call void @nish.Map$i32$str.constructor(%struct.Map$i32$str* %22)
  store %struct.Map$i32$str* %22, %struct.Map$i32$str** %m.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %23 = load i32, i32* %k.addr, align 4
  %24 = icmp sle i32 %23, 3
  br i1 %24, label %for.body, label %for.end

for.body:
  %25 = load i32, i32* %t.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = load i32, i32* %k.addr, align 4
  %28 = call i32 @counted(%struct.nish_array* %26, i32 %27)
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = srem i32 %30, 1000003
  store i32 %32, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %35 = call i32 @churn()
  %36 = load i32, i32* %t.addr, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %37)
  call void @nish_print(i8* %38)
  store i32 1, i32* %k.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %39 = load i32, i32* %k.addr.1, align 4
  %40 = icmp sle i32 %39, 3
  br i1 %40, label %for.body.1, label %for.end.1

for.body.1:
  %41 = load i32, i32* %t.addr, align 4
  %42 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %44 = load i32, i32* %k.addr.1, align 4
  %45 = call i32 @field(%struct.Holder* %42, %struct.nish_array* %43, i32 %44)
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 %45)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %47, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %49 = load i32, i32* %k.addr.1, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %51 = call i32 @churn()
  %52 = load i32, i32* %t.addr, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %56 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %57 = getelementptr inbounds %struct.Holder, %struct.Holder* %56, i32 0, i32 1
  %58 = load i8*, i8** %57, align 8, !tbaa !20
  %59 = call i8* @nish_str_concat(i8* %55, i8* %58)
  call void @nish_print(i8* %59)
  store i32 1, i32* %k.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %60 = load i32, i32* %k.addr.2, align 4
  %61 = icmp sle i32 %60, 3
  br i1 %61, label %for.body.2, label %for.end.2

for.body.2:
  %62 = load i32, i32* %t.addr, align 4
  %63 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %64 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %65 = load i32, i32* %k.addr.2, align 4
  %66 = call i32 @array(%struct.Holder* %63, %struct.nish_array* %64, i32 %65)
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %68, i32* %t.addr, align 4
  br label %for.inc.2

for.inc.2:
  %70 = load i32, i32* %k.addr.2, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %k.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %72 = call i32 @churn()
  %73 = load i32, i32* %t.addr, align 4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*), i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %77 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %78 = call i64 @nish_arena_mark()
  %79 = call i8* @show(%struct.Holder* %77)
  %80 = call i8* @nish_arena_keep(i64 %78, i8* %79)
  %81 = call i8* @nish_str_concat(i8* %76, i8* %80)
  call void @nish_print(i8* %81)
  store i32 1, i32* %k.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %82 = load i32, i32* %k.addr.3, align 4
  %83 = icmp sle i32 %82, 3
  br i1 %83, label %for.body.3, label %for.end.3

for.body.3:
  %84 = load i32, i32* %t.addr, align 4
  %85 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %86 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %87 = load i32, i32* %k.addr.3, align 4
  %88 = call i32 @returned(%struct.Holder* %85, %struct.nish_array* %86, i32 %87)
  %89 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %84, i32 %88)
  %90 = extractvalue { i32, i1 } %89, 0
  %91 = extractvalue { i32, i1 } %89, 1
  br i1 %91, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %90, i32* %t.addr, align 4
  br label %for.inc.3

for.inc.3:
  %92 = load i32, i32* %k.addr.3, align 4
  %93 = add nsw i32 %92, 1
  store i32 %93, i32* %k.addr.3, align 4
  br label %for.cond.3

for.end.3:
  %94 = call i32 @churn()
  %95 = load i32, i32* %t.addr, align 4
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %99 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %100 = getelementptr inbounds %struct.Holder, %struct.Holder* %99, i32 0, i32 1
  %101 = load i8*, i8** %100, align 8, !tbaa !20
  %102 = call i8* @nish_str_concat(i8* %98, i8* %101)
  call void @nish_print(i8* %102)
  store i32 1, i32* %k.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %103 = load i32, i32* %k.addr.4, align 4
  %104 = icmp sle i32 %103, 3
  br i1 %104, label %for.body.4, label %for.end.4

for.body.4:
  %105 = load i32, i32* %t.addr, align 4
  %106 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %107 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %108 = load i32, i32* %k.addr.4, align 4
  %109 = call i32 @returnedArray(%struct.Holder* %106, %struct.nish_array* %107, i32 %108)
  %110 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 %109)
  %111 = extractvalue { i32, i1 } %110, 0
  %112 = extractvalue { i32, i1 } %110, 1
  br i1 %112, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %111, i32* %t.addr, align 4
  br label %for.inc.4

for.inc.4:
  %113 = load i32, i32* %k.addr.4, align 4
  %114 = add nsw i32 %113, 1
  store i32 %114, i32* %k.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %115 = call i32 @churn()
  %116 = load i32, i32* %t.addr, align 4
  %117 = call i8* @nish_str_from_i32(i32 %116)
  %118 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.8 to i8*), i8* %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %120 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %121 = call i64 @nish_arena_mark()
  %122 = call i8* @show(%struct.Holder* %120)
  %123 = call i8* @nish_arena_keep(i64 %121, i8* %122)
  %124 = call i8* @nish_str_concat(i8* %119, i8* %123)
  call void @nish_print(i8* %124)
  store i32 1, i32* %k.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %125 = load i32, i32* %k.addr.5, align 4
  %126 = icmp sle i32 %125, 3
  br i1 %126, label %for.body.5, label %for.end.5

for.body.5:
  %127 = load i32, i32* %t.addr, align 4
  %128 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %129 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %130 = load i32, i32* %k.addr.5, align 4
  %131 = call i32 @captured(%struct.Holder* %128, %struct.nish_array* %129, i32 %130)
  %132 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %127, i32 %131)
  %133 = extractvalue { i32, i1 } %132, 0
  %134 = extractvalue { i32, i1 } %132, 1
  br i1 %134, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %133, i32* %t.addr, align 4
  br label %for.inc.5

for.inc.5:
  %135 = load i32, i32* %k.addr.5, align 4
  %136 = add nsw i32 %135, 1
  store i32 %136, i32* %k.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %137 = call i32 @churn()
  %138 = load i32, i32* %t.addr, align 4
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.9 to i8*), i8* %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %142 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %143 = call i64 @nish_arena_mark()
  %144 = call i8* @show(%struct.Holder* %142)
  %145 = call i8* @nish_arena_keep(i64 %143, i8* %144)
  %146 = call i8* @nish_str_concat(i8* %141, i8* %145)
  call void @nish_print(i8* %146)
  store i32 1, i32* %k.addr.6, align 4
  br label %for.cond.6

for.cond.6:
  %147 = load i32, i32* %k.addr.6, align 4
  %148 = icmp sle i32 %147, 3
  br i1 %148, label %for.body.6, label %for.end.6

for.body.6:
  %149 = load i32, i32* %t.addr, align 4
  %150 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %151 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %152 = load i32, i32* %k.addr.6, align 4
  %153 = call i32 @pushed(%struct.nish_array* %150, %struct.nish_array* %151, i32 %152)
  %154 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %149, i32 %153)
  %155 = extractvalue { i32, i1 } %154, 0
  %156 = extractvalue { i32, i1 } %154, 1
  br i1 %156, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %155, i32* %t.addr, align 4
  br label %for.inc.6

for.inc.6:
  %157 = load i32, i32* %k.addr.6, align 4
  %158 = add nsw i32 %157, 1
  store i32 %158, i32* %k.addr.6, align 4
  br label %for.cond.6

for.end.6:
  %159 = call i32 @churn()
  %160 = load i32, i32* %t.addr, align 4
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* %161)
  %163 = call i8* @nish_str_concat(i8* %162, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %164 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 0
  %166 = load i64, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %167 = trunc i64 %166 to i32
  %168 = call i8* @nish_str_from_i32(i32 %167)
  %169 = call i8* @nish_str_concat(i8* %163, i8* %168)
  %170 = call i8* @nish_str_concat(i8* %169, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %171 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %172 = call i32 @wordsSum(%struct.nish_array* %171)
  %173 = call i8* @nish_str_from_i32(i32 %172)
  %174 = call i8* @nish_str_concat(i8* %170, i8* %173)
  %175 = call i8* @nish_str_concat(i8* %174, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %176 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 0
  %178 = load i64, i64* %177, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %179 = icmp ult i64 0, %178
  br i1 %179, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %178)
  unreachable

bounds.ok:
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 2
  %181 = load i8*, i8** %180, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %182 = bitcast i8* %181 to i8**
  %183 = getelementptr inbounds i8*, i8** %182, i64 0
  %184 = load i8*, i8** %183, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %185 = call i8* @nish_str_concat(i8* %175, i8* %184)
  %186 = call i8* @nish_str_concat(i8* %185, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %187 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 0
  %189 = load i64, i64* %188, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %190 = icmp ult i64 2, %189
  br i1 %190, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %189)
  unreachable

bounds.ok.1:
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 2
  %192 = load i8*, i8** %191, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %193 = bitcast i8* %192 to i8**
  %194 = getelementptr inbounds i8*, i8** %193, i64 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %196 = call i8* @nish_str_concat(i8* %186, i8* %195)
  call void @nish_print(i8* %196)
  store i32 1, i32* %k.addr.7, align 4
  br label %for.cond.7

for.cond.7:
  %197 = load i32, i32* %k.addr.7, align 4
  %198 = icmp sle i32 %197, 3
  br i1 %198, label %for.body.7, label %for.end.7

for.body.7:
  %199 = load i32, i32* %t.addr, align 4
  %200 = load %struct.Map$i32$str*, %struct.Map$i32$str** %m.addr, align 8
  %201 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %202 = load i32, i32* %k.addr.7, align 4
  %203 = call i32 @mapped(%struct.Map$i32$str* %200, %struct.nish_array* %201, i32 %202)
  %204 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %199, i32 %203)
  %205 = extractvalue { i32, i1 } %204, 0
  %206 = extractvalue { i32, i1 } %204, 1
  br i1 %206, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %205, i32* %t.addr, align 4
  br label %for.inc.7

for.inc.7:
  %207 = load i32, i32* %k.addr.7, align 4
  %208 = add nsw i32 %207, 1
  store i32 %208, i32* %k.addr.7, align 4
  br label %for.cond.7

for.end.7:
  %209 = call i32 @churn()
  %210 = load i32, i32* %t.addr, align 4
  %211 = call i8* @nish_str_from_i32(i32 %210)
  %212 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %214 = load %struct.Map$i32$str*, %struct.Map$i32$str** %m.addr, align 8
  %215 = call i64 @nish.Map$i32$str.probe(%struct.Map$i32$str* %214, i32 1)
  %216 = icmp sge i64 %215, 0
  br i1 %216, label %nullish.value, label %nullish.default

nullish.value:
  %217 = trunc i64 %215 to i32
  %218 = call i8* @nish.Map$i32$str.valueAt(%struct.Map$i32$str* %214, i32 %217)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %219 = phi i8* [ %218, %nullish.value ], [ bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), %nullish.default ]
  %220 = call i8* @nish_str_concat(i8* %213, i8* %219)
  %221 = call i8* @nish_str_concat(i8* %220, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %222 = load %struct.Map$i32$str*, %struct.Map$i32$str** %m.addr, align 8
  %223 = call i64 @nish.Map$i32$str.probe(%struct.Map$i32$str* %222, i32 3)
  %224 = icmp sge i64 %223, 0
  br i1 %224, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %225 = trunc i64 %223 to i32
  %226 = call i8* @nish.Map$i32$str.valueAt(%struct.Map$i32$str* %222, i32 %225)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %227 = phi i8* [ %226, %nullish.value.1 ], [ bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), %nullish.default.1 ]
  %228 = call i8* @nish_str_concat(i8* %221, i8* %227)
  call void @nish_print(i8* %228)
  store i32 1, i32* %k.addr.8, align 4
  br label %for.cond.8

for.cond.8:
  %229 = load i32, i32* %k.addr.8, align 4
  %230 = icmp sle i32 %229, 3
  br i1 %230, label %for.body.8, label %for.end.8

for.body.8:
  %231 = load i32, i32* %t.addr, align 4
  %232 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %233 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %234 = load i32, i32* %k.addr.8, align 4
  %235 = call i32 @boxed(%struct.Holder* %232, %struct.nish_array* %233, i32 %234)
  %236 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %231, i32 %235)
  %237 = extractvalue { i32, i1 } %236, 0
  %238 = extractvalue { i32, i1 } %236, 1
  br i1 %238, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i32 %237, i32* %t.addr, align 4
  br label %for.inc.8

for.inc.8:
  %239 = load i32, i32* %k.addr.8, align 4
  %240 = add nsw i32 %239, 1
  store i32 %240, i32* %k.addr.8, align 4
  br label %for.cond.8

for.end.8:
  %241 = call i32 @churn()
  %242 = load i32, i32* %t.addr, align 4
  %243 = call i8* @nish_str_from_i32(i32 %242)
  %244 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.13 to i8*), i8* %243)
  %245 = call i8* @nish_str_concat(i8* %244, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %246 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %247 = getelementptr inbounds %struct.Holder, %struct.Holder* %246, i32 0, i32 2
  %248 = load %struct.Box*, %struct.Box** %247, align 8, !tbaa !21
  %249 = getelementptr inbounds %struct.Box, %struct.Box* %248, i32 0, i32 0
  %250 = load %struct.nish_array*, %struct.nish_array** %249, align 8, !tbaa !17
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %250, i64 0, i32 0
  %252 = load i64, i64* %251, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %253 = icmp ult i64 0, %252
  br i1 %253, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %252)
  unreachable

bounds.ok.2:
  %254 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %250, i64 0, i32 2
  %255 = load i8*, i8** %254, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %256 = bitcast i8* %255 to i8**
  %257 = getelementptr inbounds i8*, i8** %256, i64 0
  %258 = load i8*, i8** %257, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %259 = call i8* @nish_str_concat(i8* %245, i8* %258)
  %260 = call i8* @nish_str_concat(i8* %259, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %261 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %262 = getelementptr inbounds %struct.Holder, %struct.Holder* %261, i32 0, i32 2
  %263 = load %struct.Box*, %struct.Box** %262, align 8, !tbaa !21
  %264 = getelementptr inbounds %struct.Box, %struct.Box* %263, i32 0, i32 0
  %265 = load %struct.nish_array*, %struct.nish_array** %264, align 8, !tbaa !17
  %266 = call i32 @wordsSum(%struct.nish_array* %265)
  %267 = call i8* @nish_str_from_i32(i32 %266)
  %268 = call i8* @nish_str_concat(i8* %260, i8* %267)
  call void @nish_print(i8* %268)
  store i32 1, i32* %k.addr.9, align 4
  br label %for.cond.9

for.cond.9:
  %269 = load i32, i32* %k.addr.9, align 4
  %270 = icmp sle i32 %269, 3
  br i1 %270, label %for.body.9, label %for.end.9

for.body.9:
  %271 = load i32, i32* %t.addr, align 4
  %272 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %273 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %274 = load i32, i32* %k.addr.9, align 4
  %275 = call i32 @tagged(%struct.Holder* %272, %struct.nish_array* %273, i32 %274)
  %276 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %271, i32 %275)
  %277 = extractvalue { i32, i1 } %276, 0
  %278 = extractvalue { i32, i1 } %276, 1
  br i1 %278, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  store i32 %277, i32* %t.addr, align 4
  br label %for.inc.9

for.inc.9:
  %279 = load i32, i32* %k.addr.9, align 4
  %280 = add nsw i32 %279, 1
  store i32 %280, i32* %k.addr.9, align 4
  br label %for.cond.9

for.end.9:
  %281 = call i32 @churn()
  %282 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %283 = getelementptr inbounds %struct.Holder, %struct.Holder* %282, i32 0, i32 3
  %284 = load %struct.Tag*, %struct.Tag** %283, align 8, !tbaa !22
  store %struct.Tag* %284, %struct.Tag** %tag.addr, align 8
  %285 = load i32, i32* %t.addr, align 4
  %286 = call i8* @nish_str_from_i32(i32 %285)
  %287 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*), i8* %286)
  %288 = call i8* @nish_str_concat(i8* %287, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %289 = load %struct.Tag*, %struct.Tag** %tag.addr, align 8
  %290 = icmp eq %struct.Tag* %289, null
  br i1 %290, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %291 = load %struct.Tag*, %struct.Tag** %tag.addr, align 8
  %292 = getelementptr inbounds %struct.Tag, %struct.Tag* %291, i32 0, i32 0
  %293 = load i8*, i8** %292, align 8, !tbaa !24
  br label %cond.end

cond.end:
  %294 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), %cond.true ], [ %293, %cond.false ]
  %295 = call i8* @nish_str_concat(i8* %288, i8* %294)
  call void @nish_print(i8* %295)
  store i32 1, i32* %k.addr.10, align 4
  br label %for.cond.10

for.cond.10:
  %296 = load i32, i32* %k.addr.10, align 4
  %297 = icmp sle i32 %296, 3
  br i1 %297, label %for.body.10, label %for.end.10

for.body.10:
  %298 = load i32, i32* %t.addr, align 4
  %299 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %300 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %301 = load i32, i32* %k.addr.10, align 4
  %302 = call i32 @second(%struct.Holder* %299, %struct.nish_array* %300, i32 %301)
  %303 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %298, i32 %302)
  %304 = extractvalue { i32, i1 } %303, 0
  %305 = extractvalue { i32, i1 } %303, 1
  br i1 %305, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  store i32 %304, i32* %t.addr, align 4
  br label %for.inc.10

for.inc.10:
  %306 = load i32, i32* %k.addr.10, align 4
  %307 = add nsw i32 %306, 1
  store i32 %307, i32* %k.addr.10, align 4
  br label %for.cond.10

for.end.10:
  %308 = call i32 @churn()
  %309 = load i32, i32* %t.addr, align 4
  %310 = call i8* @nish_str_from_i32(i32 %309)
  %311 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.15 to i8*), i8* %310)
  %312 = call i8* @nish_str_concat(i8* %311, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %313 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %314 = getelementptr inbounds %struct.Holder, %struct.Holder* %313, i32 0, i32 1
  %315 = load i8*, i8** %314, align 8, !tbaa !20
  %316 = call i8* @nish_str_concat(i8* %312, i8* %315)
  call void @nish_print(i8* %316)
  store i32 1, i32* %k.addr.11, align 4
  br label %for.cond.11

for.cond.11:
  %317 = load i32, i32* %k.addr.11, align 4
  %318 = icmp sle i32 %317, 3
  br i1 %318, label %for.body.11, label %for.end.11

for.body.11:
  %319 = load i32, i32* %t.addr, align 4
  %320 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %321 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %322 = load i32, i32* %k.addr.11, align 4
  %323 = call i32 @aliased(%struct.Holder* %320, %struct.nish_array* %321, i32 %322)
  %324 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %319, i32 %323)
  %325 = extractvalue { i32, i1 } %324, 0
  %326 = extractvalue { i32, i1 } %324, 1
  br i1 %326, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  store i32 %325, i32* %t.addr, align 4
  br label %for.inc.11

for.inc.11:
  %327 = load i32, i32* %k.addr.11, align 4
  %328 = add nsw i32 %327, 1
  store i32 %328, i32* %k.addr.11, align 4
  br label %for.cond.11

for.end.11:
  %329 = call i32 @churn()
  %330 = load i32, i32* %t.addr, align 4
  %331 = call i8* @nish_str_from_i32(i32 %330)
  %332 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.16 to i8*), i8* %331)
  %333 = call i8* @nish_str_concat(i8* %332, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %334 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %335 = call i64 @nish_arena_mark()
  %336 = call i8* @show(%struct.Holder* %334)
  %337 = call i8* @nish_arena_keep(i64 %335, i8* %336)
  %338 = call i8* @nish_str_concat(i8* %333, i8* %337)
  call void @nish_print(i8* %338)
  store i32 1, i32* %k.addr.12, align 4
  br label %for.cond.12

for.cond.12:
  %339 = load i32, i32* %k.addr.12, align 4
  %340 = icmp sle i32 %339, 3
  br i1 %340, label %for.body.12, label %for.end.12

for.body.12:
  %341 = load i32, i32* %t.addr, align 4
  %342 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %343 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %344 = load i32, i32* %k.addr.12, align 4
  %345 = call i32 @relayed(%struct.Holder* %342, %struct.nish_array* %343, i32 %344)
  %346 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %341, i32 %345)
  %347 = extractvalue { i32, i1 } %346, 0
  %348 = extractvalue { i32, i1 } %346, 1
  br i1 %348, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  store i32 %347, i32* %t.addr, align 4
  br label %for.inc.12

for.inc.12:
  %349 = load i32, i32* %k.addr.12, align 4
  %350 = add nsw i32 %349, 1
  store i32 %350, i32* %k.addr.12, align 4
  br label %for.cond.12

for.end.12:
  %351 = call i32 @churn()
  %352 = load i32, i32* %t.addr, align 4
  %353 = call i8* @nish_str_from_i32(i32 %352)
  %354 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.17 to i8*), i8* %353)
  %355 = call i8* @nish_str_concat(i8* %354, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %356 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %357 = getelementptr inbounds %struct.Holder, %struct.Holder* %356, i32 0, i32 1
  %358 = load i8*, i8** %357, align 8, !tbaa !20
  %359 = call i8* @nish_str_concat(i8* %355, i8* %358)
  call void @nish_print(i8* %359)
  store i32 1, i32* %k.addr.13, align 4
  br label %for.cond.13

for.cond.13:
  %360 = load i32, i32* %k.addr.13, align 4
  %361 = icmp sle i32 %360, 3
  br i1 %361, label %for.body.13, label %for.end.13

for.body.13:
  %362 = load i32, i32* %t.addr, align 4
  %363 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %364 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %365 = load i32, i32* %k.addr.13, align 4
  %366 = call i32 @nested(%struct.Holder* %363, %struct.nish_array* %364, i32 %365)
  %367 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %362, i32 %366)
  %368 = extractvalue { i32, i1 } %367, 0
  %369 = extractvalue { i32, i1 } %367, 1
  br i1 %369, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  store i32 %368, i32* %t.addr, align 4
  br label %for.inc.13

for.inc.13:
  %370 = load i32, i32* %k.addr.13, align 4
  %371 = add nsw i32 %370, 1
  store i32 %371, i32* %k.addr.13, align 4
  br label %for.cond.13

for.end.13:
  %372 = call i32 @churn()
  %373 = load i32, i32* %t.addr, align 4
  %374 = call i8* @nish_str_from_i32(i32 %373)
  %375 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.18 to i8*), i8* %374)
  %376 = call i8* @nish_str_concat(i8* %375, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %377 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %378 = getelementptr inbounds %struct.Holder, %struct.Holder* %377, i32 0, i32 1
  %379 = load i8*, i8** %378, align 8, !tbaa !20
  %380 = call i8* @nish_str_concat(i8* %376, i8* %379)
  call void @nish_print(i8* %380)
  br label %forof.inc

forof.inc:
  %381 = load i64, i64* %forof.idx, align 8
  %382 = add i64 %381, 1
  store i64 %382, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @keepCaptured$arrow0(i32 noundef %i) #2 {
entry:
  ret i32 %i
}

define hidden noundef nonnull align 8 i8* @keepCaptured$arrow1(i32 noundef %i, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %8
}

define hidden noundef nonnull align 8 i8* @field$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @array$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @returned$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 5)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @returnedArray$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 7)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @captured$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 11)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @pushed$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 13)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @mapped$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 17)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @boxed$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 19)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @tagged$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 23)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @second$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 29)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @aliased$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 31)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @relayed$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 37)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @nested$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 41)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @counted$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 43)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @word(i32 %4)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  ret i8* %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 7919)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = srem i32 %1, 10007
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.19 to i8*))
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i32$str.constructor(%struct.Map$i32$str* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !29
  %1 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !30
  %2 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !31
  %3 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !32
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.19 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !33
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !34
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !35
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !36
  ret void
}

define internal noundef i64 @nish.Map$i32$str.probe(%struct.Map$i32$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !33
  %2 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !30
  %4 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !36
  %6 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$str* @nish.Map$i32$str.set(%struct.Map$i32$str* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$str.probe(%struct.Map$i32$str* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i32$str.setValueAt(%struct.Map$i32$str* %this, i32 %4, i8* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i32$str.insertAt(%struct.Map$i32$str* %this, i64 %5, i32 %key, i8* %value)
  br label %if.end

if.end:
  ret %struct.Map$i32$str* %this
}

define internal noundef nonnull align 8 i8* @nish.Map$i32$str.valueAt(%struct.Map$i32$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.20 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !35
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %10
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %15
}

define internal void @nish.Map$i32$str.setValueAt(%struct.Map$i32$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i8* noundef nonnull noalias readonly align 8 %value) #1 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !35
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %10
  store i8* %value, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$str.insertAt(%struct.Map$i32$str* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !32
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.21 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$i32$str.rebuild(%struct.Map$i32$str* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !34
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  store i32 %key, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !35
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 %35
  store i8* %value, i8** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !36
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !31
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !31
  %65 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !29
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !29
  %71 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !34
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !33
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i32$str.rebuild(%struct.Map$i32$str* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !33
  %91 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !30
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$i32$str.rebuild(%struct.Map$i32$str* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !32
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !33
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !31
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !34
  %26 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !36
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !35
  %30 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !36
  call void @nish.compactEntries$str(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !36
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !33
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !30
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$str, %struct.Map$i32$str* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !36
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = lshr i32 %key, 16
  %1 = xor i32 %key, %0
  %2 = mul i32 %1, -2048144789
  %3 = lshr i32 %2, 13
  %4 = xor i32 %2, %3
  %5 = mul i32 %4, -1028477387
  %6 = lshr i32 %5, 16
  %7 = xor i32 %5, %6
  %8 = icmp eq i32 %7, 0
  %9 = select i1 %8, i32 1, i32 %7
  store i32 %9, i32* %h.addr, align 4
  %10 = load i32, i32* %h.addr, align 4
  %11 = lshr i32 %10, 24
  store i32 %11, i32* %fingerprint.addr, align 4
  %12 = load i32, i32* %h.addr, align 4
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask)
  store i32 %13, i32* %bucket.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4
  %29 = trunc i64 %15 to i32
  %30 = icmp slt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ]
  br i1 %31, label %while.body, label %while.end

while.body:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %17 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  store i32 %36, i32* %word.addr, align 4
  %37 = load i32, i32* %word.addr, align 4
  %38 = icmp eq i32 %37, 0
  br i1 %38, label %if.then, label %if.end

if.then:
  %39 = load i32, i32* %bucket.addr, align 4
  %40 = load i32, i32* %h.addr, align 4
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40)
  ret i64 %41

if.end:
  %42 = load i32, i32* %word.addr, align 4
  %43 = lshr i32 %42, 24
  %44 = load i32, i32* %fingerprint.addr, align 4
  %45 = icmp eq i32 %43, %44
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  %46 = load i32, i32* %word.addr, align 4
  %47 = and i32 %46, 16777215
  %48 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %49, i32* %at.addr, align 4
  %51 = load i32, i32* %at.addr, align 4
  %52 = icmp sge i32 %51, 0
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = load i32, i32* %at.addr, align 4
  %54 = trunc i64 %19 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %ovf.ok ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = bitcast i8* %21 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %58
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %62 = load i32, i32* %h.addr, align 4
  %63 = icmp eq i32 %61, %62
  br label %land.end.3

land.end.3:
  %64 = phi i1 [ false, %land.end.4 ], [ %63, %land.rhs.3 ]
  br i1 %64, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %65 = load i32, i32* %at.addr, align 4
  %66 = trunc i64 %23 to i32
  %67 = icmp slt i32 %65, %66
  br label %land.end.2

land.end.2:
  %68 = phi i1 [ false, %land.end.3 ], [ %67, %land.rhs.2 ]
  br i1 %68, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %69 = load i32, i32* %at.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %25 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 %70
  %73 = load i32, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %74 = icmp eq i32 %73, %key
  br label %land.end.1

land.end.1:
  %75 = phi i1 [ false, %land.end.2 ], [ %74, %land.rhs.1 ]
  br i1 %75, label %if.then.2, label %if.end.2

if.then.2:
  %76 = load i32, i32* %bucket.addr, align 4
  %77 = load i32, i32* %at.addr, align 4
  %78 = tail call i64 @nish.foundAt(i32 %76, i32 %77)
  ret i64 %78

if.end.2:
  br label %if.end.1

if.end.1:
  %79 = load i32, i32* %bucket.addr, align 4
  %80 = add nsw i32 %79, 1
  %81 = and i32 %80, %mask
  store i32 %81, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.22 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !26
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Box", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"Holder", !15, i64 0, !15, i64 8, !15, i64 16, !15, i64 24}
!19 = !{!18, !15, i64 0}
!20 = !{!18, !15, i64 8}
!21 = !{!18, !15, i64 16}
!22 = !{!18, !15, i64 24}
!23 = !{!"Tag", !15, i64 0}
!24 = !{!23, !15, i64 0}
!25 = !{!"element i32", !6, i64 0}
!26 = !{!25, !25, i64 0}
!27 = !{!"i32", !6, i64 0}
!28 = !{!"Map$i32$str", !27, i64 0, !15, i64 8, !27, i64 16, !27, i64 20, !15, i64 24, !15, i64 32, !15, i64 40, !27, i64 48}
!29 = !{!28, !27, i64 0}
!30 = !{!28, !27, i64 16}
!31 = !{!28, !27, i64 20}
!32 = !{!28, !27, i64 48}
!33 = !{!28, !15, i64 8}
!34 = !{!28, !15, i64 24}
!35 = !{!28, !15, i64 32}
!36 = !{!28, !15, i64 40}
