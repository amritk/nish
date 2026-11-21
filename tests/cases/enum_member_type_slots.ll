%struct.Node = type { i32 }
%struct.Map$em.p1.en$Kind$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$em.p1.en$Kind = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Box$em.p1.en$Kind = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.0 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal void @nish.int.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_int_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.0 to i8*))
  unreachable
mark:
  %r0 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r0.s1 = lshr i64 %r0, 30
  %r0.x1 = xor i64 %r0, %r0.s1
  %r0.m1 = mul i64 %r0.x1, -4658895280553007687
  %r0.s2 = lshr i64 %r0.m1, 27
  %r0.x2 = xor i64 %r0.m1, %r0.s2
  %r0.m2 = mul i64 %r0.x2, -7723592293110705685
  %r0.s3 = lshr i64 %r0.m2, 31
  %r0.x3 = xor i64 %r0.m2, %r0.s3
  store i64 %r0.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %r1.s1 = lshr i64 %r1, 30
  %r1.x1 = xor i64 %r1, %r1.s1
  %r1.m1 = mul i64 %r1.x1, -4658895280553007687
  %r1.s2 = lshr i64 %r1.m1, 27
  %r1.x2 = xor i64 %r1.m1, %r1.s2
  %r1.m2 = mul i64 %r1.x2, -7723592293110705685
  %r1.s3 = lshr i64 %r1.m2, 31
  %r1.x3 = xor i64 %r1.m2, %r1.s3
  store i64 %r1.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

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
  %47 = call i32 @nish.Map$em.p1.en$Kind$i32.valueAt(%struct.Map$em.p1.en$Kind$i32* %43, i32 %46, i32 zeroinitializer), !dbg !131
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 !dbg !213 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !215, metadata !DIExpression()), !dbg !214
  call void @llvm.dbg.value(metadata i32 %mask, metadata !216, metadata !DIExpression()), !dbg !214
  call void @llvm.dbg.value(metadata i32 %index, metadata !217, metadata !DIExpression()), !dbg !214
  %0 = xor i32 %mask, -1, !dbg !220
  %1 = and i32 %h, %0, !dbg !219
  %2 = add i32 %index, 1, !dbg !224
  %3 = or i32 %1, %2, !dbg !218
  ret i32 %3, !dbg !214
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 !dbg !229 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !231, metadata !DIExpression()), !dbg !230
  call void @llvm.dbg.value(metadata i32 %index, metadata !232, metadata !DIExpression()), !dbg !230
  %0 = sext i32 %bucket to i64, !dbg !234
  %1 = shl i64 %0, 32, !dbg !234
  %2 = sext i32 %index to i64, !dbg !236
  %3 = or i64 %1, %2, !dbg !233
  ret i64 %3, !dbg !230
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 !dbg !240 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !242, metadata !DIExpression()), !dbg !241
  call void @llvm.dbg.value(metadata i32 %h, metadata !243, metadata !DIExpression()), !dbg !241
  %0 = sext i32 %bucket to i64, !dbg !247
  %1 = shl i64 %0, 32, !dbg !247
  %2 = zext i32 %h to i64, !dbg !249
  %3 = or i64 %1, %2, !dbg !246
  %4 = xor i64 %3, -1, !dbg !244
  ret i64 %4, !dbg !241
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !253 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !255, metadata !DIExpression()), !dbg !254
  call void @llvm.dbg.value(metadata i32 %mask, metadata !256, metadata !DIExpression()), !dbg !254
  call void @llvm.dbg.value(metadata i32 %h, metadata !257, metadata !DIExpression()), !dbg !254
  call void @llvm.dbg.value(metadata i32 %index, metadata !258, metadata !DIExpression()), !dbg !254
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index), !dbg !260
  store i32 %0, i32* %word.addr, align 4, !dbg !259
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !264, metadata !DIExpression()), !dbg !259
  store i32 %mask, i32* %low.addr, align 4, !dbg !265
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !268, metadata !DIExpression()), !dbg !265
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !271
  store i32 %1, i32* %bucket.addr, align 4, !dbg !269
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !274, metadata !DIExpression()), !dbg !269
  %2 = load i32, i32* %bucket.addr, align 4, !dbg !277
  store i32 %2, i32* %b.addr, align 4, !dbg !275
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !278, metadata !DIExpression()), !dbg !275
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !279
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !279
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !279
  %6 = load i8*, i8** %5, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !279
  br label %while.cond, !dbg !279

while.cond:
  %7 = load i32, i32* %b.addr, align 4, !dbg !281
  %8 = icmp sge i32 %7, 0, !dbg !281
  br i1 %8, label %land.rhs, label %land.end, !dbg !281

land.rhs:
  %9 = load i32, i32* %b.addr, align 4, !dbg !283
  %10 = trunc i64 %4 to i32, !dbg !280
  %11 = icmp slt i32 %9, %10, !dbg !283
  br label %land.end, !dbg !281

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ], !dbg !281
  br i1 %12, label %while.body, label %while.end, !dbg !279

while.body:
  %13 = load i32, i32* %b.addr, align 4, !dbg !288
  %14 = sext i32 %13 to i64, !dbg !287
  %15 = bitcast i8* %6 to i32*, !dbg !287
  %16 = getelementptr inbounds i32, i32* %15, i64 %14, !dbg !287
  %17 = load i32, i32* %16, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !287
  %18 = icmp eq i32 %17, 0, !dbg !287
  br i1 %18, label %if.then, label %if.end, !dbg !286

if.then:
  %19 = load i32, i32* %b.addr, align 4, !dbg !292
  %20 = sext i32 %19 to i64, !dbg !291
  %21 = load i32, i32* %word.addr, align 4, !dbg !293
  %22 = bitcast i8* %6 to i32*, !dbg !291
  %23 = getelementptr inbounds i32, i32* %22, i64 %20, !dbg !291
  store i32 %21, i32* %23, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !291
  ret void, !dbg !294

if.end:
  %24 = load i32, i32* %bucket.addr, align 4, !dbg !297
  %25 = add i32 %24, 1, !dbg !297
  %26 = load i32, i32* %low.addr, align 4, !dbg !299
  %27 = and i32 %25, %26, !dbg !296
  store i32 %27, i32* %bucket.addr, align 4, !dbg !295
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !302
  store i32 %28, i32* %b.addr, align 4, !dbg !300
  br label %while.cond, !dbg !279

while.end:
  ret void, !dbg !254
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !305 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !307, metadata !DIExpression()), !dbg !306
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !310
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !310
  %2 = trunc i64 %1 to i32, !dbg !310
  store i32 %2, i32* %used.addr, align 4, !dbg !308
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !311, metadata !DIExpression()), !dbg !308
  store i32 0, i32* %to.addr, align 4, !dbg !312
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !314, metadata !DIExpression()), !dbg !312
  store i32 0, i32* %from.addr, align 4, !dbg !315
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !317, metadata !DIExpression()), !dbg !315
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !315
  %4 = load i8*, i8** %3, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !315
  br label %for.cond, !dbg !315

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !319
  %6 = load i32, i32* %used.addr, align 4, !dbg !320
  %7 = icmp slt i32 %5, %6, !dbg !319
  br i1 %7, label %for.body, label %for.end, !dbg !315

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !323
  %9 = sext i32 %8 to i64, !dbg !318
  %10 = bitcast i8* %4 to i32*, !dbg !318
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !318
  %12 = load i32, i32* %11, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !318
  store i32 %12, i32* %h.addr, align 4, !dbg !322
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !324, metadata !DIExpression()), !dbg !322
  %13 = load i32, i32* %h.addr, align 4, !dbg !326
  %14 = icmp ne i32 %13, 0, !dbg !326
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !326

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !328
  %16 = icmp sge i32 %15, 0, !dbg !328
  br label %land.end.1, !dbg !326

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !326
  br i1 %17, label %land.rhs, label %land.end, !dbg !326

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !330
  %19 = load i32, i32* %used.addr, align 4, !dbg !331
  %20 = icmp slt i32 %18, %19, !dbg !330
  br label %land.end, !dbg !326

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !326
  br i1 %21, label %if.then, label %if.end, !dbg !325

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !334
  %23 = sext i32 %22 to i64, !dbg !333
  %24 = load i32, i32* %h.addr, align 4, !dbg !335
  %25 = bitcast i8* %4 to i32*, !dbg !333
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !333
  store i32 %24, i32* %26, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !333
  %27 = load i32, i32* %to.addr, align 4, !dbg !336
  %28 = add nsw i32 %27, 1, !dbg !336
  store i32 %28, i32* %to.addr, align 4, !dbg !336
  br label %if.end, !dbg !325

if.end:
  br label %for.inc, !dbg !315

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !337
  %30 = add nsw i32 %29, 1, !dbg !337
  store i32 %30, i32* %from.addr, align 4, !dbg !337
  br label %for.cond, !dbg !315

for.end:
  br label %while.cond, !dbg !338

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !340
  %32 = load i64, i64* %31, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !340
  %33 = trunc i64 %32 to i32, !dbg !340
  %34 = load i32, i32* %to.addr, align 4, !dbg !341
  %35 = icmp sgt i32 %33, %34, !dbg !339
  br i1 %35, label %land.rhs.2, label %land.end.2, !dbg !339

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !342
  %37 = load i64, i64* %36, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !342
  %38 = trunc i64 %37 to i32, !dbg !342
  %39 = icmp sgt i32 %38, 0, !dbg !342
  br label %land.end.2, !dbg !339

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ], !dbg !339
  br i1 %40, label %while.body, label %while.end, !dbg !338

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !345
  %42 = load i64, i64* %41, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !345
  %43 = sub i64 %42, 1, !dbg !345
  store i64 %43, i64* %41, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !345
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !345
  %45 = load i8*, i8** %44, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !345
  %46 = bitcast i8* %45 to i32*, !dbg !345
  %47 = getelementptr inbounds i32, i32* %46, i64 %43, !dbg !345
  %48 = load i32, i32* %47, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !345
  br label %while.cond, !dbg !338

while.end:
  ret void, !dbg !306
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !348 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !350, metadata !DIExpression()), !dbg !349
  call void @llvm.dbg.value(metadata i32 %live, metadata !351, metadata !DIExpression()), !dbg !349
  call void @llvm.dbg.value(metadata i32 %used, metadata !352, metadata !DIExpression()), !dbg !349
  %0 = sext i32 %live to i64, !dbg !354
  %1 = mul nsw i64 %0, 2, !dbg !354
  %2 = sext i32 %used to i64, !dbg !357
  %3 = icmp slt i64 %1, %2, !dbg !354
  br i1 %3, label %if.then, label %if.end, !dbg !353

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !360
  ret %struct.nish_array* %slots, !dbg !362

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !366
  %5 = load i64, i64* %4, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !366
  %6 = trunc i64 %5 to i32, !dbg !366
  store i32 %6, i32* %n.addr, align 4, !dbg !364
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !367, metadata !DIExpression()), !dbg !364
  %7 = load i32, i32* %n.addr, align 4, !dbg !369
  %8 = icmp sge i32 %7, 0, !dbg !369
  br i1 %8, label %land.rhs, label %land.end, !dbg !369

land.rhs:
  %9 = load i32, i32* %n.addr, align 4, !dbg !371
  %10 = icmp slt i32 %9, 32768, !dbg !371
  br label %land.end, !dbg !369

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ], !dbg !369
  br i1 %11, label %if.then.1, label %if.end.1, !dbg !368

if.then.1:
  %12 = load i32, i32* %n.addr, align 4, !dbg !377
  %13 = mul nsw i32 %12, 2, !dbg !377
  %14 = trunc i32 %13 to i16, !dbg !376
  %15 = zext i16 %14 to i64, !dbg !375
  %16 = call i8* @nish_alloc_struct(i64 24), !dbg !375
  %17 = bitcast i8* %16 to %struct.nish_array*, !dbg !375
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0, !dbg !375
  store i64 %15, i64* %18, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !375
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1, !dbg !375
  store i64 %15, i64* %19, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !375
  %20 = mul i64 %15, 4, !dbg !375
  %21 = call i8* @nish_alloc_struct(i64 %20), !dbg !375
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !76, !noalias !75, !dbg !375
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2, !dbg !375
  store i8* %21, i8** %22, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !375
  ret %struct.nish_array* %17, !dbg !374

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2), !dbg !379
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !382
  ret %struct.nish_array* %slots, !dbg !384
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #1 !dbg !388 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !390, metadata !DIExpression()), !dbg !389
  call void @llvm.dbg.value(metadata i32 %times, metadata !391, metadata !DIExpression()), !dbg !389
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !394
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !394
  %2 = trunc i64 %1 to i32, !dbg !394
  store i32 %2, i32* %n.addr, align 4, !dbg !392
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !395, metadata !DIExpression()), !dbg !392
  store i32 1, i32* %k.addr, align 4, !dbg !396
  call void @llvm.dbg.declare(metadata i32* %k.addr, metadata !398, metadata !DIExpression()), !dbg !396
  br label %for.cond, !dbg !396

for.cond:
  %3 = load i32, i32* %k.addr, align 4, !dbg !399
  %4 = icmp slt i32 %3, %times, !dbg !399
  br i1 %4, label %for.body, label %for.end, !dbg !396

for.body:
  store i32 0, i32* %i.addr, align 4, !dbg !402
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !404, metadata !DIExpression()), !dbg !402
  br label %for.cond.1, !dbg !402

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4, !dbg !405
  %6 = load i32, i32* %n.addr, align 4, !dbg !406
  %7 = icmp slt i32 %5, %6, !dbg !405
  br i1 %7, label %for.body.1, label %for.end.1, !dbg !402

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !408
  %9 = load i64, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !408
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1, !dbg !408
  %11 = load i64, i64* %10, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !408
  %12 = icmp eq i64 %9, %11, !dbg !408
  br i1 %12, label %push.grow, label %push.store, !dbg !408

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4), !dbg !408
  br label %push.store, !dbg !408

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !408
  %14 = load i8*, i8** %13, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !408
  %15 = bitcast i8* %14 to i32*, !dbg !408
  %16 = getelementptr inbounds i32, i32* %15, i64 %9, !dbg !408
  store i32 0, i32* %16, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !408
  %17 = add i64 %9, 1, !dbg !408
  store i64 %17, i64* %8, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !408
  %18 = trunc i64 %17 to i32, !dbg !408
  br label %for.inc.1, !dbg !402

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4, !dbg !410
  %20 = add nsw i32 %19, 1, !dbg !410
  store i32 %20, i32* %i.addr, align 4, !dbg !410
  br label %for.cond.1, !dbg !402

for.end.1:
  br label %for.inc, !dbg !396

for.inc:
  %21 = load i32, i32* %k.addr, align 4, !dbg !411
  %22 = add nsw i32 %21, 1, !dbg !411
  store i32 %22, i32* %k.addr, align 4, !dbg !411
  br label %for.cond, !dbg !396

for.end:
  ret void, !dbg !389
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !414 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !416, metadata !DIExpression()), !dbg !415
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !417, metadata !DIExpression()), !dbg !415
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !420
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !420
  %2 = trunc i64 %1 to i32, !dbg !420
  %3 = sub nsw i32 %2, 1, !dbg !419
  store i32 %3, i32* %mask.addr, align 4, !dbg !418
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !422, metadata !DIExpression()), !dbg !418
  store i32 0, i32* %i.addr, align 4, !dbg !423
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !425, metadata !DIExpression()), !dbg !423
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !423
  %5 = load i64, i64* %4, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !423
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !423
  %7 = load i8*, i8** %6, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !423
  br label %for.cond, !dbg !423

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !427
  %9 = trunc i64 %5 to i32, !dbg !426
  %10 = icmp slt i32 %8, %9, !dbg !427
  br i1 %10, label %for.body, label %for.end, !dbg !423

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !432
  %12 = sext i32 %11 to i64, !dbg !431
  %13 = bitcast i8* %7 to i32*, !dbg !431
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !431
  %15 = load i32, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !431
  store i32 %15, i32* %h.addr, align 4, !dbg !430
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !433, metadata !DIExpression()), !dbg !430
  %16 = load i32, i32* %h.addr, align 4, !dbg !435
  %17 = icmp ne i32 %16, 0, !dbg !435
  br i1 %17, label %if.then, label %if.end, !dbg !434

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !440
  %19 = load i32, i32* %h.addr, align 4, !dbg !441
  %20 = load i32, i32* %i.addr, align 4, !dbg !442
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !438
  br label %if.end, !dbg !434

if.end:
  br label %for.inc, !dbg !423

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !443
  %22 = add nsw i32 %21, 1, !dbg !443
  store i32 %22, i32* %i.addr, align 4, !dbg !443
  br label %for.cond, !dbg !423

for.end:
  ret void, !dbg !415
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !444 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !446, metadata !DIExpression()), !dbg !445
  store i32 0, i32* %i.addr, align 4, !dbg !447
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !449, metadata !DIExpression()), !dbg !447
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !447
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !447
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !447
  %3 = load i8*, i8** %2, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !447
  br label %for.cond, !dbg !447

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !451
  %5 = trunc i64 %1 to i32, !dbg !450
  %6 = icmp slt i32 %4, %5, !dbg !451
  br i1 %6, label %for.body, label %for.end, !dbg !447

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !455
  %8 = sext i32 %7 to i64, !dbg !454
  %9 = bitcast i8* %3 to i32*, !dbg !454
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !454
  store i32 0, i32* %10, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !454
  br label %for.inc, !dbg !447

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !457
  %12 = add nsw i32 %11, 1, !dbg !457
  store i32 %12, i32* %i.addr, align 4, !dbg !457
  br label %for.cond, !dbg !447

for.end:
  ret void, !dbg !445
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 !dbg !461 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !463, metadata !DIExpression()), !dbg !462
  call void @llvm.dbg.value(metadata i32 %mask, metadata !464, metadata !DIExpression()), !dbg !462
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !465, metadata !DIExpression()), !dbg !462
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !466, metadata !DIExpression()), !dbg !462
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !469
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !469
  %2 = trunc i64 %1 to i32, !dbg !469
  store i32 %2, i32* %used.addr, align 4, !dbg !467
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !470, metadata !DIExpression()), !dbg !467
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !473
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !473
  %5 = trunc i64 %4 to i32, !dbg !473
  store i32 %5, i32* %size.addr, align 4, !dbg !471
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !474, metadata !DIExpression()), !dbg !471
  %6 = load i32, i32* %used.addr, align 4, !dbg !477
  %7 = sext i32 %6 to i64, !dbg !476
  %8 = mul nsw i64 %7, 4, !dbg !476
  %9 = load i32, i32* %size.addr, align 4, !dbg !480
  %10 = sext i32 %9 to i64, !dbg !479
  %11 = mul nsw i64 %10, 3, !dbg !479
  %12 = icmp sgt i64 %8, %11, !dbg !476
  br i1 %12, label %lor.end.1, label %lor.rhs.1, !dbg !476

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0, !dbg !482
  br label %lor.end.1, !dbg !476

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ], !dbg !476
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !476

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4, !dbg !485
  %16 = icmp sge i32 %bucket, %15, !dbg !484
  br label %lor.end, !dbg !476

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ], !dbg !476
  br i1 %17, label %if.then, label %if.end, !dbg !475

if.then:
  ret i1 false, !dbg !487

if.end:
  %18 = load i32, i32* %used.addr, align 4, !dbg !490
  %19 = icmp sgt i32 %18, 0, !dbg !490
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !489

if.then.1:
  %20 = sext i32 %bucket to i64, !dbg !493
  %21 = load i32, i32* %used.addr, align 4, !dbg !497
  %22 = sub nsw i32 %21, 1, !dbg !497
  %23 = sext i32 %22 to i64, !dbg !496
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !496
  %25 = load i8*, i8** %24, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !496
  %26 = bitcast i8* %25 to i32*, !dbg !496
  %27 = getelementptr inbounds i32, i32* %26, i64 %23, !dbg !496
  %28 = load i32, i32* %27, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !496
  %29 = load i32, i32* %used.addr, align 4, !dbg !500
  %30 = sub nsw i32 %29, 1, !dbg !500
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30), !dbg !495
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !493
  %33 = load i8*, i8** %32, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !493
  %34 = bitcast i8* %33 to i32*, !dbg !493
  %35 = getelementptr inbounds i32, i32* %34, i64 %20, !dbg !493
  store i32 %31, i32* %35, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !493
  br label %if.end.1, !dbg !489

if.end.1:
  ret i1 true, !dbg !502
}

define internal void @nish.Map$em.p1.en$Kind$i32.constructor(%struct.Map$em.p1.en$Kind$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 !dbg !506 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !508, metadata !DIExpression()), !dbg !507
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !507
  store i32 0, i32* %0, align 4, !tbaa !511, !dbg !507
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !507
  store i32 7, i32* %1, align 4, !tbaa !512, !dbg !507
  %2 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !507
  store i32 0, i32* %2, align 4, !tbaa !513, !dbg !507
  %3 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 7, !dbg !507
  store i32 0, i32* %3, align 4, !tbaa !514, !dbg !507
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !516
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !516
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !516
  store i64 8, i64* %6, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !516
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !516
  store i64 8, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !516
  %8 = mul i64 8, 4, !dbg !516
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !516
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !76, !noalias !75, !dbg !516
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !516
  store i8* %9, i8** %10, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !516
  %11 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !515
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !517, !dbg !515
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !519
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !519
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !519
  store i64 0, i64* %14, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !519
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !519
  store i64 0, i64* %15, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !519
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !519
  store i8* null, i8** %16, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !519
  %17 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !518
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !520, !dbg !518
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !522
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !522
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !522
  store i64 0, i64* %20, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !522
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !522
  store i64 0, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !522
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !522
  store i8* null, i8** %22, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !522
  %23 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !521
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !523, !dbg !521
  %24 = call i8* @nish_alloc_struct(i64 24), !dbg !525
  %25 = bitcast i8* %24 to %struct.nish_array*, !dbg !525
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0, !dbg !525
  store i64 0, i64* %26, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !525
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1, !dbg !525
  store i64 0, i64* %27, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !525
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2, !dbg !525
  store i8* null, i8** %28, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !525
  %29 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !524
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !526, !dbg !524
  ret void, !dbg !507
}

define internal noundef i64 @nish.Map$em.p1.en$Kind$i32.probe(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #3 !dbg !529 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !531, metadata !DIExpression()), !dbg !530
  call void @llvm.dbg.value(metadata i32 %key, metadata !532, metadata !DIExpression()), !dbg !530
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !535
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !517, !dbg !535
  %2 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !536
  %3 = load i32, i32* %2, align 4, !tbaa !512, !dbg !536
  %4 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !537
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !526, !dbg !537
  %6 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !538
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !520, !dbg !538
  %8 = call i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !534
  ret i64 %8, !dbg !533
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$em.p1.en$Kind$i32* @nish.Map$em.p1.en$Kind$i32.set(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, i32 noundef %value) #0 !dbg !542 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !544, metadata !DIExpression()), !dbg !543
  call void @llvm.dbg.value(metadata i32 %key, metadata !545, metadata !DIExpression()), !dbg !543
  call void @llvm.dbg.value(metadata i32 %value, metadata !546, metadata !DIExpression()), !dbg !543
  %0 = call i64 @nish.Map$em.p1.en$Kind$i32.probe(%struct.Map$em.p1.en$Kind$i32* %this, i32 %key), !dbg !548
  store i64 %0, i64* %found.addr, align 8, !dbg !547
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !550, metadata !DIExpression()), !dbg !547
  %1 = load i64, i64* %found.addr, align 8, !dbg !552
  %2 = icmp sge i64 %1, 0, !dbg !552
  br i1 %2, label %if.then, label %if.else, !dbg !551

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !557
  %4 = trunc i64 %3 to i32, !dbg !556
  call void @nish.Map$em.p1.en$Kind$i32.setValueAt(%struct.Map$em.p1.en$Kind$i32* %this, i32 %4, i32 %value), !dbg !555
  br label %if.end, !dbg !551

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !561
  call void @nish.Map$em.p1.en$Kind$i32.insertAt(%struct.Map$em.p1.en$Kind$i32* %this, i64 %5, i32 %key, i32 %value), !dbg !560
  br label %if.end, !dbg !551

if.end:
  ret %struct.Map$em.p1.en$Kind$i32* %this, !dbg !564
}

define internal noundef i32 @nish.Map$em.p1.en$Kind$i32.valueAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %none) #4 !dbg !568 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !570, metadata !DIExpression()), !dbg !569
  call void @llvm.dbg.value(metadata i32 %index, metadata !571, metadata !DIExpression()), !dbg !569
  call void @llvm.dbg.value(metadata i32 %none, metadata !572, metadata !DIExpression()), !dbg !569
  %0 = icmp sge i32 %index, 0, !dbg !574
  br i1 %0, label %land.rhs, label %land.end, !dbg !574

land.rhs:
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !578
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !523, !dbg !578
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !578
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !578
  %5 = trunc i64 %4 to i32, !dbg !578
  %6 = icmp slt i32 %index, %5, !dbg !576
  br label %land.end, !dbg !574

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !574
  br i1 %7, label %if.then, label %if.end, !dbg !573

if.then:
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !581
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !523, !dbg !581
  %10 = sext i32 %index to i64, !dbg !581
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !581
  %12 = load i8*, i8** %11, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !581
  %13 = bitcast i8* %12 to i32*, !dbg !581
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !581
  %15 = load i32, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !581
  ret i32 %15, !dbg !580

if.end:
  ret i32 %none, !dbg !583
}

define internal void @nish.Map$em.p1.en$Kind$i32.setValueAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #1 !dbg !587 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !589, metadata !DIExpression()), !dbg !588
  call void @llvm.dbg.value(metadata i32 %index, metadata !590, metadata !DIExpression()), !dbg !588
  call void @llvm.dbg.value(metadata i32 %value, metadata !591, metadata !DIExpression()), !dbg !588
  %0 = icmp sge i32 %index, 0, !dbg !593
  br i1 %0, label %land.rhs, label %land.end, !dbg !593

land.rhs:
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !597
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !523, !dbg !597
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !597
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !597
  %5 = trunc i64 %4 to i32, !dbg !597
  %6 = icmp slt i32 %index, %5, !dbg !595
  br label %land.end, !dbg !593

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !593
  br i1 %7, label %if.then, label %if.end, !dbg !592

if.then:
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !599
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !523, !dbg !599
  %10 = sext i32 %index to i64, !dbg !599
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !599
  %12 = load i8*, i8** %11, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !599
  %13 = bitcast i8* %12 to i32*, !dbg !599
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !599
  store i32 %value, i32* %14, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !599
  br label %if.end, !dbg !592

if.end:
  ret void, !dbg !588
}

define internal void @nish.Map$em.p1.en$Kind$i32.insertAt(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, i32 noundef %value) #0 !dbg !604 {
entry:
  %packed.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !606, metadata !DIExpression()), !dbg !605
  call void @llvm.dbg.value(metadata i64 %absent, metadata !607, metadata !DIExpression()), !dbg !605
  call void @llvm.dbg.value(metadata i32 %key, metadata !608, metadata !DIExpression()), !dbg !605
  call void @llvm.dbg.value(metadata i32 %value, metadata !609, metadata !DIExpression()), !dbg !605
  %0 = sub nsw i64 -1, %absent, !dbg !611
  store i64 %0, i64* %packed.addr, align 8, !dbg !610
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !613, metadata !DIExpression()), !dbg !610
  %1 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !614
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !520, !dbg !614
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !614
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !614
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !614
  %6 = load i64, i64* %5, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !614
  %7 = icmp eq i64 %4, %6, !dbg !614
  br i1 %7, label %push.grow, label %push.store, !dbg !614

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4), !dbg !614
  br label %push.store, !dbg !614

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !614
  %9 = load i8*, i8** %8, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !614
  %10 = bitcast i8* %9 to i32*, !dbg !614
  %11 = getelementptr inbounds i32, i32* %10, i64 %4, !dbg !614
  store i32 %key, i32* %11, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !614
  %12 = add i64 %4, 1, !dbg !614
  store i64 %12, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !614
  %13 = trunc i64 %12 to i32, !dbg !614
  %14 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !616
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !523, !dbg !616
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !616
  %17 = load i64, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !616
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !616
  %19 = load i64, i64* %18, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !616
  %20 = icmp eq i64 %17, %19, !dbg !616
  br i1 %20, label %push.grow.1, label %push.store.1, !dbg !616

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4), !dbg !616
  br label %push.store.1, !dbg !616

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !616
  %22 = load i8*, i8** %21, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !616
  %23 = bitcast i8* %22 to i32*, !dbg !616
  %24 = getelementptr inbounds i32, i32* %23, i64 %17, !dbg !616
  store i32 %value, i32* %24, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !616
  %25 = add i64 %17, 1, !dbg !616
  store i64 %25, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !616
  %26 = trunc i64 %25 to i32, !dbg !616
  %27 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !618
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !526, !dbg !618
  %29 = load i64, i64* %packed.addr, align 8, !dbg !620
  %30 = trunc i64 %29 to i32, !dbg !619
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0, !dbg !618
  %32 = load i64, i64* %31, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !618
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1, !dbg !618
  %34 = load i64, i64* %33, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !618
  %35 = icmp eq i64 %32, %34, !dbg !618
  br i1 %35, label %push.grow.2, label %push.store.2, !dbg !618

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4), !dbg !618
  br label %push.store.2, !dbg !618

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2, !dbg !618
  %37 = load i8*, i8** %36, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !618
  %38 = bitcast i8* %37 to i32*, !dbg !618
  %39 = getelementptr inbounds i32, i32* %38, i64 %32, !dbg !618
  store i32 %30, i32* %39, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !618
  %40 = add i64 %32, 1, !dbg !618
  store i64 %40, i64* %31, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !618
  %41 = trunc i64 %40 to i32, !dbg !618
  call void @nish.Map$em.p1.en$Kind$i32.addOne(%struct.Map$em.p1.en$Kind$i32* %this), !dbg !621
  %42 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !625
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !517, !dbg !625
  %44 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !626
  %45 = load i32, i32* %44, align 4, !tbaa !512, !dbg !626
  %46 = load i64, i64* %packed.addr, align 8, !dbg !628
  %47 = ashr i64 %46, 32, !dbg !628
  %48 = trunc i64 %47 to i32, !dbg !627
  %49 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !629
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !526, !dbg !629
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50), !dbg !624
  %52 = xor i1 %51, true, !dbg !623
  br i1 %52, label %if.then, label %if.end, !dbg !622

if.then:
  call void @nish.Map$em.p1.en$Kind$i32.rebuild(%struct.Map$em.p1.en$Kind$i32* %this), !dbg !631
  br label %if.end, !dbg !622

if.end:
  ret void, !dbg !605
}

define internal void @nish.Map$em.p1.en$Kind$i32.addOne(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 !dbg !632 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !634, metadata !DIExpression()), !dbg !633
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !636
  %1 = load i32, i32* %0, align 4, !tbaa !513, !dbg !636
  store i32 %1, i32* %live.addr, align 4, !dbg !635
  call void @llvm.dbg.declare(metadata i32* %live.addr, metadata !637, metadata !DIExpression()), !dbg !635
  %2 = load i32, i32* %live.addr, align 4, !dbg !639
  %3 = icmp slt i32 %2, 2147483647, !dbg !639
  br i1 %3, label %if.then, label %if.end, !dbg !638

if.then:
  %4 = load i32, i32* %live.addr, align 4, !dbg !643
  %5 = add nsw i32 %4, 1, !dbg !643
  %6 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !642
  store i32 %5, i32* %6, align 4, !tbaa !513, !dbg !642
  br label %if.end, !dbg !638

if.end:
  %7 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !646
  %8 = load i32, i32* %7, align 4, !tbaa !511, !dbg !646
  store i32 %8, i32* %size.addr, align 4, !dbg !645
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !647, metadata !DIExpression()), !dbg !645
  %9 = load i32, i32* %size.addr, align 4, !dbg !649
  %10 = icmp slt i32 %9, 2147483647, !dbg !649
  br i1 %10, label %if.then.1, label %if.end.1, !dbg !648

if.then.1:
  %11 = load i32, i32* %size.addr, align 4, !dbg !653
  %12 = add nsw i32 %11, 1, !dbg !653
  %13 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 0, !dbg !652
  store i32 %12, i32* %13, align 4, !tbaa !511, !dbg !652
  br label %if.end.1, !dbg !648

if.end.1:
  ret void, !dbg !633
}

define internal void @nish.Map$em.p1.en$Kind$i32.rebuild(%struct.Map$em.p1.en$Kind$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !655 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$em.p1.en$Kind$i32* %this, metadata !657, metadata !DIExpression()), !dbg !656
  %0 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !660
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !520, !dbg !660
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !660
  %3 = load i64, i64* %2, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !660
  %4 = trunc i64 %3 to i32, !dbg !660
  store i32 %4, i32* %used.addr, align 4, !dbg !658
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !661, metadata !DIExpression()), !dbg !658
  %5 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 7, !dbg !663
  %6 = load i32, i32* %5, align 4, !tbaa !514, !dbg !663
  %7 = icmp ugt i32 %6, 0, !dbg !663
  store i1 %7, i1* %walking.addr, align 1, !dbg !662
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !665, metadata !DIExpression()), !dbg !662
  %8 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !668
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !517, !dbg !668
  %10 = load i1, i1* %walking.addr, align 1, !dbg !669
  br i1 %10, label %cond.true, label %cond.false, !dbg !669

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !670
  br label %cond.end, !dbg !669

cond.false:
  %12 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !671
  %13 = load i32, i32* %12, align 4, !tbaa !513, !dbg !671
  br label %cond.end, !dbg !669

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !669
  %15 = load i32, i32* %used.addr, align 4, !dbg !672
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !667
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !666
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !673, metadata !DIExpression()), !dbg !666
  %17 = load i1, i1* %walking.addr, align 1, !dbg !676
  %18 = xor i1 %17, true, !dbg !675
  br i1 %18, label %land.rhs, label %land.end, !dbg !675

land.rhs:
  %19 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 3, !dbg !677
  %20 = load i32, i32* %19, align 4, !tbaa !513, !dbg !677
  %21 = load i32, i32* %used.addr, align 4, !dbg !678
  %22 = icmp slt i32 %20, %21, !dbg !677
  br label %land.end, !dbg !675

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !675
  br i1 %23, label %if.then, label %if.end, !dbg !674

if.then:
  %24 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 4, !dbg !681
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !520, !dbg !681
  %26 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !682
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !526, !dbg !682
  call void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !680
  %28 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 5, !dbg !684
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !523, !dbg !684
  %30 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !685
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !526, !dbg !685
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !683
  %32 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !687
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !526, !dbg !687
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !686
  br label %if.end, !dbg !674

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !689
  %35 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 1, !dbg !688
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !517, !dbg !688
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !692
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !692
  %38 = load i64, i64* %37, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !692
  %39 = trunc i64 %38 to i32, !dbg !692
  %40 = sub nsw i32 %39, 1, !dbg !691
  %41 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 2, !dbg !690
  store i32 %40, i32* %41, align 4, !tbaa !512, !dbg !690
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !695
  %43 = getelementptr inbounds %struct.Map$em.p1.en$Kind$i32, %struct.Map$em.p1.en$Kind$i32* %this, i32 0, i32 6, !dbg !696
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !526, !dbg !696
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !694
  ret void, !dbg !656
}

define internal void @nish.Set$em.p1.en$Kind.constructor(%struct.Set$em.p1.en$Kind* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #1 !dbg !699 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !701, metadata !DIExpression()), !dbg !700
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !700
  store i32 0, i32* %0, align 4, !tbaa !703, !dbg !700
  %1 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !700
  store i32 7, i32* %1, align 4, !tbaa !704, !dbg !700
  %2 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !700
  store i32 0, i32* %2, align 4, !tbaa !705, !dbg !700
  %3 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 6, !dbg !700
  store i32 0, i32* %3, align 4, !tbaa !706, !dbg !700
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !708
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !708
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !708
  store i64 8, i64* %6, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !708
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !708
  store i64 8, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !708
  %8 = mul i64 8, 4, !dbg !708
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !708
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !76, !noalias !75, !dbg !708
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !708
  store i8* %9, i8** %10, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !708
  %11 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !707
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !709, !dbg !707
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !711
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !711
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !711
  store i64 0, i64* %14, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !711
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !711
  store i64 0, i64* %15, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !711
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !711
  store i8* null, i8** %16, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !711
  %17 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !710
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !712, !dbg !710
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !714
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !714
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !714
  store i64 0, i64* %20, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !714
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !714
  store i64 0, i64* %21, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !714
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !714
  store i8* null, i8** %22, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !714
  %23 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !713
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !715, !dbg !713
  ret void, !dbg !700
}

define internal noundef i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #3 !dbg !718 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !720, metadata !DIExpression()), !dbg !719
  call void @llvm.dbg.value(metadata i32 %key, metadata !721, metadata !DIExpression()), !dbg !719
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !724
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !709, !dbg !724
  %2 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !725
  %3 = load i32, i32* %2, align 4, !tbaa !704, !dbg !725
  %4 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !726
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !715, !dbg !726
  %6 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !727
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !712, !dbg !727
  %8 = call i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !723
  ret i64 %8, !dbg !722
}

define internal noundef zeroext i1 @nish.Set$em.p1.en$Kind.has(%struct.Set$em.p1.en$Kind* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #3 !dbg !731 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !733, metadata !DIExpression()), !dbg !732
  call void @llvm.dbg.value(metadata i32 %key, metadata !734, metadata !DIExpression()), !dbg !732
  %0 = call i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* %this, i32 %key), !dbg !736
  %1 = icmp sge i64 %0, 0, !dbg !736
  ret i1 %1, !dbg !735
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$em.p1.en$Kind* @nish.Set$em.p1.en$Kind.add(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) %this, i32 noundef %key) #0 !dbg !741 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !743, metadata !DIExpression()), !dbg !742
  call void @llvm.dbg.value(metadata i32 %key, metadata !744, metadata !DIExpression()), !dbg !742
  %0 = call i64 @nish.Set$em.p1.en$Kind.probe(%struct.Set$em.p1.en$Kind* %this, i32 %key), !dbg !746
  store i64 %0, i64* %found.addr, align 8, !dbg !745
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !748, metadata !DIExpression()), !dbg !745
  %1 = load i64, i64* %found.addr, align 8, !dbg !750
  %2 = icmp slt i64 %1, 0, !dbg !750
  br i1 %2, label %if.then, label %if.end, !dbg !749

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !754
  call void @nish.Set$em.p1.en$Kind.insertAt(%struct.Set$em.p1.en$Kind* %this, i64 %3, i32 %key), !dbg !753
  br label %if.end, !dbg !749

if.end:
  ret %struct.Set$em.p1.en$Kind* %this, !dbg !756
}

define internal void @nish.Set$em.p1.en$Kind.insertAt(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !760 {
entry:
  %packed.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !762, metadata !DIExpression()), !dbg !761
  call void @llvm.dbg.value(metadata i64 %absent, metadata !763, metadata !DIExpression()), !dbg !761
  call void @llvm.dbg.value(metadata i32 %key, metadata !764, metadata !DIExpression()), !dbg !761
  %0 = sub nsw i64 -1, %absent, !dbg !766
  store i64 %0, i64* %packed.addr, align 8, !dbg !765
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !768, metadata !DIExpression()), !dbg !765
  %1 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !769
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !712, !dbg !769
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !769
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !769
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !769
  %6 = load i64, i64* %5, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !769
  %7 = icmp eq i64 %4, %6, !dbg !769
  br i1 %7, label %push.grow, label %push.store, !dbg !769

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4), !dbg !769
  br label %push.store, !dbg !769

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !769
  %9 = load i8*, i8** %8, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !769
  %10 = bitcast i8* %9 to i32*, !dbg !769
  %11 = getelementptr inbounds i32, i32* %10, i64 %4, !dbg !769
  store i32 %key, i32* %11, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !769
  %12 = add i64 %4, 1, !dbg !769
  store i64 %12, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !769
  %13 = trunc i64 %12 to i32, !dbg !769
  %14 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !771
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !715, !dbg !771
  %16 = load i64, i64* %packed.addr, align 8, !dbg !773
  %17 = trunc i64 %16 to i32, !dbg !772
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !771
  %19 = load i64, i64* %18, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !771
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !771
  %21 = load i64, i64* %20, align 8, !alias.scope !75, !noalias !76, !tbaa !83, !dbg !771
  %22 = icmp eq i64 %19, %21, !dbg !771
  br i1 %22, label %push.grow.1, label %push.store.1, !dbg !771

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4), !dbg !771
  br label %push.store.1, !dbg !771

push.store.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !771
  %24 = load i8*, i8** %23, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !771
  %25 = bitcast i8* %24 to i32*, !dbg !771
  %26 = getelementptr inbounds i32, i32* %25, i64 %19, !dbg !771
  store i32 %17, i32* %26, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !771
  %27 = add i64 %19, 1, !dbg !771
  store i64 %27, i64* %18, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !771
  %28 = trunc i64 %27 to i32, !dbg !771
  call void @nish.Set$em.p1.en$Kind.addOne(%struct.Set$em.p1.en$Kind* %this), !dbg !774
  %29 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !778
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !709, !dbg !778
  %31 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !779
  %32 = load i32, i32* %31, align 4, !tbaa !704, !dbg !779
  %33 = load i64, i64* %packed.addr, align 8, !dbg !781
  %34 = ashr i64 %33, 32, !dbg !781
  %35 = trunc i64 %34 to i32, !dbg !780
  %36 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !782
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !715, !dbg !782
  %38 = call i1 @nish.fileAppended(%struct.nish_array* %30, i32 %32, i32 %35, %struct.nish_array* %37), !dbg !777
  %39 = xor i1 %38, true, !dbg !776
  br i1 %39, label %if.then, label %if.end, !dbg !775

if.then:
  call void @nish.Set$em.p1.en$Kind.rebuild(%struct.Set$em.p1.en$Kind* %this), !dbg !784
  br label %if.end, !dbg !775

if.end:
  ret void, !dbg !761
}

define internal void @nish.Set$em.p1.en$Kind.addOne(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) nocapture %this) #1 !dbg !785 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !787, metadata !DIExpression()), !dbg !786
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !789
  %1 = load i32, i32* %0, align 4, !tbaa !705, !dbg !789
  store i32 %1, i32* %live.addr, align 4, !dbg !788
  call void @llvm.dbg.declare(metadata i32* %live.addr, metadata !790, metadata !DIExpression()), !dbg !788
  %2 = load i32, i32* %live.addr, align 4, !dbg !792
  %3 = icmp slt i32 %2, 2147483647, !dbg !792
  br i1 %3, label %if.then, label %if.end, !dbg !791

if.then:
  %4 = load i32, i32* %live.addr, align 4, !dbg !796
  %5 = add nsw i32 %4, 1, !dbg !796
  %6 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !795
  store i32 %5, i32* %6, align 4, !tbaa !705, !dbg !795
  br label %if.end, !dbg !791

if.end:
  %7 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !799
  %8 = load i32, i32* %7, align 4, !tbaa !703, !dbg !799
  store i32 %8, i32* %size.addr, align 4, !dbg !798
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !800, metadata !DIExpression()), !dbg !798
  %9 = load i32, i32* %size.addr, align 4, !dbg !802
  %10 = icmp slt i32 %9, 2147483647, !dbg !802
  br i1 %10, label %if.then.1, label %if.end.1, !dbg !801

if.then.1:
  %11 = load i32, i32* %size.addr, align 4, !dbg !806
  %12 = add nsw i32 %11, 1, !dbg !806
  %13 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 0, !dbg !805
  store i32 %12, i32* %13, align 4, !tbaa !703, !dbg !805
  br label %if.end.1, !dbg !801

if.end.1:
  ret void, !dbg !786
}

define internal void @nish.Set$em.p1.en$Kind.rebuild(%struct.Set$em.p1.en$Kind* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !808 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$em.p1.en$Kind* %this, metadata !810, metadata !DIExpression()), !dbg !809
  %0 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !813
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !712, !dbg !813
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !813
  %3 = load i64, i64* %2, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !813
  %4 = trunc i64 %3 to i32, !dbg !813
  store i32 %4, i32* %used.addr, align 4, !dbg !811
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !814, metadata !DIExpression()), !dbg !811
  %5 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 6, !dbg !816
  %6 = load i32, i32* %5, align 4, !tbaa !706, !dbg !816
  %7 = icmp ugt i32 %6, 0, !dbg !816
  store i1 %7, i1* %walking.addr, align 1, !dbg !815
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !818, metadata !DIExpression()), !dbg !815
  %8 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !821
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !709, !dbg !821
  %10 = load i1, i1* %walking.addr, align 1, !dbg !822
  br i1 %10, label %cond.true, label %cond.false, !dbg !822

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !823
  br label %cond.end, !dbg !822

cond.false:
  %12 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !824
  %13 = load i32, i32* %12, align 4, !tbaa !705, !dbg !824
  br label %cond.end, !dbg !822

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !822
  %15 = load i32, i32* %used.addr, align 4, !dbg !825
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !820
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !819
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !826, metadata !DIExpression()), !dbg !819
  %17 = load i1, i1* %walking.addr, align 1, !dbg !829
  %18 = xor i1 %17, true, !dbg !828
  br i1 %18, label %land.rhs, label %land.end, !dbg !828

land.rhs:
  %19 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 3, !dbg !830
  %20 = load i32, i32* %19, align 4, !tbaa !705, !dbg !830
  %21 = load i32, i32* %used.addr, align 4, !dbg !831
  %22 = icmp slt i32 %20, %21, !dbg !830
  br label %land.end, !dbg !828

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !828
  br i1 %23, label %if.then, label %if.end, !dbg !827

if.then:
  %24 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 4, !dbg !834
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !712, !dbg !834
  %26 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !835
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !715, !dbg !835
  call void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !833
  %28 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !837
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !715, !dbg !837
  call void @nish.compactHashes(%struct.nish_array* %29), !dbg !836
  br label %if.end, !dbg !827

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !839
  %31 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 1, !dbg !838
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !709, !dbg !838
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !842
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0, !dbg !842
  %34 = load i64, i64* %33, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !842
  %35 = trunc i64 %34 to i32, !dbg !842
  %36 = sub nsw i32 %35, 1, !dbg !841
  %37 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 2, !dbg !840
  store i32 %36, i32* %37, align 4, !tbaa !704, !dbg !840
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !845
  %39 = getelementptr inbounds %struct.Set$em.p1.en$Kind, %struct.Set$em.p1.en$Kind* %this, i32 0, i32 5, !dbg !846
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !715, !dbg !846
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40), !dbg !844
  ret void, !dbg !809
}

define internal noundef i64 @nish.probeTable$em.p1.en$Kind(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #3 !dbg !849 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !851, metadata !DIExpression()), !dbg !850
  call void @llvm.dbg.value(metadata i32 %mask, metadata !852, metadata !DIExpression()), !dbg !850
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !853, metadata !DIExpression()), !dbg !850
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !854, metadata !DIExpression()), !dbg !850
  call void @llvm.dbg.value(metadata i32 %key, metadata !855, metadata !DIExpression()), !dbg !850
  %0 = zext i32 %key to i64, !dbg !857
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8, !dbg !857
  %2 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8, !dbg !857
  %3 = mul i64 %0, %1, !dbg !857
  %4 = add i64 %3, %2, !dbg !857
  %5 = lshr i64 %4, 32, !dbg !857
  %6 = trunc i64 %5 to i32, !dbg !857
  %7 = icmp eq i32 %6, 0, !dbg !857
  %8 = select i1 %7, i32 1, i32 %6, !dbg !857
  store i32 %8, i32* %h.addr, align 4, !dbg !856
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !859, metadata !DIExpression()), !dbg !856
  store i32 %mask, i32* %low.addr, align 4, !dbg !860
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !863, metadata !DIExpression()), !dbg !860
  %9 = load i32, i32* %h.addr, align 4, !dbg !865
  %10 = load i32, i32* %low.addr, align 4, !dbg !867
  %11 = xor i32 %10, -1, !dbg !866
  %12 = and i32 %9, %11, !dbg !865
  store i32 %12, i32* %fingerprint.addr, align 4, !dbg !864
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !868, metadata !DIExpression()), !dbg !864
  %13 = load i32, i32* %h.addr, align 4, !dbg !872
  %14 = call i32 @nish.homeBucket(i32 %13, i32 %mask), !dbg !871
  store i32 %14, i32* %bucket.addr, align 4, !dbg !869
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !874, metadata !DIExpression()), !dbg !869
  %15 = load i32, i32* %bucket.addr, align 4, !dbg !877
  store i32 %15, i32* %b.addr, align 4, !dbg !875
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !878, metadata !DIExpression()), !dbg !875
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !879
  %17 = load i64, i64* %16, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !879
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !879
  %19 = load i8*, i8** %18, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !879
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !879
  %21 = load i64, i64* %20, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !879
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !879
  %23 = load i8*, i8** %22, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !879
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !879
  %25 = load i64, i64* %24, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !879
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !879
  %27 = load i8*, i8** %26, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !879
  br label %while.cond, !dbg !879

while.cond:
  %28 = load i32, i32* %b.addr, align 4, !dbg !883
  %29 = icmp sge i32 %28, 0, !dbg !883
  br i1 %29, label %land.rhs, label %land.end, !dbg !883

land.rhs:
  %30 = load i32, i32* %b.addr, align 4, !dbg !885
  %31 = trunc i64 %17 to i32, !dbg !880
  %32 = icmp slt i32 %30, %31, !dbg !885
  br label %land.end, !dbg !883

land.end:
  %33 = phi i1 [ false, %while.cond ], [ %32, %land.rhs ], !dbg !883
  br i1 %33, label %while.body, label %while.end, !dbg !879

while.body:
  %34 = load i32, i32* %b.addr, align 4, !dbg !890
  %35 = sext i32 %34 to i64, !dbg !889
  %36 = bitcast i8* %19 to i32*, !dbg !889
  %37 = getelementptr inbounds i32, i32* %36, i64 %35, !dbg !889
  %38 = load i32, i32* %37, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !889
  store i32 %38, i32* %word.addr, align 4, !dbg !888
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !891, metadata !DIExpression()), !dbg !888
  %39 = load i32, i32* %word.addr, align 4, !dbg !893
  %40 = icmp eq i32 %39, 0, !dbg !893
  br i1 %40, label %if.then, label %if.end, !dbg !892

if.then:
  %41 = load i32, i32* %b.addr, align 4, !dbg !898
  %42 = load i32, i32* %h.addr, align 4, !dbg !899
  %43 = tail call i64 @nish.absentAt(i32 %41, i32 %42), !dbg !897
  ret i64 %43, !dbg !896

if.end:
  %44 = load i32, i32* %word.addr, align 4, !dbg !902
  %45 = load i32, i32* %low.addr, align 4, !dbg !904
  %46 = xor i32 %45, -1, !dbg !903
  %47 = and i32 %44, %46, !dbg !902
  %48 = load i32, i32* %fingerprint.addr, align 4, !dbg !905
  %49 = icmp eq i32 %47, %48, !dbg !901
  br i1 %49, label %if.then.1, label %if.end.1, !dbg !900

if.then.1:
  %50 = load i32, i32* %word.addr, align 4, !dbg !910
  %51 = load i32, i32* %low.addr, align 4, !dbg !911
  %52 = and i32 %50, %51, !dbg !910
  %53 = sub i32 %52, 1, !dbg !909
  store i32 %53, i32* %at.addr, align 4, !dbg !907
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !913, metadata !DIExpression()), !dbg !907
  %54 = load i32, i32* %at.addr, align 4, !dbg !915
  %55 = icmp sge i32 %54, 0, !dbg !915
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !915

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !917
  %57 = trunc i64 %21 to i32, !dbg !881
  %58 = icmp slt i32 %56, %57, !dbg !917
  br label %land.end.4, !dbg !915

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !915
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !915

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !920
  %61 = sext i32 %60 to i64, !dbg !919
  %62 = bitcast i8* %23 to i32*, !dbg !919
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !919
  %64 = load i32, i32* %63, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !919
  %65 = load i32, i32* %h.addr, align 4, !dbg !921
  %66 = icmp eq i32 %64, %65, !dbg !919
  br label %land.end.3, !dbg !915

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !915
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !915

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !922
  %69 = trunc i64 %25 to i32, !dbg !882
  %70 = icmp slt i32 %68, %69, !dbg !922
  br label %land.end.2, !dbg !915

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !915
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !915

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !926
  %73 = sext i32 %72 to i64, !dbg !925
  %74 = bitcast i8* %27 to i32*, !dbg !925
  %75 = getelementptr inbounds i32, i32* %74, i64 %73, !dbg !925
  %76 = load i32, i32* %75, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !925
  %77 = icmp eq i32 %76, %key, !dbg !924
  br label %land.end.1, !dbg !915

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !915
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !914

if.then.2:
  %79 = load i32, i32* %b.addr, align 4, !dbg !931
  %80 = load i32, i32* %at.addr, align 4, !dbg !932
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !930
  ret i64 %81, !dbg !929

if.end.2:
  br label %if.end.1, !dbg !900

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !935
  %83 = add i32 %82, 1, !dbg !935
  %84 = load i32, i32* %low.addr, align 4, !dbg !937
  %85 = and i32 %83, %84, !dbg !934
  store i32 %85, i32* %bucket.addr, align 4, !dbg !933
  %86 = load i32, i32* %bucket.addr, align 4, !dbg !940
  store i32 %86, i32* %b.addr, align 4, !dbg !938
  br label %while.cond, !dbg !879

while.end:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !944
  %88 = load i64, i64* %87, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !944
  %89 = trunc i64 %88 to i32, !dbg !944
  %90 = load i32, i32* %h.addr, align 4, !dbg !945
  %91 = tail call i64 @nish.absentAt(i32 %89, i32 %90), !dbg !942
  ret i64 %91, !dbg !941
}

define internal void @nish.compactEntries$em.p1.en$Kind(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !948 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !950, metadata !DIExpression()), !dbg !949
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !951, metadata !DIExpression()), !dbg !949
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !954
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !954
  %2 = trunc i64 %1 to i32, !dbg !954
  store i32 %2, i32* %used.addr, align 4, !dbg !952
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !955, metadata !DIExpression()), !dbg !952
  store i32 0, i32* %to.addr, align 4, !dbg !956
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !958, metadata !DIExpression()), !dbg !956
  store i32 0, i32* %from.addr, align 4, !dbg !959
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !961, metadata !DIExpression()), !dbg !959
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !959
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !959
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !959
  %6 = load i8*, i8** %5, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !959
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !959
  %8 = load i64, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !959
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !959
  %10 = load i8*, i8** %9, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !959
  br label %for.cond, !dbg !959

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !964
  %12 = load i32, i32* %used.addr, align 4, !dbg !965
  %13 = icmp slt i32 %11, %12, !dbg !964
  br i1 %13, label %land.rhs, label %land.end, !dbg !964

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !966
  %15 = trunc i64 %4 to i32, !dbg !962
  %16 = icmp slt i32 %14, %15, !dbg !966
  br label %land.end, !dbg !964

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !964
  br i1 %17, label %for.body, label %for.end, !dbg !959

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !971
  %19 = sext i32 %18 to i64, !dbg !970
  %20 = bitcast i8* %6 to i32*, !dbg !970
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !970
  %22 = load i32, i32* %21, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !970
  %23 = icmp ne i32 %22, 0, !dbg !970
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !970

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !973
  %25 = icmp sge i32 %24, 0, !dbg !973
  br label %land.end.3, !dbg !970

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !970
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !970

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !975
  %28 = load i32, i32* %used.addr, align 4, !dbg !976
  %29 = icmp slt i32 %27, %28, !dbg !975
  br label %land.end.2, !dbg !970

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !970
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !970

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !977
  %32 = trunc i64 %8 to i32, !dbg !963
  %33 = icmp slt i32 %31, %32, !dbg !977
  br label %land.end.1, !dbg !970

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !970
  br i1 %34, label %if.then, label %if.end, !dbg !969

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !981
  %36 = sext i32 %35 to i64, !dbg !980
  %37 = load i32, i32* %from.addr, align 4, !dbg !983
  %38 = sext i32 %37 to i64, !dbg !982
  %39 = bitcast i8* %10 to i32*, !dbg !982
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !982
  %41 = load i32, i32* %40, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !982
  %42 = bitcast i8* %10 to i32*, !dbg !980
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !980
  store i32 %41, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !980
  %44 = load i32, i32* %to.addr, align 4, !dbg !984
  %45 = add nsw i32 %44, 1, !dbg !984
  store i32 %45, i32* %to.addr, align 4, !dbg !984
  br label %if.end, !dbg !969

if.end:
  br label %for.inc, !dbg !959

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !985
  %47 = add nsw i32 %46, 1, !dbg !985
  store i32 %47, i32* %from.addr, align 4, !dbg !985
  br label %for.cond, !dbg !959

for.end:
  br label %while.cond, !dbg !986

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !988
  %49 = load i64, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !988
  %50 = trunc i64 %49 to i32, !dbg !988
  %51 = load i32, i32* %to.addr, align 4, !dbg !989
  %52 = icmp sgt i32 %50, %51, !dbg !987
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !987

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !990
  %54 = load i64, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !990
  %55 = trunc i64 %54 to i32, !dbg !990
  %56 = icmp sgt i32 %55, 0, !dbg !990
  br label %land.end.4, !dbg !987

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !987
  br i1 %57, label %while.body, label %while.end, !dbg !986

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !993
  %59 = load i64, i64* %58, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !993
  %60 = sub i64 %59, 1, !dbg !993
  store i64 %60, i64* %58, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !993
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !993
  %62 = load i8*, i8** %61, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !993
  %63 = bitcast i8* %62 to i32*, !dbg !993
  %64 = getelementptr inbounds i32, i32* %63, i64 %60, !dbg !993
  %65 = load i32, i32* %64, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !993
  br label %while.cond, !dbg !986

while.end:
  ret void, !dbg !949
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !996 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !998, metadata !DIExpression()), !dbg !997
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !999, metadata !DIExpression()), !dbg !997
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !1002
  %1 = load i64, i64* %0, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1002
  %2 = trunc i64 %1 to i32, !dbg !1002
  store i32 %2, i32* %used.addr, align 4, !dbg !1000
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !1003, metadata !DIExpression()), !dbg !1000
  store i32 0, i32* %to.addr, align 4, !dbg !1004
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !1006, metadata !DIExpression()), !dbg !1004
  store i32 0, i32* %from.addr, align 4, !dbg !1007
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !1009, metadata !DIExpression()), !dbg !1007
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !1007
  %4 = load i64, i64* %3, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1007
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !1007
  %6 = load i8*, i8** %5, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !1007
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !1007
  %8 = load i64, i64* %7, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1007
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !1007
  %10 = load i8*, i8** %9, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !1007
  br label %for.cond, !dbg !1007

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !1012
  %12 = load i32, i32* %used.addr, align 4, !dbg !1013
  %13 = icmp slt i32 %11, %12, !dbg !1012
  br i1 %13, label %land.rhs, label %land.end, !dbg !1012

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !1014
  %15 = trunc i64 %4 to i32, !dbg !1010
  %16 = icmp slt i32 %14, %15, !dbg !1014
  br label %land.end, !dbg !1012

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !1012
  br i1 %17, label %for.body, label %for.end, !dbg !1007

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !1019
  %19 = sext i32 %18 to i64, !dbg !1018
  %20 = bitcast i8* %6 to i32*, !dbg !1018
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !1018
  %22 = load i32, i32* %21, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !1018
  %23 = icmp ne i32 %22, 0, !dbg !1018
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !1018

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !1021
  %25 = icmp sge i32 %24, 0, !dbg !1021
  br label %land.end.3, !dbg !1018

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !1018
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !1018

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !1023
  %28 = load i32, i32* %used.addr, align 4, !dbg !1024
  %29 = icmp slt i32 %27, %28, !dbg !1023
  br label %land.end.2, !dbg !1018

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !1018
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !1018

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !1025
  %32 = trunc i64 %8 to i32, !dbg !1011
  %33 = icmp slt i32 %31, %32, !dbg !1025
  br label %land.end.1, !dbg !1018

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !1018
  br i1 %34, label %if.then, label %if.end, !dbg !1017

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !1029
  %36 = sext i32 %35 to i64, !dbg !1028
  %37 = load i32, i32* %from.addr, align 4, !dbg !1031
  %38 = sext i32 %37 to i64, !dbg !1030
  %39 = bitcast i8* %10 to i32*, !dbg !1030
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !1030
  %41 = load i32, i32* %40, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !1030
  %42 = bitcast i8* %10 to i32*, !dbg !1028
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !1028
  store i32 %41, i32* %43, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !1028
  %44 = load i32, i32* %to.addr, align 4, !dbg !1032
  %45 = add nsw i32 %44, 1, !dbg !1032
  store i32 %45, i32* %to.addr, align 4, !dbg !1032
  br label %if.end, !dbg !1017

if.end:
  br label %for.inc, !dbg !1007

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !1033
  %47 = add nsw i32 %46, 1, !dbg !1033
  store i32 %47, i32* %from.addr, align 4, !dbg !1033
  br label %for.cond, !dbg !1007

for.end:
  br label %while.cond, !dbg !1034

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !1036
  %49 = load i64, i64* %48, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1036
  %50 = trunc i64 %49 to i32, !dbg !1036
  %51 = load i32, i32* %to.addr, align 4, !dbg !1037
  %52 = icmp sgt i32 %50, %51, !dbg !1035
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !1035

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !1038
  %54 = load i64, i64* %53, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1038
  %55 = trunc i64 %54 to i32, !dbg !1038
  %56 = icmp sgt i32 %55, 0, !dbg !1038
  br label %land.end.4, !dbg !1035

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !1035
  br i1 %57, label %while.body, label %while.end, !dbg !1034

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !1041
  %59 = load i64, i64* %58, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1041
  %60 = sub i64 %59, 1, !dbg !1041
  store i64 %60, i64* %58, align 8, !alias.scope !75, !noalias !76, !tbaa !82, !dbg !1041
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !1041
  %62 = load i8*, i8** %61, align 8, !alias.scope !75, !noalias !76, !tbaa !84, !dbg !1041
  %63 = bitcast i8* %62 to i32*, !dbg !1041
  %64 = getelementptr inbounds i32, i32* %63, i64 %60, !dbg !1041
  %65 = load i32, i32* %64, align 4, !alias.scope !76, !noalias !75, !tbaa !89, !dbg !1041
  br label %while.cond, !dbg !1034

while.end:
  ret void, !dbg !997
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3, !1042, !1043, !1044, !1045, !1046}
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<Kind.Array, i32>", file: !13, line: 330, size: 448, align: 64, elements: !50)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 332, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 334, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 336, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 338, baseType: !4, size: 32, offset: 160)
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
!39 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 339, baseType: !38, size: 64, offset: 192)
!40 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !45)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !40, baseType: !16, size: 64, offset: 0)
!42 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !40, baseType: !16, size: 64, offset: 64)
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !40, baseType: !43, size: 64, offset: 128)
!45 = !{!41, !42, !44}
!46 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !40, size: 64)
!47 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 340, baseType: !46, size: 64, offset: 256)
!48 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 342, baseType: !23, size: 64, offset: 320)
!49 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 348, baseType: !19, size: 32, offset: 384)
!50 = !{!14, !24, !25, !26, !39, !47, !48, !49}
!51 = !DILocalVariable(name: "counts", scope: !7, file: !1, line: 31, type: !12)
!52 = !DILocation(line: 32, column: 3, scope: !7)
!53 = !DILocation(line: 32, column: 14, scope: !7)
!54 = !DILocation(line: 32, column: 26, scope: !7)
!55 = !DILocation(line: 33, column: 3, scope: !7)
!56 = !DILocation(line: 33, column: 16, scope: !7)
!57 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<Kind.Array>", file: !13, line: 624, size: 384, align: 64, elements: !66)
!58 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !57, size: 64)
!59 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !57, file: !13, line: 626, baseType: !4, size: 32, offset: 0)
!60 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !57, file: !13, line: 627, baseType: !23, size: 64, offset: 64)
!61 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !57, file: !13, line: 628, baseType: !4, size: 32, offset: 128)
!62 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !57, file: !13, line: 629, baseType: !4, size: 32, offset: 160)
!63 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !57, file: !13, line: 630, baseType: !38, size: 64, offset: 192)
!64 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !57, file: !13, line: 631, baseType: !23, size: 64, offset: 256)
!65 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !57, file: !13, line: 633, baseType: !19, size: 32, offset: 320)
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
!202 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 82, type: !201, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!203 = !DILocation(line: 82, column: 1, scope: !202)
!204 = !DILocalVariable(name: "h", arg: 1, scope: !202, file: !13, line: 82, type: !19)
!205 = !DILocalVariable(name: "mask", arg: 2, scope: !202, file: !13, line: 82, type: !4)
!206 = !DILocation(line: 82, column: 48, scope: !202)
!207 = !DILocation(line: 82, column: 54, scope: !202)
!208 = !DILocation(line: 82, column: 58, scope: !202)
!209 = !DILocation(line: 82, column: 59, scope: !202)
!210 = !DILocation(line: 82, column: 72, scope: !202)
!211 = !{!19, !19, !4, !4}
!212 = !DISubroutineType(types: !211)
!213 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 90, type: !212, scopeLine: 90, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!214 = !DILocation(line: 90, column: 1, scope: !213)
!215 = !DILocalVariable(name: "h", arg: 1, scope: !213, file: !13, line: 90, type: !19)
!216 = !DILocalVariable(name: "mask", arg: 2, scope: !213, file: !13, line: 90, type: !4)
!217 = !DILocalVariable(name: "index", arg: 3, scope: !213, file: !13, line: 90, type: !4)
!218 = !DILocation(line: 90, column: 58, scope: !213)
!219 = !DILocation(line: 90, column: 59, scope: !213)
!220 = !DILocation(line: 90, column: 63, scope: !213)
!221 = !DILocation(line: 90, column: 64, scope: !213)
!222 = !DILocation(line: 90, column: 70, scope: !213)
!223 = !DILocation(line: 90, column: 79, scope: !213)
!224 = !DILocation(line: 90, column: 80, scope: !213)
!225 = !DILocation(line: 90, column: 86, scope: !213)
!226 = !DILocation(line: 90, column: 95, scope: !213)
!227 = !{!16, !4, !4}
!228 = !DISubroutineType(types: !227)
!229 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 99, type: !228, scopeLine: 99, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!230 = !DILocation(line: 99, column: 1, scope: !229)
!231 = !DILocalVariable(name: "bucket", arg: 1, scope: !229, file: !13, line: 99, type: !4)
!232 = !DILocalVariable(name: "index", arg: 2, scope: !229, file: !13, line: 99, type: !4)
!233 = !DILocation(line: 99, column: 51, scope: !229)
!234 = !DILocation(line: 99, column: 52, scope: !229)
!235 = !DILocation(line: 99, column: 58, scope: !229)
!236 = !DILocation(line: 99, column: 75, scope: !229)
!237 = !DILocation(line: 99, column: 81, scope: !229)
!238 = !{!16, !4, !19}
!239 = !DISubroutineType(types: !238)
!240 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 102, type: !239, scopeLine: 102, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!241 = !DILocation(line: 102, column: 1, scope: !240)
!242 = !DILocalVariable(name: "bucket", arg: 1, scope: !240, file: !13, line: 102, type: !4)
!243 = !DILocalVariable(name: "h", arg: 2, scope: !240, file: !13, line: 102, type: !19)
!244 = !DILocation(line: 102, column: 48, scope: !240)
!245 = !DILocation(line: 102, column: 49, scope: !240)
!246 = !DILocation(line: 102, column: 50, scope: !240)
!247 = !DILocation(line: 102, column: 51, scope: !240)
!248 = !DILocation(line: 102, column: 57, scope: !240)
!249 = !DILocation(line: 102, column: 74, scope: !240)
!250 = !DILocation(line: 102, column: 80, scope: !240)
!251 = !{null, !23, !4, !19, !4}
!252 = !DISubroutineType(types: !251)
!253 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 154, type: !252, scopeLine: 154, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!254 = !DILocation(line: 154, column: 1, scope: !253)
!255 = !DILocalVariable(name: "slots", arg: 1, scope: !253, file: !13, line: 154, type: !23)
!256 = !DILocalVariable(name: "mask", arg: 2, scope: !253, file: !13, line: 154, type: !4)
!257 = !DILocalVariable(name: "h", arg: 3, scope: !253, file: !13, line: 154, type: !19)
!258 = !DILocalVariable(name: "index", arg: 4, scope: !253, file: !13, line: 154, type: !4)
!259 = !DILocation(line: 155, column: 3, scope: !253)
!260 = !DILocation(line: 155, column: 16, scope: !253)
!261 = !DILocation(line: 155, column: 25, scope: !253)
!262 = !DILocation(line: 155, column: 28, scope: !253)
!263 = !DILocation(line: 155, column: 34, scope: !253)
!264 = !DILocalVariable(name: "word", scope: !253, file: !13, line: 155, type: !19)
!265 = !DILocation(line: 156, column: 3, scope: !253)
!266 = !DILocation(line: 156, column: 15, scope: !253)
!267 = !DILocation(line: 156, column: 21, scope: !253)
!268 = !DILocalVariable(name: "low", scope: !253, file: !13, line: 156, type: !19)
!269 = !DILocation(line: 157, column: 3, scope: !253)
!270 = !DILocation(line: 157, column: 16, scope: !253)
!271 = !DILocation(line: 157, column: 22, scope: !253)
!272 = !DILocation(line: 157, column: 33, scope: !253)
!273 = !DILocation(line: 157, column: 36, scope: !253)
!274 = !DILocalVariable(name: "bucket", scope: !253, file: !13, line: 157, type: !19)
!275 = !DILocation(line: 158, column: 3, scope: !253)
!276 = !DILocation(line: 158, column: 11, scope: !253)
!277 = !DILocation(line: 158, column: 17, scope: !253)
!278 = !DILocalVariable(name: "b", scope: !253, file: !13, line: 158, type: !4)
!279 = !DILocation(line: 159, column: 3, scope: !253)
!280 = !DILocation(line: 159, column: 30, scope: !253)
!281 = !DILocation(line: 159, column: 10, scope: !253)
!282 = !DILocation(line: 159, column: 15, scope: !253)
!283 = !DILocation(line: 159, column: 20, scope: !253)
!284 = !DILocation(line: 159, column: 24, scope: !253)
!285 = !DILocation(line: 159, column: 45, scope: !253)
!286 = !DILocation(line: 160, column: 5, scope: !253)
!287 = !DILocation(line: 160, column: 9, scope: !253)
!288 = !DILocation(line: 160, column: 15, scope: !253)
!289 = !DILocation(line: 160, column: 22, scope: !253)
!290 = !DILocation(line: 160, column: 25, scope: !253)
!291 = !DILocation(line: 161, column: 7, scope: !253)
!292 = !DILocation(line: 161, column: 13, scope: !253)
!293 = !DILocation(line: 161, column: 18, scope: !253)
!294 = !DILocation(line: 162, column: 7, scope: !253)
!295 = !DILocation(line: 164, column: 5, scope: !253)
!296 = !DILocation(line: 164, column: 14, scope: !253)
!297 = !DILocation(line: 164, column: 15, scope: !253)
!298 = !DILocation(line: 164, column: 24, scope: !253)
!299 = !DILocation(line: 164, column: 29, scope: !253)
!300 = !DILocation(line: 165, column: 5, scope: !253)
!301 = !DILocation(line: 165, column: 9, scope: !253)
!302 = !DILocation(line: 165, column: 15, scope: !253)
!303 = !{null, !23}
!304 = !DISubroutineType(types: !303)
!305 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 185, type: !304, scopeLine: 185, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!306 = !DILocation(line: 185, column: 1, scope: !305)
!307 = !DILocalVariable(name: "hashes", arg: 1, scope: !305, file: !13, line: 185, type: !23)
!308 = !DILocation(line: 186, column: 3, scope: !305)
!309 = !DILocation(line: 186, column: 16, scope: !305)
!310 = !DILocation(line: 186, column: 22, scope: !305)
!311 = !DILocalVariable(name: "used", scope: !305, file: !13, line: 186, type: !4)
!312 = !DILocation(line: 187, column: 3, scope: !305)
!313 = !DILocation(line: 187, column: 17, scope: !305)
!314 = !DILocalVariable(name: "to", scope: !305, file: !13, line: 187, type: !4)
!315 = !DILocation(line: 188, column: 3, scope: !305)
!316 = !DILocation(line: 188, column: 24, scope: !305)
!317 = !DILocalVariable(name: "from", scope: !305, file: !13, line: 188, type: !4)
!318 = !DILocation(line: 189, column: 15, scope: !305)
!319 = !DILocation(line: 188, column: 27, scope: !305)
!320 = !DILocation(line: 188, column: 34, scope: !305)
!321 = !DILocation(line: 188, column: 48, scope: !305)
!322 = !DILocation(line: 189, column: 5, scope: !305)
!323 = !DILocation(line: 189, column: 22, scope: !305)
!324 = !DILocalVariable(name: "h", scope: !305, file: !13, line: 189, type: !19)
!325 = !DILocation(line: 190, column: 5, scope: !305)
!326 = !DILocation(line: 190, column: 9, scope: !305)
!327 = !DILocation(line: 190, column: 15, scope: !305)
!328 = !DILocation(line: 190, column: 20, scope: !305)
!329 = !DILocation(line: 190, column: 26, scope: !305)
!330 = !DILocation(line: 190, column: 31, scope: !305)
!331 = !DILocation(line: 190, column: 36, scope: !305)
!332 = !DILocation(line: 190, column: 42, scope: !305)
!333 = !DILocation(line: 191, column: 7, scope: !305)
!334 = !DILocation(line: 191, column: 14, scope: !305)
!335 = !DILocation(line: 191, column: 20, scope: !305)
!336 = !DILocation(line: 192, column: 7, scope: !305)
!337 = !DILocation(line: 188, column: 40, scope: !305)
!338 = !DILocation(line: 195, column: 3, scope: !305)
!339 = !DILocation(line: 195, column: 10, scope: !305)
!340 = !DILocation(line: 195, column: 16, scope: !305)
!341 = !DILocation(line: 195, column: 33, scope: !305)
!342 = !DILocation(line: 195, column: 39, scope: !305)
!343 = !DILocation(line: 195, column: 55, scope: !305)
!344 = !DILocation(line: 195, column: 58, scope: !305)
!345 = !DILocation(line: 196, column: 5, scope: !305)
!346 = !{!23, !23, !4, !4}
!347 = !DISubroutineType(types: !346)
!348 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 207, type: !347, scopeLine: 207, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!349 = !DILocation(line: 207, column: 1, scope: !348)
!350 = !DILocalVariable(name: "slots", arg: 1, scope: !348, file: !13, line: 207, type: !23)
!351 = !DILocalVariable(name: "live", arg: 2, scope: !348, file: !13, line: 207, type: !4)
!352 = !DILocalVariable(name: "used", arg: 3, scope: !348, file: !13, line: 207, type: !4)
!353 = !DILocation(line: 208, column: 3, scope: !348)
!354 = !DILocation(line: 208, column: 7, scope: !348)
!355 = !DILocation(line: 208, column: 13, scope: !348)
!356 = !DILocation(line: 208, column: 21, scope: !348)
!357 = !DILocation(line: 208, column: 25, scope: !348)
!358 = !DILocation(line: 208, column: 31, scope: !348)
!359 = !DILocation(line: 208, column: 38, scope: !348)
!360 = !DILocation(line: 209, column: 5, scope: !348)
!361 = !DILocation(line: 209, column: 16, scope: !348)
!362 = !DILocation(line: 210, column: 5, scope: !348)
!363 = !DILocation(line: 210, column: 12, scope: !348)
!364 = !DILocation(line: 212, column: 3, scope: !348)
!365 = !DILocation(line: 212, column: 13, scope: !348)
!366 = !DILocation(line: 212, column: 19, scope: !348)
!367 = !DILocalVariable(name: "n", scope: !348, file: !13, line: 212, type: !4)
!368 = !DILocation(line: 213, column: 3, scope: !348)
!369 = !DILocation(line: 213, column: 7, scope: !348)
!370 = !DILocation(line: 213, column: 12, scope: !348)
!371 = !DILocation(line: 213, column: 17, scope: !348)
!372 = !DILocation(line: 213, column: 21, scope: !348)
!373 = !DILocation(line: 213, column: 28, scope: !348)
!374 = !DILocation(line: 215, column: 5, scope: !348)
!375 = !DILocation(line: 215, column: 12, scope: !348)
!376 = !DILocation(line: 215, column: 27, scope: !348)
!377 = !DILocation(line: 215, column: 33, scope: !348)
!378 = !DILocation(line: 215, column: 37, scope: !348)
!379 = !DILocation(line: 217, column: 3, scope: !348)
!380 = !DILocation(line: 217, column: 14, scope: !348)
!381 = !DILocation(line: 217, column: 21, scope: !348)
!382 = !DILocation(line: 218, column: 3, scope: !348)
!383 = !DILocation(line: 218, column: 14, scope: !348)
!384 = !DILocation(line: 219, column: 3, scope: !348)
!385 = !DILocation(line: 219, column: 10, scope: !348)
!386 = !{null, !23, !4}
!387 = !DISubroutineType(types: !386)
!388 = distinct !DISubprogram(name: "widenSlots", linkageName: "nish.widenSlots", scope: !13, file: !13, line: 231, type: !387, scopeLine: 231, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!389 = !DILocation(line: 231, column: 1, scope: !388)
!390 = !DILocalVariable(name: "slots", arg: 1, scope: !388, file: !13, line: 231, type: !23)
!391 = !DILocalVariable(name: "times", arg: 2, scope: !388, file: !13, line: 231, type: !4)
!392 = !DILocation(line: 232, column: 3, scope: !388)
!393 = !DILocation(line: 232, column: 13, scope: !388)
!394 = !DILocation(line: 232, column: 19, scope: !388)
!395 = !DILocalVariable(name: "n", scope: !388, file: !13, line: 232, type: !4)
!396 = !DILocation(line: 233, column: 3, scope: !388)
!397 = !DILocation(line: 233, column: 21, scope: !388)
!398 = !DILocalVariable(name: "k", scope: !388, file: !13, line: 233, type: !4)
!399 = !DILocation(line: 233, column: 24, scope: !388)
!400 = !DILocation(line: 233, column: 28, scope: !388)
!401 = !DILocation(line: 233, column: 40, scope: !388)
!402 = !DILocation(line: 234, column: 5, scope: !388)
!403 = !DILocation(line: 234, column: 23, scope: !388)
!404 = !DILocalVariable(name: "i", scope: !388, file: !13, line: 234, type: !4)
!405 = !DILocation(line: 234, column: 26, scope: !388)
!406 = !DILocation(line: 234, column: 30, scope: !388)
!407 = !DILocation(line: 234, column: 38, scope: !388)
!408 = !DILocation(line: 235, column: 7, scope: !388)
!409 = !DILocation(line: 235, column: 18, scope: !388)
!410 = !DILocation(line: 234, column: 33, scope: !388)
!411 = !DILocation(line: 233, column: 35, scope: !388)
!412 = !{null, !23, !23}
!413 = !DISubroutineType(types: !412)
!414 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 245, type: !413, scopeLine: 245, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!415 = !DILocation(line: 245, column: 1, scope: !414)
!416 = !DILocalVariable(name: "slots", arg: 1, scope: !414, file: !13, line: 245, type: !23)
!417 = !DILocalVariable(name: "hashes", arg: 2, scope: !414, file: !13, line: 245, type: !23)
!418 = !DILocation(line: 246, column: 3, scope: !414)
!419 = !DILocation(line: 246, column: 16, scope: !414)
!420 = !DILocation(line: 246, column: 22, scope: !414)
!421 = !DILocation(line: 246, column: 38, scope: !414)
!422 = !DILocalVariable(name: "mask", scope: !414, file: !13, line: 246, type: !4)
!423 = !DILocation(line: 247, column: 3, scope: !414)
!424 = !DILocation(line: 247, column: 21, scope: !414)
!425 = !DILocalVariable(name: "i", scope: !414, file: !13, line: 247, type: !4)
!426 = !DILocation(line: 247, column: 34, scope: !414)
!427 = !DILocation(line: 247, column: 24, scope: !414)
!428 = !DILocation(line: 247, column: 28, scope: !414)
!429 = !DILocation(line: 247, column: 55, scope: !414)
!430 = !DILocation(line: 248, column: 5, scope: !414)
!431 = !DILocation(line: 248, column: 15, scope: !414)
!432 = !DILocation(line: 248, column: 22, scope: !414)
!433 = !DILocalVariable(name: "h", scope: !414, file: !13, line: 248, type: !19)
!434 = !DILocation(line: 249, column: 5, scope: !414)
!435 = !DILocation(line: 249, column: 9, scope: !414)
!436 = !DILocation(line: 249, column: 15, scope: !414)
!437 = !DILocation(line: 249, column: 18, scope: !414)
!438 = !DILocation(line: 250, column: 7, scope: !414)
!439 = !DILocation(line: 250, column: 17, scope: !414)
!440 = !DILocation(line: 250, column: 24, scope: !414)
!441 = !DILocation(line: 250, column: 30, scope: !414)
!442 = !DILocation(line: 250, column: 33, scope: !414)
!443 = !DILocation(line: 247, column: 50, scope: !414)
!444 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 276, type: !304, scopeLine: 276, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!445 = !DILocation(line: 276, column: 1, scope: !444)
!446 = !DILocalVariable(name: "slots", arg: 1, scope: !444, file: !13, line: 276, type: !23)
!447 = !DILocation(line: 277, column: 3, scope: !444)
!448 = !DILocation(line: 277, column: 21, scope: !444)
!449 = !DILocalVariable(name: "i", scope: !444, file: !13, line: 277, type: !4)
!450 = !DILocation(line: 277, column: 34, scope: !444)
!451 = !DILocation(line: 277, column: 24, scope: !444)
!452 = !DILocation(line: 277, column: 28, scope: !444)
!453 = !DILocation(line: 277, column: 54, scope: !444)
!454 = !DILocation(line: 278, column: 5, scope: !444)
!455 = !DILocation(line: 278, column: 11, scope: !444)
!456 = !DILocation(line: 278, column: 16, scope: !444)
!457 = !DILocation(line: 277, column: 49, scope: !444)
!458 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!459 = !{!458, !23, !4, !4, !23}
!460 = !DISubroutineType(types: !459)
!461 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 312, type: !460, scopeLine: 312, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!462 = !DILocation(line: 312, column: 1, scope: !461)
!463 = !DILocalVariable(name: "slots", arg: 1, scope: !461, file: !13, line: 312, type: !23)
!464 = !DILocalVariable(name: "mask", arg: 2, scope: !461, file: !13, line: 312, type: !4)
!465 = !DILocalVariable(name: "bucket", arg: 3, scope: !461, file: !13, line: 312, type: !4)
!466 = !DILocalVariable(name: "hashes", arg: 4, scope: !461, file: !13, line: 312, type: !23)
!467 = !DILocation(line: 313, column: 3, scope: !461)
!468 = !DILocation(line: 313, column: 16, scope: !461)
!469 = !DILocation(line: 313, column: 22, scope: !461)
!470 = !DILocalVariable(name: "used", scope: !461, file: !13, line: 313, type: !4)
!471 = !DILocation(line: 314, column: 3, scope: !461)
!472 = !DILocation(line: 314, column: 16, scope: !461)
!473 = !DILocation(line: 314, column: 22, scope: !461)
!474 = !DILocalVariable(name: "size", scope: !461, file: !13, line: 314, type: !4)
!475 = !DILocation(line: 315, column: 3, scope: !461)
!476 = !DILocation(line: 315, column: 7, scope: !461)
!477 = !DILocation(line: 315, column: 13, scope: !461)
!478 = !DILocation(line: 315, column: 21, scope: !461)
!479 = !DILocation(line: 315, column: 25, scope: !461)
!480 = !DILocation(line: 315, column: 31, scope: !461)
!481 = !DILocation(line: 315, column: 39, scope: !461)
!482 = !DILocation(line: 315, column: 44, scope: !461)
!483 = !DILocation(line: 315, column: 53, scope: !461)
!484 = !DILocation(line: 315, column: 58, scope: !461)
!485 = !DILocation(line: 315, column: 68, scope: !461)
!486 = !DILocation(line: 315, column: 74, scope: !461)
!487 = !DILocation(line: 316, column: 5, scope: !461)
!488 = !DILocation(line: 316, column: 12, scope: !461)
!489 = !DILocation(line: 318, column: 3, scope: !461)
!490 = !DILocation(line: 318, column: 7, scope: !461)
!491 = !DILocation(line: 318, column: 14, scope: !461)
!492 = !DILocation(line: 318, column: 17, scope: !461)
!493 = !DILocation(line: 319, column: 5, scope: !461)
!494 = !DILocation(line: 319, column: 11, scope: !461)
!495 = !DILocation(line: 319, column: 21, scope: !461)
!496 = !DILocation(line: 319, column: 30, scope: !461)
!497 = !DILocation(line: 319, column: 37, scope: !461)
!498 = !DILocation(line: 319, column: 44, scope: !461)
!499 = !DILocation(line: 319, column: 48, scope: !461)
!500 = !DILocation(line: 319, column: 54, scope: !461)
!501 = !DILocation(line: 319, column: 61, scope: !461)
!502 = !DILocation(line: 321, column: 3, scope: !461)
!503 = !DILocation(line: 321, column: 10, scope: !461)
!504 = !{null, !12}
!505 = !DISubroutineType(types: !504)
!506 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.constructor", linkageName: "nish.Map$em.p1.en$Kind$i32.constructor", scope: !13, file: !13, line: 351, type: !505, scopeLine: 351, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!507 = !DILocation(line: 351, column: 3, scope: !506)
!508 = !DILocalVariable(name: "this", arg: 1, scope: !506, file: !13, line: 351, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!509 = !{!"ptr", !78, i64 0}
!510 = !{!"Map$em.p1.en$Kind$i32", !114, i64 0, !509, i64 8, !114, i64 16, !114, i64 20, !509, i64 24, !509, i64 32, !509, i64 40, !114, i64 48}
!511 = !{!510, !114, i64 0}
!512 = !{!510, !114, i64 16}
!513 = !{!510, !114, i64 20}
!514 = !{!510, !114, i64 48}
!515 = !DILocation(line: 352, column: 5, scope: !506)
!516 = !DILocation(line: 352, column: 18, scope: !506)
!517 = !{!510, !509, i64 8}
!518 = !DILocation(line: 353, column: 5, scope: !506)
!519 = !DILocation(line: 353, column: 22, scope: !506)
!520 = !{!510, !509, i64 24}
!521 = !DILocation(line: 354, column: 5, scope: !506)
!522 = !DILocation(line: 354, column: 24, scope: !506)
!523 = !{!510, !509, i64 32}
!524 = !DILocation(line: 355, column: 5, scope: !506)
!525 = !DILocation(line: 355, column: 24, scope: !506)
!526 = !{!510, !509, i64 40}
!527 = !{!16, !12, !34}
!528 = !DISubroutineType(types: !527)
!529 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.probe", linkageName: "nish.Map$em.p1.en$Kind$i32.probe", scope: !13, file: !13, line: 365, type: !528, scopeLine: 365, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!530 = !DILocation(line: 365, column: 3, scope: !529)
!531 = !DILocalVariable(name: "this", arg: 1, scope: !529, file: !13, line: 365, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!532 = !DILocalVariable(name: "key", arg: 2, scope: !529, file: !13, line: 365, type: !34)
!533 = !DILocation(line: 366, column: 5, scope: !529)
!534 = !DILocation(line: 366, column: 12, scope: !529)
!535 = !DILocation(line: 366, column: 23, scope: !529)
!536 = !DILocation(line: 366, column: 35, scope: !529)
!537 = !DILocation(line: 366, column: 46, scope: !529)
!538 = !DILocation(line: 366, column: 64, scope: !529)
!539 = !DILocation(line: 366, column: 80, scope: !529)
!540 = !{!12, !12, !34, !4}
!541 = !DISubroutineType(types: !540)
!542 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.set", linkageName: "nish.Map$em.p1.en$Kind$i32.set", scope: !13, file: !13, line: 388, type: !541, scopeLine: 388, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!543 = !DILocation(line: 388, column: 3, scope: !542)
!544 = !DILocalVariable(name: "this", arg: 1, scope: !542, file: !13, line: 388, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!545 = !DILocalVariable(name: "key", arg: 2, scope: !542, file: !13, line: 388, type: !34)
!546 = !DILocalVariable(name: "value", arg: 3, scope: !542, file: !13, line: 388, type: !4)
!547 = !DILocation(line: 389, column: 5, scope: !542)
!548 = !DILocation(line: 389, column: 19, scope: !542)
!549 = !DILocation(line: 389, column: 30, scope: !542)
!550 = !DILocalVariable(name: "found", scope: !542, file: !13, line: 389, type: !16)
!551 = !DILocation(line: 390, column: 5, scope: !542)
!552 = !DILocation(line: 390, column: 9, scope: !542)
!553 = !DILocation(line: 390, column: 18, scope: !542)
!554 = !DILocation(line: 390, column: 21, scope: !542)
!555 = !DILocation(line: 391, column: 7, scope: !542)
!556 = !DILocation(line: 391, column: 23, scope: !542)
!557 = !DILocation(line: 391, column: 29, scope: !542)
!558 = !DILocation(line: 391, column: 37, scope: !542)
!559 = !DILocation(line: 392, column: 12, scope: !542)
!560 = !DILocation(line: 393, column: 7, scope: !542)
!561 = !DILocation(line: 393, column: 21, scope: !542)
!562 = !DILocation(line: 393, column: 28, scope: !542)
!563 = !DILocation(line: 393, column: 33, scope: !542)
!564 = !DILocation(line: 395, column: 5, scope: !542)
!565 = !DILocation(line: 395, column: 12, scope: !542)
!566 = !{!4, !12, !4, !4}
!567 = !DISubroutineType(types: !566)
!568 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.valueAt", linkageName: "nish.Map$em.p1.en$Kind$i32.valueAt", scope: !13, file: !13, line: 474, type: !567, scopeLine: 474, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!569 = !DILocation(line: 474, column: 3, scope: !568)
!570 = !DILocalVariable(name: "this", arg: 1, scope: !568, file: !13, line: 474, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!571 = !DILocalVariable(name: "index", arg: 2, scope: !568, file: !13, line: 474, type: !4)
!572 = !DILocalVariable(name: "none", arg: 3, scope: !568, file: !13, line: 474, type: !4)
!573 = !DILocation(line: 475, column: 5, scope: !568)
!574 = !DILocation(line: 475, column: 9, scope: !568)
!575 = !DILocation(line: 475, column: 18, scope: !568)
!576 = !DILocation(line: 475, column: 23, scope: !568)
!577 = !DILocation(line: 475, column: 31, scope: !568)
!578 = !DILocation(line: 475, column: 37, scope: !568)
!579 = !DILocation(line: 475, column: 63, scope: !568)
!580 = !DILocation(line: 476, column: 7, scope: !568)
!581 = !DILocation(line: 476, column: 14, scope: !568)
!582 = !DILocation(line: 476, column: 31, scope: !568)
!583 = !DILocation(line: 478, column: 5, scope: !568)
!584 = !DILocation(line: 478, column: 12, scope: !568)
!585 = !{null, !12, !4, !4}
!586 = !DISubroutineType(types: !585)
!587 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.setValueAt", linkageName: "nish.Map$em.p1.en$Kind$i32.setValueAt", scope: !13, file: !13, line: 487, type: !586, scopeLine: 487, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!588 = !DILocation(line: 487, column: 3, scope: !587)
!589 = !DILocalVariable(name: "this", arg: 1, scope: !587, file: !13, line: 487, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!590 = !DILocalVariable(name: "index", arg: 2, scope: !587, file: !13, line: 487, type: !4)
!591 = !DILocalVariable(name: "value", arg: 3, scope: !587, file: !13, line: 487, type: !4)
!592 = !DILocation(line: 488, column: 5, scope: !587)
!593 = !DILocation(line: 488, column: 9, scope: !587)
!594 = !DILocation(line: 488, column: 18, scope: !587)
!595 = !DILocation(line: 488, column: 23, scope: !587)
!596 = !DILocation(line: 488, column: 31, scope: !587)
!597 = !DILocation(line: 488, column: 37, scope: !587)
!598 = !DILocation(line: 488, column: 63, scope: !587)
!599 = !DILocation(line: 489, column: 7, scope: !587)
!600 = !DILocation(line: 489, column: 24, scope: !587)
!601 = !DILocation(line: 489, column: 33, scope: !587)
!602 = !{null, !12, !16, !34, !4}
!603 = !DISubroutineType(types: !602)
!604 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.insertAt", linkageName: "nish.Map$em.p1.en$Kind$i32.insertAt", scope: !13, file: !13, line: 500, type: !603, scopeLine: 500, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!605 = !DILocation(line: 500, column: 3, scope: !604)
!606 = !DILocalVariable(name: "this", arg: 1, scope: !604, file: !13, line: 500, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!607 = !DILocalVariable(name: "absent", arg: 2, scope: !604, file: !13, line: 500, type: !16)
!608 = !DILocalVariable(name: "key", arg: 3, scope: !604, file: !13, line: 500, type: !34)
!609 = !DILocalVariable(name: "value", arg: 4, scope: !604, file: !13, line: 500, type: !4)
!610 = !DILocation(line: 501, column: 5, scope: !604)
!611 = !DILocation(line: 501, column: 20, scope: !604)
!612 = !DILocation(line: 501, column: 25, scope: !604)
!613 = !DILocalVariable(name: "packed", scope: !604, file: !13, line: 501, type: !16)
!614 = !DILocation(line: 502, column: 5, scope: !604)
!615 = !DILocation(line: 502, column: 25, scope: !604)
!616 = !DILocation(line: 503, column: 5, scope: !604)
!617 = !DILocation(line: 503, column: 27, scope: !604)
!618 = !DILocation(line: 504, column: 5, scope: !604)
!619 = !DILocation(line: 504, column: 27, scope: !604)
!620 = !DILocation(line: 504, column: 33, scope: !604)
!621 = !DILocation(line: 505, column: 5, scope: !604)
!622 = !DILocation(line: 508, column: 5, scope: !604)
!623 = !DILocation(line: 508, column: 9, scope: !604)
!624 = !DILocation(line: 508, column: 10, scope: !604)
!625 = !DILocation(line: 508, column: 23, scope: !604)
!626 = !DILocation(line: 508, column: 35, scope: !604)
!627 = !DILocation(line: 508, column: 46, scope: !604)
!628 = !DILocation(line: 508, column: 52, scope: !604)
!629 = !DILocation(line: 508, column: 67, scope: !604)
!630 = !DILocation(line: 508, column: 86, scope: !604)
!631 = !DILocation(line: 509, column: 7, scope: !604)
!632 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.addOne", linkageName: "nish.Map$em.p1.en$Kind$i32.addOne", scope: !13, file: !13, line: 518, type: !505, scopeLine: 518, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!633 = !DILocation(line: 518, column: 3, scope: !632)
!634 = !DILocalVariable(name: "this", arg: 1, scope: !632, file: !13, line: 518, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!635 = !DILocation(line: 519, column: 5, scope: !632)
!636 = !DILocation(line: 519, column: 18, scope: !632)
!637 = !DILocalVariable(name: "live", scope: !632, file: !13, line: 519, type: !4)
!638 = !DILocation(line: 520, column: 5, scope: !632)
!639 = !DILocation(line: 520, column: 9, scope: !632)
!640 = !DILocation(line: 520, column: 16, scope: !632)
!641 = !DILocation(line: 520, column: 28, scope: !632)
!642 = !DILocation(line: 521, column: 7, scope: !632)
!643 = !DILocation(line: 521, column: 19, scope: !632)
!644 = !DILocation(line: 521, column: 26, scope: !632)
!645 = !DILocation(line: 523, column: 5, scope: !632)
!646 = !DILocation(line: 523, column: 18, scope: !632)
!647 = !DILocalVariable(name: "size", scope: !632, file: !13, line: 523, type: !4)
!648 = !DILocation(line: 524, column: 5, scope: !632)
!649 = !DILocation(line: 524, column: 9, scope: !632)
!650 = !DILocation(line: 524, column: 16, scope: !632)
!651 = !DILocation(line: 524, column: 28, scope: !632)
!652 = !DILocation(line: 525, column: 7, scope: !632)
!653 = !DILocation(line: 525, column: 19, scope: !632)
!654 = !DILocation(line: 525, column: 26, scope: !632)
!655 = distinct !DISubprogram(name: "Map<Kind.Array, i32>.rebuild", linkageName: "nish.Map$em.p1.en$Kind$i32.rebuild", scope: !13, file: !13, line: 546, type: !505, scopeLine: 546, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!656 = !DILocation(line: 546, column: 3, scope: !655)
!657 = !DILocalVariable(name: "this", arg: 1, scope: !655, file: !13, line: 546, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!658 = !DILocation(line: 547, column: 5, scope: !655)
!659 = !DILocation(line: 547, column: 18, scope: !655)
!660 = !DILocation(line: 547, column: 24, scope: !655)
!661 = !DILocalVariable(name: "used", scope: !655, file: !13, line: 547, type: !4)
!662 = !DILocation(line: 548, column: 5, scope: !655)
!663 = !DILocation(line: 548, column: 21, scope: !655)
!664 = !DILocation(line: 548, column: 34, scope: !655)
!665 = !DILocalVariable(name: "walking", scope: !655, file: !13, line: 548, type: !458)
!666 = !DILocation(line: 549, column: 5, scope: !655)
!667 = !DILocation(line: 549, column: 19, scope: !655)
!668 = !DILocation(line: 549, column: 32, scope: !655)
!669 = !DILocation(line: 549, column: 44, scope: !655)
!670 = !DILocation(line: 549, column: 54, scope: !655)
!671 = !DILocation(line: 549, column: 61, scope: !655)
!672 = !DILocation(line: 549, column: 72, scope: !655)
!673 = !DILocalVariable(name: "slots", scope: !655, file: !13, line: 549, type: !23)
!674 = !DILocation(line: 550, column: 5, scope: !655)
!675 = !DILocation(line: 550, column: 9, scope: !655)
!676 = !DILocation(line: 550, column: 10, scope: !655)
!677 = !DILocation(line: 550, column: 21, scope: !655)
!678 = !DILocation(line: 550, column: 33, scope: !655)
!679 = !DILocation(line: 550, column: 39, scope: !655)
!680 = !DILocation(line: 551, column: 7, scope: !655)
!681 = !DILocation(line: 551, column: 22, scope: !655)
!682 = !DILocation(line: 551, column: 38, scope: !655)
!683 = !DILocation(line: 552, column: 7, scope: !655)
!684 = !DILocation(line: 552, column: 22, scope: !655)
!685 = !DILocation(line: 552, column: 40, scope: !655)
!686 = !DILocation(line: 553, column: 7, scope: !655)
!687 = !DILocation(line: 553, column: 21, scope: !655)
!688 = !DILocation(line: 555, column: 5, scope: !655)
!689 = !DILocation(line: 555, column: 18, scope: !655)
!690 = !DILocation(line: 556, column: 5, scope: !655)
!691 = !DILocation(line: 556, column: 17, scope: !655)
!692 = !DILocation(line: 556, column: 23, scope: !655)
!693 = !DILocation(line: 556, column: 39, scope: !655)
!694 = !DILocation(line: 557, column: 5, scope: !655)
!695 = !DILocation(line: 557, column: 12, scope: !655)
!696 = !DILocation(line: 557, column: 19, scope: !655)
!697 = !{null, !58}
!698 = !DISubroutineType(types: !697)
!699 = distinct !DISubprogram(name: "Set<Kind.Array>.constructor", linkageName: "nish.Set$em.p1.en$Kind.constructor", scope: !13, file: !13, line: 636, type: !698, scopeLine: 636, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!700 = !DILocation(line: 636, column: 3, scope: !699)
!701 = !DILocalVariable(name: "this", arg: 1, scope: !699, file: !13, line: 636, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!702 = !{!"Set$em.p1.en$Kind", !114, i64 0, !509, i64 8, !114, i64 16, !114, i64 20, !509, i64 24, !509, i64 32, !114, i64 40}
!703 = !{!702, !114, i64 0}
!704 = !{!702, !114, i64 16}
!705 = !{!702, !114, i64 20}
!706 = !{!702, !114, i64 40}
!707 = !DILocation(line: 637, column: 5, scope: !699)
!708 = !DILocation(line: 637, column: 18, scope: !699)
!709 = !{!702, !509, i64 8}
!710 = !DILocation(line: 638, column: 5, scope: !699)
!711 = !DILocation(line: 638, column: 22, scope: !699)
!712 = !{!702, !509, i64 24}
!713 = !DILocation(line: 639, column: 5, scope: !699)
!714 = !DILocation(line: 639, column: 24, scope: !699)
!715 = !{!702, !509, i64 32}
!716 = !{!16, !58, !34}
!717 = !DISubroutineType(types: !716)
!718 = distinct !DISubprogram(name: "Set<Kind.Array>.probe", linkageName: "nish.Set$em.p1.en$Kind.probe", scope: !13, file: !13, line: 643, type: !717, scopeLine: 643, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!719 = !DILocation(line: 643, column: 3, scope: !718)
!720 = !DILocalVariable(name: "this", arg: 1, scope: !718, file: !13, line: 643, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!721 = !DILocalVariable(name: "key", arg: 2, scope: !718, file: !13, line: 643, type: !34)
!722 = !DILocation(line: 644, column: 5, scope: !718)
!723 = !DILocation(line: 644, column: 12, scope: !718)
!724 = !DILocation(line: 644, column: 23, scope: !718)
!725 = !DILocation(line: 644, column: 35, scope: !718)
!726 = !DILocation(line: 644, column: 46, scope: !718)
!727 = !DILocation(line: 644, column: 64, scope: !718)
!728 = !DILocation(line: 644, column: 80, scope: !718)
!729 = !{!458, !58, !34}
!730 = !DISubroutineType(types: !729)
!731 = distinct !DISubprogram(name: "Set<Kind.Array>.has", linkageName: "nish.Set$em.p1.en$Kind.has", scope: !13, file: !13, line: 654, type: !730, scopeLine: 654, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!732 = !DILocation(line: 654, column: 3, scope: !731)
!733 = !DILocalVariable(name: "this", arg: 1, scope: !731, file: !13, line: 654, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!734 = !DILocalVariable(name: "key", arg: 2, scope: !731, file: !13, line: 654, type: !34)
!735 = !DILocation(line: 655, column: 5, scope: !731)
!736 = !DILocation(line: 655, column: 12, scope: !731)
!737 = !DILocation(line: 655, column: 23, scope: !731)
!738 = !DILocation(line: 655, column: 31, scope: !731)
!739 = !{!58, !58, !34}
!740 = !DISubroutineType(types: !739)
!741 = distinct !DISubprogram(name: "Set<Kind.Array>.add", linkageName: "nish.Set$em.p1.en$Kind.add", scope: !13, file: !13, line: 664, type: !740, scopeLine: 664, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!742 = !DILocation(line: 664, column: 3, scope: !741)
!743 = !DILocalVariable(name: "this", arg: 1, scope: !741, file: !13, line: 664, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!744 = !DILocalVariable(name: "key", arg: 2, scope: !741, file: !13, line: 664, type: !34)
!745 = !DILocation(line: 665, column: 5, scope: !741)
!746 = !DILocation(line: 665, column: 19, scope: !741)
!747 = !DILocation(line: 665, column: 30, scope: !741)
!748 = !DILocalVariable(name: "found", scope: !741, file: !13, line: 665, type: !16)
!749 = !DILocation(line: 666, column: 5, scope: !741)
!750 = !DILocation(line: 666, column: 9, scope: !741)
!751 = !DILocation(line: 666, column: 17, scope: !741)
!752 = !DILocation(line: 666, column: 20, scope: !741)
!753 = !DILocation(line: 667, column: 7, scope: !741)
!754 = !DILocation(line: 667, column: 21, scope: !741)
!755 = !DILocation(line: 667, column: 28, scope: !741)
!756 = !DILocation(line: 669, column: 5, scope: !741)
!757 = !DILocation(line: 669, column: 12, scope: !741)
!758 = !{null, !58, !16, !34}
!759 = !DISubroutineType(types: !758)
!760 = distinct !DISubprogram(name: "Set<Kind.Array>.insertAt", linkageName: "nish.Set$em.p1.en$Kind.insertAt", scope: !13, file: !13, line: 731, type: !759, scopeLine: 731, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!761 = !DILocation(line: 731, column: 3, scope: !760)
!762 = !DILocalVariable(name: "this", arg: 1, scope: !760, file: !13, line: 731, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!763 = !DILocalVariable(name: "absent", arg: 2, scope: !760, file: !13, line: 731, type: !16)
!764 = !DILocalVariable(name: "key", arg: 3, scope: !760, file: !13, line: 731, type: !34)
!765 = !DILocation(line: 732, column: 5, scope: !760)
!766 = !DILocation(line: 732, column: 20, scope: !760)
!767 = !DILocation(line: 732, column: 25, scope: !760)
!768 = !DILocalVariable(name: "packed", scope: !760, file: !13, line: 732, type: !16)
!769 = !DILocation(line: 733, column: 5, scope: !760)
!770 = !DILocation(line: 733, column: 25, scope: !760)
!771 = !DILocation(line: 734, column: 5, scope: !760)
!772 = !DILocation(line: 734, column: 27, scope: !760)
!773 = !DILocation(line: 734, column: 33, scope: !760)
!774 = !DILocation(line: 735, column: 5, scope: !760)
!775 = !DILocation(line: 738, column: 5, scope: !760)
!776 = !DILocation(line: 738, column: 9, scope: !760)
!777 = !DILocation(line: 738, column: 10, scope: !760)
!778 = !DILocation(line: 738, column: 23, scope: !760)
!779 = !DILocation(line: 738, column: 35, scope: !760)
!780 = !DILocation(line: 738, column: 46, scope: !760)
!781 = !DILocation(line: 738, column: 52, scope: !760)
!782 = !DILocation(line: 738, column: 67, scope: !760)
!783 = !DILocation(line: 738, column: 86, scope: !760)
!784 = !DILocation(line: 739, column: 7, scope: !760)
!785 = distinct !DISubprogram(name: "Set<Kind.Array>.addOne", linkageName: "nish.Set$em.p1.en$Kind.addOne", scope: !13, file: !13, line: 744, type: !698, scopeLine: 744, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!786 = !DILocation(line: 744, column: 3, scope: !785)
!787 = !DILocalVariable(name: "this", arg: 1, scope: !785, file: !13, line: 744, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!788 = !DILocation(line: 745, column: 5, scope: !785)
!789 = !DILocation(line: 745, column: 18, scope: !785)
!790 = !DILocalVariable(name: "live", scope: !785, file: !13, line: 745, type: !4)
!791 = !DILocation(line: 746, column: 5, scope: !785)
!792 = !DILocation(line: 746, column: 9, scope: !785)
!793 = !DILocation(line: 746, column: 16, scope: !785)
!794 = !DILocation(line: 746, column: 28, scope: !785)
!795 = !DILocation(line: 747, column: 7, scope: !785)
!796 = !DILocation(line: 747, column: 19, scope: !785)
!797 = !DILocation(line: 747, column: 26, scope: !785)
!798 = !DILocation(line: 749, column: 5, scope: !785)
!799 = !DILocation(line: 749, column: 18, scope: !785)
!800 = !DILocalVariable(name: "size", scope: !785, file: !13, line: 749, type: !4)
!801 = !DILocation(line: 750, column: 5, scope: !785)
!802 = !DILocation(line: 750, column: 9, scope: !785)
!803 = !DILocation(line: 750, column: 16, scope: !785)
!804 = !DILocation(line: 750, column: 28, scope: !785)
!805 = !DILocation(line: 751, column: 7, scope: !785)
!806 = !DILocation(line: 751, column: 19, scope: !785)
!807 = !DILocation(line: 751, column: 26, scope: !785)
!808 = distinct !DISubprogram(name: "Set<Kind.Array>.rebuild", linkageName: "nish.Set$em.p1.en$Kind.rebuild", scope: !13, file: !13, line: 767, type: !698, scopeLine: 767, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!809 = !DILocation(line: 767, column: 3, scope: !808)
!810 = !DILocalVariable(name: "this", arg: 1, scope: !808, file: !13, line: 767, type: !58, flags: DIFlagArtificial | DIFlagObjectPointer)
!811 = !DILocation(line: 768, column: 5, scope: !808)
!812 = !DILocation(line: 768, column: 18, scope: !808)
!813 = !DILocation(line: 768, column: 24, scope: !808)
!814 = !DILocalVariable(name: "used", scope: !808, file: !13, line: 768, type: !4)
!815 = !DILocation(line: 769, column: 5, scope: !808)
!816 = !DILocation(line: 769, column: 21, scope: !808)
!817 = !DILocation(line: 769, column: 34, scope: !808)
!818 = !DILocalVariable(name: "walking", scope: !808, file: !13, line: 769, type: !458)
!819 = !DILocation(line: 770, column: 5, scope: !808)
!820 = !DILocation(line: 770, column: 19, scope: !808)
!821 = !DILocation(line: 770, column: 32, scope: !808)
!822 = !DILocation(line: 770, column: 44, scope: !808)
!823 = !DILocation(line: 770, column: 54, scope: !808)
!824 = !DILocation(line: 770, column: 61, scope: !808)
!825 = !DILocation(line: 770, column: 72, scope: !808)
!826 = !DILocalVariable(name: "slots", scope: !808, file: !13, line: 770, type: !23)
!827 = !DILocation(line: 771, column: 5, scope: !808)
!828 = !DILocation(line: 771, column: 9, scope: !808)
!829 = !DILocation(line: 771, column: 10, scope: !808)
!830 = !DILocation(line: 771, column: 21, scope: !808)
!831 = !DILocation(line: 771, column: 33, scope: !808)
!832 = !DILocation(line: 771, column: 39, scope: !808)
!833 = !DILocation(line: 772, column: 7, scope: !808)
!834 = !DILocation(line: 772, column: 22, scope: !808)
!835 = !DILocation(line: 772, column: 38, scope: !808)
!836 = !DILocation(line: 773, column: 7, scope: !808)
!837 = !DILocation(line: 773, column: 21, scope: !808)
!838 = !DILocation(line: 775, column: 5, scope: !808)
!839 = !DILocation(line: 775, column: 18, scope: !808)
!840 = !DILocation(line: 776, column: 5, scope: !808)
!841 = !DILocation(line: 776, column: 17, scope: !808)
!842 = !DILocation(line: 776, column: 23, scope: !808)
!843 = !DILocation(line: 776, column: 39, scope: !808)
!844 = !DILocation(line: 777, column: 5, scope: !808)
!845 = !DILocation(line: 777, column: 12, scope: !808)
!846 = !DILocation(line: 777, column: 19, scope: !808)
!847 = !{!16, !23, !4, !23, !38, !34}
!848 = !DISubroutineType(types: !847)
!849 = distinct !DISubprogram(name: "probeTable<Kind.Array>", linkageName: "nish.probeTable$em.p1.en$Kind", scope: !13, file: !13, line: 113, type: !848, scopeLine: 113, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!850 = !DILocation(line: 113, column: 1, scope: !849)
!851 = !DILocalVariable(name: "slots", arg: 1, scope: !849, file: !13, line: 113, type: !23)
!852 = !DILocalVariable(name: "mask", arg: 2, scope: !849, file: !13, line: 113, type: !4)
!853 = !DILocalVariable(name: "hashes", arg: 3, scope: !849, file: !13, line: 113, type: !23)
!854 = !DILocalVariable(name: "keys", arg: 4, scope: !849, file: !13, line: 113, type: !38)
!855 = !DILocalVariable(name: "key", arg: 5, scope: !849, file: !13, line: 113, type: !34)
!856 = !DILocation(line: 114, column: 3, scope: !849)
!857 = !DILocation(line: 114, column: 13, scope: !849)
!858 = !DILocation(line: 114, column: 21, scope: !849)
!859 = !DILocalVariable(name: "h", scope: !849, file: !13, line: 114, type: !19)
!860 = !DILocation(line: 115, column: 3, scope: !849)
!861 = !DILocation(line: 115, column: 15, scope: !849)
!862 = !DILocation(line: 115, column: 21, scope: !849)
!863 = !DILocalVariable(name: "low", scope: !849, file: !13, line: 115, type: !19)
!864 = !DILocation(line: 116, column: 3, scope: !849)
!865 = !DILocation(line: 116, column: 23, scope: !849)
!866 = !DILocation(line: 116, column: 27, scope: !849)
!867 = !DILocation(line: 116, column: 28, scope: !849)
!868 = !DILocalVariable(name: "fingerprint", scope: !849, file: !13, line: 116, type: !19)
!869 = !DILocation(line: 117, column: 3, scope: !849)
!870 = !DILocation(line: 117, column: 16, scope: !849)
!871 = !DILocation(line: 117, column: 22, scope: !849)
!872 = !DILocation(line: 117, column: 33, scope: !849)
!873 = !DILocation(line: 117, column: 36, scope: !849)
!874 = !DILocalVariable(name: "bucket", scope: !849, file: !13, line: 117, type: !19)
!875 = !DILocation(line: 124, column: 3, scope: !849)
!876 = !DILocation(line: 124, column: 11, scope: !849)
!877 = !DILocation(line: 124, column: 17, scope: !849)
!878 = !DILocalVariable(name: "b", scope: !849, file: !13, line: 124, type: !4)
!879 = !DILocation(line: 125, column: 3, scope: !849)
!880 = !DILocation(line: 125, column: 30, scope: !849)
!881 = !DILocation(line: 134, column: 20, scope: !849)
!882 = !DILocation(line: 136, column: 20, scope: !849)
!883 = !DILocation(line: 125, column: 10, scope: !849)
!884 = !DILocation(line: 125, column: 15, scope: !849)
!885 = !DILocation(line: 125, column: 20, scope: !849)
!886 = !DILocation(line: 125, column: 24, scope: !849)
!887 = !DILocation(line: 125, column: 45, scope: !849)
!888 = !DILocation(line: 126, column: 5, scope: !849)
!889 = !DILocation(line: 126, column: 18, scope: !849)
!890 = !DILocation(line: 126, column: 24, scope: !849)
!891 = !DILocalVariable(name: "word", scope: !849, file: !13, line: 126, type: !19)
!892 = !DILocation(line: 127, column: 5, scope: !849)
!893 = !DILocation(line: 127, column: 9, scope: !849)
!894 = !DILocation(line: 127, column: 18, scope: !849)
!895 = !DILocation(line: 127, column: 21, scope: !849)
!896 = !DILocation(line: 128, column: 7, scope: !849)
!897 = !DILocation(line: 128, column: 14, scope: !849)
!898 = !DILocation(line: 128, column: 23, scope: !849)
!899 = !DILocation(line: 128, column: 26, scope: !849)
!900 = !DILocation(line: 130, column: 5, scope: !849)
!901 = !DILocation(line: 130, column: 9, scope: !849)
!902 = !DILocation(line: 130, column: 10, scope: !849)
!903 = !DILocation(line: 130, column: 17, scope: !849)
!904 = !DILocation(line: 130, column: 18, scope: !849)
!905 = !DILocation(line: 130, column: 27, scope: !849)
!906 = !DILocation(line: 130, column: 40, scope: !849)
!907 = !DILocation(line: 131, column: 7, scope: !849)
!908 = !DILocation(line: 131, column: 18, scope: !849)
!909 = !DILocation(line: 131, column: 24, scope: !849)
!910 = !DILocation(line: 131, column: 25, scope: !849)
!911 = !DILocation(line: 131, column: 32, scope: !849)
!912 = !DILocation(line: 131, column: 39, scope: !849)
!913 = !DILocalVariable(name: "at", scope: !849, file: !13, line: 131, type: !4)
!914 = !DILocation(line: 132, column: 7, scope: !849)
!915 = !DILocation(line: 133, column: 9, scope: !849)
!916 = !DILocation(line: 133, column: 15, scope: !849)
!917 = !DILocation(line: 134, column: 9, scope: !849)
!918 = !DILocation(line: 134, column: 14, scope: !849)
!919 = !DILocation(line: 135, column: 9, scope: !849)
!920 = !DILocation(line: 135, column: 16, scope: !849)
!921 = !DILocation(line: 135, column: 24, scope: !849)
!922 = !DILocation(line: 136, column: 9, scope: !849)
!923 = !DILocation(line: 136, column: 14, scope: !849)
!924 = !DILocation(line: 137, column: 9, scope: !849)
!925 = !DILocation(line: 137, column: 17, scope: !849)
!926 = !DILocation(line: 137, column: 22, scope: !849)
!927 = !DILocation(line: 137, column: 27, scope: !849)
!928 = !DILocation(line: 138, column: 9, scope: !849)
!929 = !DILocation(line: 139, column: 9, scope: !849)
!930 = !DILocation(line: 139, column: 16, scope: !849)
!931 = !DILocation(line: 139, column: 24, scope: !849)
!932 = !DILocation(line: 139, column: 27, scope: !849)
!933 = !DILocation(line: 142, column: 5, scope: !849)
!934 = !DILocation(line: 142, column: 14, scope: !849)
!935 = !DILocation(line: 142, column: 15, scope: !849)
!936 = !DILocation(line: 142, column: 24, scope: !849)
!937 = !DILocation(line: 142, column: 29, scope: !849)
!938 = !DILocation(line: 143, column: 5, scope: !849)
!939 = !DILocation(line: 143, column: 9, scope: !849)
!940 = !DILocation(line: 143, column: 15, scope: !849)
!941 = !DILocation(line: 145, column: 3, scope: !849)
!942 = !DILocation(line: 145, column: 10, scope: !849)
!943 = !DILocation(line: 145, column: 19, scope: !849)
!944 = !DILocation(line: 145, column: 25, scope: !849)
!945 = !DILocation(line: 145, column: 40, scope: !849)
!946 = !{null, !38, !23}
!947 = !DISubroutineType(types: !946)
!948 = distinct !DISubprogram(name: "compactEntries<Kind.Array>", linkageName: "nish.compactEntries$em.p1.en$Kind", scope: !13, file: !13, line: 170, type: !947, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!949 = !DILocation(line: 170, column: 1, scope: !948)
!950 = !DILocalVariable(name: "items", arg: 1, scope: !948, file: !13, line: 170, type: !38)
!951 = !DILocalVariable(name: "hashes", arg: 2, scope: !948, file: !13, line: 170, type: !23)
!952 = !DILocation(line: 171, column: 3, scope: !948)
!953 = !DILocation(line: 171, column: 16, scope: !948)
!954 = !DILocation(line: 171, column: 22, scope: !948)
!955 = !DILocalVariable(name: "used", scope: !948, file: !13, line: 171, type: !4)
!956 = !DILocation(line: 172, column: 3, scope: !948)
!957 = !DILocation(line: 172, column: 17, scope: !948)
!958 = !DILocalVariable(name: "to", scope: !948, file: !13, line: 172, type: !4)
!959 = !DILocation(line: 173, column: 3, scope: !948)
!960 = !DILocation(line: 173, column: 24, scope: !948)
!961 = !DILocalVariable(name: "from", scope: !948, file: !13, line: 173, type: !4)
!962 = !DILocation(line: 173, column: 55, scope: !948)
!963 = !DILocation(line: 174, column: 68, scope: !948)
!964 = !DILocation(line: 173, column: 27, scope: !948)
!965 = !DILocation(line: 173, column: 34, scope: !948)
!966 = !DILocation(line: 173, column: 42, scope: !948)
!967 = !DILocation(line: 173, column: 49, scope: !948)
!968 = !DILocation(line: 173, column: 79, scope: !948)
!969 = !DILocation(line: 174, column: 5, scope: !948)
!970 = !DILocation(line: 174, column: 9, scope: !948)
!971 = !DILocation(line: 174, column: 16, scope: !948)
!972 = !DILocation(line: 174, column: 26, scope: !948)
!973 = !DILocation(line: 174, column: 31, scope: !948)
!974 = !DILocation(line: 174, column: 37, scope: !948)
!975 = !DILocation(line: 174, column: 42, scope: !948)
!976 = !DILocation(line: 174, column: 47, scope: !948)
!977 = !DILocation(line: 174, column: 55, scope: !948)
!978 = !DILocation(line: 174, column: 62, scope: !948)
!979 = !DILocation(line: 174, column: 83, scope: !948)
!980 = !DILocation(line: 175, column: 7, scope: !948)
!981 = !DILocation(line: 175, column: 13, scope: !948)
!982 = !DILocation(line: 175, column: 19, scope: !948)
!983 = !DILocation(line: 175, column: 25, scope: !948)
!984 = !DILocation(line: 176, column: 7, scope: !948)
!985 = !DILocation(line: 173, column: 71, scope: !948)
!986 = !DILocation(line: 179, column: 3, scope: !948)
!987 = !DILocation(line: 179, column: 10, scope: !948)
!988 = !DILocation(line: 179, column: 16, scope: !948)
!989 = !DILocation(line: 179, column: 32, scope: !948)
!990 = !DILocation(line: 179, column: 38, scope: !948)
!991 = !DILocation(line: 179, column: 53, scope: !948)
!992 = !DILocation(line: 179, column: 56, scope: !948)
!993 = !DILocation(line: 180, column: 5, scope: !948)
!994 = !{null, !46, !23}
!995 = !DISubroutineType(types: !994)
!996 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 170, type: !995, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!997 = !DILocation(line: 170, column: 1, scope: !996)
!998 = !DILocalVariable(name: "items", arg: 1, scope: !996, file: !13, line: 170, type: !46)
!999 = !DILocalVariable(name: "hashes", arg: 2, scope: !996, file: !13, line: 170, type: !23)
!1000 = !DILocation(line: 171, column: 3, scope: !996)
!1001 = !DILocation(line: 171, column: 16, scope: !996)
!1002 = !DILocation(line: 171, column: 22, scope: !996)
!1003 = !DILocalVariable(name: "used", scope: !996, file: !13, line: 171, type: !4)
!1004 = !DILocation(line: 172, column: 3, scope: !996)
!1005 = !DILocation(line: 172, column: 17, scope: !996)
!1006 = !DILocalVariable(name: "to", scope: !996, file: !13, line: 172, type: !4)
!1007 = !DILocation(line: 173, column: 3, scope: !996)
!1008 = !DILocation(line: 173, column: 24, scope: !996)
!1009 = !DILocalVariable(name: "from", scope: !996, file: !13, line: 173, type: !4)
!1010 = !DILocation(line: 173, column: 55, scope: !996)
!1011 = !DILocation(line: 174, column: 68, scope: !996)
!1012 = !DILocation(line: 173, column: 27, scope: !996)
!1013 = !DILocation(line: 173, column: 34, scope: !996)
!1014 = !DILocation(line: 173, column: 42, scope: !996)
!1015 = !DILocation(line: 173, column: 49, scope: !996)
!1016 = !DILocation(line: 173, column: 79, scope: !996)
!1017 = !DILocation(line: 174, column: 5, scope: !996)
!1018 = !DILocation(line: 174, column: 9, scope: !996)
!1019 = !DILocation(line: 174, column: 16, scope: !996)
!1020 = !DILocation(line: 174, column: 26, scope: !996)
!1021 = !DILocation(line: 174, column: 31, scope: !996)
!1022 = !DILocation(line: 174, column: 37, scope: !996)
!1023 = !DILocation(line: 174, column: 42, scope: !996)
!1024 = !DILocation(line: 174, column: 47, scope: !996)
!1025 = !DILocation(line: 174, column: 55, scope: !996)
!1026 = !DILocation(line: 174, column: 62, scope: !996)
!1027 = !DILocation(line: 174, column: 83, scope: !996)
!1028 = !DILocation(line: 175, column: 7, scope: !996)
!1029 = !DILocation(line: 175, column: 13, scope: !996)
!1030 = !DILocation(line: 175, column: 19, scope: !996)
!1031 = !DILocation(line: 175, column: 25, scope: !996)
!1032 = !DILocation(line: 176, column: 7, scope: !996)
!1033 = !DILocation(line: 173, column: 71, scope: !996)
!1034 = !DILocation(line: 179, column: 3, scope: !996)
!1035 = !DILocation(line: 179, column: 10, scope: !996)
!1036 = !DILocation(line: 179, column: 16, scope: !996)
!1037 = !DILocation(line: 179, column: 32, scope: !996)
!1038 = !DILocation(line: 179, column: 38, scope: !996)
!1039 = !DILocation(line: 179, column: 53, scope: !996)
!1040 = !DILocation(line: 179, column: 56, scope: !996)
!1041 = !DILocation(line: 180, column: 5, scope: !996)
!1042 = !{i32 8, !"cf-protection-branch", i32 1}
!1043 = !{i32 8, !"cf-protection-return", i32 1}
!1044 = !{i32 8, !"branch-target-enforcement", i32 1}
!1045 = !{i32 8, !"sign-return-address", i32 1}
!1046 = !{i32 4, !"probe-stack", !"inline-asm"}
