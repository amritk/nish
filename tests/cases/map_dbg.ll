%struct.Set$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  %s.addr = alloca %struct.Set$i32*, align 8
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = call i8* @nish_alloc_struct(i64 48), !dbg !10
  %1 = bitcast i8* %0 to %struct.Set$i32*, !dbg !10
  call void @nish.Set$i32.constructor(%struct.Set$i32* %1), !dbg !10
  store %struct.Set$i32* %1, %struct.Set$i32** %s.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Set$i32** %s.addr, metadata !38, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !39
  %3 = call %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* %2, i32 3), !dbg !39
  %4 = call %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* %3, i32 4), !dbg !39
  %5 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !44
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %5, i32 0, i32 0, !dbg !44
  %7 = load i32, i32* %6, align 4, !tbaa !50, !dbg !44
  %8 = call i8* @nish_str_from_i32(i32 %7), !dbg !43
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !43
  %10 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !51
  %11 = call i1 @nish.Set$i32.has(%struct.Set$i32* %10, i32 3), !dbg !51
  %12 = select i1 %11, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), !dbg !43
  %13 = call i8* @nish_str_concat(i8* %9, i8* %12), !dbg !43
  call void @nish_print(i8* %13), !dbg !42
  call void @nish_arena_release(i64 %arena.mark), !dbg !53
  ret i32 0, !dbg !53
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !55 {
entry:
  %0 = call i32 @nish_main(), !dbg !56
  call void @nish_free_arena(), !dbg !56
  ret i32 %0, !dbg !56
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 !dbg !59 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !61, metadata !DIExpression()), !dbg !60
  call void @llvm.dbg.value(metadata i32 %mask, metadata !62, metadata !DIExpression()), !dbg !60
  %0 = lshr i32 %h, 16, !dbg !66
  %1 = xor i32 %h, %0, !dbg !64
  %2 = and i32 %1, %mask, !dbg !63
  ret i32 %2, !dbg !60
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 !dbg !70 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !72, metadata !DIExpression()), !dbg !71
  call void @llvm.dbg.value(metadata i32 %index, metadata !73, metadata !DIExpression()), !dbg !71
  %0 = lshr i32 %h, 24, !dbg !76
  %1 = shl i32 %0, 24, !dbg !75
  %2 = add nsw i32 %index, 1, !dbg !78
  %3 = or i32 %1, %2, !dbg !74
  ret i32 %3, !dbg !71
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !82 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !84, metadata !DIExpression()), !dbg !83
  call void @llvm.dbg.value(metadata i32 %index, metadata !85, metadata !DIExpression()), !dbg !83
  %0 = sext i32 %bucket to i64, !dbg !87
  %1 = shl i64 %0, 32, !dbg !87
  %2 = sext i32 %index to i64, !dbg !89
  %3 = or i64 %1, %2, !dbg !86
  ret i64 %3, !dbg !83
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !93 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !95, metadata !DIExpression()), !dbg !94
  call void @llvm.dbg.value(metadata i32 %h, metadata !96, metadata !DIExpression()), !dbg !94
  %0 = sub nsw i32 0, 1, !dbg !98
  %1 = sext i32 %0 to i64, !dbg !97
  %2 = sext i32 %bucket to i64, !dbg !102
  %3 = shl i64 %2, 32, !dbg !102
  %4 = zext i32 %h to i64, !dbg !104
  %5 = or i64 %3, %4, !dbg !101
  %6 = sub nsw i64 %1, %5, !dbg !97
  ret i64 %6, !dbg !94
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !108 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !110, metadata !DIExpression()), !dbg !109
  call void @llvm.dbg.value(metadata i32 %mask, metadata !111, metadata !DIExpression()), !dbg !109
  call void @llvm.dbg.value(metadata i32 %h, metadata !112, metadata !DIExpression()), !dbg !109
  call void @llvm.dbg.value(metadata i32 %index, metadata !113, metadata !DIExpression()), !dbg !109
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !115
  store i32 %0, i32* %word.addr, align 4, !dbg !114
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !118, metadata !DIExpression()), !dbg !114
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !120
  store i32 %1, i32* %bucket.addr, align 4, !dbg !119
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !123, metadata !DIExpression()), !dbg !119
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !124
  %3 = load i64, i64* %2, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !124
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !124
  %5 = load i8*, i8** %4, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !124
  br label %while.cond, !dbg !124

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !136
  %7 = icmp sge i32 %6, 0, !dbg !136
  br i1 %7, label %land.rhs, label %land.end, !dbg !136

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !138
  %9 = trunc i64 %3 to i32, !dbg !125
  %10 = icmp slt i32 %8, %9, !dbg !138
  br label %land.end, !dbg !136

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !136
  br i1 %11, label %while.body, label %while.end, !dbg !124

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !143
  %13 = sext i32 %12 to i64, !dbg !142
  %14 = bitcast i8* %5 to i32*, !dbg !142
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !142
  %16 = load i32, i32* %15, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !142
  %17 = icmp eq i32 %16, 0, !dbg !142
  br i1 %17, label %if.then, label %if.end, !dbg !141

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !149
  %19 = sext i32 %18 to i64, !dbg !148
  %20 = load i32, i32* %word.addr, align 4, !dbg !150
  %21 = bitcast i8* %5 to i32*, !dbg !148
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !148
  store i32 %20, i32* %22, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !148
  ret void, !dbg !151

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !154
  %24 = add nsw i32 %23, 1, !dbg !154
  %25 = and i32 %24, %mask, !dbg !153
  store i32 %25, i32* %bucket.addr, align 4, !dbg !152
  br label %while.cond, !dbg !124

while.end:
  ret void, !dbg !109
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !159 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !161, metadata !DIExpression()), !dbg !160
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !164
  %1 = load i64, i64* %0, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !164
  %2 = trunc i64 %1 to i32, !dbg !164
  store i32 %2, i32* %used.addr, align 4, !dbg !162
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !165, metadata !DIExpression()), !dbg !162
  store i32 0, i32* %to.addr, align 4, !dbg !166
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !168, metadata !DIExpression()), !dbg !166
  store i32 0, i32* %from.addr, align 4, !dbg !169
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !171, metadata !DIExpression()), !dbg !169
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !169
  %4 = load i8*, i8** %3, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !169
  br label %for.cond, !dbg !169

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !173
  %6 = load i32, i32* %used.addr, align 4, !dbg !174
  %7 = icmp slt i32 %5, %6, !dbg !173
  br i1 %7, label %for.body, label %for.end, !dbg !169

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !177
  %9 = sext i32 %8 to i64, !dbg !172
  %10 = bitcast i8* %4 to i32*, !dbg !172
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !172
  %12 = load i32, i32* %11, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !172
  store i32 %12, i32* %h.addr, align 4, !dbg !176
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !178, metadata !DIExpression()), !dbg !176
  %13 = load i32, i32* %h.addr, align 4, !dbg !180
  %14 = icmp ne i32 %13, 0, !dbg !180
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !180

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !182
  %16 = icmp sge i32 %15, 0, !dbg !182
  br label %land.end.1, !dbg !180

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !180
  br i1 %17, label %land.rhs, label %land.end, !dbg !180

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !184
  %19 = load i32, i32* %used.addr, align 4, !dbg !185
  %20 = icmp slt i32 %18, %19, !dbg !184
  br label %land.end, !dbg !180

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !180
  br i1 %21, label %if.then, label %if.end, !dbg !179

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !188
  %23 = sext i32 %22 to i64, !dbg !187
  %24 = load i32, i32* %h.addr, align 4, !dbg !189
  %25 = bitcast i8* %4 to i32*, !dbg !187
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !187
  store i32 %24, i32* %26, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !187
  %27 = load i32, i32* %to.addr, align 4, !dbg !190
  %28 = add nsw i32 %27, 1, !dbg !190
  store i32 %28, i32* %to.addr, align 4, !dbg !190
  br label %if.end, !dbg !179

if.end:
  br label %for.inc, !dbg !169

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !191
  %30 = add nsw i32 %29, 1, !dbg !191
  store i32 %30, i32* %from.addr, align 4, !dbg !191
  br label %for.cond, !dbg !169

for.end:
  br label %while.cond, !dbg !192

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !194
  %32 = load i64, i64* %31, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !194
  %33 = trunc i64 %32 to i32, !dbg !194
  %34 = load i32, i32* %to.addr, align 4, !dbg !195
  %35 = icmp sgt i32 %33, %34, !dbg !193
  br i1 %35, label %while.body, label %while.end, !dbg !192

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !197
  %37 = load i64, i64* %36, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !197
  %38 = icmp eq i64 %37, 0, !dbg !197
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !197

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !197
  unreachable, !dbg !197

pop.ok:
  %39 = sub i64 %37, 1, !dbg !197
  store i64 %39, i64* %36, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !197
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !197
  %41 = load i8*, i8** %40, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !197
  %42 = bitcast i8* %41 to i32*, !dbg !197
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !197
  %44 = load i32, i32* %43, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !197
  br label %while.cond, !dbg !192

while.end:
  ret void, !dbg !160
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !200 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !202, metadata !DIExpression()), !dbg !201
  call void @llvm.dbg.value(metadata i32 %live, metadata !203, metadata !DIExpression()), !dbg !201
  call void @llvm.dbg.value(metadata i32 %used, metadata !204, metadata !DIExpression()), !dbg !201
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !207
  %1 = load i64, i64* %0, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !207
  %2 = trunc i64 %1 to i32, !dbg !207
  store i32 %2, i32* %n.addr, align 4, !dbg !205
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !208, metadata !DIExpression()), !dbg !205
  %3 = mul nsw i32 %live, 2, !dbg !210
  %4 = icmp slt i32 %3, %used, !dbg !210
  br i1 %4, label %if.then, label %if.end, !dbg !209

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !214
  ret %struct.nish_array* %slots, !dbg !216

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !220
  %6 = mul nsw i32 %5, 2, !dbg !220
  %7 = sext i32 %6 to i64, !dbg !219
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !219
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !219
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !219
  store i64 %7, i64* %10, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !219
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !219
  store i64 %7, i64* %11, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !219
  %12 = mul i64 %7, 4, !dbg !219
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !219
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !130, !noalias !129, !dbg !219
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !219
  store i8* %13, i8** %14, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !219
  ret %struct.nish_array* %9, !dbg !218
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !225 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !227, metadata !DIExpression()), !dbg !226
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !228, metadata !DIExpression()), !dbg !226
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !231
  %1 = load i64, i64* %0, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !231
  %2 = trunc i64 %1 to i32, !dbg !231
  %3 = sub nsw i32 %2, 1, !dbg !230
  store i32 %3, i32* %mask.addr, align 4, !dbg !229
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !233, metadata !DIExpression()), !dbg !229
  store i32 0, i32* %i.addr, align 4, !dbg !234
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !236, metadata !DIExpression()), !dbg !234
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !234
  %5 = load i64, i64* %4, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !234
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !234
  %7 = load i8*, i8** %6, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !234
  br label %for.cond, !dbg !234

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !238
  %9 = trunc i64 %5 to i32, !dbg !237
  %10 = icmp slt i32 %8, %9, !dbg !238
  br i1 %10, label %for.body, label %for.end, !dbg !234

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !243
  %12 = sext i32 %11 to i64, !dbg !242
  %13 = bitcast i8* %7 to i32*, !dbg !242
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !242
  %15 = load i32, i32* %14, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !242
  store i32 %15, i32* %h.addr, align 4, !dbg !241
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !244, metadata !DIExpression()), !dbg !241
  %16 = load i32, i32* %h.addr, align 4, !dbg !246
  %17 = icmp ne i32 %16, 0, !dbg !246
  br i1 %17, label %if.then, label %if.end, !dbg !245

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !251
  %19 = load i32, i32* %h.addr, align 4, !dbg !252
  %20 = load i32, i32* %i.addr, align 4, !dbg !253
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !249
  br label %if.end, !dbg !245

if.end:
  br label %for.inc, !dbg !234

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !254
  %22 = add nsw i32 %21, 1, !dbg !254
  store i32 %22, i32* %i.addr, align 4, !dbg !254
  br label %for.cond, !dbg !234

for.end:
  ret void, !dbg !226
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !255 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !257, metadata !DIExpression()), !dbg !256
  store i32 0, i32* %i.addr, align 4, !dbg !258
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !260, metadata !DIExpression()), !dbg !258
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !258
  %1 = load i64, i64* %0, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !258
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !258
  %3 = load i8*, i8** %2, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !258
  br label %for.cond, !dbg !258

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !262
  %5 = trunc i64 %1 to i32, !dbg !261
  %6 = icmp slt i32 %4, %5, !dbg !262
  br i1 %6, label %for.body, label %for.end, !dbg !258

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !266
  %8 = sext i32 %7 to i64, !dbg !265
  %9 = bitcast i8* %3 to i32*, !dbg !265
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !265
  store i32 0, i32* %10, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !265
  br label %for.inc, !dbg !258

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !268
  %12 = add nsw i32 %11, 1, !dbg !268
  store i32 %12, i32* %i.addr, align 4, !dbg !268
  br label %for.cond, !dbg !258

for.end:
  ret void, !dbg !256
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !271 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !273, metadata !DIExpression()), !dbg !272
  call void @llvm.dbg.value(metadata i32 %mask, metadata !274, metadata !DIExpression()), !dbg !272
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !275, metadata !DIExpression()), !dbg !272
  call void @llvm.dbg.value(metadata i32 %h, metadata !276, metadata !DIExpression()), !dbg !272
  call void @llvm.dbg.value(metadata i32 %used, metadata !277, metadata !DIExpression()), !dbg !272
  %0 = icmp sge i32 %bucket, 0, !dbg !279
  br i1 %0, label %land.rhs, label %land.end, !dbg !279

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !283
  %2 = load i64, i64* %1, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !283
  %3 = trunc i64 %2 to i32, !dbg !283
  %4 = icmp slt i32 %bucket, %3, !dbg !281
  br label %land.end, !dbg !279

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !279
  br i1 %5, label %if.then, label %if.else, !dbg !278

if.then:
  %6 = sext i32 %bucket to i64, !dbg !285
  %7 = sub nsw i32 %used, 1, !dbg !289
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !287
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !285
  %10 = load i8*, i8** %9, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !285
  %11 = bitcast i8* %10 to i32*, !dbg !285
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !285
  store i32 %8, i32* %12, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !285
  br label %if.end, !dbg !278

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !296
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !292
  br label %if.end, !dbg !278

if.end:
  ret void, !dbg !272
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 !dbg !300 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !302, metadata !DIExpression()), !dbg !301
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !301
  store i32 0, i32* %0, align 4, !tbaa !50, !dbg !301
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !301
  store i32 7, i32* %1, align 4, !tbaa !303, !dbg !301
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !301
  store i32 0, i32* %2, align 4, !tbaa !304, !dbg !301
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !301
  store i32 0, i32* %3, align 4, !tbaa !305, !dbg !301
  %4 = sext i32 8 to i64, !dbg !307
  %5 = call i8* @nish_alloc_struct(i64 24), !dbg !307
  %6 = bitcast i8* %5 to %struct.nish_array*, !dbg !307
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0, !dbg !307
  store i64 %4, i64* %7, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !307
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1, !dbg !307
  store i64 %4, i64* %8, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !307
  %9 = mul i64 %4, 4, !dbg !307
  %10 = call i8* @nish_alloc_struct(i64 %9), !dbg !307
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !130, !noalias !129, !dbg !307
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2, !dbg !307
  store i8* %10, i8** %11, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !307
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !306
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !309, !dbg !306
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !311
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !311
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !311
  store i64 0, i64* %15, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !311
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !311
  store i64 0, i64* %16, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !311
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !311
  store i8* null, i8** %17, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !311
  %18 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !310
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !312, !dbg !310
  %19 = call i8* @nish_alloc_struct(i64 24), !dbg !314
  %20 = bitcast i8* %19 to %struct.nish_array*, !dbg !314
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !314
  store i64 0, i64* %21, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !314
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !314
  store i64 0, i64* %22, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !314
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !314
  store i8* null, i8** %23, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !314
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !313
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !315, !dbg !313
  ret void, !dbg !301
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !318 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !320, metadata !DIExpression()), !dbg !319
  call void @llvm.dbg.value(metadata i32 %key, metadata !321, metadata !DIExpression()), !dbg !319
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !324
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !309, !dbg !324
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !325
  %3 = load i32, i32* %2, align 4, !tbaa !303, !dbg !325
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !326
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !315, !dbg !326
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !327
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !312, !dbg !327
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !323
  ret i64 %8, !dbg !322
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !332 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !334, metadata !DIExpression()), !dbg !333
  call void @llvm.dbg.value(metadata i32 %key, metadata !335, metadata !DIExpression()), !dbg !333
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !337
  %1 = icmp sge i64 %0, 0, !dbg !337
  ret i1 %1, !dbg !336
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) %this, i32 noundef %key) #0 !dbg !342 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !344, metadata !DIExpression()), !dbg !343
  call void @llvm.dbg.value(metadata i32 %key, metadata !345, metadata !DIExpression()), !dbg !343
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !347
  store i64 %0, i64* %found.addr, align 8, !dbg !346
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !349, metadata !DIExpression()), !dbg !346
  %1 = load i64, i64* %found.addr, align 8, !dbg !351
  %2 = icmp slt i64 %1, 0, !dbg !351
  br i1 %2, label %if.then, label %if.end, !dbg !350

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !355
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !354
  br label %if.end, !dbg !350

if.end:
  ret %struct.Set$i32* %this, !dbg !357
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !361 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !363, metadata !DIExpression()), !dbg !362
  call void @llvm.dbg.value(metadata i64 %absent, metadata !364, metadata !DIExpression()), !dbg !362
  call void @llvm.dbg.value(metadata i32 %key, metadata !365, metadata !DIExpression()), !dbg !362
  %0 = sub nsw i64 0, 1, !dbg !367
  %1 = sub nsw i64 %0, %absent, !dbg !367
  store i64 %1, i64* %packed.addr, align 8, !dbg !366
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !370, metadata !DIExpression()), !dbg !366
  %2 = load i64, i64* %packed.addr, align 8, !dbg !373
  %3 = ashr i64 %2, 32, !dbg !373
  %4 = trunc i64 %3 to i32, !dbg !372
  store i32 %4, i32* %bucket.addr, align 4, !dbg !371
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !374, metadata !DIExpression()), !dbg !371
  %5 = load i64, i64* %packed.addr, align 8, !dbg !377
  %6 = trunc i64 %5 to i32, !dbg !376
  store i32 %6, i32* %h.addr, align 4, !dbg !375
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !378, metadata !DIExpression()), !dbg !375
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !381
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !312, !dbg !381
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !381
  %10 = load i64, i64* %9, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !381
  %11 = trunc i64 %10 to i32, !dbg !381
  %12 = icmp sge i32 %11, 16777215, !dbg !380
  br i1 %12, label %if.then, label %if.end, !dbg !379

if.then:
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !385
  %14 = load i32, i32* %13, align 4, !tbaa !304, !dbg !385
  %15 = icmp sge i32 %14, 16777215, !dbg !385
  br i1 %15, label %lor.end, label %lor.rhs, !dbg !385

lor.rhs:
  %16 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !387
  %17 = load i32, i32* %16, align 4, !tbaa !305, !dbg !387
  %18 = icmp sgt i32 %17, 0, !dbg !387
  br label %lor.end, !dbg !385

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ], !dbg !385
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !384

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !390
  call void @nish_exit(i32 1), !dbg !390
  unreachable, !dbg !390

if.end.1:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !392
  %20 = sub nsw i32 0, 1, !dbg !394
  store i32 %20, i32* %bucket.addr, align 4, !dbg !393
  br label %if.end, !dbg !379

if.end:
  %21 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !396
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !312, !dbg !396
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0, !dbg !396
  %24 = load i64, i64* %23, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !396
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1, !dbg !396
  %26 = load i64, i64* %25, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !396
  %27 = icmp eq i64 %24, %26, !dbg !396
  br i1 %27, label %push.grow, label %push.store, !dbg !396

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 4), !dbg !396
  br label %push.store, !dbg !396

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2, !dbg !396
  %29 = load i8*, i8** %28, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !396
  %30 = bitcast i8* %29 to i32*, !dbg !396
  %31 = getelementptr inbounds i32, i32* %30, i64 %24, !dbg !396
  store i32 %key, i32* %31, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !396
  %32 = add i64 %24, 1, !dbg !396
  store i64 %32, i64* %23, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !396
  %33 = trunc i64 %32 to i32, !dbg !396
  %34 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !398
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !315, !dbg !398
  %36 = load i32, i32* %h.addr, align 4, !dbg !399
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0, !dbg !398
  %38 = load i64, i64* %37, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !398
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1, !dbg !398
  %40 = load i64, i64* %39, align 8, !alias.scope !129, !noalias !130, !tbaa !222, !dbg !398
  %41 = icmp eq i64 %38, %40, !dbg !398
  br i1 %41, label %push.grow.1, label %push.store.1, !dbg !398

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %35, i64 4), !dbg !398
  br label %push.store.1, !dbg !398

push.store.1:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2, !dbg !398
  %43 = load i8*, i8** %42, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !398
  %44 = bitcast i8* %43 to i32*, !dbg !398
  %45 = getelementptr inbounds i32, i32* %44, i64 %38, !dbg !398
  store i32 %36, i32* %45, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !398
  %46 = add i64 %38, 1, !dbg !398
  store i64 %46, i64* %37, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !398
  %47 = trunc i64 %46 to i32, !dbg !398
  %48 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !401
  %49 = load i32, i32* %48, align 4, !tbaa !304, !dbg !401
  %50 = add nsw i32 %49, 1, !dbg !401
  %51 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !400
  store i32 %50, i32* %51, align 4, !tbaa !304, !dbg !400
  %52 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !404
  %53 = load i32, i32* %52, align 4, !tbaa !50, !dbg !404
  %54 = add nsw i32 %53, 1, !dbg !404
  %55 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !403
  store i32 %54, i32* %55, align 4, !tbaa !50, !dbg !403
  %56 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !408
  %57 = load %struct.nish_array*, %struct.nish_array** %56, align 8, !tbaa !312, !dbg !408
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0, !dbg !408
  %59 = load i64, i64* %58, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !408
  %60 = trunc i64 %59 to i32, !dbg !408
  store i32 %60, i32* %used.addr, align 4, !dbg !406
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !409, metadata !DIExpression()), !dbg !406
  %61 = load i32, i32* %used.addr, align 4, !dbg !411
  %62 = mul nsw i32 %61, 4, !dbg !411
  %63 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !414
  %64 = load %struct.nish_array*, %struct.nish_array** %63, align 8, !tbaa !309, !dbg !414
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0, !dbg !414
  %66 = load i64, i64* %65, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !414
  %67 = trunc i64 %66 to i32, !dbg !414
  %68 = mul nsw i32 %67, 3, !dbg !413
  %69 = icmp sgt i32 %62, %68, !dbg !411
  br i1 %69, label %if.then.2, label %if.else, !dbg !410

if.then.2:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !417
  br label %if.end.2, !dbg !410

if.else:
  %70 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !420
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !309, !dbg !420
  %72 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !421
  %73 = load i32, i32* %72, align 4, !tbaa !303, !dbg !421
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !422
  %75 = load i32, i32* %h.addr, align 4, !dbg !423
  %76 = load i32, i32* %used.addr, align 4, !dbg !424
  call void @nish.fileAppended(%struct.nish_array* %71, i32 %73, i32 %74, i32 %75, i32 %76), !dbg !419
  br label %if.end.2, !dbg !410

if.end.2:
  ret void, !dbg !362
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !425 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !427, metadata !DIExpression()), !dbg !426
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !430
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !312, !dbg !430
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !430
  %3 = load i64, i64* %2, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !430
  %4 = trunc i64 %3 to i32, !dbg !430
  store i32 %4, i32* %used.addr, align 4, !dbg !428
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !431, metadata !DIExpression()), !dbg !428
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !433
  %6 = load i32, i32* %5, align 4, !tbaa !305, !dbg !433
  %7 = icmp sgt i32 %6, 0, !dbg !433
  store i1 %7, i1* %walking.addr, align 1, !dbg !432
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !435, metadata !DIExpression()), !dbg !432
  %8 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !438
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !309, !dbg !438
  %10 = load i1, i1* %walking.addr, align 1, !dbg !439
  br i1 %10, label %cond.true, label %cond.false, !dbg !439

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !440
  br label %cond.end, !dbg !439

cond.false:
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !441
  %13 = load i32, i32* %12, align 4, !tbaa !304, !dbg !441
  br label %cond.end, !dbg !439

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !439
  %15 = load i32, i32* %used.addr, align 4, !dbg !442
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !437
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !436
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !443, metadata !DIExpression()), !dbg !436
  %17 = load i1, i1* %walking.addr, align 1, !dbg !446
  %18 = xor i1 %17, true, !dbg !445
  br i1 %18, label %land.rhs, label %land.end, !dbg !445

land.rhs:
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !447
  %20 = load i32, i32* %19, align 4, !tbaa !304, !dbg !447
  %21 = load i32, i32* %used.addr, align 4, !dbg !448
  %22 = icmp slt i32 %20, %21, !dbg !447
  br label %land.end, !dbg !445

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !445
  br i1 %23, label %if.then, label %if.end, !dbg !444

if.then:
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !451
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !312, !dbg !451
  %26 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !452
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !315, !dbg !452
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !450
  %28 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !454
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !315, !dbg !454
  call void @nish.compactHashes(%struct.nish_array* %29), !dbg !453
  br label %if.end, !dbg !444

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !456
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !455
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !309, !dbg !455
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !459
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0, !dbg !459
  %34 = load i64, i64* %33, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !459
  %35 = trunc i64 %34 to i32, !dbg !459
  %36 = sub nsw i32 %35, 1, !dbg !458
  %37 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !457
  store i32 %36, i32* %37, align 4, !tbaa !303, !dbg !457
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !462
  %39 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !463
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !315, !dbg !463
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40), !dbg !461
  ret void, !dbg !426
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !466 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !468, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata i32 %mask, metadata !469, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !470, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !471, metadata !DIExpression()), !dbg !467
  call void @llvm.dbg.value(metadata i32 %key, metadata !472, metadata !DIExpression()), !dbg !467
  %0 = lshr i32 %key, 16, !dbg !474
  %1 = xor i32 %key, %0, !dbg !474
  %2 = mul i32 %1, -2048144789, !dbg !474
  %3 = lshr i32 %2, 13, !dbg !474
  %4 = xor i32 %2, %3, !dbg !474
  %5 = mul i32 %4, -1028477387, !dbg !474
  %6 = lshr i32 %5, 16, !dbg !474
  %7 = xor i32 %5, %6, !dbg !474
  %8 = icmp eq i32 %7, 0, !dbg !474
  %9 = select i1 %8, i32 1, i32 %7, !dbg !474
  store i32 %9, i32* %h.addr, align 4, !dbg !473
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !476, metadata !DIExpression()), !dbg !473
  %10 = load i32, i32* %h.addr, align 4, !dbg !478
  %11 = lshr i32 %10, 24, !dbg !478
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !477
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !479, metadata !DIExpression()), !dbg !477
  %12 = load i32, i32* %h.addr, align 4, !dbg !482
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !481
  store i32 %13, i32* %bucket.addr, align 4, !dbg !480
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !484, metadata !DIExpression()), !dbg !480
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !485
  %15 = load i64, i64* %14, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !485
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !485
  %17 = load i8*, i8** %16, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !485
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !485
  %19 = load i64, i64* %18, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !485
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !485
  %21 = load i8*, i8** %20, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !485
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !485
  %23 = load i64, i64* %22, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !485
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !485
  %25 = load i8*, i8** %24, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !485
  br label %while.cond, !dbg !485

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !489
  %27 = icmp sge i32 %26, 0, !dbg !489
  br i1 %27, label %land.rhs, label %land.end, !dbg !489

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !491
  %29 = trunc i64 %15 to i32, !dbg !486
  %30 = icmp slt i32 %28, %29, !dbg !491
  br label %land.end, !dbg !489

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !489
  br i1 %31, label %while.body, label %while.end, !dbg !485

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !496
  %33 = sext i32 %32 to i64, !dbg !495
  %34 = bitcast i8* %17 to i32*, !dbg !495
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !495
  %36 = load i32, i32* %35, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !495
  store i32 %36, i32* %word.addr, align 4, !dbg !494
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !497, metadata !DIExpression()), !dbg !494
  %37 = load i32, i32* %word.addr, align 4, !dbg !499
  %38 = icmp eq i32 %37, 0, !dbg !499
  br i1 %38, label %if.then, label %if.end, !dbg !498

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !504
  %40 = load i32, i32* %h.addr, align 4, !dbg !505
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !503
  ret i64 %41, !dbg !502

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !507
  %43 = lshr i32 %42, 24, !dbg !507
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !508
  %45 = icmp eq i32 %43, %44, !dbg !507
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !506

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !512
  %47 = and i32 %46, 16777215, !dbg !512
  %48 = sub nsw i32 %47, 1, !dbg !511
  store i32 %48, i32* %at.addr, align 4, !dbg !510
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !515, metadata !DIExpression()), !dbg !510
  %49 = load i32, i32* %at.addr, align 4, !dbg !517
  %50 = icmp sge i32 %49, 0, !dbg !517
  br i1 %50, label %land.rhs.4, label %land.end.4, !dbg !517

land.rhs.4:
  %51 = load i32, i32* %at.addr, align 4, !dbg !519
  %52 = trunc i64 %19 to i32, !dbg !487
  %53 = icmp slt i32 %51, %52, !dbg !519
  br label %land.end.4, !dbg !517

land.end.4:
  %54 = phi i1 [ false, %if.then.1 ], [ %53, %land.rhs.4 ], !dbg !517
  br i1 %54, label %land.rhs.3, label %land.end.3, !dbg !517

land.rhs.3:
  %55 = load i32, i32* %at.addr, align 4, !dbg !522
  %56 = sext i32 %55 to i64, !dbg !521
  %57 = bitcast i8* %21 to i32*, !dbg !521
  %58 = getelementptr inbounds i32, i32* %57, i64 %56, !dbg !521
  %59 = load i32, i32* %58, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !521
  %60 = load i32, i32* %h.addr, align 4, !dbg !523
  %61 = icmp eq i32 %59, %60, !dbg !521
  br label %land.end.3, !dbg !517

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %land.rhs.3 ], !dbg !517
  br i1 %62, label %land.rhs.2, label %land.end.2, !dbg !517

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4, !dbg !524
  %64 = trunc i64 %23 to i32, !dbg !488
  %65 = icmp slt i32 %63, %64, !dbg !524
  br label %land.end.2, !dbg !517

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ], !dbg !517
  br i1 %66, label %land.rhs.1, label %land.end.1, !dbg !517

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4, !dbg !528
  %68 = sext i32 %67 to i64, !dbg !527
  %69 = bitcast i8* %25 to i32*, !dbg !527
  %70 = getelementptr inbounds i32, i32* %69, i64 %68, !dbg !527
  %71 = load i32, i32* %70, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !527
  %72 = icmp eq i32 %71, %key, !dbg !526
  br label %land.end.1, !dbg !517

land.end.1:
  %73 = phi i1 [ false, %land.end.2 ], [ %72, %land.rhs.1 ], !dbg !517
  br i1 %73, label %if.then.2, label %if.end.2, !dbg !516

if.then.2:
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !533
  %75 = load i32, i32* %at.addr, align 4, !dbg !534
  %76 = tail call i64 @nish.foundAt(i32 %74, i32 %75), !dbg !532
  ret i64 %76, !dbg !531

if.end.2:
  br label %if.end.1, !dbg !506

if.end.1:
  %77 = load i32, i32* %bucket.addr, align 4, !dbg !537
  %78 = add nsw i32 %77, 1, !dbg !537
  %79 = and i32 %78, %mask, !dbg !536
  store i32 %79, i32* %bucket.addr, align 4, !dbg !535
  br label %while.cond, !dbg !485

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !540
  call void @nish_exit(i32 1), !dbg !540
  unreachable, !dbg !540
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !544 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !546, metadata !DIExpression()), !dbg !545
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !547, metadata !DIExpression()), !dbg !545
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !550
  %1 = load i64, i64* %0, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !550
  %2 = trunc i64 %1 to i32, !dbg !550
  store i32 %2, i32* %used.addr, align 4, !dbg !548
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !551, metadata !DIExpression()), !dbg !548
  store i32 0, i32* %to.addr, align 4, !dbg !552
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !554, metadata !DIExpression()), !dbg !552
  store i32 0, i32* %from.addr, align 4, !dbg !555
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !557, metadata !DIExpression()), !dbg !555
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !555
  %4 = load i64, i64* %3, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !555
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !555
  %6 = load i8*, i8** %5, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !555
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !555
  %8 = load i64, i64* %7, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !555
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !555
  %10 = load i8*, i8** %9, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !555
  br label %for.cond, !dbg !555

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !560
  %12 = load i32, i32* %used.addr, align 4, !dbg !561
  %13 = icmp slt i32 %11, %12, !dbg !560
  br i1 %13, label %land.rhs, label %land.end, !dbg !560

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !562
  %15 = trunc i64 %4 to i32, !dbg !558
  %16 = icmp slt i32 %14, %15, !dbg !562
  br label %land.end, !dbg !560

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !560
  br i1 %17, label %for.body, label %for.end, !dbg !555

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !567
  %19 = sext i32 %18 to i64, !dbg !566
  %20 = bitcast i8* %6 to i32*, !dbg !566
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !566
  %22 = load i32, i32* %21, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !566
  %23 = icmp ne i32 %22, 0, !dbg !566
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !566

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !569
  %25 = icmp sge i32 %24, 0, !dbg !569
  br label %land.end.3, !dbg !566

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !566
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !566

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !571
  %28 = load i32, i32* %used.addr, align 4, !dbg !572
  %29 = icmp slt i32 %27, %28, !dbg !571
  br label %land.end.2, !dbg !566

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !566
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !566

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !573
  %32 = trunc i64 %8 to i32, !dbg !559
  %33 = icmp slt i32 %31, %32, !dbg !573
  br label %land.end.1, !dbg !566

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !566
  br i1 %34, label %if.then, label %if.end, !dbg !565

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !577
  %36 = sext i32 %35 to i64, !dbg !576
  %37 = load i32, i32* %from.addr, align 4, !dbg !579
  %38 = sext i32 %37 to i64, !dbg !578
  %39 = bitcast i8* %10 to i32*, !dbg !578
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !578
  %41 = load i32, i32* %40, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !578
  %42 = bitcast i8* %10 to i32*, !dbg !576
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !576
  store i32 %41, i32* %43, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !576
  %44 = load i32, i32* %to.addr, align 4, !dbg !580
  %45 = add nsw i32 %44, 1, !dbg !580
  store i32 %45, i32* %to.addr, align 4, !dbg !580
  br label %if.end, !dbg !565

if.end:
  br label %for.inc, !dbg !555

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !581
  %47 = add nsw i32 %46, 1, !dbg !581
  store i32 %47, i32* %from.addr, align 4, !dbg !581
  br label %for.cond, !dbg !555

for.end:
  br label %while.cond, !dbg !582

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !584
  %49 = load i64, i64* %48, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !584
  %50 = trunc i64 %49 to i32, !dbg !584
  %51 = load i32, i32* %to.addr, align 4, !dbg !585
  %52 = icmp sgt i32 %50, %51, !dbg !583
  br i1 %52, label %while.body, label %while.end, !dbg !582

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !587
  %54 = load i64, i64* %53, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !587
  %55 = icmp eq i64 %54, 0, !dbg !587
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !587

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !587
  unreachable, !dbg !587

pop.ok:
  %56 = sub i64 %54, 1, !dbg !587
  store i64 %56, i64* %53, align 8, !alias.scope !129, !noalias !130, !tbaa !134, !dbg !587
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !587
  %58 = load i8*, i8** %57, align 8, !alias.scope !129, !noalias !130, !tbaa !135, !dbg !587
  %59 = bitcast i8* %58 to i32*, !dbg !587
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !587
  %61 = load i32, i32* %60, align 4, !alias.scope !130, !noalias !129, !tbaa !145, !dbg !587
  br label %while.cond, !dbg !582

while.end:
  ret void, !dbg !545
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/map_dbg.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 5, type: !6, scopeLine: 5, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 5, column: 1, scope: !7)
!9 = !DILocation(line: 6, column: 3, scope: !7)
!10 = !DILocation(line: 6, column: 13, scope: !7)
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 441, size: 384, align: 64, elements: !37)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 443, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 444, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 445, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 446, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 447, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 448, baseType: !23, size: 64, offset: 256)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 450, baseType: !4, size: 32, offset: 320)
!37 = !{!14, !24, !25, !26, !34, !35, !36}
!38 = !DILocalVariable(name: "s", scope: !7, file: !1, line: 6, type: !12)
!39 = !DILocation(line: 7, column: 3, scope: !7)
!40 = !DILocation(line: 7, column: 9, scope: !7)
!41 = !DILocation(line: 7, column: 16, scope: !7)
!42 = !DILocation(line: 8, column: 3, scope: !7)
!43 = !DILocation(line: 8, column: 15, scope: !7)
!44 = !DILocation(line: 8, column: 18, scope: !7)
!45 = !{!"nish TBAA"}
!46 = !{!"omnipotent char", !45, i64 0}
!47 = !{!"i32", !46, i64 0}
!48 = !{!"ptr", !46, i64 0}
!49 = !{!"Set$i32", !47, i64 0, !48, i64 8, !47, i64 16, !47, i64 20, !48, i64 24, !48, i64 32, !47, i64 40}
!50 = !{!49, !47, i64 0}
!51 = !DILocation(line: 8, column: 28, scope: !7)
!52 = !DILocation(line: 8, column: 34, scope: !7)
!53 = !DILocation(line: 9, column: 3, scope: !7)
!54 = !DILocation(line: 9, column: 10, scope: !7)
!55 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 5, type: !6, scopeLine: 5, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!56 = !DILocation(line: 5, column: 1, scope: !55)
!57 = !{!4, !19, !4}
!58 = !DISubroutineType(types: !57)
!59 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 78, type: !58, scopeLine: 78, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!60 = !DILocation(line: 78, column: 1, scope: !59)
!61 = !DILocalVariable(name: "h", arg: 1, scope: !59, file: !13, line: 78, type: !19)
!62 = !DILocalVariable(name: "mask", arg: 2, scope: !59, file: !13, line: 78, type: !4)
!63 = !DILocation(line: 78, column: 48, scope: !59)
!64 = !DILocation(line: 78, column: 54, scope: !59)
!65 = !DILocation(line: 78, column: 58, scope: !59)
!66 = !DILocation(line: 78, column: 59, scope: !59)
!67 = !DILocation(line: 78, column: 72, scope: !59)
!68 = !{!19, !19, !4}
!69 = !DISubroutineType(types: !68)
!70 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 81, type: !69, scopeLine: 81, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!71 = !DILocation(line: 81, column: 1, scope: !70)
!72 = !DILocalVariable(name: "h", arg: 1, scope: !70, file: !13, line: 81, type: !19)
!73 = !DILocalVariable(name: "index", arg: 2, scope: !70, file: !13, line: 81, type: !4)
!74 = !DILocation(line: 81, column: 47, scope: !70)
!75 = !DILocation(line: 81, column: 48, scope: !70)
!76 = !DILocation(line: 81, column: 49, scope: !70)
!77 = !DILocation(line: 81, column: 68, scope: !70)
!78 = !DILocation(line: 81, column: 74, scope: !70)
!79 = !DILocation(line: 81, column: 82, scope: !70)
!80 = !{!16, !4, !4}
!81 = !DISubroutineType(types: !80)
!82 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 84, type: !81, scopeLine: 84, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!83 = !DILocation(line: 84, column: 1, scope: !82)
!84 = !DILocalVariable(name: "bucket", arg: 1, scope: !82, file: !13, line: 84, type: !4)
!85 = !DILocalVariable(name: "index", arg: 2, scope: !82, file: !13, line: 84, type: !4)
!86 = !DILocation(line: 84, column: 51, scope: !82)
!87 = !DILocation(line: 84, column: 52, scope: !82)
!88 = !DILocation(line: 84, column: 58, scope: !82)
!89 = !DILocation(line: 84, column: 75, scope: !82)
!90 = !DILocation(line: 84, column: 81, scope: !82)
!91 = !{!16, !4, !19}
!92 = !DISubroutineType(types: !91)
!93 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 87, type: !92, scopeLine: 87, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!94 = !DILocation(line: 87, column: 1, scope: !93)
!95 = !DILocalVariable(name: "bucket", arg: 1, scope: !93, file: !13, line: 87, type: !4)
!96 = !DILocalVariable(name: "h", arg: 2, scope: !93, file: !13, line: 87, type: !19)
!97 = !DILocation(line: 87, column: 48, scope: !93)
!98 = !DILocation(line: 87, column: 54, scope: !93)
!99 = !DILocation(line: 87, column: 55, scope: !93)
!100 = !DILocation(line: 87, column: 60, scope: !93)
!101 = !DILocation(line: 87, column: 61, scope: !93)
!102 = !DILocation(line: 87, column: 62, scope: !93)
!103 = !DILocation(line: 87, column: 68, scope: !93)
!104 = !DILocation(line: 87, column: 85, scope: !93)
!105 = !DILocation(line: 87, column: 91, scope: !93)
!106 = !{null, !23, !4, !19, !4}
!107 = !DISubroutineType(types: !106)
!108 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 123, type: !107, scopeLine: 123, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!109 = !DILocation(line: 123, column: 1, scope: !108)
!110 = !DILocalVariable(name: "slots", arg: 1, scope: !108, file: !13, line: 123, type: !23)
!111 = !DILocalVariable(name: "mask", arg: 2, scope: !108, file: !13, line: 123, type: !4)
!112 = !DILocalVariable(name: "h", arg: 3, scope: !108, file: !13, line: 123, type: !19)
!113 = !DILocalVariable(name: "index", arg: 4, scope: !108, file: !13, line: 123, type: !4)
!114 = !DILocation(line: 124, column: 3, scope: !108)
!115 = !DILocation(line: 124, column: 16, scope: !108)
!116 = !DILocation(line: 124, column: 25, scope: !108)
!117 = !DILocation(line: 124, column: 28, scope: !108)
!118 = !DILocalVariable(name: "word", scope: !108, file: !13, line: 124, type: !19)
!119 = !DILocation(line: 125, column: 3, scope: !108)
!120 = !DILocation(line: 125, column: 16, scope: !108)
!121 = !DILocation(line: 125, column: 27, scope: !108)
!122 = !DILocation(line: 125, column: 30, scope: !108)
!123 = !DILocalVariable(name: "bucket", scope: !108, file: !13, line: 125, type: !4)
!124 = !DILocation(line: 126, column: 3, scope: !108)
!125 = !DILocation(line: 126, column: 40, scope: !108)
!126 = !{!"nish array"}
!127 = !{!"header", !126}
!128 = !{!"elements", !126}
!129 = !{!127}
!130 = !{!128}
!131 = !{!"header i64", !46, i64 0}
!132 = !{!"header ptr", !46, i64 0}
!133 = !{!"array header", !131, i64 0, !131, i64 8, !132, i64 16}
!134 = !{!133, !131, i64 0}
!135 = !{!133, !132, i64 16}
!136 = !DILocation(line: 126, column: 10, scope: !108)
!137 = !DILocation(line: 126, column: 20, scope: !108)
!138 = !DILocation(line: 126, column: 25, scope: !108)
!139 = !DILocation(line: 126, column: 34, scope: !108)
!140 = !DILocation(line: 126, column: 55, scope: !108)
!141 = !DILocation(line: 127, column: 5, scope: !108)
!142 = !DILocation(line: 127, column: 9, scope: !108)
!143 = !DILocation(line: 127, column: 15, scope: !108)
!144 = !{!"element i32", !46, i64 0}
!145 = !{!144, !144, i64 0}
!146 = !DILocation(line: 127, column: 27, scope: !108)
!147 = !DILocation(line: 127, column: 30, scope: !108)
!148 = !DILocation(line: 128, column: 7, scope: !108)
!149 = !DILocation(line: 128, column: 13, scope: !108)
!150 = !DILocation(line: 128, column: 23, scope: !108)
!151 = !DILocation(line: 129, column: 7, scope: !108)
!152 = !DILocation(line: 131, column: 5, scope: !108)
!153 = !DILocation(line: 131, column: 14, scope: !108)
!154 = !DILocation(line: 131, column: 15, scope: !108)
!155 = !DILocation(line: 131, column: 24, scope: !108)
!156 = !DILocation(line: 131, column: 29, scope: !108)
!157 = !{null, !23}
!158 = !DISubroutineType(types: !157)
!159 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 151, type: !158, scopeLine: 151, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!160 = !DILocation(line: 151, column: 1, scope: !159)
!161 = !DILocalVariable(name: "hashes", arg: 1, scope: !159, file: !13, line: 151, type: !23)
!162 = !DILocation(line: 152, column: 3, scope: !159)
!163 = !DILocation(line: 152, column: 16, scope: !159)
!164 = !DILocation(line: 152, column: 22, scope: !159)
!165 = !DILocalVariable(name: "used", scope: !159, file: !13, line: 152, type: !4)
!166 = !DILocation(line: 153, column: 3, scope: !159)
!167 = !DILocation(line: 153, column: 17, scope: !159)
!168 = !DILocalVariable(name: "to", scope: !159, file: !13, line: 153, type: !4)
!169 = !DILocation(line: 154, column: 3, scope: !159)
!170 = !DILocation(line: 154, column: 24, scope: !159)
!171 = !DILocalVariable(name: "from", scope: !159, file: !13, line: 154, type: !4)
!172 = !DILocation(line: 155, column: 15, scope: !159)
!173 = !DILocation(line: 154, column: 27, scope: !159)
!174 = !DILocation(line: 154, column: 34, scope: !159)
!175 = !DILocation(line: 154, column: 48, scope: !159)
!176 = !DILocation(line: 155, column: 5, scope: !159)
!177 = !DILocation(line: 155, column: 22, scope: !159)
!178 = !DILocalVariable(name: "h", scope: !159, file: !13, line: 155, type: !19)
!179 = !DILocation(line: 156, column: 5, scope: !159)
!180 = !DILocation(line: 156, column: 9, scope: !159)
!181 = !DILocation(line: 156, column: 15, scope: !159)
!182 = !DILocation(line: 156, column: 20, scope: !159)
!183 = !DILocation(line: 156, column: 26, scope: !159)
!184 = !DILocation(line: 156, column: 31, scope: !159)
!185 = !DILocation(line: 156, column: 36, scope: !159)
!186 = !DILocation(line: 156, column: 42, scope: !159)
!187 = !DILocation(line: 157, column: 7, scope: !159)
!188 = !DILocation(line: 157, column: 14, scope: !159)
!189 = !DILocation(line: 157, column: 20, scope: !159)
!190 = !DILocation(line: 158, column: 7, scope: !159)
!191 = !DILocation(line: 154, column: 40, scope: !159)
!192 = !DILocation(line: 161, column: 3, scope: !159)
!193 = !DILocation(line: 161, column: 10, scope: !159)
!194 = !DILocation(line: 161, column: 16, scope: !159)
!195 = !DILocation(line: 161, column: 33, scope: !159)
!196 = !DILocation(line: 161, column: 37, scope: !159)
!197 = !DILocation(line: 162, column: 5, scope: !159)
!198 = !{!23, !23, !4, !4}
!199 = !DISubroutineType(types: !198)
!200 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 173, type: !199, scopeLine: 173, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!201 = !DILocation(line: 173, column: 1, scope: !200)
!202 = !DILocalVariable(name: "slots", arg: 1, scope: !200, file: !13, line: 173, type: !23)
!203 = !DILocalVariable(name: "live", arg: 2, scope: !200, file: !13, line: 173, type: !4)
!204 = !DILocalVariable(name: "used", arg: 3, scope: !200, file: !13, line: 173, type: !4)
!205 = !DILocation(line: 174, column: 3, scope: !200)
!206 = !DILocation(line: 174, column: 13, scope: !200)
!207 = !DILocation(line: 174, column: 19, scope: !200)
!208 = !DILocalVariable(name: "n", scope: !200, file: !13, line: 174, type: !4)
!209 = !DILocation(line: 175, column: 3, scope: !200)
!210 = !DILocation(line: 175, column: 7, scope: !200)
!211 = !DILocation(line: 175, column: 14, scope: !200)
!212 = !DILocation(line: 175, column: 18, scope: !200)
!213 = !DILocation(line: 175, column: 24, scope: !200)
!214 = !DILocation(line: 176, column: 5, scope: !200)
!215 = !DILocation(line: 176, column: 16, scope: !200)
!216 = !DILocation(line: 177, column: 5, scope: !200)
!217 = !DILocation(line: 177, column: 12, scope: !200)
!218 = !DILocation(line: 179, column: 3, scope: !200)
!219 = !DILocation(line: 179, column: 10, scope: !200)
!220 = !DILocation(line: 179, column: 25, scope: !200)
!221 = !DILocation(line: 179, column: 29, scope: !200)
!222 = !{!133, !131, i64 8}
!223 = !{null, !23, !23}
!224 = !DISubroutineType(types: !223)
!225 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 187, type: !224, scopeLine: 187, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!226 = !DILocation(line: 187, column: 1, scope: !225)
!227 = !DILocalVariable(name: "slots", arg: 1, scope: !225, file: !13, line: 187, type: !23)
!228 = !DILocalVariable(name: "hashes", arg: 2, scope: !225, file: !13, line: 187, type: !23)
!229 = !DILocation(line: 188, column: 3, scope: !225)
!230 = !DILocation(line: 188, column: 16, scope: !225)
!231 = !DILocation(line: 188, column: 22, scope: !225)
!232 = !DILocation(line: 188, column: 38, scope: !225)
!233 = !DILocalVariable(name: "mask", scope: !225, file: !13, line: 188, type: !4)
!234 = !DILocation(line: 189, column: 3, scope: !225)
!235 = !DILocation(line: 189, column: 21, scope: !225)
!236 = !DILocalVariable(name: "i", scope: !225, file: !13, line: 189, type: !4)
!237 = !DILocation(line: 189, column: 34, scope: !225)
!238 = !DILocation(line: 189, column: 24, scope: !225)
!239 = !DILocation(line: 189, column: 28, scope: !225)
!240 = !DILocation(line: 189, column: 55, scope: !225)
!241 = !DILocation(line: 190, column: 5, scope: !225)
!242 = !DILocation(line: 190, column: 15, scope: !225)
!243 = !DILocation(line: 190, column: 22, scope: !225)
!244 = !DILocalVariable(name: "h", scope: !225, file: !13, line: 190, type: !19)
!245 = !DILocation(line: 191, column: 5, scope: !225)
!246 = !DILocation(line: 191, column: 9, scope: !225)
!247 = !DILocation(line: 191, column: 15, scope: !225)
!248 = !DILocation(line: 191, column: 18, scope: !225)
!249 = !DILocation(line: 192, column: 7, scope: !225)
!250 = !DILocation(line: 192, column: 17, scope: !225)
!251 = !DILocation(line: 192, column: 24, scope: !225)
!252 = !DILocation(line: 192, column: 30, scope: !225)
!253 = !DILocation(line: 192, column: 33, scope: !225)
!254 = !DILocation(line: 189, column: 50, scope: !225)
!255 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 214, type: !158, scopeLine: 214, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!256 = !DILocation(line: 214, column: 1, scope: !255)
!257 = !DILocalVariable(name: "slots", arg: 1, scope: !255, file: !13, line: 214, type: !23)
!258 = !DILocation(line: 215, column: 3, scope: !255)
!259 = !DILocation(line: 215, column: 21, scope: !255)
!260 = !DILocalVariable(name: "i", scope: !255, file: !13, line: 215, type: !4)
!261 = !DILocation(line: 215, column: 34, scope: !255)
!262 = !DILocation(line: 215, column: 24, scope: !255)
!263 = !DILocation(line: 215, column: 28, scope: !255)
!264 = !DILocation(line: 215, column: 54, scope: !255)
!265 = !DILocation(line: 216, column: 5, scope: !255)
!266 = !DILocation(line: 216, column: 11, scope: !255)
!267 = !DILocation(line: 216, column: 16, scope: !255)
!268 = !DILocation(line: 215, column: 49, scope: !255)
!269 = !{null, !23, !4, !4, !19, !4}
!270 = !DISubroutineType(types: !269)
!271 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 259, type: !270, scopeLine: 259, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!272 = !DILocation(line: 259, column: 1, scope: !271)
!273 = !DILocalVariable(name: "slots", arg: 1, scope: !271, file: !13, line: 259, type: !23)
!274 = !DILocalVariable(name: "mask", arg: 2, scope: !271, file: !13, line: 259, type: !4)
!275 = !DILocalVariable(name: "bucket", arg: 3, scope: !271, file: !13, line: 259, type: !4)
!276 = !DILocalVariable(name: "h", arg: 4, scope: !271, file: !13, line: 259, type: !19)
!277 = !DILocalVariable(name: "used", arg: 5, scope: !271, file: !13, line: 259, type: !4)
!278 = !DILocation(line: 260, column: 3, scope: !271)
!279 = !DILocation(line: 260, column: 7, scope: !271)
!280 = !DILocation(line: 260, column: 17, scope: !271)
!281 = !DILocation(line: 260, column: 22, scope: !271)
!282 = !DILocation(line: 260, column: 31, scope: !271)
!283 = !DILocation(line: 260, column: 37, scope: !271)
!284 = !DILocation(line: 260, column: 52, scope: !271)
!285 = !DILocation(line: 261, column: 5, scope: !271)
!286 = !DILocation(line: 261, column: 11, scope: !271)
!287 = !DILocation(line: 261, column: 21, scope: !271)
!288 = !DILocation(line: 261, column: 30, scope: !271)
!289 = !DILocation(line: 261, column: 33, scope: !271)
!290 = !DILocation(line: 261, column: 40, scope: !271)
!291 = !DILocation(line: 262, column: 10, scope: !271)
!292 = !DILocation(line: 263, column: 5, scope: !271)
!293 = !DILocation(line: 263, column: 15, scope: !271)
!294 = !DILocation(line: 263, column: 22, scope: !271)
!295 = !DILocation(line: 263, column: 28, scope: !271)
!296 = !DILocation(line: 263, column: 31, scope: !271)
!297 = !DILocation(line: 263, column: 38, scope: !271)
!298 = !{null, !12}
!299 = !DISubroutineType(types: !298)
!300 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 452, type: !299, scopeLine: 452, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!301 = !DILocation(line: 452, column: 3, scope: !300)
!302 = !DILocalVariable(name: "this", arg: 1, scope: !300, file: !13, line: 452, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!303 = !{!49, !47, i64 16}
!304 = !{!49, !47, i64 20}
!305 = !{!49, !47, i64 40}
!306 = !DILocation(line: 453, column: 5, scope: !300)
!307 = !DILocation(line: 453, column: 18, scope: !300)
!308 = !DILocation(line: 453, column: 33, scope: !300)
!309 = !{!49, !48, i64 8}
!310 = !DILocation(line: 454, column: 5, scope: !300)
!311 = !DILocation(line: 454, column: 22, scope: !300)
!312 = !{!49, !48, i64 24}
!313 = !DILocation(line: 455, column: 5, scope: !300)
!314 = !DILocation(line: 455, column: 24, scope: !300)
!315 = !{!49, !48, i64 32}
!316 = !{!16, !12, !4}
!317 = !DISubroutineType(types: !316)
!318 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 458, type: !317, scopeLine: 458, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!319 = !DILocation(line: 458, column: 3, scope: !318)
!320 = !DILocalVariable(name: "this", arg: 1, scope: !318, file: !13, line: 458, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!321 = !DILocalVariable(name: "key", arg: 2, scope: !318, file: !13, line: 458, type: !4)
!322 = !DILocation(line: 459, column: 5, scope: !318)
!323 = !DILocation(line: 459, column: 12, scope: !318)
!324 = !DILocation(line: 459, column: 23, scope: !318)
!325 = !DILocation(line: 459, column: 35, scope: !318)
!326 = !DILocation(line: 459, column: 46, scope: !318)
!327 = !DILocation(line: 459, column: 64, scope: !318)
!328 = !DILocation(line: 459, column: 80, scope: !318)
!329 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!330 = !{!329, !12, !4}
!331 = !DISubroutineType(types: !330)
!332 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 462, type: !331, scopeLine: 462, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!333 = !DILocation(line: 462, column: 3, scope: !332)
!334 = !DILocalVariable(name: "this", arg: 1, scope: !332, file: !13, line: 462, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!335 = !DILocalVariable(name: "key", arg: 2, scope: !332, file: !13, line: 462, type: !4)
!336 = !DILocation(line: 463, column: 5, scope: !332)
!337 = !DILocation(line: 463, column: 12, scope: !332)
!338 = !DILocation(line: 463, column: 23, scope: !332)
!339 = !DILocation(line: 463, column: 31, scope: !332)
!340 = !{!12, !12, !4}
!341 = !DISubroutineType(types: !340)
!342 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 467, type: !341, scopeLine: 467, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!343 = !DILocation(line: 467, column: 3, scope: !342)
!344 = !DILocalVariable(name: "this", arg: 1, scope: !342, file: !13, line: 467, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!345 = !DILocalVariable(name: "key", arg: 2, scope: !342, file: !13, line: 467, type: !4)
!346 = !DILocation(line: 468, column: 5, scope: !342)
!347 = !DILocation(line: 468, column: 19, scope: !342)
!348 = !DILocation(line: 468, column: 30, scope: !342)
!349 = !DILocalVariable(name: "found", scope: !342, file: !13, line: 468, type: !16)
!350 = !DILocation(line: 469, column: 5, scope: !342)
!351 = !DILocation(line: 469, column: 9, scope: !342)
!352 = !DILocation(line: 469, column: 17, scope: !342)
!353 = !DILocation(line: 469, column: 20, scope: !342)
!354 = !DILocation(line: 470, column: 7, scope: !342)
!355 = !DILocation(line: 470, column: 21, scope: !342)
!356 = !DILocation(line: 470, column: 28, scope: !342)
!357 = !DILocation(line: 472, column: 5, scope: !342)
!358 = !DILocation(line: 472, column: 12, scope: !342)
!359 = !{null, !12, !16, !4}
!360 = !DISubroutineType(types: !359)
!361 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 518, type: !360, scopeLine: 518, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!362 = !DILocation(line: 518, column: 3, scope: !361)
!363 = !DILocalVariable(name: "this", arg: 1, scope: !361, file: !13, line: 518, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!364 = !DILocalVariable(name: "absent", arg: 2, scope: !361, file: !13, line: 518, type: !16)
!365 = !DILocalVariable(name: "key", arg: 3, scope: !361, file: !13, line: 518, type: !4)
!366 = !DILocation(line: 519, column: 5, scope: !361)
!367 = !DILocation(line: 519, column: 20, scope: !361)
!368 = !DILocation(line: 519, column: 21, scope: !361)
!369 = !DILocation(line: 519, column: 25, scope: !361)
!370 = !DILocalVariable(name: "packed", scope: !361, file: !13, line: 519, type: !16)
!371 = !DILocation(line: 520, column: 5, scope: !361)
!372 = !DILocation(line: 520, column: 18, scope: !361)
!373 = !DILocation(line: 520, column: 24, scope: !361)
!374 = !DILocalVariable(name: "bucket", scope: !361, file: !13, line: 520, type: !4)
!375 = !DILocation(line: 521, column: 5, scope: !361)
!376 = !DILocation(line: 521, column: 15, scope: !361)
!377 = !DILocation(line: 521, column: 21, scope: !361)
!378 = !DILocalVariable(name: "h", scope: !361, file: !13, line: 521, type: !19)
!379 = !DILocation(line: 522, column: 5, scope: !361)
!380 = !DILocation(line: 522, column: 9, scope: !361)
!381 = !DILocation(line: 522, column: 15, scope: !361)
!382 = !DILocation(line: 522, column: 41, scope: !361)
!383 = !DILocation(line: 522, column: 52, scope: !361)
!384 = !DILocation(line: 523, column: 7, scope: !361)
!385 = !DILocation(line: 523, column: 11, scope: !361)
!386 = !DILocation(line: 523, column: 24, scope: !361)
!387 = !DILocation(line: 523, column: 37, scope: !361)
!388 = !DILocation(line: 523, column: 50, scope: !361)
!389 = !DILocation(line: 523, column: 53, scope: !361)
!390 = !DILocation(line: 524, column: 9, scope: !361)
!391 = !DILocation(line: 524, column: 15, scope: !361)
!392 = !DILocation(line: 526, column: 7, scope: !361)
!393 = !DILocation(line: 527, column: 7, scope: !361)
!394 = !DILocation(line: 527, column: 16, scope: !361)
!395 = !DILocation(line: 527, column: 17, scope: !361)
!396 = !DILocation(line: 529, column: 5, scope: !361)
!397 = !DILocation(line: 529, column: 25, scope: !361)
!398 = !DILocation(line: 530, column: 5, scope: !361)
!399 = !DILocation(line: 530, column: 27, scope: !361)
!400 = !DILocation(line: 531, column: 5, scope: !361)
!401 = !DILocation(line: 531, column: 17, scope: !361)
!402 = !DILocation(line: 531, column: 29, scope: !361)
!403 = !DILocation(line: 532, column: 5, scope: !361)
!404 = !DILocation(line: 532, column: 17, scope: !361)
!405 = !DILocation(line: 532, column: 29, scope: !361)
!406 = !DILocation(line: 535, column: 5, scope: !361)
!407 = !DILocation(line: 535, column: 18, scope: !361)
!408 = !DILocation(line: 535, column: 24, scope: !361)
!409 = !DILocalVariable(name: "used", scope: !361, file: !13, line: 535, type: !4)
!410 = !DILocation(line: 536, column: 5, scope: !361)
!411 = !DILocation(line: 536, column: 9, scope: !361)
!412 = !DILocation(line: 536, column: 16, scope: !361)
!413 = !DILocation(line: 536, column: 20, scope: !361)
!414 = !DILocation(line: 536, column: 26, scope: !361)
!415 = !DILocation(line: 536, column: 47, scope: !361)
!416 = !DILocation(line: 536, column: 50, scope: !361)
!417 = !DILocation(line: 537, column: 7, scope: !361)
!418 = !DILocation(line: 538, column: 12, scope: !361)
!419 = !DILocation(line: 539, column: 7, scope: !361)
!420 = !DILocation(line: 539, column: 20, scope: !361)
!421 = !DILocation(line: 539, column: 32, scope: !361)
!422 = !DILocation(line: 539, column: 43, scope: !361)
!423 = !DILocation(line: 539, column: 51, scope: !361)
!424 = !DILocation(line: 539, column: 54, scope: !361)
!425 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 543, type: !299, scopeLine: 543, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!426 = !DILocation(line: 543, column: 3, scope: !425)
!427 = !DILocalVariable(name: "this", arg: 1, scope: !425, file: !13, line: 543, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!428 = !DILocation(line: 544, column: 5, scope: !425)
!429 = !DILocation(line: 544, column: 18, scope: !425)
!430 = !DILocation(line: 544, column: 24, scope: !425)
!431 = !DILocalVariable(name: "used", scope: !425, file: !13, line: 544, type: !4)
!432 = !DILocation(line: 545, column: 5, scope: !425)
!433 = !DILocation(line: 545, column: 21, scope: !425)
!434 = !DILocation(line: 545, column: 34, scope: !425)
!435 = !DILocalVariable(name: "walking", scope: !425, file: !13, line: 545, type: !329)
!436 = !DILocation(line: 546, column: 5, scope: !425)
!437 = !DILocation(line: 546, column: 19, scope: !425)
!438 = !DILocation(line: 546, column: 32, scope: !425)
!439 = !DILocation(line: 546, column: 44, scope: !425)
!440 = !DILocation(line: 546, column: 54, scope: !425)
!441 = !DILocation(line: 546, column: 61, scope: !425)
!442 = !DILocation(line: 546, column: 72, scope: !425)
!443 = !DILocalVariable(name: "slots", scope: !425, file: !13, line: 546, type: !23)
!444 = !DILocation(line: 547, column: 5, scope: !425)
!445 = !DILocation(line: 547, column: 9, scope: !425)
!446 = !DILocation(line: 547, column: 10, scope: !425)
!447 = !DILocation(line: 547, column: 21, scope: !425)
!448 = !DILocation(line: 547, column: 33, scope: !425)
!449 = !DILocation(line: 547, column: 39, scope: !425)
!450 = !DILocation(line: 548, column: 7, scope: !425)
!451 = !DILocation(line: 548, column: 22, scope: !425)
!452 = !DILocation(line: 548, column: 38, scope: !425)
!453 = !DILocation(line: 549, column: 7, scope: !425)
!454 = !DILocation(line: 549, column: 21, scope: !425)
!455 = !DILocation(line: 551, column: 5, scope: !425)
!456 = !DILocation(line: 551, column: 18, scope: !425)
!457 = !DILocation(line: 552, column: 5, scope: !425)
!458 = !DILocation(line: 552, column: 17, scope: !425)
!459 = !DILocation(line: 552, column: 23, scope: !425)
!460 = !DILocation(line: 552, column: 39, scope: !425)
!461 = !DILocation(line: 553, column: 5, scope: !425)
!462 = !DILocation(line: 553, column: 12, scope: !425)
!463 = !DILocation(line: 553, column: 19, scope: !425)
!464 = !{!16, !23, !4, !23, !33, !4}
!465 = !DISubroutineType(types: !464)
!466 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 96, type: !465, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!467 = !DILocation(line: 96, column: 1, scope: !466)
!468 = !DILocalVariable(name: "slots", arg: 1, scope: !466, file: !13, line: 96, type: !23)
!469 = !DILocalVariable(name: "mask", arg: 2, scope: !466, file: !13, line: 96, type: !4)
!470 = !DILocalVariable(name: "hashes", arg: 3, scope: !466, file: !13, line: 96, type: !23)
!471 = !DILocalVariable(name: "keys", arg: 4, scope: !466, file: !13, line: 96, type: !33)
!472 = !DILocalVariable(name: "key", arg: 5, scope: !466, file: !13, line: 96, type: !4)
!473 = !DILocation(line: 97, column: 3, scope: !466)
!474 = !DILocation(line: 97, column: 13, scope: !466)
!475 = !DILocation(line: 97, column: 21, scope: !466)
!476 = !DILocalVariable(name: "h", scope: !466, file: !13, line: 97, type: !19)
!477 = !DILocation(line: 98, column: 3, scope: !466)
!478 = !DILocation(line: 98, column: 23, scope: !466)
!479 = !DILocalVariable(name: "fingerprint", scope: !466, file: !13, line: 98, type: !19)
!480 = !DILocation(line: 99, column: 3, scope: !466)
!481 = !DILocation(line: 99, column: 16, scope: !466)
!482 = !DILocation(line: 99, column: 27, scope: !466)
!483 = !DILocation(line: 99, column: 30, scope: !466)
!484 = !DILocalVariable(name: "bucket", scope: !466, file: !13, line: 99, type: !4)
!485 = !DILocation(line: 102, column: 3, scope: !466)
!486 = !DILocation(line: 102, column: 40, scope: !466)
!487 = !DILocation(line: 109, column: 33, scope: !466)
!488 = !DILocation(line: 109, column: 82, scope: !466)
!489 = !DILocation(line: 102, column: 10, scope: !466)
!490 = !DILocation(line: 102, column: 20, scope: !466)
!491 = !DILocation(line: 102, column: 25, scope: !466)
!492 = !DILocation(line: 102, column: 34, scope: !466)
!493 = !DILocation(line: 102, column: 55, scope: !466)
!494 = !DILocation(line: 103, column: 5, scope: !466)
!495 = !DILocation(line: 103, column: 18, scope: !466)
!496 = !DILocation(line: 103, column: 24, scope: !466)
!497 = !DILocalVariable(name: "word", scope: !466, file: !13, line: 103, type: !19)
!498 = !DILocation(line: 104, column: 5, scope: !466)
!499 = !DILocation(line: 104, column: 9, scope: !466)
!500 = !DILocation(line: 104, column: 18, scope: !466)
!501 = !DILocation(line: 104, column: 21, scope: !466)
!502 = !DILocation(line: 105, column: 7, scope: !466)
!503 = !DILocation(line: 105, column: 14, scope: !466)
!504 = !DILocation(line: 105, column: 23, scope: !466)
!505 = !DILocation(line: 105, column: 31, scope: !466)
!506 = !DILocation(line: 107, column: 5, scope: !466)
!507 = !DILocation(line: 107, column: 9, scope: !466)
!508 = !DILocation(line: 107, column: 25, scope: !466)
!509 = !DILocation(line: 107, column: 38, scope: !466)
!510 = !DILocation(line: 108, column: 7, scope: !466)
!511 = !DILocation(line: 108, column: 18, scope: !466)
!512 = !DILocation(line: 108, column: 24, scope: !466)
!513 = !DILocation(line: 108, column: 31, scope: !466)
!514 = !DILocation(line: 108, column: 43, scope: !466)
!515 = !DILocalVariable(name: "at", scope: !466, file: !13, line: 108, type: !4)
!516 = !DILocation(line: 109, column: 7, scope: !466)
!517 = !DILocation(line: 109, column: 11, scope: !466)
!518 = !DILocation(line: 109, column: 17, scope: !466)
!519 = !DILocation(line: 109, column: 22, scope: !466)
!520 = !DILocation(line: 109, column: 27, scope: !466)
!521 = !DILocation(line: 109, column: 51, scope: !466)
!522 = !DILocation(line: 109, column: 58, scope: !466)
!523 = !DILocation(line: 109, column: 66, scope: !466)
!524 = !DILocation(line: 109, column: 71, scope: !466)
!525 = !DILocation(line: 109, column: 76, scope: !466)
!526 = !DILocation(line: 109, column: 98, scope: !466)
!527 = !DILocation(line: 109, column: 106, scope: !466)
!528 = !DILocation(line: 109, column: 111, scope: !466)
!529 = !DILocation(line: 109, column: 116, scope: !466)
!530 = !DILocation(line: 109, column: 122, scope: !466)
!531 = !DILocation(line: 110, column: 9, scope: !466)
!532 = !DILocation(line: 110, column: 16, scope: !466)
!533 = !DILocation(line: 110, column: 24, scope: !466)
!534 = !DILocation(line: 110, column: 32, scope: !466)
!535 = !DILocation(line: 113, column: 5, scope: !466)
!536 = !DILocation(line: 113, column: 14, scope: !466)
!537 = !DILocation(line: 113, column: 15, scope: !466)
!538 = !DILocation(line: 113, column: 24, scope: !466)
!539 = !DILocation(line: 113, column: 29, scope: !466)
!540 = !DILocation(line: 115, column: 3, scope: !466)
!541 = !DILocation(line: 115, column: 9, scope: !466)
!542 = !{null, !33, !23}
!543 = !DISubroutineType(types: !542)
!544 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 136, type: !543, scopeLine: 136, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!545 = !DILocation(line: 136, column: 1, scope: !544)
!546 = !DILocalVariable(name: "items", arg: 1, scope: !544, file: !13, line: 136, type: !33)
!547 = !DILocalVariable(name: "hashes", arg: 2, scope: !544, file: !13, line: 136, type: !23)
!548 = !DILocation(line: 137, column: 3, scope: !544)
!549 = !DILocation(line: 137, column: 16, scope: !544)
!550 = !DILocation(line: 137, column: 22, scope: !544)
!551 = !DILocalVariable(name: "used", scope: !544, file: !13, line: 137, type: !4)
!552 = !DILocation(line: 138, column: 3, scope: !544)
!553 = !DILocation(line: 138, column: 17, scope: !544)
!554 = !DILocalVariable(name: "to", scope: !544, file: !13, line: 138, type: !4)
!555 = !DILocation(line: 139, column: 3, scope: !544)
!556 = !DILocation(line: 139, column: 24, scope: !544)
!557 = !DILocalVariable(name: "from", scope: !544, file: !13, line: 139, type: !4)
!558 = !DILocation(line: 139, column: 55, scope: !544)
!559 = !DILocation(line: 140, column: 68, scope: !544)
!560 = !DILocation(line: 139, column: 27, scope: !544)
!561 = !DILocation(line: 139, column: 34, scope: !544)
!562 = !DILocation(line: 139, column: 42, scope: !544)
!563 = !DILocation(line: 139, column: 49, scope: !544)
!564 = !DILocation(line: 139, column: 79, scope: !544)
!565 = !DILocation(line: 140, column: 5, scope: !544)
!566 = !DILocation(line: 140, column: 9, scope: !544)
!567 = !DILocation(line: 140, column: 16, scope: !544)
!568 = !DILocation(line: 140, column: 26, scope: !544)
!569 = !DILocation(line: 140, column: 31, scope: !544)
!570 = !DILocation(line: 140, column: 37, scope: !544)
!571 = !DILocation(line: 140, column: 42, scope: !544)
!572 = !DILocation(line: 140, column: 47, scope: !544)
!573 = !DILocation(line: 140, column: 55, scope: !544)
!574 = !DILocation(line: 140, column: 62, scope: !544)
!575 = !DILocation(line: 140, column: 83, scope: !544)
!576 = !DILocation(line: 141, column: 7, scope: !544)
!577 = !DILocation(line: 141, column: 13, scope: !544)
!578 = !DILocation(line: 141, column: 19, scope: !544)
!579 = !DILocation(line: 141, column: 25, scope: !544)
!580 = !DILocation(line: 142, column: 7, scope: !544)
!581 = !DILocation(line: 139, column: 71, scope: !544)
!582 = !DILocation(line: 145, column: 3, scope: !544)
!583 = !DILocation(line: 145, column: 10, scope: !544)
!584 = !DILocation(line: 145, column: 16, scope: !544)
!585 = !DILocation(line: 145, column: 32, scope: !544)
!586 = !DILocation(line: 145, column: 36, scope: !544)
!587 = !DILocation(line: 146, column: 5, scope: !544)
