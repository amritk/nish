%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
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
  %0 = sext i32 -1 to i64, !dbg !116
  %1 = sext i32 %bucket to i64, !dbg !120
  %2 = shl i64 %1, 32, !dbg !120
  %3 = zext i32 %h to i64, !dbg !122
  %4 = or i64 %2, %3, !dbg !119
  %5 = sub nsw i64 %0, %4, !dbg !116
  ret i64 %5, !dbg !113
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !126 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !128, metadata !DIExpression()), !dbg !127
  call void @llvm.dbg.value(metadata i32 %mask, metadata !129, metadata !DIExpression()), !dbg !127
  call void @llvm.dbg.value(metadata i32 %h, metadata !130, metadata !DIExpression()), !dbg !127
  call void @llvm.dbg.value(metadata i32 %index, metadata !131, metadata !DIExpression()), !dbg !127
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !133
  store i32 %0, i32* %word.addr, align 4, !dbg !132
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !136, metadata !DIExpression()), !dbg !132
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !138
  store i32 %1, i32* %bucket.addr, align 4, !dbg !137
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !141, metadata !DIExpression()), !dbg !137
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !142
  %3 = load i64, i64* %2, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !142
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !142
  %5 = load i8*, i8** %4, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !142
  br label %while.cond, !dbg !142

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !156
  %7 = icmp sge i32 %6, 0, !dbg !156
  br i1 %7, label %land.rhs, label %land.end, !dbg !156

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !158
  %9 = trunc i64 %3 to i32, !dbg !143
  %10 = icmp slt i32 %8, %9, !dbg !158
  br label %land.end, !dbg !156

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !156
  br i1 %11, label %while.body, label %while.end, !dbg !142

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !163
  %13 = sext i32 %12 to i64, !dbg !162
  %14 = bitcast i8* %5 to i32*, !dbg !162
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !162
  %16 = load i32, i32* %15, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !162
  %17 = icmp eq i32 %16, 0, !dbg !162
  br i1 %17, label %if.then, label %if.end, !dbg !161

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !169
  %19 = sext i32 %18 to i64, !dbg !168
  %20 = load i32, i32* %word.addr, align 4, !dbg !170
  %21 = bitcast i8* %5 to i32*, !dbg !168
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !168
  store i32 %20, i32* %22, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !168
  ret void, !dbg !171

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !174
  %24 = add nsw i32 %23, 1, !dbg !174
  %25 = and i32 %24, %mask, !dbg !173
  store i32 %25, i32* %bucket.addr, align 4, !dbg !172
  br label %while.cond, !dbg !142

while.end:
  ret void, !dbg !127
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !179 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !181, metadata !DIExpression()), !dbg !180
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !184
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !184
  %2 = trunc i64 %1 to i32, !dbg !184
  store i32 %2, i32* %used.addr, align 4, !dbg !182
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !185, metadata !DIExpression()), !dbg !182
  store i32 0, i32* %to.addr, align 4, !dbg !186
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !188, metadata !DIExpression()), !dbg !186
  store i32 0, i32* %from.addr, align 4, !dbg !189
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !191, metadata !DIExpression()), !dbg !189
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !189
  %4 = load i8*, i8** %3, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !189
  br label %for.cond, !dbg !189

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !193
  %6 = load i32, i32* %used.addr, align 4, !dbg !194
  %7 = icmp slt i32 %5, %6, !dbg !193
  br i1 %7, label %for.body, label %for.end, !dbg !189

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !197
  %9 = sext i32 %8 to i64, !dbg !192
  %10 = bitcast i8* %4 to i32*, !dbg !192
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !192
  %12 = load i32, i32* %11, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !192
  store i32 %12, i32* %h.addr, align 4, !dbg !196
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !198, metadata !DIExpression()), !dbg !196
  %13 = load i32, i32* %h.addr, align 4, !dbg !200
  %14 = icmp ne i32 %13, 0, !dbg !200
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !200

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !202
  %16 = icmp sge i32 %15, 0, !dbg !202
  br label %land.end.1, !dbg !200

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !200
  br i1 %17, label %land.rhs, label %land.end, !dbg !200

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !204
  %19 = load i32, i32* %used.addr, align 4, !dbg !205
  %20 = icmp slt i32 %18, %19, !dbg !204
  br label %land.end, !dbg !200

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !200
  br i1 %21, label %if.then, label %if.end, !dbg !199

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !208
  %23 = sext i32 %22 to i64, !dbg !207
  %24 = load i32, i32* %h.addr, align 4, !dbg !209
  %25 = bitcast i8* %4 to i32*, !dbg !207
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !207
  store i32 %24, i32* %26, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !207
  %27 = load i32, i32* %to.addr, align 4, !dbg !210
  %28 = add nsw i32 %27, 1, !dbg !210
  store i32 %28, i32* %to.addr, align 4, !dbg !210
  br label %if.end, !dbg !199

if.end:
  br label %for.inc, !dbg !189

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !211
  %30 = add nsw i32 %29, 1, !dbg !211
  store i32 %30, i32* %from.addr, align 4, !dbg !211
  br label %for.cond, !dbg !189

for.end:
  br label %while.cond, !dbg !212

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !214
  %32 = load i64, i64* %31, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !214
  %33 = trunc i64 %32 to i32, !dbg !214
  %34 = load i32, i32* %to.addr, align 4, !dbg !215
  %35 = icmp sgt i32 %33, %34, !dbg !213
  br i1 %35, label %while.body, label %while.end, !dbg !212

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !217
  %37 = load i64, i64* %36, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !217
  %38 = icmp eq i64 %37, 0, !dbg !217
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !217

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !217
  unreachable, !dbg !217

pop.ok:
  %39 = sub i64 %37, 1, !dbg !217
  store i64 %39, i64* %36, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !217
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !217
  %41 = load i8*, i8** %40, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !217
  %42 = bitcast i8* %41 to i32*, !dbg !217
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !217
  %44 = load i32, i32* %43, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !217
  br label %while.cond, !dbg !212

while.end:
  ret void, !dbg !180
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !220 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !222, metadata !DIExpression()), !dbg !221
  call void @llvm.dbg.value(metadata i32 %live, metadata !223, metadata !DIExpression()), !dbg !221
  call void @llvm.dbg.value(metadata i32 %used, metadata !224, metadata !DIExpression()), !dbg !221
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !227
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !227
  %2 = trunc i64 %1 to i32, !dbg !227
  store i32 %2, i32* %n.addr, align 4, !dbg !225
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !228, metadata !DIExpression()), !dbg !225
  %3 = mul nsw i32 %live, 2, !dbg !230
  %4 = icmp slt i32 %3, %used, !dbg !230
  br i1 %4, label %if.then, label %if.end, !dbg !229

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !234
  ret %struct.nish_array* %slots, !dbg !236

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !240
  %6 = mul nsw i32 %5, 2, !dbg !240
  %7 = sext i32 %6 to i64, !dbg !239
  %8 = icmp ule i64 %7, 2147483647, !dbg !239
  br i1 %8, label %len.ok, label %len.fail, !dbg !239

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !239
  call void @nish_exit(i32 1), !dbg !239
  unreachable, !dbg !239

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24), !dbg !239
  %10 = bitcast i8* %9 to %struct.nish_array*, !dbg !239
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0, !dbg !239
  store i64 %7, i64* %11, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !239
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1, !dbg !239
  store i64 %7, i64* %12, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !239
  %13 = mul i64 %7, 4, !dbg !239
  %14 = call i8* @nish_alloc_struct(i64 %13), !dbg !239
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !148, !noalias !147, !dbg !239
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2, !dbg !239
  store i8* %14, i8** %15, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !239
  ret %struct.nish_array* %10, !dbg !238
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !245 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !247, metadata !DIExpression()), !dbg !246
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !248, metadata !DIExpression()), !dbg !246
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !251
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !251
  %2 = trunc i64 %1 to i32, !dbg !251
  %3 = sub nsw i32 %2, 1, !dbg !250
  store i32 %3, i32* %mask.addr, align 4, !dbg !249
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !253, metadata !DIExpression()), !dbg !249
  store i32 0, i32* %i.addr, align 4, !dbg !254
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !256, metadata !DIExpression()), !dbg !254
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !254
  %5 = load i64, i64* %4, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !254
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !254
  %7 = load i8*, i8** %6, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !254
  br label %for.cond, !dbg !254

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !258
  %9 = trunc i64 %5 to i32, !dbg !257
  %10 = icmp slt i32 %8, %9, !dbg !258
  br i1 %10, label %for.body, label %for.end, !dbg !254

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !263
  %12 = sext i32 %11 to i64, !dbg !262
  %13 = bitcast i8* %7 to i32*, !dbg !262
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !262
  %15 = load i32, i32* %14, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !262
  store i32 %15, i32* %h.addr, align 4, !dbg !261
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !264, metadata !DIExpression()), !dbg !261
  %16 = load i32, i32* %h.addr, align 4, !dbg !266
  %17 = icmp ne i32 %16, 0, !dbg !266
  br i1 %17, label %if.then, label %if.end, !dbg !265

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !271
  %19 = load i32, i32* %h.addr, align 4, !dbg !272
  %20 = load i32, i32* %i.addr, align 4, !dbg !273
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !269
  br label %if.end, !dbg !265

if.end:
  br label %for.inc, !dbg !254

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !274
  %22 = add nsw i32 %21, 1, !dbg !274
  store i32 %22, i32* %i.addr, align 4, !dbg !274
  br label %for.cond, !dbg !254

for.end:
  ret void, !dbg !246
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !275 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !277, metadata !DIExpression()), !dbg !276
  store i32 0, i32* %i.addr, align 4, !dbg !278
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !280, metadata !DIExpression()), !dbg !278
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !278
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !278
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !278
  %3 = load i8*, i8** %2, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !278
  br label %for.cond, !dbg !278

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !282
  %5 = trunc i64 %1 to i32, !dbg !281
  %6 = icmp slt i32 %4, %5, !dbg !282
  br i1 %6, label %for.body, label %for.end, !dbg !278

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !286
  %8 = sext i32 %7 to i64, !dbg !285
  %9 = bitcast i8* %3 to i32*, !dbg !285
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !285
  store i32 0, i32* %10, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !285
  br label %for.inc, !dbg !278

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !288
  %12 = add nsw i32 %11, 1, !dbg !288
  store i32 %12, i32* %i.addr, align 4, !dbg !288
  br label %for.cond, !dbg !278

for.end:
  ret void, !dbg !276
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 !dbg !291 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !293, metadata !DIExpression()), !dbg !292
  call void @llvm.dbg.value(metadata i32 %from, metadata !294, metadata !DIExpression()), !dbg !292
  store i32 %from, i32* %i.addr, align 4, !dbg !295
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !297, metadata !DIExpression()), !dbg !295
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !295
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !295
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !295
  %3 = load i8*, i8** %2, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !295
  br label %for.cond, !dbg !295

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !299
  %5 = icmp sge i32 %4, 0, !dbg !299
  br i1 %5, label %land.rhs, label %land.end, !dbg !299

land.rhs:
  %6 = load i32, i32* %i.addr, align 4, !dbg !301
  %7 = trunc i64 %1 to i32, !dbg !298
  %8 = icmp slt i32 %6, %7, !dbg !301
  br label %land.end, !dbg !299

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ], !dbg !299
  br i1 %9, label %for.body, label %for.end, !dbg !295

for.body:
  %10 = load i32, i32* %i.addr, align 4, !dbg !306
  %11 = sext i32 %10 to i64, !dbg !305
  %12 = bitcast i8* %3 to i32*, !dbg !305
  %13 = getelementptr inbounds i32, i32* %12, i64 %11, !dbg !305
  %14 = load i32, i32* %13, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !305
  %15 = icmp ne i32 %14, 0, !dbg !305
  br i1 %15, label %if.then, label %if.end, !dbg !304

if.then:
  %16 = load i32, i32* %i.addr, align 4, !dbg !310
  ret i32 %16, !dbg !309

if.end:
  br label %for.inc, !dbg !295

for.inc:
  %17 = load i32, i32* %i.addr, align 4, !dbg !311
  %18 = add nsw i32 %17, 1, !dbg !311
  store i32 %18, i32* %i.addr, align 4, !dbg !311
  br label %for.cond, !dbg !295

for.end:
  ret i32 -1, !dbg !312
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !316 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !318, metadata !DIExpression()), !dbg !317
  call void @llvm.dbg.value(metadata i32 %mask, metadata !319, metadata !DIExpression()), !dbg !317
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !320, metadata !DIExpression()), !dbg !317
  call void @llvm.dbg.value(metadata i32 %h, metadata !321, metadata !DIExpression()), !dbg !317
  call void @llvm.dbg.value(metadata i32 %used, metadata !322, metadata !DIExpression()), !dbg !317
  %0 = icmp sge i32 %bucket, 0, !dbg !324
  br i1 %0, label %land.rhs, label %land.end, !dbg !324

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !328
  %2 = load i64, i64* %1, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !328
  %3 = trunc i64 %2 to i32, !dbg !328
  %4 = icmp slt i32 %bucket, %3, !dbg !326
  br label %land.end, !dbg !324

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !324
  br i1 %5, label %if.then, label %if.else, !dbg !323

if.then:
  %6 = sext i32 %bucket to i64, !dbg !330
  %7 = sub nsw i32 %used, 1, !dbg !334
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !332
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !330
  %10 = load i8*, i8** %9, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !330
  %11 = bitcast i8* %10 to i32*, !dbg !330
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !330
  store i32 %8, i32* %12, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !330
  br label %if.end, !dbg !323

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !341
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !337
  br label %if.end, !dbg !323

if.end:
  ret void, !dbg !317
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 !dbg !345 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !347, metadata !DIExpression()), !dbg !346
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !346
  store i32 0, i32* %0, align 4, !tbaa !351, !dbg !346
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !346
  store i32 7, i32* %1, align 4, !tbaa !352, !dbg !346
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !346
  store i32 0, i32* %2, align 4, !tbaa !353, !dbg !346
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !346
  store i32 0, i32* %3, align 4, !tbaa !354, !dbg !346
  %4 = sext i32 8 to i64, !dbg !356
  %5 = icmp ule i64 %4, 2147483647, !dbg !356
  br i1 %5, label %len.ok, label %len.fail, !dbg !356

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !356
  call void @nish_exit(i32 1), !dbg !356
  unreachable, !dbg !356

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24), !dbg !356
  %7 = bitcast i8* %6 to %struct.nish_array*, !dbg !356
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !356
  store i64 %4, i64* %8, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !356
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1, !dbg !356
  store i64 %4, i64* %9, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !356
  %10 = mul i64 %4, 4, !dbg !356
  %11 = call i8* @nish_alloc_struct(i64 %10), !dbg !356
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !148, !noalias !147, !dbg !356
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2, !dbg !356
  store i8* %11, i8** %12, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !356
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !355
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !358, !dbg !355
  %14 = call i8* @nish_alloc_struct(i64 24), !dbg !360
  %15 = bitcast i8* %14 to %struct.nish_array*, !dbg !360
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !360
  store i64 0, i64* %16, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !360
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !360
  store i64 0, i64* %17, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !360
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !360
  store i8* null, i8** %18, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !360
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !359
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !361, !dbg !359
  %20 = call i8* @nish_alloc_struct(i64 24), !dbg !363
  %21 = bitcast i8* %20 to %struct.nish_array*, !dbg !363
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0, !dbg !363
  store i64 0, i64* %22, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !363
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1, !dbg !363
  store i64 0, i64* %23, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !363
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2, !dbg !363
  store i8* null, i8** %24, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !363
  %25 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !362
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !364, !dbg !362
  %26 = call i8* @nish_alloc_struct(i64 24), !dbg !366
  %27 = bitcast i8* %26 to %struct.nish_array*, !dbg !366
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0, !dbg !366
  store i64 0, i64* %28, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !366
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1, !dbg !366
  store i64 0, i64* %29, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !366
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2, !dbg !366
  store i8* null, i8** %30, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !366
  %31 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !365
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !367, !dbg !365
  ret void, !dbg !346
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !370 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !372, metadata !DIExpression()), !dbg !371
  call void @llvm.dbg.value(metadata i8* %key, metadata !373, metadata !DIExpression()), !dbg !371
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !376
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !358, !dbg !376
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !377
  %3 = load i32, i32* %2, align 4, !tbaa !352, !dbg !377
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !378
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !367, !dbg !378
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !379
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !361, !dbg !379
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !375
  ret i64 %8, !dbg !374
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !383 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !385, metadata !DIExpression()), !dbg !384
  call void @llvm.dbg.value(metadata i8* %key, metadata !386, metadata !DIExpression()), !dbg !384
  call void @llvm.dbg.value(metadata i32 %value, metadata !387, metadata !DIExpression()), !dbg !384
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !389
  store i64 %0, i64* %found.addr, align 8, !dbg !388
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !391, metadata !DIExpression()), !dbg !388
  %1 = load i64, i64* %found.addr, align 8, !dbg !393
  %2 = icmp sge i64 %1, 0, !dbg !393
  br i1 %2, label %if.then, label %if.else, !dbg !392

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !398
  %4 = trunc i64 %3 to i32, !dbg !397
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !396
  br label %if.end, !dbg !392

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !402
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !401
  br label %if.end, !dbg !392

if.end:
  ret %struct.Map$str$i32* %this, !dbg !405
}

define internal void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 !dbg !407 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !409, metadata !DIExpression()), !dbg !408
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !411
  %1 = load i32, i32* %0, align 4, !tbaa !354, !dbg !411
  %2 = add nsw i32 %1, 1, !dbg !411
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !410
  store i32 %2, i32* %3, align 4, !tbaa !354, !dbg !410
  ret void, !dbg !408
}

define internal noundef i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 !dbg !415 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !417, metadata !DIExpression()), !dbg !416
  call void @llvm.dbg.value(metadata i32 %from, metadata !418, metadata !DIExpression()), !dbg !416
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !421
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !367, !dbg !421
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from), !dbg !420
  ret i32 %2, !dbg !419
}

define internal void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 !dbg !423 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !425, metadata !DIExpression()), !dbg !424
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !427
  %1 = load i32, i32* %0, align 4, !tbaa !354, !dbg !427
  %2 = sub nsw i32 %1, 1, !dbg !427
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !426
  store i32 %2, i32* %3, align 4, !tbaa !354, !dbg !426
  ret void, !dbg !424
}

define internal noundef nonnull align 8 i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !431 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !433, metadata !DIExpression()), !dbg !432
  call void @llvm.dbg.value(metadata i32 %index, metadata !434, metadata !DIExpression()), !dbg !432
  %0 = icmp slt i32 %index, 0, !dbg !436
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !436

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !440
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !361, !dbg !440
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !440
  %4 = load i64, i64* %3, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !440
  %5 = trunc i64 %4 to i32, !dbg !440
  %6 = icmp sge i32 %index, %5, !dbg !438
  br label %lor.end, !dbg !436

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !436
  br i1 %7, label %if.then, label %if.end, !dbg !435

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !442
  call void @nish_exit(i32 1), !dbg !442
  unreachable, !dbg !442

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !445
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !361, !dbg !445
  %10 = sext i32 %index to i64, !dbg !445
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !445
  %12 = load i64, i64* %11, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !445
  %13 = icmp ult i64 %10, %12, !dbg !445
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !445

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !445
  unreachable, !dbg !445

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !445
  %15 = load i8*, i8** %14, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !445
  %16 = bitcast i8* %15 to i8**, !dbg !445
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10, !dbg !445
  %18 = load i8*, i8** %17, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !445
  ret i8* %18, !dbg !444
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !449 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !451, metadata !DIExpression()), !dbg !450
  call void @llvm.dbg.value(metadata i32 %index, metadata !452, metadata !DIExpression()), !dbg !450
  %0 = icmp slt i32 %index, 0, !dbg !454
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !454

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !458
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !364, !dbg !458
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !458
  %4 = load i64, i64* %3, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !458
  %5 = trunc i64 %4 to i32, !dbg !458
  %6 = icmp sge i32 %index, %5, !dbg !456
  br label %lor.end, !dbg !454

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !454
  br i1 %7, label %if.then, label %if.end, !dbg !453

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !460
  call void @nish_exit(i32 1), !dbg !460
  unreachable, !dbg !460

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !463
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !364, !dbg !463
  %10 = sext i32 %index to i64, !dbg !463
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !463
  %12 = load i64, i64* %11, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !463
  %13 = icmp ult i64 %10, %12, !dbg !463
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !463

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !463
  unreachable, !dbg !463

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !463
  %15 = load i8*, i8** %14, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !463
  %16 = bitcast i8* %15 to i32*, !dbg !463
  %17 = getelementptr inbounds i32, i32* %16, i64 %10, !dbg !463
  %18 = load i32, i32* %17, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !463
  ret i32 %18, !dbg !462
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #3 !dbg !467 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !469, metadata !DIExpression()), !dbg !468
  call void @llvm.dbg.value(metadata i32 %index, metadata !470, metadata !DIExpression()), !dbg !468
  call void @llvm.dbg.value(metadata i32 %value, metadata !471, metadata !DIExpression()), !dbg !468
  %0 = icmp sge i32 %index, 0, !dbg !473
  br i1 %0, label %land.rhs, label %land.end, !dbg !473

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !477
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !364, !dbg !477
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !477
  %4 = load i64, i64* %3, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !477
  %5 = trunc i64 %4 to i32, !dbg !477
  %6 = icmp slt i32 %index, %5, !dbg !475
  br label %land.end, !dbg !473

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !473
  br i1 %7, label %if.then, label %if.end, !dbg !472

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !479
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !364, !dbg !479
  %10 = sext i32 %index to i64, !dbg !479
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !479
  %12 = load i8*, i8** %11, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !479
  %13 = bitcast i8* %12 to i32*, !dbg !479
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !479
  store i32 %value, i32* %14, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !479
  br label %if.end, !dbg !472

if.end:
  ret void, !dbg !468
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !484 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !486, metadata !DIExpression()), !dbg !485
  call void @llvm.dbg.value(metadata i64 %absent, metadata !487, metadata !DIExpression()), !dbg !485
  call void @llvm.dbg.value(metadata i8* %key, metadata !488, metadata !DIExpression()), !dbg !485
  call void @llvm.dbg.value(metadata i32 %value, metadata !489, metadata !DIExpression()), !dbg !485
  %0 = sub nsw i64 -1, %absent, !dbg !491
  store i64 %0, i64* %packed.addr, align 8, !dbg !490
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !493, metadata !DIExpression()), !dbg !490
  %1 = load i64, i64* %packed.addr, align 8, !dbg !496
  %2 = ashr i64 %1, 32, !dbg !496
  %3 = trunc i64 %2 to i32, !dbg !495
  store i32 %3, i32* %bucket.addr, align 4, !dbg !494
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !497, metadata !DIExpression()), !dbg !494
  %4 = load i64, i64* %packed.addr, align 8, !dbg !500
  %5 = trunc i64 %4 to i32, !dbg !499
  store i32 %5, i32* %h.addr, align 4, !dbg !498
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !501, metadata !DIExpression()), !dbg !498
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !504
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !361, !dbg !504
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !504
  %9 = load i64, i64* %8, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !504
  %10 = trunc i64 %9 to i32, !dbg !504
  %11 = icmp sge i32 %10, 16777215, !dbg !503
  br i1 %11, label %if.then, label %if.end, !dbg !502

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !508
  %13 = load i32, i32* %12, align 4, !tbaa !353, !dbg !508
  %14 = icmp sge i32 %13, 16777215, !dbg !508
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !508

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !510
  %16 = load i32, i32* %15, align 4, !tbaa !354, !dbg !510
  %17 = icmp sgt i32 %16, 0, !dbg !510
  br label %lor.end, !dbg !508

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ], !dbg !508
  br i1 %18, label %if.then.1, label %if.end.1, !dbg !507

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !513
  call void @nish_exit(i32 1), !dbg !513
  unreachable, !dbg !513

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !515
  store i32 -1, i32* %bucket.addr, align 4, !dbg !516
  br label %if.end, !dbg !502

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !518
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !361, !dbg !518
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !518
  %22 = load i64, i64* %21, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !518
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !518
  %24 = load i64, i64* %23, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !518
  %25 = icmp eq i64 %22, %24, !dbg !518
  br i1 %25, label %push.grow, label %push.store, !dbg !518

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8), !dbg !518
  br label %push.store, !dbg !518

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !518
  %27 = load i8*, i8** %26, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !518
  %28 = bitcast i8* %27 to i8**, !dbg !518
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22, !dbg !518
  store i8* %key, i8** %29, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !518
  %30 = add i64 %22, 1, !dbg !518
  store i64 %30, i64* %21, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !518
  %31 = trunc i64 %30 to i32, !dbg !518
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !520
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !364, !dbg !520
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0, !dbg !520
  %35 = load i64, i64* %34, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !520
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1, !dbg !520
  %37 = load i64, i64* %36, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !520
  %38 = icmp eq i64 %35, %37, !dbg !520
  br i1 %38, label %push.grow.1, label %push.store.1, !dbg !520

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4), !dbg !520
  br label %push.store.1, !dbg !520

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2, !dbg !520
  %40 = load i8*, i8** %39, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !520
  %41 = bitcast i8* %40 to i32*, !dbg !520
  %42 = getelementptr inbounds i32, i32* %41, i64 %35, !dbg !520
  store i32 %value, i32* %42, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !520
  %43 = add i64 %35, 1, !dbg !520
  store i64 %43, i64* %34, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !520
  %44 = trunc i64 %43 to i32, !dbg !520
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !522
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !367, !dbg !522
  %47 = load i32, i32* %h.addr, align 4, !dbg !523
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0, !dbg !522
  %49 = load i64, i64* %48, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !522
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1, !dbg !522
  %51 = load i64, i64* %50, align 8, !alias.scope !147, !noalias !148, !tbaa !242, !dbg !522
  %52 = icmp eq i64 %49, %51, !dbg !522
  br i1 %52, label %push.grow.2, label %push.store.2, !dbg !522

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4), !dbg !522
  br label %push.store.2, !dbg !522

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2, !dbg !522
  %54 = load i8*, i8** %53, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !522
  %55 = bitcast i8* %54 to i32*, !dbg !522
  %56 = getelementptr inbounds i32, i32* %55, i64 %49, !dbg !522
  store i32 %47, i32* %56, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !522
  %57 = add i64 %49, 1, !dbg !522
  store i64 %57, i64* %48, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !522
  %58 = trunc i64 %57 to i32, !dbg !522
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !525
  %60 = load i32, i32* %59, align 4, !tbaa !353, !dbg !525
  %61 = add nsw i32 %60, 1, !dbg !525
  %62 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !524
  store i32 %61, i32* %62, align 4, !tbaa !353, !dbg !524
  %63 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !528
  %64 = load i32, i32* %63, align 4, !tbaa !351, !dbg !528
  %65 = add nsw i32 %64, 1, !dbg !528
  %66 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !527
  store i32 %65, i32* %66, align 4, !tbaa !351, !dbg !527
  %67 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !532
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !361, !dbg !532
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0, !dbg !532
  %70 = load i64, i64* %69, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !532
  %71 = trunc i64 %70 to i32, !dbg !532
  store i32 %71, i32* %used.addr, align 4, !dbg !530
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !533, metadata !DIExpression()), !dbg !530
  %72 = load i32, i32* %used.addr, align 4, !dbg !535
  %73 = mul nsw i32 %72, 4, !dbg !535
  %74 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !538
  %75 = load %struct.nish_array*, %struct.nish_array** %74, align 8, !tbaa !358, !dbg !538
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0, !dbg !538
  %77 = load i64, i64* %76, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !538
  %78 = trunc i64 %77 to i32, !dbg !538
  %79 = mul nsw i32 %78, 3, !dbg !537
  %80 = icmp sgt i32 %73, %79, !dbg !535
  br i1 %80, label %if.then.2, label %if.else, !dbg !534

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !541
  br label %if.end.2, !dbg !534

if.else:
  %81 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !544
  %82 = load %struct.nish_array*, %struct.nish_array** %81, align 8, !tbaa !358, !dbg !544
  %83 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !545
  %84 = load i32, i32* %83, align 4, !tbaa !352, !dbg !545
  %85 = load i32, i32* %bucket.addr, align 4, !dbg !546
  %86 = load i32, i32* %h.addr, align 4, !dbg !547
  %87 = load i32, i32* %used.addr, align 4, !dbg !548
  call void @nish.fileAppended(%struct.nish_array* %82, i32 %84, i32 %85, i32 %86, i32 %87), !dbg !543
  br label %if.end.2, !dbg !534

if.end.2:
  ret void, !dbg !485
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !549 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !551, metadata !DIExpression()), !dbg !550
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !554
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !361, !dbg !554
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !554
  %3 = load i64, i64* %2, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !554
  %4 = trunc i64 %3 to i32, !dbg !554
  store i32 %4, i32* %used.addr, align 4, !dbg !552
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !555, metadata !DIExpression()), !dbg !552
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !557
  %6 = load i32, i32* %5, align 4, !tbaa !354, !dbg !557
  %7 = icmp sgt i32 %6, 0, !dbg !557
  store i1 %7, i1* %walking.addr, align 1, !dbg !556
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !560, metadata !DIExpression()), !dbg !556
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !563
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !358, !dbg !563
  %10 = load i1, i1* %walking.addr, align 1, !dbg !564
  br i1 %10, label %cond.true, label %cond.false, !dbg !564

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !565
  br label %cond.end, !dbg !564

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !566
  %13 = load i32, i32* %12, align 4, !tbaa !353, !dbg !566
  br label %cond.end, !dbg !564

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !564
  %15 = load i32, i32* %used.addr, align 4, !dbg !567
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !562
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !561
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !568, metadata !DIExpression()), !dbg !561
  %17 = load i1, i1* %walking.addr, align 1, !dbg !571
  %18 = xor i1 %17, true, !dbg !570
  br i1 %18, label %land.rhs, label %land.end, !dbg !570

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !572
  %20 = load i32, i32* %19, align 4, !tbaa !353, !dbg !572
  %21 = load i32, i32* %used.addr, align 4, !dbg !573
  %22 = icmp slt i32 %20, %21, !dbg !572
  br label %land.end, !dbg !570

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !570
  br i1 %23, label %if.then, label %if.end, !dbg !569

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !576
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !361, !dbg !576
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !577
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !367, !dbg !577
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !575
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !579
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !364, !dbg !579
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !580
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !367, !dbg !580
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !578
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !582
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !367, !dbg !582
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !581
  br label %if.end, !dbg !569

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !584
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !583
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !358, !dbg !583
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !587
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !587
  %38 = load i64, i64* %37, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !587
  %39 = trunc i64 %38 to i32, !dbg !587
  %40 = sub nsw i32 %39, 1, !dbg !586
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !585
  store i32 %40, i32* %41, align 4, !tbaa !352, !dbg !585
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !590
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !591
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !367, !dbg !591
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !589
  ret void, !dbg !550
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !594 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !596, metadata !DIExpression()), !dbg !595
  call void @llvm.dbg.value(metadata i32 %mask, metadata !597, metadata !DIExpression()), !dbg !595
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !598, metadata !DIExpression()), !dbg !595
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !599, metadata !DIExpression()), !dbg !595
  call void @llvm.dbg.value(metadata i8* %key, metadata !600, metadata !DIExpression()), !dbg !595
  %0 = bitcast i8* %key to i64*, !dbg !602
  %1 = load i64, i64* %0, align 8, !dbg !602
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !602
  store i64 0, i64* %hash.i, align 8, !dbg !602
  store i32 -2128831035, i32* %hash.h, align 4, !dbg !602
  br label %hash.test, !dbg !602

hash.test:
  %3 = load i64, i64* %hash.i, align 8, !dbg !602
  %4 = icmp ult i64 %3, %1, !dbg !602
  br i1 %4, label %hash.byte, label %hash.done, !dbg !602

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3, !dbg !602
  %6 = load i8, i8* %5, !dbg !602
  %7 = zext i8 %6 to i32, !dbg !602
  %8 = load i32, i32* %hash.h, align 4, !dbg !602
  %9 = xor i32 %8, %7, !dbg !602
  %10 = mul i32 %9, 16777619, !dbg !602
  store i32 %10, i32* %hash.h, align 4, !dbg !602
  %11 = add i64 %3, 1, !dbg !602
  store i64 %11, i64* %hash.i, align 8, !dbg !602
  br label %hash.test, !dbg !602

hash.done:
  %12 = load i32, i32* %hash.h, align 4, !dbg !602
  %13 = icmp eq i32 %12, 0, !dbg !602
  %14 = select i1 %13, i32 1, i32 %12, !dbg !602
  store i32 %14, i32* %h.addr, align 4, !dbg !601
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !604, metadata !DIExpression()), !dbg !601
  %15 = load i32, i32* %h.addr, align 4, !dbg !606
  %16 = lshr i32 %15, 24, !dbg !606
  store i32 %16, i32* %fingerprint.addr, align 4, !dbg !605
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !607, metadata !DIExpression()), !dbg !605
  %17 = load i32, i32* %h.addr, align 4, !dbg !610
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask), !dbg !609
  store i32 %18, i32* %bucket.addr, align 4, !dbg !608
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !612, metadata !DIExpression()), !dbg !608
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !613
  %20 = load i64, i64* %19, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !613
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !613
  %22 = load i8*, i8** %21, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !613
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !613
  %24 = load i64, i64* %23, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !613
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !613
  %26 = load i8*, i8** %25, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !613
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !613
  %28 = load i64, i64* %27, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !613
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !613
  %30 = load i8*, i8** %29, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !613
  br label %while.cond, !dbg !613

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4, !dbg !617
  %32 = icmp sge i32 %31, 0, !dbg !617
  br i1 %32, label %land.rhs, label %land.end, !dbg !617

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4, !dbg !619
  %34 = trunc i64 %20 to i32, !dbg !614
  %35 = icmp slt i32 %33, %34, !dbg !619
  br label %land.end, !dbg !617

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ], !dbg !617
  br i1 %36, label %while.body, label %while.end, !dbg !613

while.body:
  %37 = load i32, i32* %bucket.addr, align 4, !dbg !624
  %38 = sext i32 %37 to i64, !dbg !623
  %39 = bitcast i8* %22 to i32*, !dbg !623
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !623
  %41 = load i32, i32* %40, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !623
  store i32 %41, i32* %word.addr, align 4, !dbg !622
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !625, metadata !DIExpression()), !dbg !622
  %42 = load i32, i32* %word.addr, align 4, !dbg !627
  %43 = icmp eq i32 %42, 0, !dbg !627
  br i1 %43, label %if.then, label %if.end, !dbg !626

if.then:
  %44 = load i32, i32* %bucket.addr, align 4, !dbg !632
  %45 = load i32, i32* %h.addr, align 4, !dbg !633
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45), !dbg !631
  ret i64 %46, !dbg !630

if.end:
  %47 = load i32, i32* %word.addr, align 4, !dbg !635
  %48 = lshr i32 %47, 24, !dbg !635
  %49 = load i32, i32* %fingerprint.addr, align 4, !dbg !636
  %50 = icmp eq i32 %48, %49, !dbg !635
  br i1 %50, label %if.then.1, label %if.end.1, !dbg !634

if.then.1:
  %51 = load i32, i32* %word.addr, align 4, !dbg !640
  %52 = and i32 %51, 16777215, !dbg !640
  %53 = sub nsw i32 %52, 1, !dbg !639
  store i32 %53, i32* %at.addr, align 4, !dbg !638
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !643, metadata !DIExpression()), !dbg !638
  %54 = load i32, i32* %at.addr, align 4, !dbg !645
  %55 = icmp sge i32 %54, 0, !dbg !645
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !645

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !647
  %57 = trunc i64 %24 to i32, !dbg !615
  %58 = icmp slt i32 %56, %57, !dbg !647
  br label %land.end.4, !dbg !645

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !645
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !645

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !650
  %61 = sext i32 %60 to i64, !dbg !649
  %62 = bitcast i8* %26 to i32*, !dbg !649
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !649
  %64 = load i32, i32* %63, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !649
  %65 = load i32, i32* %h.addr, align 4, !dbg !651
  %66 = icmp eq i32 %64, %65, !dbg !649
  br label %land.end.3, !dbg !645

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !645
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !645

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !652
  %69 = trunc i64 %28 to i32, !dbg !616
  %70 = icmp slt i32 %68, %69, !dbg !652
  br label %land.end.2, !dbg !645

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !645
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !645

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !656
  %73 = sext i32 %72 to i64, !dbg !655
  %74 = bitcast i8* %30 to i8**, !dbg !655
  %75 = getelementptr inbounds i8*, i8** %74, i64 %73, !dbg !655
  %76 = load i8*, i8** %75, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !655
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* %key), !dbg !654
  br label %land.end.1, !dbg !645

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !645
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !644

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4, !dbg !661
  %80 = load i32, i32* %at.addr, align 4, !dbg !662
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !660
  ret i64 %81, !dbg !659

if.end.2:
  br label %if.end.1, !dbg !634

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !665
  %83 = add nsw i32 %82, 1, !dbg !665
  %84 = and i32 %83, %mask, !dbg !664
  store i32 %84, i32* %bucket.addr, align 4, !dbg !663
  br label %while.cond, !dbg !613

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.5 to i8*), i32 2, i1 true), !dbg !668
  call void @nish_exit(i32 1), !dbg !668
  unreachable, !dbg !668
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !672 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !674, metadata !DIExpression()), !dbg !673
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !675, metadata !DIExpression()), !dbg !673
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !678
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !678
  %2 = trunc i64 %1 to i32, !dbg !678
  store i32 %2, i32* %used.addr, align 4, !dbg !676
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !679, metadata !DIExpression()), !dbg !676
  store i32 0, i32* %to.addr, align 4, !dbg !680
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !682, metadata !DIExpression()), !dbg !680
  store i32 0, i32* %from.addr, align 4, !dbg !683
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !685, metadata !DIExpression()), !dbg !683
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !683
  %4 = load i64, i64* %3, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !683
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !683
  %6 = load i8*, i8** %5, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !683
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !683
  %8 = load i64, i64* %7, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !683
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !683
  %10 = load i8*, i8** %9, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !683
  br label %for.cond, !dbg !683

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !688
  %12 = load i32, i32* %used.addr, align 4, !dbg !689
  %13 = icmp slt i32 %11, %12, !dbg !688
  br i1 %13, label %land.rhs, label %land.end, !dbg !688

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !690
  %15 = trunc i64 %4 to i32, !dbg !686
  %16 = icmp slt i32 %14, %15, !dbg !690
  br label %land.end, !dbg !688

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !688
  br i1 %17, label %for.body, label %for.end, !dbg !683

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !695
  %19 = sext i32 %18 to i64, !dbg !694
  %20 = bitcast i8* %6 to i32*, !dbg !694
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !694
  %22 = load i32, i32* %21, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !694
  %23 = icmp ne i32 %22, 0, !dbg !694
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !694

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !697
  %25 = icmp sge i32 %24, 0, !dbg !697
  br label %land.end.3, !dbg !694

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !694
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !694

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !699
  %28 = load i32, i32* %used.addr, align 4, !dbg !700
  %29 = icmp slt i32 %27, %28, !dbg !699
  br label %land.end.2, !dbg !694

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !694
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !694

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !701
  %32 = trunc i64 %8 to i32, !dbg !687
  %33 = icmp slt i32 %31, %32, !dbg !701
  br label %land.end.1, !dbg !694

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !694
  br i1 %34, label %if.then, label %if.end, !dbg !693

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !705
  %36 = sext i32 %35 to i64, !dbg !704
  %37 = load i32, i32* %from.addr, align 4, !dbg !707
  %38 = sext i32 %37 to i64, !dbg !706
  %39 = bitcast i8* %10 to i8**, !dbg !706
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !706
  %41 = load i8*, i8** %40, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !706
  %42 = bitcast i8* %10 to i8**, !dbg !704
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !704
  store i8* %41, i8** %43, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !704
  %44 = load i32, i32* %to.addr, align 4, !dbg !708
  %45 = add nsw i32 %44, 1, !dbg !708
  store i32 %45, i32* %to.addr, align 4, !dbg !708
  br label %if.end, !dbg !693

if.end:
  br label %for.inc, !dbg !683

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !709
  %47 = add nsw i32 %46, 1, !dbg !709
  store i32 %47, i32* %from.addr, align 4, !dbg !709
  br label %for.cond, !dbg !683

for.end:
  br label %while.cond, !dbg !710

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !712
  %49 = load i64, i64* %48, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !712
  %50 = trunc i64 %49 to i32, !dbg !712
  %51 = load i32, i32* %to.addr, align 4, !dbg !713
  %52 = icmp sgt i32 %50, %51, !dbg !711
  br i1 %52, label %while.body, label %while.end, !dbg !710

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !715
  %54 = load i64, i64* %53, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !715
  %55 = icmp eq i64 %54, 0, !dbg !715
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !715

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !715
  unreachable, !dbg !715

pop.ok:
  %56 = sub i64 %54, 1, !dbg !715
  store i64 %56, i64* %53, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !715
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !715
  %58 = load i8*, i8** %57, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !715
  %59 = bitcast i8* %58 to i8**, !dbg !715
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56, !dbg !715
  %61 = load i8*, i8** %60, align 8, !alias.scope !148, !noalias !147, !tbaa !448, !dbg !715
  br label %while.cond, !dbg !710

while.end:
  ret void, !dbg !673
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !718 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !720, metadata !DIExpression()), !dbg !719
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !721, metadata !DIExpression()), !dbg !719
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !724
  %1 = load i64, i64* %0, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !724
  %2 = trunc i64 %1 to i32, !dbg !724
  store i32 %2, i32* %used.addr, align 4, !dbg !722
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !725, metadata !DIExpression()), !dbg !722
  store i32 0, i32* %to.addr, align 4, !dbg !726
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !728, metadata !DIExpression()), !dbg !726
  store i32 0, i32* %from.addr, align 4, !dbg !729
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !731, metadata !DIExpression()), !dbg !729
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !729
  %4 = load i64, i64* %3, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !729
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !729
  %6 = load i8*, i8** %5, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !729
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !729
  %8 = load i64, i64* %7, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !729
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !729
  %10 = load i8*, i8** %9, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !729
  br label %for.cond, !dbg !729

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !734
  %12 = load i32, i32* %used.addr, align 4, !dbg !735
  %13 = icmp slt i32 %11, %12, !dbg !734
  br i1 %13, label %land.rhs, label %land.end, !dbg !734

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !736
  %15 = trunc i64 %4 to i32, !dbg !732
  %16 = icmp slt i32 %14, %15, !dbg !736
  br label %land.end, !dbg !734

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !734
  br i1 %17, label %for.body, label %for.end, !dbg !729

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !741
  %19 = sext i32 %18 to i64, !dbg !740
  %20 = bitcast i8* %6 to i32*, !dbg !740
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !740
  %22 = load i32, i32* %21, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !740
  %23 = icmp ne i32 %22, 0, !dbg !740
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !740

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !743
  %25 = icmp sge i32 %24, 0, !dbg !743
  br label %land.end.3, !dbg !740

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !740
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !740

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !745
  %28 = load i32, i32* %used.addr, align 4, !dbg !746
  %29 = icmp slt i32 %27, %28, !dbg !745
  br label %land.end.2, !dbg !740

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !740
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !740

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !747
  %32 = trunc i64 %8 to i32, !dbg !733
  %33 = icmp slt i32 %31, %32, !dbg !747
  br label %land.end.1, !dbg !740

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !740
  br i1 %34, label %if.then, label %if.end, !dbg !739

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !751
  %36 = sext i32 %35 to i64, !dbg !750
  %37 = load i32, i32* %from.addr, align 4, !dbg !753
  %38 = sext i32 %37 to i64, !dbg !752
  %39 = bitcast i8* %10 to i32*, !dbg !752
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !752
  %41 = load i32, i32* %40, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !752
  %42 = bitcast i8* %10 to i32*, !dbg !750
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !750
  store i32 %41, i32* %43, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !750
  %44 = load i32, i32* %to.addr, align 4, !dbg !754
  %45 = add nsw i32 %44, 1, !dbg !754
  store i32 %45, i32* %to.addr, align 4, !dbg !754
  br label %if.end, !dbg !739

if.end:
  br label %for.inc, !dbg !729

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !755
  %47 = add nsw i32 %46, 1, !dbg !755
  store i32 %47, i32* %from.addr, align 4, !dbg !755
  br label %for.cond, !dbg !729

for.end:
  br label %while.cond, !dbg !756

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !758
  %49 = load i64, i64* %48, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !758
  %50 = trunc i64 %49 to i32, !dbg !758
  %51 = load i32, i32* %to.addr, align 4, !dbg !759
  %52 = icmp sgt i32 %50, %51, !dbg !757
  br i1 %52, label %while.body, label %while.end, !dbg !756

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !761
  %54 = load i64, i64* %53, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !761
  %55 = icmp eq i64 %54, 0, !dbg !761
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !761

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !761
  unreachable, !dbg !761

pop.ok:
  %56 = sub i64 %54, 1, !dbg !761
  store i64 %56, i64* %53, align 8, !alias.scope !147, !noalias !148, !tbaa !154, !dbg !761
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !761
  %58 = load i8*, i8** %57, align 8, !alias.scope !147, !noalias !148, !tbaa !155, !dbg !761
  %59 = bitcast i8* %58 to i32*, !dbg !761
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !761
  %61 = load i32, i32* %60, align 4, !alias.scope !148, !noalias !147, !tbaa !165, !dbg !761
  br label %while.cond, !dbg !756

while.end:
  ret void, !dbg !719
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<string, i32>", file: !13, line: 272, size: 448, align: 64, elements: !47)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 274, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 276, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 278, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 280, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "string[]", file: !1, size: 192, align: 64, elements: !34)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!31 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !30, size: 64)
!32 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !31, size: 64)
!33 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !32, size: 64, offset: 128)
!34 = !{!28, !29, !33}
!35 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 281, baseType: !35, size: 64, offset: 192)
!37 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !42)
!38 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !37, baseType: !16, size: 64, offset: 0)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !37, baseType: !16, size: 64, offset: 64)
!40 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !37, baseType: !40, size: 64, offset: 128)
!42 = !{!38, !39, !41}
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !37, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 282, baseType: !43, size: 64, offset: 256)
!45 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 284, baseType: !23, size: 64, offset: 320)
!46 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 290, baseType: !4, size: 32, offset: 384)
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
!118 = !DILocation(line: 87, column: 60, scope: !112)
!119 = !DILocation(line: 87, column: 61, scope: !112)
!120 = !DILocation(line: 87, column: 62, scope: !112)
!121 = !DILocation(line: 87, column: 68, scope: !112)
!122 = !DILocation(line: 87, column: 85, scope: !112)
!123 = !DILocation(line: 87, column: 91, scope: !112)
!124 = !{null, !23, !4, !19, !4}
!125 = !DISubroutineType(types: !124)
!126 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 129, type: !125, scopeLine: 129, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!127 = !DILocation(line: 129, column: 1, scope: !126)
!128 = !DILocalVariable(name: "slots", arg: 1, scope: !126, file: !13, line: 129, type: !23)
!129 = !DILocalVariable(name: "mask", arg: 2, scope: !126, file: !13, line: 129, type: !4)
!130 = !DILocalVariable(name: "h", arg: 3, scope: !126, file: !13, line: 129, type: !19)
!131 = !DILocalVariable(name: "index", arg: 4, scope: !126, file: !13, line: 129, type: !4)
!132 = !DILocation(line: 130, column: 3, scope: !126)
!133 = !DILocation(line: 130, column: 16, scope: !126)
!134 = !DILocation(line: 130, column: 25, scope: !126)
!135 = !DILocation(line: 130, column: 28, scope: !126)
!136 = !DILocalVariable(name: "word", scope: !126, file: !13, line: 130, type: !19)
!137 = !DILocation(line: 131, column: 3, scope: !126)
!138 = !DILocation(line: 131, column: 16, scope: !126)
!139 = !DILocation(line: 131, column: 27, scope: !126)
!140 = !DILocation(line: 131, column: 30, scope: !126)
!141 = !DILocalVariable(name: "bucket", scope: !126, file: !13, line: 131, type: !4)
!142 = !DILocation(line: 132, column: 3, scope: !126)
!143 = !DILocation(line: 132, column: 40, scope: !126)
!144 = !{!"nish array"}
!145 = !{!"header", !144}
!146 = !{!"elements", !144}
!147 = !{!145}
!148 = !{!146}
!149 = !{!"nish TBAA"}
!150 = !{!"omnipotent char", !149, i64 0}
!151 = !{!"header i64", !150, i64 0}
!152 = !{!"header ptr", !150, i64 0}
!153 = !{!"array header", !151, i64 0, !151, i64 8, !152, i64 16}
!154 = !{!153, !151, i64 0}
!155 = !{!153, !152, i64 16}
!156 = !DILocation(line: 132, column: 10, scope: !126)
!157 = !DILocation(line: 132, column: 20, scope: !126)
!158 = !DILocation(line: 132, column: 25, scope: !126)
!159 = !DILocation(line: 132, column: 34, scope: !126)
!160 = !DILocation(line: 132, column: 55, scope: !126)
!161 = !DILocation(line: 133, column: 5, scope: !126)
!162 = !DILocation(line: 133, column: 9, scope: !126)
!163 = !DILocation(line: 133, column: 15, scope: !126)
!164 = !{!"element i32", !150, i64 0}
!165 = !{!164, !164, i64 0}
!166 = !DILocation(line: 133, column: 27, scope: !126)
!167 = !DILocation(line: 133, column: 30, scope: !126)
!168 = !DILocation(line: 134, column: 7, scope: !126)
!169 = !DILocation(line: 134, column: 13, scope: !126)
!170 = !DILocation(line: 134, column: 23, scope: !126)
!171 = !DILocation(line: 135, column: 7, scope: !126)
!172 = !DILocation(line: 137, column: 5, scope: !126)
!173 = !DILocation(line: 137, column: 14, scope: !126)
!174 = !DILocation(line: 137, column: 15, scope: !126)
!175 = !DILocation(line: 137, column: 24, scope: !126)
!176 = !DILocation(line: 137, column: 29, scope: !126)
!177 = !{null, !23}
!178 = !DISubroutineType(types: !177)
!179 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 157, type: !178, scopeLine: 157, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!180 = !DILocation(line: 157, column: 1, scope: !179)
!181 = !DILocalVariable(name: "hashes", arg: 1, scope: !179, file: !13, line: 157, type: !23)
!182 = !DILocation(line: 158, column: 3, scope: !179)
!183 = !DILocation(line: 158, column: 16, scope: !179)
!184 = !DILocation(line: 158, column: 22, scope: !179)
!185 = !DILocalVariable(name: "used", scope: !179, file: !13, line: 158, type: !4)
!186 = !DILocation(line: 159, column: 3, scope: !179)
!187 = !DILocation(line: 159, column: 17, scope: !179)
!188 = !DILocalVariable(name: "to", scope: !179, file: !13, line: 159, type: !4)
!189 = !DILocation(line: 160, column: 3, scope: !179)
!190 = !DILocation(line: 160, column: 24, scope: !179)
!191 = !DILocalVariable(name: "from", scope: !179, file: !13, line: 160, type: !4)
!192 = !DILocation(line: 161, column: 15, scope: !179)
!193 = !DILocation(line: 160, column: 27, scope: !179)
!194 = !DILocation(line: 160, column: 34, scope: !179)
!195 = !DILocation(line: 160, column: 48, scope: !179)
!196 = !DILocation(line: 161, column: 5, scope: !179)
!197 = !DILocation(line: 161, column: 22, scope: !179)
!198 = !DILocalVariable(name: "h", scope: !179, file: !13, line: 161, type: !19)
!199 = !DILocation(line: 162, column: 5, scope: !179)
!200 = !DILocation(line: 162, column: 9, scope: !179)
!201 = !DILocation(line: 162, column: 15, scope: !179)
!202 = !DILocation(line: 162, column: 20, scope: !179)
!203 = !DILocation(line: 162, column: 26, scope: !179)
!204 = !DILocation(line: 162, column: 31, scope: !179)
!205 = !DILocation(line: 162, column: 36, scope: !179)
!206 = !DILocation(line: 162, column: 42, scope: !179)
!207 = !DILocation(line: 163, column: 7, scope: !179)
!208 = !DILocation(line: 163, column: 14, scope: !179)
!209 = !DILocation(line: 163, column: 20, scope: !179)
!210 = !DILocation(line: 164, column: 7, scope: !179)
!211 = !DILocation(line: 160, column: 40, scope: !179)
!212 = !DILocation(line: 167, column: 3, scope: !179)
!213 = !DILocation(line: 167, column: 10, scope: !179)
!214 = !DILocation(line: 167, column: 16, scope: !179)
!215 = !DILocation(line: 167, column: 33, scope: !179)
!216 = !DILocation(line: 167, column: 37, scope: !179)
!217 = !DILocation(line: 168, column: 5, scope: !179)
!218 = !{!23, !23, !4, !4}
!219 = !DISubroutineType(types: !218)
!220 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 179, type: !219, scopeLine: 179, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!221 = !DILocation(line: 179, column: 1, scope: !220)
!222 = !DILocalVariable(name: "slots", arg: 1, scope: !220, file: !13, line: 179, type: !23)
!223 = !DILocalVariable(name: "live", arg: 2, scope: !220, file: !13, line: 179, type: !4)
!224 = !DILocalVariable(name: "used", arg: 3, scope: !220, file: !13, line: 179, type: !4)
!225 = !DILocation(line: 180, column: 3, scope: !220)
!226 = !DILocation(line: 180, column: 13, scope: !220)
!227 = !DILocation(line: 180, column: 19, scope: !220)
!228 = !DILocalVariable(name: "n", scope: !220, file: !13, line: 180, type: !4)
!229 = !DILocation(line: 181, column: 3, scope: !220)
!230 = !DILocation(line: 181, column: 7, scope: !220)
!231 = !DILocation(line: 181, column: 14, scope: !220)
!232 = !DILocation(line: 181, column: 18, scope: !220)
!233 = !DILocation(line: 181, column: 24, scope: !220)
!234 = !DILocation(line: 182, column: 5, scope: !220)
!235 = !DILocation(line: 182, column: 16, scope: !220)
!236 = !DILocation(line: 183, column: 5, scope: !220)
!237 = !DILocation(line: 183, column: 12, scope: !220)
!238 = !DILocation(line: 185, column: 3, scope: !220)
!239 = !DILocation(line: 185, column: 10, scope: !220)
!240 = !DILocation(line: 185, column: 25, scope: !220)
!241 = !DILocation(line: 185, column: 29, scope: !220)
!242 = !{!153, !151, i64 8}
!243 = !{null, !23, !23}
!244 = !DISubroutineType(types: !243)
!245 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 193, type: !244, scopeLine: 193, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!246 = !DILocation(line: 193, column: 1, scope: !245)
!247 = !DILocalVariable(name: "slots", arg: 1, scope: !245, file: !13, line: 193, type: !23)
!248 = !DILocalVariable(name: "hashes", arg: 2, scope: !245, file: !13, line: 193, type: !23)
!249 = !DILocation(line: 194, column: 3, scope: !245)
!250 = !DILocation(line: 194, column: 16, scope: !245)
!251 = !DILocation(line: 194, column: 22, scope: !245)
!252 = !DILocation(line: 194, column: 38, scope: !245)
!253 = !DILocalVariable(name: "mask", scope: !245, file: !13, line: 194, type: !4)
!254 = !DILocation(line: 195, column: 3, scope: !245)
!255 = !DILocation(line: 195, column: 21, scope: !245)
!256 = !DILocalVariable(name: "i", scope: !245, file: !13, line: 195, type: !4)
!257 = !DILocation(line: 195, column: 34, scope: !245)
!258 = !DILocation(line: 195, column: 24, scope: !245)
!259 = !DILocation(line: 195, column: 28, scope: !245)
!260 = !DILocation(line: 195, column: 55, scope: !245)
!261 = !DILocation(line: 196, column: 5, scope: !245)
!262 = !DILocation(line: 196, column: 15, scope: !245)
!263 = !DILocation(line: 196, column: 22, scope: !245)
!264 = !DILocalVariable(name: "h", scope: !245, file: !13, line: 196, type: !19)
!265 = !DILocation(line: 197, column: 5, scope: !245)
!266 = !DILocation(line: 197, column: 9, scope: !245)
!267 = !DILocation(line: 197, column: 15, scope: !245)
!268 = !DILocation(line: 197, column: 18, scope: !245)
!269 = !DILocation(line: 198, column: 7, scope: !245)
!270 = !DILocation(line: 198, column: 17, scope: !245)
!271 = !DILocation(line: 198, column: 24, scope: !245)
!272 = !DILocation(line: 198, column: 30, scope: !245)
!273 = !DILocation(line: 198, column: 33, scope: !245)
!274 = !DILocation(line: 195, column: 50, scope: !245)
!275 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 224, type: !178, scopeLine: 224, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!276 = !DILocation(line: 224, column: 1, scope: !275)
!277 = !DILocalVariable(name: "slots", arg: 1, scope: !275, file: !13, line: 224, type: !23)
!278 = !DILocation(line: 225, column: 3, scope: !275)
!279 = !DILocation(line: 225, column: 21, scope: !275)
!280 = !DILocalVariable(name: "i", scope: !275, file: !13, line: 225, type: !4)
!281 = !DILocation(line: 225, column: 34, scope: !275)
!282 = !DILocation(line: 225, column: 24, scope: !275)
!283 = !DILocation(line: 225, column: 28, scope: !275)
!284 = !DILocation(line: 225, column: 54, scope: !275)
!285 = !DILocation(line: 226, column: 5, scope: !275)
!286 = !DILocation(line: 226, column: 11, scope: !275)
!287 = !DILocation(line: 226, column: 16, scope: !275)
!288 = !DILocation(line: 225, column: 49, scope: !275)
!289 = !{!4, !23, !4}
!290 = !DISubroutineType(types: !289)
!291 = distinct !DISubprogram(name: "nextLive", linkageName: "nish.nextLive", scope: !13, file: !13, line: 237, type: !290, scopeLine: 237, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!292 = !DILocation(line: 237, column: 1, scope: !291)
!293 = !DILocalVariable(name: "hashes", arg: 1, scope: !291, file: !13, line: 237, type: !23)
!294 = !DILocalVariable(name: "from", arg: 2, scope: !291, file: !13, line: 237, type: !4)
!295 = !DILocation(line: 238, column: 3, scope: !291)
!296 = !DILocation(line: 238, column: 21, scope: !291)
!297 = !DILocalVariable(name: "i", scope: !291, file: !13, line: 238, type: !4)
!298 = !DILocation(line: 238, column: 47, scope: !291)
!299 = !DILocation(line: 238, column: 27, scope: !291)
!300 = !DILocation(line: 238, column: 32, scope: !291)
!301 = !DILocation(line: 238, column: 37, scope: !291)
!302 = !DILocation(line: 238, column: 41, scope: !291)
!303 = !DILocation(line: 238, column: 68, scope: !291)
!304 = !DILocation(line: 239, column: 5, scope: !291)
!305 = !DILocation(line: 239, column: 9, scope: !291)
!306 = !DILocation(line: 239, column: 16, scope: !291)
!307 = !DILocation(line: 239, column: 23, scope: !291)
!308 = !DILocation(line: 239, column: 26, scope: !291)
!309 = !DILocation(line: 240, column: 7, scope: !291)
!310 = !DILocation(line: 240, column: 14, scope: !291)
!311 = !DILocation(line: 238, column: 63, scope: !291)
!312 = !DILocation(line: 243, column: 3, scope: !291)
!313 = !DILocation(line: 243, column: 10, scope: !291)
!314 = !{null, !23, !4, !4, !19, !4}
!315 = !DISubroutineType(types: !314)
!316 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 258, type: !315, scopeLine: 258, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!317 = !DILocation(line: 258, column: 1, scope: !316)
!318 = !DILocalVariable(name: "slots", arg: 1, scope: !316, file: !13, line: 258, type: !23)
!319 = !DILocalVariable(name: "mask", arg: 2, scope: !316, file: !13, line: 258, type: !4)
!320 = !DILocalVariable(name: "bucket", arg: 3, scope: !316, file: !13, line: 258, type: !4)
!321 = !DILocalVariable(name: "h", arg: 4, scope: !316, file: !13, line: 258, type: !19)
!322 = !DILocalVariable(name: "used", arg: 5, scope: !316, file: !13, line: 258, type: !4)
!323 = !DILocation(line: 259, column: 3, scope: !316)
!324 = !DILocation(line: 259, column: 7, scope: !316)
!325 = !DILocation(line: 259, column: 17, scope: !316)
!326 = !DILocation(line: 259, column: 22, scope: !316)
!327 = !DILocation(line: 259, column: 31, scope: !316)
!328 = !DILocation(line: 259, column: 37, scope: !316)
!329 = !DILocation(line: 259, column: 52, scope: !316)
!330 = !DILocation(line: 260, column: 5, scope: !316)
!331 = !DILocation(line: 260, column: 11, scope: !316)
!332 = !DILocation(line: 260, column: 21, scope: !316)
!333 = !DILocation(line: 260, column: 30, scope: !316)
!334 = !DILocation(line: 260, column: 33, scope: !316)
!335 = !DILocation(line: 260, column: 40, scope: !316)
!336 = !DILocation(line: 261, column: 10, scope: !316)
!337 = !DILocation(line: 262, column: 5, scope: !316)
!338 = !DILocation(line: 262, column: 15, scope: !316)
!339 = !DILocation(line: 262, column: 22, scope: !316)
!340 = !DILocation(line: 262, column: 28, scope: !316)
!341 = !DILocation(line: 262, column: 31, scope: !316)
!342 = !DILocation(line: 262, column: 38, scope: !316)
!343 = !{null, !12}
!344 = !DISubroutineType(types: !343)
!345 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 292, type: !344, scopeLine: 292, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!346 = !DILocation(line: 292, column: 3, scope: !345)
!347 = !DILocalVariable(name: "this", arg: 1, scope: !345, file: !13, line: 292, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!348 = !{!"i32", !150, i64 0}
!349 = !{!"ptr", !150, i64 0}
!350 = !{!"Map$str$i32", !348, i64 0, !349, i64 8, !348, i64 16, !348, i64 20, !349, i64 24, !349, i64 32, !349, i64 40, !348, i64 48}
!351 = !{!350, !348, i64 0}
!352 = !{!350, !348, i64 16}
!353 = !{!350, !348, i64 20}
!354 = !{!350, !348, i64 48}
!355 = !DILocation(line: 293, column: 5, scope: !345)
!356 = !DILocation(line: 293, column: 18, scope: !345)
!357 = !DILocation(line: 293, column: 33, scope: !345)
!358 = !{!350, !349, i64 8}
!359 = !DILocation(line: 294, column: 5, scope: !345)
!360 = !DILocation(line: 294, column: 22, scope: !345)
!361 = !{!350, !349, i64 24}
!362 = !DILocation(line: 295, column: 5, scope: !345)
!363 = !DILocation(line: 295, column: 24, scope: !345)
!364 = !{!350, !349, i64 32}
!365 = !DILocation(line: 296, column: 5, scope: !345)
!366 = !DILocation(line: 296, column: 24, scope: !345)
!367 = !{!350, !349, i64 40}
!368 = !{!16, !12, !31}
!369 = !DISubroutineType(types: !368)
!370 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 300, type: !369, scopeLine: 300, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!371 = !DILocation(line: 300, column: 3, scope: !370)
!372 = !DILocalVariable(name: "this", arg: 1, scope: !370, file: !13, line: 300, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!373 = !DILocalVariable(name: "key", arg: 2, scope: !370, file: !13, line: 300, type: !31)
!374 = !DILocation(line: 301, column: 5, scope: !370)
!375 = !DILocation(line: 301, column: 12, scope: !370)
!376 = !DILocation(line: 301, column: 23, scope: !370)
!377 = !DILocation(line: 301, column: 35, scope: !370)
!378 = !DILocation(line: 301, column: 46, scope: !370)
!379 = !DILocation(line: 301, column: 64, scope: !370)
!380 = !DILocation(line: 301, column: 80, scope: !370)
!381 = !{!12, !12, !31, !4}
!382 = !DISubroutineType(types: !381)
!383 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 309, type: !382, scopeLine: 309, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!384 = !DILocation(line: 309, column: 3, scope: !383)
!385 = !DILocalVariable(name: "this", arg: 1, scope: !383, file: !13, line: 309, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!386 = !DILocalVariable(name: "key", arg: 2, scope: !383, file: !13, line: 309, type: !31)
!387 = !DILocalVariable(name: "value", arg: 3, scope: !383, file: !13, line: 309, type: !4)
!388 = !DILocation(line: 310, column: 5, scope: !383)
!389 = !DILocation(line: 310, column: 19, scope: !383)
!390 = !DILocation(line: 310, column: 30, scope: !383)
!391 = !DILocalVariable(name: "found", scope: !383, file: !13, line: 310, type: !16)
!392 = !DILocation(line: 311, column: 5, scope: !383)
!393 = !DILocation(line: 311, column: 9, scope: !383)
!394 = !DILocation(line: 311, column: 18, scope: !383)
!395 = !DILocation(line: 311, column: 21, scope: !383)
!396 = !DILocation(line: 312, column: 7, scope: !383)
!397 = !DILocation(line: 312, column: 23, scope: !383)
!398 = !DILocation(line: 312, column: 29, scope: !383)
!399 = !DILocation(line: 312, column: 37, scope: !383)
!400 = !DILocation(line: 313, column: 12, scope: !383)
!401 = !DILocation(line: 314, column: 7, scope: !383)
!402 = !DILocation(line: 314, column: 21, scope: !383)
!403 = !DILocation(line: 314, column: 28, scope: !383)
!404 = !DILocation(line: 314, column: 33, scope: !383)
!405 = !DILocation(line: 316, column: 5, scope: !383)
!406 = !DILocation(line: 316, column: 12, scope: !383)
!407 = distinct !DISubprogram(name: "Map<string, i32>.walkOpen", linkageName: "nish.Map$str$i32.walkOpen", scope: !13, file: !13, line: 354, type: !344, scopeLine: 354, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!408 = !DILocation(line: 354, column: 3, scope: !407)
!409 = !DILocalVariable(name: "this", arg: 1, scope: !407, file: !13, line: 354, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!410 = !DILocation(line: 355, column: 5, scope: !407)
!411 = !DILocation(line: 355, column: 18, scope: !407)
!412 = !DILocation(line: 355, column: 31, scope: !407)
!413 = !{!4, !12, !4}
!414 = !DISubroutineType(types: !413)
!415 = distinct !DISubprogram(name: "Map<string, i32>.walkNext", linkageName: "nish.Map$str$i32.walkNext", scope: !13, file: !13, line: 358, type: !414, scopeLine: 358, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!416 = !DILocation(line: 358, column: 3, scope: !415)
!417 = !DILocalVariable(name: "this", arg: 1, scope: !415, file: !13, line: 358, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!418 = !DILocalVariable(name: "from", arg: 2, scope: !415, file: !13, line: 358, type: !4)
!419 = !DILocation(line: 359, column: 5, scope: !415)
!420 = !DILocation(line: 359, column: 12, scope: !415)
!421 = !DILocation(line: 359, column: 21, scope: !415)
!422 = !DILocation(line: 359, column: 39, scope: !415)
!423 = distinct !DISubprogram(name: "Map<string, i32>.walkClose", linkageName: "nish.Map$str$i32.walkClose", scope: !13, file: !13, line: 362, type: !344, scopeLine: 362, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!424 = !DILocation(line: 362, column: 3, scope: !423)
!425 = !DILocalVariable(name: "this", arg: 1, scope: !423, file: !13, line: 362, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!426 = !DILocation(line: 363, column: 5, scope: !423)
!427 = !DILocation(line: 363, column: 18, scope: !423)
!428 = !DILocation(line: 363, column: 31, scope: !423)
!429 = !{!31, !12, !4}
!430 = !DISubroutineType(types: !429)
!431 = distinct !DISubprogram(name: "Map<string, i32>.keyAt", linkageName: "nish.Map$str$i32.keyAt", scope: !13, file: !13, line: 367, type: !430, scopeLine: 367, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!432 = !DILocation(line: 367, column: 3, scope: !431)
!433 = !DILocalVariable(name: "this", arg: 1, scope: !431, file: !13, line: 367, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!434 = !DILocalVariable(name: "index", arg: 2, scope: !431, file: !13, line: 367, type: !4)
!435 = !DILocation(line: 368, column: 5, scope: !431)
!436 = !DILocation(line: 368, column: 9, scope: !431)
!437 = !DILocation(line: 368, column: 17, scope: !431)
!438 = !DILocation(line: 368, column: 22, scope: !431)
!439 = !DILocation(line: 368, column: 31, scope: !431)
!440 = !DILocation(line: 368, column: 37, scope: !431)
!441 = !DILocation(line: 368, column: 61, scope: !431)
!442 = !DILocation(line: 369, column: 7, scope: !431)
!443 = !DILocation(line: 369, column: 13, scope: !431)
!444 = !DILocation(line: 371, column: 5, scope: !431)
!445 = !DILocation(line: 371, column: 12, scope: !431)
!446 = !DILocation(line: 371, column: 27, scope: !431)
!447 = !{!"element ptr", !150, i64 0}
!448 = !{!447, !447, i64 0}
!449 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 375, type: !414, scopeLine: 375, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!450 = !DILocation(line: 375, column: 3, scope: !449)
!451 = !DILocalVariable(name: "this", arg: 1, scope: !449, file: !13, line: 375, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!452 = !DILocalVariable(name: "index", arg: 2, scope: !449, file: !13, line: 375, type: !4)
!453 = !DILocation(line: 376, column: 5, scope: !449)
!454 = !DILocation(line: 376, column: 9, scope: !449)
!455 = !DILocation(line: 376, column: 17, scope: !449)
!456 = !DILocation(line: 376, column: 22, scope: !449)
!457 = !DILocation(line: 376, column: 31, scope: !449)
!458 = !DILocation(line: 376, column: 37, scope: !449)
!459 = !DILocation(line: 376, column: 63, scope: !449)
!460 = !DILocation(line: 377, column: 7, scope: !449)
!461 = !DILocation(line: 377, column: 13, scope: !449)
!462 = !DILocation(line: 379, column: 5, scope: !449)
!463 = !DILocation(line: 379, column: 12, scope: !449)
!464 = !DILocation(line: 379, column: 29, scope: !449)
!465 = !{null, !12, !4, !4}
!466 = !DISubroutineType(types: !465)
!467 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 383, type: !466, scopeLine: 383, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!468 = !DILocation(line: 383, column: 3, scope: !467)
!469 = !DILocalVariable(name: "this", arg: 1, scope: !467, file: !13, line: 383, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!470 = !DILocalVariable(name: "index", arg: 2, scope: !467, file: !13, line: 383, type: !4)
!471 = !DILocalVariable(name: "value", arg: 3, scope: !467, file: !13, line: 383, type: !4)
!472 = !DILocation(line: 384, column: 5, scope: !467)
!473 = !DILocation(line: 384, column: 9, scope: !467)
!474 = !DILocation(line: 384, column: 18, scope: !467)
!475 = !DILocation(line: 384, column: 23, scope: !467)
!476 = !DILocation(line: 384, column: 31, scope: !467)
!477 = !DILocation(line: 384, column: 37, scope: !467)
!478 = !DILocation(line: 384, column: 63, scope: !467)
!479 = !DILocation(line: 385, column: 7, scope: !467)
!480 = !DILocation(line: 385, column: 24, scope: !467)
!481 = !DILocation(line: 385, column: 33, scope: !467)
!482 = !{null, !12, !16, !31, !4}
!483 = !DISubroutineType(types: !482)
!484 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 390, type: !483, scopeLine: 390, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!485 = !DILocation(line: 390, column: 3, scope: !484)
!486 = !DILocalVariable(name: "this", arg: 1, scope: !484, file: !13, line: 390, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!487 = !DILocalVariable(name: "absent", arg: 2, scope: !484, file: !13, line: 390, type: !16)
!488 = !DILocalVariable(name: "key", arg: 3, scope: !484, file: !13, line: 390, type: !31)
!489 = !DILocalVariable(name: "value", arg: 4, scope: !484, file: !13, line: 390, type: !4)
!490 = !DILocation(line: 391, column: 5, scope: !484)
!491 = !DILocation(line: 391, column: 20, scope: !484)
!492 = !DILocation(line: 391, column: 25, scope: !484)
!493 = !DILocalVariable(name: "packed", scope: !484, file: !13, line: 391, type: !16)
!494 = !DILocation(line: 392, column: 5, scope: !484)
!495 = !DILocation(line: 392, column: 18, scope: !484)
!496 = !DILocation(line: 392, column: 24, scope: !484)
!497 = !DILocalVariable(name: "bucket", scope: !484, file: !13, line: 392, type: !4)
!498 = !DILocation(line: 393, column: 5, scope: !484)
!499 = !DILocation(line: 393, column: 15, scope: !484)
!500 = !DILocation(line: 393, column: 21, scope: !484)
!501 = !DILocalVariable(name: "h", scope: !484, file: !13, line: 393, type: !19)
!502 = !DILocation(line: 394, column: 5, scope: !484)
!503 = !DILocation(line: 394, column: 9, scope: !484)
!504 = !DILocation(line: 394, column: 15, scope: !484)
!505 = !DILocation(line: 394, column: 41, scope: !484)
!506 = !DILocation(line: 394, column: 52, scope: !484)
!507 = !DILocation(line: 397, column: 7, scope: !484)
!508 = !DILocation(line: 397, column: 11, scope: !484)
!509 = !DILocation(line: 397, column: 24, scope: !484)
!510 = !DILocation(line: 397, column: 37, scope: !484)
!511 = !DILocation(line: 397, column: 50, scope: !484)
!512 = !DILocation(line: 397, column: 53, scope: !484)
!513 = !DILocation(line: 398, column: 9, scope: !484)
!514 = !DILocation(line: 398, column: 15, scope: !484)
!515 = !DILocation(line: 400, column: 7, scope: !484)
!516 = !DILocation(line: 401, column: 7, scope: !484)
!517 = !DILocation(line: 401, column: 16, scope: !484)
!518 = !DILocation(line: 403, column: 5, scope: !484)
!519 = !DILocation(line: 403, column: 25, scope: !484)
!520 = !DILocation(line: 404, column: 5, scope: !484)
!521 = !DILocation(line: 404, column: 27, scope: !484)
!522 = !DILocation(line: 405, column: 5, scope: !484)
!523 = !DILocation(line: 405, column: 27, scope: !484)
!524 = !DILocation(line: 406, column: 5, scope: !484)
!525 = !DILocation(line: 406, column: 17, scope: !484)
!526 = !DILocation(line: 406, column: 29, scope: !484)
!527 = !DILocation(line: 407, column: 5, scope: !484)
!528 = !DILocation(line: 407, column: 17, scope: !484)
!529 = !DILocation(line: 407, column: 29, scope: !484)
!530 = !DILocation(line: 410, column: 5, scope: !484)
!531 = !DILocation(line: 410, column: 18, scope: !484)
!532 = !DILocation(line: 410, column: 24, scope: !484)
!533 = !DILocalVariable(name: "used", scope: !484, file: !13, line: 410, type: !4)
!534 = !DILocation(line: 411, column: 5, scope: !484)
!535 = !DILocation(line: 411, column: 9, scope: !484)
!536 = !DILocation(line: 411, column: 16, scope: !484)
!537 = !DILocation(line: 411, column: 20, scope: !484)
!538 = !DILocation(line: 411, column: 26, scope: !484)
!539 = !DILocation(line: 411, column: 47, scope: !484)
!540 = !DILocation(line: 411, column: 50, scope: !484)
!541 = !DILocation(line: 412, column: 7, scope: !484)
!542 = !DILocation(line: 413, column: 12, scope: !484)
!543 = !DILocation(line: 414, column: 7, scope: !484)
!544 = !DILocation(line: 414, column: 20, scope: !484)
!545 = !DILocation(line: 414, column: 32, scope: !484)
!546 = !DILocation(line: 414, column: 43, scope: !484)
!547 = !DILocation(line: 414, column: 51, scope: !484)
!548 = !DILocation(line: 414, column: 54, scope: !484)
!549 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 423, type: !344, scopeLine: 423, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!550 = !DILocation(line: 423, column: 3, scope: !549)
!551 = !DILocalVariable(name: "this", arg: 1, scope: !549, file: !13, line: 423, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!552 = !DILocation(line: 424, column: 5, scope: !549)
!553 = !DILocation(line: 424, column: 18, scope: !549)
!554 = !DILocation(line: 424, column: 24, scope: !549)
!555 = !DILocalVariable(name: "used", scope: !549, file: !13, line: 424, type: !4)
!556 = !DILocation(line: 425, column: 5, scope: !549)
!557 = !DILocation(line: 425, column: 21, scope: !549)
!558 = !DILocation(line: 425, column: 34, scope: !549)
!559 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!560 = !DILocalVariable(name: "walking", scope: !549, file: !13, line: 425, type: !559)
!561 = !DILocation(line: 426, column: 5, scope: !549)
!562 = !DILocation(line: 426, column: 19, scope: !549)
!563 = !DILocation(line: 426, column: 32, scope: !549)
!564 = !DILocation(line: 426, column: 44, scope: !549)
!565 = !DILocation(line: 426, column: 54, scope: !549)
!566 = !DILocation(line: 426, column: 61, scope: !549)
!567 = !DILocation(line: 426, column: 72, scope: !549)
!568 = !DILocalVariable(name: "slots", scope: !549, file: !13, line: 426, type: !23)
!569 = !DILocation(line: 427, column: 5, scope: !549)
!570 = !DILocation(line: 427, column: 9, scope: !549)
!571 = !DILocation(line: 427, column: 10, scope: !549)
!572 = !DILocation(line: 427, column: 21, scope: !549)
!573 = !DILocation(line: 427, column: 33, scope: !549)
!574 = !DILocation(line: 427, column: 39, scope: !549)
!575 = !DILocation(line: 428, column: 7, scope: !549)
!576 = !DILocation(line: 428, column: 22, scope: !549)
!577 = !DILocation(line: 428, column: 38, scope: !549)
!578 = !DILocation(line: 429, column: 7, scope: !549)
!579 = !DILocation(line: 429, column: 22, scope: !549)
!580 = !DILocation(line: 429, column: 40, scope: !549)
!581 = !DILocation(line: 430, column: 7, scope: !549)
!582 = !DILocation(line: 430, column: 21, scope: !549)
!583 = !DILocation(line: 432, column: 5, scope: !549)
!584 = !DILocation(line: 432, column: 18, scope: !549)
!585 = !DILocation(line: 433, column: 5, scope: !549)
!586 = !DILocation(line: 433, column: 17, scope: !549)
!587 = !DILocation(line: 433, column: 23, scope: !549)
!588 = !DILocation(line: 433, column: 39, scope: !549)
!589 = !DILocation(line: 434, column: 5, scope: !549)
!590 = !DILocation(line: 434, column: 12, scope: !549)
!591 = !DILocation(line: 434, column: 19, scope: !549)
!592 = !{!16, !23, !4, !23, !35, !31}
!593 = !DISubroutineType(types: !592)
!594 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 96, type: !593, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!595 = !DILocation(line: 96, column: 1, scope: !594)
!596 = !DILocalVariable(name: "slots", arg: 1, scope: !594, file: !13, line: 96, type: !23)
!597 = !DILocalVariable(name: "mask", arg: 2, scope: !594, file: !13, line: 96, type: !4)
!598 = !DILocalVariable(name: "hashes", arg: 3, scope: !594, file: !13, line: 96, type: !23)
!599 = !DILocalVariable(name: "keys", arg: 4, scope: !594, file: !13, line: 96, type: !35)
!600 = !DILocalVariable(name: "key", arg: 5, scope: !594, file: !13, line: 96, type: !31)
!601 = !DILocation(line: 97, column: 3, scope: !594)
!602 = !DILocation(line: 97, column: 13, scope: !594)
!603 = !DILocation(line: 97, column: 21, scope: !594)
!604 = !DILocalVariable(name: "h", scope: !594, file: !13, line: 97, type: !19)
!605 = !DILocation(line: 98, column: 3, scope: !594)
!606 = !DILocation(line: 98, column: 23, scope: !594)
!607 = !DILocalVariable(name: "fingerprint", scope: !594, file: !13, line: 98, type: !19)
!608 = !DILocation(line: 99, column: 3, scope: !594)
!609 = !DILocation(line: 99, column: 16, scope: !594)
!610 = !DILocation(line: 99, column: 27, scope: !594)
!611 = !DILocation(line: 99, column: 30, scope: !594)
!612 = !DILocalVariable(name: "bucket", scope: !594, file: !13, line: 99, type: !4)
!613 = !DILocation(line: 102, column: 3, scope: !594)
!614 = !DILocation(line: 102, column: 40, scope: !594)
!615 = !DILocation(line: 111, column: 20, scope: !594)
!616 = !DILocation(line: 113, column: 20, scope: !594)
!617 = !DILocation(line: 102, column: 10, scope: !594)
!618 = !DILocation(line: 102, column: 20, scope: !594)
!619 = !DILocation(line: 102, column: 25, scope: !594)
!620 = !DILocation(line: 102, column: 34, scope: !594)
!621 = !DILocation(line: 102, column: 55, scope: !594)
!622 = !DILocation(line: 103, column: 5, scope: !594)
!623 = !DILocation(line: 103, column: 18, scope: !594)
!624 = !DILocation(line: 103, column: 24, scope: !594)
!625 = !DILocalVariable(name: "word", scope: !594, file: !13, line: 103, type: !19)
!626 = !DILocation(line: 104, column: 5, scope: !594)
!627 = !DILocation(line: 104, column: 9, scope: !594)
!628 = !DILocation(line: 104, column: 18, scope: !594)
!629 = !DILocation(line: 104, column: 21, scope: !594)
!630 = !DILocation(line: 105, column: 7, scope: !594)
!631 = !DILocation(line: 105, column: 14, scope: !594)
!632 = !DILocation(line: 105, column: 23, scope: !594)
!633 = !DILocation(line: 105, column: 31, scope: !594)
!634 = !DILocation(line: 107, column: 5, scope: !594)
!635 = !DILocation(line: 107, column: 9, scope: !594)
!636 = !DILocation(line: 107, column: 25, scope: !594)
!637 = !DILocation(line: 107, column: 38, scope: !594)
!638 = !DILocation(line: 108, column: 7, scope: !594)
!639 = !DILocation(line: 108, column: 18, scope: !594)
!640 = !DILocation(line: 108, column: 24, scope: !594)
!641 = !DILocation(line: 108, column: 31, scope: !594)
!642 = !DILocation(line: 108, column: 43, scope: !594)
!643 = !DILocalVariable(name: "at", scope: !594, file: !13, line: 108, type: !4)
!644 = !DILocation(line: 109, column: 7, scope: !594)
!645 = !DILocation(line: 110, column: 9, scope: !594)
!646 = !DILocation(line: 110, column: 15, scope: !594)
!647 = !DILocation(line: 111, column: 9, scope: !594)
!648 = !DILocation(line: 111, column: 14, scope: !594)
!649 = !DILocation(line: 112, column: 9, scope: !594)
!650 = !DILocation(line: 112, column: 16, scope: !594)
!651 = !DILocation(line: 112, column: 24, scope: !594)
!652 = !DILocation(line: 113, column: 9, scope: !594)
!653 = !DILocation(line: 113, column: 14, scope: !594)
!654 = !DILocation(line: 114, column: 9, scope: !594)
!655 = !DILocation(line: 114, column: 17, scope: !594)
!656 = !DILocation(line: 114, column: 22, scope: !594)
!657 = !DILocation(line: 114, column: 27, scope: !594)
!658 = !DILocation(line: 115, column: 9, scope: !594)
!659 = !DILocation(line: 116, column: 9, scope: !594)
!660 = !DILocation(line: 116, column: 16, scope: !594)
!661 = !DILocation(line: 116, column: 24, scope: !594)
!662 = !DILocation(line: 116, column: 32, scope: !594)
!663 = !DILocation(line: 119, column: 5, scope: !594)
!664 = !DILocation(line: 119, column: 14, scope: !594)
!665 = !DILocation(line: 119, column: 15, scope: !594)
!666 = !DILocation(line: 119, column: 24, scope: !594)
!667 = !DILocation(line: 119, column: 29, scope: !594)
!668 = !DILocation(line: 121, column: 3, scope: !594)
!669 = !DILocation(line: 121, column: 9, scope: !594)
!670 = !{null, !35, !23}
!671 = !DISubroutineType(types: !670)
!672 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 142, type: !671, scopeLine: 142, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!673 = !DILocation(line: 142, column: 1, scope: !672)
!674 = !DILocalVariable(name: "items", arg: 1, scope: !672, file: !13, line: 142, type: !35)
!675 = !DILocalVariable(name: "hashes", arg: 2, scope: !672, file: !13, line: 142, type: !23)
!676 = !DILocation(line: 143, column: 3, scope: !672)
!677 = !DILocation(line: 143, column: 16, scope: !672)
!678 = !DILocation(line: 143, column: 22, scope: !672)
!679 = !DILocalVariable(name: "used", scope: !672, file: !13, line: 143, type: !4)
!680 = !DILocation(line: 144, column: 3, scope: !672)
!681 = !DILocation(line: 144, column: 17, scope: !672)
!682 = !DILocalVariable(name: "to", scope: !672, file: !13, line: 144, type: !4)
!683 = !DILocation(line: 145, column: 3, scope: !672)
!684 = !DILocation(line: 145, column: 24, scope: !672)
!685 = !DILocalVariable(name: "from", scope: !672, file: !13, line: 145, type: !4)
!686 = !DILocation(line: 145, column: 55, scope: !672)
!687 = !DILocation(line: 146, column: 68, scope: !672)
!688 = !DILocation(line: 145, column: 27, scope: !672)
!689 = !DILocation(line: 145, column: 34, scope: !672)
!690 = !DILocation(line: 145, column: 42, scope: !672)
!691 = !DILocation(line: 145, column: 49, scope: !672)
!692 = !DILocation(line: 145, column: 79, scope: !672)
!693 = !DILocation(line: 146, column: 5, scope: !672)
!694 = !DILocation(line: 146, column: 9, scope: !672)
!695 = !DILocation(line: 146, column: 16, scope: !672)
!696 = !DILocation(line: 146, column: 26, scope: !672)
!697 = !DILocation(line: 146, column: 31, scope: !672)
!698 = !DILocation(line: 146, column: 37, scope: !672)
!699 = !DILocation(line: 146, column: 42, scope: !672)
!700 = !DILocation(line: 146, column: 47, scope: !672)
!701 = !DILocation(line: 146, column: 55, scope: !672)
!702 = !DILocation(line: 146, column: 62, scope: !672)
!703 = !DILocation(line: 146, column: 83, scope: !672)
!704 = !DILocation(line: 147, column: 7, scope: !672)
!705 = !DILocation(line: 147, column: 13, scope: !672)
!706 = !DILocation(line: 147, column: 19, scope: !672)
!707 = !DILocation(line: 147, column: 25, scope: !672)
!708 = !DILocation(line: 148, column: 7, scope: !672)
!709 = !DILocation(line: 145, column: 71, scope: !672)
!710 = !DILocation(line: 151, column: 3, scope: !672)
!711 = !DILocation(line: 151, column: 10, scope: !672)
!712 = !DILocation(line: 151, column: 16, scope: !672)
!713 = !DILocation(line: 151, column: 32, scope: !672)
!714 = !DILocation(line: 151, column: 36, scope: !672)
!715 = !DILocation(line: 152, column: 5, scope: !672)
!716 = !{null, !43, !23}
!717 = !DISubroutineType(types: !716)
!718 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 142, type: !717, scopeLine: 142, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!719 = !DILocation(line: 142, column: 1, scope: !718)
!720 = !DILocalVariable(name: "items", arg: 1, scope: !718, file: !13, line: 142, type: !43)
!721 = !DILocalVariable(name: "hashes", arg: 2, scope: !718, file: !13, line: 142, type: !23)
!722 = !DILocation(line: 143, column: 3, scope: !718)
!723 = !DILocation(line: 143, column: 16, scope: !718)
!724 = !DILocation(line: 143, column: 22, scope: !718)
!725 = !DILocalVariable(name: "used", scope: !718, file: !13, line: 143, type: !4)
!726 = !DILocation(line: 144, column: 3, scope: !718)
!727 = !DILocation(line: 144, column: 17, scope: !718)
!728 = !DILocalVariable(name: "to", scope: !718, file: !13, line: 144, type: !4)
!729 = !DILocation(line: 145, column: 3, scope: !718)
!730 = !DILocation(line: 145, column: 24, scope: !718)
!731 = !DILocalVariable(name: "from", scope: !718, file: !13, line: 145, type: !4)
!732 = !DILocation(line: 145, column: 55, scope: !718)
!733 = !DILocation(line: 146, column: 68, scope: !718)
!734 = !DILocation(line: 145, column: 27, scope: !718)
!735 = !DILocation(line: 145, column: 34, scope: !718)
!736 = !DILocation(line: 145, column: 42, scope: !718)
!737 = !DILocation(line: 145, column: 49, scope: !718)
!738 = !DILocation(line: 145, column: 79, scope: !718)
!739 = !DILocation(line: 146, column: 5, scope: !718)
!740 = !DILocation(line: 146, column: 9, scope: !718)
!741 = !DILocation(line: 146, column: 16, scope: !718)
!742 = !DILocation(line: 146, column: 26, scope: !718)
!743 = !DILocation(line: 146, column: 31, scope: !718)
!744 = !DILocation(line: 146, column: 37, scope: !718)
!745 = !DILocation(line: 146, column: 42, scope: !718)
!746 = !DILocation(line: 146, column: 47, scope: !718)
!747 = !DILocation(line: 146, column: 55, scope: !718)
!748 = !DILocation(line: 146, column: 62, scope: !718)
!749 = !DILocation(line: 146, column: 83, scope: !718)
!750 = !DILocation(line: 147, column: 7, scope: !718)
!751 = !DILocation(line: 147, column: 13, scope: !718)
!752 = !DILocation(line: 147, column: 19, scope: !718)
!753 = !DILocation(line: 147, column: 25, scope: !718)
!754 = !DILocation(line: 148, column: 7, scope: !718)
!755 = !DILocation(line: 145, column: 71, scope: !718)
!756 = !DILocation(line: 151, column: 3, scope: !718)
!757 = !DILocation(line: 151, column: 10, scope: !718)
!758 = !DILocation(line: 151, column: 16, scope: !718)
!759 = !DILocation(line: 151, column: 32, scope: !718)
!760 = !DILocation(line: 151, column: 36, scope: !718)
!761 = !DILocation(line: 152, column: 5, scope: !718)
