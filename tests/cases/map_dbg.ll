%struct.Set$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array* }
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
  %0 = call i8* @nish_alloc_struct(i64 40), !dbg !10
  %1 = bitcast i8* %0 to %struct.Set$i32*, !dbg !10
  call void @nish.Set$i32.constructor(%struct.Set$i32* %1), !dbg !10
  store %struct.Set$i32* %1, %struct.Set$i32** %s.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Set$i32** %s.addr, metadata !37, metadata !DIExpression()), !dbg !9
  %2 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !38
  %3 = call %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* %2, i32 3), !dbg !38
  %4 = call %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* %3, i32 4), !dbg !38
  %5 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !43
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %5, i32 0, i32 0, !dbg !43
  %7 = load i32, i32* %6, align 4, !tbaa !49, !dbg !43
  %8 = call i8* @nish_str_from_i32(i32 %7), !dbg !42
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !42
  %10 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8, !dbg !50
  %11 = call i1 @nish.Set$i32.has(%struct.Set$i32* %10, i32 3), !dbg !50
  %12 = select i1 %11, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), !dbg !42
  %13 = call i8* @nish_str_concat(i8* %9, i8* %12), !dbg !42
  call void @nish_print(i8* %13), !dbg !41
  call void @nish_arena_release(i64 %arena.mark), !dbg !52
  ret i32 0, !dbg !52
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !54 {
entry:
  %0 = call i32 @nish_main(), !dbg !55
  call void @nish_free_arena(), !dbg !55
  ret i32 %0, !dbg !55
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 !dbg !58 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !60, metadata !DIExpression()), !dbg !59
  call void @llvm.dbg.value(metadata i32 %mask, metadata !61, metadata !DIExpression()), !dbg !59
  %0 = lshr i32 %h, 16, !dbg !65
  %1 = xor i32 %h, %0, !dbg !63
  %2 = and i32 %1, %mask, !dbg !62
  ret i32 %2, !dbg !59
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 !dbg !69 {
entry:
  call void @llvm.dbg.value(metadata i32 %h, metadata !71, metadata !DIExpression()), !dbg !70
  call void @llvm.dbg.value(metadata i32 %index, metadata !72, metadata !DIExpression()), !dbg !70
  %0 = lshr i32 %h, 24, !dbg !75
  %1 = shl i32 %0, 24, !dbg !74
  %2 = add nsw i32 %index, 1, !dbg !77
  %3 = or i32 %1, %2, !dbg !73
  ret i32 %3, !dbg !70
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 !dbg !81 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !83, metadata !DIExpression()), !dbg !82
  call void @llvm.dbg.value(metadata i32 %index, metadata !84, metadata !DIExpression()), !dbg !82
  %0 = sext i32 %bucket to i64, !dbg !86
  %1 = shl i64 %0, 32, !dbg !86
  %2 = sext i32 %index to i64, !dbg !88
  %3 = or i64 %1, %2, !dbg !85
  ret i64 %3, !dbg !82
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 !dbg !92 {
entry:
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !94, metadata !DIExpression()), !dbg !93
  call void @llvm.dbg.value(metadata i32 %h, metadata !95, metadata !DIExpression()), !dbg !93
  %0 = sub nsw i32 0, 1, !dbg !97
  %1 = sext i32 %0 to i64, !dbg !96
  %2 = sext i32 %bucket to i64, !dbg !101
  %3 = shl i64 %2, 32, !dbg !101
  %4 = zext i32 %h to i64, !dbg !103
  %5 = or i64 %3, %4, !dbg !100
  %6 = sub nsw i64 %1, %5, !dbg !96
  ret i64 %6, !dbg !93
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 !dbg !107 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !109, metadata !DIExpression()), !dbg !108
  call void @llvm.dbg.value(metadata i32 %mask, metadata !110, metadata !DIExpression()), !dbg !108
  call void @llvm.dbg.value(metadata i32 %h, metadata !111, metadata !DIExpression()), !dbg !108
  call void @llvm.dbg.value(metadata i32 %index, metadata !112, metadata !DIExpression()), !dbg !108
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index), !dbg !114
  store i32 %0, i32* %word.addr, align 4, !dbg !113
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !117, metadata !DIExpression()), !dbg !113
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask), !dbg !119
  store i32 %1, i32* %bucket.addr, align 4, !dbg !118
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !122, metadata !DIExpression()), !dbg !118
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !123
  %3 = load i64, i64* %2, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !123
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !123
  %5 = load i8*, i8** %4, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !123
  br label %while.cond, !dbg !123

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4, !dbg !135
  %7 = icmp sge i32 %6, 0, !dbg !135
  br i1 %7, label %land.rhs, label %land.end, !dbg !135

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4, !dbg !137
  %9 = trunc i64 %3 to i32, !dbg !124
  %10 = icmp slt i32 %8, %9, !dbg !137
  br label %land.end, !dbg !135

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ], !dbg !135
  br i1 %11, label %while.body, label %while.end, !dbg !123

while.body:
  %12 = load i32, i32* %bucket.addr, align 4, !dbg !142
  %13 = sext i32 %12 to i64, !dbg !141
  %14 = bitcast i8* %5 to i32*, !dbg !141
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !141
  %16 = load i32, i32* %15, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !141
  %17 = icmp eq i32 %16, 0, !dbg !141
  br i1 %17, label %if.then, label %if.end, !dbg !140

if.then:
  %18 = load i32, i32* %bucket.addr, align 4, !dbg !148
  %19 = sext i32 %18 to i64, !dbg !147
  %20 = load i32, i32* %word.addr, align 4, !dbg !149
  %21 = bitcast i8* %5 to i32*, !dbg !147
  %22 = getelementptr inbounds i32, i32* %21, i64 %19, !dbg !147
  store i32 %20, i32* %22, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !147
  ret void, !dbg !150

if.end:
  %23 = load i32, i32* %bucket.addr, align 4, !dbg !153
  %24 = add nsw i32 %23, 1, !dbg !153
  %25 = and i32 %24, %mask, !dbg !152
  store i32 %25, i32* %bucket.addr, align 4, !dbg !151
  br label %while.cond, !dbg !123

while.end:
  ret void, !dbg !108
}

define internal noundef i32 @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !158 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !160, metadata !DIExpression()), !dbg !159
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !163
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !163
  %2 = trunc i64 %1 to i32, !dbg !163
  store i32 %2, i32* %used.addr, align 4, !dbg !161
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !164, metadata !DIExpression()), !dbg !161
  store i32 0, i32* %to.addr, align 4, !dbg !165
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !167, metadata !DIExpression()), !dbg !165
  store i32 0, i32* %from.addr, align 4, !dbg !168
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !170, metadata !DIExpression()), !dbg !168
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !168
  %4 = load i8*, i8** %3, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !168
  br label %for.cond, !dbg !168

for.cond:
  %5 = load i32, i32* %from.addr, align 4, !dbg !172
  %6 = load i32, i32* %used.addr, align 4, !dbg !173
  %7 = icmp slt i32 %5, %6, !dbg !172
  br i1 %7, label %for.body, label %for.end, !dbg !168

for.body:
  %8 = load i32, i32* %from.addr, align 4, !dbg !176
  %9 = sext i32 %8 to i64, !dbg !171
  %10 = bitcast i8* %4 to i32*, !dbg !171
  %11 = getelementptr inbounds i32, i32* %10, i64 %9, !dbg !171
  %12 = load i32, i32* %11, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !171
  store i32 %12, i32* %h.addr, align 4, !dbg !175
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !177, metadata !DIExpression()), !dbg !175
  %13 = load i32, i32* %h.addr, align 4, !dbg !179
  %14 = icmp ne i32 %13, 0, !dbg !179
  br i1 %14, label %land.rhs.1, label %land.end.1, !dbg !179

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4, !dbg !181
  %16 = icmp sge i32 %15, 0, !dbg !181
  br label %land.end.1, !dbg !179

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ], !dbg !179
  br i1 %17, label %land.rhs, label %land.end, !dbg !179

land.rhs:
  %18 = load i32, i32* %to.addr, align 4, !dbg !183
  %19 = load i32, i32* %used.addr, align 4, !dbg !184
  %20 = icmp slt i32 %18, %19, !dbg !183
  br label %land.end, !dbg !179

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ], !dbg !179
  br i1 %21, label %if.then, label %if.end, !dbg !178

if.then:
  %22 = load i32, i32* %to.addr, align 4, !dbg !187
  %23 = sext i32 %22 to i64, !dbg !186
  %24 = load i32, i32* %h.addr, align 4, !dbg !188
  %25 = bitcast i8* %4 to i32*, !dbg !186
  %26 = getelementptr inbounds i32, i32* %25, i64 %23, !dbg !186
  store i32 %24, i32* %26, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !186
  %27 = load i32, i32* %to.addr, align 4, !dbg !189
  %28 = add nsw i32 %27, 1, !dbg !189
  store i32 %28, i32* %to.addr, align 4, !dbg !189
  br label %if.end, !dbg !178

if.end:
  br label %for.inc, !dbg !168

for.inc:
  %29 = load i32, i32* %from.addr, align 4, !dbg !190
  %30 = add nsw i32 %29, 1, !dbg !190
  store i32 %30, i32* %from.addr, align 4, !dbg !190
  br label %for.cond, !dbg !168

for.end:
  br label %while.cond, !dbg !191

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !193
  %32 = load i64, i64* %31, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !193
  %33 = trunc i64 %32 to i32, !dbg !193
  %34 = load i32, i32* %to.addr, align 4, !dbg !194
  %35 = icmp sgt i32 %33, %34, !dbg !192
  br i1 %35, label %while.body, label %while.end, !dbg !191

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !196
  %37 = load i64, i64* %36, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !196
  %38 = icmp eq i64 %37, 0, !dbg !196
  br i1 %38, label %pop.empty, label %pop.ok, !dbg !196

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !196
  unreachable, !dbg !196

pop.ok:
  %39 = sub i64 %37, 1, !dbg !196
  store i64 %39, i64* %36, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !196
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !196
  %41 = load i8*, i8** %40, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !196
  %42 = bitcast i8* %41 to i32*, !dbg !196
  %43 = getelementptr inbounds i32, i32* %42, i64 %39, !dbg !196
  %44 = load i32, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !196
  br label %while.cond, !dbg !191

while.end:
  %45 = load i32, i32* %to.addr, align 4, !dbg !198
  ret i32 %45, !dbg !197
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !201 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !203, metadata !DIExpression()), !dbg !202
  call void @llvm.dbg.value(metadata i32 %live, metadata !204, metadata !DIExpression()), !dbg !202
  call void @llvm.dbg.value(metadata i32 %used, metadata !205, metadata !DIExpression()), !dbg !202
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !208
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !208
  %2 = trunc i64 %1 to i32, !dbg !208
  store i32 %2, i32* %n.addr, align 4, !dbg !206
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !209, metadata !DIExpression()), !dbg !206
  %3 = mul nsw i32 %live, 2, !dbg !211
  %4 = icmp slt i32 %3, %used, !dbg !211
  br i1 %4, label %if.then, label %if.end, !dbg !210

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !215
  ret %struct.nish_array* %slots, !dbg !217

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !221
  %6 = mul nsw i32 %5, 2, !dbg !221
  %7 = sext i32 %6 to i64, !dbg !220
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !220
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !220
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !220
  store i64 %7, i64* %10, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !220
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !220
  store i64 %7, i64* %11, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !220
  %12 = mul i64 %7, 4, !dbg !220
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !220
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !129, !noalias !128, !dbg !220
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !220
  store i8* %13, i8** %14, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !220
  ret %struct.nish_array* %9, !dbg !219
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !226 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !228, metadata !DIExpression()), !dbg !227
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !229, metadata !DIExpression()), !dbg !227
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !232
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !232
  %2 = trunc i64 %1 to i32, !dbg !232
  %3 = sub nsw i32 %2, 1, !dbg !231
  store i32 %3, i32* %mask.addr, align 4, !dbg !230
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !234, metadata !DIExpression()), !dbg !230
  store i32 0, i32* %i.addr, align 4, !dbg !235
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !237, metadata !DIExpression()), !dbg !235
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !235
  %5 = load i64, i64* %4, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !235
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !235
  %7 = load i8*, i8** %6, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !235
  br label %for.cond, !dbg !235

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !239
  %9 = trunc i64 %5 to i32, !dbg !238
  %10 = icmp slt i32 %8, %9, !dbg !239
  br i1 %10, label %for.body, label %for.end, !dbg !235

for.body:
  %11 = load i32, i32* %mask.addr, align 4, !dbg !244
  %12 = load i32, i32* %i.addr, align 4, !dbg !246
  %13 = sext i32 %12 to i64, !dbg !245
  %14 = bitcast i8* %7 to i32*, !dbg !245
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !245
  %16 = load i32, i32* %15, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !245
  %17 = load i32, i32* %i.addr, align 4, !dbg !247
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %11, i32 %16, i32 %17), !dbg !242
  br label %for.inc, !dbg !235

for.inc:
  %18 = load i32, i32* %i.addr, align 4, !dbg !248
  %19 = add nsw i32 %18, 1, !dbg !248
  store i32 %19, i32* %i.addr, align 4, !dbg !248
  br label %for.cond, !dbg !235

for.end:
  ret void, !dbg !227
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !251 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !253, metadata !DIExpression()), !dbg !252
  store i32 0, i32* %i.addr, align 4, !dbg !254
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !256, metadata !DIExpression()), !dbg !254
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !254
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !254
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !254
  %3 = load i8*, i8** %2, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !254
  br label %for.cond, !dbg !254

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !258
  %5 = trunc i64 %1 to i32, !dbg !257
  %6 = icmp slt i32 %4, %5, !dbg !258
  br i1 %6, label %for.body, label %for.end, !dbg !254

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !262
  %8 = sext i32 %7 to i64, !dbg !261
  %9 = bitcast i8* %3 to i32*, !dbg !261
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !261
  store i32 0, i32* %10, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !261
  br label %for.inc, !dbg !254

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !264
  %12 = add nsw i32 %11, 1, !dbg !264
  store i32 %12, i32* %i.addr, align 4, !dbg !264
  br label %for.cond, !dbg !254

for.end:
  ret void, !dbg !252
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !267 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !269, metadata !DIExpression()), !dbg !268
  call void @llvm.dbg.value(metadata i32 %mask, metadata !270, metadata !DIExpression()), !dbg !268
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !271, metadata !DIExpression()), !dbg !268
  call void @llvm.dbg.value(metadata i32 %h, metadata !272, metadata !DIExpression()), !dbg !268
  call void @llvm.dbg.value(metadata i32 %used, metadata !273, metadata !DIExpression()), !dbg !268
  %0 = icmp sge i32 %bucket, 0, !dbg !275
  br i1 %0, label %land.rhs, label %land.end, !dbg !275

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !279
  %2 = load i64, i64* %1, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !279
  %3 = trunc i64 %2 to i32, !dbg !279
  %4 = icmp slt i32 %bucket, %3, !dbg !277
  br label %land.end, !dbg !275

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !275
  br i1 %5, label %if.then, label %if.else, !dbg !274

if.then:
  %6 = sext i32 %bucket to i64, !dbg !281
  %7 = sub nsw i32 %used, 1, !dbg !285
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !283
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !281
  %10 = load i64, i64* %9, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !281
  %11 = icmp ult i64 %6, %10, !dbg !281
  br i1 %11, label %bounds.ok, label %bounds.fail, !dbg !281

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %10), !dbg !281
  unreachable, !dbg !281

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !281
  %13 = load i8*, i8** %12, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !281
  %14 = bitcast i8* %13 to i32*, !dbg !281
  %15 = getelementptr inbounds i32, i32* %14, i64 %6, !dbg !281
  store i32 %8, i32* %15, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !281
  br label %if.end, !dbg !274

if.else:
  %16 = sub nsw i32 %used, 1, !dbg !292
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16), !dbg !288
  br label %if.end, !dbg !274

if.end:
  ret void, !dbg !268
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #2 !dbg !296 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !298, metadata !DIExpression()), !dbg !297
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !297
  store i32 0, i32* %0, align 4, !tbaa !49, !dbg !297
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !297
  store i32 7, i32* %1, align 4, !tbaa !299, !dbg !297
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !297
  store i32 0, i32* %2, align 4, !tbaa !300, !dbg !297
  %3 = sext i32 8 to i64, !dbg !302
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !302
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !302
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !302
  store i64 %3, i64* %6, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !302
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !302
  store i64 %3, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !302
  %8 = mul i64 %3, 4, !dbg !302
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !302
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !129, !noalias !128, !dbg !302
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !302
  store i8* %9, i8** %10, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !302
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !301
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !304, !dbg !301
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !306
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !306
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !306
  store i64 0, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !306
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !306
  store i64 0, i64* %15, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !306
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !306
  store i8* null, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !306
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !305
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !307, !dbg !305
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !309
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !309
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !309
  store i64 0, i64* %20, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !309
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !309
  store i64 0, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !309
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !309
  store i8* null, i8** %22, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !309
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !308
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !310, !dbg !308
  ret void, !dbg !297
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !313 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !315, metadata !DIExpression()), !dbg !314
  call void @llvm.dbg.value(metadata i32 %key, metadata !316, metadata !DIExpression()), !dbg !314
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !319
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !304, !dbg !319
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !320
  %3 = load i32, i32* %2, align 4, !tbaa !299, !dbg !320
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !321
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !310, !dbg !321
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !322
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !307, !dbg !322
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !318
  ret i64 %8, !dbg !317
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !327 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !329, metadata !DIExpression()), !dbg !328
  call void @llvm.dbg.value(metadata i32 %key, metadata !330, metadata !DIExpression()), !dbg !328
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !332
  %1 = icmp sge i64 %0, 0, !dbg !332
  ret i1 %1, !dbg !331
}

define internal noundef nonnull align 8 dereferenceable(40) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) %this, i32 noundef %key) #0 !dbg !337 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !339, metadata !DIExpression()), !dbg !338
  call void @llvm.dbg.value(metadata i32 %key, metadata !340, metadata !DIExpression()), !dbg !338
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !342
  store i64 %0, i64* %found.addr, align 8, !dbg !341
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !344, metadata !DIExpression()), !dbg !341
  %1 = load i64, i64* %found.addr, align 8, !dbg !346
  %2 = icmp slt i64 %1, 0, !dbg !346
  br i1 %2, label %if.then, label %if.end, !dbg !345

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !350
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !349
  br label %if.end, !dbg !345

if.end:
  ret %struct.Set$i32* %this, !dbg !352
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !356 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !358, metadata !DIExpression()), !dbg !357
  call void @llvm.dbg.value(metadata i64 %absent, metadata !359, metadata !DIExpression()), !dbg !357
  call void @llvm.dbg.value(metadata i32 %key, metadata !360, metadata !DIExpression()), !dbg !357
  %0 = sub nsw i64 0, 1, !dbg !362
  %1 = sub nsw i64 %0, %absent, !dbg !362
  store i64 %1, i64* %packed.addr, align 8, !dbg !361
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !365, metadata !DIExpression()), !dbg !361
  %2 = load i64, i64* %packed.addr, align 8, !dbg !368
  %3 = ashr i64 %2, 32, !dbg !368
  %4 = trunc i64 %3 to i32, !dbg !367
  store i32 %4, i32* %bucket.addr, align 4, !dbg !366
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !369, metadata !DIExpression()), !dbg !366
  %5 = load i64, i64* %packed.addr, align 8, !dbg !372
  %6 = trunc i64 %5 to i32, !dbg !371
  store i32 %6, i32* %h.addr, align 4, !dbg !370
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !373, metadata !DIExpression()), !dbg !370
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !376
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !307, !dbg !376
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !376
  %10 = load i64, i64* %9, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !376
  %11 = trunc i64 %10 to i32, !dbg !376
  %12 = icmp sge i32 %11, 16777215, !dbg !375
  br i1 %12, label %if.then, label %if.end, !dbg !374

if.then:
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !380
  %14 = load i32, i32* %13, align 4, !tbaa !300, !dbg !380
  %15 = icmp sge i32 %14, 16777215, !dbg !380
  br i1 %15, label %if.then.1, label %if.end.1, !dbg !379

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !383
  call void @nish_exit(i32 1), !dbg !383
  unreachable, !dbg !383

if.end.1:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !385
  %16 = sub nsw i32 0, 1, !dbg !387
  store i32 %16, i32* %bucket.addr, align 4, !dbg !386
  br label %if.end, !dbg !374

if.end:
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !389
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !307, !dbg !389
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0, !dbg !389
  %20 = load i64, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !389
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1, !dbg !389
  %22 = load i64, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !389
  %23 = icmp eq i64 %20, %22, !dbg !389
  br i1 %23, label %push.grow, label %push.store, !dbg !389

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4), !dbg !389
  br label %push.store, !dbg !389

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2, !dbg !389
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !389
  %26 = bitcast i8* %25 to i32*, !dbg !389
  %27 = getelementptr inbounds i32, i32* %26, i64 %20, !dbg !389
  store i32 %key, i32* %27, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !389
  %28 = add i64 %20, 1, !dbg !389
  store i64 %28, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !389
  %29 = trunc i64 %28 to i32, !dbg !389
  %30 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !391
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !310, !dbg !391
  %32 = load i32, i32* %h.addr, align 4, !dbg !392
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0, !dbg !391
  %34 = load i64, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !391
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1, !dbg !391
  %36 = load i64, i64* %35, align 8, !alias.scope !128, !noalias !129, !tbaa !223, !dbg !391
  %37 = icmp eq i64 %34, %36, !dbg !391
  br i1 %37, label %push.grow.1, label %push.store.1, !dbg !391

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4), !dbg !391
  br label %push.store.1, !dbg !391

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2, !dbg !391
  %39 = load i8*, i8** %38, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !391
  %40 = bitcast i8* %39 to i32*, !dbg !391
  %41 = getelementptr inbounds i32, i32* %40, i64 %34, !dbg !391
  store i32 %32, i32* %41, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !391
  %42 = add i64 %34, 1, !dbg !391
  store i64 %42, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !391
  %43 = trunc i64 %42 to i32, !dbg !391
  %44 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !394
  %45 = load i32, i32* %44, align 4, !tbaa !300, !dbg !394
  %46 = add nsw i32 %45, 1, !dbg !394
  %47 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !393
  store i32 %46, i32* %47, align 4, !tbaa !300, !dbg !393
  %48 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !397
  %49 = load i32, i32* %48, align 4, !tbaa !49, !dbg !397
  %50 = add nsw i32 %49, 1, !dbg !397
  %51 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !396
  store i32 %50, i32* %51, align 4, !tbaa !49, !dbg !396
  %52 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !401
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !307, !dbg !401
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0, !dbg !401
  %55 = load i64, i64* %54, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !401
  %56 = trunc i64 %55 to i32, !dbg !401
  store i32 %56, i32* %used.addr, align 4, !dbg !399
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !402, metadata !DIExpression()), !dbg !399
  %57 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !404
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !304, !dbg !404
  %59 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !405
  %60 = load i32, i32* %59, align 4, !tbaa !299, !dbg !405
  %61 = load i32, i32* %bucket.addr, align 4, !dbg !406
  %62 = load i32, i32* %h.addr, align 4, !dbg !407
  %63 = load i32, i32* %used.addr, align 4, !dbg !408
  call void @nish.fileAppended(%struct.nish_array* %58, i32 %60, i32 %61, i32 %62, i32 %63), !dbg !403
  %64 = load i32, i32* %used.addr, align 4, !dbg !410
  %65 = mul nsw i32 %64, 4, !dbg !410
  %66 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !413
  %67 = load %struct.nish_array*, %struct.nish_array** %66, align 8, !tbaa !304, !dbg !413
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0, !dbg !413
  %69 = load i64, i64* %68, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !413
  %70 = trunc i64 %69 to i32, !dbg !413
  %71 = mul nsw i32 %70, 3, !dbg !412
  %72 = icmp sgt i32 %65, %71, !dbg !410
  br i1 %72, label %if.then.2, label %if.end.2, !dbg !409

if.then.2:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !416
  br label %if.end.2, !dbg !409

if.end.2:
  ret void, !dbg !357
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this) #0 !dbg !417 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !419, metadata !DIExpression()), !dbg !418
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !422
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !307, !dbg !422
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !422
  %3 = load i64, i64* %2, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !422
  %4 = trunc i64 %3 to i32, !dbg !422
  store i32 %4, i32* %used.addr, align 4, !dbg !420
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !423, metadata !DIExpression()), !dbg !420
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !426
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !304, !dbg !426
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !427
  %8 = load i32, i32* %7, align 4, !tbaa !300, !dbg !427
  %9 = load i32, i32* %used.addr, align 4, !dbg !428
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9), !dbg !425
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8, !dbg !424
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !429, metadata !DIExpression()), !dbg !424
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !431
  %12 = load i32, i32* %11, align 4, !tbaa !300, !dbg !431
  %13 = load i32, i32* %used.addr, align 4, !dbg !432
  %14 = icmp slt i32 %12, %13, !dbg !431
  br i1 %14, label %if.then, label %if.end, !dbg !430

if.then:
  %15 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !435
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !307, !dbg !435
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !436
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !310, !dbg !436
  call void @nish.compactEntries$i32(%struct.nish_array* %16, %struct.nish_array* %18), !dbg !434
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !438
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !310, !dbg !438
  %21 = call i32 @nish.compactHashes(%struct.nish_array* %20), !dbg !437
  br label %if.end, !dbg !430

if.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !440
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !439
  store %struct.nish_array* %22, %struct.nish_array** %23, align 8, !tbaa !304, !dbg !439
  %24 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !443
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0, !dbg !443
  %26 = load i64, i64* %25, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !443
  %27 = trunc i64 %26 to i32, !dbg !443
  %28 = sub nsw i32 %27, 1, !dbg !442
  %29 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !441
  store i32 %28, i32* %29, align 4, !tbaa !299, !dbg !441
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !446
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !447
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !310, !dbg !447
  call void @nish.refile(%struct.nish_array* %30, %struct.nish_array* %32), !dbg !445
  ret void, !dbg !418
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !450 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !452, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata i32 %mask, metadata !453, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !454, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !455, metadata !DIExpression()), !dbg !451
  call void @llvm.dbg.value(metadata i32 %key, metadata !456, metadata !DIExpression()), !dbg !451
  %0 = lshr i32 %key, 16, !dbg !458
  %1 = xor i32 %key, %0, !dbg !458
  %2 = mul i32 %1, -2048144789, !dbg !458
  %3 = lshr i32 %2, 13, !dbg !458
  %4 = xor i32 %2, %3, !dbg !458
  %5 = mul i32 %4, -1028477387, !dbg !458
  %6 = lshr i32 %5, 16, !dbg !458
  %7 = xor i32 %5, %6, !dbg !458
  %8 = icmp eq i32 %7, 0, !dbg !458
  %9 = select i1 %8, i32 1, i32 %7, !dbg !458
  store i32 %9, i32* %h.addr, align 4, !dbg !457
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !460, metadata !DIExpression()), !dbg !457
  %10 = load i32, i32* %h.addr, align 4, !dbg !462
  %11 = lshr i32 %10, 24, !dbg !462
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !461
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !463, metadata !DIExpression()), !dbg !461
  %12 = load i32, i32* %h.addr, align 4, !dbg !466
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !465
  store i32 %13, i32* %bucket.addr, align 4, !dbg !464
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !468, metadata !DIExpression()), !dbg !464
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !469
  %15 = load i64, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !469
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !469
  %17 = load i8*, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !469
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !469
  %19 = load i64, i64* %18, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !469
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !469
  %21 = load i8*, i8** %20, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !469
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !469
  %23 = load i64, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !469
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !469
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !469
  br label %while.cond, !dbg !469

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !473
  %27 = icmp sge i32 %26, 0, !dbg !473
  br i1 %27, label %land.rhs, label %land.end, !dbg !473

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !475
  %29 = trunc i64 %15 to i32, !dbg !470
  %30 = icmp slt i32 %28, %29, !dbg !475
  br label %land.end, !dbg !473

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !473
  br i1 %31, label %while.body, label %while.end, !dbg !469

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !480
  %33 = sext i32 %32 to i64, !dbg !479
  %34 = bitcast i8* %17 to i32*, !dbg !479
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !479
  %36 = load i32, i32* %35, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !479
  store i32 %36, i32* %word.addr, align 4, !dbg !478
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !481, metadata !DIExpression()), !dbg !478
  %37 = load i32, i32* %word.addr, align 4, !dbg !483
  %38 = icmp eq i32 %37, 0, !dbg !483
  br i1 %38, label %if.then, label %if.end, !dbg !482

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !488
  %40 = load i32, i32* %h.addr, align 4, !dbg !489
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !487
  ret i64 %41, !dbg !486

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !491
  %43 = lshr i32 %42, 24, !dbg !491
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !492
  %45 = icmp eq i32 %43, %44, !dbg !491
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !490

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !496
  %47 = and i32 %46, 16777215, !dbg !496
  %48 = sub nsw i32 %47, 1, !dbg !495
  store i32 %48, i32* %at.addr, align 4, !dbg !494
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !499, metadata !DIExpression()), !dbg !494
  %49 = load i32, i32* %at.addr, align 4, !dbg !501
  %50 = icmp sge i32 %49, 0, !dbg !501
  br i1 %50, label %land.rhs.4, label %land.end.4, !dbg !501

land.rhs.4:
  %51 = load i32, i32* %at.addr, align 4, !dbg !503
  %52 = trunc i64 %19 to i32, !dbg !471
  %53 = icmp slt i32 %51, %52, !dbg !503
  br label %land.end.4, !dbg !501

land.end.4:
  %54 = phi i1 [ false, %if.then.1 ], [ %53, %land.rhs.4 ], !dbg !501
  br i1 %54, label %land.rhs.3, label %land.end.3, !dbg !501

land.rhs.3:
  %55 = load i32, i32* %at.addr, align 4, !dbg !506
  %56 = sext i32 %55 to i64, !dbg !505
  %57 = bitcast i8* %21 to i32*, !dbg !505
  %58 = getelementptr inbounds i32, i32* %57, i64 %56, !dbg !505
  %59 = load i32, i32* %58, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !505
  %60 = load i32, i32* %h.addr, align 4, !dbg !507
  %61 = icmp eq i32 %59, %60, !dbg !505
  br label %land.end.3, !dbg !501

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %land.rhs.3 ], !dbg !501
  br i1 %62, label %land.rhs.2, label %land.end.2, !dbg !501

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4, !dbg !508
  %64 = trunc i64 %23 to i32, !dbg !472
  %65 = icmp slt i32 %63, %64, !dbg !508
  br label %land.end.2, !dbg !501

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ], !dbg !501
  br i1 %66, label %land.rhs.1, label %land.end.1, !dbg !501

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4, !dbg !512
  %68 = sext i32 %67 to i64, !dbg !511
  %69 = bitcast i8* %25 to i32*, !dbg !511
  %70 = getelementptr inbounds i32, i32* %69, i64 %68, !dbg !511
  %71 = load i32, i32* %70, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !511
  %72 = icmp eq i32 %71, %key, !dbg !510
  br label %land.end.1, !dbg !501

land.end.1:
  %73 = phi i1 [ false, %land.end.2 ], [ %72, %land.rhs.1 ], !dbg !501
  br i1 %73, label %if.then.2, label %if.end.2, !dbg !500

if.then.2:
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !517
  %75 = load i32, i32* %at.addr, align 4, !dbg !518
  %76 = tail call i64 @nish.foundAt(i32 %74, i32 %75), !dbg !516
  ret i64 %76, !dbg !515

if.end.2:
  br label %if.end.1, !dbg !490

if.end.1:
  %77 = load i32, i32* %bucket.addr, align 4, !dbg !521
  %78 = add nsw i32 %77, 1, !dbg !521
  %79 = and i32 %78, %mask, !dbg !520
  store i32 %79, i32* %bucket.addr, align 4, !dbg !519
  br label %while.cond, !dbg !469

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !524
  call void @nish_exit(i32 1), !dbg !524
  unreachable, !dbg !524
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !528 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !530, metadata !DIExpression()), !dbg !529
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !531, metadata !DIExpression()), !dbg !529
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !534
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !534
  %2 = trunc i64 %1 to i32, !dbg !534
  store i32 %2, i32* %used.addr, align 4, !dbg !532
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !535, metadata !DIExpression()), !dbg !532
  store i32 0, i32* %to.addr, align 4, !dbg !536
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !538, metadata !DIExpression()), !dbg !536
  store i32 0, i32* %from.addr, align 4, !dbg !539
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !541, metadata !DIExpression()), !dbg !539
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !539
  %4 = load i64, i64* %3, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !539
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !539
  %6 = load i8*, i8** %5, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !539
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !539
  %8 = load i64, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !539
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !539
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !539
  br label %for.cond, !dbg !539

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !544
  %12 = load i32, i32* %used.addr, align 4, !dbg !545
  %13 = icmp slt i32 %11, %12, !dbg !544
  br i1 %13, label %land.rhs, label %land.end, !dbg !544

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !546
  %15 = trunc i64 %4 to i32, !dbg !542
  %16 = icmp slt i32 %14, %15, !dbg !546
  br label %land.end, !dbg !544

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !544
  br i1 %17, label %for.body, label %for.end, !dbg !539

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !551
  %19 = sext i32 %18 to i64, !dbg !550
  %20 = bitcast i8* %6 to i32*, !dbg !550
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !550
  %22 = load i32, i32* %21, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !550
  %23 = icmp ne i32 %22, 0, !dbg !550
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !550

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !553
  %25 = icmp sge i32 %24, 0, !dbg !553
  br label %land.end.3, !dbg !550

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !550
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !550

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !555
  %28 = load i32, i32* %used.addr, align 4, !dbg !556
  %29 = icmp slt i32 %27, %28, !dbg !555
  br label %land.end.2, !dbg !550

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !550
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !550

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !557
  %32 = trunc i64 %8 to i32, !dbg !543
  %33 = icmp slt i32 %31, %32, !dbg !557
  br label %land.end.1, !dbg !550

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !550
  br i1 %34, label %if.then, label %if.end, !dbg !549

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !561
  %36 = sext i32 %35 to i64, !dbg !560
  %37 = load i32, i32* %from.addr, align 4, !dbg !563
  %38 = sext i32 %37 to i64, !dbg !562
  %39 = bitcast i8* %10 to i32*, !dbg !562
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !562
  %41 = load i32, i32* %40, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !562
  %42 = bitcast i8* %10 to i32*, !dbg !560
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !560
  store i32 %41, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !560
  %44 = load i32, i32* %to.addr, align 4, !dbg !564
  %45 = add nsw i32 %44, 1, !dbg !564
  store i32 %45, i32* %to.addr, align 4, !dbg !564
  br label %if.end, !dbg !549

if.end:
  br label %for.inc, !dbg !539

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !565
  %47 = add nsw i32 %46, 1, !dbg !565
  store i32 %47, i32* %from.addr, align 4, !dbg !565
  br label %for.cond, !dbg !539

for.end:
  br label %while.cond, !dbg !566

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !568
  %49 = load i64, i64* %48, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !568
  %50 = trunc i64 %49 to i32, !dbg !568
  %51 = load i32, i32* %to.addr, align 4, !dbg !569
  %52 = icmp sgt i32 %50, %51, !dbg !567
  br i1 %52, label %while.body, label %while.end, !dbg !566

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !571
  %54 = load i64, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !571
  %55 = icmp eq i64 %54, 0, !dbg !571
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !571

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !571
  unreachable, !dbg !571

pop.ok:
  %56 = sub i64 %54, 1, !dbg !571
  store i64 %56, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !571
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !571
  %58 = load i8*, i8** %57, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !571
  %59 = bitcast i8* %58 to i32*, !dbg !571
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !571
  %61 = load i32, i32* %60, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !571
  br label %while.cond, !dbg !566

while.end:
  ret void, !dbg !529
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 355, size: 320, align: 64, elements: !36)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 357, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 358, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 359, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 360, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 361, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 362, baseType: !23, size: 64, offset: 256)
!36 = !{!14, !24, !25, !26, !34, !35}
!37 = !DILocalVariable(name: "s", scope: !7, file: !1, line: 6, type: !12)
!38 = !DILocation(line: 7, column: 3, scope: !7)
!39 = !DILocation(line: 7, column: 9, scope: !7)
!40 = !DILocation(line: 7, column: 16, scope: !7)
!41 = !DILocation(line: 8, column: 3, scope: !7)
!42 = !DILocation(line: 8, column: 15, scope: !7)
!43 = !DILocation(line: 8, column: 18, scope: !7)
!44 = !{!"nish TBAA"}
!45 = !{!"omnipotent char", !44, i64 0}
!46 = !{!"i32", !45, i64 0}
!47 = !{!"ptr", !45, i64 0}
!48 = !{!"Set$i32", !46, i64 0, !47, i64 8, !46, i64 16, !46, i64 20, !47, i64 24, !47, i64 32}
!49 = !{!48, !46, i64 0}
!50 = !DILocation(line: 8, column: 28, scope: !7)
!51 = !DILocation(line: 8, column: 34, scope: !7)
!52 = !DILocation(line: 9, column: 3, scope: !7)
!53 = !DILocation(line: 9, column: 10, scope: !7)
!54 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 5, type: !6, scopeLine: 5, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!55 = !DILocation(line: 5, column: 1, scope: !54)
!56 = !{!4, !19, !4}
!57 = !DISubroutineType(types: !56)
!58 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 73, type: !57, scopeLine: 73, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!59 = !DILocation(line: 73, column: 1, scope: !58)
!60 = !DILocalVariable(name: "h", arg: 1, scope: !58, file: !13, line: 73, type: !19)
!61 = !DILocalVariable(name: "mask", arg: 2, scope: !58, file: !13, line: 73, type: !4)
!62 = !DILocation(line: 73, column: 48, scope: !58)
!63 = !DILocation(line: 73, column: 54, scope: !58)
!64 = !DILocation(line: 73, column: 58, scope: !58)
!65 = !DILocation(line: 73, column: 59, scope: !58)
!66 = !DILocation(line: 73, column: 72, scope: !58)
!67 = !{!19, !19, !4}
!68 = !DISubroutineType(types: !67)
!69 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 76, type: !68, scopeLine: 76, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!70 = !DILocation(line: 76, column: 1, scope: !69)
!71 = !DILocalVariable(name: "h", arg: 1, scope: !69, file: !13, line: 76, type: !19)
!72 = !DILocalVariable(name: "index", arg: 2, scope: !69, file: !13, line: 76, type: !4)
!73 = !DILocation(line: 76, column: 47, scope: !69)
!74 = !DILocation(line: 76, column: 48, scope: !69)
!75 = !DILocation(line: 76, column: 49, scope: !69)
!76 = !DILocation(line: 76, column: 68, scope: !69)
!77 = !DILocation(line: 76, column: 74, scope: !69)
!78 = !DILocation(line: 76, column: 82, scope: !69)
!79 = !{!16, !4, !4}
!80 = !DISubroutineType(types: !79)
!81 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 79, type: !80, scopeLine: 79, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!82 = !DILocation(line: 79, column: 1, scope: !81)
!83 = !DILocalVariable(name: "bucket", arg: 1, scope: !81, file: !13, line: 79, type: !4)
!84 = !DILocalVariable(name: "index", arg: 2, scope: !81, file: !13, line: 79, type: !4)
!85 = !DILocation(line: 79, column: 51, scope: !81)
!86 = !DILocation(line: 79, column: 52, scope: !81)
!87 = !DILocation(line: 79, column: 58, scope: !81)
!88 = !DILocation(line: 79, column: 75, scope: !81)
!89 = !DILocation(line: 79, column: 81, scope: !81)
!90 = !{!16, !4, !19}
!91 = !DISubroutineType(types: !90)
!92 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 82, type: !91, scopeLine: 82, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!93 = !DILocation(line: 82, column: 1, scope: !92)
!94 = !DILocalVariable(name: "bucket", arg: 1, scope: !92, file: !13, line: 82, type: !4)
!95 = !DILocalVariable(name: "h", arg: 2, scope: !92, file: !13, line: 82, type: !19)
!96 = !DILocation(line: 82, column: 48, scope: !92)
!97 = !DILocation(line: 82, column: 54, scope: !92)
!98 = !DILocation(line: 82, column: 55, scope: !92)
!99 = !DILocation(line: 82, column: 60, scope: !92)
!100 = !DILocation(line: 82, column: 61, scope: !92)
!101 = !DILocation(line: 82, column: 62, scope: !92)
!102 = !DILocation(line: 82, column: 68, scope: !92)
!103 = !DILocation(line: 82, column: 85, scope: !92)
!104 = !DILocation(line: 82, column: 91, scope: !92)
!105 = !{null, !23, !4, !19, !4}
!106 = !DISubroutineType(types: !105)
!107 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 118, type: !106, scopeLine: 118, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!108 = !DILocation(line: 118, column: 1, scope: !107)
!109 = !DILocalVariable(name: "slots", arg: 1, scope: !107, file: !13, line: 118, type: !23)
!110 = !DILocalVariable(name: "mask", arg: 2, scope: !107, file: !13, line: 118, type: !4)
!111 = !DILocalVariable(name: "h", arg: 3, scope: !107, file: !13, line: 118, type: !19)
!112 = !DILocalVariable(name: "index", arg: 4, scope: !107, file: !13, line: 118, type: !4)
!113 = !DILocation(line: 119, column: 3, scope: !107)
!114 = !DILocation(line: 119, column: 16, scope: !107)
!115 = !DILocation(line: 119, column: 25, scope: !107)
!116 = !DILocation(line: 119, column: 28, scope: !107)
!117 = !DILocalVariable(name: "word", scope: !107, file: !13, line: 119, type: !19)
!118 = !DILocation(line: 120, column: 3, scope: !107)
!119 = !DILocation(line: 120, column: 16, scope: !107)
!120 = !DILocation(line: 120, column: 27, scope: !107)
!121 = !DILocation(line: 120, column: 30, scope: !107)
!122 = !DILocalVariable(name: "bucket", scope: !107, file: !13, line: 120, type: !4)
!123 = !DILocation(line: 121, column: 3, scope: !107)
!124 = !DILocation(line: 121, column: 40, scope: !107)
!125 = !{!"nish array"}
!126 = !{!"header", !125}
!127 = !{!"elements", !125}
!128 = !{!126}
!129 = !{!127}
!130 = !{!"header i64", !45, i64 0}
!131 = !{!"header ptr", !45, i64 0}
!132 = !{!"array header", !130, i64 0, !130, i64 8, !131, i64 16}
!133 = !{!132, !130, i64 0}
!134 = !{!132, !131, i64 16}
!135 = !DILocation(line: 121, column: 10, scope: !107)
!136 = !DILocation(line: 121, column: 20, scope: !107)
!137 = !DILocation(line: 121, column: 25, scope: !107)
!138 = !DILocation(line: 121, column: 34, scope: !107)
!139 = !DILocation(line: 121, column: 55, scope: !107)
!140 = !DILocation(line: 122, column: 5, scope: !107)
!141 = !DILocation(line: 122, column: 9, scope: !107)
!142 = !DILocation(line: 122, column: 15, scope: !107)
!143 = !{!"element i32", !45, i64 0}
!144 = !{!143, !143, i64 0}
!145 = !DILocation(line: 122, column: 27, scope: !107)
!146 = !DILocation(line: 122, column: 30, scope: !107)
!147 = !DILocation(line: 123, column: 7, scope: !107)
!148 = !DILocation(line: 123, column: 13, scope: !107)
!149 = !DILocation(line: 123, column: 23, scope: !107)
!150 = !DILocation(line: 124, column: 7, scope: !107)
!151 = !DILocation(line: 126, column: 5, scope: !107)
!152 = !DILocation(line: 126, column: 14, scope: !107)
!153 = !DILocation(line: 126, column: 15, scope: !107)
!154 = !DILocation(line: 126, column: 24, scope: !107)
!155 = !DILocation(line: 126, column: 29, scope: !107)
!156 = !{!4, !23}
!157 = !DISubroutineType(types: !156)
!158 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 146, type: !157, scopeLine: 146, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!159 = !DILocation(line: 146, column: 1, scope: !158)
!160 = !DILocalVariable(name: "hashes", arg: 1, scope: !158, file: !13, line: 146, type: !23)
!161 = !DILocation(line: 147, column: 3, scope: !158)
!162 = !DILocation(line: 147, column: 16, scope: !158)
!163 = !DILocation(line: 147, column: 22, scope: !158)
!164 = !DILocalVariable(name: "used", scope: !158, file: !13, line: 147, type: !4)
!165 = !DILocation(line: 148, column: 3, scope: !158)
!166 = !DILocation(line: 148, column: 17, scope: !158)
!167 = !DILocalVariable(name: "to", scope: !158, file: !13, line: 148, type: !4)
!168 = !DILocation(line: 149, column: 3, scope: !158)
!169 = !DILocation(line: 149, column: 24, scope: !158)
!170 = !DILocalVariable(name: "from", scope: !158, file: !13, line: 149, type: !4)
!171 = !DILocation(line: 150, column: 15, scope: !158)
!172 = !DILocation(line: 149, column: 27, scope: !158)
!173 = !DILocation(line: 149, column: 34, scope: !158)
!174 = !DILocation(line: 149, column: 48, scope: !158)
!175 = !DILocation(line: 150, column: 5, scope: !158)
!176 = !DILocation(line: 150, column: 22, scope: !158)
!177 = !DILocalVariable(name: "h", scope: !158, file: !13, line: 150, type: !19)
!178 = !DILocation(line: 151, column: 5, scope: !158)
!179 = !DILocation(line: 151, column: 9, scope: !158)
!180 = !DILocation(line: 151, column: 15, scope: !158)
!181 = !DILocation(line: 151, column: 20, scope: !158)
!182 = !DILocation(line: 151, column: 26, scope: !158)
!183 = !DILocation(line: 151, column: 31, scope: !158)
!184 = !DILocation(line: 151, column: 36, scope: !158)
!185 = !DILocation(line: 151, column: 42, scope: !158)
!186 = !DILocation(line: 152, column: 7, scope: !158)
!187 = !DILocation(line: 152, column: 14, scope: !158)
!188 = !DILocation(line: 152, column: 20, scope: !158)
!189 = !DILocation(line: 153, column: 7, scope: !158)
!190 = !DILocation(line: 149, column: 40, scope: !158)
!191 = !DILocation(line: 156, column: 3, scope: !158)
!192 = !DILocation(line: 156, column: 10, scope: !158)
!193 = !DILocation(line: 156, column: 16, scope: !158)
!194 = !DILocation(line: 156, column: 33, scope: !158)
!195 = !DILocation(line: 156, column: 37, scope: !158)
!196 = !DILocation(line: 157, column: 5, scope: !158)
!197 = !DILocation(line: 159, column: 3, scope: !158)
!198 = !DILocation(line: 159, column: 10, scope: !158)
!199 = !{!23, !23, !4, !4}
!200 = !DISubroutineType(types: !199)
!201 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 169, type: !200, scopeLine: 169, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!202 = !DILocation(line: 169, column: 1, scope: !201)
!203 = !DILocalVariable(name: "slots", arg: 1, scope: !201, file: !13, line: 169, type: !23)
!204 = !DILocalVariable(name: "live", arg: 2, scope: !201, file: !13, line: 169, type: !4)
!205 = !DILocalVariable(name: "used", arg: 3, scope: !201, file: !13, line: 169, type: !4)
!206 = !DILocation(line: 170, column: 3, scope: !201)
!207 = !DILocation(line: 170, column: 13, scope: !201)
!208 = !DILocation(line: 170, column: 19, scope: !201)
!209 = !DILocalVariable(name: "n", scope: !201, file: !13, line: 170, type: !4)
!210 = !DILocation(line: 171, column: 3, scope: !201)
!211 = !DILocation(line: 171, column: 7, scope: !201)
!212 = !DILocation(line: 171, column: 14, scope: !201)
!213 = !DILocation(line: 171, column: 18, scope: !201)
!214 = !DILocation(line: 171, column: 24, scope: !201)
!215 = !DILocation(line: 172, column: 5, scope: !201)
!216 = !DILocation(line: 172, column: 16, scope: !201)
!217 = !DILocation(line: 173, column: 5, scope: !201)
!218 = !DILocation(line: 173, column: 12, scope: !201)
!219 = !DILocation(line: 175, column: 3, scope: !201)
!220 = !DILocation(line: 175, column: 10, scope: !201)
!221 = !DILocation(line: 175, column: 25, scope: !201)
!222 = !DILocation(line: 175, column: 29, scope: !201)
!223 = !{!132, !130, i64 8}
!224 = !{null, !23, !23}
!225 = !DISubroutineType(types: !224)
!226 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 179, type: !225, scopeLine: 179, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!227 = !DILocation(line: 179, column: 1, scope: !226)
!228 = !DILocalVariable(name: "slots", arg: 1, scope: !226, file: !13, line: 179, type: !23)
!229 = !DILocalVariable(name: "hashes", arg: 2, scope: !226, file: !13, line: 179, type: !23)
!230 = !DILocation(line: 180, column: 3, scope: !226)
!231 = !DILocation(line: 180, column: 16, scope: !226)
!232 = !DILocation(line: 180, column: 22, scope: !226)
!233 = !DILocation(line: 180, column: 38, scope: !226)
!234 = !DILocalVariable(name: "mask", scope: !226, file: !13, line: 180, type: !4)
!235 = !DILocation(line: 181, column: 3, scope: !226)
!236 = !DILocation(line: 181, column: 21, scope: !226)
!237 = !DILocalVariable(name: "i", scope: !226, file: !13, line: 181, type: !4)
!238 = !DILocation(line: 181, column: 34, scope: !226)
!239 = !DILocation(line: 181, column: 24, scope: !226)
!240 = !DILocation(line: 181, column: 28, scope: !226)
!241 = !DILocation(line: 181, column: 55, scope: !226)
!242 = !DILocation(line: 182, column: 5, scope: !226)
!243 = !DILocation(line: 182, column: 15, scope: !226)
!244 = !DILocation(line: 182, column: 22, scope: !226)
!245 = !DILocation(line: 182, column: 28, scope: !226)
!246 = !DILocation(line: 182, column: 35, scope: !226)
!247 = !DILocation(line: 182, column: 39, scope: !226)
!248 = !DILocation(line: 181, column: 50, scope: !226)
!249 = !{null, !23}
!250 = !DISubroutineType(types: !249)
!251 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 203, type: !250, scopeLine: 203, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!252 = !DILocation(line: 203, column: 1, scope: !251)
!253 = !DILocalVariable(name: "slots", arg: 1, scope: !251, file: !13, line: 203, type: !23)
!254 = !DILocation(line: 204, column: 3, scope: !251)
!255 = !DILocation(line: 204, column: 21, scope: !251)
!256 = !DILocalVariable(name: "i", scope: !251, file: !13, line: 204, type: !4)
!257 = !DILocation(line: 204, column: 34, scope: !251)
!258 = !DILocation(line: 204, column: 24, scope: !251)
!259 = !DILocation(line: 204, column: 28, scope: !251)
!260 = !DILocation(line: 204, column: 54, scope: !251)
!261 = !DILocation(line: 205, column: 5, scope: !251)
!262 = !DILocation(line: 205, column: 11, scope: !251)
!263 = !DILocation(line: 205, column: 16, scope: !251)
!264 = !DILocation(line: 204, column: 49, scope: !251)
!265 = !{null, !23, !4, !4, !19, !4}
!266 = !DISubroutineType(types: !265)
!267 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 221, type: !266, scopeLine: 221, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!268 = !DILocation(line: 221, column: 1, scope: !267)
!269 = !DILocalVariable(name: "slots", arg: 1, scope: !267, file: !13, line: 221, type: !23)
!270 = !DILocalVariable(name: "mask", arg: 2, scope: !267, file: !13, line: 221, type: !4)
!271 = !DILocalVariable(name: "bucket", arg: 3, scope: !267, file: !13, line: 221, type: !4)
!272 = !DILocalVariable(name: "h", arg: 4, scope: !267, file: !13, line: 221, type: !19)
!273 = !DILocalVariable(name: "used", arg: 5, scope: !267, file: !13, line: 221, type: !4)
!274 = !DILocation(line: 222, column: 3, scope: !267)
!275 = !DILocation(line: 222, column: 7, scope: !267)
!276 = !DILocation(line: 222, column: 17, scope: !267)
!277 = !DILocation(line: 222, column: 22, scope: !267)
!278 = !DILocation(line: 222, column: 31, scope: !267)
!279 = !DILocation(line: 222, column: 37, scope: !267)
!280 = !DILocation(line: 222, column: 52, scope: !267)
!281 = !DILocation(line: 223, column: 5, scope: !267)
!282 = !DILocation(line: 223, column: 11, scope: !267)
!283 = !DILocation(line: 223, column: 21, scope: !267)
!284 = !DILocation(line: 223, column: 30, scope: !267)
!285 = !DILocation(line: 223, column: 33, scope: !267)
!286 = !DILocation(line: 223, column: 40, scope: !267)
!287 = !DILocation(line: 224, column: 10, scope: !267)
!288 = !DILocation(line: 225, column: 5, scope: !267)
!289 = !DILocation(line: 225, column: 15, scope: !267)
!290 = !DILocation(line: 225, column: 22, scope: !267)
!291 = !DILocation(line: 225, column: 28, scope: !267)
!292 = !DILocation(line: 225, column: 31, scope: !267)
!293 = !DILocation(line: 225, column: 38, scope: !267)
!294 = !{null, !12}
!295 = !DISubroutineType(types: !294)
!296 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 364, type: !295, scopeLine: 364, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!297 = !DILocation(line: 364, column: 3, scope: !296)
!298 = !DILocalVariable(name: "this", arg: 1, scope: !296, file: !13, line: 364, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!299 = !{!48, !46, i64 16}
!300 = !{!48, !46, i64 20}
!301 = !DILocation(line: 365, column: 5, scope: !296)
!302 = !DILocation(line: 365, column: 18, scope: !296)
!303 = !DILocation(line: 365, column: 33, scope: !296)
!304 = !{!48, !47, i64 8}
!305 = !DILocation(line: 366, column: 5, scope: !296)
!306 = !DILocation(line: 366, column: 22, scope: !296)
!307 = !{!48, !47, i64 24}
!308 = !DILocation(line: 367, column: 5, scope: !296)
!309 = !DILocation(line: 367, column: 24, scope: !296)
!310 = !{!48, !47, i64 32}
!311 = !{!16, !12, !4}
!312 = !DISubroutineType(types: !311)
!313 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 370, type: !312, scopeLine: 370, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!314 = !DILocation(line: 370, column: 3, scope: !313)
!315 = !DILocalVariable(name: "this", arg: 1, scope: !313, file: !13, line: 370, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!316 = !DILocalVariable(name: "key", arg: 2, scope: !313, file: !13, line: 370, type: !4)
!317 = !DILocation(line: 371, column: 5, scope: !313)
!318 = !DILocation(line: 371, column: 12, scope: !313)
!319 = !DILocation(line: 371, column: 23, scope: !313)
!320 = !DILocation(line: 371, column: 35, scope: !313)
!321 = !DILocation(line: 371, column: 46, scope: !313)
!322 = !DILocation(line: 371, column: 64, scope: !313)
!323 = !DILocation(line: 371, column: 80, scope: !313)
!324 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!325 = !{!324, !12, !4}
!326 = !DISubroutineType(types: !325)
!327 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 374, type: !326, scopeLine: 374, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!328 = !DILocation(line: 374, column: 3, scope: !327)
!329 = !DILocalVariable(name: "this", arg: 1, scope: !327, file: !13, line: 374, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!330 = !DILocalVariable(name: "key", arg: 2, scope: !327, file: !13, line: 374, type: !4)
!331 = !DILocation(line: 375, column: 5, scope: !327)
!332 = !DILocation(line: 375, column: 12, scope: !327)
!333 = !DILocation(line: 375, column: 23, scope: !327)
!334 = !DILocation(line: 375, column: 31, scope: !327)
!335 = !{!12, !12, !4}
!336 = !DISubroutineType(types: !335)
!337 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 379, type: !336, scopeLine: 379, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!338 = !DILocation(line: 379, column: 3, scope: !337)
!339 = !DILocalVariable(name: "this", arg: 1, scope: !337, file: !13, line: 379, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!340 = !DILocalVariable(name: "key", arg: 2, scope: !337, file: !13, line: 379, type: !4)
!341 = !DILocation(line: 380, column: 5, scope: !337)
!342 = !DILocation(line: 380, column: 19, scope: !337)
!343 = !DILocation(line: 380, column: 30, scope: !337)
!344 = !DILocalVariable(name: "found", scope: !337, file: !13, line: 380, type: !16)
!345 = !DILocation(line: 381, column: 5, scope: !337)
!346 = !DILocation(line: 381, column: 9, scope: !337)
!347 = !DILocation(line: 381, column: 17, scope: !337)
!348 = !DILocation(line: 381, column: 20, scope: !337)
!349 = !DILocation(line: 382, column: 7, scope: !337)
!350 = !DILocation(line: 382, column: 21, scope: !337)
!351 = !DILocation(line: 382, column: 28, scope: !337)
!352 = !DILocation(line: 384, column: 5, scope: !337)
!353 = !DILocation(line: 384, column: 12, scope: !337)
!354 = !{null, !12, !16, !4}
!355 = !DISubroutineType(types: !354)
!356 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 406, type: !355, scopeLine: 406, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!357 = !DILocation(line: 406, column: 3, scope: !356)
!358 = !DILocalVariable(name: "this", arg: 1, scope: !356, file: !13, line: 406, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!359 = !DILocalVariable(name: "absent", arg: 2, scope: !356, file: !13, line: 406, type: !16)
!360 = !DILocalVariable(name: "key", arg: 3, scope: !356, file: !13, line: 406, type: !4)
!361 = !DILocation(line: 407, column: 5, scope: !356)
!362 = !DILocation(line: 407, column: 20, scope: !356)
!363 = !DILocation(line: 407, column: 21, scope: !356)
!364 = !DILocation(line: 407, column: 25, scope: !356)
!365 = !DILocalVariable(name: "packed", scope: !356, file: !13, line: 407, type: !16)
!366 = !DILocation(line: 408, column: 5, scope: !356)
!367 = !DILocation(line: 408, column: 18, scope: !356)
!368 = !DILocation(line: 408, column: 24, scope: !356)
!369 = !DILocalVariable(name: "bucket", scope: !356, file: !13, line: 408, type: !4)
!370 = !DILocation(line: 409, column: 5, scope: !356)
!371 = !DILocation(line: 409, column: 15, scope: !356)
!372 = !DILocation(line: 409, column: 21, scope: !356)
!373 = !DILocalVariable(name: "h", scope: !356, file: !13, line: 409, type: !19)
!374 = !DILocation(line: 410, column: 5, scope: !356)
!375 = !DILocation(line: 410, column: 9, scope: !356)
!376 = !DILocation(line: 410, column: 15, scope: !356)
!377 = !DILocation(line: 410, column: 41, scope: !356)
!378 = !DILocation(line: 410, column: 52, scope: !356)
!379 = !DILocation(line: 411, column: 7, scope: !356)
!380 = !DILocation(line: 411, column: 11, scope: !356)
!381 = !DILocation(line: 411, column: 24, scope: !356)
!382 = !DILocation(line: 411, column: 35, scope: !356)
!383 = !DILocation(line: 412, column: 9, scope: !356)
!384 = !DILocation(line: 412, column: 15, scope: !356)
!385 = !DILocation(line: 414, column: 7, scope: !356)
!386 = !DILocation(line: 415, column: 7, scope: !356)
!387 = !DILocation(line: 415, column: 16, scope: !356)
!388 = !DILocation(line: 415, column: 17, scope: !356)
!389 = !DILocation(line: 417, column: 5, scope: !356)
!390 = !DILocation(line: 417, column: 25, scope: !356)
!391 = !DILocation(line: 418, column: 5, scope: !356)
!392 = !DILocation(line: 418, column: 27, scope: !356)
!393 = !DILocation(line: 419, column: 5, scope: !356)
!394 = !DILocation(line: 419, column: 17, scope: !356)
!395 = !DILocation(line: 419, column: 29, scope: !356)
!396 = !DILocation(line: 420, column: 5, scope: !356)
!397 = !DILocation(line: 420, column: 17, scope: !356)
!398 = !DILocation(line: 420, column: 29, scope: !356)
!399 = !DILocation(line: 421, column: 5, scope: !356)
!400 = !DILocation(line: 421, column: 18, scope: !356)
!401 = !DILocation(line: 421, column: 24, scope: !356)
!402 = !DILocalVariable(name: "used", scope: !356, file: !13, line: 421, type: !4)
!403 = !DILocation(line: 422, column: 5, scope: !356)
!404 = !DILocation(line: 422, column: 18, scope: !356)
!405 = !DILocation(line: 422, column: 30, scope: !356)
!406 = !DILocation(line: 422, column: 41, scope: !356)
!407 = !DILocation(line: 422, column: 49, scope: !356)
!408 = !DILocation(line: 422, column: 52, scope: !356)
!409 = !DILocation(line: 423, column: 5, scope: !356)
!410 = !DILocation(line: 423, column: 9, scope: !356)
!411 = !DILocation(line: 423, column: 16, scope: !356)
!412 = !DILocation(line: 423, column: 20, scope: !356)
!413 = !DILocation(line: 423, column: 26, scope: !356)
!414 = !DILocation(line: 423, column: 47, scope: !356)
!415 = !DILocation(line: 423, column: 50, scope: !356)
!416 = !DILocation(line: 424, column: 7, scope: !356)
!417 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 428, type: !295, scopeLine: 428, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!418 = !DILocation(line: 428, column: 3, scope: !417)
!419 = !DILocalVariable(name: "this", arg: 1, scope: !417, file: !13, line: 428, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!420 = !DILocation(line: 429, column: 5, scope: !417)
!421 = !DILocation(line: 429, column: 18, scope: !417)
!422 = !DILocation(line: 429, column: 24, scope: !417)
!423 = !DILocalVariable(name: "used", scope: !417, file: !13, line: 429, type: !4)
!424 = !DILocation(line: 430, column: 5, scope: !417)
!425 = !DILocation(line: 430, column: 19, scope: !417)
!426 = !DILocation(line: 430, column: 32, scope: !417)
!427 = !DILocation(line: 430, column: 44, scope: !417)
!428 = !DILocation(line: 430, column: 55, scope: !417)
!429 = !DILocalVariable(name: "slots", scope: !417, file: !13, line: 430, type: !23)
!430 = !DILocation(line: 431, column: 5, scope: !417)
!431 = !DILocation(line: 431, column: 9, scope: !417)
!432 = !DILocation(line: 431, column: 21, scope: !417)
!433 = !DILocation(line: 431, column: 27, scope: !417)
!434 = !DILocation(line: 432, column: 7, scope: !417)
!435 = !DILocation(line: 432, column: 22, scope: !417)
!436 = !DILocation(line: 432, column: 38, scope: !417)
!437 = !DILocation(line: 433, column: 7, scope: !417)
!438 = !DILocation(line: 433, column: 21, scope: !417)
!439 = !DILocation(line: 435, column: 5, scope: !417)
!440 = !DILocation(line: 435, column: 18, scope: !417)
!441 = !DILocation(line: 436, column: 5, scope: !417)
!442 = !DILocation(line: 436, column: 17, scope: !417)
!443 = !DILocation(line: 436, column: 23, scope: !417)
!444 = !DILocation(line: 436, column: 39, scope: !417)
!445 = !DILocation(line: 437, column: 5, scope: !417)
!446 = !DILocation(line: 437, column: 12, scope: !417)
!447 = !DILocation(line: 437, column: 19, scope: !417)
!448 = !{!16, !23, !4, !23, !33, !4}
!449 = !DISubroutineType(types: !448)
!450 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 91, type: !449, scopeLine: 91, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!451 = !DILocation(line: 91, column: 1, scope: !450)
!452 = !DILocalVariable(name: "slots", arg: 1, scope: !450, file: !13, line: 91, type: !23)
!453 = !DILocalVariable(name: "mask", arg: 2, scope: !450, file: !13, line: 91, type: !4)
!454 = !DILocalVariable(name: "hashes", arg: 3, scope: !450, file: !13, line: 91, type: !23)
!455 = !DILocalVariable(name: "keys", arg: 4, scope: !450, file: !13, line: 91, type: !33)
!456 = !DILocalVariable(name: "key", arg: 5, scope: !450, file: !13, line: 91, type: !4)
!457 = !DILocation(line: 92, column: 3, scope: !450)
!458 = !DILocation(line: 92, column: 13, scope: !450)
!459 = !DILocation(line: 92, column: 21, scope: !450)
!460 = !DILocalVariable(name: "h", scope: !450, file: !13, line: 92, type: !19)
!461 = !DILocation(line: 93, column: 3, scope: !450)
!462 = !DILocation(line: 93, column: 23, scope: !450)
!463 = !DILocalVariable(name: "fingerprint", scope: !450, file: !13, line: 93, type: !19)
!464 = !DILocation(line: 94, column: 3, scope: !450)
!465 = !DILocation(line: 94, column: 16, scope: !450)
!466 = !DILocation(line: 94, column: 27, scope: !450)
!467 = !DILocation(line: 94, column: 30, scope: !450)
!468 = !DILocalVariable(name: "bucket", scope: !450, file: !13, line: 94, type: !4)
!469 = !DILocation(line: 97, column: 3, scope: !450)
!470 = !DILocation(line: 97, column: 40, scope: !450)
!471 = !DILocation(line: 104, column: 33, scope: !450)
!472 = !DILocation(line: 104, column: 82, scope: !450)
!473 = !DILocation(line: 97, column: 10, scope: !450)
!474 = !DILocation(line: 97, column: 20, scope: !450)
!475 = !DILocation(line: 97, column: 25, scope: !450)
!476 = !DILocation(line: 97, column: 34, scope: !450)
!477 = !DILocation(line: 97, column: 55, scope: !450)
!478 = !DILocation(line: 98, column: 5, scope: !450)
!479 = !DILocation(line: 98, column: 18, scope: !450)
!480 = !DILocation(line: 98, column: 24, scope: !450)
!481 = !DILocalVariable(name: "word", scope: !450, file: !13, line: 98, type: !19)
!482 = !DILocation(line: 99, column: 5, scope: !450)
!483 = !DILocation(line: 99, column: 9, scope: !450)
!484 = !DILocation(line: 99, column: 18, scope: !450)
!485 = !DILocation(line: 99, column: 21, scope: !450)
!486 = !DILocation(line: 100, column: 7, scope: !450)
!487 = !DILocation(line: 100, column: 14, scope: !450)
!488 = !DILocation(line: 100, column: 23, scope: !450)
!489 = !DILocation(line: 100, column: 31, scope: !450)
!490 = !DILocation(line: 102, column: 5, scope: !450)
!491 = !DILocation(line: 102, column: 9, scope: !450)
!492 = !DILocation(line: 102, column: 25, scope: !450)
!493 = !DILocation(line: 102, column: 38, scope: !450)
!494 = !DILocation(line: 103, column: 7, scope: !450)
!495 = !DILocation(line: 103, column: 18, scope: !450)
!496 = !DILocation(line: 103, column: 24, scope: !450)
!497 = !DILocation(line: 103, column: 31, scope: !450)
!498 = !DILocation(line: 103, column: 43, scope: !450)
!499 = !DILocalVariable(name: "at", scope: !450, file: !13, line: 103, type: !4)
!500 = !DILocation(line: 104, column: 7, scope: !450)
!501 = !DILocation(line: 104, column: 11, scope: !450)
!502 = !DILocation(line: 104, column: 17, scope: !450)
!503 = !DILocation(line: 104, column: 22, scope: !450)
!504 = !DILocation(line: 104, column: 27, scope: !450)
!505 = !DILocation(line: 104, column: 51, scope: !450)
!506 = !DILocation(line: 104, column: 58, scope: !450)
!507 = !DILocation(line: 104, column: 66, scope: !450)
!508 = !DILocation(line: 104, column: 71, scope: !450)
!509 = !DILocation(line: 104, column: 76, scope: !450)
!510 = !DILocation(line: 104, column: 98, scope: !450)
!511 = !DILocation(line: 104, column: 106, scope: !450)
!512 = !DILocation(line: 104, column: 111, scope: !450)
!513 = !DILocation(line: 104, column: 116, scope: !450)
!514 = !DILocation(line: 104, column: 122, scope: !450)
!515 = !DILocation(line: 105, column: 9, scope: !450)
!516 = !DILocation(line: 105, column: 16, scope: !450)
!517 = !DILocation(line: 105, column: 24, scope: !450)
!518 = !DILocation(line: 105, column: 32, scope: !450)
!519 = !DILocation(line: 108, column: 5, scope: !450)
!520 = !DILocation(line: 108, column: 14, scope: !450)
!521 = !DILocation(line: 108, column: 15, scope: !450)
!522 = !DILocation(line: 108, column: 24, scope: !450)
!523 = !DILocation(line: 108, column: 29, scope: !450)
!524 = !DILocation(line: 110, column: 3, scope: !450)
!525 = !DILocation(line: 110, column: 9, scope: !450)
!526 = !{null, !33, !23}
!527 = !DISubroutineType(types: !526)
!528 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 131, type: !527, scopeLine: 131, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!529 = !DILocation(line: 131, column: 1, scope: !528)
!530 = !DILocalVariable(name: "items", arg: 1, scope: !528, file: !13, line: 131, type: !33)
!531 = !DILocalVariable(name: "hashes", arg: 2, scope: !528, file: !13, line: 131, type: !23)
!532 = !DILocation(line: 132, column: 3, scope: !528)
!533 = !DILocation(line: 132, column: 16, scope: !528)
!534 = !DILocation(line: 132, column: 22, scope: !528)
!535 = !DILocalVariable(name: "used", scope: !528, file: !13, line: 132, type: !4)
!536 = !DILocation(line: 133, column: 3, scope: !528)
!537 = !DILocation(line: 133, column: 17, scope: !528)
!538 = !DILocalVariable(name: "to", scope: !528, file: !13, line: 133, type: !4)
!539 = !DILocation(line: 134, column: 3, scope: !528)
!540 = !DILocation(line: 134, column: 24, scope: !528)
!541 = !DILocalVariable(name: "from", scope: !528, file: !13, line: 134, type: !4)
!542 = !DILocation(line: 134, column: 55, scope: !528)
!543 = !DILocation(line: 135, column: 68, scope: !528)
!544 = !DILocation(line: 134, column: 27, scope: !528)
!545 = !DILocation(line: 134, column: 34, scope: !528)
!546 = !DILocation(line: 134, column: 42, scope: !528)
!547 = !DILocation(line: 134, column: 49, scope: !528)
!548 = !DILocation(line: 134, column: 79, scope: !528)
!549 = !DILocation(line: 135, column: 5, scope: !528)
!550 = !DILocation(line: 135, column: 9, scope: !528)
!551 = !DILocation(line: 135, column: 16, scope: !528)
!552 = !DILocation(line: 135, column: 26, scope: !528)
!553 = !DILocation(line: 135, column: 31, scope: !528)
!554 = !DILocation(line: 135, column: 37, scope: !528)
!555 = !DILocation(line: 135, column: 42, scope: !528)
!556 = !DILocation(line: 135, column: 47, scope: !528)
!557 = !DILocation(line: 135, column: 55, scope: !528)
!558 = !DILocation(line: 135, column: 62, scope: !528)
!559 = !DILocation(line: 135, column: 83, scope: !528)
!560 = !DILocation(line: 136, column: 7, scope: !528)
!561 = !DILocation(line: 136, column: 13, scope: !528)
!562 = !DILocation(line: 136, column: 19, scope: !528)
!563 = !DILocation(line: 136, column: 25, scope: !528)
!564 = !DILocation(line: 137, column: 7, scope: !528)
!565 = !DILocation(line: 134, column: 71, scope: !528)
!566 = !DILocation(line: 140, column: 3, scope: !528)
!567 = !DILocation(line: 140, column: 10, scope: !528)
!568 = !DILocation(line: 140, column: 16, scope: !528)
!569 = !DILocation(line: 140, column: 32, scope: !528)
!570 = !DILocation(line: 140, column: 36, scope: !528)
!571 = !DILocation(line: 141, column: 5, scope: !528)
