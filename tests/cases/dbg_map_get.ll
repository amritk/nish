%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
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
  %0 = call i8* @nish_alloc_struct(i64 48), !dbg !10
  %1 = bitcast i8* %0 to %struct.Map$str$i32*, !dbg !10
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1), !dbg !10
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %m.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Map$str$i32** %m.addr, metadata !47, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !48
  %3 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 4), !dbg !48
  %4 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8, !dbg !52
  %5 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !51
  %6 = icmp sge i64 %5, 0, !dbg !51
  br i1 %6, label %get.found, label %get.end, !dbg !51

get.found:
  %7 = trunc i64 %5 to i32, !dbg !51
  %8 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %4, i32 %7), !dbg !51
  br label %get.end, !dbg !51

get.end:
  %9 = phi i32 [ %8, %get.found ], [ 0, %entry ], !dbg !51
  call void @llvm.dbg.value(metadata i32 %9, metadata !54, metadata !DIExpression()), !dbg !51
  br i1 %6, label %if.then, label %if.end, !dbg !55

if.then:
  %10 = call i8* @nish_str_from_i32(i32 %9), !dbg !59
  call void @nish_print(i8* %10), !dbg !58
  br label %if.end, !dbg !55

if.end:
  call void @nish_arena_release(i64 %arena.mark), !dbg !61
  ret i32 0, !dbg !61
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !63 {
entry:
  %0 = call i32 @nish_main(), !dbg !64
  call void @nish_free_arena(), !dbg !64
  ret i32 %0, !dbg !64
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 !dbg !67 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !69, metadata !DIExpression()), !dbg !68
  call void @llvm.dbg.value(metadata i32 %mask, metadata !70, metadata !DIExpression()), !dbg !68
  %0 = lshr i32 %h, 16, !dbg !74
  %1 = xor i32 %h, %0, !dbg !72
  %2 = and i32 %1, %mask, !dbg !71
  ret i32 %2, !dbg !68
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 !dbg !78 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !80, metadata !DIExpression()), !dbg !79
  call void @llvm.dbg.value(metadata i32 %index, metadata !81, metadata !DIExpression()), !dbg !79
  %0 = lshr i32 %h, 24, !dbg !84
  %1 = shl i32 %0, 24, !dbg !83
  %2 = add nsw i32 %index, 1, !dbg !86
  %3 = or i32 %1, %2, !dbg !82
  ret i32 %3, !dbg !79
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !90 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !92, metadata !DIExpression()), !dbg !91
  call void @llvm.dbg.value(metadata i32 %index, metadata !93, metadata !DIExpression()), !dbg !91
  %0 = sext i32 %bucket to i64, !dbg !95
  %1 = shl i64 %0, 32, !dbg !95
  %2 = sext i32 %index to i64, !dbg !97
  %3 = or i64 %1, %2, !dbg !94
  ret i64 %3, !dbg !91
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !101 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !103, metadata !DIExpression()), !dbg !102
  call void @llvm.dbg.value(metadata i32 %h, metadata !104, metadata !DIExpression()), !dbg !102
  %0 = sub nsw i32 0, 1, !dbg !106
  %1 = sext i32 %0 to i64, !dbg !105
  %2 = sext i32 %bucket to i64, !dbg !110
  %3 = shl i64 %2, 32, !dbg !110
  %4 = zext i32 %h to i64, !dbg !112
  %5 = or i64 %3, %4, !dbg !109
  %6 = sub nsw i64 %1, %5, !dbg !105
  ret i64 %6, !dbg !102
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
  %3 = mul nsw i32 %live, 2, !dbg !220
  %4 = icmp slt i32 %3, %used, !dbg !220
  br i1 %4, label %if.then, label %if.end, !dbg !219

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !224
  ret %struct.nish_array* %slots, !dbg !226

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !230
  %6 = mul nsw i32 %5, 2, !dbg !230
  %7 = sext i32 %6 to i64, !dbg !229
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !229
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !229
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !229
  store i64 %7, i64* %10, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !229
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !229
  store i64 %7, i64* %11, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !229
  %12 = mul i64 %7, 4, !dbg !229
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !229
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !138, !noalias !137, !dbg !229
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !229
  store i8* %13, i8** %14, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !229
  ret %struct.nish_array* %9, !dbg !228
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !235 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
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
  %11 = load i32, i32* %mask.addr, align 4, !dbg !253
  %12 = load i32, i32* %i.addr, align 4, !dbg !255
  %13 = sext i32 %12 to i64, !dbg !254
  %14 = bitcast i8* %7 to i32*, !dbg !254
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !254
  %16 = load i32, i32* %15, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !254
  %17 = load i32, i32* %i.addr, align 4, !dbg !256
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %11, i32 %16, i32 %17), !dbg !251
  br label %for.inc, !dbg !244

for.inc:
  %18 = load i32, i32* %i.addr, align 4, !dbg !257
  %19 = add nsw i32 %18, 1, !dbg !257
  store i32 %19, i32* %i.addr, align 4, !dbg !257
  br label %for.cond, !dbg !244

for.end:
  ret void, !dbg !236
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !258 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !260, metadata !DIExpression()), !dbg !259
  store i32 0, i32* %i.addr, align 4, !dbg !261
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !263, metadata !DIExpression()), !dbg !261
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !261
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !261
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !261
  %3 = load i8*, i8** %2, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !261
  br label %for.cond, !dbg !261

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !265
  %5 = trunc i64 %1 to i32, !dbg !264
  %6 = icmp slt i32 %4, %5, !dbg !265
  br i1 %6, label %for.body, label %for.end, !dbg !261

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !269
  %8 = sext i32 %7 to i64, !dbg !268
  %9 = bitcast i8* %3 to i32*, !dbg !268
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !268
  store i32 0, i32* %10, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !268
  br label %for.inc, !dbg !261

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !271
  %12 = add nsw i32 %11, 1, !dbg !271
  store i32 %12, i32* %i.addr, align 4, !dbg !271
  br label %for.cond, !dbg !261

for.end:
  ret void, !dbg !259
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !274 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !276, metadata !DIExpression()), !dbg !275
  call void @llvm.dbg.value(metadata i32 %mask, metadata !277, metadata !DIExpression()), !dbg !275
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !278, metadata !DIExpression()), !dbg !275
  call void @llvm.dbg.value(metadata i32 %h, metadata !279, metadata !DIExpression()), !dbg !275
  call void @llvm.dbg.value(metadata i32 %used, metadata !280, metadata !DIExpression()), !dbg !275
  %0 = icmp sge i32 %bucket, 0, !dbg !282
  br i1 %0, label %land.rhs, label %land.end, !dbg !282

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !286
  %2 = load i64, i64* %1, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !286
  %3 = trunc i64 %2 to i32, !dbg !286
  %4 = icmp slt i32 %bucket, %3, !dbg !284
  br label %land.end, !dbg !282

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !282
  br i1 %5, label %if.then, label %if.else, !dbg !281

if.then:
  %6 = sext i32 %bucket to i64, !dbg !288
  %7 = sub nsw i32 %used, 1, !dbg !292
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !290
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !288
  %10 = load i8*, i8** %9, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !288
  %11 = bitcast i8* %10 to i32*, !dbg !288
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !288
  store i32 %8, i32* %12, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !288
  br label %if.end, !dbg !281

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !299
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !295
  br label %if.end, !dbg !281

if.end:
  ret void, !dbg !275
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 !dbg !303 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !305, metadata !DIExpression()), !dbg !304
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !304
  store i32 0, i32* %0, align 4, !tbaa !309, !dbg !304
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !304
  store i32 7, i32* %1, align 4, !tbaa !310, !dbg !304
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !304
  store i32 0, i32* %2, align 4, !tbaa !311, !dbg !304
  %3 = sext i32 8 to i64, !dbg !313
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !313
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !313
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !313
  store i64 %3, i64* %6, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !313
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !313
  store i64 %3, i64* %7, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !313
  %8 = mul i64 %3, 4, !dbg !313
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !313
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !138, !noalias !137, !dbg !313
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !313
  store i8* %9, i8** %10, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !313
  %11 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !312
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !315, !dbg !312
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !317
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !317
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !317
  store i64 0, i64* %14, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !317
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !317
  store i64 0, i64* %15, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !317
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !317
  store i8* null, i8** %16, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !317
  %17 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !316
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !318, !dbg !316
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !320
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !320
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !320
  store i64 0, i64* %20, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !320
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !320
  store i64 0, i64* %21, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !320
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !320
  store i8* null, i8** %22, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !320
  %23 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !319
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !321, !dbg !319
  %24 = call i8* @nish_alloc_struct(i64 24), !dbg !323
  %25 = bitcast i8* %24 to %struct.nish_array*, !dbg !323
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0, !dbg !323
  store i64 0, i64* %26, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !323
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1, !dbg !323
  store i64 0, i64* %27, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !323
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2, !dbg !323
  store i8* null, i8** %28, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !323
  %29 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !322
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !324, !dbg !322
  ret void, !dbg !304
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !327 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !329, metadata !DIExpression()), !dbg !328
  call void @llvm.dbg.value(metadata i8* %key, metadata !330, metadata !DIExpression()), !dbg !328
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !333
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !315, !dbg !333
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !334
  %3 = load i32, i32* %2, align 4, !tbaa !310, !dbg !334
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !335
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !324, !dbg !335
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !336
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !318, !dbg !336
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !332
  ret i64 %8, !dbg !331
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(48) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !340 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !342, metadata !DIExpression()), !dbg !341
  call void @llvm.dbg.value(metadata i8* %key, metadata !343, metadata !DIExpression()), !dbg !341
  call void @llvm.dbg.value(metadata i32 %value, metadata !344, metadata !DIExpression()), !dbg !341
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !346
  store i64 %0, i64* %found.addr, align 8, !dbg !345
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !348, metadata !DIExpression()), !dbg !345
  %1 = load i64, i64* %found.addr, align 8, !dbg !350
  %2 = icmp sge i64 %1, 0, !dbg !350
  br i1 %2, label %if.then, label %if.else, !dbg !349

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !355
  %4 = trunc i64 %3 to i32, !dbg !354
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !353
  br label %if.end, !dbg !349

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !359
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !358
  br label %if.end, !dbg !349

if.end:
  ret %struct.Map$str$i32* %this, !dbg !362
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 !dbg !366 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !368, metadata !DIExpression()), !dbg !367
  call void @llvm.dbg.value(metadata i32 %index, metadata !369, metadata !DIExpression()), !dbg !367
  %0 = icmp slt i32 %index, 0, !dbg !371
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !371

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !375
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !321, !dbg !375
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !375
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !375
  %5 = trunc i64 %4 to i32, !dbg !375
  %6 = icmp sge i32 %index, %5, !dbg !373
  br label %lor.end, !dbg !371

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !371
  br i1 %7, label %if.then, label %if.end, !dbg !370

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i32 2, i1 true), !dbg !377
  call void @nish_exit(i32 1), !dbg !377
  unreachable, !dbg !377

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !380
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !321, !dbg !380
  %10 = sext i32 %index to i64, !dbg !380
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !380
  %12 = load i64, i64* %11, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !380
  %13 = icmp ult i64 %10, %12, !dbg !380
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !380

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !380
  unreachable, !dbg !380

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !380
  %15 = load i8*, i8** %14, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !380
  %16 = bitcast i8* %15 to i32*, !dbg !380
  %17 = getelementptr inbounds i32, i32* %16, i64 %10, !dbg !380
  %18 = load i32, i32* %17, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !380
  ret i32 %18, !dbg !379
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, i32 noundef %value) #2 !dbg !384 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !386, metadata !DIExpression()), !dbg !385
  call void @llvm.dbg.value(metadata i32 %index, metadata !387, metadata !DIExpression()), !dbg !385
  call void @llvm.dbg.value(metadata i32 %value, metadata !388, metadata !DIExpression()), !dbg !385
  %0 = icmp sge i32 %index, 0, !dbg !390
  br i1 %0, label %land.rhs, label %land.end, !dbg !390

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !394
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !321, !dbg !394
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !394
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !394
  %5 = trunc i64 %4 to i32, !dbg !394
  %6 = icmp slt i32 %index, %5, !dbg !392
  br label %land.end, !dbg !390

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !390
  br i1 %7, label %if.then, label %if.end, !dbg !389

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !396
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !321, !dbg !396
  %10 = sext i32 %index to i64, !dbg !396
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !396
  %12 = load i8*, i8** %11, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !396
  %13 = bitcast i8* %12 to i32*, !dbg !396
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !396
  store i32 %value, i32* %14, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !396
  br label %if.end, !dbg !389

if.end:
  ret void, !dbg !385
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !401 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !403, metadata !DIExpression()), !dbg !402
  call void @llvm.dbg.value(metadata i64 %absent, metadata !404, metadata !DIExpression()), !dbg !402
  call void @llvm.dbg.value(metadata i8* %key, metadata !405, metadata !DIExpression()), !dbg !402
  call void @llvm.dbg.value(metadata i32 %value, metadata !406, metadata !DIExpression()), !dbg !402
  %0 = sub nsw i64 0, 1, !dbg !408
  %1 = sub nsw i64 %0, %absent, !dbg !408
  store i64 %1, i64* %packed.addr, align 8, !dbg !407
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !411, metadata !DIExpression()), !dbg !407
  %2 = load i64, i64* %packed.addr, align 8, !dbg !414
  %3 = ashr i64 %2, 32, !dbg !414
  %4 = trunc i64 %3 to i32, !dbg !413
  store i32 %4, i32* %bucket.addr, align 4, !dbg !412
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !415, metadata !DIExpression()), !dbg !412
  %5 = load i64, i64* %packed.addr, align 8, !dbg !418
  %6 = trunc i64 %5 to i32, !dbg !417
  store i32 %6, i32* %h.addr, align 4, !dbg !416
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !419, metadata !DIExpression()), !dbg !416
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !422
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !318, !dbg !422
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !422
  %10 = load i64, i64* %9, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !422
  %11 = trunc i64 %10 to i32, !dbg !422
  %12 = icmp sge i32 %11, 16777215, !dbg !421
  br i1 %12, label %if.then, label %if.end, !dbg !420

if.then:
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !426
  %14 = load i32, i32* %13, align 4, !tbaa !311, !dbg !426
  %15 = icmp sge i32 %14, 16777215, !dbg !426
  br i1 %15, label %if.then.1, label %if.end.1, !dbg !425

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !429
  call void @nish_exit(i32 1), !dbg !429
  unreachable, !dbg !429

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !431
  %16 = sub nsw i32 0, 1, !dbg !433
  store i32 %16, i32* %bucket.addr, align 4, !dbg !432
  br label %if.end, !dbg !420

if.end:
  %17 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !435
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !318, !dbg !435
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0, !dbg !435
  %20 = load i64, i64* %19, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !435
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1, !dbg !435
  %22 = load i64, i64* %21, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !435
  %23 = icmp eq i64 %20, %22, !dbg !435
  br i1 %23, label %push.grow, label %push.store, !dbg !435

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 8), !dbg !435
  br label %push.store, !dbg !435

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2, !dbg !435
  %25 = load i8*, i8** %24, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !435
  %26 = bitcast i8* %25 to i8**, !dbg !435
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20, !dbg !435
  store i8* %key, i8** %27, align 8, !alias.scope !138, !noalias !137, !tbaa !438, !dbg !435
  %28 = add i64 %20, 1, !dbg !435
  store i64 %28, i64* %19, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !435
  %29 = trunc i64 %28 to i32, !dbg !435
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !439
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !321, !dbg !439
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0, !dbg !439
  %33 = load i64, i64* %32, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !439
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1, !dbg !439
  %35 = load i64, i64* %34, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !439
  %36 = icmp eq i64 %33, %35, !dbg !439
  br i1 %36, label %push.grow.1, label %push.store.1, !dbg !439

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4), !dbg !439
  br label %push.store.1, !dbg !439

push.store.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2, !dbg !439
  %38 = load i8*, i8** %37, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !439
  %39 = bitcast i8* %38 to i32*, !dbg !439
  %40 = getelementptr inbounds i32, i32* %39, i64 %33, !dbg !439
  store i32 %value, i32* %40, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !439
  %41 = add i64 %33, 1, !dbg !439
  store i64 %41, i64* %32, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !439
  %42 = trunc i64 %41 to i32, !dbg !439
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !441
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !324, !dbg !441
  %45 = load i32, i32* %h.addr, align 4, !dbg !442
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0, !dbg !441
  %47 = load i64, i64* %46, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !441
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1, !dbg !441
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !232, !dbg !441
  %50 = icmp eq i64 %47, %49, !dbg !441
  br i1 %50, label %push.grow.2, label %push.store.2, !dbg !441

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %44, i64 4), !dbg !441
  br label %push.store.2, !dbg !441

push.store.2:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2, !dbg !441
  %52 = load i8*, i8** %51, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !441
  %53 = bitcast i8* %52 to i32*, !dbg !441
  %54 = getelementptr inbounds i32, i32* %53, i64 %47, !dbg !441
  store i32 %45, i32* %54, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !441
  %55 = add i64 %47, 1, !dbg !441
  store i64 %55, i64* %46, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !441
  %56 = trunc i64 %55 to i32, !dbg !441
  %57 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !444
  %58 = load i32, i32* %57, align 4, !tbaa !311, !dbg !444
  %59 = add nsw i32 %58, 1, !dbg !444
  %60 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !443
  store i32 %59, i32* %60, align 4, !tbaa !311, !dbg !443
  %61 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !447
  %62 = load i32, i32* %61, align 4, !tbaa !309, !dbg !447
  %63 = add nsw i32 %62, 1, !dbg !447
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !446
  store i32 %63, i32* %64, align 4, !tbaa !309, !dbg !446
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !451
  %66 = load %struct.nish_array*, %struct.nish_array** %65, align 8, !tbaa !318, !dbg !451
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0, !dbg !451
  %68 = load i64, i64* %67, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !451
  %69 = trunc i64 %68 to i32, !dbg !451
  store i32 %69, i32* %used.addr, align 4, !dbg !449
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !452, metadata !DIExpression()), !dbg !449
  %70 = load i32, i32* %used.addr, align 4, !dbg !454
  %71 = mul nsw i32 %70, 4, !dbg !454
  %72 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !457
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !tbaa !315, !dbg !457
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0, !dbg !457
  %75 = load i64, i64* %74, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !457
  %76 = trunc i64 %75 to i32, !dbg !457
  %77 = mul nsw i32 %76, 3, !dbg !456
  %78 = icmp sgt i32 %71, %77, !dbg !454
  br i1 %78, label %if.then.2, label %if.else, !dbg !453

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !460
  br label %if.end.2, !dbg !453

if.else:
  %79 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !463
  %80 = load %struct.nish_array*, %struct.nish_array** %79, align 8, !tbaa !315, !dbg !463
  %81 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !464
  %82 = load i32, i32* %81, align 4, !tbaa !310, !dbg !464
  %83 = load i32, i32* %bucket.addr, align 4, !dbg !465
  %84 = load i32, i32* %h.addr, align 4, !dbg !466
  %85 = load i32, i32* %used.addr, align 4, !dbg !467
  call void @nish.fileAppended(%struct.nish_array* %80, i32 %82, i32 %83, i32 %84, i32 %85), !dbg !462
  br label %if.end.2, !dbg !453

if.end.2:
  ret void, !dbg !402
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !468 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !470, metadata !DIExpression()), !dbg !469
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !473
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !318, !dbg !473
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !473
  %3 = load i64, i64* %2, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !473
  %4 = trunc i64 %3 to i32, !dbg !473
  store i32 %4, i32* %used.addr, align 4, !dbg !471
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !474, metadata !DIExpression()), !dbg !471
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !477
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !315, !dbg !477
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !478
  %8 = load i32, i32* %7, align 4, !tbaa !311, !dbg !478
  %9 = load i32, i32* %used.addr, align 4, !dbg !479
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9), !dbg !476
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8, !dbg !475
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !480, metadata !DIExpression()), !dbg !475
  %11 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !482
  %12 = load i32, i32* %11, align 4, !tbaa !311, !dbg !482
  %13 = load i32, i32* %used.addr, align 4, !dbg !483
  %14 = icmp slt i32 %12, %13, !dbg !482
  br i1 %14, label %if.then, label %if.end, !dbg !481

if.then:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !486
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !318, !dbg !486
  %17 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !487
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !324, !dbg !487
  call void @nish.compactEntries$str(%struct.nish_array* %16, %struct.nish_array* %18), !dbg !485
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !489
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !321, !dbg !489
  %21 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !490
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !324, !dbg !490
  call void @nish.compactEntries$i32(%struct.nish_array* %20, %struct.nish_array* %22), !dbg !488
  %23 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !492
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !324, !dbg !492
  call void @nish.compactHashes(%struct.nish_array* %24), !dbg !491
  br label %if.end, !dbg !481

if.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !494
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !493
  store %struct.nish_array* %25, %struct.nish_array** %26, align 8, !tbaa !315, !dbg !493
  %27 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !497
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0, !dbg !497
  %29 = load i64, i64* %28, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !497
  %30 = trunc i64 %29 to i32, !dbg !497
  %31 = sub nsw i32 %30, 1, !dbg !496
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !495
  store i32 %31, i32* %32, align 4, !tbaa !310, !dbg !495
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !500
  %34 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !501
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !324, !dbg !501
  call void @nish.refile(%struct.nish_array* %33, %struct.nish_array* %35), !dbg !499
  ret void, !dbg !469
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !504 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !506, metadata !DIExpression()), !dbg !505
  call void @llvm.dbg.value(metadata i32 %mask, metadata !507, metadata !DIExpression()), !dbg !505
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !508, metadata !DIExpression()), !dbg !505
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !509, metadata !DIExpression()), !dbg !505
  call void @llvm.dbg.value(metadata i8* %key, metadata !510, metadata !DIExpression()), !dbg !505
  %0 = bitcast i8* %key to i64*, !dbg !512
  %1 = load i64, i64* %0, align 8, !dbg !512
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !512
  store i64 0, i64* %hash.i, align 8, !dbg !512
  store i32 -2128831035, i32* %hash.h, align 4, !dbg !512
  br label %hash.test, !dbg !512

hash.test:
  %3 = load i64, i64* %hash.i, align 8, !dbg !512
  %4 = icmp ult i64 %3, %1, !dbg !512
  br i1 %4, label %hash.byte, label %hash.done, !dbg !512

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3, !dbg !512
  %6 = load i8, i8* %5, !dbg !512
  %7 = zext i8 %6 to i32, !dbg !512
  %8 = load i32, i32* %hash.h, align 4, !dbg !512
  %9 = xor i32 %8, %7, !dbg !512
  %10 = mul i32 %9, 16777619, !dbg !512
  store i32 %10, i32* %hash.h, align 4, !dbg !512
  %11 = add i64 %3, 1, !dbg !512
  store i64 %11, i64* %hash.i, align 8, !dbg !512
  br label %hash.test, !dbg !512

hash.done:
  %12 = load i32, i32* %hash.h, align 4, !dbg !512
  %13 = icmp eq i32 %12, 0, !dbg !512
  %14 = select i1 %13, i32 1, i32 %12, !dbg !512
  store i32 %14, i32* %h.addr, align 4, !dbg !511
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !514, metadata !DIExpression()), !dbg !511
  %15 = load i32, i32* %h.addr, align 4, !dbg !516
  %16 = lshr i32 %15, 24, !dbg !516
  store i32 %16, i32* %fingerprint.addr, align 4, !dbg !515
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !517, metadata !DIExpression()), !dbg !515
  %17 = load i32, i32* %h.addr, align 4, !dbg !520
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask), !dbg !519
  store i32 %18, i32* %bucket.addr, align 4, !dbg !518
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !522, metadata !DIExpression()), !dbg !518
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !523
  %20 = load i64, i64* %19, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !523
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !523
  %22 = load i8*, i8** %21, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !523
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !523
  %24 = load i64, i64* %23, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !523
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !523
  %26 = load i8*, i8** %25, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !523
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !523
  %28 = load i64, i64* %27, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !523
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !523
  %30 = load i8*, i8** %29, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !523
  br label %while.cond, !dbg !523

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4, !dbg !527
  %32 = icmp sge i32 %31, 0, !dbg !527
  br i1 %32, label %land.rhs, label %land.end, !dbg !527

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4, !dbg !529
  %34 = trunc i64 %20 to i32, !dbg !524
  %35 = icmp slt i32 %33, %34, !dbg !529
  br label %land.end, !dbg !527

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ], !dbg !527
  br i1 %36, label %while.body, label %while.end, !dbg !523

while.body:
  %37 = load i32, i32* %bucket.addr, align 4, !dbg !534
  %38 = sext i32 %37 to i64, !dbg !533
  %39 = bitcast i8* %22 to i32*, !dbg !533
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !533
  %41 = load i32, i32* %40, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !533
  store i32 %41, i32* %word.addr, align 4, !dbg !532
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !535, metadata !DIExpression()), !dbg !532
  %42 = load i32, i32* %word.addr, align 4, !dbg !537
  %43 = icmp eq i32 %42, 0, !dbg !537
  br i1 %43, label %if.then, label %if.end, !dbg !536

if.then:
  %44 = load i32, i32* %bucket.addr, align 4, !dbg !542
  %45 = load i32, i32* %h.addr, align 4, !dbg !543
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45), !dbg !541
  ret i64 %46, !dbg !540

if.end:
  %47 = load i32, i32* %word.addr, align 4, !dbg !545
  %48 = lshr i32 %47, 24, !dbg !545
  %49 = load i32, i32* %fingerprint.addr, align 4, !dbg !546
  %50 = icmp eq i32 %48, %49, !dbg !545
  br i1 %50, label %if.then.1, label %if.end.1, !dbg !544

if.then.1:
  %51 = load i32, i32* %word.addr, align 4, !dbg !550
  %52 = and i32 %51, 16777215, !dbg !550
  %53 = sub nsw i32 %52, 1, !dbg !549
  store i32 %53, i32* %at.addr, align 4, !dbg !548
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !553, metadata !DIExpression()), !dbg !548
  %54 = load i32, i32* %at.addr, align 4, !dbg !555
  %55 = icmp sge i32 %54, 0, !dbg !555
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !555

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !557
  %57 = trunc i64 %24 to i32, !dbg !525
  %58 = icmp slt i32 %56, %57, !dbg !557
  br label %land.end.4, !dbg !555

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !555
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !555

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !560
  %61 = sext i32 %60 to i64, !dbg !559
  %62 = bitcast i8* %26 to i32*, !dbg !559
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !559
  %64 = load i32, i32* %63, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !559
  %65 = load i32, i32* %h.addr, align 4, !dbg !561
  %66 = icmp eq i32 %64, %65, !dbg !559
  br label %land.end.3, !dbg !555

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !555
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !555

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !562
  %69 = trunc i64 %28 to i32, !dbg !526
  %70 = icmp slt i32 %68, %69, !dbg !562
  br label %land.end.2, !dbg !555

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !555
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !555

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !566
  %73 = sext i32 %72 to i64, !dbg !565
  %74 = bitcast i8* %30 to i8**, !dbg !565
  %75 = getelementptr inbounds i8*, i8** %74, i64 %73, !dbg !565
  %76 = load i8*, i8** %75, align 8, !alias.scope !138, !noalias !137, !tbaa !438, !dbg !565
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* %key), !dbg !564
  br label %land.end.1, !dbg !555

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !555
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !554

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4, !dbg !571
  %80 = load i32, i32* %at.addr, align 4, !dbg !572
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !570
  ret i64 %81, !dbg !569

if.end.2:
  br label %if.end.1, !dbg !544

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !575
  %83 = add nsw i32 %82, 1, !dbg !575
  %84 = and i32 %83, %mask, !dbg !574
  store i32 %84, i32* %bucket.addr, align 4, !dbg !573
  br label %while.cond, !dbg !523

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !578
  call void @nish_exit(i32 1), !dbg !578
  unreachable, !dbg !578
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !582 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !584, metadata !DIExpression()), !dbg !583
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !585, metadata !DIExpression()), !dbg !583
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !588
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !588
  %2 = trunc i64 %1 to i32, !dbg !588
  store i32 %2, i32* %used.addr, align 4, !dbg !586
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !589, metadata !DIExpression()), !dbg !586
  store i32 0, i32* %to.addr, align 4, !dbg !590
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !592, metadata !DIExpression()), !dbg !590
  store i32 0, i32* %from.addr, align 4, !dbg !593
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !595, metadata !DIExpression()), !dbg !593
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !593
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !593
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !593
  %6 = load i8*, i8** %5, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !593
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !593
  %8 = load i64, i64* %7, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !593
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !593
  %10 = load i8*, i8** %9, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !593
  br label %for.cond, !dbg !593

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !598
  %12 = load i32, i32* %used.addr, align 4, !dbg !599
  %13 = icmp slt i32 %11, %12, !dbg !598
  br i1 %13, label %land.rhs, label %land.end, !dbg !598

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !600
  %15 = trunc i64 %4 to i32, !dbg !596
  %16 = icmp slt i32 %14, %15, !dbg !600
  br label %land.end, !dbg !598

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !598
  br i1 %17, label %for.body, label %for.end, !dbg !593

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !605
  %19 = sext i32 %18 to i64, !dbg !604
  %20 = bitcast i8* %6 to i32*, !dbg !604
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !604
  %22 = load i32, i32* %21, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !604
  %23 = icmp ne i32 %22, 0, !dbg !604
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !604

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !607
  %25 = icmp sge i32 %24, 0, !dbg !607
  br label %land.end.3, !dbg !604

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !604
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !604

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !609
  %28 = load i32, i32* %used.addr, align 4, !dbg !610
  %29 = icmp slt i32 %27, %28, !dbg !609
  br label %land.end.2, !dbg !604

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !604
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !604

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !611
  %32 = trunc i64 %8 to i32, !dbg !597
  %33 = icmp slt i32 %31, %32, !dbg !611
  br label %land.end.1, !dbg !604

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !604
  br i1 %34, label %if.then, label %if.end, !dbg !603

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !615
  %36 = sext i32 %35 to i64, !dbg !614
  %37 = load i32, i32* %from.addr, align 4, !dbg !617
  %38 = sext i32 %37 to i64, !dbg !616
  %39 = bitcast i8* %10 to i8**, !dbg !616
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !616
  %41 = load i8*, i8** %40, align 8, !alias.scope !138, !noalias !137, !tbaa !438, !dbg !616
  %42 = bitcast i8* %10 to i8**, !dbg !614
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !614
  store i8* %41, i8** %43, align 8, !alias.scope !138, !noalias !137, !tbaa !438, !dbg !614
  %44 = load i32, i32* %to.addr, align 4, !dbg !618
  %45 = add nsw i32 %44, 1, !dbg !618
  store i32 %45, i32* %to.addr, align 4, !dbg !618
  br label %if.end, !dbg !603

if.end:
  br label %for.inc, !dbg !593

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !619
  %47 = add nsw i32 %46, 1, !dbg !619
  store i32 %47, i32* %from.addr, align 4, !dbg !619
  br label %for.cond, !dbg !593

for.end:
  br label %while.cond, !dbg !620

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !622
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !622
  %50 = trunc i64 %49 to i32, !dbg !622
  %51 = load i32, i32* %to.addr, align 4, !dbg !623
  %52 = icmp sgt i32 %50, %51, !dbg !621
  br i1 %52, label %while.body, label %while.end, !dbg !620

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !625
  %54 = load i64, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !625
  %55 = icmp eq i64 %54, 0, !dbg !625
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !625

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !625
  unreachable, !dbg !625

pop.ok:
  %56 = sub i64 %54, 1, !dbg !625
  store i64 %56, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !625
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !625
  %58 = load i8*, i8** %57, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !625
  %59 = bitcast i8* %58 to i8**, !dbg !625
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56, !dbg !625
  %61 = load i8*, i8** %60, align 8, !alias.scope !138, !noalias !137, !tbaa !438, !dbg !625
  br label %while.cond, !dbg !620

while.end:
  ret void, !dbg !583
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !628 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !630, metadata !DIExpression()), !dbg !629
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !631, metadata !DIExpression()), !dbg !629
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !634
  %1 = load i64, i64* %0, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !634
  %2 = trunc i64 %1 to i32, !dbg !634
  store i32 %2, i32* %used.addr, align 4, !dbg !632
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !635, metadata !DIExpression()), !dbg !632
  store i32 0, i32* %to.addr, align 4, !dbg !636
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !638, metadata !DIExpression()), !dbg !636
  store i32 0, i32* %from.addr, align 4, !dbg !639
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !641, metadata !DIExpression()), !dbg !639
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !639
  %4 = load i64, i64* %3, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !639
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !639
  %6 = load i8*, i8** %5, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !639
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !639
  %8 = load i64, i64* %7, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !639
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !639
  %10 = load i8*, i8** %9, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !639
  br label %for.cond, !dbg !639

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !644
  %12 = load i32, i32* %used.addr, align 4, !dbg !645
  %13 = icmp slt i32 %11, %12, !dbg !644
  br i1 %13, label %land.rhs, label %land.end, !dbg !644

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !646
  %15 = trunc i64 %4 to i32, !dbg !642
  %16 = icmp slt i32 %14, %15, !dbg !646
  br label %land.end, !dbg !644

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !644
  br i1 %17, label %for.body, label %for.end, !dbg !639

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !651
  %19 = sext i32 %18 to i64, !dbg !650
  %20 = bitcast i8* %6 to i32*, !dbg !650
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !650
  %22 = load i32, i32* %21, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !650
  %23 = icmp ne i32 %22, 0, !dbg !650
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !650

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !653
  %25 = icmp sge i32 %24, 0, !dbg !653
  br label %land.end.3, !dbg !650

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !650
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !650

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !655
  %28 = load i32, i32* %used.addr, align 4, !dbg !656
  %29 = icmp slt i32 %27, %28, !dbg !655
  br label %land.end.2, !dbg !650

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !650
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !650

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !657
  %32 = trunc i64 %8 to i32, !dbg !643
  %33 = icmp slt i32 %31, %32, !dbg !657
  br label %land.end.1, !dbg !650

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !650
  br i1 %34, label %if.then, label %if.end, !dbg !649

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !661
  %36 = sext i32 %35 to i64, !dbg !660
  %37 = load i32, i32* %from.addr, align 4, !dbg !663
  %38 = sext i32 %37 to i64, !dbg !662
  %39 = bitcast i8* %10 to i32*, !dbg !662
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !662
  %41 = load i32, i32* %40, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !662
  %42 = bitcast i8* %10 to i32*, !dbg !660
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !660
  store i32 %41, i32* %43, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !660
  %44 = load i32, i32* %to.addr, align 4, !dbg !664
  %45 = add nsw i32 %44, 1, !dbg !664
  store i32 %45, i32* %to.addr, align 4, !dbg !664
  br label %if.end, !dbg !649

if.end:
  br label %for.inc, !dbg !639

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !665
  %47 = add nsw i32 %46, 1, !dbg !665
  store i32 %47, i32* %from.addr, align 4, !dbg !665
  br label %for.cond, !dbg !639

for.end:
  br label %while.cond, !dbg !666

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !668
  %49 = load i64, i64* %48, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !668
  %50 = trunc i64 %49 to i32, !dbg !668
  %51 = load i32, i32* %to.addr, align 4, !dbg !669
  %52 = icmp sgt i32 %50, %51, !dbg !667
  br i1 %52, label %while.body, label %while.end, !dbg !666

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !671
  %54 = load i64, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !671
  %55 = icmp eq i64 %54, 0, !dbg !671
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !671

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !671
  unreachable, !dbg !671

pop.ok:
  %56 = sub i64 %54, 1, !dbg !671
  store i64 %56, i64* %53, align 8, !alias.scope !137, !noalias !138, !tbaa !144, !dbg !671
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !671
  %58 = load i8*, i8** %57, align 8, !alias.scope !137, !noalias !138, !tbaa !145, !dbg !671
  %59 = bitcast i8* %58 to i32*, !dbg !671
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !671
  %61 = load i32, i32* %60, align 4, !alias.scope !138, !noalias !137, !tbaa !155, !dbg !671
  br label %while.cond, !dbg !666

while.end:
  ret void, !dbg !629
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Map<string, i32>", file: !13, line: 234, size: 384, align: 64, elements: !46)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 236, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 238, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 240, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 242, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "string[]", file: !1, size: 192, align: 64, elements: !34)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!31 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !30, size: 64)
!32 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !31, size: 64)
!33 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !32, size: 64, offset: 128)
!34 = !{!28, !29, !33}
!35 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 243, baseType: !35, size: 64, offset: 192)
!37 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !42)
!38 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !37, baseType: !16, size: 64, offset: 0)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !37, baseType: !16, size: 64, offset: 64)
!40 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!41 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !37, baseType: !40, size: 64, offset: 128)
!42 = !{!38, !39, !41}
!43 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !37, size: 64)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "entryValues", scope: !11, file: !13, line: 244, baseType: !43, size: 64, offset: 256)
!45 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 246, baseType: !23, size: 64, offset: 320)
!46 = !{!14, !24, !25, !26, !36, !44, !45}
!47 = !DILocalVariable(name: "m", scope: !7, file: !1, line: 5, type: !12)
!48 = !DILocation(line: 6, column: 3, scope: !7)
!49 = !DILocation(line: 6, column: 9, scope: !7)
!50 = !DILocation(line: 6, column: 14, scope: !7)
!51 = !DILocation(line: 7, column: 3, scope: !7)
!52 = !DILocation(line: 7, column: 13, scope: !7)
!53 = !DILocation(line: 7, column: 19, scope: !7)
!54 = !DILocalVariable(name: "n", scope: !7, file: !1, line: 7, type: !4)
!55 = !DILocation(line: 8, column: 3, scope: !7)
!56 = !DILocation(line: 8, column: 7, scope: !7)
!57 = !DILocation(line: 8, column: 24, scope: !7)
!58 = !DILocation(line: 9, column: 5, scope: !7)
!59 = !DILocation(line: 9, column: 17, scope: !7)
!60 = !DILocation(line: 9, column: 20, scope: !7)
!61 = !DILocation(line: 11, column: 3, scope: !7)
!62 = !DILocation(line: 11, column: 10, scope: !7)
!63 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 4, type: !6, scopeLine: 4, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!64 = !DILocation(line: 4, column: 1, scope: !63)
!65 = !{!4, !19, !4}
!66 = !DISubroutineType(types: !65)
!67 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 73, type: !66, scopeLine: 73, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!68 = !DILocation(line: 73, column: 1, scope: !67)
!69 = !DILocalVariable(name: "h", arg: 1, scope: !67, file: !13, line: 73, type: !19)
!70 = !DILocalVariable(name: "mask", arg: 2, scope: !67, file: !13, line: 73, type: !4)
!71 = !DILocation(line: 73, column: 48, scope: !67)
!72 = !DILocation(line: 73, column: 54, scope: !67)
!73 = !DILocation(line: 73, column: 58, scope: !67)
!74 = !DILocation(line: 73, column: 59, scope: !67)
!75 = !DILocation(line: 73, column: 72, scope: !67)
!76 = !{!19, !19, !4}
!77 = !DISubroutineType(types: !76)
!78 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 76, type: !77, scopeLine: 76, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!79 = !DILocation(line: 76, column: 1, scope: !78)
!80 = !DILocalVariable(name: "h", arg: 1, scope: !78, file: !13, line: 76, type: !19)
!81 = !DILocalVariable(name: "index", arg: 2, scope: !78, file: !13, line: 76, type: !4)
!82 = !DILocation(line: 76, column: 47, scope: !78)
!83 = !DILocation(line: 76, column: 48, scope: !78)
!84 = !DILocation(line: 76, column: 49, scope: !78)
!85 = !DILocation(line: 76, column: 68, scope: !78)
!86 = !DILocation(line: 76, column: 74, scope: !78)
!87 = !DILocation(line: 76, column: 82, scope: !78)
!88 = !{!16, !4, !4}
!89 = !DISubroutineType(types: !88)
!90 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 79, type: !89, scopeLine: 79, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!91 = !DILocation(line: 79, column: 1, scope: !90)
!92 = !DILocalVariable(name: "bucket", arg: 1, scope: !90, file: !13, line: 79, type: !4)
!93 = !DILocalVariable(name: "index", arg: 2, scope: !90, file: !13, line: 79, type: !4)
!94 = !DILocation(line: 79, column: 51, scope: !90)
!95 = !DILocation(line: 79, column: 52, scope: !90)
!96 = !DILocation(line: 79, column: 58, scope: !90)
!97 = !DILocation(line: 79, column: 75, scope: !90)
!98 = !DILocation(line: 79, column: 81, scope: !90)
!99 = !{!16, !4, !19}
!100 = !DISubroutineType(types: !99)
!101 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 82, type: !100, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!102 = !DILocation(line: 82, column: 1, scope: !101)
!103 = !DILocalVariable(name: "bucket", arg: 1, scope: !101, file: !13, line: 82, type: !4)
!104 = !DILocalVariable(name: "h", arg: 2, scope: !101, file: !13, line: 82, type: !19)
!105 = !DILocation(line: 82, column: 48, scope: !101)
!106 = !DILocation(line: 82, column: 54, scope: !101)
!107 = !DILocation(line: 82, column: 55, scope: !101)
!108 = !DILocation(line: 82, column: 60, scope: !101)
!109 = !DILocation(line: 82, column: 61, scope: !101)
!110 = !DILocation(line: 82, column: 62, scope: !101)
!111 = !DILocation(line: 82, column: 68, scope: !101)
!112 = !DILocation(line: 82, column: 85, scope: !101)
!113 = !DILocation(line: 82, column: 91, scope: !101)
!114 = !{null, !23, !4, !19, !4}
!115 = !DISubroutineType(types: !114)
!116 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 118, type: !115, scopeLine: 118, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!117 = !DILocation(line: 118, column: 1, scope: !116)
!118 = !DILocalVariable(name: "slots", arg: 1, scope: !116, file: !13, line: 118, type: !23)
!119 = !DILocalVariable(name: "mask", arg: 2, scope: !116, file: !13, line: 118, type: !4)
!120 = !DILocalVariable(name: "h", arg: 3, scope: !116, file: !13, line: 118, type: !19)
!121 = !DILocalVariable(name: "index", arg: 4, scope: !116, file: !13, line: 118, type: !4)
!122 = !DILocation(line: 119, column: 3, scope: !116)
!123 = !DILocation(line: 119, column: 16, scope: !116)
!124 = !DILocation(line: 119, column: 25, scope: !116)
!125 = !DILocation(line: 119, column: 28, scope: !116)
!126 = !DILocalVariable(name: "word", scope: !116, file: !13, line: 119, type: !19)
!127 = !DILocation(line: 120, column: 3, scope: !116)
!128 = !DILocation(line: 120, column: 16, scope: !116)
!129 = !DILocation(line: 120, column: 27, scope: !116)
!130 = !DILocation(line: 120, column: 30, scope: !116)
!131 = !DILocalVariable(name: "bucket", scope: !116, file: !13, line: 120, type: !4)
!132 = !DILocation(line: 121, column: 3, scope: !116)
!133 = !DILocation(line: 121, column: 40, scope: !116)
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
!146 = !DILocation(line: 121, column: 10, scope: !116)
!147 = !DILocation(line: 121, column: 20, scope: !116)
!148 = !DILocation(line: 121, column: 25, scope: !116)
!149 = !DILocation(line: 121, column: 34, scope: !116)
!150 = !DILocation(line: 121, column: 55, scope: !116)
!151 = !DILocation(line: 122, column: 5, scope: !116)
!152 = !DILocation(line: 122, column: 9, scope: !116)
!153 = !DILocation(line: 122, column: 15, scope: !116)
!154 = !{!"element i32", !140, i64 0}
!155 = !{!154, !154, i64 0}
!156 = !DILocation(line: 122, column: 27, scope: !116)
!157 = !DILocation(line: 122, column: 30, scope: !116)
!158 = !DILocation(line: 123, column: 7, scope: !116)
!159 = !DILocation(line: 123, column: 13, scope: !116)
!160 = !DILocation(line: 123, column: 23, scope: !116)
!161 = !DILocation(line: 124, column: 7, scope: !116)
!162 = !DILocation(line: 126, column: 5, scope: !116)
!163 = !DILocation(line: 126, column: 14, scope: !116)
!164 = !DILocation(line: 126, column: 15, scope: !116)
!165 = !DILocation(line: 126, column: 24, scope: !116)
!166 = !DILocation(line: 126, column: 29, scope: !116)
!167 = !{null, !23}
!168 = !DISubroutineType(types: !167)
!169 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 146, type: !168, scopeLine: 146, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!170 = !DILocation(line: 146, column: 1, scope: !169)
!171 = !DILocalVariable(name: "hashes", arg: 1, scope: !169, file: !13, line: 146, type: !23)
!172 = !DILocation(line: 147, column: 3, scope: !169)
!173 = !DILocation(line: 147, column: 16, scope: !169)
!174 = !DILocation(line: 147, column: 22, scope: !169)
!175 = !DILocalVariable(name: "used", scope: !169, file: !13, line: 147, type: !4)
!176 = !DILocation(line: 148, column: 3, scope: !169)
!177 = !DILocation(line: 148, column: 17, scope: !169)
!178 = !DILocalVariable(name: "to", scope: !169, file: !13, line: 148, type: !4)
!179 = !DILocation(line: 149, column: 3, scope: !169)
!180 = !DILocation(line: 149, column: 24, scope: !169)
!181 = !DILocalVariable(name: "from", scope: !169, file: !13, line: 149, type: !4)
!182 = !DILocation(line: 150, column: 15, scope: !169)
!183 = !DILocation(line: 149, column: 27, scope: !169)
!184 = !DILocation(line: 149, column: 34, scope: !169)
!185 = !DILocation(line: 149, column: 48, scope: !169)
!186 = !DILocation(line: 150, column: 5, scope: !169)
!187 = !DILocation(line: 150, column: 22, scope: !169)
!188 = !DILocalVariable(name: "h", scope: !169, file: !13, line: 150, type: !19)
!189 = !DILocation(line: 151, column: 5, scope: !169)
!190 = !DILocation(line: 151, column: 9, scope: !169)
!191 = !DILocation(line: 151, column: 15, scope: !169)
!192 = !DILocation(line: 151, column: 20, scope: !169)
!193 = !DILocation(line: 151, column: 26, scope: !169)
!194 = !DILocation(line: 151, column: 31, scope: !169)
!195 = !DILocation(line: 151, column: 36, scope: !169)
!196 = !DILocation(line: 151, column: 42, scope: !169)
!197 = !DILocation(line: 152, column: 7, scope: !169)
!198 = !DILocation(line: 152, column: 14, scope: !169)
!199 = !DILocation(line: 152, column: 20, scope: !169)
!200 = !DILocation(line: 153, column: 7, scope: !169)
!201 = !DILocation(line: 149, column: 40, scope: !169)
!202 = !DILocation(line: 156, column: 3, scope: !169)
!203 = !DILocation(line: 156, column: 10, scope: !169)
!204 = !DILocation(line: 156, column: 16, scope: !169)
!205 = !DILocation(line: 156, column: 33, scope: !169)
!206 = !DILocation(line: 156, column: 37, scope: !169)
!207 = !DILocation(line: 157, column: 5, scope: !169)
!208 = !{!23, !23, !4, !4}
!209 = !DISubroutineType(types: !208)
!210 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 168, type: !209, scopeLine: 168, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!211 = !DILocation(line: 168, column: 1, scope: !210)
!212 = !DILocalVariable(name: "slots", arg: 1, scope: !210, file: !13, line: 168, type: !23)
!213 = !DILocalVariable(name: "live", arg: 2, scope: !210, file: !13, line: 168, type: !4)
!214 = !DILocalVariable(name: "used", arg: 3, scope: !210, file: !13, line: 168, type: !4)
!215 = !DILocation(line: 169, column: 3, scope: !210)
!216 = !DILocation(line: 169, column: 13, scope: !210)
!217 = !DILocation(line: 169, column: 19, scope: !210)
!218 = !DILocalVariable(name: "n", scope: !210, file: !13, line: 169, type: !4)
!219 = !DILocation(line: 170, column: 3, scope: !210)
!220 = !DILocation(line: 170, column: 7, scope: !210)
!221 = !DILocation(line: 170, column: 14, scope: !210)
!222 = !DILocation(line: 170, column: 18, scope: !210)
!223 = !DILocation(line: 170, column: 24, scope: !210)
!224 = !DILocation(line: 171, column: 5, scope: !210)
!225 = !DILocation(line: 171, column: 16, scope: !210)
!226 = !DILocation(line: 172, column: 5, scope: !210)
!227 = !DILocation(line: 172, column: 12, scope: !210)
!228 = !DILocation(line: 174, column: 3, scope: !210)
!229 = !DILocation(line: 174, column: 10, scope: !210)
!230 = !DILocation(line: 174, column: 25, scope: !210)
!231 = !DILocation(line: 174, column: 29, scope: !210)
!232 = !{!143, !141, i64 8}
!233 = !{null, !23, !23}
!234 = !DISubroutineType(types: !233)
!235 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 178, type: !234, scopeLine: 178, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!236 = !DILocation(line: 178, column: 1, scope: !235)
!237 = !DILocalVariable(name: "slots", arg: 1, scope: !235, file: !13, line: 178, type: !23)
!238 = !DILocalVariable(name: "hashes", arg: 2, scope: !235, file: !13, line: 178, type: !23)
!239 = !DILocation(line: 179, column: 3, scope: !235)
!240 = !DILocation(line: 179, column: 16, scope: !235)
!241 = !DILocation(line: 179, column: 22, scope: !235)
!242 = !DILocation(line: 179, column: 38, scope: !235)
!243 = !DILocalVariable(name: "mask", scope: !235, file: !13, line: 179, type: !4)
!244 = !DILocation(line: 180, column: 3, scope: !235)
!245 = !DILocation(line: 180, column: 21, scope: !235)
!246 = !DILocalVariable(name: "i", scope: !235, file: !13, line: 180, type: !4)
!247 = !DILocation(line: 180, column: 34, scope: !235)
!248 = !DILocation(line: 180, column: 24, scope: !235)
!249 = !DILocation(line: 180, column: 28, scope: !235)
!250 = !DILocation(line: 180, column: 55, scope: !235)
!251 = !DILocation(line: 181, column: 5, scope: !235)
!252 = !DILocation(line: 181, column: 15, scope: !235)
!253 = !DILocation(line: 181, column: 22, scope: !235)
!254 = !DILocation(line: 181, column: 28, scope: !235)
!255 = !DILocation(line: 181, column: 35, scope: !235)
!256 = !DILocation(line: 181, column: 39, scope: !235)
!257 = !DILocation(line: 180, column: 50, scope: !235)
!258 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 202, type: !168, scopeLine: 202, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!259 = !DILocation(line: 202, column: 1, scope: !258)
!260 = !DILocalVariable(name: "slots", arg: 1, scope: !258, file: !13, line: 202, type: !23)
!261 = !DILocation(line: 203, column: 3, scope: !258)
!262 = !DILocation(line: 203, column: 21, scope: !258)
!263 = !DILocalVariable(name: "i", scope: !258, file: !13, line: 203, type: !4)
!264 = !DILocation(line: 203, column: 34, scope: !258)
!265 = !DILocation(line: 203, column: 24, scope: !258)
!266 = !DILocation(line: 203, column: 28, scope: !258)
!267 = !DILocation(line: 203, column: 54, scope: !258)
!268 = !DILocation(line: 204, column: 5, scope: !258)
!269 = !DILocation(line: 204, column: 11, scope: !258)
!270 = !DILocation(line: 204, column: 16, scope: !258)
!271 = !DILocation(line: 203, column: 49, scope: !258)
!272 = !{null, !23, !4, !4, !19, !4}
!273 = !DISubroutineType(types: !272)
!274 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 220, type: !273, scopeLine: 220, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!275 = !DILocation(line: 220, column: 1, scope: !274)
!276 = !DILocalVariable(name: "slots", arg: 1, scope: !274, file: !13, line: 220, type: !23)
!277 = !DILocalVariable(name: "mask", arg: 2, scope: !274, file: !13, line: 220, type: !4)
!278 = !DILocalVariable(name: "bucket", arg: 3, scope: !274, file: !13, line: 220, type: !4)
!279 = !DILocalVariable(name: "h", arg: 4, scope: !274, file: !13, line: 220, type: !19)
!280 = !DILocalVariable(name: "used", arg: 5, scope: !274, file: !13, line: 220, type: !4)
!281 = !DILocation(line: 221, column: 3, scope: !274)
!282 = !DILocation(line: 221, column: 7, scope: !274)
!283 = !DILocation(line: 221, column: 17, scope: !274)
!284 = !DILocation(line: 221, column: 22, scope: !274)
!285 = !DILocation(line: 221, column: 31, scope: !274)
!286 = !DILocation(line: 221, column: 37, scope: !274)
!287 = !DILocation(line: 221, column: 52, scope: !274)
!288 = !DILocation(line: 222, column: 5, scope: !274)
!289 = !DILocation(line: 222, column: 11, scope: !274)
!290 = !DILocation(line: 222, column: 21, scope: !274)
!291 = !DILocation(line: 222, column: 30, scope: !274)
!292 = !DILocation(line: 222, column: 33, scope: !274)
!293 = !DILocation(line: 222, column: 40, scope: !274)
!294 = !DILocation(line: 223, column: 10, scope: !274)
!295 = !DILocation(line: 224, column: 5, scope: !274)
!296 = !DILocation(line: 224, column: 15, scope: !274)
!297 = !DILocation(line: 224, column: 22, scope: !274)
!298 = !DILocation(line: 224, column: 28, scope: !274)
!299 = !DILocation(line: 224, column: 31, scope: !274)
!300 = !DILocation(line: 224, column: 38, scope: !274)
!301 = !{null, !12}
!302 = !DISubroutineType(types: !301)
!303 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 248, type: !302, scopeLine: 248, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!304 = !DILocation(line: 248, column: 3, scope: !303)
!305 = !DILocalVariable(name: "this", arg: 1, scope: !303, file: !13, line: 248, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!306 = !{!"i32", !140, i64 0}
!307 = !{!"ptr", !140, i64 0}
!308 = !{!"Map$str$i32", !306, i64 0, !307, i64 8, !306, i64 16, !306, i64 20, !307, i64 24, !307, i64 32, !307, i64 40}
!309 = !{!308, !306, i64 0}
!310 = !{!308, !306, i64 16}
!311 = !{!308, !306, i64 20}
!312 = !DILocation(line: 249, column: 5, scope: !303)
!313 = !DILocation(line: 249, column: 18, scope: !303)
!314 = !DILocation(line: 249, column: 33, scope: !303)
!315 = !{!308, !307, i64 8}
!316 = !DILocation(line: 250, column: 5, scope: !303)
!317 = !DILocation(line: 250, column: 22, scope: !303)
!318 = !{!308, !307, i64 24}
!319 = !DILocation(line: 251, column: 5, scope: !303)
!320 = !DILocation(line: 251, column: 24, scope: !303)
!321 = !{!308, !307, i64 32}
!322 = !DILocation(line: 252, column: 5, scope: !303)
!323 = !DILocation(line: 252, column: 24, scope: !303)
!324 = !{!308, !307, i64 40}
!325 = !{!16, !12, !31}
!326 = !DISubroutineType(types: !325)
!327 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 256, type: !326, scopeLine: 256, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!328 = !DILocation(line: 256, column: 3, scope: !327)
!329 = !DILocalVariable(name: "this", arg: 1, scope: !327, file: !13, line: 256, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!330 = !DILocalVariable(name: "key", arg: 2, scope: !327, file: !13, line: 256, type: !31)
!331 = !DILocation(line: 257, column: 5, scope: !327)
!332 = !DILocation(line: 257, column: 12, scope: !327)
!333 = !DILocation(line: 257, column: 23, scope: !327)
!334 = !DILocation(line: 257, column: 35, scope: !327)
!335 = !DILocation(line: 257, column: 46, scope: !327)
!336 = !DILocation(line: 257, column: 64, scope: !327)
!337 = !DILocation(line: 257, column: 80, scope: !327)
!338 = !{!12, !12, !31, !4}
!339 = !DISubroutineType(types: !338)
!340 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 265, type: !339, scopeLine: 265, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!341 = !DILocation(line: 265, column: 3, scope: !340)
!342 = !DILocalVariable(name: "this", arg: 1, scope: !340, file: !13, line: 265, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!343 = !DILocalVariable(name: "key", arg: 2, scope: !340, file: !13, line: 265, type: !31)
!344 = !DILocalVariable(name: "value", arg: 3, scope: !340, file: !13, line: 265, type: !4)
!345 = !DILocation(line: 266, column: 5, scope: !340)
!346 = !DILocation(line: 266, column: 19, scope: !340)
!347 = !DILocation(line: 266, column: 30, scope: !340)
!348 = !DILocalVariable(name: "found", scope: !340, file: !13, line: 266, type: !16)
!349 = !DILocation(line: 267, column: 5, scope: !340)
!350 = !DILocation(line: 267, column: 9, scope: !340)
!351 = !DILocation(line: 267, column: 18, scope: !340)
!352 = !DILocation(line: 267, column: 21, scope: !340)
!353 = !DILocation(line: 268, column: 7, scope: !340)
!354 = !DILocation(line: 268, column: 23, scope: !340)
!355 = !DILocation(line: 268, column: 29, scope: !340)
!356 = !DILocation(line: 268, column: 37, scope: !340)
!357 = !DILocation(line: 269, column: 12, scope: !340)
!358 = !DILocation(line: 270, column: 7, scope: !340)
!359 = !DILocation(line: 270, column: 21, scope: !340)
!360 = !DILocation(line: 270, column: 28, scope: !340)
!361 = !DILocation(line: 270, column: 33, scope: !340)
!362 = !DILocation(line: 272, column: 5, scope: !340)
!363 = !DILocation(line: 272, column: 12, scope: !340)
!364 = !{!4, !12, !4}
!365 = !DISubroutineType(types: !364)
!366 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 297, type: !365, scopeLine: 297, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!367 = !DILocation(line: 297, column: 3, scope: !366)
!368 = !DILocalVariable(name: "this", arg: 1, scope: !366, file: !13, line: 297, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!369 = !DILocalVariable(name: "index", arg: 2, scope: !366, file: !13, line: 297, type: !4)
!370 = !DILocation(line: 298, column: 5, scope: !366)
!371 = !DILocation(line: 298, column: 9, scope: !366)
!372 = !DILocation(line: 298, column: 17, scope: !366)
!373 = !DILocation(line: 298, column: 22, scope: !366)
!374 = !DILocation(line: 298, column: 31, scope: !366)
!375 = !DILocation(line: 298, column: 37, scope: !366)
!376 = !DILocation(line: 298, column: 63, scope: !366)
!377 = !DILocation(line: 299, column: 7, scope: !366)
!378 = !DILocation(line: 299, column: 13, scope: !366)
!379 = !DILocation(line: 301, column: 5, scope: !366)
!380 = !DILocation(line: 301, column: 12, scope: !366)
!381 = !DILocation(line: 301, column: 29, scope: !366)
!382 = !{null, !12, !4, !4}
!383 = !DISubroutineType(types: !382)
!384 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 305, type: !383, scopeLine: 305, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!385 = !DILocation(line: 305, column: 3, scope: !384)
!386 = !DILocalVariable(name: "this", arg: 1, scope: !384, file: !13, line: 305, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!387 = !DILocalVariable(name: "index", arg: 2, scope: !384, file: !13, line: 305, type: !4)
!388 = !DILocalVariable(name: "value", arg: 3, scope: !384, file: !13, line: 305, type: !4)
!389 = !DILocation(line: 306, column: 5, scope: !384)
!390 = !DILocation(line: 306, column: 9, scope: !384)
!391 = !DILocation(line: 306, column: 18, scope: !384)
!392 = !DILocation(line: 306, column: 23, scope: !384)
!393 = !DILocation(line: 306, column: 31, scope: !384)
!394 = !DILocation(line: 306, column: 37, scope: !384)
!395 = !DILocation(line: 306, column: 63, scope: !384)
!396 = !DILocation(line: 307, column: 7, scope: !384)
!397 = !DILocation(line: 307, column: 24, scope: !384)
!398 = !DILocation(line: 307, column: 33, scope: !384)
!399 = !{null, !12, !16, !31, !4}
!400 = !DISubroutineType(types: !399)
!401 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 312, type: !400, scopeLine: 312, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!402 = !DILocation(line: 312, column: 3, scope: !401)
!403 = !DILocalVariable(name: "this", arg: 1, scope: !401, file: !13, line: 312, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!404 = !DILocalVariable(name: "absent", arg: 2, scope: !401, file: !13, line: 312, type: !16)
!405 = !DILocalVariable(name: "key", arg: 3, scope: !401, file: !13, line: 312, type: !31)
!406 = !DILocalVariable(name: "value", arg: 4, scope: !401, file: !13, line: 312, type: !4)
!407 = !DILocation(line: 313, column: 5, scope: !401)
!408 = !DILocation(line: 313, column: 20, scope: !401)
!409 = !DILocation(line: 313, column: 21, scope: !401)
!410 = !DILocation(line: 313, column: 25, scope: !401)
!411 = !DILocalVariable(name: "packed", scope: !401, file: !13, line: 313, type: !16)
!412 = !DILocation(line: 314, column: 5, scope: !401)
!413 = !DILocation(line: 314, column: 18, scope: !401)
!414 = !DILocation(line: 314, column: 24, scope: !401)
!415 = !DILocalVariable(name: "bucket", scope: !401, file: !13, line: 314, type: !4)
!416 = !DILocation(line: 315, column: 5, scope: !401)
!417 = !DILocation(line: 315, column: 15, scope: !401)
!418 = !DILocation(line: 315, column: 21, scope: !401)
!419 = !DILocalVariable(name: "h", scope: !401, file: !13, line: 315, type: !19)
!420 = !DILocation(line: 316, column: 5, scope: !401)
!421 = !DILocation(line: 316, column: 9, scope: !401)
!422 = !DILocation(line: 316, column: 15, scope: !401)
!423 = !DILocation(line: 316, column: 41, scope: !401)
!424 = !DILocation(line: 316, column: 52, scope: !401)
!425 = !DILocation(line: 317, column: 7, scope: !401)
!426 = !DILocation(line: 317, column: 11, scope: !401)
!427 = !DILocation(line: 317, column: 24, scope: !401)
!428 = !DILocation(line: 317, column: 35, scope: !401)
!429 = !DILocation(line: 318, column: 9, scope: !401)
!430 = !DILocation(line: 318, column: 15, scope: !401)
!431 = !DILocation(line: 321, column: 7, scope: !401)
!432 = !DILocation(line: 322, column: 7, scope: !401)
!433 = !DILocation(line: 322, column: 16, scope: !401)
!434 = !DILocation(line: 322, column: 17, scope: !401)
!435 = !DILocation(line: 324, column: 5, scope: !401)
!436 = !DILocation(line: 324, column: 25, scope: !401)
!437 = !{!"element ptr", !140, i64 0}
!438 = !{!437, !437, i64 0}
!439 = !DILocation(line: 325, column: 5, scope: !401)
!440 = !DILocation(line: 325, column: 27, scope: !401)
!441 = !DILocation(line: 326, column: 5, scope: !401)
!442 = !DILocation(line: 326, column: 27, scope: !401)
!443 = !DILocation(line: 327, column: 5, scope: !401)
!444 = !DILocation(line: 327, column: 17, scope: !401)
!445 = !DILocation(line: 327, column: 29, scope: !401)
!446 = !DILocation(line: 328, column: 5, scope: !401)
!447 = !DILocation(line: 328, column: 17, scope: !401)
!448 = !DILocation(line: 328, column: 29, scope: !401)
!449 = !DILocation(line: 331, column: 5, scope: !401)
!450 = !DILocation(line: 331, column: 18, scope: !401)
!451 = !DILocation(line: 331, column: 24, scope: !401)
!452 = !DILocalVariable(name: "used", scope: !401, file: !13, line: 331, type: !4)
!453 = !DILocation(line: 332, column: 5, scope: !401)
!454 = !DILocation(line: 332, column: 9, scope: !401)
!455 = !DILocation(line: 332, column: 16, scope: !401)
!456 = !DILocation(line: 332, column: 20, scope: !401)
!457 = !DILocation(line: 332, column: 26, scope: !401)
!458 = !DILocation(line: 332, column: 47, scope: !401)
!459 = !DILocation(line: 332, column: 50, scope: !401)
!460 = !DILocation(line: 333, column: 7, scope: !401)
!461 = !DILocation(line: 334, column: 12, scope: !401)
!462 = !DILocation(line: 335, column: 7, scope: !401)
!463 = !DILocation(line: 335, column: 20, scope: !401)
!464 = !DILocation(line: 335, column: 32, scope: !401)
!465 = !DILocation(line: 335, column: 43, scope: !401)
!466 = !DILocation(line: 335, column: 51, scope: !401)
!467 = !DILocation(line: 335, column: 54, scope: !401)
!468 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 340, type: !302, scopeLine: 340, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!469 = !DILocation(line: 340, column: 3, scope: !468)
!470 = !DILocalVariable(name: "this", arg: 1, scope: !468, file: !13, line: 340, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!471 = !DILocation(line: 341, column: 5, scope: !468)
!472 = !DILocation(line: 341, column: 18, scope: !468)
!473 = !DILocation(line: 341, column: 24, scope: !468)
!474 = !DILocalVariable(name: "used", scope: !468, file: !13, line: 341, type: !4)
!475 = !DILocation(line: 342, column: 5, scope: !468)
!476 = !DILocation(line: 342, column: 19, scope: !468)
!477 = !DILocation(line: 342, column: 32, scope: !468)
!478 = !DILocation(line: 342, column: 44, scope: !468)
!479 = !DILocation(line: 342, column: 55, scope: !468)
!480 = !DILocalVariable(name: "slots", scope: !468, file: !13, line: 342, type: !23)
!481 = !DILocation(line: 343, column: 5, scope: !468)
!482 = !DILocation(line: 343, column: 9, scope: !468)
!483 = !DILocation(line: 343, column: 21, scope: !468)
!484 = !DILocation(line: 343, column: 27, scope: !468)
!485 = !DILocation(line: 344, column: 7, scope: !468)
!486 = !DILocation(line: 344, column: 22, scope: !468)
!487 = !DILocation(line: 344, column: 38, scope: !468)
!488 = !DILocation(line: 345, column: 7, scope: !468)
!489 = !DILocation(line: 345, column: 22, scope: !468)
!490 = !DILocation(line: 345, column: 40, scope: !468)
!491 = !DILocation(line: 346, column: 7, scope: !468)
!492 = !DILocation(line: 346, column: 21, scope: !468)
!493 = !DILocation(line: 348, column: 5, scope: !468)
!494 = !DILocation(line: 348, column: 18, scope: !468)
!495 = !DILocation(line: 349, column: 5, scope: !468)
!496 = !DILocation(line: 349, column: 17, scope: !468)
!497 = !DILocation(line: 349, column: 23, scope: !468)
!498 = !DILocation(line: 349, column: 39, scope: !468)
!499 = !DILocation(line: 350, column: 5, scope: !468)
!500 = !DILocation(line: 350, column: 12, scope: !468)
!501 = !DILocation(line: 350, column: 19, scope: !468)
!502 = !{!16, !23, !4, !23, !35, !31}
!503 = !DISubroutineType(types: !502)
!504 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 91, type: !503, scopeLine: 91, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!505 = !DILocation(line: 91, column: 1, scope: !504)
!506 = !DILocalVariable(name: "slots", arg: 1, scope: !504, file: !13, line: 91, type: !23)
!507 = !DILocalVariable(name: "mask", arg: 2, scope: !504, file: !13, line: 91, type: !4)
!508 = !DILocalVariable(name: "hashes", arg: 3, scope: !504, file: !13, line: 91, type: !23)
!509 = !DILocalVariable(name: "keys", arg: 4, scope: !504, file: !13, line: 91, type: !35)
!510 = !DILocalVariable(name: "key", arg: 5, scope: !504, file: !13, line: 91, type: !31)
!511 = !DILocation(line: 92, column: 3, scope: !504)
!512 = !DILocation(line: 92, column: 13, scope: !504)
!513 = !DILocation(line: 92, column: 21, scope: !504)
!514 = !DILocalVariable(name: "h", scope: !504, file: !13, line: 92, type: !19)
!515 = !DILocation(line: 93, column: 3, scope: !504)
!516 = !DILocation(line: 93, column: 23, scope: !504)
!517 = !DILocalVariable(name: "fingerprint", scope: !504, file: !13, line: 93, type: !19)
!518 = !DILocation(line: 94, column: 3, scope: !504)
!519 = !DILocation(line: 94, column: 16, scope: !504)
!520 = !DILocation(line: 94, column: 27, scope: !504)
!521 = !DILocation(line: 94, column: 30, scope: !504)
!522 = !DILocalVariable(name: "bucket", scope: !504, file: !13, line: 94, type: !4)
!523 = !DILocation(line: 97, column: 3, scope: !504)
!524 = !DILocation(line: 97, column: 40, scope: !504)
!525 = !DILocation(line: 104, column: 33, scope: !504)
!526 = !DILocation(line: 104, column: 82, scope: !504)
!527 = !DILocation(line: 97, column: 10, scope: !504)
!528 = !DILocation(line: 97, column: 20, scope: !504)
!529 = !DILocation(line: 97, column: 25, scope: !504)
!530 = !DILocation(line: 97, column: 34, scope: !504)
!531 = !DILocation(line: 97, column: 55, scope: !504)
!532 = !DILocation(line: 98, column: 5, scope: !504)
!533 = !DILocation(line: 98, column: 18, scope: !504)
!534 = !DILocation(line: 98, column: 24, scope: !504)
!535 = !DILocalVariable(name: "word", scope: !504, file: !13, line: 98, type: !19)
!536 = !DILocation(line: 99, column: 5, scope: !504)
!537 = !DILocation(line: 99, column: 9, scope: !504)
!538 = !DILocation(line: 99, column: 18, scope: !504)
!539 = !DILocation(line: 99, column: 21, scope: !504)
!540 = !DILocation(line: 100, column: 7, scope: !504)
!541 = !DILocation(line: 100, column: 14, scope: !504)
!542 = !DILocation(line: 100, column: 23, scope: !504)
!543 = !DILocation(line: 100, column: 31, scope: !504)
!544 = !DILocation(line: 102, column: 5, scope: !504)
!545 = !DILocation(line: 102, column: 9, scope: !504)
!546 = !DILocation(line: 102, column: 25, scope: !504)
!547 = !DILocation(line: 102, column: 38, scope: !504)
!548 = !DILocation(line: 103, column: 7, scope: !504)
!549 = !DILocation(line: 103, column: 18, scope: !504)
!550 = !DILocation(line: 103, column: 24, scope: !504)
!551 = !DILocation(line: 103, column: 31, scope: !504)
!552 = !DILocation(line: 103, column: 43, scope: !504)
!553 = !DILocalVariable(name: "at", scope: !504, file: !13, line: 103, type: !4)
!554 = !DILocation(line: 104, column: 7, scope: !504)
!555 = !DILocation(line: 104, column: 11, scope: !504)
!556 = !DILocation(line: 104, column: 17, scope: !504)
!557 = !DILocation(line: 104, column: 22, scope: !504)
!558 = !DILocation(line: 104, column: 27, scope: !504)
!559 = !DILocation(line: 104, column: 51, scope: !504)
!560 = !DILocation(line: 104, column: 58, scope: !504)
!561 = !DILocation(line: 104, column: 66, scope: !504)
!562 = !DILocation(line: 104, column: 71, scope: !504)
!563 = !DILocation(line: 104, column: 76, scope: !504)
!564 = !DILocation(line: 104, column: 98, scope: !504)
!565 = !DILocation(line: 104, column: 106, scope: !504)
!566 = !DILocation(line: 104, column: 111, scope: !504)
!567 = !DILocation(line: 104, column: 116, scope: !504)
!568 = !DILocation(line: 104, column: 122, scope: !504)
!569 = !DILocation(line: 105, column: 9, scope: !504)
!570 = !DILocation(line: 105, column: 16, scope: !504)
!571 = !DILocation(line: 105, column: 24, scope: !504)
!572 = !DILocation(line: 105, column: 32, scope: !504)
!573 = !DILocation(line: 108, column: 5, scope: !504)
!574 = !DILocation(line: 108, column: 14, scope: !504)
!575 = !DILocation(line: 108, column: 15, scope: !504)
!576 = !DILocation(line: 108, column: 24, scope: !504)
!577 = !DILocation(line: 108, column: 29, scope: !504)
!578 = !DILocation(line: 110, column: 3, scope: !504)
!579 = !DILocation(line: 110, column: 9, scope: !504)
!580 = !{null, !35, !23}
!581 = !DISubroutineType(types: !580)
!582 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 131, type: !581, scopeLine: 131, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!583 = !DILocation(line: 131, column: 1, scope: !582)
!584 = !DILocalVariable(name: "items", arg: 1, scope: !582, file: !13, line: 131, type: !35)
!585 = !DILocalVariable(name: "hashes", arg: 2, scope: !582, file: !13, line: 131, type: !23)
!586 = !DILocation(line: 132, column: 3, scope: !582)
!587 = !DILocation(line: 132, column: 16, scope: !582)
!588 = !DILocation(line: 132, column: 22, scope: !582)
!589 = !DILocalVariable(name: "used", scope: !582, file: !13, line: 132, type: !4)
!590 = !DILocation(line: 133, column: 3, scope: !582)
!591 = !DILocation(line: 133, column: 17, scope: !582)
!592 = !DILocalVariable(name: "to", scope: !582, file: !13, line: 133, type: !4)
!593 = !DILocation(line: 134, column: 3, scope: !582)
!594 = !DILocation(line: 134, column: 24, scope: !582)
!595 = !DILocalVariable(name: "from", scope: !582, file: !13, line: 134, type: !4)
!596 = !DILocation(line: 134, column: 55, scope: !582)
!597 = !DILocation(line: 135, column: 68, scope: !582)
!598 = !DILocation(line: 134, column: 27, scope: !582)
!599 = !DILocation(line: 134, column: 34, scope: !582)
!600 = !DILocation(line: 134, column: 42, scope: !582)
!601 = !DILocation(line: 134, column: 49, scope: !582)
!602 = !DILocation(line: 134, column: 79, scope: !582)
!603 = !DILocation(line: 135, column: 5, scope: !582)
!604 = !DILocation(line: 135, column: 9, scope: !582)
!605 = !DILocation(line: 135, column: 16, scope: !582)
!606 = !DILocation(line: 135, column: 26, scope: !582)
!607 = !DILocation(line: 135, column: 31, scope: !582)
!608 = !DILocation(line: 135, column: 37, scope: !582)
!609 = !DILocation(line: 135, column: 42, scope: !582)
!610 = !DILocation(line: 135, column: 47, scope: !582)
!611 = !DILocation(line: 135, column: 55, scope: !582)
!612 = !DILocation(line: 135, column: 62, scope: !582)
!613 = !DILocation(line: 135, column: 83, scope: !582)
!614 = !DILocation(line: 136, column: 7, scope: !582)
!615 = !DILocation(line: 136, column: 13, scope: !582)
!616 = !DILocation(line: 136, column: 19, scope: !582)
!617 = !DILocation(line: 136, column: 25, scope: !582)
!618 = !DILocation(line: 137, column: 7, scope: !582)
!619 = !DILocation(line: 134, column: 71, scope: !582)
!620 = !DILocation(line: 140, column: 3, scope: !582)
!621 = !DILocation(line: 140, column: 10, scope: !582)
!622 = !DILocation(line: 140, column: 16, scope: !582)
!623 = !DILocation(line: 140, column: 32, scope: !582)
!624 = !DILocation(line: 140, column: 36, scope: !582)
!625 = !DILocation(line: 141, column: 5, scope: !582)
!626 = !{null, !43, !23}
!627 = !DISubroutineType(types: !626)
!628 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 131, type: !627, scopeLine: 131, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!629 = !DILocation(line: 131, column: 1, scope: !628)
!630 = !DILocalVariable(name: "items", arg: 1, scope: !628, file: !13, line: 131, type: !43)
!631 = !DILocalVariable(name: "hashes", arg: 2, scope: !628, file: !13, line: 131, type: !23)
!632 = !DILocation(line: 132, column: 3, scope: !628)
!633 = !DILocation(line: 132, column: 16, scope: !628)
!634 = !DILocation(line: 132, column: 22, scope: !628)
!635 = !DILocalVariable(name: "used", scope: !628, file: !13, line: 132, type: !4)
!636 = !DILocation(line: 133, column: 3, scope: !628)
!637 = !DILocation(line: 133, column: 17, scope: !628)
!638 = !DILocalVariable(name: "to", scope: !628, file: !13, line: 133, type: !4)
!639 = !DILocation(line: 134, column: 3, scope: !628)
!640 = !DILocation(line: 134, column: 24, scope: !628)
!641 = !DILocalVariable(name: "from", scope: !628, file: !13, line: 134, type: !4)
!642 = !DILocation(line: 134, column: 55, scope: !628)
!643 = !DILocation(line: 135, column: 68, scope: !628)
!644 = !DILocation(line: 134, column: 27, scope: !628)
!645 = !DILocation(line: 134, column: 34, scope: !628)
!646 = !DILocation(line: 134, column: 42, scope: !628)
!647 = !DILocation(line: 134, column: 49, scope: !628)
!648 = !DILocation(line: 134, column: 79, scope: !628)
!649 = !DILocation(line: 135, column: 5, scope: !628)
!650 = !DILocation(line: 135, column: 9, scope: !628)
!651 = !DILocation(line: 135, column: 16, scope: !628)
!652 = !DILocation(line: 135, column: 26, scope: !628)
!653 = !DILocation(line: 135, column: 31, scope: !628)
!654 = !DILocation(line: 135, column: 37, scope: !628)
!655 = !DILocation(line: 135, column: 42, scope: !628)
!656 = !DILocation(line: 135, column: 47, scope: !628)
!657 = !DILocation(line: 135, column: 55, scope: !628)
!658 = !DILocation(line: 135, column: 62, scope: !628)
!659 = !DILocation(line: 135, column: 83, scope: !628)
!660 = !DILocation(line: 136, column: 7, scope: !628)
!661 = !DILocation(line: 136, column: 13, scope: !628)
!662 = !DILocation(line: 136, column: 19, scope: !628)
!663 = !DILocation(line: 136, column: 25, scope: !628)
!664 = !DILocation(line: 137, column: 7, scope: !628)
!665 = !DILocation(line: 134, column: 71, scope: !628)
!666 = !DILocation(line: 140, column: 3, scope: !628)
!667 = !DILocation(line: 140, column: 10, scope: !628)
!668 = !DILocation(line: 140, column: 16, scope: !628)
!669 = !DILocation(line: 140, column: 32, scope: !628)
!670 = !DILocation(line: 140, column: 36, scope: !628)
!671 = !DILocation(line: 141, column: 5, scope: !628)
