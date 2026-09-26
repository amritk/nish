%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_exit(i32 noundef) #6
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #7

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
  %9 = call i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* %5, i32 %7), !dbg !57
  store i8* %9, i8** %word.addr, align 8, !dbg !57
  %10 = load i32, i32* %sum.addr, align 4, !dbg !61
  %11 = load i8*, i8** %word.addr, align 8, !dbg !62
  %12 = bitcast i8* %11 to i64*, !dbg !62
  %13 = load i64, i64* %12, align 8, !dbg !62
  %14 = trunc i64 %13 to i32, !dbg !62
  %15 = add nsw i32 %10, %14, !dbg !61
  store i32 %15, i32* %sum.addr, align 4, !dbg !61
  br label %walk.inc, !dbg !57

walk.inc:
  %16 = add i32 %7, 1, !dbg !57
  %17 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %5, i32 %16), !dbg !57
  store i32 %17, i32* %walk.idx, align 4, !dbg !57
  br label %walk.cond, !dbg !57

walk.end:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %5), !dbg !57
  call void @llvm.dbg.declare(metadata i32* %count.addr, metadata !64, metadata !DIExpression()), !dbg !63
  %18 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !65
  call void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* %18), !dbg !63
  %19 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %18, i32 0), !dbg !63
  store i32 %19, i32* %walk.idx.1, align 4, !dbg !63
  br label %walk.cond.1, !dbg !63

walk.cond.1:
  %20 = load i32, i32* %walk.idx.1, align 4, !dbg !63
  %21 = icmp sge i32 %20, 0, !dbg !63
  br i1 %21, label %walk.body.1, label %walk.end.1, !dbg !63

walk.body.1:
  %22 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %18, i32 %20), !dbg !63
  store i32 %22, i32* %count.addr, align 4, !dbg !63
  %23 = load i32, i32* %sum.addr, align 4, !dbg !67
  %24 = load i32, i32* %count.addr, align 4, !dbg !68
  %25 = add nsw i32 %23, %24, !dbg !67
  store i32 %25, i32* %sum.addr, align 4, !dbg !67
  br label %walk.inc.1, !dbg !63

walk.inc.1:
  %26 = add i32 %20, 1, !dbg !63
  %27 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %18, i32 %26), !dbg !63
  store i32 %27, i32* %walk.idx.1, align 4, !dbg !63
  br label %walk.cond.1, !dbg !63

walk.end.1:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %18), !dbg !63
  %28 = load i32, i32* %sum.addr, align 4, !dbg !71
  %29 = call i8* @nish_str_from_i32(i32 %28), !dbg !70
  call void @nish_print(i8* %29), !dbg !69
  call void @nish_arena_release(i64 %arena.mark), !dbg !72
  ret i32 0, !dbg !72
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 !dbg !89 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !91, metadata !DIExpression()), !dbg !90
  call void @llvm.dbg.value(metadata i32 %index, metadata !92, metadata !DIExpression()), !dbg !90
  %0 = lshr i32 %h, 24, !dbg !95
  %1 = shl i32 %0, 24, !dbg !94
  %2 = add nsw i32 %index, 1, !dbg !97
  %3 = or i32 %1, %2, !dbg !93
  ret i32 %3, !dbg !90
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !101 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !103, metadata !DIExpression()), !dbg !102
  call void @llvm.dbg.value(metadata i32 %index, metadata !104, metadata !DIExpression()), !dbg !102
  %0 = sext i32 %bucket to i64, !dbg !106
  %1 = shl i64 %0, 32, !dbg !106
  %2 = sext i32 %index to i64, !dbg !108
  %3 = or i64 %1, %2, !dbg !105
  ret i64 %3, !dbg !102
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !112 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !114, metadata !DIExpression()), !dbg !113
  call void @llvm.dbg.value(metadata i32 %h, metadata !115, metadata !DIExpression()), !dbg !113
  %0 = sub nsw i32 0, 1, !dbg !117
  %1 = sext i32 %0 to i64, !dbg !116
  %2 = sext i32 %bucket to i64, !dbg !121
  %3 = shl i64 %2, 32, !dbg !121
  %4 = zext i32 %h to i64, !dbg !123
  %5 = or i64 %3, %4, !dbg !120
  %6 = sub nsw i64 %1, %5, !dbg !116
  ret i64 %6, !dbg !113
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !127 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !129, metadata !DIExpression()), !dbg !128
  call void @llvm.dbg.value(metadata i32 %mask, metadata !130, metadata !DIExpression()), !dbg !128
  call void @llvm.dbg.value(metadata i32 %h, metadata !131, metadata !DIExpression()), !dbg !128
  call void @llvm.dbg.value(metadata i32 %index, metadata !132, metadata !DIExpression()), !dbg !128
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !134
  store i32 %0, i32* %word.addr, align 4, !dbg !133
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !137, metadata !DIExpression()), !dbg !133
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !139
  store i32 %1, i32* %bucket.addr, align 4, !dbg !138
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !142, metadata !DIExpression()), !dbg !138
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !143
  %3 = load i64, i64* %2, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !143
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !143
  %5 = load i8*, i8** %4, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !143
  br label %while.cond, !dbg !143

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !157
  %7 = icmp sge i32 %6, 0, !dbg !157
  br i1 %7, label %land.rhs, label %land.end, !dbg !157

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !159
  %9 = trunc i64 %3 to i32, !dbg !144
  %10 = icmp slt i32 %8, %9, !dbg !159
  br label %land.end, !dbg !157

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !157
  br i1 %11, label %while.body, label %while.end, !dbg !143

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !164
  %13 = sext i32 %12 to i64, !dbg !163
  %14 = bitcast i8* %5 to i32*, !dbg !163
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !163
  %16 = load i32, i32* %15, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !163
  %17 = icmp eq i32 %16, 0, !dbg !163
  br i1 %17, label %if.then, label %if.end, !dbg !162

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !170
  %19 = sext i32 %18 to i64, !dbg !169
  %20 = load i32, i32* %word.addr, align 4, !dbg !171
  %21 = bitcast i8* %5 to i32*, !dbg !169
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !169
  store i32 %20, i32* %22, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !169
  ret void, !dbg !172

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !175
  %24 = add nsw i32 %23, 1, !dbg !175
  %25 = and i32 %24, %mask, !dbg !174
  store i32 %25, i32* %bucket.addr, align 4, !dbg !173
  br label %while.cond, !dbg !143

while.end:
  ret void, !dbg !128
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !180 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !182, metadata !DIExpression()), !dbg !181
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !185
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !185
  %2 = trunc i64 %1 to i32, !dbg !185
  store i32 %2, i32* %used.addr, align 4, !dbg !183
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !186, metadata !DIExpression()), !dbg !183
  store i32 0, i32* %to.addr, align 4, !dbg !187
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !189, metadata !DIExpression()), !dbg !187
  store i32 0, i32* %from.addr, align 4, !dbg !190
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !192, metadata !DIExpression()), !dbg !190
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !190
  %4 = load i8*, i8** %3, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !190
  br label %for.cond, !dbg !190

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !194
  %6 = load i32, i32* %used.addr, align 4, !dbg !195
  %7 = icmp slt i32 %5, %6, !dbg !194
  br i1 %7, label %for.body, label %for.end, !dbg !190

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !198
  %9 = sext i32 %8 to i64, !dbg !193
  %10 = bitcast i8* %4 to i32*, !dbg !193
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !193
  %12 = load i32, i32* %11, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !193
  store i32 %12, i32* %h.addr, align 4, !dbg !197
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !199, metadata !DIExpression()), !dbg !197
  %13 = load i32, i32* %h.addr, align 4, !dbg !201
  %14 = icmp ne i32 %13, 0, !dbg !201
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !201

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !203
  %16 = icmp sge i32 %15, 0, !dbg !203
  br label %land.end.1, !dbg !201

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !201
  br i1 %17, label %land.rhs, label %land.end, !dbg !201

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !205
  %19 = load i32, i32* %used.addr, align 4, !dbg !206
  %20 = icmp slt i32 %18, %19, !dbg !205
  br label %land.end, !dbg !201

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !201
  br i1 %21, label %if.then, label %if.end, !dbg !200

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !209
  %23 = sext i32 %22 to i64, !dbg !208
  %24 = load i32, i32* %h.addr, align 4, !dbg !210
  %25 = bitcast i8* %4 to i32*, !dbg !208
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !208
  store i32 %24, i32* %26, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !208
  %27 = load i32, i32* %to.addr, align 4, !dbg !211
  %28 = add nsw i32 %27, 1, !dbg !211
  store i32 %28, i32* %to.addr, align 4, !dbg !211
  br label %if.end, !dbg !200

if.end:
  br label %for.inc, !dbg !190

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !212
  %30 = add nsw i32 %29, 1, !dbg !212
  store i32 %30, i32* %from.addr, align 4, !dbg !212
  br label %for.cond, !dbg !190

for.end:
  br label %while.cond, !dbg !213

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !215
  %32 = load i64, i64* %31, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !215
  %33 = trunc i64 %32 to i32, !dbg !215
  %34 = load i32, i32* %to.addr, align 4, !dbg !216
  %35 = icmp sgt i32 %33, %34, !dbg !214
  br i1 %35, label %while.body, label %while.end, !dbg !213

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !218
  %37 = load i64, i64* %36, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !218
  %38 = icmp eq i64 %37, 0, !dbg !218
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !218

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !218
  unreachable, !dbg !218

pop.ok:
  %39 = sub i64 %37, 1, !dbg !218
  store i64 %39, i64* %36, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !218
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !218
  %41 = load i8*, i8** %40, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !218
  %42 = bitcast i8* %41 to i32*, !dbg !218
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !218
  %44 = load i32, i32* %43, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !218
  br label %while.cond, !dbg !213

while.end:
  ret void, !dbg !181
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !221 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !223, metadata !DIExpression()), !dbg !222
  call void @llvm.dbg.value(metadata i32 %live, metadata !224, metadata !DIExpression()), !dbg !222
  call void @llvm.dbg.value(metadata i32 %used, metadata !225, metadata !DIExpression()), !dbg !222
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !228
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !228
  %2 = trunc i64 %1 to i32, !dbg !228
  store i32 %2, i32* %n.addr, align 4, !dbg !226
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !229, metadata !DIExpression()), !dbg !226
  %3 = mul nsw i32 %live, 2, !dbg !231
  %4 = icmp slt i32 %3, %used, !dbg !231
  br i1 %4, label %if.then, label %if.end, !dbg !230

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !235
  ret %struct.nish_array* %slots, !dbg !237

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !241
  %6 = mul nsw i32 %5, 2, !dbg !241
  %7 = sext i32 %6 to i64, !dbg !240
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !240
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !240
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !240
  store i64 %7, i64* %10, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !240
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !240
  store i64 %7, i64* %11, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !240
  %12 = mul i64 %7, 4, !dbg !240
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !240
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !149, !noalias !148, !dbg !240
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !240
  store i8* %13, i8** %14, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !240
  ret %struct.nish_array* %9, !dbg !239
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !246 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !248, metadata !DIExpression()), !dbg !247
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !249, metadata !DIExpression()), !dbg !247
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !252
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !252
  %2 = trunc i64 %1 to i32, !dbg !252
  %3 = sub nsw i32 %2, 1, !dbg !251
  store i32 %3, i32* %mask.addr, align 4, !dbg !250
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !254, metadata !DIExpression()), !dbg !250
  store i32 0, i32* %i.addr, align 4, !dbg !255
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !257, metadata !DIExpression()), !dbg !255
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !255
  %5 = load i64, i64* %4, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !255
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !255
  %7 = load i8*, i8** %6, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !255
  br label %for.cond, !dbg !255

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !259
  %9 = trunc i64 %5 to i32, !dbg !258
  %10 = icmp slt i32 %8, %9, !dbg !259
  br i1 %10, label %for.body, label %for.end, !dbg !255

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !264
  %12 = sext i32 %11 to i64, !dbg !263
  %13 = bitcast i8* %7 to i32*, !dbg !263
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !263
  %15 = load i32, i32* %14, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !263
  store i32 %15, i32* %h.addr, align 4, !dbg !262
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !265, metadata !DIExpression()), !dbg !262
  %16 = load i32, i32* %h.addr, align 4, !dbg !267
  %17 = icmp ne i32 %16, 0, !dbg !267
  br i1 %17, label %if.then, label %if.end, !dbg !266

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !272
  %19 = load i32, i32* %h.addr, align 4, !dbg !273
  %20 = load i32, i32* %i.addr, align 4, !dbg !274
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !270
  br label %if.end, !dbg !266

if.end:
  br label %for.inc, !dbg !255

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !275
  %22 = add nsw i32 %21, 1, !dbg !275
  store i32 %22, i32* %i.addr, align 4, !dbg !275
  br label %for.cond, !dbg !255

for.end:
  ret void, !dbg !247
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !276 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !278, metadata !DIExpression()), !dbg !277
  store i32 0, i32* %i.addr, align 4, !dbg !279
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !281, metadata !DIExpression()), !dbg !279
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !279
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !279
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !279
  %3 = load i8*, i8** %2, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !279
  br label %for.cond, !dbg !279

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !283
  %5 = trunc i64 %1 to i32, !dbg !282
  %6 = icmp slt i32 %4, %5, !dbg !283
  br i1 %6, label %for.body, label %for.end, !dbg !279

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !287
  %8 = sext i32 %7 to i64, !dbg !286
  %9 = bitcast i8* %3 to i32*, !dbg !286
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !286
  store i32 0, i32* %10, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !286
  br label %for.inc, !dbg !279

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !289
  %12 = add nsw i32 %11, 1, !dbg !289
  store i32 %12, i32* %i.addr, align 4, !dbg !289
  br label %for.cond, !dbg !279

for.end:
  ret void, !dbg !277
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 !dbg !292 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !294, metadata !DIExpression()), !dbg !293
  call void @llvm.dbg.value(metadata i32 %from, metadata !295, metadata !DIExpression()), !dbg !293
  store i32 %from, i32* %i.addr, align 4, !dbg !296
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !298, metadata !DIExpression()), !dbg !296
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !296
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !296
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !296
  %3 = load i8*, i8** %2, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !296
  br label %for.cond, !dbg !296

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !300
  %5 = icmp sge i32 %4, 0, !dbg !300
  br i1 %5, label %land.rhs, label %land.end, !dbg !300

land.rhs:
  %6 = load i32, i32* %i.addr, align 4, !dbg !302
  %7 = trunc i64 %1 to i32, !dbg !299
  %8 = icmp slt i32 %6, %7, !dbg !302
  br label %land.end, !dbg !300

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ], !dbg !300
  br i1 %9, label %for.body, label %for.end, !dbg !296

for.body:
  %10 = load i32, i32* %i.addr, align 4, !dbg !307
  %11 = sext i32 %10 to i64, !dbg !306
  %12 = bitcast i8* %3 to i32*, !dbg !306
  %13 = getelementptr inbounds i32, i32* %12, i64 %11, !dbg !306
  %14 = load i32, i32* %13, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !306
  %15 = icmp ne i32 %14, 0, !dbg !306
  br i1 %15, label %if.then, label %if.end, !dbg !305

if.then:
  %16 = load i32, i32* %i.addr, align 4, !dbg !311
  ret i32 %16, !dbg !310

if.end:
  br label %for.inc, !dbg !296

for.inc:
  %17 = load i32, i32* %i.addr, align 4, !dbg !312
  %18 = add nsw i32 %17, 1, !dbg !312
  store i32 %18, i32* %i.addr, align 4, !dbg !312
  br label %for.cond, !dbg !296

for.end:
  %19 = sub nsw i32 0, 1, !dbg !314
  ret i32 %19, !dbg !313
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !318 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !320, metadata !DIExpression()), !dbg !319
  call void @llvm.dbg.value(metadata i32 %mask, metadata !321, metadata !DIExpression()), !dbg !319
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !322, metadata !DIExpression()), !dbg !319
  call void @llvm.dbg.value(metadata i32 %h, metadata !323, metadata !DIExpression()), !dbg !319
  call void @llvm.dbg.value(metadata i32 %used, metadata !324, metadata !DIExpression()), !dbg !319
  %0 = icmp sge i32 %bucket, 0, !dbg !326
  br i1 %0, label %land.rhs, label %land.end, !dbg !326

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !330
  %2 = load i64, i64* %1, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !330
  %3 = trunc i64 %2 to i32, !dbg !330
  %4 = icmp slt i32 %bucket, %3, !dbg !328
  br label %land.end, !dbg !326

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !326
  br i1 %5, label %if.then, label %if.else, !dbg !325

if.then:
  %6 = sext i32 %bucket to i64, !dbg !332
  %7 = sub nsw i32 %used, 1, !dbg !336
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !334
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !332
  %10 = load i8*, i8** %9, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !332
  %11 = bitcast i8* %10 to i32*, !dbg !332
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !332
  store i32 %8, i32* %12, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !332
  br label %if.end, !dbg !325

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !343
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !339
  br label %if.end, !dbg !325

if.end:
  ret void, !dbg !319
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #3 !dbg !347 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !349, metadata !DIExpression()), !dbg !348
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !348
  store i32 0, i32* %0, align 4, !tbaa !353, !dbg !348
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !348
  store i32 7, i32* %1, align 4, !tbaa !354, !dbg !348
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !348
  store i32 0, i32* %2, align 4, !tbaa !355, !dbg !348
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !348
  store i32 0, i32* %3, align 4, !tbaa !356, !dbg !348
  %4 = sext i32 8 to i64, !dbg !358
  %5 = call i8* @nish_alloc_struct(i64 24), !dbg !358
  %6 = bitcast i8* %5 to %struct.nish_array*, !dbg !358
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0, !dbg !358
  store i64 %4, i64* %7, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !358
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1, !dbg !358
  store i64 %4, i64* %8, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !358
  %9 = mul i64 %4, 4, !dbg !358
  %10 = call i8* @nish_alloc_struct(i64 %9), !dbg !358
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !149, !noalias !148, !dbg !358
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2, !dbg !358
  store i8* %10, i8** %11, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !358
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !357
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !360, !dbg !357
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !362
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !362
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !362
  store i64 0, i64* %15, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !362
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !362
  store i64 0, i64* %16, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !362
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !362
  store i8* null, i8** %17, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !362
  %18 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !361
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !363, !dbg !361
  %19 = call i8* @nish_alloc_struct(i64 24), !dbg !365
  %20 = bitcast i8* %19 to %struct.nish_array*, !dbg !365
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !365
  store i64 0, i64* %21, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !365
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !365
  store i64 0, i64* %22, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !365
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !365
  store i8* null, i8** %23, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !365
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !364
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !366, !dbg !364
  %25 = call i8* @nish_alloc_struct(i64 24), !dbg !368
  %26 = bitcast i8* %25 to %struct.nish_array*, !dbg !368
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0, !dbg !368
  store i64 0, i64* %27, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !368
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1, !dbg !368
  store i64 0, i64* %28, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !368
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2, !dbg !368
  store i8* null, i8** %29, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !368
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !367
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !369, !dbg !367
  ret void, !dbg !348
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !372 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !374, metadata !DIExpression()), !dbg !373
  call void @llvm.dbg.value(metadata i8* %key, metadata !375, metadata !DIExpression()), !dbg !373
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !378
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !360, !dbg !378
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !379
  %3 = load i32, i32* %2, align 4, !tbaa !354, !dbg !379
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !380
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !369, !dbg !380
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !381
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !363, !dbg !381
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !377
  ret i64 %8, !dbg !376
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !385 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !387, metadata !DIExpression()), !dbg !386
  call void @llvm.dbg.value(metadata i8* %key, metadata !388, metadata !DIExpression()), !dbg !386
  call void @llvm.dbg.value(metadata i32 %value, metadata !389, metadata !DIExpression()), !dbg !386
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !391
  store i64 %0, i64* %found.addr, align 8, !dbg !390
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !393, metadata !DIExpression()), !dbg !390
  %1 = load i64, i64* %found.addr, align 8, !dbg !395
  %2 = icmp sge i64 %1, 0, !dbg !395
  br i1 %2, label %if.then, label %if.else, !dbg !394

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !400
  %4 = trunc i64 %3 to i32, !dbg !399
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !398
  br label %if.end, !dbg !394

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !404
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !403
  br label %if.end, !dbg !394

if.end:
  ret %struct.Map$str$i32* %this, !dbg !407
}

define internal void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 !dbg !409 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !411, metadata !DIExpression()), !dbg !410
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !413
  %1 = load i32, i32* %0, align 4, !tbaa !356, !dbg !413
  %2 = add nsw i32 %1, 1, !dbg !413
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !412
  store i32 %2, i32* %3, align 4, !tbaa !356, !dbg !412
  ret void, !dbg !410
}

define internal noundef i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 !dbg !417 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !419, metadata !DIExpression()), !dbg !418
  call void @llvm.dbg.value(metadata i32 %from, metadata !420, metadata !DIExpression()), !dbg !418
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !423
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !369, !dbg !423
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from), !dbg !422
  ret i32 %2, !dbg !421
}

define internal void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 !dbg !425 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !427, metadata !DIExpression()), !dbg !426
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !429
  %1 = load i32, i32* %0, align 4, !tbaa !356, !dbg !429
  %2 = sub nsw i32 %1, 1, !dbg !429
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !428
  store i32 %2, i32* %3, align 4, !tbaa !356, !dbg !428
  ret void, !dbg !426
}

define internal noundef nonnull align 8 i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !433 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !435, metadata !DIExpression()), !dbg !434
  call void @llvm.dbg.value(metadata i32 %index, metadata !436, metadata !DIExpression()), !dbg !434
  %0 = icmp slt i32 %index, 0, !dbg !438
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !438

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !442
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !363, !dbg !442
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !442
  %4 = load i64, i64* %3, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !442
  %5 = trunc i64 %4 to i32, !dbg !442
  %6 = icmp sge i32 %index, %5, !dbg !440
  br label %lor.end, !dbg !438

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !438
  br i1 %7, label %if.then, label %if.end, !dbg !437

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !444
  call void @nish_exit(i32 1), !dbg !444
  unreachable, !dbg !444

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !447
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !363, !dbg !447
  %10 = sext i32 %index to i64, !dbg !447
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !447
  %12 = load i64, i64* %11, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !447
  %13 = icmp ult i64 %10, %12, !dbg !447
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !447

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !447
  unreachable, !dbg !447

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !447
  %15 = load i8*, i8** %14, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !447
  %16 = bitcast i8* %15 to i8**, !dbg !447
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10, !dbg !447
  %18 = load i8*, i8** %17, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !447
  ret i8* %18, !dbg !446
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !451 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !453, metadata !DIExpression()), !dbg !452
  call void @llvm.dbg.value(metadata i32 %index, metadata !454, metadata !DIExpression()), !dbg !452
  %0 = icmp slt i32 %index, 0, !dbg !456
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !456

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !460
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !366, !dbg !460
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !460
  %4 = load i64, i64* %3, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !460
  %5 = trunc i64 %4 to i32, !dbg !460
  %6 = icmp sge i32 %index, %5, !dbg !458
  br label %lor.end, !dbg !456

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !456
  br i1 %7, label %if.then, label %if.end, !dbg !455

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !462
  call void @nish_exit(i32 1), !dbg !462
  unreachable, !dbg !462

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !465
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !366, !dbg !465
  %10 = sext i32 %index to i64, !dbg !465
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !465
  %12 = load i64, i64* %11, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !465
  %13 = icmp ult i64 %10, %12, !dbg !465
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !465

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !465
  unreachable, !dbg !465

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !465
  %15 = load i8*, i8** %14, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !465
  %16 = bitcast i8* %15 to i32*, !dbg !465
  %17 = getelementptr inbounds i32, i32* %16, i64 %10, !dbg !465
  %18 = load i32, i32* %17, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !465
  ret i32 %18, !dbg !464
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #3 !dbg !469 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !471, metadata !DIExpression()), !dbg !470
  call void @llvm.dbg.value(metadata i32 %index, metadata !472, metadata !DIExpression()), !dbg !470
  call void @llvm.dbg.value(metadata i32 %value, metadata !473, metadata !DIExpression()), !dbg !470
  %0 = icmp sge i32 %index, 0, !dbg !475
  br i1 %0, label %land.rhs, label %land.end, !dbg !475

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !479
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !366, !dbg !479
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !479
  %4 = load i64, i64* %3, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !479
  %5 = trunc i64 %4 to i32, !dbg !479
  %6 = icmp slt i32 %index, %5, !dbg !477
  br label %land.end, !dbg !475

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !475
  br i1 %7, label %if.then, label %if.end, !dbg !474

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !481
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !366, !dbg !481
  %10 = sext i32 %index to i64, !dbg !481
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !481
  %12 = load i8*, i8** %11, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !481
  %13 = bitcast i8* %12 to i32*, !dbg !481
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !481
  store i32 %value, i32* %14, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !481
  br label %if.end, !dbg !474

if.end:
  ret void, !dbg !470
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !486 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !488, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i64 %absent, metadata !489, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i8* %key, metadata !490, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i32 %value, metadata !491, metadata !DIExpression()), !dbg !487
  %0 = sub nsw i64 0, 1, !dbg !493
  %1 = sub nsw i64 %0, %absent, !dbg !493
  store i64 %1, i64* %packed.addr, align 8, !dbg !492
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !496, metadata !DIExpression()), !dbg !492
  %2 = load i64, i64* %packed.addr, align 8, !dbg !499
  %3 = ashr i64 %2, 32, !dbg !499
  %4 = trunc i64 %3 to i32, !dbg !498
  store i32 %4, i32* %bucket.addr, align 4, !dbg !497
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !500, metadata !DIExpression()), !dbg !497
  %5 = load i64, i64* %packed.addr, align 8, !dbg !503
  %6 = trunc i64 %5 to i32, !dbg !502
  store i32 %6, i32* %h.addr, align 4, !dbg !501
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !504, metadata !DIExpression()), !dbg !501
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !507
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !363, !dbg !507
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !507
  %10 = load i64, i64* %9, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !507
  %11 = trunc i64 %10 to i32, !dbg !507
  %12 = icmp sge i32 %11, 16777215, !dbg !506
  br i1 %12, label %if.then, label %if.end, !dbg !505

if.then:
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !511
  %14 = load i32, i32* %13, align 4, !tbaa !355, !dbg !511
  %15 = icmp sge i32 %14, 16777215, !dbg !511
  br i1 %15, label %lor.end, label %lor.rhs, !dbg !511

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !513
  %17 = load i32, i32* %16, align 4, !tbaa !356, !dbg !513
  %18 = icmp sgt i32 %17, 0, !dbg !513
  br label %lor.end, !dbg !511

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ], !dbg !511
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !510

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !516
  call void @nish_exit(i32 1), !dbg !516
  unreachable, !dbg !516

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !518
  %20 = sub nsw i32 0, 1, !dbg !520
  store i32 %20, i32* %bucket.addr, align 4, !dbg !519
  br label %if.end, !dbg !505

if.end:
  %21 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !522
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !363, !dbg !522
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0, !dbg !522
  %24 = load i64, i64* %23, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !522
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1, !dbg !522
  %26 = load i64, i64* %25, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !522
  %27 = icmp eq i64 %24, %26, !dbg !522
  br i1 %27, label %push.grow, label %push.store, !dbg !522

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 8), !dbg !522
  br label %push.store, !dbg !522

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2, !dbg !522
  %29 = load i8*, i8** %28, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !522
  %30 = bitcast i8* %29 to i8**, !dbg !522
  %31 = getelementptr inbounds i8*, i8** %30, i64 %24, !dbg !522
  store i8* %key, i8** %31, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !522
  %32 = add i64 %24, 1, !dbg !522
  store i64 %32, i64* %23, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !522
  %33 = trunc i64 %32 to i32, !dbg !522
  %34 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !524
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !366, !dbg !524
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0, !dbg !524
  %37 = load i64, i64* %36, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !524
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1, !dbg !524
  %39 = load i64, i64* %38, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !524
  %40 = icmp eq i64 %37, %39, !dbg !524
  br i1 %40, label %push.grow.1, label %push.store.1, !dbg !524

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %35, i64 4), !dbg !524
  br label %push.store.1, !dbg !524

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2, !dbg !524
  %42 = load i8*, i8** %41, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !524
  %43 = bitcast i8* %42 to i32*, !dbg !524
  %44 = getelementptr inbounds i32, i32* %43, i64 %37, !dbg !524
  store i32 %value, i32* %44, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !524
  %45 = add i64 %37, 1, !dbg !524
  store i64 %45, i64* %36, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !524
  %46 = trunc i64 %45 to i32, !dbg !524
  %47 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !526
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !369, !dbg !526
  %49 = load i32, i32* %h.addr, align 4, !dbg !527
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0, !dbg !526
  %51 = load i64, i64* %50, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !526
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1, !dbg !526
  %53 = load i64, i64* %52, align 8, !alias.scope !148, !noalias !149, !tbaa !243, !dbg !526
  %54 = icmp eq i64 %51, %53, !dbg !526
  br i1 %54, label %push.grow.2, label %push.store.2, !dbg !526

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4), !dbg !526
  br label %push.store.2, !dbg !526

push.store.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2, !dbg !526
  %56 = load i8*, i8** %55, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !526
  %57 = bitcast i8* %56 to i32*, !dbg !526
  %58 = getelementptr inbounds i32, i32* %57, i64 %51, !dbg !526
  store i32 %49, i32* %58, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !526
  %59 = add i64 %51, 1, !dbg !526
  store i64 %59, i64* %50, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !526
  %60 = trunc i64 %59 to i32, !dbg !526
  %61 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !529
  %62 = load i32, i32* %61, align 4, !tbaa !355, !dbg !529
  %63 = add nsw i32 %62, 1, !dbg !529
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !528
  store i32 %63, i32* %64, align 4, !tbaa !355, !dbg !528
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !532
  %66 = load i32, i32* %65, align 4, !tbaa !353, !dbg !532
  %67 = add nsw i32 %66, 1, !dbg !532
  %68 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !531
  store i32 %67, i32* %68, align 4, !tbaa !353, !dbg !531
  %69 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !536
  %70 = load %struct.nish_array*, %struct.nish_array** %69, align 8, !tbaa !363, !dbg !536
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0, !dbg !536
  %72 = load i64, i64* %71, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !536
  %73 = trunc i64 %72 to i32, !dbg !536
  store i32 %73, i32* %used.addr, align 4, !dbg !534
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !537, metadata !DIExpression()), !dbg !534
  %74 = load i32, i32* %used.addr, align 4, !dbg !539
  %75 = mul nsw i32 %74, 4, !dbg !539
  %76 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !542
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !360, !dbg !542
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0, !dbg !542
  %79 = load i64, i64* %78, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !542
  %80 = trunc i64 %79 to i32, !dbg !542
  %81 = mul nsw i32 %80, 3, !dbg !541
  %82 = icmp sgt i32 %75, %81, !dbg !539
  br i1 %82, label %if.then.2, label %if.else, !dbg !538

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !545
  br label %if.end.2, !dbg !538

if.else:
  %83 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !548
  %84 = load %struct.nish_array*, %struct.nish_array** %83, align 8, !tbaa !360, !dbg !548
  %85 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !549
  %86 = load i32, i32* %85, align 4, !tbaa !354, !dbg !549
  %87 = load i32, i32* %bucket.addr, align 4, !dbg !550
  %88 = load i32, i32* %h.addr, align 4, !dbg !551
  %89 = load i32, i32* %used.addr, align 4, !dbg !552
  call void @nish.fileAppended(%struct.nish_array* %84, i32 %86, i32 %87, i32 %88, i32 %89), !dbg !547
  br label %if.end.2, !dbg !538

if.end.2:
  ret void, !dbg !487
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !553 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !555, metadata !DIExpression()), !dbg !554
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !558
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !363, !dbg !558
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !558
  %3 = load i64, i64* %2, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !558
  %4 = trunc i64 %3 to i32, !dbg !558
  store i32 %4, i32* %used.addr, align 4, !dbg !556
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !559, metadata !DIExpression()), !dbg !556
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !561
  %6 = load i32, i32* %5, align 4, !tbaa !356, !dbg !561
  %7 = icmp sgt i32 %6, 0, !dbg !561
  store i1 %7, i1* %walking.addr, align 1, !dbg !560
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !564, metadata !DIExpression()), !dbg !560
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !567
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !360, !dbg !567
  %10 = load i1, i1* %walking.addr, align 1, !dbg !568
  br i1 %10, label %cond.true, label %cond.false, !dbg !568

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !569
  br label %cond.end, !dbg !568

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !570
  %13 = load i32, i32* %12, align 4, !tbaa !355, !dbg !570
  br label %cond.end, !dbg !568

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !568
  %15 = load i32, i32* %used.addr, align 4, !dbg !571
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !566
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !565
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !572, metadata !DIExpression()), !dbg !565
  %17 = load i1, i1* %walking.addr, align 1, !dbg !575
  %18 = xor i1 %17, true, !dbg !574
  br i1 %18, label %land.rhs, label %land.end, !dbg !574

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !576
  %20 = load i32, i32* %19, align 4, !tbaa !355, !dbg !576
  %21 = load i32, i32* %used.addr, align 4, !dbg !577
  %22 = icmp slt i32 %20, %21, !dbg !576
  br label %land.end, !dbg !574

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !574
  br i1 %23, label %if.then, label %if.end, !dbg !573

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !580
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !363, !dbg !580
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !581
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !369, !dbg !581
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !579
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !583
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !366, !dbg !583
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !584
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !369, !dbg !584
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !582
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !586
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !369, !dbg !586
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !585
  br label %if.end, !dbg !573

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !588
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !587
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !360, !dbg !587
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !591
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !591
  %38 = load i64, i64* %37, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !591
  %39 = trunc i64 %38 to i32, !dbg !591
  %40 = sub nsw i32 %39, 1, !dbg !590
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !589
  store i32 %40, i32* %41, align 4, !tbaa !354, !dbg !589
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !594
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !595
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !369, !dbg !595
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !593
  ret void, !dbg !554
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !598 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !600, metadata !DIExpression()), !dbg !599
  call void @llvm.dbg.value(metadata i32 %mask, metadata !601, metadata !DIExpression()), !dbg !599
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !602, metadata !DIExpression()), !dbg !599
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !603, metadata !DIExpression()), !dbg !599
  call void @llvm.dbg.value(metadata i8* %key, metadata !604, metadata !DIExpression()), !dbg !599
  %0 = bitcast i8* %key to i64*, !dbg !606
  %1 = load i64, i64* %0, align 8, !dbg !606
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !606
  store i64 0, i64* %hash.i, align 8, !dbg !606
  store i32 -2128831035, i32* %hash.h, align 4, !dbg !606
  br label %hash.test, !dbg !606

hash.test:
  %3 = load i64, i64* %hash.i, align 8, !dbg !606
  %4 = icmp ult i64 %3, %1, !dbg !606
  br i1 %4, label %hash.byte, label %hash.done, !dbg !606

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3, !dbg !606
  %6 = load i8, i8* %5, !dbg !606
  %7 = zext i8 %6 to i32, !dbg !606
  %8 = load i32, i32* %hash.h, align 4, !dbg !606
  %9 = xor i32 %8, %7, !dbg !606
  %10 = mul i32 %9, 16777619, !dbg !606
  store i32 %10, i32* %hash.h, align 4, !dbg !606
  %11 = add i64 %3, 1, !dbg !606
  store i64 %11, i64* %hash.i, align 8, !dbg !606
  br label %hash.test, !dbg !606

hash.done:
  %12 = load i32, i32* %hash.h, align 4, !dbg !606
  %13 = icmp eq i32 %12, 0, !dbg !606
  %14 = select i1 %13, i32 1, i32 %12, !dbg !606
  store i32 %14, i32* %h.addr, align 4, !dbg !605
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !608, metadata !DIExpression()), !dbg !605
  %15 = load i32, i32* %h.addr, align 4, !dbg !610
  %16 = lshr i32 %15, 24, !dbg !610
  store i32 %16, i32* %fingerprint.addr, align 4, !dbg !609
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !611, metadata !DIExpression()), !dbg !609
  %17 = load i32, i32* %h.addr, align 4, !dbg !614
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask), !dbg !613
  store i32 %18, i32* %bucket.addr, align 4, !dbg !612
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !616, metadata !DIExpression()), !dbg !612
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !617
  %20 = load i64, i64* %19, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !617
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !617
  %22 = load i8*, i8** %21, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !617
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !617
  %24 = load i64, i64* %23, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !617
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !617
  %26 = load i8*, i8** %25, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !617
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !617
  %28 = load i64, i64* %27, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !617
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !617
  %30 = load i8*, i8** %29, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !617
  br label %while.cond, !dbg !617

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4, !dbg !621
  %32 = icmp sge i32 %31, 0, !dbg !621
  br i1 %32, label %land.rhs, label %land.end, !dbg !621

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4, !dbg !623
  %34 = trunc i64 %20 to i32, !dbg !618
  %35 = icmp slt i32 %33, %34, !dbg !623
  br label %land.end, !dbg !621

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ], !dbg !621
  br i1 %36, label %while.body, label %while.end, !dbg !617

while.body:
  %37 = load i32, i32* %bucket.addr, align 4, !dbg !628
  %38 = sext i32 %37 to i64, !dbg !627
  %39 = bitcast i8* %22 to i32*, !dbg !627
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !627
  %41 = load i32, i32* %40, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !627
  store i32 %41, i32* %word.addr, align 4, !dbg !626
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !629, metadata !DIExpression()), !dbg !626
  %42 = load i32, i32* %word.addr, align 4, !dbg !631
  %43 = icmp eq i32 %42, 0, !dbg !631
  br i1 %43, label %if.then, label %if.end, !dbg !630

if.then:
  %44 = load i32, i32* %bucket.addr, align 4, !dbg !636
  %45 = load i32, i32* %h.addr, align 4, !dbg !637
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45), !dbg !635
  ret i64 %46, !dbg !634

if.end:
  %47 = load i32, i32* %word.addr, align 4, !dbg !639
  %48 = lshr i32 %47, 24, !dbg !639
  %49 = load i32, i32* %fingerprint.addr, align 4, !dbg !640
  %50 = icmp eq i32 %48, %49, !dbg !639
  br i1 %50, label %if.then.1, label %if.end.1, !dbg !638

if.then.1:
  %51 = load i32, i32* %word.addr, align 4, !dbg !644
  %52 = and i32 %51, 16777215, !dbg !644
  %53 = sub nsw i32 %52, 1, !dbg !643
  store i32 %53, i32* %at.addr, align 4, !dbg !642
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !647, metadata !DIExpression()), !dbg !642
  %54 = load i32, i32* %at.addr, align 4, !dbg !649
  %55 = icmp sge i32 %54, 0, !dbg !649
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !649

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !651
  %57 = trunc i64 %24 to i32, !dbg !619
  %58 = icmp slt i32 %56, %57, !dbg !651
  br label %land.end.4, !dbg !649

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !649
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !649

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !654
  %61 = sext i32 %60 to i64, !dbg !653
  %62 = bitcast i8* %26 to i32*, !dbg !653
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !653
  %64 = load i32, i32* %63, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !653
  %65 = load i32, i32* %h.addr, align 4, !dbg !655
  %66 = icmp eq i32 %64, %65, !dbg !653
  br label %land.end.3, !dbg !649

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !649
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !649

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !656
  %69 = trunc i64 %28 to i32, !dbg !620
  %70 = icmp slt i32 %68, %69, !dbg !656
  br label %land.end.2, !dbg !649

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !649
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !649

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !660
  %73 = sext i32 %72 to i64, !dbg !659
  %74 = bitcast i8* %30 to i8**, !dbg !659
  %75 = getelementptr inbounds i8*, i8** %74, i64 %73, !dbg !659
  %76 = load i8*, i8** %75, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !659
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* %key), !dbg !658
  br label %land.end.1, !dbg !649

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !649
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !648

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4, !dbg !665
  %80 = load i32, i32* %at.addr, align 4, !dbg !666
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !664
  ret i64 %81, !dbg !663

if.end.2:
  br label %if.end.1, !dbg !638

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !669
  %83 = add nsw i32 %82, 1, !dbg !669
  %84 = and i32 %83, %mask, !dbg !668
  store i32 %84, i32* %bucket.addr, align 4, !dbg !667
  br label %while.cond, !dbg !617

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !672
  call void @nish_exit(i32 1), !dbg !672
  unreachable, !dbg !672
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !676 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !678, metadata !DIExpression()), !dbg !677
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !679, metadata !DIExpression()), !dbg !677
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !682
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !682
  %2 = trunc i64 %1 to i32, !dbg !682
  store i32 %2, i32* %used.addr, align 4, !dbg !680
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !683, metadata !DIExpression()), !dbg !680
  store i32 0, i32* %to.addr, align 4, !dbg !684
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !686, metadata !DIExpression()), !dbg !684
  store i32 0, i32* %from.addr, align 4, !dbg !687
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !689, metadata !DIExpression()), !dbg !687
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !687
  %4 = load i64, i64* %3, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !687
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !687
  %6 = load i8*, i8** %5, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !687
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !687
  %8 = load i64, i64* %7, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !687
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !687
  %10 = load i8*, i8** %9, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !687
  br label %for.cond, !dbg !687

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !692
  %12 = load i32, i32* %used.addr, align 4, !dbg !693
  %13 = icmp slt i32 %11, %12, !dbg !692
  br i1 %13, label %land.rhs, label %land.end, !dbg !692

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !694
  %15 = trunc i64 %4 to i32, !dbg !690
  %16 = icmp slt i32 %14, %15, !dbg !694
  br label %land.end, !dbg !692

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !692
  br i1 %17, label %for.body, label %for.end, !dbg !687

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !699
  %19 = sext i32 %18 to i64, !dbg !698
  %20 = bitcast i8* %6 to i32*, !dbg !698
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !698
  %22 = load i32, i32* %21, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !698
  %23 = icmp ne i32 %22, 0, !dbg !698
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !698

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !701
  %25 = icmp sge i32 %24, 0, !dbg !701
  br label %land.end.3, !dbg !698

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !698
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !698

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !703
  %28 = load i32, i32* %used.addr, align 4, !dbg !704
  %29 = icmp slt i32 %27, %28, !dbg !703
  br label %land.end.2, !dbg !698

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !698
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !698

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !705
  %32 = trunc i64 %8 to i32, !dbg !691
  %33 = icmp slt i32 %31, %32, !dbg !705
  br label %land.end.1, !dbg !698

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !698
  br i1 %34, label %if.then, label %if.end, !dbg !697

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !709
  %36 = sext i32 %35 to i64, !dbg !708
  %37 = load i32, i32* %from.addr, align 4, !dbg !711
  %38 = sext i32 %37 to i64, !dbg !710
  %39 = bitcast i8* %10 to i8**, !dbg !710
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !710
  %41 = load i8*, i8** %40, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !710
  %42 = bitcast i8* %10 to i8**, !dbg !708
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !708
  store i8* %41, i8** %43, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !708
  %44 = load i32, i32* %to.addr, align 4, !dbg !712
  %45 = add nsw i32 %44, 1, !dbg !712
  store i32 %45, i32* %to.addr, align 4, !dbg !712
  br label %if.end, !dbg !697

if.end:
  br label %for.inc, !dbg !687

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !713
  %47 = add nsw i32 %46, 1, !dbg !713
  store i32 %47, i32* %from.addr, align 4, !dbg !713
  br label %for.cond, !dbg !687

for.end:
  br label %while.cond, !dbg !714

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !716
  %49 = load i64, i64* %48, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !716
  %50 = trunc i64 %49 to i32, !dbg !716
  %51 = load i32, i32* %to.addr, align 4, !dbg !717
  %52 = icmp sgt i32 %50, %51, !dbg !715
  br i1 %52, label %while.body, label %while.end, !dbg !714

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !719
  %54 = load i64, i64* %53, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !719
  %55 = icmp eq i64 %54, 0, !dbg !719
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !719

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !719
  unreachable, !dbg !719

pop.ok:
  %56 = sub i64 %54, 1, !dbg !719
  store i64 %56, i64* %53, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !719
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !719
  %58 = load i8*, i8** %57, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !719
  %59 = bitcast i8* %58 to i8**, !dbg !719
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56, !dbg !719
  %61 = load i8*, i8** %60, align 8, !alias.scope !149, !noalias !148, !tbaa !450, !dbg !719
  br label %while.cond, !dbg !714

while.end:
  ret void, !dbg !677
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !722 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !724, metadata !DIExpression()), !dbg !723
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !725, metadata !DIExpression()), !dbg !723
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !728
  %1 = load i64, i64* %0, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !728
  %2 = trunc i64 %1 to i32, !dbg !728
  store i32 %2, i32* %used.addr, align 4, !dbg !726
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !729, metadata !DIExpression()), !dbg !726
  store i32 0, i32* %to.addr, align 4, !dbg !730
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !732, metadata !DIExpression()), !dbg !730
  store i32 0, i32* %from.addr, align 4, !dbg !733
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !735, metadata !DIExpression()), !dbg !733
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !733
  %4 = load i64, i64* %3, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !733
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !733
  %6 = load i8*, i8** %5, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !733
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !733
  %8 = load i64, i64* %7, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !733
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !733
  %10 = load i8*, i8** %9, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !733
  br label %for.cond, !dbg !733

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !738
  %12 = load i32, i32* %used.addr, align 4, !dbg !739
  %13 = icmp slt i32 %11, %12, !dbg !738
  br i1 %13, label %land.rhs, label %land.end, !dbg !738

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !740
  %15 = trunc i64 %4 to i32, !dbg !736
  %16 = icmp slt i32 %14, %15, !dbg !740
  br label %land.end, !dbg !738

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !738
  br i1 %17, label %for.body, label %for.end, !dbg !733

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !745
  %19 = sext i32 %18 to i64, !dbg !744
  %20 = bitcast i8* %6 to i32*, !dbg !744
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !744
  %22 = load i32, i32* %21, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !744
  %23 = icmp ne i32 %22, 0, !dbg !744
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !744

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !747
  %25 = icmp sge i32 %24, 0, !dbg !747
  br label %land.end.3, !dbg !744

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !744
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !744

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !749
  %28 = load i32, i32* %used.addr, align 4, !dbg !750
  %29 = icmp slt i32 %27, %28, !dbg !749
  br label %land.end.2, !dbg !744

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !744
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !744

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !751
  %32 = trunc i64 %8 to i32, !dbg !737
  %33 = icmp slt i32 %31, %32, !dbg !751
  br label %land.end.1, !dbg !744

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !744
  br i1 %34, label %if.then, label %if.end, !dbg !743

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !755
  %36 = sext i32 %35 to i64, !dbg !754
  %37 = load i32, i32* %from.addr, align 4, !dbg !757
  %38 = sext i32 %37 to i64, !dbg !756
  %39 = bitcast i8* %10 to i32*, !dbg !756
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !756
  %41 = load i32, i32* %40, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !756
  %42 = bitcast i8* %10 to i32*, !dbg !754
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !754
  store i32 %41, i32* %43, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !754
  %44 = load i32, i32* %to.addr, align 4, !dbg !758
  %45 = add nsw i32 %44, 1, !dbg !758
  store i32 %45, i32* %to.addr, align 4, !dbg !758
  br label %if.end, !dbg !743

if.end:
  br label %for.inc, !dbg !733

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !759
  %47 = add nsw i32 %46, 1, !dbg !759
  store i32 %47, i32* %from.addr, align 4, !dbg !759
  br label %for.cond, !dbg !733

for.end:
  br label %while.cond, !dbg !760

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !762
  %49 = load i64, i64* %48, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !762
  %50 = trunc i64 %49 to i32, !dbg !762
  %51 = load i32, i32* %to.addr, align 4, !dbg !763
  %52 = icmp sgt i32 %50, %51, !dbg !761
  br i1 %52, label %while.body, label %while.end, !dbg !760

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !765
  %54 = load i64, i64* %53, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !765
  %55 = icmp eq i64 %54, 0, !dbg !765
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !765

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !765
  unreachable, !dbg !765

pop.ok:
  %56 = sub i64 %54, 1, !dbg !765
  store i64 %56, i64* %53, align 8, !alias.scope !148, !noalias !149, !tbaa !155, !dbg !765
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !765
  %58 = load i8*, i8** %57, align 8, !alias.scope !148, !noalias !149, !tbaa !156, !dbg !765
  %59 = bitcast i8* %58 to i32*, !dbg !765
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !765
  %61 = load i32, i32* %60, align 4, !alias.scope !149, !noalias !148, !tbaa !166, !dbg !765
  br label %while.cond, !dbg !760

while.end:
  ret void, !dbg !723
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { noreturn nounwind }
attributes #7 = { nounwind noreturn cold }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<string, i32>", file: !13, line: 266, size: 448, align: 64, elements: !47)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 268, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 270, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 272, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 274, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "string[]", file: !1, size: 192, align: 64, elements: !34)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!31 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !30, size: 64)
!32 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !31, size: 64)
!33 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !32, size: 64, offset: 128)
!34 = !{!28, !29, !33}
!35 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 275, baseType: !35, size: 64, offset: 192)
!37 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !42)
!38 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !37, baseType: !16, size: 64, offset: 0)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !37, baseType: !16, size: 64, offset: 64)
!40 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !37, baseType: !40, size: 64, offset: 128)
!42 = !{!38, !39, !41}
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !37, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 276, baseType: !43, size: 64, offset: 256)
!45 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 278, baseType: !23, size: 64, offset: 320)
!46 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 284, baseType: !4, size: 32, offset: 384)
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
!78 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 78, type: !77, scopeLine: 78, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!79 = !DILocation(line: 78, column: 1, scope: !78)
!80 = !DILocalVariable(name: "h", arg: 1, scope: !78, file: !13, line: 78, type: !19)
!81 = !DILocalVariable(name: "mask", arg: 2, scope: !78, file: !13, line: 78, type: !4)
!82 = !DILocation(line: 78, column: 48, scope: !78)
!83 = !DILocation(line: 78, column: 54, scope: !78)
!84 = !DILocation(line: 78, column: 58, scope: !78)
!85 = !DILocation(line: 78, column: 59, scope: !78)
!86 = !DILocation(line: 78, column: 72, scope: !78)
!87 = !{!19, !19, !4}
!88 = !DISubroutineType(types: !87)
!89 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 81, type: !88, scopeLine: 81, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!90 = !DILocation(line: 81, column: 1, scope: !89)
!91 = !DILocalVariable(name: "h", arg: 1, scope: !89, file: !13, line: 81, type: !19)
!92 = !DILocalVariable(name: "index", arg: 2, scope: !89, file: !13, line: 81, type: !4)
!93 = !DILocation(line: 81, column: 47, scope: !89)
!94 = !DILocation(line: 81, column: 48, scope: !89)
!95 = !DILocation(line: 81, column: 49, scope: !89)
!96 = !DILocation(line: 81, column: 68, scope: !89)
!97 = !DILocation(line: 81, column: 74, scope: !89)
!98 = !DILocation(line: 81, column: 82, scope: !89)
!99 = !{!16, !4, !4}
!100 = !DISubroutineType(types: !99)
!101 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 84, type: !100, scopeLine: 84, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!102 = !DILocation(line: 84, column: 1, scope: !101)
!103 = !DILocalVariable(name: "bucket", arg: 1, scope: !101, file: !13, line: 84, type: !4)
!104 = !DILocalVariable(name: "index", arg: 2, scope: !101, file: !13, line: 84, type: !4)
!105 = !DILocation(line: 84, column: 51, scope: !101)
!106 = !DILocation(line: 84, column: 52, scope: !101)
!107 = !DILocation(line: 84, column: 58, scope: !101)
!108 = !DILocation(line: 84, column: 75, scope: !101)
!109 = !DILocation(line: 84, column: 81, scope: !101)
!110 = !{!16, !4, !19}
!111 = !DISubroutineType(types: !110)
!112 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 87, type: !111, scopeLine: 87, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!113 = !DILocation(line: 87, column: 1, scope: !112)
!114 = !DILocalVariable(name: "bucket", arg: 1, scope: !112, file: !13, line: 87, type: !4)
!115 = !DILocalVariable(name: "h", arg: 2, scope: !112, file: !13, line: 87, type: !19)
!116 = !DILocation(line: 87, column: 48, scope: !112)
!117 = !DILocation(line: 87, column: 54, scope: !112)
!118 = !DILocation(line: 87, column: 55, scope: !112)
!119 = !DILocation(line: 87, column: 60, scope: !112)
!120 = !DILocation(line: 87, column: 61, scope: !112)
!121 = !DILocation(line: 87, column: 62, scope: !112)
!122 = !DILocation(line: 87, column: 68, scope: !112)
!123 = !DILocation(line: 87, column: 85, scope: !112)
!124 = !DILocation(line: 87, column: 91, scope: !112)
!125 = !{null, !23, !4, !19, !4}
!126 = !DISubroutineType(types: !125)
!127 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 123, type: !126, scopeLine: 123, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!128 = !DILocation(line: 123, column: 1, scope: !127)
!129 = !DILocalVariable(name: "slots", arg: 1, scope: !127, file: !13, line: 123, type: !23)
!130 = !DILocalVariable(name: "mask", arg: 2, scope: !127, file: !13, line: 123, type: !4)
!131 = !DILocalVariable(name: "h", arg: 3, scope: !127, file: !13, line: 123, type: !19)
!132 = !DILocalVariable(name: "index", arg: 4, scope: !127, file: !13, line: 123, type: !4)
!133 = !DILocation(line: 124, column: 3, scope: !127)
!134 = !DILocation(line: 124, column: 16, scope: !127)
!135 = !DILocation(line: 124, column: 25, scope: !127)
!136 = !DILocation(line: 124, column: 28, scope: !127)
!137 = !DILocalVariable(name: "word", scope: !127, file: !13, line: 124, type: !19)
!138 = !DILocation(line: 125, column: 3, scope: !127)
!139 = !DILocation(line: 125, column: 16, scope: !127)
!140 = !DILocation(line: 125, column: 27, scope: !127)
!141 = !DILocation(line: 125, column: 30, scope: !127)
!142 = !DILocalVariable(name: "bucket", scope: !127, file: !13, line: 125, type: !4)
!143 = !DILocation(line: 126, column: 3, scope: !127)
!144 = !DILocation(line: 126, column: 40, scope: !127)
!145 = !{!"nish array"}
!146 = !{!"header", !145}
!147 = !{!"elements", !145}
!148 = !{!146}
!149 = !{!147}
!150 = !{!"nish TBAA"}
!151 = !{!"omnipotent char", !150, i64 0}
!152 = !{!"header i64", !151, i64 0}
!153 = !{!"header ptr", !151, i64 0}
!154 = !{!"array header", !152, i64 0, !152, i64 8, !153, i64 16}
!155 = !{!154, !152, i64 0}
!156 = !{!154, !153, i64 16}
!157 = !DILocation(line: 126, column: 10, scope: !127)
!158 = !DILocation(line: 126, column: 20, scope: !127)
!159 = !DILocation(line: 126, column: 25, scope: !127)
!160 = !DILocation(line: 126, column: 34, scope: !127)
!161 = !DILocation(line: 126, column: 55, scope: !127)
!162 = !DILocation(line: 127, column: 5, scope: !127)
!163 = !DILocation(line: 127, column: 9, scope: !127)
!164 = !DILocation(line: 127, column: 15, scope: !127)
!165 = !{!"element i32", !151, i64 0}
!166 = !{!165, !165, i64 0}
!167 = !DILocation(line: 127, column: 27, scope: !127)
!168 = !DILocation(line: 127, column: 30, scope: !127)
!169 = !DILocation(line: 128, column: 7, scope: !127)
!170 = !DILocation(line: 128, column: 13, scope: !127)
!171 = !DILocation(line: 128, column: 23, scope: !127)
!172 = !DILocation(line: 129, column: 7, scope: !127)
!173 = !DILocation(line: 131, column: 5, scope: !127)
!174 = !DILocation(line: 131, column: 14, scope: !127)
!175 = !DILocation(line: 131, column: 15, scope: !127)
!176 = !DILocation(line: 131, column: 24, scope: !127)
!177 = !DILocation(line: 131, column: 29, scope: !127)
!178 = !{null, !23}
!179 = !DISubroutineType(types: !178)
!180 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 151, type: !179, scopeLine: 151, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!181 = !DILocation(line: 151, column: 1, scope: !180)
!182 = !DILocalVariable(name: "hashes", arg: 1, scope: !180, file: !13, line: 151, type: !23)
!183 = !DILocation(line: 152, column: 3, scope: !180)
!184 = !DILocation(line: 152, column: 16, scope: !180)
!185 = !DILocation(line: 152, column: 22, scope: !180)
!186 = !DILocalVariable(name: "used", scope: !180, file: !13, line: 152, type: !4)
!187 = !DILocation(line: 153, column: 3, scope: !180)
!188 = !DILocation(line: 153, column: 17, scope: !180)
!189 = !DILocalVariable(name: "to", scope: !180, file: !13, line: 153, type: !4)
!190 = !DILocation(line: 154, column: 3, scope: !180)
!191 = !DILocation(line: 154, column: 24, scope: !180)
!192 = !DILocalVariable(name: "from", scope: !180, file: !13, line: 154, type: !4)
!193 = !DILocation(line: 155, column: 15, scope: !180)
!194 = !DILocation(line: 154, column: 27, scope: !180)
!195 = !DILocation(line: 154, column: 34, scope: !180)
!196 = !DILocation(line: 154, column: 48, scope: !180)
!197 = !DILocation(line: 155, column: 5, scope: !180)
!198 = !DILocation(line: 155, column: 22, scope: !180)
!199 = !DILocalVariable(name: "h", scope: !180, file: !13, line: 155, type: !19)
!200 = !DILocation(line: 156, column: 5, scope: !180)
!201 = !DILocation(line: 156, column: 9, scope: !180)
!202 = !DILocation(line: 156, column: 15, scope: !180)
!203 = !DILocation(line: 156, column: 20, scope: !180)
!204 = !DILocation(line: 156, column: 26, scope: !180)
!205 = !DILocation(line: 156, column: 31, scope: !180)
!206 = !DILocation(line: 156, column: 36, scope: !180)
!207 = !DILocation(line: 156, column: 42, scope: !180)
!208 = !DILocation(line: 157, column: 7, scope: !180)
!209 = !DILocation(line: 157, column: 14, scope: !180)
!210 = !DILocation(line: 157, column: 20, scope: !180)
!211 = !DILocation(line: 158, column: 7, scope: !180)
!212 = !DILocation(line: 154, column: 40, scope: !180)
!213 = !DILocation(line: 161, column: 3, scope: !180)
!214 = !DILocation(line: 161, column: 10, scope: !180)
!215 = !DILocation(line: 161, column: 16, scope: !180)
!216 = !DILocation(line: 161, column: 33, scope: !180)
!217 = !DILocation(line: 161, column: 37, scope: !180)
!218 = !DILocation(line: 162, column: 5, scope: !180)
!219 = !{!23, !23, !4, !4}
!220 = !DISubroutineType(types: !219)
!221 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 173, type: !220, scopeLine: 173, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!222 = !DILocation(line: 173, column: 1, scope: !221)
!223 = !DILocalVariable(name: "slots", arg: 1, scope: !221, file: !13, line: 173, type: !23)
!224 = !DILocalVariable(name: "live", arg: 2, scope: !221, file: !13, line: 173, type: !4)
!225 = !DILocalVariable(name: "used", arg: 3, scope: !221, file: !13, line: 173, type: !4)
!226 = !DILocation(line: 174, column: 3, scope: !221)
!227 = !DILocation(line: 174, column: 13, scope: !221)
!228 = !DILocation(line: 174, column: 19, scope: !221)
!229 = !DILocalVariable(name: "n", scope: !221, file: !13, line: 174, type: !4)
!230 = !DILocation(line: 175, column: 3, scope: !221)
!231 = !DILocation(line: 175, column: 7, scope: !221)
!232 = !DILocation(line: 175, column: 14, scope: !221)
!233 = !DILocation(line: 175, column: 18, scope: !221)
!234 = !DILocation(line: 175, column: 24, scope: !221)
!235 = !DILocation(line: 176, column: 5, scope: !221)
!236 = !DILocation(line: 176, column: 16, scope: !221)
!237 = !DILocation(line: 177, column: 5, scope: !221)
!238 = !DILocation(line: 177, column: 12, scope: !221)
!239 = !DILocation(line: 179, column: 3, scope: !221)
!240 = !DILocation(line: 179, column: 10, scope: !221)
!241 = !DILocation(line: 179, column: 25, scope: !221)
!242 = !DILocation(line: 179, column: 29, scope: !221)
!243 = !{!154, !152, i64 8}
!244 = !{null, !23, !23}
!245 = !DISubroutineType(types: !244)
!246 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 187, type: !245, scopeLine: 187, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!247 = !DILocation(line: 187, column: 1, scope: !246)
!248 = !DILocalVariable(name: "slots", arg: 1, scope: !246, file: !13, line: 187, type: !23)
!249 = !DILocalVariable(name: "hashes", arg: 2, scope: !246, file: !13, line: 187, type: !23)
!250 = !DILocation(line: 188, column: 3, scope: !246)
!251 = !DILocation(line: 188, column: 16, scope: !246)
!252 = !DILocation(line: 188, column: 22, scope: !246)
!253 = !DILocation(line: 188, column: 38, scope: !246)
!254 = !DILocalVariable(name: "mask", scope: !246, file: !13, line: 188, type: !4)
!255 = !DILocation(line: 189, column: 3, scope: !246)
!256 = !DILocation(line: 189, column: 21, scope: !246)
!257 = !DILocalVariable(name: "i", scope: !246, file: !13, line: 189, type: !4)
!258 = !DILocation(line: 189, column: 34, scope: !246)
!259 = !DILocation(line: 189, column: 24, scope: !246)
!260 = !DILocation(line: 189, column: 28, scope: !246)
!261 = !DILocation(line: 189, column: 55, scope: !246)
!262 = !DILocation(line: 190, column: 5, scope: !246)
!263 = !DILocation(line: 190, column: 15, scope: !246)
!264 = !DILocation(line: 190, column: 22, scope: !246)
!265 = !DILocalVariable(name: "h", scope: !246, file: !13, line: 190, type: !19)
!266 = !DILocation(line: 191, column: 5, scope: !246)
!267 = !DILocation(line: 191, column: 9, scope: !246)
!268 = !DILocation(line: 191, column: 15, scope: !246)
!269 = !DILocation(line: 191, column: 18, scope: !246)
!270 = !DILocation(line: 192, column: 7, scope: !246)
!271 = !DILocation(line: 192, column: 17, scope: !246)
!272 = !DILocation(line: 192, column: 24, scope: !246)
!273 = !DILocation(line: 192, column: 30, scope: !246)
!274 = !DILocation(line: 192, column: 33, scope: !246)
!275 = !DILocation(line: 189, column: 50, scope: !246)
!276 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 218, type: !179, scopeLine: 218, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!277 = !DILocation(line: 218, column: 1, scope: !276)
!278 = !DILocalVariable(name: "slots", arg: 1, scope: !276, file: !13, line: 218, type: !23)
!279 = !DILocation(line: 219, column: 3, scope: !276)
!280 = !DILocation(line: 219, column: 21, scope: !276)
!281 = !DILocalVariable(name: "i", scope: !276, file: !13, line: 219, type: !4)
!282 = !DILocation(line: 219, column: 34, scope: !276)
!283 = !DILocation(line: 219, column: 24, scope: !276)
!284 = !DILocation(line: 219, column: 28, scope: !276)
!285 = !DILocation(line: 219, column: 54, scope: !276)
!286 = !DILocation(line: 220, column: 5, scope: !276)
!287 = !DILocation(line: 220, column: 11, scope: !276)
!288 = !DILocation(line: 220, column: 16, scope: !276)
!289 = !DILocation(line: 219, column: 49, scope: !276)
!290 = !{!4, !23, !4}
!291 = !DISubroutineType(types: !290)
!292 = distinct !DISubprogram(name: "nextLive", linkageName: "nish.nextLive", scope: !13, file: !13, line: 231, type: !291, scopeLine: 231, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!293 = !DILocation(line: 231, column: 1, scope: !292)
!294 = !DILocalVariable(name: "hashes", arg: 1, scope: !292, file: !13, line: 231, type: !23)
!295 = !DILocalVariable(name: "from", arg: 2, scope: !292, file: !13, line: 231, type: !4)
!296 = !DILocation(line: 232, column: 3, scope: !292)
!297 = !DILocation(line: 232, column: 21, scope: !292)
!298 = !DILocalVariable(name: "i", scope: !292, file: !13, line: 232, type: !4)
!299 = !DILocation(line: 232, column: 47, scope: !292)
!300 = !DILocation(line: 232, column: 27, scope: !292)
!301 = !DILocation(line: 232, column: 32, scope: !292)
!302 = !DILocation(line: 232, column: 37, scope: !292)
!303 = !DILocation(line: 232, column: 41, scope: !292)
!304 = !DILocation(line: 232, column: 68, scope: !292)
!305 = !DILocation(line: 233, column: 5, scope: !292)
!306 = !DILocation(line: 233, column: 9, scope: !292)
!307 = !DILocation(line: 233, column: 16, scope: !292)
!308 = !DILocation(line: 233, column: 23, scope: !292)
!309 = !DILocation(line: 233, column: 26, scope: !292)
!310 = !DILocation(line: 234, column: 7, scope: !292)
!311 = !DILocation(line: 234, column: 14, scope: !292)
!312 = !DILocation(line: 232, column: 63, scope: !292)
!313 = !DILocation(line: 237, column: 3, scope: !292)
!314 = !DILocation(line: 237, column: 10, scope: !292)
!315 = !DILocation(line: 237, column: 11, scope: !292)
!316 = !{null, !23, !4, !4, !19, !4}
!317 = !DISubroutineType(types: !316)
!318 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 252, type: !317, scopeLine: 252, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!319 = !DILocation(line: 252, column: 1, scope: !318)
!320 = !DILocalVariable(name: "slots", arg: 1, scope: !318, file: !13, line: 252, type: !23)
!321 = !DILocalVariable(name: "mask", arg: 2, scope: !318, file: !13, line: 252, type: !4)
!322 = !DILocalVariable(name: "bucket", arg: 3, scope: !318, file: !13, line: 252, type: !4)
!323 = !DILocalVariable(name: "h", arg: 4, scope: !318, file: !13, line: 252, type: !19)
!324 = !DILocalVariable(name: "used", arg: 5, scope: !318, file: !13, line: 252, type: !4)
!325 = !DILocation(line: 253, column: 3, scope: !318)
!326 = !DILocation(line: 253, column: 7, scope: !318)
!327 = !DILocation(line: 253, column: 17, scope: !318)
!328 = !DILocation(line: 253, column: 22, scope: !318)
!329 = !DILocation(line: 253, column: 31, scope: !318)
!330 = !DILocation(line: 253, column: 37, scope: !318)
!331 = !DILocation(line: 253, column: 52, scope: !318)
!332 = !DILocation(line: 254, column: 5, scope: !318)
!333 = !DILocation(line: 254, column: 11, scope: !318)
!334 = !DILocation(line: 254, column: 21, scope: !318)
!335 = !DILocation(line: 254, column: 30, scope: !318)
!336 = !DILocation(line: 254, column: 33, scope: !318)
!337 = !DILocation(line: 254, column: 40, scope: !318)
!338 = !DILocation(line: 255, column: 10, scope: !318)
!339 = !DILocation(line: 256, column: 5, scope: !318)
!340 = !DILocation(line: 256, column: 15, scope: !318)
!341 = !DILocation(line: 256, column: 22, scope: !318)
!342 = !DILocation(line: 256, column: 28, scope: !318)
!343 = !DILocation(line: 256, column: 31, scope: !318)
!344 = !DILocation(line: 256, column: 38, scope: !318)
!345 = !{null, !12}
!346 = !DISubroutineType(types: !345)
!347 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 286, type: !346, scopeLine: 286, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!348 = !DILocation(line: 286, column: 3, scope: !347)
!349 = !DILocalVariable(name: "this", arg: 1, scope: !347, file: !13, line: 286, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!350 = !{!"i32", !151, i64 0}
!351 = !{!"ptr", !151, i64 0}
!352 = !{!"Map$str$i32", !350, i64 0, !351, i64 8, !350, i64 16, !350, i64 20, !351, i64 24, !351, i64 32, !351, i64 40, !350, i64 48}
!353 = !{!352, !350, i64 0}
!354 = !{!352, !350, i64 16}
!355 = !{!352, !350, i64 20}
!356 = !{!352, !350, i64 48}
!357 = !DILocation(line: 287, column: 5, scope: !347)
!358 = !DILocation(line: 287, column: 18, scope: !347)
!359 = !DILocation(line: 287, column: 33, scope: !347)
!360 = !{!352, !351, i64 8}
!361 = !DILocation(line: 288, column: 5, scope: !347)
!362 = !DILocation(line: 288, column: 22, scope: !347)
!363 = !{!352, !351, i64 24}
!364 = !DILocation(line: 289, column: 5, scope: !347)
!365 = !DILocation(line: 289, column: 24, scope: !347)
!366 = !{!352, !351, i64 32}
!367 = !DILocation(line: 290, column: 5, scope: !347)
!368 = !DILocation(line: 290, column: 24, scope: !347)
!369 = !{!352, !351, i64 40}
!370 = !{!16, !12, !31}
!371 = !DISubroutineType(types: !370)
!372 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 294, type: !371, scopeLine: 294, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!373 = !DILocation(line: 294, column: 3, scope: !372)
!374 = !DILocalVariable(name: "this", arg: 1, scope: !372, file: !13, line: 294, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!375 = !DILocalVariable(name: "key", arg: 2, scope: !372, file: !13, line: 294, type: !31)
!376 = !DILocation(line: 295, column: 5, scope: !372)
!377 = !DILocation(line: 295, column: 12, scope: !372)
!378 = !DILocation(line: 295, column: 23, scope: !372)
!379 = !DILocation(line: 295, column: 35, scope: !372)
!380 = !DILocation(line: 295, column: 46, scope: !372)
!381 = !DILocation(line: 295, column: 64, scope: !372)
!382 = !DILocation(line: 295, column: 80, scope: !372)
!383 = !{!12, !12, !31, !4}
!384 = !DISubroutineType(types: !383)
!385 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 303, type: !384, scopeLine: 303, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!386 = !DILocation(line: 303, column: 3, scope: !385)
!387 = !DILocalVariable(name: "this", arg: 1, scope: !385, file: !13, line: 303, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!388 = !DILocalVariable(name: "key", arg: 2, scope: !385, file: !13, line: 303, type: !31)
!389 = !DILocalVariable(name: "value", arg: 3, scope: !385, file: !13, line: 303, type: !4)
!390 = !DILocation(line: 304, column: 5, scope: !385)
!391 = !DILocation(line: 304, column: 19, scope: !385)
!392 = !DILocation(line: 304, column: 30, scope: !385)
!393 = !DILocalVariable(name: "found", scope: !385, file: !13, line: 304, type: !16)
!394 = !DILocation(line: 305, column: 5, scope: !385)
!395 = !DILocation(line: 305, column: 9, scope: !385)
!396 = !DILocation(line: 305, column: 18, scope: !385)
!397 = !DILocation(line: 305, column: 21, scope: !385)
!398 = !DILocation(line: 306, column: 7, scope: !385)
!399 = !DILocation(line: 306, column: 23, scope: !385)
!400 = !DILocation(line: 306, column: 29, scope: !385)
!401 = !DILocation(line: 306, column: 37, scope: !385)
!402 = !DILocation(line: 307, column: 12, scope: !385)
!403 = !DILocation(line: 308, column: 7, scope: !385)
!404 = !DILocation(line: 308, column: 21, scope: !385)
!405 = !DILocation(line: 308, column: 28, scope: !385)
!406 = !DILocation(line: 308, column: 33, scope: !385)
!407 = !DILocation(line: 310, column: 5, scope: !385)
!408 = !DILocation(line: 310, column: 12, scope: !385)
!409 = distinct !DISubprogram(name: "Map<string, i32>.walkOpen", linkageName: "nish.Map$str$i32.walkOpen", scope: !13, file: !13, line: 348, type: !346, scopeLine: 348, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!410 = !DILocation(line: 348, column: 3, scope: !409)
!411 = !DILocalVariable(name: "this", arg: 1, scope: !409, file: !13, line: 348, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!412 = !DILocation(line: 349, column: 5, scope: !409)
!413 = !DILocation(line: 349, column: 18, scope: !409)
!414 = !DILocation(line: 349, column: 31, scope: !409)
!415 = !{!4, !12, !4}
!416 = !DISubroutineType(types: !415)
!417 = distinct !DISubprogram(name: "Map<string, i32>.walkNext", linkageName: "nish.Map$str$i32.walkNext", scope: !13, file: !13, line: 352, type: !416, scopeLine: 352, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!418 = !DILocation(line: 352, column: 3, scope: !417)
!419 = !DILocalVariable(name: "this", arg: 1, scope: !417, file: !13, line: 352, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!420 = !DILocalVariable(name: "from", arg: 2, scope: !417, file: !13, line: 352, type: !4)
!421 = !DILocation(line: 353, column: 5, scope: !417)
!422 = !DILocation(line: 353, column: 12, scope: !417)
!423 = !DILocation(line: 353, column: 21, scope: !417)
!424 = !DILocation(line: 353, column: 39, scope: !417)
!425 = distinct !DISubprogram(name: "Map<string, i32>.walkClose", linkageName: "nish.Map$str$i32.walkClose", scope: !13, file: !13, line: 356, type: !346, scopeLine: 356, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!426 = !DILocation(line: 356, column: 3, scope: !425)
!427 = !DILocalVariable(name: "this", arg: 1, scope: !425, file: !13, line: 356, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!428 = !DILocation(line: 357, column: 5, scope: !425)
!429 = !DILocation(line: 357, column: 18, scope: !425)
!430 = !DILocation(line: 357, column: 31, scope: !425)
!431 = !{!31, !12, !4}
!432 = !DISubroutineType(types: !431)
!433 = distinct !DISubprogram(name: "Map<string, i32>.keyAt", linkageName: "nish.Map$str$i32.keyAt", scope: !13, file: !13, line: 361, type: !432, scopeLine: 361, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!434 = !DILocation(line: 361, column: 3, scope: !433)
!435 = !DILocalVariable(name: "this", arg: 1, scope: !433, file: !13, line: 361, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!436 = !DILocalVariable(name: "index", arg: 2, scope: !433, file: !13, line: 361, type: !4)
!437 = !DILocation(line: 362, column: 5, scope: !433)
!438 = !DILocation(line: 362, column: 9, scope: !433)
!439 = !DILocation(line: 362, column: 17, scope: !433)
!440 = !DILocation(line: 362, column: 22, scope: !433)
!441 = !DILocation(line: 362, column: 31, scope: !433)
!442 = !DILocation(line: 362, column: 37, scope: !433)
!443 = !DILocation(line: 362, column: 61, scope: !433)
!444 = !DILocation(line: 363, column: 7, scope: !433)
!445 = !DILocation(line: 363, column: 13, scope: !433)
!446 = !DILocation(line: 365, column: 5, scope: !433)
!447 = !DILocation(line: 365, column: 12, scope: !433)
!448 = !DILocation(line: 365, column: 27, scope: !433)
!449 = !{!"element ptr", !151, i64 0}
!450 = !{!449, !449, i64 0}
!451 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 369, type: !416, scopeLine: 369, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!452 = !DILocation(line: 369, column: 3, scope: !451)
!453 = !DILocalVariable(name: "this", arg: 1, scope: !451, file: !13, line: 369, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!454 = !DILocalVariable(name: "index", arg: 2, scope: !451, file: !13, line: 369, type: !4)
!455 = !DILocation(line: 370, column: 5, scope: !451)
!456 = !DILocation(line: 370, column: 9, scope: !451)
!457 = !DILocation(line: 370, column: 17, scope: !451)
!458 = !DILocation(line: 370, column: 22, scope: !451)
!459 = !DILocation(line: 370, column: 31, scope: !451)
!460 = !DILocation(line: 370, column: 37, scope: !451)
!461 = !DILocation(line: 370, column: 63, scope: !451)
!462 = !DILocation(line: 371, column: 7, scope: !451)
!463 = !DILocation(line: 371, column: 13, scope: !451)
!464 = !DILocation(line: 373, column: 5, scope: !451)
!465 = !DILocation(line: 373, column: 12, scope: !451)
!466 = !DILocation(line: 373, column: 29, scope: !451)
!467 = !{null, !12, !4, !4}
!468 = !DISubroutineType(types: !467)
!469 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 377, type: !468, scopeLine: 377, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!470 = !DILocation(line: 377, column: 3, scope: !469)
!471 = !DILocalVariable(name: "this", arg: 1, scope: !469, file: !13, line: 377, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!472 = !DILocalVariable(name: "index", arg: 2, scope: !469, file: !13, line: 377, type: !4)
!473 = !DILocalVariable(name: "value", arg: 3, scope: !469, file: !13, line: 377, type: !4)
!474 = !DILocation(line: 378, column: 5, scope: !469)
!475 = !DILocation(line: 378, column: 9, scope: !469)
!476 = !DILocation(line: 378, column: 18, scope: !469)
!477 = !DILocation(line: 378, column: 23, scope: !469)
!478 = !DILocation(line: 378, column: 31, scope: !469)
!479 = !DILocation(line: 378, column: 37, scope: !469)
!480 = !DILocation(line: 378, column: 63, scope: !469)
!481 = !DILocation(line: 379, column: 7, scope: !469)
!482 = !DILocation(line: 379, column: 24, scope: !469)
!483 = !DILocation(line: 379, column: 33, scope: !469)
!484 = !{null, !12, !16, !31, !4}
!485 = !DISubroutineType(types: !484)
!486 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 384, type: !485, scopeLine: 384, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!487 = !DILocation(line: 384, column: 3, scope: !486)
!488 = !DILocalVariable(name: "this", arg: 1, scope: !486, file: !13, line: 384, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!489 = !DILocalVariable(name: "absent", arg: 2, scope: !486, file: !13, line: 384, type: !16)
!490 = !DILocalVariable(name: "key", arg: 3, scope: !486, file: !13, line: 384, type: !31)
!491 = !DILocalVariable(name: "value", arg: 4, scope: !486, file: !13, line: 384, type: !4)
!492 = !DILocation(line: 385, column: 5, scope: !486)
!493 = !DILocation(line: 385, column: 20, scope: !486)
!494 = !DILocation(line: 385, column: 21, scope: !486)
!495 = !DILocation(line: 385, column: 25, scope: !486)
!496 = !DILocalVariable(name: "packed", scope: !486, file: !13, line: 385, type: !16)
!497 = !DILocation(line: 386, column: 5, scope: !486)
!498 = !DILocation(line: 386, column: 18, scope: !486)
!499 = !DILocation(line: 386, column: 24, scope: !486)
!500 = !DILocalVariable(name: "bucket", scope: !486, file: !13, line: 386, type: !4)
!501 = !DILocation(line: 387, column: 5, scope: !486)
!502 = !DILocation(line: 387, column: 15, scope: !486)
!503 = !DILocation(line: 387, column: 21, scope: !486)
!504 = !DILocalVariable(name: "h", scope: !486, file: !13, line: 387, type: !19)
!505 = !DILocation(line: 388, column: 5, scope: !486)
!506 = !DILocation(line: 388, column: 9, scope: !486)
!507 = !DILocation(line: 388, column: 15, scope: !486)
!508 = !DILocation(line: 388, column: 41, scope: !486)
!509 = !DILocation(line: 388, column: 52, scope: !486)
!510 = !DILocation(line: 391, column: 7, scope: !486)
!511 = !DILocation(line: 391, column: 11, scope: !486)
!512 = !DILocation(line: 391, column: 24, scope: !486)
!513 = !DILocation(line: 391, column: 37, scope: !486)
!514 = !DILocation(line: 391, column: 50, scope: !486)
!515 = !DILocation(line: 391, column: 53, scope: !486)
!516 = !DILocation(line: 392, column: 9, scope: !486)
!517 = !DILocation(line: 392, column: 15, scope: !486)
!518 = !DILocation(line: 394, column: 7, scope: !486)
!519 = !DILocation(line: 395, column: 7, scope: !486)
!520 = !DILocation(line: 395, column: 16, scope: !486)
!521 = !DILocation(line: 395, column: 17, scope: !486)
!522 = !DILocation(line: 397, column: 5, scope: !486)
!523 = !DILocation(line: 397, column: 25, scope: !486)
!524 = !DILocation(line: 398, column: 5, scope: !486)
!525 = !DILocation(line: 398, column: 27, scope: !486)
!526 = !DILocation(line: 399, column: 5, scope: !486)
!527 = !DILocation(line: 399, column: 27, scope: !486)
!528 = !DILocation(line: 400, column: 5, scope: !486)
!529 = !DILocation(line: 400, column: 17, scope: !486)
!530 = !DILocation(line: 400, column: 29, scope: !486)
!531 = !DILocation(line: 401, column: 5, scope: !486)
!532 = !DILocation(line: 401, column: 17, scope: !486)
!533 = !DILocation(line: 401, column: 29, scope: !486)
!534 = !DILocation(line: 404, column: 5, scope: !486)
!535 = !DILocation(line: 404, column: 18, scope: !486)
!536 = !DILocation(line: 404, column: 24, scope: !486)
!537 = !DILocalVariable(name: "used", scope: !486, file: !13, line: 404, type: !4)
!538 = !DILocation(line: 405, column: 5, scope: !486)
!539 = !DILocation(line: 405, column: 9, scope: !486)
!540 = !DILocation(line: 405, column: 16, scope: !486)
!541 = !DILocation(line: 405, column: 20, scope: !486)
!542 = !DILocation(line: 405, column: 26, scope: !486)
!543 = !DILocation(line: 405, column: 47, scope: !486)
!544 = !DILocation(line: 405, column: 50, scope: !486)
!545 = !DILocation(line: 406, column: 7, scope: !486)
!546 = !DILocation(line: 407, column: 12, scope: !486)
!547 = !DILocation(line: 408, column: 7, scope: !486)
!548 = !DILocation(line: 408, column: 20, scope: !486)
!549 = !DILocation(line: 408, column: 32, scope: !486)
!550 = !DILocation(line: 408, column: 43, scope: !486)
!551 = !DILocation(line: 408, column: 51, scope: !486)
!552 = !DILocation(line: 408, column: 54, scope: !486)
!553 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 417, type: !346, scopeLine: 417, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!554 = !DILocation(line: 417, column: 3, scope: !553)
!555 = !DILocalVariable(name: "this", arg: 1, scope: !553, file: !13, line: 417, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!556 = !DILocation(line: 418, column: 5, scope: !553)
!557 = !DILocation(line: 418, column: 18, scope: !553)
!558 = !DILocation(line: 418, column: 24, scope: !553)
!559 = !DILocalVariable(name: "used", scope: !553, file: !13, line: 418, type: !4)
!560 = !DILocation(line: 419, column: 5, scope: !553)
!561 = !DILocation(line: 419, column: 21, scope: !553)
!562 = !DILocation(line: 419, column: 34, scope: !553)
!563 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!564 = !DILocalVariable(name: "walking", scope: !553, file: !13, line: 419, type: !563)
!565 = !DILocation(line: 420, column: 5, scope: !553)
!566 = !DILocation(line: 420, column: 19, scope: !553)
!567 = !DILocation(line: 420, column: 32, scope: !553)
!568 = !DILocation(line: 420, column: 44, scope: !553)
!569 = !DILocation(line: 420, column: 54, scope: !553)
!570 = !DILocation(line: 420, column: 61, scope: !553)
!571 = !DILocation(line: 420, column: 72, scope: !553)
!572 = !DILocalVariable(name: "slots", scope: !553, file: !13, line: 420, type: !23)
!573 = !DILocation(line: 421, column: 5, scope: !553)
!574 = !DILocation(line: 421, column: 9, scope: !553)
!575 = !DILocation(line: 421, column: 10, scope: !553)
!576 = !DILocation(line: 421, column: 21, scope: !553)
!577 = !DILocation(line: 421, column: 33, scope: !553)
!578 = !DILocation(line: 421, column: 39, scope: !553)
!579 = !DILocation(line: 422, column: 7, scope: !553)
!580 = !DILocation(line: 422, column: 22, scope: !553)
!581 = !DILocation(line: 422, column: 38, scope: !553)
!582 = !DILocation(line: 423, column: 7, scope: !553)
!583 = !DILocation(line: 423, column: 22, scope: !553)
!584 = !DILocation(line: 423, column: 40, scope: !553)
!585 = !DILocation(line: 424, column: 7, scope: !553)
!586 = !DILocation(line: 424, column: 21, scope: !553)
!587 = !DILocation(line: 426, column: 5, scope: !553)
!588 = !DILocation(line: 426, column: 18, scope: !553)
!589 = !DILocation(line: 427, column: 5, scope: !553)
!590 = !DILocation(line: 427, column: 17, scope: !553)
!591 = !DILocation(line: 427, column: 23, scope: !553)
!592 = !DILocation(line: 427, column: 39, scope: !553)
!593 = !DILocation(line: 428, column: 5, scope: !553)
!594 = !DILocation(line: 428, column: 12, scope: !553)
!595 = !DILocation(line: 428, column: 19, scope: !553)
!596 = !{!16, !23, !4, !23, !35, !31}
!597 = !DISubroutineType(types: !596)
!598 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 96, type: !597, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!599 = !DILocation(line: 96, column: 1, scope: !598)
!600 = !DILocalVariable(name: "slots", arg: 1, scope: !598, file: !13, line: 96, type: !23)
!601 = !DILocalVariable(name: "mask", arg: 2, scope: !598, file: !13, line: 96, type: !4)
!602 = !DILocalVariable(name: "hashes", arg: 3, scope: !598, file: !13, line: 96, type: !23)
!603 = !DILocalVariable(name: "keys", arg: 4, scope: !598, file: !13, line: 96, type: !35)
!604 = !DILocalVariable(name: "key", arg: 5, scope: !598, file: !13, line: 96, type: !31)
!605 = !DILocation(line: 97, column: 3, scope: !598)
!606 = !DILocation(line: 97, column: 13, scope: !598)
!607 = !DILocation(line: 97, column: 21, scope: !598)
!608 = !DILocalVariable(name: "h", scope: !598, file: !13, line: 97, type: !19)
!609 = !DILocation(line: 98, column: 3, scope: !598)
!610 = !DILocation(line: 98, column: 23, scope: !598)
!611 = !DILocalVariable(name: "fingerprint", scope: !598, file: !13, line: 98, type: !19)
!612 = !DILocation(line: 99, column: 3, scope: !598)
!613 = !DILocation(line: 99, column: 16, scope: !598)
!614 = !DILocation(line: 99, column: 27, scope: !598)
!615 = !DILocation(line: 99, column: 30, scope: !598)
!616 = !DILocalVariable(name: "bucket", scope: !598, file: !13, line: 99, type: !4)
!617 = !DILocation(line: 102, column: 3, scope: !598)
!618 = !DILocation(line: 102, column: 40, scope: !598)
!619 = !DILocation(line: 109, column: 33, scope: !598)
!620 = !DILocation(line: 109, column: 82, scope: !598)
!621 = !DILocation(line: 102, column: 10, scope: !598)
!622 = !DILocation(line: 102, column: 20, scope: !598)
!623 = !DILocation(line: 102, column: 25, scope: !598)
!624 = !DILocation(line: 102, column: 34, scope: !598)
!625 = !DILocation(line: 102, column: 55, scope: !598)
!626 = !DILocation(line: 103, column: 5, scope: !598)
!627 = !DILocation(line: 103, column: 18, scope: !598)
!628 = !DILocation(line: 103, column: 24, scope: !598)
!629 = !DILocalVariable(name: "word", scope: !598, file: !13, line: 103, type: !19)
!630 = !DILocation(line: 104, column: 5, scope: !598)
!631 = !DILocation(line: 104, column: 9, scope: !598)
!632 = !DILocation(line: 104, column: 18, scope: !598)
!633 = !DILocation(line: 104, column: 21, scope: !598)
!634 = !DILocation(line: 105, column: 7, scope: !598)
!635 = !DILocation(line: 105, column: 14, scope: !598)
!636 = !DILocation(line: 105, column: 23, scope: !598)
!637 = !DILocation(line: 105, column: 31, scope: !598)
!638 = !DILocation(line: 107, column: 5, scope: !598)
!639 = !DILocation(line: 107, column: 9, scope: !598)
!640 = !DILocation(line: 107, column: 25, scope: !598)
!641 = !DILocation(line: 107, column: 38, scope: !598)
!642 = !DILocation(line: 108, column: 7, scope: !598)
!643 = !DILocation(line: 108, column: 18, scope: !598)
!644 = !DILocation(line: 108, column: 24, scope: !598)
!645 = !DILocation(line: 108, column: 31, scope: !598)
!646 = !DILocation(line: 108, column: 43, scope: !598)
!647 = !DILocalVariable(name: "at", scope: !598, file: !13, line: 108, type: !4)
!648 = !DILocation(line: 109, column: 7, scope: !598)
!649 = !DILocation(line: 109, column: 11, scope: !598)
!650 = !DILocation(line: 109, column: 17, scope: !598)
!651 = !DILocation(line: 109, column: 22, scope: !598)
!652 = !DILocation(line: 109, column: 27, scope: !598)
!653 = !DILocation(line: 109, column: 51, scope: !598)
!654 = !DILocation(line: 109, column: 58, scope: !598)
!655 = !DILocation(line: 109, column: 66, scope: !598)
!656 = !DILocation(line: 109, column: 71, scope: !598)
!657 = !DILocation(line: 109, column: 76, scope: !598)
!658 = !DILocation(line: 109, column: 98, scope: !598)
!659 = !DILocation(line: 109, column: 106, scope: !598)
!660 = !DILocation(line: 109, column: 111, scope: !598)
!661 = !DILocation(line: 109, column: 116, scope: !598)
!662 = !DILocation(line: 109, column: 122, scope: !598)
!663 = !DILocation(line: 110, column: 9, scope: !598)
!664 = !DILocation(line: 110, column: 16, scope: !598)
!665 = !DILocation(line: 110, column: 24, scope: !598)
!666 = !DILocation(line: 110, column: 32, scope: !598)
!667 = !DILocation(line: 113, column: 5, scope: !598)
!668 = !DILocation(line: 113, column: 14, scope: !598)
!669 = !DILocation(line: 113, column: 15, scope: !598)
!670 = !DILocation(line: 113, column: 24, scope: !598)
!671 = !DILocation(line: 113, column: 29, scope: !598)
!672 = !DILocation(line: 115, column: 3, scope: !598)
!673 = !DILocation(line: 115, column: 9, scope: !598)
!674 = !{null, !35, !23}
!675 = !DISubroutineType(types: !674)
!676 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 136, type: !675, scopeLine: 136, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!677 = !DILocation(line: 136, column: 1, scope: !676)
!678 = !DILocalVariable(name: "items", arg: 1, scope: !676, file: !13, line: 136, type: !35)
!679 = !DILocalVariable(name: "hashes", arg: 2, scope: !676, file: !13, line: 136, type: !23)
!680 = !DILocation(line: 137, column: 3, scope: !676)
!681 = !DILocation(line: 137, column: 16, scope: !676)
!682 = !DILocation(line: 137, column: 22, scope: !676)
!683 = !DILocalVariable(name: "used", scope: !676, file: !13, line: 137, type: !4)
!684 = !DILocation(line: 138, column: 3, scope: !676)
!685 = !DILocation(line: 138, column: 17, scope: !676)
!686 = !DILocalVariable(name: "to", scope: !676, file: !13, line: 138, type: !4)
!687 = !DILocation(line: 139, column: 3, scope: !676)
!688 = !DILocation(line: 139, column: 24, scope: !676)
!689 = !DILocalVariable(name: "from", scope: !676, file: !13, line: 139, type: !4)
!690 = !DILocation(line: 139, column: 55, scope: !676)
!691 = !DILocation(line: 140, column: 68, scope: !676)
!692 = !DILocation(line: 139, column: 27, scope: !676)
!693 = !DILocation(line: 139, column: 34, scope: !676)
!694 = !DILocation(line: 139, column: 42, scope: !676)
!695 = !DILocation(line: 139, column: 49, scope: !676)
!696 = !DILocation(line: 139, column: 79, scope: !676)
!697 = !DILocation(line: 140, column: 5, scope: !676)
!698 = !DILocation(line: 140, column: 9, scope: !676)
!699 = !DILocation(line: 140, column: 16, scope: !676)
!700 = !DILocation(line: 140, column: 26, scope: !676)
!701 = !DILocation(line: 140, column: 31, scope: !676)
!702 = !DILocation(line: 140, column: 37, scope: !676)
!703 = !DILocation(line: 140, column: 42, scope: !676)
!704 = !DILocation(line: 140, column: 47, scope: !676)
!705 = !DILocation(line: 140, column: 55, scope: !676)
!706 = !DILocation(line: 140, column: 62, scope: !676)
!707 = !DILocation(line: 140, column: 83, scope: !676)
!708 = !DILocation(line: 141, column: 7, scope: !676)
!709 = !DILocation(line: 141, column: 13, scope: !676)
!710 = !DILocation(line: 141, column: 19, scope: !676)
!711 = !DILocation(line: 141, column: 25, scope: !676)
!712 = !DILocation(line: 142, column: 7, scope: !676)
!713 = !DILocation(line: 139, column: 71, scope: !676)
!714 = !DILocation(line: 145, column: 3, scope: !676)
!715 = !DILocation(line: 145, column: 10, scope: !676)
!716 = !DILocation(line: 145, column: 16, scope: !676)
!717 = !DILocation(line: 145, column: 32, scope: !676)
!718 = !DILocation(line: 145, column: 36, scope: !676)
!719 = !DILocation(line: 146, column: 5, scope: !676)
!720 = !{null, !43, !23}
!721 = !DISubroutineType(types: !720)
!722 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 136, type: !721, scopeLine: 136, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!723 = !DILocation(line: 136, column: 1, scope: !722)
!724 = !DILocalVariable(name: "items", arg: 1, scope: !722, file: !13, line: 136, type: !43)
!725 = !DILocalVariable(name: "hashes", arg: 2, scope: !722, file: !13, line: 136, type: !23)
!726 = !DILocation(line: 137, column: 3, scope: !722)
!727 = !DILocation(line: 137, column: 16, scope: !722)
!728 = !DILocation(line: 137, column: 22, scope: !722)
!729 = !DILocalVariable(name: "used", scope: !722, file: !13, line: 137, type: !4)
!730 = !DILocation(line: 138, column: 3, scope: !722)
!731 = !DILocation(line: 138, column: 17, scope: !722)
!732 = !DILocalVariable(name: "to", scope: !722, file: !13, line: 138, type: !4)
!733 = !DILocation(line: 139, column: 3, scope: !722)
!734 = !DILocation(line: 139, column: 24, scope: !722)
!735 = !DILocalVariable(name: "from", scope: !722, file: !13, line: 139, type: !4)
!736 = !DILocation(line: 139, column: 55, scope: !722)
!737 = !DILocation(line: 140, column: 68, scope: !722)
!738 = !DILocation(line: 139, column: 27, scope: !722)
!739 = !DILocation(line: 139, column: 34, scope: !722)
!740 = !DILocation(line: 139, column: 42, scope: !722)
!741 = !DILocation(line: 139, column: 49, scope: !722)
!742 = !DILocation(line: 139, column: 79, scope: !722)
!743 = !DILocation(line: 140, column: 5, scope: !722)
!744 = !DILocation(line: 140, column: 9, scope: !722)
!745 = !DILocation(line: 140, column: 16, scope: !722)
!746 = !DILocation(line: 140, column: 26, scope: !722)
!747 = !DILocation(line: 140, column: 31, scope: !722)
!748 = !DILocation(line: 140, column: 37, scope: !722)
!749 = !DILocation(line: 140, column: 42, scope: !722)
!750 = !DILocation(line: 140, column: 47, scope: !722)
!751 = !DILocation(line: 140, column: 55, scope: !722)
!752 = !DILocation(line: 140, column: 62, scope: !722)
!753 = !DILocation(line: 140, column: 83, scope: !722)
!754 = !DILocation(line: 141, column: 7, scope: !722)
!755 = !DILocation(line: 141, column: 13, scope: !722)
!756 = !DILocation(line: 141, column: 19, scope: !722)
!757 = !DILocation(line: 141, column: 25, scope: !722)
!758 = !DILocation(line: 142, column: 7, scope: !722)
!759 = !DILocation(line: 139, column: 71, scope: !722)
!760 = !DILocation(line: 145, column: 3, scope: !722)
!761 = !DILocation(line: 145, column: 10, scope: !722)
!762 = !DILocation(line: 145, column: 16, scope: !722)
!763 = !DILocation(line: 145, column: 32, scope: !722)
!764 = !DILocation(line: 145, column: 36, scope: !722)
!765 = !DILocation(line: 146, column: 5, scope: !722)
