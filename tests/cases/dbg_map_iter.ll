%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_hash_key = external global [2 x i64], align 8
@.str.2 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.2 to i8*))
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

define noundef i32 @nish_main() #0 !dbg !7 {
entry:
  %m.addr = alloca %struct.Map$str$i32*, align 8
  %sum.addr = alloca i32, align 4
  %word.addr = alloca i8*, align 8
  %walk.idx = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %walk.idx.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = call i8* @nish_alloc_struct(i64 56), !dbg !10
  %1 = bitcast i8* %0 to %struct.Map$str$i32*, !dbg !10
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1), !dbg !10
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %m.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Map$str$i32** %m.addr, metadata !48, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !49
  %3 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 1), !dbg !49
  %4 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 2), !dbg !49
  store i32 0, i32* %sum.addr, align 4, !dbg !54
  call void @llvm.dbg.declare(metadata i32* %sum.addr, metadata !56, metadata !DIExpression()), !dbg !54
  call void @llvm.dbg.declare(metadata i8** %word.addr, metadata !58, metadata !DIExpression()), !dbg !57
  %5 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !59
  call void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* %5), !dbg !57
  %6 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %5, i32 0), !dbg !57
  store i32 %6, i32* %walk.idx, align 4, !dbg !57
  br label %walk.cond, !dbg !57

walk.cond:
  %7 = load i32, i32* %walk.idx, align 4, !dbg !57
  %8 = icmp sge i32 %7, 0, !dbg !57
  br i1 %8, label %walk.body, label %walk.end, !dbg !57

walk.body:
  %9 = call i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* %5, i32 %7, i8* zeroinitializer), !dbg !57
  store i8* %9, i8** %word.addr, align 8, !dbg !57
  %10 = load i32, i32* %sum.addr, align 4, !dbg !61
  %11 = load i8*, i8** %word.addr, align 8, !dbg !62
  %12 = bitcast i8* %11 to i64*, !dbg !62
  %13 = load i64, i64* %12, align 8, !dbg !62
  %14 = trunc i64 %13 to i32, !dbg !62
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %14), !dbg !61
  %16 = extractvalue { i32, i1 } %15, 0, !dbg !61
  %17 = extractvalue { i32, i1 } %15, 1, !dbg !61
  br i1 %17, label %ovf.fail, label %ovf.ok, !dbg !61

ovf.ok:
  store i32 %16, i32* %sum.addr, align 4, !dbg !61
  br label %walk.inc, !dbg !57

walk.inc:
  %18 = add i32 %7, 1, !dbg !57
  %19 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %5, i32 %18), !dbg !57
  store i32 %19, i32* %walk.idx, align 4, !dbg !57
  br label %walk.cond, !dbg !57

walk.end:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %5), !dbg !57
  call void @llvm.dbg.declare(metadata i32* %count.addr, metadata !64, metadata !DIExpression()), !dbg !63
  %20 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !65
  call void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* %20), !dbg !63
  %21 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %20, i32 0), !dbg !63
  store i32 %21, i32* %walk.idx.1, align 4, !dbg !63
  br label %walk.cond.1, !dbg !63

walk.cond.1:
  %22 = load i32, i32* %walk.idx.1, align 4, !dbg !63
  %23 = icmp sge i32 %22, 0, !dbg !63
  br i1 %23, label %walk.body.1, label %walk.end.1, !dbg !63

walk.body.1:
  %24 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %20, i32 %22, i32 zeroinitializer), !dbg !63
  store i32 %24, i32* %count.addr, align 4, !dbg !63
  %25 = load i32, i32* %sum.addr, align 4, !dbg !67
  %26 = load i32, i32* %count.addr, align 4, !dbg !68
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %26), !dbg !67
  %28 = extractvalue { i32, i1 } %27, 0, !dbg !67
  %29 = extractvalue { i32, i1 } %27, 1, !dbg !67
  br i1 %29, label %ovf.fail.1, label %ovf.ok.1, !dbg !67

ovf.ok.1:
  store i32 %28, i32* %sum.addr, align 4, !dbg !67
  br label %walk.inc.1, !dbg !63

walk.inc.1:
  %30 = add i32 %22, 1, !dbg !63
  %31 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %20, i32 %30), !dbg !63
  store i32 %31, i32* %walk.idx.1, align 4, !dbg !63
  br label %walk.cond.1, !dbg !63

walk.end.1:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %20), !dbg !63
  %32 = load i32, i32* %sum.addr, align 4, !dbg !71
  %33 = call i8* @nish_str_from_i32(i32 %32), !dbg !70
  call void @nish_print(i8* %33), !dbg !69
  call void @nish_arena_release(i64 %arena.mark), !dbg !72
  ret i32 0, !dbg !72

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !61
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 0), !dbg !67
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !74 {
entry:
  %0 = call i32 @nish_main(), !dbg !75
  call void @nish_free_arena(), !dbg !75
  ret i32 %0, !dbg !75
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 !dbg !78 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !80, metadata !DIExpression()), !dbg !79
  call void @llvm.dbg.value(metadata i32 %mask, metadata !81, metadata !DIExpression()), !dbg !79
  %0 = lshr i32 %h, 16, !dbg !85
  %1 = xor i32 %h, %0, !dbg !83
  %2 = and i32 %1, %mask, !dbg !82
  ret i32 %2, !dbg !79
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 !dbg !89 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !91, metadata !DIExpression()), !dbg !90
  call void @llvm.dbg.value(metadata i32 %mask, metadata !92, metadata !DIExpression()), !dbg !90
  call void @llvm.dbg.value(metadata i32 %index, metadata !93, metadata !DIExpression()), !dbg !90
  %0 = xor i32 %mask, -1, !dbg !96
  %1 = and i32 %h, %0, !dbg !95
  %2 = add i32 %index, 1, !dbg !100
  %3 = or i32 %1, %2, !dbg !94
  ret i32 %3, !dbg !90
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !105 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !107, metadata !DIExpression()), !dbg !106
  call void @llvm.dbg.value(metadata i32 %index, metadata !108, metadata !DIExpression()), !dbg !106
  %0 = sext i32 %bucket to i64, !dbg !110
  %1 = shl i64 %0, 32, !dbg !110
  %2 = sext i32 %index to i64, !dbg !112
  %3 = or i64 %1, %2, !dbg !109
  ret i64 %3, !dbg !106
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !116 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !118, metadata !DIExpression()), !dbg !117
  call void @llvm.dbg.value(metadata i32 %h, metadata !119, metadata !DIExpression()), !dbg !117
  %0 = sext i32 %bucket to i64, !dbg !123
  %1 = shl i64 %0, 32, !dbg !123
  %2 = zext i32 %h to i64, !dbg !125
  %3 = or i64 %1, %2, !dbg !122
  %4 = xor i64 %3, -1, !dbg !120
  ret i64 %4, !dbg !117
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !129 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !131, metadata !DIExpression()), !dbg !130
  call void @llvm.dbg.value(metadata i32 %mask, metadata !132, metadata !DIExpression()), !dbg !130
  call void @llvm.dbg.value(metadata i32 %h, metadata !133, metadata !DIExpression()), !dbg !130
  call void @llvm.dbg.value(metadata i32 %index, metadata !134, metadata !DIExpression()), !dbg !130
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index), !dbg !136
  store i32 %0, i32* %word.addr, align 4, !dbg !135
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !140, metadata !DIExpression()), !dbg !135
  store i32 %mask, i32* %low.addr, align 4, !dbg !141
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !144, metadata !DIExpression()), !dbg !141
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !147
  store i32 %1, i32* %bucket.addr, align 4, !dbg !145
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !150, metadata !DIExpression()), !dbg !145
  %2 = load i32, i32* %bucket.addr, align 4, !dbg !153
  store i32 %2, i32* %b.addr, align 4, !dbg !151
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !154, metadata !DIExpression()), !dbg !151
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !155
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !155
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !155
  %6 = load i8*, i8** %5, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !155
  br label %while.cond, !dbg !155

while.cond:
  %7 = load i32, i32* %b.addr, align 4, !dbg !169
  %8 = icmp sge i32 %7, 0, !dbg !169
  br i1 %8, label %land.rhs, label %land.end, !dbg !169

land.rhs:
  %9 = load i32, i32* %b.addr, align 4, !dbg !171
  %10 = trunc i64 %4 to i32, !dbg !156
  %11 = icmp slt i32 %9, %10, !dbg !171
  br label %land.end, !dbg !169

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ], !dbg !169
  br i1 %12, label %while.body, label %while.end, !dbg !155

while.body:
  %13 = load i32, i32* %b.addr, align 4, !dbg !176
  %14 = sext i32 %13 to i64, !dbg !175
  %15 = bitcast i8* %6 to i32*, !dbg !175
  %16 = getelementptr inbounds i32, i32* %15, i64 %14, !dbg !175
  %17 = load i32, i32* %16, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !175
  %18 = icmp eq i32 %17, 0, !dbg !175
  br i1 %18, label %if.then, label %if.end, !dbg !174

if.then:
  %19 = load i32, i32* %b.addr, align 4, !dbg !182
  %20 = sext i32 %19 to i64, !dbg !181
  %21 = load i32, i32* %word.addr, align 4, !dbg !183
  %22 = bitcast i8* %6 to i32*, !dbg !181
  %23 = getelementptr inbounds i32, i32* %22, i64 %20, !dbg !181
  store i32 %21, i32* %23, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !181
  ret void, !dbg !184

if.end:
  %24 = load i32, i32* %bucket.addr, align 4, !dbg !187
  %25 = add i32 %24, 1, !dbg !187
  %26 = load i32, i32* %low.addr, align 4, !dbg !189
  %27 = and i32 %25, %26, !dbg !186
  store i32 %27, i32* %bucket.addr, align 4, !dbg !185
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !192
  store i32 %28, i32* %b.addr, align 4, !dbg !190
  br label %while.cond, !dbg !155

while.end:
  ret void, !dbg !130
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !195 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !197, metadata !DIExpression()), !dbg !196
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !200
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !200
  %2 = trunc i64 %1 to i32, !dbg !200
  store i32 %2, i32* %used.addr, align 4, !dbg !198
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !201, metadata !DIExpression()), !dbg !198
  store i32 0, i32* %to.addr, align 4, !dbg !202
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !204, metadata !DIExpression()), !dbg !202
  store i32 0, i32* %from.addr, align 4, !dbg !205
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !207, metadata !DIExpression()), !dbg !205
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !205
  %4 = load i8*, i8** %3, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !205
  br label %for.cond, !dbg !205

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !209
  %6 = load i32, i32* %used.addr, align 4, !dbg !210
  %7 = icmp slt i32 %5, %6, !dbg !209
  br i1 %7, label %for.body, label %for.end, !dbg !205

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !213
  %9 = sext i32 %8 to i64, !dbg !208
  %10 = bitcast i8* %4 to i32*, !dbg !208
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !208
  %12 = load i32, i32* %11, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !208
  store i32 %12, i32* %h.addr, align 4, !dbg !212
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !214, metadata !DIExpression()), !dbg !212
  %13 = load i32, i32* %h.addr, align 4, !dbg !216
  %14 = icmp ne i32 %13, 0, !dbg !216
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !216

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !218
  %16 = icmp sge i32 %15, 0, !dbg !218
  br label %land.end.1, !dbg !216

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !216
  br i1 %17, label %land.rhs, label %land.end, !dbg !216

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !220
  %19 = load i32, i32* %used.addr, align 4, !dbg !221
  %20 = icmp slt i32 %18, %19, !dbg !220
  br label %land.end, !dbg !216

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !216
  br i1 %21, label %if.then, label %if.end, !dbg !215

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !224
  %23 = sext i32 %22 to i64, !dbg !223
  %24 = load i32, i32* %h.addr, align 4, !dbg !225
  %25 = bitcast i8* %4 to i32*, !dbg !223
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !223
  store i32 %24, i32* %26, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !223
  %27 = load i32, i32* %to.addr, align 4, !dbg !226
  %28 = add nsw i32 %27, 1, !dbg !226
  store i32 %28, i32* %to.addr, align 4, !dbg !226
  br label %if.end, !dbg !215

if.end:
  br label %for.inc, !dbg !205

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !227
  %30 = add nsw i32 %29, 1, !dbg !227
  store i32 %30, i32* %from.addr, align 4, !dbg !227
  br label %for.cond, !dbg !205

for.end:
  br label %while.cond, !dbg !228

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !230
  %32 = load i64, i64* %31, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !230
  %33 = trunc i64 %32 to i32, !dbg !230
  %34 = load i32, i32* %to.addr, align 4, !dbg !231
  %35 = icmp sgt i32 %33, %34, !dbg !229
  br i1 %35, label %land.rhs.2, label %land.end.2, !dbg !229

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !232
  %37 = load i64, i64* %36, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !232
  %38 = trunc i64 %37 to i32, !dbg !232
  %39 = icmp sgt i32 %38, 0, !dbg !232
  br label %land.end.2, !dbg !229

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ], !dbg !229
  br i1 %40, label %while.body, label %while.end, !dbg !228

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !235
  %42 = load i64, i64* %41, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !235
  %43 = sub i64 %42, 1, !dbg !235
  store i64 %43, i64* %41, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !235
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !235
  %45 = load i8*, i8** %44, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !235
  %46 = bitcast i8* %45 to i32*, !dbg !235
  %47 = getelementptr inbounds i32, i32* %46, i64 %43, !dbg !235
  %48 = load i32, i32* %47, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !235
  br label %while.cond, !dbg !228

while.end:
  ret void, !dbg !196
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !238 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !240, metadata !DIExpression()), !dbg !239
  call void @llvm.dbg.value(metadata i32 %live, metadata !241, metadata !DIExpression()), !dbg !239
  call void @llvm.dbg.value(metadata i32 %used, metadata !242, metadata !DIExpression()), !dbg !239
  %0 = sext i32 %live to i64, !dbg !244
  %1 = mul nsw i64 %0, 2, !dbg !244
  %2 = sext i32 %used to i64, !dbg !247
  %3 = icmp slt i64 %1, %2, !dbg !244
  br i1 %3, label %if.then, label %if.end, !dbg !243

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !250
  ret %struct.nish_array* %slots, !dbg !252

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !256
  %5 = load i64, i64* %4, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !256
  %6 = trunc i64 %5 to i32, !dbg !256
  store i32 %6, i32* %n.addr, align 4, !dbg !254
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !257, metadata !DIExpression()), !dbg !254
  %7 = load i32, i32* %n.addr, align 4, !dbg !259
  %8 = icmp sge i32 %7, 0, !dbg !259
  br i1 %8, label %land.rhs, label %land.end, !dbg !259

land.rhs:
  %9 = load i32, i32* %n.addr, align 4, !dbg !261
  %10 = icmp slt i32 %9, 32768, !dbg !261
  br label %land.end, !dbg !259

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ], !dbg !259
  br i1 %11, label %if.then.1, label %if.end.1, !dbg !258

if.then.1:
  %12 = load i32, i32* %n.addr, align 4, !dbg !267
  %13 = mul nsw i32 %12, 2, !dbg !267
  %14 = trunc i32 %13 to i16, !dbg !266
  %15 = zext i16 %14 to i64, !dbg !265
  %16 = call i8* @nish_alloc_struct(i64 24), !dbg !265
  %17 = bitcast i8* %16 to %struct.nish_array*, !dbg !265
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0, !dbg !265
  store i64 %15, i64* %18, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !265
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1, !dbg !265
  store i64 %15, i64* %19, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !265
  %20 = mul i64 %15, 4, !dbg !265
  %21 = call i8* @nish_alloc_struct(i64 %20), !dbg !265
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !161, !noalias !160, !dbg !265
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2, !dbg !265
  store i8* %21, i8** %22, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !265
  ret %struct.nish_array* %17, !dbg !264

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2), !dbg !270
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !273
  ret %struct.nish_array* %slots, !dbg !275
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 !dbg !279 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !281, metadata !DIExpression()), !dbg !280
  call void @llvm.dbg.value(metadata i32 %times, metadata !282, metadata !DIExpression()), !dbg !280
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !285
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !285
  %2 = trunc i64 %1 to i32, !dbg !285
  store i32 %2, i32* %n.addr, align 4, !dbg !283
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !286, metadata !DIExpression()), !dbg !283
  store i32 1, i32* %k.addr, align 4, !dbg !287
  call void @llvm.dbg.declare(metadata i32* %k.addr, metadata !289, metadata !DIExpression()), !dbg !287
  br label %for.cond, !dbg !287

for.cond:
  %3 = load i32, i32* %k.addr, align 4, !dbg !290
  %4 = icmp slt i32 %3, %times, !dbg !290
  br i1 %4, label %for.body, label %for.end, !dbg !287

for.body:
  store i32 0, i32* %i.addr, align 4, !dbg !293
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !295, metadata !DIExpression()), !dbg !293
  br label %for.cond.1, !dbg !293

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4, !dbg !296
  %6 = load i32, i32* %n.addr, align 4, !dbg !297
  %7 = icmp slt i32 %5, %6, !dbg !296
  br i1 %7, label %for.body.1, label %for.end.1, !dbg !293

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !299
  %9 = load i64, i64* %8, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !299
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1, !dbg !299
  %11 = load i64, i64* %10, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !299
  %12 = icmp eq i64 %9, %11, !dbg !299
  br i1 %12, label %push.grow, label %push.store, !dbg !299

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4), !dbg !299
  br label %push.store, !dbg !299

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !299
  %14 = load i8*, i8** %13, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !299
  %15 = bitcast i8* %14 to i32*, !dbg !299
  %16 = getelementptr inbounds i32, i32* %15, i64 %9, !dbg !299
  store i32 0, i32* %16, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !299
  %17 = add i64 %9, 1, !dbg !299
  store i64 %17, i64* %8, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !299
  %18 = trunc i64 %17 to i32, !dbg !299
  br label %for.inc.1, !dbg !293

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4, !dbg !301
  %20 = add nsw i32 %19, 1, !dbg !301
  store i32 %20, i32* %i.addr, align 4, !dbg !301
  br label %for.cond.1, !dbg !293

for.end.1:
  br label %for.inc, !dbg !287

for.inc:
  %21 = load i32, i32* %k.addr, align 4, !dbg !302
  %22 = add nsw i32 %21, 1, !dbg !302
  store i32 %22, i32* %k.addr, align 4, !dbg !302
  br label %for.cond, !dbg !287

for.end:
  ret void, !dbg !280
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !305 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !307, metadata !DIExpression()), !dbg !306
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !308, metadata !DIExpression()), !dbg !306
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !311
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !311
  %2 = trunc i64 %1 to i32, !dbg !311
  %3 = sub nsw i32 %2, 1, !dbg !310
  store i32 %3, i32* %mask.addr, align 4, !dbg !309
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !313, metadata !DIExpression()), !dbg !309
  store i32 0, i32* %i.addr, align 4, !dbg !314
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !316, metadata !DIExpression()), !dbg !314
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !314
  %5 = load i64, i64* %4, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !314
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !314
  %7 = load i8*, i8** %6, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !314
  br label %for.cond, !dbg !314

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !318
  %9 = trunc i64 %5 to i32, !dbg !317
  %10 = icmp slt i32 %8, %9, !dbg !318
  br i1 %10, label %for.body, label %for.end, !dbg !314

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !323
  %12 = sext i32 %11 to i64, !dbg !322
  %13 = bitcast i8* %7 to i32*, !dbg !322
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !322
  %15 = load i32, i32* %14, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !322
  store i32 %15, i32* %h.addr, align 4, !dbg !321
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !324, metadata !DIExpression()), !dbg !321
  %16 = load i32, i32* %h.addr, align 4, !dbg !326
  %17 = icmp ne i32 %16, 0, !dbg !326
  br i1 %17, label %if.then, label %if.end, !dbg !325

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !331
  %19 = load i32, i32* %h.addr, align 4, !dbg !332
  %20 = load i32, i32* %i.addr, align 4, !dbg !333
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !329
  br label %if.end, !dbg !325

if.end:
  br label %for.inc, !dbg !314

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !334
  %22 = add nsw i32 %21, 1, !dbg !334
  store i32 %22, i32* %i.addr, align 4, !dbg !334
  br label %for.cond, !dbg !314

for.end:
  ret void, !dbg !306
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !335 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !337, metadata !DIExpression()), !dbg !336
  store i32 0, i32* %i.addr, align 4, !dbg !338
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !340, metadata !DIExpression()), !dbg !338
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !338
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !338
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !338
  %3 = load i8*, i8** %2, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !338
  br label %for.cond, !dbg !338

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !342
  %5 = trunc i64 %1 to i32, !dbg !341
  %6 = icmp slt i32 %4, %5, !dbg !342
  br i1 %6, label %for.body, label %for.end, !dbg !338

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !346
  %8 = sext i32 %7 to i64, !dbg !345
  %9 = bitcast i8* %3 to i32*, !dbg !345
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !345
  store i32 0, i32* %10, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !345
  br label %for.inc, !dbg !338

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !348
  %12 = add nsw i32 %11, 1, !dbg !348
  store i32 %12, i32* %i.addr, align 4, !dbg !348
  br label %for.cond, !dbg !338

for.end:
  ret void, !dbg !336
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 !dbg !351 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !353, metadata !DIExpression()), !dbg !352
  call void @llvm.dbg.value(metadata i32 %from, metadata !354, metadata !DIExpression()), !dbg !352
  store i32 %from, i32* %i.addr, align 4, !dbg !355
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !357, metadata !DIExpression()), !dbg !355
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !355
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !355
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !355
  %3 = load i8*, i8** %2, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !355
  br label %for.cond, !dbg !355

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !359
  %5 = icmp sge i32 %4, 0, !dbg !359
  br i1 %5, label %land.rhs, label %land.end, !dbg !359

land.rhs:
  %6 = load i32, i32* %i.addr, align 4, !dbg !361
  %7 = trunc i64 %1 to i32, !dbg !358
  %8 = icmp slt i32 %6, %7, !dbg !361
  br label %land.end, !dbg !359

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ], !dbg !359
  br i1 %9, label %for.body, label %for.end, !dbg !355

for.body:
  %10 = load i32, i32* %i.addr, align 4, !dbg !366
  %11 = sext i32 %10 to i64, !dbg !365
  %12 = bitcast i8* %3 to i32*, !dbg !365
  %13 = getelementptr inbounds i32, i32* %12, i64 %11, !dbg !365
  %14 = load i32, i32* %13, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !365
  %15 = icmp ne i32 %14, 0, !dbg !365
  br i1 %15, label %if.then, label %if.end, !dbg !364

if.then:
  %16 = load i32, i32* %i.addr, align 4, !dbg !370
  ret i32 %16, !dbg !369

if.end:
  br label %for.inc, !dbg !355

for.inc:
  %17 = load i32, i32* %i.addr, align 4, !dbg !371
  %18 = add nsw i32 %17, 1, !dbg !371
  store i32 %18, i32* %i.addr, align 4, !dbg !371
  br label %for.cond, !dbg !355

for.end:
  ret i32 -1, !dbg !372
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 !dbg !377 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !379, metadata !DIExpression()), !dbg !378
  call void @llvm.dbg.value(metadata i32 %mask, metadata !380, metadata !DIExpression()), !dbg !378
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !381, metadata !DIExpression()), !dbg !378
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !382, metadata !DIExpression()), !dbg !378
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !385
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !385
  %2 = trunc i64 %1 to i32, !dbg !385
  store i32 %2, i32* %used.addr, align 4, !dbg !383
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !386, metadata !DIExpression()), !dbg !383
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !389
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !389
  %5 = trunc i64 %4 to i32, !dbg !389
  store i32 %5, i32* %size.addr, align 4, !dbg !387
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !390, metadata !DIExpression()), !dbg !387
  %6 = load i32, i32* %used.addr, align 4, !dbg !393
  %7 = sext i32 %6 to i64, !dbg !392
  %8 = mul nsw i64 %7, 4, !dbg !392
  %9 = load i32, i32* %size.addr, align 4, !dbg !396
  %10 = sext i32 %9 to i64, !dbg !395
  %11 = mul nsw i64 %10, 3, !dbg !395
  %12 = icmp sgt i64 %8, %11, !dbg !392
  br i1 %12, label %lor.end.1, label %lor.rhs.1, !dbg !392

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0, !dbg !398
  br label %lor.end.1, !dbg !392

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ], !dbg !392
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !392

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4, !dbg !401
  %16 = icmp sge i32 %bucket, %15, !dbg !400
  br label %lor.end, !dbg !392

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ], !dbg !392
  br i1 %17, label %if.then, label %if.end, !dbg !391

if.then:
  ret i1 false, !dbg !403

if.end:
  %18 = load i32, i32* %used.addr, align 4, !dbg !406
  %19 = icmp sgt i32 %18, 0, !dbg !406
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !405

if.then.1:
  %20 = sext i32 %bucket to i64, !dbg !409
  %21 = load i32, i32* %used.addr, align 4, !dbg !413
  %22 = sub nsw i32 %21, 1, !dbg !413
  %23 = sext i32 %22 to i64, !dbg !412
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !412
  %25 = load i8*, i8** %24, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !412
  %26 = bitcast i8* %25 to i32*, !dbg !412
  %27 = getelementptr inbounds i32, i32* %26, i64 %23, !dbg !412
  %28 = load i32, i32* %27, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !412
  %29 = load i32, i32* %used.addr, align 4, !dbg !416
  %30 = sub nsw i32 %29, 1, !dbg !416
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30), !dbg !411
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !409
  %33 = load i8*, i8** %32, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !409
  %34 = bitcast i8* %33 to i32*, !dbg !409
  %35 = getelementptr inbounds i32, i32* %34, i64 %20, !dbg !409
  store i32 %31, i32* %35, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !409
  br label %if.end.1, !dbg !405

if.end.1:
  ret i1 true, !dbg !418
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 !dbg !422 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !424, metadata !DIExpression()), !dbg !423
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !423
  store i32 0, i32* %0, align 4, !tbaa !428, !dbg !423
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !423
  store i32 7, i32* %1, align 4, !tbaa !429, !dbg !423
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !423
  store i32 0, i32* %2, align 4, !tbaa !430, !dbg !423
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !423
  store i32 0, i32* %3, align 4, !tbaa !431, !dbg !423
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !433
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !433
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !433
  store i64 8, i64* %6, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !433
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !433
  store i64 8, i64* %7, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !433
  %8 = mul i64 8, 4, !dbg !433
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !433
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !161, !noalias !160, !dbg !433
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !433
  store i8* %9, i8** %10, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !433
  %11 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !432
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !434, !dbg !432
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !436
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !436
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !436
  store i64 0, i64* %14, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !436
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !436
  store i64 0, i64* %15, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !436
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !436
  store i8* null, i8** %16, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !436
  %17 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !435
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !437, !dbg !435
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !439
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !439
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !439
  store i64 0, i64* %20, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !439
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !439
  store i64 0, i64* %21, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !439
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !439
  store i8* null, i8** %22, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !439
  %23 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !438
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !440, !dbg !438
  %24 = call i8* @nish_alloc_struct(i64 24), !dbg !442
  %25 = bitcast i8* %24 to %struct.nish_array*, !dbg !442
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0, !dbg !442
  store i64 0, i64* %26, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !442
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1, !dbg !442
  store i64 0, i64* %27, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !442
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2, !dbg !442
  store i8* null, i8** %28, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !442
  %29 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !441
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !443, !dbg !441
  ret void, !dbg !423
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 !dbg !446 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !448, metadata !DIExpression()), !dbg !447
  call void @llvm.dbg.value(metadata i8* %key, metadata !449, metadata !DIExpression()), !dbg !447
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !452
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !434, !dbg !452
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !453
  %3 = load i32, i32* %2, align 4, !tbaa !429, !dbg !453
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !454
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !443, !dbg !454
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !455
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !437, !dbg !455
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !451
  ret i64 %8, !dbg !450
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !459 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !461, metadata !DIExpression()), !dbg !460
  call void @llvm.dbg.value(metadata i8* %key, metadata !462, metadata !DIExpression()), !dbg !460
  call void @llvm.dbg.value(metadata i32 %value, metadata !463, metadata !DIExpression()), !dbg !460
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !465
  store i64 %0, i64* %found.addr, align 8, !dbg !464
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !467, metadata !DIExpression()), !dbg !464
  %1 = load i64, i64* %found.addr, align 8, !dbg !469
  %2 = icmp sge i64 %1, 0, !dbg !469
  br i1 %2, label %if.then, label %if.else, !dbg !468

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !474
  %4 = trunc i64 %3 to i32, !dbg !473
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !472
  br label %if.end, !dbg !468

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !478
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !477
  br label %if.end, !dbg !468

if.end:
  ret %struct.Map$str$i32* %this, !dbg !481
}

define internal void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 !dbg !483 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !485, metadata !DIExpression()), !dbg !484
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !487
  %1 = load i32, i32* %0, align 4, !tbaa !431, !dbg !487
  %2 = add i32 %1, 1, !dbg !487
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !486
  store i32 %2, i32* %3, align 4, !tbaa !431, !dbg !486
  ret void, !dbg !484
}

define internal noundef i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 !dbg !491 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !493, metadata !DIExpression()), !dbg !492
  call void @llvm.dbg.value(metadata i32 %from, metadata !494, metadata !DIExpression()), !dbg !492
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !497
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !443, !dbg !497
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from), !dbg !496
  ret i32 %2, !dbg !495
}

define internal void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 !dbg !499 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !501, metadata !DIExpression()), !dbg !500
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !503
  %1 = load i32, i32* %0, align 4, !tbaa !431, !dbg !503
  %2 = sub i32 %1, 1, !dbg !503
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !502
  store i32 %2, i32* %3, align 4, !tbaa !431, !dbg !502
  ret void, !dbg !500
}

define internal noundef nonnull align 8 i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i8* noundef nonnull noalias readonly align 8 %none) #4 !dbg !507 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !509, metadata !DIExpression()), !dbg !508
  call void @llvm.dbg.value(metadata i32 %index, metadata !510, metadata !DIExpression()), !dbg !508
  call void @llvm.dbg.value(metadata i8* %none, metadata !511, metadata !DIExpression()), !dbg !508
  %0 = icmp sge i32 %index, 0, !dbg !513
  br i1 %0, label %land.rhs, label %land.end, !dbg !513

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !517
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !437, !dbg !517
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !517
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !517
  %5 = trunc i64 %4 to i32, !dbg !517
  %6 = icmp slt i32 %index, %5, !dbg !515
  br label %land.end, !dbg !513

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !513
  br i1 %7, label %if.then, label %if.end, !dbg !512

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !520
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !437, !dbg !520
  %10 = sext i32 %index to i64, !dbg !520
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !520
  %12 = load i8*, i8** %11, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !520
  %13 = bitcast i8* %12 to i8**, !dbg !520
  %14 = getelementptr inbounds i8*, i8** %13, i64 %10, !dbg !520
  %15 = load i8*, i8** %14, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !520
  ret i8* %15, !dbg !519

if.end:
  ret i8* %none, !dbg !524
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %none) #4 !dbg !528 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !530, metadata !DIExpression()), !dbg !529
  call void @llvm.dbg.value(metadata i32 %index, metadata !531, metadata !DIExpression()), !dbg !529
  call void @llvm.dbg.value(metadata i32 %none, metadata !532, metadata !DIExpression()), !dbg !529
  %0 = icmp sge i32 %index, 0, !dbg !534
  br i1 %0, label %land.rhs, label %land.end, !dbg !534

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !538
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !440, !dbg !538
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !538
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !538
  %5 = trunc i64 %4 to i32, !dbg !538
  %6 = icmp slt i32 %index, %5, !dbg !536
  br label %land.end, !dbg !534

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !534
  br i1 %7, label %if.then, label %if.end, !dbg !533

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !541
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !440, !dbg !541
  %10 = sext i32 %index to i64, !dbg !541
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !541
  %12 = load i8*, i8** %11, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !541
  %13 = bitcast i8* %12 to i32*, !dbg !541
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !541
  %15 = load i32, i32* %14, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !541
  ret i32 %15, !dbg !540

if.end:
  ret i32 %none, !dbg !543
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 !dbg !547 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !549, metadata !DIExpression()), !dbg !548
  call void @llvm.dbg.value(metadata i32 %index, metadata !550, metadata !DIExpression()), !dbg !548
  call void @llvm.dbg.value(metadata i32 %value, metadata !551, metadata !DIExpression()), !dbg !548
  %0 = icmp sge i32 %index, 0, !dbg !553
  br i1 %0, label %land.rhs, label %land.end, !dbg !553

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !557
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !440, !dbg !557
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !557
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !557
  %5 = trunc i64 %4 to i32, !dbg !557
  %6 = icmp slt i32 %index, %5, !dbg !555
  br label %land.end, !dbg !553

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !553
  br i1 %7, label %if.then, label %if.end, !dbg !552

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !559
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !440, !dbg !559
  %10 = sext i32 %index to i64, !dbg !559
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !559
  %12 = load i8*, i8** %11, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !559
  %13 = bitcast i8* %12 to i32*, !dbg !559
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !559
  store i32 %value, i32* %14, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !559
  br label %if.end, !dbg !552

if.end:
  ret void, !dbg !548
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !564 {
entry:
  %packed.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !566, metadata !DIExpression()), !dbg !565
  call void @llvm.dbg.value(metadata i64 %absent, metadata !567, metadata !DIExpression()), !dbg !565
  call void @llvm.dbg.value(metadata i8* %key, metadata !568, metadata !DIExpression()), !dbg !565
  call void @llvm.dbg.value(metadata i32 %value, metadata !569, metadata !DIExpression()), !dbg !565
  %0 = sub nsw i64 -1, %absent, !dbg !571
  store i64 %0, i64* %packed.addr, align 8, !dbg !570
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !573, metadata !DIExpression()), !dbg !570
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !574
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !437, !dbg !574
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !574
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !574
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !574
  %6 = load i64, i64* %5, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !574
  %7 = icmp eq i64 %4, %6, !dbg !574
  br i1 %7, label %push.grow, label %push.store, !dbg !574

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8), !dbg !574
  br label %push.store, !dbg !574

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !574
  %9 = load i8*, i8** %8, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !574
  %10 = bitcast i8* %9 to i8**, !dbg !574
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4, !dbg !574
  store i8* %key, i8** %11, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !574
  %12 = add i64 %4, 1, !dbg !574
  store i64 %12, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !574
  %13 = trunc i64 %12 to i32, !dbg !574
  %14 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !576
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !440, !dbg !576
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !576
  %17 = load i64, i64* %16, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !576
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !576
  %19 = load i64, i64* %18, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !576
  %20 = icmp eq i64 %17, %19, !dbg !576
  br i1 %20, label %push.grow.1, label %push.store.1, !dbg !576

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4), !dbg !576
  br label %push.store.1, !dbg !576

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !576
  %22 = load i8*, i8** %21, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !576
  %23 = bitcast i8* %22 to i32*, !dbg !576
  %24 = getelementptr inbounds i32, i32* %23, i64 %17, !dbg !576
  store i32 %value, i32* %24, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !576
  %25 = add i64 %17, 1, !dbg !576
  store i64 %25, i64* %16, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !576
  %26 = trunc i64 %25 to i32, !dbg !576
  %27 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !578
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !443, !dbg !578
  %29 = load i64, i64* %packed.addr, align 8, !dbg !580
  %30 = trunc i64 %29 to i32, !dbg !579
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0, !dbg !578
  %32 = load i64, i64* %31, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !578
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1, !dbg !578
  %34 = load i64, i64* %33, align 8, !alias.scope !160, !noalias !161, !tbaa !269, !dbg !578
  %35 = icmp eq i64 %32, %34, !dbg !578
  br i1 %35, label %push.grow.2, label %push.store.2, !dbg !578

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4), !dbg !578
  br label %push.store.2, !dbg !578

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2, !dbg !578
  %37 = load i8*, i8** %36, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !578
  %38 = bitcast i8* %37 to i32*, !dbg !578
  %39 = getelementptr inbounds i32, i32* %38, i64 %32, !dbg !578
  store i32 %30, i32* %39, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !578
  %40 = add i64 %32, 1, !dbg !578
  store i64 %40, i64* %31, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !578
  %41 = trunc i64 %40 to i32, !dbg !578
  call void @nish.Map$str$i32.addOne(%struct.Map$str$i32* %this), !dbg !581
  %42 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !585
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !434, !dbg !585
  %44 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !586
  %45 = load i32, i32* %44, align 4, !tbaa !429, !dbg !586
  %46 = load i64, i64* %packed.addr, align 8, !dbg !588
  %47 = ashr i64 %46, 32, !dbg !588
  %48 = trunc i64 %47 to i32, !dbg !587
  %49 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !589
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !443, !dbg !589
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50), !dbg !584
  %52 = xor i1 %51, true, !dbg !583
  br i1 %52, label %if.then, label %if.end, !dbg !582

if.then:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !591
  br label %if.end, !dbg !582

if.end:
  ret void, !dbg !565
}

define internal void @nish.Map$str$i32.addOne(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 !dbg !592 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !594, metadata !DIExpression()), !dbg !593
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !596
  %1 = load i32, i32* %0, align 4, !tbaa !430, !dbg !596
  store i32 %1, i32* %live.addr, align 4, !dbg !595
  call void @llvm.dbg.declare(metadata i32* %live.addr, metadata !597, metadata !DIExpression()), !dbg !595
  %2 = load i32, i32* %live.addr, align 4, !dbg !599
  %3 = icmp slt i32 %2, 2147483647, !dbg !599
  br i1 %3, label %if.then, label %if.end, !dbg !598

if.then:
  %4 = load i32, i32* %live.addr, align 4, !dbg !603
  %5 = add nsw i32 %4, 1, !dbg !603
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !602
  store i32 %5, i32* %6, align 4, !tbaa !430, !dbg !602
  br label %if.end, !dbg !598

if.end:
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !606
  %8 = load i32, i32* %7, align 4, !tbaa !428, !dbg !606
  store i32 %8, i32* %size.addr, align 4, !dbg !605
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !607, metadata !DIExpression()), !dbg !605
  %9 = load i32, i32* %size.addr, align 4, !dbg !609
  %10 = icmp slt i32 %9, 2147483647, !dbg !609
  br i1 %10, label %if.then.1, label %if.end.1, !dbg !608

if.then.1:
  %11 = load i32, i32* %size.addr, align 4, !dbg !613
  %12 = add nsw i32 %11, 1, !dbg !613
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !612
  store i32 %12, i32* %13, align 4, !tbaa !428, !dbg !612
  br label %if.end.1, !dbg !608

if.end.1:
  ret void, !dbg !593
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !615 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !617, metadata !DIExpression()), !dbg !616
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !620
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !437, !dbg !620
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !620
  %3 = load i64, i64* %2, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !620
  %4 = trunc i64 %3 to i32, !dbg !620
  store i32 %4, i32* %used.addr, align 4, !dbg !618
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !621, metadata !DIExpression()), !dbg !618
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !623
  %6 = load i32, i32* %5, align 4, !tbaa !431, !dbg !623
  %7 = icmp ugt i32 %6, 0, !dbg !623
  store i1 %7, i1* %walking.addr, align 1, !dbg !622
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !625, metadata !DIExpression()), !dbg !622
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !628
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !434, !dbg !628
  %10 = load i1, i1* %walking.addr, align 1, !dbg !629
  br i1 %10, label %cond.true, label %cond.false, !dbg !629

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !630
  br label %cond.end, !dbg !629

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !631
  %13 = load i32, i32* %12, align 4, !tbaa !430, !dbg !631
  br label %cond.end, !dbg !629

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !629
  %15 = load i32, i32* %used.addr, align 4, !dbg !632
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !627
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !626
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !633, metadata !DIExpression()), !dbg !626
  %17 = load i1, i1* %walking.addr, align 1, !dbg !636
  %18 = xor i1 %17, true, !dbg !635
  br i1 %18, label %land.rhs, label %land.end, !dbg !635

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !637
  %20 = load i32, i32* %19, align 4, !tbaa !430, !dbg !637
  %21 = load i32, i32* %used.addr, align 4, !dbg !638
  %22 = icmp slt i32 %20, %21, !dbg !637
  br label %land.end, !dbg !635

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !635
  br i1 %23, label %if.then, label %if.end, !dbg !634

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !641
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !437, !dbg !641
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !642
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !443, !dbg !642
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !640
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !644
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !440, !dbg !644
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !645
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !443, !dbg !645
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !643
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !647
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !443, !dbg !647
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !646
  br label %if.end, !dbg !634

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !649
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !648
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !434, !dbg !648
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !652
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !652
  %38 = load i64, i64* %37, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !652
  %39 = trunc i64 %38 to i32, !dbg !652
  %40 = sub nsw i32 %39, 1, !dbg !651
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !650
  store i32 %40, i32* %41, align 4, !tbaa !429, !dbg !650
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !655
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !656
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !443, !dbg !656
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !654
  ret void, !dbg !616
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #3 !dbg !659 {
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
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !661, metadata !DIExpression()), !dbg !660
  call void @llvm.dbg.value(metadata i32 %mask, metadata !662, metadata !DIExpression()), !dbg !660
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !663, metadata !DIExpression()), !dbg !660
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !664, metadata !DIExpression()), !dbg !660
  call void @llvm.dbg.value(metadata i8* %key, metadata !665, metadata !DIExpression()), !dbg !660
  %0 = bitcast i8* %key to i64*, !dbg !667
  %1 = load i64, i64* %0, align 8, !dbg !667
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !667
  %3 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8, !dbg !667
  %4 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 1), align 8, !dbg !667
  %5 = xor i64 %3, 8317987319222330741, !dbg !667
  store i64 %5, i64* %hash.v0, align 8, !dbg !667
  %6 = xor i64 %4, 7237128888997146477, !dbg !667
  store i64 %6, i64* %hash.v1, align 8, !dbg !667
  %7 = xor i64 %3, 7816392313619706465, !dbg !667
  store i64 %7, i64* %hash.v2, align 8, !dbg !667
  %8 = xor i64 %4, 8387220255154660723, !dbg !667
  store i64 %8, i64* %hash.v3, align 8, !dbg !667
  %9 = and i64 %1, -8, !dbg !667
  store i64 0, i64* %hash.i, align 8, !dbg !667
  br label %hash.test, !dbg !667

hash.test:
  %10 = load i64, i64* %hash.i, align 8, !dbg !667
  %11 = icmp ult i64 %10, %9, !dbg !667
  br i1 %11, label %hash.word, label %hash.tail, !dbg !667

hash.word:
  %12 = getelementptr inbounds i8, i8* %2, i64 %10, !dbg !667
  %13 = bitcast i8* %12 to i64*, !dbg !667
  %14 = load i64, i64* %13, align 1, !dbg !667
  %15 = load i64, i64* %hash.v3, align 8, !dbg !667
  %16 = xor i64 %15, %14, !dbg !667
  store i64 %16, i64* %hash.v3, align 8, !dbg !667
  %17 = load i64, i64* %hash.v0, align 8, !dbg !667
  %18 = load i64, i64* %hash.v1, align 8, !dbg !667
  %19 = load i64, i64* %hash.v2, align 8, !dbg !667
  %20 = load i64, i64* %hash.v3, align 8, !dbg !667
  %21 = add i64 %17, %18, !dbg !667
  %22 = shl i64 %18, 13, !dbg !667
  %23 = lshr i64 %18, 51, !dbg !667
  %24 = or i64 %22, %23, !dbg !667
  %25 = xor i64 %24, %21, !dbg !667
  %26 = shl i64 %21, 32, !dbg !667
  %27 = lshr i64 %21, 32, !dbg !667
  %28 = or i64 %26, %27, !dbg !667
  %29 = add i64 %19, %20, !dbg !667
  %30 = shl i64 %20, 16, !dbg !667
  %31 = lshr i64 %20, 48, !dbg !667
  %32 = or i64 %30, %31, !dbg !667
  %33 = xor i64 %32, %29, !dbg !667
  %34 = add i64 %28, %33, !dbg !667
  %35 = shl i64 %33, 21, !dbg !667
  %36 = lshr i64 %33, 43, !dbg !667
  %37 = or i64 %35, %36, !dbg !667
  %38 = xor i64 %37, %34, !dbg !667
  %39 = add i64 %29, %25, !dbg !667
  %40 = shl i64 %25, 17, !dbg !667
  %41 = lshr i64 %25, 47, !dbg !667
  %42 = or i64 %40, %41, !dbg !667
  %43 = xor i64 %42, %39, !dbg !667
  %44 = shl i64 %39, 32, !dbg !667
  %45 = lshr i64 %39, 32, !dbg !667
  %46 = or i64 %44, %45, !dbg !667
  store i64 %34, i64* %hash.v0, align 8, !dbg !667
  store i64 %43, i64* %hash.v1, align 8, !dbg !667
  store i64 %46, i64* %hash.v2, align 8, !dbg !667
  store i64 %38, i64* %hash.v3, align 8, !dbg !667
  %47 = xor i64 %34, %14, !dbg !667
  store i64 %47, i64* %hash.v0, align 8, !dbg !667
  %48 = add i64 %10, 8, !dbg !667
  store i64 %48, i64* %hash.i, align 8, !dbg !667
  br label %hash.test, !dbg !667

hash.tail:
  %49 = shl i64 %1, 56, !dbg !667
  store i64 %49, i64* %hash.b, align 8, !dbg !667
  br label %hash.more, !dbg !667

hash.more:
  %50 = load i64, i64* %hash.i, align 8, !dbg !667
  %51 = icmp ult i64 %50, %1, !dbg !667
  br i1 %51, label %hash.byte, label %hash.done, !dbg !667

hash.byte:
  %52 = getelementptr inbounds i8, i8* %2, i64 %50, !dbg !667
  %53 = load i8, i8* %52, !dbg !667
  %54 = zext i8 %53 to i64, !dbg !667
  %55 = sub i64 %50, %9, !dbg !667
  %56 = shl i64 %55, 3, !dbg !667
  %57 = load i64, i64* %hash.b, align 8, !dbg !667
  %58 = shl i64 %54, %56, !dbg !667
  %59 = or i64 %57, %58, !dbg !667
  store i64 %59, i64* %hash.b, align 8, !dbg !667
  %60 = add i64 %50, 1, !dbg !667
  store i64 %60, i64* %hash.i, align 8, !dbg !667
  br label %hash.more, !dbg !667

hash.done:
  %61 = load i64, i64* %hash.b, align 8, !dbg !667
  %62 = load i64, i64* %hash.v3, align 8, !dbg !667
  %63 = xor i64 %62, %61, !dbg !667
  store i64 %63, i64* %hash.v3, align 8, !dbg !667
  %64 = load i64, i64* %hash.v0, align 8, !dbg !667
  %65 = load i64, i64* %hash.v1, align 8, !dbg !667
  %66 = load i64, i64* %hash.v2, align 8, !dbg !667
  %67 = load i64, i64* %hash.v3, align 8, !dbg !667
  %68 = add i64 %64, %65, !dbg !667
  %69 = shl i64 %65, 13, !dbg !667
  %70 = lshr i64 %65, 51, !dbg !667
  %71 = or i64 %69, %70, !dbg !667
  %72 = xor i64 %71, %68, !dbg !667
  %73 = shl i64 %68, 32, !dbg !667
  %74 = lshr i64 %68, 32, !dbg !667
  %75 = or i64 %73, %74, !dbg !667
  %76 = add i64 %66, %67, !dbg !667
  %77 = shl i64 %67, 16, !dbg !667
  %78 = lshr i64 %67, 48, !dbg !667
  %79 = or i64 %77, %78, !dbg !667
  %80 = xor i64 %79, %76, !dbg !667
  %81 = add i64 %75, %80, !dbg !667
  %82 = shl i64 %80, 21, !dbg !667
  %83 = lshr i64 %80, 43, !dbg !667
  %84 = or i64 %82, %83, !dbg !667
  %85 = xor i64 %84, %81, !dbg !667
  %86 = add i64 %76, %72, !dbg !667
  %87 = shl i64 %72, 17, !dbg !667
  %88 = lshr i64 %72, 47, !dbg !667
  %89 = or i64 %87, %88, !dbg !667
  %90 = xor i64 %89, %86, !dbg !667
  %91 = shl i64 %86, 32, !dbg !667
  %92 = lshr i64 %86, 32, !dbg !667
  %93 = or i64 %91, %92, !dbg !667
  store i64 %81, i64* %hash.v0, align 8, !dbg !667
  store i64 %90, i64* %hash.v1, align 8, !dbg !667
  store i64 %93, i64* %hash.v2, align 8, !dbg !667
  store i64 %85, i64* %hash.v3, align 8, !dbg !667
  %94 = xor i64 %81, %61, !dbg !667
  store i64 %94, i64* %hash.v0, align 8, !dbg !667
  %95 = load i64, i64* %hash.v2, align 8, !dbg !667
  %96 = xor i64 %95, 255, !dbg !667
  store i64 %96, i64* %hash.v2, align 8, !dbg !667
  %97 = load i64, i64* %hash.v0, align 8, !dbg !667
  %98 = load i64, i64* %hash.v1, align 8, !dbg !667
  %99 = load i64, i64* %hash.v2, align 8, !dbg !667
  %100 = load i64, i64* %hash.v3, align 8, !dbg !667
  %101 = add i64 %97, %98, !dbg !667
  %102 = shl i64 %98, 13, !dbg !667
  %103 = lshr i64 %98, 51, !dbg !667
  %104 = or i64 %102, %103, !dbg !667
  %105 = xor i64 %104, %101, !dbg !667
  %106 = shl i64 %101, 32, !dbg !667
  %107 = lshr i64 %101, 32, !dbg !667
  %108 = or i64 %106, %107, !dbg !667
  %109 = add i64 %99, %100, !dbg !667
  %110 = shl i64 %100, 16, !dbg !667
  %111 = lshr i64 %100, 48, !dbg !667
  %112 = or i64 %110, %111, !dbg !667
  %113 = xor i64 %112, %109, !dbg !667
  %114 = add i64 %108, %113, !dbg !667
  %115 = shl i64 %113, 21, !dbg !667
  %116 = lshr i64 %113, 43, !dbg !667
  %117 = or i64 %115, %116, !dbg !667
  %118 = xor i64 %117, %114, !dbg !667
  %119 = add i64 %109, %105, !dbg !667
  %120 = shl i64 %105, 17, !dbg !667
  %121 = lshr i64 %105, 47, !dbg !667
  %122 = or i64 %120, %121, !dbg !667
  %123 = xor i64 %122, %119, !dbg !667
  %124 = shl i64 %119, 32, !dbg !667
  %125 = lshr i64 %119, 32, !dbg !667
  %126 = or i64 %124, %125, !dbg !667
  %127 = add i64 %114, %123, !dbg !667
  %128 = shl i64 %123, 13, !dbg !667
  %129 = lshr i64 %123, 51, !dbg !667
  %130 = or i64 %128, %129, !dbg !667
  %131 = xor i64 %130, %127, !dbg !667
  %132 = shl i64 %127, 32, !dbg !667
  %133 = lshr i64 %127, 32, !dbg !667
  %134 = or i64 %132, %133, !dbg !667
  %135 = add i64 %126, %118, !dbg !667
  %136 = shl i64 %118, 16, !dbg !667
  %137 = lshr i64 %118, 48, !dbg !667
  %138 = or i64 %136, %137, !dbg !667
  %139 = xor i64 %138, %135, !dbg !667
  %140 = add i64 %134, %139, !dbg !667
  %141 = shl i64 %139, 21, !dbg !667
  %142 = lshr i64 %139, 43, !dbg !667
  %143 = or i64 %141, %142, !dbg !667
  %144 = xor i64 %143, %140, !dbg !667
  %145 = add i64 %135, %131, !dbg !667
  %146 = shl i64 %131, 17, !dbg !667
  %147 = lshr i64 %131, 47, !dbg !667
  %148 = or i64 %146, %147, !dbg !667
  %149 = xor i64 %148, %145, !dbg !667
  %150 = shl i64 %145, 32, !dbg !667
  %151 = lshr i64 %145, 32, !dbg !667
  %152 = or i64 %150, %151, !dbg !667
  %153 = add i64 %140, %149, !dbg !667
  %154 = shl i64 %149, 13, !dbg !667
  %155 = lshr i64 %149, 51, !dbg !667
  %156 = or i64 %154, %155, !dbg !667
  %157 = xor i64 %156, %153, !dbg !667
  %158 = shl i64 %153, 32, !dbg !667
  %159 = lshr i64 %153, 32, !dbg !667
  %160 = or i64 %158, %159, !dbg !667
  %161 = add i64 %152, %144, !dbg !667
  %162 = shl i64 %144, 16, !dbg !667
  %163 = lshr i64 %144, 48, !dbg !667
  %164 = or i64 %162, %163, !dbg !667
  %165 = xor i64 %164, %161, !dbg !667
  %166 = add i64 %160, %165, !dbg !667
  %167 = shl i64 %165, 21, !dbg !667
  %168 = lshr i64 %165, 43, !dbg !667
  %169 = or i64 %167, %168, !dbg !667
  %170 = xor i64 %169, %166, !dbg !667
  %171 = add i64 %161, %157, !dbg !667
  %172 = shl i64 %157, 17, !dbg !667
  %173 = lshr i64 %157, 47, !dbg !667
  %174 = or i64 %172, %173, !dbg !667
  %175 = xor i64 %174, %171, !dbg !667
  %176 = shl i64 %171, 32, !dbg !667
  %177 = lshr i64 %171, 32, !dbg !667
  %178 = or i64 %176, %177, !dbg !667
  store i64 %166, i64* %hash.v0, align 8, !dbg !667
  store i64 %175, i64* %hash.v1, align 8, !dbg !667
  store i64 %178, i64* %hash.v2, align 8, !dbg !667
  store i64 %170, i64* %hash.v3, align 8, !dbg !667
  %179 = xor i64 %166, %175, !dbg !667
  %180 = xor i64 %178, %170, !dbg !667
  %181 = xor i64 %179, %180, !dbg !667
  %182 = trunc i64 %181 to i32, !dbg !667
  %183 = lshr i64 %181, 32, !dbg !667
  %184 = trunc i64 %183 to i32, !dbg !667
  %185 = xor i32 %182, %184, !dbg !667
  %186 = icmp eq i32 %185, 0, !dbg !667
  %187 = select i1 %186, i32 1, i32 %185, !dbg !667
  store i32 %187, i32* %h.addr, align 4, !dbg !666
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !669, metadata !DIExpression()), !dbg !666
  store i32 %mask, i32* %low.addr, align 4, !dbg !670
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !673, metadata !DIExpression()), !dbg !670
  %188 = load i32, i32* %h.addr, align 4, !dbg !675
  %189 = load i32, i32* %low.addr, align 4, !dbg !677
  %190 = xor i32 %189, -1, !dbg !676
  %191 = and i32 %188, %190, !dbg !675
  store i32 %191, i32* %fingerprint.addr, align 4, !dbg !674
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !678, metadata !DIExpression()), !dbg !674
  %192 = load i32, i32* %h.addr, align 4, !dbg !682
  %193 = call i32 @nish.homeBucket(i32 %192, i32 %mask), !dbg !681
  store i32 %193, i32* %bucket.addr, align 4, !dbg !679
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !684, metadata !DIExpression()), !dbg !679
  %194 = load i32, i32* %bucket.addr, align 4, !dbg !687
  store i32 %194, i32* %b.addr, align 4, !dbg !685
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !688, metadata !DIExpression()), !dbg !685
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !689
  %196 = load i64, i64* %195, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !689
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !689
  %198 = load i8*, i8** %197, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !689
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !689
  %200 = load i64, i64* %199, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !689
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !689
  %202 = load i8*, i8** %201, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !689
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !689
  %204 = load i64, i64* %203, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !689
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !689
  %206 = load i8*, i8** %205, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !689
  br label %while.cond, !dbg !689

while.cond:
  %207 = load i32, i32* %b.addr, align 4, !dbg !693
  %208 = icmp sge i32 %207, 0, !dbg !693
  br i1 %208, label %land.rhs, label %land.end, !dbg !693

land.rhs:
  %209 = load i32, i32* %b.addr, align 4, !dbg !695
  %210 = trunc i64 %196 to i32, !dbg !690
  %211 = icmp slt i32 %209, %210, !dbg !695
  br label %land.end, !dbg !693

land.end:
  %212 = phi i1 [ false, %while.cond ], [ %211, %land.rhs ], !dbg !693
  br i1 %212, label %while.body, label %while.end, !dbg !689

while.body:
  %213 = load i32, i32* %b.addr, align 4, !dbg !700
  %214 = sext i32 %213 to i64, !dbg !699
  %215 = bitcast i8* %198 to i32*, !dbg !699
  %216 = getelementptr inbounds i32, i32* %215, i64 %214, !dbg !699
  %217 = load i32, i32* %216, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !699
  store i32 %217, i32* %word.addr, align 4, !dbg !698
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !701, metadata !DIExpression()), !dbg !698
  %218 = load i32, i32* %word.addr, align 4, !dbg !703
  %219 = icmp eq i32 %218, 0, !dbg !703
  br i1 %219, label %if.then, label %if.end, !dbg !702

if.then:
  %220 = load i32, i32* %b.addr, align 4, !dbg !708
  %221 = load i32, i32* %h.addr, align 4, !dbg !709
  %222 = tail call i64 @nish.absentAt(i32 %220, i32 %221), !dbg !707
  ret i64 %222, !dbg !706

if.end:
  %223 = load i32, i32* %word.addr, align 4, !dbg !712
  %224 = load i32, i32* %low.addr, align 4, !dbg !714
  %225 = xor i32 %224, -1, !dbg !713
  %226 = and i32 %223, %225, !dbg !712
  %227 = load i32, i32* %fingerprint.addr, align 4, !dbg !715
  %228 = icmp eq i32 %226, %227, !dbg !711
  br i1 %228, label %if.then.1, label %if.end.1, !dbg !710

if.then.1:
  %229 = load i32, i32* %word.addr, align 4, !dbg !720
  %230 = load i32, i32* %low.addr, align 4, !dbg !721
  %231 = and i32 %229, %230, !dbg !720
  %232 = sub i32 %231, 1, !dbg !719
  store i32 %232, i32* %at.addr, align 4, !dbg !717
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !723, metadata !DIExpression()), !dbg !717
  %233 = load i32, i32* %at.addr, align 4, !dbg !725
  %234 = icmp sge i32 %233, 0, !dbg !725
  br i1 %234, label %land.rhs.4, label %land.end.4, !dbg !725

land.rhs.4:
  %235 = load i32, i32* %at.addr, align 4, !dbg !727
  %236 = trunc i64 %200 to i32, !dbg !691
  %237 = icmp slt i32 %235, %236, !dbg !727
  br label %land.end.4, !dbg !725

land.end.4:
  %238 = phi i1 [ false, %if.then.1 ], [ %237, %land.rhs.4 ], !dbg !725
  br i1 %238, label %land.rhs.3, label %land.end.3, !dbg !725

land.rhs.3:
  %239 = load i32, i32* %at.addr, align 4, !dbg !730
  %240 = sext i32 %239 to i64, !dbg !729
  %241 = bitcast i8* %202 to i32*, !dbg !729
  %242 = getelementptr inbounds i32, i32* %241, i64 %240, !dbg !729
  %243 = load i32, i32* %242, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !729
  %244 = load i32, i32* %h.addr, align 4, !dbg !731
  %245 = icmp eq i32 %243, %244, !dbg !729
  br label %land.end.3, !dbg !725

land.end.3:
  %246 = phi i1 [ false, %land.end.4 ], [ %245, %land.rhs.3 ], !dbg !725
  br i1 %246, label %land.rhs.2, label %land.end.2, !dbg !725

land.rhs.2:
  %247 = load i32, i32* %at.addr, align 4, !dbg !732
  %248 = trunc i64 %204 to i32, !dbg !692
  %249 = icmp slt i32 %247, %248, !dbg !732
  br label %land.end.2, !dbg !725

land.end.2:
  %250 = phi i1 [ false, %land.end.3 ], [ %249, %land.rhs.2 ], !dbg !725
  br i1 %250, label %land.rhs.1, label %land.end.1, !dbg !725

land.rhs.1:
  %251 = load i32, i32* %at.addr, align 4, !dbg !736
  %252 = sext i32 %251 to i64, !dbg !735
  %253 = bitcast i8* %206 to i8**, !dbg !735
  %254 = getelementptr inbounds i8*, i8** %253, i64 %252, !dbg !735
  %255 = load i8*, i8** %254, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !735
  %256 = call zeroext i1 @nish_str_eq(i8* %255, i8* %key), !dbg !734
  br label %land.end.1, !dbg !725

land.end.1:
  %257 = phi i1 [ false, %land.end.2 ], [ %256, %land.rhs.1 ], !dbg !725
  br i1 %257, label %if.then.2, label %if.end.2, !dbg !724

if.then.2:
  %258 = load i32, i32* %b.addr, align 4, !dbg !741
  %259 = load i32, i32* %at.addr, align 4, !dbg !742
  %260 = tail call i64 @nish.foundAt(i32 %258, i32 %259), !dbg !740
  ret i64 %260, !dbg !739

if.end.2:
  br label %if.end.1, !dbg !710

if.end.1:
  %261 = load i32, i32* %bucket.addr, align 4, !dbg !745
  %262 = add i32 %261, 1, !dbg !745
  %263 = load i32, i32* %low.addr, align 4, !dbg !747
  %264 = and i32 %262, %263, !dbg !744
  store i32 %264, i32* %bucket.addr, align 4, !dbg !743
  %265 = load i32, i32* %bucket.addr, align 4, !dbg !750
  store i32 %265, i32* %b.addr, align 4, !dbg !748
  br label %while.cond, !dbg !689

while.end:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !754
  %267 = load i64, i64* %266, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !754
  %268 = trunc i64 %267 to i32, !dbg !754
  %269 = load i32, i32* %h.addr, align 4, !dbg !755
  %270 = tail call i64 @nish.absentAt(i32 %268, i32 %269), !dbg !752
  ret i64 %270, !dbg !751
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !758 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !760, metadata !DIExpression()), !dbg !759
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !761, metadata !DIExpression()), !dbg !759
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !764
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !764
  %2 = trunc i64 %1 to i32, !dbg !764
  store i32 %2, i32* %used.addr, align 4, !dbg !762
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !765, metadata !DIExpression()), !dbg !762
  store i32 0, i32* %to.addr, align 4, !dbg !766
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !768, metadata !DIExpression()), !dbg !766
  store i32 0, i32* %from.addr, align 4, !dbg !769
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !771, metadata !DIExpression()), !dbg !769
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !769
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !769
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !769
  %6 = load i8*, i8** %5, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !769
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !769
  %8 = load i64, i64* %7, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !769
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !769
  %10 = load i8*, i8** %9, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !769
  br label %for.cond, !dbg !769

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !774
  %12 = load i32, i32* %used.addr, align 4, !dbg !775
  %13 = icmp slt i32 %11, %12, !dbg !774
  br i1 %13, label %land.rhs, label %land.end, !dbg !774

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !776
  %15 = trunc i64 %4 to i32, !dbg !772
  %16 = icmp slt i32 %14, %15, !dbg !776
  br label %land.end, !dbg !774

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !774
  br i1 %17, label %for.body, label %for.end, !dbg !769

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !781
  %19 = sext i32 %18 to i64, !dbg !780
  %20 = bitcast i8* %6 to i32*, !dbg !780
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !780
  %22 = load i32, i32* %21, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !780
  %23 = icmp ne i32 %22, 0, !dbg !780
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !780

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !783
  %25 = icmp sge i32 %24, 0, !dbg !783
  br label %land.end.3, !dbg !780

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !780
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !780

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !785
  %28 = load i32, i32* %used.addr, align 4, !dbg !786
  %29 = icmp slt i32 %27, %28, !dbg !785
  br label %land.end.2, !dbg !780

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !780
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !780

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !787
  %32 = trunc i64 %8 to i32, !dbg !773
  %33 = icmp slt i32 %31, %32, !dbg !787
  br label %land.end.1, !dbg !780

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !780
  br i1 %34, label %if.then, label %if.end, !dbg !779

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !791
  %36 = sext i32 %35 to i64, !dbg !790
  %37 = load i32, i32* %from.addr, align 4, !dbg !793
  %38 = sext i32 %37 to i64, !dbg !792
  %39 = bitcast i8* %10 to i8**, !dbg !792
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !792
  %41 = load i8*, i8** %40, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !792
  %42 = bitcast i8* %10 to i8**, !dbg !790
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !790
  store i8* %41, i8** %43, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !790
  %44 = load i32, i32* %to.addr, align 4, !dbg !794
  %45 = add nsw i32 %44, 1, !dbg !794
  store i32 %45, i32* %to.addr, align 4, !dbg !794
  br label %if.end, !dbg !779

if.end:
  br label %for.inc, !dbg !769

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !795
  %47 = add nsw i32 %46, 1, !dbg !795
  store i32 %47, i32* %from.addr, align 4, !dbg !795
  br label %for.cond, !dbg !769

for.end:
  br label %while.cond, !dbg !796

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !798
  %49 = load i64, i64* %48, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !798
  %50 = trunc i64 %49 to i32, !dbg !798
  %51 = load i32, i32* %to.addr, align 4, !dbg !799
  %52 = icmp sgt i32 %50, %51, !dbg !797
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !797

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !800
  %54 = load i64, i64* %53, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !800
  %55 = trunc i64 %54 to i32, !dbg !800
  %56 = icmp sgt i32 %55, 0, !dbg !800
  br label %land.end.4, !dbg !797

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !797
  br i1 %57, label %while.body, label %while.end, !dbg !796

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !803
  %59 = load i64, i64* %58, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !803
  %60 = sub i64 %59, 1, !dbg !803
  store i64 %60, i64* %58, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !803
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !803
  %62 = load i8*, i8** %61, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !803
  %63 = bitcast i8* %62 to i8**, !dbg !803
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60, !dbg !803
  %65 = load i8*, i8** %64, align 8, !alias.scope !161, !noalias !160, !tbaa !523, !dbg !803
  br label %while.cond, !dbg !796

while.end:
  ret void, !dbg !759
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !806 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !808, metadata !DIExpression()), !dbg !807
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !809, metadata !DIExpression()), !dbg !807
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !812
  %1 = load i64, i64* %0, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !812
  %2 = trunc i64 %1 to i32, !dbg !812
  store i32 %2, i32* %used.addr, align 4, !dbg !810
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !813, metadata !DIExpression()), !dbg !810
  store i32 0, i32* %to.addr, align 4, !dbg !814
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !816, metadata !DIExpression()), !dbg !814
  store i32 0, i32* %from.addr, align 4, !dbg !817
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !819, metadata !DIExpression()), !dbg !817
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !817
  %4 = load i64, i64* %3, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !817
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !817
  %6 = load i8*, i8** %5, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !817
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !817
  %8 = load i64, i64* %7, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !817
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !817
  %10 = load i8*, i8** %9, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !817
  br label %for.cond, !dbg !817

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !822
  %12 = load i32, i32* %used.addr, align 4, !dbg !823
  %13 = icmp slt i32 %11, %12, !dbg !822
  br i1 %13, label %land.rhs, label %land.end, !dbg !822

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !824
  %15 = trunc i64 %4 to i32, !dbg !820
  %16 = icmp slt i32 %14, %15, !dbg !824
  br label %land.end, !dbg !822

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !822
  br i1 %17, label %for.body, label %for.end, !dbg !817

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !829
  %19 = sext i32 %18 to i64, !dbg !828
  %20 = bitcast i8* %6 to i32*, !dbg !828
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !828
  %22 = load i32, i32* %21, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !828
  %23 = icmp ne i32 %22, 0, !dbg !828
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !828

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !831
  %25 = icmp sge i32 %24, 0, !dbg !831
  br label %land.end.3, !dbg !828

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !828
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !828

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !833
  %28 = load i32, i32* %used.addr, align 4, !dbg !834
  %29 = icmp slt i32 %27, %28, !dbg !833
  br label %land.end.2, !dbg !828

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !828
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !828

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !835
  %32 = trunc i64 %8 to i32, !dbg !821
  %33 = icmp slt i32 %31, %32, !dbg !835
  br label %land.end.1, !dbg !828

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !828
  br i1 %34, label %if.then, label %if.end, !dbg !827

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !839
  %36 = sext i32 %35 to i64, !dbg !838
  %37 = load i32, i32* %from.addr, align 4, !dbg !841
  %38 = sext i32 %37 to i64, !dbg !840
  %39 = bitcast i8* %10 to i32*, !dbg !840
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !840
  %41 = load i32, i32* %40, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !840
  %42 = bitcast i8* %10 to i32*, !dbg !838
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !838
  store i32 %41, i32* %43, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !838
  %44 = load i32, i32* %to.addr, align 4, !dbg !842
  %45 = add nsw i32 %44, 1, !dbg !842
  store i32 %45, i32* %to.addr, align 4, !dbg !842
  br label %if.end, !dbg !827

if.end:
  br label %for.inc, !dbg !817

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !843
  %47 = add nsw i32 %46, 1, !dbg !843
  store i32 %47, i32* %from.addr, align 4, !dbg !843
  br label %for.cond, !dbg !817

for.end:
  br label %while.cond, !dbg !844

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !846
  %49 = load i64, i64* %48, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !846
  %50 = trunc i64 %49 to i32, !dbg !846
  %51 = load i32, i32* %to.addr, align 4, !dbg !847
  %52 = icmp sgt i32 %50, %51, !dbg !845
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !845

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !848
  %54 = load i64, i64* %53, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !848
  %55 = trunc i64 %54 to i32, !dbg !848
  %56 = icmp sgt i32 %55, 0, !dbg !848
  br label %land.end.4, !dbg !845

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !845
  br i1 %57, label %while.body, label %while.end, !dbg !844

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !851
  %59 = load i64, i64* %58, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !851
  %60 = sub i64 %59, 1, !dbg !851
  store i64 %60, i64* %58, align 8, !alias.scope !160, !noalias !161, !tbaa !167, !dbg !851
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !851
  %62 = load i8*, i8** %61, align 8, !alias.scope !160, !noalias !161, !tbaa !168, !dbg !851
  %63 = bitcast i8* %62 to i32*, !dbg !851
  %64 = getelementptr inbounds i32, i32* %63, i64 %60, !dbg !851
  %65 = load i32, i32* %64, align 4, !alias.scope !161, !noalias !160, !tbaa !178, !dbg !851
  br label %while.cond, !dbg !844

while.end:
  ret void, !dbg !807
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #7 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3, !852, !853, !854, !855, !856}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_map_iter.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 3, type: !6, scopeLine: 3, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 3, column: 1, scope: !7)
!9 = !DILocation(line: 4, column: 3, scope: !7)
!10 = !DILocation(line: 4, column: 13, scope: !7)
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<string, i32>", file: !13, line: 330, size: 448, align: 64, elements: !47)
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
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "string[]", file: !1, size: 192, align: 64, elements: !34)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!31 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !30, size: 64)
!32 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !31, size: 64)
!33 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !32, size: 64, offset: 128)
!34 = !{!28, !29, !33}
!35 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 339, baseType: !35, size: 64, offset: 192)
!37 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !42)
!38 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !37, baseType: !16, size: 64, offset: 0)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !37, baseType: !16, size: 64, offset: 64)
!40 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !37, baseType: !40, size: 64, offset: 128)
!42 = !{!38, !39, !41}
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !37, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 340, baseType: !43, size: 64, offset: 256)
!45 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 342, baseType: !23, size: 64, offset: 320)
!46 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 348, baseType: !19, size: 32, offset: 384)
!47 = !{!14, !24, !25, !26, !36, !44, !45, !46}
!48 = !DILocalVariable(name: "m", scope: !7, file: !1, line: 4, type: !12)
!49 = !DILocation(line: 5, column: 3, scope: !7)
!50 = !DILocation(line: 5, column: 9, scope: !7)
!51 = !DILocation(line: 5, column: 14, scope: !7)
!52 = !DILocation(line: 5, column: 21, scope: !7)
!53 = !DILocation(line: 5, column: 26, scope: !7)
!54 = !DILocation(line: 6, column: 3, scope: !7)
!55 = !DILocation(line: 6, column: 18, scope: !7)
!56 = !DILocalVariable(name: "sum", scope: !7, file: !1, line: 6, type: !4)
!57 = !DILocation(line: 7, column: 3, scope: !7)
!58 = !DILocalVariable(name: "word", scope: !7, file: !1, line: 7, type: !31)
!59 = !DILocation(line: 7, column: 22, scope: !7)
!60 = !DILocation(line: 7, column: 32, scope: !7)
!61 = !DILocation(line: 8, column: 5, scope: !7)
!62 = !DILocation(line: 8, column: 12, scope: !7)
!63 = !DILocation(line: 10, column: 3, scope: !7)
!64 = !DILocalVariable(name: "count", scope: !7, file: !1, line: 10, type: !4)
!65 = !DILocation(line: 10, column: 23, scope: !7)
!66 = !DILocation(line: 10, column: 35, scope: !7)
!67 = !DILocation(line: 11, column: 5, scope: !7)
!68 = !DILocation(line: 11, column: 12, scope: !7)
!69 = !DILocation(line: 13, column: 3, scope: !7)
!70 = !DILocation(line: 13, column: 15, scope: !7)
!71 = !DILocation(line: 13, column: 18, scope: !7)
!72 = !DILocation(line: 14, column: 3, scope: !7)
!73 = !DILocation(line: 14, column: 10, scope: !7)
!74 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 3, type: !6, scopeLine: 3, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!75 = !DILocation(line: 3, column: 1, scope: !74)
!76 = !{!4, !19, !4}
!77 = !DISubroutineType(types: !76)
!78 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 82, type: !77, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!79 = !DILocation(line: 82, column: 1, scope: !78)
!80 = !DILocalVariable(name: "h", arg: 1, scope: !78, file: !13, line: 82, type: !19)
!81 = !DILocalVariable(name: "mask", arg: 2, scope: !78, file: !13, line: 82, type: !4)
!82 = !DILocation(line: 82, column: 48, scope: !78)
!83 = !DILocation(line: 82, column: 54, scope: !78)
!84 = !DILocation(line: 82, column: 58, scope: !78)
!85 = !DILocation(line: 82, column: 59, scope: !78)
!86 = !DILocation(line: 82, column: 72, scope: !78)
!87 = !{!19, !19, !4, !4}
!88 = !DISubroutineType(types: !87)
!89 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 90, type: !88, scopeLine: 90, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!90 = !DILocation(line: 90, column: 1, scope: !89)
!91 = !DILocalVariable(name: "h", arg: 1, scope: !89, file: !13, line: 90, type: !19)
!92 = !DILocalVariable(name: "mask", arg: 2, scope: !89, file: !13, line: 90, type: !4)
!93 = !DILocalVariable(name: "index", arg: 3, scope: !89, file: !13, line: 90, type: !4)
!94 = !DILocation(line: 90, column: 58, scope: !89)
!95 = !DILocation(line: 90, column: 59, scope: !89)
!96 = !DILocation(line: 90, column: 63, scope: !89)
!97 = !DILocation(line: 90, column: 64, scope: !89)
!98 = !DILocation(line: 90, column: 70, scope: !89)
!99 = !DILocation(line: 90, column: 79, scope: !89)
!100 = !DILocation(line: 90, column: 80, scope: !89)
!101 = !DILocation(line: 90, column: 86, scope: !89)
!102 = !DILocation(line: 90, column: 95, scope: !89)
!103 = !{!16, !4, !4}
!104 = !DISubroutineType(types: !103)
!105 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 99, type: !104, scopeLine: 99, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!106 = !DILocation(line: 99, column: 1, scope: !105)
!107 = !DILocalVariable(name: "bucket", arg: 1, scope: !105, file: !13, line: 99, type: !4)
!108 = !DILocalVariable(name: "index", arg: 2, scope: !105, file: !13, line: 99, type: !4)
!109 = !DILocation(line: 99, column: 51, scope: !105)
!110 = !DILocation(line: 99, column: 52, scope: !105)
!111 = !DILocation(line: 99, column: 58, scope: !105)
!112 = !DILocation(line: 99, column: 75, scope: !105)
!113 = !DILocation(line: 99, column: 81, scope: !105)
!114 = !{!16, !4, !19}
!115 = !DISubroutineType(types: !114)
!116 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 102, type: !115, scopeLine: 102, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!117 = !DILocation(line: 102, column: 1, scope: !116)
!118 = !DILocalVariable(name: "bucket", arg: 1, scope: !116, file: !13, line: 102, type: !4)
!119 = !DILocalVariable(name: "h", arg: 2, scope: !116, file: !13, line: 102, type: !19)
!120 = !DILocation(line: 102, column: 48, scope: !116)
!121 = !DILocation(line: 102, column: 49, scope: !116)
!122 = !DILocation(line: 102, column: 50, scope: !116)
!123 = !DILocation(line: 102, column: 51, scope: !116)
!124 = !DILocation(line: 102, column: 57, scope: !116)
!125 = !DILocation(line: 102, column: 74, scope: !116)
!126 = !DILocation(line: 102, column: 80, scope: !116)
!127 = !{null, !23, !4, !19, !4}
!128 = !DISubroutineType(types: !127)
!129 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 154, type: !128, scopeLine: 154, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!130 = !DILocation(line: 154, column: 1, scope: !129)
!131 = !DILocalVariable(name: "slots", arg: 1, scope: !129, file: !13, line: 154, type: !23)
!132 = !DILocalVariable(name: "mask", arg: 2, scope: !129, file: !13, line: 154, type: !4)
!133 = !DILocalVariable(name: "h", arg: 3, scope: !129, file: !13, line: 154, type: !19)
!134 = !DILocalVariable(name: "index", arg: 4, scope: !129, file: !13, line: 154, type: !4)
!135 = !DILocation(line: 155, column: 3, scope: !129)
!136 = !DILocation(line: 155, column: 16, scope: !129)
!137 = !DILocation(line: 155, column: 25, scope: !129)
!138 = !DILocation(line: 155, column: 28, scope: !129)
!139 = !DILocation(line: 155, column: 34, scope: !129)
!140 = !DILocalVariable(name: "word", scope: !129, file: !13, line: 155, type: !19)
!141 = !DILocation(line: 156, column: 3, scope: !129)
!142 = !DILocation(line: 156, column: 15, scope: !129)
!143 = !DILocation(line: 156, column: 21, scope: !129)
!144 = !DILocalVariable(name: "low", scope: !129, file: !13, line: 156, type: !19)
!145 = !DILocation(line: 157, column: 3, scope: !129)
!146 = !DILocation(line: 157, column: 16, scope: !129)
!147 = !DILocation(line: 157, column: 22, scope: !129)
!148 = !DILocation(line: 157, column: 33, scope: !129)
!149 = !DILocation(line: 157, column: 36, scope: !129)
!150 = !DILocalVariable(name: "bucket", scope: !129, file: !13, line: 157, type: !19)
!151 = !DILocation(line: 158, column: 3, scope: !129)
!152 = !DILocation(line: 158, column: 11, scope: !129)
!153 = !DILocation(line: 158, column: 17, scope: !129)
!154 = !DILocalVariable(name: "b", scope: !129, file: !13, line: 158, type: !4)
!155 = !DILocation(line: 159, column: 3, scope: !129)
!156 = !DILocation(line: 159, column: 30, scope: !129)
!157 = !{!"nish array"}
!158 = !{!"header", !157}
!159 = !{!"elements", !157}
!160 = !{!158}
!161 = !{!159}
!162 = !{!"nish TBAA"}
!163 = !{!"omnipotent char", !162, i64 0}
!164 = !{!"header i64", !163, i64 0}
!165 = !{!"header ptr", !163, i64 0}
!166 = !{!"array header", !164, i64 0, !164, i64 8, !165, i64 16}
!167 = !{!166, !164, i64 0}
!168 = !{!166, !165, i64 16}
!169 = !DILocation(line: 159, column: 10, scope: !129)
!170 = !DILocation(line: 159, column: 15, scope: !129)
!171 = !DILocation(line: 159, column: 20, scope: !129)
!172 = !DILocation(line: 159, column: 24, scope: !129)
!173 = !DILocation(line: 159, column: 45, scope: !129)
!174 = !DILocation(line: 160, column: 5, scope: !129)
!175 = !DILocation(line: 160, column: 9, scope: !129)
!176 = !DILocation(line: 160, column: 15, scope: !129)
!177 = !{!"element i32", !163, i64 0}
!178 = !{!177, !177, i64 0}
!179 = !DILocation(line: 160, column: 22, scope: !129)
!180 = !DILocation(line: 160, column: 25, scope: !129)
!181 = !DILocation(line: 161, column: 7, scope: !129)
!182 = !DILocation(line: 161, column: 13, scope: !129)
!183 = !DILocation(line: 161, column: 18, scope: !129)
!184 = !DILocation(line: 162, column: 7, scope: !129)
!185 = !DILocation(line: 164, column: 5, scope: !129)
!186 = !DILocation(line: 164, column: 14, scope: !129)
!187 = !DILocation(line: 164, column: 15, scope: !129)
!188 = !DILocation(line: 164, column: 24, scope: !129)
!189 = !DILocation(line: 164, column: 29, scope: !129)
!190 = !DILocation(line: 165, column: 5, scope: !129)
!191 = !DILocation(line: 165, column: 9, scope: !129)
!192 = !DILocation(line: 165, column: 15, scope: !129)
!193 = !{null, !23}
!194 = !DISubroutineType(types: !193)
!195 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 185, type: !194, scopeLine: 185, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!196 = !DILocation(line: 185, column: 1, scope: !195)
!197 = !DILocalVariable(name: "hashes", arg: 1, scope: !195, file: !13, line: 185, type: !23)
!198 = !DILocation(line: 186, column: 3, scope: !195)
!199 = !DILocation(line: 186, column: 16, scope: !195)
!200 = !DILocation(line: 186, column: 22, scope: !195)
!201 = !DILocalVariable(name: "used", scope: !195, file: !13, line: 186, type: !4)
!202 = !DILocation(line: 187, column: 3, scope: !195)
!203 = !DILocation(line: 187, column: 17, scope: !195)
!204 = !DILocalVariable(name: "to", scope: !195, file: !13, line: 187, type: !4)
!205 = !DILocation(line: 188, column: 3, scope: !195)
!206 = !DILocation(line: 188, column: 24, scope: !195)
!207 = !DILocalVariable(name: "from", scope: !195, file: !13, line: 188, type: !4)
!208 = !DILocation(line: 189, column: 15, scope: !195)
!209 = !DILocation(line: 188, column: 27, scope: !195)
!210 = !DILocation(line: 188, column: 34, scope: !195)
!211 = !DILocation(line: 188, column: 48, scope: !195)
!212 = !DILocation(line: 189, column: 5, scope: !195)
!213 = !DILocation(line: 189, column: 22, scope: !195)
!214 = !DILocalVariable(name: "h", scope: !195, file: !13, line: 189, type: !19)
!215 = !DILocation(line: 190, column: 5, scope: !195)
!216 = !DILocation(line: 190, column: 9, scope: !195)
!217 = !DILocation(line: 190, column: 15, scope: !195)
!218 = !DILocation(line: 190, column: 20, scope: !195)
!219 = !DILocation(line: 190, column: 26, scope: !195)
!220 = !DILocation(line: 190, column: 31, scope: !195)
!221 = !DILocation(line: 190, column: 36, scope: !195)
!222 = !DILocation(line: 190, column: 42, scope: !195)
!223 = !DILocation(line: 191, column: 7, scope: !195)
!224 = !DILocation(line: 191, column: 14, scope: !195)
!225 = !DILocation(line: 191, column: 20, scope: !195)
!226 = !DILocation(line: 192, column: 7, scope: !195)
!227 = !DILocation(line: 188, column: 40, scope: !195)
!228 = !DILocation(line: 195, column: 3, scope: !195)
!229 = !DILocation(line: 195, column: 10, scope: !195)
!230 = !DILocation(line: 195, column: 16, scope: !195)
!231 = !DILocation(line: 195, column: 33, scope: !195)
!232 = !DILocation(line: 195, column: 39, scope: !195)
!233 = !DILocation(line: 195, column: 55, scope: !195)
!234 = !DILocation(line: 195, column: 58, scope: !195)
!235 = !DILocation(line: 196, column: 5, scope: !195)
!236 = !{!23, !23, !4, !4}
!237 = !DISubroutineType(types: !236)
!238 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 207, type: !237, scopeLine: 207, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!239 = !DILocation(line: 207, column: 1, scope: !238)
!240 = !DILocalVariable(name: "slots", arg: 1, scope: !238, file: !13, line: 207, type: !23)
!241 = !DILocalVariable(name: "live", arg: 2, scope: !238, file: !13, line: 207, type: !4)
!242 = !DILocalVariable(name: "used", arg: 3, scope: !238, file: !13, line: 207, type: !4)
!243 = !DILocation(line: 208, column: 3, scope: !238)
!244 = !DILocation(line: 208, column: 7, scope: !238)
!245 = !DILocation(line: 208, column: 13, scope: !238)
!246 = !DILocation(line: 208, column: 21, scope: !238)
!247 = !DILocation(line: 208, column: 25, scope: !238)
!248 = !DILocation(line: 208, column: 31, scope: !238)
!249 = !DILocation(line: 208, column: 38, scope: !238)
!250 = !DILocation(line: 209, column: 5, scope: !238)
!251 = !DILocation(line: 209, column: 16, scope: !238)
!252 = !DILocation(line: 210, column: 5, scope: !238)
!253 = !DILocation(line: 210, column: 12, scope: !238)
!254 = !DILocation(line: 212, column: 3, scope: !238)
!255 = !DILocation(line: 212, column: 13, scope: !238)
!256 = !DILocation(line: 212, column: 19, scope: !238)
!257 = !DILocalVariable(name: "n", scope: !238, file: !13, line: 212, type: !4)
!258 = !DILocation(line: 213, column: 3, scope: !238)
!259 = !DILocation(line: 213, column: 7, scope: !238)
!260 = !DILocation(line: 213, column: 12, scope: !238)
!261 = !DILocation(line: 213, column: 17, scope: !238)
!262 = !DILocation(line: 213, column: 21, scope: !238)
!263 = !DILocation(line: 213, column: 28, scope: !238)
!264 = !DILocation(line: 215, column: 5, scope: !238)
!265 = !DILocation(line: 215, column: 12, scope: !238)
!266 = !DILocation(line: 215, column: 27, scope: !238)
!267 = !DILocation(line: 215, column: 33, scope: !238)
!268 = !DILocation(line: 215, column: 37, scope: !238)
!269 = !{!166, !164, i64 8}
!270 = !DILocation(line: 217, column: 3, scope: !238)
!271 = !DILocation(line: 217, column: 14, scope: !238)
!272 = !DILocation(line: 217, column: 21, scope: !238)
!273 = !DILocation(line: 218, column: 3, scope: !238)
!274 = !DILocation(line: 218, column: 14, scope: !238)
!275 = !DILocation(line: 219, column: 3, scope: !238)
!276 = !DILocation(line: 219, column: 10, scope: !238)
!277 = !{null, !23, !4}
!278 = !DISubroutineType(types: !277)
!279 = distinct !DISubprogram(name: "widenSlots", linkageName: "nish.widenSlots", scope: !13, file: !13, line: 231, type: !278, scopeLine: 231, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!280 = !DILocation(line: 231, column: 1, scope: !279)
!281 = !DILocalVariable(name: "slots", arg: 1, scope: !279, file: !13, line: 231, type: !23)
!282 = !DILocalVariable(name: "times", arg: 2, scope: !279, file: !13, line: 231, type: !4)
!283 = !DILocation(line: 232, column: 3, scope: !279)
!284 = !DILocation(line: 232, column: 13, scope: !279)
!285 = !DILocation(line: 232, column: 19, scope: !279)
!286 = !DILocalVariable(name: "n", scope: !279, file: !13, line: 232, type: !4)
!287 = !DILocation(line: 233, column: 3, scope: !279)
!288 = !DILocation(line: 233, column: 21, scope: !279)
!289 = !DILocalVariable(name: "k", scope: !279, file: !13, line: 233, type: !4)
!290 = !DILocation(line: 233, column: 24, scope: !279)
!291 = !DILocation(line: 233, column: 28, scope: !279)
!292 = !DILocation(line: 233, column: 40, scope: !279)
!293 = !DILocation(line: 234, column: 5, scope: !279)
!294 = !DILocation(line: 234, column: 23, scope: !279)
!295 = !DILocalVariable(name: "i", scope: !279, file: !13, line: 234, type: !4)
!296 = !DILocation(line: 234, column: 26, scope: !279)
!297 = !DILocation(line: 234, column: 30, scope: !279)
!298 = !DILocation(line: 234, column: 38, scope: !279)
!299 = !DILocation(line: 235, column: 7, scope: !279)
!300 = !DILocation(line: 235, column: 18, scope: !279)
!301 = !DILocation(line: 234, column: 33, scope: !279)
!302 = !DILocation(line: 233, column: 35, scope: !279)
!303 = !{null, !23, !23}
!304 = !DISubroutineType(types: !303)
!305 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 245, type: !304, scopeLine: 245, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!306 = !DILocation(line: 245, column: 1, scope: !305)
!307 = !DILocalVariable(name: "slots", arg: 1, scope: !305, file: !13, line: 245, type: !23)
!308 = !DILocalVariable(name: "hashes", arg: 2, scope: !305, file: !13, line: 245, type: !23)
!309 = !DILocation(line: 246, column: 3, scope: !305)
!310 = !DILocation(line: 246, column: 16, scope: !305)
!311 = !DILocation(line: 246, column: 22, scope: !305)
!312 = !DILocation(line: 246, column: 38, scope: !305)
!313 = !DILocalVariable(name: "mask", scope: !305, file: !13, line: 246, type: !4)
!314 = !DILocation(line: 247, column: 3, scope: !305)
!315 = !DILocation(line: 247, column: 21, scope: !305)
!316 = !DILocalVariable(name: "i", scope: !305, file: !13, line: 247, type: !4)
!317 = !DILocation(line: 247, column: 34, scope: !305)
!318 = !DILocation(line: 247, column: 24, scope: !305)
!319 = !DILocation(line: 247, column: 28, scope: !305)
!320 = !DILocation(line: 247, column: 55, scope: !305)
!321 = !DILocation(line: 248, column: 5, scope: !305)
!322 = !DILocation(line: 248, column: 15, scope: !305)
!323 = !DILocation(line: 248, column: 22, scope: !305)
!324 = !DILocalVariable(name: "h", scope: !305, file: !13, line: 248, type: !19)
!325 = !DILocation(line: 249, column: 5, scope: !305)
!326 = !DILocation(line: 249, column: 9, scope: !305)
!327 = !DILocation(line: 249, column: 15, scope: !305)
!328 = !DILocation(line: 249, column: 18, scope: !305)
!329 = !DILocation(line: 250, column: 7, scope: !305)
!330 = !DILocation(line: 250, column: 17, scope: !305)
!331 = !DILocation(line: 250, column: 24, scope: !305)
!332 = !DILocation(line: 250, column: 30, scope: !305)
!333 = !DILocation(line: 250, column: 33, scope: !305)
!334 = !DILocation(line: 247, column: 50, scope: !305)
!335 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 276, type: !194, scopeLine: 276, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!336 = !DILocation(line: 276, column: 1, scope: !335)
!337 = !DILocalVariable(name: "slots", arg: 1, scope: !335, file: !13, line: 276, type: !23)
!338 = !DILocation(line: 277, column: 3, scope: !335)
!339 = !DILocation(line: 277, column: 21, scope: !335)
!340 = !DILocalVariable(name: "i", scope: !335, file: !13, line: 277, type: !4)
!341 = !DILocation(line: 277, column: 34, scope: !335)
!342 = !DILocation(line: 277, column: 24, scope: !335)
!343 = !DILocation(line: 277, column: 28, scope: !335)
!344 = !DILocation(line: 277, column: 54, scope: !335)
!345 = !DILocation(line: 278, column: 5, scope: !335)
!346 = !DILocation(line: 278, column: 11, scope: !335)
!347 = !DILocation(line: 278, column: 16, scope: !335)
!348 = !DILocation(line: 277, column: 49, scope: !335)
!349 = !{!4, !23, !4}
!350 = !DISubroutineType(types: !349)
!351 = distinct !DISubprogram(name: "nextLive", linkageName: "nish.nextLive", scope: !13, file: !13, line: 289, type: !350, scopeLine: 289, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!352 = !DILocation(line: 289, column: 1, scope: !351)
!353 = !DILocalVariable(name: "hashes", arg: 1, scope: !351, file: !13, line: 289, type: !23)
!354 = !DILocalVariable(name: "from", arg: 2, scope: !351, file: !13, line: 289, type: !4)
!355 = !DILocation(line: 290, column: 3, scope: !351)
!356 = !DILocation(line: 290, column: 21, scope: !351)
!357 = !DILocalVariable(name: "i", scope: !351, file: !13, line: 290, type: !4)
!358 = !DILocation(line: 290, column: 47, scope: !351)
!359 = !DILocation(line: 290, column: 27, scope: !351)
!360 = !DILocation(line: 290, column: 32, scope: !351)
!361 = !DILocation(line: 290, column: 37, scope: !351)
!362 = !DILocation(line: 290, column: 41, scope: !351)
!363 = !DILocation(line: 290, column: 68, scope: !351)
!364 = !DILocation(line: 291, column: 5, scope: !351)
!365 = !DILocation(line: 291, column: 9, scope: !351)
!366 = !DILocation(line: 291, column: 16, scope: !351)
!367 = !DILocation(line: 291, column: 23, scope: !351)
!368 = !DILocation(line: 291, column: 26, scope: !351)
!369 = !DILocation(line: 292, column: 7, scope: !351)
!370 = !DILocation(line: 292, column: 14, scope: !351)
!371 = !DILocation(line: 290, column: 63, scope: !351)
!372 = !DILocation(line: 295, column: 3, scope: !351)
!373 = !DILocation(line: 295, column: 10, scope: !351)
!374 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!375 = !{!374, !23, !4, !4, !23}
!376 = !DISubroutineType(types: !375)
!377 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 312, type: !376, scopeLine: 312, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!378 = !DILocation(line: 312, column: 1, scope: !377)
!379 = !DILocalVariable(name: "slots", arg: 1, scope: !377, file: !13, line: 312, type: !23)
!380 = !DILocalVariable(name: "mask", arg: 2, scope: !377, file: !13, line: 312, type: !4)
!381 = !DILocalVariable(name: "bucket", arg: 3, scope: !377, file: !13, line: 312, type: !4)
!382 = !DILocalVariable(name: "hashes", arg: 4, scope: !377, file: !13, line: 312, type: !23)
!383 = !DILocation(line: 313, column: 3, scope: !377)
!384 = !DILocation(line: 313, column: 16, scope: !377)
!385 = !DILocation(line: 313, column: 22, scope: !377)
!386 = !DILocalVariable(name: "used", scope: !377, file: !13, line: 313, type: !4)
!387 = !DILocation(line: 314, column: 3, scope: !377)
!388 = !DILocation(line: 314, column: 16, scope: !377)
!389 = !DILocation(line: 314, column: 22, scope: !377)
!390 = !DILocalVariable(name: "size", scope: !377, file: !13, line: 314, type: !4)
!391 = !DILocation(line: 315, column: 3, scope: !377)
!392 = !DILocation(line: 315, column: 7, scope: !377)
!393 = !DILocation(line: 315, column: 13, scope: !377)
!394 = !DILocation(line: 315, column: 21, scope: !377)
!395 = !DILocation(line: 315, column: 25, scope: !377)
!396 = !DILocation(line: 315, column: 31, scope: !377)
!397 = !DILocation(line: 315, column: 39, scope: !377)
!398 = !DILocation(line: 315, column: 44, scope: !377)
!399 = !DILocation(line: 315, column: 53, scope: !377)
!400 = !DILocation(line: 315, column: 58, scope: !377)
!401 = !DILocation(line: 315, column: 68, scope: !377)
!402 = !DILocation(line: 315, column: 74, scope: !377)
!403 = !DILocation(line: 316, column: 5, scope: !377)
!404 = !DILocation(line: 316, column: 12, scope: !377)
!405 = !DILocation(line: 318, column: 3, scope: !377)
!406 = !DILocation(line: 318, column: 7, scope: !377)
!407 = !DILocation(line: 318, column: 14, scope: !377)
!408 = !DILocation(line: 318, column: 17, scope: !377)
!409 = !DILocation(line: 319, column: 5, scope: !377)
!410 = !DILocation(line: 319, column: 11, scope: !377)
!411 = !DILocation(line: 319, column: 21, scope: !377)
!412 = !DILocation(line: 319, column: 30, scope: !377)
!413 = !DILocation(line: 319, column: 37, scope: !377)
!414 = !DILocation(line: 319, column: 44, scope: !377)
!415 = !DILocation(line: 319, column: 48, scope: !377)
!416 = !DILocation(line: 319, column: 54, scope: !377)
!417 = !DILocation(line: 319, column: 61, scope: !377)
!418 = !DILocation(line: 321, column: 3, scope: !377)
!419 = !DILocation(line: 321, column: 10, scope: !377)
!420 = !{null, !12}
!421 = !DISubroutineType(types: !420)
!422 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 351, type: !421, scopeLine: 351, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!423 = !DILocation(line: 351, column: 3, scope: !422)
!424 = !DILocalVariable(name: "this", arg: 1, scope: !422, file: !13, line: 351, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!425 = !{!"i32", !163, i64 0}
!426 = !{!"ptr", !163, i64 0}
!427 = !{!"Map$str$i32", !425, i64 0, !426, i64 8, !425, i64 16, !425, i64 20, !426, i64 24, !426, i64 32, !426, i64 40, !425, i64 48}
!428 = !{!427, !425, i64 0}
!429 = !{!427, !425, i64 16}
!430 = !{!427, !425, i64 20}
!431 = !{!427, !425, i64 48}
!432 = !DILocation(line: 352, column: 5, scope: !422)
!433 = !DILocation(line: 352, column: 18, scope: !422)
!434 = !{!427, !426, i64 8}
!435 = !DILocation(line: 353, column: 5, scope: !422)
!436 = !DILocation(line: 353, column: 22, scope: !422)
!437 = !{!427, !426, i64 24}
!438 = !DILocation(line: 354, column: 5, scope: !422)
!439 = !DILocation(line: 354, column: 24, scope: !422)
!440 = !{!427, !426, i64 32}
!441 = !DILocation(line: 355, column: 5, scope: !422)
!442 = !DILocation(line: 355, column: 24, scope: !422)
!443 = !{!427, !426, i64 40}
!444 = !{!16, !12, !31}
!445 = !DISubroutineType(types: !444)
!446 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 365, type: !445, scopeLine: 365, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!447 = !DILocation(line: 365, column: 3, scope: !446)
!448 = !DILocalVariable(name: "this", arg: 1, scope: !446, file: !13, line: 365, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!449 = !DILocalVariable(name: "key", arg: 2, scope: !446, file: !13, line: 365, type: !31)
!450 = !DILocation(line: 366, column: 5, scope: !446)
!451 = !DILocation(line: 366, column: 12, scope: !446)
!452 = !DILocation(line: 366, column: 23, scope: !446)
!453 = !DILocation(line: 366, column: 35, scope: !446)
!454 = !DILocation(line: 366, column: 46, scope: !446)
!455 = !DILocation(line: 366, column: 64, scope: !446)
!456 = !DILocation(line: 366, column: 80, scope: !446)
!457 = !{!12, !12, !31, !4}
!458 = !DISubroutineType(types: !457)
!459 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 388, type: !458, scopeLine: 388, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!460 = !DILocation(line: 388, column: 3, scope: !459)
!461 = !DILocalVariable(name: "this", arg: 1, scope: !459, file: !13, line: 388, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!462 = !DILocalVariable(name: "key", arg: 2, scope: !459, file: !13, line: 388, type: !31)
!463 = !DILocalVariable(name: "value", arg: 3, scope: !459, file: !13, line: 388, type: !4)
!464 = !DILocation(line: 389, column: 5, scope: !459)
!465 = !DILocation(line: 389, column: 19, scope: !459)
!466 = !DILocation(line: 389, column: 30, scope: !459)
!467 = !DILocalVariable(name: "found", scope: !459, file: !13, line: 389, type: !16)
!468 = !DILocation(line: 390, column: 5, scope: !459)
!469 = !DILocation(line: 390, column: 9, scope: !459)
!470 = !DILocation(line: 390, column: 18, scope: !459)
!471 = !DILocation(line: 390, column: 21, scope: !459)
!472 = !DILocation(line: 391, column: 7, scope: !459)
!473 = !DILocation(line: 391, column: 23, scope: !459)
!474 = !DILocation(line: 391, column: 29, scope: !459)
!475 = !DILocation(line: 391, column: 37, scope: !459)
!476 = !DILocation(line: 392, column: 12, scope: !459)
!477 = !DILocation(line: 393, column: 7, scope: !459)
!478 = !DILocation(line: 393, column: 21, scope: !459)
!479 = !DILocation(line: 393, column: 28, scope: !459)
!480 = !DILocation(line: 393, column: 33, scope: !459)
!481 = !DILocation(line: 395, column: 5, scope: !459)
!482 = !DILocation(line: 395, column: 12, scope: !459)
!483 = distinct !DISubprogram(name: "Map<string, i32>.walkOpen", linkageName: "nish.Map$str$i32.walkOpen", scope: !13, file: !13, line: 441, type: !421, scopeLine: 441, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!484 = !DILocation(line: 441, column: 3, scope: !483)
!485 = !DILocalVariable(name: "this", arg: 1, scope: !483, file: !13, line: 441, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!486 = !DILocation(line: 442, column: 5, scope: !483)
!487 = !DILocation(line: 442, column: 18, scope: !483)
!488 = !DILocation(line: 442, column: 31, scope: !483)
!489 = !{!4, !12, !4}
!490 = !DISubroutineType(types: !489)
!491 = distinct !DISubprogram(name: "Map<string, i32>.walkNext", linkageName: "nish.Map$str$i32.walkNext", scope: !13, file: !13, line: 446, type: !490, scopeLine: 446, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!492 = !DILocation(line: 446, column: 3, scope: !491)
!493 = !DILocalVariable(name: "this", arg: 1, scope: !491, file: !13, line: 446, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!494 = !DILocalVariable(name: "from", arg: 2, scope: !491, file: !13, line: 446, type: !4)
!495 = !DILocation(line: 447, column: 5, scope: !491)
!496 = !DILocation(line: 447, column: 12, scope: !491)
!497 = !DILocation(line: 447, column: 21, scope: !491)
!498 = !DILocation(line: 447, column: 39, scope: !491)
!499 = distinct !DISubprogram(name: "Map<string, i32>.walkClose", linkageName: "nish.Map$str$i32.walkClose", scope: !13, file: !13, line: 451, type: !421, scopeLine: 451, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!500 = !DILocation(line: 451, column: 3, scope: !499)
!501 = !DILocalVariable(name: "this", arg: 1, scope: !499, file: !13, line: 451, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!502 = !DILocation(line: 452, column: 5, scope: !499)
!503 = !DILocation(line: 452, column: 18, scope: !499)
!504 = !DILocation(line: 452, column: 31, scope: !499)
!505 = !{!31, !12, !4, !31}
!506 = !DISubroutineType(types: !505)
!507 = distinct !DISubprogram(name: "Map<string, i32>.keyAt", linkageName: "nish.Map$str$i32.keyAt", scope: !13, file: !13, line: 461, type: !506, scopeLine: 461, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!508 = !DILocation(line: 461, column: 3, scope: !507)
!509 = !DILocalVariable(name: "this", arg: 1, scope: !507, file: !13, line: 461, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!510 = !DILocalVariable(name: "index", arg: 2, scope: !507, file: !13, line: 461, type: !4)
!511 = !DILocalVariable(name: "none", arg: 3, scope: !507, file: !13, line: 461, type: !31)
!512 = !DILocation(line: 462, column: 5, scope: !507)
!513 = !DILocation(line: 462, column: 9, scope: !507)
!514 = !DILocation(line: 462, column: 18, scope: !507)
!515 = !DILocation(line: 462, column: 23, scope: !507)
!516 = !DILocation(line: 462, column: 31, scope: !507)
!517 = !DILocation(line: 462, column: 37, scope: !507)
!518 = !DILocation(line: 462, column: 61, scope: !507)
!519 = !DILocation(line: 463, column: 7, scope: !507)
!520 = !DILocation(line: 463, column: 14, scope: !507)
!521 = !DILocation(line: 463, column: 29, scope: !507)
!522 = !{!"element ptr", !163, i64 0}
!523 = !{!522, !522, i64 0}
!524 = !DILocation(line: 465, column: 5, scope: !507)
!525 = !DILocation(line: 465, column: 12, scope: !507)
!526 = !{!4, !12, !4, !4}
!527 = !DISubroutineType(types: !526)
!528 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 474, type: !527, scopeLine: 474, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!529 = !DILocation(line: 474, column: 3, scope: !528)
!530 = !DILocalVariable(name: "this", arg: 1, scope: !528, file: !13, line: 474, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!531 = !DILocalVariable(name: "index", arg: 2, scope: !528, file: !13, line: 474, type: !4)
!532 = !DILocalVariable(name: "none", arg: 3, scope: !528, file: !13, line: 474, type: !4)
!533 = !DILocation(line: 475, column: 5, scope: !528)
!534 = !DILocation(line: 475, column: 9, scope: !528)
!535 = !DILocation(line: 475, column: 18, scope: !528)
!536 = !DILocation(line: 475, column: 23, scope: !528)
!537 = !DILocation(line: 475, column: 31, scope: !528)
!538 = !DILocation(line: 475, column: 37, scope: !528)
!539 = !DILocation(line: 475, column: 63, scope: !528)
!540 = !DILocation(line: 476, column: 7, scope: !528)
!541 = !DILocation(line: 476, column: 14, scope: !528)
!542 = !DILocation(line: 476, column: 31, scope: !528)
!543 = !DILocation(line: 478, column: 5, scope: !528)
!544 = !DILocation(line: 478, column: 12, scope: !528)
!545 = !{null, !12, !4, !4}
!546 = !DISubroutineType(types: !545)
!547 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 487, type: !546, scopeLine: 487, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!548 = !DILocation(line: 487, column: 3, scope: !547)
!549 = !DILocalVariable(name: "this", arg: 1, scope: !547, file: !13, line: 487, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!550 = !DILocalVariable(name: "index", arg: 2, scope: !547, file: !13, line: 487, type: !4)
!551 = !DILocalVariable(name: "value", arg: 3, scope: !547, file: !13, line: 487, type: !4)
!552 = !DILocation(line: 488, column: 5, scope: !547)
!553 = !DILocation(line: 488, column: 9, scope: !547)
!554 = !DILocation(line: 488, column: 18, scope: !547)
!555 = !DILocation(line: 488, column: 23, scope: !547)
!556 = !DILocation(line: 488, column: 31, scope: !547)
!557 = !DILocation(line: 488, column: 37, scope: !547)
!558 = !DILocation(line: 488, column: 63, scope: !547)
!559 = !DILocation(line: 489, column: 7, scope: !547)
!560 = !DILocation(line: 489, column: 24, scope: !547)
!561 = !DILocation(line: 489, column: 33, scope: !547)
!562 = !{null, !12, !16, !31, !4}
!563 = !DISubroutineType(types: !562)
!564 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 500, type: !563, scopeLine: 500, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!565 = !DILocation(line: 500, column: 3, scope: !564)
!566 = !DILocalVariable(name: "this", arg: 1, scope: !564, file: !13, line: 500, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!567 = !DILocalVariable(name: "absent", arg: 2, scope: !564, file: !13, line: 500, type: !16)
!568 = !DILocalVariable(name: "key", arg: 3, scope: !564, file: !13, line: 500, type: !31)
!569 = !DILocalVariable(name: "value", arg: 4, scope: !564, file: !13, line: 500, type: !4)
!570 = !DILocation(line: 501, column: 5, scope: !564)
!571 = !DILocation(line: 501, column: 20, scope: !564)
!572 = !DILocation(line: 501, column: 25, scope: !564)
!573 = !DILocalVariable(name: "packed", scope: !564, file: !13, line: 501, type: !16)
!574 = !DILocation(line: 502, column: 5, scope: !564)
!575 = !DILocation(line: 502, column: 25, scope: !564)
!576 = !DILocation(line: 503, column: 5, scope: !564)
!577 = !DILocation(line: 503, column: 27, scope: !564)
!578 = !DILocation(line: 504, column: 5, scope: !564)
!579 = !DILocation(line: 504, column: 27, scope: !564)
!580 = !DILocation(line: 504, column: 33, scope: !564)
!581 = !DILocation(line: 505, column: 5, scope: !564)
!582 = !DILocation(line: 508, column: 5, scope: !564)
!583 = !DILocation(line: 508, column: 9, scope: !564)
!584 = !DILocation(line: 508, column: 10, scope: !564)
!585 = !DILocation(line: 508, column: 23, scope: !564)
!586 = !DILocation(line: 508, column: 35, scope: !564)
!587 = !DILocation(line: 508, column: 46, scope: !564)
!588 = !DILocation(line: 508, column: 52, scope: !564)
!589 = !DILocation(line: 508, column: 67, scope: !564)
!590 = !DILocation(line: 508, column: 86, scope: !564)
!591 = !DILocation(line: 509, column: 7, scope: !564)
!592 = distinct !DISubprogram(name: "Map<string, i32>.addOne", linkageName: "nish.Map$str$i32.addOne", scope: !13, file: !13, line: 518, type: !421, scopeLine: 518, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!593 = !DILocation(line: 518, column: 3, scope: !592)
!594 = !DILocalVariable(name: "this", arg: 1, scope: !592, file: !13, line: 518, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!595 = !DILocation(line: 519, column: 5, scope: !592)
!596 = !DILocation(line: 519, column: 18, scope: !592)
!597 = !DILocalVariable(name: "live", scope: !592, file: !13, line: 519, type: !4)
!598 = !DILocation(line: 520, column: 5, scope: !592)
!599 = !DILocation(line: 520, column: 9, scope: !592)
!600 = !DILocation(line: 520, column: 16, scope: !592)
!601 = !DILocation(line: 520, column: 28, scope: !592)
!602 = !DILocation(line: 521, column: 7, scope: !592)
!603 = !DILocation(line: 521, column: 19, scope: !592)
!604 = !DILocation(line: 521, column: 26, scope: !592)
!605 = !DILocation(line: 523, column: 5, scope: !592)
!606 = !DILocation(line: 523, column: 18, scope: !592)
!607 = !DILocalVariable(name: "size", scope: !592, file: !13, line: 523, type: !4)
!608 = !DILocation(line: 524, column: 5, scope: !592)
!609 = !DILocation(line: 524, column: 9, scope: !592)
!610 = !DILocation(line: 524, column: 16, scope: !592)
!611 = !DILocation(line: 524, column: 28, scope: !592)
!612 = !DILocation(line: 525, column: 7, scope: !592)
!613 = !DILocation(line: 525, column: 19, scope: !592)
!614 = !DILocation(line: 525, column: 26, scope: !592)
!615 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 546, type: !421, scopeLine: 546, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!616 = !DILocation(line: 546, column: 3, scope: !615)
!617 = !DILocalVariable(name: "this", arg: 1, scope: !615, file: !13, line: 546, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!618 = !DILocation(line: 547, column: 5, scope: !615)
!619 = !DILocation(line: 547, column: 18, scope: !615)
!620 = !DILocation(line: 547, column: 24, scope: !615)
!621 = !DILocalVariable(name: "used", scope: !615, file: !13, line: 547, type: !4)
!622 = !DILocation(line: 548, column: 5, scope: !615)
!623 = !DILocation(line: 548, column: 21, scope: !615)
!624 = !DILocation(line: 548, column: 34, scope: !615)
!625 = !DILocalVariable(name: "walking", scope: !615, file: !13, line: 548, type: !374)
!626 = !DILocation(line: 549, column: 5, scope: !615)
!627 = !DILocation(line: 549, column: 19, scope: !615)
!628 = !DILocation(line: 549, column: 32, scope: !615)
!629 = !DILocation(line: 549, column: 44, scope: !615)
!630 = !DILocation(line: 549, column: 54, scope: !615)
!631 = !DILocation(line: 549, column: 61, scope: !615)
!632 = !DILocation(line: 549, column: 72, scope: !615)
!633 = !DILocalVariable(name: "slots", scope: !615, file: !13, line: 549, type: !23)
!634 = !DILocation(line: 550, column: 5, scope: !615)
!635 = !DILocation(line: 550, column: 9, scope: !615)
!636 = !DILocation(line: 550, column: 10, scope: !615)
!637 = !DILocation(line: 550, column: 21, scope: !615)
!638 = !DILocation(line: 550, column: 33, scope: !615)
!639 = !DILocation(line: 550, column: 39, scope: !615)
!640 = !DILocation(line: 551, column: 7, scope: !615)
!641 = !DILocation(line: 551, column: 22, scope: !615)
!642 = !DILocation(line: 551, column: 38, scope: !615)
!643 = !DILocation(line: 552, column: 7, scope: !615)
!644 = !DILocation(line: 552, column: 22, scope: !615)
!645 = !DILocation(line: 552, column: 40, scope: !615)
!646 = !DILocation(line: 553, column: 7, scope: !615)
!647 = !DILocation(line: 553, column: 21, scope: !615)
!648 = !DILocation(line: 555, column: 5, scope: !615)
!649 = !DILocation(line: 555, column: 18, scope: !615)
!650 = !DILocation(line: 556, column: 5, scope: !615)
!651 = !DILocation(line: 556, column: 17, scope: !615)
!652 = !DILocation(line: 556, column: 23, scope: !615)
!653 = !DILocation(line: 556, column: 39, scope: !615)
!654 = !DILocation(line: 557, column: 5, scope: !615)
!655 = !DILocation(line: 557, column: 12, scope: !615)
!656 = !DILocation(line: 557, column: 19, scope: !615)
!657 = !{!16, !23, !4, !23, !35, !31}
!658 = !DISubroutineType(types: !657)
!659 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 113, type: !658, scopeLine: 113, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!660 = !DILocation(line: 113, column: 1, scope: !659)
!661 = !DILocalVariable(name: "slots", arg: 1, scope: !659, file: !13, line: 113, type: !23)
!662 = !DILocalVariable(name: "mask", arg: 2, scope: !659, file: !13, line: 113, type: !4)
!663 = !DILocalVariable(name: "hashes", arg: 3, scope: !659, file: !13, line: 113, type: !23)
!664 = !DILocalVariable(name: "keys", arg: 4, scope: !659, file: !13, line: 113, type: !35)
!665 = !DILocalVariable(name: "key", arg: 5, scope: !659, file: !13, line: 113, type: !31)
!666 = !DILocation(line: 114, column: 3, scope: !659)
!667 = !DILocation(line: 114, column: 13, scope: !659)
!668 = !DILocation(line: 114, column: 21, scope: !659)
!669 = !DILocalVariable(name: "h", scope: !659, file: !13, line: 114, type: !19)
!670 = !DILocation(line: 115, column: 3, scope: !659)
!671 = !DILocation(line: 115, column: 15, scope: !659)
!672 = !DILocation(line: 115, column: 21, scope: !659)
!673 = !DILocalVariable(name: "low", scope: !659, file: !13, line: 115, type: !19)
!674 = !DILocation(line: 116, column: 3, scope: !659)
!675 = !DILocation(line: 116, column: 23, scope: !659)
!676 = !DILocation(line: 116, column: 27, scope: !659)
!677 = !DILocation(line: 116, column: 28, scope: !659)
!678 = !DILocalVariable(name: "fingerprint", scope: !659, file: !13, line: 116, type: !19)
!679 = !DILocation(line: 117, column: 3, scope: !659)
!680 = !DILocation(line: 117, column: 16, scope: !659)
!681 = !DILocation(line: 117, column: 22, scope: !659)
!682 = !DILocation(line: 117, column: 33, scope: !659)
!683 = !DILocation(line: 117, column: 36, scope: !659)
!684 = !DILocalVariable(name: "bucket", scope: !659, file: !13, line: 117, type: !19)
!685 = !DILocation(line: 124, column: 3, scope: !659)
!686 = !DILocation(line: 124, column: 11, scope: !659)
!687 = !DILocation(line: 124, column: 17, scope: !659)
!688 = !DILocalVariable(name: "b", scope: !659, file: !13, line: 124, type: !4)
!689 = !DILocation(line: 125, column: 3, scope: !659)
!690 = !DILocation(line: 125, column: 30, scope: !659)
!691 = !DILocation(line: 134, column: 20, scope: !659)
!692 = !DILocation(line: 136, column: 20, scope: !659)
!693 = !DILocation(line: 125, column: 10, scope: !659)
!694 = !DILocation(line: 125, column: 15, scope: !659)
!695 = !DILocation(line: 125, column: 20, scope: !659)
!696 = !DILocation(line: 125, column: 24, scope: !659)
!697 = !DILocation(line: 125, column: 45, scope: !659)
!698 = !DILocation(line: 126, column: 5, scope: !659)
!699 = !DILocation(line: 126, column: 18, scope: !659)
!700 = !DILocation(line: 126, column: 24, scope: !659)
!701 = !DILocalVariable(name: "word", scope: !659, file: !13, line: 126, type: !19)
!702 = !DILocation(line: 127, column: 5, scope: !659)
!703 = !DILocation(line: 127, column: 9, scope: !659)
!704 = !DILocation(line: 127, column: 18, scope: !659)
!705 = !DILocation(line: 127, column: 21, scope: !659)
!706 = !DILocation(line: 128, column: 7, scope: !659)
!707 = !DILocation(line: 128, column: 14, scope: !659)
!708 = !DILocation(line: 128, column: 23, scope: !659)
!709 = !DILocation(line: 128, column: 26, scope: !659)
!710 = !DILocation(line: 130, column: 5, scope: !659)
!711 = !DILocation(line: 130, column: 9, scope: !659)
!712 = !DILocation(line: 130, column: 10, scope: !659)
!713 = !DILocation(line: 130, column: 17, scope: !659)
!714 = !DILocation(line: 130, column: 18, scope: !659)
!715 = !DILocation(line: 130, column: 27, scope: !659)
!716 = !DILocation(line: 130, column: 40, scope: !659)
!717 = !DILocation(line: 131, column: 7, scope: !659)
!718 = !DILocation(line: 131, column: 18, scope: !659)
!719 = !DILocation(line: 131, column: 24, scope: !659)
!720 = !DILocation(line: 131, column: 25, scope: !659)
!721 = !DILocation(line: 131, column: 32, scope: !659)
!722 = !DILocation(line: 131, column: 39, scope: !659)
!723 = !DILocalVariable(name: "at", scope: !659, file: !13, line: 131, type: !4)
!724 = !DILocation(line: 132, column: 7, scope: !659)
!725 = !DILocation(line: 133, column: 9, scope: !659)
!726 = !DILocation(line: 133, column: 15, scope: !659)
!727 = !DILocation(line: 134, column: 9, scope: !659)
!728 = !DILocation(line: 134, column: 14, scope: !659)
!729 = !DILocation(line: 135, column: 9, scope: !659)
!730 = !DILocation(line: 135, column: 16, scope: !659)
!731 = !DILocation(line: 135, column: 24, scope: !659)
!732 = !DILocation(line: 136, column: 9, scope: !659)
!733 = !DILocation(line: 136, column: 14, scope: !659)
!734 = !DILocation(line: 137, column: 9, scope: !659)
!735 = !DILocation(line: 137, column: 17, scope: !659)
!736 = !DILocation(line: 137, column: 22, scope: !659)
!737 = !DILocation(line: 137, column: 27, scope: !659)
!738 = !DILocation(line: 138, column: 9, scope: !659)
!739 = !DILocation(line: 139, column: 9, scope: !659)
!740 = !DILocation(line: 139, column: 16, scope: !659)
!741 = !DILocation(line: 139, column: 24, scope: !659)
!742 = !DILocation(line: 139, column: 27, scope: !659)
!743 = !DILocation(line: 142, column: 5, scope: !659)
!744 = !DILocation(line: 142, column: 14, scope: !659)
!745 = !DILocation(line: 142, column: 15, scope: !659)
!746 = !DILocation(line: 142, column: 24, scope: !659)
!747 = !DILocation(line: 142, column: 29, scope: !659)
!748 = !DILocation(line: 143, column: 5, scope: !659)
!749 = !DILocation(line: 143, column: 9, scope: !659)
!750 = !DILocation(line: 143, column: 15, scope: !659)
!751 = !DILocation(line: 145, column: 3, scope: !659)
!752 = !DILocation(line: 145, column: 10, scope: !659)
!753 = !DILocation(line: 145, column: 19, scope: !659)
!754 = !DILocation(line: 145, column: 25, scope: !659)
!755 = !DILocation(line: 145, column: 40, scope: !659)
!756 = !{null, !35, !23}
!757 = !DISubroutineType(types: !756)
!758 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 170, type: !757, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!759 = !DILocation(line: 170, column: 1, scope: !758)
!760 = !DILocalVariable(name: "items", arg: 1, scope: !758, file: !13, line: 170, type: !35)
!761 = !DILocalVariable(name: "hashes", arg: 2, scope: !758, file: !13, line: 170, type: !23)
!762 = !DILocation(line: 171, column: 3, scope: !758)
!763 = !DILocation(line: 171, column: 16, scope: !758)
!764 = !DILocation(line: 171, column: 22, scope: !758)
!765 = !DILocalVariable(name: "used", scope: !758, file: !13, line: 171, type: !4)
!766 = !DILocation(line: 172, column: 3, scope: !758)
!767 = !DILocation(line: 172, column: 17, scope: !758)
!768 = !DILocalVariable(name: "to", scope: !758, file: !13, line: 172, type: !4)
!769 = !DILocation(line: 173, column: 3, scope: !758)
!770 = !DILocation(line: 173, column: 24, scope: !758)
!771 = !DILocalVariable(name: "from", scope: !758, file: !13, line: 173, type: !4)
!772 = !DILocation(line: 173, column: 55, scope: !758)
!773 = !DILocation(line: 174, column: 68, scope: !758)
!774 = !DILocation(line: 173, column: 27, scope: !758)
!775 = !DILocation(line: 173, column: 34, scope: !758)
!776 = !DILocation(line: 173, column: 42, scope: !758)
!777 = !DILocation(line: 173, column: 49, scope: !758)
!778 = !DILocation(line: 173, column: 79, scope: !758)
!779 = !DILocation(line: 174, column: 5, scope: !758)
!780 = !DILocation(line: 174, column: 9, scope: !758)
!781 = !DILocation(line: 174, column: 16, scope: !758)
!782 = !DILocation(line: 174, column: 26, scope: !758)
!783 = !DILocation(line: 174, column: 31, scope: !758)
!784 = !DILocation(line: 174, column: 37, scope: !758)
!785 = !DILocation(line: 174, column: 42, scope: !758)
!786 = !DILocation(line: 174, column: 47, scope: !758)
!787 = !DILocation(line: 174, column: 55, scope: !758)
!788 = !DILocation(line: 174, column: 62, scope: !758)
!789 = !DILocation(line: 174, column: 83, scope: !758)
!790 = !DILocation(line: 175, column: 7, scope: !758)
!791 = !DILocation(line: 175, column: 13, scope: !758)
!792 = !DILocation(line: 175, column: 19, scope: !758)
!793 = !DILocation(line: 175, column: 25, scope: !758)
!794 = !DILocation(line: 176, column: 7, scope: !758)
!795 = !DILocation(line: 173, column: 71, scope: !758)
!796 = !DILocation(line: 179, column: 3, scope: !758)
!797 = !DILocation(line: 179, column: 10, scope: !758)
!798 = !DILocation(line: 179, column: 16, scope: !758)
!799 = !DILocation(line: 179, column: 32, scope: !758)
!800 = !DILocation(line: 179, column: 38, scope: !758)
!801 = !DILocation(line: 179, column: 53, scope: !758)
!802 = !DILocation(line: 179, column: 56, scope: !758)
!803 = !DILocation(line: 180, column: 5, scope: !758)
!804 = !{null, !43, !23}
!805 = !DISubroutineType(types: !804)
!806 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 170, type: !805, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!807 = !DILocation(line: 170, column: 1, scope: !806)
!808 = !DILocalVariable(name: "items", arg: 1, scope: !806, file: !13, line: 170, type: !43)
!809 = !DILocalVariable(name: "hashes", arg: 2, scope: !806, file: !13, line: 170, type: !23)
!810 = !DILocation(line: 171, column: 3, scope: !806)
!811 = !DILocation(line: 171, column: 16, scope: !806)
!812 = !DILocation(line: 171, column: 22, scope: !806)
!813 = !DILocalVariable(name: "used", scope: !806, file: !13, line: 171, type: !4)
!814 = !DILocation(line: 172, column: 3, scope: !806)
!815 = !DILocation(line: 172, column: 17, scope: !806)
!816 = !DILocalVariable(name: "to", scope: !806, file: !13, line: 172, type: !4)
!817 = !DILocation(line: 173, column: 3, scope: !806)
!818 = !DILocation(line: 173, column: 24, scope: !806)
!819 = !DILocalVariable(name: "from", scope: !806, file: !13, line: 173, type: !4)
!820 = !DILocation(line: 173, column: 55, scope: !806)
!821 = !DILocation(line: 174, column: 68, scope: !806)
!822 = !DILocation(line: 173, column: 27, scope: !806)
!823 = !DILocation(line: 173, column: 34, scope: !806)
!824 = !DILocation(line: 173, column: 42, scope: !806)
!825 = !DILocation(line: 173, column: 49, scope: !806)
!826 = !DILocation(line: 173, column: 79, scope: !806)
!827 = !DILocation(line: 174, column: 5, scope: !806)
!828 = !DILocation(line: 174, column: 9, scope: !806)
!829 = !DILocation(line: 174, column: 16, scope: !806)
!830 = !DILocation(line: 174, column: 26, scope: !806)
!831 = !DILocation(line: 174, column: 31, scope: !806)
!832 = !DILocation(line: 174, column: 37, scope: !806)
!833 = !DILocation(line: 174, column: 42, scope: !806)
!834 = !DILocation(line: 174, column: 47, scope: !806)
!835 = !DILocation(line: 174, column: 55, scope: !806)
!836 = !DILocation(line: 174, column: 62, scope: !806)
!837 = !DILocation(line: 174, column: 83, scope: !806)
!838 = !DILocation(line: 175, column: 7, scope: !806)
!839 = !DILocation(line: 175, column: 13, scope: !806)
!840 = !DILocation(line: 175, column: 19, scope: !806)
!841 = !DILocation(line: 175, column: 25, scope: !806)
!842 = !DILocation(line: 176, column: 7, scope: !806)
!843 = !DILocation(line: 173, column: 71, scope: !806)
!844 = !DILocation(line: 179, column: 3, scope: !806)
!845 = !DILocation(line: 179, column: 10, scope: !806)
!846 = !DILocation(line: 179, column: 16, scope: !806)
!847 = !DILocation(line: 179, column: 32, scope: !806)
!848 = !DILocation(line: 179, column: 38, scope: !806)
!849 = !DILocation(line: 179, column: 53, scope: !806)
!850 = !DILocation(line: 179, column: 56, scope: !806)
!851 = !DILocation(line: 180, column: 5, scope: !806)
!852 = !{i32 8, !"cf-protection-branch", i32 1}
!853 = !{i32 8, !"cf-protection-return", i32 1}
!854 = !{i32 8, !"branch-target-enforcement", i32 1}
!855 = !{i32 8, !"sign-return-address", i32 1}
!856 = !{i32 4, !"probe-stack", !"inline-asm"}
