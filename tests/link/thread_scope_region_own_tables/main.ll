%struct.Leaf = type { i32 }
%struct.Mid = type { %struct.Leaf* }
%struct.Item = type { i8*, i32 }
%struct.Holder = type { %struct.Leaf*, %struct.nish_array* }
%struct.Reg = type { %struct.Map$str$i32* }
%struct.Map$i32$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.ThreadScope = type { i32 }
%struct.Map$str$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$str$$Item = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$$Leaf$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$$Leaf$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Holder* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #6
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare void @nish_scope_join(i8* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #8 {
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

define internal void @Mid.constructor(%struct.Mid* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Leaf*
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = getelementptr inbounds %struct.Mid, %struct.Mid* %this, i32 0, i32 0
  store %struct.Leaf* %1, %struct.Leaf** %3, align 8, !tbaa !7
  ret void
}

define internal void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8, !tbaa !9
  %1 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 1
  store i32 %v, i32* %1, align 4, !tbaa !10
  ret void
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Leaf*
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Leaf* %1, %struct.Leaf** %3, align 8, !tbaa !12
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.Item*
  call void @Item.constructor(%struct.Item* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 1)
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.Item*
  call void @Item.constructor(%struct.Item* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 2)
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 2, i64* %10, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 2, i64* %11, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %12 = call i8* @nish_alloc_struct(i64 16)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %14 = bitcast i8* %12 to %struct.Item**
  %15 = getelementptr inbounds %struct.Item*, %struct.Item** %14, i64 0
  store %struct.Item* %5, %struct.Item** %15, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %16 = getelementptr inbounds %struct.Item*, %struct.Item** %14, i64 1
  store %struct.Item* %7, %struct.Item** %16, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.nish_array* %9, %struct.nish_array** %17, align 8, !tbaa !26
  ret void
}

define hidden noundef i32 @read$(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Leaf*, %struct.Leaf** %0, align 8, !tbaa !12
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !26
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %8 = icmp ult i64 0, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %11 = bitcast i8* %10 to %struct.Item**
  %12 = getelementptr inbounds %struct.Item*, %struct.Item** %11, i64 0
  %13 = load %struct.Item*, %struct.Item** %12, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %14 = getelementptr inbounds %struct.Item, %struct.Item* %13, i32 0, i32 1
  %15 = load i32, i32* %14, align 4, !tbaa !10
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work1(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$i32$i32*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %b.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %walk.idx = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$i32*
  call void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* %1)
  store %struct.Map$i32$i32* %1, %struct.Map$i32$i32** %m.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %4 = bitcast [6 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 2, i32* %9, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 3, i32* %10, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 3, i32* %11, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 3, i32* %12, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %forof.body, label %forof.end

forof.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  store i32 %22, i32* %b.addr, align 4
  %23 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %m.addr, align 8
  %24 = load i32, i32* %b.addr, align 4
  %25 = call i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* %23, i32 %24)
  %26 = icmp sge i64 %25, 0
  br i1 %26, label %nullish.value, label %nullish.default

nullish.value:
  %27 = trunc i64 %25 to i32
  %28 = call i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* %23, i32 %27)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %29 = phi i32 [ %28, %nullish.value ], [ 0, %nullish.default ]
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 1)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  br i1 %26, label %set.found, label %set.insert

set.found:
  %33 = trunc i64 %25 to i32
  call void @nish.Map$i32$i32.setValueAt(%struct.Map$i32$i32* %23, i32 %33, i32 %31)
  br label %set.end

set.insert:
  call void @nish.Map$i32$i32.insertAt(%struct.Map$i32$i32* %23, i64 %25, i32 %24, i32 %31)
  br label %set.end

set.end:
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = add i64 %34, 1
  store i64 %35, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %t.addr, align 4
  %36 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %m.addr, align 8
  call void @nish.Map$i32$i32.walkOpen(%struct.Map$i32$i32* %36)
  %37 = call i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* %36, i32 0)
  store i32 %37, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %38 = load i32, i32* %walk.idx, align 4
  %39 = icmp sge i32 %38, 0
  br i1 %39, label %walk.body, label %walk.end

walk.body:
  %40 = call i32 @nish.Map$i32$i32.keyAt(%struct.Map$i32$i32* %36, i32 %38)
  store i32 %40, i32* %k.addr, align 4
  %41 = load i32, i32* %t.addr, align 4
  %42 = load i32, i32* %k.addr, align 4
  %43 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %m.addr, align 8
  %44 = load i32, i32* %k.addr, align 4
  %45 = call i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* %43, i32 %44)
  %46 = icmp sge i64 %45, 0
  br i1 %46, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %47 = trunc i64 %45 to i32
  %48 = call i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* %43, i32 %47)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %49 = phi i32 [ %48, %nullish.value.1 ], [ 0, %nullish.default.1 ]
  %50 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %42, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 %51)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %54, i32* %t.addr, align 4
  br label %walk.inc

walk.inc:
  %56 = add i32 %38, 1
  %57 = call i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* %36, i32 %56)
  store i32 %57, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$i32$i32.walkClose(%struct.Map$i32$i32* %36)
  %58 = load i32, i32* %t.addr, align 4
  %59 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %60 = load %struct.Leaf*, %struct.Leaf** %59, align 8, !tbaa !12
  %61 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %60, i32 0, i32 0
  %62 = load i32, i32* %61, align 4, !tbaa !4
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %62)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %64

ovf.fail:
  %ovf.op = phi i32 [ 0, %nullish.end ], [ 2, %nullish.end.1 ], [ 0, %ovf.ok.1 ], [ 0, %walk.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @fib(i32 noundef %n, %struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) %memo) #1 {
entry:
  %r.addr = alloca i32, align 4
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %n

if.end:
  %1 = call i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* %memo, i32 %n)
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %get.found, label %get.end

get.found:
  %3 = trunc i64 %1 to i32
  %4 = call i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* %memo, i32 %3)
  br label %get.end

get.end:
  %5 = phi i32 [ %4, %get.found ], [ 0, %if.end ]
  br i1 %2, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 %5

if.end.1:
  %6 = sub nsw i32 %n, 1
  %7 = call i32 @fib(i32 %6, %struct.Map$i32$i32* %memo)
  %8 = sub nsw i32 %n, 2
  %9 = call i32 @fib(i32 %8, %struct.Map$i32$i32* %memo)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %r.addr, align 4
  %13 = load i32, i32* %r.addr, align 4
  %14 = call %struct.Map$i32$i32* @nish.Map$i32$i32.set(%struct.Map$i32$i32* %memo, i32 %n, i32 %13)
  %15 = load i32, i32* %r.addr, align 4
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work2(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %memo.addr = alloca %struct.Map$i32$i32*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$i32*
  call void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* %1)
  store %struct.Map$i32$i32* %1, %struct.Map$i32$i32** %memo.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %3 = load %struct.Leaf*, %struct.Leaf** %2, align 8, !tbaa !12
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 20, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %memo.addr, align 8
  %10 = call i32 @fib(i32 %7, %struct.Map$i32$i32* %9)
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @look(i32 noundef %n, %struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) %memo) #1 {
entry:
  %0 = mul nsw i32 %n, 2
  %1 = call %struct.Map$i32$i32* @nish.Map$i32$i32.set(%struct.Map$i32$i32* %memo, i32 %n, i32 %0)
  %2 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %memo, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !30
  ret i32 %3
}

define internal noundef i32 @work3(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %memo.addr = alloca %struct.Map$i32$i32*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$i32*
  call void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* %1)
  store %struct.Map$i32$i32* %1, %struct.Map$i32$i32** %memo.addr, align 8
  %2 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %memo.addr, align 8
  %3 = call i32 @look(i32 3, %struct.Map$i32$i32* %2)
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %5 = load %struct.Leaf*, %struct.Leaf** %4, align 8, !tbaa !12
  %6 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work4(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$i32*, align 8
  %t.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %walk.idx = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$i32*
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1)
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %m.addr, align 8
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %3 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 1)
  %4 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %5 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 2)
  store i32 0, i32* %t.addr, align 4
  %6 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  call void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* %6)
  %7 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %6, i32 0)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %8 = load i32, i32* %walk.idx, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %walk.body, label %walk.end

walk.body:
  %10 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %6, i32 %8)
  store i32 %10, i32* %v.addr, align 4
  %11 = load i32, i32* %t.addr, align 4
  %12 = load i32, i32* %v.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  br label %walk.inc

walk.inc:
  %16 = add i32 %8, 1
  %17 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %6, i32 %16)
  store i32 %17, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %6)
  %18 = load i32, i32* %t.addr, align 4
  ret i32 %18

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work5(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Leaf*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Leaf*
  call void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* %1)
  store %struct.Map$str$$Leaf* %1, %struct.Map$str$$Leaf** %m.addr, align 8
  %2 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %4 = load %struct.Leaf*, %struct.Leaf** %3, align 8, !tbaa !12
  %5 = call %struct.Map$str$$Leaf* @nish.Map$str$$Leaf.set(%struct.Map$str$$Leaf* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Leaf* %4)
  %6 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %7 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !32
  %9 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %10 = call i1 @nish.Map$str$$Leaf.has(%struct.Map$str$$Leaf* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %11 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work6(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %ix.addr = alloca %struct.Map$str$$Item*, align 8
  %it.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Item*
  call void @nish.Map$str$$Item.constructor(%struct.Map$str$$Item* %1)
  store %struct.Map$str$$Item* %1, %struct.Map$str$$Item** %ix.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !26
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = bitcast i8* %9 to %struct.Item**
  %11 = getelementptr inbounds %struct.Item*, %struct.Item** %10, i64 %4
  %12 = load %struct.Item*, %struct.Item** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  store %struct.Item* %12, %struct.Item** %it.addr, align 8
  %13 = load %struct.Map$str$$Item*, %struct.Map$str$$Item** %ix.addr, align 8
  %14 = load %struct.Item*, %struct.Item** %it.addr, align 8
  %15 = getelementptr inbounds %struct.Item, %struct.Item* %14, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !9
  %17 = load %struct.Item*, %struct.Item** %it.addr, align 8
  %18 = call %struct.Map$str$$Item* @nish.Map$str$$Item.set(%struct.Map$str$$Item* %13, i8* %16, %struct.Item* %17)
  br label %forof.inc

forof.inc:
  %19 = load i64, i64* %forof.idx, align 8
  %20 = add i64 %19, 1
  store i64 %20, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %21 = load %struct.Map$str$$Item*, %struct.Map$str$$Item** %ix.addr, align 8
  %22 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !34
  ret i32 %23
}

define internal noundef i32 @work7(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Leaf*, align 8
  %o.addr = alloca %struct.Leaf*, align 8
  %st.addr = alloca %struct.Set$$Leaf*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Leaf*
  call void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* %1)
  store %struct.Map$str$$Leaf* %1, %struct.Map$str$$Leaf** %m.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Leaf*
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !4
  store %struct.Leaf* %3, %struct.Leaf** %o.addr, align 8
  %5 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %6 = load %struct.Leaf*, %struct.Leaf** %o.addr, align 8
  %7 = call %struct.Map$str$$Leaf* @nish.Map$str$$Leaf.set(%struct.Map$str$$Leaf* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Leaf* %6)
  %8 = call i8* @nish_alloc_struct(i64 48)
  %9 = bitcast i8* %8 to %struct.Set$$Leaf*
  call void @nish.Set$$Leaf.constructor(%struct.Set$$Leaf* %9)
  store %struct.Set$$Leaf* %9, %struct.Set$$Leaf** %st.addr, align 8
  %10 = load %struct.Set$$Leaf*, %struct.Set$$Leaf** %st.addr, align 8
  %11 = load %struct.Leaf*, %struct.Leaf** %o.addr, align 8
  %12 = call %struct.Set$$Leaf* @nish.Set$$Leaf.add(%struct.Set$$Leaf* %10, %struct.Leaf* %11)
  %13 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %14 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !32
  %16 = load %struct.Set$$Leaf*, %struct.Set$$Leaf** %st.addr, align 8
  %17 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %16, i32 0, i32 0
  %18 = load i32, i32* %17, align 4, !tbaa !36
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work8(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$$Leaf$i32*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$$Leaf$i32*
  call void @nish.Map$$Leaf$i32.constructor(%struct.Map$$Leaf$i32* %1)
  store %struct.Map$$Leaf$i32* %1, %struct.Map$$Leaf$i32** %m.addr, align 8
  %2 = load %struct.Map$$Leaf$i32*, %struct.Map$$Leaf$i32** %m.addr, align 8
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %4 = load %struct.Leaf*, %struct.Leaf** %3, align 8, !tbaa !12
  %5 = load %struct.Map$$Leaf$i32*, %struct.Map$$Leaf$i32** %m.addr, align 8
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %7 = load %struct.Leaf*, %struct.Leaf** %6, align 8, !tbaa !12
  %8 = call i64 @nish.Map$$Leaf$i32.probe(%struct.Map$$Leaf$i32* %5, %struct.Leaf* %7)
  %9 = icmp sge i64 %8, 0
  br i1 %9, label %nullish.value, label %nullish.default

nullish.value:
  %10 = trunc i64 %8 to i32
  %11 = call i32 @nish.Map$$Leaf$i32.valueAt(%struct.Map$$Leaf$i32* %5, i32 %10)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %12 = phi i32 [ %11, %nullish.value ], [ 0, %nullish.default ]
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 1)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = call %struct.Map$$Leaf$i32* @nish.Map$$Leaf$i32.set(%struct.Map$$Leaf$i32* %2, %struct.Leaf* %4, i32 %14)
  %17 = load %struct.Map$$Leaf$i32*, %struct.Map$$Leaf$i32** %m.addr, align 8
  %18 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !38
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Reg.constructor(%struct.Reg* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Reg, %struct.Reg* %this, i32 0, i32 0
  store %struct.Map$str$i32* %c, %struct.Map$str$i32** %0, align 8, !tbaa !40
  ret void
}

define internal noundef i32 @work9(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %counts.addr = alloca %struct.Map$str$i32*, align 8
  %r.addr = alloca %struct.Reg*, align 8
  %Reg.obj = alloca %struct.Reg, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$i32*
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1)
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %counts.addr, align 8
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %counts.addr, align 8
  %3 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = icmp sge i64 %3, 0
  br i1 %4, label %nullish.value, label %nullish.default

nullish.value:
  %5 = trunc i64 %3 to i32
  %6 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %2, i32 %5)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %7 = phi i32 [ %6, %nullish.value ], [ 0, %nullish.default ]
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  br i1 %4, label %set.found, label %set.insert

set.found:
  %11 = trunc i64 %3 to i32
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %2, i32 %11, i32 %9)
  br label %set.end

set.insert:
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %2, i64 %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 %9)
  br label %set.end

set.end:
  %12 = load %struct.Map$str$i32*, %struct.Map$str$i32** %counts.addr, align 8
  call void @Reg.constructor(%struct.Reg* %Reg.obj, %struct.Map$str$i32* %12)
  store %struct.Reg* %Reg.obj, %struct.Reg** %r.addr, align 8
  %13 = load %struct.Reg*, %struct.Reg** %r.addr, align 8
  %14 = getelementptr inbounds %struct.Reg, %struct.Reg* %13, i32 0, i32 0
  %15 = load %struct.Map$str$i32*, %struct.Map$str$i32** %14, align 8, !tbaa !40
  %16 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 2)
  %17 = load %struct.Reg*, %struct.Reg** %r.addr, align 8
  %18 = getelementptr inbounds %struct.Reg, %struct.Reg* %17, i32 0, i32 0
  %19 = load %struct.Map$str$i32*, %struct.Map$str$i32** %18, align 8, !tbaa !40
  %20 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !42
  %22 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %23 = load %struct.Leaf*, %struct.Leaf** %22, align 8, !tbaa !12
  %24 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4, !tbaa !4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %27

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work10(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %seen.addr = alloca %struct.Map$$Leaf$$Leaf*, align 8
  %t.addr = alloca i32, align 4
  %v.addr = alloca %struct.Leaf*, align 8
  %walk.idx = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$$Leaf$$Leaf*
  call void @nish.Map$$Leaf$$Leaf.constructor(%struct.Map$$Leaf$$Leaf* %1)
  store %struct.Map$$Leaf$$Leaf* %1, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  %2 = load %struct.Map$$Leaf$$Leaf*, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.Leaf*
  %5 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !4
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = bitcast i8* %6 to %struct.Leaf*
  %8 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %7, i32 0, i32 0
  store i32 0, i32* %8, align 4, !tbaa !4
  %9 = call %struct.Map$$Leaf$$Leaf* @nish.Map$$Leaf$$Leaf.set(%struct.Map$$Leaf$$Leaf* %2, %struct.Leaf* %4, %struct.Leaf* %7)
  %10 = load %struct.Map$$Leaf$$Leaf*, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %12 = load %struct.Leaf*, %struct.Leaf** %11, align 8, !tbaa !12
  %13 = call i1 @nish.Map$$Leaf$$Leaf.has(%struct.Map$$Leaf$$Leaf* %10, %struct.Leaf* %12)
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %14 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  store i32 %14, i32* %t.addr, align 4
  %15 = load %struct.Map$$Leaf$$Leaf*, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  %16 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %17 = load %struct.Leaf*, %struct.Leaf** %16, align 8, !tbaa !12
  %18 = call i1 @nish.Map$$Leaf$$Leaf.delete(%struct.Map$$Leaf$$Leaf* %15, %struct.Leaf* %17)
  %19 = load %struct.Map$$Leaf$$Leaf*, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  %20 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %21 = load %struct.Leaf*, %struct.Leaf** %20, align 8, !tbaa !12
  %22 = call i64 @nish.Map$$Leaf$$Leaf.probe(%struct.Map$$Leaf$$Leaf* %19, %struct.Leaf* %21)
  %23 = icmp sge i64 %22, 0
  br i1 %23, label %get.found, label %get.end

get.found:
  %24 = trunc i64 %22 to i32
  %25 = call %struct.Leaf* @nish.Map$$Leaf$$Leaf.valueAt(%struct.Map$$Leaf$$Leaf* %19, i32 %24)
  br label %get.end

get.end:
  %26 = phi %struct.Leaf* [ %25, %get.found ], [ null, %cond.end ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %t.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 1)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %t.addr, align 4
  br label %if.end

if.end:
  %31 = load %struct.Map$$Leaf$$Leaf*, %struct.Map$$Leaf$$Leaf** %seen.addr, align 8
  call void @nish.Map$$Leaf$$Leaf.walkOpen(%struct.Map$$Leaf$$Leaf* %31)
  %32 = call i32 @nish.Map$$Leaf$$Leaf.walkNext(%struct.Map$$Leaf$$Leaf* %31, i32 0)
  store i32 %32, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %33 = load i32, i32* %walk.idx, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %walk.body, label %walk.end

walk.body:
  %35 = call %struct.Leaf* @nish.Map$$Leaf$$Leaf.valueAt(%struct.Map$$Leaf$$Leaf* %31, i32 %33)
  store %struct.Leaf* %35, %struct.Leaf** %v.addr, align 8
  %36 = load %struct.Leaf*, %struct.Leaf** %v.addr, align 8
  %37 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %36, i32 0, i32 0
  store i32 1, i32* %37, align 4, !tbaa !4
  %38 = load i32, i32* %t.addr, align 4
  %39 = load %struct.Leaf*, %struct.Leaf** %v.addr, align 8
  %40 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !4
  %42 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %43, i32* %t.addr, align 4
  br label %walk.inc

walk.inc:
  %45 = add i32 %33, 1
  %46 = call i32 @nish.Map$$Leaf$$Leaf.walkNext(%struct.Map$$Leaf$$Leaf* %31, i32 %45)
  store i32 %46, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$$Leaf$$Leaf.walkClose(%struct.Map$$Leaf$$Leaf* %31)
  %47 = load i32, i32* %t.addr, align 4
  ret i32 %47

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %r.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %1)
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  store %struct.nish_array* %3, %struct.nish_array** %done.addr, align 8
  store i32 0, i32* %r.addr, align 4
  %10 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %10, %struct.ThreadScope** %s.addr, align 8
  %11 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %12 = bitcast %struct.ThreadScope* %11 to i8*
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* %13, %struct.Holder* %14, %struct.nish_array* %15, i32 0)
  %16 = load i32, i32* %r.addr, align 4
  %17 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %18 = call i32 @work1(%struct.Holder* %17)
  %19 = add nsw i32 %16, %18
  store i32 %19, i32* %r.addr, align 4
  %20 = load i32, i32* %r.addr, align 4
  %21 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %22 = call i32 @work2(%struct.Holder* %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %24, i32* %r.addr, align 4
  %26 = load i32, i32* %r.addr, align 4
  %27 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %28 = call i32 @work3(%struct.Holder* %27)
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %30, i32* %r.addr, align 4
  %32 = load i32, i32* %r.addr, align 4
  %33 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %34 = call i32 @work4(%struct.Holder* %33)
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %36, i32* %r.addr, align 4
  %38 = load i32, i32* %r.addr, align 4
  %39 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %40 = call i32 @work5(%struct.Holder* %39)
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %42, i32* %r.addr, align 4
  %44 = load i32, i32* %r.addr, align 4
  %45 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %46 = call i32 @work6(%struct.Holder* %45)
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %48, i32* %r.addr, align 4
  %50 = load i32, i32* %r.addr, align 4
  %51 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %52 = call i32 @work7(%struct.Holder* %51)
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %52)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %54, i32* %r.addr, align 4
  %56 = load i32, i32* %r.addr, align 4
  %57 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %58 = call i32 @work8(%struct.Holder* %57)
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %60, i32* %r.addr, align 4
  %62 = load i32, i32* %r.addr, align 4
  %63 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %64 = call i32 @work9(%struct.Holder* %63)
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 %64)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %66, i32* %r.addr, align 4
  %68 = load i32, i32* %r.addr, align 4
  %69 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %70 = call i32 @work10(%struct.Holder* %69)
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 %70)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i32 %72, i32* %r.addr, align 4
  call void @nish_scope_join(i8* %12)
  %74 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %77 = icmp ult i64 0, %76
  br i1 %77, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %76)
  unreachable

bounds.ok:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %80 = bitcast i8* %79 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 0
  %82 = load i32, i32* %81, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %85 = load i32, i32* %r.addr, align 4
  %86 = call i8* @nish_str_from_i32(i32 %85)
  %87 = call i8* @nish_str_concat(i8* %84, i8* %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %89 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %90 = getelementptr inbounds %struct.Holder, %struct.Holder* %89, i32 0, i32 0
  %91 = load %struct.Leaf*, %struct.Leaf** %90, align 8, !tbaa !12
  %92 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %91, i32 0, i32 0
  %93 = load i32, i32* %92, align 4, !tbaa !4
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %88, i8* %94)
  call void @nish_print(i8* %95)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

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

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
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

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %16 = load i32, i32* %15, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %12 = load i32, i32* %11, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  store i32 %24, i32* %26, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %32 = load i64, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
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
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !17, !noalias !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #0 {
entry:
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = trunc i64 %found to i32
  store i32 %0, i32* %at.addr, align 4
  %1 = ashr i64 %found, 32
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %bucket.addr, align 4
  %3 = load i32, i32* %bucket.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %bucket.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %entry ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %bucket.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  store i32 16777216, i32* %16, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %if.end

if.end:
  %17 = load i32, i32* %at.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = load i32, i32* %at.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %19, %22
  br label %land.end.1

land.end.1:
  %24 = phi i1 [ false, %if.end ], [ %23, %land.rhs.1 ]
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load i32, i32* %at.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %26
  store i32 0, i32* %30, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  store i32 0, i32* %10, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #1 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !16, !noalias !17, !tbaa !21
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
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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

define internal void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !30
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !43
  %2 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !44
  %3 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !45
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !46
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !47
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !48
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !49
  ret void
}

define internal noundef i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !46
  %2 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !43
  %4 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !49
  %6 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !47
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$i32* @nish.Map$i32$i32.set(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, i32 noundef %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i32$i32.setValueAt(%struct.Map$i32$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i32$i32.insertAt(%struct.Map$i32$i32* %this, i64 %5, i32 %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$i32$i32* %this
}

define internal void @nish.Map$i32$i32.walkOpen(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !45
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !45
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !49
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$i32$i32.walkClose(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !45
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !45
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish.Map$i32$i32.keyAt(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !47
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !47
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  ret i32 %15
}

define internal noundef i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !48
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !48
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  ret i32 %15
}

define internal void @nish.Map$i32$i32.setValueAt(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !48
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !48
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$i32.insertAt(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, i32 noundef %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !47
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !44
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !45
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$i32$i32.rebuild(%struct.Map$i32$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !47
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  store i32 %key, i32* %29, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !48
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !49
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !44
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !44
  %65 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !30
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !30
  %71 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !47
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !46
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i32$i32.rebuild(%struct.Map$i32$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !46
  %91 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !43
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

define internal void @nish.Map$i32$i32.rebuild(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !47
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !45
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !46
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !44
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
  %19 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !44
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !47
  %26 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !49
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !48
  %30 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !49
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !49
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !46
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !43
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !49
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !42
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !50
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !51
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !52
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !53
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !54
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !55
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !56
  ret void
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !53
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !50
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !56
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !54
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$str$i32* %this
}

define internal void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !52
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !52
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !56
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !52
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !52
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !55
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !55
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  ret i32 %15
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !55
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !55
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !54
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !51
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !52
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !54
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !55
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !56
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !51
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !51
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !42
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !42
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !54
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !53
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !53
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !50
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

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !54
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !52
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !53
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !51
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
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !51
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !54
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !56
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !55
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !56
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !56
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !53
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !50
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !56
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !32
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !57
  %2 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !58
  %3 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !59
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !60
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !61
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !62
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !63
  ret void
}

define internal noundef i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !60
  %2 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !57
  %4 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !63
  %6 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !61
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$str$$Leaf.has(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = call i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* %this, i8* %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Leaf* @nish.Map$str$$Leaf.set(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$$Leaf.setValueAt(%struct.Map$str$$Leaf* %this, i32 %4, %struct.Leaf* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$$Leaf.insertAt(%struct.Map$str$$Leaf* %this, i64 %5, i8* %key, %struct.Leaf* %value)
  br label %if.end

if.end:
  ret %struct.Map$str$$Leaf* %this
}

define internal void @nish.Map$str$$Leaf.setValueAt(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !62
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !62
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  store %struct.Leaf* %value, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Leaf.insertAt(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !61
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !58
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !59
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !61
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !62
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to %struct.Leaf**
  %42 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %41, i64 %35
  store %struct.Leaf* %value, %struct.Leaf** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !63
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !58
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !58
  %65 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !32
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !32
  %71 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !61
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !60
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !60
  %91 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !57
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

define internal void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !61
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !59
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !60
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !58
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
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !58
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !61
  %26 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !63
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !62
  %30 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !63
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !63
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !60
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !57
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !63
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$$Item.constructor(%struct.Map$str$$Item* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !34
  %1 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !64
  %2 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !65
  %3 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !66
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !67
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !68
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !69
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !70
  ret void
}

define internal noundef i64 @nish.Map$str$$Item.probe(%struct.Map$str$$Item* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !67
  %2 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !64
  %4 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !70
  %6 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !68
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Item* @nish.Map$str$$Item.set(%struct.Map$str$$Item* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, %struct.Item* noundef nonnull align 8 dereferenceable(16) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$$Item.probe(%struct.Map$str$$Item* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$$Item.setValueAt(%struct.Map$str$$Item* %this, i32 %4, %struct.Item* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$$Item.insertAt(%struct.Map$str$$Item* %this, i64 %5, i8* %key, %struct.Item* %value)
  br label %if.end

if.end:
  ret %struct.Map$str$$Item* %this
}

define internal void @nish.Map$str$$Item.setValueAt(%struct.Map$str$$Item* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Item* noundef nonnull align 8 dereferenceable(16) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !69
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !69
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to %struct.Item**
  %14 = getelementptr inbounds %struct.Item*, %struct.Item** %13, i64 %10
  store %struct.Item* %value, %struct.Item** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Item.insertAt(%struct.Map$str$$Item* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %struct.Item* noundef nonnull align 8 dereferenceable(16) %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !68
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !65
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !66
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$$Item.rebuild(%struct.Map$str$$Item* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !68
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !69
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to %struct.Item**
  %42 = getelementptr inbounds %struct.Item*, %struct.Item** %41, i64 %35
  store %struct.Item* %value, %struct.Item** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !70
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !65
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !65
  %65 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !34
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !34
  %71 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !68
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !67
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$$Item.rebuild(%struct.Map$str$$Item* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !67
  %91 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !64
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

define internal void @nish.Map$str$$Item.rebuild(%struct.Map$str$$Item* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !68
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !66
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !67
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !65
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
  %19 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !65
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !68
  %26 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !70
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !69
  %30 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !70
  call void @nish.compactEntries$$Item(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !70
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !67
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !64
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$$Item, %struct.Map$str$$Item* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !70
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Set$$Leaf.constructor(%struct.Set$$Leaf* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !36
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !71
  %2 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !72
  %3 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !73
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !74
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !75
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !76
  ret void
}

define internal noundef i64 @nish.Set$$Leaf.probe(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !74
  %2 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !71
  %4 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !76
  %6 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !75
  %8 = call i64 @nish.probeTable$$Leaf(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, %struct.Leaf* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$$Leaf* @nish.Set$$Leaf.add(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) %this, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$$Leaf.probe(%struct.Set$$Leaf* %this, %struct.Leaf* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$$Leaf.insertAt(%struct.Set$$Leaf* %this, i64 %3, %struct.Leaf* %key)
  br label %if.end

if.end:
  ret %struct.Set$$Leaf* %this
}

define internal void @nish.Set$$Leaf.insertAt(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key) #1 {
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
  %6 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !75
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !72
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %16 = load i32, i32* %15, align 4, !tbaa !73
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !75
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to %struct.Leaf**
  %29 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %28, i64 %22
  store %struct.Leaf* %key, %struct.Leaf** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !76
  %34 = load i32, i32* %h.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %34, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %47 = load i32, i32* %46, align 4, !tbaa !72
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  %51 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 %49, i32* %51, align 4, !tbaa !72
  %52 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !36
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %57 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 %55, i32* %57, align 4, !tbaa !36
  %58 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %59 = load %struct.nish_array*, %struct.nish_array** %58, align 8, !tbaa !75
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %62 = trunc i64 %61 to i32
  store i32 %62, i32* %used.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %67 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !74
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %71 = trunc i64 %70 to i32
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 3)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %75 = icmp sgt i32 %65, %73
  br i1 %75, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* %this)
  br label %if.end.2

if.else:
  %76 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !74
  %78 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  %79 = load i32, i32* %78, align 4, !tbaa !71
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

define internal void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !75
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !73
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !74
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !72
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
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !72
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !75
  %26 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !76
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !76
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !74
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !71
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !76
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
  ret void
}

define internal void @nish.Map$$Leaf$i32.constructor(%struct.Map$$Leaf$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !38
  %1 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !77
  %2 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !78
  %3 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !79
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !80
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !81
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !82
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !83
  ret void
}

define internal noundef i64 @nish.Map$$Leaf$i32.probe(%struct.Map$$Leaf$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !80
  %2 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !77
  %4 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !83
  %6 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !81
  %8 = call i64 @nish.probeTable$$Leaf(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, %struct.Leaf* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$$Leaf$i32* @nish.Map$$Leaf$i32.set(%struct.Map$$Leaf$i32* noundef nonnull align 8 dereferenceable(56) %this, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key, i32 noundef %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$$Leaf$i32.probe(%struct.Map$$Leaf$i32* %this, %struct.Leaf* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$$Leaf$i32.setValueAt(%struct.Map$$Leaf$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$$Leaf$i32.insertAt(%struct.Map$$Leaf$i32* %this, i64 %5, %struct.Leaf* %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$$Leaf$i32* %this
}

define internal noundef i32 @nish.Map$$Leaf$i32.valueAt(%struct.Map$$Leaf$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !82
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !82
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  ret i32 %15
}

define internal void @nish.Map$$Leaf$i32.setValueAt(%struct.Map$$Leaf$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !82
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !82
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$$Leaf$i32.insertAt(%struct.Map$$Leaf$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key, i32 noundef %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !81
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !78
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !79
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$$Leaf$i32.rebuild(%struct.Map$$Leaf$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !81
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to %struct.Leaf**
  %29 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %28, i64 %22
  store %struct.Leaf* %key, %struct.Leaf** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !82
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !83
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !78
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !78
  %65 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !38
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !38
  %71 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !81
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !80
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$$Leaf$i32.rebuild(%struct.Map$$Leaf$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !80
  %91 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !77
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

define internal void @nish.Map$$Leaf$i32.rebuild(%struct.Map$$Leaf$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !81
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !79
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !80
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !78
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
  %19 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !78
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !81
  %26 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !83
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !82
  %30 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !83
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !83
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !80
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !77
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$$Leaf$i32, %struct.Map$$Leaf$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !83
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$$Leaf$$Leaf.constructor(%struct.Map$$Leaf$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !85
  %1 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !86
  %2 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !87
  %3 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !88
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !89
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !90
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !91
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !92
  ret void
}

define internal noundef i64 @nish.Map$$Leaf$$Leaf.probe(%struct.Map$$Leaf$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !89
  %2 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !86
  %4 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !92
  %6 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !90
  %8 = call i64 @nish.probeTable$$Leaf(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, %struct.Leaf* %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$$Leaf$$Leaf.has(%struct.Map$$Leaf$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %0 = call i64 @nish.Map$$Leaf$$Leaf.probe(%struct.Map$$Leaf$$Leaf* %this, %struct.Leaf* %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$$Leaf$$Leaf* @nish.Map$$Leaf$$Leaf.set(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) %this, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$$Leaf$$Leaf.probe(%struct.Map$$Leaf$$Leaf* %this, %struct.Leaf* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$$Leaf$$Leaf.setValueAt(%struct.Map$$Leaf$$Leaf* %this, i32 %4, %struct.Leaf* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$$Leaf$$Leaf.insertAt(%struct.Map$$Leaf$$Leaf* %this, i64 %5, %struct.Leaf* %key, %struct.Leaf* %value)
  br label %if.end

if.end:
  ret %struct.Map$$Leaf$$Leaf* %this
}

define internal noundef zeroext i1 @nish.Map$$Leaf$$Leaf.delete(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$$Leaf$$Leaf.probe(%struct.Map$$Leaf$$Leaf* %this, %struct.Leaf* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !89
  %5 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !92
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !87
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  store i32 %11, i32* %13, align 4, !tbaa !87
  %14 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !85
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 0
  store i32 %17, i32* %19, align 4, !tbaa !85
  ret i1 true

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$$Leaf$$Leaf.walkOpen(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !88
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !88
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$$Leaf$$Leaf.walkNext(%struct.Map$$Leaf$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !92
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$$Leaf$$Leaf.walkClose(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !88
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !88
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @nish.Map$$Leaf$$Leaf.valueAt(%struct.Map$$Leaf$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !91
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !91
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  %15 = load %struct.Leaf*, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  ret %struct.Leaf* %15
}

define internal void @nish.Map$$Leaf$$Leaf.setValueAt(%struct.Map$$Leaf$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !91
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !91
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  store %struct.Leaf* %value, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$$Leaf$$Leaf.insertAt(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !90
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !87
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !88
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$$Leaf$$Leaf.rebuild(%struct.Map$$Leaf$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !90
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = bitcast i8* %27 to %struct.Leaf**
  %29 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %28, i64 %22
  store %struct.Leaf* %key, %struct.Leaf** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !91
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = bitcast i8* %40 to %struct.Leaf**
  %42 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %41, i64 %35
  store %struct.Leaf* %value, %struct.Leaf** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !92
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !22
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !87
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !87
  %65 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !85
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !85
  %71 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !90
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !89
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$$Leaf$$Leaf.rebuild(%struct.Map$$Leaf$$Leaf* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !89
  %91 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !86
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

define internal void @nish.Map$$Leaf$$Leaf.rebuild(%struct.Map$$Leaf$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !90
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !88
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !89
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !87
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
  %19 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !87
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !90
  %26 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !92
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !91
  %30 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !92
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !92
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !89
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !86
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$$Leaf$$Leaf, %struct.Map$$Leaf$$Leaf* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !92
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #1 {
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
  %15 = load i64, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %36 = load i32, i32* %35, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %61 = load i32, i32* %60, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %73 = load i32, i32* %72, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %41 = load i32, i32* %40, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !17, !noalias !16, !tbaa !28
  br label %while.cond

while.end:
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #1 {
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
  %20 = load i64, i64* %19, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %41 = load i32, i32* %40, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %66 = load i32, i32* %65, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %78 = load i8*, i8** %77, align 8, !alias.scope !17, !noalias !16, !tbaa !25
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
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %41 = load i8*, i8** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !25
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$$Leaf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %39 = bitcast i8* %10 to %struct.Leaf**
  %40 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %39, i64 %38
  %41 = load %struct.Leaf*, %struct.Leaf** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %42 = bitcast i8* %10 to %struct.Leaf**
  %43 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %42, i64 %36
  store %struct.Leaf* %41, %struct.Leaf** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !25
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %59 = bitcast i8* %58 to %struct.Leaf**
  %60 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %59, i64 %56
  %61 = load %struct.Leaf*, %struct.Leaf** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$$Item(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %39 = bitcast i8* %10 to %struct.Item**
  %40 = getelementptr inbounds %struct.Item*, %struct.Item** %39, i64 %38
  %41 = load %struct.Item*, %struct.Item** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %42 = bitcast i8* %10 to %struct.Item**
  %43 = getelementptr inbounds %struct.Item*, %struct.Item** %42, i64 %36
  store %struct.Item* %41, %struct.Item** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !25
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %59 = bitcast i8* %58 to %struct.Item**
  %60 = getelementptr inbounds %struct.Item*, %struct.Item** %59, i64 %56
  %61 = load %struct.Item*, %struct.Item** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  br label %while.cond

while.end:
  ret void
}

define internal noundef i64 @nish.probeTable$$Leaf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = ptrtoint %struct.Leaf* %key to i64
  %1 = lshr i64 %0, 33
  %2 = xor i64 %0, %1
  %3 = mul i64 %2, -49064778989728563
  %4 = lshr i64 %3, 33
  %5 = xor i64 %3, %4
  %6 = mul i64 %5, -4265267296055464877
  %7 = lshr i64 %6, 33
  %8 = xor i64 %6, %7
  %9 = trunc i64 %8 to i32
  %10 = lshr i64 %8, 32
  %11 = trunc i64 %10 to i32
  %12 = xor i32 %9, %11
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
  %20 = load i64, i64* %19, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !21
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %41 = load i32, i32* %40, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %66 = load i32, i32* %65, align 4, !alias.scope !17, !noalias !16, !tbaa !28
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
  %76 = bitcast i8* %30 to %struct.Leaf**
  %77 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %76, i64 %75
  %78 = load %struct.Leaf*, %struct.Leaf** %77, align 8, !alias.scope !17, !noalias !16, !tbaa !25
  %79 = icmp eq %struct.Leaf* %78, %key
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
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { noreturn nounwind }
attributes #7 = { nounwind noreturn cold }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Leaf", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Mid", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Item", !5, i64 0, !2, i64 8}
!9 = !{!8, !5, i64 0}
!10 = !{!8, !2, i64 8}
!11 = !{!"Holder", !5, i64 0, !5, i64 8}
!12 = !{!11, !5, i64 0}
!13 = !{!"nish array"}
!14 = !{!"header", !13}
!15 = !{!"elements", !13}
!16 = !{!14}
!17 = !{!15}
!18 = !{!"header i64", !1, i64 0}
!19 = !{!"header ptr", !1, i64 0}
!20 = !{!"array header", !18, i64 0, !18, i64 8, !19, i64 16}
!21 = !{!20, !18, i64 0}
!22 = !{!20, !18, i64 8}
!23 = !{!20, !19, i64 16}
!24 = !{!"element ptr", !1, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!11, !5, i64 8}
!27 = !{!"element i32", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{!"Map$i32$i32", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!30 = !{!29, !2, i64 0}
!31 = !{!"Map$str$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!32 = !{!31, !2, i64 0}
!33 = !{!"Map$str$$Item", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!34 = !{!33, !2, i64 0}
!35 = !{!"Set$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !2, i64 40}
!36 = !{!35, !2, i64 0}
!37 = !{!"Map$$Leaf$i32", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!38 = !{!37, !2, i64 0}
!39 = !{!"Reg", !5, i64 0}
!40 = !{!39, !5, i64 0}
!41 = !{!"Map$str$i32", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!42 = !{!41, !2, i64 0}
!43 = !{!29, !2, i64 16}
!44 = !{!29, !2, i64 20}
!45 = !{!29, !2, i64 48}
!46 = !{!29, !5, i64 8}
!47 = !{!29, !5, i64 24}
!48 = !{!29, !5, i64 32}
!49 = !{!29, !5, i64 40}
!50 = !{!41, !2, i64 16}
!51 = !{!41, !2, i64 20}
!52 = !{!41, !2, i64 48}
!53 = !{!41, !5, i64 8}
!54 = !{!41, !5, i64 24}
!55 = !{!41, !5, i64 32}
!56 = !{!41, !5, i64 40}
!57 = !{!31, !2, i64 16}
!58 = !{!31, !2, i64 20}
!59 = !{!31, !2, i64 48}
!60 = !{!31, !5, i64 8}
!61 = !{!31, !5, i64 24}
!62 = !{!31, !5, i64 32}
!63 = !{!31, !5, i64 40}
!64 = !{!33, !2, i64 16}
!65 = !{!33, !2, i64 20}
!66 = !{!33, !2, i64 48}
!67 = !{!33, !5, i64 8}
!68 = !{!33, !5, i64 24}
!69 = !{!33, !5, i64 32}
!70 = !{!33, !5, i64 40}
!71 = !{!35, !2, i64 16}
!72 = !{!35, !2, i64 20}
!73 = !{!35, !2, i64 40}
!74 = !{!35, !5, i64 8}
!75 = !{!35, !5, i64 24}
!76 = !{!35, !5, i64 32}
!77 = !{!37, !2, i64 16}
!78 = !{!37, !2, i64 20}
!79 = !{!37, !2, i64 48}
!80 = !{!37, !5, i64 8}
!81 = !{!37, !5, i64 24}
!82 = !{!37, !5, i64 32}
!83 = !{!37, !5, i64 40}
!84 = !{!"Map$$Leaf$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!85 = !{!84, !2, i64 0}
!86 = !{!84, !2, i64 16}
!87 = !{!84, !2, i64 20}
!88 = !{!84, !2, i64 48}
!89 = !{!84, !5, i64 8}
!90 = !{!84, !5, i64 24}
!91 = !{!84, !5, i64 32}
!92 = !{!84, !5, i64 40}
