%struct.Node = type { i32 }
%struct.Map$em.p1.en$Kind$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$em.p1.en$Kind = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Box$em.p1.en$Kind = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
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

define noundef i32 @test() #0 !dbg !7 {
entry:
  %counts.addr = alloca %struct.Map$em.p1.en$Kind$i32*, align 8
  %seen.addr = alloca %struct.Set$em.p1.en$Kind*, align 8
  %tags.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %zeros.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %alias.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box$em.p1.en$Kind*, align 8
  %Box$em.p1.en$Kind.obj = alloca %struct.Box$em.p1.en$Kind, align 8
  %n.addr = alloca %struct.Node*, align 8
  %Node.obj = alloca %struct.Node, align 8
  %called.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = call i8* @nish_alloc_struct(i64 56), !dbg !10
  %1 = bitcast i8* %0 to %struct.Map$em.p1.en$Kind$i32*, !dbg !10
  call void @nish.Map$em.p1.en$Kind$i32.constructor(%struct.Map$em.p1.en$Kind$i32* %1), !dbg !10
  store %struct.Map$em.p1.en$Kind$i32* %1, %struct.Map$em.p1.en$Kind$i32** %counts.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Map$em.p1.en$Kind$i32** %counts.addr, metadata !51, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Map$em.p1.en$Kind$i32*, %struct.Map$em.p1.en$Kind$i32** %counts.addr, align 8, !dbg !52
  %3 = call %struct.Map$em.p1.en$Kind$i32* @nish.Map$em.p1.en$Kind$i32.set(%struct.Map$em.p1.en$Kind$i32* %2, i32 1, i32 7), !dbg !52
  %4 = call i8* @nish_alloc_struct(i64 48), !dbg !56
  %5 = bitcast i8* %4 to %struct.Set$em.p1.en$Kind*, !dbg !56
  call void @nish.Set$em.p1.en$Kind.constructor(%struct.Set$em.p1.en$Kind* %5), !dbg !56
  store %struct.Set$em.p1.en$Kind* %5, %struct.Set$em.p1.en$Kind** %seen.addr, align 8, !dbg !55
  call void @llvm.dbg.declare(metadata %struct.Set$em.p1.en$Kind** %seen.addr, metadata !67, metadata !DIExpression()), !dbg !55
  %6 = load %struct.Set$em.p1.en$Kind*, %struct.Set$em.p1.en$Kind** %seen.addr, align 8, !dbg !68
  %7 = call %struct.Set$em.p1.en$Kind* @nish.Set$em.p1.en$Kind.add(%struct.Set$em.p1.en$Kind* %6, i32 1), !dbg !68
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0, !dbg !71
  store i64 0, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !71
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1, !dbg !71
  store i64 0, i64* %9, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !71
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2, !dbg !71
  store i8* null, i8** %10, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !71
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tags.addr, align 8, !dbg !70
  call void @llvm.dbg.declare(metadata %struct.nish_array** %tags.addr, metadata !85, metadata !DIExpression()), !dbg !70
  %11 = load %struct.nish_array*, %struct.nish_array** %tags.addr, align 8, !dbg !86
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0, !dbg !86
  %13 = load i64, i64* %12, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !86
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1, !dbg !86
  %15 = load i64, i64* %14, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !86
  %16 = icmp eq i64 %13, %15, !dbg !86
  br i1 %16, label %push.grow, label %push.store, !dbg !86

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 4), !dbg !86
  br label %push.store, !dbg !86

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2, !dbg !86
  %18 = load i8*, i8** %17, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !86
  %19 = bitcast i8* %18 to i32*, !dbg !86
  %20 = getelementptr inbounds i32, i32* %19, i64 %13, !dbg !86
  store i32 1, i32* %20, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !86
  %21 = add i64 %13, 1, !dbg !86
  store i64 %21, i64* %12, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !86
  %22 = trunc i64 %21 to i32, !dbg !86
  %23 = load %struct.nish_array*, %struct.nish_array** %tags.addr, align 8, !dbg !90
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0, !dbg !90
  %25 = load i64, i64* %24, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !90
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1, !dbg !90
  %27 = load i64, i64* %26, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !90
  %28 = icmp eq i64 %25, %27, !dbg !90
  br i1 %28, label %push.grow.1, label %push.store.1, !dbg !90

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %23, i64 4), !dbg !90
  br label %push.store.1, !dbg !90

push.store.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2, !dbg !90
  %30 = load i8*, i8** %29, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !90
  %31 = bitcast i8* %30 to i32*, !dbg !90
  %32 = getelementptr inbounds i32, i32* %31, i64 %25, !dbg !90
  store i32 1, i32* %32, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !90
  %33 = add i64 %25, 1, !dbg !90
  store i64 %33, i64* %24, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !90
  %34 = trunc i64 %33 to i32, !dbg !90
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0, !dbg !93
  store i64 2, i64* %35, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !93
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1, !dbg !93
  store i64 2, i64* %36, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !93
  %37 = mul i64 2, 4, !dbg !93
  %38 = bitcast [2 x i32]* %arr.data to i8*, !dbg !93
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 %37, i1 false), !alias.scope !76, !noalias !75, !dbg !93
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2, !dbg !93
  store i8* %38, i8** %39, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !93
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %zeros.addr, align 8, !dbg !92
  call void @llvm.dbg.declare(metadata %struct.nish_array** %zeros.addr, metadata !100, metadata !DIExpression()), !dbg !92
  store i32 1, i32* %alias.addr, align 4, !dbg !101
  call void @llvm.dbg.declare(metadata i32* %alias.addr, metadata !103, metadata !DIExpression()), !dbg !101
  call void @Box$em.p1.en$Kind.constructor(%struct.Box$em.p1.en$Kind* %Box$em.p1.en$Kind.obj, i32 1), !dbg !105
  store %struct.Box$em.p1.en$Kind* %Box$em.p1.en$Kind.obj, %struct.Box$em.p1.en$Kind** %box.addr, align 8, !dbg !104
  call void @llvm.dbg.declare(metadata %struct.Box$em.p1.en$Kind** %box.addr, metadata !111, metadata !DIExpression()), !dbg !104
  %40 = getelementptr inbounds %struct.Node, %struct.Node* %Node.obj, i32 0, i32 0, !dbg !113
  store i32 1, i32* %40, align 4, !tbaa !116, !dbg !113
  store %struct.Node* %Node.obj, %struct.Node** %n.addr, align 8, !dbg !112
  call void @llvm.dbg.declare(metadata %struct.Node** %n.addr, metadata !121, metadata !DIExpression()), !dbg !112
  %41 = call i32 @call$fn.11.test$arrow0(), !dbg !123
  store i32 %41, i32* %called.addr, align 4, !dbg !122
  call void @llvm.dbg.declare(metadata i32* %called.addr, metadata !124, metadata !DIExpression()), !dbg !122
  store i32 0, i32* %total.addr, align 4, !dbg !125
  call void @llvm.dbg.declare(metadata i32* %total.addr, metadata !127, metadata !DIExpression()), !dbg !125
  %42 = load i32, i32* %total.addr, align 4, !dbg !129
  %43 = load %struct.Map$em.p1.en$Kind$i32*, %struct.Map$em.p1.en$Kind$i32** %counts.addr, align 8, !dbg !131
  %44 = call i64 @nish.Map$em.p1.en$Kind$i32.probe(%struct.Map$em.p1.en$Kind$i32* %43, i32 1), !dbg !131
  %45 = icmp sge i64 %44, 0, !dbg !131
  br i1 %45, label %nullish.value, label %nullish.default, !dbg !131

nullish.value:
  %46 = trunc i64 %44 to i32, !dbg !131
  %47 = call i32 @nish.Map$em.p1.en$Kind$i32.valueAt(%struct.Map$em.p1.en$Kind$i32* %43, i32 %46), !dbg !131
  br label %nullish.end, !dbg !131

nullish.default:
  br label %nullish.end, !dbg !131

nullish.end:
  %48 = phi i32 [ %47, %nullish.value ], [ 0, %nullish.default ], !dbg !131
  %49 = add nsw i32 %42, %48, !dbg !129
  store i32 %49, i32* %total.addr, align 4, !dbg !128
  %50 = load i32, i32* %total.addr, align 4, !dbg !135
  %51 = load %struct.Set$em.p1.en$Kind*, %struct.Set$em.p1.en$Kind** %seen.addr, align 8, !dbg !137
  %52 = call i1 @nish.Set$em.p1.en$Kind.has(%struct.Set$em.p1.en$Kind* %51, i32 1), !dbg !137
  br i1 %52, label %cond.true, label %cond.false, !dbg !137

cond.true:
  br label %cond.end, !dbg !137

cond.false:
  br label %cond.end, !dbg !137

cond.end:
  %53 = phi i32 [ 10, %cond.true ], [ 0, %cond.false ], !dbg !137
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %53), !dbg !135
  %55 = extractvalue { i32, i1 } %54, 0, !dbg !135
  %56 = extractvalue { i32, i1 } %54, 1, !dbg !135
  br i1 %56, label %ovf.fail, label %ovf.ok, !dbg !135

ovf.ok:
  store i32 %55, i32* %total.addr, align 4, !dbg !134
  %57 = load i32, i32* %total.addr, align 4, !dbg !142
  %58 = load %struct.nish_array*, %struct.nish_array** %tags.addr, align 8, !dbg !143
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0, !dbg !143
  %60 = load i64, i64* %59, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !143
  %61 = trunc i64 %60 to i32, !dbg !143
  %62 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %61, i32 100), !dbg !143
  %63 = extractvalue { i32, i1 } %62, 0, !dbg !143
  %64 = extractvalue { i32, i1 } %62, 1, !dbg !143
  br i1 %64, label %ovf.fail.1, label %ovf.ok.1, !dbg !143

ovf.ok.1:
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %63), !dbg !142
  %66 = extractvalue { i32, i1 } %65, 0, !dbg !142
  %67 = extractvalue { i32, i1 } %65, 1, !dbg !142
  br i1 %67, label %ovf.fail.2, label %ovf.ok.2, !dbg !142

ovf.ok.2:
  store i32 %66, i32* %total.addr, align 4, !dbg !141
  %68 = load i32, i32* %total.addr, align 4, !dbg !146
  %69 = load %struct.nish_array*, %struct.nish_array** %zeros.addr, align 8, !dbg !148
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0, !dbg !148
  %71 = load i64, i64* %70, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !148
  %72 = icmp ult i64 1, %71, !dbg !148
  br i1 %72, label %bounds.ok, label %bounds.fail, !dbg !148

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %71), !dbg !148
  unreachable, !dbg !148

bounds.ok:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2, !dbg !148
  %74 = load i8*, i8** %73, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !148
  %75 = bitcast i8* %74 to i32*, !dbg !148
  %76 = getelementptr inbounds i32, i32* %75, i64 1, !dbg !148
  %77 = load i32, i32* %76, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !148
  %78 = icmp eq i32 %77, 0, !dbg !148
  br i1 %78, label %cond.true.1, label %cond.false.1, !dbg !148

cond.true.1:
  br label %cond.end.1, !dbg !148

cond.false.1:
  br label %cond.end.1, !dbg !148

cond.end.1:
  %79 = phi i32 [ 1000, %cond.true.1 ], [ 0, %cond.false.1 ], !dbg !148
  %80 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 %79), !dbg !146
  %81 = extractvalue { i32, i1 } %80, 0, !dbg !146
  %82 = extractvalue { i32, i1 } %80, 1, !dbg !146
  br i1 %82, label %ovf.fail.3, label %ovf.ok.3, !dbg !146

ovf.ok.3:
  store i32 %81, i32* %total.addr, align 4, !dbg !145
  %83 = load i32, i32* %total.addr, align 4, !dbg !153
  %84 = load i32, i32* %alias.addr, align 4, !dbg !155
  %85 = icmp eq i32 %84, 1, !dbg !155
  br i1 %85, label %cond.true.2, label %cond.false.2, !dbg !155

cond.true.2:
  br label %cond.end.2, !dbg !155

cond.false.2:
  br label %cond.end.2, !dbg !155

cond.end.2:
  %86 = phi i32 [ 10000, %cond.true.2 ], [ 0, %cond.false.2 ], !dbg !155
  %87 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %83, i32 %86), !dbg !153
  %88 = extractvalue { i32, i1 } %87, 0, !dbg !153
  %89 = extractvalue { i32, i1 } %87, 1, !dbg !153
  br i1 %89, label %ovf.fail.4, label %ovf.ok.4, !dbg !153

ovf.ok.4:
  store i32 %88, i32* %total.addr, align 4, !dbg !152
  %90 = load i32, i32* %total.addr, align 4, !dbg !160
  %91 = load %struct.Box$em.p1.en$Kind*, %struct.Box$em.p1.en$Kind** %box.addr, align 8, !dbg !162
  %92 = getelementptr inbounds %struct.Box$em.p1.en$Kind, %struct.Box$em.p1.en$Kind* %91, i32 0, i32 0, !dbg !162
  %93 = load i32, i32* %92, align 4, !tbaa !164, !dbg !162
  %94 = icmp eq i32 %93, 1, !dbg !162
  br i1 %94, label %cond.true.3, label %cond.false.3, !dbg !162

cond.true.3:
  br label %cond.end.3, !dbg !162

cond.false.3:
  br label %cond.end.3, !dbg !162

cond.end.3:
  %95 = phi i32 [ 100000, %cond.true.3 ], [ 0, %cond.false.3 ], !dbg !162
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %90, i32 %95), !dbg !160
  %97 = extractvalue { i32, i1 } %96, 0, !dbg !160
  %98 = extractvalue { i32, i1 } %96, 1, !dbg !160
  br i1 %98, label %ovf.fail.5, label %ovf.ok.5, !dbg !160

ovf.ok.5:
  store i32 %97, i32* %total.addr, align 4, !dbg !159
  %99 = load i32, i32* %total.addr, align 4, !dbg !169
  %100 = load %struct.Node*, %struct.Node** %n.addr, align 8, !dbg !171
  %101 = getelementptr inbounds %struct.Node, %struct.Node* %100, i32 0, i32 0, !dbg !171
  %102 = load i32, i32* %101, align 4, !tbaa !116, !dbg !171
  %103 = icmp eq i32 %102, 1, !dbg !171
  br i1 %103, label %cond.true.4, label %cond.false.4, !dbg !171

cond.true.4:
  br label %cond.end.4, !dbg !171

cond.false.4:
  br label %cond.end.4, !dbg !171

cond.end.4:
  %104 = phi i32 [ 1000000, %cond.true.4 ], [ 0, %cond.false.4 ], !dbg !171
  %105 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %99, i32 %104), !dbg !169
  %106 = extractvalue { i32, i1 } %105, 0, !dbg !169
  %107 = extractvalue { i32, i1 } %105, 1, !dbg !169
  br i1 %107, label %ovf.fail.6, label %ovf.ok.6, !dbg !169

ovf.ok.6:
  store i32 %106, i32* %total.addr, align 4, !dbg !168
  %108 = load i32, i32* %total.addr, align 4, !dbg !176
  %109 = load i32, i32* %called.addr, align 4, !dbg !178
  %110 = icmp eq i32 %109, 1, !dbg !178
  br i1 %110, label %cond.true.5, label %cond.false.5, !dbg !178

cond.true.5:
  br label %cond.end.5, !dbg !178

cond.false.5:
  br label %cond.end.5, !dbg !178

cond.end.5:
  %111 = phi i32 [ 10000000, %cond.true.5 ], [ 0, %cond.false.5 ], !dbg !178
  %112 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %108, i32 %111), !dbg !176
  %113 = extractvalue { i32, i1 } %112, 0, !dbg !176
  %114 = extractvalue { i32, i1 } %112, 1, !dbg !176
  br i1 %114, label %ovf.fail.7, label %ovf.ok.7, !dbg !176

ovf.ok.7:
  store i32 %113, i32* %total.addr, align 4, !dbg !175
  %115 = load i32, i32* %total.addr, align 4, !dbg !183
  call void @nish_arena_release(i64 %arena.mark), !dbg !182
  ret i32 %115, !dbg !182

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !135
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 2), !dbg !143
  unreachable

ovf.fail.2:
  call void @nish_panic_overflow(i32 0), !dbg !142
  unreachable

ovf.fail.3:
  call void @nish_panic_overflow(i32 0), !dbg !146
  unreachable

ovf.fail.4:
  call void @nish_panic_overflow(i32 0), !dbg !153
  unreachable

ovf.fail.5:
  call void @nish_panic_overflow(i32 0), !dbg !160
  unreachable

ovf.fail.6:
  call void @nish_panic_overflow(i32 0), !dbg !169
  unreachable

ovf.fail.7:
  call void @nish_panic_overflow(i32 0), !dbg !176
  unreachable
}

define internal void @Box$em.p1.en$Kind.constructor(%struct.Box$em.p1.en$Kind* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #1 !dbg !186 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$em.p1.en$Kind* %this, metadata !188, metadata !DIExpression()), !dbg !187
  call void @llvm.dbg.value(metadata i32 %value, metadata !189, metadata !DIExpression()), !dbg !187
  %0 = getelementptr inbounds %struct.Box$em.p1.en$Kind, %struct.Box$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !190
  store i32 %value, i32* %0, align 4, !tbaa !164, !dbg !190
  ret void, !dbg !187
}

define internal noundef i32 @test$arrow0() #2 !dbg !194 {
entry:
  ret i32 1, !dbg !195
}

define internal noundef i32 @call$fn.11.test$arrow0() #2 !dbg !197 {
entry:
  %0 = tail call i32 @test$arrow0(), !dbg !199
  ret i32 %0, !dbg !198
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 !dbg !202 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !204, metadata !DIExpression()), !dbg !203
  call void @llvm.dbg.value(metadata i32 %mask, metadata !205, metadata !DIExpression()), !dbg !203
  %0 = lshr i32 %h, 16, !dbg !209
  %1 = xor i32 %h, %0, !dbg !207
  %2 = and i32 %1, %mask, !dbg !206
  ret i32 %2, !dbg !203
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 !dbg !213 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !215, metadata !DIExpression()), !dbg !214
  call void @llvm.dbg.value(metadata i32 %index, metadata !216, metadata !DIExpression()), !dbg !214
  %0 = lshr i32 %h, 24, !dbg !219
  %1 = shl i32 %0, 24, !dbg !218
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1), !dbg !221
  %3 = extractvalue { i32, i1 } %2, 0, !dbg !221
  %4 = extractvalue { i32, i1 } %2, 1, !dbg !221
  br i1 %4, label %ovf.fail, label %ovf.ok, !dbg !221

ovf.ok:
  %5 = or i32 %1, %3, !dbg !217
  ret i32 %5, !dbg !214

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !221
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 !dbg !225 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !227, metadata !DIExpression()), !dbg !226
  call void @llvm.dbg.value(metadata i32 %index, metadata !228, metadata !DIExpression()), !dbg !226
  %0 = sext i32 %bucket to i64, !dbg !230
  %1 = shl i64 %0, 32, !dbg !230
  %2 = sext i32 %index to i64, !dbg !232
  %3 = or i64 %1, %2, !dbg !229
  ret i64 %3, !dbg !226
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 !dbg !236 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !238, metadata !DIExpression()), !dbg !237
  call void @llvm.dbg.value(metadata i32 %h, metadata !239, metadata !DIExpression()), !dbg !237
  %0 = sext i32 -1 to i64, !dbg !240
  %1 = sext i32 %bucket to i64, !dbg !244
  %2 = shl i64 %1, 32, !dbg !244
  %3 = zext i32 %h to i64, !dbg !246
  %4 = or i64 %2, %3, !dbg !243
  %5 = sub nsw i64 %0, %4, !dbg !240
  ret i64 %5, !dbg !237
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !250 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !252, metadata !DIExpression()), !dbg !251
  call void @llvm.dbg.value(metadata i32 %mask, metadata !253, metadata !DIExpression()), !dbg !251
  call void @llvm.dbg.value(metadata i32 %h, metadata !254, metadata !DIExpression()), !dbg !251
  call void @llvm.dbg.value(metadata i32 %index, metadata !255, metadata !DIExpression()), !dbg !251
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !257
  store i32 %0, i32* %word.addr, align 4, !dbg !256
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !260, metadata !DIExpression()), !dbg !256
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !262
  store i32 %1, i32* %bucket.addr, align 4, !dbg !261
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !265, metadata !DIExpression()), !dbg !261
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !266
  %3 = load i64, i64* %2, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !266
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !266
  %5 = load i8*, i8** %4, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !266
  br label %while.cond, !dbg !266

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !268
  %7 = icmp sge i32 %6, 0, !dbg !268
  br i1 %7, label %land.rhs, label %land.end, !dbg !268

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !270
  %9 = trunc i64 %3 to i32, !dbg !267
  %10 = icmp slt i32 %8, %9, !dbg !270
  br label %land.end, !dbg !268

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !268
  br i1 %11, label %while.body, label %while.end, !dbg !266

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !275
  %13 = sext i32 %12 to i64, !dbg !274
  %14 = bitcast i8* %5 to i32*, !dbg !274
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !274
  %16 = load i32, i32* %15, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !274
  %17 = icmp eq i32 %16, 0, !dbg !274
  br i1 %17, label %if.then, label %if.end, !dbg !273

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !279
  %19 = sext i32 %18 to i64, !dbg !278
  %20 = load i32, i32* %word.addr, align 4, !dbg !280
  %21 = bitcast i8* %5 to i32*, !dbg !278
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !278
  store i32 %20, i32* %22, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !278
  ret void, !dbg !281

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !284
  %24 = add nsw i32 %23, 1, !dbg !284
  %25 = and i32 %24, %mask, !dbg !283
  store i32 %25, i32* %bucket.addr, align 4, !dbg !282
  br label %while.cond, !dbg !266

while.end:
  ret void, !dbg !251
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !289 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !291, metadata !DIExpression()), !dbg !290
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !294
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !294
  %2 = trunc i64 %1 to i32, !dbg !294
  store i32 %2, i32* %used.addr, align 4, !dbg !292
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !295, metadata !DIExpression()), !dbg !292
  store i32 0, i32* %to.addr, align 4, !dbg !296
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !298, metadata !DIExpression()), !dbg !296
  store i32 0, i32* %from.addr, align 4, !dbg !299
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !301, metadata !DIExpression()), !dbg !299
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !299
  %4 = load i8*, i8** %3, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !299
  br label %for.cond, !dbg !299

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !303
  %6 = load i32, i32* %used.addr, align 4, !dbg !304
  %7 = icmp slt i32 %5, %6, !dbg !303
  br i1 %7, label %for.body, label %for.end, !dbg !299

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !307
  %9 = sext i32 %8 to i64, !dbg !302
  %10 = bitcast i8* %4 to i32*, !dbg !302
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !302
  %12 = load i32, i32* %11, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !302
  store i32 %12, i32* %h.addr, align 4, !dbg !306
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !308, metadata !DIExpression()), !dbg !306
  %13 = load i32, i32* %h.addr, align 4, !dbg !310
  %14 = icmp ne i32 %13, 0, !dbg !310
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !310

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !312
  %16 = icmp sge i32 %15, 0, !dbg !312
  br label %land.end.1, !dbg !310

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !310
  br i1 %17, label %land.rhs, label %land.end, !dbg !310

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !314
  %19 = load i32, i32* %used.addr, align 4, !dbg !315
  %20 = icmp slt i32 %18, %19, !dbg !314
  br label %land.end, !dbg !310

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !310
  br i1 %21, label %if.then, label %if.end, !dbg !309

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !318
  %23 = sext i32 %22 to i64, !dbg !317
  %24 = load i32, i32* %h.addr, align 4, !dbg !319
  %25 = bitcast i8* %4 to i32*, !dbg !317
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !317
  store i32 %24, i32* %26, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !317
  %27 = load i32, i32* %to.addr, align 4, !dbg !320
  %28 = add nsw i32 %27, 1, !dbg !320
  store i32 %28, i32* %to.addr, align 4, !dbg !320
  br label %if.end, !dbg !309

if.end:
  br label %for.inc, !dbg !299

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !321
  %30 = add nsw i32 %29, 1, !dbg !321
  store i32 %30, i32* %from.addr, align 4, !dbg !321
  br label %for.cond, !dbg !299

for.end:
  br label %while.cond, !dbg !322

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !324
  %32 = load i64, i64* %31, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !324
  %33 = trunc i64 %32 to i32, !dbg !324
  %34 = load i32, i32* %to.addr, align 4, !dbg !325
  %35 = icmp sgt i32 %33, %34, !dbg !323
  br i1 %35, label %while.body, label %while.end, !dbg !322

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !327
  %37 = load i64, i64* %36, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !327
  %38 = icmp eq i64 %37, 0, !dbg !327
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !327

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !327
  unreachable, !dbg !327

pop.ok:
  %39 = sub i64 %37, 1, !dbg !327
  store i64 %39, i64* %36, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !327
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !327
  %41 = load i8*, i8** %40, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !327
  %42 = bitcast i8* %41 to i32*, !dbg !327
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !327
  %44 = load i32, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !327
  br label %while.cond, !dbg !322

while.end:
  ret void, !dbg !290
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !330 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !332, metadata !DIExpression()), !dbg !331
  call void @llvm.dbg.value(metadata i32 %live, metadata !333, metadata !DIExpression()), !dbg !331
  call void @llvm.dbg.value(metadata i32 %used, metadata !334, metadata !DIExpression()), !dbg !331
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !337
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !337
  %2 = trunc i64 %1 to i32, !dbg !337
  store i32 %2, i32* %n.addr, align 4, !dbg !335
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !338, metadata !DIExpression()), !dbg !335
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2), !dbg !340
  %4 = extractvalue { i32, i1 } %3, 0, !dbg !340
  %5 = extractvalue { i32, i1 } %3, 1, !dbg !340
  br i1 %5, label %ovf.fail, label %ovf.ok, !dbg !340

ovf.ok:
  %6 = icmp slt i32 %4, %used, !dbg !340
  br i1 %6, label %if.then, label %if.end, !dbg !339

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !344
  ret %struct.nish_array* %slots, !dbg !346

if.end:
  %7 = load i32, i32* %n.addr, align 4, !dbg !350
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2), !dbg !350
  %9 = extractvalue { i32, i1 } %8, 0, !dbg !350
  %10 = extractvalue { i32, i1 } %8, 1, !dbg !350
  br i1 %10, label %ovf.fail.1, label %ovf.ok.1, !dbg !350

ovf.ok.1:
  %11 = sext i32 %9 to i64, !dbg !349
  %12 = icmp ule i64 %11, 2147483647, !dbg !349
  br i1 %12, label %len.ok, label %len.fail, !dbg !349

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*)), !dbg !349
  unreachable, !dbg !349

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !349
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !349
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !349
  store i64 %11, i64* %15, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !349
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !349
  store i64 %11, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !349
  %17 = mul i64 %11, 4, !dbg !349
  %18 = call i8* @nish_alloc_struct(i64 %17), !dbg !349
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !76, !noalias !75, !dbg !349
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !349
  store i8* %18, i8** %19, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !349
  ret %struct.nish_array* %14, !dbg !348

ovf.fail:
  call void @nish_panic_overflow(i32 2), !dbg !340
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 2), !dbg !350
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !354 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !356, metadata !DIExpression()), !dbg !355
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !357, metadata !DIExpression()), !dbg !355
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !360
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !360
  %2 = trunc i64 %1 to i32, !dbg !360
  %3 = sub nsw i32 %2, 1, !dbg !359
  store i32 %3, i32* %mask.addr, align 4, !dbg !358
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !362, metadata !DIExpression()), !dbg !358
  store i32 0, i32* %i.addr, align 4, !dbg !363
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !365, metadata !DIExpression()), !dbg !363
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !363
  %5 = load i64, i64* %4, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !363
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !363
  %7 = load i8*, i8** %6, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !363
  br label %for.cond, !dbg !363

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !367
  %9 = trunc i64 %5 to i32, !dbg !366
  %10 = icmp slt i32 %8, %9, !dbg !367
  br i1 %10, label %for.body, label %for.end, !dbg !363

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !372
  %12 = sext i32 %11 to i64, !dbg !371
  %13 = bitcast i8* %7 to i32*, !dbg !371
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !371
  %15 = load i32, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !371
  store i32 %15, i32* %h.addr, align 4, !dbg !370
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !373, metadata !DIExpression()), !dbg !370
  %16 = load i32, i32* %h.addr, align 4, !dbg !375
  %17 = icmp ne i32 %16, 0, !dbg !375
  br i1 %17, label %if.then, label %if.end, !dbg !374

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !380
  %19 = load i32, i32* %h.addr, align 4, !dbg !381
  %20 = load i32, i32* %i.addr, align 4, !dbg !382
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !378
  br label %if.end, !dbg !374

if.end:
  br label %for.inc, !dbg !363

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !383
  %22 = add nsw i32 %21, 1, !dbg !383
  store i32 %22, i32* %i.addr, align 4, !dbg !383
  br label %for.cond, !dbg !363

for.end:
  ret void, !dbg !355
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !384 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !386, metadata !DIExpression()), !dbg !385
  store i32 0, i32* %i.addr, align 4, !dbg !387
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !389, metadata !DIExpression()), !dbg !387
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !387
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !387
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !387
  %3 = load i8*, i8** %2, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !387
  br label %for.cond, !dbg !387

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !391
  %5 = trunc i64 %1 to i32, !dbg !390
  %6 = icmp slt i32 %4, %5, !dbg !391
  br i1 %6, label %for.body, label %for.end, !dbg !387

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !395
  %8 = sext i32 %7 to i64, !dbg !394
  %9 = bitcast i8* %3 to i32*, !dbg !394
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !394
  store i32 0, i32* %10, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !394
  br label %for.inc, !dbg !387

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !397
  %12 = add nsw i32 %11, 1, !dbg !397
  store i32 %12, i32* %i.addr, align 4, !dbg !397
  br label %for.cond, !dbg !387

for.end:
  ret void, !dbg !385
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !400 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !402, metadata !DIExpression()), !dbg !401
  call void @llvm.dbg.value(metadata i32 %mask, metadata !403, metadata !DIExpression()), !dbg !401
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !404, metadata !DIExpression()), !dbg !401
  call void @llvm.dbg.value(metadata i32 %h, metadata !405, metadata !DIExpression()), !dbg !401
  call void @llvm.dbg.value(metadata i32 %used, metadata !406, metadata !DIExpression()), !dbg !401
  %0 = icmp sge i32 %bucket, 0, !dbg !408
  br i1 %0, label %land.rhs, label %land.end, !dbg !408

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !412
  %2 = load i64, i64* %1, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !412
  %3 = trunc i64 %2 to i32, !dbg !412
  %4 = icmp slt i32 %bucket, %3, !dbg !410
  br label %land.end, !dbg !408

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !408
  br i1 %5, label %if.then, label %if.else, !dbg !407

if.then:
  %6 = sext i32 %bucket to i64, !dbg !414
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1), !dbg !418
  %8 = extractvalue { i32, i1 } %7, 0, !dbg !418
  %9 = extractvalue { i32, i1 } %7, 1, !dbg !418
  br i1 %9, label %ovf.fail, label %ovf.ok, !dbg !418

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8), !dbg !416
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !414
  %12 = load i8*, i8** %11, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !414
  %13 = bitcast i8* %12 to i32*, !dbg !414
  %14 = getelementptr inbounds i32, i32* %13, i64 %6, !dbg !414
  store i32 %10, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !414
  br label %if.end, !dbg !407

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1), !dbg !425
  %16 = extractvalue { i32, i1 } %15, 0, !dbg !425
  %17 = extractvalue { i32, i1 } %15, 1, !dbg !425
  br i1 %17, label %ovf.fail.1, label %ovf.ok.1, !dbg !425

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16), !dbg !421
  br label %if.end, !dbg !407

if.end:
  ret void, !dbg !401

ovf.fail:
  call void @nish_panic_overflow(i32 1), !dbg !418
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 1), !dbg !425
  unreachable
}

define internal void @nish.Map$em.p1.en$Kind$i32.constructor(%struct.Map$em.p1.en$Kind$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 !dbg !429 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !431, metadata !DIExpression()), !dbg !430
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !430
  store i32 0, i32* %0, align 4, !tbaa !434, !dbg !430
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !430
  store i32 7, i32* %1, align 4, !tbaa !435, !dbg !430
  %2 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !430
  store i32 0, i32* %2, align 4, !tbaa !436, !dbg !430
  %3 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 7, !dbg !430
  store i32 0, i32* %3, align 4, !tbaa !437, !dbg !430
  %4 = sext i32 8 to i64, !dbg !439
  %5 = icmp ule i64 %4, 2147483647, !dbg !439
  br i1 %5, label %len.ok, label %len.fail, !dbg !439

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*)), !dbg !439
  unreachable, !dbg !439

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24), !dbg !439
  %7 = bitcast i8* %6 to %struct.nish_array*, !dbg !439
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !439
  store i64 %4, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !439
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1, !dbg !439
  store i64 %4, i64* %9, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !439
  %10 = mul i64 %4, 4, !dbg !439
  %11 = call i8* @nish_alloc_struct(i64 %10), !dbg !439
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !76, !noalias !75, !dbg !439
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2, !dbg !439
  store i8* %11, i8** %12, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !439
  %13 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !438
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !441, !dbg !438
  %14 = call i8* @nish_alloc_struct(i64 24), !dbg !443
  %15 = bitcast i8* %14 to %struct.nish_array*, !dbg !443
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !443
  store i64 0, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !443
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !443
  store i64 0, i64* %17, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !443
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !443
  store i8* null, i8** %18, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !443
  %19 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !442
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !444, !dbg !442
  %20 = call i8* @nish_alloc_struct(i64 24), !dbg !446
  %21 = bitcast i8* %20 to %struct.nish_array*, !dbg !446
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0, !dbg !446
  store i64 0, i64* %22, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !446
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1, !dbg !446
  store i64 0, i64* %23, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !446
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2, !dbg !446
  store i8* null, i8** %24, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !446
  %25 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !445
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !447, !dbg !445
  %26 = call i8* @nish_alloc_struct(i64 24), !dbg !449
  %27 = bitcast i8* %26 to %struct.nish_array*, !dbg !449
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0, !dbg !449
  store i64 0, i64* %28, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !449
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1, !dbg !449
  store i64 0, i64* %29, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !449
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2, !dbg !449
  store i8* null, i8** %30, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !449
  %31 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !448
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !450, !dbg !448
  ret void, !dbg !430
}

define internal noundef i64 @nish.Map$em.p1.en$Kind$i32.probe(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #0 !dbg !453 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !455, metadata !DIExpression()), !dbg !454
  call void @llvm.dbg.value(metadata i32 %key, metadata !456, metadata !DIExpression()), !dbg !454
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !459
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !441, !dbg !459
  %2 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !460
  %3 = load i32, i32* %2, align 4, !tbaa !435, !dbg !460
  %4 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !461
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !450, !dbg !461
  %6 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !462
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !444, !dbg !462
  %8 = call i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !458
  ret i64 %8, !dbg !457
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$em.p1.en$Kind$i32* @nish.Map$em.p1.en$Kind$i32.set(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, i32 noundef %value) #0 !dbg !466 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !468, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata i32 %key, metadata !469, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata i32 %value, metadata !470, metadata !DIExpression()), !dbg !467
  %0 = call i64 @nish.Map$em.p1.en$Kind$i32.probe(%struct.Map$em.p1.en$Kind$i32* %this, i32 %key), !dbg !472
  store i64 %0, i64* %found.addr, align 8, !dbg !471
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !474, metadata !DIExpression()), !dbg !471
  %1 = load i64, i64* %found.addr, align 8, !dbg !476
  %2 = icmp sge i64 %1, 0, !dbg !476
  br i1 %2, label %if.then, label %if.else, !dbg !475

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !481
  %4 = trunc i64 %3 to i32, !dbg !480
  call void @nish.Map$em.p1.en$Kind$i32.setValueAt(%struct.Map$em.p1.en$Kind$i32* %this, i32 %4, i32 %value), !dbg !479
  br label %if.end, !dbg !475

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !485
  call void @nish.Map$em.p1.en$Kind$i32.insertAt(%struct.Map$em.p1.en$Kind$i32* %this, i64 %5, i32 %key, i32 %value), !dbg !484
  br label %if.end, !dbg !475

if.end:
  ret %struct.Map$em.p1.en$Kind$i32* %this, !dbg !488
}

define internal noundef i32 @nish.Map$em.p1.en$Kind$i32.valueAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !492 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !494, metadata !DIExpression()), !dbg !493
  call void @llvm.dbg.value(metadata i32 %index, metadata !495, metadata !DIExpression()), !dbg !493
  %0 = icmp slt i32 %index, 0, !dbg !497
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !497

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !501
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !447, !dbg !501
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !501
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !501
  %5 = trunc i64 %4 to i32, !dbg !501
  %6 = icmp sge i32 %index, %5, !dbg !499
  br label %lor.end, !dbg !497

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !497
  br i1 %7, label %if.then, label %if.end, !dbg !496

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*)), !dbg !503
  unreachable, !dbg !503

if.end:
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !506
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !447, !dbg !506
  %10 = sext i32 %index to i64, !dbg !506
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !506
  %12 = load i8*, i8** %11, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !506
  %13 = bitcast i8* %12 to i32*, !dbg !506
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !506
  %15 = load i32, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !506
  ret i32 %15, !dbg !505
}

define internal void @nish.Map$em.p1.en$Kind$i32.setValueAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #1 !dbg !510 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !512, metadata !DIExpression()), !dbg !511
  call void @llvm.dbg.value(metadata i32 %index, metadata !513, metadata !DIExpression()), !dbg !511
  call void @llvm.dbg.value(metadata i32 %value, metadata !514, metadata !DIExpression()), !dbg !511
  %0 = icmp sge i32 %index, 0, !dbg !516
  br i1 %0, label %land.rhs, label %land.end, !dbg !516

land.rhs:
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !520
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !447, !dbg !520
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !520
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !520
  %5 = trunc i64 %4 to i32, !dbg !520
  %6 = icmp slt i32 %index, %5, !dbg !518
  br label %land.end, !dbg !516

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !516
  br i1 %7, label %if.then, label %if.end, !dbg !515

if.then:
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !522
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !447, !dbg !522
  %10 = sext i32 %index to i64, !dbg !522
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !522
  %12 = load i8*, i8** %11, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !522
  %13 = bitcast i8* %12 to i32*, !dbg !522
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !522
  store i32 %value, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !522
  br label %if.end, !dbg !515

if.end:
  ret void, !dbg !511
}

define internal void @nish.Map$em.p1.en$Kind$i32.insertAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, i32 noundef %value) #0 !dbg !527 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !529, metadata !DIExpression()), !dbg !528
  call void @llvm.dbg.value(metadata i64 %absent, metadata !530, metadata !DIExpression()), !dbg !528
  call void @llvm.dbg.value(metadata i32 %key, metadata !531, metadata !DIExpression()), !dbg !528
  call void @llvm.dbg.value(metadata i32 %value, metadata !532, metadata !DIExpression()), !dbg !528
  %0 = sub nsw i64 -1, %absent, !dbg !534
  store i64 %0, i64* %packed.addr, align 8, !dbg !533
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !536, metadata !DIExpression()), !dbg !533
  %1 = load i64, i64* %packed.addr, align 8, !dbg !539
  %2 = ashr i64 %1, 32, !dbg !539
  %3 = trunc i64 %2 to i32, !dbg !538
  store i32 %3, i32* %bucket.addr, align 4, !dbg !537
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !540, metadata !DIExpression()), !dbg !537
  %4 = load i64, i64* %packed.addr, align 8, !dbg !543
  %5 = trunc i64 %4 to i32, !dbg !542
  store i32 %5, i32* %h.addr, align 4, !dbg !541
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !544, metadata !DIExpression()), !dbg !541
  %6 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !547
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !444, !dbg !547
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !547
  %9 = load i64, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !547
  %10 = trunc i64 %9 to i32, !dbg !547
  %11 = icmp sge i32 %10, 16777215, !dbg !546
  br i1 %11, label %if.then, label %if.end, !dbg !545

if.then:
  %12 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !551
  %13 = load i32, i32* %12, align 4, !tbaa !436, !dbg !551
  %14 = icmp sge i32 %13, 16777215, !dbg !551
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !551

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 7, !dbg !553
  %16 = load i32, i32* %15, align 4, !tbaa !437, !dbg !553
  %17 = icmp sgt i32 %16, 0, !dbg !553
  br label %lor.end, !dbg !551

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ], !dbg !551
  br i1 %18, label %if.then.1, label %if.end.1, !dbg !550

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*)), !dbg !556
  unreachable, !dbg !556

if.end.1:
  call void @nish.Map$em.p1.en$Kind$i32.rebuild(%struct.Map$em.p1.en$Kind$i32* %this), !dbg !558
  store i32 -1, i32* %bucket.addr, align 4, !dbg !559
  br label %if.end, !dbg !545

if.end:
  %19 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !561
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !444, !dbg !561
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !561
  %22 = load i64, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !561
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !561
  %24 = load i64, i64* %23, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !561
  %25 = icmp eq i64 %22, %24, !dbg !561
  br i1 %25, label %push.grow, label %push.store, !dbg !561

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4), !dbg !561
  br label %push.store, !dbg !561

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !561
  %27 = load i8*, i8** %26, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !561
  %28 = bitcast i8* %27 to i32*, !dbg !561
  %29 = getelementptr inbounds i32, i32* %28, i64 %22, !dbg !561
  store i32 %key, i32* %29, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !561
  %30 = add i64 %22, 1, !dbg !561
  store i64 %30, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !561
  %31 = trunc i64 %30 to i32, !dbg !561
  %32 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !563
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !447, !dbg !563
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0, !dbg !563
  %35 = load i64, i64* %34, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !563
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1, !dbg !563
  %37 = load i64, i64* %36, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !563
  %38 = icmp eq i64 %35, %37, !dbg !563
  br i1 %38, label %push.grow.1, label %push.store.1, !dbg !563

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4), !dbg !563
  br label %push.store.1, !dbg !563

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2, !dbg !563
  %40 = load i8*, i8** %39, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !563
  %41 = bitcast i8* %40 to i32*, !dbg !563
  %42 = getelementptr inbounds i32, i32* %41, i64 %35, !dbg !563
  store i32 %value, i32* %42, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !563
  %43 = add i64 %35, 1, !dbg !563
  store i64 %43, i64* %34, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !563
  %44 = trunc i64 %43 to i32, !dbg !563
  %45 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !565
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !450, !dbg !565
  %47 = load i32, i32* %h.addr, align 4, !dbg !566
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0, !dbg !565
  %49 = load i64, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !565
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1, !dbg !565
  %51 = load i64, i64* %50, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !565
  %52 = icmp eq i64 %49, %51, !dbg !565
  br i1 %52, label %push.grow.2, label %push.store.2, !dbg !565

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4), !dbg !565
  br label %push.store.2, !dbg !565

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2, !dbg !565
  %54 = load i8*, i8** %53, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !565
  %55 = bitcast i8* %54 to i32*, !dbg !565
  %56 = getelementptr inbounds i32, i32* %55, i64 %49, !dbg !565
  store i32 %47, i32* %56, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !565
  %57 = add i64 %49, 1, !dbg !565
  store i64 %57, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !565
  %58 = trunc i64 %57 to i32, !dbg !565
  %59 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !568
  %60 = load i32, i32* %59, align 4, !tbaa !436, !dbg !568
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1), !dbg !568
  %62 = extractvalue { i32, i1 } %61, 0, !dbg !568
  %63 = extractvalue { i32, i1 } %61, 1, !dbg !568
  br i1 %63, label %ovf.fail, label %ovf.ok, !dbg !568

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !567
  store i32 %62, i32* %64, align 4, !tbaa !436, !dbg !567
  %65 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !571
  %66 = load i32, i32* %65, align 4, !tbaa !434, !dbg !571
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1), !dbg !571
  %68 = extractvalue { i32, i1 } %67, 0, !dbg !571
  %69 = extractvalue { i32, i1 } %67, 1, !dbg !571
  br i1 %69, label %ovf.fail.1, label %ovf.ok.1, !dbg !571

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !570
  store i32 %68, i32* %70, align 4, !tbaa !434, !dbg !570
  %71 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !575
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !444, !dbg !575
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0, !dbg !575
  %74 = load i64, i64* %73, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !575
  %75 = trunc i64 %74 to i32, !dbg !575
  store i32 %75, i32* %used.addr, align 4, !dbg !573
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !576, metadata !DIExpression()), !dbg !573
  %76 = load i32, i32* %used.addr, align 4, !dbg !578
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4), !dbg !578
  %78 = extractvalue { i32, i1 } %77, 0, !dbg !578
  %79 = extractvalue { i32, i1 } %77, 1, !dbg !578
  br i1 %79, label %ovf.fail.2, label %ovf.ok.2, !dbg !578

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !581
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !441, !dbg !581
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0, !dbg !581
  %83 = load i64, i64* %82, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !581
  %84 = trunc i64 %83 to i32, !dbg !581
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3), !dbg !580
  %86 = extractvalue { i32, i1 } %85, 0, !dbg !580
  %87 = extractvalue { i32, i1 } %85, 1, !dbg !580
  br i1 %87, label %ovf.fail.3, label %ovf.ok.3, !dbg !580

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86, !dbg !578
  br i1 %88, label %if.then.2, label %if.else, !dbg !577

if.then.2:
  call void @nish.Map$em.p1.en$Kind$i32.rebuild(%struct.Map$em.p1.en$Kind$i32* %this), !dbg !584
  br label %if.end.2, !dbg !577

if.else:
  %89 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !587
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !441, !dbg !587
  %91 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !588
  %92 = load i32, i32* %91, align 4, !tbaa !435, !dbg !588
  %93 = load i32, i32* %bucket.addr, align 4, !dbg !589
  %94 = load i32, i32* %h.addr, align 4, !dbg !590
  %95 = load i32, i32* %used.addr, align 4, !dbg !591
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95), !dbg !586
  br label %if.end.2, !dbg !577

if.end.2:
  ret void, !dbg !528

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !568
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 0), !dbg !571
  unreachable

ovf.fail.2:
  call void @nish_panic_overflow(i32 2), !dbg !578
  unreachable

ovf.fail.3:
  call void @nish_panic_overflow(i32 2), !dbg !580
  unreachable
}

define internal void @nish.Map$em.p1.en$Kind$i32.rebuild(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !592 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !594, metadata !DIExpression()), !dbg !593
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !597
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !444, !dbg !597
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !597
  %3 = load i64, i64* %2, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !597
  %4 = trunc i64 %3 to i32, !dbg !597
  store i32 %4, i32* %used.addr, align 4, !dbg !595
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !598, metadata !DIExpression()), !dbg !595
  %5 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 7, !dbg !600
  %6 = load i32, i32* %5, align 4, !tbaa !437, !dbg !600
  %7 = icmp sgt i32 %6, 0, !dbg !600
  store i1 %7, i1* %walking.addr, align 1, !dbg !599
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !603, metadata !DIExpression()), !dbg !599
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !606
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !441, !dbg !606
  %10 = load i1, i1* %walking.addr, align 1, !dbg !607
  br i1 %10, label %cond.true, label %cond.false, !dbg !607

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !608
  br label %cond.end, !dbg !607

cond.false:
  %12 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !609
  %13 = load i32, i32* %12, align 4, !tbaa !436, !dbg !609
  br label %cond.end, !dbg !607

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !607
  %15 = load i32, i32* %used.addr, align 4, !dbg !610
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !605
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !604
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !611, metadata !DIExpression()), !dbg !604
  %17 = load i1, i1* %walking.addr, align 1, !dbg !614
  %18 = xor i1 %17, true, !dbg !613
  br i1 %18, label %land.rhs, label %land.end, !dbg !613

land.rhs:
  %19 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !615
  %20 = load i32, i32* %19, align 4, !tbaa !436, !dbg !615
  %21 = load i32, i32* %used.addr, align 4, !dbg !616
  %22 = icmp slt i32 %20, %21, !dbg !615
  br label %land.end, !dbg !613

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !613
  br i1 %23, label %if.then, label %if.end, !dbg !612

if.then:
  %24 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !619
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !444, !dbg !619
  %26 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !620
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !450, !dbg !620
  call void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !618
  %28 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !622
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !447, !dbg !622
  %30 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !623
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !450, !dbg !623
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !621
  %32 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !625
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !450, !dbg !625
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !624
  br label %if.end, !dbg !612

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !627
  %35 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !626
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !441, !dbg !626
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !630
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !630
  %38 = load i64, i64* %37, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !630
  %39 = trunc i64 %38 to i32, !dbg !630
  %40 = sub nsw i32 %39, 1, !dbg !629
  %41 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !628
  store i32 %40, i32* %41, align 4, !tbaa !435, !dbg !628
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !633
  %43 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !634
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !450, !dbg !634
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !632
  ret void, !dbg !593
}

define internal void @nish.Set$em.p1.en$Kind.constructor(%struct.Set$em.p1.en$Kind* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 !dbg !637 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !639, metadata !DIExpression()), !dbg !638
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !638
  store i32 0, i32* %0, align 4, !tbaa !641, !dbg !638
  %1 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !638
  store i32 7, i32* %1, align 4, !tbaa !642, !dbg !638
  %2 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !638
  store i32 0, i32* %2, align 4, !tbaa !643, !dbg !638
  %3 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 6, !dbg !638
  store i32 0, i32* %3, align 4, !tbaa !644, !dbg !638
  %4 = sext i32 8 to i64, !dbg !646
  %5 = icmp ule i64 %4, 2147483647, !dbg !646
  br i1 %5, label %len.ok, label %len.fail, !dbg !646

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*)), !dbg !646
  unreachable, !dbg !646

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24), !dbg !646
  %7 = bitcast i8* %6 to %struct.nish_array*, !dbg !646
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !646
  store i64 %4, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !646
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1, !dbg !646
  store i64 %4, i64* %9, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !646
  %10 = mul i64 %4, 4, !dbg !646
  %11 = call i8* @nish_alloc_struct(i64 %10), !dbg !646
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !76, !noalias !75, !dbg !646
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2, !dbg !646
  store i8* %11, i8** %12, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !646
  %13 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !645
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !648, !dbg !645
  %14 = call i8* @nish_alloc_struct(i64 24), !dbg !650
  %15 = bitcast i8* %14 to %struct.nish_array*, !dbg !650
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !650
  store i64 0, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !650
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !650
  store i64 0, i64* %17, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !650
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !650
  store i8* null, i8** %18, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !650
  %19 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !649
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !651, !dbg !649
  %20 = call i8* @nish_alloc_struct(i64 24), !dbg !653
  %21 = bitcast i8* %20 to %struct.nish_array*, !dbg !653
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0, !dbg !653
  store i64 0, i64* %22, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !653
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1, !dbg !653
  store i64 0, i64* %23, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !653
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2, !dbg !653
  store i8* null, i8** %24, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !653
  %25 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !652
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !654, !dbg !652
  ret void, !dbg !638
}

define internal noundef i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !657 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !659, metadata !DIExpression()), !dbg !658
  call void @llvm.dbg.value(metadata i32 %key, metadata !660, metadata !DIExpression()), !dbg !658
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !663
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !648, !dbg !663
  %2 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !664
  %3 = load i32, i32* %2, align 4, !tbaa !642, !dbg !664
  %4 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !665
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !654, !dbg !665
  %6 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !666
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !651, !dbg !666
  %8 = call i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !662
  ret i64 %8, !dbg !661
}

define internal noundef zeroext i1 @nish.Set$em.p1.en$Kind.has(%struct.Set$em.p1.en$Kind* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !670 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !672, metadata !DIExpression()), !dbg !671
  call void @llvm.dbg.value(metadata i32 %key, metadata !673, metadata !DIExpression()), !dbg !671
  %0 = call i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* %this, i32 %key), !dbg !675
  %1 = icmp sge i64 %0, 0, !dbg !675
  ret i1 %1, !dbg !674
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$em.p1.en$Kind* @nish.Set$em.p1.en$Kind.add(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) %this, i32 noundef %key) #0 !dbg !680 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !682, metadata !DIExpression()), !dbg !681
  call void @llvm.dbg.value(metadata i32 %key, metadata !683, metadata !DIExpression()), !dbg !681
  %0 = call i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* %this, i32 %key), !dbg !685
  store i64 %0, i64* %found.addr, align 8, !dbg !684
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !687, metadata !DIExpression()), !dbg !684
  %1 = load i64, i64* %found.addr, align 8, !dbg !689
  %2 = icmp slt i64 %1, 0, !dbg !689
  br i1 %2, label %if.then, label %if.end, !dbg !688

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !693
  call void @nish.Set$em.p1.en$Kind.insertAt(%struct.Set$em.p1.en$Kind* %this, i64 %3, i32 %key), !dbg !692
  br label %if.end, !dbg !688

if.end:
  ret %struct.Set$em.p1.en$Kind* %this, !dbg !695
}

define internal void @nish.Set$em.p1.en$Kind.insertAt(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !699 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !701, metadata !DIExpression()), !dbg !700
  call void @llvm.dbg.value(metadata i64 %absent, metadata !702, metadata !DIExpression()), !dbg !700
  call void @llvm.dbg.value(metadata i32 %key, metadata !703, metadata !DIExpression()), !dbg !700
  %0 = sub nsw i64 -1, %absent, !dbg !705
  store i64 %0, i64* %packed.addr, align 8, !dbg !704
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !707, metadata !DIExpression()), !dbg !704
  %1 = load i64, i64* %packed.addr, align 8, !dbg !710
  %2 = ashr i64 %1, 32, !dbg !710
  %3 = trunc i64 %2 to i32, !dbg !709
  store i32 %3, i32* %bucket.addr, align 4, !dbg !708
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !711, metadata !DIExpression()), !dbg !708
  %4 = load i64, i64* %packed.addr, align 8, !dbg !714
  %5 = trunc i64 %4 to i32, !dbg !713
  store i32 %5, i32* %h.addr, align 4, !dbg !712
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !715, metadata !DIExpression()), !dbg !712
  %6 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !718
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !651, !dbg !718
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !718
  %9 = load i64, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !718
  %10 = trunc i64 %9 to i32, !dbg !718
  %11 = icmp sge i32 %10, 16777215, !dbg !717
  br i1 %11, label %if.then, label %if.end, !dbg !716

if.then:
  %12 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !722
  %13 = load i32, i32* %12, align 4, !tbaa !643, !dbg !722
  %14 = icmp sge i32 %13, 16777215, !dbg !722
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !722

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 6, !dbg !724
  %16 = load i32, i32* %15, align 4, !tbaa !644, !dbg !724
  %17 = icmp sgt i32 %16, 0, !dbg !724
  br label %lor.end, !dbg !722

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ], !dbg !722
  br i1 %18, label %if.then.1, label %if.end.1, !dbg !721

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*)), !dbg !727
  unreachable, !dbg !727

if.end.1:
  call void @nish.Set$em.p1.en$Kind.rebuild(%struct.Set$em.p1.en$Kind* %this), !dbg !729
  store i32 -1, i32* %bucket.addr, align 4, !dbg !730
  br label %if.end, !dbg !716

if.end:
  %19 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !732
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !651, !dbg !732
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !732
  %22 = load i64, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !732
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !732
  %24 = load i64, i64* %23, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !732
  %25 = icmp eq i64 %22, %24, !dbg !732
  br i1 %25, label %push.grow, label %push.store, !dbg !732

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4), !dbg !732
  br label %push.store, !dbg !732

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !732
  %27 = load i8*, i8** %26, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !732
  %28 = bitcast i8* %27 to i32*, !dbg !732
  %29 = getelementptr inbounds i32, i32* %28, i64 %22, !dbg !732
  store i32 %key, i32* %29, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !732
  %30 = add i64 %22, 1, !dbg !732
  store i64 %30, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !732
  %31 = trunc i64 %30 to i32, !dbg !732
  %32 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !734
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !654, !dbg !734
  %34 = load i32, i32* %h.addr, align 4, !dbg !735
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0, !dbg !734
  %36 = load i64, i64* %35, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !734
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1, !dbg !734
  %38 = load i64, i64* %37, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !734
  %39 = icmp eq i64 %36, %38, !dbg !734
  br i1 %39, label %push.grow.1, label %push.store.1, !dbg !734

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4), !dbg !734
  br label %push.store.1, !dbg !734

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2, !dbg !734
  %41 = load i8*, i8** %40, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !734
  %42 = bitcast i8* %41 to i32*, !dbg !734
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !734
  store i32 %34, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !734
  %44 = add i64 %36, 1, !dbg !734
  store i64 %44, i64* %35, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !734
  %45 = trunc i64 %44 to i32, !dbg !734
  %46 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !737
  %47 = load i32, i32* %46, align 4, !tbaa !643, !dbg !737
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1), !dbg !737
  %49 = extractvalue { i32, i1 } %48, 0, !dbg !737
  %50 = extractvalue { i32, i1 } %48, 1, !dbg !737
  br i1 %50, label %ovf.fail, label %ovf.ok, !dbg !737

ovf.ok:
  %51 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !736
  store i32 %49, i32* %51, align 4, !tbaa !643, !dbg !736
  %52 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !740
  %53 = load i32, i32* %52, align 4, !tbaa !641, !dbg !740
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 1), !dbg !740
  %55 = extractvalue { i32, i1 } %54, 0, !dbg !740
  %56 = extractvalue { i32, i1 } %54, 1, !dbg !740
  br i1 %56, label %ovf.fail.1, label %ovf.ok.1, !dbg !740

ovf.ok.1:
  %57 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !739
  store i32 %55, i32* %57, align 4, !tbaa !641, !dbg !739
  %58 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !744
  %59 = load %struct.nish_array*, %struct.nish_array** %58, align 8, !tbaa !651, !dbg !744
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0, !dbg !744
  %61 = load i64, i64* %60, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !744
  %62 = trunc i64 %61 to i32, !dbg !744
  store i32 %62, i32* %used.addr, align 4, !dbg !742
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !745, metadata !DIExpression()), !dbg !742
  %63 = load i32, i32* %used.addr, align 4, !dbg !747
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4), !dbg !747
  %65 = extractvalue { i32, i1 } %64, 0, !dbg !747
  %66 = extractvalue { i32, i1 } %64, 1, !dbg !747
  br i1 %66, label %ovf.fail.2, label %ovf.ok.2, !dbg !747

ovf.ok.2:
  %67 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !750
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !648, !dbg !750
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0, !dbg !750
  %70 = load i64, i64* %69, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !750
  %71 = trunc i64 %70 to i32, !dbg !750
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 3), !dbg !749
  %73 = extractvalue { i32, i1 } %72, 0, !dbg !749
  %74 = extractvalue { i32, i1 } %72, 1, !dbg !749
  br i1 %74, label %ovf.fail.3, label %ovf.ok.3, !dbg !749

ovf.ok.3:
  %75 = icmp sgt i32 %65, %73, !dbg !747
  br i1 %75, label %if.then.2, label %if.else, !dbg !746

if.then.2:
  call void @nish.Set$em.p1.en$Kind.rebuild(%struct.Set$em.p1.en$Kind* %this), !dbg !753
  br label %if.end.2, !dbg !746

if.else:
  %76 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !756
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !648, !dbg !756
  %78 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !757
  %79 = load i32, i32* %78, align 4, !tbaa !642, !dbg !757
  %80 = load i32, i32* %bucket.addr, align 4, !dbg !758
  %81 = load i32, i32* %h.addr, align 4, !dbg !759
  %82 = load i32, i32* %used.addr, align 4, !dbg !760
  call void @nish.fileAppended(%struct.nish_array* %77, i32 %79, i32 %80, i32 %81, i32 %82), !dbg !755
  br label %if.end.2, !dbg !746

if.end.2:
  ret void, !dbg !700

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !737
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 0), !dbg !740
  unreachable

ovf.fail.2:
  call void @nish_panic_overflow(i32 2), !dbg !747
  unreachable

ovf.fail.3:
  call void @nish_panic_overflow(i32 2), !dbg !749
  unreachable
}

define internal void @nish.Set$em.p1.en$Kind.rebuild(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !761 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !763, metadata !DIExpression()), !dbg !762
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !766
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !651, !dbg !766
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !766
  %3 = load i64, i64* %2, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !766
  %4 = trunc i64 %3 to i32, !dbg !766
  store i32 %4, i32* %used.addr, align 4, !dbg !764
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !767, metadata !DIExpression()), !dbg !764
  %5 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 6, !dbg !769
  %6 = load i32, i32* %5, align 4, !tbaa !644, !dbg !769
  %7 = icmp sgt i32 %6, 0, !dbg !769
  store i1 %7, i1* %walking.addr, align 1, !dbg !768
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !771, metadata !DIExpression()), !dbg !768
  %8 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !774
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !648, !dbg !774
  %10 = load i1, i1* %walking.addr, align 1, !dbg !775
  br i1 %10, label %cond.true, label %cond.false, !dbg !775

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !776
  br label %cond.end, !dbg !775

cond.false:
  %12 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !777
  %13 = load i32, i32* %12, align 4, !tbaa !643, !dbg !777
  br label %cond.end, !dbg !775

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !775
  %15 = load i32, i32* %used.addr, align 4, !dbg !778
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !773
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !772
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !779, metadata !DIExpression()), !dbg !772
  %17 = load i1, i1* %walking.addr, align 1, !dbg !782
  %18 = xor i1 %17, true, !dbg !781
  br i1 %18, label %land.rhs, label %land.end, !dbg !781

land.rhs:
  %19 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !783
  %20 = load i32, i32* %19, align 4, !tbaa !643, !dbg !783
  %21 = load i32, i32* %used.addr, align 4, !dbg !784
  %22 = icmp slt i32 %20, %21, !dbg !783
  br label %land.end, !dbg !781

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !781
  br i1 %23, label %if.then, label %if.end, !dbg !780

if.then:
  %24 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !787
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !651, !dbg !787
  %26 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !788
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !654, !dbg !788
  call void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !786
  %28 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !790
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !654, !dbg !790
  call void @nish.compactHashes(%struct.nish_array* %29), !dbg !789
  br label %if.end, !dbg !780

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !792
  %31 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !791
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !648, !dbg !791
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !795
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0, !dbg !795
  %34 = load i64, i64* %33, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !795
  %35 = trunc i64 %34 to i32, !dbg !795
  %36 = sub nsw i32 %35, 1, !dbg !794
  %37 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !793
  store i32 %36, i32* %37, align 4, !tbaa !642, !dbg !793
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !798
  %39 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !799
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !654, !dbg !799
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40), !dbg !797
  ret void, !dbg !762
}

define internal noundef i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !802 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !804, metadata !DIExpression()), !dbg !803
  call void @llvm.dbg.value(metadata i32 %mask, metadata !805, metadata !DIExpression()), !dbg !803
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !806, metadata !DIExpression()), !dbg !803
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !807, metadata !DIExpression()), !dbg !803
  call void @llvm.dbg.value(metadata i32 %key, metadata !808, metadata !DIExpression()), !dbg !803
  %0 = lshr i32 %key, 16, !dbg !810
  %1 = xor i32 %key, %0, !dbg !810
  %2 = mul i32 %1, -2048144789, !dbg !810
  %3 = lshr i32 %2, 13, !dbg !810
  %4 = xor i32 %2, %3, !dbg !810
  %5 = mul i32 %4, -1028477387, !dbg !810
  %6 = lshr i32 %5, 16, !dbg !810
  %7 = xor i32 %5, %6, !dbg !810
  %8 = icmp eq i32 %7, 0, !dbg !810
  %9 = select i1 %8, i32 1, i32 %7, !dbg !810
  store i32 %9, i32* %h.addr, align 4, !dbg !809
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !812, metadata !DIExpression()), !dbg !809
  %10 = load i32, i32* %h.addr, align 4, !dbg !814
  %11 = lshr i32 %10, 24, !dbg !814
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !813
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !815, metadata !DIExpression()), !dbg !813
  %12 = load i32, i32* %h.addr, align 4, !dbg !818
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !817
  store i32 %13, i32* %bucket.addr, align 4, !dbg !816
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !820, metadata !DIExpression()), !dbg !816
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !821
  %15 = load i64, i64* %14, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !821
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !821
  %17 = load i8*, i8** %16, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !821
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !821
  %19 = load i64, i64* %18, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !821
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !821
  %21 = load i8*, i8** %20, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !821
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !821
  %23 = load i64, i64* %22, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !821
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !821
  %25 = load i8*, i8** %24, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !821
  br label %while.cond, !dbg !821

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !825
  %27 = icmp sge i32 %26, 0, !dbg !825
  br i1 %27, label %land.rhs, label %land.end, !dbg !825

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !827
  %29 = trunc i64 %15 to i32, !dbg !822
  %30 = icmp slt i32 %28, %29, !dbg !827
  br label %land.end, !dbg !825

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !825
  br i1 %31, label %while.body, label %while.end, !dbg !821

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !832
  %33 = sext i32 %32 to i64, !dbg !831
  %34 = bitcast i8* %17 to i32*, !dbg !831
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !831
  %36 = load i32, i32* %35, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !831
  store i32 %36, i32* %word.addr, align 4, !dbg !830
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !833, metadata !DIExpression()), !dbg !830
  %37 = load i32, i32* %word.addr, align 4, !dbg !835
  %38 = icmp eq i32 %37, 0, !dbg !835
  br i1 %38, label %if.then, label %if.end, !dbg !834

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !840
  %40 = load i32, i32* %h.addr, align 4, !dbg !841
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !839
  ret i64 %41, !dbg !838

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !843
  %43 = lshr i32 %42, 24, !dbg !843
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !844
  %45 = icmp eq i32 %43, %44, !dbg !843
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !842

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !848
  %47 = and i32 %46, 16777215, !dbg !848
  %48 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %47, i32 1), !dbg !847
  %49 = extractvalue { i32, i1 } %48, 0, !dbg !847
  %50 = extractvalue { i32, i1 } %48, 1, !dbg !847
  br i1 %50, label %ovf.fail, label %ovf.ok, !dbg !847

ovf.ok:
  store i32 %49, i32* %at.addr, align 4, !dbg !846
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !851, metadata !DIExpression()), !dbg !846
  %51 = load i32, i32* %at.addr, align 4, !dbg !853
  %52 = icmp sge i32 %51, 0, !dbg !853
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !853

land.rhs.4:
  %53 = load i32, i32* %at.addr, align 4, !dbg !855
  %54 = trunc i64 %19 to i32, !dbg !823
  %55 = icmp slt i32 %53, %54, !dbg !855
  br label %land.end.4, !dbg !853

land.end.4:
  %56 = phi i1 [ false, %ovf.ok ], [ %55, %land.rhs.4 ], !dbg !853
  br i1 %56, label %land.rhs.3, label %land.end.3, !dbg !853

land.rhs.3:
  %57 = load i32, i32* %at.addr, align 4, !dbg !858
  %58 = sext i32 %57 to i64, !dbg !857
  %59 = bitcast i8* %21 to i32*, !dbg !857
  %60 = getelementptr inbounds i32, i32* %59, i64 %58, !dbg !857
  %61 = load i32, i32* %60, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !857
  %62 = load i32, i32* %h.addr, align 4, !dbg !859
  %63 = icmp eq i32 %61, %62, !dbg !857
  br label %land.end.3, !dbg !853

land.end.3:
  %64 = phi i1 [ false, %land.end.4 ], [ %63, %land.rhs.3 ], !dbg !853
  br i1 %64, label %land.rhs.2, label %land.end.2, !dbg !853

land.rhs.2:
  %65 = load i32, i32* %at.addr, align 4, !dbg !860
  %66 = trunc i64 %23 to i32, !dbg !824
  %67 = icmp slt i32 %65, %66, !dbg !860
  br label %land.end.2, !dbg !853

land.end.2:
  %68 = phi i1 [ false, %land.end.3 ], [ %67, %land.rhs.2 ], !dbg !853
  br i1 %68, label %land.rhs.1, label %land.end.1, !dbg !853

land.rhs.1:
  %69 = load i32, i32* %at.addr, align 4, !dbg !864
  %70 = sext i32 %69 to i64, !dbg !863
  %71 = bitcast i8* %25 to i32*, !dbg !863
  %72 = getelementptr inbounds i32, i32* %71, i64 %70, !dbg !863
  %73 = load i32, i32* %72, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !863
  %74 = icmp eq i32 %73, %key, !dbg !862
  br label %land.end.1, !dbg !853

land.end.1:
  %75 = phi i1 [ false, %land.end.2 ], [ %74, %land.rhs.1 ], !dbg !853
  br i1 %75, label %if.then.2, label %if.end.2, !dbg !852

if.then.2:
  %76 = load i32, i32* %bucket.addr, align 4, !dbg !869
  %77 = load i32, i32* %at.addr, align 4, !dbg !870
  %78 = tail call i64 @nish.foundAt(i32 %76, i32 %77), !dbg !868
  ret i64 %78, !dbg !867

if.end.2:
  br label %if.end.1, !dbg !842

if.end.1:
  %79 = load i32, i32* %bucket.addr, align 4, !dbg !873
  %80 = add nsw i32 %79, 1, !dbg !873
  %81 = and i32 %80, %mask, !dbg !872
  store i32 %81, i32* %bucket.addr, align 4, !dbg !871
  br label %while.cond, !dbg !821

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*)), !dbg !876
  unreachable, !dbg !876

ovf.fail:
  call void @nish_panic_overflow(i32 1), !dbg !847
  unreachable
}

define internal void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !880 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !882, metadata !DIExpression()), !dbg !881
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !883, metadata !DIExpression()), !dbg !881
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !886
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !886
  %2 = trunc i64 %1 to i32, !dbg !886
  store i32 %2, i32* %used.addr, align 4, !dbg !884
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !887, metadata !DIExpression()), !dbg !884
  store i32 0, i32* %to.addr, align 4, !dbg !888
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !890, metadata !DIExpression()), !dbg !888
  store i32 0, i32* %from.addr, align 4, !dbg !891
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !893, metadata !DIExpression()), !dbg !891
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !891
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !891
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !891
  %6 = load i8*, i8** %5, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !891
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !891
  %8 = load i64, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !891
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !891
  %10 = load i8*, i8** %9, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !891
  br label %for.cond, !dbg !891

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !896
  %12 = load i32, i32* %used.addr, align 4, !dbg !897
  %13 = icmp slt i32 %11, %12, !dbg !896
  br i1 %13, label %land.rhs, label %land.end, !dbg !896

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !898
  %15 = trunc i64 %4 to i32, !dbg !894
  %16 = icmp slt i32 %14, %15, !dbg !898
  br label %land.end, !dbg !896

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !896
  br i1 %17, label %for.body, label %for.end, !dbg !891

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !903
  %19 = sext i32 %18 to i64, !dbg !902
  %20 = bitcast i8* %6 to i32*, !dbg !902
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !902
  %22 = load i32, i32* %21, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !902
  %23 = icmp ne i32 %22, 0, !dbg !902
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !902

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !905
  %25 = icmp sge i32 %24, 0, !dbg !905
  br label %land.end.3, !dbg !902

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !902
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !902

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !907
  %28 = load i32, i32* %used.addr, align 4, !dbg !908
  %29 = icmp slt i32 %27, %28, !dbg !907
  br label %land.end.2, !dbg !902

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !902
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !902

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !909
  %32 = trunc i64 %8 to i32, !dbg !895
  %33 = icmp slt i32 %31, %32, !dbg !909
  br label %land.end.1, !dbg !902

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !902
  br i1 %34, label %if.then, label %if.end, !dbg !901

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !913
  %36 = sext i32 %35 to i64, !dbg !912
  %37 = load i32, i32* %from.addr, align 4, !dbg !915
  %38 = sext i32 %37 to i64, !dbg !914
  %39 = bitcast i8* %10 to i32*, !dbg !914
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !914
  %41 = load i32, i32* %40, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !914
  %42 = bitcast i8* %10 to i32*, !dbg !912
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !912
  store i32 %41, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !912
  %44 = load i32, i32* %to.addr, align 4, !dbg !916
  %45 = add nsw i32 %44, 1, !dbg !916
  store i32 %45, i32* %to.addr, align 4, !dbg !916
  br label %if.end, !dbg !901

if.end:
  br label %for.inc, !dbg !891

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !917
  %47 = add nsw i32 %46, 1, !dbg !917
  store i32 %47, i32* %from.addr, align 4, !dbg !917
  br label %for.cond, !dbg !891

for.end:
  br label %while.cond, !dbg !918

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !920
  %49 = load i64, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !920
  %50 = trunc i64 %49 to i32, !dbg !920
  %51 = load i32, i32* %to.addr, align 4, !dbg !921
  %52 = icmp sgt i32 %50, %51, !dbg !919
  br i1 %52, label %while.body, label %while.end, !dbg !918

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !923
  %54 = load i64, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !923
  %55 = icmp eq i64 %54, 0, !dbg !923
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !923

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !923
  unreachable, !dbg !923

pop.ok:
  %56 = sub i64 %54, 1, !dbg !923
  store i64 %56, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !923
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !923
  %58 = load i8*, i8** %57, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !923
  %59 = bitcast i8* %58 to i32*, !dbg !923
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !923
  %61 = load i32, i32* %60, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !923
  br label %while.cond, !dbg !918

while.end:
  ret void, !dbg !881
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !926 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !928, metadata !DIExpression()), !dbg !927
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !929, metadata !DIExpression()), !dbg !927
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !932
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !932
  %2 = trunc i64 %1 to i32, !dbg !932
  store i32 %2, i32* %used.addr, align 4, !dbg !930
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !933, metadata !DIExpression()), !dbg !930
  store i32 0, i32* %to.addr, align 4, !dbg !934
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !936, metadata !DIExpression()), !dbg !934
  store i32 0, i32* %from.addr, align 4, !dbg !937
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !939, metadata !DIExpression()), !dbg !937
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !937
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !937
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !937
  %6 = load i8*, i8** %5, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !937
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !937
  %8 = load i64, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !937
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !937
  %10 = load i8*, i8** %9, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !937
  br label %for.cond, !dbg !937

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !942
  %12 = load i32, i32* %used.addr, align 4, !dbg !943
  %13 = icmp slt i32 %11, %12, !dbg !942
  br i1 %13, label %land.rhs, label %land.end, !dbg !942

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !944
  %15 = trunc i64 %4 to i32, !dbg !940
  %16 = icmp slt i32 %14, %15, !dbg !944
  br label %land.end, !dbg !942

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !942
  br i1 %17, label %for.body, label %for.end, !dbg !937

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !949
  %19 = sext i32 %18 to i64, !dbg !948
  %20 = bitcast i8* %6 to i32*, !dbg !948
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !948
  %22 = load i32, i32* %21, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !948
  %23 = icmp ne i32 %22, 0, !dbg !948
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !948

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !951
  %25 = icmp sge i32 %24, 0, !dbg !951
  br label %land.end.3, !dbg !948

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !948
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !948

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !953
  %28 = load i32, i32* %used.addr, align 4, !dbg !954
  %29 = icmp slt i32 %27, %28, !dbg !953
  br label %land.end.2, !dbg !948

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !948
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !948

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !955
  %32 = trunc i64 %8 to i32, !dbg !941
  %33 = icmp slt i32 %31, %32, !dbg !955
  br label %land.end.1, !dbg !948

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !948
  br i1 %34, label %if.then, label %if.end, !dbg !947

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !959
  %36 = sext i32 %35 to i64, !dbg !958
  %37 = load i32, i32* %from.addr, align 4, !dbg !961
  %38 = sext i32 %37 to i64, !dbg !960
  %39 = bitcast i8* %10 to i32*, !dbg !960
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !960
  %41 = load i32, i32* %40, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !960
  %42 = bitcast i8* %10 to i32*, !dbg !958
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !958
  store i32 %41, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !958
  %44 = load i32, i32* %to.addr, align 4, !dbg !962
  %45 = add nsw i32 %44, 1, !dbg !962
  store i32 %45, i32* %to.addr, align 4, !dbg !962
  br label %if.end, !dbg !947

if.end:
  br label %for.inc, !dbg !937

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !963
  %47 = add nsw i32 %46, 1, !dbg !963
  store i32 %47, i32* %from.addr, align 4, !dbg !963
  br label %for.cond, !dbg !937

for.end:
  br label %while.cond, !dbg !964

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !966
  %49 = load i64, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !966
  %50 = trunc i64 %49 to i32, !dbg !966
  %51 = load i32, i32* %to.addr, align 4, !dbg !967
  %52 = icmp sgt i32 %50, %51, !dbg !965
  br i1 %52, label %while.body, label %while.end, !dbg !964

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !969
  %54 = load i64, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !969
  %55 = icmp eq i64 %54, 0, !dbg !969
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !969

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !969
  unreachable, !dbg !969

pop.ok:
  %56 = sub i64 %54, 1, !dbg !969
  store i64 %56, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !969
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !969
  %58 = load i8*, i8** %57, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !969
  %59 = bitcast i8* %58 to i32*, !dbg !969
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !969
  %61 = load i32, i32* %60, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !969
  br label %while.cond, !dbg !964

while.end:
  ret void, !dbg !927
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/enum_member_type_slots.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 30, type: !6, scopeLine: 30, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 30, column: 1, scope: !7)
!9 = !DILocation(line: 31, column: 3, scope: !7)
!10 = !DILocation(line: 31, column: 18, scope: !7)
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<Kind.Array, i32>", file: !13, line: 273, size: 448, align: 64, elements: !50)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 275, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 277, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 279, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 281, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Kind.Array[]", file: !1, size: 192, align: 64, elements: !37)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIEnumerator(name: "Scalar", value: 0)
!31 = !DIEnumerator(name: "Array", value: 1)
!32 = !DIEnumerator(name: "List", value: 1)
!33 = !{!30, !31, !32}
!34 = !DICompositeType(tag: DW_TAG_enumeration_type, name: "Kind", file: !1, line: 9, size: 32, align: 32, elements: !33, baseType: !4)
!35 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !34, size: 64)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !35, size: 64, offset: 128)
!37 = !{!28, !29, !36}
!38 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 282, baseType: !38, size: 64, offset: 192)
!40 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !45)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !40, baseType: !16, size: 64, offset: 0)
!42 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !40, baseType: !16, size: 64, offset: 64)
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !40, baseType: !43, size: 64, offset: 128)
!45 = !{!41, !42, !44}
!46 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !40, size: 64)
!47 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 283, baseType: !46, size: 64, offset: 256)
!48 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 285, baseType: !23, size: 64, offset: 320)
!49 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 291, baseType: !4, size: 32, offset: 384)
!50 = !{!14, !24, !25, !26, !39, !47, !48, !49}
!51 = !DILocalVariable(name: "counts", scope: !7, file: !1, line: 31, type: !12)
!52 = !DILocation(line: 32, column: 3, scope: !7)
!53 = !DILocation(line: 32, column: 14, scope: !7)
!54 = !DILocation(line: 32, column: 26, scope: !7)
!55 = !DILocation(line: 33, column: 3, scope: !7)
!56 = !DILocation(line: 33, column: 16, scope: !7)
!57 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<Kind.Array>", file: !13, line: 468, size: 384, align: 64, elements: !66)
!58 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !57, size: 64)
!59 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !57, file: !13, line: 470, baseType: !4, size: 32, offset: 0)
!60 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !57, file: !13, line: 471, baseType: !23, size: 64, offset: 64)
!61 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !57, file: !13, line: 472, baseType: !4, size: 32, offset: 128)
!62 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !57, file: !13, line: 473, baseType: !4, size: 32, offset: 160)
!63 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !57, file: !13, line: 474, baseType: !38, size: 64, offset: 192)
!64 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !57, file: !13, line: 475, baseType: !23, size: 64, offset: 256)
!65 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !57, file: !13, line: 477, baseType: !4, size: 32, offset: 320)
!66 = !{!59, !60, !61, !62, !63, !64, !65}
!67 = !DILocalVariable(name: "seen", scope: !7, file: !1, line: 33, type: !58)
!68 = !DILocation(line: 34, column: 3, scope: !7)
!69 = !DILocation(line: 34, column: 12, scope: !7)
!70 = !DILocation(line: 35, column: 3, scope: !7)
!71 = !DILocation(line: 35, column: 30, scope: !7)
!72 = !{!"nish array"}
!73 = !{!"header", !72}
!74 = !{!"elements", !72}
!75 = !{!73}
!76 = !{!74}
!77 = !{!"nish TBAA"}
!78 = !{!"omnipotent char", !77, i64 0}
!79 = !{!"header i64", !78, i64 0}
!80 = !{!"header ptr", !78, i64 0}
!81 = !{!"array header", !79, i64 0, !79, i64 8, !80, i64 16}
!82 = !{!81, !79, i64 0}
!83 = !{!81, !79, i64 8}
!84 = !{!81, !80, i64 16}
!85 = !DILocalVariable(name: "tags", scope: !7, file: !1, line: 35, type: !38)
!86 = !DILocation(line: 36, column: 3, scope: !7)
!87 = !DILocation(line: 36, column: 13, scope: !7)
!88 = !{!"element i32", !78, i64 0}
!89 = !{!88, !88, i64 0}
!90 = !DILocation(line: 37, column: 3, scope: !7)
!91 = !DILocation(line: 37, column: 13, scope: !7)
!92 = !DILocation(line: 38, column: 3, scope: !7)
!93 = !DILocation(line: 38, column: 17, scope: !7)
!94 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Kind.Scalar[]", file: !1, size: 192, align: 64, elements: !98)
!95 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !94, baseType: !16, size: 64, offset: 0)
!96 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !94, baseType: !16, size: 64, offset: 64)
!97 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !94, baseType: !35, size: 64, offset: 128)
!98 = !{!95, !96, !97}
!99 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !94, size: 64)
!100 = !DILocalVariable(name: "zeros", scope: !7, file: !1, line: 38, type: !99)
!101 = !DILocation(line: 39, column: 3, scope: !7)
!102 = !DILocation(line: 39, column: 27, scope: !7)
!103 = !DILocalVariable(name: "alias", scope: !7, file: !1, line: 39, type: !34)
!104 = !DILocation(line: 40, column: 3, scope: !7)
!105 = !DILocation(line: 40, column: 15, scope: !7)
!106 = !DILocation(line: 40, column: 35, scope: !7)
!107 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Box<Kind.Array>", file: !1, line: 17, size: 32, align: 32, elements: !110)
!108 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !107, size: 64)
!109 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !107, file: !1, line: 18, baseType: !34, size: 32, offset: 0)
!110 = !{!109}
!111 = !DILocalVariable(name: "box", scope: !7, file: !1, line: 40, type: !108)
!112 = !DILocation(line: 41, column: 3, scope: !7)
!113 = !DILocation(line: 41, column: 13, scope: !7)
!114 = !{!"i32", !78, i64 0}
!115 = !{!"Node", !114, i64 0}
!116 = !{!115, !114, i64 0}
!117 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Node", file: !1, line: 26, size: 32, align: 32, elements: !120)
!118 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !117, size: 64)
!119 = !DIDerivedType(tag: DW_TAG_member, name: "kind", scope: !117, file: !1, line: 27, baseType: !34, size: 32, offset: 0)
!120 = !{!119}
!121 = !DILocalVariable(name: "n", scope: !7, file: !1, line: 41, type: !118)
!122 = !DILocation(line: 42, column: 3, scope: !7)
!123 = !DILocation(line: 42, column: 18, scope: !7)
!124 = !DILocalVariable(name: "called", scope: !7, file: !1, line: 42, type: !34)
!125 = !DILocation(line: 43, column: 3, scope: !7)
!126 = !DILocation(line: 43, column: 15, scope: !7)
!127 = !DILocalVariable(name: "total", scope: !7, file: !1, line: 43, type: !4)
!128 = !DILocation(line: 44, column: 3, scope: !7)
!129 = !DILocation(line: 44, column: 11, scope: !7)
!130 = !DILocation(line: 44, column: 19, scope: !7)
!131 = !DILocation(line: 44, column: 20, scope: !7)
!132 = !DILocation(line: 44, column: 31, scope: !7)
!133 = !DILocation(line: 44, column: 46, scope: !7)
!134 = !DILocation(line: 45, column: 3, scope: !7)
!135 = !DILocation(line: 45, column: 11, scope: !7)
!136 = !DILocation(line: 45, column: 19, scope: !7)
!137 = !DILocation(line: 45, column: 20, scope: !7)
!138 = !DILocation(line: 45, column: 29, scope: !7)
!139 = !DILocation(line: 45, column: 43, scope: !7)
!140 = !DILocation(line: 45, column: 48, scope: !7)
!141 = !DILocation(line: 46, column: 3, scope: !7)
!142 = !DILocation(line: 46, column: 11, scope: !7)
!143 = !DILocation(line: 46, column: 19, scope: !7)
!144 = !DILocation(line: 46, column: 33, scope: !7)
!145 = !DILocation(line: 47, column: 3, scope: !7)
!146 = !DILocation(line: 47, column: 11, scope: !7)
!147 = !DILocation(line: 47, column: 19, scope: !7)
!148 = !DILocation(line: 47, column: 20, scope: !7)
!149 = !DILocation(line: 47, column: 33, scope: !7)
!150 = !DILocation(line: 47, column: 47, scope: !7)
!151 = !DILocation(line: 47, column: 54, scope: !7)
!152 = !DILocation(line: 48, column: 3, scope: !7)
!153 = !DILocation(line: 48, column: 11, scope: !7)
!154 = !DILocation(line: 48, column: 19, scope: !7)
!155 = !DILocation(line: 48, column: 20, scope: !7)
!156 = !DILocation(line: 48, column: 30, scope: !7)
!157 = !DILocation(line: 48, column: 43, scope: !7)
!158 = !DILocation(line: 48, column: 51, scope: !7)
!159 = !DILocation(line: 49, column: 3, scope: !7)
!160 = !DILocation(line: 49, column: 11, scope: !7)
!161 = !DILocation(line: 49, column: 19, scope: !7)
!162 = !DILocation(line: 49, column: 20, scope: !7)
!163 = !{!"Box$em.p1.en$Kind", !114, i64 0}
!164 = !{!163, !114, i64 0}
!165 = !DILocation(line: 49, column: 34, scope: !7)
!166 = !DILocation(line: 49, column: 46, scope: !7)
!167 = !DILocation(line: 49, column: 55, scope: !7)
!168 = !DILocation(line: 50, column: 3, scope: !7)
!169 = !DILocation(line: 50, column: 11, scope: !7)
!170 = !DILocation(line: 50, column: 19, scope: !7)
!171 = !DILocation(line: 50, column: 20, scope: !7)
!172 = !DILocation(line: 50, column: 31, scope: !7)
!173 = !DILocation(line: 50, column: 44, scope: !7)
!174 = !DILocation(line: 50, column: 54, scope: !7)
!175 = !DILocation(line: 51, column: 3, scope: !7)
!176 = !DILocation(line: 51, column: 11, scope: !7)
!177 = !DILocation(line: 51, column: 19, scope: !7)
!178 = !DILocation(line: 51, column: 20, scope: !7)
!179 = !DILocation(line: 51, column: 31, scope: !7)
!180 = !DILocation(line: 51, column: 44, scope: !7)
!181 = !DILocation(line: 51, column: 55, scope: !7)
!182 = !DILocation(line: 52, column: 3, scope: !7)
!183 = !DILocation(line: 52, column: 10, scope: !7)
!184 = !{null, !108, !34}
!185 = !DISubroutineType(types: !184)
!186 = distinct !DISubprogram(name: "Box<Kind.Array>.constructor", linkageName: "Box$em.p1.en$Kind.constructor", scope: !1, file: !1, line: 19, type: !185, scopeLine: 19, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!187 = !DILocation(line: 19, column: 3, scope: !186)
!188 = !DILocalVariable(name: "this", arg: 1, scope: !186, file: !1, line: 19, type: !108, flags: DIFlagArtificial | DIFlagObjectPointer)
!189 = !DILocalVariable(name: "value", arg: 2, scope: !186, file: !1, line: 19, type: !34)
!190 = !DILocation(line: 20, column: 5, scope: !186)
!191 = !DILocation(line: 20, column: 18, scope: !186)
!192 = !{!34}
!193 = !DISubroutineType(types: !192)
!194 = distinct !DISubprogram(name: "() => ...", linkageName: "test$arrow0", scope: !1, file: !1, line: 42, type: !193, scopeLine: 42, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!195 = !DILocation(line: 42, column: 23, scope: !194)
!196 = !DILocation(line: 42, column: 41, scope: !194)
!197 = distinct !DISubprogram(name: "call<() => ...>", linkageName: "call$fn.11.test$arrow0", scope: !1, file: !1, line: 24, type: !193, scopeLine: 24, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!198 = !DILocation(line: 24, column: 1, scope: !197)
!199 = !DILocation(line: 24, column: 51, scope: !197)
!200 = !{!4, !19, !4}
!201 = !DISubroutineType(types: !200)
!202 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 79, type: !201, scopeLine: 79, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!203 = !DILocation(line: 79, column: 1, scope: !202)
!204 = !DILocalVariable(name: "h", arg: 1, scope: !202, file: !13, line: 79, type: !19)
!205 = !DILocalVariable(name: "mask", arg: 2, scope: !202, file: !13, line: 79, type: !4)
!206 = !DILocation(line: 79, column: 48, scope: !202)
!207 = !DILocation(line: 79, column: 54, scope: !202)
!208 = !DILocation(line: 79, column: 58, scope: !202)
!209 = !DILocation(line: 79, column: 59, scope: !202)
!210 = !DILocation(line: 79, column: 72, scope: !202)
!211 = !{!19, !19, !4}
!212 = !DISubroutineType(types: !211)
!213 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 82, type: !212, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!214 = !DILocation(line: 82, column: 1, scope: !213)
!215 = !DILocalVariable(name: "h", arg: 1, scope: !213, file: !13, line: 82, type: !19)
!216 = !DILocalVariable(name: "index", arg: 2, scope: !213, file: !13, line: 82, type: !4)
!217 = !DILocation(line: 82, column: 47, scope: !213)
!218 = !DILocation(line: 82, column: 48, scope: !213)
!219 = !DILocation(line: 82, column: 49, scope: !213)
!220 = !DILocation(line: 82, column: 68, scope: !213)
!221 = !DILocation(line: 82, column: 74, scope: !213)
!222 = !DILocation(line: 82, column: 82, scope: !213)
!223 = !{!16, !4, !4}
!224 = !DISubroutineType(types: !223)
!225 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 85, type: !224, scopeLine: 85, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!226 = !DILocation(line: 85, column: 1, scope: !225)
!227 = !DILocalVariable(name: "bucket", arg: 1, scope: !225, file: !13, line: 85, type: !4)
!228 = !DILocalVariable(name: "index", arg: 2, scope: !225, file: !13, line: 85, type: !4)
!229 = !DILocation(line: 85, column: 51, scope: !225)
!230 = !DILocation(line: 85, column: 52, scope: !225)
!231 = !DILocation(line: 85, column: 58, scope: !225)
!232 = !DILocation(line: 85, column: 75, scope: !225)
!233 = !DILocation(line: 85, column: 81, scope: !225)
!234 = !{!16, !4, !19}
!235 = !DISubroutineType(types: !234)
!236 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 88, type: !235, scopeLine: 88, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!237 = !DILocation(line: 88, column: 1, scope: !236)
!238 = !DILocalVariable(name: "bucket", arg: 1, scope: !236, file: !13, line: 88, type: !4)
!239 = !DILocalVariable(name: "h", arg: 2, scope: !236, file: !13, line: 88, type: !19)
!240 = !DILocation(line: 88, column: 48, scope: !236)
!241 = !DILocation(line: 88, column: 54, scope: !236)
!242 = !DILocation(line: 88, column: 60, scope: !236)
!243 = !DILocation(line: 88, column: 61, scope: !236)
!244 = !DILocation(line: 88, column: 62, scope: !236)
!245 = !DILocation(line: 88, column: 68, scope: !236)
!246 = !DILocation(line: 88, column: 85, scope: !236)
!247 = !DILocation(line: 88, column: 91, scope: !236)
!248 = !{null, !23, !4, !19, !4}
!249 = !DISubroutineType(types: !248)
!250 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 130, type: !249, scopeLine: 130, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!251 = !DILocation(line: 130, column: 1, scope: !250)
!252 = !DILocalVariable(name: "slots", arg: 1, scope: !250, file: !13, line: 130, type: !23)
!253 = !DILocalVariable(name: "mask", arg: 2, scope: !250, file: !13, line: 130, type: !4)
!254 = !DILocalVariable(name: "h", arg: 3, scope: !250, file: !13, line: 130, type: !19)
!255 = !DILocalVariable(name: "index", arg: 4, scope: !250, file: !13, line: 130, type: !4)
!256 = !DILocation(line: 131, column: 3, scope: !250)
!257 = !DILocation(line: 131, column: 16, scope: !250)
!258 = !DILocation(line: 131, column: 25, scope: !250)
!259 = !DILocation(line: 131, column: 28, scope: !250)
!260 = !DILocalVariable(name: "word", scope: !250, file: !13, line: 131, type: !19)
!261 = !DILocation(line: 132, column: 3, scope: !250)
!262 = !DILocation(line: 132, column: 16, scope: !250)
!263 = !DILocation(line: 132, column: 27, scope: !250)
!264 = !DILocation(line: 132, column: 30, scope: !250)
!265 = !DILocalVariable(name: "bucket", scope: !250, file: !13, line: 132, type: !4)
!266 = !DILocation(line: 133, column: 3, scope: !250)
!267 = !DILocation(line: 133, column: 40, scope: !250)
!268 = !DILocation(line: 133, column: 10, scope: !250)
!269 = !DILocation(line: 133, column: 20, scope: !250)
!270 = !DILocation(line: 133, column: 25, scope: !250)
!271 = !DILocation(line: 133, column: 34, scope: !250)
!272 = !DILocation(line: 133, column: 55, scope: !250)
!273 = !DILocation(line: 134, column: 5, scope: !250)
!274 = !DILocation(line: 134, column: 9, scope: !250)
!275 = !DILocation(line: 134, column: 15, scope: !250)
!276 = !DILocation(line: 134, column: 27, scope: !250)
!277 = !DILocation(line: 134, column: 30, scope: !250)
!278 = !DILocation(line: 135, column: 7, scope: !250)
!279 = !DILocation(line: 135, column: 13, scope: !250)
!280 = !DILocation(line: 135, column: 23, scope: !250)
!281 = !DILocation(line: 136, column: 7, scope: !250)
!282 = !DILocation(line: 138, column: 5, scope: !250)
!283 = !DILocation(line: 138, column: 14, scope: !250)
!284 = !DILocation(line: 138, column: 15, scope: !250)
!285 = !DILocation(line: 138, column: 24, scope: !250)
!286 = !DILocation(line: 138, column: 29, scope: !250)
!287 = !{null, !23}
!288 = !DISubroutineType(types: !287)
!289 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 158, type: !288, scopeLine: 158, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!290 = !DILocation(line: 158, column: 1, scope: !289)
!291 = !DILocalVariable(name: "hashes", arg: 1, scope: !289, file: !13, line: 158, type: !23)
!292 = !DILocation(line: 159, column: 3, scope: !289)
!293 = !DILocation(line: 159, column: 16, scope: !289)
!294 = !DILocation(line: 159, column: 22, scope: !289)
!295 = !DILocalVariable(name: "used", scope: !289, file: !13, line: 159, type: !4)
!296 = !DILocation(line: 160, column: 3, scope: !289)
!297 = !DILocation(line: 160, column: 17, scope: !289)
!298 = !DILocalVariable(name: "to", scope: !289, file: !13, line: 160, type: !4)
!299 = !DILocation(line: 161, column: 3, scope: !289)
!300 = !DILocation(line: 161, column: 24, scope: !289)
!301 = !DILocalVariable(name: "from", scope: !289, file: !13, line: 161, type: !4)
!302 = !DILocation(line: 162, column: 15, scope: !289)
!303 = !DILocation(line: 161, column: 27, scope: !289)
!304 = !DILocation(line: 161, column: 34, scope: !289)
!305 = !DILocation(line: 161, column: 48, scope: !289)
!306 = !DILocation(line: 162, column: 5, scope: !289)
!307 = !DILocation(line: 162, column: 22, scope: !289)
!308 = !DILocalVariable(name: "h", scope: !289, file: !13, line: 162, type: !19)
!309 = !DILocation(line: 163, column: 5, scope: !289)
!310 = !DILocation(line: 163, column: 9, scope: !289)
!311 = !DILocation(line: 163, column: 15, scope: !289)
!312 = !DILocation(line: 163, column: 20, scope: !289)
!313 = !DILocation(line: 163, column: 26, scope: !289)
!314 = !DILocation(line: 163, column: 31, scope: !289)
!315 = !DILocation(line: 163, column: 36, scope: !289)
!316 = !DILocation(line: 163, column: 42, scope: !289)
!317 = !DILocation(line: 164, column: 7, scope: !289)
!318 = !DILocation(line: 164, column: 14, scope: !289)
!319 = !DILocation(line: 164, column: 20, scope: !289)
!320 = !DILocation(line: 165, column: 7, scope: !289)
!321 = !DILocation(line: 161, column: 40, scope: !289)
!322 = !DILocation(line: 168, column: 3, scope: !289)
!323 = !DILocation(line: 168, column: 10, scope: !289)
!324 = !DILocation(line: 168, column: 16, scope: !289)
!325 = !DILocation(line: 168, column: 33, scope: !289)
!326 = !DILocation(line: 168, column: 37, scope: !289)
!327 = !DILocation(line: 169, column: 5, scope: !289)
!328 = !{!23, !23, !4, !4}
!329 = !DISubroutineType(types: !328)
!330 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 180, type: !329, scopeLine: 180, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!331 = !DILocation(line: 180, column: 1, scope: !330)
!332 = !DILocalVariable(name: "slots", arg: 1, scope: !330, file: !13, line: 180, type: !23)
!333 = !DILocalVariable(name: "live", arg: 2, scope: !330, file: !13, line: 180, type: !4)
!334 = !DILocalVariable(name: "used", arg: 3, scope: !330, file: !13, line: 180, type: !4)
!335 = !DILocation(line: 181, column: 3, scope: !330)
!336 = !DILocation(line: 181, column: 13, scope: !330)
!337 = !DILocation(line: 181, column: 19, scope: !330)
!338 = !DILocalVariable(name: "n", scope: !330, file: !13, line: 181, type: !4)
!339 = !DILocation(line: 182, column: 3, scope: !330)
!340 = !DILocation(line: 182, column: 7, scope: !330)
!341 = !DILocation(line: 182, column: 14, scope: !330)
!342 = !DILocation(line: 182, column: 18, scope: !330)
!343 = !DILocation(line: 182, column: 24, scope: !330)
!344 = !DILocation(line: 183, column: 5, scope: !330)
!345 = !DILocation(line: 183, column: 16, scope: !330)
!346 = !DILocation(line: 184, column: 5, scope: !330)
!347 = !DILocation(line: 184, column: 12, scope: !330)
!348 = !DILocation(line: 186, column: 3, scope: !330)
!349 = !DILocation(line: 186, column: 10, scope: !330)
!350 = !DILocation(line: 186, column: 25, scope: !330)
!351 = !DILocation(line: 186, column: 29, scope: !330)
!352 = !{null, !23, !23}
!353 = !DISubroutineType(types: !352)
!354 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 194, type: !353, scopeLine: 194, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!355 = !DILocation(line: 194, column: 1, scope: !354)
!356 = !DILocalVariable(name: "slots", arg: 1, scope: !354, file: !13, line: 194, type: !23)
!357 = !DILocalVariable(name: "hashes", arg: 2, scope: !354, file: !13, line: 194, type: !23)
!358 = !DILocation(line: 195, column: 3, scope: !354)
!359 = !DILocation(line: 195, column: 16, scope: !354)
!360 = !DILocation(line: 195, column: 22, scope: !354)
!361 = !DILocation(line: 195, column: 38, scope: !354)
!362 = !DILocalVariable(name: "mask", scope: !354, file: !13, line: 195, type: !4)
!363 = !DILocation(line: 196, column: 3, scope: !354)
!364 = !DILocation(line: 196, column: 21, scope: !354)
!365 = !DILocalVariable(name: "i", scope: !354, file: !13, line: 196, type: !4)
!366 = !DILocation(line: 196, column: 34, scope: !354)
!367 = !DILocation(line: 196, column: 24, scope: !354)
!368 = !DILocation(line: 196, column: 28, scope: !354)
!369 = !DILocation(line: 196, column: 55, scope: !354)
!370 = !DILocation(line: 197, column: 5, scope: !354)
!371 = !DILocation(line: 197, column: 15, scope: !354)
!372 = !DILocation(line: 197, column: 22, scope: !354)
!373 = !DILocalVariable(name: "h", scope: !354, file: !13, line: 197, type: !19)
!374 = !DILocation(line: 198, column: 5, scope: !354)
!375 = !DILocation(line: 198, column: 9, scope: !354)
!376 = !DILocation(line: 198, column: 15, scope: !354)
!377 = !DILocation(line: 198, column: 18, scope: !354)
!378 = !DILocation(line: 199, column: 7, scope: !354)
!379 = !DILocation(line: 199, column: 17, scope: !354)
!380 = !DILocation(line: 199, column: 24, scope: !354)
!381 = !DILocation(line: 199, column: 30, scope: !354)
!382 = !DILocation(line: 199, column: 33, scope: !354)
!383 = !DILocation(line: 196, column: 50, scope: !354)
!384 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 225, type: !288, scopeLine: 225, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!385 = !DILocation(line: 225, column: 1, scope: !384)
!386 = !DILocalVariable(name: "slots", arg: 1, scope: !384, file: !13, line: 225, type: !23)
!387 = !DILocation(line: 226, column: 3, scope: !384)
!388 = !DILocation(line: 226, column: 21, scope: !384)
!389 = !DILocalVariable(name: "i", scope: !384, file: !13, line: 226, type: !4)
!390 = !DILocation(line: 226, column: 34, scope: !384)
!391 = !DILocation(line: 226, column: 24, scope: !384)
!392 = !DILocation(line: 226, column: 28, scope: !384)
!393 = !DILocation(line: 226, column: 54, scope: !384)
!394 = !DILocation(line: 227, column: 5, scope: !384)
!395 = !DILocation(line: 227, column: 11, scope: !384)
!396 = !DILocation(line: 227, column: 16, scope: !384)
!397 = !DILocation(line: 226, column: 49, scope: !384)
!398 = !{null, !23, !4, !4, !19, !4}
!399 = !DISubroutineType(types: !398)
!400 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 259, type: !399, scopeLine: 259, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!401 = !DILocation(line: 259, column: 1, scope: !400)
!402 = !DILocalVariable(name: "slots", arg: 1, scope: !400, file: !13, line: 259, type: !23)
!403 = !DILocalVariable(name: "mask", arg: 2, scope: !400, file: !13, line: 259, type: !4)
!404 = !DILocalVariable(name: "bucket", arg: 3, scope: !400, file: !13, line: 259, type: !4)
!405 = !DILocalVariable(name: "h", arg: 4, scope: !400, file: !13, line: 259, type: !19)
!406 = !DILocalVariable(name: "used", arg: 5, scope: !400, file: !13, line: 259, type: !4)
!407 = !DILocation(line: 260, column: 3, scope: !400)
!408 = !DILocation(line: 260, column: 7, scope: !400)
!409 = !DILocation(line: 260, column: 17, scope: !400)
!410 = !DILocation(line: 260, column: 22, scope: !400)
!411 = !DILocation(line: 260, column: 31, scope: !400)
!412 = !DILocation(line: 260, column: 37, scope: !400)
!413 = !DILocation(line: 260, column: 52, scope: !400)
!414 = !DILocation(line: 261, column: 5, scope: !400)
!415 = !DILocation(line: 261, column: 11, scope: !400)
!416 = !DILocation(line: 261, column: 21, scope: !400)
!417 = !DILocation(line: 261, column: 30, scope: !400)
!418 = !DILocation(line: 261, column: 33, scope: !400)
!419 = !DILocation(line: 261, column: 40, scope: !400)
!420 = !DILocation(line: 262, column: 10, scope: !400)
!421 = !DILocation(line: 263, column: 5, scope: !400)
!422 = !DILocation(line: 263, column: 15, scope: !400)
!423 = !DILocation(line: 263, column: 22, scope: !400)
!424 = !DILocation(line: 263, column: 28, scope: !400)
!425 = !DILocation(line: 263, column: 31, scope: !400)
!426 = !DILocation(line: 263, column: 38, scope: !400)
!427 = !{null, !12}
!428 = !DISubroutineType(types: !427)
!429 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.constructor", linkageName: "nish.Map$em.p1.en$Kind$i32.constructor", scope: !13, file: !13, line: 293, type: !428, scopeLine: 293, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!430 = !DILocation(line: 293, column: 3, scope: !429)
!431 = !DILocalVariable(name: "this", arg: 1, scope: !429, file: !13, line: 293, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!432 = !{!"ptr", !78, i64 0}
!433 = !{!"Map$em.p1.en$Kind$i32", !114, i64 0, !432, i64 8, !114, i64 16, !114, i64 20, !432, i64 24, !432, i64 32, !432, i64 40, !114, i64 48}
!434 = !{!433, !114, i64 0}
!435 = !{!433, !114, i64 16}
!436 = !{!433, !114, i64 20}
!437 = !{!433, !114, i64 48}
!438 = !DILocation(line: 294, column: 5, scope: !429)
!439 = !DILocation(line: 294, column: 18, scope: !429)
!440 = !DILocation(line: 294, column: 33, scope: !429)
!441 = !{!433, !432, i64 8}
!442 = !DILocation(line: 295, column: 5, scope: !429)
!443 = !DILocation(line: 295, column: 22, scope: !429)
!444 = !{!433, !432, i64 24}
!445 = !DILocation(line: 296, column: 5, scope: !429)
!446 = !DILocation(line: 296, column: 24, scope: !429)
!447 = !{!433, !432, i64 32}
!448 = !DILocation(line: 297, column: 5, scope: !429)
!449 = !DILocation(line: 297, column: 24, scope: !429)
!450 = !{!433, !432, i64 40}
!451 = !{!16, !12, !34}
!452 = !DISubroutineType(types: !451)
!453 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.probe", linkageName: "nish.Map$em.p1.en$Kind$i32.probe", scope: !13, file: !13, line: 301, type: !452, scopeLine: 301, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!454 = !DILocation(line: 301, column: 3, scope: !453)
!455 = !DILocalVariable(name: "this", arg: 1, scope: !453, file: !13, line: 301, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!456 = !DILocalVariable(name: "key", arg: 2, scope: !453, file: !13, line: 301, type: !34)
!457 = !DILocation(line: 302, column: 5, scope: !453)
!458 = !DILocation(line: 302, column: 12, scope: !453)
!459 = !DILocation(line: 302, column: 23, scope: !453)
!460 = !DILocation(line: 302, column: 35, scope: !453)
!461 = !DILocation(line: 302, column: 46, scope: !453)
!462 = !DILocation(line: 302, column: 64, scope: !453)
!463 = !DILocation(line: 302, column: 80, scope: !453)
!464 = !{!12, !12, !34, !4}
!465 = !DISubroutineType(types: !464)
!466 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.set", linkageName: "nish.Map$em.p1.en$Kind$i32.set", scope: !13, file: !13, line: 310, type: !465, scopeLine: 310, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!467 = !DILocation(line: 310, column: 3, scope: !466)
!468 = !DILocalVariable(name: "this", arg: 1, scope: !466, file: !13, line: 310, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!469 = !DILocalVariable(name: "key", arg: 2, scope: !466, file: !13, line: 310, type: !34)
!470 = !DILocalVariable(name: "value", arg: 3, scope: !466, file: !13, line: 310, type: !4)
!471 = !DILocation(line: 311, column: 5, scope: !466)
!472 = !DILocation(line: 311, column: 19, scope: !466)
!473 = !DILocation(line: 311, column: 30, scope: !466)
!474 = !DILocalVariable(name: "found", scope: !466, file: !13, line: 311, type: !16)
!475 = !DILocation(line: 312, column: 5, scope: !466)
!476 = !DILocation(line: 312, column: 9, scope: !466)
!477 = !DILocation(line: 312, column: 18, scope: !466)
!478 = !DILocation(line: 312, column: 21, scope: !466)
!479 = !DILocation(line: 313, column: 7, scope: !466)
!480 = !DILocation(line: 313, column: 23, scope: !466)
!481 = !DILocation(line: 313, column: 29, scope: !466)
!482 = !DILocation(line: 313, column: 37, scope: !466)
!483 = !DILocation(line: 314, column: 12, scope: !466)
!484 = !DILocation(line: 315, column: 7, scope: !466)
!485 = !DILocation(line: 315, column: 21, scope: !466)
!486 = !DILocation(line: 315, column: 28, scope: !466)
!487 = !DILocation(line: 315, column: 33, scope: !466)
!488 = !DILocation(line: 317, column: 5, scope: !466)
!489 = !DILocation(line: 317, column: 12, scope: !466)
!490 = !{!4, !12, !4}
!491 = !DISubroutineType(types: !490)
!492 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.valueAt", linkageName: "nish.Map$em.p1.en$Kind$i32.valueAt", scope: !13, file: !13, line: 376, type: !491, scopeLine: 376, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!493 = !DILocation(line: 376, column: 3, scope: !492)
!494 = !DILocalVariable(name: "this", arg: 1, scope: !492, file: !13, line: 376, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!495 = !DILocalVariable(name: "index", arg: 2, scope: !492, file: !13, line: 376, type: !4)
!496 = !DILocation(line: 377, column: 5, scope: !492)
!497 = !DILocation(line: 377, column: 9, scope: !492)
!498 = !DILocation(line: 377, column: 17, scope: !492)
!499 = !DILocation(line: 377, column: 22, scope: !492)
!500 = !DILocation(line: 377, column: 31, scope: !492)
!501 = !DILocation(line: 377, column: 37, scope: !492)
!502 = !DILocation(line: 377, column: 63, scope: !492)
!503 = !DILocation(line: 378, column: 7, scope: !492)
!504 = !DILocation(line: 378, column: 13, scope: !492)
!505 = !DILocation(line: 380, column: 5, scope: !492)
!506 = !DILocation(line: 380, column: 12, scope: !492)
!507 = !DILocation(line: 380, column: 29, scope: !492)
!508 = !{null, !12, !4, !4}
!509 = !DISubroutineType(types: !508)
!510 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.setValueAt", linkageName: "nish.Map$em.p1.en$Kind$i32.setValueAt", scope: !13, file: !13, line: 384, type: !509, scopeLine: 384, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!511 = !DILocation(line: 384, column: 3, scope: !510)
!512 = !DILocalVariable(name: "this", arg: 1, scope: !510, file: !13, line: 384, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!513 = !DILocalVariable(name: "index", arg: 2, scope: !510, file: !13, line: 384, type: !4)
!514 = !DILocalVariable(name: "value", arg: 3, scope: !510, file: !13, line: 384, type: !4)
!515 = !DILocation(line: 385, column: 5, scope: !510)
!516 = !DILocation(line: 385, column: 9, scope: !510)
!517 = !DILocation(line: 385, column: 18, scope: !510)
!518 = !DILocation(line: 385, column: 23, scope: !510)
!519 = !DILocation(line: 385, column: 31, scope: !510)
!520 = !DILocation(line: 385, column: 37, scope: !510)
!521 = !DILocation(line: 385, column: 63, scope: !510)
!522 = !DILocation(line: 386, column: 7, scope: !510)
!523 = !DILocation(line: 386, column: 24, scope: !510)
!524 = !DILocation(line: 386, column: 33, scope: !510)
!525 = !{null, !12, !16, !34, !4}
!526 = !DISubroutineType(types: !525)
!527 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.insertAt", linkageName: "nish.Map$em.p1.en$Kind$i32.insertAt", scope: !13, file: !13, line: 391, type: !526, scopeLine: 391, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!528 = !DILocation(line: 391, column: 3, scope: !527)
!529 = !DILocalVariable(name: "this", arg: 1, scope: !527, file: !13, line: 391, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!530 = !DILocalVariable(name: "absent", arg: 2, scope: !527, file: !13, line: 391, type: !16)
!531 = !DILocalVariable(name: "key", arg: 3, scope: !527, file: !13, line: 391, type: !34)
!532 = !DILocalVariable(name: "value", arg: 4, scope: !527, file: !13, line: 391, type: !4)
!533 = !DILocation(line: 392, column: 5, scope: !527)
!534 = !DILocation(line: 392, column: 20, scope: !527)
!535 = !DILocation(line: 392, column: 25, scope: !527)
!536 = !DILocalVariable(name: "packed", scope: !527, file: !13, line: 392, type: !16)
!537 = !DILocation(line: 393, column: 5, scope: !527)
!538 = !DILocation(line: 393, column: 18, scope: !527)
!539 = !DILocation(line: 393, column: 24, scope: !527)
!540 = !DILocalVariable(name: "bucket", scope: !527, file: !13, line: 393, type: !4)
!541 = !DILocation(line: 394, column: 5, scope: !527)
!542 = !DILocation(line: 394, column: 15, scope: !527)
!543 = !DILocation(line: 394, column: 21, scope: !527)
!544 = !DILocalVariable(name: "h", scope: !527, file: !13, line: 394, type: !19)
!545 = !DILocation(line: 395, column: 5, scope: !527)
!546 = !DILocation(line: 395, column: 9, scope: !527)
!547 = !DILocation(line: 395, column: 15, scope: !527)
!548 = !DILocation(line: 395, column: 41, scope: !527)
!549 = !DILocation(line: 395, column: 52, scope: !527)
!550 = !DILocation(line: 398, column: 7, scope: !527)
!551 = !DILocation(line: 398, column: 11, scope: !527)
!552 = !DILocation(line: 398, column: 24, scope: !527)
!553 = !DILocation(line: 398, column: 37, scope: !527)
!554 = !DILocation(line: 398, column: 50, scope: !527)
!555 = !DILocation(line: 398, column: 53, scope: !527)
!556 = !DILocation(line: 399, column: 9, scope: !527)
!557 = !DILocation(line: 399, column: 15, scope: !527)
!558 = !DILocation(line: 401, column: 7, scope: !527)
!559 = !DILocation(line: 402, column: 7, scope: !527)
!560 = !DILocation(line: 402, column: 16, scope: !527)
!561 = !DILocation(line: 404, column: 5, scope: !527)
!562 = !DILocation(line: 404, column: 25, scope: !527)
!563 = !DILocation(line: 405, column: 5, scope: !527)
!564 = !DILocation(line: 405, column: 27, scope: !527)
!565 = !DILocation(line: 406, column: 5, scope: !527)
!566 = !DILocation(line: 406, column: 27, scope: !527)
!567 = !DILocation(line: 407, column: 5, scope: !527)
!568 = !DILocation(line: 407, column: 17, scope: !527)
!569 = !DILocation(line: 407, column: 29, scope: !527)
!570 = !DILocation(line: 408, column: 5, scope: !527)
!571 = !DILocation(line: 408, column: 17, scope: !527)
!572 = !DILocation(line: 408, column: 29, scope: !527)
!573 = !DILocation(line: 411, column: 5, scope: !527)
!574 = !DILocation(line: 411, column: 18, scope: !527)
!575 = !DILocation(line: 411, column: 24, scope: !527)
!576 = !DILocalVariable(name: "used", scope: !527, file: !13, line: 411, type: !4)
!577 = !DILocation(line: 412, column: 5, scope: !527)
!578 = !DILocation(line: 412, column: 9, scope: !527)
!579 = !DILocation(line: 412, column: 16, scope: !527)
!580 = !DILocation(line: 412, column: 20, scope: !527)
!581 = !DILocation(line: 412, column: 26, scope: !527)
!582 = !DILocation(line: 412, column: 47, scope: !527)
!583 = !DILocation(line: 412, column: 50, scope: !527)
!584 = !DILocation(line: 413, column: 7, scope: !527)
!585 = !DILocation(line: 414, column: 12, scope: !527)
!586 = !DILocation(line: 415, column: 7, scope: !527)
!587 = !DILocation(line: 415, column: 20, scope: !527)
!588 = !DILocation(line: 415, column: 32, scope: !527)
!589 = !DILocation(line: 415, column: 43, scope: !527)
!590 = !DILocation(line: 415, column: 51, scope: !527)
!591 = !DILocation(line: 415, column: 54, scope: !527)
!592 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.rebuild", linkageName: "nish.Map$em.p1.en$Kind$i32.rebuild", scope: !13, file: !13, line: 424, type: !428, scopeLine: 424, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!593 = !DILocation(line: 424, column: 3, scope: !592)
!594 = !DILocalVariable(name: "this", arg: 1, scope: !592, file: !13, line: 424, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!595 = !DILocation(line: 425, column: 5, scope: !592)
!596 = !DILocation(line: 425, column: 18, scope: !592)
!597 = !DILocation(line: 425, column: 24, scope: !592)
!598 = !DILocalVariable(name: "used", scope: !592, file: !13, line: 425, type: !4)
!599 = !DILocation(line: 426, column: 5, scope: !592)
!600 = !DILocation(line: 426, column: 21, scope: !592)
!601 = !DILocation(line: 426, column: 34, scope: !592)
!602 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!603 = !DILocalVariable(name: "walking", scope: !592, file: !13, line: 426, type: !602)
!604 = !DILocation(line: 427, column: 5, scope: !592)
!605 = !DILocation(line: 427, column: 19, scope: !592)
!606 = !DILocation(line: 427, column: 32, scope: !592)
!607 = !DILocation(line: 427, column: 44, scope: !592)
!608 = !DILocation(line: 427, column: 54, scope: !592)
!609 = !DILocation(line: 427, column: 61, scope: !592)
!610 = !DILocation(line: 427, column: 72, scope: !592)
!611 = !DILocalVariable(name: "slots", scope: !592, file: !13, line: 427, type: !23)
!612 = !DILocation(line: 428, column: 5, scope: !592)
!613 = !DILocation(line: 428, column: 9, scope: !592)
!614 = !DILocation(line: 428, column: 10, scope: !592)
!615 = !DILocation(line: 428, column: 21, scope: !592)
!616 = !DILocation(line: 428, column: 33, scope: !592)
!617 = !DILocation(line: 428, column: 39, scope: !592)
!618 = !DILocation(line: 429, column: 7, scope: !592)
!619 = !DILocation(line: 429, column: 22, scope: !592)
!620 = !DILocation(line: 429, column: 38, scope: !592)
!621 = !DILocation(line: 430, column: 7, scope: !592)
!622 = !DILocation(line: 430, column: 22, scope: !592)
!623 = !DILocation(line: 430, column: 40, scope: !592)
!624 = !DILocation(line: 431, column: 7, scope: !592)
!625 = !DILocation(line: 431, column: 21, scope: !592)
!626 = !DILocation(line: 433, column: 5, scope: !592)
!627 = !DILocation(line: 433, column: 18, scope: !592)
!628 = !DILocation(line: 434, column: 5, scope: !592)
!629 = !DILocation(line: 434, column: 17, scope: !592)
!630 = !DILocation(line: 434, column: 23, scope: !592)
!631 = !DILocation(line: 434, column: 39, scope: !592)
!632 = !DILocation(line: 435, column: 5, scope: !592)
!633 = !DILocation(line: 435, column: 12, scope: !592)
!634 = !DILocation(line: 435, column: 19, scope: !592)
!635 = !{null, !58}
!636 = !DISubroutineType(types: !635)
!637 = distinct !DISubprogram(name: "Set<Kind.Array>.constructor", linkageName: "nish.Set$em.p1.en$Kind.constructor", scope: !13, file: !13, line: 479, type: !636, scopeLine: 479, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!638 = !DILocation(line: 479, column: 3, scope: !637)
!639 = !DILocalVariable(name: "this", arg: 1, scope: !637, file: !13, line: 479, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!640 = !{!"Set$em.p1.en$Kind", !114, i64 0, !432, i64 8, !114, i64 16, !114, i64 20, !432, i64 24, !432, i64 32, !114, i64 40}
!641 = !{!640, !114, i64 0}
!642 = !{!640, !114, i64 16}
!643 = !{!640, !114, i64 20}
!644 = !{!640, !114, i64 40}
!645 = !DILocation(line: 480, column: 5, scope: !637)
!646 = !DILocation(line: 480, column: 18, scope: !637)
!647 = !DILocation(line: 480, column: 33, scope: !637)
!648 = !{!640, !432, i64 8}
!649 = !DILocation(line: 481, column: 5, scope: !637)
!650 = !DILocation(line: 481, column: 22, scope: !637)
!651 = !{!640, !432, i64 24}
!652 = !DILocation(line: 482, column: 5, scope: !637)
!653 = !DILocation(line: 482, column: 24, scope: !637)
!654 = !{!640, !432, i64 32}
!655 = !{!16, !58, !34}
!656 = !DISubroutineType(types: !655)
!657 = distinct !DISubprogram(name: "Set<Kind.Array>.probe", linkageName: "nish.Set$em.p1.en$Kind.probe", scope: !13, file: !13, line: 485, type: !656, scopeLine: 485, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!658 = !DILocation(line: 485, column: 3, scope: !657)
!659 = !DILocalVariable(name: "this", arg: 1, scope: !657, file: !13, line: 485, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!660 = !DILocalVariable(name: "key", arg: 2, scope: !657, file: !13, line: 485, type: !34)
!661 = !DILocation(line: 486, column: 5, scope: !657)
!662 = !DILocation(line: 486, column: 12, scope: !657)
!663 = !DILocation(line: 486, column: 23, scope: !657)
!664 = !DILocation(line: 486, column: 35, scope: !657)
!665 = !DILocation(line: 486, column: 46, scope: !657)
!666 = !DILocation(line: 486, column: 64, scope: !657)
!667 = !DILocation(line: 486, column: 80, scope: !657)
!668 = !{!602, !58, !34}
!669 = !DISubroutineType(types: !668)
!670 = distinct !DISubprogram(name: "Set<Kind.Array>.has", linkageName: "nish.Set$em.p1.en$Kind.has", scope: !13, file: !13, line: 489, type: !669, scopeLine: 489, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!671 = !DILocation(line: 489, column: 3, scope: !670)
!672 = !DILocalVariable(name: "this", arg: 1, scope: !670, file: !13, line: 489, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!673 = !DILocalVariable(name: "key", arg: 2, scope: !670, file: !13, line: 489, type: !34)
!674 = !DILocation(line: 490, column: 5, scope: !670)
!675 = !DILocation(line: 490, column: 12, scope: !670)
!676 = !DILocation(line: 490, column: 23, scope: !670)
!677 = !DILocation(line: 490, column: 31, scope: !670)
!678 = !{!58, !58, !34}
!679 = !DISubroutineType(types: !678)
!680 = distinct !DISubprogram(name: "Set<Kind.Array>.add", linkageName: "nish.Set$em.p1.en$Kind.add", scope: !13, file: !13, line: 494, type: !679, scopeLine: 494, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!681 = !DILocation(line: 494, column: 3, scope: !680)
!682 = !DILocalVariable(name: "this", arg: 1, scope: !680, file: !13, line: 494, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!683 = !DILocalVariable(name: "key", arg: 2, scope: !680, file: !13, line: 494, type: !34)
!684 = !DILocation(line: 495, column: 5, scope: !680)
!685 = !DILocation(line: 495, column: 19, scope: !680)
!686 = !DILocation(line: 495, column: 30, scope: !680)
!687 = !DILocalVariable(name: "found", scope: !680, file: !13, line: 495, type: !16)
!688 = !DILocation(line: 496, column: 5, scope: !680)
!689 = !DILocation(line: 496, column: 9, scope: !680)
!690 = !DILocation(line: 496, column: 17, scope: !680)
!691 = !DILocation(line: 496, column: 20, scope: !680)
!692 = !DILocation(line: 497, column: 7, scope: !680)
!693 = !DILocation(line: 497, column: 21, scope: !680)
!694 = !DILocation(line: 497, column: 28, scope: !680)
!695 = !DILocation(line: 499, column: 5, scope: !680)
!696 = !DILocation(line: 499, column: 12, scope: !680)
!697 = !{null, !58, !16, !34}
!698 = !DISubroutineType(types: !697)
!699 = distinct !DISubprogram(name: "Set<Kind.Array>.insertAt", linkageName: "nish.Set$em.p1.en$Kind.insertAt", scope: !13, file: !13, line: 545, type: !698, scopeLine: 545, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!700 = !DILocation(line: 545, column: 3, scope: !699)
!701 = !DILocalVariable(name: "this", arg: 1, scope: !699, file: !13, line: 545, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!702 = !DILocalVariable(name: "absent", arg: 2, scope: !699, file: !13, line: 545, type: !16)
!703 = !DILocalVariable(name: "key", arg: 3, scope: !699, file: !13, line: 545, type: !34)
!704 = !DILocation(line: 546, column: 5, scope: !699)
!705 = !DILocation(line: 546, column: 20, scope: !699)
!706 = !DILocation(line: 546, column: 25, scope: !699)
!707 = !DILocalVariable(name: "packed", scope: !699, file: !13, line: 546, type: !16)
!708 = !DILocation(line: 547, column: 5, scope: !699)
!709 = !DILocation(line: 547, column: 18, scope: !699)
!710 = !DILocation(line: 547, column: 24, scope: !699)
!711 = !DILocalVariable(name: "bucket", scope: !699, file: !13, line: 547, type: !4)
!712 = !DILocation(line: 548, column: 5, scope: !699)
!713 = !DILocation(line: 548, column: 15, scope: !699)
!714 = !DILocation(line: 548, column: 21, scope: !699)
!715 = !DILocalVariable(name: "h", scope: !699, file: !13, line: 548, type: !19)
!716 = !DILocation(line: 549, column: 5, scope: !699)
!717 = !DILocation(line: 549, column: 9, scope: !699)
!718 = !DILocation(line: 549, column: 15, scope: !699)
!719 = !DILocation(line: 549, column: 41, scope: !699)
!720 = !DILocation(line: 549, column: 52, scope: !699)
!721 = !DILocation(line: 550, column: 7, scope: !699)
!722 = !DILocation(line: 550, column: 11, scope: !699)
!723 = !DILocation(line: 550, column: 24, scope: !699)
!724 = !DILocation(line: 550, column: 37, scope: !699)
!725 = !DILocation(line: 550, column: 50, scope: !699)
!726 = !DILocation(line: 550, column: 53, scope: !699)
!727 = !DILocation(line: 551, column: 9, scope: !699)
!728 = !DILocation(line: 551, column: 15, scope: !699)
!729 = !DILocation(line: 553, column: 7, scope: !699)
!730 = !DILocation(line: 554, column: 7, scope: !699)
!731 = !DILocation(line: 554, column: 16, scope: !699)
!732 = !DILocation(line: 556, column: 5, scope: !699)
!733 = !DILocation(line: 556, column: 25, scope: !699)
!734 = !DILocation(line: 557, column: 5, scope: !699)
!735 = !DILocation(line: 557, column: 27, scope: !699)
!736 = !DILocation(line: 558, column: 5, scope: !699)
!737 = !DILocation(line: 558, column: 17, scope: !699)
!738 = !DILocation(line: 558, column: 29, scope: !699)
!739 = !DILocation(line: 559, column: 5, scope: !699)
!740 = !DILocation(line: 559, column: 17, scope: !699)
!741 = !DILocation(line: 559, column: 29, scope: !699)
!742 = !DILocation(line: 562, column: 5, scope: !699)
!743 = !DILocation(line: 562, column: 18, scope: !699)
!744 = !DILocation(line: 562, column: 24, scope: !699)
!745 = !DILocalVariable(name: "used", scope: !699, file: !13, line: 562, type: !4)
!746 = !DILocation(line: 563, column: 5, scope: !699)
!747 = !DILocation(line: 563, column: 9, scope: !699)
!748 = !DILocation(line: 563, column: 16, scope: !699)
!749 = !DILocation(line: 563, column: 20, scope: !699)
!750 = !DILocation(line: 563, column: 26, scope: !699)
!751 = !DILocation(line: 563, column: 47, scope: !699)
!752 = !DILocation(line: 563, column: 50, scope: !699)
!753 = !DILocation(line: 564, column: 7, scope: !699)
!754 = !DILocation(line: 565, column: 12, scope: !699)
!755 = !DILocation(line: 566, column: 7, scope: !699)
!756 = !DILocation(line: 566, column: 20, scope: !699)
!757 = !DILocation(line: 566, column: 32, scope: !699)
!758 = !DILocation(line: 566, column: 43, scope: !699)
!759 = !DILocation(line: 566, column: 51, scope: !699)
!760 = !DILocation(line: 566, column: 54, scope: !699)
!761 = distinct !DISubprogram(name: "Set<Kind.Array>.rebuild", linkageName: "nish.Set$em.p1.en$Kind.rebuild", scope: !13, file: !13, line: 570, type: !636, scopeLine: 570, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!762 = !DILocation(line: 570, column: 3, scope: !761)
!763 = !DILocalVariable(name: "this", arg: 1, scope: !761, file: !13, line: 570, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!764 = !DILocation(line: 571, column: 5, scope: !761)
!765 = !DILocation(line: 571, column: 18, scope: !761)
!766 = !DILocation(line: 571, column: 24, scope: !761)
!767 = !DILocalVariable(name: "used", scope: !761, file: !13, line: 571, type: !4)
!768 = !DILocation(line: 572, column: 5, scope: !761)
!769 = !DILocation(line: 572, column: 21, scope: !761)
!770 = !DILocation(line: 572, column: 34, scope: !761)
!771 = !DILocalVariable(name: "walking", scope: !761, file: !13, line: 572, type: !602)
!772 = !DILocation(line: 573, column: 5, scope: !761)
!773 = !DILocation(line: 573, column: 19, scope: !761)
!774 = !DILocation(line: 573, column: 32, scope: !761)
!775 = !DILocation(line: 573, column: 44, scope: !761)
!776 = !DILocation(line: 573, column: 54, scope: !761)
!777 = !DILocation(line: 573, column: 61, scope: !761)
!778 = !DILocation(line: 573, column: 72, scope: !761)
!779 = !DILocalVariable(name: "slots", scope: !761, file: !13, line: 573, type: !23)
!780 = !DILocation(line: 574, column: 5, scope: !761)
!781 = !DILocation(line: 574, column: 9, scope: !761)
!782 = !DILocation(line: 574, column: 10, scope: !761)
!783 = !DILocation(line: 574, column: 21, scope: !761)
!784 = !DILocation(line: 574, column: 33, scope: !761)
!785 = !DILocation(line: 574, column: 39, scope: !761)
!786 = !DILocation(line: 575, column: 7, scope: !761)
!787 = !DILocation(line: 575, column: 22, scope: !761)
!788 = !DILocation(line: 575, column: 38, scope: !761)
!789 = !DILocation(line: 576, column: 7, scope: !761)
!790 = !DILocation(line: 576, column: 21, scope: !761)
!791 = !DILocation(line: 578, column: 5, scope: !761)
!792 = !DILocation(line: 578, column: 18, scope: !761)
!793 = !DILocation(line: 579, column: 5, scope: !761)
!794 = !DILocation(line: 579, column: 17, scope: !761)
!795 = !DILocation(line: 579, column: 23, scope: !761)
!796 = !DILocation(line: 579, column: 39, scope: !761)
!797 = !DILocation(line: 580, column: 5, scope: !761)
!798 = !DILocation(line: 580, column: 12, scope: !761)
!799 = !DILocation(line: 580, column: 19, scope: !761)
!800 = !{!16, !23, !4, !23, !38, !34}
!801 = !DISubroutineType(types: !800)
!802 = distinct !DISubprogram(name: "probeTable<Kind.Array>", linkageName: "nish.probeTable$em.p1.en$Kind", scope: !13, file: !13, line: 97, type: !801, scopeLine: 97, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!803 = !DILocation(line: 97, column: 1, scope: !802)
!804 = !DILocalVariable(name: "slots", arg: 1, scope: !802, file: !13, line: 97, type: !23)
!805 = !DILocalVariable(name: "mask", arg: 2, scope: !802, file: !13, line: 97, type: !4)
!806 = !DILocalVariable(name: "hashes", arg: 3, scope: !802, file: !13, line: 97, type: !23)
!807 = !DILocalVariable(name: "keys", arg: 4, scope: !802, file: !13, line: 97, type: !38)
!808 = !DILocalVariable(name: "key", arg: 5, scope: !802, file: !13, line: 97, type: !34)
!809 = !DILocation(line: 98, column: 3, scope: !802)
!810 = !DILocation(line: 98, column: 13, scope: !802)
!811 = !DILocation(line: 98, column: 21, scope: !802)
!812 = !DILocalVariable(name: "h", scope: !802, file: !13, line: 98, type: !19)
!813 = !DILocation(line: 99, column: 3, scope: !802)
!814 = !DILocation(line: 99, column: 23, scope: !802)
!815 = !DILocalVariable(name: "fingerprint", scope: !802, file: !13, line: 99, type: !19)
!816 = !DILocation(line: 100, column: 3, scope: !802)
!817 = !DILocation(line: 100, column: 16, scope: !802)
!818 = !DILocation(line: 100, column: 27, scope: !802)
!819 = !DILocation(line: 100, column: 30, scope: !802)
!820 = !DILocalVariable(name: "bucket", scope: !802, file: !13, line: 100, type: !4)
!821 = !DILocation(line: 103, column: 3, scope: !802)
!822 = !DILocation(line: 103, column: 40, scope: !802)
!823 = !DILocation(line: 112, column: 20, scope: !802)
!824 = !DILocation(line: 114, column: 20, scope: !802)
!825 = !DILocation(line: 103, column: 10, scope: !802)
!826 = !DILocation(line: 103, column: 20, scope: !802)
!827 = !DILocation(line: 103, column: 25, scope: !802)
!828 = !DILocation(line: 103, column: 34, scope: !802)
!829 = !DILocation(line: 103, column: 55, scope: !802)
!830 = !DILocation(line: 104, column: 5, scope: !802)
!831 = !DILocation(line: 104, column: 18, scope: !802)
!832 = !DILocation(line: 104, column: 24, scope: !802)
!833 = !DILocalVariable(name: "word", scope: !802, file: !13, line: 104, type: !19)
!834 = !DILocation(line: 105, column: 5, scope: !802)
!835 = !DILocation(line: 105, column: 9, scope: !802)
!836 = !DILocation(line: 105, column: 18, scope: !802)
!837 = !DILocation(line: 105, column: 21, scope: !802)
!838 = !DILocation(line: 106, column: 7, scope: !802)
!839 = !DILocation(line: 106, column: 14, scope: !802)
!840 = !DILocation(line: 106, column: 23, scope: !802)
!841 = !DILocation(line: 106, column: 31, scope: !802)
!842 = !DILocation(line: 108, column: 5, scope: !802)
!843 = !DILocation(line: 108, column: 9, scope: !802)
!844 = !DILocation(line: 108, column: 25, scope: !802)
!845 = !DILocation(line: 108, column: 38, scope: !802)
!846 = !DILocation(line: 109, column: 7, scope: !802)
!847 = !DILocation(line: 109, column: 18, scope: !802)
!848 = !DILocation(line: 109, column: 24, scope: !802)
!849 = !DILocation(line: 109, column: 31, scope: !802)
!850 = !DILocation(line: 109, column: 43, scope: !802)
!851 = !DILocalVariable(name: "at", scope: !802, file: !13, line: 109, type: !4)
!852 = !DILocation(line: 110, column: 7, scope: !802)
!853 = !DILocation(line: 111, column: 9, scope: !802)
!854 = !DILocation(line: 111, column: 15, scope: !802)
!855 = !DILocation(line: 112, column: 9, scope: !802)
!856 = !DILocation(line: 112, column: 14, scope: !802)
!857 = !DILocation(line: 113, column: 9, scope: !802)
!858 = !DILocation(line: 113, column: 16, scope: !802)
!859 = !DILocation(line: 113, column: 24, scope: !802)
!860 = !DILocation(line: 114, column: 9, scope: !802)
!861 = !DILocation(line: 114, column: 14, scope: !802)
!862 = !DILocation(line: 115, column: 9, scope: !802)
!863 = !DILocation(line: 115, column: 17, scope: !802)
!864 = !DILocation(line: 115, column: 22, scope: !802)
!865 = !DILocation(line: 115, column: 27, scope: !802)
!866 = !DILocation(line: 116, column: 9, scope: !802)
!867 = !DILocation(line: 117, column: 9, scope: !802)
!868 = !DILocation(line: 117, column: 16, scope: !802)
!869 = !DILocation(line: 117, column: 24, scope: !802)
!870 = !DILocation(line: 117, column: 32, scope: !802)
!871 = !DILocation(line: 120, column: 5, scope: !802)
!872 = !DILocation(line: 120, column: 14, scope: !802)
!873 = !DILocation(line: 120, column: 15, scope: !802)
!874 = !DILocation(line: 120, column: 24, scope: !802)
!875 = !DILocation(line: 120, column: 29, scope: !802)
!876 = !DILocation(line: 122, column: 3, scope: !802)
!877 = !DILocation(line: 122, column: 9, scope: !802)
!878 = !{null, !38, !23}
!879 = !DISubroutineType(types: !878)
!880 = distinct !DISubprogram(name: "compactEntries<Kind.Array>", linkageName: "nish.compactEntries$em.p1.en$Kind", scope: !13, file: !13, line: 143, type: !879, scopeLine: 143, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!881 = !DILocation(line: 143, column: 1, scope: !880)
!882 = !DILocalVariable(name: "items", arg: 1, scope: !880, file: !13, line: 143, type: !38)
!883 = !DILocalVariable(name: "hashes", arg: 2, scope: !880, file: !13, line: 143, type: !23)
!884 = !DILocation(line: 144, column: 3, scope: !880)
!885 = !DILocation(line: 144, column: 16, scope: !880)
!886 = !DILocation(line: 144, column: 22, scope: !880)
!887 = !DILocalVariable(name: "used", scope: !880, file: !13, line: 144, type: !4)
!888 = !DILocation(line: 145, column: 3, scope: !880)
!889 = !DILocation(line: 145, column: 17, scope: !880)
!890 = !DILocalVariable(name: "to", scope: !880, file: !13, line: 145, type: !4)
!891 = !DILocation(line: 146, column: 3, scope: !880)
!892 = !DILocation(line: 146, column: 24, scope: !880)
!893 = !DILocalVariable(name: "from", scope: !880, file: !13, line: 146, type: !4)
!894 = !DILocation(line: 146, column: 55, scope: !880)
!895 = !DILocation(line: 147, column: 68, scope: !880)
!896 = !DILocation(line: 146, column: 27, scope: !880)
!897 = !DILocation(line: 146, column: 34, scope: !880)
!898 = !DILocation(line: 146, column: 42, scope: !880)
!899 = !DILocation(line: 146, column: 49, scope: !880)
!900 = !DILocation(line: 146, column: 79, scope: !880)
!901 = !DILocation(line: 147, column: 5, scope: !880)
!902 = !DILocation(line: 147, column: 9, scope: !880)
!903 = !DILocation(line: 147, column: 16, scope: !880)
!904 = !DILocation(line: 147, column: 26, scope: !880)
!905 = !DILocation(line: 147, column: 31, scope: !880)
!906 = !DILocation(line: 147, column: 37, scope: !880)
!907 = !DILocation(line: 147, column: 42, scope: !880)
!908 = !DILocation(line: 147, column: 47, scope: !880)
!909 = !DILocation(line: 147, column: 55, scope: !880)
!910 = !DILocation(line: 147, column: 62, scope: !880)
!911 = !DILocation(line: 147, column: 83, scope: !880)
!912 = !DILocation(line: 148, column: 7, scope: !880)
!913 = !DILocation(line: 148, column: 13, scope: !880)
!914 = !DILocation(line: 148, column: 19, scope: !880)
!915 = !DILocation(line: 148, column: 25, scope: !880)
!916 = !DILocation(line: 149, column: 7, scope: !880)
!917 = !DILocation(line: 146, column: 71, scope: !880)
!918 = !DILocation(line: 152, column: 3, scope: !880)
!919 = !DILocation(line: 152, column: 10, scope: !880)
!920 = !DILocation(line: 152, column: 16, scope: !880)
!921 = !DILocation(line: 152, column: 32, scope: !880)
!922 = !DILocation(line: 152, column: 36, scope: !880)
!923 = !DILocation(line: 153, column: 5, scope: !880)
!924 = !{null, !46, !23}
!925 = !DISubroutineType(types: !924)
!926 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 143, type: !925, scopeLine: 143, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!927 = !DILocation(line: 143, column: 1, scope: !926)
!928 = !DILocalVariable(name: "items", arg: 1, scope: !926, file: !13, line: 143, type: !46)
!929 = !DILocalVariable(name: "hashes", arg: 2, scope: !926, file: !13, line: 143, type: !23)
!930 = !DILocation(line: 144, column: 3, scope: !926)
!931 = !DILocation(line: 144, column: 16, scope: !926)
!932 = !DILocation(line: 144, column: 22, scope: !926)
!933 = !DILocalVariable(name: "used", scope: !926, file: !13, line: 144, type: !4)
!934 = !DILocation(line: 145, column: 3, scope: !926)
!935 = !DILocation(line: 145, column: 17, scope: !926)
!936 = !DILocalVariable(name: "to", scope: !926, file: !13, line: 145, type: !4)
!937 = !DILocation(line: 146, column: 3, scope: !926)
!938 = !DILocation(line: 146, column: 24, scope: !926)
!939 = !DILocalVariable(name: "from", scope: !926, file: !13, line: 146, type: !4)
!940 = !DILocation(line: 146, column: 55, scope: !926)
!941 = !DILocation(line: 147, column: 68, scope: !926)
!942 = !DILocation(line: 146, column: 27, scope: !926)
!943 = !DILocation(line: 146, column: 34, scope: !926)
!944 = !DILocation(line: 146, column: 42, scope: !926)
!945 = !DILocation(line: 146, column: 49, scope: !926)
!946 = !DILocation(line: 146, column: 79, scope: !926)
!947 = !DILocation(line: 147, column: 5, scope: !926)
!948 = !DILocation(line: 147, column: 9, scope: !926)
!949 = !DILocation(line: 147, column: 16, scope: !926)
!950 = !DILocation(line: 147, column: 26, scope: !926)
!951 = !DILocation(line: 147, column: 31, scope: !926)
!952 = !DILocation(line: 147, column: 37, scope: !926)
!953 = !DILocation(line: 147, column: 42, scope: !926)
!954 = !DILocation(line: 147, column: 47, scope: !926)
!955 = !DILocation(line: 147, column: 55, scope: !926)
!956 = !DILocation(line: 147, column: 62, scope: !926)
!957 = !DILocation(line: 147, column: 83, scope: !926)
!958 = !DILocation(line: 148, column: 7, scope: !926)
!959 = !DILocation(line: 148, column: 13, scope: !926)
!960 = !DILocation(line: 148, column: 19, scope: !926)
!961 = !DILocation(line: 148, column: 25, scope: !926)
!962 = !DILocation(line: 149, column: 7, scope: !926)
!963 = !DILocation(line: 146, column: 71, scope: !926)
!964 = !DILocation(line: 152, column: 3, scope: !926)
!965 = !DILocation(line: 152, column: 10, scope: !926)
!966 = !DILocation(line: 152, column: 16, scope: !926)
!967 = !DILocation(line: 152, column: 32, scope: !926)
!968 = !DILocation(line: 152, column: 36, scope: !926)
!969 = !DILocation(line: 153, column: 5, scope: !926)
