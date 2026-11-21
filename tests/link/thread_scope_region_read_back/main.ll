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
@nish_hash_key = external global [2 x i64], align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.hash.seed, i8* null }]
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Holder* noundef nonnull align 8 dereferenceable(48), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #7
declare void @nish_panic_index(i64 noundef, i64 noundef) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare void @nish_scope_join(i8* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal void @nish.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*))
  unreachable
mark:
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

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

define hidden noundef i32 @read$(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %h) #1 {
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
  %11 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %7, i32 %10, %struct.Leaf* zeroinitializer)
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
  %9 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %2, i32 %8, %struct.Leaf* zeroinitializer)
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
  %16 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %12, i32 %15, %struct.Leaf* zeroinitializer)
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
  %14 = call %struct.Mid* @nish.Map$str$$Mid.valueAt(%struct.Map$str$$Mid* %10, i32 %12, %struct.Mid* zeroinitializer)
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
  %16 = call %struct.Leaf* @nish.Set$$Leaf.keyAt(%struct.Set$$Leaf* %12, i32 %14, %struct.Leaf* zeroinitializer)
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
  %10 = call %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* %6, i32 %9, %struct.Map$str$$Leaf* zeroinitializer)
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
  %20 = call %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* %16, i32 %18, %struct.Map$str$$Leaf* zeroinitializer)
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
  %25 = call %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* %21, i32 %23, %struct.Leaf* zeroinitializer)
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
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
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %b.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %b.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %6 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add i32 %24, 1
  %26 = load i32, i32* %low.addr, align 4
  %27 = and i32 %25, %26
  store i32 %27, i32* %bucket.addr, align 4
  %28 = load i32, i32* %bucket.addr, align 4
  store i32 %28, i32* %b.addr, align 4
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
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %38 = trunc i64 %37 to i32
  %39 = icmp sgt i32 %38, 0
  br label %land.end.2

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %43 = sub i64 %42, 1
  store i64 %43, i64* %41, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  %48 = load i32, i32* %47, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %9, 32768
  br label %land.end

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = mul nsw i32 %12, 2
  %14 = trunc i32 %13 to i16
  %15 = zext i16 %14 to i64
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %15, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %15, i64* %19, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %20 = mul i64 %15, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !17, !noalias !16
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  ret %struct.nish_array* %17

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #0 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %times
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 0, i32* %16, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %18 = trunc i64 %17 to i32
  br label %for.inc.1

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
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

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %size.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = mul nsw i64 %7, 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = mul nsw i64 %10, 3
  %12 = icmp sgt i64 %8, %11
  br i1 %12, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4
  %16 = icmp sge i32 %bucket, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %18 = load i32, i32* %used.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = sext i32 %bucket to i64
  %21 = load i32, i32* %used.addr, align 4
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %23
  %28 = load i32, i32* %27, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %29 = load i32, i32* %used.addr, align 4
  %30 = sub nsw i32 %29, 1
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %20
  store i32 %31, i32* %35, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$str$$Leaf.constructor(%struct.Map$str$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !25
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !30
  %2 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !31
  %3 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !32
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !17, !noalias !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %11 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !33
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %17 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !34
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !35
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %29 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !36
  ret void
}

define internal noundef i64 @nish.Map$str$$Leaf.probe(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 {
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

define internal void @nish.Map$str$$Leaf.walkOpen(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef i32 @nish.Map$str$$Leaf.walkNext(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Leaf.walkClose(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @nish.Map$str$$Leaf.valueAt(%struct.Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %none) #4 {
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
  %15 = load %struct.Leaf*, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Leaf* %15

if.end:
  ret %struct.Leaf* %none
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
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !34
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  store i8* %key, i8** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !35
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = bitcast i8* %22 to %struct.Leaf**
  %24 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %23, i64 %17
  store %struct.Leaf* %value, %struct.Leaf** %24, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !36
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = trunc i64 %40 to i32
  call void @nish.Map$str$$Leaf.addOne(%struct.Map$str$$Leaf* %this)
  %42 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !33
  %44 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !30
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !36
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$str$$Leaf.rebuild(%struct.Map$str$$Leaf* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Leaf.addOne(%struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !31
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !31
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !25
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$str$$Leaf, %struct.Map$str$$Leaf* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !25
  br label %if.end.1

if.end.1:
  ret void
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
  %7 = icmp ugt i32 %6, 0
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

define internal void @nish.Map$str$$Mid.constructor(%struct.Map$str$$Mid* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !38
  %1 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !39
  %2 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !40
  %3 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !41
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !17, !noalias !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %11 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !42
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %17 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !43
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !44
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %29 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !45
  ret void
}

define internal noundef i64 @nish.Map$str$$Mid.probe(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 {
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

define internal void @nish.Map$str$$Mid.walkOpen(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !41
  ret void
}

define internal noundef i32 @nish.Map$str$$Mid.walkNext(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !45
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Mid.walkClose(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !41
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Mid* @nish.Map$str$$Mid.valueAt(%struct.Map$str$$Mid* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Mid* noundef nonnull align 8 dereferenceable(8) %none) #4 {
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
  %15 = load %struct.Mid*, %struct.Mid** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Mid* %15

if.end:
  ret %struct.Mid* %none
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
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !43
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  store i8* %key, i8** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !44
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = bitcast i8* %22 to %struct.Mid**
  %24 = getelementptr inbounds %struct.Mid*, %struct.Mid** %23, i64 %17
  store %struct.Mid* %value, %struct.Mid** %24, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !45
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = trunc i64 %40 to i32
  call void @nish.Map$str$$Mid.addOne(%struct.Map$str$$Mid* %this)
  %42 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !42
  %44 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !39
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !45
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$str$$Mid.rebuild(%struct.Map$str$$Mid* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Mid.addOne(%struct.Map$str$$Mid* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !40
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !40
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !38
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$str$$Mid, %struct.Map$str$$Mid* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !38
  br label %if.end.1

if.end.1:
  ret void
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
  %7 = icmp ugt i32 %6, 0
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

define internal void @nish.Set$$Leaf.constructor(%struct.Set$$Leaf* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !47
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !48
  %2 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !49
  %3 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !50
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !17, !noalias !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %11 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !51
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %17 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !52
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !53
  ret void
}

define internal noundef i64 @nish.Set$$Leaf.probe(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #3 {
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

define internal void @nish.Set$$Leaf.walkOpen(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !50
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !50
  ret void
}

define internal noundef i32 @nish.Set$$Leaf.walkNext(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !53
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$$Leaf.walkClose(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !50
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !50
  ret void
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @nish.Set$$Leaf.keyAt(%struct.Set$$Leaf* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !52
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !52
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %13 = bitcast i8* %12 to %struct.Leaf**
  %14 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %13, i64 %10
  %15 = load %struct.Leaf*, %struct.Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Leaf* %15

if.end:
  ret %struct.Leaf* %none
}

define internal void @nish.Set$$Leaf.insertAt(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %key) #1 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !52
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %10 = bitcast i8* %9 to %struct.Leaf**
  %11 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %10, i64 %4
  store %struct.Leaf* %key, %struct.Leaf** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !53
  %16 = load i64, i64* %packed.addr, align 8
  %17 = trunc i64 %16 to i32
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store.1

push.store.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  store i32 %17, i32* %26, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = trunc i64 %27 to i32
  call void @nish.Set$$Leaf.addOne(%struct.Set$$Leaf* %this)
  %29 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 1
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !51
  %31 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 2
  %32 = load i32, i32* %31, align 4, !tbaa !48
  %33 = load i64, i64* %packed.addr, align 8
  %34 = ashr i64 %33, 32
  %35 = trunc i64 %34 to i32
  %36 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 5
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !53
  %38 = call i1 @nish.fileAppended(%struct.nish_array* %30, i32 %32, i32 %35, %struct.nish_array* %37)
  %39 = xor i1 %38, true
  br i1 %39, label %if.then, label %if.end

if.then:
  call void @nish.Set$$Leaf.rebuild(%struct.Set$$Leaf* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Set$$Leaf.addOne(%struct.Set$$Leaf* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !49
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !49
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !47
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Set$$Leaf, %struct.Set$$Leaf* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !47
  br label %if.end.1

if.end.1:
  ret void
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
  %7 = icmp ugt i32 %6, 0
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

define internal void @nish.Map$str$$Map$str$$Leaf.constructor(%struct.Map$str$$Map$str$$Leaf* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !55
  %1 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !56
  %2 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !57
  %3 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !58
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !17, !noalias !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %11 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !59
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %17 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !60
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !61
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %29 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !62
  ret void
}

define internal noundef i64 @nish.Map$str$$Map$str$$Leaf.probe(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 {
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

define internal void @nish.Map$str$$Map$str$$Leaf.walkOpen(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !58
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !58
  ret void
}

define internal noundef i32 @nish.Map$str$$Map$str$$Leaf.walkNext(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !62
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$$Map$str$$Leaf.walkClose(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !58
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !58
  ret void
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Leaf* @nish.Map$str$$Map$str$$Leaf.valueAt(%struct.Map$str$$Map$str$$Leaf* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) %none) #4 {
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
  %15 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %14, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  ret %struct.Map$str$$Leaf* %15

if.end:
  ret %struct.Map$str$$Leaf* %none
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
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !60
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  store i8* %key, i8** %11, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !61
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %23 = bitcast i8* %22 to %struct.Map$str$$Leaf**
  %24 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %23, i64 %17
  store %struct.Map$str$$Leaf* %value, %struct.Map$str$$Leaf** %24, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !62
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !16, !noalias !17, !tbaa !26
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %41 = trunc i64 %40 to i32
  call void @nish.Map$str$$Map$str$$Leaf.addOne(%struct.Map$str$$Map$str$$Leaf* %this)
  %42 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !59
  %44 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !56
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !62
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$str$$Map$str$$Leaf.rebuild(%struct.Map$str$$Map$str$$Leaf* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Map$str$$Leaf.addOne(%struct.Map$str$$Map$str$$Leaf* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !57
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !57
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !55
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$str$$Map$str$$Leaf, %struct.Map$str$$Map$str$$Leaf* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !55
  br label %if.end.1

if.end.1:
  ret void
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
  %7 = icmp ugt i32 %6, 0
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

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.v0 = alloca i64, align 8
  %hash.v1 = alloca i64, align 8
  %hash.v2 = alloca i64, align 8
  %hash.v3 = alloca i64, align 8
  %hash.b = alloca i64, align 8
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  %3 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %4 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 1), align 8
  %5 = xor i64 %3, 8317987319222330741
  store i64 %5, i64* %hash.v0, align 8
  %6 = xor i64 %4, 7237128888997146477
  store i64 %6, i64* %hash.v1, align 8
  %7 = xor i64 %3, 7816392313619706465
  store i64 %7, i64* %hash.v2, align 8
  %8 = xor i64 %4, 8387220255154660723
  store i64 %8, i64* %hash.v3, align 8
  %9 = and i64 %1, -8
  store i64 0, i64* %hash.i, align 8
  br label %hash.test

hash.test:
  %10 = load i64, i64* %hash.i, align 8
  %11 = icmp ult i64 %10, %9
  br i1 %11, label %hash.word, label %hash.tail

hash.word:
  %12 = getelementptr inbounds i8, i8* %2, i64 %10
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 1
  %15 = load i64, i64* %hash.v3, align 8
  %16 = xor i64 %15, %14
  store i64 %16, i64* %hash.v3, align 8
  %17 = load i64, i64* %hash.v0, align 8
  %18 = load i64, i64* %hash.v1, align 8
  %19 = load i64, i64* %hash.v2, align 8
  %20 = load i64, i64* %hash.v3, align 8
  %21 = add i64 %17, %18
  %22 = shl i64 %18, 13
  %23 = lshr i64 %18, 51
  %24 = or i64 %22, %23
  %25 = xor i64 %24, %21
  %26 = shl i64 %21, 32
  %27 = lshr i64 %21, 32
  %28 = or i64 %26, %27
  %29 = add i64 %19, %20
  %30 = shl i64 %20, 16
  %31 = lshr i64 %20, 48
  %32 = or i64 %30, %31
  %33 = xor i64 %32, %29
  %34 = add i64 %28, %33
  %35 = shl i64 %33, 21
  %36 = lshr i64 %33, 43
  %37 = or i64 %35, %36
  %38 = xor i64 %37, %34
  %39 = add i64 %29, %25
  %40 = shl i64 %25, 17
  %41 = lshr i64 %25, 47
  %42 = or i64 %40, %41
  %43 = xor i64 %42, %39
  %44 = shl i64 %39, 32
  %45 = lshr i64 %39, 32
  %46 = or i64 %44, %45
  store i64 %34, i64* %hash.v0, align 8
  store i64 %43, i64* %hash.v1, align 8
  store i64 %46, i64* %hash.v2, align 8
  store i64 %38, i64* %hash.v3, align 8
  %47 = xor i64 %34, %14
  store i64 %47, i64* %hash.v0, align 8
  %48 = add i64 %10, 8
  store i64 %48, i64* %hash.i, align 8
  br label %hash.test

hash.tail:
  %49 = shl i64 %1, 56
  store i64 %49, i64* %hash.b, align 8
  br label %hash.more

hash.more:
  %50 = load i64, i64* %hash.i, align 8
  %51 = icmp ult i64 %50, %1
  br i1 %51, label %hash.byte, label %hash.done

hash.byte:
  %52 = getelementptr inbounds i8, i8* %2, i64 %50
  %53 = load i8, i8* %52
  %54 = zext i8 %53 to i64
  %55 = sub i64 %50, %9
  %56 = shl i64 %55, 3
  %57 = load i64, i64* %hash.b, align 8
  %58 = shl i64 %54, %56
  %59 = or i64 %57, %58
  store i64 %59, i64* %hash.b, align 8
  %60 = add i64 %50, 1
  store i64 %60, i64* %hash.i, align 8
  br label %hash.more

hash.done:
  %61 = load i64, i64* %hash.b, align 8
  %62 = load i64, i64* %hash.v3, align 8
  %63 = xor i64 %62, %61
  store i64 %63, i64* %hash.v3, align 8
  %64 = load i64, i64* %hash.v0, align 8
  %65 = load i64, i64* %hash.v1, align 8
  %66 = load i64, i64* %hash.v2, align 8
  %67 = load i64, i64* %hash.v3, align 8
  %68 = add i64 %64, %65
  %69 = shl i64 %65, 13
  %70 = lshr i64 %65, 51
  %71 = or i64 %69, %70
  %72 = xor i64 %71, %68
  %73 = shl i64 %68, 32
  %74 = lshr i64 %68, 32
  %75 = or i64 %73, %74
  %76 = add i64 %66, %67
  %77 = shl i64 %67, 16
  %78 = lshr i64 %67, 48
  %79 = or i64 %77, %78
  %80 = xor i64 %79, %76
  %81 = add i64 %75, %80
  %82 = shl i64 %80, 21
  %83 = lshr i64 %80, 43
  %84 = or i64 %82, %83
  %85 = xor i64 %84, %81
  %86 = add i64 %76, %72
  %87 = shl i64 %72, 17
  %88 = lshr i64 %72, 47
  %89 = or i64 %87, %88
  %90 = xor i64 %89, %86
  %91 = shl i64 %86, 32
  %92 = lshr i64 %86, 32
  %93 = or i64 %91, %92
  store i64 %81, i64* %hash.v0, align 8
  store i64 %90, i64* %hash.v1, align 8
  store i64 %93, i64* %hash.v2, align 8
  store i64 %85, i64* %hash.v3, align 8
  %94 = xor i64 %81, %61
  store i64 %94, i64* %hash.v0, align 8
  %95 = load i64, i64* %hash.v2, align 8
  %96 = xor i64 %95, 255
  store i64 %96, i64* %hash.v2, align 8
  %97 = load i64, i64* %hash.v0, align 8
  %98 = load i64, i64* %hash.v1, align 8
  %99 = load i64, i64* %hash.v2, align 8
  %100 = load i64, i64* %hash.v3, align 8
  %101 = add i64 %97, %98
  %102 = shl i64 %98, 13
  %103 = lshr i64 %98, 51
  %104 = or i64 %102, %103
  %105 = xor i64 %104, %101
  %106 = shl i64 %101, 32
  %107 = lshr i64 %101, 32
  %108 = or i64 %106, %107
  %109 = add i64 %99, %100
  %110 = shl i64 %100, 16
  %111 = lshr i64 %100, 48
  %112 = or i64 %110, %111
  %113 = xor i64 %112, %109
  %114 = add i64 %108, %113
  %115 = shl i64 %113, 21
  %116 = lshr i64 %113, 43
  %117 = or i64 %115, %116
  %118 = xor i64 %117, %114
  %119 = add i64 %109, %105
  %120 = shl i64 %105, 17
  %121 = lshr i64 %105, 47
  %122 = or i64 %120, %121
  %123 = xor i64 %122, %119
  %124 = shl i64 %119, 32
  %125 = lshr i64 %119, 32
  %126 = or i64 %124, %125
  %127 = add i64 %114, %123
  %128 = shl i64 %123, 13
  %129 = lshr i64 %123, 51
  %130 = or i64 %128, %129
  %131 = xor i64 %130, %127
  %132 = shl i64 %127, 32
  %133 = lshr i64 %127, 32
  %134 = or i64 %132, %133
  %135 = add i64 %126, %118
  %136 = shl i64 %118, 16
  %137 = lshr i64 %118, 48
  %138 = or i64 %136, %137
  %139 = xor i64 %138, %135
  %140 = add i64 %134, %139
  %141 = shl i64 %139, 21
  %142 = lshr i64 %139, 43
  %143 = or i64 %141, %142
  %144 = xor i64 %143, %140
  %145 = add i64 %135, %131
  %146 = shl i64 %131, 17
  %147 = lshr i64 %131, 47
  %148 = or i64 %146, %147
  %149 = xor i64 %148, %145
  %150 = shl i64 %145, 32
  %151 = lshr i64 %145, 32
  %152 = or i64 %150, %151
  %153 = add i64 %140, %149
  %154 = shl i64 %149, 13
  %155 = lshr i64 %149, 51
  %156 = or i64 %154, %155
  %157 = xor i64 %156, %153
  %158 = shl i64 %153, 32
  %159 = lshr i64 %153, 32
  %160 = or i64 %158, %159
  %161 = add i64 %152, %144
  %162 = shl i64 %144, 16
  %163 = lshr i64 %144, 48
  %164 = or i64 %162, %163
  %165 = xor i64 %164, %161
  %166 = add i64 %160, %165
  %167 = shl i64 %165, 21
  %168 = lshr i64 %165, 43
  %169 = or i64 %167, %168
  %170 = xor i64 %169, %166
  %171 = add i64 %161, %157
  %172 = shl i64 %157, 17
  %173 = lshr i64 %157, 47
  %174 = or i64 %172, %173
  %175 = xor i64 %174, %171
  %176 = shl i64 %171, 32
  %177 = lshr i64 %171, 32
  %178 = or i64 %176, %177
  store i64 %166, i64* %hash.v0, align 8
  store i64 %175, i64* %hash.v1, align 8
  store i64 %178, i64* %hash.v2, align 8
  store i64 %170, i64* %hash.v3, align 8
  %179 = xor i64 %166, %175
  %180 = xor i64 %178, %170
  %181 = xor i64 %179, %180
  %182 = trunc i64 %181 to i32
  %183 = lshr i64 %181, 32
  %184 = trunc i64 %183 to i32
  %185 = xor i32 %182, %184
  %186 = icmp eq i32 %185, 0
  %187 = select i1 %186, i32 1, i32 %185
  store i32 %187, i32* %h.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %188 = load i32, i32* %h.addr, align 4
  %189 = load i32, i32* %low.addr, align 4
  %190 = xor i32 %189, -1
  %191 = and i32 %188, %190
  store i32 %191, i32* %fingerprint.addr, align 4
  %192 = load i32, i32* %h.addr, align 4
  %193 = call i32 @nish.homeBucket(i32 %192, i32 %mask)
  store i32 %193, i32* %bucket.addr, align 4
  %194 = load i32, i32* %bucket.addr, align 4
  store i32 %194, i32* %b.addr, align 4
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %200 = load i64, i64* %199, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %202 = load i8*, i8** %201, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %204 = load i64, i64* %203, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  br label %while.cond

while.cond:
  %207 = load i32, i32* %b.addr, align 4
  %208 = icmp sge i32 %207, 0
  br i1 %208, label %land.rhs, label %land.end

land.rhs:
  %209 = load i32, i32* %b.addr, align 4
  %210 = trunc i64 %196 to i32
  %211 = icmp slt i32 %209, %210
  br label %land.end

land.end:
  %212 = phi i1 [ false, %while.cond ], [ %211, %land.rhs ]
  br i1 %212, label %while.body, label %while.end

while.body:
  %213 = load i32, i32* %b.addr, align 4
  %214 = sext i32 %213 to i64
  %215 = bitcast i8* %198 to i32*
  %216 = getelementptr inbounds i32, i32* %215, i64 %214
  %217 = load i32, i32* %216, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  store i32 %217, i32* %word.addr, align 4
  %218 = load i32, i32* %word.addr, align 4
  %219 = icmp eq i32 %218, 0
  br i1 %219, label %if.then, label %if.end

if.then:
  %220 = load i32, i32* %b.addr, align 4
  %221 = load i32, i32* %h.addr, align 4
  %222 = tail call i64 @nish.absentAt(i32 %220, i32 %221)
  ret i64 %222

if.end:
  %223 = load i32, i32* %word.addr, align 4
  %224 = load i32, i32* %low.addr, align 4
  %225 = xor i32 %224, -1
  %226 = and i32 %223, %225
  %227 = load i32, i32* %fingerprint.addr, align 4
  %228 = icmp eq i32 %226, %227
  br i1 %228, label %if.then.1, label %if.end.1

if.then.1:
  %229 = load i32, i32* %word.addr, align 4
  %230 = load i32, i32* %low.addr, align 4
  %231 = and i32 %229, %230
  %232 = sub i32 %231, 1
  store i32 %232, i32* %at.addr, align 4
  %233 = load i32, i32* %at.addr, align 4
  %234 = icmp sge i32 %233, 0
  br i1 %234, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %235 = load i32, i32* %at.addr, align 4
  %236 = trunc i64 %200 to i32
  %237 = icmp slt i32 %235, %236
  br label %land.end.4

land.end.4:
  %238 = phi i1 [ false, %if.then.1 ], [ %237, %land.rhs.4 ]
  br i1 %238, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %239 = load i32, i32* %at.addr, align 4
  %240 = sext i32 %239 to i64
  %241 = bitcast i8* %202 to i32*
  %242 = getelementptr inbounds i32, i32* %241, i64 %240
  %243 = load i32, i32* %242, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %244 = load i32, i32* %h.addr, align 4
  %245 = icmp eq i32 %243, %244
  br label %land.end.3

land.end.3:
  %246 = phi i1 [ false, %land.end.4 ], [ %245, %land.rhs.3 ]
  br i1 %246, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %247 = load i32, i32* %at.addr, align 4
  %248 = trunc i64 %204 to i32
  %249 = icmp slt i32 %247, %248
  br label %land.end.2

land.end.2:
  %250 = phi i1 [ false, %land.end.3 ], [ %249, %land.rhs.2 ]
  br i1 %250, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %251 = load i32, i32* %at.addr, align 4
  %252 = sext i32 %251 to i64
  %253 = bitcast i8* %206 to i8**
  %254 = getelementptr inbounds i8*, i8** %253, i64 %252
  %255 = load i8*, i8** %254, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %256 = call zeroext i1 @nish_str_eq(i8* %255, i8* %key)
  br label %land.end.1

land.end.1:
  %257 = phi i1 [ false, %land.end.2 ], [ %256, %land.rhs.1 ]
  br i1 %257, label %if.then.2, label %if.end.2

if.then.2:
  %258 = load i32, i32* %b.addr, align 4
  %259 = load i32, i32* %at.addr, align 4
  %260 = tail call i64 @nish.foundAt(i32 %258, i32 %259)
  ret i64 %260

if.end.2:
  br label %if.end.1

if.end.1:
  %261 = load i32, i32* %bucket.addr, align 4
  %262 = add i32 %261, 1
  %263 = load i32, i32* %low.addr, align 4
  %264 = and i32 %262, %263
  store i32 %264, i32* %bucket.addr, align 4
  %265 = load i32, i32* %bucket.addr, align 4
  store i32 %265, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %267 = load i64, i64* %266, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %268 = trunc i64 %267 to i32
  %269 = load i32, i32* %h.addr, align 4
  %270 = tail call i64 @nish.absentAt(i32 %268, i32 %269)
  ret i64 %270
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %63 = bitcast i8* %62 to %struct.Leaf**
  %64 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %63, i64 %60
  %65 = load %struct.Leaf*, %struct.Leaf** %64, align 8, !alias.scope !17, !noalias !16, !tbaa !19
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %63 = bitcast i8* %62 to %struct.Mid**
  %64 = getelementptr inbounds %struct.Mid*, %struct.Mid** %63, i64 %60
  %65 = load %struct.Mid*, %struct.Mid** %64, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %while.cond

while.end:
  ret void
}

define internal noundef i64 @nish.probeTable$$Leaf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, %struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
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
  store i32 %mask, i32* %low.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = load i32, i32* %low.addr, align 4
  %17 = xor i32 %16, -1
  %18 = and i32 %15, %17
  store i32 %18, i32* %fingerprint.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = call i32 @nish.homeBucket(i32 %19, i32 %mask)
  store i32 %20, i32* %bucket.addr, align 4
  %21 = load i32, i32* %bucket.addr, align 4
  store i32 %21, i32* %b.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  br label %while.cond

while.cond:
  %34 = load i32, i32* %b.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs, label %land.end

land.rhs:
  %36 = load i32, i32* %b.addr, align 4
  %37 = trunc i64 %23 to i32
  %38 = icmp slt i32 %36, %37
  br label %land.end

land.end:
  %39 = phi i1 [ false, %while.cond ], [ %38, %land.rhs ]
  br i1 %39, label %while.body, label %while.end

while.body:
  %40 = load i32, i32* %b.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %25 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  store i32 %44, i32* %word.addr, align 4
  %45 = load i32, i32* %word.addr, align 4
  %46 = icmp eq i32 %45, 0
  br i1 %46, label %if.then, label %if.end

if.then:
  %47 = load i32, i32* %b.addr, align 4
  %48 = load i32, i32* %h.addr, align 4
  %49 = tail call i64 @nish.absentAt(i32 %47, i32 %48)
  ret i64 %49

if.end:
  %50 = load i32, i32* %word.addr, align 4
  %51 = load i32, i32* %low.addr, align 4
  %52 = xor i32 %51, -1
  %53 = and i32 %50, %52
  %54 = load i32, i32* %fingerprint.addr, align 4
  %55 = icmp eq i32 %53, %54
  br i1 %55, label %if.then.1, label %if.end.1

if.then.1:
  %56 = load i32, i32* %word.addr, align 4
  %57 = load i32, i32* %low.addr, align 4
  %58 = and i32 %56, %57
  %59 = sub i32 %58, 1
  store i32 %59, i32* %at.addr, align 4
  %60 = load i32, i32* %at.addr, align 4
  %61 = icmp sge i32 %60, 0
  br i1 %61, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %62 = load i32, i32* %at.addr, align 4
  %63 = trunc i64 %27 to i32
  %64 = icmp slt i32 %62, %63
  br label %land.end.4

land.end.4:
  %65 = phi i1 [ false, %if.then.1 ], [ %64, %land.rhs.4 ]
  br i1 %65, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %66 = load i32, i32* %at.addr, align 4
  %67 = sext i32 %66 to i64
  %68 = bitcast i8* %29 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 %67
  %70 = load i32, i32* %69, align 4, !alias.scope !17, !noalias !16, !tbaa !29
  %71 = load i32, i32* %h.addr, align 4
  %72 = icmp eq i32 %70, %71
  br label %land.end.3

land.end.3:
  %73 = phi i1 [ false, %land.end.4 ], [ %72, %land.rhs.3 ]
  br i1 %73, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %74 = load i32, i32* %at.addr, align 4
  %75 = trunc i64 %31 to i32
  %76 = icmp slt i32 %74, %75
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %land.end.3 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %78 = load i32, i32* %at.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = bitcast i8* %33 to %struct.Leaf**
  %81 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %80, i64 %79
  %82 = load %struct.Leaf*, %struct.Leaf** %81, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  %83 = icmp eq %struct.Leaf* %82, %key
  br label %land.end.1

land.end.1:
  %84 = phi i1 [ false, %land.end.2 ], [ %83, %land.rhs.1 ]
  br i1 %84, label %if.then.2, label %if.end.2

if.then.2:
  %85 = load i32, i32* %b.addr, align 4
  %86 = load i32, i32* %at.addr, align 4
  %87 = tail call i64 @nish.foundAt(i32 %85, i32 %86)
  ret i64 %87

if.end.2:
  br label %if.end.1

if.end.1:
  %88 = load i32, i32* %bucket.addr, align 4
  %89 = add i32 %88, 1
  %90 = load i32, i32* %low.addr, align 4
  %91 = and i32 %89, %90
  store i32 %91, i32* %bucket.addr, align 4
  %92 = load i32, i32* %bucket.addr, align 4
  store i32 %92, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %95 = trunc i64 %94 to i32
  %96 = load i32, i32* %h.addr, align 4
  %97 = tail call i64 @nish.absentAt(i32 %95, i32 %96)
  ret i64 %97
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !16, !noalias !17, !tbaa !23
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !16, !noalias !17, !tbaa !27
  %63 = bitcast i8* %62 to %struct.Map$str$$Leaf**
  %64 = getelementptr inbounds %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %63, i64 %60
  %65 = load %struct.Map$str$$Leaf*, %struct.Map$str$$Leaf** %64, align 8, !alias.scope !17, !noalias !16, !tbaa !19
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #7 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!63, !64, !65, !66, !67}
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
!63 = !{i32 8, !"cf-protection-branch", i32 1}
!64 = !{i32 8, !"cf-protection-return", i32 1}
!65 = !{i32 8, !"branch-target-enforcement", i32 1}
!66 = !{i32 8, !"sign-return-address", i32 1}
!67 = !{i32 4, !"probe-stack", !"inline-asm"}
