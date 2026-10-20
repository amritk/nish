%struct.Words = type { %struct.nish_array* }
%struct.Pipe = type { %struct.Channel$str*, i32 }
%struct.Slot = type { %struct.Mutex$str*, i32 }
%struct.Channel$str = type { %struct.nish_array*, i32, i64 }
%struct.Mutex$str = type { %struct.MutexGuard$str* }
%struct.MutexGuard$str = type { i8*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [56 x i8] } { i64 55, [56 x i8] c"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" | \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"g\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"L\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"f\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"e\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.18.reclaimable$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.13.nested$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.nested$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.14.bigRows$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$str$fn.12.tasks$arrow0(i32 noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Words$str$fn.6.joined(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Words* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Slot$i32$fn.5.store(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Slot* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.13.shapes$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.4.word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$str$fn.5.label(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare void @nish.parallelMapInto$i32$str$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.11.into$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.11.pick$arrow0(i32 noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.11.pick$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare void @nish.Channel$str.constructor(%struct.Channel$str* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #1
declare void @nish.Channel$str.send(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef nonnull align 8 i8* @nish.Channel$str.take(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.Channel$str.ready(%struct.Channel$str* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #3
declare void @nish.Mutex$str.constructor(%struct.Mutex$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$str.constructor(%struct.MutexGuard$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare void @nish_scope_join(i8* noundef nonnull) #0
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #0
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #0
declare i8* @nish_cross_in(i8* noundef, i64 noundef) #0
declare noundef i8* @nish_guard_keep(i8* noundef, i8* noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #2
declare i64 @llvm.smax.i64(i64, i64) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define internal noundef nonnull align 8 i8* @big(i8* noundef nonnull noalias readonly align 8 nocapture %tag, i32 noundef %n) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 1000
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %tag, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  store i8* %10, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %28 = load i64, i64* %27, align 8
  %29 = sub i64 %26, 1
  %30 = mul i64 %28, %29
  %31 = icmp eq i64 %26, 0
  %32 = select i1 %31, i64 0, i64 %30
  store i64 %32, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %33 = load i64, i64* %join.at, align 8
  %34 = icmp ult i64 %33, %26
  br i1 %34, label %join.sum.body, label %join.copy

join.sum.body:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %33
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = load i64, i64* %join.total, align 8
  %41 = bitcast i8* %39 to i64*
  %42 = load i64, i64* %41, align 8
  %43 = add i64 %40, %42
  store i64 %43, i64* %join.total, align 8
  %44 = add i64 %33, 1
  store i64 %44, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %45 = load i64, i64* %join.total, align 8
  %46 = icmp ugt i64 %45, 2147483647
  %47 = add i64 %45, 9
  %48 = select i1 %46, i64 4611686018427387904, i64 %47
  %49 = call i8* @nish_alloc_struct(i64 %48)
  %50 = bitcast i8* %49 to i64*
  store i64 %45, i64* %50, align 8
  %51 = getelementptr inbounds i8, i8* %49, i64 8
  store i8* %51, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %52 = load i64, i64* %join.at, align 8
  %53 = icmp ult i64 %52, %26
  br i1 %53, label %join.part, label %join.end

join.part:
  %54 = load i8*, i8** %join.p, align 8
  %55 = icmp eq i64 %52, 0
  %56 = select i1 %55, i64 0, i64 %28
  %57 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %54, i8* %57, i64 %56, i1 false)
  %58 = getelementptr inbounds i8, i8* %54, i64 %56
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 %52
  %63 = load i8*, i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = bitcast i8* %63 to i64*
  %65 = load i64, i64* %64, align 8
  %66 = getelementptr inbounds i8, i8* %63, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %58, i8* %66, i64 %65, i1 false)
  %67 = getelementptr inbounds i8, i8* %58, i64 %65
  store i8* %67, i8** %join.p, align 8
  %68 = add i64 %52, 1
  store i64 %68, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %69 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %69, align 1
  ret i8* %49
}

define internal noundef i32 @sumOf(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %t.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 97)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %t.addr, align 4
  %20 = bitcast i8* %s to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @word$(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %0)
  ret i8* %1
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
  store i32 %32, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = add i64 %34, 1
  store i64 %35, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %36 = load i32, i32* %t.addr, align 4
  ret i32 %36

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @reclaimable(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.18.reclaimable$arrow0(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* %1)
  store %struct.nish_array* %2, %struct.nish_array** %ws.addr, align 8
  %3 = call i32 @churn()
  %4 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 0
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %14 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %15 = sub nsw i32 %n, 1
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  %24 = load i8*, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = call i8* @nish_str_concat(i8* %13, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %27 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %26, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %34 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %35 = call i32 @wordsSum(%struct.nish_array* %34)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %33, i8* %36)
  ret i8* %37
}

define internal noundef nonnull align 8 i8* @nested() #0 {
entry:
  %keep.addr = alloca %struct.nish_array*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %keep.addr, align 8
  %5 = call %struct.nish_array* @nish.parallelFrom$i32$fn.13.nested$arrow0(i32 70000)
  store %struct.nish_array* %5, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.nested$arrow1(%struct.nish_array* %6)
  store %struct.nish_array* %7, %struct.nish_array** %ws.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  store %struct.nish_array* %8, %struct.nish_array** %keep.addr, align 8
  %9 = call i32 @churn()
  %10 = call i32 @churn()
  %11 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 0, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 0
  %19 = load i8*, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %21 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 69999, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 69999, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 69999
  %29 = load i8*, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = call i8* @nish_str_concat(i8* %20, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %33 = call i32 @wordsSum(%struct.nish_array* %32)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %31, i8* %34)
  ret i8* %35
}

define internal noundef nonnull align 8 i8* @inner(i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ws.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 12000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %k)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %7, i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* %11, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %25 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %29 = load i64, i64* %28, align 8
  %30 = sub i64 %27, 1
  %31 = mul i64 %29, %30
  %32 = icmp eq i64 %27, 0
  %33 = select i1 %32, i64 0, i64 %31
  store i64 %33, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %34 = load i64, i64* %join.at, align 8
  %35 = icmp ult i64 %34, %27
  br i1 %35, label %join.sum.body, label %join.copy

join.sum.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %34
  %40 = load i8*, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = load i64, i64* %join.total, align 8
  %42 = bitcast i8* %40 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = add i64 %41, %43
  store i64 %44, i64* %join.total, align 8
  %45 = add i64 %34, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %46 = load i64, i64* %join.total, align 8
  %47 = icmp ugt i64 %46, 2147483647
  %48 = add i64 %46, 9
  %49 = select i1 %47, i64 4611686018427387904, i64 %48
  %50 = call i8* @nish_alloc_struct(i64 %49)
  %51 = bitcast i8* %50 to i64*
  store i64 %46, i64* %51, align 8
  %52 = getelementptr inbounds i8, i8* %50, i64 8
  store i8* %52, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %27
  br i1 %54, label %join.part, label %join.end

join.part:
  %55 = load i8*, i8** %join.p, align 8
  %56 = icmp eq i64 %53, 0
  %57 = select i1 %56, i64 0, i64 %29
  %58 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %58, i64 %57, i1 false)
  %59 = getelementptr inbounds i8, i8* %55, i64 %57
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i8**
  %63 = getelementptr inbounds i8*, i8** %62, i64 %53
  %64 = load i8*, i8** %63, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = getelementptr inbounds i8, i8* %64, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %67, i64 %66, i1 false)
  %68 = getelementptr inbounds i8, i8* %59, i64 %66
  store i8* %68, i8** %join.p, align 8
  %69 = add i64 %53, 1
  store i64 %69, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %70 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %70, align 1
  ret i8* %50
}

define internal noundef nonnull align 8 i8* @bigRows() #0 {
entry:
  %ks.addr = alloca %struct.nish_array*, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %r.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.14.bigRows$arrow0(i32 6)
  store %struct.nish_array* %0, %struct.nish_array** %ks.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ks.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* %1)
  store %struct.nish_array* %2, %struct.nish_array** %rows.addr, align 8
  %3 = call i32 @churn()
  store i32 0, i32* %t.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %13, i8** %r.addr, align 8
  %14 = load i32, i32* %t.addr, align 4
  %15 = load i8*, i8** %r.addr, align 8
  %16 = call i32 @sumOf(i8* %15)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = add i64 %20, 1
  store i64 %21, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %28 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ult i64 5, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 5
  %36 = load i8*, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = bitcast i8* %36 to i64*
  %38 = load i64, i64* %37, align 8
  %39 = trunc i64 %38 to i32
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %27, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %43 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 5
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = call i64 @llvm.smin.i64(i64 8, i64 %50)
  %52 = call i64 @llvm.smax.i64(i64 %51, i64 0)
  %53 = call i64 @llvm.smin.i64(i64 0, i64 %52)
  %54 = call i64 @llvm.smax.i64(i64 0, i64 %52)
  %55 = sub i64 %54, %53
  %56 = getelementptr inbounds i8, i8* %48, i64 8
  %57 = getelementptr inbounds i8, i8* %56, i64 %53
  %58 = call i8* @nish_str_new(i8* %57, i64 %55)
  %59 = call i8* @nish_str_concat(i8* %42, i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %61 = load i32, i32* %t.addr, align 4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %60, i8* %62)
  ret i8* %63

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Words.constructor(%struct.Words* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %0 = getelementptr inbounds %struct.Words, %struct.Words* %this, i32 0, i32 0
  store %struct.nish_array* %ws, %struct.nish_array** %0, align 8, !tbaa !17
  ret void
}

define hidden noundef nonnull align 8 i8* @joined$(%struct.Words* noundef nonnull readonly align 8 dereferenceable(8) nocapture %w) #1 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Words, %struct.Words* %w, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %5 = load i64, i64* %4, align 8
  %6 = sub i64 %3, 1
  %7 = mul i64 %5, %6
  %8 = icmp eq i64 %3, 0
  %9 = select i1 %8, i64 0, i64 %7
  store i64 %9, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %10 = load i64, i64* %join.at, align 8
  %11 = icmp ult i64 %10, %3
  br i1 %11, label %join.sum.body, label %join.copy

join.sum.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %10
  %16 = load i8*, i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = load i64, i64* %join.total, align 8
  %18 = bitcast i8* %16 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = add i64 %17, %19
  store i64 %20, i64* %join.total, align 8
  %21 = add i64 %10, 1
  store i64 %21, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %22 = load i64, i64* %join.total, align 8
  %23 = icmp ugt i64 %22, 2147483647
  %24 = add i64 %22, 9
  %25 = select i1 %23, i64 4611686018427387904, i64 %24
  %26 = call i8* @nish_alloc_struct(i64 %25)
  %27 = bitcast i8* %26 to i64*
  store i64 %22, i64* %27, align 8
  %28 = getelementptr inbounds i8, i8* %26, i64 8
  store i8* %28, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %29 = load i64, i64* %join.at, align 8
  %30 = icmp ult i64 %29, %3
  br i1 %30, label %join.part, label %join.end

join.part:
  %31 = load i8*, i8** %join.p, align 8
  %32 = icmp eq i64 %29, 0
  %33 = select i1 %32, i64 0, i64 %5
  %34 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %31, i8* %34, i64 %33, i1 false)
  %35 = getelementptr inbounds i8, i8* %31, i64 %33
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %29
  %40 = load i8*, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = bitcast i8* %40 to i64*
  %42 = load i64, i64* %41, align 8
  %43 = getelementptr inbounds i8, i8* %40, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %35, i8* %43, i64 %42, i1 false)
  %44 = getelementptr inbounds i8, i8* %35, i64 %42
  store i8* %44, i8** %join.p, align 8
  %45 = add i64 %29, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %46 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %46, align 1
  ret i8* %26
}

define internal noundef nonnull align 8 i8* @tasks(i32 noundef %round) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %o.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %6, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %6, i64 3
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %11 = call %struct.nish_array* @nish.parallelFrom$str$fn.12.tasks$arrow0(i32 70000, i32 %round)
  store %struct.nish_array* %11, %struct.nish_array** %ws.addr, align 8
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Words*
  %18 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  call void @Words.constructor(%struct.Words* %17, %struct.nish_array* %18)
  %19 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$$Words$str$fn.6.joined(%struct.ThreadScope* %15, %struct.Words* %17, %struct.nish_array* %19, i32 0)
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp slt i32 %20, 4
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 16000, %23
  %25 = add nsw i32 %24, %round
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1(%struct.ThreadScope* %22, i32 %25, %struct.nish_array* %26, i32 %27)
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %14)
  %30 = call i32 @churn()
  store i32 0, i32* %t.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %32 = load i64, i64* %forof.idx, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ult i64 %32, %34
  br i1 %35, label %forof.body, label %forof.end

forof.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %32
  %40 = load i8*, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %40, i8** %o.addr, align 8
  %41 = load i32, i32* %t.addr, align 4
  %42 = load i8*, i8** %o.addr, align 8
  %43 = call i32 @sumOf(i8* %42)
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %45, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %47 = load i64, i64* %forof.idx, align 8
  %48 = add i64 %47, 1
  store i64 %48, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 0, %51
  br i1 %52, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %51)
  unreachable

bounds.ok:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 0
  %57 = load i8*, i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = bitcast i8* %57 to i64*
  %59 = load i64, i64* %58, align 8
  %60 = trunc i64 %59 to i32
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %63 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ult i64 3, %65
  br i1 %66, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %65)
  unreachable

bounds.ok.1:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 3
  %71 = load i8*, i8** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %72 = bitcast i8* %71 to i64*
  %73 = load i64, i64* %72, align 8
  %74 = trunc i64 %73 to i32
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %62, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %78 = load i32, i32* %t.addr, align 4
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %77, i8* %79)
  ret i8* %80

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @twice() #0 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %0 = call i8* @tasks(i32 1)
  store i8* %0, i8** %a.addr, align 8
  %1 = call i32 @churn()
  %2 = call i8* @tasks(i32 2)
  store i8* %2, i8** %b.addr, align 8
  %3 = call i32 @churn()
  %4 = load i8*, i8** %a.addr, align 8
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [4 x i8] }* @.str.7 to i8*))
  %6 = load i8*, i8** %b.addr, align 8
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @fetchBig(i32 noundef %k) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %8 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %8, %struct.ThreadScope** %s.addr, align 8
  %9 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %10 = bitcast %struct.ThreadScope* %9 to i8*
  %11 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %12 = add nsw i32 15000, %k
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0(%struct.ThreadScope* %11, i32 %12, %struct.nish_array* %13, i32 0)
  call void @nish_scope_join(i8* %10)
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 0
  %22 = load i8*, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %22
}

define internal noundef nonnull align 8 i8* @reclaimAfter() #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, 4
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %6 = load i32, i32* %k.addr, align 4
  %7 = call i8* @fetchBig(i32 %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %20 = load i32, i32* %k.addr, align 4
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @word$(i32 %20)
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store.1

push.store.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %23, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %for.inc

for.inc:
  %35 = load i32, i32* %k.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %37 = call i32 @churn()
  store i32 0, i32* %t.addr, align 4
  %38 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 %39, %41
  br i1 %42, label %forof.body, label %forof.end

forof.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  %47 = load i8*, i8** %46, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %47, i8** %s.addr, align 8
  %48 = load i32, i32* %t.addr, align 4
  %49 = load i8*, i8** %s.addr, align 8
  %50 = call i32 @sumOf(i8* %49)
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %52, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %54 = load i64, i64* %forof.idx, align 8
  %55 = add i64 %54, 1
  store i64 %55, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %56 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = trunc i64 %58 to i32
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %62 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ult i64 6, %64
  br i1 %65, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 6, i64 %64)
  unreachable

bounds.ok:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i8**
  %69 = getelementptr inbounds i8*, i8** %68, i64 6
  %70 = load i8*, i8** %69, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = bitcast i8* %70 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = trunc i64 %72 to i32
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %61, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp ult i64 7, %79
  br i1 %80, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 7, i64 %79)
  unreachable

bounds.ok.1:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i8**
  %84 = getelementptr inbounds i8*, i8** %83, i64 7
  %85 = load i8*, i8** %84, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = call i8* @nish_str_concat(i8* %76, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %88 = load i32, i32* %t.addr, align 4
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* %87, i8* %89)
  ret i8* %90

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Pipe.constructor(%struct.Pipe* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Channel$str* noundef nonnull align 8 dereferenceable(24) %ch, i32 noundef %n) #1 {
entry:
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 0
  store %struct.Channel$str* %ch, %struct.Channel$str** %0, align 8, !tbaa !20
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  store i32 %n, i32* %1, align 4, !tbaa !21
  ret void
}

define hidden noundef i32 @send$(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #0 {
entry:
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !21
  %3 = icmp slt i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %5 = load i8*, i8** %4, align 8
  %6 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %7 = load i64, i64* %6, align 8
  %8 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %9 = load %struct.Channel$str*, %struct.Channel$str** %8, align 8, !tbaa !20
  %10 = load i32, i32* %i.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 15000, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @big(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i32 %12)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish.Channel$str.send(%struct.Channel$str* %9, i8* %16)
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %18 = load i8*, i8** %17, align 8
  %19 = icmp eq i8* %18, %5
  br i1 %19, label %pass.rewind, label %pass.free

pass.rewind:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %7, i64* %20, align 8
  br label %pass.done

pass.free:
  %21 = ptrtoint i8* %5 to i64
  %22 = add i64 %21, %7
  call void @nish_arena_release(i64 %22)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !21
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @channel() #0 {
entry:
  %ch.addr = alloca %struct.Channel$str*, align 8
  %sent.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %got.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %s.addr.1 = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %t.addr = alloca i32, align 4
  %s.addr.2 = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %1)
  store %struct.Channel$str* %1, %struct.Channel$str** %ch.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  store %struct.nish_array* %3, %struct.nish_array** %sent.addr, align 8
  %10 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %10, %struct.ThreadScope** %s.addr, align 8
  %11 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %12 = bitcast %struct.ThreadScope* %11 to i8*
  %13 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %14 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %13, i32 0, i32 2
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 16)
  %17 = bitcast i8* %16 to %struct.Pipe*
  %18 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %17, %struct.Channel$str* %18, i32 3)
  %19 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send(%struct.ThreadScope* %15, %struct.Pipe* %17, %struct.nish_array* %19, i32 0)
  call void @nish_channel_count(i64* %14, i64 -1)
  call void @nish_scope_join(i8* %12)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %got.addr, align 8
  %23 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %24 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %23, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %25 = call i32 @nish_channel_receive(i64* %24, i64* %chan.slot)
  %26 = icmp ne i32 %25, 0
  br i1 %26, label %chan.body, label %chan.end

chan.body:
  %27 = load i64, i64* %chan.slot, align 8
  %28 = inttoptr i64 %27 to i8*
  %29 = call i8* @nish_cross_in(i8* %28, i64 0)
  store i8* %29, i8** %s.addr.1, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %31 = load i8*, i8** %s.addr.1, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %30, i64 8)
  br label %push.store

push.store:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %33
  store i8* %31, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = trunc i64 %41 to i32
  br label %chan.recv

chan.end:
  %43 = call i32 @churn()
  store i32 0, i32* %t.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %45 = load i64, i64* %forof.idx, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp ult i64 %45, %47
  br i1 %48, label %forof.body, label %forof.end

forof.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 %45
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %53, i8** %s.addr.2, align 8
  %54 = load i32, i32* %t.addr, align 4
  %55 = load i8*, i8** %s.addr.2, align 8
  %56 = call i32 @sumOf(i8* %55)
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %54, i32 %56)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %58, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %60 = load i64, i64* %forof.idx, align 8
  %61 = add i64 %60, 1
  store i64 %61, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %62 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
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
  %70 = load i32, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %73 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* %72, i8* %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %80 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ult i64 2, %82
  br i1 %83, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %82)
  unreachable

bounds.ok.1:
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = bitcast i8* %85 to i8**
  %87 = getelementptr inbounds i8*, i8** %86, i64 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %89 = bitcast i8* %88 to i64*
  %90 = load i64, i64* %89, align 8
  %91 = trunc i64 %90 to i32
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %79, i8* %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %95 = load i32, i32* %t.addr, align 4
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* %94, i8* %96)
  ret i8* %97

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @inArena() #0 {
entry:
  %before.addr = alloca i8*, align 8
  %ch.addr = alloca %struct.Channel$str*, align 8
  %sent.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %got.addr = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %late.addr = alloca %struct.Channel$str*, align 8
  %s.addr.1 = alloca %struct.ThreadScope*, align 8
  %u.addr = alloca i32, align 4
  %got.addr.1 = alloca i8*, align 8
  %chan.slot.1 = alloca i64, align 8
  %a.addr.1 = alloca i64, align 8
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @word$(i32 7)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %before.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %4)
  store %struct.Channel$str* %4, %struct.Channel$str** %ch.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 1, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 1, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = call i8* @nish_alloc_struct(i64 4)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %9 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  store i32 0, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  store %struct.nish_array* %6, %struct.nish_array** %sent.addr, align 8
  %13 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %13, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = bitcast %struct.ThreadScope* %14 to i8*
  %16 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %17 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %16, i32 0, i32 2
  %18 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %19 = call i8* @nish_alloc_struct(i64 16)
  %20 = bitcast i8* %19 to %struct.Pipe*
  %21 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %20, %struct.Channel$str* %21, i32 3)
  %22 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send(%struct.ThreadScope* %18, %struct.Pipe* %20, %struct.nish_array* %22, i32 0)
  call void @nish_channel_count(i64* %17, i64 -1)
  call void @nish_scope_join(i8* %15)
  store i32 0, i32* %t.addr, align 4
  %23 = call i64 @nish_arena_mark()
  store i64 %23, i64* %a.addr, align 8
  %24 = load i64, i64* %a.addr, align 8
  %25 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %26 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %25, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %27 = call i32 @nish_channel_receive(i64* %26, i64* %chan.slot)
  %28 = icmp ne i32 %27, 0
  br i1 %28, label %chan.body, label %chan.end

chan.body:
  %29 = load i64, i64* %chan.slot, align 8
  %30 = inttoptr i64 %29 to i8*
  %31 = call i8* @nish_cross_in(i8* %30, i64 0)
  store i8* %31, i8** %got.addr, align 8
  %32 = load i32, i32* %t.addr, align 4
  %33 = load i8*, i8** %got.addr, align 8
  %34 = call i32 @sumOf(i8* %33)
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %36, i32* %t.addr, align 4
  br label %chan.recv

chan.end:
  %38 = call i32 @churn()
  call void @nish_arena_release(i64 %24)
  %39 = call i32 @churn()
  %40 = call i8* @nish_alloc_struct(i64 24)
  %41 = bitcast i8* %40 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %41)
  store %struct.Channel$str* %41, %struct.Channel$str** %late.addr, align 8
  %42 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %42, %struct.ThreadScope** %s.addr.1, align 8
  %43 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %44 = bitcast %struct.ThreadScope* %43 to i8*
  %45 = load %struct.Channel$str*, %struct.Channel$str** %late.addr, align 8
  %46 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %45, i32 0, i32 2
  %47 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %48 = call i8* @nish_alloc_struct(i64 16)
  %49 = bitcast i8* %48 to %struct.Pipe*
  %50 = load %struct.Channel$str*, %struct.Channel$str** %late.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %49, %struct.Channel$str* %50, i32 2)
  %51 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send(%struct.ThreadScope* %47, %struct.Pipe* %49, %struct.nish_array* %51, i32 0)
  call void @nish_channel_count(i64* %46, i64 -1)
  call void @nish_scope_join(i8* %44)
  store i32 0, i32* %u.addr, align 4
  %52 = load %struct.Channel$str*, %struct.Channel$str** %late.addr, align 8
  %53 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %52, i32 0, i32 2
  br label %chan.recv.1

chan.recv.1:
  %54 = call i32 @nish_channel_receive(i64* %53, i64* %chan.slot.1)
  %55 = icmp ne i32 %54, 0
  br i1 %55, label %chan.body.1, label %chan.end.1

chan.body.1:
  %56 = load i64, i64* %chan.slot.1, align 8
  %57 = inttoptr i64 %56 to i8*
  %58 = call i8* @nish_cross_in(i8* %57, i64 0)
  store i8* %58, i8** %got.addr.1, align 8
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %60 = load i8*, i8** %59, align 8
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %62 = load i64, i64* %61, align 8
  %63 = call i64 @nish_arena_mark()
  store i64 %63, i64* %a.addr.1, align 8
  %64 = load i64, i64* %a.addr.1, align 8
  %65 = call i32 @churn()
  %66 = load i32, i32* %u.addr, align 4
  %67 = load i8*, i8** %got.addr.1, align 8
  %68 = call i32 @sumOf(i8* %67)
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %70, i32* %u.addr, align 4
  call void @nish_arena_release(i64 %64)
  %72 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %73 = load i8*, i8** %72, align 8
  %74 = icmp eq i8* %73, %60
  br i1 %74, label %pass.rewind, label %pass.free

pass.rewind:
  %75 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %62, i64* %75, align 8
  br label %pass.done

pass.free:
  %76 = ptrtoint i8* %60 to i64
  %77 = add i64 %76, %62
  call void @nish_arena_release(i64 %77)
  br label %pass.done

pass.done:
  br label %chan.recv.1

chan.end.1:
  %78 = load i8*, i8** %before.addr, align 8
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %80 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ult i64 0, %82
  br i1 %83, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %82)
  unreachable

bounds.ok:
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = bitcast i8* %85 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 0
  %88 = load i32, i32* %87, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* %79, i8* %89)
  %91 = call i8* @nish_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %92 = load i32, i32* %t.addr, align 4
  %93 = call i8* @nish_str_from_i32(i32 %92)
  %94 = call i8* @nish_str_concat(i8* %91, i8* %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %96 = load i32, i32* %u.addr, align 4
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %95, i8* %97)
  ret i8* %98

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Slot.constructor(%struct.Slot* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Mutex$str* noundef nonnull align 8 dereferenceable(8) %m, i32 noundef %id) #1 {
entry:
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 0
  store %struct.Mutex$str* %m, %struct.Mutex$str** %0, align 8, !tbaa !25
  %1 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 1
  store i32 %id, i32* %1, align 4, !tbaa !26
  ret void
}

define hidden noundef i32 @store$(%struct.Slot* noundef nonnull readonly align 8 dereferenceable(16) nocapture %sl) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %g.addr = alloca %struct.MutexGuard$str*, align 8
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %sl, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !26
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 15000, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @big(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*), i32 %3)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = getelementptr inbounds %struct.Slot, %struct.Slot* %sl, i32 0, i32 0
  %9 = load %struct.Mutex$str*, %struct.Mutex$str** %8, align 8, !tbaa !25
  %10 = call %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* %9)
  store %struct.MutexGuard$str* %10, %struct.MutexGuard$str** %g.addr, align 8
  %11 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %12 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %11, i32 0, i32 1
  %13 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %14 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %13, i32 0, i32 0
  %15 = load i8*, i8** %14, align 8, !tbaa !28
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = load i8*, i8** %s.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %18, %22
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %25 = load i8*, i8** %s.addr, align 8
  %26 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %24, i32 0, i32 0
  %27 = load i8*, i8** %26, align 8, !tbaa !28
  %28 = call i8* @nish_guard_keep(i8* %27, i8* %25)
  %29 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %24, i32 0, i32 0
  store i8* %28, i8** %29, align 8, !tbaa !28
  br label %if.end

if.end:
  %30 = load i8*, i8** %s.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = trunc i64 %32 to i32
  store atomic i32 0, i32* %12 release, align 4
  ret i32 %33

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @guard() #0 {
entry:
  %m.addr = alloca %struct.Mutex$str*, align 8
  %lens.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %v.addr = alloca i8*, align 8
  %g.addr = alloca %struct.MutexGuard$str*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$str*
  call void @nish.Mutex$str.constructor(%struct.Mutex$str* %1, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*))
  store %struct.Mutex$str* %1, %struct.Mutex$str** %m.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 12)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  store %struct.nish_array* %3, %struct.nish_array** %lens.addr, align 8
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 3
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 16)
  %19 = bitcast i8* %18 to %struct.Slot*
  %20 = load %struct.Mutex$str*, %struct.Mutex$str** %m.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  call void @Slot.constructor(%struct.Slot* %19, %struct.Mutex$str* %20, i32 %21)
  %22 = load %struct.nish_array*, %struct.nish_array** %lens.addr, align 8
  %23 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$$Slot$i32$fn.5.store(%struct.ThreadScope* %17, %struct.Slot* %19, %struct.nish_array* %22, i32 %23)
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %14)
  %26 = call i32 @churn()
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %v.addr, align 8
  %27 = load %struct.Mutex$str*, %struct.Mutex$str** %m.addr, align 8
  %28 = call %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* %27)
  store %struct.MutexGuard$str* %28, %struct.MutexGuard$str** %g.addr, align 8
  %29 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %30 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %29, i32 0, i32 1
  %31 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %32 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %31, i32 0, i32 0
  %33 = load i8*, i8** %32, align 8, !tbaa !28
  %34 = getelementptr inbounds i8, i8* %33, i64 8
  %35 = bitcast i8* %33 to i64*
  %36 = load i64, i64* %35, align 8
  %37 = call i8* @nish_str_new(i8* %34, i64 %36)
  store i8* %37, i8** %v.addr, align 8
  store atomic i32 0, i32* %30 release, align 4
  %38 = call i32 @churn()
  %39 = load %struct.nish_array*, %struct.nish_array** %lens.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 0, %41
  br i1 %42, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %41)
  unreachable

bounds.ok:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %48 = load %struct.nish_array*, %struct.nish_array** %lens.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = icmp ult i64 1, %50
  br i1 %51, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %50)
  unreachable

bounds.ok.1:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 1
  %56 = load i32, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 %56)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok

ovf.ok:
  %60 = load %struct.nish_array*, %struct.nish_array** %lens.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = icmp ult i64 2, %62
  br i1 %63, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %62)
  unreachable

bounds.ok.2:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 2
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %72 = call i8* @nish_str_from_i32(i32 %70)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %74 = load i8*, i8** %v.addr, align 8
  %75 = bitcast i8* %74 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = trunc i64 %76 to i32
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %73, i8* %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %81 = load i8*, i8** %v.addr, align 8
  %82 = call i32 @sumOf(i8* %81)
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %80, i8* %83)
  ret i8* %84

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @label$(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @shapes(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca %struct.nish_array*, align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.13.shapes$arrow0(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.4.word(%struct.nish_array* %1)
  store %struct.nish_array* %2, %struct.nish_array** %a.addr, align 8
  %3 = call %struct.nish_array* @nish.parallelFrom$str$fn.5.label(i32 %n)
  store %struct.nish_array* %3, %struct.nish_array** %b.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %5 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow1(%struct.nish_array* %4)
  store %struct.nish_array* %5, %struct.nish_array** %c.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow2(%struct.nish_array* %6)
  store %struct.nish_array* %7, %struct.nish_array** %d.addr, align 8
  %8 = call i32 @churn()
  %9 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %10 = sub nsw i32 %n, 1
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  %19 = load i8*, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %21 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %22 = sub nsw i32 %n, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  %31 = load i8*, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = call i8* @nish_str_concat(i8* %20, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %34 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %35 = sub nsw i32 %n, 1
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 %36, %38
  br i1 %39, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %36, i64 %38)
  unreachable

bounds.ok.2:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = call i8* @nish_str_concat(i8* %33, i8* %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %47 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %48 = sub nsw i32 %n, 1
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %49, i64 %51)
  unreachable

bounds.ok.3:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 %49
  %57 = load i8*, i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = call i8* @nish_str_concat(i8* %46, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %60 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %61 = call i32 @wordsSum(%struct.nish_array* %60)
  %62 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %63 = call i32 @wordsSum(%struct.nish_array* %62)
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok

ovf.ok:
  %67 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %68 = call i32 @wordsSum(%struct.nish_array* %67)
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %65, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %72 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %73 = call i32 @wordsSum(%struct.nish_array* %72)
  %74 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %70, i32 %73)
  %75 = extractvalue { i32, i1 } %74, 0
  %76 = extractvalue { i32, i1 } %74, 1
  br i1 %76, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %77 = call i8* @nish_str_from_i32(i32 %75)
  %78 = call i8* @nish_str_concat(i8* %59, i8* %77)
  ret i8* %78

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #0 {
entry:
  call void @nish.parallelMapInto$i32$str$fn.11.fill$arrow0(%struct.nish_array* %xs, %struct.nish_array* %dst)
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @into(i32 noundef %n) #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %len.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %7
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = call %struct.nish_array* @nish.parallelFrom$i32$fn.11.into$arrow0(i32 %n)
  store %struct.nish_array* %19, %struct.nish_array** %xs.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %22 = call i32 @fill(%struct.nish_array* %20, %struct.nish_array* %21)
  store i32 %22, i32* %len.addr, align 4
  %23 = call i32 @churn()
  %24 = load i32, i32* %len.addr, align 4
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %27 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8**
  %34 = getelementptr inbounds i8*, i8** %33, i64 0
  %35 = load i8*, i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = call i8* @nish_str_concat(i8* %26, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %38 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %39 = sub nsw i32 %n, 1
  %40 = sext i32 %39 to i64
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 %40, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %40, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 %40
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = call i8* @nish_str_concat(i8* %37, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %51 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %52 = call i32 @wordsSum(%struct.nish_array* %51)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %50, i8* %53)
  ret i8* %54
}

define internal noundef nonnull align 8 i8* @pick(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.11.pick$arrow0(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.11.pick$arrow1(%struct.nish_array* %1)
  store %struct.nish_array* %2, %struct.nish_array** %ws.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %4 = sdiv i32 %n, 2
  %5 = sext i32 %4 to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %5, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %13
}

define internal noundef nonnull align 8 i8* @relay(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = add nsw i32 %k, 10
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @pick(i32 %n, i32 %0)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  ret i8* %4
}

define internal noundef nonnull align 8 i8* @picked(i32 noundef %n) #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, 4
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %6 = load i32, i32* %k.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @pick(i32 %n, i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %22 = load i32, i32* %k.addr, align 4
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @relay(i32 %n, i32 %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store.1

push.store.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8**
  %34 = getelementptr inbounds i8*, i8** %33, i64 %27
  store i8* %25, i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %39 = call i32 @churn()
  %40 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 0
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %50 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 7, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 7, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i8**
  %57 = getelementptr inbounds i8*, i8** %56, i64 7
  %58 = load i8*, i8** %57, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = call i8* @nish_str_concat(i8* %49, i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %61 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %62 = call i32 @wordsSum(%struct.nish_array* %61)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %60, i8* %63)
  ret i8* %64
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @reclaimable(i32 500)
  call void @nish_print(i8* %0)
  %1 = call i8* @reclaimable(i32 80000)
  call void @nish_print(i8* %1)
  %2 = call i8* @nested()
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @bigRows()
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i8* @twice()
  call void @nish_print(i8* %6)
  %7 = call i8* @reclaimAfter()
  call void @nish_print(i8* %7)
  %8 = call i8* @channel()
  call void @nish_print(i8* %8)
  %9 = call i8* @guard()
  call void @nish_print(i8* %9)
  %10 = call i8* @shapes(i32 500)
  call void @nish_print(i8* %10)
  %11 = call i8* @shapes(i32 80000)
  call void @nish_print(i8* %11)
  %12 = call i8* @inArena()
  call void @nish_print(i8* %12)
  %13 = call i8* @into(i32 80000)
  call void @nish_print(i8* %13)
  %14 = call i8* @picked(i32 80000)
  call void @nish_print(i8* %14)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @reclaimable$arrow0(i32 noundef %i) #2 {
entry:
  ret i32 %i
}

define hidden noundef nonnull align 8 i8* @reclaimable$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @word$(i32 %x)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define hidden noundef i32 @nested$arrow0(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @nested$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i8* %0)
  ret i8* %1
}

define hidden noundef i32 @bigRows$arrow0(i32 noundef %k) #2 {
entry:
  ret i32 %k
}

define hidden noundef nonnull align 8 i8* @bigRows$arrow1(i32 noundef %k) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @inner(i32 %k)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define hidden noundef nonnull align 8 i8* @tasks$arrow0(i32 noundef %i, i32 noundef %round) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %round)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %2 = call i8* @nish_str_from_i32(i32 %i)
  %3 = call i8* @nish_str_concat(i8* %1, i8* %2)
  ret i8* %3
}

define hidden noundef nonnull align 8 i8* @tasks$arrow1(i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @big(i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*), i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define hidden noundef nonnull align 8 i8* @fetchBig$arrow0(i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @big(i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*), i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define hidden noundef i32 @shapes$arrow0(i32 noundef %i) #2 {
entry:
  ret i32 %i
}

define hidden noundef nonnull align 8 i8* @shapes$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @label$(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @shapes$arrow2(i32 noundef %x) #0 {
entry:
  %0 = srem i32 %x, 3
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @word$(i32 %x)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  br label %cond.end

cond.false:
  %5 = srem i32 %x, 4
  %6 = add nsw i32 1, %5
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @big(i8* bitcast ({ i64, [2 x i8] }* @.str.15 to i8*), i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  br label %cond.end

cond.end:
  %10 = phi i8* [ %4, %cond.true ], [ %9, %cond.false ]
  ret i8* %10
}

define hidden noundef nonnull align 8 i8* @fill$arrow0(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 7)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word$(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @into$arrow0(i32 noundef %i) #2 {
entry:
  ret i32 %i
}

define hidden noundef i32 @pick$arrow0(i32 noundef %i, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @pick$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @word$(i32 %x)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!16 = !{!"Words", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"i32", !6, i64 0}
!19 = !{!"Pipe", !15, i64 0, !18, i64 8}
!20 = !{!19, !15, i64 0}
!21 = !{!19, !18, i64 8}
!22 = !{!"element i32", !6, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!"Slot", !15, i64 0, !18, i64 8}
!25 = !{!24, !15, i64 0}
!26 = !{!24, !18, i64 8}
!27 = !{!"MutexGuard$str", !15, i64 0, !18, i64 8}
!28 = !{!27, !15, i64 0}
