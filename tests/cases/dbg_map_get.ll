%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 !dbg !79 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !81, metadata !DIExpression()), !dbg !80
  call void @llvm.dbg.value(metadata i32 %index, metadata !82, metadata !DIExpression()), !dbg !80
  %0 = lshr i32 %h, 24, !dbg !85
  %1 = shl i32 %0, 24, !dbg !84
  %2 = add nsw i32 %index, 1, !dbg !87
  %3 = or i32 %1, %2, !dbg !83
  ret i32 %3, !dbg !80
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
  %0 = sub nsw i32 0, 1, !dbg !107
  %1 = sext i32 %0 to i64, !dbg !106
  %2 = sext i32 %bucket to i64, !dbg !111
  %3 = shl i64 %2, 32, !dbg !111
  %4 = zext i32 %h to i64, !dbg !113
  %5 = or i64 %3, %4, !dbg !110
  %6 = sub nsw i64 %1, %5, !dbg !106
  ret i64 %6, !dbg !103
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !117 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !119, metadata !DIExpression()), !dbg !118
  call void @llvm.dbg.value(metadata i32 %mask, metadata !120, metadata !DIExpression()), !dbg !118
  call void @llvm.dbg.value(metadata i32 %h, metadata !121, metadata !DIExpression()), !dbg !118
  call void @llvm.dbg.value(metadata i32 %index, metadata !122, metadata !DIExpression()), !dbg !118
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !124
  store i32 %0, i32* %word.addr, align 4, !dbg !123
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !127, metadata !DIExpression()), !dbg !123
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !129
  store i32 %1, i32* %bucket.addr, align 4, !dbg !128
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !132, metadata !DIExpression()), !dbg !128
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !133
  %3 = load i64, i64* %2, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !133
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !133
  %5 = load i8*, i8** %4, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !133
  br label %while.cond, !dbg !133

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !147
  %7 = icmp sge i32 %6, 0, !dbg !147
  br i1 %7, label %land.rhs, label %land.end, !dbg !147

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !149
  %9 = trunc i64 %3 to i32, !dbg !134
  %10 = icmp slt i32 %8, %9, !dbg !149
  br label %land.end, !dbg !147

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !147
  br i1 %11, label %while.body, label %while.end, !dbg !133

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !154
  %13 = sext i32 %12 to i64, !dbg !153
  %14 = bitcast i8* %5 to i32*, !dbg !153
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !153
  %16 = load i32, i32* %15, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !153
  %17 = icmp eq i32 %16, 0, !dbg !153
  br i1 %17, label %if.then, label %if.end, !dbg !152

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !160
  %19 = sext i32 %18 to i64, !dbg !159
  %20 = load i32, i32* %word.addr, align 4, !dbg !161
  %21 = bitcast i8* %5 to i32*, !dbg !159
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !159
  store i32 %20, i32* %22, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !159
  ret void, !dbg !162

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !165
  %24 = add nsw i32 %23, 1, !dbg !165
  %25 = and i32 %24, %mask, !dbg !164
  store i32 %25, i32* %bucket.addr, align 4, !dbg !163
  br label %while.cond, !dbg !133

while.end:
  ret void, !dbg !118
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !170 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !172, metadata !DIExpression()), !dbg !171
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !175
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !175
  %2 = trunc i64 %1 to i32, !dbg !175
  store i32 %2, i32* %used.addr, align 4, !dbg !173
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !176, metadata !DIExpression()), !dbg !173
  store i32 0, i32* %to.addr, align 4, !dbg !177
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !179, metadata !DIExpression()), !dbg !177
  store i32 0, i32* %from.addr, align 4, !dbg !180
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !182, metadata !DIExpression()), !dbg !180
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !180
  %4 = load i8*, i8** %3, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !180
  br label %for.cond, !dbg !180

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !184
  %6 = load i32, i32* %used.addr, align 4, !dbg !185
  %7 = icmp slt i32 %5, %6, !dbg !184
  br i1 %7, label %for.body, label %for.end, !dbg !180

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !188
  %9 = sext i32 %8 to i64, !dbg !183
  %10 = bitcast i8* %4 to i32*, !dbg !183
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !183
  %12 = load i32, i32* %11, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !183
  store i32 %12, i32* %h.addr, align 4, !dbg !187
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !189, metadata !DIExpression()), !dbg !187
  %13 = load i32, i32* %h.addr, align 4, !dbg !191
  %14 = icmp ne i32 %13, 0, !dbg !191
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !191

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !193
  %16 = icmp sge i32 %15, 0, !dbg !193
  br label %land.end.1, !dbg !191

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !191
  br i1 %17, label %land.rhs, label %land.end, !dbg !191

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !195
  %19 = load i32, i32* %used.addr, align 4, !dbg !196
  %20 = icmp slt i32 %18, %19, !dbg !195
  br label %land.end, !dbg !191

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !191
  br i1 %21, label %if.then, label %if.end, !dbg !190

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !199
  %23 = sext i32 %22 to i64, !dbg !198
  %24 = load i32, i32* %h.addr, align 4, !dbg !200
  %25 = bitcast i8* %4 to i32*, !dbg !198
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !198
  store i32 %24, i32* %26, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !198
  %27 = load i32, i32* %to.addr, align 4, !dbg !201
  %28 = add nsw i32 %27, 1, !dbg !201
  store i32 %28, i32* %to.addr, align 4, !dbg !201
  br label %if.end, !dbg !190

if.end:
  br label %for.inc, !dbg !180

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !202
  %30 = add nsw i32 %29, 1, !dbg !202
  store i32 %30, i32* %from.addr, align 4, !dbg !202
  br label %for.cond, !dbg !180

for.end:
  br label %while.cond, !dbg !203

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !205
  %32 = load i64, i64* %31, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !205
  %33 = trunc i64 %32 to i32, !dbg !205
  %34 = load i32, i32* %to.addr, align 4, !dbg !206
  %35 = icmp sgt i32 %33, %34, !dbg !204
  br i1 %35, label %while.body, label %while.end, !dbg !203

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !208
  %37 = load i64, i64* %36, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !208
  %38 = icmp eq i64 %37, 0, !dbg !208
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !208

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !208
  unreachable, !dbg !208

pop.ok:
  %39 = sub i64 %37, 1, !dbg !208
  store i64 %39, i64* %36, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !208
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !208
  %41 = load i8*, i8** %40, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !208
  %42 = bitcast i8* %41 to i32*, !dbg !208
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !208
  %44 = load i32, i32* %43, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !208
  br label %while.cond, !dbg !203

while.end:
  ret void, !dbg !171
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !211 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !213, metadata !DIExpression()), !dbg !212
  call void @llvm.dbg.value(metadata i32 %live, metadata !214, metadata !DIExpression()), !dbg !212
  call void @llvm.dbg.value(metadata i32 %used, metadata !215, metadata !DIExpression()), !dbg !212
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !218
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !218
  %2 = trunc i64 %1 to i32, !dbg !218
  store i32 %2, i32* %n.addr, align 4, !dbg !216
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !219, metadata !DIExpression()), !dbg !216
  %3 = mul nsw i32 %live, 2, !dbg !221
  %4 = icmp slt i32 %3, %used, !dbg !221
  br i1 %4, label %if.then, label %if.end, !dbg !220

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !225
  ret %struct.nish_array* %slots, !dbg !227

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !231
  %6 = mul nsw i32 %5, 2, !dbg !231
  %7 = sext i32 %6 to i64, !dbg !230
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !230
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !230
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !230
  store i64 %7, i64* %10, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !230
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !230
  store i64 %7, i64* %11, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !230
  %12 = mul i64 %7, 4, !dbg !230
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !230
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !139, !noalias !138, !dbg !230
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !230
  store i8* %13, i8** %14, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !230
  ret %struct.nish_array* %9, !dbg !229
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !236 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !238, metadata !DIExpression()), !dbg !237
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !239, metadata !DIExpression()), !dbg !237
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !242
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !242
  %2 = trunc i64 %1 to i32, !dbg !242
  %3 = sub nsw i32 %2, 1, !dbg !241
  store i32 %3, i32* %mask.addr, align 4, !dbg !240
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !244, metadata !DIExpression()), !dbg !240
  store i32 0, i32* %i.addr, align 4, !dbg !245
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !247, metadata !DIExpression()), !dbg !245
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !245
  %5 = load i64, i64* %4, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !245
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !245
  %7 = load i8*, i8** %6, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !245
  br label %for.cond, !dbg !245

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !249
  %9 = trunc i64 %5 to i32, !dbg !248
  %10 = icmp slt i32 %8, %9, !dbg !249
  br i1 %10, label %for.body, label %for.end, !dbg !245

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !254
  %12 = sext i32 %11 to i64, !dbg !253
  %13 = bitcast i8* %7 to i32*, !dbg !253
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !253
  %15 = load i32, i32* %14, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !253
  store i32 %15, i32* %h.addr, align 4, !dbg !252
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !255, metadata !DIExpression()), !dbg !252
  %16 = load i32, i32* %h.addr, align 4, !dbg !257
  %17 = icmp ne i32 %16, 0, !dbg !257
  br i1 %17, label %if.then, label %if.end, !dbg !256

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !262
  %19 = load i32, i32* %h.addr, align 4, !dbg !263
  %20 = load i32, i32* %i.addr, align 4, !dbg !264
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !260
  br label %if.end, !dbg !256

if.end:
  br label %for.inc, !dbg !245

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !265
  %22 = add nsw i32 %21, 1, !dbg !265
  store i32 %22, i32* %i.addr, align 4, !dbg !265
  br label %for.cond, !dbg !245

for.end:
  ret void, !dbg !237
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !266 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !268, metadata !DIExpression()), !dbg !267
  store i32 0, i32* %i.addr, align 4, !dbg !269
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !271, metadata !DIExpression()), !dbg !269
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !269
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !269
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !269
  %3 = load i8*, i8** %2, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !269
  br label %for.cond, !dbg !269

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !273
  %5 = trunc i64 %1 to i32, !dbg !272
  %6 = icmp slt i32 %4, %5, !dbg !273
  br i1 %6, label %for.body, label %for.end, !dbg !269

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !277
  %8 = sext i32 %7 to i64, !dbg !276
  %9 = bitcast i8* %3 to i32*, !dbg !276
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !276
  store i32 0, i32* %10, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !276
  br label %for.inc, !dbg !269

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !279
  %12 = add nsw i32 %11, 1, !dbg !279
  store i32 %12, i32* %i.addr, align 4, !dbg !279
  br label %for.cond, !dbg !269

for.end:
  ret void, !dbg !267
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !282 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !284, metadata !DIExpression()), !dbg !283
  call void @llvm.dbg.value(metadata i32 %mask, metadata !285, metadata !DIExpression()), !dbg !283
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !286, metadata !DIExpression()), !dbg !283
  call void @llvm.dbg.value(metadata i32 %h, metadata !287, metadata !DIExpression()), !dbg !283
  call void @llvm.dbg.value(metadata i32 %used, metadata !288, metadata !DIExpression()), !dbg !283
  %0 = icmp sge i32 %bucket, 0, !dbg !290
  br i1 %0, label %land.rhs, label %land.end, !dbg !290

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !294
  %2 = load i64, i64* %1, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !294
  %3 = trunc i64 %2 to i32, !dbg !294
  %4 = icmp slt i32 %bucket, %3, !dbg !292
  br label %land.end, !dbg !290

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !290
  br i1 %5, label %if.then, label %if.else, !dbg !289

if.then:
  %6 = sext i32 %bucket to i64, !dbg !296
  %7 = sub nsw i32 %used, 1, !dbg !300
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !298
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !296
  %10 = load i8*, i8** %9, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !296
  %11 = bitcast i8* %10 to i32*, !dbg !296
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !296
  store i32 %8, i32* %12, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !296
  br label %if.end, !dbg !289

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !307
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !303
  br label %if.end, !dbg !289

if.end:
  ret void, !dbg !283
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 !dbg !311 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !313, metadata !DIExpression()), !dbg !312
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !312
  store i32 0, i32* %0, align 4, !tbaa !317, !dbg !312
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !312
  store i32 7, i32* %1, align 4, !tbaa !318, !dbg !312
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !312
  store i32 0, i32* %2, align 4, !tbaa !319, !dbg !312
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !312
  store i32 0, i32* %3, align 4, !tbaa !320, !dbg !312
  %4 = sext i32 8 to i64, !dbg !322
  %5 = call i8* @nish_alloc_struct(i64 24), !dbg !322
  %6 = bitcast i8* %5 to %struct.nish_array*, !dbg !322
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0, !dbg !322
  store i64 %4, i64* %7, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !322
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1, !dbg !322
  store i64 %4, i64* %8, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !322
  %9 = mul i64 %4, 4, !dbg !322
  %10 = call i8* @nish_alloc_struct(i64 %9), !dbg !322
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !139, !noalias !138, !dbg !322
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2, !dbg !322
  store i8* %10, i8** %11, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !322
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !321
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !324, !dbg !321
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !326
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !326
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !326
  store i64 0, i64* %15, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !326
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !326
  store i64 0, i64* %16, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !326
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !326
  store i8* null, i8** %17, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !326
  %18 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !325
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !327, !dbg !325
  %19 = call i8* @nish_alloc_struct(i64 24), !dbg !329
  %20 = bitcast i8* %19 to %struct.nish_array*, !dbg !329
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !329
  store i64 0, i64* %21, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !329
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !329
  store i64 0, i64* %22, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !329
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !329
  store i8* null, i8** %23, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !329
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !328
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !330, !dbg !328
  %25 = call i8* @nish_alloc_struct(i64 24), !dbg !332
  %26 = bitcast i8* %25 to %struct.nish_array*, !dbg !332
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0, !dbg !332
  store i64 0, i64* %27, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !332
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1, !dbg !332
  store i64 0, i64* %28, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !332
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2, !dbg !332
  store i8* null, i8** %29, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !332
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !331
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !333, !dbg !331
  ret void, !dbg !312
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !336 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !338, metadata !DIExpression()), !dbg !337
  call void @llvm.dbg.value(metadata i8* %key, metadata !339, metadata !DIExpression()), !dbg !337
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !342
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !324, !dbg !342
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !343
  %3 = load i32, i32* %2, align 4, !tbaa !318, !dbg !343
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !344
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !333, !dbg !344
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !345
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !327, !dbg !345
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key), !dbg !341
  ret i64 %8, !dbg !340
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !349 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !351, metadata !DIExpression()), !dbg !350
  call void @llvm.dbg.value(metadata i8* %key, metadata !352, metadata !DIExpression()), !dbg !350
  call void @llvm.dbg.value(metadata i32 %value, metadata !353, metadata !DIExpression()), !dbg !350
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key), !dbg !355
  store i64 %0, i64* %found.addr, align 8, !dbg !354
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !357, metadata !DIExpression()), !dbg !354
  %1 = load i64, i64* %found.addr, align 8, !dbg !359
  %2 = icmp sge i64 %1, 0, !dbg !359
  br i1 %2, label %if.then, label %if.else, !dbg !358

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !364
  %4 = trunc i64 %3 to i32, !dbg !363
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value), !dbg !362
  br label %if.end, !dbg !358

if.else:
  %5 = load i64, i64* %found.addr, align 8, !dbg !368
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value), !dbg !367
  br label %if.end, !dbg !358

if.end:
  ret %struct.Map$str$i32* %this, !dbg !371
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 !dbg !375 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !377, metadata !DIExpression()), !dbg !376
  call void @llvm.dbg.value(metadata i32 %index, metadata !378, metadata !DIExpression()), !dbg !376
  %0 = icmp slt i32 %index, 0, !dbg !380
  br i1 %0, label %lor.end, label %lor.rhs, !dbg !380

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !384
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !330, !dbg !384
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !384
  %4 = load i64, i64* %3, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !384
  %5 = trunc i64 %4 to i32, !dbg !384
  %6 = icmp sge i32 %index, %5, !dbg !382
  br label %lor.end, !dbg !380

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ], !dbg !380
  br i1 %7, label %if.then, label %if.end, !dbg !379

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i32 2, i1 true), !dbg !386
  call void @nish_exit(i32 1), !dbg !386
  unreachable, !dbg !386

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !389
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !330, !dbg !389
  %10 = sext i32 %index to i64, !dbg !389
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !389
  %12 = load i64, i64* %11, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !389
  %13 = icmp ult i64 %10, %12, !dbg !389
  br i1 %13, label %bounds.ok, label %bounds.fail, !dbg !389

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12), !dbg !389
  unreachable, !dbg !389

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !389
  %15 = load i8*, i8** %14, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !389
  %16 = bitcast i8* %15 to i32*, !dbg !389
  %17 = getelementptr inbounds i32, i32* %16, i64 %10, !dbg !389
  %18 = load i32, i32* %17, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !389
  ret i32 %18, !dbg !388
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 !dbg !393 {
entry:
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !395, metadata !DIExpression()), !dbg !394
  call void @llvm.dbg.value(metadata i32 %index, metadata !396, metadata !DIExpression()), !dbg !394
  call void @llvm.dbg.value(metadata i32 %value, metadata !397, metadata !DIExpression()), !dbg !394
  %0 = icmp sge i32 %index, 0, !dbg !399
  br i1 %0, label %land.rhs, label %land.end, !dbg !399

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !403
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !330, !dbg !403
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !403
  %4 = load i64, i64* %3, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !403
  %5 = trunc i64 %4 to i32, !dbg !403
  %6 = icmp slt i32 %index, %5, !dbg !401
  br label %land.end, !dbg !399

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ], !dbg !399
  br i1 %7, label %if.then, label %if.end, !dbg !398

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !405
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !330, !dbg !405
  %10 = sext i32 %index to i64, !dbg !405
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !405
  %12 = load i8*, i8** %11, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !405
  %13 = bitcast i8* %12 to i32*, !dbg !405
  %14 = getelementptr inbounds i32, i32* %13, i64 %10, !dbg !405
  store i32 %value, i32* %14, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !405
  br label %if.end, !dbg !398

if.end:
  ret void, !dbg !394
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 !dbg !410 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !412, metadata !DIExpression()), !dbg !411
  call void @llvm.dbg.value(metadata i64 %absent, metadata !413, metadata !DIExpression()), !dbg !411
  call void @llvm.dbg.value(metadata i8* %key, metadata !414, metadata !DIExpression()), !dbg !411
  call void @llvm.dbg.value(metadata i32 %value, metadata !415, metadata !DIExpression()), !dbg !411
  %0 = sub nsw i64 0, 1, !dbg !417
  %1 = sub nsw i64 %0, %absent, !dbg !417
  store i64 %1, i64* %packed.addr, align 8, !dbg !416
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !420, metadata !DIExpression()), !dbg !416
  %2 = load i64, i64* %packed.addr, align 8, !dbg !423
  %3 = ashr i64 %2, 32, !dbg !423
  %4 = trunc i64 %3 to i32, !dbg !422
  store i32 %4, i32* %bucket.addr, align 4, !dbg !421
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !424, metadata !DIExpression()), !dbg !421
  %5 = load i64, i64* %packed.addr, align 8, !dbg !427
  %6 = trunc i64 %5 to i32, !dbg !426
  store i32 %6, i32* %h.addr, align 4, !dbg !425
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !428, metadata !DIExpression()), !dbg !425
  %7 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !431
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !327, !dbg !431
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !431
  %10 = load i64, i64* %9, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !431
  %11 = trunc i64 %10 to i32, !dbg !431
  %12 = icmp sge i32 %11, 16777215, !dbg !430
  br i1 %12, label %if.then, label %if.end, !dbg !429

if.then:
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !435
  %14 = load i32, i32* %13, align 4, !tbaa !319, !dbg !435
  %15 = icmp sge i32 %14, 16777215, !dbg !435
  br i1 %15, label %lor.end, label %lor.rhs, !dbg !435

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !437
  %17 = load i32, i32* %16, align 4, !tbaa !320, !dbg !437
  %18 = icmp sgt i32 %17, 0, !dbg !437
  br label %lor.end, !dbg !435

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ], !dbg !435
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !434

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true), !dbg !440
  call void @nish_exit(i32 1), !dbg !440
  unreachable, !dbg !440

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !442
  %20 = sub nsw i32 0, 1, !dbg !444
  store i32 %20, i32* %bucket.addr, align 4, !dbg !443
  br label %if.end, !dbg !429

if.end:
  %21 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !446
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !327, !dbg !446
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0, !dbg !446
  %24 = load i64, i64* %23, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !446
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1, !dbg !446
  %26 = load i64, i64* %25, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !446
  %27 = icmp eq i64 %24, %26, !dbg !446
  br i1 %27, label %push.grow, label %push.store, !dbg !446

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 8), !dbg !446
  br label %push.store, !dbg !446

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2, !dbg !446
  %29 = load i8*, i8** %28, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !446
  %30 = bitcast i8* %29 to i8**, !dbg !446
  %31 = getelementptr inbounds i8*, i8** %30, i64 %24, !dbg !446
  store i8* %key, i8** %31, align 8, !alias.scope !139, !noalias !138, !tbaa !449, !dbg !446
  %32 = add i64 %24, 1, !dbg !446
  store i64 %32, i64* %23, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !446
  %33 = trunc i64 %32 to i32, !dbg !446
  %34 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !450
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !330, !dbg !450
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0, !dbg !450
  %37 = load i64, i64* %36, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !450
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1, !dbg !450
  %39 = load i64, i64* %38, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !450
  %40 = icmp eq i64 %37, %39, !dbg !450
  br i1 %40, label %push.grow.1, label %push.store.1, !dbg !450

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %35, i64 4), !dbg !450
  br label %push.store.1, !dbg !450

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2, !dbg !450
  %42 = load i8*, i8** %41, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !450
  %43 = bitcast i8* %42 to i32*, !dbg !450
  %44 = getelementptr inbounds i32, i32* %43, i64 %37, !dbg !450
  store i32 %value, i32* %44, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !450
  %45 = add i64 %37, 1, !dbg !450
  store i64 %45, i64* %36, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !450
  %46 = trunc i64 %45 to i32, !dbg !450
  %47 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !452
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !333, !dbg !452
  %49 = load i32, i32* %h.addr, align 4, !dbg !453
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0, !dbg !452
  %51 = load i64, i64* %50, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !452
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1, !dbg !452
  %53 = load i64, i64* %52, align 8, !alias.scope !138, !noalias !139, !tbaa !233, !dbg !452
  %54 = icmp eq i64 %51, %53, !dbg !452
  br i1 %54, label %push.grow.2, label %push.store.2, !dbg !452

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4), !dbg !452
  br label %push.store.2, !dbg !452

push.store.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2, !dbg !452
  %56 = load i8*, i8** %55, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !452
  %57 = bitcast i8* %56 to i32*, !dbg !452
  %58 = getelementptr inbounds i32, i32* %57, i64 %51, !dbg !452
  store i32 %49, i32* %58, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !452
  %59 = add i64 %51, 1, !dbg !452
  store i64 %59, i64* %50, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !452
  %60 = trunc i64 %59 to i32, !dbg !452
  %61 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !455
  %62 = load i32, i32* %61, align 4, !tbaa !319, !dbg !455
  %63 = add nsw i32 %62, 1, !dbg !455
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !454
  store i32 %63, i32* %64, align 4, !tbaa !319, !dbg !454
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !458
  %66 = load i32, i32* %65, align 4, !tbaa !317, !dbg !458
  %67 = add nsw i32 %66, 1, !dbg !458
  %68 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0, !dbg !457
  store i32 %67, i32* %68, align 4, !tbaa !317, !dbg !457
  %69 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !462
  %70 = load %struct.nish_array*, %struct.nish_array** %69, align 8, !tbaa !327, !dbg !462
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0, !dbg !462
  %72 = load i64, i64* %71, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !462
  %73 = trunc i64 %72 to i32, !dbg !462
  store i32 %73, i32* %used.addr, align 4, !dbg !460
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !463, metadata !DIExpression()), !dbg !460
  %74 = load i32, i32* %used.addr, align 4, !dbg !465
  %75 = mul nsw i32 %74, 4, !dbg !465
  %76 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !468
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !324, !dbg !468
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0, !dbg !468
  %79 = load i64, i64* %78, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !468
  %80 = trunc i64 %79 to i32, !dbg !468
  %81 = mul nsw i32 %80, 3, !dbg !467
  %82 = icmp sgt i32 %75, %81, !dbg !465
  br i1 %82, label %if.then.2, label %if.else, !dbg !464

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this), !dbg !471
  br label %if.end.2, !dbg !464

if.else:
  %83 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !474
  %84 = load %struct.nish_array*, %struct.nish_array** %83, align 8, !tbaa !324, !dbg !474
  %85 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !475
  %86 = load i32, i32* %85, align 4, !tbaa !318, !dbg !475
  %87 = load i32, i32* %bucket.addr, align 4, !dbg !476
  %88 = load i32, i32* %h.addr, align 4, !dbg !477
  %89 = load i32, i32* %used.addr, align 4, !dbg !478
  call void @nish.fileAppended(%struct.nish_array* %84, i32 %86, i32 %87, i32 %88, i32 %89), !dbg !473
  br label %if.end.2, !dbg !464

if.end.2:
  ret void, !dbg !411
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 !dbg !479 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Map$str$i32* %this, metadata !481, metadata !DIExpression()), !dbg !480
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !484
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !327, !dbg !484
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !484
  %3 = load i64, i64* %2, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !484
  %4 = trunc i64 %3 to i32, !dbg !484
  store i32 %4, i32* %used.addr, align 4, !dbg !482
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !485, metadata !DIExpression()), !dbg !482
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7, !dbg !487
  %6 = load i32, i32* %5, align 4, !tbaa !320, !dbg !487
  %7 = icmp sgt i32 %6, 0, !dbg !487
  store i1 %7, i1* %walking.addr, align 1, !dbg !486
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !490, metadata !DIExpression()), !dbg !486
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !493
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !324, !dbg !493
  %10 = load i1, i1* %walking.addr, align 1, !dbg !494
  br i1 %10, label %cond.true, label %cond.false, !dbg !494

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !495
  br label %cond.end, !dbg !494

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !496
  %13 = load i32, i32* %12, align 4, !tbaa !319, !dbg !496
  br label %cond.end, !dbg !494

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !494
  %15 = load i32, i32* %used.addr, align 4, !dbg !497
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !492
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !491
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !498, metadata !DIExpression()), !dbg !491
  %17 = load i1, i1* %walking.addr, align 1, !dbg !501
  %18 = xor i1 %17, true, !dbg !500
  br i1 %18, label %land.rhs, label %land.end, !dbg !500

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3, !dbg !502
  %20 = load i32, i32* %19, align 4, !tbaa !319, !dbg !502
  %21 = load i32, i32* %used.addr, align 4, !dbg !503
  %22 = icmp slt i32 %20, %21, !dbg !502
  br label %land.end, !dbg !500

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !500
  br i1 %23, label %if.then, label %if.end, !dbg !499

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4, !dbg !506
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !327, !dbg !506
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !507
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !333, !dbg !507
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !505
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5, !dbg !509
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !330, !dbg !509
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !510
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !333, !dbg !510
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !508
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !512
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !333, !dbg !512
  call void @nish.compactHashes(%struct.nish_array* %33), !dbg !511
  br label %if.end, !dbg !499

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !514
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1, !dbg !513
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !324, !dbg !513
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !517
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0, !dbg !517
  %38 = load i64, i64* %37, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !517
  %39 = trunc i64 %38 to i32, !dbg !517
  %40 = sub nsw i32 %39, 1, !dbg !516
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2, !dbg !515
  store i32 %40, i32* %41, align 4, !tbaa !318, !dbg !515
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !520
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6, !dbg !521
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !333, !dbg !521
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44), !dbg !519
  ret void, !dbg !480
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 !dbg !524 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !526, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata i32 %mask, metadata !527, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !528, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !529, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata i8* %key, metadata !530, metadata !DIExpression()), !dbg !525
  %0 = bitcast i8* %key to i64*, !dbg !532
  %1 = load i64, i64* %0, align 8, !dbg !532
  %2 = getelementptr inbounds i8, i8* %key, i64 8, !dbg !532
  store i64 0, i64* %hash.i, align 8, !dbg !532
  store i32 -2128831035, i32* %hash.h, align 4, !dbg !532
  br label %hash.test, !dbg !532

hash.test:
  %3 = load i64, i64* %hash.i, align 8, !dbg !532
  %4 = icmp ult i64 %3, %1, !dbg !532
  br i1 %4, label %hash.byte, label %hash.done, !dbg !532

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3, !dbg !532
  %6 = load i8, i8* %5, !dbg !532
  %7 = zext i8 %6 to i32, !dbg !532
  %8 = load i32, i32* %hash.h, align 4, !dbg !532
  %9 = xor i32 %8, %7, !dbg !532
  %10 = mul i32 %9, 16777619, !dbg !532
  store i32 %10, i32* %hash.h, align 4, !dbg !532
  %11 = add i64 %3, 1, !dbg !532
  store i64 %11, i64* %hash.i, align 8, !dbg !532
  br label %hash.test, !dbg !532

hash.done:
  %12 = load i32, i32* %hash.h, align 4, !dbg !532
  %13 = icmp eq i32 %12, 0, !dbg !532
  %14 = select i1 %13, i32 1, i32 %12, !dbg !532
  store i32 %14, i32* %h.addr, align 4, !dbg !531
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !534, metadata !DIExpression()), !dbg !531
  %15 = load i32, i32* %h.addr, align 4, !dbg !536
  %16 = lshr i32 %15, 24, !dbg !536
  store i32 %16, i32* %fingerprint.addr, align 4, !dbg !535
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !537, metadata !DIExpression()), !dbg !535
  %17 = load i32, i32* %h.addr, align 4, !dbg !540
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask), !dbg !539
  store i32 %18, i32* %bucket.addr, align 4, !dbg !538
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !542, metadata !DIExpression()), !dbg !538
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !543
  %20 = load i64, i64* %19, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !543
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !543
  %22 = load i8*, i8** %21, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !543
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !543
  %24 = load i64, i64* %23, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !543
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !543
  %26 = load i8*, i8** %25, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !543
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !543
  %28 = load i64, i64* %27, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !543
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !543
  %30 = load i8*, i8** %29, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !543
  br label %while.cond, !dbg !543

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4, !dbg !547
  %32 = icmp sge i32 %31, 0, !dbg !547
  br i1 %32, label %land.rhs, label %land.end, !dbg !547

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4, !dbg !549
  %34 = trunc i64 %20 to i32, !dbg !544
  %35 = icmp slt i32 %33, %34, !dbg !549
  br label %land.end, !dbg !547

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ], !dbg !547
  br i1 %36, label %while.body, label %while.end, !dbg !543

while.body:
  %37 = load i32, i32* %bucket.addr, align 4, !dbg !554
  %38 = sext i32 %37 to i64, !dbg !553
  %39 = bitcast i8* %22 to i32*, !dbg !553
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !553
  %41 = load i32, i32* %40, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !553
  store i32 %41, i32* %word.addr, align 4, !dbg !552
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !555, metadata !DIExpression()), !dbg !552
  %42 = load i32, i32* %word.addr, align 4, !dbg !557
  %43 = icmp eq i32 %42, 0, !dbg !557
  br i1 %43, label %if.then, label %if.end, !dbg !556

if.then:
  %44 = load i32, i32* %bucket.addr, align 4, !dbg !562
  %45 = load i32, i32* %h.addr, align 4, !dbg !563
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45), !dbg !561
  ret i64 %46, !dbg !560

if.end:
  %47 = load i32, i32* %word.addr, align 4, !dbg !565
  %48 = lshr i32 %47, 24, !dbg !565
  %49 = load i32, i32* %fingerprint.addr, align 4, !dbg !566
  %50 = icmp eq i32 %48, %49, !dbg !565
  br i1 %50, label %if.then.1, label %if.end.1, !dbg !564

if.then.1:
  %51 = load i32, i32* %word.addr, align 4, !dbg !570
  %52 = and i32 %51, 16777215, !dbg !570
  %53 = sub nsw i32 %52, 1, !dbg !569
  store i32 %53, i32* %at.addr, align 4, !dbg !568
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !573, metadata !DIExpression()), !dbg !568
  %54 = load i32, i32* %at.addr, align 4, !dbg !575
  %55 = icmp sge i32 %54, 0, !dbg !575
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !575

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !577
  %57 = trunc i64 %24 to i32, !dbg !545
  %58 = icmp slt i32 %56, %57, !dbg !577
  br label %land.end.4, !dbg !575

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !575
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !575

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !580
  %61 = sext i32 %60 to i64, !dbg !579
  %62 = bitcast i8* %26 to i32*, !dbg !579
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !579
  %64 = load i32, i32* %63, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !579
  %65 = load i32, i32* %h.addr, align 4, !dbg !581
  %66 = icmp eq i32 %64, %65, !dbg !579
  br label %land.end.3, !dbg !575

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !575
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !575

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !582
  %69 = trunc i64 %28 to i32, !dbg !546
  %70 = icmp slt i32 %68, %69, !dbg !582
  br label %land.end.2, !dbg !575

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !575
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !575

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !586
  %73 = sext i32 %72 to i64, !dbg !585
  %74 = bitcast i8* %30 to i8**, !dbg !585
  %75 = getelementptr inbounds i8*, i8** %74, i64 %73, !dbg !585
  %76 = load i8*, i8** %75, align 8, !alias.scope !139, !noalias !138, !tbaa !449, !dbg !585
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* %key), !dbg !584
  br label %land.end.1, !dbg !575

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !575
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !574

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4, !dbg !591
  %80 = load i32, i32* %at.addr, align 4, !dbg !592
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !590
  ret i64 %81, !dbg !589

if.end.2:
  br label %if.end.1, !dbg !564

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !595
  %83 = add nsw i32 %82, 1, !dbg !595
  %84 = and i32 %83, %mask, !dbg !594
  store i32 %84, i32* %bucket.addr, align 4, !dbg !593
  br label %while.cond, !dbg !543

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !598
  call void @nish_exit(i32 1), !dbg !598
  unreachable, !dbg !598
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !602 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !604, metadata !DIExpression()), !dbg !603
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !605, metadata !DIExpression()), !dbg !603
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !608
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !608
  %2 = trunc i64 %1 to i32, !dbg !608
  store i32 %2, i32* %used.addr, align 4, !dbg !606
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !609, metadata !DIExpression()), !dbg !606
  store i32 0, i32* %to.addr, align 4, !dbg !610
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !612, metadata !DIExpression()), !dbg !610
  store i32 0, i32* %from.addr, align 4, !dbg !613
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !615, metadata !DIExpression()), !dbg !613
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !613
  %4 = load i64, i64* %3, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !613
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !613
  %6 = load i8*, i8** %5, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !613
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !613
  %8 = load i64, i64* %7, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !613
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !613
  %10 = load i8*, i8** %9, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !613
  br label %for.cond, !dbg !613

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !618
  %12 = load i32, i32* %used.addr, align 4, !dbg !619
  %13 = icmp slt i32 %11, %12, !dbg !618
  br i1 %13, label %land.rhs, label %land.end, !dbg !618

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !620
  %15 = trunc i64 %4 to i32, !dbg !616
  %16 = icmp slt i32 %14, %15, !dbg !620
  br label %land.end, !dbg !618

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !618
  br i1 %17, label %for.body, label %for.end, !dbg !613

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !625
  %19 = sext i32 %18 to i64, !dbg !624
  %20 = bitcast i8* %6 to i32*, !dbg !624
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !624
  %22 = load i32, i32* %21, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !624
  %23 = icmp ne i32 %22, 0, !dbg !624
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !624

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !627
  %25 = icmp sge i32 %24, 0, !dbg !627
  br label %land.end.3, !dbg !624

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !624
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !624

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !629
  %28 = load i32, i32* %used.addr, align 4, !dbg !630
  %29 = icmp slt i32 %27, %28, !dbg !629
  br label %land.end.2, !dbg !624

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !624
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !624

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !631
  %32 = trunc i64 %8 to i32, !dbg !617
  %33 = icmp slt i32 %31, %32, !dbg !631
  br label %land.end.1, !dbg !624

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !624
  br i1 %34, label %if.then, label %if.end, !dbg !623

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !635
  %36 = sext i32 %35 to i64, !dbg !634
  %37 = load i32, i32* %from.addr, align 4, !dbg !637
  %38 = sext i32 %37 to i64, !dbg !636
  %39 = bitcast i8* %10 to i8**, !dbg !636
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38, !dbg !636
  %41 = load i8*, i8** %40, align 8, !alias.scope !139, !noalias !138, !tbaa !449, !dbg !636
  %42 = bitcast i8* %10 to i8**, !dbg !634
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36, !dbg !634
  store i8* %41, i8** %43, align 8, !alias.scope !139, !noalias !138, !tbaa !449, !dbg !634
  %44 = load i32, i32* %to.addr, align 4, !dbg !638
  %45 = add nsw i32 %44, 1, !dbg !638
  store i32 %45, i32* %to.addr, align 4, !dbg !638
  br label %if.end, !dbg !623

if.end:
  br label %for.inc, !dbg !613

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !639
  %47 = add nsw i32 %46, 1, !dbg !639
  store i32 %47, i32* %from.addr, align 4, !dbg !639
  br label %for.cond, !dbg !613

for.end:
  br label %while.cond, !dbg !640

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !642
  %49 = load i64, i64* %48, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !642
  %50 = trunc i64 %49 to i32, !dbg !642
  %51 = load i32, i32* %to.addr, align 4, !dbg !643
  %52 = icmp sgt i32 %50, %51, !dbg !641
  br i1 %52, label %while.body, label %while.end, !dbg !640

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !645
  %54 = load i64, i64* %53, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !645
  %55 = icmp eq i64 %54, 0, !dbg !645
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !645

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !645
  unreachable, !dbg !645

pop.ok:
  %56 = sub i64 %54, 1, !dbg !645
  store i64 %56, i64* %53, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !645
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !645
  %58 = load i8*, i8** %57, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !645
  %59 = bitcast i8* %58 to i8**, !dbg !645
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56, !dbg !645
  %61 = load i8*, i8** %60, align 8, !alias.scope !139, !noalias !138, !tbaa !449, !dbg !645
  br label %while.cond, !dbg !640

while.end:
  ret void, !dbg !603
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !648 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !650, metadata !DIExpression()), !dbg !649
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !651, metadata !DIExpression()), !dbg !649
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !654
  %1 = load i64, i64* %0, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !654
  %2 = trunc i64 %1 to i32, !dbg !654
  store i32 %2, i32* %used.addr, align 4, !dbg !652
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !655, metadata !DIExpression()), !dbg !652
  store i32 0, i32* %to.addr, align 4, !dbg !656
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !658, metadata !DIExpression()), !dbg !656
  store i32 0, i32* %from.addr, align 4, !dbg !659
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !661, metadata !DIExpression()), !dbg !659
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !659
  %4 = load i64, i64* %3, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !659
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !659
  %6 = load i8*, i8** %5, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !659
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !659
  %8 = load i64, i64* %7, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !659
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !659
  %10 = load i8*, i8** %9, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !659
  br label %for.cond, !dbg !659

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !664
  %12 = load i32, i32* %used.addr, align 4, !dbg !665
  %13 = icmp slt i32 %11, %12, !dbg !664
  br i1 %13, label %land.rhs, label %land.end, !dbg !664

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !666
  %15 = trunc i64 %4 to i32, !dbg !662
  %16 = icmp slt i32 %14, %15, !dbg !666
  br label %land.end, !dbg !664

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !664
  br i1 %17, label %for.body, label %for.end, !dbg !659

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !671
  %19 = sext i32 %18 to i64, !dbg !670
  %20 = bitcast i8* %6 to i32*, !dbg !670
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !670
  %22 = load i32, i32* %21, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !670
  %23 = icmp ne i32 %22, 0, !dbg !670
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !670

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !673
  %25 = icmp sge i32 %24, 0, !dbg !673
  br label %land.end.3, !dbg !670

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !670
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !670

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !675
  %28 = load i32, i32* %used.addr, align 4, !dbg !676
  %29 = icmp slt i32 %27, %28, !dbg !675
  br label %land.end.2, !dbg !670

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !670
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !670

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !677
  %32 = trunc i64 %8 to i32, !dbg !663
  %33 = icmp slt i32 %31, %32, !dbg !677
  br label %land.end.1, !dbg !670

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !670
  br i1 %34, label %if.then, label %if.end, !dbg !669

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !681
  %36 = sext i32 %35 to i64, !dbg !680
  %37 = load i32, i32* %from.addr, align 4, !dbg !683
  %38 = sext i32 %37 to i64, !dbg !682
  %39 = bitcast i8* %10 to i32*, !dbg !682
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !682
  %41 = load i32, i32* %40, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !682
  %42 = bitcast i8* %10 to i32*, !dbg !680
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !680
  store i32 %41, i32* %43, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !680
  %44 = load i32, i32* %to.addr, align 4, !dbg !684
  %45 = add nsw i32 %44, 1, !dbg !684
  store i32 %45, i32* %to.addr, align 4, !dbg !684
  br label %if.end, !dbg !669

if.end:
  br label %for.inc, !dbg !659

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !685
  %47 = add nsw i32 %46, 1, !dbg !685
  store i32 %47, i32* %from.addr, align 4, !dbg !685
  br label %for.cond, !dbg !659

for.end:
  br label %while.cond, !dbg !686

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !688
  %49 = load i64, i64* %48, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !688
  %50 = trunc i64 %49 to i32, !dbg !688
  %51 = load i32, i32* %to.addr, align 4, !dbg !689
  %52 = icmp sgt i32 %50, %51, !dbg !687
  br i1 %52, label %while.body, label %while.end, !dbg !686

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !691
  %54 = load i64, i64* %53, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !691
  %55 = icmp eq i64 %54, 0, !dbg !691
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !691

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !691
  unreachable, !dbg !691

pop.ok:
  %56 = sub i64 %54, 1, !dbg !691
  store i64 %56, i64* %53, align 8, !alias.scope !138, !noalias !139, !tbaa !145, !dbg !691
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !691
  %58 = load i8*, i8** %57, align 8, !alias.scope !138, !noalias !139, !tbaa !146, !dbg !691
  %59 = bitcast i8* %58 to i32*, !dbg !691
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !691
  %61 = load i32, i32* %60, align 4, !alias.scope !139, !noalias !138, !tbaa !156, !dbg !691
  br label %while.cond, !dbg !686

while.end:
  ret void, !dbg !649
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
!108 = !DILocation(line: 87, column: 55, scope: !102)
!109 = !DILocation(line: 87, column: 60, scope: !102)
!110 = !DILocation(line: 87, column: 61, scope: !102)
!111 = !DILocation(line: 87, column: 62, scope: !102)
!112 = !DILocation(line: 87, column: 68, scope: !102)
!113 = !DILocation(line: 87, column: 85, scope: !102)
!114 = !DILocation(line: 87, column: 91, scope: !102)
!115 = !{null, !23, !4, !19, !4}
!116 = !DISubroutineType(types: !115)
!117 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 123, type: !116, scopeLine: 123, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!118 = !DILocation(line: 123, column: 1, scope: !117)
!119 = !DILocalVariable(name: "slots", arg: 1, scope: !117, file: !13, line: 123, type: !23)
!120 = !DILocalVariable(name: "mask", arg: 2, scope: !117, file: !13, line: 123, type: !4)
!121 = !DILocalVariable(name: "h", arg: 3, scope: !117, file: !13, line: 123, type: !19)
!122 = !DILocalVariable(name: "index", arg: 4, scope: !117, file: !13, line: 123, type: !4)
!123 = !DILocation(line: 124, column: 3, scope: !117)
!124 = !DILocation(line: 124, column: 16, scope: !117)
!125 = !DILocation(line: 124, column: 25, scope: !117)
!126 = !DILocation(line: 124, column: 28, scope: !117)
!127 = !DILocalVariable(name: "word", scope: !117, file: !13, line: 124, type: !19)
!128 = !DILocation(line: 125, column: 3, scope: !117)
!129 = !DILocation(line: 125, column: 16, scope: !117)
!130 = !DILocation(line: 125, column: 27, scope: !117)
!131 = !DILocation(line: 125, column: 30, scope: !117)
!132 = !DILocalVariable(name: "bucket", scope: !117, file: !13, line: 125, type: !4)
!133 = !DILocation(line: 126, column: 3, scope: !117)
!134 = !DILocation(line: 126, column: 40, scope: !117)
!135 = !{!"nish array"}
!136 = !{!"header", !135}
!137 = !{!"elements", !135}
!138 = !{!136}
!139 = !{!137}
!140 = !{!"nish TBAA"}
!141 = !{!"omnipotent char", !140, i64 0}
!142 = !{!"header i64", !141, i64 0}
!143 = !{!"header ptr", !141, i64 0}
!144 = !{!"array header", !142, i64 0, !142, i64 8, !143, i64 16}
!145 = !{!144, !142, i64 0}
!146 = !{!144, !143, i64 16}
!147 = !DILocation(line: 126, column: 10, scope: !117)
!148 = !DILocation(line: 126, column: 20, scope: !117)
!149 = !DILocation(line: 126, column: 25, scope: !117)
!150 = !DILocation(line: 126, column: 34, scope: !117)
!151 = !DILocation(line: 126, column: 55, scope: !117)
!152 = !DILocation(line: 127, column: 5, scope: !117)
!153 = !DILocation(line: 127, column: 9, scope: !117)
!154 = !DILocation(line: 127, column: 15, scope: !117)
!155 = !{!"element i32", !141, i64 0}
!156 = !{!155, !155, i64 0}
!157 = !DILocation(line: 127, column: 27, scope: !117)
!158 = !DILocation(line: 127, column: 30, scope: !117)
!159 = !DILocation(line: 128, column: 7, scope: !117)
!160 = !DILocation(line: 128, column: 13, scope: !117)
!161 = !DILocation(line: 128, column: 23, scope: !117)
!162 = !DILocation(line: 129, column: 7, scope: !117)
!163 = !DILocation(line: 131, column: 5, scope: !117)
!164 = !DILocation(line: 131, column: 14, scope: !117)
!165 = !DILocation(line: 131, column: 15, scope: !117)
!166 = !DILocation(line: 131, column: 24, scope: !117)
!167 = !DILocation(line: 131, column: 29, scope: !117)
!168 = !{null, !23}
!169 = !DISubroutineType(types: !168)
!170 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 151, type: !169, scopeLine: 151, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!171 = !DILocation(line: 151, column: 1, scope: !170)
!172 = !DILocalVariable(name: "hashes", arg: 1, scope: !170, file: !13, line: 151, type: !23)
!173 = !DILocation(line: 152, column: 3, scope: !170)
!174 = !DILocation(line: 152, column: 16, scope: !170)
!175 = !DILocation(line: 152, column: 22, scope: !170)
!176 = !DILocalVariable(name: "used", scope: !170, file: !13, line: 152, type: !4)
!177 = !DILocation(line: 153, column: 3, scope: !170)
!178 = !DILocation(line: 153, column: 17, scope: !170)
!179 = !DILocalVariable(name: "to", scope: !170, file: !13, line: 153, type: !4)
!180 = !DILocation(line: 154, column: 3, scope: !170)
!181 = !DILocation(line: 154, column: 24, scope: !170)
!182 = !DILocalVariable(name: "from", scope: !170, file: !13, line: 154, type: !4)
!183 = !DILocation(line: 155, column: 15, scope: !170)
!184 = !DILocation(line: 154, column: 27, scope: !170)
!185 = !DILocation(line: 154, column: 34, scope: !170)
!186 = !DILocation(line: 154, column: 48, scope: !170)
!187 = !DILocation(line: 155, column: 5, scope: !170)
!188 = !DILocation(line: 155, column: 22, scope: !170)
!189 = !DILocalVariable(name: "h", scope: !170, file: !13, line: 155, type: !19)
!190 = !DILocation(line: 156, column: 5, scope: !170)
!191 = !DILocation(line: 156, column: 9, scope: !170)
!192 = !DILocation(line: 156, column: 15, scope: !170)
!193 = !DILocation(line: 156, column: 20, scope: !170)
!194 = !DILocation(line: 156, column: 26, scope: !170)
!195 = !DILocation(line: 156, column: 31, scope: !170)
!196 = !DILocation(line: 156, column: 36, scope: !170)
!197 = !DILocation(line: 156, column: 42, scope: !170)
!198 = !DILocation(line: 157, column: 7, scope: !170)
!199 = !DILocation(line: 157, column: 14, scope: !170)
!200 = !DILocation(line: 157, column: 20, scope: !170)
!201 = !DILocation(line: 158, column: 7, scope: !170)
!202 = !DILocation(line: 154, column: 40, scope: !170)
!203 = !DILocation(line: 161, column: 3, scope: !170)
!204 = !DILocation(line: 161, column: 10, scope: !170)
!205 = !DILocation(line: 161, column: 16, scope: !170)
!206 = !DILocation(line: 161, column: 33, scope: !170)
!207 = !DILocation(line: 161, column: 37, scope: !170)
!208 = !DILocation(line: 162, column: 5, scope: !170)
!209 = !{!23, !23, !4, !4}
!210 = !DISubroutineType(types: !209)
!211 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 173, type: !210, scopeLine: 173, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!212 = !DILocation(line: 173, column: 1, scope: !211)
!213 = !DILocalVariable(name: "slots", arg: 1, scope: !211, file: !13, line: 173, type: !23)
!214 = !DILocalVariable(name: "live", arg: 2, scope: !211, file: !13, line: 173, type: !4)
!215 = !DILocalVariable(name: "used", arg: 3, scope: !211, file: !13, line: 173, type: !4)
!216 = !DILocation(line: 174, column: 3, scope: !211)
!217 = !DILocation(line: 174, column: 13, scope: !211)
!218 = !DILocation(line: 174, column: 19, scope: !211)
!219 = !DILocalVariable(name: "n", scope: !211, file: !13, line: 174, type: !4)
!220 = !DILocation(line: 175, column: 3, scope: !211)
!221 = !DILocation(line: 175, column: 7, scope: !211)
!222 = !DILocation(line: 175, column: 14, scope: !211)
!223 = !DILocation(line: 175, column: 18, scope: !211)
!224 = !DILocation(line: 175, column: 24, scope: !211)
!225 = !DILocation(line: 176, column: 5, scope: !211)
!226 = !DILocation(line: 176, column: 16, scope: !211)
!227 = !DILocation(line: 177, column: 5, scope: !211)
!228 = !DILocation(line: 177, column: 12, scope: !211)
!229 = !DILocation(line: 179, column: 3, scope: !211)
!230 = !DILocation(line: 179, column: 10, scope: !211)
!231 = !DILocation(line: 179, column: 25, scope: !211)
!232 = !DILocation(line: 179, column: 29, scope: !211)
!233 = !{!144, !142, i64 8}
!234 = !{null, !23, !23}
!235 = !DISubroutineType(types: !234)
!236 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 187, type: !235, scopeLine: 187, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!237 = !DILocation(line: 187, column: 1, scope: !236)
!238 = !DILocalVariable(name: "slots", arg: 1, scope: !236, file: !13, line: 187, type: !23)
!239 = !DILocalVariable(name: "hashes", arg: 2, scope: !236, file: !13, line: 187, type: !23)
!240 = !DILocation(line: 188, column: 3, scope: !236)
!241 = !DILocation(line: 188, column: 16, scope: !236)
!242 = !DILocation(line: 188, column: 22, scope: !236)
!243 = !DILocation(line: 188, column: 38, scope: !236)
!244 = !DILocalVariable(name: "mask", scope: !236, file: !13, line: 188, type: !4)
!245 = !DILocation(line: 189, column: 3, scope: !236)
!246 = !DILocation(line: 189, column: 21, scope: !236)
!247 = !DILocalVariable(name: "i", scope: !236, file: !13, line: 189, type: !4)
!248 = !DILocation(line: 189, column: 34, scope: !236)
!249 = !DILocation(line: 189, column: 24, scope: !236)
!250 = !DILocation(line: 189, column: 28, scope: !236)
!251 = !DILocation(line: 189, column: 55, scope: !236)
!252 = !DILocation(line: 190, column: 5, scope: !236)
!253 = !DILocation(line: 190, column: 15, scope: !236)
!254 = !DILocation(line: 190, column: 22, scope: !236)
!255 = !DILocalVariable(name: "h", scope: !236, file: !13, line: 190, type: !19)
!256 = !DILocation(line: 191, column: 5, scope: !236)
!257 = !DILocation(line: 191, column: 9, scope: !236)
!258 = !DILocation(line: 191, column: 15, scope: !236)
!259 = !DILocation(line: 191, column: 18, scope: !236)
!260 = !DILocation(line: 192, column: 7, scope: !236)
!261 = !DILocation(line: 192, column: 17, scope: !236)
!262 = !DILocation(line: 192, column: 24, scope: !236)
!263 = !DILocation(line: 192, column: 30, scope: !236)
!264 = !DILocation(line: 192, column: 33, scope: !236)
!265 = !DILocation(line: 189, column: 50, scope: !236)
!266 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 218, type: !169, scopeLine: 218, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!267 = !DILocation(line: 218, column: 1, scope: !266)
!268 = !DILocalVariable(name: "slots", arg: 1, scope: !266, file: !13, line: 218, type: !23)
!269 = !DILocation(line: 219, column: 3, scope: !266)
!270 = !DILocation(line: 219, column: 21, scope: !266)
!271 = !DILocalVariable(name: "i", scope: !266, file: !13, line: 219, type: !4)
!272 = !DILocation(line: 219, column: 34, scope: !266)
!273 = !DILocation(line: 219, column: 24, scope: !266)
!274 = !DILocation(line: 219, column: 28, scope: !266)
!275 = !DILocation(line: 219, column: 54, scope: !266)
!276 = !DILocation(line: 220, column: 5, scope: !266)
!277 = !DILocation(line: 220, column: 11, scope: !266)
!278 = !DILocation(line: 220, column: 16, scope: !266)
!279 = !DILocation(line: 219, column: 49, scope: !266)
!280 = !{null, !23, !4, !4, !19, !4}
!281 = !DISubroutineType(types: !280)
!282 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 252, type: !281, scopeLine: 252, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!283 = !DILocation(line: 252, column: 1, scope: !282)
!284 = !DILocalVariable(name: "slots", arg: 1, scope: !282, file: !13, line: 252, type: !23)
!285 = !DILocalVariable(name: "mask", arg: 2, scope: !282, file: !13, line: 252, type: !4)
!286 = !DILocalVariable(name: "bucket", arg: 3, scope: !282, file: !13, line: 252, type: !4)
!287 = !DILocalVariable(name: "h", arg: 4, scope: !282, file: !13, line: 252, type: !19)
!288 = !DILocalVariable(name: "used", arg: 5, scope: !282, file: !13, line: 252, type: !4)
!289 = !DILocation(line: 253, column: 3, scope: !282)
!290 = !DILocation(line: 253, column: 7, scope: !282)
!291 = !DILocation(line: 253, column: 17, scope: !282)
!292 = !DILocation(line: 253, column: 22, scope: !282)
!293 = !DILocation(line: 253, column: 31, scope: !282)
!294 = !DILocation(line: 253, column: 37, scope: !282)
!295 = !DILocation(line: 253, column: 52, scope: !282)
!296 = !DILocation(line: 254, column: 5, scope: !282)
!297 = !DILocation(line: 254, column: 11, scope: !282)
!298 = !DILocation(line: 254, column: 21, scope: !282)
!299 = !DILocation(line: 254, column: 30, scope: !282)
!300 = !DILocation(line: 254, column: 33, scope: !282)
!301 = !DILocation(line: 254, column: 40, scope: !282)
!302 = !DILocation(line: 255, column: 10, scope: !282)
!303 = !DILocation(line: 256, column: 5, scope: !282)
!304 = !DILocation(line: 256, column: 15, scope: !282)
!305 = !DILocation(line: 256, column: 22, scope: !282)
!306 = !DILocation(line: 256, column: 28, scope: !282)
!307 = !DILocation(line: 256, column: 31, scope: !282)
!308 = !DILocation(line: 256, column: 38, scope: !282)
!309 = !{null, !12}
!310 = !DISubroutineType(types: !309)
!311 = distinct !DISubprogram(name: "Map<string, i32>.constructor", linkageName: "nish.Map$str$i32.constructor", scope: !13, file: !13, line: 286, type: !310, scopeLine: 286, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!312 = !DILocation(line: 286, column: 3, scope: !311)
!313 = !DILocalVariable(name: "this", arg: 1, scope: !311, file: !13, line: 286, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!314 = !{!"i32", !141, i64 0}
!315 = !{!"ptr", !141, i64 0}
!316 = !{!"Map$str$i32", !314, i64 0, !315, i64 8, !314, i64 16, !314, i64 20, !315, i64 24, !315, i64 32, !315, i64 40, !314, i64 48}
!317 = !{!316, !314, i64 0}
!318 = !{!316, !314, i64 16}
!319 = !{!316, !314, i64 20}
!320 = !{!316, !314, i64 48}
!321 = !DILocation(line: 287, column: 5, scope: !311)
!322 = !DILocation(line: 287, column: 18, scope: !311)
!323 = !DILocation(line: 287, column: 33, scope: !311)
!324 = !{!316, !315, i64 8}
!325 = !DILocation(line: 288, column: 5, scope: !311)
!326 = !DILocation(line: 288, column: 22, scope: !311)
!327 = !{!316, !315, i64 24}
!328 = !DILocation(line: 289, column: 5, scope: !311)
!329 = !DILocation(line: 289, column: 24, scope: !311)
!330 = !{!316, !315, i64 32}
!331 = !DILocation(line: 290, column: 5, scope: !311)
!332 = !DILocation(line: 290, column: 24, scope: !311)
!333 = !{!316, !315, i64 40}
!334 = !{!16, !12, !31}
!335 = !DISubroutineType(types: !334)
!336 = distinct !DISubprogram(name: "Map<string, i32>.probe", linkageName: "nish.Map$str$i32.probe", scope: !13, file: !13, line: 294, type: !335, scopeLine: 294, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!337 = !DILocation(line: 294, column: 3, scope: !336)
!338 = !DILocalVariable(name: "this", arg: 1, scope: !336, file: !13, line: 294, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!339 = !DILocalVariable(name: "key", arg: 2, scope: !336, file: !13, line: 294, type: !31)
!340 = !DILocation(line: 295, column: 5, scope: !336)
!341 = !DILocation(line: 295, column: 12, scope: !336)
!342 = !DILocation(line: 295, column: 23, scope: !336)
!343 = !DILocation(line: 295, column: 35, scope: !336)
!344 = !DILocation(line: 295, column: 46, scope: !336)
!345 = !DILocation(line: 295, column: 64, scope: !336)
!346 = !DILocation(line: 295, column: 80, scope: !336)
!347 = !{!12, !12, !31, !4}
!348 = !DISubroutineType(types: !347)
!349 = distinct !DISubprogram(name: "Map<string, i32>.set", linkageName: "nish.Map$str$i32.set", scope: !13, file: !13, line: 303, type: !348, scopeLine: 303, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!350 = !DILocation(line: 303, column: 3, scope: !349)
!351 = !DILocalVariable(name: "this", arg: 1, scope: !349, file: !13, line: 303, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!352 = !DILocalVariable(name: "key", arg: 2, scope: !349, file: !13, line: 303, type: !31)
!353 = !DILocalVariable(name: "value", arg: 3, scope: !349, file: !13, line: 303, type: !4)
!354 = !DILocation(line: 304, column: 5, scope: !349)
!355 = !DILocation(line: 304, column: 19, scope: !349)
!356 = !DILocation(line: 304, column: 30, scope: !349)
!357 = !DILocalVariable(name: "found", scope: !349, file: !13, line: 304, type: !16)
!358 = !DILocation(line: 305, column: 5, scope: !349)
!359 = !DILocation(line: 305, column: 9, scope: !349)
!360 = !DILocation(line: 305, column: 18, scope: !349)
!361 = !DILocation(line: 305, column: 21, scope: !349)
!362 = !DILocation(line: 306, column: 7, scope: !349)
!363 = !DILocation(line: 306, column: 23, scope: !349)
!364 = !DILocation(line: 306, column: 29, scope: !349)
!365 = !DILocation(line: 306, column: 37, scope: !349)
!366 = !DILocation(line: 307, column: 12, scope: !349)
!367 = !DILocation(line: 308, column: 7, scope: !349)
!368 = !DILocation(line: 308, column: 21, scope: !349)
!369 = !DILocation(line: 308, column: 28, scope: !349)
!370 = !DILocation(line: 308, column: 33, scope: !349)
!371 = !DILocation(line: 310, column: 5, scope: !349)
!372 = !DILocation(line: 310, column: 12, scope: !349)
!373 = !{!4, !12, !4}
!374 = !DISubroutineType(types: !373)
!375 = distinct !DISubprogram(name: "Map<string, i32>.valueAt", linkageName: "nish.Map$str$i32.valueAt", scope: !13, file: !13, line: 369, type: !374, scopeLine: 369, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!376 = !DILocation(line: 369, column: 3, scope: !375)
!377 = !DILocalVariable(name: "this", arg: 1, scope: !375, file: !13, line: 369, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!378 = !DILocalVariable(name: "index", arg: 2, scope: !375, file: !13, line: 369, type: !4)
!379 = !DILocation(line: 370, column: 5, scope: !375)
!380 = !DILocation(line: 370, column: 9, scope: !375)
!381 = !DILocation(line: 370, column: 17, scope: !375)
!382 = !DILocation(line: 370, column: 22, scope: !375)
!383 = !DILocation(line: 370, column: 31, scope: !375)
!384 = !DILocation(line: 370, column: 37, scope: !375)
!385 = !DILocation(line: 370, column: 63, scope: !375)
!386 = !DILocation(line: 371, column: 7, scope: !375)
!387 = !DILocation(line: 371, column: 13, scope: !375)
!388 = !DILocation(line: 373, column: 5, scope: !375)
!389 = !DILocation(line: 373, column: 12, scope: !375)
!390 = !DILocation(line: 373, column: 29, scope: !375)
!391 = !{null, !12, !4, !4}
!392 = !DISubroutineType(types: !391)
!393 = distinct !DISubprogram(name: "Map<string, i32>.setValueAt", linkageName: "nish.Map$str$i32.setValueAt", scope: !13, file: !13, line: 377, type: !392, scopeLine: 377, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!394 = !DILocation(line: 377, column: 3, scope: !393)
!395 = !DILocalVariable(name: "this", arg: 1, scope: !393, file: !13, line: 377, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!396 = !DILocalVariable(name: "index", arg: 2, scope: !393, file: !13, line: 377, type: !4)
!397 = !DILocalVariable(name: "value", arg: 3, scope: !393, file: !13, line: 377, type: !4)
!398 = !DILocation(line: 378, column: 5, scope: !393)
!399 = !DILocation(line: 378, column: 9, scope: !393)
!400 = !DILocation(line: 378, column: 18, scope: !393)
!401 = !DILocation(line: 378, column: 23, scope: !393)
!402 = !DILocation(line: 378, column: 31, scope: !393)
!403 = !DILocation(line: 378, column: 37, scope: !393)
!404 = !DILocation(line: 378, column: 63, scope: !393)
!405 = !DILocation(line: 379, column: 7, scope: !393)
!406 = !DILocation(line: 379, column: 24, scope: !393)
!407 = !DILocation(line: 379, column: 33, scope: !393)
!408 = !{null, !12, !16, !31, !4}
!409 = !DISubroutineType(types: !408)
!410 = distinct !DISubprogram(name: "Map<string, i32>.insertAt", linkageName: "nish.Map$str$i32.insertAt", scope: !13, file: !13, line: 384, type: !409, scopeLine: 384, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!411 = !DILocation(line: 384, column: 3, scope: !410)
!412 = !DILocalVariable(name: "this", arg: 1, scope: !410, file: !13, line: 384, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!413 = !DILocalVariable(name: "absent", arg: 2, scope: !410, file: !13, line: 384, type: !16)
!414 = !DILocalVariable(name: "key", arg: 3, scope: !410, file: !13, line: 384, type: !31)
!415 = !DILocalVariable(name: "value", arg: 4, scope: !410, file: !13, line: 384, type: !4)
!416 = !DILocation(line: 385, column: 5, scope: !410)
!417 = !DILocation(line: 385, column: 20, scope: !410)
!418 = !DILocation(line: 385, column: 21, scope: !410)
!419 = !DILocation(line: 385, column: 25, scope: !410)
!420 = !DILocalVariable(name: "packed", scope: !410, file: !13, line: 385, type: !16)
!421 = !DILocation(line: 386, column: 5, scope: !410)
!422 = !DILocation(line: 386, column: 18, scope: !410)
!423 = !DILocation(line: 386, column: 24, scope: !410)
!424 = !DILocalVariable(name: "bucket", scope: !410, file: !13, line: 386, type: !4)
!425 = !DILocation(line: 387, column: 5, scope: !410)
!426 = !DILocation(line: 387, column: 15, scope: !410)
!427 = !DILocation(line: 387, column: 21, scope: !410)
!428 = !DILocalVariable(name: "h", scope: !410, file: !13, line: 387, type: !19)
!429 = !DILocation(line: 388, column: 5, scope: !410)
!430 = !DILocation(line: 388, column: 9, scope: !410)
!431 = !DILocation(line: 388, column: 15, scope: !410)
!432 = !DILocation(line: 388, column: 41, scope: !410)
!433 = !DILocation(line: 388, column: 52, scope: !410)
!434 = !DILocation(line: 391, column: 7, scope: !410)
!435 = !DILocation(line: 391, column: 11, scope: !410)
!436 = !DILocation(line: 391, column: 24, scope: !410)
!437 = !DILocation(line: 391, column: 37, scope: !410)
!438 = !DILocation(line: 391, column: 50, scope: !410)
!439 = !DILocation(line: 391, column: 53, scope: !410)
!440 = !DILocation(line: 392, column: 9, scope: !410)
!441 = !DILocation(line: 392, column: 15, scope: !410)
!442 = !DILocation(line: 394, column: 7, scope: !410)
!443 = !DILocation(line: 395, column: 7, scope: !410)
!444 = !DILocation(line: 395, column: 16, scope: !410)
!445 = !DILocation(line: 395, column: 17, scope: !410)
!446 = !DILocation(line: 397, column: 5, scope: !410)
!447 = !DILocation(line: 397, column: 25, scope: !410)
!448 = !{!"element ptr", !141, i64 0}
!449 = !{!448, !448, i64 0}
!450 = !DILocation(line: 398, column: 5, scope: !410)
!451 = !DILocation(line: 398, column: 27, scope: !410)
!452 = !DILocation(line: 399, column: 5, scope: !410)
!453 = !DILocation(line: 399, column: 27, scope: !410)
!454 = !DILocation(line: 400, column: 5, scope: !410)
!455 = !DILocation(line: 400, column: 17, scope: !410)
!456 = !DILocation(line: 400, column: 29, scope: !410)
!457 = !DILocation(line: 401, column: 5, scope: !410)
!458 = !DILocation(line: 401, column: 17, scope: !410)
!459 = !DILocation(line: 401, column: 29, scope: !410)
!460 = !DILocation(line: 404, column: 5, scope: !410)
!461 = !DILocation(line: 404, column: 18, scope: !410)
!462 = !DILocation(line: 404, column: 24, scope: !410)
!463 = !DILocalVariable(name: "used", scope: !410, file: !13, line: 404, type: !4)
!464 = !DILocation(line: 405, column: 5, scope: !410)
!465 = !DILocation(line: 405, column: 9, scope: !410)
!466 = !DILocation(line: 405, column: 16, scope: !410)
!467 = !DILocation(line: 405, column: 20, scope: !410)
!468 = !DILocation(line: 405, column: 26, scope: !410)
!469 = !DILocation(line: 405, column: 47, scope: !410)
!470 = !DILocation(line: 405, column: 50, scope: !410)
!471 = !DILocation(line: 406, column: 7, scope: !410)
!472 = !DILocation(line: 407, column: 12, scope: !410)
!473 = !DILocation(line: 408, column: 7, scope: !410)
!474 = !DILocation(line: 408, column: 20, scope: !410)
!475 = !DILocation(line: 408, column: 32, scope: !410)
!476 = !DILocation(line: 408, column: 43, scope: !410)
!477 = !DILocation(line: 408, column: 51, scope: !410)
!478 = !DILocation(line: 408, column: 54, scope: !410)
!479 = distinct !DISubprogram(name: "Map<string, i32>.rebuild", linkageName: "nish.Map$str$i32.rebuild", scope: !13, file: !13, line: 417, type: !310, scopeLine: 417, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!480 = !DILocation(line: 417, column: 3, scope: !479)
!481 = !DILocalVariable(name: "this", arg: 1, scope: !479, file: !13, line: 417, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!482 = !DILocation(line: 418, column: 5, scope: !479)
!483 = !DILocation(line: 418, column: 18, scope: !479)
!484 = !DILocation(line: 418, column: 24, scope: !479)
!485 = !DILocalVariable(name: "used", scope: !479, file: !13, line: 418, type: !4)
!486 = !DILocation(line: 419, column: 5, scope: !479)
!487 = !DILocation(line: 419, column: 21, scope: !479)
!488 = !DILocation(line: 419, column: 34, scope: !479)
!489 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!490 = !DILocalVariable(name: "walking", scope: !479, file: !13, line: 419, type: !489)
!491 = !DILocation(line: 420, column: 5, scope: !479)
!492 = !DILocation(line: 420, column: 19, scope: !479)
!493 = !DILocation(line: 420, column: 32, scope: !479)
!494 = !DILocation(line: 420, column: 44, scope: !479)
!495 = !DILocation(line: 420, column: 54, scope: !479)
!496 = !DILocation(line: 420, column: 61, scope: !479)
!497 = !DILocation(line: 420, column: 72, scope: !479)
!498 = !DILocalVariable(name: "slots", scope: !479, file: !13, line: 420, type: !23)
!499 = !DILocation(line: 421, column: 5, scope: !479)
!500 = !DILocation(line: 421, column: 9, scope: !479)
!501 = !DILocation(line: 421, column: 10, scope: !479)
!502 = !DILocation(line: 421, column: 21, scope: !479)
!503 = !DILocation(line: 421, column: 33, scope: !479)
!504 = !DILocation(line: 421, column: 39, scope: !479)
!505 = !DILocation(line: 422, column: 7, scope: !479)
!506 = !DILocation(line: 422, column: 22, scope: !479)
!507 = !DILocation(line: 422, column: 38, scope: !479)
!508 = !DILocation(line: 423, column: 7, scope: !479)
!509 = !DILocation(line: 423, column: 22, scope: !479)
!510 = !DILocation(line: 423, column: 40, scope: !479)
!511 = !DILocation(line: 424, column: 7, scope: !479)
!512 = !DILocation(line: 424, column: 21, scope: !479)
!513 = !DILocation(line: 426, column: 5, scope: !479)
!514 = !DILocation(line: 426, column: 18, scope: !479)
!515 = !DILocation(line: 427, column: 5, scope: !479)
!516 = !DILocation(line: 427, column: 17, scope: !479)
!517 = !DILocation(line: 427, column: 23, scope: !479)
!518 = !DILocation(line: 427, column: 39, scope: !479)
!519 = !DILocation(line: 428, column: 5, scope: !479)
!520 = !DILocation(line: 428, column: 12, scope: !479)
!521 = !DILocation(line: 428, column: 19, scope: !479)
!522 = !{!16, !23, !4, !23, !35, !31}
!523 = !DISubroutineType(types: !522)
!524 = distinct !DISubprogram(name: "probeTable<string>", linkageName: "nish.probeTable$str", scope: !13, file: !13, line: 96, type: !523, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!525 = !DILocation(line: 96, column: 1, scope: !524)
!526 = !DILocalVariable(name: "slots", arg: 1, scope: !524, file: !13, line: 96, type: !23)
!527 = !DILocalVariable(name: "mask", arg: 2, scope: !524, file: !13, line: 96, type: !4)
!528 = !DILocalVariable(name: "hashes", arg: 3, scope: !524, file: !13, line: 96, type: !23)
!529 = !DILocalVariable(name: "keys", arg: 4, scope: !524, file: !13, line: 96, type: !35)
!530 = !DILocalVariable(name: "key", arg: 5, scope: !524, file: !13, line: 96, type: !31)
!531 = !DILocation(line: 97, column: 3, scope: !524)
!532 = !DILocation(line: 97, column: 13, scope: !524)
!533 = !DILocation(line: 97, column: 21, scope: !524)
!534 = !DILocalVariable(name: "h", scope: !524, file: !13, line: 97, type: !19)
!535 = !DILocation(line: 98, column: 3, scope: !524)
!536 = !DILocation(line: 98, column: 23, scope: !524)
!537 = !DILocalVariable(name: "fingerprint", scope: !524, file: !13, line: 98, type: !19)
!538 = !DILocation(line: 99, column: 3, scope: !524)
!539 = !DILocation(line: 99, column: 16, scope: !524)
!540 = !DILocation(line: 99, column: 27, scope: !524)
!541 = !DILocation(line: 99, column: 30, scope: !524)
!542 = !DILocalVariable(name: "bucket", scope: !524, file: !13, line: 99, type: !4)
!543 = !DILocation(line: 102, column: 3, scope: !524)
!544 = !DILocation(line: 102, column: 40, scope: !524)
!545 = !DILocation(line: 109, column: 33, scope: !524)
!546 = !DILocation(line: 109, column: 82, scope: !524)
!547 = !DILocation(line: 102, column: 10, scope: !524)
!548 = !DILocation(line: 102, column: 20, scope: !524)
!549 = !DILocation(line: 102, column: 25, scope: !524)
!550 = !DILocation(line: 102, column: 34, scope: !524)
!551 = !DILocation(line: 102, column: 55, scope: !524)
!552 = !DILocation(line: 103, column: 5, scope: !524)
!553 = !DILocation(line: 103, column: 18, scope: !524)
!554 = !DILocation(line: 103, column: 24, scope: !524)
!555 = !DILocalVariable(name: "word", scope: !524, file: !13, line: 103, type: !19)
!556 = !DILocation(line: 104, column: 5, scope: !524)
!557 = !DILocation(line: 104, column: 9, scope: !524)
!558 = !DILocation(line: 104, column: 18, scope: !524)
!559 = !DILocation(line: 104, column: 21, scope: !524)
!560 = !DILocation(line: 105, column: 7, scope: !524)
!561 = !DILocation(line: 105, column: 14, scope: !524)
!562 = !DILocation(line: 105, column: 23, scope: !524)
!563 = !DILocation(line: 105, column: 31, scope: !524)
!564 = !DILocation(line: 107, column: 5, scope: !524)
!565 = !DILocation(line: 107, column: 9, scope: !524)
!566 = !DILocation(line: 107, column: 25, scope: !524)
!567 = !DILocation(line: 107, column: 38, scope: !524)
!568 = !DILocation(line: 108, column: 7, scope: !524)
!569 = !DILocation(line: 108, column: 18, scope: !524)
!570 = !DILocation(line: 108, column: 24, scope: !524)
!571 = !DILocation(line: 108, column: 31, scope: !524)
!572 = !DILocation(line: 108, column: 43, scope: !524)
!573 = !DILocalVariable(name: "at", scope: !524, file: !13, line: 108, type: !4)
!574 = !DILocation(line: 109, column: 7, scope: !524)
!575 = !DILocation(line: 109, column: 11, scope: !524)
!576 = !DILocation(line: 109, column: 17, scope: !524)
!577 = !DILocation(line: 109, column: 22, scope: !524)
!578 = !DILocation(line: 109, column: 27, scope: !524)
!579 = !DILocation(line: 109, column: 51, scope: !524)
!580 = !DILocation(line: 109, column: 58, scope: !524)
!581 = !DILocation(line: 109, column: 66, scope: !524)
!582 = !DILocation(line: 109, column: 71, scope: !524)
!583 = !DILocation(line: 109, column: 76, scope: !524)
!584 = !DILocation(line: 109, column: 98, scope: !524)
!585 = !DILocation(line: 109, column: 106, scope: !524)
!586 = !DILocation(line: 109, column: 111, scope: !524)
!587 = !DILocation(line: 109, column: 116, scope: !524)
!588 = !DILocation(line: 109, column: 122, scope: !524)
!589 = !DILocation(line: 110, column: 9, scope: !524)
!590 = !DILocation(line: 110, column: 16, scope: !524)
!591 = !DILocation(line: 110, column: 24, scope: !524)
!592 = !DILocation(line: 110, column: 32, scope: !524)
!593 = !DILocation(line: 113, column: 5, scope: !524)
!594 = !DILocation(line: 113, column: 14, scope: !524)
!595 = !DILocation(line: 113, column: 15, scope: !524)
!596 = !DILocation(line: 113, column: 24, scope: !524)
!597 = !DILocation(line: 113, column: 29, scope: !524)
!598 = !DILocation(line: 115, column: 3, scope: !524)
!599 = !DILocation(line: 115, column: 9, scope: !524)
!600 = !{null, !35, !23}
!601 = !DISubroutineType(types: !600)
!602 = distinct !DISubprogram(name: "compactEntries<string>", linkageName: "nish.compactEntries$str", scope: !13, file: !13, line: 136, type: !601, scopeLine: 136, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!603 = !DILocation(line: 136, column: 1, scope: !602)
!604 = !DILocalVariable(name: "items", arg: 1, scope: !602, file: !13, line: 136, type: !35)
!605 = !DILocalVariable(name: "hashes", arg: 2, scope: !602, file: !13, line: 136, type: !23)
!606 = !DILocation(line: 137, column: 3, scope: !602)
!607 = !DILocation(line: 137, column: 16, scope: !602)
!608 = !DILocation(line: 137, column: 22, scope: !602)
!609 = !DILocalVariable(name: "used", scope: !602, file: !13, line: 137, type: !4)
!610 = !DILocation(line: 138, column: 3, scope: !602)
!611 = !DILocation(line: 138, column: 17, scope: !602)
!612 = !DILocalVariable(name: "to", scope: !602, file: !13, line: 138, type: !4)
!613 = !DILocation(line: 139, column: 3, scope: !602)
!614 = !DILocation(line: 139, column: 24, scope: !602)
!615 = !DILocalVariable(name: "from", scope: !602, file: !13, line: 139, type: !4)
!616 = !DILocation(line: 139, column: 55, scope: !602)
!617 = !DILocation(line: 140, column: 68, scope: !602)
!618 = !DILocation(line: 139, column: 27, scope: !602)
!619 = !DILocation(line: 139, column: 34, scope: !602)
!620 = !DILocation(line: 139, column: 42, scope: !602)
!621 = !DILocation(line: 139, column: 49, scope: !602)
!622 = !DILocation(line: 139, column: 79, scope: !602)
!623 = !DILocation(line: 140, column: 5, scope: !602)
!624 = !DILocation(line: 140, column: 9, scope: !602)
!625 = !DILocation(line: 140, column: 16, scope: !602)
!626 = !DILocation(line: 140, column: 26, scope: !602)
!627 = !DILocation(line: 140, column: 31, scope: !602)
!628 = !DILocation(line: 140, column: 37, scope: !602)
!629 = !DILocation(line: 140, column: 42, scope: !602)
!630 = !DILocation(line: 140, column: 47, scope: !602)
!631 = !DILocation(line: 140, column: 55, scope: !602)
!632 = !DILocation(line: 140, column: 62, scope: !602)
!633 = !DILocation(line: 140, column: 83, scope: !602)
!634 = !DILocation(line: 141, column: 7, scope: !602)
!635 = !DILocation(line: 141, column: 13, scope: !602)
!636 = !DILocation(line: 141, column: 19, scope: !602)
!637 = !DILocation(line: 141, column: 25, scope: !602)
!638 = !DILocation(line: 142, column: 7, scope: !602)
!639 = !DILocation(line: 139, column: 71, scope: !602)
!640 = !DILocation(line: 145, column: 3, scope: !602)
!641 = !DILocation(line: 145, column: 10, scope: !602)
!642 = !DILocation(line: 145, column: 16, scope: !602)
!643 = !DILocation(line: 145, column: 32, scope: !602)
!644 = !DILocation(line: 145, column: 36, scope: !602)
!645 = !DILocation(line: 146, column: 5, scope: !602)
!646 = !{null, !43, !23}
!647 = !DISubroutineType(types: !646)
!648 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 136, type: !647, scopeLine: 136, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!649 = !DILocation(line: 136, column: 1, scope: !648)
!650 = !DILocalVariable(name: "items", arg: 1, scope: !648, file: !13, line: 136, type: !43)
!651 = !DILocalVariable(name: "hashes", arg: 2, scope: !648, file: !13, line: 136, type: !23)
!652 = !DILocation(line: 137, column: 3, scope: !648)
!653 = !DILocation(line: 137, column: 16, scope: !648)
!654 = !DILocation(line: 137, column: 22, scope: !648)
!655 = !DILocalVariable(name: "used", scope: !648, file: !13, line: 137, type: !4)
!656 = !DILocation(line: 138, column: 3, scope: !648)
!657 = !DILocation(line: 138, column: 17, scope: !648)
!658 = !DILocalVariable(name: "to", scope: !648, file: !13, line: 138, type: !4)
!659 = !DILocation(line: 139, column: 3, scope: !648)
!660 = !DILocation(line: 139, column: 24, scope: !648)
!661 = !DILocalVariable(name: "from", scope: !648, file: !13, line: 139, type: !4)
!662 = !DILocation(line: 139, column: 55, scope: !648)
!663 = !DILocation(line: 140, column: 68, scope: !648)
!664 = !DILocation(line: 139, column: 27, scope: !648)
!665 = !DILocation(line: 139, column: 34, scope: !648)
!666 = !DILocation(line: 139, column: 42, scope: !648)
!667 = !DILocation(line: 139, column: 49, scope: !648)
!668 = !DILocation(line: 139, column: 79, scope: !648)
!669 = !DILocation(line: 140, column: 5, scope: !648)
!670 = !DILocation(line: 140, column: 9, scope: !648)
!671 = !DILocation(line: 140, column: 16, scope: !648)
!672 = !DILocation(line: 140, column: 26, scope: !648)
!673 = !DILocation(line: 140, column: 31, scope: !648)
!674 = !DILocation(line: 140, column: 37, scope: !648)
!675 = !DILocation(line: 140, column: 42, scope: !648)
!676 = !DILocation(line: 140, column: 47, scope: !648)
!677 = !DILocation(line: 140, column: 55, scope: !648)
!678 = !DILocation(line: 140, column: 62, scope: !648)
!679 = !DILocation(line: 140, column: 83, scope: !648)
!680 = !DILocation(line: 141, column: 7, scope: !648)
!681 = !DILocation(line: 141, column: 13, scope: !648)
!682 = !DILocation(line: 141, column: 19, scope: !648)
!683 = !DILocation(line: 141, column: 25, scope: !648)
!684 = !DILocation(line: 142, column: 7, scope: !648)
!685 = !DILocation(line: 139, column: 71, scope: !648)
!686 = !DILocation(line: 145, column: 3, scope: !648)
!687 = !DILocation(line: 145, column: 10, scope: !648)
!688 = !DILocation(line: 145, column: 16, scope: !648)
!689 = !DILocation(line: 145, column: 32, scope: !648)
!690 = !DILocation(line: 145, column: 36, scope: !648)
!691 = !DILocation(line: 146, column: 5, scope: !648)
