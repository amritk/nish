%struct.Holder = type { %struct.nish_array*, %struct.nish_array*, i8* }
%struct.Box = type { %struct.nish_array* }
%struct.Slot = type { i8*, i32 }
%struct.Sink = type { %struct.nish_array*, i8* }
%struct.Cell$arr.i32 = type { %struct.nish_array* }
%struct.Cell$str = type { i8* }
%struct.Map$i32$arr.i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$str = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Channel$str = type { %struct.nish_array*, i32, i64 }
%struct.Mutex$$Slot = type { %struct.MutexGuard$$Slot* }
%struct.MutexGuard$$Slot = type { %struct.Slot*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [56 x i8] } { i64 55, [56 x i8] c"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"+\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.tripled$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.intoField$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.intoField$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.firstWord$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.intoOuter$arrow0(i32 noundef, %struct.nish_array* noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.intoOuter$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.fillOuter$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.parallelMapInto$i32$str$fn.16.fillOuter$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.passThrough$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.parallelMapInto$str$str$fn.18.passThrough$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.toTask$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Box$str$fn.6.joined(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Box* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$arr.i32$fn.17.nestedInto$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.11.pick$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.choose$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.choose$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.chooseWords$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.chooseWords$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.pushed$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.pushedWords$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.intoMap$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.intoMap$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.sendWords$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Channel$str$i32$fn.6.sender(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Channel$str* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.guarded$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.guarded$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.11.sunk$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.11.sunk$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.11.sunk$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.aliased$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.aliased$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.carried$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.carried$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.reclaims$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.18.afterNested$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.afterNested$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare void @nish.Channel$str.constructor(%struct.Channel$str* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #1
declare void @nish.Channel$str.send(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef nonnull align 8 i8* @nish.Channel$str.take(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.Channel$str.ready(%struct.Channel$str* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #3
declare void @nish.Mutex$$Slot.constructor(%struct.Mutex$$Slot* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Slot* noundef nonnull align 8 dereferenceable(16)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Slot* @nish.Mutex$$Slot.lock(%struct.Mutex$$Slot* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Slot.constructor(%struct.MutexGuard$$Slot* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Slot* noundef nonnull align 8 dereferenceable(16)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare void @nish_scope_join(i8* noundef nonnull) #0
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #0
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #0
declare i8* @nish_cross_in(i8* noundef, i64 noundef) #0
declare noundef nonnull i8* @nish_guard_keep(i8* noundef, i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %t.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %8, i32* %y.addr, align 4
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i32, i32* %y.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = srem i32 %12, 1000003
  store i32 %14, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %t.addr, align 4
  ret i32 %17

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @tripled(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.tripled$arrow0(%struct.nish_array* %xs)
  ret %struct.nish_array* %0
}

define internal noundef nonnull align 8 i8* @returned(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %r.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %r.addr, align 4
  %4 = icmp slt i32 %3, 4
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %6 = call %struct.nish_array* @tripled(%struct.nish_array* %xs)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.nish_array**
  %15 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %14, i64 %8
  store %struct.nish_array* %6, %struct.nish_array** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  br label %for.inc

for.inc:
  %18 = load i32, i32* %r.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %20 = call i32 @churn()
  %21 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = trunc i64 %23 to i32
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %27 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 3, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to %struct.nish_array**
  %34 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %33, i64 3
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = sub nsw i32 %38, 1
  %40 = sext i32 %39 to i64
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 %40, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %40, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %40
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %26, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %52 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to %struct.nish_array**
  %56 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %55, i64 0
  %57 = load %struct.nish_array*, %struct.nish_array** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = call i32 @sum(%struct.nish_array* %57)
  %59 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to %struct.nish_array**
  %63 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %62, i64 3
  %64 = load %struct.nish_array*, %struct.nish_array** %63, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = call i32 @sum(%struct.nish_array* %64)
  %66 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %65)
  %67 = extractvalue { i32, i1 } %66, 0
  %68 = extractvalue { i32, i1 } %66, 1
  br i1 %68, label %ovf.fail, label %ovf.ok

ovf.ok:
  %69 = call i8* @nish_str_from_i32(i32 %67)
  %70 = call i8* @nish_str_concat(i8* %51, i8* %69)
  ret i8* %70

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this) #1 {
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
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %11, align 8, !tbaa !20
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %12, align 8, !tbaa !21
  ret void
}

define internal noundef i32 @intoField(%struct.Holder* noundef nonnull align 8 dereferenceable(24) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.intoField$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.intoField$arrow1(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %1, %struct.nish_array** %ws.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %3, align 8, !tbaa !19
  %4 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store %struct.nish_array* %4, %struct.nish_array** %5, align 8, !tbaa !20
  %6 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define internal noundef i32 @firstWord(%struct.Holder* noundef nonnull align 8 dereferenceable(24) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.firstWord$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = sub nsw i32 %4, 1
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 2
  store i8* %14, i8** %15, align 8, !tbaa !21
  %16 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  ret i32 %19
}

define internal noundef nonnull align 8 i8* @field(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp sle i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call i32 @intoField(%struct.Holder* %3, %struct.nish_array* %xs, i32 %4)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %n.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %11 = load i32, i32* %k.addr, align 4
  %12 = add nsw i32 %11, 10
  %13 = call i32 @firstWord(%struct.Holder* %10, %struct.nish_array* %xs, i32 %12)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %15, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %k.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %19 = call i32 @churn()
  %20 = load i32, i32* %n.addr, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %23 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %24 = getelementptr inbounds %struct.Holder, %struct.Holder* %23, i32 0, i32 0
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !19
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 1, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %27)
  unreachable

bounds.ok:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 1
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %22, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %37 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %38 = getelementptr inbounds %struct.Holder, %struct.Holder* %37, i32 0, i32 1
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !20
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = trunc i64 %41 to i32
  %43 = sub nsw i32 %42, 1
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 %44, %46
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %44, i64 %46)
  unreachable

bounds.ok.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 %44
  %52 = load i8*, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = call i8* @nish_str_concat(i8* %36, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %55 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %56 = getelementptr inbounds %struct.Holder, %struct.Holder* %55, i32 0, i32 2
  %57 = load i8*, i8** %56, align 8, !tbaa !21
  %58 = call i8* @nish_str_concat(i8* %54, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %60 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %61 = getelementptr inbounds %struct.Holder, %struct.Holder* %60, i32 0, i32 0
  %62 = load %struct.nish_array*, %struct.nish_array** %61, align 8, !tbaa !19
  %63 = call i32 @sum(%struct.nish_array* %62)
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %59, i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %67 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %68 = getelementptr inbounds %struct.Holder, %struct.Holder* %67, i32 0, i32 1
  %69 = load %struct.nish_array*, %struct.nish_array** %68, align 8, !tbaa !20
  %70 = call i32 @wordsSum(%struct.nish_array* %69)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %66, i8* %71)
  ret i8* %72

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @intoOuter(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rows, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %words, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %at) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.intoOuter$arrow0(i32 %2, %struct.nish_array* %xs, i32 %at)
  store %struct.nish_array* %3, %struct.nish_array** %ys.addr, align 8
  %4 = sext i32 %at to i64
  %5 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %4, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to %struct.nish_array**
  %12 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %11, i64 %4
  store %struct.nish_array* %5, %struct.nish_array** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = sext i32 %at to i64
  %14 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %15 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.intoOuter$arrow1(%struct.nish_array* %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %words, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %13, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %13, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %words, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to %struct.nish_array**
  %22 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %21, i64 %13
  store %struct.nish_array* %15, %struct.nish_array** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  ret i32 %26
}

define internal noundef nonnull align 8 i8* @outer(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %struct.nish_array*], align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x %struct.nish_array*], align 8
  %n.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast [3 x %struct.nish_array*]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %17 to %struct.nish_array**
  %20 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %19, i64 0
  store %struct.nish_array* %1, %struct.nish_array** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %19, i64 1
  store %struct.nish_array* %6, %struct.nish_array** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %19, i64 2
  store %struct.nish_array* %11, %struct.nish_array** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 0, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* null, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* null, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = call i8* @nish_alloc_struct(i64 24)
  %34 = bitcast i8* %33 to %struct.nish_array*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  store i64 0, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  store i64 0, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  store i8* null, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = bitcast [3 x %struct.nish_array*]* %arr.data.1 to i8*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %40 to %struct.nish_array**
  %43 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %42, i64 0
  store %struct.nish_array* %24, %struct.nish_array** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %42, i64 1
  store %struct.nish_array* %29, %struct.nish_array** %44, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %42, i64 2
  store %struct.nish_array* %34, %struct.nish_array** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %at.addr, align 4
  br label %for.cond

for.cond:
  %46 = load i32, i32* %at.addr, align 4
  %47 = icmp slt i32 %46, 3
  br i1 %47, label %for.body, label %for.end

for.body:
  %48 = load i32, i32* %n.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %51 = load i32, i32* %at.addr, align 4
  %52 = call i32 @intoOuter(%struct.nish_array* %49, %struct.nish_array* %50, %struct.nish_array* %xs, i32 %51)
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %52)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %54, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %56 = load i32, i32* %at.addr, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %at.addr, align 4
  br label %for.cond

for.end:
  %58 = call i32 @churn()
  %59 = load i32, i32* %n.addr, align 4
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %62 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ult i64 2, %64
  br i1 %65, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %64)
  unreachable

bounds.ok:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to %struct.nish_array**
  %69 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %68, i64 2
  %70 = load %struct.nish_array*, %struct.nish_array** %69, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = icmp ult i64 1, %72
  br i1 %73, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %72)
  unreachable

bounds.ok.1:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 1
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %61, i8* %79)
  %81 = call i8* @nish_str_concat(i8* %80, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %82 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = icmp ult i64 2, %84
  br i1 %85, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %84)
  unreachable

bounds.ok.2:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to %struct.nish_array**
  %89 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %88, i64 2
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = trunc i64 %92 to i32
  %94 = sub nsw i32 %93, 1
  %95 = sext i32 %94 to i64
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = icmp ult i64 %95, %97
  br i1 %98, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %95, i64 %97)
  unreachable

bounds.ok.3:
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %101 = bitcast i8* %100 to i8**
  %102 = getelementptr inbounds i8*, i8** %101, i64 %95
  %103 = load i8*, i8** %102, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %104 = call i8* @nish_str_concat(i8* %81, i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %106 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = bitcast i8* %108 to %struct.nish_array**
  %110 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %109, i64 1
  %111 = load %struct.nish_array*, %struct.nish_array** %110, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %112 = call i32 @sum(%struct.nish_array* %111)
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %105, i8* %113)
  %115 = call i8* @nish_str_concat(i8* %114, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %116 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %119 = bitcast i8* %118 to %struct.nish_array**
  %120 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %119, i64 1
  %121 = load %struct.nish_array*, %struct.nish_array** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = call i32 @wordsSum(%struct.nish_array* %121)
  %123 = call i8* @nish_str_from_i32(i32 %122)
  %124 = call i8* @nish_str_concat(i8* %115, i8* %123)
  ret i8* %124

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @fillOuter(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out, i32 noundef %k) #0 {
entry:
  %scratch.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.fillOuter$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %scratch.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.16.fillOuter$arrow1(%struct.nish_array* %xs, %struct.nish_array* %out, i32 %k)
  %1 = load %struct.nish_array*, %struct.nish_array** %scratch.addr, align 8
  %2 = call i32 @sum(%struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @passThrough(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out, i32 noundef %k) #0 {
entry:
  %local.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.passThrough$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %local.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %local.addr, align 8
  call void @nish.parallelMapInto$str$str$fn.18.passThrough$arrow1(%struct.nish_array* %1, %struct.nish_array* %out)
  %2 = load %struct.nish_array*, %struct.nish_array** %local.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  ret i32 %5
}

define internal noundef nonnull align 8 i8* @into(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %out2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %out2.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  %23 = load %struct.nish_array*, %struct.nish_array** %out2.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store.1

push.store.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond.1

for.cond.1:
  %37 = load i32, i32* %k.addr, align 4
  %38 = icmp slt i32 %37, 3
  br i1 %38, label %for.body.1, label %for.end.1

for.body.1:
  %39 = load i32, i32* %t.addr, align 4
  %40 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %41 = load i32, i32* %k.addr, align 4
  %42 = call i32 @fillOuter(%struct.nish_array* %xs, %struct.nish_array* %40, i32 %41)
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok

ovf.ok:
  %46 = srem i32 %44, 1000003
  store i32 %46, i32* %t.addr, align 4
  %47 = load i32, i32* %t.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %out2.addr, align 8
  %49 = load i32, i32* %k.addr, align 4
  %50 = call i32 @passThrough(%struct.nish_array* %xs, %struct.nish_array* %48, i32 %49)
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %54 = srem i32 %52, 1000003
  store i32 %54, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %55 = load i32, i32* %k.addr, align 4
  %56 = add nsw i32 %55, 1
  store i32 %56, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %57 = call i32 @churn()
  %58 = load i32, i32* %t.addr, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %61 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = icmp ult i64 0, %63
  br i1 %64, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %63)
  unreachable

bounds.ok:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %66 to i8**
  %68 = getelementptr inbounds i8*, i8** %67, i64 0
  %69 = load i8*, i8** %68, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = call i8* @nish_str_concat(i8* %60, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %72 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = sub nsw i32 %75, 1
  %77 = sext i32 %76 to i64
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp ult i64 %77, %79
  br i1 %80, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %77, i64 %79)
  unreachable

bounds.ok.1:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i8**
  %84 = getelementptr inbounds i8*, i8** %83, i64 %77
  %85 = load i8*, i8** %84, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = call i8* @nish_str_concat(i8* %71, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %88 = load %struct.nish_array*, %struct.nish_array** %out2.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = trunc i64 %90 to i32
  %92 = sub nsw i32 %91, 1
  %93 = sext i32 %92 to i64
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 %93, %95
  br i1 %96, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %93, i64 %95)
  unreachable

bounds.ok.2:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i8**
  %100 = getelementptr inbounds i8*, i8** %99, i64 %93
  %101 = load i8*, i8** %100, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = call i8* @nish_str_concat(i8* %87, i8* %101)
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %104 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %105 = call i32 @wordsSum(%struct.nish_array* %104)
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %103, i8* %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %109 = load %struct.nish_array*, %struct.nish_array** %out2.addr, align 8
  %110 = call i32 @wordsSum(%struct.nish_array* %109)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %108, i8* %111)
  ret i8* %112

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ws) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %ws, %struct.nish_array** %0, align 8, !tbaa !23
  ret void
}

define hidden noundef nonnull align 8 i8* @joined$(%struct.Box* noundef nonnull readonly align 8 dereferenceable(8) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 0
  %9 = load i8*, i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !23
  %13 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = sub nsw i32 %17, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call i8* @nish_str_concat(i8* %10, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %30 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !23
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %29, i8* %35)
  ret i8* %36
}

define internal noundef i32 @toTask(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %answers, i32 noundef %at) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %got.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.toTask$arrow0(%struct.nish_array* %xs, i32 %at)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %2, %struct.nish_array** %got.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = bitcast i8* %13 to %struct.Box*
  %15 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  call void @Box.constructor(%struct.Box* %14, %struct.nish_array* %15)
  %16 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  call void @nish.ThreadScope.spawn$$Box$str$fn.6.joined(%struct.ThreadScope* %12, %struct.Box* %14, %struct.nish_array* %16, i32 0)
  call void @nish_scope_join(i8* %11)
  %17 = sext i32 %at to i64
  %18 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 0
  %26 = load i8*, i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %answers, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = icmp ult i64 %17, %28
  br i1 %29, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %17, i64 %28)
  unreachable

bounds.ok.1:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %answers, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8**
  %33 = getelementptr inbounds i8*, i8** %32, i64 %17
  store i8* %26, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  ret i32 %37
}

define internal noundef nonnull align 8 i8* @task(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %answers.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %n.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %answers.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %at.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %at.addr, align 4
  %9 = icmp slt i32 %8, 3
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %n.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %answers.addr, align 8
  %12 = load i32, i32* %at.addr, align 4
  %13 = call i32 @toTask(%struct.nish_array* %xs, %struct.nish_array* %11, i32 %12)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %at.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %at.addr, align 4
  br label %for.cond

for.end:
  %19 = call i32 @churn()
  %20 = load i32, i32* %n.addr, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %23 = load %struct.nish_array*, %struct.nish_array** %answers.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ult i64 0, %25
  br i1 %26, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %25)
  unreachable

bounds.ok:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 0
  %31 = load i8*, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = call i8* @nish_str_concat(i8* %22, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %34 = load %struct.nish_array*, %struct.nish_array** %answers.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp ult i64 2, %36
  br i1 %37, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %36)
  unreachable

bounds.ok.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = call i8* @nish_str_concat(i8* %33, i8* %42)
  ret i8* %43

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nestedInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keep, i32 noundef %at) #0 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$arr.i32$fn.17.nestedInto$arrow0(%struct.nish_array* %xs, i32 %at)
  store %struct.nish_array* %0, %struct.nish_array** %rows.addr, align 8
  %1 = sext i32 %at to i64
  %2 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %1, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to %struct.nish_array**
  %9 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %8, i64 %1
  store %struct.nish_array* %2, %struct.nish_array** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  ret i32 %13
}

define internal noundef nonnull align 8 i8* @nested(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %keep.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.nish_array*], align 8
  %n.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %last.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast [2 x %struct.nish_array*]* %arr.data to i8*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %12 to %struct.nish_array**
  %15 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %14, i64 0
  store %struct.nish_array* %1, %struct.nish_array** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %14, i64 1
  store %struct.nish_array* %6, %struct.nish_array** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %keep.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %at.addr, align 4
  br label %for.cond

for.cond:
  %17 = load i32, i32* %at.addr, align 4
  %18 = icmp slt i32 %17, 2
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %21 = load i32, i32* %at.addr, align 4
  %22 = call i32 @nestedInto(%struct.nish_array* %xs, %struct.nish_array* %20, i32 %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %24, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %26 = load i32, i32* %at.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %at.addr, align 4
  br label %for.cond

for.end:
  %28 = call i32 @churn()
  %29 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 1, %31
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %31)
  unreachable

bounds.ok:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to %struct.nish_array**
  %36 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %35, i64 1
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = sub nsw i32 %40, 1
  %42 = sext i32 %41 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok.1:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to %struct.nish_array**
  %49 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %48, i64 %42
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %50, %struct.nish_array** %last.addr, align 8
  store i32 0, i32* %t.addr, align 4
  %51 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to %struct.nish_array**
  %55 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %54, i64 0
  %56 = load %struct.nish_array*, %struct.nish_array** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %57 = load i64, i64* %forof.idx, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = icmp ult i64 %57, %59
  br i1 %60, label %forof.body, label %forof.end

forof.body:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to %struct.nish_array**
  %64 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %63, i64 %57
  %65 = load %struct.nish_array*, %struct.nish_array** %64, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %65, %struct.nish_array** %row.addr, align 8
  %66 = load i32, i32* %t.addr, align 4
  %67 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %68 = call i32 @sum(%struct.nish_array* %67)
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %72 = srem i32 %70, 1000003
  store i32 %72, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %73 = load i64, i64* %forof.idx, align 8
  %74 = add i64 %73, 1
  store i64 %74, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %75 = load i32, i32* %n.addr, align 4
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %78 = load %struct.nish_array*, %struct.nish_array** %last.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = icmp ult i64 0, %80
  br i1 %81, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %80)
  unreachable

bounds.ok.2:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %84 = bitcast i8* %83 to i32*
  %85 = getelementptr inbounds i32, i32* %84, i64 0
  %86 = load i32, i32* %85, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %77, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %90 = load %struct.nish_array*, %struct.nish_array** %last.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = icmp ult i64 1, %92
  br i1 %93, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %92)
  unreachable

bounds.ok.3:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* %95 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 1
  %98 = load i32, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %89, i8* %99)
  %101 = call i8* @nish_str_concat(i8* %100, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %102 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to %struct.nish_array**
  %106 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %105, i64 0
  %107 = load %struct.nish_array*, %struct.nish_array** %106, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = icmp ult i64 0, %109
  br i1 %110, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %109)
  unreachable

bounds.ok.4:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to %struct.nish_array**
  %114 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %113, i64 0
  %115 = load %struct.nish_array*, %struct.nish_array** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = icmp ult i64 1, %117
  br i1 %118, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %117)
  unreachable

bounds.ok.5:
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 1
  %123 = load i32, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %101, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %127 = load i32, i32* %t.addr, align 4
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %126, i8* %128)
  ret i8* %129

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @pick(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %mid.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.11.pick$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = ashr i32 %3, 1
  store i32 %4, i32* %mid.addr, align 4
  %5 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %6 = load i32, i32* %mid.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %7
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %15
}

define internal noundef nonnull align 8 i8* @picked(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %last.addr = alloca i8*, align 8
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, 6
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %k.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @pick(%struct.nish_array* %xs, i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %s.addr, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i8*, i8** %s.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = load i8*, i8** %s.addr, align 8
  %15 = load i8*, i8** %s.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = sub nsw i32 %18, 1
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %14 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds i8, i8* %14, i64 8
  %25 = getelementptr inbounds i8, i8* %24, i64 %20
  %26 = load i8, i8* %25, align 1
  %27 = zext i8 %26 to i32
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %29, i32* %t.addr, align 4
  %31 = load i8*, i8** %s.addr, align 8
  store i8* %31, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %34 = call i32 @churn()
  %35 = load i8*, i8** %last.addr, align 8
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %37 = load i32, i32* %t.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %36, i8* %38)
  ret i8* %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @choose(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i1 noundef zeroext %c) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.choose$arrow0(%struct.nish_array* %xs)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.choose$arrow1(%struct.nish_array* %xs)
  store %struct.nish_array* %1, %struct.nish_array** %zs.addr, align 8
  br i1 %c, label %cond.true, label %cond.false

cond.true:
  %2 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  br label %cond.end

cond.false:
  %3 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi %struct.nish_array* [ %2, %cond.true ], [ %3, %cond.false ]
  ret %struct.nish_array* %4
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @chooseWords(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i1 noundef zeroext %c) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.chooseWords$arrow0(%struct.nish_array* %xs)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.chooseWords$arrow1(%struct.nish_array* %xs)
  store %struct.nish_array* %1, %struct.nish_array** %zs.addr, align 8
  br i1 %c, label %cond.true, label %cond.false

cond.true:
  %2 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  br label %cond.end

cond.false:
  %3 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi %struct.nish_array* [ %2, %cond.true ], [ %3, %cond.false ]
  ret %struct.nish_array* %4
}

define internal noundef nonnull align 8 i8* @ternary(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca %struct.nish_array*, align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @choose(%struct.nish_array* %xs, i1 true)
  store %struct.nish_array* %0, %struct.nish_array** %a.addr, align 8
  %1 = call %struct.nish_array* @choose(%struct.nish_array* %xs, i1 false)
  store %struct.nish_array* %1, %struct.nish_array** %b.addr, align 8
  %2 = call %struct.nish_array* @chooseWords(%struct.nish_array* %xs, i1 true)
  store %struct.nish_array* %2, %struct.nish_array** %c.addr, align 8
  %3 = call %struct.nish_array* @chooseWords(%struct.nish_array* %xs, i1 false)
  store %struct.nish_array* %3, %struct.nish_array** %d.addr, align 8
  %4 = call i32 @churn()
  %5 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 0, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = sub nsw i32 %19, 1
  %21 = sext i32 %20 to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %21, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %21
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %15, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %33 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok.2:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 0
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = call i8* @nish_str_concat(i8* %32, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  %48 = sub nsw i32 %47, 1
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %49, i64 %51)
  unreachable

bounds.ok.3:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 %49
  %57 = load i8*, i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = call i8* @nish_str_concat(i8* %43, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %60 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %61 = call i32 @sum(%struct.nish_array* %60)
  %62 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %63 = call i32 @sum(%struct.nish_array* %62)
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok

ovf.ok:
  %67 = call i8* @nish_str_from_i32(i32 %65)
  %68 = call i8* @nish_str_concat(i8* %59, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %71 = call i32 @wordsSum(%struct.nish_array* %70)
  %72 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %73 = call i32 @wordsSum(%struct.nish_array* %72)
  %74 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %73)
  %75 = extractvalue { i32, i1 } %74, 0
  %76 = extractvalue { i32, i1 } %74, 1
  br i1 %76, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %77 = call i8* @nish_str_from_i32(i32 %75)
  %78 = call i8* @nish_str_concat(i8* %69, i8* %77)
  ret i8* %78

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pushed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %r.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %r.addr, align 4
  %6 = icmp slt i32 %5, 3
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %r.addr, align 4
  store i32 %7, i32* %q.addr, align 4
  %8 = load i32, i32* %q.addr, align 4
  %9 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.pushed$arrow0(%struct.nish_array* %xs, i32 %8)
  store %struct.nish_array* %9, %struct.nish_array** %ys.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to %struct.nish_array**
  %20 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %19, i64 %13
  store %struct.nish_array* %11, %struct.nish_array** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %r.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  ret %struct.nish_array* %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pushedWords(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %strs.addr = alloca %struct.nish_array*, align 8
  %r.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %strs.addr, align 8
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %r.addr, align 4
  %6 = icmp slt i32 %5, 3
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %r.addr, align 4
  store i32 %7, i32* %q.addr, align 4
  %8 = load i32, i32* %q.addr, align 4
  %9 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.pushedWords$arrow0(%struct.nish_array* %xs, i32 %8)
  store %struct.nish_array* %9, %struct.nish_array** %ws.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %strs.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = sub nsw i32 %14, 1
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  %24 = load i8*, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8**
  %33 = getelementptr inbounds i8*, i8** %32, i64 %26
  store i8* %24, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  br label %for.inc

for.inc:
  %36 = load i32, i32* %r.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %38 = load %struct.nish_array*, %struct.nish_array** %strs.addr, align 8
  ret %struct.nish_array* %38
}

define internal noundef nonnull align 8 i8* @push(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %strs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @pushed(%struct.nish_array* %xs)
  store %struct.nish_array* %0, %struct.nish_array** %rows.addr, align 8
  %1 = call %struct.nish_array* @pushedWords(%struct.nish_array* %xs)
  store %struct.nish_array* %1, %struct.nish_array** %strs.addr, align 8
  %2 = call i32 @churn()
  %3 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %9 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 2, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to %struct.nish_array**
  %16 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %15, i64 2
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = sub nsw i32 %20, 1
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %22, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %8, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %34 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to %struct.nish_array**
  %38 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %37, i64 1
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = call i32 @sum(%struct.nish_array* %39)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %33, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %strs.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.2:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 0
  %52 = load i8*, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = call i8* @nish_str_concat(i8* %43, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %55 = load %struct.nish_array*, %struct.nish_array** %strs.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = icmp ult i64 2, %57
  br i1 %58, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %57)
  unreachable

bounds.ok.3:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = call i8* @nish_str_concat(i8* %54, i8* %63)
  ret i8* %64
}

define internal noundef i32 @intoMap(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) %m, %struct.Set$str* noundef nonnull align 8 dereferenceable(48) %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.intoMap$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.intoMap$arrow1(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %1, %struct.nish_array** %ws.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %3 = call %struct.Map$i32$arr.i32* @nish.Map$i32$arr.i32.set(%struct.Map$i32$arr.i32* %m, i32 %k, %struct.nish_array* %2)
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
  %13 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %s, i8* %12)
  %14 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = sub nsw i32 %17, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %s, i8* %27)
  %29 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  ret i32 %32
}

define internal noundef nonnull align 8 i8* @maps(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %m.addr = alloca %struct.Map$i32$arr.i32*, align 8
  %s.addr = alloca %struct.Set$str*, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %last.addr = alloca i8*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$arr.i32*
  call void @nish.Map$i32$arr.i32.constructor(%struct.Map$i32$arr.i32* %1)
  store %struct.Map$i32$arr.i32* %1, %struct.Map$i32$arr.i32** %m.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 48)
  %3 = bitcast i8* %2 to %struct.Set$str*
  call void @nish.Set$str.constructor(%struct.Set$str* %3)
  store %struct.Set$str* %3, %struct.Set$str** %s.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, 3
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %n.addr, align 4
  %7 = load %struct.Map$i32$arr.i32*, %struct.Map$i32$arr.i32** %m.addr, align 8
  %8 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %9 = load i32, i32* %k.addr, align 4
  %10 = call i32 @intoMap(%struct.Map$i32$arr.i32* %7, %struct.Set$str* %8, %struct.nish_array* %xs, i32 %9)
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %14 = load i32, i32* %k.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %16 = call i32 @churn()
  %17 = load %struct.Map$i32$arr.i32*, %struct.Map$i32$arr.i32** %m.addr, align 8
  %18 = call i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* %17, i32 2)
  %19 = icmp sge i64 %18, 0
  br i1 %19, label %get.found, label %get.end

get.found:
  %20 = trunc i64 %18 to i32
  %21 = call %struct.nish_array* @nish.Map$i32$arr.i32.valueAt(%struct.Map$i32$arr.i32* %17, i32 %20)
  br label %get.end

get.end:
  %22 = phi %struct.nish_array* [ %21, %get.found ], [ null, %for.end ]
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = sub nsw i32 %25, 1
  %27 = sext i32 %26 to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 2)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %39 = call i64 @nish_arena_mark()
  %40 = call i8* @word(i32 %37)
  %41 = call i8* @nish_arena_keep(i64 %39, i8* %40)
  store i8* %41, i8** %last.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %45 = xor i1 %19, true
  br i1 %45, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %46 = call i32 @sum(%struct.nish_array* %22)
  br label %cond.end

cond.end:
  %47 = phi i32 [ -1, %cond.true ], [ %46, %cond.false ]
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %44, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %51 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %52 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %51, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !26
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %50, i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %57 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %58 = load i8*, i8** %last.addr, align 8
  %59 = call i1 @nish.Set$str.has(%struct.Set$str* %57, i8* %58)
  %60 = select i1 %59, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %61 = call i8* @nish_str_concat(i8* %56, i8* %60)
  ret i8* %61

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @sender$(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture %ch) #0 {
entry:
  call void @nish.Channel$str.send(%struct.Channel$str* %ch, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  ret i32 1
}

define internal noundef i32 @sendWords(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %got, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %ch.addr = alloca %struct.Channel$str*, align 8
  %n.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %w.addr = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.sendWords$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %2)
  store %struct.Channel$str* %2, %struct.Channel$str** %ch.addr, align 8
  %3 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
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
  call void @nish.Channel$str.send(%struct.Channel$str* %3, i8* %12)
  %13 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = sub nsw i32 %17, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish.Channel$str.send(%struct.Channel$str* %13, i8* %27)
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 1, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 1, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = call i8* @nish_alloc_struct(i64 4)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 0, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %29, %struct.nish_array** %n.addr, align 8
  %36 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %36, %struct.ThreadScope** %s.addr, align 8
  %37 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %38 = bitcast %struct.ThreadScope* %37 to i8*
  %39 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %40 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %39, i32 0, i32 2
  %41 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %42 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %n.addr, align 8
  call void @nish.ThreadScope.spawn$$Channel$str$i32$fn.6.sender(%struct.ThreadScope* %41, %struct.Channel$str* %42, %struct.nish_array* %43, i32 0)
  call void @nish_channel_count(i64* %40, i64 -1)
  call void @nish_scope_join(i8* %38)
  %44 = load %struct.Channel$str*, %struct.Channel$str** %ch.addr, align 8
  %45 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %44, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %46 = call i32 @nish_channel_receive(i64* %45, i64* %chan.slot)
  %47 = icmp ne i32 %46, 0
  br i1 %47, label %chan.body, label %chan.end

chan.body:
  %48 = load i64, i64* %chan.slot, align 8
  %49 = inttoptr i64 %48 to i8*
  %50 = call i8* @nish_cross_in(i8* %49, i64 0)
  store i8* %50, i8** %w.addr, align 8
  %51 = load i8*, i8** %w.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %got, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %got, i64 0, i32 1
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = icmp eq i64 %53, %55
  br i1 %56, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %got, i64 8)
  br label %push.store

push.store:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %got, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %53
  store i8* %51, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = add i64 %53, 1
  store i64 %61, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = trunc i64 %61 to i32
  br label %chan.recv

chan.end:
  %63 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  ret i32 %66
}

define internal noundef nonnull align 8 i8* @channel(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %got.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %got.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %n.addr, align 4
  %6 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %7 = load i32, i32* %k.addr, align 4
  %8 = call i32 @sendWords(%struct.nish_array* %xs, %struct.nish_array* %6, i32 %7)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %12 = load i32, i32* %k.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %14 = call i32 @churn()
  %15 = load i32, i32* %n.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %18 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %17, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %25 = load %struct.nish_array*, %struct.nish_array** %got.addr, align 8
  %26 = call i32 @wordsSum(%struct.nish_array* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %24, i8* %27)
  ret i8* %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Slot.constructor(%struct.Slot* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %0, align 8, !tbaa !28
  %1 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !29
  ret void
}

define internal noundef i32 @guarded(%struct.Mutex$$Slot* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %g.addr = alloca %struct.MutexGuard$$Slot*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.guarded$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.guarded$arrow1(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %1, %struct.nish_array** %ys.addr, align 8
  %2 = call %struct.MutexGuard$$Slot* @nish.Mutex$$Slot.lock(%struct.Mutex$$Slot* %m)
  store %struct.MutexGuard$$Slot* %2, %struct.MutexGuard$$Slot** %g.addr, align 8
  %3 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %3, i32 0, i32 1
  %5 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %5, i32 0, i32 0
  %7 = load %struct.Slot*, %struct.Slot** %6, align 8, !tbaa !31
  %8 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = sub nsw i32 %11, 1
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds %struct.Slot, %struct.Slot* %7, i32 0, i32 0
  %23 = load i8*, i8** %22, align 8, !tbaa !28
  %24 = call i8* @nish_guard_keep(i8* %23, i8* %21)
  %25 = getelementptr inbounds %struct.Slot, %struct.Slot* %7, i32 0, i32 0
  store i8* %24, i8** %25, align 8, !tbaa !28
  %26 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %27 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %26, i32 0, i32 0
  %28 = load %struct.Slot*, %struct.Slot** %27, align 8, !tbaa !31
  %29 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = sub nsw i32 %32, 1
  %34 = sext i32 %33 to i64
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp ult i64 %34, %36
  br i1 %37, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %34, i64 %36)
  unreachable

bounds.ok.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %34
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %43 = getelementptr inbounds %struct.Slot, %struct.Slot* %28, i32 0, i32 1
  store i32 %42, i32* %43, align 4, !tbaa !29
  %44 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  store atomic i32 0, i32* %4 release, align 4
  ret i32 %47
}

define internal noundef nonnull align 8 i8* @mutex(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Slot*, align 8
  %Mutex$$Slot.obj = alloca %struct.Mutex$$Slot, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Slot*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Slot*
  call void @Slot.constructor(%struct.Slot* %1)
  call void @nish.Mutex$$Slot.constructor(%struct.Mutex$$Slot* %Mutex$$Slot.obj, %struct.Slot* %1)
  store %struct.Mutex$$Slot* %Mutex$$Slot.obj, %struct.Mutex$$Slot** %m.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp sle i32 %2, 3
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %n.addr, align 4
  %5 = load %struct.Mutex$$Slot*, %struct.Mutex$$Slot** %m.addr, align 8
  %6 = load i32, i32* %k.addr, align 4
  %7 = call i32 @guarded(%struct.Mutex$$Slot* %5, %struct.nish_array* %xs, i32 %6)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %11 = load i32, i32* %k.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %13 = call i32 @churn()
  %14 = load %struct.Mutex$$Slot*, %struct.Mutex$$Slot** %m.addr, align 8
  %15 = call %struct.MutexGuard$$Slot* @nish.Mutex$$Slot.lock(%struct.Mutex$$Slot* %14)
  store %struct.MutexGuard$$Slot* %15, %struct.MutexGuard$$Slot** %g.addr, align 8
  %16 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %17 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %16, i32 0, i32 1
  %18 = load i32, i32* %n.addr, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %21 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %22 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %21, i32 0, i32 0
  %23 = load %struct.Slot*, %struct.Slot** %22, align 8, !tbaa !31
  %24 = getelementptr inbounds %struct.Slot, %struct.Slot* %23, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !28
  %26 = getelementptr inbounds i8, i8* %25, i64 8
  %27 = bitcast i8* %25 to i64*
  %28 = load i64, i64* %27, align 8
  %29 = call i8* @nish_str_new(i8* %26, i64 %28)
  %30 = call i8* @nish_str_concat(i8* %20, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %32 = load %struct.MutexGuard$$Slot*, %struct.MutexGuard$$Slot** %g.addr, align 8
  %33 = getelementptr inbounds %struct.MutexGuard$$Slot, %struct.MutexGuard$$Slot* %32, i32 0, i32 0
  %34 = load %struct.Slot*, %struct.Slot** %33, align 8, !tbaa !31
  %35 = getelementptr inbounds %struct.Slot, %struct.Slot* %34, i32 0, i32 1
  %36 = load i32, i32* %35, align 4, !tbaa !29
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %31, i8* %37)
  store atomic i32 0, i32* %17 release, align 4
  ret i8* %38

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Sink.constructor(%struct.Sink* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !33
  %6 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %6, align 8, !tbaa !34
  ret void
}

define internal void @keepYs(%struct.Sink* noundef nonnull align 8 dereferenceable(16) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ys) #1 {
entry:
  %0 = getelementptr inbounds %struct.Sink, %struct.Sink* %h, i32 0, i32 0
  store %struct.nish_array* %ys, %struct.nish_array** %0, align 8, !tbaa !33
  ret void
}

define internal void @keepWord(%struct.Sink* noundef nonnull align 8 dereferenceable(16) nocapture %h, i8* noundef nonnull noalias readonly align 8 %w) #1 {
entry:
  %0 = getelementptr inbounds %struct.Sink, %struct.Sink* %h, i32 0, i32 1
  store i8* %w, i8** %0, align 8, !tbaa !34
  ret void
}

define internal void @Cell$arr.i32.constructor(%struct.Cell$arr.i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell$arr.i32, %struct.Cell$arr.i32* %this, i32 0, i32 0
  store %struct.nish_array* %v, %struct.nish_array** %0, align 8, !tbaa !36
  ret void
}

define internal void @Cell$str.constructor(%struct.Cell$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell$str, %struct.Cell$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !38
  ret void
}

define internal noundef i32 @sunk(%struct.Sink* noundef nonnull align 8 dereferenceable(16) nocapture %h, %struct.Cell$arr.i32* noundef nonnull align 8 dereferenceable(8) nocapture %c, %struct.Cell$str* noundef nonnull align 8 dereferenceable(8) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.11.sunk$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.11.sunk$arrow1(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %1, %struct.nish_array** %ws.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.11.sunk$arrow2(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %zs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @keepYs(%struct.Sink* %h, %struct.nish_array* %3)
  %4 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 1, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 1
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @keepWord(%struct.Sink* %h, i8* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  call void @keepAny$arr.i32(%struct.Cell$arr.i32* %c, %struct.nish_array* %13)
  %14 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = sub nsw i32 %17, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @keepAny$str(%struct.Cell$str* %d, i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  ret i32 %31
}

define internal noundef nonnull align 8 i8* @callee(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %h.addr = alloca %struct.Sink*, align 8
  %Sink.obj = alloca %struct.Sink, align 8
  %c.addr = alloca %struct.Cell$arr.i32*, align 8
  %Cell$arr.i32.obj = alloca %struct.Cell$arr.i32, align 8
  %d.addr = alloca %struct.Cell$str*, align 8
  %Cell$str.obj = alloca %struct.Cell$str, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  call void @Sink.constructor(%struct.Sink* %Sink.obj)
  store %struct.Sink* %Sink.obj, %struct.Sink** %h.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @Cell$arr.i32.constructor(%struct.Cell$arr.i32* %Cell$arr.i32.obj, %struct.nish_array* %1)
  store %struct.Cell$arr.i32* %Cell$arr.i32.obj, %struct.Cell$arr.i32** %c.addr, align 8
  call void @Cell$str.constructor(%struct.Cell$str* %Cell$str.obj, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  store %struct.Cell$str* %Cell$str.obj, %struct.Cell$str** %d.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp slt i32 %5, 3
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %n.addr, align 4
  %8 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %9 = load %struct.Cell$arr.i32*, %struct.Cell$arr.i32** %c.addr, align 8
  %10 = load %struct.Cell$str*, %struct.Cell$str** %d.addr, align 8
  %11 = load i32, i32* %k.addr, align 4
  %12 = call i32 @sunk(%struct.Sink* %8, %struct.Cell$arr.i32* %9, %struct.Cell$str* %10, %struct.nish_array* %xs, i32 %11)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %k.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %18 = call i32 @churn()
  %19 = load i32, i32* %n.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %22 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %23 = getelementptr inbounds %struct.Sink, %struct.Sink* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !33
  %25 = call i32 @sum(%struct.nish_array* %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %21, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %29 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %30 = getelementptr inbounds %struct.Sink, %struct.Sink* %29, i32 0, i32 1
  %31 = load i8*, i8** %30, align 8, !tbaa !34
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %34 = load %struct.Cell$arr.i32*, %struct.Cell$arr.i32** %c.addr, align 8
  %35 = getelementptr inbounds %struct.Cell$arr.i32, %struct.Cell$arr.i32* %34, i32 0, i32 0
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !36
  %37 = call i32 @sum(%struct.nish_array* %36)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %33, i8* %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %41 = load %struct.Cell$str*, %struct.Cell$str** %d.addr, align 8
  %42 = getelementptr inbounds %struct.Cell$str, %struct.Cell$str* %41, i32 0, i32 0
  %43 = load i8*, i8** %42, align 8, !tbaa !38
  %44 = call i8* @nish_str_concat(i8* %40, i8* %43)
  ret i8* %44

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @aliased(%struct.Sink* noundef nonnull align 8 dereferenceable(16) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %w.addr = alloca i8*, align 8
  %v.addr = alloca i8*, align 8
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.aliased$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  store %struct.nish_array* %1, %struct.nish_array** %zs.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %3 = getelementptr inbounds %struct.Sink, %struct.Sink* %h, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %3, align 8, !tbaa !33
  %4 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.aliased$arrow1(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %4, %struct.nish_array** %ws.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = sub nsw i32 %8, 1
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  %18 = load i8*, i8** %17, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %18, i8** %w.addr, align 8
  %19 = load i8*, i8** %w.addr, align 8
  store i8* %19, i8** %v.addr, align 8
  %20 = load i8*, i8** %v.addr, align 8
  %21 = getelementptr inbounds %struct.Sink, %struct.Sink* %h, i32 0, i32 1
  store i8* %20, i8** %21, align 8, !tbaa !34
  %22 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  ret i32 %25
}

define internal noundef nonnull align 8 i8* @alias(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %h.addr = alloca %struct.Sink*, align 8
  %Sink.obj = alloca %struct.Sink, align 8
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  call void @Sink.constructor(%struct.Sink* %Sink.obj)
  store %struct.Sink* %Sink.obj, %struct.Sink** %h.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call i32 @aliased(%struct.Sink* %3, %struct.nish_array* %xs, i32 %4)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %9 = load i32, i32* %k.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %11 = call i32 @churn()
  %12 = load i32, i32* %n.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %15 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %16 = getelementptr inbounds %struct.Sink, %struct.Sink* %15, i32 0, i32 0
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !33
  %18 = call i32 @sum(%struct.nish_array* %17)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %14, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %22 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %23 = getelementptr inbounds %struct.Sink, %struct.Sink* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !33
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %21, i8* %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %36 = load %struct.Sink*, %struct.Sink** %h.addr, align 8
  %37 = getelementptr inbounds %struct.Sink, %struct.Sink* %36, i32 0, i32 1
  %38 = load i8*, i8** %37, align 8, !tbaa !34
  %39 = call i8* @nish_str_concat(i8* %35, i8* %38)
  ret i8* %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @carried(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %prev.addr = alloca %struct.nish_array*, align 8
  %prevWords.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %prev.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %prevWords.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %r.addr, align 4
  %11 = icmp slt i32 %10, 4
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %r.addr, align 4
  %13 = icmp sgt i32 %12, 0
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load i32, i32* %t.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %prev.addr, align 8
  %16 = call i32 @sum(%struct.nish_array* %15)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = load %struct.nish_array*, %struct.nish_array** %prevWords.addr, align 8
  %21 = call i32 @wordsSum(%struct.nish_array* %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %25 = srem i32 %23, 1000003
  store i32 %25, i32* %t.addr, align 4
  br label %if.end

if.end:
  %26 = load i32, i32* %r.addr, align 4
  store i32 %26, i32* %q.addr, align 4
  %27 = load i32, i32* %q.addr, align 4
  %28 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.14.carried$arrow0(%struct.nish_array* %xs, i32 %27)
  store %struct.nish_array* %28, %struct.nish_array** %prev.addr, align 8
  %29 = load i32, i32* %q.addr, align 4
  %30 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.14.carried$arrow1(%struct.nish_array* %xs, i32 %29)
  store %struct.nish_array* %30, %struct.nish_array** %prevWords.addr, align 8
  %31 = call i32 @churn()
  br label %for.inc

for.inc:
  %32 = load i32, i32* %r.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %34 = load i32, i32* %t.addr, align 4
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %37 = load %struct.nish_array*, %struct.nish_array** %prev.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = sub nsw i32 %40, 1
  %42 = sext i32 %41 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %42
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %36, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %54 = load %struct.nish_array*, %struct.nish_array** %prevWords.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 0, %56
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %56)
  unreachable

bounds.ok.1:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i8**
  %61 = getelementptr inbounds i8*, i8** %60, i64 0
  %62 = load i8*, i8** %61, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = call i8* @nish_str_concat(i8* %53, i8* %62)
  ret i8* %63

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @reclaims(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.reclaims$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %2 = call i32 @sum(%struct.nish_array* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @afterNested(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.18.afterNested$arrow0(%struct.nish_array* %xs)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.afterNested$arrow1(%struct.nish_array* %xs)
  store %struct.nish_array* %1, %struct.nish_array** %ws.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp slt i32 %2, 3
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %t.addr, align 4
  %5 = load i32, i32* %k.addr, align 4
  %6 = call i32 @reclaims(%struct.nish_array* %xs, i32 %5)
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = srem i32 %8, 1000003
  store i32 %10, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %11 = load i32, i32* %k.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %13 = call i32 @churn()
  %14 = load i32, i32* %t.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %17 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %18 = call i32 @sum(%struct.nish_array* %17)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %16, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %22 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = sub nsw i32 %25, 1
  %27 = sext i32 %26 to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %21, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %40 = call i32 @wordsSum(%struct.nish_array* %39)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %38, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 0
  %52 = load i8*, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = call i8* @nish_str_concat(i8* %43, i8* %52)
  ret i8* %53

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %xs.addr = alloca %struct.nish_array*, align 8
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
  store i32 37, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 70000, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %15, i32* %n.addr, align 4
  %16 = load i32, i32* %n.addr, align 4
  %17 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %xs.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = call i8* @returned(%struct.nish_array* %18)
  call void @nish_print(i8* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = call i8* @field(%struct.nish_array* %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %23 = call i8* @outer(%struct.nish_array* %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = call i8* @into(%struct.nish_array* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = call i8* @task(%struct.nish_array* %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = call i8* @nested(%struct.nish_array* %28)
  call void @nish_print(i8* %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = call i64 @nish_arena_mark()
  %32 = call i8* @picked(%struct.nish_array* %30)
  %33 = call i8* @nish_arena_keep(i64 %31, i8* %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @ternary(%struct.nish_array* %34)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  call void @nish_print(i8* %37)
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = call i8* @push(%struct.nish_array* %38)
  call void @nish_print(i8* %39)
  %40 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %41 = call i8* @maps(%struct.nish_array* %40)
  call void @nish_print(i8* %41)
  %42 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %43 = call i8* @channel(%struct.nish_array* %42)
  call void @nish_print(i8* %43)
  %44 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %45 = call i8* @mutex(%struct.nish_array* %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = call i8* @callee(%struct.nish_array* %46)
  call void @nish_print(i8* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = call i8* @alias(%struct.nish_array* %48)
  call void @nish_print(i8* %49)
  %50 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %51 = call i64 @nish_arena_mark()
  %52 = call i8* @carried(%struct.nish_array* %50)
  %53 = call i8* @nish_arena_keep(i64 %51, i8* %52)
  call void @nish_print(i8* %53)
  %54 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %55 = call i64 @nish_arena_mark()
  %56 = call i8* @afterNested(%struct.nish_array* %54)
  %57 = call i8* @nish_arena_keep(i64 %55, i8* %56)
  call void @nish_print(i8* %57)
  br label %forof.inc

forof.inc:
  %58 = load i64, i64* %forof.idx, align 8
  %59 = add i64 %58, 1
  store i64 %59, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @tripled$arrow0(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 3)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @intoField$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @intoField$arrow1(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef nonnull align 8 i8* @firstWord$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @intoOuter$arrow0(i32 noundef %i, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %at) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 %at)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @intoOuter$arrow1(i32 noundef %y) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %y)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i8* %0)
  ret i8* %1
}

define hidden noundef i32 @fillOuter$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef nonnull align 8 i8* @fillOuter$arrow1(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef nonnull align 8 i8* @passThrough$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*), i8* %3)
  ret i8* %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @passThrough$arrow1(i8* noundef nonnull noalias readonly align 8 %s) #2 {
entry:
  ret i8* %s
}

define hidden noundef nonnull align 8 i8* @toTask$arrow0(i32 noundef %x, i32 noundef %at) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 5)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %at)
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

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nestedInto$arrow0(i32 noundef %x, i32 noundef %at) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %at)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %at)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
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
  store i32 %1, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 %7, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret %struct.nish_array* %10

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @pick$arrow0(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef i32 @choose$arrow0(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @choose$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @chooseWords$arrow0(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
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

define hidden noundef nonnull align 8 i8* @chooseWords$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 2)
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

define hidden noundef i32 @pushed$arrow0(i32 noundef %x, i32 noundef %q) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %q)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @pushedWords$arrow0(i32 noundef %x, i32 noundef %q) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %q)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @intoMap$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @intoMap$arrow1(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef nonnull align 8 i8* @sendWords$arrow0(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef nonnull align 8 i8* @guarded$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @guarded$arrow1(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @sunk$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @sunk$arrow1(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef i32 @sunk$arrow2(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef i32 @aliased$arrow0(i32 noundef %x, i32 noundef %k) #0 {
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
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef nonnull align 8 i8* @aliased$arrow1(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef i32 @carried$arrow0(i32 noundef %x, i32 noundef %q) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %q)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @carried$arrow1(i32 noundef %x, i32 noundef %q) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %q)
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

define hidden noundef i32 @reclaims$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @afterNested$arrow0(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 5)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @afterNested$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 5)
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

define internal void @keepAny$arr.i32(%struct.Cell$arr.i32* noundef nonnull align 8 dereferenceable(8) nocapture %c, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell$arr.i32, %struct.Cell$arr.i32* %c, i32 0, i32 0
  store %struct.nish_array* %v, %struct.nish_array** %0, align 8, !tbaa !36
  ret void
}

define internal void @keepAny$str(%struct.Cell$str* noundef nonnull align 8 dereferenceable(8) nocapture %c, i8* noundef nonnull noalias readonly align 8 %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell$str, %struct.Cell$str* %c, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !38
  ret void
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
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*))
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
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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

define internal void @nish.Map$i32$arr.i32.constructor(%struct.Map$i32$arr.i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !40
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !41
  %2 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !42
  %3 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !43
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*))
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
  %13 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !44
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !45
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !46
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !47
  ret void
}

define internal noundef i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !44
  %2 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !41
  %4 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !47
  %6 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !45
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$arr.i32* @nish.Map$i32$arr.i32.set(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i32$arr.i32.setValueAt(%struct.Map$i32$arr.i32* %this, i32 %4, %struct.nish_array* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i32$arr.i32.insertAt(%struct.Map$i32$arr.i32* %this, i64 %5, i32 %key, %struct.nish_array* %value)
  br label %if.end

if.end:
  ret %struct.Map$i32$arr.i32* %this
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.Map$i32$arr.i32.valueAt(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !46
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.11 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !46
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.nish_array**
  %14 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %13, i64 %10
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %15
}

define internal void @nish.Map$i32$arr.i32.setValueAt(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #1 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !46
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !46
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.nish_array**
  %14 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %13, i64 %10
  store %struct.nish_array* %value, %struct.nish_array** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$arr.i32.insertAt(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
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
  %6 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !45
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !42
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !43
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$i32$arr.i32.rebuild(%struct.Map$i32$arr.i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !45
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
  store i32 %key, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !46
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
  %41 = bitcast i8* %40 to %struct.nish_array**
  %42 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %41, i64 %35
  store %struct.nish_array* %value, %struct.nish_array** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !47
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
  store i32 %47, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !42
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !42
  %65 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !40
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !40
  %71 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !45
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
  %80 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !44
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
  call void @nish.Map$i32$arr.i32.rebuild(%struct.Map$i32$arr.i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !44
  %91 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !41
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

define internal void @nish.Map$i32$arr.i32.rebuild(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !45
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !43
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !44
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !42
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
  %19 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !42
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !45
  %26 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !47
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !46
  %30 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !47
  call void @nish.compactEntries$arr.i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !47
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !44
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !41
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !47
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Set$str.constructor(%struct.Set$str* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !26
  %1 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !48
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !49
  %3 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !50
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*))
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
  %13 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !51
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !52
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !53
  ret void
}

define internal noundef i64 @nish.Set$str.probe(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !51
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !48
  %4 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !53
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !52
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Set$str.has(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$str* @nish.Set$str.add(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$str.insertAt(%struct.Set$str* %this, i64 %3, i8* %key)
  br label %if.end

if.end:
  ret %struct.Set$str* %this
}

define internal void @nish.Set$str.insertAt(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key) #0 {
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
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !52
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !49
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %16 = load i32, i32* %15, align 4, !tbaa !50
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.13 to i8*))
  unreachable

if.end.1:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !52
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !53
  %34 = load i32, i32* %h.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %34, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %47 = load i32, i32* %46, align 4, !tbaa !49
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  %51 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 %49, i32* %51, align 4, !tbaa !49
  %52 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !26
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %57 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 %55, i32* %57, align 4, !tbaa !26
  %58 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %59 = load %struct.nish_array*, %struct.nish_array** %58, align 8, !tbaa !52
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = trunc i64 %61 to i32
  store i32 %62, i32* %used.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %67 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !51
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = trunc i64 %70 to i32
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 3)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %75 = icmp sgt i32 %65, %73
  br i1 %75, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  br label %if.end.2

if.else:
  %76 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !51
  %78 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %79 = load i32, i32* %78, align 4, !tbaa !48
  %80 = load i32, i32* %bucket.addr, align 4
  %81 = load i32, i32* %h.addr, align 4
  %82 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %77, i32 %79, i32 %80, i32 %81, i32 %82)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.1 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Set$str.rebuild(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !52
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !50
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !51
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !49
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
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !49
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !52
  %26 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !53
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !53
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !51
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !48
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !53
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
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
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %73 = load i32, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.14 to i8*))
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$arr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %39 = bitcast i8* %10 to %struct.nish_array**
  %40 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %39, i64 %38
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %10 to %struct.nish_array**
  %43 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %42, i64 %36
  store %struct.nish_array* %41, %struct.nish_array** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %59 = bitcast i8* %58 to %struct.nish_array**
  %60 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %59, i64 %56
  %61 = load %struct.nish_array*, %struct.nish_array** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = trunc i64 %20 to i32
  %35 = icmp slt i32 %33, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %22 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %41, i32* %word.addr, align 4
  %42 = load i32, i32* %word.addr, align 4
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %bucket.addr, align 4
  %45 = load i32, i32* %h.addr, align 4
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45)
  ret i64 %46

if.end:
  %47 = load i32, i32* %word.addr, align 4
  %48 = lshr i32 %47, 24
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = and i32 %51, 16777215
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %54, i32* %at.addr, align 4
  %56 = load i32, i32* %at.addr, align 4
  %57 = icmp sge i32 %56, 0
  br i1 %57, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %58 = load i32, i32* %at.addr, align 4
  %59 = trunc i64 %24 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %ovf.ok ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = trunc i64 %28 to i32
  %72 = icmp slt i32 %70, %71
  br label %land.end.2

land.end.2:
  %73 = phi i1 [ false, %land.end.3 ], [ %72, %land.rhs.2 ]
  br i1 %73, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %74 = load i32, i32* %at.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %30 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %75
  %78 = load i8*, i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* %key)
  br label %land.end.1

land.end.1:
  %80 = phi i1 [ false, %land.end.2 ], [ %79, %land.rhs.1 ]
  br i1 %80, label %if.then.2, label %if.end.2

if.then.2:
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = load i32, i32* %at.addr, align 4
  %83 = tail call i64 @nish.foundAt(i32 %81, i32 %82)
  ret i64 %83

if.end.2:
  br label %if.end.1

if.end.1:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = add nsw i32 %84, 1
  %86 = and i32 %85, %mask
  store i32 %86, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.14 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"ptr", !6, i64 0}
!18 = !{!"Holder", !17, i64 0, !17, i64 8, !17, i64 16}
!19 = !{!18, !17, i64 0}
!20 = !{!18, !17, i64 8}
!21 = !{!18, !17, i64 16}
!22 = !{!"Box", !17, i64 0}
!23 = !{!22, !17, i64 0}
!24 = !{!"i32", !6, i64 0}
!25 = !{!"Set$str", !24, i64 0, !17, i64 8, !24, i64 16, !24, i64 20, !17, i64 24, !17, i64 32, !24, i64 40}
!26 = !{!25, !24, i64 0}
!27 = !{!"Slot", !17, i64 0, !24, i64 8}
!28 = !{!27, !17, i64 0}
!29 = !{!27, !24, i64 8}
!30 = !{!"MutexGuard$$Slot", !17, i64 0, !24, i64 8}
!31 = !{!30, !17, i64 0}
!32 = !{!"Sink", !17, i64 0, !17, i64 8}
!33 = !{!32, !17, i64 0}
!34 = !{!32, !17, i64 8}
!35 = !{!"Cell$arr.i32", !17, i64 0}
!36 = !{!35, !17, i64 0}
!37 = !{!"Cell$str", !17, i64 0}
!38 = !{!37, !17, i64 0}
!39 = !{!"Map$i32$arr.i32", !24, i64 0, !17, i64 8, !24, i64 16, !24, i64 20, !17, i64 24, !17, i64 32, !17, i64 40, !24, i64 48}
!40 = !{!39, !24, i64 0}
!41 = !{!39, !24, i64 16}
!42 = !{!39, !24, i64 20}
!43 = !{!39, !24, i64 48}
!44 = !{!39, !17, i64 8}
!45 = !{!39, !17, i64 24}
!46 = !{!39, !17, i64 32}
!47 = !{!39, !17, i64 40}
!48 = !{!25, !24, i64 16}
!49 = !{!25, !24, i64 20}
!50 = !{!25, !24, i64 40}
!51 = !{!25, !17, i64 8}
!52 = !{!25, !17, i64 24}
!53 = !{!25, !17, i64 32}
