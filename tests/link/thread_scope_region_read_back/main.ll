%struct.Leaf = type { i32 }
%struct.Mid = type { %struct.Leaf* }
%struct.Item = type { i8*, i32 }
%struct.Holder = type { %struct.Leaf*, { %struct.nish_array, [2 x %struct.Item*] } }
%struct.ThreadScope = type { i32 }
%struct.Map$str$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$str$$Mid = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$str$$Map$str$$Leaf = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Set: no entry at this index\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Holder* noundef nonnull align 8 dereferenceable(48), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare void @nish_scope_join(i8* noundef nonnull) #1
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
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
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1, i32 0
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1, i32 1, i64 0
  %10 = bitcast %struct.Item** %9 to i8*
  %11 = bitcast i8* %10 to %struct.Item**
  %12 = getelementptr inbounds %struct.Item*, %struct.Item** %11, i64 0
  store %struct.Item* %5, %struct.Item** %12, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %13 = getelementptr inbounds %struct.Item*, %struct.Item** %11, i64 1
  store %struct.Item* %7, %struct.Item** %13, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 2, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  ret void
}

define hidden noundef i32 @read(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Leaf*, %struct.Leaf** %0, align 8, !tbaa !12
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 0
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 1, i64 0
  %9 = bitcast %struct.Item** %8 to i8*
  %10 = bitcast i8* %9 to %struct.Item**
  %11 = getelementptr inbounds %struct.Item*, %struct.Item** %10, i64 0
  %12 = load %struct.Item*, %struct.Item** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %13 = getelementptr inbounds %struct.Item, %struct.Item* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !10
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work1(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Leaf*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Leaf*
  call void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* %1)
  store %struct.Map$str$$Leaf* %1, %struct.Map$str$$Leaf** %m.addr, align 8
  %2 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.Leaf*
  %5 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !4
  %6 = call %struct.Map$str$$Leaf* @nish.Map$str$$Leaf.set(%struct.Map$str$$Leaf* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Leaf* %4)
  %7 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %8 = call i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = icmp sge i64 %8, 0
  br i1 %9, label %get.found, label %get.end

get.found:
  %10 = trunc i64 %8 to i32
  %11 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %7, i32 %10)
  br label %get.end

get.end:
  %12 = phi %struct.Leaf* [ %11, %get.found ], [ null, %entry ]
  br i1 %9, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %12, i32 0, i32 0
  store i32 1, i32* %13, align 4, !tbaa !4
  br label %if.end

if.end:
  %14 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %15 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4, !tbaa !25
  ret i32 %16
}

define internal noundef i32 @work2(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Leaf*, align 8
  %Leaf.obj = alloca %struct.Leaf, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Leaf*
  call void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* %1)
  store %struct.Map$str$$Leaf* %1, %struct.Map$str$$Leaf** %m.addr, align 8
  %2 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.Leaf*
  %5 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !4
  %6 = call i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = icmp sge i64 %6, 0
  br i1 %7, label %get.found, label %get.insert

get.found:
  %8 = trunc i64 %6 to i32
  %9 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %2, i32 %8)
  br label %get.end

get.insert:
  call void @nish.Map$str$$Leaf.insertAt(%struct.Map$str$$Leaf* %2, i64 %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Leaf* %4)
  br label %get.end

get.end:
  %10 = phi %struct.Leaf* [ %9, %get.found ], [ %4, %get.insert ]
  %11 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %10, i32 0, i32 0
  store i32 1, i32* %11, align 4, !tbaa !4
  %12 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  %13 = call i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = icmp sge i64 %13, 0
  br i1 %14, label %nullish.value, label %nullish.default

nullish.value:
  %15 = trunc i64 %13 to i32
  %16 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %12, i32 %15)
  br label %nullish.end

nullish.default:
  %17 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %Leaf.obj, i32 0, i32 0
  store i32 0, i32* %17, align 4, !tbaa !4
  br label %nullish.end

nullish.end:
  %18 = phi %struct.Leaf* [ %16, %nullish.value ], [ %Leaf.obj, %nullish.default ]
  %19 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %18, i32 0, i32 0
  %20 = load i32, i32* %19, align 4, !tbaa !4
  ret i32 %20
}

define internal noundef i32 @work3(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Mid*, align 8
  %t.addr = alloca i32, align 4
  %v.addr = alloca %struct.Mid*, align 8
  %walk.idx = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Mid*
  call void @nish.Map$str$$Mid.constructor(%struct.Map$str$$Mid* %1)
  store %struct.Map$str$$Mid* %1, %struct.Map$str$$Mid** %m.addr, align 8
  %2 = load %struct.Map$str$$Mid*, %struct.Map$str$$Mid** %m.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 8)
  %4 = bitcast i8* %3 to %struct.Mid*
  call void @Mid.constructor(%struct.Mid* %4)
  %5 = call %struct.Map$str$$Mid* @nish.Map$str$$Mid.set(%struct.Map$str$$Mid* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Mid* %4)
  %6 = load %struct.Map$str$$Mid*, %struct.Map$str$$Mid** %m.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Mid*
  call void @Mid.constructor(%struct.Mid* %8)
  %9 = call %struct.Map$str$$Mid* @nish.Map$str$$Mid.set(%struct.Map$str$$Mid* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %struct.Mid* %8)
  store i32 0, i32* %t.addr, align 4
  %10 = load %struct.Map$str$$Mid*, %struct.Map$str$$Mid** %m.addr, align 8
  call void @nish.Map$str$$Mid.walkOpen(%struct.Map$str$$Mid* %10)
  %11 = call i32 @nish.Map$str$$Mid.walkNext(%struct.Map$str$$Mid* %10, i32 0)
  store i32 %11, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %12 = load i32, i32* %walk.idx, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %walk.body, label %walk.end

walk.body:
  %14 = call %struct.Mid* @nish.Map$str$$Mid.valueAt(%struct.Map$str$$Mid* %10, i32 %12)
  store %struct.Mid* %14, %struct.Mid** %v.addr, align 8
  %15 = load %struct.Mid*, %struct.Mid** %v.addr, align 8
  %16 = getelementptr inbounds %struct.Mid, %struct.Mid* %15, i32 0, i32 0
  %17 = load %struct.Leaf*, %struct.Leaf** %16, align 8, !tbaa !7
  %18 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %17, i32 0, i32 0
  store i32 1, i32* %18, align 4, !tbaa !4
  %19 = load i32, i32* %t.addr, align 4
  %20 = load %struct.Mid*, %struct.Mid** %v.addr, align 8
  %21 = getelementptr inbounds %struct.Mid, %struct.Mid* %20, i32 0, i32 0
  %22 = load %struct.Leaf*, %struct.Leaf** %21, align 8, !tbaa !7
  %23 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %26, i32* %t.addr, align 4
  br label %walk.inc

walk.inc:
  %28 = add i32 %12, 1
  %29 = call i32 @nish.Map$str$$Mid.walkNext(%struct.Map$str$$Mid* %10, i32 %28)
  store i32 %29, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$str$$Mid.walkClose(%struct.Map$str$$Mid* %10)
  %30 = load i32, i32* %t.addr, align 4
  ret i32 %30

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work4(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %st.addr = alloca %struct.Set$$Leaf*, align 8
  %t.addr = alloca i32, align 4
  %l.addr = alloca %struct.Leaf*, align 8
  %walk.idx = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Set$$Leaf*
  call void @nish.Set$$Leaf.constructor(%struct.Set$$Leaf* %1)
  store %struct.Set$$Leaf* %1, %struct.Set$$Leaf** %st.addr, align 8
  %2 = load %struct.Set$$Leaf*, %struct.Set$$Leaf** %st.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.Leaf*
  %5 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !4
  %6 = call %struct.Set$$Leaf* @nish.Set$$Leaf.add(%struct.Set$$Leaf* %2, %struct.Leaf* %4)
  %7 = load %struct.Set$$Leaf*, %struct.Set$$Leaf** %st.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 4)
  %9 = bitcast i8* %8 to %struct.Leaf*
  %10 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %9, i32 0, i32 0
  store i32 0, i32* %10, align 4, !tbaa !4
  %11 = call %struct.Set$$Leaf* @nish.Set$$Leaf.add(%struct.Set$$Leaf* %7, %struct.Leaf* %9)
  store i32 0, i32* %t.addr, align 4
  %12 = load %struct.Set$$Leaf*, %struct.Set$$Leaf** %st.addr, align 8
  call void @nish.Set$$Leaf.walkOpen(%struct.Set$$Leaf* %12)
  %13 = call i32 @nish.Set$$Leaf.walkNext(%struct.Set$$Leaf* %12, i32 0)
  store i32 %13, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %14 = load i32, i32* %walk.idx, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %walk.body, label %walk.end

walk.body:
  %16 = call %struct.Leaf* @nish.Set$$Leaf.keyAt(%struct.Set$$Leaf* %12, i32 %14)
  store %struct.Leaf* %16, %struct.Leaf** %l.addr, align 8
  %17 = load %struct.Leaf*, %struct.Leaf** %l.addr, align 8
  %18 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %17, i32 0, i32 0
  store i32 2, i32* %18, align 4, !tbaa !4
  %19 = load i32, i32* %t.addr, align 4
  %20 = load %struct.Leaf*, %struct.Leaf** %l.addr, align 8
  %21 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4, !tbaa !4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %24, i32* %t.addr, align 4
  br label %walk.inc

walk.inc:
  %26 = add i32 %14, 1
  %27 = call i32 @nish.Set$$Leaf.walkNext(%struct.Set$$Leaf* %12, i32 %26)
  store i32 %27, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Set$$Leaf.walkClose(%struct.Set$$Leaf* %12)
  %28 = load i32, i32* %t.addr, align 4
  ret i32 %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work5(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %outer.addr = alloca %struct.Map$str$$Map$str$$Leaf*, align 8
  %t.addr = alloca i32, align 4
  %m.addr = alloca %struct.Map$str$$Leaf*, align 8
  %walk.idx = alloca i32, align 4
  %l.addr = alloca %struct.Leaf*, align 8
  %walk.idx.1 = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Map$str$$Leaf*
  call void @nish.Map$str$$Map$str$$Leaf.constructor(%struct.Map$str$$Map$str$$Leaf* %1)
  store %struct.Map$str$$Map$str$$Leaf* %1, %struct.Map$str$$Map$str$$Leaf** %outer.addr, align 8
  %2 = load %struct.Map$str$$Map$str$$Leaf*, %struct.Map$str$$Map$str$$Leaf** %outer.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 56)
  %4 = bitcast i8* %3 to %struct.Map$str$$Leaf*
  call void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* %4)
  %5 = call %struct.Map$str$$Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.set(%struct.Map$str$$Map$str$$Leaf* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %struct.Map$str$$Leaf* %4)
  %6 = load %struct.Map$str$$Map$str$$Leaf*, %struct.Map$str$$Map$str$$Leaf** %outer.addr, align 8
  %7 = call i64 @nish.Map$str$$Map$str$$Leaf.probe(%struct.Map$str$$Map$str$$Leaf* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = icmp sge i64 %7, 0
  br i1 %8, label %get.found, label %get.end

get.found:
  %9 = trunc i64 %7 to i32
  %10 = call %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* %6, i32 %9)
  br label %get.end

get.end:
  %11 = phi %struct.Map$str$$Leaf* [ %10, %get.found ], [ null, %entry ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = bitcast i8* %12 to %struct.Leaf*
  %14 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %13, i32 0, i32 0
  store i32 0, i32* %14, align 4, !tbaa !4
  %15 = call %struct.Map$str$$Leaf* @nish.Map$str$$Leaf.set(%struct.Map$str$$Leaf* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), %struct.Leaf* %13)
  br label %if.end

if.end:
  store i32 0, i32* %t.addr, align 4
  %16 = load %struct.Map$str$$Map$str$$Leaf*, %struct.Map$str$$Map$str$$Leaf** %outer.addr, align 8
  call void @nish.Map$str$$Map$str$$Leaf.walkOpen(%struct.Map$str$$Map$str$$Leaf* %16)
  %17 = call i32 @nish.Map$str$$Map$str$$Leaf.walkNext(%struct.Map$str$$Map$str$$Leaf* %16, i32 0)
  store i32 %17, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %18 = load i32, i32* %walk.idx, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %walk.body, label %walk.end

walk.body:
  %20 = call %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* %16, i32 %18)
  store %struct.Map$str$$Leaf* %20, %struct.Map$str$$Leaf** %m.addr, align 8
  %21 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %m.addr, align 8
  call void @nish.Map$str$$Leaf.walkOpen(%struct.Map$str$$Leaf* %21)
  %22 = call i32 @nish.Map$str$$Leaf.walkNext(%struct.Map$str$$Leaf* %21, i32 0)
  store i32 %22, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %23 = load i32, i32* %walk.idx.1, align 4
  %24 = icmp sge i32 %23, 0
  br i1 %24, label %walk.body.1, label %walk.end.1

walk.body.1:
  %25 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %21, i32 %23)
  store %struct.Leaf* %25, %struct.Leaf** %l.addr, align 8
  %26 = load %struct.Leaf*, %struct.Leaf** %l.addr, align 8
  %27 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %26, i32 0, i32 0
  store i32 3, i32* %27, align 4, !tbaa !4
  %28 = load i32, i32* %t.addr, align 4
  %29 = load %struct.Leaf*, %struct.Leaf** %l.addr, align 8
  %30 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4, !tbaa !4
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %33, i32* %t.addr, align 4
  br label %walk.inc.1

walk.inc.1:
  %35 = add i32 %23, 1
  %36 = call i32 @nish.Map$str$$Leaf.walkNext(%struct.Map$str$$Leaf* %21, i32 %35)
  store i32 %36, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Map$str$$Leaf.walkClose(%struct.Map$str$$Leaf* %21)
  br label %walk.inc

walk.inc:
  %37 = add i32 %18, 1
  %38 = call i32 @nish.Map$str$$Map$str$$Leaf.walkNext(%struct.Map$str$$Map$str$$Leaf* %16, i32 %37)
  store i32 %38, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$str$$Map$str$$Leaf.walkClose(%struct.Map$str$$Map$str$$Leaf* %16)
  %39 = load i32, i32* %t.addr, align 4
  ret i32 %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work6(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
entry:
  %ls.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Leaf*], align 8
  %l.addr = alloca %struct.Leaf*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Leaf*
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.Leaf*
  %5 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %8 = bitcast [2 x %struct.Leaf*]* %arr.data to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %10 = bitcast i8* %8 to %struct.Leaf**
  %11 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %10, i64 0
  store %struct.Leaf* %1, %struct.Leaf** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %12 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %10, i64 1
  store %struct.Leaf* %4, %struct.Leaf** %12, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ls.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ls.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %forof.body, label %forof.end

forof.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %20 = bitcast i8* %19 to %struct.Leaf**
  %21 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %20, i64 %14
  %22 = load %struct.Leaf*, %struct.Leaf** %21, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  store %struct.Leaf* %22, %struct.Leaf** %l.addr, align 8
  %23 = load %struct.Leaf*, %struct.Leaf** %l.addr, align 8
  %24 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %23, i32 0, i32 0
  store i32 1, i32* %24, align 4, !tbaa !4
  br label %forof.inc

forof.inc:
  %25 = load i64, i64* %forof.idx, align 8
  %26 = add i64 %25, 1
  store i64 %26, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %27 = load %struct.nish_array*, %struct.nish_array** %ls.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %30 = bitcast i8* %29 to %struct.Leaf**
  %31 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %30, i64 0
  %32 = load %struct.Leaf*, %struct.Leaf** %31, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %33 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %32, i32 0, i32 0
  %34 = load i32, i32* %33, align 4, !tbaa !4
  %35 = load %struct.nish_array*, %struct.nish_array** %ls.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %38 = bitcast i8* %37 to %struct.Leaf**
  %39 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %38, i64 1
  %40 = load %struct.Leaf*, %struct.Leaf** %39, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %41 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %40, i32 0, i32 0
  %42 = load i32, i32* %41, align 4, !tbaa !4
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %44

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @work7(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #0 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Mid*], align 8
  %m.addr = alloca %struct.Mid*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mid*
  call void @Mid.constructor(%struct.Mid* %1)
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Mid*
  call void @Mid.constructor(%struct.Mid* %3)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %6 = bitcast [2 x %struct.Mid*]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %8 = bitcast i8* %6 to %struct.Mid**
  %9 = getelementptr inbounds %struct.Mid*, %struct.Mid** %8, i64 0
  store %struct.Mid* %1, %struct.Mid** %9, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %10 = getelementptr inbounds %struct.Mid*, %struct.Mid** %8, i64 1
  store %struct.Mid* %3, %struct.Mid** %10, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %arr.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %18 = bitcast i8* %17 to %struct.Mid**
  %19 = getelementptr inbounds %struct.Mid*, %struct.Mid** %18, i64 %12
  %20 = load %struct.Mid*, %struct.Mid** %19, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  store %struct.Mid* %20, %struct.Mid** %m.addr, align 8
  %21 = load %struct.Mid*, %struct.Mid** %m.addr, align 8
  %22 = call i8* @nish_alloc_struct(i64 4)
  %23 = bitcast i8* %22 to %struct.Leaf*
  %24 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %23, i32 0, i32 0
  store i32 0, i32* %24, align 4, !tbaa !4
  %25 = getelementptr inbounds %struct.Mid, %struct.Mid* %21, i32 0, i32 0
  store %struct.Leaf* %23, %struct.Leaf** %25, align 8, !tbaa !7
  br label %forof.inc

forof.inc:
  %26 = load i64, i64* %forof.idx, align 8
  %27 = add i64 %26, 1
  store i64 %27, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %31 = bitcast i8* %30 to %struct.Mid**
  %32 = getelementptr inbounds %struct.Mid*, %struct.Mid** %31, i64 0
  %33 = load %struct.Mid*, %struct.Mid** %32, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %34 = getelementptr inbounds %struct.Mid, %struct.Mid* %33, i32 0, i32 0
  %35 = load %struct.Leaf*, %struct.Leaf** %34, align 8, !tbaa !7
  %36 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %35, i32 0, i32 0
  store i32 1, i32* %36, align 4, !tbaa !4
  %37 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %40 = bitcast i8* %39 to %struct.Mid**
  %41 = getelementptr inbounds %struct.Mid*, %struct.Mid** %40, i64 0
  %42 = load %struct.Mid*, %struct.Mid** %41, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %43 = getelementptr inbounds %struct.Mid, %struct.Mid* %42, i32 0, i32 0
  %44 = load %struct.Leaf*, %struct.Leaf** %43, align 8, !tbaa !7
  %45 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %44, i32 0, i32 0
  %46 = load i32, i32* %45, align 4, !tbaa !4
  ret i32 %46
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %r.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Holder*
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 1, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 2, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 1, i32 1, i64 0
  %6 = bitcast %struct.Item** %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  call void @Holder.constructor(%struct.Holder* %1)
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 1, i64* %10, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 1, i64* %11, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 0, i32* %15, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  store %struct.nish_array* %9, %struct.nish_array** %done.addr, align 8
  store i32 0, i32* %r.addr, align 4
  %16 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %16, %struct.ThreadScope** %s.addr, align 8
  %17 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %18 = bitcast %struct.ThreadScope* %17 to i8*
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* %19, %struct.Holder* %20, %struct.nish_array* %21, i32 0)
  %22 = load i32, i32* %r.addr, align 4
  %23 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %24 = call i32 @work1(%struct.Holder* %23)
  %25 = add nsw i32 %22, %24
  store i32 %25, i32* %r.addr, align 4
  %26 = load i32, i32* %r.addr, align 4
  %27 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %28 = call i32 @work2(%struct.Holder* %27)
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %30, i32* %r.addr, align 4
  %32 = load i32, i32* %r.addr, align 4
  %33 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %34 = call i32 @work3(%struct.Holder* %33)
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %r.addr, align 4
  %38 = load i32, i32* %r.addr, align 4
  %39 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %40 = call i32 @work4(%struct.Holder* %39)
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %42, i32* %r.addr, align 4
  %44 = load i32, i32* %r.addr, align 4
  %45 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %46 = call i32 @work5(%struct.Holder* %45)
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %48, i32* %r.addr, align 4
  %50 = load i32, i32* %r.addr, align 4
  %51 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %52 = call i32 @work6(%struct.Holder* %51)
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %52)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %54, i32* %r.addr, align 4
  %56 = load i32, i32* %r.addr, align 4
  %57 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %58 = call i32 @work7(%struct.Holder* %57)
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %60, i32* %r.addr, align 4
  call void @nish_scope_join(i8* %18)
  %62 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %65 = icmp ult i64 0, %64
  br i1 %65, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %64)
  unreachable

bounds.ok:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %68 = bitcast i8* %67 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  %70 = load i32, i32* %69, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %73 = load i32, i32* %r.addr, align 4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %72, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %77 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %78 = getelementptr inbounds %struct.Holder, %struct.Holder* %77, i32 0, i32 0
  %79 = load %struct.Leaf*, %struct.Leaf** %78, align 8, !tbaa !12
  %80 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %79, i32 0, i32 0
  %81 = load i32, i32* %80, align 4, !tbaa !4
  %82 = call i8* @nish_str_from_i32(i32 %81)
  %83 = call i8* @nish_str_concat(i8* %76, i8* %82)
  call void @nish_print(i8* %83)
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
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %16 = load i32, i32* %15, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %12 = load i32, i32* %11, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  store i32 %24, i32* %26, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %32 = load i64, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !17, !noalias !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %15 = load i32, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  store i32 0, i32* %10, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %14 = load i32, i32* %13, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %2 = load i64, i64* %1, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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

define internal void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !25
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !30
  %2 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !31
  %3 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !32
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !33
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !34
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %25 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !35
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !36
  ret void
}

define internal noundef i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !33
  %2 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !30
  %4 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !36
  %6 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
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

define internal void @nish.Map$str$$Leaf.walkOpen(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !32
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$str$$Leaf.walkNext(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Leaf.walkClose(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !32
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !35
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  %15 = load %struct.Leaf*, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Leaf* %15
}

define internal void @nish.Map$str$$Leaf.setValueAt(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !35
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  store %struct.Leaf* %value, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !32
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !34
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !35
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %41 = bitcast i8* %40 to %struct.Leaf**
  %42 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %41, i64 %35
  store %struct.Leaf* %value, %struct.Leaf** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !36
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !31
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !31
  %65 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !25
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !25
  %71 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !34
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !33
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !33
  %91 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
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

define internal void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !32
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !33
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
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
  %19 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !31
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !34
  %26 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !36
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !35
  %30 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !36
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !36
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !33
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !30
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !36
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$$Mid.constructor(%struct.Map$str$$Mid* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !38
  %1 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !39
  %2 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !40
  %3 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !41
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !42
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %19 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !43
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %25 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !44
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !45
  ret void
}

define internal noundef i64 @nish.Map$str$$Mid.probe(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !42
  %2 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !39
  %4 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !45
  %6 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !43
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Mid* @nish.Map$str$$Mid.set(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, %struct.Mid* noundef nonnull align 8 dereferenceable(8) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$$Mid.probe(%struct.Map$str$$Mid* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$$Mid.setValueAt(%struct.Map$str$$Mid* %this, i32 %4, %struct.Mid* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$$Mid.insertAt(%struct.Map$str$$Mid* %this, i64 %5, i8* %key, %struct.Mid* %value)
  br label %if.end

if.end:
  ret %struct.Map$str$$Mid* %this
}

define internal void @nish.Map$str$$Mid.walkOpen(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !41
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$str$$Mid.walkNext(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !45
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Mid.walkClose(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !41
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Mid* @nish.Map$str$$Mid.valueAt(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !44
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !44
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Mid**
  %14 = getelementptr inbounds %struct.Mid*, %struct.Mid** %13, i64 %10
  %15 = load %struct.Mid*, %struct.Mid** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Mid* %15
}

define internal void @nish.Map$str$$Mid.setValueAt(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Mid* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !44
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !44
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Mid**
  %14 = getelementptr inbounds %struct.Mid*, %struct.Mid** %13, i64 %10
  store %struct.Mid* %value, %struct.Mid** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Mid.insertAt(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %struct.Mid* noundef nonnull align 8 dereferenceable(8) %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !43
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !40
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !41
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$str$$Mid.rebuild(%struct.Map$str$$Mid* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !43
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !44
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %41 = bitcast i8* %40 to %struct.Mid**
  %42 = getelementptr inbounds %struct.Mid*, %struct.Mid** %41, i64 %35
  store %struct.Mid* %value, %struct.Mid** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !45
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !40
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !40
  %65 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !38
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !38
  %71 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !43
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !42
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$$Mid.rebuild(%struct.Map$str$$Mid* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !42
  %91 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !39
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

define internal void @nish.Map$str$$Mid.rebuild(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !43
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !41
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !42
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !40
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
  %19 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !40
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !43
  %26 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !45
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !44
  %30 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !45
  call void @nish.compactEntries$$Mid(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !45
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !42
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !39
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !45
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Set$$Leaf.constructor(%struct.Set$$Leaf* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !47
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !48
  %2 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !49
  %3 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !50
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !51
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !52
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %25 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !53
  ret void
}

define internal noundef i64 @nish.Set$$Leaf.probe(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !51
  %2 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !48
  %4 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !53
  %6 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !52
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

define internal void @nish.Set$$Leaf.walkOpen(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !50
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !50
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Set$$Leaf.walkNext(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !53
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$$Leaf.walkClose(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !50
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !50
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @nish.Set$$Leaf.keyAt(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !52
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.7 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !52
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  %15 = load %struct.Leaf*, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Leaf* %15
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
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !52
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !49
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %16 = load i32, i32* %15, align 4, !tbaa !50
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.8 to i8*))
  unreachable

if.end.1:
  call void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !52
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %28 = bitcast i8* %27 to %struct.Leaf**
  %29 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %28, i64 %22
  store %struct.Leaf* %key, %struct.Leaf** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !53
  %34 = load i32, i32* %h.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %34, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %47 = load i32, i32* %46, align 4, !tbaa !49
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  %51 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 %49, i32* %51, align 4, !tbaa !49
  %52 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !47
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %57 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 %55, i32* %57, align 4, !tbaa !47
  %58 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %59 = load %struct.nish_array*, %struct.nish_array** %58, align 8, !tbaa !52
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %62 = trunc i64 %61 to i32
  store i32 %62, i32* %used.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %67 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !51
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !16, !noalias !17, !tbaa !23
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
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !51
  %78 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
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

define internal void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !52
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !50
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !51
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
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
  %19 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !49
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !52
  %26 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !53
  call void @nish.compactEntries$$Leaf(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !53
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !51
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !48
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !53
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
  ret void
}

define internal void @nish.Map$str$$Map$str$$Leaf.constructor(%struct.Map$str$$Map$str$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !55
  %1 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !56
  %2 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !57
  %3 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !58
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !17, !noalias !16
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !59
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %19 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !60
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %25 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !61
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !62
  ret void
}

define internal noundef i64 @nish.Map$str$$Map$str$$Leaf.probe(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !59
  %2 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !56
  %4 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !62
  %6 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !60
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.set(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, %struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$$Map$str$$Leaf.probe(%struct.Map$str$$Map$str$$Leaf* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$$Map$str$$Leaf.setValueAt(%struct.Map$str$$Map$str$$Leaf* %this, i32 %4, %struct.Map$str$$Leaf* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$$Map$str$$Leaf.insertAt(%struct.Map$str$$Map$str$$Leaf* %this, i64 %5, i8* %key, %struct.Map$str$$Leaf* %value)
  br label %if.end

if.end:
  ret %struct.Map$str$$Map$str$$Leaf* %this
}

define internal void @nish.Map$str$$Map$str$$Leaf.walkOpen(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !58
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !58
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$str$$Map$str$$Leaf.walkNext(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !62
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Map$str$$Leaf.walkClose(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !58
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !58
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !61
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !61
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Map$str$$Leaf**
  %14 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %13, i64 %10
  %15 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Map$str$$Leaf* %15
}

define internal void @nish.Map$str$$Map$str$$Leaf.setValueAt(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !61
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !61
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Map$str$$Leaf**
  %14 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %13, i64 %10
  store %struct.Map$str$$Leaf* %value, %struct.Map$str$$Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Map$str$$Leaf.insertAt(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %value) #1 {
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
  %6 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !60
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !57
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !58
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$str$$Map$str$$Leaf.rebuild(%struct.Map$str$$Map$str$$Leaf* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !60
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !61
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %41 = bitcast i8* %40 to %struct.Map$str$$Leaf**
  %42 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %41, i64 %35
  store %struct.Map$str$$Leaf* %value, %struct.Map$str$$Leaf** %42, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !62
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !57
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !57
  %65 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !55
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !55
  %71 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !60
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !59
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$$Map$str$$Leaf.rebuild(%struct.Map$str$$Map$str$$Leaf* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !59
  %91 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !56
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

define internal void @nish.Map$str$$Map$str$$Leaf.rebuild(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !60
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !58
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !59
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !57
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
  %19 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !57
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !60
  %26 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !62
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !61
  %30 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !62
  call void @nish.compactEntries$$Map$str$$Leaf(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !62
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !59
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !56
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !62
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
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
  %20 = load i64, i64* %19, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %41 = load i32, i32* %40, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %66 = load i32, i32* %65, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %78 = load i8*, i8** %77, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.9 to i8*))
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
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %41 = load i8*, i8** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %41 = load %struct.Leaf*, %struct.Leaf** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %42 = bitcast i8* %10 to %struct.Leaf**
  %43 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %42, i64 %36
  store %struct.Leaf* %41, %struct.Leaf** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %59 = bitcast i8* %58 to %struct.Leaf**
  %60 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %59, i64 %56
  %61 = load %struct.Leaf*, %struct.Leaf** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$$Mid(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %39 = bitcast i8* %10 to %struct.Mid**
  %40 = getelementptr inbounds %struct.Mid*, %struct.Mid** %39, i64 %38
  %41 = load %struct.Mid*, %struct.Mid** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %42 = bitcast i8* %10 to %struct.Mid**
  %43 = getelementptr inbounds %struct.Mid*, %struct.Mid** %42, i64 %36
  store %struct.Mid* %41, %struct.Mid** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %59 = bitcast i8* %58 to %struct.Mid**
  %60 = getelementptr inbounds %struct.Mid*, %struct.Mid** %59, i64 %56
  %61 = load %struct.Mid*, %struct.Mid** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %20 = load i64, i64* %19, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %41 = load i32, i32* %40, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %66 = load i32, i32* %65, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %78 = load %struct.Leaf*, %struct.Leaf** %77, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.9 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$$Map$str$$Leaf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !16, !noalias !17, !tbaa !27
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
  %22 = load i32, i32* %21, align 4, !alias.scope !17, !noalias !16, !tbaa !29
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
  %39 = bitcast i8* %10 to %struct.Map$str$$Leaf**
  %40 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %39, i64 %38
  %41 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %40, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %42 = bitcast i8* %10 to %struct.Map$str$$Leaf**
  %43 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %42, i64 %36
  store %struct.Map$str$$Leaf* %41, %struct.Map$str$$Leaf** %43, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  %49 = load i64, i64* %48, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %59 = bitcast i8* %58 to %struct.Map$str$$Leaf**
  %60 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %59, i64 %56
  %61 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %60, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!11 = !{!"Holder", !5, i64 0}
!12 = !{!11, !5, i64 0}
!13 = !{!"nish array"}
!14 = !{!"header", !13}
!15 = !{!"elements", !13}
!16 = !{!14}
!17 = !{!15}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!"header i64", !1, i64 0}
!21 = !{!"header ptr", !1, i64 0}
!22 = !{!"array header", !20, i64 0, !20, i64 8, !21, i64 16}
!23 = !{!22, !20, i64 0}
!24 = !{!"Map$str$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!25 = !{!24, !2, i64 0}
!26 = !{!22, !20, i64 8}
!27 = !{!22, !21, i64 16}
!28 = !{!"element i32", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!24, !2, i64 16}
!31 = !{!24, !2, i64 20}
!32 = !{!24, !2, i64 48}
!33 = !{!24, !5, i64 8}
!34 = !{!24, !5, i64 24}
!35 = !{!24, !5, i64 32}
!36 = !{!24, !5, i64 40}
!37 = !{!"Map$str$$Mid", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!38 = !{!37, !2, i64 0}
!39 = !{!37, !2, i64 16}
!40 = !{!37, !2, i64 20}
!41 = !{!37, !2, i64 48}
!42 = !{!37, !5, i64 8}
!43 = !{!37, !5, i64 24}
!44 = !{!37, !5, i64 32}
!45 = !{!37, !5, i64 40}
!46 = !{!"Set$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !2, i64 40}
!47 = !{!46, !2, i64 0}
!48 = !{!46, !2, i64 16}
!49 = !{!46, !2, i64 20}
!50 = !{!46, !2, i64 40}
!51 = !{!46, !5, i64 8}
!52 = !{!46, !5, i64 24}
!53 = !{!46, !5, i64 32}
!54 = !{!"Map$str$$Map$str$$Leaf", !2, i64 0, !5, i64 8, !2, i64 16, !2, i64 20, !5, i64 24, !5, i64 32, !5, i64 40, !2, i64 48}
!55 = !{!54, !2, i64 0}
!56 = !{!54, !2, i64 16}
!57 = !{!54, !2, i64 20}
!58 = !{!54, !2, i64 48}
!59 = !{!54, !5, i64 8}
!60 = !{!54, !5, i64 24}
!61 = !{!54, !5, i64 32}
!62 = !{!54, !5, i64 40}
