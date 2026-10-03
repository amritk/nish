%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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
  %8 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %4, i32 %7), !dbg !52
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 !dbg !79 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !81, metadata !DIExpression()), !dbg !80
  call void @llvm.dbg.value(metadata i32 %index, metadata !82, metadata !DIExpression()), !dbg !80
  %0 = lshr i32 %h, 24, !dbg !85
  %1 = shl i32 %0, 24, !dbg !84
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1), !dbg !87
  %3 = extractvalue { i32, i1 } %2, 0, !dbg !87
  %4 = extractvalue { i32, i1 } %2, 1, !dbg !87
  br i1 %4, label %ovf.fail, label %ovf.ok, !dbg !87

ovf.ok:
  %5 = or i32 %1, %3, !dbg !83
  ret i32 %5, !dbg !80

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !87
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !91 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !93, metadata !DIExpression()), !dbg !92
  call void @llvm.dbg.value(metadata i32 %index, metadata !94, metadata !DIExpression()), !dbg !92
  %0 = sext i32 %bucket to i64, !dbg !96
  %1 = shl i64 %0, 32, !dbg !96
  %2 = sext i32 %index to i64, !dbg !98
  %3 = or i64 %1, %2, !dbg !95
  ret i64 %3, !dbg !92
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !102 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !104, metadata !DIExpression()), !dbg !103
  call void @llvm.dbg.value(metadata i32 %h, metadata !105, metadata !DIExpression()), !dbg !103
  %0 = sext i32 -1 to i64, !dbg !106
  %1 = sext i32 %bucket to i64, !dbg !110
  %2 = shl i64 %1, 32, !dbg !110
  %3 = zext i32 %h to i64, !dbg !112
  %4 = or i64 %2, %3, !dbg !109
  %5 = sub nsw i64 %0, %4, !dbg !106
  ret i64 %5, !dbg !103
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !116 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !118, metadata !DIExpression()), !dbg !117
  call void @llvm.dbg.value(metadata i32 %mask, metadata !119, metadata !DIExpression()), !dbg !117
  call void @llvm.dbg.value(metadata i32 %h, metadata !120, metadata !DIExpression()), !dbg !117
  call void @llvm.dbg.value(metadata i32 %index, metadata !121, metadata !DIExpression()), !dbg !117
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !123
  store i32 %0, i32* %word.addr, align 4, !dbg !122
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !126, metadata !DIExpression()), !dbg !122
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !128
  store i32 %1, i32* %bucket.addr, align 4, !dbg !127
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !131, metadata !DIExpression()), !dbg !127
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !132
  %3 = load i64, i64* %2, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !132
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !132
  %5 = load i8*, i8** %4, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !132
  br label %while.cond, !dbg !132

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !146
  %7 = icmp sge i32 %6, 0, !dbg !146
  br i1 %7, label %land.rhs, label %land.end, !dbg !146

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !148
  %9 = trunc i64 %3 to i32, !dbg !133
  %10 = icmp slt i32 %8, %9, !dbg !148
  br label %land.end, !dbg !146

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !146
  br i1 %11, label %while.body, label %while.end, !dbg !132

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !153
  %13 = sext i32 %12 to i64, !dbg !152
  %14 = bitcast i8* %5 to i32*, !dbg !152
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !152
  %16 = load i32, i32* %15, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !152
  %17 = icmp eq i32 %16, 0, !dbg !152
  br i1 %17, label %if.then, label %if.end, !dbg !151

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !159
  %19 = sext i32 %18 to i64, !dbg !158
  %20 = load i32, i32* %word.addr, align 4, !dbg !160
  %21 = bitcast i8* %5 to i32*, !dbg !158
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !158
  store i32 %20, i32* %22, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !158
  ret void, !dbg !161

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !164
  %24 = add nsw i32 %23, 1, !dbg !164
  %25 = and i32 %24, %mask, !dbg !163
  store i32 %25, i32* %bucket.addr, align 4, !dbg !162
  br label %while.cond, !dbg !132

while.end:
  ret void, !dbg !117
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !169 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !171, metadata !DIExpression()), !dbg !170
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !174
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !174
  %2 = trunc i64 %1 to i32, !dbg !174
  store i32 %2, i32* %used.addr, align 4, !dbg !172
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !175, metadata !DIExpression()), !dbg !172
  store i32 0, i32* %to.addr, align 4, !dbg !176
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !178, metadata !DIExpression()), !dbg !176
  store i32 0, i32* %from.addr, align 4, !dbg !179
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !181, metadata !DIExpression()), !dbg !179
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !179
  %4 = load i8*, i8** %3, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !179
  br label %for.cond, !dbg !179

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !183
  %6 = load i32, i32* %used.addr, align 4, !dbg !184
  %7 = icmp slt i32 %5, %6, !dbg !183
  br i1 %7, label %for.body, label %for.end, !dbg !179

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !187
  %9 = sext i32 %8 to i64, !dbg !182
  %10 = bitcast i8* %4 to i32*, !dbg !182
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !182
  %12 = load i32, i32* %11, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !182
  store i32 %12, i32* %h.addr, align 4, !dbg !186
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !188, metadata !DIExpression()), !dbg !186
  %13 = load i32, i32* %h.addr, align 4, !dbg !190
  %14 = icmp ne i32 %13, 0, !dbg !190
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !190

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !192
  %16 = icmp sge i32 %15, 0, !dbg !192
  br label %land.end.1, !dbg !190

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !190
  br i1 %17, label %land.rhs, label %land.end, !dbg !190

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !194
  %19 = load i32, i32* %used.addr, align 4, !dbg !195
  %20 = icmp slt i32 %18, %19, !dbg !194
  br label %land.end, !dbg !190

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !190
  br i1 %21, label %if.then, label %if.end, !dbg !189

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !198
  %23 = sext i32 %22 to i64, !dbg !197
  %24 = load i32, i32* %h.addr, align 4, !dbg !199
  %25 = bitcast i8* %4 to i32*, !dbg !197
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !197
  store i32 %24, i32* %26, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !197
  %27 = load i32, i32* %to.addr, align 4, !dbg !200
  %28 = add nsw i32 %27, 1, !dbg !200
  store i32 %28, i32* %to.addr, align 4, !dbg !200
  br label %if.end, !dbg !189

if.end:
  br label %for.inc, !dbg !179

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !201
  %30 = add nsw i32 %29, 1, !dbg !201
  store i32 %30, i32* %from.addr, align 4, !dbg !201
  br label %for.cond, !dbg !179

for.end:
  br label %while.cond, !dbg !202

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !204
  %32 = load i64, i64* %31, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !204
  %33 = trunc i64 %32 to i32, !dbg !204
  %34 = load i32, i32* %to.addr, align 4, !dbg !205
  %35 = icmp sgt i32 %33, %34, !dbg !203
  br i1 %35, label %while.body, label %while.end, !dbg !202

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !207
  %37 = load i64, i64* %36, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !207
  %38 = icmp eq i64 %37, 0, !dbg !207
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !207

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !207
  unreachable, !dbg !207

pop.ok:
  %39 = sub i64 %37, 1, !dbg !207
  store i64 %39, i64* %36, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !207
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !207
  %41 = load i8*, i8** %40, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !207
  %42 = bitcast i8* %41 to i32*, !dbg !207
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !207
  %44 = load i32, i32* %43, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !207
  br label %while.cond, !dbg !202

while.end:
  ret void, !dbg !170
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !210 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !212, metadata !DIExpression()), !dbg !211
  call void @llvm.dbg.value(metadata i32 %live, metadata !213, metadata !DIExpression()), !dbg !211
  call void @llvm.dbg.value(metadata i32 %used, metadata !214, metadata !DIExpression()), !dbg !211
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !217
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !217
  %2 = trunc i64 %1 to i32, !dbg !217
  store i32 %2, i32* %n.addr, align 4, !dbg !215
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !218, metadata !DIExpression()), !dbg !215
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2), !dbg !220
  %4 = extractvalue { i32, i1 } %3, 0, !dbg !220
  %5 = extractvalue { i32, i1 } %3, 1, !dbg !220
  br i1 %5, label %ovf.fail, label %ovf.ok, !dbg !220

ovf.ok:
  %6 = icmp slt i32 %4, %used, !dbg !220
  br i1 %6, label %if.then, label %if.end, !dbg !219

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !224
  ret %struct.nish_array* %slots, !dbg !226

if.end:
  %7 = load i32, i32* %n.addr, align 4, !dbg !230
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2), !dbg !230
  %9 = extractvalue { i32, i1 } %8, 0, !dbg !230
  %10 = extractvalue { i32, i1 } %8, 1, !dbg !230
  br i1 %10, label %ovf.fail.1, label %ovf.ok.1, !dbg !230

ovf.ok.1:
  %11 = sext i32 %9 to i64, !dbg !229
  %12 = icmp ule i64 %11, 2147483647, !dbg !229
  br i1 %12, label %len.ok, label %len.fail, !dbg !229

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true), !dbg !229
  call void @nish_exit(i32 1), !dbg !229
  unreachable, !dbg !229

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !229
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !229
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !229
  store i64 %11, i64* %15, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !229
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !229
  store i64 %11, i64* %16, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !229
  %17 = mul i64 %11, 4, !dbg !229
  %18 = call i8* @nish_alloc_struct(i64 %17), !dbg !229
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !138, !noalias !137, !dbg !229
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !229
  store i8* %18, i8** %19, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !229
  ret %struct.nish_array* %14, !dbg !228

ovf.fail:
  call void @nish_panic_overflow(i32 2), !dbg !220
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 2), !dbg !230
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !235 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !237, metadata !DIExpression()), !dbg !236
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !238, metadata !DIExpression()), !dbg !236
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !241
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !241
  %2 = trunc i64 %1 to i32, !dbg !241
  %3 = sub nsw i32 %2, 1, !dbg !240
  store i32 %3, i32* %mask.addr, align 4, !dbg !239
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !243, metadata !DIExpression()), !dbg !239
  store i32 0, i32* %i.addr, align 4, !dbg !244
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !246, metadata !DIExpression()), !dbg !244
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !244
  %5 = load i64, i64* %4, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !244
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !244
  %7 = load i8*, i8** %6, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !244
  br label %for.cond, !dbg !244

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !248
  %9 = trunc i64 %5 to i32, !dbg !247
  %10 = icmp slt i32 %8, %9, !dbg !248
  br i1 %10, label %for.body, label %for.end, !dbg !244

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !253
  %12 = sext i32 %11 to i64, !dbg !252
  %13 = bitcast i8* %7 to i32*, !dbg !252
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !252
  %15 = load i32, i32* %14, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !252
  store i32 %15, i32* %h.addr, align 4, !dbg !251
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !254, metadata !DIExpression()), !dbg !251
  %16 = load i32, i32* %h.addr, align 4, !dbg !256
  %17 = icmp ne i32 %16, 0, !dbg !256
  br i1 %17, label %if.then, label %if.end, !dbg !255

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !261
  %19 = load i32, i32* %h.addr, align 4, !dbg !262
  %20 = load i32, i32* %i.addr, align 4, !dbg !263
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !259
  br label %if.end, !dbg !255

if.end:
  br label %for.inc, !dbg !244

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !264
  %22 = add nsw i32 %21, 1, !dbg !264
  store i32 %22, i32* %i.addr, align 4, !dbg !264
  br label %for.cond, !dbg !244

for.end:
  ret void, !dbg !236
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !265 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !267, metadata !DIExpression()), !dbg !266
  store i32 0, i32* %i.addr, align 4, !dbg !268
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !270, metadata !DIExpression()), !dbg !268
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !268
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !268
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !268
  %3 = load i8*, i8** %2, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !268
  br label %for.cond, !dbg !268

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !272
  %5 = trunc i64 %1 to i32, !dbg !271
  %6 = icmp slt i32 %4, %5, !dbg !272
  br i1 %6, label %for.body, label %for.end, !dbg !268

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !276
  %8 = sext i32 %7 to i64, !dbg !275
  %9 = bitcast i8* %3 to i32*, !dbg !275
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !275
  store i32 0, i32* %10, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !275
  br label %for.inc, !dbg !268

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !278
  %12 = add nsw i32 %11, 1, !dbg !278
  store i32 %12, i32* %i.addr, align 4, !dbg !278
  br label %for.cond, !dbg !268

for.end:
  ret void, !dbg !266
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !281 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !283, metadata !DIExpression()), !dbg !282
  call void @llvm.dbg.value(metadata i32 %mask, metadata !284, metadata !DIExpression()), !dbg !282
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !285, metadata !DIExpression()), !dbg !282
  call void @llvm.dbg.value(metadata i32 %h, metadata !286, metadata !DIExpression()), !dbg !282
  call void @llvm.dbg.value(metadata i32 %used, metadata !287, metadata !DIExpression()), !dbg !282
  %0 = icmp sge i32 %bucket, 0, !dbg !289
  br i1 %0, label %land.rhs, label %land.end, !dbg !289

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !293
  %2 = load i64, i64* %1, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !293
  %3 = trunc i64 %2 to i32, !dbg !293
  %4 = icmp slt i32 %bucket, %3, !dbg !291
  br label %land.end, !dbg !289

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !289
  br i1 %5, label %if.then, label %if.else, !dbg !288

if.then:
  %6 = sext i32 %bucket to i64, !dbg !295
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1), !dbg !299
  %8 = extractvalue { i32, i1 } %7, 0, !dbg !299
  %9 = extractvalue { i32, i1 } %7, 1, !dbg !299
  br i1 %9, label %ovf.fail, label %ovf.ok, !dbg !299

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8), !dbg !297
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !295
  %12 = load i8*, i8** %11, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !295
  %13 = bitcast i8* %12 to i32*, !dbg !295
  %14 = getelementptr inbounds i32, i32* %13, i64 %6, !dbg !295
  store i32 %10, i32* %14, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !295
  br label %if.end, !dbg !288

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1), !dbg !306
  %16 = extractvalue { i32, i1 } %15, 0, !dbg !306
  %17 = extractvalue { i32, i1 } %15, 1, !dbg !306
  br i1 %17, label %ovf.fail.1, label %ovf.ok.1, !dbg !306

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16), !dbg !302
  br label %if.end, !dbg !288

if.end:
  ret void, !dbg !282

ovf.fail:
  call void @nish_panic_overflow(i32 1), !dbg !299
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 1), !dbg !306
  unreachable
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 !dbg !310 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !312, metadata !DIExpression()), !dbg !311
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !311
  store i32 0, i32* %0, align 4, !tbaa !316, !dbg !311
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !311
  store i32 7, i32* %1, align 4, !tbaa !317, !dbg !311
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !311
  store i32 0, i32* %2, align 4, !tbaa !318, !dbg !311
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !311
  store i32 0, i32* %3, align 4, !tbaa !319, !dbg !311
  %4 = sext i32 8 to i64, !dbg !321
  %5 = icmp ule i64 %4, 2147483647, !dbg !321
  br i1 %5, label %len.ok, label %len.fail, !dbg !321

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true), !dbg !321
  call void @nish_exit(i32 1), !dbg !321
  unreachable, !dbg !321

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24), !dbg !321
  %7 = bitcast i8* %6 to %struct.nish_array*, !dbg !321
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !321
  store i64 %4, i64* %8, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !321
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1, !dbg !321
  store i64 %4, i64* %9, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !321
  %10 = mul i64 %4, 4, !dbg !321
  %11 = call i8* @nish_alloc_struct(i64 %10), !dbg !321
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !138, !noalias !137, !dbg !321
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2, !dbg !321
  store i8* %11, i8** %12, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !321
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !320
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !323, !dbg !320
  %14 = call i8* @nish_alloc_struct(i64 24), !dbg !325
  %15 = bitcast i8* %14 to %struct.nish_array*, !dbg !325
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !325
  store i64 0, i64* %16, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !325
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !325
  store i64 0, i64* %17, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !325
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !325
  store i8* null, i8** %18, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !325
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !324
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !326, !dbg !324
  %20 = call i8* @nish_alloc_struct(i64 24), !dbg !328
  %21 = bitcast i8* %20 to %struct.nish_array*, !dbg !328
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0, !dbg !328
  store i64 0, i64* %22, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !328
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1, !dbg !328
  store i64 0, i64* %23, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !328
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2, !dbg !328
  store i8* null, i8** %24, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !328
  %25 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !327
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !329, !dbg !327
  %26 = call i8* @nish_alloc_struct(i64 24), !dbg !331
  %27 = bitcast i8* %26 to %struct.nish_array*, !dbg !331
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0, !dbg !331
  store i64 0, i64* %28, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !331
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1, !dbg !331
  store i64 0, i64* %29, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !331
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2, !dbg !331
  store i8* null, i8** %30, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !331
  %31 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !330
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !332, !dbg !330
  ret void, !dbg !311
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !335 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !337, metadata !DIExpression()), !dbg !336
  call void @llvm.dbg.value(metadata i8* %key, metadata !338, metadata !DIExpression()), !dbg !336
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !341
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !323, !dbg !341
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !342
  %3 = load i32, i32* %2, align 4, !tbaa !317, !dbg !342
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !343
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !332, !dbg !343
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !344
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !326, !dbg !344
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !340
  ret i64 %8, !dbg !339
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !348 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !350, metadata !DIExpression()), !dbg !349
  call void @llvm.dbg.value(metadata i8* %key, metadata !351, metadata !DIExpression()), !dbg !349
  call void @llvm.dbg.value(metadata i32 %value, metadata !352, metadata !DIExpression()), !dbg !349
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !354
  store i64 %0, i64* %found.addr, align 8, !dbg !353
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !356, metadata !DIExpression()), !dbg !353
  %1 = load i64, i64* %found.addr, align 8, !dbg !358
  %2 = icmp sge i64 %1, 0, !dbg !358
  br i1 %2, label %if.then, label %if.else, !dbg !357

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !363
  %4 = trunc i64 %3 to i32, !dbg !362
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !361
  br label %if.end, !dbg !357

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !367
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !366
  br label %if.end, !dbg !357

if.end:
  ret %struct.Map$str$i32* %this, !dbg !370
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !374 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !376, metadata !DIExpression()), !dbg !375
  call void @llvm.dbg.value(metadata i32 %index, metadata !377, metadata !DIExpression()), !dbg !375
  %0 = icmp slt i32 %index, 0, !dbg !379
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !379

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !383
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !329, !dbg !383
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !383
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !383
  %5 = trunc i64 %4 to i32, !dbg !383
  %6 = icmp sge i32 %index, %5, !dbg !381
  br label %lor.end, !dbg !379

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !379
  br i1 %7, label %if.then, label %if.end, !dbg !378

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !385
  call void @nish_exit(i32 1), !dbg !385
  unreachable, !dbg !385

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !388
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !329, !dbg !388
  %10 = sext i32 %index to i64, !dbg !388
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !388
  %12 = load i64, i64* %11, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !388
  %13 = icmp ult i64 %10, %12, !dbg !388
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !388

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !388
  unreachable, !dbg !388

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !388
  %15 = load i8*, i8** %14, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !388
  %16 = bitcast i8* %15 to i32*, !dbg !388
  %17 = getelementptr inbounds i32, i32* %16, i64 %10, !dbg !388
  %18 = load i32, i32* %17, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !388
  ret i32 %18, !dbg !387
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 !dbg !392 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !394, metadata !DIExpression()), !dbg !393
  call void @llvm.dbg.value(metadata i32 %index, metadata !395, metadata !DIExpression()), !dbg !393
  call void @llvm.dbg.value(metadata i32 %value, metadata !396, metadata !DIExpression()), !dbg !393
  %0 = icmp sge i32 %index, 0, !dbg !398
  br i1 %0, label %land.rhs, label %land.end, !dbg !398

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !402
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !329, !dbg !402
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !402
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !402
  %5 = trunc i64 %4 to i32, !dbg !402
  %6 = icmp slt i32 %index, %5, !dbg !400
  br label %land.end, !dbg !398

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !398
  br i1 %7, label %if.then, label %if.end, !dbg !397

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !404
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !329, !dbg !404
  %10 = sext i32 %index to i64, !dbg !404
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !404
  %12 = load i8*, i8** %11, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !404
  %13 = bitcast i8* %12 to i32*, !dbg !404
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !404
  store i32 %value, i32* %14, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !404
  br label %if.end, !dbg !397

if.end:
  ret void, !dbg !393
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !409 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !411, metadata !DIExpression()), !dbg !410
  call void @llvm.dbg.value(metadata i64 %absent, metadata !412, metadata !DIExpression()), !dbg !410
  call void @llvm.dbg.value(metadata i8* %key, metadata !413, metadata !DIExpression()), !dbg !410
  call void @llvm.dbg.value(metadata i32 %value, metadata !414, metadata !DIExpression()), !dbg !410
  %0 = sub nsw i64 -1, %absent, !dbg !416
  store i64 %0, i64* %packed.addr, align 8, !dbg !415
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !418, metadata !DIExpression()), !dbg !415
  %1 = load i64, i64* %packed.addr, align 8, !dbg !421
  %2 = ashr i64 %1, 32, !dbg !421
  %3 = trunc i64 %2 to i32, !dbg !420
  store i32 %3, i32* %bucket.addr, align 4, !dbg !419
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !422, metadata !DIExpression()), !dbg !419
  %4 = load i64, i64* %packed.addr, align 8, !dbg !425
  %5 = trunc i64 %4 to i32, !dbg !424
  store i32 %5, i32* %h.addr, align 4, !dbg !423
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !426, metadata !DIExpression()), !dbg !423
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !429
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !326, !dbg !429
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !429
  %9 = load i64, i64* %8, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !429
  %10 = trunc i64 %9 to i32, !dbg !429
  %11 = icmp sge i32 %10, 16777215, !dbg !428
  br i1 %11, label %if.then, label %if.end, !dbg !427

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !433
  %13 = load i32, i32* %12, align 4, !tbaa !318, !dbg !433
  %14 = icmp sge i32 %13, 16777215, !dbg !433
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !433

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !435
  %16 = load i32, i32* %15, align 4, !tbaa !319, !dbg !435
  %17 = icmp sgt i32 %16, 0, !dbg !435
  br label %lor.end, !dbg !433

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ], !dbg !433
  br i1 %18, label %if.then.1, label %if.end.1, !dbg !432

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !438
  call void @nish_exit(i32 1), !dbg !438
  unreachable, !dbg !438

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !440
  store i32 -1, i32* %bucket.addr, align 4, !dbg !441
  br label %if.end, !dbg !427

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !443
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !326, !dbg !443
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !443
  %22 = load i64, i64* %21, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !443
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !443
  %24 = load i64, i64* %23, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !443
  %25 = icmp eq i64 %22, %24, !dbg !443
  br i1 %25, label %push.grow, label %push.store, !dbg !443

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8), !dbg !443
  br label %push.store, !dbg !443

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !443
  %27 = load i8*, i8** %26, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !443
  %28 = bitcast i8* %27 to i8**, !dbg !443
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22, !dbg !443
  store i8* %key, i8** %29, align 8, !alias.scope !138, !noalias !137, !tbaa !446, !dbg !443
  %30 = add i64 %22, 1, !dbg !443
  store i64 %30, i64* %21, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !443
  %31 = trunc i64 %30 to i32, !dbg !443
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !447
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !329, !dbg !447
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0, !dbg !447
  %35 = load i64, i64* %34, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !447
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1, !dbg !447
  %37 = load i64, i64* %36, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !447
  %38 = icmp eq i64 %35, %37, !dbg !447
  br i1 %38, label %push.grow.1, label %push.store.1, !dbg !447

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4), !dbg !447
  br label %push.store.1, !dbg !447

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2, !dbg !447
  %40 = load i8*, i8** %39, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !447
  %41 = bitcast i8* %40 to i32*, !dbg !447
  %42 = getelementptr inbounds i32, i32* %41, i64 %35, !dbg !447
  store i32 %value, i32* %42, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !447
  %43 = add i64 %35, 1, !dbg !447
  store i64 %43, i64* %34, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !447
  %44 = trunc i64 %43 to i32, !dbg !447
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !449
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !332, !dbg !449
  %47 = load i32, i32* %h.addr, align 4, !dbg !450
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0, !dbg !449
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !449
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1, !dbg !449
  %51 = load i64, i64* %50, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !449
  %52 = icmp eq i64 %49, %51, !dbg !449
  br i1 %52, label %push.grow.2, label %push.store.2, !dbg !449

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4), !dbg !449
  br label %push.store.2, !dbg !449

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2, !dbg !449
  %54 = load i8*, i8** %53, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !449
  %55 = bitcast i8* %54 to i32*, !dbg !449
  %56 = getelementptr inbounds i32, i32* %55, i64 %49, !dbg !449
  store i32 %47, i32* %56, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !449
  %57 = add i64 %49, 1, !dbg !449
  store i64 %57, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !449
  %58 = trunc i64 %57 to i32, !dbg !449
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !452
  %60 = load i32, i32* %59, align 4, !tbaa !318, !dbg !452
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1), !dbg !452
  %62 = extractvalue { i32, i1 } %61, 0, !dbg !452
  %63 = extractvalue { i32, i1 } %61, 1, !dbg !452
  br i1 %63, label %ovf.fail, label %ovf.ok, !dbg !452

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !451
  store i32 %62, i32* %64, align 4, !tbaa !318, !dbg !451
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !455
  %66 = load i32, i32* %65, align 4, !tbaa !316, !dbg !455
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1), !dbg !455
  %68 = extractvalue { i32, i1 } %67, 0, !dbg !455
  %69 = extractvalue { i32, i1 } %67, 1, !dbg !455
  br i1 %69, label %ovf.fail.1, label %ovf.ok.1, !dbg !455

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !454
  store i32 %68, i32* %70, align 4, !tbaa !316, !dbg !454
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !459
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !326, !dbg !459
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0, !dbg !459
  %74 = load i64, i64* %73, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !459
  %75 = trunc i64 %74 to i32, !dbg !459
  store i32 %75, i32* %used.addr, align 4, !dbg !457
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !460, metadata !DIExpression()), !dbg !457
  %76 = load i32, i32* %used.addr, align 4, !dbg !462
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4), !dbg !462
  %78 = extractvalue { i32, i1 } %77, 0, !dbg !462
  %79 = extractvalue { i32, i1 } %77, 1, !dbg !462
  br i1 %79, label %ovf.fail.2, label %ovf.ok.2, !dbg !462

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !465
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !323, !dbg !465
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0, !dbg !465
  %83 = load i64, i64* %82, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !465
  %84 = trunc i64 %83 to i32, !dbg !465
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3), !dbg !464
  %86 = extractvalue { i32, i1 } %85, 0, !dbg !464
  %87 = extractvalue { i32, i1 } %85, 1, !dbg !464
  br i1 %87, label %ovf.fail.3, label %ovf.ok.3, !dbg !464

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86, !dbg !462
  br i1 %88, label %if.then.2, label %if.else, !dbg !461

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !468
  br label %if.end.2, !dbg !461

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !471
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !323, !dbg !471
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !472
  %92 = load i32, i32* %91, align 4, !tbaa !317, !dbg !472
  %93 = load i32, i32* %bucket.addr, align 4, !dbg !473
  %94 = load i32, i32* %h.addr, align 4, !dbg !474
  %95 = load i32, i32* %used.addr, align 4, !dbg !475
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95), !dbg !470
  br label %if.end.2, !dbg !461

if.end.2:
  ret void, !dbg !410

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !452
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 0), !dbg !455
  unreachable

ovf.fail.2:
  call void @nish_panic_overflow(i32 2), !dbg !462
  unreachable

ovf.fail.3:
  call void @nish_panic_overflow(i32 2), !dbg !464
  unreachable
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !476 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !478, metadata !DIExpression()), !dbg !477
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !481
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !326, !dbg !481
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !481
  %3 = load i64, i64* %2, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !481
  %4 = trunc i64 %3 to i32, !dbg !481
  store i32 %4, i32* %used.addr, align 4, !dbg !479
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !482, metadata !DIExpression()), !dbg !479
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !484
  %6 = load i32, i32* %5, align 4, !tbaa !319, !dbg !484
  %7 = icmp sgt i32 %6, 0, !dbg !484
  store i1 %7, i1* %walking.addr, align 1, !dbg !483
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !487, metadata !DIExpression()), !dbg !483
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !490
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !323, !dbg !490
  %10 = load i1, i1* %walking.addr, align 1, !dbg !491
  br i1 %10, label %cond.true, label %cond.false, !dbg !491

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !492
  br label %cond.end, !dbg !491

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !493
  %13 = load i32, i32* %12, align 4, !tbaa !318, !dbg !493
  br label %cond.end, !dbg !491

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !491
  %15 = load i32, i32* %used.addr, align 4, !dbg !494
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !489
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !488
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !495, metadata !DIExpression()), !dbg !488
  %17 = load i1, i1* %walking.addr, align 1, !dbg !498
  %18 = xor i1 %17, true, !dbg !497
  br i1 %18, label %land.rhs, label %land.end, !dbg !497

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !499
  %20 = load i32, i32* %19, align 4, !tbaa !318, !dbg !499
  %21 = load i32, i32* %used.addr, align 4, !dbg !500
  %22 = icmp slt i32 %20, %21, !dbg !499
  br label %land.end, !dbg !497

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !497
  br i1 %23, label %if.then, label %if.end, !dbg !496

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !503
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !326, !dbg !503
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !504
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !332, !dbg !504
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !502
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !506
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !329, !dbg !506
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !507
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !332, !dbg !507
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !505
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !509
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !332, !dbg !509
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !508
  br label %if.end, !dbg !496

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !511
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !510
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !323, !dbg !510
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !514
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !514
  %38 = load i64, i64* %37, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !514
  %39 = trunc i64 %38 to i32, !dbg !514
  %40 = sub nsw i32 %39, 1, !dbg !513
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !512
  store i32 %40, i32* %41, align 4, !tbaa !317, !dbg !512
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !517
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !518
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !332, !dbg !518
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !516
  ret void, !dbg !477
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !521 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !523, metadata !DIExpression()), !dbg !522
  call void @llvm.dbg.value(metadata i32 %mask, metadata !524, metadata !DIExpression()), !dbg !522
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !525, metadata !DIExpression()), !dbg !522
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !526, metadata !DIExpression()), !dbg !522
  call void @llvm.dbg.value(metadata i8* %key, metadata !527, metadata !DIExpression()), !dbg !522
  %0 = bitcast i8* %key to i64*, !dbg !529
  %1 = load i64, i64* %0, align 8, !dbg !529
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !529
  store i64 0, i64* %hash.i, align 8, !dbg !529
  store i32 -2128831035, i32* %hash.h, align 4, !dbg !529
  br label %hash.test, !dbg !529

hash.test:
  %3 = load i64, i64* %hash.i, align 8, !dbg !529
  %4 = icmp ult i64 %3, %1, !dbg !529
  br i1 %4, label %hash.byte, label %hash.done, !dbg !529

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3, !dbg !529
  %6 = load i8, i8* %5, !dbg !529
  %7 = zext i8 %6 to i32, !dbg !529
  %8 = load i32, i32* %hash.h, align 4, !dbg !529
  %9 = xor i32 %8, %7, !dbg !529
  %10 = mul i32 %9, 16777619, !dbg !529
  store i32 %10, i32* %hash.h, align 4, !dbg !529
  %11 = add i64 %3, 1, !dbg !529
  store i64 %11, i64* %hash.i, align 8, !dbg !529
  br label %hash.test, !dbg !529

hash.done:
  %12 = load i32, i32* %hash.h, align 4, !dbg !529
  %13 = icmp eq i32 %12, 0, !dbg !529
  %14 = select i1 %13, i32 1, i32 %12, !dbg !529
  store i32 %14, i32* %h.addr, align 4, !dbg !528
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !531, metadata !DIExpression()), !dbg !528
  %15 = load i32, i32* %h.addr, align 4, !dbg !533
  %16 = lshr i32 %15, 24, !dbg !533
  store i32 %16, i32* %fingerprint.addr, align 4, !dbg !532
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !534, metadata !DIExpression()), !dbg !532
  %17 = load i32, i32* %h.addr, align 4, !dbg !537
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask), !dbg !536
  store i32 %18, i32* %bucket.addr, align 4, !dbg !535
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !539, metadata !DIExpression()), !dbg !535
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !540
  %20 = load i64, i64* %19, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !540
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !540
  %22 = load i8*, i8** %21, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !540
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !540
  %24 = load i64, i64* %23, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !540
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !540
  %26 = load i8*, i8** %25, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !540
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !540
  %28 = load i64, i64* %27, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !540
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !540
  %30 = load i8*, i8** %29, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !540
  br label %while.cond, !dbg !540

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4, !dbg !544
  %32 = icmp sge i32 %31, 0, !dbg !544
  br i1 %32, label %land.rhs, label %land.end, !dbg !544

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4, !dbg !546
  %34 = trunc i64 %20 to i32, !dbg !541
  %35 = icmp slt i32 %33, %34, !dbg !546
  br label %land.end, !dbg !544

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ], !dbg !544
  br i1 %36, label %while.body, label %while.end, !dbg !540

while.body:
  %37 = load i32, i32* %bucket.addr, align 4, !dbg !551
  %38 = sext i32 %37 to i64, !dbg !550
  %39 = bitcast i8* %22 to i32*, !dbg !550
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !550
  %41 = load i32, i32* %40, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !550
  store i32 %41, i32* %word.addr, align 4, !dbg !549
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !552, metadata !DIExpression()), !dbg !549
  %42 = load i32, i32* %word.addr, align 4, !dbg !554
  %43 = icmp eq i32 %42, 0, !dbg !554
  br i1 %43, label %if.then, label %if.end, !dbg !553

if.then:
  %44 = load i32, i32* %bucket.addr, align 4, !dbg !559
  %45 = load i32, i32* %h.addr, align 4, !dbg !560
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45), !dbg !558
  ret i64 %46, !dbg !557

if.end:
  %47 = load i32, i32* %word.addr, align 4, !dbg !562
  %48 = lshr i32 %47, 24, !dbg !562
  %49 = load i32, i32* %fingerprint.addr, align 4, !dbg !563
  %50 = icmp eq i32 %48, %49, !dbg !562
  br i1 %50, label %if.then.1, label %if.end.1, !dbg !561

if.then.1:
  %51 = load i32, i32* %word.addr, align 4, !dbg !567
  %52 = and i32 %51, 16777215, !dbg !567
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1), !dbg !566
  %54 = extractvalue { i32, i1 } %53, 0, !dbg !566
  %55 = extractvalue { i32, i1 } %53, 1, !dbg !566
  br i1 %55, label %ovf.fail, label %ovf.ok, !dbg !566

ovf.ok:
  store i32 %54, i32* %at.addr, align 4, !dbg !565
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !570, metadata !DIExpression()), !dbg !565
  %56 = load i32, i32* %at.addr, align 4, !dbg !572
  %57 = icmp sge i32 %56, 0, !dbg !572
  br i1 %57, label %land.rhs.4, label %land.end.4, !dbg !572

land.rhs.4:
  %58 = load i32, i32* %at.addr, align 4, !dbg !574
  %59 = trunc i64 %24 to i32, !dbg !542
  %60 = icmp slt i32 %58, %59, !dbg !574
  br label %land.end.4, !dbg !572

land.end.4:
  %61 = phi i1 [ false, %ovf.ok ], [ %60, %land.rhs.4 ], !dbg !572
  br i1 %61, label %land.rhs.3, label %land.end.3, !dbg !572

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4, !dbg !577
  %63 = sext i32 %62 to i64, !dbg !576
  %64 = bitcast i8* %26 to i32*, !dbg !576
  %65 = getelementptr inbounds i32, i32* %64, i64 %63, !dbg !576
  %66 = load i32, i32* %65, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !576
  %67 = load i32, i32* %h.addr, align 4, !dbg !578
  %68 = icmp eq i32 %66, %67, !dbg !576
  br label %land.end.3, !dbg !572

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ], !dbg !572
  br i1 %69, label %land.rhs.2, label %land.end.2, !dbg !572

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4, !dbg !579
  %71 = trunc i64 %28 to i32, !dbg !543
  %72 = icmp slt i32 %70, %71, !dbg !579
  br label %land.end.2, !dbg !572

land.end.2:
  %73 = phi i1 [ false, %land.end.3 ], [ %72, %land.rhs.2 ], !dbg !572
  br i1 %73, label %land.rhs.1, label %land.end.1, !dbg !572

land.rhs.1:
  %74 = load i32, i32* %at.addr, align 4, !dbg !583
  %75 = sext i32 %74 to i64, !dbg !582
  %76 = bitcast i8* %30 to i8**, !dbg !582
  %77 = getelementptr inbounds i8*, i8** %76, i64 %75, !dbg !582
  %78 = load i8*, i8** %77, align 8, !alias.scope !138, !noalias !137, !tbaa !446, !dbg !582
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* %key), !dbg !581
  br label %land.end.1, !dbg !572

land.end.1:
  %80 = phi i1 [ false, %land.end.2 ], [ %79, %land.rhs.1 ], !dbg !572
  br i1 %80, label %if.then.2, label %if.end.2, !dbg !571

if.then.2:
  %81 = load i32, i32* %bucket.addr, align 4, !dbg !588
  %82 = load i32, i32* %at.addr, align 4, !dbg !589
  %83 = tail call i64 @nish.foundAt(i32 %81, i32 %82), !dbg !587
  ret i64 %83, !dbg !586

if.end.2:
  br label %if.end.1, !dbg !561

if.end.1:
  %84 = load i32, i32* %bucket.addr, align 4, !dbg !592
  %85 = add nsw i32 %84, 1, !dbg !592
  %86 = and i32 %85, %mask, !dbg !591
  store i32 %86, i32* %bucket.addr, align 4, !dbg !590
  br label %while.cond, !dbg !540

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !595
  call void @nish_exit(i32 1), !dbg !595
  unreachable, !dbg !595

ovf.fail:
  call void @nish_panic_overflow(i32 1), !dbg !566
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !599 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !601, metadata !DIExpression()), !dbg !600
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !602, metadata !DIExpression()), !dbg !600
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !605
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !605
  %2 = trunc i64 %1 to i32, !dbg !605
  store i32 %2, i32* %used.addr, align 4, !dbg !603
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !606, metadata !DIExpression()), !dbg !603
  store i32 0, i32* %to.addr, align 4, !dbg !607
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !609, metadata !DIExpression()), !dbg !607
  store i32 0, i32* %from.addr, align 4, !dbg !610
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !612, metadata !DIExpression()), !dbg !610
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !610
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !610
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !610
  %6 = load i8*, i8** %5, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !610
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !610
  %8 = load i64, i64* %7, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !610
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !610
  %10 = load i8*, i8** %9, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !610
  br label %for.cond, !dbg !610

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !615
  %12 = load i32, i32* %used.addr, align 4, !dbg !616
  %13 = icmp slt i32 %11, %12, !dbg !615
  br i1 %13, label %land.rhs, label %land.end, !dbg !615

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !617
  %15 = trunc i64 %4 to i32, !dbg !613
  %16 = icmp slt i32 %14, %15, !dbg !617
  br label %land.end, !dbg !615

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !615
  br i1 %17, label %for.body, label %for.end, !dbg !610

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !622
  %19 = sext i32 %18 to i64, !dbg !621
  %20 = bitcast i8* %6 to i32*, !dbg !621
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !621
  %22 = load i32, i32* %21, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !621
  %23 = icmp ne i32 %22, 0, !dbg !621
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !621

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !624
  %25 = icmp sge i32 %24, 0, !dbg !624
  br label %land.end.3, !dbg !621

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !621
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !621

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !626
  %28 = load i32, i32* %used.addr, align 4, !dbg !627
  %29 = icmp slt i32 %27, %28, !dbg !626
  br label %land.end.2, !dbg !621

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !621
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !621

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !628
  %32 = trunc i64 %8 to i32, !dbg !614
  %33 = icmp slt i32 %31, %32, !dbg !628
  br label %land.end.1, !dbg !621

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !621
  br i1 %34, label %if.then, label %if.end, !dbg !620

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !632
  %36 = sext i32 %35 to i64, !dbg !631
  %37 = load i32, i32* %from.addr, align 4, !dbg !634
  %38 = sext i32 %37 to i64, !dbg !633
  %39 = bitcast i8* %10 to i8**, !dbg !633
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !633
  %41 = load i8*, i8** %40, align 8, !alias.scope !138, !noalias !137, !tbaa !446, !dbg !633
  %42 = bitcast i8* %10 to i8**, !dbg !631
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !631
  store i8* %41, i8** %43, align 8, !alias.scope !138, !noalias !137, !tbaa !446, !dbg !631
  %44 = load i32, i32* %to.addr, align 4, !dbg !635
  %45 = add nsw i32 %44, 1, !dbg !635
  store i32 %45, i32* %to.addr, align 4, !dbg !635
  br label %if.end, !dbg !620

if.end:
  br label %for.inc, !dbg !610

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !636
  %47 = add nsw i32 %46, 1, !dbg !636
  store i32 %47, i32* %from.addr, align 4, !dbg !636
  br label %for.cond, !dbg !610

for.end:
  br label %while.cond, !dbg !637

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !639
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !639
  %50 = trunc i64 %49 to i32, !dbg !639
  %51 = load i32, i32* %to.addr, align 4, !dbg !640
  %52 = icmp sgt i32 %50, %51, !dbg !638
  br i1 %52, label %while.body, label %while.end, !dbg !637

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !642
  %54 = load i64, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !642
  %55 = icmp eq i64 %54, 0, !dbg !642
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !642

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !642
  unreachable, !dbg !642

pop.ok:
  %56 = sub i64 %54, 1, !dbg !642
  store i64 %56, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !642
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !642
  %58 = load i8*, i8** %57, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !642
  %59 = bitcast i8* %58 to i8**, !dbg !642
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56, !dbg !642
  %61 = load i8*, i8** %60, align 8, !alias.scope !138, !noalias !137, !tbaa !446, !dbg !642
  br label %while.cond, !dbg !637

while.end:
  ret void, !dbg !600
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !645 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !647, metadata !DIExpression()), !dbg !646
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !648, metadata !DIExpression()), !dbg !646
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !651
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !651
  %2 = trunc i64 %1 to i32, !dbg !651
  store i32 %2, i32* %used.addr, align 4, !dbg !649
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !652, metadata !DIExpression()), !dbg !649
  store i32 0, i32* %to.addr, align 4, !dbg !653
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !655, metadata !DIExpression()), !dbg !653
  store i32 0, i32* %from.addr, align 4, !dbg !656
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !658, metadata !DIExpression()), !dbg !656
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !656
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !656
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !656
  %6 = load i8*, i8** %5, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !656
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !656
  %8 = load i64, i64* %7, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !656
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !656
  %10 = load i8*, i8** %9, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !656
  br label %for.cond, !dbg !656

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !661
  %12 = load i32, i32* %used.addr, align 4, !dbg !662
  %13 = icmp slt i32 %11, %12, !dbg !661
  br i1 %13, label %land.rhs, label %land.end, !dbg !661

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !663
  %15 = trunc i64 %4 to i32, !dbg !659
  %16 = icmp slt i32 %14, %15, !dbg !663
  br label %land.end, !dbg !661

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !661
  br i1 %17, label %for.body, label %for.end, !dbg !656

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !668
  %19 = sext i32 %18 to i64, !dbg !667
  %20 = bitcast i8* %6 to i32*, !dbg !667
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !667
  %22 = load i32, i32* %21, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !667
  %23 = icmp ne i32 %22, 0, !dbg !667
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !667

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !670
  %25 = icmp sge i32 %24, 0, !dbg !670
  br label %land.end.3, !dbg !667

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !667
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !667

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !672
  %28 = load i32, i32* %used.addr, align 4, !dbg !673
  %29 = icmp slt i32 %27, %28, !dbg !672
  br label %land.end.2, !dbg !667

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !667
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !667

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !674
  %32 = trunc i64 %8 to i32, !dbg !660
  %33 = icmp slt i32 %31, %32, !dbg !674
  br label %land.end.1, !dbg !667

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !667
  br i1 %34, label %if.then, label %if.end, !dbg !666

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !678
  %36 = sext i32 %35 to i64, !dbg !677
  %37 = load i32, i32* %from.addr, align 4, !dbg !680
  %38 = sext i32 %37 to i64, !dbg !679
  %39 = bitcast i8* %10 to i32*, !dbg !679
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !679
  %41 = load i32, i32* %40, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !679
  %42 = bitcast i8* %10 to i32*, !dbg !677
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !677
  store i32 %41, i32* %43, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !677
  %44 = load i32, i32* %to.addr, align 4, !dbg !681
  %45 = add nsw i32 %44, 1, !dbg !681
  store i32 %45, i32* %to.addr, align 4, !dbg !681
  br label %if.end, !dbg !666

if.end:
  br label %for.inc, !dbg !656

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !682
  %47 = add nsw i32 %46, 1, !dbg !682
  store i32 %47, i32* %from.addr, align 4, !dbg !682
  br label %for.cond, !dbg !656

for.end:
  br label %while.cond, !dbg !683

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !685
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !685
  %50 = trunc i64 %49 to i32, !dbg !685
  %51 = load i32, i32* %to.addr, align 4, !dbg !686
  %52 = icmp sgt i32 %50, %51, !dbg !684
  br i1 %52, label %while.body, label %while.end, !dbg !683

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !688
  %54 = load i64, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !688
  %55 = icmp eq i64 %54, 0, !dbg !688
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !688

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !688
  unreachable, !dbg !688

pop.ok:
  %56 = sub i64 %54, 1, !dbg !688
  store i64 %56, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !688
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !688
  %58 = load i8*, i8** %57, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !688
  %59 = bitcast i8* %58 to i32*, !dbg !688
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !688
  %61 = load i32, i32* %60, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !688
  br label %while.cond, !dbg !683

while.end:
  ret void, !dbg !646
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
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
!68 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 78, type: !67, scopeLine: 78, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!69 = !DILocation(line: 78, column: 1, scope: !68)
!70 = !DILocalVariable(name: "h", arg: 1, scope: !68, file: !13, line: 78, type: !19)
!71 = !DILocalVariable(name: "mask", arg: 2, scope: !68, file: !13, line: 78, type: !4)
!72 = !DILocation(line: 78, column: 48, scope: !68)
!73 = !DILocation(line: 78, column: 54, scope: !68)
!74 = !DILocation(line: 78, column: 58, scope: !68)
!75 = !DILocation(line: 78, column: 59, scope: !68)
!76 = !DILocation(line: 78, column: 72, scope: !68)
!77 = !{!19, !19, !4}
!78 = !DISubroutineType(types: !77)
!79 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 81, type: !78, scopeLine: 81, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!80 = !DILocation(line: 81, column: 1, scope: !79)
!81 = !DILocalVariable(name: "h", arg: 1, scope: !79, file: !13, line: 81, type: !19)
!82 = !DILocalVariable(name: "index", arg: 2, scope: !79, file: !13, line: 81, type: !4)
!83 = !DILocation(line: 81, column: 47, scope: !79)
!84 = !DILocation(line: 81, column: 48, scope: !79)
!85 = !DILocation(line: 81, column: 49, scope: !79)
!86 = !DILocation(line: 81, column: 68, scope: !79)
!87 = !DILocation(line: 81, column: 74, scope: !79)
!88 = !DILocation(line: 81, column: 82, scope: !79)
!89 = !{!16, !4, !4}
!90 = !DISubroutineType(types: !89)
!91 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 84, type: !90, scopeLine: 84, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!92 = !DILocation(line: 84, column: 1, scope: !91)
!93 = !DILocalVariable(name: "bucket", arg: 1, scope: !91, file: !13, line: 84, type: !4)
!94 = !DILocalVariable(name: "index", arg: 2, scope: !91, file: !13, line: 84, type: !4)
!95 = !DILocation(line: 84, column: 51, scope: !91)
!96 = !DILocation(line: 84, column: 52, scope: !91)
!97 = !DILocation(line: 84, column: 58, scope: !91)
!98 = !DILocation(line: 84, column: 75, scope: !91)
!99 = !DILocation(line: 84, column: 81, scope: !91)
!100 = !{!16, !4, !19}
!101 = !DISubroutineType(types: !100)
!102 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 87, type: !101, scopeLine: 87, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!103 = !DILocation(line: 87, column: 1, scope: !102)
!104 = !DILocalVariable(name: "bucket", arg: 1, scope: !102, file: !13, line: 87, type: !4)
!105 = !DILocalVariable(name: "h", arg: 2, scope: !102, file: !13, line: 87, type: !19)
!106 = !DILocation(line: 87, column: 48, scope: !102)
!107 = !DILocation(line: 87, column: 54, scope: !102)
!108 = !DILocation(line: 87, column: 60, scope: !102)
!109 = !DILocation(line: 87, column: 61, scope: !102)
!110 = !DILocation(line: 87, column: 62, scope: !102)
!111 = !DILocation(line: 87, column: 68, scope: !102)
!112 = !DILocation(line: 87, column: 85, scope: !102)
!113 = !DILocation(line: 87, column: 91, scope: !102)
!114 = !{null, !23, !4, !19, !4}
!115 = !DISubroutineType(types: !114)
!116 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 129, type: !115, scopeLine: 129, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!117 = !DILocation(line: 129, column: 1, scope: !116)
!118 = !DILocalVariable(name: "slots", arg: 1, scope: !116, file: !13, line: 129, type: !23)
!119 = !DILocalVariable(name: "mask", arg: 2, scope: !116, file: !13, line: 129, type: !4)
!120 = !DILocalVariable(name: "h", arg: 3, scope: !116, file: !13, line: 129, type: !19)
!121 = !DILocalVariable(name: "index", arg: 4, scope: !116, file: !13, line: 129, type: !4)
!122 = !DILocation(line: 130, column: 3, scope: !116)
!123 = !DILocation(line: 130, column: 16, scope: !116)
!124 = !DILocation(line: 130, column: 25, scope: !116)
!125 = !DILocation(line: 130, column: 28, scope: !116)
!126 = !DILocalVariable(name: "word", scope: !116, file: !13, line: 130, type: !19)
!127 = !DILocation(line: 131, column: 3, scope: !116)
!128 = !DILocation(line: 131, column: 16, scope: !116)
!129 = !DILocation(line: 131, column: 27, scope: !116)
!130 = !DILocation(line: 131, column: 30, scope: !116)
!131 = !DILocalVariable(name: "bucket", scope: !116, file: !13, line: 131, type: !4)
!132 = !DILocation(line: 132, column: 3, scope: !116)
!133 = !DILocation(line: 132, column: 40, scope: !116)
!134 = !{!"nish array"}
!135 = !{!"header", !134}
!136 = !{!"elements", !134}
!137 = !{!135}
!138 = !{!136}
!139 = !{!"nish TBAA"}
!140 = !{!"omnipotent char", !139, i64 0}
!141 = !{!"header i64", !140, i64 0}
!142 = !{!"header ptr", !140, i64 0}
!143 = !{!"array header", !141, i64 0, !141, i64 8, !142, i64 16}
!144 = !{!143, !141, i64 0}
!145 = !{!143, !142, i64 16}
!146 = !DILocation(line: 132, column: 10, scope: !116)
!147 = !DILocation(line: 132, column: 20, scope: !116)
!148 = !DILocation(line: 132, column: 25, scope: !116)
!149 = !DILocation(line: 132, column: 34, scope: !116)
!150 = !DILocation(line: 132, column: 55, scope: !116)
!151 = !DILocation(line: 133, column: 5, scope: !116)
!152 = !DILocation(line: 133, column: 9, scope: !116)
!153 = !DILocation(line: 133, column: 15, scope: !116)
!154 = !{!"element i32", !140, i64 0}
!155 = !{!154, !154, i64 0}
!156 = !DILocation(line: 133, column: 27, scope: !116)
!157 = !DILocation(line: 133, column: 30, scope: !116)
!158 = !DILocation(line: 134, column: 7, scope: !116)
!159 = !DILocation(line: 134, column: 13, scope: !116)
!160 = !DILocation(line: 134, column: 23, scope: !116)
!161 = !DILocation(line: 135, column: 7, scope: !116)
!162 = !DILocation(line: 137, column: 5, scope: !116)
!163 = !DILocation(line: 137, column: 14, scope: !116)
!164 = !DILocation(line: 137, column: 15, scope: !116)
!165 = !DILocation(line: 137, column: 24, scope: !116)
!166 = !DILocation(line: 137, column: 29, scope: !116)
!167 = !{null, !23}
!168 = !DISubroutineType(types: !167)
!169 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 157, type: !168, scopeLine: 157, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!170 = !DILocation(line: 157, column: 1, scope: !169)
!171 = !DILocalVariable(name: "hashes", arg: 1, scope: !169, file: !13, line: 157, type: !23)
!172 = !DILocation(line: 158, column: 3, scope: !169)
!173 = !DILocation(line: 158, column: 16, scope: !169)
!174 = !DILocation(line: 158, column: 22, scope: !169)
!175 = !DILocalVariable(name: "used", scope: !169, file: !13, line: 158, type: !4)
!176 = !DILocation(line: 159, column: 3, scope: !169)
!177 = !DILocation(line: 159, column: 17, scope: !169)
!178 = !DILocalVariable(name: "to", scope: !169, file: !13, line: 159, type: !4)
!179 = !DILocation(line: 160, column: 3, scope: !169)
!180 = !DILocation(line: 160, column: 24, scope: !169)
!181 = !DILocalVariable(name: "from", scope: !169, file: !13, line: 160, type: !4)
!182 = !DILocation(line: 161, column: 15, scope: !169)
!183 = !DILocation(line: 160, column: 27, scope: !169)
!184 = !DILocation(line: 160, column: 34, scope: !169)
!185 = !DILocation(line: 160, column: 48, scope: !169)
!186 = !DILocation(line: 161, column: 5, scope: !169)
!187 = !DILocation(line: 161, column: 22, scope: !169)
!188 = !DILocalVariable(name: "h", scope: !169, file: !13, line: 161, type: !19)
!189 = !DILocation(line: 162, column: 5, scope: !169)
!190 = !DILocation(line: 162, column: 9, scope: !169)
!191 = !DILocation(line: 162, column: 15, scope: !169)
!192 = !DILocation(line: 162, column: 20, scope: !169)
!193 = !DILocation(line: 162, column: 26, scope: !169)
!194 = !DILocation(line: 162, column: 31, scope: !169)
!195 = !DILocation(line: 162, column: 36, scope: !169)
!196 = !DILocation(line: 162, column: 42, scope: !169)
!197 = !DILocation(line: 163, column: 7, scope: !169)
!198 = !DILocation(line: 163, column: 14, scope: !169)
!199 = !DILocation(line: 163, column: 20, scope: !169)
!200 = !DILocation(line: 164, column: 7, scope: !169)
!201 = !DILocation(line: 160, column: 40, scope: !169)
!202 = !DILocation(line: 167, column: 3, scope: !169)
!203 = !DILocation(line: 167, column: 10, scope: !169)
!204 = !DILocation(line: 167, column: 16, scope: !169)
!205 = !DILocation(line: 167, column: 33, scope: !169)
!206 = !DILocation(line: 167, column: 37, scope: !169)
!207 = !DILocation(line: 168, column: 5, scope: !169)
!208 = !{!23, !23, !4, !4}
!209 = !DISubroutineType(types: !208)
!210 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 179, type: !209, scopeLine: 179, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!211 = !DILocation(line: 179, column: 1, scope: !210)
!212 = !DILocalVariable(name: "slots", arg: 1, scope: !210, file: !13, line: 179, type: !23)
!213 = !DILocalVariable(name: "live", arg: 2, scope: !210, file: !13, line: 179, type: !4)
!214 = !DILocalVariable(name: "used", arg: 3, scope: !210, file: !13, line: 179, type: !4)
!215 = !DILocation(line: 180, column: 3, scope: !210)
!216 = !DILocation(line: 180, column: 13, scope: !210)
!217 = !DILocation(line: 180, column: 19, scope: !210)
!218 = !DILocalVariable(name: "n", scope: !210, file: !13, line: 180, type: !4)
!219 = !DILocation(line: 181, column: 3, scope: !210)
!220 = !DILocation(line: 181, column: 7, scope: !210)
!221 = !DILocation(line: 181, column: 14, scope: !210)
!222 = !DILocation(line: 181, column: 18, scope: !210)
!223 = !DILocation(line: 181, column: 24, scope: !210)
!224 = !DILocation(line: 182, column: 5, scope: !210)
!225 = !DILocation(line: 182, column: 16, scope: !210)
!226 = !DILocation(line: 183, column: 5, scope: !210)
!227 = !DILocation(line: 183, column: 12, scope: !210)
!228 = !DILocation(line: 185, column: 3, scope: !210)
!229 = !DILocation(line: 185, column: 10, scope: !210)
!230 = !DILocation(line: 185, column: 25, scope: !210)
!231 = !DILocation(line: 185, column: 29, scope: !210)
!232 = !{!143, !141, i64 8}
!233 = !{null, !23, !23}
!234 = !DISubroutineType(types: !233)
!235 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 193, type: !234, scopeLine: 193, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!236 = !DILocation(line: 193, column: 1, scope: !235)
!237 = !DILocalVariable(name: "slots", arg: 1, scope: !235, file: !13, line: 193, type: !23)
!238 = !DILocalVariable(name: "hashes", arg: 2, scope: !235, file: !13, line: 193, type: !23)
!239 = !DILocation(line: 194, column: 3, scope: !235)
!240 = !DILocation(line: 194, column: 16, scope: !235)
!241 = !DILocation(line: 194, column: 22, scope: !235)
!242 = !DILocation(line: 194, column: 38, scope: !235)
!243 = !DILocalVariable(name: "mask", scope: !235, file: !13, line: 194, type: !4)
!244 = !DILocation(line: 195, column: 3, scope: !235)
!245 = !DILocation(line: 195, column: 21, scope: !235)
!246 = !DILocalVariable(name: "i", scope: !235, file: !13, line: 195, type: !4)
!247 = !DILocation(line: 195, column: 34, scope: !235)
!248 = !DILocation(line: 195, column: 24, scope: !235)
!249 = !DILocation(line: 195, column: 28, scope: !235)
!250 = !DILocation(line: 195, column: 55, scope: !235)
!251 = !DILocation(line: 196, column: 5, scope: !235)
!252 = !DILocation(line: 196, column: 15, scope: !235)
!253 = !DILocation(line: 196, column: 22, scope: !235)
!254 = !DILocalVariable(name: "h", scope: !235, file: !13, line: 196, type: !19)
!255 = !DILocation(line: 197, column: 5, scope: !235)
!256 = !DILocation(line: 197, column: 9, scope: !235)
!257 = !DILocation(line: 197, column: 15, scope: !235)
!258 = !DILocation(line: 197, column: 18, scope: !235)
!259 = !DILocation(line: 198, column: 7, scope: !235)
!260 = !DILocation(line: 198, column: 17, scope: !235)
!261 = !DILocation(line: 198, column: 24, scope: !235)
!262 = !DILocation(line: 198, column: 30, scope: !235)
!263 = !DILocation(line: 198, column: 33, scope: !235)
!264 = !DILocation(line: 195, column: 50, scope: !235)
!265 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 224, type: !168, scopeLine: 224, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!266 = !DILocation(line: 224, column: 1, scope: !265)
!267 = !DILocalVariable(name: "slots", arg: 1, scope: !265, file: !13, line: 224, type: !23)
!268 = !DILocation(line: 225, column: 3, scope: !265)
!269 = !DILocation(line: 225, column: 21, scope: !265)
!270 = !DILocalVariable(name: "i", scope: !265, file: !13, line: 225, type: !4)
!271 = !DILocation(line: 225, column: 34, scope: !265)
!272 = !DILocation(line: 225, column: 24, scope: !265)
!273 = !DILocation(line: 225, column: 28, scope: !265)
!274 = !DILocation(line: 225, column: 54, scope: !265)
!275 = !DILocation(line: 226, column: 5, scope: !265)
!276 = !DILocation(line: 226, column: 11, scope: !265)
!277 = !DILocation(line: 226, column: 16, scope: !265)
!278 = !DILocation(line: 225, column: 49, scope: !265)
!279 = !{null, !23, !4, !4, !19, !4}
!280 = !DISubroutineType(types: !279)
!281 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 258, type: !280, scopeLine: 258, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!282 = !DILocation(line: 258, column: 1, scope: !281)
!283 = !DILocalVariable(name: "slots", arg: 1, scope: !281, file: !13, line: 258, type: !23)
!284 = !DILocalVariable(name: "mask", arg: 2, scope: !281, file: !13, line: 258, type: !4)
!285 = !DILocalVariable(name: "bucket", arg: 3, scope: !281, file: !13, line: 258, type: !4)
!286 = !DILocalVariable(name: "h", arg: 4, scope: !281, file: !13, line: 258, type: !19)
!287 = !DILocalVariable(name: "used", arg: 5, scope: !281, file: !13, line: 258, type: !4)
!288 = !DILocation(line: 259, column: 3, scope: !281)
!289 = !DILocation(line: 259, column: 7, scope: !281)
!290 = !DILocation(line: 259, column: 17, scope: !281)
!291 = !DILocation(line: 259, column: 22, scope: !281)
!292 = !DILocation(line: 259, column: 31, scope: !281)
!293 = !DILocation(line: 259, column: 37, scope: !281)
!294 = !DILocation(line: 259, column: 52, scope: !281)
!295 = !DILocation(line: 260, column: 5, scope: !281)
!296 = !DILocation(line: 260, column: 11, scope: !281)
!297 = !DILocation(line: 260, column: 21, scope: !281)
!298 = !DILocation(line: 260, column: 30, scope: !281)
!299 = !DILocation(line: 260, column: 33, scope: !281)
!300 = !DILocation(line: 260, column: 40, scope: !281)
!301 = !DILocation(line: 261, column: 10, scope: !281)
!302 = !DILocation(line: 262, column: 5, scope: !281)
!303 = !DILocation(line: 262, column: 15, scope: !281)
!304 = !DILocation(line: 262, column: 22, scope: !281)
!305 = !DILocation(line: 262, column: 28, scope: !281)
!306 = !DILocation(line: 262, column: 31, scope: !281)
!307 = !DILocation(line: 262, column: 38, scope: !281)
!308 = !{null, !12}
!309 = !DISubroutineType(types: !308)
!310 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 292, type: !309, scopeLine: 292, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!311 = !DILocation(line: 292, column: 3, scope: !310)
!312 = !DILocalVariable(name: "this", arg: 1, scope: !310, file: !13, line: 292, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!313 = !{!"i32", !140, i64 0}
!314 = !{!"ptr", !140, i64 0}
!315 = !{!"Map$str$i32", !313, i64 0, !314, i64 8, !313, i64 16, !313, i64 20, !314, i64 24, !314, i64 32, !314, i64 40, !313, i64 48}
!316 = !{!315, !313, i64 0}
!317 = !{!315, !313, i64 16}
!318 = !{!315, !313, i64 20}
!319 = !{!315, !313, i64 48}
!320 = !DILocation(line: 293, column: 5, scope: !310)
!321 = !DILocation(line: 293, column: 18, scope: !310)
!322 = !DILocation(line: 293, column: 33, scope: !310)
!323 = !{!315, !314, i64 8}
!324 = !DILocation(line: 294, column: 5, scope: !310)
!325 = !DILocation(line: 294, column: 22, scope: !310)
!326 = !{!315, !314, i64 24}
!327 = !DILocation(line: 295, column: 5, scope: !310)
!328 = !DILocation(line: 295, column: 24, scope: !310)
!329 = !{!315, !314, i64 32}
!330 = !DILocation(line: 296, column: 5, scope: !310)
!331 = !DILocation(line: 296, column: 24, scope: !310)
!332 = !{!315, !314, i64 40}
!333 = !{!16, !12, !31}
!334 = !DISubroutineType(types: !333)
!335 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 300, type: !334, scopeLine: 300, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!336 = !DILocation(line: 300, column: 3, scope: !335)
!337 = !DILocalVariable(name: "this", arg: 1, scope: !335, file: !13, line: 300, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!338 = !DILocalVariable(name: "key", arg: 2, scope: !335, file: !13, line: 300, type: !31)
!339 = !DILocation(line: 301, column: 5, scope: !335)
!340 = !DILocation(line: 301, column: 12, scope: !335)
!341 = !DILocation(line: 301, column: 23, scope: !335)
!342 = !DILocation(line: 301, column: 35, scope: !335)
!343 = !DILocation(line: 301, column: 46, scope: !335)
!344 = !DILocation(line: 301, column: 64, scope: !335)
!345 = !DILocation(line: 301, column: 80, scope: !335)
!346 = !{!12, !12, !31, !4}
!347 = !DISubroutineType(types: !346)
!348 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 309, type: !347, scopeLine: 309, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!349 = !DILocation(line: 309, column: 3, scope: !348)
!350 = !DILocalVariable(name: "this", arg: 1, scope: !348, file: !13, line: 309, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!351 = !DILocalVariable(name: "key", arg: 2, scope: !348, file: !13, line: 309, type: !31)
!352 = !DILocalVariable(name: "value", arg: 3, scope: !348, file: !13, line: 309, type: !4)
!353 = !DILocation(line: 310, column: 5, scope: !348)
!354 = !DILocation(line: 310, column: 19, scope: !348)
!355 = !DILocation(line: 310, column: 30, scope: !348)
!356 = !DILocalVariable(name: "found", scope: !348, file: !13, line: 310, type: !16)
!357 = !DILocation(line: 311, column: 5, scope: !348)
!358 = !DILocation(line: 311, column: 9, scope: !348)
!359 = !DILocation(line: 311, column: 18, scope: !348)
!360 = !DILocation(line: 311, column: 21, scope: !348)
!361 = !DILocation(line: 312, column: 7, scope: !348)
!362 = !DILocation(line: 312, column: 23, scope: !348)
!363 = !DILocation(line: 312, column: 29, scope: !348)
!364 = !DILocation(line: 312, column: 37, scope: !348)
!365 = !DILocation(line: 313, column: 12, scope: !348)
!366 = !DILocation(line: 314, column: 7, scope: !348)
!367 = !DILocation(line: 314, column: 21, scope: !348)
!368 = !DILocation(line: 314, column: 28, scope: !348)
!369 = !DILocation(line: 314, column: 33, scope: !348)
!370 = !DILocation(line: 316, column: 5, scope: !348)
!371 = !DILocation(line: 316, column: 12, scope: !348)
!372 = !{!4, !12, !4}
!373 = !DISubroutineType(types: !372)
!374 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 375, type: !373, scopeLine: 375, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!375 = !DILocation(line: 375, column: 3, scope: !374)
!376 = !DILocalVariable(name: "this", arg: 1, scope: !374, file: !13, line: 375, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!377 = !DILocalVariable(name: "index", arg: 2, scope: !374, file: !13, line: 375, type: !4)
!378 = !DILocation(line: 376, column: 5, scope: !374)
!379 = !DILocation(line: 376, column: 9, scope: !374)
!380 = !DILocation(line: 376, column: 17, scope: !374)
!381 = !DILocation(line: 376, column: 22, scope: !374)
!382 = !DILocation(line: 376, column: 31, scope: !374)
!383 = !DILocation(line: 376, column: 37, scope: !374)
!384 = !DILocation(line: 376, column: 63, scope: !374)
!385 = !DILocation(line: 377, column: 7, scope: !374)
!386 = !DILocation(line: 377, column: 13, scope: !374)
!387 = !DILocation(line: 379, column: 5, scope: !374)
!388 = !DILocation(line: 379, column: 12, scope: !374)
!389 = !DILocation(line: 379, column: 29, scope: !374)
!390 = !{null, !12, !4, !4}
!391 = !DISubroutineType(types: !390)
!392 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 383, type: !391, scopeLine: 383, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!393 = !DILocation(line: 383, column: 3, scope: !392)
!394 = !DILocalVariable(name: "this", arg: 1, scope: !392, file: !13, line: 383, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!395 = !DILocalVariable(name: "index", arg: 2, scope: !392, file: !13, line: 383, type: !4)
!396 = !DILocalVariable(name: "value", arg: 3, scope: !392, file: !13, line: 383, type: !4)
!397 = !DILocation(line: 384, column: 5, scope: !392)
!398 = !DILocation(line: 384, column: 9, scope: !392)
!399 = !DILocation(line: 384, column: 18, scope: !392)
!400 = !DILocation(line: 384, column: 23, scope: !392)
!401 = !DILocation(line: 384, column: 31, scope: !392)
!402 = !DILocation(line: 384, column: 37, scope: !392)
!403 = !DILocation(line: 384, column: 63, scope: !392)
!404 = !DILocation(line: 385, column: 7, scope: !392)
!405 = !DILocation(line: 385, column: 24, scope: !392)
!406 = !DILocation(line: 385, column: 33, scope: !392)
!407 = !{null, !12, !16, !31, !4}
!408 = !DISubroutineType(types: !407)
!409 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 390, type: !408, scopeLine: 390, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!410 = !DILocation(line: 390, column: 3, scope: !409)
!411 = !DILocalVariable(name: "this", arg: 1, scope: !409, file: !13, line: 390, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!412 = !DILocalVariable(name: "absent", arg: 2, scope: !409, file: !13, line: 390, type: !16)
!413 = !DILocalVariable(name: "key", arg: 3, scope: !409, file: !13, line: 390, type: !31)
!414 = !DILocalVariable(name: "value", arg: 4, scope: !409, file: !13, line: 390, type: !4)
!415 = !DILocation(line: 391, column: 5, scope: !409)
!416 = !DILocation(line: 391, column: 20, scope: !409)
!417 = !DILocation(line: 391, column: 25, scope: !409)
!418 = !DILocalVariable(name: "packed", scope: !409, file: !13, line: 391, type: !16)
!419 = !DILocation(line: 392, column: 5, scope: !409)
!420 = !DILocation(line: 392, column: 18, scope: !409)
!421 = !DILocation(line: 392, column: 24, scope: !409)
!422 = !DILocalVariable(name: "bucket", scope: !409, file: !13, line: 392, type: !4)
!423 = !DILocation(line: 393, column: 5, scope: !409)
!424 = !DILocation(line: 393, column: 15, scope: !409)
!425 = !DILocation(line: 393, column: 21, scope: !409)
!426 = !DILocalVariable(name: "h", scope: !409, file: !13, line: 393, type: !19)
!427 = !DILocation(line: 394, column: 5, scope: !409)
!428 = !DILocation(line: 394, column: 9, scope: !409)
!429 = !DILocation(line: 394, column: 15, scope: !409)
!430 = !DILocation(line: 394, column: 41, scope: !409)
!431 = !DILocation(line: 394, column: 52, scope: !409)
!432 = !DILocation(line: 397, column: 7, scope: !409)
!433 = !DILocation(line: 397, column: 11, scope: !409)
!434 = !DILocation(line: 397, column: 24, scope: !409)
!435 = !DILocation(line: 397, column: 37, scope: !409)
!436 = !DILocation(line: 397, column: 50, scope: !409)
!437 = !DILocation(line: 397, column: 53, scope: !409)
!438 = !DILocation(line: 398, column: 9, scope: !409)
!439 = !DILocation(line: 398, column: 15, scope: !409)
!440 = !DILocation(line: 400, column: 7, scope: !409)
!441 = !DILocation(line: 401, column: 7, scope: !409)
!442 = !DILocation(line: 401, column: 16, scope: !409)
!443 = !DILocation(line: 403, column: 5, scope: !409)
!444 = !DILocation(line: 403, column: 25, scope: !409)
!445 = !{!"element ptr", !140, i64 0}
!446 = !{!445, !445, i64 0}
!447 = !DILocation(line: 404, column: 5, scope: !409)
!448 = !DILocation(line: 404, column: 27, scope: !409)
!449 = !DILocation(line: 405, column: 5, scope: !409)
!450 = !DILocation(line: 405, column: 27, scope: !409)
!451 = !DILocation(line: 406, column: 5, scope: !409)
!452 = !DILocation(line: 406, column: 17, scope: !409)
!453 = !DILocation(line: 406, column: 29, scope: !409)
!454 = !DILocation(line: 407, column: 5, scope: !409)
!455 = !DILocation(line: 407, column: 17, scope: !409)
!456 = !DILocation(line: 407, column: 29, scope: !409)
!457 = !DILocation(line: 410, column: 5, scope: !409)
!458 = !DILocation(line: 410, column: 18, scope: !409)
!459 = !DILocation(line: 410, column: 24, scope: !409)
!460 = !DILocalVariable(name: "used", scope: !409, file: !13, line: 410, type: !4)
!461 = !DILocation(line: 411, column: 5, scope: !409)
!462 = !DILocation(line: 411, column: 9, scope: !409)
!463 = !DILocation(line: 411, column: 16, scope: !409)
!464 = !DILocation(line: 411, column: 20, scope: !409)
!465 = !DILocation(line: 411, column: 26, scope: !409)
!466 = !DILocation(line: 411, column: 47, scope: !409)
!467 = !DILocation(line: 411, column: 50, scope: !409)
!468 = !DILocation(line: 412, column: 7, scope: !409)
!469 = !DILocation(line: 413, column: 12, scope: !409)
!470 = !DILocation(line: 414, column: 7, scope: !409)
!471 = !DILocation(line: 414, column: 20, scope: !409)
!472 = !DILocation(line: 414, column: 32, scope: !409)
!473 = !DILocation(line: 414, column: 43, scope: !409)
!474 = !DILocation(line: 414, column: 51, scope: !409)
!475 = !DILocation(line: 414, column: 54, scope: !409)
!476 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 423, type: !309, scopeLine: 423, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!477 = !DILocation(line: 423, column: 3, scope: !476)
!478 = !DILocalVariable(name: "this", arg: 1, scope: !476, file: !13, line: 423, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!479 = !DILocation(line: 424, column: 5, scope: !476)
!480 = !DILocation(line: 424, column: 18, scope: !476)
!481 = !DILocation(line: 424, column: 24, scope: !476)
!482 = !DILocalVariable(name: "used", scope: !476, file: !13, line: 424, type: !4)
!483 = !DILocation(line: 425, column: 5, scope: !476)
!484 = !DILocation(line: 425, column: 21, scope: !476)
!485 = !DILocation(line: 425, column: 34, scope: !476)
!486 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!487 = !DILocalVariable(name: "walking", scope: !476, file: !13, line: 425, type: !486)
!488 = !DILocation(line: 426, column: 5, scope: !476)
!489 = !DILocation(line: 426, column: 19, scope: !476)
!490 = !DILocation(line: 426, column: 32, scope: !476)
!491 = !DILocation(line: 426, column: 44, scope: !476)
!492 = !DILocation(line: 426, column: 54, scope: !476)
!493 = !DILocation(line: 426, column: 61, scope: !476)
!494 = !DILocation(line: 426, column: 72, scope: !476)
!495 = !DILocalVariable(name: "slots", scope: !476, file: !13, line: 426, type: !23)
!496 = !DILocation(line: 427, column: 5, scope: !476)
!497 = !DILocation(line: 427, column: 9, scope: !476)
!498 = !DILocation(line: 427, column: 10, scope: !476)
!499 = !DILocation(line: 427, column: 21, scope: !476)
!500 = !DILocation(line: 427, column: 33, scope: !476)
!501 = !DILocation(line: 427, column: 39, scope: !476)
!502 = !DILocation(line: 428, column: 7, scope: !476)
!503 = !DILocation(line: 428, column: 22, scope: !476)
!504 = !DILocation(line: 428, column: 38, scope: !476)
!505 = !DILocation(line: 429, column: 7, scope: !476)
!506 = !DILocation(line: 429, column: 22, scope: !476)
!507 = !DILocation(line: 429, column: 40, scope: !476)
!508 = !DILocation(line: 430, column: 7, scope: !476)
!509 = !DILocation(line: 430, column: 21, scope: !476)
!510 = !DILocation(line: 432, column: 5, scope: !476)
!511 = !DILocation(line: 432, column: 18, scope: !476)
!512 = !DILocation(line: 433, column: 5, scope: !476)
!513 = !DILocation(line: 433, column: 17, scope: !476)
!514 = !DILocation(line: 433, column: 23, scope: !476)
!515 = !DILocation(line: 433, column: 39, scope: !476)
!516 = !DILocation(line: 434, column: 5, scope: !476)
!517 = !DILocation(line: 434, column: 12, scope: !476)
!518 = !DILocation(line: 434, column: 19, scope: !476)
!519 = !{!16, !23, !4, !23, !35, !31}
!520 = !DISubroutineType(types: !519)
!521 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 96, type: !520, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!522 = !DILocation(line: 96, column: 1, scope: !521)
!523 = !DILocalVariable(name: "slots", arg: 1, scope: !521, file: !13, line: 96, type: !23)
!524 = !DILocalVariable(name: "mask", arg: 2, scope: !521, file: !13, line: 96, type: !4)
!525 = !DILocalVariable(name: "hashes", arg: 3, scope: !521, file: !13, line: 96, type: !23)
!526 = !DILocalVariable(name: "keys", arg: 4, scope: !521, file: !13, line: 96, type: !35)
!527 = !DILocalVariable(name: "key", arg: 5, scope: !521, file: !13, line: 96, type: !31)
!528 = !DILocation(line: 97, column: 3, scope: !521)
!529 = !DILocation(line: 97, column: 13, scope: !521)
!530 = !DILocation(line: 97, column: 21, scope: !521)
!531 = !DILocalVariable(name: "h", scope: !521, file: !13, line: 97, type: !19)
!532 = !DILocation(line: 98, column: 3, scope: !521)
!533 = !DILocation(line: 98, column: 23, scope: !521)
!534 = !DILocalVariable(name: "fingerprint", scope: !521, file: !13, line: 98, type: !19)
!535 = !DILocation(line: 99, column: 3, scope: !521)
!536 = !DILocation(line: 99, column: 16, scope: !521)
!537 = !DILocation(line: 99, column: 27, scope: !521)
!538 = !DILocation(line: 99, column: 30, scope: !521)
!539 = !DILocalVariable(name: "bucket", scope: !521, file: !13, line: 99, type: !4)
!540 = !DILocation(line: 102, column: 3, scope: !521)
!541 = !DILocation(line: 102, column: 40, scope: !521)
!542 = !DILocation(line: 111, column: 20, scope: !521)
!543 = !DILocation(line: 113, column: 20, scope: !521)
!544 = !DILocation(line: 102, column: 10, scope: !521)
!545 = !DILocation(line: 102, column: 20, scope: !521)
!546 = !DILocation(line: 102, column: 25, scope: !521)
!547 = !DILocation(line: 102, column: 34, scope: !521)
!548 = !DILocation(line: 102, column: 55, scope: !521)
!549 = !DILocation(line: 103, column: 5, scope: !521)
!550 = !DILocation(line: 103, column: 18, scope: !521)
!551 = !DILocation(line: 103, column: 24, scope: !521)
!552 = !DILocalVariable(name: "word", scope: !521, file: !13, line: 103, type: !19)
!553 = !DILocation(line: 104, column: 5, scope: !521)
!554 = !DILocation(line: 104, column: 9, scope: !521)
!555 = !DILocation(line: 104, column: 18, scope: !521)
!556 = !DILocation(line: 104, column: 21, scope: !521)
!557 = !DILocation(line: 105, column: 7, scope: !521)
!558 = !DILocation(line: 105, column: 14, scope: !521)
!559 = !DILocation(line: 105, column: 23, scope: !521)
!560 = !DILocation(line: 105, column: 31, scope: !521)
!561 = !DILocation(line: 107, column: 5, scope: !521)
!562 = !DILocation(line: 107, column: 9, scope: !521)
!563 = !DILocation(line: 107, column: 25, scope: !521)
!564 = !DILocation(line: 107, column: 38, scope: !521)
!565 = !DILocation(line: 108, column: 7, scope: !521)
!566 = !DILocation(line: 108, column: 18, scope: !521)
!567 = !DILocation(line: 108, column: 24, scope: !521)
!568 = !DILocation(line: 108, column: 31, scope: !521)
!569 = !DILocation(line: 108, column: 43, scope: !521)
!570 = !DILocalVariable(name: "at", scope: !521, file: !13, line: 108, type: !4)
!571 = !DILocation(line: 109, column: 7, scope: !521)
!572 = !DILocation(line: 110, column: 9, scope: !521)
!573 = !DILocation(line: 110, column: 15, scope: !521)
!574 = !DILocation(line: 111, column: 9, scope: !521)
!575 = !DILocation(line: 111, column: 14, scope: !521)
!576 = !DILocation(line: 112, column: 9, scope: !521)
!577 = !DILocation(line: 112, column: 16, scope: !521)
!578 = !DILocation(line: 112, column: 24, scope: !521)
!579 = !DILocation(line: 113, column: 9, scope: !521)
!580 = !DILocation(line: 113, column: 14, scope: !521)
!581 = !DILocation(line: 114, column: 9, scope: !521)
!582 = !DILocation(line: 114, column: 17, scope: !521)
!583 = !DILocation(line: 114, column: 22, scope: !521)
!584 = !DILocation(line: 114, column: 27, scope: !521)
!585 = !DILocation(line: 115, column: 9, scope: !521)
!586 = !DILocation(line: 116, column: 9, scope: !521)
!587 = !DILocation(line: 116, column: 16, scope: !521)
!588 = !DILocation(line: 116, column: 24, scope: !521)
!589 = !DILocation(line: 116, column: 32, scope: !521)
!590 = !DILocation(line: 119, column: 5, scope: !521)
!591 = !DILocation(line: 119, column: 14, scope: !521)
!592 = !DILocation(line: 119, column: 15, scope: !521)
!593 = !DILocation(line: 119, column: 24, scope: !521)
!594 = !DILocation(line: 119, column: 29, scope: !521)
!595 = !DILocation(line: 121, column: 3, scope: !521)
!596 = !DILocation(line: 121, column: 9, scope: !521)
!597 = !{null, !35, !23}
!598 = !DISubroutineType(types: !597)
!599 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 142, type: !598, scopeLine: 142, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!600 = !DILocation(line: 142, column: 1, scope: !599)
!601 = !DILocalVariable(name: "items", arg: 1, scope: !599, file: !13, line: 142, type: !35)
!602 = !DILocalVariable(name: "hashes", arg: 2, scope: !599, file: !13, line: 142, type: !23)
!603 = !DILocation(line: 143, column: 3, scope: !599)
!604 = !DILocation(line: 143, column: 16, scope: !599)
!605 = !DILocation(line: 143, column: 22, scope: !599)
!606 = !DILocalVariable(name: "used", scope: !599, file: !13, line: 143, type: !4)
!607 = !DILocation(line: 144, column: 3, scope: !599)
!608 = !DILocation(line: 144, column: 17, scope: !599)
!609 = !DILocalVariable(name: "to", scope: !599, file: !13, line: 144, type: !4)
!610 = !DILocation(line: 145, column: 3, scope: !599)
!611 = !DILocation(line: 145, column: 24, scope: !599)
!612 = !DILocalVariable(name: "from", scope: !599, file: !13, line: 145, type: !4)
!613 = !DILocation(line: 145, column: 55, scope: !599)
!614 = !DILocation(line: 146, column: 68, scope: !599)
!615 = !DILocation(line: 145, column: 27, scope: !599)
!616 = !DILocation(line: 145, column: 34, scope: !599)
!617 = !DILocation(line: 145, column: 42, scope: !599)
!618 = !DILocation(line: 145, column: 49, scope: !599)
!619 = !DILocation(line: 145, column: 79, scope: !599)
!620 = !DILocation(line: 146, column: 5, scope: !599)
!621 = !DILocation(line: 146, column: 9, scope: !599)
!622 = !DILocation(line: 146, column: 16, scope: !599)
!623 = !DILocation(line: 146, column: 26, scope: !599)
!624 = !DILocation(line: 146, column: 31, scope: !599)
!625 = !DILocation(line: 146, column: 37, scope: !599)
!626 = !DILocation(line: 146, column: 42, scope: !599)
!627 = !DILocation(line: 146, column: 47, scope: !599)
!628 = !DILocation(line: 146, column: 55, scope: !599)
!629 = !DILocation(line: 146, column: 62, scope: !599)
!630 = !DILocation(line: 146, column: 83, scope: !599)
!631 = !DILocation(line: 147, column: 7, scope: !599)
!632 = !DILocation(line: 147, column: 13, scope: !599)
!633 = !DILocation(line: 147, column: 19, scope: !599)
!634 = !DILocation(line: 147, column: 25, scope: !599)
!635 = !DILocation(line: 148, column: 7, scope: !599)
!636 = !DILocation(line: 145, column: 71, scope: !599)
!637 = !DILocation(line: 151, column: 3, scope: !599)
!638 = !DILocation(line: 151, column: 10, scope: !599)
!639 = !DILocation(line: 151, column: 16, scope: !599)
!640 = !DILocation(line: 151, column: 32, scope: !599)
!641 = !DILocation(line: 151, column: 36, scope: !599)
!642 = !DILocation(line: 152, column: 5, scope: !599)
!643 = !{null, !43, !23}
!644 = !DISubroutineType(types: !643)
!645 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 142, type: !644, scopeLine: 142, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!646 = !DILocation(line: 142, column: 1, scope: !645)
!647 = !DILocalVariable(name: "items", arg: 1, scope: !645, file: !13, line: 142, type: !43)
!648 = !DILocalVariable(name: "hashes", arg: 2, scope: !645, file: !13, line: 142, type: !23)
!649 = !DILocation(line: 143, column: 3, scope: !645)
!650 = !DILocation(line: 143, column: 16, scope: !645)
!651 = !DILocation(line: 143, column: 22, scope: !645)
!652 = !DILocalVariable(name: "used", scope: !645, file: !13, line: 143, type: !4)
!653 = !DILocation(line: 144, column: 3, scope: !645)
!654 = !DILocation(line: 144, column: 17, scope: !645)
!655 = !DILocalVariable(name: "to", scope: !645, file: !13, line: 144, type: !4)
!656 = !DILocation(line: 145, column: 3, scope: !645)
!657 = !DILocation(line: 145, column: 24, scope: !645)
!658 = !DILocalVariable(name: "from", scope: !645, file: !13, line: 145, type: !4)
!659 = !DILocation(line: 145, column: 55, scope: !645)
!660 = !DILocation(line: 146, column: 68, scope: !645)
!661 = !DILocation(line: 145, column: 27, scope: !645)
!662 = !DILocation(line: 145, column: 34, scope: !645)
!663 = !DILocation(line: 145, column: 42, scope: !645)
!664 = !DILocation(line: 145, column: 49, scope: !645)
!665 = !DILocation(line: 145, column: 79, scope: !645)
!666 = !DILocation(line: 146, column: 5, scope: !645)
!667 = !DILocation(line: 146, column: 9, scope: !645)
!668 = !DILocation(line: 146, column: 16, scope: !645)
!669 = !DILocation(line: 146, column: 26, scope: !645)
!670 = !DILocation(line: 146, column: 31, scope: !645)
!671 = !DILocation(line: 146, column: 37, scope: !645)
!672 = !DILocation(line: 146, column: 42, scope: !645)
!673 = !DILocation(line: 146, column: 47, scope: !645)
!674 = !DILocation(line: 146, column: 55, scope: !645)
!675 = !DILocation(line: 146, column: 62, scope: !645)
!676 = !DILocation(line: 146, column: 83, scope: !645)
!677 = !DILocation(line: 147, column: 7, scope: !645)
!678 = !DILocation(line: 147, column: 13, scope: !645)
!679 = !DILocation(line: 147, column: 19, scope: !645)
!680 = !DILocation(line: 147, column: 25, scope: !645)
!681 = !DILocation(line: 148, column: 7, scope: !645)
!682 = !DILocation(line: 145, column: 71, scope: !645)
!683 = !DILocation(line: 151, column: 3, scope: !645)
!684 = !DILocation(line: 151, column: 10, scope: !645)
!685 = !DILocation(line: 151, column: 16, scope: !645)
!686 = !DILocation(line: 151, column: 32, scope: !645)
!687 = !DILocation(line: 151, column: 36, scope: !645)
!688 = !DILocation(line: 152, column: 5, scope: !645)
