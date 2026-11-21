%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@nish_hash_key = external global [2 x i64], align 8
@.str.1 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.1 to i8*))
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
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = call i8* @nish_alloc_struct(i64 56), !dbg !10
  %1 = bitcast i8* %0 to %struct.Map$str$i32*, !dbg !10
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1), !dbg !10
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %m.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Map$str$i32** %m.addr, metadata !48, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !49
  %3 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 4), !dbg !49
  %4 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !53
  %5 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !52
  %6 = icmp sge i64 %5, 0, !dbg !52
  br i1 %6, label %get.found, label %get.end, !dbg !52

get.found:
  %7 = trunc i64 %5 to i32, !dbg !52
  %8 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %4, i32 %7, i32 zeroinitializer), !dbg !52
  br label %get.end, !dbg !52

get.end:
  %9 = phi i32 [ %8, %get.found ], [ 0, %entry ], !dbg !52
  call void @llvm.dbg.value(metadata i32 %9, metadata !55, metadata !DIExpression()), !dbg !52
  br i1 %6, label %if.then, label %if.end, !dbg !56

if.then:
  %10 = call i8* @nish_str_from_i32(i32 %9), !dbg !60
  call void @nish_print(i8* %10), !dbg !59
  br label %if.end, !dbg !56

if.end:
  call void @nish_arena_release(i64 %arena.mark), !dbg !62
  ret i32 0, !dbg !62
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !64 {
entry:
  %0 = call i32 @nish_main(), !dbg !65
  call void @nish_free_arena(), !dbg !65
  ret i32 %0, !dbg !65
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 !dbg !68 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !70, metadata !DIExpression()), !dbg !69
  call void @llvm.dbg.value(metadata i32 %mask, metadata !71, metadata !DIExpression()), !dbg !69
  %0 = lshr i32 %h, 16, !dbg !75
  %1 = xor i32 %h, %0, !dbg !73
  %2 = and i32 %1, %mask, !dbg !72
  ret i32 %2, !dbg !69
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 !dbg !79 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !81, metadata !DIExpression()), !dbg !80
  call void @llvm.dbg.value(metadata i32 %mask, metadata !82, metadata !DIExpression()), !dbg !80
  call void @llvm.dbg.value(metadata i32 %index, metadata !83, metadata !DIExpression()), !dbg !80
  %0 = xor i32 %mask, -1, !dbg !86
  %1 = and i32 %h, %0, !dbg !85
  %2 = add i32 %index, 1, !dbg !90
  %3 = or i32 %1, %2, !dbg !84
  ret i32 %3, !dbg !80
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !95 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !97, metadata !DIExpression()), !dbg !96
  call void @llvm.dbg.value(metadata i32 %index, metadata !98, metadata !DIExpression()), !dbg !96
  %0 = sext i32 %bucket to i64, !dbg !100
  %1 = shl i64 %0, 32, !dbg !100
  %2 = sext i32 %index to i64, !dbg !102
  %3 = or i64 %1, %2, !dbg !99
  ret i64 %3, !dbg !96
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !106 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !108, metadata !DIExpression()), !dbg !107
  call void @llvm.dbg.value(metadata i32 %h, metadata !109, metadata !DIExpression()), !dbg !107
  %0 = sext i32 %bucket to i64, !dbg !113
  %1 = shl i64 %0, 32, !dbg !113
  %2 = zext i32 %h to i64, !dbg !115
  %3 = or i64 %1, %2, !dbg !112
  %4 = xor i64 %3, -1, !dbg !110
  ret i64 %4, !dbg !107
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !119 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !121, metadata !DIExpression()), !dbg !120
  call void @llvm.dbg.value(metadata i32 %mask, metadata !122, metadata !DIExpression()), !dbg !120
  call void @llvm.dbg.value(metadata i32 %h, metadata !123, metadata !DIExpression()), !dbg !120
  call void @llvm.dbg.value(metadata i32 %index, metadata !124, metadata !DIExpression()), !dbg !120
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index), !dbg !126
  store i32 %0, i32* %word.addr, align 4, !dbg !125
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !130, metadata !DIExpression()), !dbg !125
  store i32 %mask, i32* %low.addr, align 4, !dbg !131
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !134, metadata !DIExpression()), !dbg !131
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !137
  store i32 %1, i32* %bucket.addr, align 4, !dbg !135
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !140, metadata !DIExpression()), !dbg !135
  %2 = load i32, i32* %bucket.addr, align 4, !dbg !143
  store i32 %2, i32* %b.addr, align 4, !dbg !141
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !144, metadata !DIExpression()), !dbg !141
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !145
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !145
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !145
  %6 = load i8*, i8** %5, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !145
  br label %while.cond, !dbg !145

while.cond:
  %7 = load i32, i32* %b.addr, align 4, !dbg !159
  %8 = icmp sge i32 %7, 0, !dbg !159
  br i1 %8, label %land.rhs, label %land.end, !dbg !159

land.rhs:
  %9 = load i32, i32* %b.addr, align 4, !dbg !161
  %10 = trunc i64 %4 to i32, !dbg !146
  %11 = icmp slt i32 %9, %10, !dbg !161
  br label %land.end, !dbg !159

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ], !dbg !159
  br i1 %12, label %while.body, label %while.end, !dbg !145

while.body:
  %13 = load i32, i32* %b.addr, align 4, !dbg !166
  %14 = sext i32 %13 to i64, !dbg !165
  %15 = bitcast i8* %6 to i32*, !dbg !165
  %16 = getelementptr inbounds i32, i32* %15, i64 %14, !dbg !165
  %17 = load i32, i32* %16, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !165
  %18 = icmp eq i32 %17, 0, !dbg !165
  br i1 %18, label %if.then, label %if.end, !dbg !164

if.then:
  %19 = load i32, i32* %b.addr, align 4, !dbg !172
  %20 = sext i32 %19 to i64, !dbg !171
  %21 = load i32, i32* %word.addr, align 4, !dbg !173
  %22 = bitcast i8* %6 to i32*, !dbg !171
  %23 = getelementptr inbounds i32, i32* %22, i64 %20, !dbg !171
  store i32 %21, i32* %23, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !171
  ret void, !dbg !174

if.end:
  %24 = load i32, i32* %bucket.addr, align 4, !dbg !177
  %25 = add i32 %24, 1, !dbg !177
  %26 = load i32, i32* %low.addr, align 4, !dbg !179
  %27 = and i32 %25, %26, !dbg !176
  store i32 %27, i32* %bucket.addr, align 4, !dbg !175
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !182
  store i32 %28, i32* %b.addr, align 4, !dbg !180
  br label %while.cond, !dbg !145

while.end:
  ret void, !dbg !120
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !185 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !187, metadata !DIExpression()), !dbg !186
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !190
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !190
  %2 = trunc i64 %1 to i32, !dbg !190
  store i32 %2, i32* %used.addr, align 4, !dbg !188
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !191, metadata !DIExpression()), !dbg !188
  store i32 0, i32* %to.addr, align 4, !dbg !192
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !194, metadata !DIExpression()), !dbg !192
  store i32 0, i32* %from.addr, align 4, !dbg !195
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !197, metadata !DIExpression()), !dbg !195
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !195
  %4 = load i8*, i8** %3, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !195
  br label %for.cond, !dbg !195

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !199
  %6 = load i32, i32* %used.addr, align 4, !dbg !200
  %7 = icmp slt i32 %5, %6, !dbg !199
  br i1 %7, label %for.body, label %for.end, !dbg !195

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !203
  %9 = sext i32 %8 to i64, !dbg !198
  %10 = bitcast i8* %4 to i32*, !dbg !198
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !198
  %12 = load i32, i32* %11, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !198
  store i32 %12, i32* %h.addr, align 4, !dbg !202
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !204, metadata !DIExpression()), !dbg !202
  %13 = load i32, i32* %h.addr, align 4, !dbg !206
  %14 = icmp ne i32 %13, 0, !dbg !206
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !206

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !208
  %16 = icmp sge i32 %15, 0, !dbg !208
  br label %land.end.1, !dbg !206

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !206
  br i1 %17, label %land.rhs, label %land.end, !dbg !206

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !210
  %19 = load i32, i32* %used.addr, align 4, !dbg !211
  %20 = icmp slt i32 %18, %19, !dbg !210
  br label %land.end, !dbg !206

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !206
  br i1 %21, label %if.then, label %if.end, !dbg !205

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !214
  %23 = sext i32 %22 to i64, !dbg !213
  %24 = load i32, i32* %h.addr, align 4, !dbg !215
  %25 = bitcast i8* %4 to i32*, !dbg !213
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !213
  store i32 %24, i32* %26, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !213
  %27 = load i32, i32* %to.addr, align 4, !dbg !216
  %28 = add nsw i32 %27, 1, !dbg !216
  store i32 %28, i32* %to.addr, align 4, !dbg !216
  br label %if.end, !dbg !205

if.end:
  br label %for.inc, !dbg !195

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !217
  %30 = add nsw i32 %29, 1, !dbg !217
  store i32 %30, i32* %from.addr, align 4, !dbg !217
  br label %for.cond, !dbg !195

for.end:
  br label %while.cond, !dbg !218

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !220
  %32 = load i64, i64* %31, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !220
  %33 = trunc i64 %32 to i32, !dbg !220
  %34 = load i32, i32* %to.addr, align 4, !dbg !221
  %35 = icmp sgt i32 %33, %34, !dbg !219
  br i1 %35, label %land.rhs.2, label %land.end.2, !dbg !219

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !222
  %37 = load i64, i64* %36, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !222
  %38 = trunc i64 %37 to i32, !dbg !222
  %39 = icmp sgt i32 %38, 0, !dbg !222
  br label %land.end.2, !dbg !219

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ], !dbg !219
  br i1 %40, label %while.body, label %while.end, !dbg !218

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !225
  %42 = load i64, i64* %41, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !225
  %43 = sub i64 %42, 1, !dbg !225
  store i64 %43, i64* %41, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !225
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !225
  %45 = load i8*, i8** %44, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !225
  %46 = bitcast i8* %45 to i32*, !dbg !225
  %47 = getelementptr inbounds i32, i32* %46, i64 %43, !dbg !225
  %48 = load i32, i32* %47, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !225
  br label %while.cond, !dbg !218

while.end:
  ret void, !dbg !186
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !228 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !230, metadata !DIExpression()), !dbg !229
  call void @llvm.dbg.value(metadata i32 %live, metadata !231, metadata !DIExpression()), !dbg !229
  call void @llvm.dbg.value(metadata i32 %used, metadata !232, metadata !DIExpression()), !dbg !229
  %0 = sext i32 %live to i64, !dbg !234
  %1 = mul nsw i64 %0, 2, !dbg !234
  %2 = sext i32 %used to i64, !dbg !237
  %3 = icmp slt i64 %1, %2, !dbg !234
  br i1 %3, label %if.then, label %if.end, !dbg !233

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !240
  ret %struct.nish_array* %slots, !dbg !242

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !246
  %5 = load i64, i64* %4, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !246
  %6 = trunc i64 %5 to i32, !dbg !246
  store i32 %6, i32* %n.addr, align 4, !dbg !244
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !247, metadata !DIExpression()), !dbg !244
  %7 = load i32, i32* %n.addr, align 4, !dbg !249
  %8 = icmp sge i32 %7, 0, !dbg !249
  br i1 %8, label %land.rhs, label %land.end, !dbg !249

land.rhs:
  %9 = load i32, i32* %n.addr, align 4, !dbg !251
  %10 = icmp slt i32 %9, 32768, !dbg !251
  br label %land.end, !dbg !249

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ], !dbg !249
  br i1 %11, label %if.then.1, label %if.end.1, !dbg !248

if.then.1:
  %12 = load i32, i32* %n.addr, align 4, !dbg !257
  %13 = mul nsw i32 %12, 2, !dbg !257
  %14 = trunc i32 %13 to i16, !dbg !256
  %15 = zext i16 %14 to i64, !dbg !255
  %16 = call i8* @nish_alloc_struct(i64 24), !dbg !255
  %17 = bitcast i8* %16 to %struct.nish_array*, !dbg !255
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0, !dbg !255
  store i64 %15, i64* %18, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !255
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1, !dbg !255
  store i64 %15, i64* %19, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !255
  %20 = mul i64 %15, 4, !dbg !255
  %21 = call i8* @nish_alloc_struct(i64 %20), !dbg !255
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !151, !noalias !150, !dbg !255
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2, !dbg !255
  store i8* %21, i8** %22, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !255
  ret %struct.nish_array* %17, !dbg !254

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2), !dbg !260
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !263
  ret %struct.nish_array* %slots, !dbg !265
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 !dbg !269 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !271, metadata !DIExpression()), !dbg !270
  call void @llvm.dbg.value(metadata i32 %times, metadata !272, metadata !DIExpression()), !dbg !270
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !275
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !275
  %2 = trunc i64 %1 to i32, !dbg !275
  store i32 %2, i32* %n.addr, align 4, !dbg !273
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !276, metadata !DIExpression()), !dbg !273
  store i32 1, i32* %k.addr, align 4, !dbg !277
  call void @llvm.dbg.declare(metadata i32* %k.addr, metadata !279, metadata !DIExpression()), !dbg !277
  br label %for.cond, !dbg !277

for.cond:
  %3 = load i32, i32* %k.addr, align 4, !dbg !280
  %4 = icmp slt i32 %3, %times, !dbg !280
  br i1 %4, label %for.body, label %for.end, !dbg !277

for.body:
  store i32 0, i32* %i.addr, align 4, !dbg !283
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !285, metadata !DIExpression()), !dbg !283
  br label %for.cond.1, !dbg !283

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4, !dbg !286
  %6 = load i32, i32* %n.addr, align 4, !dbg !287
  %7 = icmp slt i32 %5, %6, !dbg !286
  br i1 %7, label %for.body.1, label %for.end.1, !dbg !283

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !289
  %9 = load i64, i64* %8, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !289
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1, !dbg !289
  %11 = load i64, i64* %10, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !289
  %12 = icmp eq i64 %9, %11, !dbg !289
  br i1 %12, label %push.grow, label %push.store, !dbg !289

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4), !dbg !289
  br label %push.store, !dbg !289

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !289
  %14 = load i8*, i8** %13, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !289
  %15 = bitcast i8* %14 to i32*, !dbg !289
  %16 = getelementptr inbounds i32, i32* %15, i64 %9, !dbg !289
  store i32 0, i32* %16, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !289
  %17 = add i64 %9, 1, !dbg !289
  store i64 %17, i64* %8, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !289
  %18 = trunc i64 %17 to i32, !dbg !289
  br label %for.inc.1, !dbg !283

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4, !dbg !291
  %20 = add nsw i32 %19, 1, !dbg !291
  store i32 %20, i32* %i.addr, align 4, !dbg !291
  br label %for.cond.1, !dbg !283

for.end.1:
  br label %for.inc, !dbg !277

for.inc:
  %21 = load i32, i32* %k.addr, align 4, !dbg !292
  %22 = add nsw i32 %21, 1, !dbg !292
  store i32 %22, i32* %k.addr, align 4, !dbg !292
  br label %for.cond, !dbg !277

for.end:
  ret void, !dbg !270
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !295 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !297, metadata !DIExpression()), !dbg !296
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !298, metadata !DIExpression()), !dbg !296
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !301
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !301
  %2 = trunc i64 %1 to i32, !dbg !301
  %3 = sub nsw i32 %2, 1, !dbg !300
  store i32 %3, i32* %mask.addr, align 4, !dbg !299
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !303, metadata !DIExpression()), !dbg !299
  store i32 0, i32* %i.addr, align 4, !dbg !304
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !306, metadata !DIExpression()), !dbg !304
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !304
  %5 = load i64, i64* %4, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !304
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !304
  %7 = load i8*, i8** %6, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !304
  br label %for.cond, !dbg !304

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !308
  %9 = trunc i64 %5 to i32, !dbg !307
  %10 = icmp slt i32 %8, %9, !dbg !308
  br i1 %10, label %for.body, label %for.end, !dbg !304

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !313
  %12 = sext i32 %11 to i64, !dbg !312
  %13 = bitcast i8* %7 to i32*, !dbg !312
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !312
  %15 = load i32, i32* %14, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !312
  store i32 %15, i32* %h.addr, align 4, !dbg !311
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !314, metadata !DIExpression()), !dbg !311
  %16 = load i32, i32* %h.addr, align 4, !dbg !316
  %17 = icmp ne i32 %16, 0, !dbg !316
  br i1 %17, label %if.then, label %if.end, !dbg !315

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !321
  %19 = load i32, i32* %h.addr, align 4, !dbg !322
  %20 = load i32, i32* %i.addr, align 4, !dbg !323
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !319
  br label %if.end, !dbg !315

if.end:
  br label %for.inc, !dbg !304

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !324
  %22 = add nsw i32 %21, 1, !dbg !324
  store i32 %22, i32* %i.addr, align 4, !dbg !324
  br label %for.cond, !dbg !304

for.end:
  ret void, !dbg !296
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !325 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !327, metadata !DIExpression()), !dbg !326
  store i32 0, i32* %i.addr, align 4, !dbg !328
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !330, metadata !DIExpression()), !dbg !328
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !328
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !328
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !328
  %3 = load i8*, i8** %2, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !328
  br label %for.cond, !dbg !328

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !332
  %5 = trunc i64 %1 to i32, !dbg !331
  %6 = icmp slt i32 %4, %5, !dbg !332
  br i1 %6, label %for.body, label %for.end, !dbg !328

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !336
  %8 = sext i32 %7 to i64, !dbg !335
  %9 = bitcast i8* %3 to i32*, !dbg !335
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !335
  store i32 0, i32* %10, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !335
  br label %for.inc, !dbg !328

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !338
  %12 = add nsw i32 %11, 1, !dbg !338
  store i32 %12, i32* %i.addr, align 4, !dbg !338
  br label %for.cond, !dbg !328

for.end:
  ret void, !dbg !326
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 !dbg !342 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !344, metadata !DIExpression()), !dbg !343
  call void @llvm.dbg.value(metadata i32 %mask, metadata !345, metadata !DIExpression()), !dbg !343
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !346, metadata !DIExpression()), !dbg !343
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !347, metadata !DIExpression()), !dbg !343
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !350
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !350
  %2 = trunc i64 %1 to i32, !dbg !350
  store i32 %2, i32* %used.addr, align 4, !dbg !348
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !351, metadata !DIExpression()), !dbg !348
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !354
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !354
  %5 = trunc i64 %4 to i32, !dbg !354
  store i32 %5, i32* %size.addr, align 4, !dbg !352
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !355, metadata !DIExpression()), !dbg !352
  %6 = load i32, i32* %used.addr, align 4, !dbg !358
  %7 = sext i32 %6 to i64, !dbg !357
  %8 = mul nsw i64 %7, 4, !dbg !357
  %9 = load i32, i32* %size.addr, align 4, !dbg !361
  %10 = sext i32 %9 to i64, !dbg !360
  %11 = mul nsw i64 %10, 3, !dbg !360
  %12 = icmp sgt i64 %8, %11, !dbg !357
  br i1 %12, label %lor.end.1, label %lor.rhs.1, !dbg !357

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0, !dbg !363
  br label %lor.end.1, !dbg !357

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ], !dbg !357
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !357

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4, !dbg !366
  %16 = icmp sge i32 %bucket, %15, !dbg !365
  br label %lor.end, !dbg !357

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ], !dbg !357
  br i1 %17, label %if.then, label %if.end, !dbg !356

if.then:
  ret i1 false, !dbg !368

if.end:
  %18 = load i32, i32* %used.addr, align 4, !dbg !371
  %19 = icmp sgt i32 %18, 0, !dbg !371
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !370

if.then.1:
  %20 = sext i32 %bucket to i64, !dbg !374
  %21 = load i32, i32* %used.addr, align 4, !dbg !378
  %22 = sub nsw i32 %21, 1, !dbg !378
  %23 = sext i32 %22 to i64, !dbg !377
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !377
  %25 = load i8*, i8** %24, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !377
  %26 = bitcast i8* %25 to i32*, !dbg !377
  %27 = getelementptr inbounds i32, i32* %26, i64 %23, !dbg !377
  %28 = load i32, i32* %27, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !377
  %29 = load i32, i32* %used.addr, align 4, !dbg !381
  %30 = sub nsw i32 %29, 1, !dbg !381
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30), !dbg !376
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !374
  %33 = load i8*, i8** %32, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !374
  %34 = bitcast i8* %33 to i32*, !dbg !374
  %35 = getelementptr inbounds i32, i32* %34, i64 %20, !dbg !374
  store i32 %31, i32* %35, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !374
  br label %if.end.1, !dbg !370

if.end.1:
  ret i1 true, !dbg !383
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 !dbg !387 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !389, metadata !DIExpression()), !dbg !388
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !388
  store i32 0, i32* %0, align 4, !tbaa !393, !dbg !388
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !388
  store i32 7, i32* %1, align 4, !tbaa !394, !dbg !388
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !388
  store i32 0, i32* %2, align 4, !tbaa !395, !dbg !388
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !388
  store i32 0, i32* %3, align 4, !tbaa !396, !dbg !388
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !398
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !398
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !398
  store i64 8, i64* %6, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !398
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !398
  store i64 8, i64* %7, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !398
  %8 = mul i64 8, 4, !dbg !398
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !398
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !151, !noalias !150, !dbg !398
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !398
  store i8* %9, i8** %10, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !398
  %11 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !397
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !399, !dbg !397
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !401
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !401
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !401
  store i64 0, i64* %14, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !401
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !401
  store i64 0, i64* %15, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !401
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !401
  store i8* null, i8** %16, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !401
  %17 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !400
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !402, !dbg !400
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !404
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !404
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !404
  store i64 0, i64* %20, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !404
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !404
  store i64 0, i64* %21, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !404
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !404
  store i8* null, i8** %22, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !404
  %23 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !403
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !405, !dbg !403
  %24 = call i8* @nish_alloc_struct(i64 24), !dbg !407
  %25 = bitcast i8* %24 to %struct.nish_array*, !dbg !407
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0, !dbg !407
  store i64 0, i64* %26, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !407
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1, !dbg !407
  store i64 0, i64* %27, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !407
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2, !dbg !407
  store i8* null, i8** %28, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !407
  %29 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !406
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !408, !dbg !406
  ret void, !dbg !388
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 !dbg !411 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !413, metadata !DIExpression()), !dbg !412
  call void @llvm.dbg.value(metadata i8* %key, metadata !414, metadata !DIExpression()), !dbg !412
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !417
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !399, !dbg !417
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !418
  %3 = load i32, i32* %2, align 4, !tbaa !394, !dbg !418
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !419
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !408, !dbg !419
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !420
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !402, !dbg !420
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !416
  ret i64 %8, !dbg !415
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !424 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !426, metadata !DIExpression()), !dbg !425
  call void @llvm.dbg.value(metadata i8* %key, metadata !427, metadata !DIExpression()), !dbg !425
  call void @llvm.dbg.value(metadata i32 %value, metadata !428, metadata !DIExpression()), !dbg !425
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !430
  store i64 %0, i64* %found.addr, align 8, !dbg !429
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !432, metadata !DIExpression()), !dbg !429
  %1 = load i64, i64* %found.addr, align 8, !dbg !434
  %2 = icmp sge i64 %1, 0, !dbg !434
  br i1 %2, label %if.then, label %if.else, !dbg !433

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !439
  %4 = trunc i64 %3 to i32, !dbg !438
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !437
  br label %if.end, !dbg !433

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !443
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !442
  br label %if.end, !dbg !433

if.end:
  ret %struct.Map$str$i32* %this, !dbg !446
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %none) #4 !dbg !450 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !452, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata i32 %index, metadata !453, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata i32 %none, metadata !454, metadata !DIExpression()), !dbg !451
  %0 = icmp sge i32 %index, 0, !dbg !456
  br i1 %0, label %land.rhs, label %land.end, !dbg !456

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !460
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !405, !dbg !460
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !460
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !460
  %5 = trunc i64 %4 to i32, !dbg !460
  %6 = icmp slt i32 %index, %5, !dbg !458
  br label %land.end, !dbg !456

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !456
  br i1 %7, label %if.then, label %if.end, !dbg !455

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !463
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !405, !dbg !463
  %10 = sext i32 %index to i64, !dbg !463
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !463
  %12 = load i8*, i8** %11, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !463
  %13 = bitcast i8* %12 to i32*, !dbg !463
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !463
  %15 = load i32, i32* %14, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !463
  ret i32 %15, !dbg !462

if.end:
  ret i32 %none, !dbg !465
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 !dbg !469 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !471, metadata !DIExpression()), !dbg !470
  call void @llvm.dbg.value(metadata i32 %index, metadata !472, metadata !DIExpression()), !dbg !470
  call void @llvm.dbg.value(metadata i32 %value, metadata !473, metadata !DIExpression()), !dbg !470
  %0 = icmp sge i32 %index, 0, !dbg !475
  br i1 %0, label %land.rhs, label %land.end, !dbg !475

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !479
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !405, !dbg !479
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !479
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !479
  %5 = trunc i64 %4 to i32, !dbg !479
  %6 = icmp slt i32 %index, %5, !dbg !477
  br label %land.end, !dbg !475

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !475
  br i1 %7, label %if.then, label %if.end, !dbg !474

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !481
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !405, !dbg !481
  %10 = sext i32 %index to i64, !dbg !481
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !481
  %12 = load i8*, i8** %11, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !481
  %13 = bitcast i8* %12 to i32*, !dbg !481
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !481
  store i32 %value, i32* %14, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !481
  br label %if.end, !dbg !474

if.end:
  ret void, !dbg !470
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !486 {
entry:
  %packed.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !488, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i64 %absent, metadata !489, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i8* %key, metadata !490, metadata !DIExpression()), !dbg !487
  call void @llvm.dbg.value(metadata i32 %value, metadata !491, metadata !DIExpression()), !dbg !487
  %0 = sub nsw i64 -1, %absent, !dbg !493
  store i64 %0, i64* %packed.addr, align 8, !dbg !492
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !495, metadata !DIExpression()), !dbg !492
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !496
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !402, !dbg !496
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !496
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !496
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !496
  %6 = load i64, i64* %5, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !496
  %7 = icmp eq i64 %4, %6, !dbg !496
  br i1 %7, label %push.grow, label %push.store, !dbg !496

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8), !dbg !496
  br label %push.store, !dbg !496

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !496
  %9 = load i8*, i8** %8, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !496
  %10 = bitcast i8* %9 to i8**, !dbg !496
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4, !dbg !496
  store i8* %key, i8** %11, align 8, !alias.scope !151, !noalias !150, !tbaa !499, !dbg !496
  %12 = add i64 %4, 1, !dbg !496
  store i64 %12, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !496
  %13 = trunc i64 %12 to i32, !dbg !496
  %14 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !500
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !405, !dbg !500
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !500
  %17 = load i64, i64* %16, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !500
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !500
  %19 = load i64, i64* %18, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !500
  %20 = icmp eq i64 %17, %19, !dbg !500
  br i1 %20, label %push.grow.1, label %push.store.1, !dbg !500

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4), !dbg !500
  br label %push.store.1, !dbg !500

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !500
  %22 = load i8*, i8** %21, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !500
  %23 = bitcast i8* %22 to i32*, !dbg !500
  %24 = getelementptr inbounds i32, i32* %23, i64 %17, !dbg !500
  store i32 %value, i32* %24, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !500
  %25 = add i64 %17, 1, !dbg !500
  store i64 %25, i64* %16, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !500
  %26 = trunc i64 %25 to i32, !dbg !500
  %27 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !502
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !408, !dbg !502
  %29 = load i64, i64* %packed.addr, align 8, !dbg !504
  %30 = trunc i64 %29 to i32, !dbg !503
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0, !dbg !502
  %32 = load i64, i64* %31, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !502
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1, !dbg !502
  %34 = load i64, i64* %33, align 8, !alias.scope !150, !noalias !151, !tbaa !259, !dbg !502
  %35 = icmp eq i64 %32, %34, !dbg !502
  br i1 %35, label %push.grow.2, label %push.store.2, !dbg !502

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4), !dbg !502
  br label %push.store.2, !dbg !502

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2, !dbg !502
  %37 = load i8*, i8** %36, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !502
  %38 = bitcast i8* %37 to i32*, !dbg !502
  %39 = getelementptr inbounds i32, i32* %38, i64 %32, !dbg !502
  store i32 %30, i32* %39, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !502
  %40 = add i64 %32, 1, !dbg !502
  store i64 %40, i64* %31, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !502
  %41 = trunc i64 %40 to i32, !dbg !502
  call void @nish.Map$str$i32.addOne(%struct.Map$str$i32* %this), !dbg !505
  %42 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !509
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !399, !dbg !509
  %44 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !510
  %45 = load i32, i32* %44, align 4, !tbaa !394, !dbg !510
  %46 = load i64, i64* %packed.addr, align 8, !dbg !512
  %47 = ashr i64 %46, 32, !dbg !512
  %48 = trunc i64 %47 to i32, !dbg !511
  %49 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !513
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !408, !dbg !513
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50), !dbg !508
  %52 = xor i1 %51, true, !dbg !507
  br i1 %52, label %if.then, label %if.end, !dbg !506

if.then:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !515
  br label %if.end, !dbg !506

if.end:
  ret void, !dbg !487
}

define internal void @nish.Map$str$i32.addOne(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 !dbg !516 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !518, metadata !DIExpression()), !dbg !517
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !520
  %1 = load i32, i32* %0, align 4, !tbaa !395, !dbg !520
  store i32 %1, i32* %live.addr, align 4, !dbg !519
  call void @llvm.dbg.declare(metadata i32* %live.addr, metadata !521, metadata !DIExpression()), !dbg !519
  %2 = load i32, i32* %live.addr, align 4, !dbg !523
  %3 = icmp slt i32 %2, 2147483647, !dbg !523
  br i1 %3, label %if.then, label %if.end, !dbg !522

if.then:
  %4 = load i32, i32* %live.addr, align 4, !dbg !527
  %5 = add nsw i32 %4, 1, !dbg !527
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !526
  store i32 %5, i32* %6, align 4, !tbaa !395, !dbg !526
  br label %if.end, !dbg !522

if.end:
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !530
  %8 = load i32, i32* %7, align 4, !tbaa !393, !dbg !530
  store i32 %8, i32* %size.addr, align 4, !dbg !529
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !531, metadata !DIExpression()), !dbg !529
  %9 = load i32, i32* %size.addr, align 4, !dbg !533
  %10 = icmp slt i32 %9, 2147483647, !dbg !533
  br i1 %10, label %if.then.1, label %if.end.1, !dbg !532

if.then.1:
  %11 = load i32, i32* %size.addr, align 4, !dbg !537
  %12 = add nsw i32 %11, 1, !dbg !537
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !536
  store i32 %12, i32* %13, align 4, !tbaa !393, !dbg !536
  br label %if.end.1, !dbg !532

if.end.1:
  ret void, !dbg !517
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !539 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !541, metadata !DIExpression()), !dbg !540
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !544
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !402, !dbg !544
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !544
  %3 = load i64, i64* %2, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !544
  %4 = trunc i64 %3 to i32, !dbg !544
  store i32 %4, i32* %used.addr, align 4, !dbg !542
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !545, metadata !DIExpression()), !dbg !542
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !547
  %6 = load i32, i32* %5, align 4, !tbaa !396, !dbg !547
  %7 = icmp ugt i32 %6, 0, !dbg !547
  store i1 %7, i1* %walking.addr, align 1, !dbg !546
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !549, metadata !DIExpression()), !dbg !546
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !552
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !399, !dbg !552
  %10 = load i1, i1* %walking.addr, align 1, !dbg !553
  br i1 %10, label %cond.true, label %cond.false, !dbg !553

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !554
  br label %cond.end, !dbg !553

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !555
  %13 = load i32, i32* %12, align 4, !tbaa !395, !dbg !555
  br label %cond.end, !dbg !553

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !553
  %15 = load i32, i32* %used.addr, align 4, !dbg !556
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !551
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !550
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !557, metadata !DIExpression()), !dbg !550
  %17 = load i1, i1* %walking.addr, align 1, !dbg !560
  %18 = xor i1 %17, true, !dbg !559
  br i1 %18, label %land.rhs, label %land.end, !dbg !559

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !561
  %20 = load i32, i32* %19, align 4, !tbaa !395, !dbg !561
  %21 = load i32, i32* %used.addr, align 4, !dbg !562
  %22 = icmp slt i32 %20, %21, !dbg !561
  br label %land.end, !dbg !559

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !559
  br i1 %23, label %if.then, label %if.end, !dbg !558

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !565
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !402, !dbg !565
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !566
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !408, !dbg !566
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !564
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !568
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !405, !dbg !568
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !569
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !408, !dbg !569
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !567
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !571
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !408, !dbg !571
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !570
  br label %if.end, !dbg !558

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !573
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !572
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !399, !dbg !572
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !576
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !576
  %38 = load i64, i64* %37, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !576
  %39 = trunc i64 %38 to i32, !dbg !576
  %40 = sub nsw i32 %39, 1, !dbg !575
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !574
  store i32 %40, i32* %41, align 4, !tbaa !394, !dbg !574
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !579
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !580
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !408, !dbg !580
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !578
  ret void, !dbg !540
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #3 !dbg !583 {
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
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !585, metadata !DIExpression()), !dbg !584
  call void @llvm.dbg.value(metadata i32 %mask, metadata !586, metadata !DIExpression()), !dbg !584
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !587, metadata !DIExpression()), !dbg !584
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !588, metadata !DIExpression()), !dbg !584
  call void @llvm.dbg.value(metadata i8* %key, metadata !589, metadata !DIExpression()), !dbg !584
  %0 = bitcast i8* %key to i64*, !dbg !591
  %1 = load i64, i64* %0, align 8, !dbg !591
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !591
  %3 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8, !dbg !591
  %4 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 1), align 8, !dbg !591
  %5 = xor i64 %3, 8317987319222330741, !dbg !591
  store i64 %5, i64* %hash.v0, align 8, !dbg !591
  %6 = xor i64 %4, 7237128888997146477, !dbg !591
  store i64 %6, i64* %hash.v1, align 8, !dbg !591
  %7 = xor i64 %3, 7816392313619706465, !dbg !591
  store i64 %7, i64* %hash.v2, align 8, !dbg !591
  %8 = xor i64 %4, 8387220255154660723, !dbg !591
  store i64 %8, i64* %hash.v3, align 8, !dbg !591
  %9 = and i64 %1, -8, !dbg !591
  store i64 0, i64* %hash.i, align 8, !dbg !591
  br label %hash.test, !dbg !591

hash.test:
  %10 = load i64, i64* %hash.i, align 8, !dbg !591
  %11 = icmp ult i64 %10, %9, !dbg !591
  br i1 %11, label %hash.word, label %hash.tail, !dbg !591

hash.word:
  %12 = getelementptr inbounds i8, i8* %2, i64 %10, !dbg !591
  %13 = bitcast i8* %12 to i64*, !dbg !591
  %14 = load i64, i64* %13, align 1, !dbg !591
  %15 = load i64, i64* %hash.v3, align 8, !dbg !591
  %16 = xor i64 %15, %14, !dbg !591
  store i64 %16, i64* %hash.v3, align 8, !dbg !591
  %17 = load i64, i64* %hash.v0, align 8, !dbg !591
  %18 = load i64, i64* %hash.v1, align 8, !dbg !591
  %19 = load i64, i64* %hash.v2, align 8, !dbg !591
  %20 = load i64, i64* %hash.v3, align 8, !dbg !591
  %21 = add i64 %17, %18, !dbg !591
  %22 = shl i64 %18, 13, !dbg !591
  %23 = lshr i64 %18, 51, !dbg !591
  %24 = or i64 %22, %23, !dbg !591
  %25 = xor i64 %24, %21, !dbg !591
  %26 = shl i64 %21, 32, !dbg !591
  %27 = lshr i64 %21, 32, !dbg !591
  %28 = or i64 %26, %27, !dbg !591
  %29 = add i64 %19, %20, !dbg !591
  %30 = shl i64 %20, 16, !dbg !591
  %31 = lshr i64 %20, 48, !dbg !591
  %32 = or i64 %30, %31, !dbg !591
  %33 = xor i64 %32, %29, !dbg !591
  %34 = add i64 %28, %33, !dbg !591
  %35 = shl i64 %33, 21, !dbg !591
  %36 = lshr i64 %33, 43, !dbg !591
  %37 = or i64 %35, %36, !dbg !591
  %38 = xor i64 %37, %34, !dbg !591
  %39 = add i64 %29, %25, !dbg !591
  %40 = shl i64 %25, 17, !dbg !591
  %41 = lshr i64 %25, 47, !dbg !591
  %42 = or i64 %40, %41, !dbg !591
  %43 = xor i64 %42, %39, !dbg !591
  %44 = shl i64 %39, 32, !dbg !591
  %45 = lshr i64 %39, 32, !dbg !591
  %46 = or i64 %44, %45, !dbg !591
  store i64 %34, i64* %hash.v0, align 8, !dbg !591
  store i64 %43, i64* %hash.v1, align 8, !dbg !591
  store i64 %46, i64* %hash.v2, align 8, !dbg !591
  store i64 %38, i64* %hash.v3, align 8, !dbg !591
  %47 = xor i64 %34, %14, !dbg !591
  store i64 %47, i64* %hash.v0, align 8, !dbg !591
  %48 = add i64 %10, 8, !dbg !591
  store i64 %48, i64* %hash.i, align 8, !dbg !591
  br label %hash.test, !dbg !591

hash.tail:
  %49 = shl i64 %1, 56, !dbg !591
  store i64 %49, i64* %hash.b, align 8, !dbg !591
  br label %hash.more, !dbg !591

hash.more:
  %50 = load i64, i64* %hash.i, align 8, !dbg !591
  %51 = icmp ult i64 %50, %1, !dbg !591
  br i1 %51, label %hash.byte, label %hash.done, !dbg !591

hash.byte:
  %52 = getelementptr inbounds i8, i8* %2, i64 %50, !dbg !591
  %53 = load i8, i8* %52, !dbg !591
  %54 = zext i8 %53 to i64, !dbg !591
  %55 = sub i64 %50, %9, !dbg !591
  %56 = shl i64 %55, 3, !dbg !591
  %57 = load i64, i64* %hash.b, align 8, !dbg !591
  %58 = shl i64 %54, %56, !dbg !591
  %59 = or i64 %57, %58, !dbg !591
  store i64 %59, i64* %hash.b, align 8, !dbg !591
  %60 = add i64 %50, 1, !dbg !591
  store i64 %60, i64* %hash.i, align 8, !dbg !591
  br label %hash.more, !dbg !591

hash.done:
  %61 = load i64, i64* %hash.b, align 8, !dbg !591
  %62 = load i64, i64* %hash.v3, align 8, !dbg !591
  %63 = xor i64 %62, %61, !dbg !591
  store i64 %63, i64* %hash.v3, align 8, !dbg !591
  %64 = load i64, i64* %hash.v0, align 8, !dbg !591
  %65 = load i64, i64* %hash.v1, align 8, !dbg !591
  %66 = load i64, i64* %hash.v2, align 8, !dbg !591
  %67 = load i64, i64* %hash.v3, align 8, !dbg !591
  %68 = add i64 %64, %65, !dbg !591
  %69 = shl i64 %65, 13, !dbg !591
  %70 = lshr i64 %65, 51, !dbg !591
  %71 = or i64 %69, %70, !dbg !591
  %72 = xor i64 %71, %68, !dbg !591
  %73 = shl i64 %68, 32, !dbg !591
  %74 = lshr i64 %68, 32, !dbg !591
  %75 = or i64 %73, %74, !dbg !591
  %76 = add i64 %66, %67, !dbg !591
  %77 = shl i64 %67, 16, !dbg !591
  %78 = lshr i64 %67, 48, !dbg !591
  %79 = or i64 %77, %78, !dbg !591
  %80 = xor i64 %79, %76, !dbg !591
  %81 = add i64 %75, %80, !dbg !591
  %82 = shl i64 %80, 21, !dbg !591
  %83 = lshr i64 %80, 43, !dbg !591
  %84 = or i64 %82, %83, !dbg !591
  %85 = xor i64 %84, %81, !dbg !591
  %86 = add i64 %76, %72, !dbg !591
  %87 = shl i64 %72, 17, !dbg !591
  %88 = lshr i64 %72, 47, !dbg !591
  %89 = or i64 %87, %88, !dbg !591
  %90 = xor i64 %89, %86, !dbg !591
  %91 = shl i64 %86, 32, !dbg !591
  %92 = lshr i64 %86, 32, !dbg !591
  %93 = or i64 %91, %92, !dbg !591
  store i64 %81, i64* %hash.v0, align 8, !dbg !591
  store i64 %90, i64* %hash.v1, align 8, !dbg !591
  store i64 %93, i64* %hash.v2, align 8, !dbg !591
  store i64 %85, i64* %hash.v3, align 8, !dbg !591
  %94 = xor i64 %81, %61, !dbg !591
  store i64 %94, i64* %hash.v0, align 8, !dbg !591
  %95 = load i64, i64* %hash.v2, align 8, !dbg !591
  %96 = xor i64 %95, 255, !dbg !591
  store i64 %96, i64* %hash.v2, align 8, !dbg !591
  %97 = load i64, i64* %hash.v0, align 8, !dbg !591
  %98 = load i64, i64* %hash.v1, align 8, !dbg !591
  %99 = load i64, i64* %hash.v2, align 8, !dbg !591
  %100 = load i64, i64* %hash.v3, align 8, !dbg !591
  %101 = add i64 %97, %98, !dbg !591
  %102 = shl i64 %98, 13, !dbg !591
  %103 = lshr i64 %98, 51, !dbg !591
  %104 = or i64 %102, %103, !dbg !591
  %105 = xor i64 %104, %101, !dbg !591
  %106 = shl i64 %101, 32, !dbg !591
  %107 = lshr i64 %101, 32, !dbg !591
  %108 = or i64 %106, %107, !dbg !591
  %109 = add i64 %99, %100, !dbg !591
  %110 = shl i64 %100, 16, !dbg !591
  %111 = lshr i64 %100, 48, !dbg !591
  %112 = or i64 %110, %111, !dbg !591
  %113 = xor i64 %112, %109, !dbg !591
  %114 = add i64 %108, %113, !dbg !591
  %115 = shl i64 %113, 21, !dbg !591
  %116 = lshr i64 %113, 43, !dbg !591
  %117 = or i64 %115, %116, !dbg !591
  %118 = xor i64 %117, %114, !dbg !591
  %119 = add i64 %109, %105, !dbg !591
  %120 = shl i64 %105, 17, !dbg !591
  %121 = lshr i64 %105, 47, !dbg !591
  %122 = or i64 %120, %121, !dbg !591
  %123 = xor i64 %122, %119, !dbg !591
  %124 = shl i64 %119, 32, !dbg !591
  %125 = lshr i64 %119, 32, !dbg !591
  %126 = or i64 %124, %125, !dbg !591
  %127 = add i64 %114, %123, !dbg !591
  %128 = shl i64 %123, 13, !dbg !591
  %129 = lshr i64 %123, 51, !dbg !591
  %130 = or i64 %128, %129, !dbg !591
  %131 = xor i64 %130, %127, !dbg !591
  %132 = shl i64 %127, 32, !dbg !591
  %133 = lshr i64 %127, 32, !dbg !591
  %134 = or i64 %132, %133, !dbg !591
  %135 = add i64 %126, %118, !dbg !591
  %136 = shl i64 %118, 16, !dbg !591
  %137 = lshr i64 %118, 48, !dbg !591
  %138 = or i64 %136, %137, !dbg !591
  %139 = xor i64 %138, %135, !dbg !591
  %140 = add i64 %134, %139, !dbg !591
  %141 = shl i64 %139, 21, !dbg !591
  %142 = lshr i64 %139, 43, !dbg !591
  %143 = or i64 %141, %142, !dbg !591
  %144 = xor i64 %143, %140, !dbg !591
  %145 = add i64 %135, %131, !dbg !591
  %146 = shl i64 %131, 17, !dbg !591
  %147 = lshr i64 %131, 47, !dbg !591
  %148 = or i64 %146, %147, !dbg !591
  %149 = xor i64 %148, %145, !dbg !591
  %150 = shl i64 %145, 32, !dbg !591
  %151 = lshr i64 %145, 32, !dbg !591
  %152 = or i64 %150, %151, !dbg !591
  %153 = add i64 %140, %149, !dbg !591
  %154 = shl i64 %149, 13, !dbg !591
  %155 = lshr i64 %149, 51, !dbg !591
  %156 = or i64 %154, %155, !dbg !591
  %157 = xor i64 %156, %153, !dbg !591
  %158 = shl i64 %153, 32, !dbg !591
  %159 = lshr i64 %153, 32, !dbg !591
  %160 = or i64 %158, %159, !dbg !591
  %161 = add i64 %152, %144, !dbg !591
  %162 = shl i64 %144, 16, !dbg !591
  %163 = lshr i64 %144, 48, !dbg !591
  %164 = or i64 %162, %163, !dbg !591
  %165 = xor i64 %164, %161, !dbg !591
  %166 = add i64 %160, %165, !dbg !591
  %167 = shl i64 %165, 21, !dbg !591
  %168 = lshr i64 %165, 43, !dbg !591
  %169 = or i64 %167, %168, !dbg !591
  %170 = xor i64 %169, %166, !dbg !591
  %171 = add i64 %161, %157, !dbg !591
  %172 = shl i64 %157, 17, !dbg !591
  %173 = lshr i64 %157, 47, !dbg !591
  %174 = or i64 %172, %173, !dbg !591
  %175 = xor i64 %174, %171, !dbg !591
  %176 = shl i64 %171, 32, !dbg !591
  %177 = lshr i64 %171, 32, !dbg !591
  %178 = or i64 %176, %177, !dbg !591
  store i64 %166, i64* %hash.v0, align 8, !dbg !591
  store i64 %175, i64* %hash.v1, align 8, !dbg !591
  store i64 %178, i64* %hash.v2, align 8, !dbg !591
  store i64 %170, i64* %hash.v3, align 8, !dbg !591
  %179 = xor i64 %166, %175, !dbg !591
  %180 = xor i64 %178, %170, !dbg !591
  %181 = xor i64 %179, %180, !dbg !591
  %182 = trunc i64 %181 to i32, !dbg !591
  %183 = lshr i64 %181, 32, !dbg !591
  %184 = trunc i64 %183 to i32, !dbg !591
  %185 = xor i32 %182, %184, !dbg !591
  %186 = icmp eq i32 %185, 0, !dbg !591
  %187 = select i1 %186, i32 1, i32 %185, !dbg !591
  store i32 %187, i32* %h.addr, align 4, !dbg !590
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !593, metadata !DIExpression()), !dbg !590
  store i32 %mask, i32* %low.addr, align 4, !dbg !594
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !597, metadata !DIExpression()), !dbg !594
  %188 = load i32, i32* %h.addr, align 4, !dbg !599
  %189 = load i32, i32* %low.addr, align 4, !dbg !601
  %190 = xor i32 %189, -1, !dbg !600
  %191 = and i32 %188, %190, !dbg !599
  store i32 %191, i32* %fingerprint.addr, align 4, !dbg !598
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !602, metadata !DIExpression()), !dbg !598
  %192 = load i32, i32* %h.addr, align 4, !dbg !606
  %193 = call i32 @nish.homeBucket(i32 %192, i32 %mask), !dbg !605
  store i32 %193, i32* %bucket.addr, align 4, !dbg !603
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !608, metadata !DIExpression()), !dbg !603
  %194 = load i32, i32* %bucket.addr, align 4, !dbg !611
  store i32 %194, i32* %b.addr, align 4, !dbg !609
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !612, metadata !DIExpression()), !dbg !609
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !613
  %196 = load i64, i64* %195, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !613
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !613
  %198 = load i8*, i8** %197, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !613
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !613
  %200 = load i64, i64* %199, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !613
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !613
  %202 = load i8*, i8** %201, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !613
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !613
  %204 = load i64, i64* %203, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !613
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !613
  %206 = load i8*, i8** %205, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !613
  br label %while.cond, !dbg !613

while.cond:
  %207 = load i32, i32* %b.addr, align 4, !dbg !617
  %208 = icmp sge i32 %207, 0, !dbg !617
  br i1 %208, label %land.rhs, label %land.end, !dbg !617

land.rhs:
  %209 = load i32, i32* %b.addr, align 4, !dbg !619
  %210 = trunc i64 %196 to i32, !dbg !614
  %211 = icmp slt i32 %209, %210, !dbg !619
  br label %land.end, !dbg !617

land.end:
  %212 = phi i1 [ false, %while.cond ], [ %211, %land.rhs ], !dbg !617
  br i1 %212, label %while.body, label %while.end, !dbg !613

while.body:
  %213 = load i32, i32* %b.addr, align 4, !dbg !624
  %214 = sext i32 %213 to i64, !dbg !623
  %215 = bitcast i8* %198 to i32*, !dbg !623
  %216 = getelementptr inbounds i32, i32* %215, i64 %214, !dbg !623
  %217 = load i32, i32* %216, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !623
  store i32 %217, i32* %word.addr, align 4, !dbg !622
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !625, metadata !DIExpression()), !dbg !622
  %218 = load i32, i32* %word.addr, align 4, !dbg !627
  %219 = icmp eq i32 %218, 0, !dbg !627
  br i1 %219, label %if.then, label %if.end, !dbg !626

if.then:
  %220 = load i32, i32* %b.addr, align 4, !dbg !632
  %221 = load i32, i32* %h.addr, align 4, !dbg !633
  %222 = tail call i64 @nish.absentAt(i32 %220, i32 %221), !dbg !631
  ret i64 %222, !dbg !630

if.end:
  %223 = load i32, i32* %word.addr, align 4, !dbg !636
  %224 = load i32, i32* %low.addr, align 4, !dbg !638
  %225 = xor i32 %224, -1, !dbg !637
  %226 = and i32 %223, %225, !dbg !636
  %227 = load i32, i32* %fingerprint.addr, align 4, !dbg !639
  %228 = icmp eq i32 %226, %227, !dbg !635
  br i1 %228, label %if.then.1, label %if.end.1, !dbg !634

if.then.1:
  %229 = load i32, i32* %word.addr, align 4, !dbg !644
  %230 = load i32, i32* %low.addr, align 4, !dbg !645
  %231 = and i32 %229, %230, !dbg !644
  %232 = sub i32 %231, 1, !dbg !643
  store i32 %232, i32* %at.addr, align 4, !dbg !641
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !647, metadata !DIExpression()), !dbg !641
  %233 = load i32, i32* %at.addr, align 4, !dbg !649
  %234 = icmp sge i32 %233, 0, !dbg !649
  br i1 %234, label %land.rhs.4, label %land.end.4, !dbg !649

land.rhs.4:
  %235 = load i32, i32* %at.addr, align 4, !dbg !651
  %236 = trunc i64 %200 to i32, !dbg !615
  %237 = icmp slt i32 %235, %236, !dbg !651
  br label %land.end.4, !dbg !649

land.end.4:
  %238 = phi i1 [ false, %if.then.1 ], [ %237, %land.rhs.4 ], !dbg !649
  br i1 %238, label %land.rhs.3, label %land.end.3, !dbg !649

land.rhs.3:
  %239 = load i32, i32* %at.addr, align 4, !dbg !654
  %240 = sext i32 %239 to i64, !dbg !653
  %241 = bitcast i8* %202 to i32*, !dbg !653
  %242 = getelementptr inbounds i32, i32* %241, i64 %240, !dbg !653
  %243 = load i32, i32* %242, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !653
  %244 = load i32, i32* %h.addr, align 4, !dbg !655
  %245 = icmp eq i32 %243, %244, !dbg !653
  br label %land.end.3, !dbg !649

land.end.3:
  %246 = phi i1 [ false, %land.end.4 ], [ %245, %land.rhs.3 ], !dbg !649
  br i1 %246, label %land.rhs.2, label %land.end.2, !dbg !649

land.rhs.2:
  %247 = load i32, i32* %at.addr, align 4, !dbg !656
  %248 = trunc i64 %204 to i32, !dbg !616
  %249 = icmp slt i32 %247, %248, !dbg !656
  br label %land.end.2, !dbg !649

land.end.2:
  %250 = phi i1 [ false, %land.end.3 ], [ %249, %land.rhs.2 ], !dbg !649
  br i1 %250, label %land.rhs.1, label %land.end.1, !dbg !649

land.rhs.1:
  %251 = load i32, i32* %at.addr, align 4, !dbg !660
  %252 = sext i32 %251 to i64, !dbg !659
  %253 = bitcast i8* %206 to i8**, !dbg !659
  %254 = getelementptr inbounds i8*, i8** %253, i64 %252, !dbg !659
  %255 = load i8*, i8** %254, align 8, !alias.scope !151, !noalias !150, !tbaa !499, !dbg !659
  %256 = call zeroext i1 @nish_str_eq(i8* %255, i8* %key), !dbg !658
  br label %land.end.1, !dbg !649

land.end.1:
  %257 = phi i1 [ false, %land.end.2 ], [ %256, %land.rhs.1 ], !dbg !649
  br i1 %257, label %if.then.2, label %if.end.2, !dbg !648

if.then.2:
  %258 = load i32, i32* %b.addr, align 4, !dbg !665
  %259 = load i32, i32* %at.addr, align 4, !dbg !666
  %260 = tail call i64 @nish.foundAt(i32 %258, i32 %259), !dbg !664
  ret i64 %260, !dbg !663

if.end.2:
  br label %if.end.1, !dbg !634

if.end.1:
  %261 = load i32, i32* %bucket.addr, align 4, !dbg !669
  %262 = add i32 %261, 1, !dbg !669
  %263 = load i32, i32* %low.addr, align 4, !dbg !671
  %264 = and i32 %262, %263, !dbg !668
  store i32 %264, i32* %bucket.addr, align 4, !dbg !667
  %265 = load i32, i32* %bucket.addr, align 4, !dbg !674
  store i32 %265, i32* %b.addr, align 4, !dbg !672
  br label %while.cond, !dbg !613

while.end:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !678
  %267 = load i64, i64* %266, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !678
  %268 = trunc i64 %267 to i32, !dbg !678
  %269 = load i32, i32* %h.addr, align 4, !dbg !679
  %270 = tail call i64 @nish.absentAt(i32 %268, i32 %269), !dbg !676
  ret i64 %270, !dbg !675
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !682 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !684, metadata !DIExpression()), !dbg !683
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !685, metadata !DIExpression()), !dbg !683
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !688
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !688
  %2 = trunc i64 %1 to i32, !dbg !688
  store i32 %2, i32* %used.addr, align 4, !dbg !686
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !689, metadata !DIExpression()), !dbg !686
  store i32 0, i32* %to.addr, align 4, !dbg !690
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !692, metadata !DIExpression()), !dbg !690
  store i32 0, i32* %from.addr, align 4, !dbg !693
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !695, metadata !DIExpression()), !dbg !693
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !693
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !693
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !693
  %6 = load i8*, i8** %5, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !693
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !693
  %8 = load i64, i64* %7, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !693
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !693
  %10 = load i8*, i8** %9, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !693
  br label %for.cond, !dbg !693

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !698
  %12 = load i32, i32* %used.addr, align 4, !dbg !699
  %13 = icmp slt i32 %11, %12, !dbg !698
  br i1 %13, label %land.rhs, label %land.end, !dbg !698

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !700
  %15 = trunc i64 %4 to i32, !dbg !696
  %16 = icmp slt i32 %14, %15, !dbg !700
  br label %land.end, !dbg !698

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !698
  br i1 %17, label %for.body, label %for.end, !dbg !693

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !705
  %19 = sext i32 %18 to i64, !dbg !704
  %20 = bitcast i8* %6 to i32*, !dbg !704
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !704
  %22 = load i32, i32* %21, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !704
  %23 = icmp ne i32 %22, 0, !dbg !704
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !704

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !707
  %25 = icmp sge i32 %24, 0, !dbg !707
  br label %land.end.3, !dbg !704

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !704
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !704

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !709
  %28 = load i32, i32* %used.addr, align 4, !dbg !710
  %29 = icmp slt i32 %27, %28, !dbg !709
  br label %land.end.2, !dbg !704

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !704
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !704

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !711
  %32 = trunc i64 %8 to i32, !dbg !697
  %33 = icmp slt i32 %31, %32, !dbg !711
  br label %land.end.1, !dbg !704

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !704
  br i1 %34, label %if.then, label %if.end, !dbg !703

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !715
  %36 = sext i32 %35 to i64, !dbg !714
  %37 = load i32, i32* %from.addr, align 4, !dbg !717
  %38 = sext i32 %37 to i64, !dbg !716
  %39 = bitcast i8* %10 to i8**, !dbg !716
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !716
  %41 = load i8*, i8** %40, align 8, !alias.scope !151, !noalias !150, !tbaa !499, !dbg !716
  %42 = bitcast i8* %10 to i8**, !dbg !714
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !714
  store i8* %41, i8** %43, align 8, !alias.scope !151, !noalias !150, !tbaa !499, !dbg !714
  %44 = load i32, i32* %to.addr, align 4, !dbg !718
  %45 = add nsw i32 %44, 1, !dbg !718
  store i32 %45, i32* %to.addr, align 4, !dbg !718
  br label %if.end, !dbg !703

if.end:
  br label %for.inc, !dbg !693

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !719
  %47 = add nsw i32 %46, 1, !dbg !719
  store i32 %47, i32* %from.addr, align 4, !dbg !719
  br label %for.cond, !dbg !693

for.end:
  br label %while.cond, !dbg !720

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !722
  %49 = load i64, i64* %48, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !722
  %50 = trunc i64 %49 to i32, !dbg !722
  %51 = load i32, i32* %to.addr, align 4, !dbg !723
  %52 = icmp sgt i32 %50, %51, !dbg !721
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !721

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !724
  %54 = load i64, i64* %53, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !724
  %55 = trunc i64 %54 to i32, !dbg !724
  %56 = icmp sgt i32 %55, 0, !dbg !724
  br label %land.end.4, !dbg !721

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !721
  br i1 %57, label %while.body, label %while.end, !dbg !720

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !727
  %59 = load i64, i64* %58, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !727
  %60 = sub i64 %59, 1, !dbg !727
  store i64 %60, i64* %58, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !727
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !727
  %62 = load i8*, i8** %61, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !727
  %63 = bitcast i8* %62 to i8**, !dbg !727
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60, !dbg !727
  %65 = load i8*, i8** %64, align 8, !alias.scope !151, !noalias !150, !tbaa !499, !dbg !727
  br label %while.cond, !dbg !720

while.end:
  ret void, !dbg !683
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !730 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !732, metadata !DIExpression()), !dbg !731
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !733, metadata !DIExpression()), !dbg !731
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !736
  %1 = load i64, i64* %0, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !736
  %2 = trunc i64 %1 to i32, !dbg !736
  store i32 %2, i32* %used.addr, align 4, !dbg !734
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !737, metadata !DIExpression()), !dbg !734
  store i32 0, i32* %to.addr, align 4, !dbg !738
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !740, metadata !DIExpression()), !dbg !738
  store i32 0, i32* %from.addr, align 4, !dbg !741
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !743, metadata !DIExpression()), !dbg !741
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !741
  %4 = load i64, i64* %3, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !741
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !741
  %6 = load i8*, i8** %5, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !741
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !741
  %8 = load i64, i64* %7, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !741
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !741
  %10 = load i8*, i8** %9, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !741
  br label %for.cond, !dbg !741

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !746
  %12 = load i32, i32* %used.addr, align 4, !dbg !747
  %13 = icmp slt i32 %11, %12, !dbg !746
  br i1 %13, label %land.rhs, label %land.end, !dbg !746

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !748
  %15 = trunc i64 %4 to i32, !dbg !744
  %16 = icmp slt i32 %14, %15, !dbg !748
  br label %land.end, !dbg !746

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !746
  br i1 %17, label %for.body, label %for.end, !dbg !741

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !753
  %19 = sext i32 %18 to i64, !dbg !752
  %20 = bitcast i8* %6 to i32*, !dbg !752
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !752
  %22 = load i32, i32* %21, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !752
  %23 = icmp ne i32 %22, 0, !dbg !752
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !752

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !755
  %25 = icmp sge i32 %24, 0, !dbg !755
  br label %land.end.3, !dbg !752

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !752
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !752

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !757
  %28 = load i32, i32* %used.addr, align 4, !dbg !758
  %29 = icmp slt i32 %27, %28, !dbg !757
  br label %land.end.2, !dbg !752

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !752
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !752

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !759
  %32 = trunc i64 %8 to i32, !dbg !745
  %33 = icmp slt i32 %31, %32, !dbg !759
  br label %land.end.1, !dbg !752

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !752
  br i1 %34, label %if.then, label %if.end, !dbg !751

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !763
  %36 = sext i32 %35 to i64, !dbg !762
  %37 = load i32, i32* %from.addr, align 4, !dbg !765
  %38 = sext i32 %37 to i64, !dbg !764
  %39 = bitcast i8* %10 to i32*, !dbg !764
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !764
  %41 = load i32, i32* %40, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !764
  %42 = bitcast i8* %10 to i32*, !dbg !762
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !762
  store i32 %41, i32* %43, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !762
  %44 = load i32, i32* %to.addr, align 4, !dbg !766
  %45 = add nsw i32 %44, 1, !dbg !766
  store i32 %45, i32* %to.addr, align 4, !dbg !766
  br label %if.end, !dbg !751

if.end:
  br label %for.inc, !dbg !741

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !767
  %47 = add nsw i32 %46, 1, !dbg !767
  store i32 %47, i32* %from.addr, align 4, !dbg !767
  br label %for.cond, !dbg !741

for.end:
  br label %while.cond, !dbg !768

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !770
  %49 = load i64, i64* %48, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !770
  %50 = trunc i64 %49 to i32, !dbg !770
  %51 = load i32, i32* %to.addr, align 4, !dbg !771
  %52 = icmp sgt i32 %50, %51, !dbg !769
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !769

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !772
  %54 = load i64, i64* %53, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !772
  %55 = trunc i64 %54 to i32, !dbg !772
  %56 = icmp sgt i32 %55, 0, !dbg !772
  br label %land.end.4, !dbg !769

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !769
  br i1 %57, label %while.body, label %while.end, !dbg !768

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !775
  %59 = load i64, i64* %58, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !775
  %60 = sub i64 %59, 1, !dbg !775
  store i64 %60, i64* %58, align 8, !alias.scope !150, !noalias !151, !tbaa !157, !dbg !775
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !775
  %62 = load i8*, i8** %61, align 8, !alias.scope !150, !noalias !151, !tbaa !158, !dbg !775
  %63 = bitcast i8* %62 to i32*, !dbg !775
  %64 = getelementptr inbounds i32, i32* %63, i64 %60, !dbg !775
  %65 = load i32, i32* %64, align 4, !alias.scope !151, !noalias !150, !tbaa !168, !dbg !775
  br label %while.cond, !dbg !768

while.end:
  ret void, !dbg !731
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
!llvm.module.flags = !{!2, !3, !776, !777, !778, !779, !780}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_map_get.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 4, type: !6, scopeLine: 4, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 4, column: 1, scope: !7)
!9 = !DILocation(line: 5, column: 3, scope: !7)
!10 = !DILocation(line: 5, column: 13, scope: !7)
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
!48 = !DILocalVariable(name: "m", scope: !7, file: !1, line: 5, type: !12)
!49 = !DILocation(line: 6, column: 3, scope: !7)
!50 = !DILocation(line: 6, column: 9, scope: !7)
!51 = !DILocation(line: 6, column: 14, scope: !7)
!52 = !DILocation(line: 7, column: 3, scope: !7)
!53 = !DILocation(line: 7, column: 13, scope: !7)
!54 = !DILocation(line: 7, column: 19, scope: !7)
!55 = !DILocalVariable(name: "n", scope: !7, file: !1, line: 7, type: !4)
!56 = !DILocation(line: 8, column: 3, scope: !7)
!57 = !DILocation(line: 8, column: 7, scope: !7)
!58 = !DILocation(line: 8, column: 24, scope: !7)
!59 = !DILocation(line: 9, column: 5, scope: !7)
!60 = !DILocation(line: 9, column: 17, scope: !7)
!61 = !DILocation(line: 9, column: 20, scope: !7)
!62 = !DILocation(line: 11, column: 3, scope: !7)
!63 = !DILocation(line: 11, column: 10, scope: !7)
!64 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 4, type: !6, scopeLine: 4, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!65 = !DILocation(line: 4, column: 1, scope: !64)
!66 = !{!4, !19, !4}
!67 = !DISubroutineType(types: !66)
!68 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 82, type: !67, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!69 = !DILocation(line: 82, column: 1, scope: !68)
!70 = !DILocalVariable(name: "h", arg: 1, scope: !68, file: !13, line: 82, type: !19)
!71 = !DILocalVariable(name: "mask", arg: 2, scope: !68, file: !13, line: 82, type: !4)
!72 = !DILocation(line: 82, column: 48, scope: !68)
!73 = !DILocation(line: 82, column: 54, scope: !68)
!74 = !DILocation(line: 82, column: 58, scope: !68)
!75 = !DILocation(line: 82, column: 59, scope: !68)
!76 = !DILocation(line: 82, column: 72, scope: !68)
!77 = !{!19, !19, !4, !4}
!78 = !DISubroutineType(types: !77)
!79 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 90, type: !78, scopeLine: 90, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!80 = !DILocation(line: 90, column: 1, scope: !79)
!81 = !DILocalVariable(name: "h", arg: 1, scope: !79, file: !13, line: 90, type: !19)
!82 = !DILocalVariable(name: "mask", arg: 2, scope: !79, file: !13, line: 90, type: !4)
!83 = !DILocalVariable(name: "index", arg: 3, scope: !79, file: !13, line: 90, type: !4)
!84 = !DILocation(line: 90, column: 58, scope: !79)
!85 = !DILocation(line: 90, column: 59, scope: !79)
!86 = !DILocation(line: 90, column: 63, scope: !79)
!87 = !DILocation(line: 90, column: 64, scope: !79)
!88 = !DILocation(line: 90, column: 70, scope: !79)
!89 = !DILocation(line: 90, column: 79, scope: !79)
!90 = !DILocation(line: 90, column: 80, scope: !79)
!91 = !DILocation(line: 90, column: 86, scope: !79)
!92 = !DILocation(line: 90, column: 95, scope: !79)
!93 = !{!16, !4, !4}
!94 = !DISubroutineType(types: !93)
!95 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 99, type: !94, scopeLine: 99, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!96 = !DILocation(line: 99, column: 1, scope: !95)
!97 = !DILocalVariable(name: "bucket", arg: 1, scope: !95, file: !13, line: 99, type: !4)
!98 = !DILocalVariable(name: "index", arg: 2, scope: !95, file: !13, line: 99, type: !4)
!99 = !DILocation(line: 99, column: 51, scope: !95)
!100 = !DILocation(line: 99, column: 52, scope: !95)
!101 = !DILocation(line: 99, column: 58, scope: !95)
!102 = !DILocation(line: 99, column: 75, scope: !95)
!103 = !DILocation(line: 99, column: 81, scope: !95)
!104 = !{!16, !4, !19}
!105 = !DISubroutineType(types: !104)
!106 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 102, type: !105, scopeLine: 102, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!107 = !DILocation(line: 102, column: 1, scope: !106)
!108 = !DILocalVariable(name: "bucket", arg: 1, scope: !106, file: !13, line: 102, type: !4)
!109 = !DILocalVariable(name: "h", arg: 2, scope: !106, file: !13, line: 102, type: !19)
!110 = !DILocation(line: 102, column: 48, scope: !106)
!111 = !DILocation(line: 102, column: 49, scope: !106)
!112 = !DILocation(line: 102, column: 50, scope: !106)
!113 = !DILocation(line: 102, column: 51, scope: !106)
!114 = !DILocation(line: 102, column: 57, scope: !106)
!115 = !DILocation(line: 102, column: 74, scope: !106)
!116 = !DILocation(line: 102, column: 80, scope: !106)
!117 = !{null, !23, !4, !19, !4}
!118 = !DISubroutineType(types: !117)
!119 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 154, type: !118, scopeLine: 154, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!120 = !DILocation(line: 154, column: 1, scope: !119)
!121 = !DILocalVariable(name: "slots", arg: 1, scope: !119, file: !13, line: 154, type: !23)
!122 = !DILocalVariable(name: "mask", arg: 2, scope: !119, file: !13, line: 154, type: !4)
!123 = !DILocalVariable(name: "h", arg: 3, scope: !119, file: !13, line: 154, type: !19)
!124 = !DILocalVariable(name: "index", arg: 4, scope: !119, file: !13, line: 154, type: !4)
!125 = !DILocation(line: 155, column: 3, scope: !119)
!126 = !DILocation(line: 155, column: 16, scope: !119)
!127 = !DILocation(line: 155, column: 25, scope: !119)
!128 = !DILocation(line: 155, column: 28, scope: !119)
!129 = !DILocation(line: 155, column: 34, scope: !119)
!130 = !DILocalVariable(name: "word", scope: !119, file: !13, line: 155, type: !19)
!131 = !DILocation(line: 156, column: 3, scope: !119)
!132 = !DILocation(line: 156, column: 15, scope: !119)
!133 = !DILocation(line: 156, column: 21, scope: !119)
!134 = !DILocalVariable(name: "low", scope: !119, file: !13, line: 156, type: !19)
!135 = !DILocation(line: 157, column: 3, scope: !119)
!136 = !DILocation(line: 157, column: 16, scope: !119)
!137 = !DILocation(line: 157, column: 22, scope: !119)
!138 = !DILocation(line: 157, column: 33, scope: !119)
!139 = !DILocation(line: 157, column: 36, scope: !119)
!140 = !DILocalVariable(name: "bucket", scope: !119, file: !13, line: 157, type: !19)
!141 = !DILocation(line: 158, column: 3, scope: !119)
!142 = !DILocation(line: 158, column: 11, scope: !119)
!143 = !DILocation(line: 158, column: 17, scope: !119)
!144 = !DILocalVariable(name: "b", scope: !119, file: !13, line: 158, type: !4)
!145 = !DILocation(line: 159, column: 3, scope: !119)
!146 = !DILocation(line: 159, column: 30, scope: !119)
!147 = !{!"nish array"}
!148 = !{!"header", !147}
!149 = !{!"elements", !147}
!150 = !{!148}
!151 = !{!149}
!152 = !{!"nish TBAA"}
!153 = !{!"omnipotent char", !152, i64 0}
!154 = !{!"header i64", !153, i64 0}
!155 = !{!"header ptr", !153, i64 0}
!156 = !{!"array header", !154, i64 0, !154, i64 8, !155, i64 16}
!157 = !{!156, !154, i64 0}
!158 = !{!156, !155, i64 16}
!159 = !DILocation(line: 159, column: 10, scope: !119)
!160 = !DILocation(line: 159, column: 15, scope: !119)
!161 = !DILocation(line: 159, column: 20, scope: !119)
!162 = !DILocation(line: 159, column: 24, scope: !119)
!163 = !DILocation(line: 159, column: 45, scope: !119)
!164 = !DILocation(line: 160, column: 5, scope: !119)
!165 = !DILocation(line: 160, column: 9, scope: !119)
!166 = !DILocation(line: 160, column: 15, scope: !119)
!167 = !{!"element i32", !153, i64 0}
!168 = !{!167, !167, i64 0}
!169 = !DILocation(line: 160, column: 22, scope: !119)
!170 = !DILocation(line: 160, column: 25, scope: !119)
!171 = !DILocation(line: 161, column: 7, scope: !119)
!172 = !DILocation(line: 161, column: 13, scope: !119)
!173 = !DILocation(line: 161, column: 18, scope: !119)
!174 = !DILocation(line: 162, column: 7, scope: !119)
!175 = !DILocation(line: 164, column: 5, scope: !119)
!176 = !DILocation(line: 164, column: 14, scope: !119)
!177 = !DILocation(line: 164, column: 15, scope: !119)
!178 = !DILocation(line: 164, column: 24, scope: !119)
!179 = !DILocation(line: 164, column: 29, scope: !119)
!180 = !DILocation(line: 165, column: 5, scope: !119)
!181 = !DILocation(line: 165, column: 9, scope: !119)
!182 = !DILocation(line: 165, column: 15, scope: !119)
!183 = !{null, !23}
!184 = !DISubroutineType(types: !183)
!185 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 185, type: !184, scopeLine: 185, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!186 = !DILocation(line: 185, column: 1, scope: !185)
!187 = !DILocalVariable(name: "hashes", arg: 1, scope: !185, file: !13, line: 185, type: !23)
!188 = !DILocation(line: 186, column: 3, scope: !185)
!189 = !DILocation(line: 186, column: 16, scope: !185)
!190 = !DILocation(line: 186, column: 22, scope: !185)
!191 = !DILocalVariable(name: "used", scope: !185, file: !13, line: 186, type: !4)
!192 = !DILocation(line: 187, column: 3, scope: !185)
!193 = !DILocation(line: 187, column: 17, scope: !185)
!194 = !DILocalVariable(name: "to", scope: !185, file: !13, line: 187, type: !4)
!195 = !DILocation(line: 188, column: 3, scope: !185)
!196 = !DILocation(line: 188, column: 24, scope: !185)
!197 = !DILocalVariable(name: "from", scope: !185, file: !13, line: 188, type: !4)
!198 = !DILocation(line: 189, column: 15, scope: !185)
!199 = !DILocation(line: 188, column: 27, scope: !185)
!200 = !DILocation(line: 188, column: 34, scope: !185)
!201 = !DILocation(line: 188, column: 48, scope: !185)
!202 = !DILocation(line: 189, column: 5, scope: !185)
!203 = !DILocation(line: 189, column: 22, scope: !185)
!204 = !DILocalVariable(name: "h", scope: !185, file: !13, line: 189, type: !19)
!205 = !DILocation(line: 190, column: 5, scope: !185)
!206 = !DILocation(line: 190, column: 9, scope: !185)
!207 = !DILocation(line: 190, column: 15, scope: !185)
!208 = !DILocation(line: 190, column: 20, scope: !185)
!209 = !DILocation(line: 190, column: 26, scope: !185)
!210 = !DILocation(line: 190, column: 31, scope: !185)
!211 = !DILocation(line: 190, column: 36, scope: !185)
!212 = !DILocation(line: 190, column: 42, scope: !185)
!213 = !DILocation(line: 191, column: 7, scope: !185)
!214 = !DILocation(line: 191, column: 14, scope: !185)
!215 = !DILocation(line: 191, column: 20, scope: !185)
!216 = !DILocation(line: 192, column: 7, scope: !185)
!217 = !DILocation(line: 188, column: 40, scope: !185)
!218 = !DILocation(line: 195, column: 3, scope: !185)
!219 = !DILocation(line: 195, column: 10, scope: !185)
!220 = !DILocation(line: 195, column: 16, scope: !185)
!221 = !DILocation(line: 195, column: 33, scope: !185)
!222 = !DILocation(line: 195, column: 39, scope: !185)
!223 = !DILocation(line: 195, column: 55, scope: !185)
!224 = !DILocation(line: 195, column: 58, scope: !185)
!225 = !DILocation(line: 196, column: 5, scope: !185)
!226 = !{!23, !23, !4, !4}
!227 = !DISubroutineType(types: !226)
!228 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 207, type: !227, scopeLine: 207, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!229 = !DILocation(line: 207, column: 1, scope: !228)
!230 = !DILocalVariable(name: "slots", arg: 1, scope: !228, file: !13, line: 207, type: !23)
!231 = !DILocalVariable(name: "live", arg: 2, scope: !228, file: !13, line: 207, type: !4)
!232 = !DILocalVariable(name: "used", arg: 3, scope: !228, file: !13, line: 207, type: !4)
!233 = !DILocation(line: 208, column: 3, scope: !228)
!234 = !DILocation(line: 208, column: 7, scope: !228)
!235 = !DILocation(line: 208, column: 13, scope: !228)
!236 = !DILocation(line: 208, column: 21, scope: !228)
!237 = !DILocation(line: 208, column: 25, scope: !228)
!238 = !DILocation(line: 208, column: 31, scope: !228)
!239 = !DILocation(line: 208, column: 38, scope: !228)
!240 = !DILocation(line: 209, column: 5, scope: !228)
!241 = !DILocation(line: 209, column: 16, scope: !228)
!242 = !DILocation(line: 210, column: 5, scope: !228)
!243 = !DILocation(line: 210, column: 12, scope: !228)
!244 = !DILocation(line: 212, column: 3, scope: !228)
!245 = !DILocation(line: 212, column: 13, scope: !228)
!246 = !DILocation(line: 212, column: 19, scope: !228)
!247 = !DILocalVariable(name: "n", scope: !228, file: !13, line: 212, type: !4)
!248 = !DILocation(line: 213, column: 3, scope: !228)
!249 = !DILocation(line: 213, column: 7, scope: !228)
!250 = !DILocation(line: 213, column: 12, scope: !228)
!251 = !DILocation(line: 213, column: 17, scope: !228)
!252 = !DILocation(line: 213, column: 21, scope: !228)
!253 = !DILocation(line: 213, column: 28, scope: !228)
!254 = !DILocation(line: 215, column: 5, scope: !228)
!255 = !DILocation(line: 215, column: 12, scope: !228)
!256 = !DILocation(line: 215, column: 27, scope: !228)
!257 = !DILocation(line: 215, column: 33, scope: !228)
!258 = !DILocation(line: 215, column: 37, scope: !228)
!259 = !{!156, !154, i64 8}
!260 = !DILocation(line: 217, column: 3, scope: !228)
!261 = !DILocation(line: 217, column: 14, scope: !228)
!262 = !DILocation(line: 217, column: 21, scope: !228)
!263 = !DILocation(line: 218, column: 3, scope: !228)
!264 = !DILocation(line: 218, column: 14, scope: !228)
!265 = !DILocation(line: 219, column: 3, scope: !228)
!266 = !DILocation(line: 219, column: 10, scope: !228)
!267 = !{null, !23, !4}
!268 = !DISubroutineType(types: !267)
!269 = distinct !DISubprogram(name: "widenSlots", linkageName: "nish.widenSlots", scope: !13, file: !13, line: 231, type: !268, scopeLine: 231, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!270 = !DILocation(line: 231, column: 1, scope: !269)
!271 = !DILocalVariable(name: "slots", arg: 1, scope: !269, file: !13, line: 231, type: !23)
!272 = !DILocalVariable(name: "times", arg: 2, scope: !269, file: !13, line: 231, type: !4)
!273 = !DILocation(line: 232, column: 3, scope: !269)
!274 = !DILocation(line: 232, column: 13, scope: !269)
!275 = !DILocation(line: 232, column: 19, scope: !269)
!276 = !DILocalVariable(name: "n", scope: !269, file: !13, line: 232, type: !4)
!277 = !DILocation(line: 233, column: 3, scope: !269)
!278 = !DILocation(line: 233, column: 21, scope: !269)
!279 = !DILocalVariable(name: "k", scope: !269, file: !13, line: 233, type: !4)
!280 = !DILocation(line: 233, column: 24, scope: !269)
!281 = !DILocation(line: 233, column: 28, scope: !269)
!282 = !DILocation(line: 233, column: 40, scope: !269)
!283 = !DILocation(line: 234, column: 5, scope: !269)
!284 = !DILocation(line: 234, column: 23, scope: !269)
!285 = !DILocalVariable(name: "i", scope: !269, file: !13, line: 234, type: !4)
!286 = !DILocation(line: 234, column: 26, scope: !269)
!287 = !DILocation(line: 234, column: 30, scope: !269)
!288 = !DILocation(line: 234, column: 38, scope: !269)
!289 = !DILocation(line: 235, column: 7, scope: !269)
!290 = !DILocation(line: 235, column: 18, scope: !269)
!291 = !DILocation(line: 234, column: 33, scope: !269)
!292 = !DILocation(line: 233, column: 35, scope: !269)
!293 = !{null, !23, !23}
!294 = !DISubroutineType(types: !293)
!295 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 245, type: !294, scopeLine: 245, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!296 = !DILocation(line: 245, column: 1, scope: !295)
!297 = !DILocalVariable(name: "slots", arg: 1, scope: !295, file: !13, line: 245, type: !23)
!298 = !DILocalVariable(name: "hashes", arg: 2, scope: !295, file: !13, line: 245, type: !23)
!299 = !DILocation(line: 246, column: 3, scope: !295)
!300 = !DILocation(line: 246, column: 16, scope: !295)
!301 = !DILocation(line: 246, column: 22, scope: !295)
!302 = !DILocation(line: 246, column: 38, scope: !295)
!303 = !DILocalVariable(name: "mask", scope: !295, file: !13, line: 246, type: !4)
!304 = !DILocation(line: 247, column: 3, scope: !295)
!305 = !DILocation(line: 247, column: 21, scope: !295)
!306 = !DILocalVariable(name: "i", scope: !295, file: !13, line: 247, type: !4)
!307 = !DILocation(line: 247, column: 34, scope: !295)
!308 = !DILocation(line: 247, column: 24, scope: !295)
!309 = !DILocation(line: 247, column: 28, scope: !295)
!310 = !DILocation(line: 247, column: 55, scope: !295)
!311 = !DILocation(line: 248, column: 5, scope: !295)
!312 = !DILocation(line: 248, column: 15, scope: !295)
!313 = !DILocation(line: 248, column: 22, scope: !295)
!314 = !DILocalVariable(name: "h", scope: !295, file: !13, line: 248, type: !19)
!315 = !DILocation(line: 249, column: 5, scope: !295)
!316 = !DILocation(line: 249, column: 9, scope: !295)
!317 = !DILocation(line: 249, column: 15, scope: !295)
!318 = !DILocation(line: 249, column: 18, scope: !295)
!319 = !DILocation(line: 250, column: 7, scope: !295)
!320 = !DILocation(line: 250, column: 17, scope: !295)
!321 = !DILocation(line: 250, column: 24, scope: !295)
!322 = !DILocation(line: 250, column: 30, scope: !295)
!323 = !DILocation(line: 250, column: 33, scope: !295)
!324 = !DILocation(line: 247, column: 50, scope: !295)
!325 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 276, type: !184, scopeLine: 276, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!326 = !DILocation(line: 276, column: 1, scope: !325)
!327 = !DILocalVariable(name: "slots", arg: 1, scope: !325, file: !13, line: 276, type: !23)
!328 = !DILocation(line: 277, column: 3, scope: !325)
!329 = !DILocation(line: 277, column: 21, scope: !325)
!330 = !DILocalVariable(name: "i", scope: !325, file: !13, line: 277, type: !4)
!331 = !DILocation(line: 277, column: 34, scope: !325)
!332 = !DILocation(line: 277, column: 24, scope: !325)
!333 = !DILocation(line: 277, column: 28, scope: !325)
!334 = !DILocation(line: 277, column: 54, scope: !325)
!335 = !DILocation(line: 278, column: 5, scope: !325)
!336 = !DILocation(line: 278, column: 11, scope: !325)
!337 = !DILocation(line: 278, column: 16, scope: !325)
!338 = !DILocation(line: 277, column: 49, scope: !325)
!339 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!340 = !{!339, !23, !4, !4, !23}
!341 = !DISubroutineType(types: !340)
!342 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 312, type: !341, scopeLine: 312, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!343 = !DILocation(line: 312, column: 1, scope: !342)
!344 = !DILocalVariable(name: "slots", arg: 1, scope: !342, file: !13, line: 312, type: !23)
!345 = !DILocalVariable(name: "mask", arg: 2, scope: !342, file: !13, line: 312, type: !4)
!346 = !DILocalVariable(name: "bucket", arg: 3, scope: !342, file: !13, line: 312, type: !4)
!347 = !DILocalVariable(name: "hashes", arg: 4, scope: !342, file: !13, line: 312, type: !23)
!348 = !DILocation(line: 313, column: 3, scope: !342)
!349 = !DILocation(line: 313, column: 16, scope: !342)
!350 = !DILocation(line: 313, column: 22, scope: !342)
!351 = !DILocalVariable(name: "used", scope: !342, file: !13, line: 313, type: !4)
!352 = !DILocation(line: 314, column: 3, scope: !342)
!353 = !DILocation(line: 314, column: 16, scope: !342)
!354 = !DILocation(line: 314, column: 22, scope: !342)
!355 = !DILocalVariable(name: "size", scope: !342, file: !13, line: 314, type: !4)
!356 = !DILocation(line: 315, column: 3, scope: !342)
!357 = !DILocation(line: 315, column: 7, scope: !342)
!358 = !DILocation(line: 315, column: 13, scope: !342)
!359 = !DILocation(line: 315, column: 21, scope: !342)
!360 = !DILocation(line: 315, column: 25, scope: !342)
!361 = !DILocation(line: 315, column: 31, scope: !342)
!362 = !DILocation(line: 315, column: 39, scope: !342)
!363 = !DILocation(line: 315, column: 44, scope: !342)
!364 = !DILocation(line: 315, column: 53, scope: !342)
!365 = !DILocation(line: 315, column: 58, scope: !342)
!366 = !DILocation(line: 315, column: 68, scope: !342)
!367 = !DILocation(line: 315, column: 74, scope: !342)
!368 = !DILocation(line: 316, column: 5, scope: !342)
!369 = !DILocation(line: 316, column: 12, scope: !342)
!370 = !DILocation(line: 318, column: 3, scope: !342)
!371 = !DILocation(line: 318, column: 7, scope: !342)
!372 = !DILocation(line: 318, column: 14, scope: !342)
!373 = !DILocation(line: 318, column: 17, scope: !342)
!374 = !DILocation(line: 319, column: 5, scope: !342)
!375 = !DILocation(line: 319, column: 11, scope: !342)
!376 = !DILocation(line: 319, column: 21, scope: !342)
!377 = !DILocation(line: 319, column: 30, scope: !342)
!378 = !DILocation(line: 319, column: 37, scope: !342)
!379 = !DILocation(line: 319, column: 44, scope: !342)
!380 = !DILocation(line: 319, column: 48, scope: !342)
!381 = !DILocation(line: 319, column: 54, scope: !342)
!382 = !DILocation(line: 319, column: 61, scope: !342)
!383 = !DILocation(line: 321, column: 3, scope: !342)
!384 = !DILocation(line: 321, column: 10, scope: !342)
!385 = !{null, !12}
!386 = !DISubroutineType(types: !385)
!387 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 351, type: !386, scopeLine: 351, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!388 = !DILocation(line: 351, column: 3, scope: !387)
!389 = !DILocalVariable(name: "this", arg: 1, scope: !387, file: !13, line: 351, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!390 = !{!"i32", !153, i64 0}
!391 = !{!"ptr", !153, i64 0}
!392 = !{!"Map$str$i32", !390, i64 0, !391, i64 8, !390, i64 16, !390, i64 20, !391, i64 24, !391, i64 32, !391, i64 40, !390, i64 48}
!393 = !{!392, !390, i64 0}
!394 = !{!392, !390, i64 16}
!395 = !{!392, !390, i64 20}
!396 = !{!392, !390, i64 48}
!397 = !DILocation(line: 352, column: 5, scope: !387)
!398 = !DILocation(line: 352, column: 18, scope: !387)
!399 = !{!392, !391, i64 8}
!400 = !DILocation(line: 353, column: 5, scope: !387)
!401 = !DILocation(line: 353, column: 22, scope: !387)
!402 = !{!392, !391, i64 24}
!403 = !DILocation(line: 354, column: 5, scope: !387)
!404 = !DILocation(line: 354, column: 24, scope: !387)
!405 = !{!392, !391, i64 32}
!406 = !DILocation(line: 355, column: 5, scope: !387)
!407 = !DILocation(line: 355, column: 24, scope: !387)
!408 = !{!392, !391, i64 40}
!409 = !{!16, !12, !31}
!410 = !DISubroutineType(types: !409)
!411 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 365, type: !410, scopeLine: 365, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!412 = !DILocation(line: 365, column: 3, scope: !411)
!413 = !DILocalVariable(name: "this", arg: 1, scope: !411, file: !13, line: 365, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!414 = !DILocalVariable(name: "key", arg: 2, scope: !411, file: !13, line: 365, type: !31)
!415 = !DILocation(line: 366, column: 5, scope: !411)
!416 = !DILocation(line: 366, column: 12, scope: !411)
!417 = !DILocation(line: 366, column: 23, scope: !411)
!418 = !DILocation(line: 366, column: 35, scope: !411)
!419 = !DILocation(line: 366, column: 46, scope: !411)
!420 = !DILocation(line: 366, column: 64, scope: !411)
!421 = !DILocation(line: 366, column: 80, scope: !411)
!422 = !{!12, !12, !31, !4}
!423 = !DISubroutineType(types: !422)
!424 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 388, type: !423, scopeLine: 388, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!425 = !DILocation(line: 388, column: 3, scope: !424)
!426 = !DILocalVariable(name: "this", arg: 1, scope: !424, file: !13, line: 388, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!427 = !DILocalVariable(name: "key", arg: 2, scope: !424, file: !13, line: 388, type: !31)
!428 = !DILocalVariable(name: "value", arg: 3, scope: !424, file: !13, line: 388, type: !4)
!429 = !DILocation(line: 389, column: 5, scope: !424)
!430 = !DILocation(line: 389, column: 19, scope: !424)
!431 = !DILocation(line: 389, column: 30, scope: !424)
!432 = !DILocalVariable(name: "found", scope: !424, file: !13, line: 389, type: !16)
!433 = !DILocation(line: 390, column: 5, scope: !424)
!434 = !DILocation(line: 390, column: 9, scope: !424)
!435 = !DILocation(line: 390, column: 18, scope: !424)
!436 = !DILocation(line: 390, column: 21, scope: !424)
!437 = !DILocation(line: 391, column: 7, scope: !424)
!438 = !DILocation(line: 391, column: 23, scope: !424)
!439 = !DILocation(line: 391, column: 29, scope: !424)
!440 = !DILocation(line: 391, column: 37, scope: !424)
!441 = !DILocation(line: 392, column: 12, scope: !424)
!442 = !DILocation(line: 393, column: 7, scope: !424)
!443 = !DILocation(line: 393, column: 21, scope: !424)
!444 = !DILocation(line: 393, column: 28, scope: !424)
!445 = !DILocation(line: 393, column: 33, scope: !424)
!446 = !DILocation(line: 395, column: 5, scope: !424)
!447 = !DILocation(line: 395, column: 12, scope: !424)
!448 = !{!4, !12, !4, !4}
!449 = !DISubroutineType(types: !448)
!450 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 474, type: !449, scopeLine: 474, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!451 = !DILocation(line: 474, column: 3, scope: !450)
!452 = !DILocalVariable(name: "this", arg: 1, scope: !450, file: !13, line: 474, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!453 = !DILocalVariable(name: "index", arg: 2, scope: !450, file: !13, line: 474, type: !4)
!454 = !DILocalVariable(name: "none", arg: 3, scope: !450, file: !13, line: 474, type: !4)
!455 = !DILocation(line: 475, column: 5, scope: !450)
!456 = !DILocation(line: 475, column: 9, scope: !450)
!457 = !DILocation(line: 475, column: 18, scope: !450)
!458 = !DILocation(line: 475, column: 23, scope: !450)
!459 = !DILocation(line: 475, column: 31, scope: !450)
!460 = !DILocation(line: 475, column: 37, scope: !450)
!461 = !DILocation(line: 475, column: 63, scope: !450)
!462 = !DILocation(line: 476, column: 7, scope: !450)
!463 = !DILocation(line: 476, column: 14, scope: !450)
!464 = !DILocation(line: 476, column: 31, scope: !450)
!465 = !DILocation(line: 478, column: 5, scope: !450)
!466 = !DILocation(line: 478, column: 12, scope: !450)
!467 = !{null, !12, !4, !4}
!468 = !DISubroutineType(types: !467)
!469 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 487, type: !468, scopeLine: 487, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!470 = !DILocation(line: 487, column: 3, scope: !469)
!471 = !DILocalVariable(name: "this", arg: 1, scope: !469, file: !13, line: 487, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!472 = !DILocalVariable(name: "index", arg: 2, scope: !469, file: !13, line: 487, type: !4)
!473 = !DILocalVariable(name: "value", arg: 3, scope: !469, file: !13, line: 487, type: !4)
!474 = !DILocation(line: 488, column: 5, scope: !469)
!475 = !DILocation(line: 488, column: 9, scope: !469)
!476 = !DILocation(line: 488, column: 18, scope: !469)
!477 = !DILocation(line: 488, column: 23, scope: !469)
!478 = !DILocation(line: 488, column: 31, scope: !469)
!479 = !DILocation(line: 488, column: 37, scope: !469)
!480 = !DILocation(line: 488, column: 63, scope: !469)
!481 = !DILocation(line: 489, column: 7, scope: !469)
!482 = !DILocation(line: 489, column: 24, scope: !469)
!483 = !DILocation(line: 489, column: 33, scope: !469)
!484 = !{null, !12, !16, !31, !4}
!485 = !DISubroutineType(types: !484)
!486 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 500, type: !485, scopeLine: 500, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!487 = !DILocation(line: 500, column: 3, scope: !486)
!488 = !DILocalVariable(name: "this", arg: 1, scope: !486, file: !13, line: 500, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!489 = !DILocalVariable(name: "absent", arg: 2, scope: !486, file: !13, line: 500, type: !16)
!490 = !DILocalVariable(name: "key", arg: 3, scope: !486, file: !13, line: 500, type: !31)
!491 = !DILocalVariable(name: "value", arg: 4, scope: !486, file: !13, line: 500, type: !4)
!492 = !DILocation(line: 501, column: 5, scope: !486)
!493 = !DILocation(line: 501, column: 20, scope: !486)
!494 = !DILocation(line: 501, column: 25, scope: !486)
!495 = !DILocalVariable(name: "packed", scope: !486, file: !13, line: 501, type: !16)
!496 = !DILocation(line: 502, column: 5, scope: !486)
!497 = !DILocation(line: 502, column: 25, scope: !486)
!498 = !{!"element ptr", !153, i64 0}
!499 = !{!498, !498, i64 0}
!500 = !DILocation(line: 503, column: 5, scope: !486)
!501 = !DILocation(line: 503, column: 27, scope: !486)
!502 = !DILocation(line: 504, column: 5, scope: !486)
!503 = !DILocation(line: 504, column: 27, scope: !486)
!504 = !DILocation(line: 504, column: 33, scope: !486)
!505 = !DILocation(line: 505, column: 5, scope: !486)
!506 = !DILocation(line: 508, column: 5, scope: !486)
!507 = !DILocation(line: 508, column: 9, scope: !486)
!508 = !DILocation(line: 508, column: 10, scope: !486)
!509 = !DILocation(line: 508, column: 23, scope: !486)
!510 = !DILocation(line: 508, column: 35, scope: !486)
!511 = !DILocation(line: 508, column: 46, scope: !486)
!512 = !DILocation(line: 508, column: 52, scope: !486)
!513 = !DILocation(line: 508, column: 67, scope: !486)
!514 = !DILocation(line: 508, column: 86, scope: !486)
!515 = !DILocation(line: 509, column: 7, scope: !486)
!516 = distinct !DISubprogram(name: "Map<string, i32>.addOne", linkageName: "nish.Map$str$i32.addOne", scope: !13, file: !13, line: 518, type: !386, scopeLine: 518, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!517 = !DILocation(line: 518, column: 3, scope: !516)
!518 = !DILocalVariable(name: "this", arg: 1, scope: !516, file: !13, line: 518, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!519 = !DILocation(line: 519, column: 5, scope: !516)
!520 = !DILocation(line: 519, column: 18, scope: !516)
!521 = !DILocalVariable(name: "live", scope: !516, file: !13, line: 519, type: !4)
!522 = !DILocation(line: 520, column: 5, scope: !516)
!523 = !DILocation(line: 520, column: 9, scope: !516)
!524 = !DILocation(line: 520, column: 16, scope: !516)
!525 = !DILocation(line: 520, column: 28, scope: !516)
!526 = !DILocation(line: 521, column: 7, scope: !516)
!527 = !DILocation(line: 521, column: 19, scope: !516)
!528 = !DILocation(line: 521, column: 26, scope: !516)
!529 = !DILocation(line: 523, column: 5, scope: !516)
!530 = !DILocation(line: 523, column: 18, scope: !516)
!531 = !DILocalVariable(name: "size", scope: !516, file: !13, line: 523, type: !4)
!532 = !DILocation(line: 524, column: 5, scope: !516)
!533 = !DILocation(line: 524, column: 9, scope: !516)
!534 = !DILocation(line: 524, column: 16, scope: !516)
!535 = !DILocation(line: 524, column: 28, scope: !516)
!536 = !DILocation(line: 525, column: 7, scope: !516)
!537 = !DILocation(line: 525, column: 19, scope: !516)
!538 = !DILocation(line: 525, column: 26, scope: !516)
!539 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 546, type: !386, scopeLine: 546, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!540 = !DILocation(line: 546, column: 3, scope: !539)
!541 = !DILocalVariable(name: "this", arg: 1, scope: !539, file: !13, line: 546, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!542 = !DILocation(line: 547, column: 5, scope: !539)
!543 = !DILocation(line: 547, column: 18, scope: !539)
!544 = !DILocation(line: 547, column: 24, scope: !539)
!545 = !DILocalVariable(name: "used", scope: !539, file: !13, line: 547, type: !4)
!546 = !DILocation(line: 548, column: 5, scope: !539)
!547 = !DILocation(line: 548, column: 21, scope: !539)
!548 = !DILocation(line: 548, column: 34, scope: !539)
!549 = !DILocalVariable(name: "walking", scope: !539, file: !13, line: 548, type: !339)
!550 = !DILocation(line: 549, column: 5, scope: !539)
!551 = !DILocation(line: 549, column: 19, scope: !539)
!552 = !DILocation(line: 549, column: 32, scope: !539)
!553 = !DILocation(line: 549, column: 44, scope: !539)
!554 = !DILocation(line: 549, column: 54, scope: !539)
!555 = !DILocation(line: 549, column: 61, scope: !539)
!556 = !DILocation(line: 549, column: 72, scope: !539)
!557 = !DILocalVariable(name: "slots", scope: !539, file: !13, line: 549, type: !23)
!558 = !DILocation(line: 550, column: 5, scope: !539)
!559 = !DILocation(line: 550, column: 9, scope: !539)
!560 = !DILocation(line: 550, column: 10, scope: !539)
!561 = !DILocation(line: 550, column: 21, scope: !539)
!562 = !DILocation(line: 550, column: 33, scope: !539)
!563 = !DILocation(line: 550, column: 39, scope: !539)
!564 = !DILocation(line: 551, column: 7, scope: !539)
!565 = !DILocation(line: 551, column: 22, scope: !539)
!566 = !DILocation(line: 551, column: 38, scope: !539)
!567 = !DILocation(line: 552, column: 7, scope: !539)
!568 = !DILocation(line: 552, column: 22, scope: !539)
!569 = !DILocation(line: 552, column: 40, scope: !539)
!570 = !DILocation(line: 553, column: 7, scope: !539)
!571 = !DILocation(line: 553, column: 21, scope: !539)
!572 = !DILocation(line: 555, column: 5, scope: !539)
!573 = !DILocation(line: 555, column: 18, scope: !539)
!574 = !DILocation(line: 556, column: 5, scope: !539)
!575 = !DILocation(line: 556, column: 17, scope: !539)
!576 = !DILocation(line: 556, column: 23, scope: !539)
!577 = !DILocation(line: 556, column: 39, scope: !539)
!578 = !DILocation(line: 557, column: 5, scope: !539)
!579 = !DILocation(line: 557, column: 12, scope: !539)
!580 = !DILocation(line: 557, column: 19, scope: !539)
!581 = !{!16, !23, !4, !23, !35, !31}
!582 = !DISubroutineType(types: !581)
!583 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 113, type: !582, scopeLine: 113, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!584 = !DILocation(line: 113, column: 1, scope: !583)
!585 = !DILocalVariable(name: "slots", arg: 1, scope: !583, file: !13, line: 113, type: !23)
!586 = !DILocalVariable(name: "mask", arg: 2, scope: !583, file: !13, line: 113, type: !4)
!587 = !DILocalVariable(name: "hashes", arg: 3, scope: !583, file: !13, line: 113, type: !23)
!588 = !DILocalVariable(name: "keys", arg: 4, scope: !583, file: !13, line: 113, type: !35)
!589 = !DILocalVariable(name: "key", arg: 5, scope: !583, file: !13, line: 113, type: !31)
!590 = !DILocation(line: 114, column: 3, scope: !583)
!591 = !DILocation(line: 114, column: 13, scope: !583)
!592 = !DILocation(line: 114, column: 21, scope: !583)
!593 = !DILocalVariable(name: "h", scope: !583, file: !13, line: 114, type: !19)
!594 = !DILocation(line: 115, column: 3, scope: !583)
!595 = !DILocation(line: 115, column: 15, scope: !583)
!596 = !DILocation(line: 115, column: 21, scope: !583)
!597 = !DILocalVariable(name: "low", scope: !583, file: !13, line: 115, type: !19)
!598 = !DILocation(line: 116, column: 3, scope: !583)
!599 = !DILocation(line: 116, column: 23, scope: !583)
!600 = !DILocation(line: 116, column: 27, scope: !583)
!601 = !DILocation(line: 116, column: 28, scope: !583)
!602 = !DILocalVariable(name: "fingerprint", scope: !583, file: !13, line: 116, type: !19)
!603 = !DILocation(line: 117, column: 3, scope: !583)
!604 = !DILocation(line: 117, column: 16, scope: !583)
!605 = !DILocation(line: 117, column: 22, scope: !583)
!606 = !DILocation(line: 117, column: 33, scope: !583)
!607 = !DILocation(line: 117, column: 36, scope: !583)
!608 = !DILocalVariable(name: "bucket", scope: !583, file: !13, line: 117, type: !19)
!609 = !DILocation(line: 124, column: 3, scope: !583)
!610 = !DILocation(line: 124, column: 11, scope: !583)
!611 = !DILocation(line: 124, column: 17, scope: !583)
!612 = !DILocalVariable(name: "b", scope: !583, file: !13, line: 124, type: !4)
!613 = !DILocation(line: 125, column: 3, scope: !583)
!614 = !DILocation(line: 125, column: 30, scope: !583)
!615 = !DILocation(line: 134, column: 20, scope: !583)
!616 = !DILocation(line: 136, column: 20, scope: !583)
!617 = !DILocation(line: 125, column: 10, scope: !583)
!618 = !DILocation(line: 125, column: 15, scope: !583)
!619 = !DILocation(line: 125, column: 20, scope: !583)
!620 = !DILocation(line: 125, column: 24, scope: !583)
!621 = !DILocation(line: 125, column: 45, scope: !583)
!622 = !DILocation(line: 126, column: 5, scope: !583)
!623 = !DILocation(line: 126, column: 18, scope: !583)
!624 = !DILocation(line: 126, column: 24, scope: !583)
!625 = !DILocalVariable(name: "word", scope: !583, file: !13, line: 126, type: !19)
!626 = !DILocation(line: 127, column: 5, scope: !583)
!627 = !DILocation(line: 127, column: 9, scope: !583)
!628 = !DILocation(line: 127, column: 18, scope: !583)
!629 = !DILocation(line: 127, column: 21, scope: !583)
!630 = !DILocation(line: 128, column: 7, scope: !583)
!631 = !DILocation(line: 128, column: 14, scope: !583)
!632 = !DILocation(line: 128, column: 23, scope: !583)
!633 = !DILocation(line: 128, column: 26, scope: !583)
!634 = !DILocation(line: 130, column: 5, scope: !583)
!635 = !DILocation(line: 130, column: 9, scope: !583)
!636 = !DILocation(line: 130, column: 10, scope: !583)
!637 = !DILocation(line: 130, column: 17, scope: !583)
!638 = !DILocation(line: 130, column: 18, scope: !583)
!639 = !DILocation(line: 130, column: 27, scope: !583)
!640 = !DILocation(line: 130, column: 40, scope: !583)
!641 = !DILocation(line: 131, column: 7, scope: !583)
!642 = !DILocation(line: 131, column: 18, scope: !583)
!643 = !DILocation(line: 131, column: 24, scope: !583)
!644 = !DILocation(line: 131, column: 25, scope: !583)
!645 = !DILocation(line: 131, column: 32, scope: !583)
!646 = !DILocation(line: 131, column: 39, scope: !583)
!647 = !DILocalVariable(name: "at", scope: !583, file: !13, line: 131, type: !4)
!648 = !DILocation(line: 132, column: 7, scope: !583)
!649 = !DILocation(line: 133, column: 9, scope: !583)
!650 = !DILocation(line: 133, column: 15, scope: !583)
!651 = !DILocation(line: 134, column: 9, scope: !583)
!652 = !DILocation(line: 134, column: 14, scope: !583)
!653 = !DILocation(line: 135, column: 9, scope: !583)
!654 = !DILocation(line: 135, column: 16, scope: !583)
!655 = !DILocation(line: 135, column: 24, scope: !583)
!656 = !DILocation(line: 136, column: 9, scope: !583)
!657 = !DILocation(line: 136, column: 14, scope: !583)
!658 = !DILocation(line: 137, column: 9, scope: !583)
!659 = !DILocation(line: 137, column: 17, scope: !583)
!660 = !DILocation(line: 137, column: 22, scope: !583)
!661 = !DILocation(line: 137, column: 27, scope: !583)
!662 = !DILocation(line: 138, column: 9, scope: !583)
!663 = !DILocation(line: 139, column: 9, scope: !583)
!664 = !DILocation(line: 139, column: 16, scope: !583)
!665 = !DILocation(line: 139, column: 24, scope: !583)
!666 = !DILocation(line: 139, column: 27, scope: !583)
!667 = !DILocation(line: 142, column: 5, scope: !583)
!668 = !DILocation(line: 142, column: 14, scope: !583)
!669 = !DILocation(line: 142, column: 15, scope: !583)
!670 = !DILocation(line: 142, column: 24, scope: !583)
!671 = !DILocation(line: 142, column: 29, scope: !583)
!672 = !DILocation(line: 143, column: 5, scope: !583)
!673 = !DILocation(line: 143, column: 9, scope: !583)
!674 = !DILocation(line: 143, column: 15, scope: !583)
!675 = !DILocation(line: 145, column: 3, scope: !583)
!676 = !DILocation(line: 145, column: 10, scope: !583)
!677 = !DILocation(line: 145, column: 19, scope: !583)
!678 = !DILocation(line: 145, column: 25, scope: !583)
!679 = !DILocation(line: 145, column: 40, scope: !583)
!680 = !{null, !35, !23}
!681 = !DISubroutineType(types: !680)
!682 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 170, type: !681, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!683 = !DILocation(line: 170, column: 1, scope: !682)
!684 = !DILocalVariable(name: "items", arg: 1, scope: !682, file: !13, line: 170, type: !35)
!685 = !DILocalVariable(name: "hashes", arg: 2, scope: !682, file: !13, line: 170, type: !23)
!686 = !DILocation(line: 171, column: 3, scope: !682)
!687 = !DILocation(line: 171, column: 16, scope: !682)
!688 = !DILocation(line: 171, column: 22, scope: !682)
!689 = !DILocalVariable(name: "used", scope: !682, file: !13, line: 171, type: !4)
!690 = !DILocation(line: 172, column: 3, scope: !682)
!691 = !DILocation(line: 172, column: 17, scope: !682)
!692 = !DILocalVariable(name: "to", scope: !682, file: !13, line: 172, type: !4)
!693 = !DILocation(line: 173, column: 3, scope: !682)
!694 = !DILocation(line: 173, column: 24, scope: !682)
!695 = !DILocalVariable(name: "from", scope: !682, file: !13, line: 173, type: !4)
!696 = !DILocation(line: 173, column: 55, scope: !682)
!697 = !DILocation(line: 174, column: 68, scope: !682)
!698 = !DILocation(line: 173, column: 27, scope: !682)
!699 = !DILocation(line: 173, column: 34, scope: !682)
!700 = !DILocation(line: 173, column: 42, scope: !682)
!701 = !DILocation(line: 173, column: 49, scope: !682)
!702 = !DILocation(line: 173, column: 79, scope: !682)
!703 = !DILocation(line: 174, column: 5, scope: !682)
!704 = !DILocation(line: 174, column: 9, scope: !682)
!705 = !DILocation(line: 174, column: 16, scope: !682)
!706 = !DILocation(line: 174, column: 26, scope: !682)
!707 = !DILocation(line: 174, column: 31, scope: !682)
!708 = !DILocation(line: 174, column: 37, scope: !682)
!709 = !DILocation(line: 174, column: 42, scope: !682)
!710 = !DILocation(line: 174, column: 47, scope: !682)
!711 = !DILocation(line: 174, column: 55, scope: !682)
!712 = !DILocation(line: 174, column: 62, scope: !682)
!713 = !DILocation(line: 174, column: 83, scope: !682)
!714 = !DILocation(line: 175, column: 7, scope: !682)
!715 = !DILocation(line: 175, column: 13, scope: !682)
!716 = !DILocation(line: 175, column: 19, scope: !682)
!717 = !DILocation(line: 175, column: 25, scope: !682)
!718 = !DILocation(line: 176, column: 7, scope: !682)
!719 = !DILocation(line: 173, column: 71, scope: !682)
!720 = !DILocation(line: 179, column: 3, scope: !682)
!721 = !DILocation(line: 179, column: 10, scope: !682)
!722 = !DILocation(line: 179, column: 16, scope: !682)
!723 = !DILocation(line: 179, column: 32, scope: !682)
!724 = !DILocation(line: 179, column: 38, scope: !682)
!725 = !DILocation(line: 179, column: 53, scope: !682)
!726 = !DILocation(line: 179, column: 56, scope: !682)
!727 = !DILocation(line: 180, column: 5, scope: !682)
!728 = !{null, !43, !23}
!729 = !DISubroutineType(types: !728)
!730 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 170, type: !729, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!731 = !DILocation(line: 170, column: 1, scope: !730)
!732 = !DILocalVariable(name: "items", arg: 1, scope: !730, file: !13, line: 170, type: !43)
!733 = !DILocalVariable(name: "hashes", arg: 2, scope: !730, file: !13, line: 170, type: !23)
!734 = !DILocation(line: 171, column: 3, scope: !730)
!735 = !DILocation(line: 171, column: 16, scope: !730)
!736 = !DILocation(line: 171, column: 22, scope: !730)
!737 = !DILocalVariable(name: "used", scope: !730, file: !13, line: 171, type: !4)
!738 = !DILocation(line: 172, column: 3, scope: !730)
!739 = !DILocation(line: 172, column: 17, scope: !730)
!740 = !DILocalVariable(name: "to", scope: !730, file: !13, line: 172, type: !4)
!741 = !DILocation(line: 173, column: 3, scope: !730)
!742 = !DILocation(line: 173, column: 24, scope: !730)
!743 = !DILocalVariable(name: "from", scope: !730, file: !13, line: 173, type: !4)
!744 = !DILocation(line: 173, column: 55, scope: !730)
!745 = !DILocation(line: 174, column: 68, scope: !730)
!746 = !DILocation(line: 173, column: 27, scope: !730)
!747 = !DILocation(line: 173, column: 34, scope: !730)
!748 = !DILocation(line: 173, column: 42, scope: !730)
!749 = !DILocation(line: 173, column: 49, scope: !730)
!750 = !DILocation(line: 173, column: 79, scope: !730)
!751 = !DILocation(line: 174, column: 5, scope: !730)
!752 = !DILocation(line: 174, column: 9, scope: !730)
!753 = !DILocation(line: 174, column: 16, scope: !730)
!754 = !DILocation(line: 174, column: 26, scope: !730)
!755 = !DILocation(line: 174, column: 31, scope: !730)
!756 = !DILocation(line: 174, column: 37, scope: !730)
!757 = !DILocation(line: 174, column: 42, scope: !730)
!758 = !DILocation(line: 174, column: 47, scope: !730)
!759 = !DILocation(line: 174, column: 55, scope: !730)
!760 = !DILocation(line: 174, column: 62, scope: !730)
!761 = !DILocation(line: 174, column: 83, scope: !730)
!762 = !DILocation(line: 175, column: 7, scope: !730)
!763 = !DILocation(line: 175, column: 13, scope: !730)
!764 = !DILocation(line: 175, column: 19, scope: !730)
!765 = !DILocation(line: 175, column: 25, scope: !730)
!766 = !DILocation(line: 176, column: 7, scope: !730)
!767 = !DILocation(line: 173, column: 71, scope: !730)
!768 = !DILocation(line: 179, column: 3, scope: !730)
!769 = !DILocation(line: 179, column: 10, scope: !730)
!770 = !DILocation(line: 179, column: 16, scope: !730)
!771 = !DILocation(line: 179, column: 32, scope: !730)
!772 = !DILocation(line: 179, column: 38, scope: !730)
!773 = !DILocation(line: 179, column: 53, scope: !730)
!774 = !DILocation(line: 179, column: 56, scope: !730)
!775 = !DILocation(line: 180, column: 5, scope: !730)
!776 = !{i32 8, !"cf-protection-branch", i32 1}
!777 = !{i32 8, !"cf-protection-return", i32 1}
!778 = !{i32 8, !"branch-target-enforcement", i32 1}
!779 = !{i32 8, !"sign-return-address", i32 1}
!780 = !{i32 4, !"probe-stack", !"inline-asm"}
