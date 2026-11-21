%struct.Set$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*))
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 !dbg !70 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !72, metadata !DIExpression()), !dbg !71
  call void @llvm.dbg.value(metadata i32 %mask, metadata !73, metadata !DIExpression()), !dbg !71
  call void @llvm.dbg.value(metadata i32 %index, metadata !74, metadata !DIExpression()), !dbg !71
  %0 = xor i32 %mask, -1, !dbg !77
  %1 = and i32 %h, %0, !dbg !76
  %2 = add i32 %index, 1, !dbg !81
  %3 = or i32 %1, %2, !dbg !75
  ret i32 %3, !dbg !71
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !86 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !88, metadata !DIExpression()), !dbg !87
  call void @llvm.dbg.value(metadata i32 %index, metadata !89, metadata !DIExpression()), !dbg !87
  %0 = sext i32 %bucket to i64, !dbg !91
  %1 = shl i64 %0, 32, !dbg !91
  %2 = sext i32 %index to i64, !dbg !93
  %3 = or i64 %1, %2, !dbg !90
  ret i64 %3, !dbg !87
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !97 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !99, metadata !DIExpression()), !dbg !98
  call void @llvm.dbg.value(metadata i32 %h, metadata !100, metadata !DIExpression()), !dbg !98
  %0 = sext i32 %bucket to i64, !dbg !104
  %1 = shl i64 %0, 32, !dbg !104
  %2 = zext i32 %h to i64, !dbg !106
  %3 = or i64 %1, %2, !dbg !103
  %4 = xor i64 %3, -1, !dbg !101
  ret i64 %4, !dbg !98
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !110 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !112, metadata !DIExpression()), !dbg !111
  call void @llvm.dbg.value(metadata i32 %mask, metadata !113, metadata !DIExpression()), !dbg !111
  call void @llvm.dbg.value(metadata i32 %h, metadata !114, metadata !DIExpression()), !dbg !111
  call void @llvm.dbg.value(metadata i32 %index, metadata !115, metadata !DIExpression()), !dbg !111
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index), !dbg !117
  store i32 %0, i32* %word.addr, align 4, !dbg !116
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !121, metadata !DIExpression()), !dbg !116
  store i32 %mask, i32* %low.addr, align 4, !dbg !122
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !125, metadata !DIExpression()), !dbg !122
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !128
  store i32 %1, i32* %bucket.addr, align 4, !dbg !126
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !131, metadata !DIExpression()), !dbg !126
  %2 = load i32, i32* %bucket.addr, align 4, !dbg !134
  store i32 %2, i32* %b.addr, align 4, !dbg !132
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !135, metadata !DIExpression()), !dbg !132
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !136
  %4 = load i64, i64* %3, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !136
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !136
  %6 = load i8*, i8** %5, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !136
  br label %while.cond, !dbg !136

while.cond:
  %7 = load i32, i32* %b.addr, align 4, !dbg !148
  %8 = icmp sge i32 %7, 0, !dbg !148
  br i1 %8, label %land.rhs, label %land.end, !dbg !148

land.rhs:
  %9 = load i32, i32* %b.addr, align 4, !dbg !150
  %10 = trunc i64 %4 to i32, !dbg !137
  %11 = icmp slt i32 %9, %10, !dbg !150
  br label %land.end, !dbg !148

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ], !dbg !148
  br i1 %12, label %while.body, label %while.end, !dbg !136

while.body:
  %13 = load i32, i32* %b.addr, align 4, !dbg !155
  %14 = sext i32 %13 to i64, !dbg !154
  %15 = bitcast i8* %6 to i32*, !dbg !154
  %16 = getelementptr inbounds i32, i32* %15, i64 %14, !dbg !154
  %17 = load i32, i32* %16, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !154
  %18 = icmp eq i32 %17, 0, !dbg !154
  br i1 %18, label %if.then, label %if.end, !dbg !153

if.then:
  %19 = load i32, i32* %b.addr, align 4, !dbg !161
  %20 = sext i32 %19 to i64, !dbg !160
  %21 = load i32, i32* %word.addr, align 4, !dbg !162
  %22 = bitcast i8* %6 to i32*, !dbg !160
  %23 = getelementptr inbounds i32, i32* %22, i64 %20, !dbg !160
  store i32 %21, i32* %23, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !160
  ret void, !dbg !163

if.end:
  %24 = load i32, i32* %bucket.addr, align 4, !dbg !166
  %25 = add i32 %24, 1, !dbg !166
  %26 = load i32, i32* %low.addr, align 4, !dbg !168
  %27 = and i32 %25, %26, !dbg !165
  store i32 %27, i32* %bucket.addr, align 4, !dbg !164
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !171
  store i32 %28, i32* %b.addr, align 4, !dbg !169
  br label %while.cond, !dbg !136

while.end:
  ret void, !dbg !111
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !174 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !176, metadata !DIExpression()), !dbg !175
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !179
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !179
  %2 = trunc i64 %1 to i32, !dbg !179
  store i32 %2, i32* %used.addr, align 4, !dbg !177
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !180, metadata !DIExpression()), !dbg !177
  store i32 0, i32* %to.addr, align 4, !dbg !181
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !183, metadata !DIExpression()), !dbg !181
  store i32 0, i32* %from.addr, align 4, !dbg !184
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !186, metadata !DIExpression()), !dbg !184
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !184
  %4 = load i8*, i8** %3, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !184
  br label %for.cond, !dbg !184

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !188
  %6 = load i32, i32* %used.addr, align 4, !dbg !189
  %7 = icmp slt i32 %5, %6, !dbg !188
  br i1 %7, label %for.body, label %for.end, !dbg !184

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !192
  %9 = sext i32 %8 to i64, !dbg !187
  %10 = bitcast i8* %4 to i32*, !dbg !187
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !187
  %12 = load i32, i32* %11, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !187
  store i32 %12, i32* %h.addr, align 4, !dbg !191
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !193, metadata !DIExpression()), !dbg !191
  %13 = load i32, i32* %h.addr, align 4, !dbg !195
  %14 = icmp ne i32 %13, 0, !dbg !195
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !195

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !197
  %16 = icmp sge i32 %15, 0, !dbg !197
  br label %land.end.1, !dbg !195

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !195
  br i1 %17, label %land.rhs, label %land.end, !dbg !195

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !199
  %19 = load i32, i32* %used.addr, align 4, !dbg !200
  %20 = icmp slt i32 %18, %19, !dbg !199
  br label %land.end, !dbg !195

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !195
  br i1 %21, label %if.then, label %if.end, !dbg !194

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !203
  %23 = sext i32 %22 to i64, !dbg !202
  %24 = load i32, i32* %h.addr, align 4, !dbg !204
  %25 = bitcast i8* %4 to i32*, !dbg !202
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !202
  store i32 %24, i32* %26, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !202
  %27 = load i32, i32* %to.addr, align 4, !dbg !205
  %28 = add nsw i32 %27, 1, !dbg !205
  store i32 %28, i32* %to.addr, align 4, !dbg !205
  br label %if.end, !dbg !194

if.end:
  br label %for.inc, !dbg !184

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !206
  %30 = add nsw i32 %29, 1, !dbg !206
  store i32 %30, i32* %from.addr, align 4, !dbg !206
  br label %for.cond, !dbg !184

for.end:
  br label %while.cond, !dbg !207

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !209
  %32 = load i64, i64* %31, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !209
  %33 = trunc i64 %32 to i32, !dbg !209
  %34 = load i32, i32* %to.addr, align 4, !dbg !210
  %35 = icmp sgt i32 %33, %34, !dbg !208
  br i1 %35, label %land.rhs.2, label %land.end.2, !dbg !208

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !211
  %37 = load i64, i64* %36, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !211
  %38 = trunc i64 %37 to i32, !dbg !211
  %39 = icmp sgt i32 %38, 0, !dbg !211
  br label %land.end.2, !dbg !208

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ], !dbg !208
  br i1 %40, label %while.body, label %while.end, !dbg !207

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !214
  %42 = load i64, i64* %41, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !214
  %43 = sub i64 %42, 1, !dbg !214
  store i64 %43, i64* %41, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !214
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !214
  %45 = load i8*, i8** %44, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !214
  %46 = bitcast i8* %45 to i32*, !dbg !214
  %47 = getelementptr inbounds i32, i32* %46, i64 %43, !dbg !214
  %48 = load i32, i32* %47, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !214
  br label %while.cond, !dbg !207

while.end:
  ret void, !dbg !175
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !217 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !219, metadata !DIExpression()), !dbg !218
  call void @llvm.dbg.value(metadata i32 %live, metadata !220, metadata !DIExpression()), !dbg !218
  call void @llvm.dbg.value(metadata i32 %used, metadata !221, metadata !DIExpression()), !dbg !218
  %0 = sext i32 %live to i64, !dbg !223
  %1 = mul nsw i64 %0, 2, !dbg !223
  %2 = sext i32 %used to i64, !dbg !226
  %3 = icmp slt i64 %1, %2, !dbg !223
  br i1 %3, label %if.then, label %if.end, !dbg !222

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !229
  ret %struct.nish_array* %slots, !dbg !231

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !235
  %5 = load i64, i64* %4, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !235
  %6 = trunc i64 %5 to i32, !dbg !235
  store i32 %6, i32* %n.addr, align 4, !dbg !233
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !236, metadata !DIExpression()), !dbg !233
  %7 = load i32, i32* %n.addr, align 4, !dbg !238
  %8 = icmp sge i32 %7, 0, !dbg !238
  br i1 %8, label %land.rhs, label %land.end, !dbg !238

land.rhs:
  %9 = load i32, i32* %n.addr, align 4, !dbg !240
  %10 = icmp slt i32 %9, 32768, !dbg !240
  br label %land.end, !dbg !238

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ], !dbg !238
  br i1 %11, label %if.then.1, label %if.end.1, !dbg !237

if.then.1:
  %12 = load i32, i32* %n.addr, align 4, !dbg !246
  %13 = mul nsw i32 %12, 2, !dbg !246
  %14 = trunc i32 %13 to i16, !dbg !245
  %15 = zext i16 %14 to i64, !dbg !244
  %16 = call i8* @nish_alloc_struct(i64 24), !dbg !244
  %17 = bitcast i8* %16 to %struct.nish_array*, !dbg !244
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0, !dbg !244
  store i64 %15, i64* %18, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !244
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1, !dbg !244
  store i64 %15, i64* %19, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !244
  %20 = mul i64 %15, 4, !dbg !244
  %21 = call i8* @nish_alloc_struct(i64 %20), !dbg !244
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !142, !noalias !141, !dbg !244
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2, !dbg !244
  store i8* %21, i8** %22, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !244
  ret %struct.nish_array* %17, !dbg !243

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2), !dbg !249
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !252
  ret %struct.nish_array* %slots, !dbg !254
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 !dbg !258 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !260, metadata !DIExpression()), !dbg !259
  call void @llvm.dbg.value(metadata i32 %times, metadata !261, metadata !DIExpression()), !dbg !259
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !264
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !264
  %2 = trunc i64 %1 to i32, !dbg !264
  store i32 %2, i32* %n.addr, align 4, !dbg !262
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !265, metadata !DIExpression()), !dbg !262
  store i32 1, i32* %k.addr, align 4, !dbg !266
  call void @llvm.dbg.declare(metadata i32* %k.addr, metadata !268, metadata !DIExpression()), !dbg !266
  br label %for.cond, !dbg !266

for.cond:
  %3 = load i32, i32* %k.addr, align 4, !dbg !269
  %4 = icmp slt i32 %3, %times, !dbg !269
  br i1 %4, label %for.body, label %for.end, !dbg !266

for.body:
  store i32 0, i32* %i.addr, align 4, !dbg !272
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !274, metadata !DIExpression()), !dbg !272
  br label %for.cond.1, !dbg !272

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4, !dbg !275
  %6 = load i32, i32* %n.addr, align 4, !dbg !276
  %7 = icmp slt i32 %5, %6, !dbg !275
  br i1 %7, label %for.body.1, label %for.end.1, !dbg !272

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !278
  %9 = load i64, i64* %8, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !278
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1, !dbg !278
  %11 = load i64, i64* %10, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !278
  %12 = icmp eq i64 %9, %11, !dbg !278
  br i1 %12, label %push.grow, label %push.store, !dbg !278

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4), !dbg !278
  br label %push.store, !dbg !278

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !278
  %14 = load i8*, i8** %13, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !278
  %15 = bitcast i8* %14 to i32*, !dbg !278
  %16 = getelementptr inbounds i32, i32* %15, i64 %9, !dbg !278
  store i32 0, i32* %16, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !278
  %17 = add i64 %9, 1, !dbg !278
  store i64 %17, i64* %8, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !278
  %18 = trunc i64 %17 to i32, !dbg !278
  br label %for.inc.1, !dbg !272

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4, !dbg !280
  %20 = add nsw i32 %19, 1, !dbg !280
  store i32 %20, i32* %i.addr, align 4, !dbg !280
  br label %for.cond.1, !dbg !272

for.end.1:
  br label %for.inc, !dbg !266

for.inc:
  %21 = load i32, i32* %k.addr, align 4, !dbg !281
  %22 = add nsw i32 %21, 1, !dbg !281
  store i32 %22, i32* %k.addr, align 4, !dbg !281
  br label %for.cond, !dbg !266

for.end:
  ret void, !dbg !259
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !284 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !286, metadata !DIExpression()), !dbg !285
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !287, metadata !DIExpression()), !dbg !285
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !290
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !290
  %2 = trunc i64 %1 to i32, !dbg !290
  %3 = sub nsw i32 %2, 1, !dbg !289
  store i32 %3, i32* %mask.addr, align 4, !dbg !288
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !292, metadata !DIExpression()), !dbg !288
  store i32 0, i32* %i.addr, align 4, !dbg !293
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !295, metadata !DIExpression()), !dbg !293
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !293
  %5 = load i64, i64* %4, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !293
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !293
  %7 = load i8*, i8** %6, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !293
  br label %for.cond, !dbg !293

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !297
  %9 = trunc i64 %5 to i32, !dbg !296
  %10 = icmp slt i32 %8, %9, !dbg !297
  br i1 %10, label %for.body, label %for.end, !dbg !293

for.body:
  %11 = load i32, i32* %i.addr, align 4, !dbg !302
  %12 = sext i32 %11 to i64, !dbg !301
  %13 = bitcast i8* %7 to i32*, !dbg !301
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !301
  %15 = load i32, i32* %14, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !301
  store i32 %15, i32* %h.addr, align 4, !dbg !300
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !303, metadata !DIExpression()), !dbg !300
  %16 = load i32, i32* %h.addr, align 4, !dbg !305
  %17 = icmp ne i32 %16, 0, !dbg !305
  br i1 %17, label %if.then, label %if.end, !dbg !304

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !310
  %19 = load i32, i32* %h.addr, align 4, !dbg !311
  %20 = load i32, i32* %i.addr, align 4, !dbg !312
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !308
  br label %if.end, !dbg !304

if.end:
  br label %for.inc, !dbg !293

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !313
  %22 = add nsw i32 %21, 1, !dbg !313
  store i32 %22, i32* %i.addr, align 4, !dbg !313
  br label %for.cond, !dbg !293

for.end:
  ret void, !dbg !285
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !314 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !316, metadata !DIExpression()), !dbg !315
  store i32 0, i32* %i.addr, align 4, !dbg !317
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !319, metadata !DIExpression()), !dbg !317
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !317
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !317
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !317
  %3 = load i8*, i8** %2, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !317
  br label %for.cond, !dbg !317

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !321
  %5 = trunc i64 %1 to i32, !dbg !320
  %6 = icmp slt i32 %4, %5, !dbg !321
  br i1 %6, label %for.body, label %for.end, !dbg !317

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !325
  %8 = sext i32 %7 to i64, !dbg !324
  %9 = bitcast i8* %3 to i32*, !dbg !324
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !324
  store i32 0, i32* %10, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !324
  br label %for.inc, !dbg !317

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !327
  %12 = add nsw i32 %11, 1, !dbg !327
  store i32 %12, i32* %i.addr, align 4, !dbg !327
  br label %for.cond, !dbg !317

for.end:
  ret void, !dbg !315
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 !dbg !331 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !333, metadata !DIExpression()), !dbg !332
  call void @llvm.dbg.value(metadata i32 %mask, metadata !334, metadata !DIExpression()), !dbg !332
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !335, metadata !DIExpression()), !dbg !332
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !336, metadata !DIExpression()), !dbg !332
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !339
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !339
  %2 = trunc i64 %1 to i32, !dbg !339
  store i32 %2, i32* %used.addr, align 4, !dbg !337
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !340, metadata !DIExpression()), !dbg !337
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !343
  %4 = load i64, i64* %3, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !343
  %5 = trunc i64 %4 to i32, !dbg !343
  store i32 %5, i32* %size.addr, align 4, !dbg !341
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !344, metadata !DIExpression()), !dbg !341
  %6 = load i32, i32* %used.addr, align 4, !dbg !347
  %7 = sext i32 %6 to i64, !dbg !346
  %8 = mul nsw i64 %7, 4, !dbg !346
  %9 = load i32, i32* %size.addr, align 4, !dbg !350
  %10 = sext i32 %9 to i64, !dbg !349
  %11 = mul nsw i64 %10, 3, !dbg !349
  %12 = icmp sgt i64 %8, %11, !dbg !346
  br i1 %12, label %lor.end.1, label %lor.rhs.1, !dbg !346

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0, !dbg !352
  br label %lor.end.1, !dbg !346

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ], !dbg !346
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !346

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4, !dbg !355
  %16 = icmp sge i32 %bucket, %15, !dbg !354
  br label %lor.end, !dbg !346

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ], !dbg !346
  br i1 %17, label %if.then, label %if.end, !dbg !345

if.then:
  ret i1 false, !dbg !357

if.end:
  %18 = load i32, i32* %used.addr, align 4, !dbg !360
  %19 = icmp sgt i32 %18, 0, !dbg !360
  br i1 %19, label %if.then.1, label %if.end.1, !dbg !359

if.then.1:
  %20 = sext i32 %bucket to i64, !dbg !363
  %21 = load i32, i32* %used.addr, align 4, !dbg !367
  %22 = sub nsw i32 %21, 1, !dbg !367
  %23 = sext i32 %22 to i64, !dbg !366
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !366
  %25 = load i8*, i8** %24, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !366
  %26 = bitcast i8* %25 to i32*, !dbg !366
  %27 = getelementptr inbounds i32, i32* %26, i64 %23, !dbg !366
  %28 = load i32, i32* %27, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !366
  %29 = load i32, i32* %used.addr, align 4, !dbg !370
  %30 = sub nsw i32 %29, 1, !dbg !370
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30), !dbg !365
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !363
  %33 = load i8*, i8** %32, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !363
  %34 = bitcast i8* %33 to i32*, !dbg !363
  %35 = getelementptr inbounds i32, i32* %34, i64 %20, !dbg !363
  store i32 %31, i32* %35, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !363
  br label %if.end.1, !dbg !359

if.end.1:
  ret i1 true, !dbg !372
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 !dbg !376 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !378, metadata !DIExpression()), !dbg !377
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !377
  store i32 0, i32* %0, align 4, !tbaa !50, !dbg !377
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !377
  store i32 7, i32* %1, align 4, !tbaa !379, !dbg !377
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !377
  store i32 0, i32* %2, align 4, !tbaa !380, !dbg !377
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !377
  store i32 0, i32* %3, align 4, !tbaa !381, !dbg !377
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !383
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !383
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !383
  store i64 8, i64* %6, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !383
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !383
  store i64 8, i64* %7, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !383
  %8 = mul i64 8, 4, !dbg !383
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !383
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !142, !noalias !141, !dbg !383
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !383
  store i8* %9, i8** %10, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !383
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !382
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !384, !dbg !382
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !386
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !386
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !386
  store i64 0, i64* %14, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !386
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !386
  store i64 0, i64* %15, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !386
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !386
  store i8* null, i8** %16, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !386
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !385
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !387, !dbg !385
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !389
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !389
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !389
  store i64 0, i64* %20, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !389
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !389
  store i64 0, i64* %21, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !389
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !389
  store i8* null, i8** %22, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !389
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !388
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !390, !dbg !388
  ret void, !dbg !377
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #3 !dbg !393 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !395, metadata !DIExpression()), !dbg !394
  call void @llvm.dbg.value(metadata i32 %key, metadata !396, metadata !DIExpression()), !dbg !394
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !399
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !384, !dbg !399
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !400
  %3 = load i32, i32* %2, align 4, !tbaa !379, !dbg !400
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !401
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !390, !dbg !401
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !402
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !387, !dbg !402
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !398
  ret i64 %8, !dbg !397
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #3 !dbg !406 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !408, metadata !DIExpression()), !dbg !407
  call void @llvm.dbg.value(metadata i32 %key, metadata !409, metadata !DIExpression()), !dbg !407
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !411
  %1 = icmp sge i64 %0, 0, !dbg !411
  ret i1 %1, !dbg !410
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) %this, i32 noundef %key) #0 !dbg !416 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !418, metadata !DIExpression()), !dbg !417
  call void @llvm.dbg.value(metadata i32 %key, metadata !419, metadata !DIExpression()), !dbg !417
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !421
  store i64 %0, i64* %found.addr, align 8, !dbg !420
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !423, metadata !DIExpression()), !dbg !420
  %1 = load i64, i64* %found.addr, align 8, !dbg !425
  %2 = icmp slt i64 %1, 0, !dbg !425
  br i1 %2, label %if.then, label %if.end, !dbg !424

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !429
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !428
  br label %if.end, !dbg !424

if.end:
  ret %struct.Set$i32* %this, !dbg !431
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !435 {
entry:
  %packed.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !437, metadata !DIExpression()), !dbg !436
  call void @llvm.dbg.value(metadata i64 %absent, metadata !438, metadata !DIExpression()), !dbg !436
  call void @llvm.dbg.value(metadata i32 %key, metadata !439, metadata !DIExpression()), !dbg !436
  %0 = sub nsw i64 -1, %absent, !dbg !441
  store i64 %0, i64* %packed.addr, align 8, !dbg !440
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !443, metadata !DIExpression()), !dbg !440
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !444
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !387, !dbg !444
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !444
  %4 = load i64, i64* %3, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !444
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !444
  %6 = load i64, i64* %5, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !444
  %7 = icmp eq i64 %4, %6, !dbg !444
  br i1 %7, label %push.grow, label %push.store, !dbg !444

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4), !dbg !444
  br label %push.store, !dbg !444

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !444
  %9 = load i8*, i8** %8, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !444
  %10 = bitcast i8* %9 to i32*, !dbg !444
  %11 = getelementptr inbounds i32, i32* %10, i64 %4, !dbg !444
  store i32 %key, i32* %11, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !444
  %12 = add i64 %4, 1, !dbg !444
  store i64 %12, i64* %3, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !444
  %13 = trunc i64 %12 to i32, !dbg !444
  %14 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !446
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !390, !dbg !446
  %16 = load i64, i64* %packed.addr, align 8, !dbg !448
  %17 = trunc i64 %16 to i32, !dbg !447
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0, !dbg !446
  %19 = load i64, i64* %18, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !446
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1, !dbg !446
  %21 = load i64, i64* %20, align 8, !alias.scope !141, !noalias !142, !tbaa !248, !dbg !446
  %22 = icmp eq i64 %19, %21, !dbg !446
  br i1 %22, label %push.grow.1, label %push.store.1, !dbg !446

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4), !dbg !446
  br label %push.store.1, !dbg !446

push.store.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2, !dbg !446
  %24 = load i8*, i8** %23, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !446
  %25 = bitcast i8* %24 to i32*, !dbg !446
  %26 = getelementptr inbounds i32, i32* %25, i64 %19, !dbg !446
  store i32 %17, i32* %26, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !446
  %27 = add i64 %19, 1, !dbg !446
  store i64 %27, i64* %18, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !446
  %28 = trunc i64 %27 to i32, !dbg !446
  call void @nish.Set$i32.addOne(%struct.Set$i32* %this), !dbg !449
  %29 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !453
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !384, !dbg !453
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !454
  %32 = load i32, i32* %31, align 4, !tbaa !379, !dbg !454
  %33 = load i64, i64* %packed.addr, align 8, !dbg !456
  %34 = ashr i64 %33, 32, !dbg !456
  %35 = trunc i64 %34 to i32, !dbg !455
  %36 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !457
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !390, !dbg !457
  %38 = call i1 @nish.fileAppended(%struct.nish_array* %30, i32 %32, i32 %35, %struct.nish_array* %37), !dbg !452
  %39 = xor i1 %38, true, !dbg !451
  br i1 %39, label %if.then, label %if.end, !dbg !450

if.then:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !459
  br label %if.end, !dbg !450

if.end:
  ret void, !dbg !436
}

define internal void @nish.Set$i32.addOne(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 !dbg !460 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !462, metadata !DIExpression()), !dbg !461
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !464
  %1 = load i32, i32* %0, align 4, !tbaa !380, !dbg !464
  store i32 %1, i32* %live.addr, align 4, !dbg !463
  call void @llvm.dbg.declare(metadata i32* %live.addr, metadata !465, metadata !DIExpression()), !dbg !463
  %2 = load i32, i32* %live.addr, align 4, !dbg !467
  %3 = icmp slt i32 %2, 2147483647, !dbg !467
  br i1 %3, label %if.then, label %if.end, !dbg !466

if.then:
  %4 = load i32, i32* %live.addr, align 4, !dbg !471
  %5 = add nsw i32 %4, 1, !dbg !471
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !470
  store i32 %5, i32* %6, align 4, !tbaa !380, !dbg !470
  br label %if.end, !dbg !466

if.end:
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !474
  %8 = load i32, i32* %7, align 4, !tbaa !50, !dbg !474
  store i32 %8, i32* %size.addr, align 4, !dbg !473
  call void @llvm.dbg.declare(metadata i32* %size.addr, metadata !475, metadata !DIExpression()), !dbg !473
  %9 = load i32, i32* %size.addr, align 4, !dbg !477
  %10 = icmp slt i32 %9, 2147483647, !dbg !477
  br i1 %10, label %if.then.1, label %if.end.1, !dbg !476

if.then.1:
  %11 = load i32, i32* %size.addr, align 4, !dbg !481
  %12 = add nsw i32 %11, 1, !dbg !481
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !480
  store i32 %12, i32* %13, align 4, !tbaa !50, !dbg !480
  br label %if.end.1, !dbg !476

if.end.1:
  ret void, !dbg !461
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !483 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !485, metadata !DIExpression()), !dbg !484
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !488
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !387, !dbg !488
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !488
  %3 = load i64, i64* %2, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !488
  %4 = trunc i64 %3 to i32, !dbg !488
  store i32 %4, i32* %used.addr, align 4, !dbg !486
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !489, metadata !DIExpression()), !dbg !486
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !491
  %6 = load i32, i32* %5, align 4, !tbaa !381, !dbg !491
  %7 = icmp ugt i32 %6, 0, !dbg !491
  store i1 %7, i1* %walking.addr, align 1, !dbg !490
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !493, metadata !DIExpression()), !dbg !490
  %8 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !496
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !384, !dbg !496
  %10 = load i1, i1* %walking.addr, align 1, !dbg !497
  br i1 %10, label %cond.true, label %cond.false, !dbg !497

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !498
  br label %cond.end, !dbg !497

cond.false:
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !499
  %13 = load i32, i32* %12, align 4, !tbaa !380, !dbg !499
  br label %cond.end, !dbg !497

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !497
  %15 = load i32, i32* %used.addr, align 4, !dbg !500
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !495
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !494
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !501, metadata !DIExpression()), !dbg !494
  %17 = load i1, i1* %walking.addr, align 1, !dbg !504
  %18 = xor i1 %17, true, !dbg !503
  br i1 %18, label %land.rhs, label %land.end, !dbg !503

land.rhs:
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !505
  %20 = load i32, i32* %19, align 4, !tbaa !380, !dbg !505
  %21 = load i32, i32* %used.addr, align 4, !dbg !506
  %22 = icmp slt i32 %20, %21, !dbg !505
  br label %land.end, !dbg !503

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !503
  br i1 %23, label %if.then, label %if.end, !dbg !502

if.then:
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !509
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !387, !dbg !509
  %26 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !510
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !390, !dbg !510
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !508
  %28 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !512
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !390, !dbg !512
  call void @nish.compactHashes(%struct.nish_array* %29), !dbg !511
  br label %if.end, !dbg !502

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !514
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !513
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !384, !dbg !513
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !517
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0, !dbg !517
  %34 = load i64, i64* %33, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !517
  %35 = trunc i64 %34 to i32, !dbg !517
  %36 = sub nsw i32 %35, 1, !dbg !516
  %37 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !515
  store i32 %36, i32* %37, align 4, !tbaa !379, !dbg !515
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !520
  %39 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !521
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !390, !dbg !521
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40), !dbg !519
  ret void, !dbg !484
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #3 !dbg !524 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !526, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata i32 %mask, metadata !527, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !528, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !529, metadata !DIExpression()), !dbg !525
  call void @llvm.dbg.value(metadata i32 %key, metadata !530, metadata !DIExpression()), !dbg !525
  %0 = zext i32 %key to i64, !dbg !532
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8, !dbg !532
  %2 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8, !dbg !532
  %3 = mul i64 %0, %1, !dbg !532
  %4 = add i64 %3, %2, !dbg !532
  %5 = lshr i64 %4, 32, !dbg !532
  %6 = trunc i64 %5 to i32, !dbg !532
  %7 = icmp eq i32 %6, 0, !dbg !532
  %8 = select i1 %7, i32 1, i32 %6, !dbg !532
  store i32 %8, i32* %h.addr, align 4, !dbg !531
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !534, metadata !DIExpression()), !dbg !531
  store i32 %mask, i32* %low.addr, align 4, !dbg !535
  call void @llvm.dbg.declare(metadata i32* %low.addr, metadata !538, metadata !DIExpression()), !dbg !535
  %9 = load i32, i32* %h.addr, align 4, !dbg !540
  %10 = load i32, i32* %low.addr, align 4, !dbg !542
  %11 = xor i32 %10, -1, !dbg !541
  %12 = and i32 %9, %11, !dbg !540
  store i32 %12, i32* %fingerprint.addr, align 4, !dbg !539
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !543, metadata !DIExpression()), !dbg !539
  %13 = load i32, i32* %h.addr, align 4, !dbg !547
  %14 = call i32 @nish.homeBucket(i32 %13, i32 %mask), !dbg !546
  store i32 %14, i32* %bucket.addr, align 4, !dbg !544
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !549, metadata !DIExpression()), !dbg !544
  %15 = load i32, i32* %bucket.addr, align 4, !dbg !552
  store i32 %15, i32* %b.addr, align 4, !dbg !550
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !553, metadata !DIExpression()), !dbg !550
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !554
  %17 = load i64, i64* %16, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !554
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !554
  %19 = load i8*, i8** %18, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !554
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !554
  %21 = load i64, i64* %20, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !554
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !554
  %23 = load i8*, i8** %22, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !554
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !554
  %25 = load i64, i64* %24, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !554
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !554
  %27 = load i8*, i8** %26, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !554
  br label %while.cond, !dbg !554

while.cond:
  %28 = load i32, i32* %b.addr, align 4, !dbg !558
  %29 = icmp sge i32 %28, 0, !dbg !558
  br i1 %29, label %land.rhs, label %land.end, !dbg !558

land.rhs:
  %30 = load i32, i32* %b.addr, align 4, !dbg !560
  %31 = trunc i64 %17 to i32, !dbg !555
  %32 = icmp slt i32 %30, %31, !dbg !560
  br label %land.end, !dbg !558

land.end:
  %33 = phi i1 [ false, %while.cond ], [ %32, %land.rhs ], !dbg !558
  br i1 %33, label %while.body, label %while.end, !dbg !554

while.body:
  %34 = load i32, i32* %b.addr, align 4, !dbg !565
  %35 = sext i32 %34 to i64, !dbg !564
  %36 = bitcast i8* %19 to i32*, !dbg !564
  %37 = getelementptr inbounds i32, i32* %36, i64 %35, !dbg !564
  %38 = load i32, i32* %37, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !564
  store i32 %38, i32* %word.addr, align 4, !dbg !563
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !566, metadata !DIExpression()), !dbg !563
  %39 = load i32, i32* %word.addr, align 4, !dbg !568
  %40 = icmp eq i32 %39, 0, !dbg !568
  br i1 %40, label %if.then, label %if.end, !dbg !567

if.then:
  %41 = load i32, i32* %b.addr, align 4, !dbg !573
  %42 = load i32, i32* %h.addr, align 4, !dbg !574
  %43 = tail call i64 @nish.absentAt(i32 %41, i32 %42), !dbg !572
  ret i64 %43, !dbg !571

if.end:
  %44 = load i32, i32* %word.addr, align 4, !dbg !577
  %45 = load i32, i32* %low.addr, align 4, !dbg !579
  %46 = xor i32 %45, -1, !dbg !578
  %47 = and i32 %44, %46, !dbg !577
  %48 = load i32, i32* %fingerprint.addr, align 4, !dbg !580
  %49 = icmp eq i32 %47, %48, !dbg !576
  br i1 %49, label %if.then.1, label %if.end.1, !dbg !575

if.then.1:
  %50 = load i32, i32* %word.addr, align 4, !dbg !585
  %51 = load i32, i32* %low.addr, align 4, !dbg !586
  %52 = and i32 %50, %51, !dbg !585
  %53 = sub i32 %52, 1, !dbg !584
  store i32 %53, i32* %at.addr, align 4, !dbg !582
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !588, metadata !DIExpression()), !dbg !582
  %54 = load i32, i32* %at.addr, align 4, !dbg !590
  %55 = icmp sge i32 %54, 0, !dbg !590
  br i1 %55, label %land.rhs.4, label %land.end.4, !dbg !590

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4, !dbg !592
  %57 = trunc i64 %21 to i32, !dbg !556
  %58 = icmp slt i32 %56, %57, !dbg !592
  br label %land.end.4, !dbg !590

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ], !dbg !590
  br i1 %59, label %land.rhs.3, label %land.end.3, !dbg !590

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4, !dbg !595
  %61 = sext i32 %60 to i64, !dbg !594
  %62 = bitcast i8* %23 to i32*, !dbg !594
  %63 = getelementptr inbounds i32, i32* %62, i64 %61, !dbg !594
  %64 = load i32, i32* %63, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !594
  %65 = load i32, i32* %h.addr, align 4, !dbg !596
  %66 = icmp eq i32 %64, %65, !dbg !594
  br label %land.end.3, !dbg !590

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ], !dbg !590
  br i1 %67, label %land.rhs.2, label %land.end.2, !dbg !590

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4, !dbg !597
  %69 = trunc i64 %25 to i32, !dbg !557
  %70 = icmp slt i32 %68, %69, !dbg !597
  br label %land.end.2, !dbg !590

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ], !dbg !590
  br i1 %71, label %land.rhs.1, label %land.end.1, !dbg !590

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4, !dbg !601
  %73 = sext i32 %72 to i64, !dbg !600
  %74 = bitcast i8* %27 to i32*, !dbg !600
  %75 = getelementptr inbounds i32, i32* %74, i64 %73, !dbg !600
  %76 = load i32, i32* %75, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !600
  %77 = icmp eq i32 %76, %key, !dbg !599
  br label %land.end.1, !dbg !590

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ], !dbg !590
  br i1 %78, label %if.then.2, label %if.end.2, !dbg !589

if.then.2:
  %79 = load i32, i32* %b.addr, align 4, !dbg !606
  %80 = load i32, i32* %at.addr, align 4, !dbg !607
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80), !dbg !605
  ret i64 %81, !dbg !604

if.end.2:
  br label %if.end.1, !dbg !575

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4, !dbg !610
  %83 = add i32 %82, 1, !dbg !610
  %84 = load i32, i32* %low.addr, align 4, !dbg !612
  %85 = and i32 %83, %84, !dbg !609
  store i32 %85, i32* %bucket.addr, align 4, !dbg !608
  %86 = load i32, i32* %bucket.addr, align 4, !dbg !615
  store i32 %86, i32* %b.addr, align 4, !dbg !613
  br label %while.cond, !dbg !554

while.end:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !619
  %88 = load i64, i64* %87, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !619
  %89 = trunc i64 %88 to i32, !dbg !619
  %90 = load i32, i32* %h.addr, align 4, !dbg !620
  %91 = tail call i64 @nish.absentAt(i32 %89, i32 %90), !dbg !617
  ret i64 %91, !dbg !616
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !623 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !625, metadata !DIExpression()), !dbg !624
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !626, metadata !DIExpression()), !dbg !624
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !629
  %1 = load i64, i64* %0, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !629
  %2 = trunc i64 %1 to i32, !dbg !629
  store i32 %2, i32* %used.addr, align 4, !dbg !627
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !630, metadata !DIExpression()), !dbg !627
  store i32 0, i32* %to.addr, align 4, !dbg !631
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !633, metadata !DIExpression()), !dbg !631
  store i32 0, i32* %from.addr, align 4, !dbg !634
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !636, metadata !DIExpression()), !dbg !634
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !634
  %4 = load i64, i64* %3, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !634
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !634
  %6 = load i8*, i8** %5, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !634
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !634
  %8 = load i64, i64* %7, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !634
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !634
  %10 = load i8*, i8** %9, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !634
  br label %for.cond, !dbg !634

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !639
  %12 = load i32, i32* %used.addr, align 4, !dbg !640
  %13 = icmp slt i32 %11, %12, !dbg !639
  br i1 %13, label %land.rhs, label %land.end, !dbg !639

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !641
  %15 = trunc i64 %4 to i32, !dbg !637
  %16 = icmp slt i32 %14, %15, !dbg !641
  br label %land.end, !dbg !639

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !639
  br i1 %17, label %for.body, label %for.end, !dbg !634

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !646
  %19 = sext i32 %18 to i64, !dbg !645
  %20 = bitcast i8* %6 to i32*, !dbg !645
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !645
  %22 = load i32, i32* %21, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !645
  %23 = icmp ne i32 %22, 0, !dbg !645
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !645

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !648
  %25 = icmp sge i32 %24, 0, !dbg !648
  br label %land.end.3, !dbg !645

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !645
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !645

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !650
  %28 = load i32, i32* %used.addr, align 4, !dbg !651
  %29 = icmp slt i32 %27, %28, !dbg !650
  br label %land.end.2, !dbg !645

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !645
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !645

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !652
  %32 = trunc i64 %8 to i32, !dbg !638
  %33 = icmp slt i32 %31, %32, !dbg !652
  br label %land.end.1, !dbg !645

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !645
  br i1 %34, label %if.then, label %if.end, !dbg !644

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !656
  %36 = sext i32 %35 to i64, !dbg !655
  %37 = load i32, i32* %from.addr, align 4, !dbg !658
  %38 = sext i32 %37 to i64, !dbg !657
  %39 = bitcast i8* %10 to i32*, !dbg !657
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !657
  %41 = load i32, i32* %40, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !657
  %42 = bitcast i8* %10 to i32*, !dbg !655
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !655
  store i32 %41, i32* %43, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !655
  %44 = load i32, i32* %to.addr, align 4, !dbg !659
  %45 = add nsw i32 %44, 1, !dbg !659
  store i32 %45, i32* %to.addr, align 4, !dbg !659
  br label %if.end, !dbg !644

if.end:
  br label %for.inc, !dbg !634

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !660
  %47 = add nsw i32 %46, 1, !dbg !660
  store i32 %47, i32* %from.addr, align 4, !dbg !660
  br label %for.cond, !dbg !634

for.end:
  br label %while.cond, !dbg !661

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !663
  %49 = load i64, i64* %48, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !663
  %50 = trunc i64 %49 to i32, !dbg !663
  %51 = load i32, i32* %to.addr, align 4, !dbg !664
  %52 = icmp sgt i32 %50, %51, !dbg !662
  br i1 %52, label %land.rhs.4, label %land.end.4, !dbg !662

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !665
  %54 = load i64, i64* %53, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !665
  %55 = trunc i64 %54 to i32, !dbg !665
  %56 = icmp sgt i32 %55, 0, !dbg !665
  br label %land.end.4, !dbg !662

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ], !dbg !662
  br i1 %57, label %while.body, label %while.end, !dbg !661

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !668
  %59 = load i64, i64* %58, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !668
  %60 = sub i64 %59, 1, !dbg !668
  store i64 %60, i64* %58, align 8, !alias.scope !141, !noalias !142, !tbaa !146, !dbg !668
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !668
  %62 = load i8*, i8** %61, align 8, !alias.scope !141, !noalias !142, !tbaa !147, !dbg !668
  %63 = bitcast i8* %62 to i32*, !dbg !668
  %64 = getelementptr inbounds i32, i32* %63, i64 %60, !dbg !668
  %65 = load i32, i32* %64, align 4, !alias.scope !142, !noalias !141, !tbaa !157, !dbg !668
  br label %while.cond, !dbg !661

while.end:
  ret void, !dbg !624
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3, !669, !670, !671, !672, !673}
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 624, size: 384, align: 64, elements: !37)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 626, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 627, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 628, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 629, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 630, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 631, baseType: !23, size: 64, offset: 256)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 633, baseType: !19, size: 32, offset: 320)
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
!59 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 82, type: !58, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!60 = !DILocation(line: 82, column: 1, scope: !59)
!61 = !DILocalVariable(name: "h", arg: 1, scope: !59, file: !13, line: 82, type: !19)
!62 = !DILocalVariable(name: "mask", arg: 2, scope: !59, file: !13, line: 82, type: !4)
!63 = !DILocation(line: 82, column: 48, scope: !59)
!64 = !DILocation(line: 82, column: 54, scope: !59)
!65 = !DILocation(line: 82, column: 58, scope: !59)
!66 = !DILocation(line: 82, column: 59, scope: !59)
!67 = !DILocation(line: 82, column: 72, scope: !59)
!68 = !{!19, !19, !4, !4}
!69 = !DISubroutineType(types: !68)
!70 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 90, type: !69, scopeLine: 90, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!71 = !DILocation(line: 90, column: 1, scope: !70)
!72 = !DILocalVariable(name: "h", arg: 1, scope: !70, file: !13, line: 90, type: !19)
!73 = !DILocalVariable(name: "mask", arg: 2, scope: !70, file: !13, line: 90, type: !4)
!74 = !DILocalVariable(name: "index", arg: 3, scope: !70, file: !13, line: 90, type: !4)
!75 = !DILocation(line: 90, column: 58, scope: !70)
!76 = !DILocation(line: 90, column: 59, scope: !70)
!77 = !DILocation(line: 90, column: 63, scope: !70)
!78 = !DILocation(line: 90, column: 64, scope: !70)
!79 = !DILocation(line: 90, column: 70, scope: !70)
!80 = !DILocation(line: 90, column: 79, scope: !70)
!81 = !DILocation(line: 90, column: 80, scope: !70)
!82 = !DILocation(line: 90, column: 86, scope: !70)
!83 = !DILocation(line: 90, column: 95, scope: !70)
!84 = !{!16, !4, !4}
!85 = !DISubroutineType(types: !84)
!86 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 99, type: !85, scopeLine: 99, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!87 = !DILocation(line: 99, column: 1, scope: !86)
!88 = !DILocalVariable(name: "bucket", arg: 1, scope: !86, file: !13, line: 99, type: !4)
!89 = !DILocalVariable(name: "index", arg: 2, scope: !86, file: !13, line: 99, type: !4)
!90 = !DILocation(line: 99, column: 51, scope: !86)
!91 = !DILocation(line: 99, column: 52, scope: !86)
!92 = !DILocation(line: 99, column: 58, scope: !86)
!93 = !DILocation(line: 99, column: 75, scope: !86)
!94 = !DILocation(line: 99, column: 81, scope: !86)
!95 = !{!16, !4, !19}
!96 = !DISubroutineType(types: !95)
!97 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 102, type: !96, scopeLine: 102, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!98 = !DILocation(line: 102, column: 1, scope: !97)
!99 = !DILocalVariable(name: "bucket", arg: 1, scope: !97, file: !13, line: 102, type: !4)
!100 = !DILocalVariable(name: "h", arg: 2, scope: !97, file: !13, line: 102, type: !19)
!101 = !DILocation(line: 102, column: 48, scope: !97)
!102 = !DILocation(line: 102, column: 49, scope: !97)
!103 = !DILocation(line: 102, column: 50, scope: !97)
!104 = !DILocation(line: 102, column: 51, scope: !97)
!105 = !DILocation(line: 102, column: 57, scope: !97)
!106 = !DILocation(line: 102, column: 74, scope: !97)
!107 = !DILocation(line: 102, column: 80, scope: !97)
!108 = !{null, !23, !4, !19, !4}
!109 = !DISubroutineType(types: !108)
!110 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 154, type: !109, scopeLine: 154, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!111 = !DILocation(line: 154, column: 1, scope: !110)
!112 = !DILocalVariable(name: "slots", arg: 1, scope: !110, file: !13, line: 154, type: !23)
!113 = !DILocalVariable(name: "mask", arg: 2, scope: !110, file: !13, line: 154, type: !4)
!114 = !DILocalVariable(name: "h", arg: 3, scope: !110, file: !13, line: 154, type: !19)
!115 = !DILocalVariable(name: "index", arg: 4, scope: !110, file: !13, line: 154, type: !4)
!116 = !DILocation(line: 155, column: 3, scope: !110)
!117 = !DILocation(line: 155, column: 16, scope: !110)
!118 = !DILocation(line: 155, column: 25, scope: !110)
!119 = !DILocation(line: 155, column: 28, scope: !110)
!120 = !DILocation(line: 155, column: 34, scope: !110)
!121 = !DILocalVariable(name: "word", scope: !110, file: !13, line: 155, type: !19)
!122 = !DILocation(line: 156, column: 3, scope: !110)
!123 = !DILocation(line: 156, column: 15, scope: !110)
!124 = !DILocation(line: 156, column: 21, scope: !110)
!125 = !DILocalVariable(name: "low", scope: !110, file: !13, line: 156, type: !19)
!126 = !DILocation(line: 157, column: 3, scope: !110)
!127 = !DILocation(line: 157, column: 16, scope: !110)
!128 = !DILocation(line: 157, column: 22, scope: !110)
!129 = !DILocation(line: 157, column: 33, scope: !110)
!130 = !DILocation(line: 157, column: 36, scope: !110)
!131 = !DILocalVariable(name: "bucket", scope: !110, file: !13, line: 157, type: !19)
!132 = !DILocation(line: 158, column: 3, scope: !110)
!133 = !DILocation(line: 158, column: 11, scope: !110)
!134 = !DILocation(line: 158, column: 17, scope: !110)
!135 = !DILocalVariable(name: "b", scope: !110, file: !13, line: 158, type: !4)
!136 = !DILocation(line: 159, column: 3, scope: !110)
!137 = !DILocation(line: 159, column: 30, scope: !110)
!138 = !{!"nish array"}
!139 = !{!"header", !138}
!140 = !{!"elements", !138}
!141 = !{!139}
!142 = !{!140}
!143 = !{!"header i64", !46, i64 0}
!144 = !{!"header ptr", !46, i64 0}
!145 = !{!"array header", !143, i64 0, !143, i64 8, !144, i64 16}
!146 = !{!145, !143, i64 0}
!147 = !{!145, !144, i64 16}
!148 = !DILocation(line: 159, column: 10, scope: !110)
!149 = !DILocation(line: 159, column: 15, scope: !110)
!150 = !DILocation(line: 159, column: 20, scope: !110)
!151 = !DILocation(line: 159, column: 24, scope: !110)
!152 = !DILocation(line: 159, column: 45, scope: !110)
!153 = !DILocation(line: 160, column: 5, scope: !110)
!154 = !DILocation(line: 160, column: 9, scope: !110)
!155 = !DILocation(line: 160, column: 15, scope: !110)
!156 = !{!"element i32", !46, i64 0}
!157 = !{!156, !156, i64 0}
!158 = !DILocation(line: 160, column: 22, scope: !110)
!159 = !DILocation(line: 160, column: 25, scope: !110)
!160 = !DILocation(line: 161, column: 7, scope: !110)
!161 = !DILocation(line: 161, column: 13, scope: !110)
!162 = !DILocation(line: 161, column: 18, scope: !110)
!163 = !DILocation(line: 162, column: 7, scope: !110)
!164 = !DILocation(line: 164, column: 5, scope: !110)
!165 = !DILocation(line: 164, column: 14, scope: !110)
!166 = !DILocation(line: 164, column: 15, scope: !110)
!167 = !DILocation(line: 164, column: 24, scope: !110)
!168 = !DILocation(line: 164, column: 29, scope: !110)
!169 = !DILocation(line: 165, column: 5, scope: !110)
!170 = !DILocation(line: 165, column: 9, scope: !110)
!171 = !DILocation(line: 165, column: 15, scope: !110)
!172 = !{null, !23}
!173 = !DISubroutineType(types: !172)
!174 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 185, type: !173, scopeLine: 185, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!175 = !DILocation(line: 185, column: 1, scope: !174)
!176 = !DILocalVariable(name: "hashes", arg: 1, scope: !174, file: !13, line: 185, type: !23)
!177 = !DILocation(line: 186, column: 3, scope: !174)
!178 = !DILocation(line: 186, column: 16, scope: !174)
!179 = !DILocation(line: 186, column: 22, scope: !174)
!180 = !DILocalVariable(name: "used", scope: !174, file: !13, line: 186, type: !4)
!181 = !DILocation(line: 187, column: 3, scope: !174)
!182 = !DILocation(line: 187, column: 17, scope: !174)
!183 = !DILocalVariable(name: "to", scope: !174, file: !13, line: 187, type: !4)
!184 = !DILocation(line: 188, column: 3, scope: !174)
!185 = !DILocation(line: 188, column: 24, scope: !174)
!186 = !DILocalVariable(name: "from", scope: !174, file: !13, line: 188, type: !4)
!187 = !DILocation(line: 189, column: 15, scope: !174)
!188 = !DILocation(line: 188, column: 27, scope: !174)
!189 = !DILocation(line: 188, column: 34, scope: !174)
!190 = !DILocation(line: 188, column: 48, scope: !174)
!191 = !DILocation(line: 189, column: 5, scope: !174)
!192 = !DILocation(line: 189, column: 22, scope: !174)
!193 = !DILocalVariable(name: "h", scope: !174, file: !13, line: 189, type: !19)
!194 = !DILocation(line: 190, column: 5, scope: !174)
!195 = !DILocation(line: 190, column: 9, scope: !174)
!196 = !DILocation(line: 190, column: 15, scope: !174)
!197 = !DILocation(line: 190, column: 20, scope: !174)
!198 = !DILocation(line: 190, column: 26, scope: !174)
!199 = !DILocation(line: 190, column: 31, scope: !174)
!200 = !DILocation(line: 190, column: 36, scope: !174)
!201 = !DILocation(line: 190, column: 42, scope: !174)
!202 = !DILocation(line: 191, column: 7, scope: !174)
!203 = !DILocation(line: 191, column: 14, scope: !174)
!204 = !DILocation(line: 191, column: 20, scope: !174)
!205 = !DILocation(line: 192, column: 7, scope: !174)
!206 = !DILocation(line: 188, column: 40, scope: !174)
!207 = !DILocation(line: 195, column: 3, scope: !174)
!208 = !DILocation(line: 195, column: 10, scope: !174)
!209 = !DILocation(line: 195, column: 16, scope: !174)
!210 = !DILocation(line: 195, column: 33, scope: !174)
!211 = !DILocation(line: 195, column: 39, scope: !174)
!212 = !DILocation(line: 195, column: 55, scope: !174)
!213 = !DILocation(line: 195, column: 58, scope: !174)
!214 = !DILocation(line: 196, column: 5, scope: !174)
!215 = !{!23, !23, !4, !4}
!216 = !DISubroutineType(types: !215)
!217 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 207, type: !216, scopeLine: 207, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!218 = !DILocation(line: 207, column: 1, scope: !217)
!219 = !DILocalVariable(name: "slots", arg: 1, scope: !217, file: !13, line: 207, type: !23)
!220 = !DILocalVariable(name: "live", arg: 2, scope: !217, file: !13, line: 207, type: !4)
!221 = !DILocalVariable(name: "used", arg: 3, scope: !217, file: !13, line: 207, type: !4)
!222 = !DILocation(line: 208, column: 3, scope: !217)
!223 = !DILocation(line: 208, column: 7, scope: !217)
!224 = !DILocation(line: 208, column: 13, scope: !217)
!225 = !DILocation(line: 208, column: 21, scope: !217)
!226 = !DILocation(line: 208, column: 25, scope: !217)
!227 = !DILocation(line: 208, column: 31, scope: !217)
!228 = !DILocation(line: 208, column: 38, scope: !217)
!229 = !DILocation(line: 209, column: 5, scope: !217)
!230 = !DILocation(line: 209, column: 16, scope: !217)
!231 = !DILocation(line: 210, column: 5, scope: !217)
!232 = !DILocation(line: 210, column: 12, scope: !217)
!233 = !DILocation(line: 212, column: 3, scope: !217)
!234 = !DILocation(line: 212, column: 13, scope: !217)
!235 = !DILocation(line: 212, column: 19, scope: !217)
!236 = !DILocalVariable(name: "n", scope: !217, file: !13, line: 212, type: !4)
!237 = !DILocation(line: 213, column: 3, scope: !217)
!238 = !DILocation(line: 213, column: 7, scope: !217)
!239 = !DILocation(line: 213, column: 12, scope: !217)
!240 = !DILocation(line: 213, column: 17, scope: !217)
!241 = !DILocation(line: 213, column: 21, scope: !217)
!242 = !DILocation(line: 213, column: 28, scope: !217)
!243 = !DILocation(line: 215, column: 5, scope: !217)
!244 = !DILocation(line: 215, column: 12, scope: !217)
!245 = !DILocation(line: 215, column: 27, scope: !217)
!246 = !DILocation(line: 215, column: 33, scope: !217)
!247 = !DILocation(line: 215, column: 37, scope: !217)
!248 = !{!145, !143, i64 8}
!249 = !DILocation(line: 217, column: 3, scope: !217)
!250 = !DILocation(line: 217, column: 14, scope: !217)
!251 = !DILocation(line: 217, column: 21, scope: !217)
!252 = !DILocation(line: 218, column: 3, scope: !217)
!253 = !DILocation(line: 218, column: 14, scope: !217)
!254 = !DILocation(line: 219, column: 3, scope: !217)
!255 = !DILocation(line: 219, column: 10, scope: !217)
!256 = !{null, !23, !4}
!257 = !DISubroutineType(types: !256)
!258 = distinct !DISubprogram(name: "widenSlots", linkageName: "nish.widenSlots", scope: !13, file: !13, line: 231, type: !257, scopeLine: 231, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!259 = !DILocation(line: 231, column: 1, scope: !258)
!260 = !DILocalVariable(name: "slots", arg: 1, scope: !258, file: !13, line: 231, type: !23)
!261 = !DILocalVariable(name: "times", arg: 2, scope: !258, file: !13, line: 231, type: !4)
!262 = !DILocation(line: 232, column: 3, scope: !258)
!263 = !DILocation(line: 232, column: 13, scope: !258)
!264 = !DILocation(line: 232, column: 19, scope: !258)
!265 = !DILocalVariable(name: "n", scope: !258, file: !13, line: 232, type: !4)
!266 = !DILocation(line: 233, column: 3, scope: !258)
!267 = !DILocation(line: 233, column: 21, scope: !258)
!268 = !DILocalVariable(name: "k", scope: !258, file: !13, line: 233, type: !4)
!269 = !DILocation(line: 233, column: 24, scope: !258)
!270 = !DILocation(line: 233, column: 28, scope: !258)
!271 = !DILocation(line: 233, column: 40, scope: !258)
!272 = !DILocation(line: 234, column: 5, scope: !258)
!273 = !DILocation(line: 234, column: 23, scope: !258)
!274 = !DILocalVariable(name: "i", scope: !258, file: !13, line: 234, type: !4)
!275 = !DILocation(line: 234, column: 26, scope: !258)
!276 = !DILocation(line: 234, column: 30, scope: !258)
!277 = !DILocation(line: 234, column: 38, scope: !258)
!278 = !DILocation(line: 235, column: 7, scope: !258)
!279 = !DILocation(line: 235, column: 18, scope: !258)
!280 = !DILocation(line: 234, column: 33, scope: !258)
!281 = !DILocation(line: 233, column: 35, scope: !258)
!282 = !{null, !23, !23}
!283 = !DISubroutineType(types: !282)
!284 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 245, type: !283, scopeLine: 245, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!285 = !DILocation(line: 245, column: 1, scope: !284)
!286 = !DILocalVariable(name: "slots", arg: 1, scope: !284, file: !13, line: 245, type: !23)
!287 = !DILocalVariable(name: "hashes", arg: 2, scope: !284, file: !13, line: 245, type: !23)
!288 = !DILocation(line: 246, column: 3, scope: !284)
!289 = !DILocation(line: 246, column: 16, scope: !284)
!290 = !DILocation(line: 246, column: 22, scope: !284)
!291 = !DILocation(line: 246, column: 38, scope: !284)
!292 = !DILocalVariable(name: "mask", scope: !284, file: !13, line: 246, type: !4)
!293 = !DILocation(line: 247, column: 3, scope: !284)
!294 = !DILocation(line: 247, column: 21, scope: !284)
!295 = !DILocalVariable(name: "i", scope: !284, file: !13, line: 247, type: !4)
!296 = !DILocation(line: 247, column: 34, scope: !284)
!297 = !DILocation(line: 247, column: 24, scope: !284)
!298 = !DILocation(line: 247, column: 28, scope: !284)
!299 = !DILocation(line: 247, column: 55, scope: !284)
!300 = !DILocation(line: 248, column: 5, scope: !284)
!301 = !DILocation(line: 248, column: 15, scope: !284)
!302 = !DILocation(line: 248, column: 22, scope: !284)
!303 = !DILocalVariable(name: "h", scope: !284, file: !13, line: 248, type: !19)
!304 = !DILocation(line: 249, column: 5, scope: !284)
!305 = !DILocation(line: 249, column: 9, scope: !284)
!306 = !DILocation(line: 249, column: 15, scope: !284)
!307 = !DILocation(line: 249, column: 18, scope: !284)
!308 = !DILocation(line: 250, column: 7, scope: !284)
!309 = !DILocation(line: 250, column: 17, scope: !284)
!310 = !DILocation(line: 250, column: 24, scope: !284)
!311 = !DILocation(line: 250, column: 30, scope: !284)
!312 = !DILocation(line: 250, column: 33, scope: !284)
!313 = !DILocation(line: 247, column: 50, scope: !284)
!314 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 276, type: !173, scopeLine: 276, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!315 = !DILocation(line: 276, column: 1, scope: !314)
!316 = !DILocalVariable(name: "slots", arg: 1, scope: !314, file: !13, line: 276, type: !23)
!317 = !DILocation(line: 277, column: 3, scope: !314)
!318 = !DILocation(line: 277, column: 21, scope: !314)
!319 = !DILocalVariable(name: "i", scope: !314, file: !13, line: 277, type: !4)
!320 = !DILocation(line: 277, column: 34, scope: !314)
!321 = !DILocation(line: 277, column: 24, scope: !314)
!322 = !DILocation(line: 277, column: 28, scope: !314)
!323 = !DILocation(line: 277, column: 54, scope: !314)
!324 = !DILocation(line: 278, column: 5, scope: !314)
!325 = !DILocation(line: 278, column: 11, scope: !314)
!326 = !DILocation(line: 278, column: 16, scope: !314)
!327 = !DILocation(line: 277, column: 49, scope: !314)
!328 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!329 = !{!328, !23, !4, !4, !23}
!330 = !DISubroutineType(types: !329)
!331 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 312, type: !330, scopeLine: 312, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!332 = !DILocation(line: 312, column: 1, scope: !331)
!333 = !DILocalVariable(name: "slots", arg: 1, scope: !331, file: !13, line: 312, type: !23)
!334 = !DILocalVariable(name: "mask", arg: 2, scope: !331, file: !13, line: 312, type: !4)
!335 = !DILocalVariable(name: "bucket", arg: 3, scope: !331, file: !13, line: 312, type: !4)
!336 = !DILocalVariable(name: "hashes", arg: 4, scope: !331, file: !13, line: 312, type: !23)
!337 = !DILocation(line: 313, column: 3, scope: !331)
!338 = !DILocation(line: 313, column: 16, scope: !331)
!339 = !DILocation(line: 313, column: 22, scope: !331)
!340 = !DILocalVariable(name: "used", scope: !331, file: !13, line: 313, type: !4)
!341 = !DILocation(line: 314, column: 3, scope: !331)
!342 = !DILocation(line: 314, column: 16, scope: !331)
!343 = !DILocation(line: 314, column: 22, scope: !331)
!344 = !DILocalVariable(name: "size", scope: !331, file: !13, line: 314, type: !4)
!345 = !DILocation(line: 315, column: 3, scope: !331)
!346 = !DILocation(line: 315, column: 7, scope: !331)
!347 = !DILocation(line: 315, column: 13, scope: !331)
!348 = !DILocation(line: 315, column: 21, scope: !331)
!349 = !DILocation(line: 315, column: 25, scope: !331)
!350 = !DILocation(line: 315, column: 31, scope: !331)
!351 = !DILocation(line: 315, column: 39, scope: !331)
!352 = !DILocation(line: 315, column: 44, scope: !331)
!353 = !DILocation(line: 315, column: 53, scope: !331)
!354 = !DILocation(line: 315, column: 58, scope: !331)
!355 = !DILocation(line: 315, column: 68, scope: !331)
!356 = !DILocation(line: 315, column: 74, scope: !331)
!357 = !DILocation(line: 316, column: 5, scope: !331)
!358 = !DILocation(line: 316, column: 12, scope: !331)
!359 = !DILocation(line: 318, column: 3, scope: !331)
!360 = !DILocation(line: 318, column: 7, scope: !331)
!361 = !DILocation(line: 318, column: 14, scope: !331)
!362 = !DILocation(line: 318, column: 17, scope: !331)
!363 = !DILocation(line: 319, column: 5, scope: !331)
!364 = !DILocation(line: 319, column: 11, scope: !331)
!365 = !DILocation(line: 319, column: 21, scope: !331)
!366 = !DILocation(line: 319, column: 30, scope: !331)
!367 = !DILocation(line: 319, column: 37, scope: !331)
!368 = !DILocation(line: 319, column: 44, scope: !331)
!369 = !DILocation(line: 319, column: 48, scope: !331)
!370 = !DILocation(line: 319, column: 54, scope: !331)
!371 = !DILocation(line: 319, column: 61, scope: !331)
!372 = !DILocation(line: 321, column: 3, scope: !331)
!373 = !DILocation(line: 321, column: 10, scope: !331)
!374 = !{null, !12}
!375 = !DISubroutineType(types: !374)
!376 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 636, type: !375, scopeLine: 636, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!377 = !DILocation(line: 636, column: 3, scope: !376)
!378 = !DILocalVariable(name: "this", arg: 1, scope: !376, file: !13, line: 636, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!379 = !{!49, !47, i64 16}
!380 = !{!49, !47, i64 20}
!381 = !{!49, !47, i64 40}
!382 = !DILocation(line: 637, column: 5, scope: !376)
!383 = !DILocation(line: 637, column: 18, scope: !376)
!384 = !{!49, !48, i64 8}
!385 = !DILocation(line: 638, column: 5, scope: !376)
!386 = !DILocation(line: 638, column: 22, scope: !376)
!387 = !{!49, !48, i64 24}
!388 = !DILocation(line: 639, column: 5, scope: !376)
!389 = !DILocation(line: 639, column: 24, scope: !376)
!390 = !{!49, !48, i64 32}
!391 = !{!16, !12, !4}
!392 = !DISubroutineType(types: !391)
!393 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 643, type: !392, scopeLine: 643, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!394 = !DILocation(line: 643, column: 3, scope: !393)
!395 = !DILocalVariable(name: "this", arg: 1, scope: !393, file: !13, line: 643, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!396 = !DILocalVariable(name: "key", arg: 2, scope: !393, file: !13, line: 643, type: !4)
!397 = !DILocation(line: 644, column: 5, scope: !393)
!398 = !DILocation(line: 644, column: 12, scope: !393)
!399 = !DILocation(line: 644, column: 23, scope: !393)
!400 = !DILocation(line: 644, column: 35, scope: !393)
!401 = !DILocation(line: 644, column: 46, scope: !393)
!402 = !DILocation(line: 644, column: 64, scope: !393)
!403 = !DILocation(line: 644, column: 80, scope: !393)
!404 = !{!328, !12, !4}
!405 = !DISubroutineType(types: !404)
!406 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 654, type: !405, scopeLine: 654, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!407 = !DILocation(line: 654, column: 3, scope: !406)
!408 = !DILocalVariable(name: "this", arg: 1, scope: !406, file: !13, line: 654, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!409 = !DILocalVariable(name: "key", arg: 2, scope: !406, file: !13, line: 654, type: !4)
!410 = !DILocation(line: 655, column: 5, scope: !406)
!411 = !DILocation(line: 655, column: 12, scope: !406)
!412 = !DILocation(line: 655, column: 23, scope: !406)
!413 = !DILocation(line: 655, column: 31, scope: !406)
!414 = !{!12, !12, !4}
!415 = !DISubroutineType(types: !414)
!416 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 664, type: !415, scopeLine: 664, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!417 = !DILocation(line: 664, column: 3, scope: !416)
!418 = !DILocalVariable(name: "this", arg: 1, scope: !416, file: !13, line: 664, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!419 = !DILocalVariable(name: "key", arg: 2, scope: !416, file: !13, line: 664, type: !4)
!420 = !DILocation(line: 665, column: 5, scope: !416)
!421 = !DILocation(line: 665, column: 19, scope: !416)
!422 = !DILocation(line: 665, column: 30, scope: !416)
!423 = !DILocalVariable(name: "found", scope: !416, file: !13, line: 665, type: !16)
!424 = !DILocation(line: 666, column: 5, scope: !416)
!425 = !DILocation(line: 666, column: 9, scope: !416)
!426 = !DILocation(line: 666, column: 17, scope: !416)
!427 = !DILocation(line: 666, column: 20, scope: !416)
!428 = !DILocation(line: 667, column: 7, scope: !416)
!429 = !DILocation(line: 667, column: 21, scope: !416)
!430 = !DILocation(line: 667, column: 28, scope: !416)
!431 = !DILocation(line: 669, column: 5, scope: !416)
!432 = !DILocation(line: 669, column: 12, scope: !416)
!433 = !{null, !12, !16, !4}
!434 = !DISubroutineType(types: !433)
!435 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 731, type: !434, scopeLine: 731, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!436 = !DILocation(line: 731, column: 3, scope: !435)
!437 = !DILocalVariable(name: "this", arg: 1, scope: !435, file: !13, line: 731, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!438 = !DILocalVariable(name: "absent", arg: 2, scope: !435, file: !13, line: 731, type: !16)
!439 = !DILocalVariable(name: "key", arg: 3, scope: !435, file: !13, line: 731, type: !4)
!440 = !DILocation(line: 732, column: 5, scope: !435)
!441 = !DILocation(line: 732, column: 20, scope: !435)
!442 = !DILocation(line: 732, column: 25, scope: !435)
!443 = !DILocalVariable(name: "packed", scope: !435, file: !13, line: 732, type: !16)
!444 = !DILocation(line: 733, column: 5, scope: !435)
!445 = !DILocation(line: 733, column: 25, scope: !435)
!446 = !DILocation(line: 734, column: 5, scope: !435)
!447 = !DILocation(line: 734, column: 27, scope: !435)
!448 = !DILocation(line: 734, column: 33, scope: !435)
!449 = !DILocation(line: 735, column: 5, scope: !435)
!450 = !DILocation(line: 738, column: 5, scope: !435)
!451 = !DILocation(line: 738, column: 9, scope: !435)
!452 = !DILocation(line: 738, column: 10, scope: !435)
!453 = !DILocation(line: 738, column: 23, scope: !435)
!454 = !DILocation(line: 738, column: 35, scope: !435)
!455 = !DILocation(line: 738, column: 46, scope: !435)
!456 = !DILocation(line: 738, column: 52, scope: !435)
!457 = !DILocation(line: 738, column: 67, scope: !435)
!458 = !DILocation(line: 738, column: 86, scope: !435)
!459 = !DILocation(line: 739, column: 7, scope: !435)
!460 = distinct !DISubprogram(name: "Set<i32>.addOne", linkageName: "nish.Set$i32.addOne", scope: !13, file: !13, line: 744, type: !375, scopeLine: 744, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!461 = !DILocation(line: 744, column: 3, scope: !460)
!462 = !DILocalVariable(name: "this", arg: 1, scope: !460, file: !13, line: 744, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!463 = !DILocation(line: 745, column: 5, scope: !460)
!464 = !DILocation(line: 745, column: 18, scope: !460)
!465 = !DILocalVariable(name: "live", scope: !460, file: !13, line: 745, type: !4)
!466 = !DILocation(line: 746, column: 5, scope: !460)
!467 = !DILocation(line: 746, column: 9, scope: !460)
!468 = !DILocation(line: 746, column: 16, scope: !460)
!469 = !DILocation(line: 746, column: 28, scope: !460)
!470 = !DILocation(line: 747, column: 7, scope: !460)
!471 = !DILocation(line: 747, column: 19, scope: !460)
!472 = !DILocation(line: 747, column: 26, scope: !460)
!473 = !DILocation(line: 749, column: 5, scope: !460)
!474 = !DILocation(line: 749, column: 18, scope: !460)
!475 = !DILocalVariable(name: "size", scope: !460, file: !13, line: 749, type: !4)
!476 = !DILocation(line: 750, column: 5, scope: !460)
!477 = !DILocation(line: 750, column: 9, scope: !460)
!478 = !DILocation(line: 750, column: 16, scope: !460)
!479 = !DILocation(line: 750, column: 28, scope: !460)
!480 = !DILocation(line: 751, column: 7, scope: !460)
!481 = !DILocation(line: 751, column: 19, scope: !460)
!482 = !DILocation(line: 751, column: 26, scope: !460)
!483 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 767, type: !375, scopeLine: 767, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!484 = !DILocation(line: 767, column: 3, scope: !483)
!485 = !DILocalVariable(name: "this", arg: 1, scope: !483, file: !13, line: 767, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!486 = !DILocation(line: 768, column: 5, scope: !483)
!487 = !DILocation(line: 768, column: 18, scope: !483)
!488 = !DILocation(line: 768, column: 24, scope: !483)
!489 = !DILocalVariable(name: "used", scope: !483, file: !13, line: 768, type: !4)
!490 = !DILocation(line: 769, column: 5, scope: !483)
!491 = !DILocation(line: 769, column: 21, scope: !483)
!492 = !DILocation(line: 769, column: 34, scope: !483)
!493 = !DILocalVariable(name: "walking", scope: !483, file: !13, line: 769, type: !328)
!494 = !DILocation(line: 770, column: 5, scope: !483)
!495 = !DILocation(line: 770, column: 19, scope: !483)
!496 = !DILocation(line: 770, column: 32, scope: !483)
!497 = !DILocation(line: 770, column: 44, scope: !483)
!498 = !DILocation(line: 770, column: 54, scope: !483)
!499 = !DILocation(line: 770, column: 61, scope: !483)
!500 = !DILocation(line: 770, column: 72, scope: !483)
!501 = !DILocalVariable(name: "slots", scope: !483, file: !13, line: 770, type: !23)
!502 = !DILocation(line: 771, column: 5, scope: !483)
!503 = !DILocation(line: 771, column: 9, scope: !483)
!504 = !DILocation(line: 771, column: 10, scope: !483)
!505 = !DILocation(line: 771, column: 21, scope: !483)
!506 = !DILocation(line: 771, column: 33, scope: !483)
!507 = !DILocation(line: 771, column: 39, scope: !483)
!508 = !DILocation(line: 772, column: 7, scope: !483)
!509 = !DILocation(line: 772, column: 22, scope: !483)
!510 = !DILocation(line: 772, column: 38, scope: !483)
!511 = !DILocation(line: 773, column: 7, scope: !483)
!512 = !DILocation(line: 773, column: 21, scope: !483)
!513 = !DILocation(line: 775, column: 5, scope: !483)
!514 = !DILocation(line: 775, column: 18, scope: !483)
!515 = !DILocation(line: 776, column: 5, scope: !483)
!516 = !DILocation(line: 776, column: 17, scope: !483)
!517 = !DILocation(line: 776, column: 23, scope: !483)
!518 = !DILocation(line: 776, column: 39, scope: !483)
!519 = !DILocation(line: 777, column: 5, scope: !483)
!520 = !DILocation(line: 777, column: 12, scope: !483)
!521 = !DILocation(line: 777, column: 19, scope: !483)
!522 = !{!16, !23, !4, !23, !33, !4}
!523 = !DISubroutineType(types: !522)
!524 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 113, type: !523, scopeLine: 113, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!525 = !DILocation(line: 113, column: 1, scope: !524)
!526 = !DILocalVariable(name: "slots", arg: 1, scope: !524, file: !13, line: 113, type: !23)
!527 = !DILocalVariable(name: "mask", arg: 2, scope: !524, file: !13, line: 113, type: !4)
!528 = !DILocalVariable(name: "hashes", arg: 3, scope: !524, file: !13, line: 113, type: !23)
!529 = !DILocalVariable(name: "keys", arg: 4, scope: !524, file: !13, line: 113, type: !33)
!530 = !DILocalVariable(name: "key", arg: 5, scope: !524, file: !13, line: 113, type: !4)
!531 = !DILocation(line: 114, column: 3, scope: !524)
!532 = !DILocation(line: 114, column: 13, scope: !524)
!533 = !DILocation(line: 114, column: 21, scope: !524)
!534 = !DILocalVariable(name: "h", scope: !524, file: !13, line: 114, type: !19)
!535 = !DILocation(line: 115, column: 3, scope: !524)
!536 = !DILocation(line: 115, column: 15, scope: !524)
!537 = !DILocation(line: 115, column: 21, scope: !524)
!538 = !DILocalVariable(name: "low", scope: !524, file: !13, line: 115, type: !19)
!539 = !DILocation(line: 116, column: 3, scope: !524)
!540 = !DILocation(line: 116, column: 23, scope: !524)
!541 = !DILocation(line: 116, column: 27, scope: !524)
!542 = !DILocation(line: 116, column: 28, scope: !524)
!543 = !DILocalVariable(name: "fingerprint", scope: !524, file: !13, line: 116, type: !19)
!544 = !DILocation(line: 117, column: 3, scope: !524)
!545 = !DILocation(line: 117, column: 16, scope: !524)
!546 = !DILocation(line: 117, column: 22, scope: !524)
!547 = !DILocation(line: 117, column: 33, scope: !524)
!548 = !DILocation(line: 117, column: 36, scope: !524)
!549 = !DILocalVariable(name: "bucket", scope: !524, file: !13, line: 117, type: !19)
!550 = !DILocation(line: 124, column: 3, scope: !524)
!551 = !DILocation(line: 124, column: 11, scope: !524)
!552 = !DILocation(line: 124, column: 17, scope: !524)
!553 = !DILocalVariable(name: "b", scope: !524, file: !13, line: 124, type: !4)
!554 = !DILocation(line: 125, column: 3, scope: !524)
!555 = !DILocation(line: 125, column: 30, scope: !524)
!556 = !DILocation(line: 134, column: 20, scope: !524)
!557 = !DILocation(line: 136, column: 20, scope: !524)
!558 = !DILocation(line: 125, column: 10, scope: !524)
!559 = !DILocation(line: 125, column: 15, scope: !524)
!560 = !DILocation(line: 125, column: 20, scope: !524)
!561 = !DILocation(line: 125, column: 24, scope: !524)
!562 = !DILocation(line: 125, column: 45, scope: !524)
!563 = !DILocation(line: 126, column: 5, scope: !524)
!564 = !DILocation(line: 126, column: 18, scope: !524)
!565 = !DILocation(line: 126, column: 24, scope: !524)
!566 = !DILocalVariable(name: "word", scope: !524, file: !13, line: 126, type: !19)
!567 = !DILocation(line: 127, column: 5, scope: !524)
!568 = !DILocation(line: 127, column: 9, scope: !524)
!569 = !DILocation(line: 127, column: 18, scope: !524)
!570 = !DILocation(line: 127, column: 21, scope: !524)
!571 = !DILocation(line: 128, column: 7, scope: !524)
!572 = !DILocation(line: 128, column: 14, scope: !524)
!573 = !DILocation(line: 128, column: 23, scope: !524)
!574 = !DILocation(line: 128, column: 26, scope: !524)
!575 = !DILocation(line: 130, column: 5, scope: !524)
!576 = !DILocation(line: 130, column: 9, scope: !524)
!577 = !DILocation(line: 130, column: 10, scope: !524)
!578 = !DILocation(line: 130, column: 17, scope: !524)
!579 = !DILocation(line: 130, column: 18, scope: !524)
!580 = !DILocation(line: 130, column: 27, scope: !524)
!581 = !DILocation(line: 130, column: 40, scope: !524)
!582 = !DILocation(line: 131, column: 7, scope: !524)
!583 = !DILocation(line: 131, column: 18, scope: !524)
!584 = !DILocation(line: 131, column: 24, scope: !524)
!585 = !DILocation(line: 131, column: 25, scope: !524)
!586 = !DILocation(line: 131, column: 32, scope: !524)
!587 = !DILocation(line: 131, column: 39, scope: !524)
!588 = !DILocalVariable(name: "at", scope: !524, file: !13, line: 131, type: !4)
!589 = !DILocation(line: 132, column: 7, scope: !524)
!590 = !DILocation(line: 133, column: 9, scope: !524)
!591 = !DILocation(line: 133, column: 15, scope: !524)
!592 = !DILocation(line: 134, column: 9, scope: !524)
!593 = !DILocation(line: 134, column: 14, scope: !524)
!594 = !DILocation(line: 135, column: 9, scope: !524)
!595 = !DILocation(line: 135, column: 16, scope: !524)
!596 = !DILocation(line: 135, column: 24, scope: !524)
!597 = !DILocation(line: 136, column: 9, scope: !524)
!598 = !DILocation(line: 136, column: 14, scope: !524)
!599 = !DILocation(line: 137, column: 9, scope: !524)
!600 = !DILocation(line: 137, column: 17, scope: !524)
!601 = !DILocation(line: 137, column: 22, scope: !524)
!602 = !DILocation(line: 137, column: 27, scope: !524)
!603 = !DILocation(line: 138, column: 9, scope: !524)
!604 = !DILocation(line: 139, column: 9, scope: !524)
!605 = !DILocation(line: 139, column: 16, scope: !524)
!606 = !DILocation(line: 139, column: 24, scope: !524)
!607 = !DILocation(line: 139, column: 27, scope: !524)
!608 = !DILocation(line: 142, column: 5, scope: !524)
!609 = !DILocation(line: 142, column: 14, scope: !524)
!610 = !DILocation(line: 142, column: 15, scope: !524)
!611 = !DILocation(line: 142, column: 24, scope: !524)
!612 = !DILocation(line: 142, column: 29, scope: !524)
!613 = !DILocation(line: 143, column: 5, scope: !524)
!614 = !DILocation(line: 143, column: 9, scope: !524)
!615 = !DILocation(line: 143, column: 15, scope: !524)
!616 = !DILocation(line: 145, column: 3, scope: !524)
!617 = !DILocation(line: 145, column: 10, scope: !524)
!618 = !DILocation(line: 145, column: 19, scope: !524)
!619 = !DILocation(line: 145, column: 25, scope: !524)
!620 = !DILocation(line: 145, column: 40, scope: !524)
!621 = !{null, !33, !23}
!622 = !DISubroutineType(types: !621)
!623 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 170, type: !622, scopeLine: 170, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!624 = !DILocation(line: 170, column: 1, scope: !623)
!625 = !DILocalVariable(name: "items", arg: 1, scope: !623, file: !13, line: 170, type: !33)
!626 = !DILocalVariable(name: "hashes", arg: 2, scope: !623, file: !13, line: 170, type: !23)
!627 = !DILocation(line: 171, column: 3, scope: !623)
!628 = !DILocation(line: 171, column: 16, scope: !623)
!629 = !DILocation(line: 171, column: 22, scope: !623)
!630 = !DILocalVariable(name: "used", scope: !623, file: !13, line: 171, type: !4)
!631 = !DILocation(line: 172, column: 3, scope: !623)
!632 = !DILocation(line: 172, column: 17, scope: !623)
!633 = !DILocalVariable(name: "to", scope: !623, file: !13, line: 172, type: !4)
!634 = !DILocation(line: 173, column: 3, scope: !623)
!635 = !DILocation(line: 173, column: 24, scope: !623)
!636 = !DILocalVariable(name: "from", scope: !623, file: !13, line: 173, type: !4)
!637 = !DILocation(line: 173, column: 55, scope: !623)
!638 = !DILocation(line: 174, column: 68, scope: !623)
!639 = !DILocation(line: 173, column: 27, scope: !623)
!640 = !DILocation(line: 173, column: 34, scope: !623)
!641 = !DILocation(line: 173, column: 42, scope: !623)
!642 = !DILocation(line: 173, column: 49, scope: !623)
!643 = !DILocation(line: 173, column: 79, scope: !623)
!644 = !DILocation(line: 174, column: 5, scope: !623)
!645 = !DILocation(line: 174, column: 9, scope: !623)
!646 = !DILocation(line: 174, column: 16, scope: !623)
!647 = !DILocation(line: 174, column: 26, scope: !623)
!648 = !DILocation(line: 174, column: 31, scope: !623)
!649 = !DILocation(line: 174, column: 37, scope: !623)
!650 = !DILocation(line: 174, column: 42, scope: !623)
!651 = !DILocation(line: 174, column: 47, scope: !623)
!652 = !DILocation(line: 174, column: 55, scope: !623)
!653 = !DILocation(line: 174, column: 62, scope: !623)
!654 = !DILocation(line: 174, column: 83, scope: !623)
!655 = !DILocation(line: 175, column: 7, scope: !623)
!656 = !DILocation(line: 175, column: 13, scope: !623)
!657 = !DILocation(line: 175, column: 19, scope: !623)
!658 = !DILocation(line: 175, column: 25, scope: !623)
!659 = !DILocation(line: 176, column: 7, scope: !623)
!660 = !DILocation(line: 173, column: 71, scope: !623)
!661 = !DILocation(line: 179, column: 3, scope: !623)
!662 = !DILocation(line: 179, column: 10, scope: !623)
!663 = !DILocation(line: 179, column: 16, scope: !623)
!664 = !DILocation(line: 179, column: 32, scope: !623)
!665 = !DILocation(line: 179, column: 38, scope: !623)
!666 = !DILocation(line: 179, column: 53, scope: !623)
!667 = !DILocation(line: 179, column: 56, scope: !623)
!668 = !DILocation(line: 180, column: 5, scope: !623)
!669 = !{i32 8, !"cf-protection-branch", i32 1}
!670 = !{i32 8, !"cf-protection-return", i32 1}
!671 = !{i32 8, !"branch-target-enforcement", i32 1}
!672 = !{i32 8, !"sign-return-address", i32 1}
!673 = !{i32 4, !"probe-stack", !"inline-asm"}
