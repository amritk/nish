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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !158 {
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
  ret void, !dbg !159
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 !dbg !199 {
entry:
  %n.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !201, metadata !DIExpression()), !dbg !200
  call void @llvm.dbg.value(metadata i32 %live, metadata !202, metadata !DIExpression()), !dbg !200
  call void @llvm.dbg.value(metadata i32 %used, metadata !203, metadata !DIExpression()), !dbg !200
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !206
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !206
  %2 = trunc i64 %1 to i32, !dbg !206
  store i32 %2, i32* %n.addr, align 4, !dbg !204
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !207, metadata !DIExpression()), !dbg !204
  %3 = mul nsw i32 %live, 2, !dbg !209
  %4 = icmp slt i32 %3, %used, !dbg !209
  br i1 %4, label %if.then, label %if.end, !dbg !208

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots), !dbg !213
  ret %struct.nish_array* %slots, !dbg !215

if.end:
  %5 = load i32, i32* %n.addr, align 4, !dbg !219
  %6 = mul nsw i32 %5, 2, !dbg !219
  %7 = sext i32 %6 to i64, !dbg !218
  %8 = call i8* @nish_alloc_struct(i64 24), !dbg !218
  %9 = bitcast i8* %8 to %struct.nish_array*, !dbg !218
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0, !dbg !218
  store i64 %7, i64* %10, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !218
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1, !dbg !218
  store i64 %7, i64* %11, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !218
  %12 = mul i64 %7, 4, !dbg !218
  %13 = call i8* @nish_alloc_struct(i64 %12), !dbg !218
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !129, !noalias !128, !dbg !218
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2, !dbg !218
  store i8* %13, i8** %14, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !218
  ret %struct.nish_array* %9, !dbg !217
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !224 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !226, metadata !DIExpression()), !dbg !225
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !227, metadata !DIExpression()), !dbg !225
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !230
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !230
  %2 = trunc i64 %1 to i32, !dbg !230
  %3 = sub nsw i32 %2, 1, !dbg !229
  store i32 %3, i32* %mask.addr, align 4, !dbg !228
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !232, metadata !DIExpression()), !dbg !228
  store i32 0, i32* %i.addr, align 4, !dbg !233
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !235, metadata !DIExpression()), !dbg !233
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !233
  %5 = load i64, i64* %4, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !233
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !233
  %7 = load i8*, i8** %6, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !233
  br label %for.cond, !dbg !233

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !237
  %9 = trunc i64 %5 to i32, !dbg !236
  %10 = icmp slt i32 %8, %9, !dbg !237
  br i1 %10, label %for.body, label %for.end, !dbg !233

for.body:
  %11 = load i32, i32* %mask.addr, align 4, !dbg !242
  %12 = load i32, i32* %i.addr, align 4, !dbg !244
  %13 = sext i32 %12 to i64, !dbg !243
  %14 = bitcast i8* %7 to i32*, !dbg !243
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !243
  %16 = load i32, i32* %15, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !243
  %17 = load i32, i32* %i.addr, align 4, !dbg !245
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %11, i32 %16, i32 %17), !dbg !240
  br label %for.inc, !dbg !233

for.inc:
  %18 = load i32, i32* %i.addr, align 4, !dbg !246
  %19 = add nsw i32 %18, 1, !dbg !246
  store i32 %19, i32* %i.addr, align 4, !dbg !246
  br label %for.cond, !dbg !233

for.end:
  ret void, !dbg !225
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !247 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !249, metadata !DIExpression()), !dbg !248
  store i32 0, i32* %i.addr, align 4, !dbg !250
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !252, metadata !DIExpression()), !dbg !250
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !250
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !250
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !250
  %3 = load i8*, i8** %2, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !250
  br label %for.cond, !dbg !250

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !254
  %5 = trunc i64 %1 to i32, !dbg !253
  %6 = icmp slt i32 %4, %5, !dbg !254
  br i1 %6, label %for.body, label %for.end, !dbg !250

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !258
  %8 = sext i32 %7 to i64, !dbg !257
  %9 = bitcast i8* %3 to i32*, !dbg !257
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !257
  store i32 0, i32* %10, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !257
  br label %for.inc, !dbg !250

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !260
  %12 = add nsw i32 %11, 1, !dbg !260
  store i32 %12, i32* %i.addr, align 4, !dbg !260
  br label %for.cond, !dbg !250

for.end:
  ret void, !dbg !248
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !263 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !265, metadata !DIExpression()), !dbg !264
  call void @llvm.dbg.value(metadata i32 %mask, metadata !266, metadata !DIExpression()), !dbg !264
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !267, metadata !DIExpression()), !dbg !264
  call void @llvm.dbg.value(metadata i32 %h, metadata !268, metadata !DIExpression()), !dbg !264
  call void @llvm.dbg.value(metadata i32 %used, metadata !269, metadata !DIExpression()), !dbg !264
  %0 = icmp sge i32 %bucket, 0, !dbg !271
  br i1 %0, label %land.rhs, label %land.end, !dbg !271

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !275
  %2 = load i64, i64* %1, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !275
  %3 = trunc i64 %2 to i32, !dbg !275
  %4 = icmp slt i32 %bucket, %3, !dbg !273
  br label %land.end, !dbg !271

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !271
  br i1 %5, label %if.then, label %if.else, !dbg !270

if.then:
  %6 = sext i32 %bucket to i64, !dbg !277
  %7 = sub nsw i32 %used, 1, !dbg !281
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !279
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !277
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !277
  %11 = bitcast i8* %10 to i32*, !dbg !277
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !277
  store i32 %8, i32* %12, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !277
  br label %if.end, !dbg !270

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !288
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !284
  br label %if.end, !dbg !270

if.end:
  ret void, !dbg !264
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #2 !dbg !292 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !294, metadata !DIExpression()), !dbg !293
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !293
  store i32 0, i32* %0, align 4, !tbaa !49, !dbg !293
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !293
  store i32 7, i32* %1, align 4, !tbaa !295, !dbg !293
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !293
  store i32 0, i32* %2, align 4, !tbaa !296, !dbg !293
  %3 = sext i32 8 to i64, !dbg !298
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !298
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !298
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !298
  store i64 %3, i64* %6, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !298
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !298
  store i64 %3, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !298
  %8 = mul i64 %3, 4, !dbg !298
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !298
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !129, !noalias !128, !dbg !298
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !298
  store i8* %9, i8** %10, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !298
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !297
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !300, !dbg !297
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !302
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !302
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !302
  store i64 0, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !302
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !302
  store i64 0, i64* %15, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !302
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !302
  store i8* null, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !302
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !301
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !303, !dbg !301
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !305
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !305
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !305
  store i64 0, i64* %20, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !305
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !305
  store i64 0, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !305
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !305
  store i8* null, i8** %22, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !305
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !304
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !306, !dbg !304
  ret void, !dbg !293
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !309 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !311, metadata !DIExpression()), !dbg !310
  call void @llvm.dbg.value(metadata i32 %key, metadata !312, metadata !DIExpression()), !dbg !310
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !315
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !300, !dbg !315
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !316
  %3 = load i32, i32* %2, align 4, !tbaa !295, !dbg !316
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !317
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !306, !dbg !317
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !318
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !303, !dbg !318
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !314
  ret i64 %8, !dbg !313
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !323 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !325, metadata !DIExpression()), !dbg !324
  call void @llvm.dbg.value(metadata i32 %key, metadata !326, metadata !DIExpression()), !dbg !324
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !328
  %1 = icmp sge i64 %0, 0, !dbg !328
  ret i1 %1, !dbg !327
}

define internal noundef nonnull align 8 dereferenceable(40) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) %this, i32 noundef %key) #0 !dbg !333 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !335, metadata !DIExpression()), !dbg !334
  call void @llvm.dbg.value(metadata i32 %key, metadata !336, metadata !DIExpression()), !dbg !334
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !338
  store i64 %0, i64* %found.addr, align 8, !dbg !337
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !340, metadata !DIExpression()), !dbg !337
  %1 = load i64, i64* %found.addr, align 8, !dbg !342
  %2 = icmp slt i64 %1, 0, !dbg !342
  br i1 %2, label %if.then, label %if.end, !dbg !341

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !346
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !345
  br label %if.end, !dbg !341

if.end:
  ret %struct.Set$i32* %this, !dbg !348
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !352 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !354, metadata !DIExpression()), !dbg !353
  call void @llvm.dbg.value(metadata i64 %absent, metadata !355, metadata !DIExpression()), !dbg !353
  call void @llvm.dbg.value(metadata i32 %key, metadata !356, metadata !DIExpression()), !dbg !353
  %0 = sub nsw i64 0, 1, !dbg !358
  %1 = sub nsw i64 %0, %absent, !dbg !358
  store i64 %1, i64* %packed.addr, align 8, !dbg !357
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !361, metadata !DIExpression()), !dbg !357
  %2 = load i64, i64* %packed.addr, align 8, !dbg !364
  %3 = ashr i64 %2, 32, !dbg !364
  %4 = trunc i64 %3 to i32, !dbg !363
  store i32 %4, i32* %bucket.addr, align 4, !dbg !362
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !365, metadata !DIExpression()), !dbg !362
  %5 = load i64, i64* %packed.addr, align 8, !dbg !368
  %6 = trunc i64 %5 to i32, !dbg !367
  store i32 %6, i32* %h.addr, align 4, !dbg !366
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !369, metadata !DIExpression()), !dbg !366
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !372
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !303, !dbg !372
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !372
  %10 = load i64, i64* %9, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !372
  %11 = trunc i64 %10 to i32, !dbg !372
  %12 = icmp sge i32 %11, 16777215, !dbg !371
  br i1 %12, label %if.then, label %if.end, !dbg !370

if.then:
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !376
  %14 = load i32, i32* %13, align 4, !tbaa !296, !dbg !376
  %15 = icmp sge i32 %14, 16777215, !dbg !376
  br i1 %15, label %if.then.1, label %if.end.1, !dbg !375

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !379
  call void @nish_exit(i32 1), !dbg !379
  unreachable, !dbg !379

if.end.1:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !381
  %16 = sub nsw i32 0, 1, !dbg !383
  store i32 %16, i32* %bucket.addr, align 4, !dbg !382
  br label %if.end, !dbg !370

if.end:
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !385
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !303, !dbg !385
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0, !dbg !385
  %20 = load i64, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !385
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1, !dbg !385
  %22 = load i64, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !385
  %23 = icmp eq i64 %20, %22, !dbg !385
  br i1 %23, label %push.grow, label %push.store, !dbg !385

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4), !dbg !385
  br label %push.store, !dbg !385

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2, !dbg !385
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !385
  %26 = bitcast i8* %25 to i32*, !dbg !385
  %27 = getelementptr inbounds i32, i32* %26, i64 %20, !dbg !385
  store i32 %key, i32* %27, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !385
  %28 = add i64 %20, 1, !dbg !385
  store i64 %28, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !385
  %29 = trunc i64 %28 to i32, !dbg !385
  %30 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !387
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !306, !dbg !387
  %32 = load i32, i32* %h.addr, align 4, !dbg !388
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0, !dbg !387
  %34 = load i64, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !387
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1, !dbg !387
  %36 = load i64, i64* %35, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !387
  %37 = icmp eq i64 %34, %36, !dbg !387
  br i1 %37, label %push.grow.1, label %push.store.1, !dbg !387

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4), !dbg !387
  br label %push.store.1, !dbg !387

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2, !dbg !387
  %39 = load i8*, i8** %38, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !387
  %40 = bitcast i8* %39 to i32*, !dbg !387
  %41 = getelementptr inbounds i32, i32* %40, i64 %34, !dbg !387
  store i32 %32, i32* %41, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !387
  %42 = add i64 %34, 1, !dbg !387
  store i64 %42, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !387
  %43 = trunc i64 %42 to i32, !dbg !387
  %44 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !390
  %45 = load i32, i32* %44, align 4, !tbaa !296, !dbg !390
  %46 = add nsw i32 %45, 1, !dbg !390
  %47 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !389
  store i32 %46, i32* %47, align 4, !tbaa !296, !dbg !389
  %48 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !393
  %49 = load i32, i32* %48, align 4, !tbaa !49, !dbg !393
  %50 = add nsw i32 %49, 1, !dbg !393
  %51 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !392
  store i32 %50, i32* %51, align 4, !tbaa !49, !dbg !392
  %52 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !397
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !303, !dbg !397
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0, !dbg !397
  %55 = load i64, i64* %54, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !397
  %56 = trunc i64 %55 to i32, !dbg !397
  store i32 %56, i32* %used.addr, align 4, !dbg !395
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !398, metadata !DIExpression()), !dbg !395
  %57 = load i32, i32* %used.addr, align 4, !dbg !400
  %58 = mul nsw i32 %57, 4, !dbg !400
  %59 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !403
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !tbaa !300, !dbg !403
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0, !dbg !403
  %62 = load i64, i64* %61, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !403
  %63 = trunc i64 %62 to i32, !dbg !403
  %64 = mul nsw i32 %63, 3, !dbg !402
  %65 = icmp sgt i32 %58, %64, !dbg !400
  br i1 %65, label %if.then.2, label %if.else, !dbg !399

if.then.2:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !406
  br label %if.end.2, !dbg !399

if.else:
  %66 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !409
  %67 = load %struct.nish_array*, %struct.nish_array** %66, align 8, !tbaa !300, !dbg !409
  %68 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !410
  %69 = load i32, i32* %68, align 4, !tbaa !295, !dbg !410
  %70 = load i32, i32* %bucket.addr, align 4, !dbg !411
  %71 = load i32, i32* %h.addr, align 4, !dbg !412
  %72 = load i32, i32* %used.addr, align 4, !dbg !413
  call void @nish.fileAppended(%struct.nish_array* %67, i32 %69, i32 %70, i32 %71, i32 %72), !dbg !408
  br label %if.end.2, !dbg !399

if.end.2:
  ret void, !dbg !353
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this) #0 !dbg !414 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !416, metadata !DIExpression()), !dbg !415
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !419
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !303, !dbg !419
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !419
  %3 = load i64, i64* %2, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !419
  %4 = trunc i64 %3 to i32, !dbg !419
  store i32 %4, i32* %used.addr, align 4, !dbg !417
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !420, metadata !DIExpression()), !dbg !417
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !423
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !300, !dbg !423
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !424
  %8 = load i32, i32* %7, align 4, !tbaa !296, !dbg !424
  %9 = load i32, i32* %used.addr, align 4, !dbg !425
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9), !dbg !422
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8, !dbg !421
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !426, metadata !DIExpression()), !dbg !421
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !428
  %12 = load i32, i32* %11, align 4, !tbaa !296, !dbg !428
  %13 = load i32, i32* %used.addr, align 4, !dbg !429
  %14 = icmp slt i32 %12, %13, !dbg !428
  br i1 %14, label %if.then, label %if.end, !dbg !427

if.then:
  %15 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !432
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !303, !dbg !432
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !433
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !306, !dbg !433
  call void @nish.compactEntries$i32(%struct.nish_array* %16, %struct.nish_array* %18), !dbg !431
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !435
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !306, !dbg !435
  call void @nish.compactHashes(%struct.nish_array* %20), !dbg !434
  br label %if.end, !dbg !427

if.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !437
  %22 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !436
  store %struct.nish_array* %21, %struct.nish_array** %22, align 8, !tbaa !300, !dbg !436
  %23 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !440
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0, !dbg !440
  %25 = load i64, i64* %24, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !440
  %26 = trunc i64 %25 to i32, !dbg !440
  %27 = sub nsw i32 %26, 1, !dbg !439
  %28 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !438
  store i32 %27, i32* %28, align 4, !tbaa !295, !dbg !438
  %29 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !443
  %30 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !444
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !306, !dbg !444
  call void @nish.refile(%struct.nish_array* %29, %struct.nish_array* %31), !dbg !442
  ret void, !dbg !415
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !447 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !449, metadata !DIExpression()), !dbg !448
  call void @llvm.dbg.value(metadata i32 %mask, metadata !450, metadata !DIExpression()), !dbg !448
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !451, metadata !DIExpression()), !dbg !448
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !452, metadata !DIExpression()), !dbg !448
  call void @llvm.dbg.value(metadata i32 %key, metadata !453, metadata !DIExpression()), !dbg !448
  %0 = lshr i32 %key, 16, !dbg !455
  %1 = xor i32 %key, %0, !dbg !455
  %2 = mul i32 %1, -2048144789, !dbg !455
  %3 = lshr i32 %2, 13, !dbg !455
  %4 = xor i32 %2, %3, !dbg !455
  %5 = mul i32 %4, -1028477387, !dbg !455
  %6 = lshr i32 %5, 16, !dbg !455
  %7 = xor i32 %5, %6, !dbg !455
  %8 = icmp eq i32 %7, 0, !dbg !455
  %9 = select i1 %8, i32 1, i32 %7, !dbg !455
  store i32 %9, i32* %h.addr, align 4, !dbg !454
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !457, metadata !DIExpression()), !dbg !454
  %10 = load i32, i32* %h.addr, align 4, !dbg !459
  %11 = lshr i32 %10, 24, !dbg !459
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !458
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !460, metadata !DIExpression()), !dbg !458
  %12 = load i32, i32* %h.addr, align 4, !dbg !463
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !462
  store i32 %13, i32* %bucket.addr, align 4, !dbg !461
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !465, metadata !DIExpression()), !dbg !461
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !466
  %15 = load i64, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !466
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !466
  %17 = load i8*, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !466
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !466
  %19 = load i64, i64* %18, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !466
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !466
  %21 = load i8*, i8** %20, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !466
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !466
  %23 = load i64, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !466
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !466
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !466
  br label %while.cond, !dbg !466

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !470
  %27 = icmp sge i32 %26, 0, !dbg !470
  br i1 %27, label %land.rhs, label %land.end, !dbg !470

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !472
  %29 = trunc i64 %15 to i32, !dbg !467
  %30 = icmp slt i32 %28, %29, !dbg !472
  br label %land.end, !dbg !470

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !470
  br i1 %31, label %while.body, label %while.end, !dbg !466

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !477
  %33 = sext i32 %32 to i64, !dbg !476
  %34 = bitcast i8* %17 to i32*, !dbg !476
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !476
  %36 = load i32, i32* %35, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !476
  store i32 %36, i32* %word.addr, align 4, !dbg !475
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !478, metadata !DIExpression()), !dbg !475
  %37 = load i32, i32* %word.addr, align 4, !dbg !480
  %38 = icmp eq i32 %37, 0, !dbg !480
  br i1 %38, label %if.then, label %if.end, !dbg !479

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !485
  %40 = load i32, i32* %h.addr, align 4, !dbg !486
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !484
  ret i64 %41, !dbg !483

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !488
  %43 = lshr i32 %42, 24, !dbg !488
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !489
  %45 = icmp eq i32 %43, %44, !dbg !488
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !487

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !493
  %47 = and i32 %46, 16777215, !dbg !493
  %48 = sub nsw i32 %47, 1, !dbg !492
  store i32 %48, i32* %at.addr, align 4, !dbg !491
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !496, metadata !DIExpression()), !dbg !491
  %49 = load i32, i32* %at.addr, align 4, !dbg !498
  %50 = icmp sge i32 %49, 0, !dbg !498
  br i1 %50, label %land.rhs.4, label %land.end.4, !dbg !498

land.rhs.4:
  %51 = load i32, i32* %at.addr, align 4, !dbg !500
  %52 = trunc i64 %19 to i32, !dbg !468
  %53 = icmp slt i32 %51, %52, !dbg !500
  br label %land.end.4, !dbg !498

land.end.4:
  %54 = phi i1 [ false, %if.then.1 ], [ %53, %land.rhs.4 ], !dbg !498
  br i1 %54, label %land.rhs.3, label %land.end.3, !dbg !498

land.rhs.3:
  %55 = load i32, i32* %at.addr, align 4, !dbg !503
  %56 = sext i32 %55 to i64, !dbg !502
  %57 = bitcast i8* %21 to i32*, !dbg !502
  %58 = getelementptr inbounds i32, i32* %57, i64 %56, !dbg !502
  %59 = load i32, i32* %58, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !502
  %60 = load i32, i32* %h.addr, align 4, !dbg !504
  %61 = icmp eq i32 %59, %60, !dbg !502
  br label %land.end.3, !dbg !498

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %land.rhs.3 ], !dbg !498
  br i1 %62, label %land.rhs.2, label %land.end.2, !dbg !498

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4, !dbg !505
  %64 = trunc i64 %23 to i32, !dbg !469
  %65 = icmp slt i32 %63, %64, !dbg !505
  br label %land.end.2, !dbg !498

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ], !dbg !498
  br i1 %66, label %land.rhs.1, label %land.end.1, !dbg !498

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4, !dbg !509
  %68 = sext i32 %67 to i64, !dbg !508
  %69 = bitcast i8* %25 to i32*, !dbg !508
  %70 = getelementptr inbounds i32, i32* %69, i64 %68, !dbg !508
  %71 = load i32, i32* %70, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !508
  %72 = icmp eq i32 %71, %key, !dbg !507
  br label %land.end.1, !dbg !498

land.end.1:
  %73 = phi i1 [ false, %land.end.2 ], [ %72, %land.rhs.1 ], !dbg !498
  br i1 %73, label %if.then.2, label %if.end.2, !dbg !497

if.then.2:
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !514
  %75 = load i32, i32* %at.addr, align 4, !dbg !515
  %76 = tail call i64 @nish.foundAt(i32 %74, i32 %75), !dbg !513
  ret i64 %76, !dbg !512

if.end.2:
  br label %if.end.1, !dbg !487

if.end.1:
  %77 = load i32, i32* %bucket.addr, align 4, !dbg !518
  %78 = add nsw i32 %77, 1, !dbg !518
  %79 = and i32 %78, %mask, !dbg !517
  store i32 %79, i32* %bucket.addr, align 4, !dbg !516
  br label %while.cond, !dbg !466

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !521
  call void @nish_exit(i32 1), !dbg !521
  unreachable, !dbg !521
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !525 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !527, metadata !DIExpression()), !dbg !526
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !528, metadata !DIExpression()), !dbg !526
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !531
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !531
  %2 = trunc i64 %1 to i32, !dbg !531
  store i32 %2, i32* %used.addr, align 4, !dbg !529
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !532, metadata !DIExpression()), !dbg !529
  store i32 0, i32* %to.addr, align 4, !dbg !533
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !535, metadata !DIExpression()), !dbg !533
  store i32 0, i32* %from.addr, align 4, !dbg !536
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !538, metadata !DIExpression()), !dbg !536
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !536
  %4 = load i64, i64* %3, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !536
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !536
  %6 = load i8*, i8** %5, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !536
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !536
  %8 = load i64, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !536
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !536
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !536
  br label %for.cond, !dbg !536

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !541
  %12 = load i32, i32* %used.addr, align 4, !dbg !542
  %13 = icmp slt i32 %11, %12, !dbg !541
  br i1 %13, label %land.rhs, label %land.end, !dbg !541

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !543
  %15 = trunc i64 %4 to i32, !dbg !539
  %16 = icmp slt i32 %14, %15, !dbg !543
  br label %land.end, !dbg !541

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !541
  br i1 %17, label %for.body, label %for.end, !dbg !536

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !548
  %19 = sext i32 %18 to i64, !dbg !547
  %20 = bitcast i8* %6 to i32*, !dbg !547
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !547
  %22 = load i32, i32* %21, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !547
  %23 = icmp ne i32 %22, 0, !dbg !547
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !547

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !550
  %25 = icmp sge i32 %24, 0, !dbg !550
  br label %land.end.3, !dbg !547

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !547
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !547

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !552
  %28 = load i32, i32* %used.addr, align 4, !dbg !553
  %29 = icmp slt i32 %27, %28, !dbg !552
  br label %land.end.2, !dbg !547

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !547
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !547

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !554
  %32 = trunc i64 %8 to i32, !dbg !540
  %33 = icmp slt i32 %31, %32, !dbg !554
  br label %land.end.1, !dbg !547

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !547
  br i1 %34, label %if.then, label %if.end, !dbg !546

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !558
  %36 = sext i32 %35 to i64, !dbg !557
  %37 = load i32, i32* %from.addr, align 4, !dbg !560
  %38 = sext i32 %37 to i64, !dbg !559
  %39 = bitcast i8* %10 to i32*, !dbg !559
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !559
  %41 = load i32, i32* %40, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !559
  %42 = bitcast i8* %10 to i32*, !dbg !557
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !557
  store i32 %41, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !557
  %44 = load i32, i32* %to.addr, align 4, !dbg !561
  %45 = add nsw i32 %44, 1, !dbg !561
  store i32 %45, i32* %to.addr, align 4, !dbg !561
  br label %if.end, !dbg !546

if.end:
  br label %for.inc, !dbg !536

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !562
  %47 = add nsw i32 %46, 1, !dbg !562
  store i32 %47, i32* %from.addr, align 4, !dbg !562
  br label %for.cond, !dbg !536

for.end:
  br label %while.cond, !dbg !563

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !565
  %49 = load i64, i64* %48, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !565
  %50 = trunc i64 %49 to i32, !dbg !565
  %51 = load i32, i32* %to.addr, align 4, !dbg !566
  %52 = icmp sgt i32 %50, %51, !dbg !564
  br i1 %52, label %while.body, label %while.end, !dbg !563

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !568
  %54 = load i64, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !568
  %55 = icmp eq i64 %54, 0, !dbg !568
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !568

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !568
  unreachable, !dbg !568

pop.ok:
  %56 = sub i64 %54, 1, !dbg !568
  store i64 %56, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !568
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !568
  %58 = load i8*, i8** %57, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !568
  %59 = bitcast i8* %58 to i32*, !dbg !568
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !568
  %61 = load i32, i32* %60, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !568
  br label %while.cond, !dbg !563

while.end:
  ret void, !dbg !526
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 357, size: 320, align: 64, elements: !36)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 359, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 360, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 361, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 362, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 363, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 364, baseType: !23, size: 64, offset: 256)
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
!58 = distinct !DISubprogram(name: "homeBucket", linkageName: "nish.homeBucket", scope: !13, file: !13, line: 74, type: !57, scopeLine: 74, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!59 = !DILocation(line: 74, column: 1, scope: !58)
!60 = !DILocalVariable(name: "h", arg: 1, scope: !58, file: !13, line: 74, type: !19)
!61 = !DILocalVariable(name: "mask", arg: 2, scope: !58, file: !13, line: 74, type: !4)
!62 = !DILocation(line: 74, column: 48, scope: !58)
!63 = !DILocation(line: 74, column: 54, scope: !58)
!64 = !DILocation(line: 74, column: 58, scope: !58)
!65 = !DILocation(line: 74, column: 59, scope: !58)
!66 = !DILocation(line: 74, column: 72, scope: !58)
!67 = !{!19, !19, !4}
!68 = !DISubroutineType(types: !67)
!69 = distinct !DISubprogram(name: "slotWord", linkageName: "nish.slotWord", scope: !13, file: !13, line: 77, type: !68, scopeLine: 77, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!70 = !DILocation(line: 77, column: 1, scope: !69)
!71 = !DILocalVariable(name: "h", arg: 1, scope: !69, file: !13, line: 77, type: !19)
!72 = !DILocalVariable(name: "index", arg: 2, scope: !69, file: !13, line: 77, type: !4)
!73 = !DILocation(line: 77, column: 47, scope: !69)
!74 = !DILocation(line: 77, column: 48, scope: !69)
!75 = !DILocation(line: 77, column: 49, scope: !69)
!76 = !DILocation(line: 77, column: 68, scope: !69)
!77 = !DILocation(line: 77, column: 74, scope: !69)
!78 = !DILocation(line: 77, column: 82, scope: !69)
!79 = !{!16, !4, !4}
!80 = !DISubroutineType(types: !79)
!81 = distinct !DISubprogram(name: "foundAt", linkageName: "nish.foundAt", scope: !13, file: !13, line: 80, type: !80, scopeLine: 80, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!82 = !DILocation(line: 80, column: 1, scope: !81)
!83 = !DILocalVariable(name: "bucket", arg: 1, scope: !81, file: !13, line: 80, type: !4)
!84 = !DILocalVariable(name: "index", arg: 2, scope: !81, file: !13, line: 80, type: !4)
!85 = !DILocation(line: 80, column: 51, scope: !81)
!86 = !DILocation(line: 80, column: 52, scope: !81)
!87 = !DILocation(line: 80, column: 58, scope: !81)
!88 = !DILocation(line: 80, column: 75, scope: !81)
!89 = !DILocation(line: 80, column: 81, scope: !81)
!90 = !{!16, !4, !19}
!91 = !DISubroutineType(types: !90)
!92 = distinct !DISubprogram(name: "absentAt", linkageName: "nish.absentAt", scope: !13, file: !13, line: 83, type: !91, scopeLine: 83, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!93 = !DILocation(line: 83, column: 1, scope: !92)
!94 = !DILocalVariable(name: "bucket", arg: 1, scope: !92, file: !13, line: 83, type: !4)
!95 = !DILocalVariable(name: "h", arg: 2, scope: !92, file: !13, line: 83, type: !19)
!96 = !DILocation(line: 83, column: 48, scope: !92)
!97 = !DILocation(line: 83, column: 54, scope: !92)
!98 = !DILocation(line: 83, column: 55, scope: !92)
!99 = !DILocation(line: 83, column: 60, scope: !92)
!100 = !DILocation(line: 83, column: 61, scope: !92)
!101 = !DILocation(line: 83, column: 62, scope: !92)
!102 = !DILocation(line: 83, column: 68, scope: !92)
!103 = !DILocation(line: 83, column: 85, scope: !92)
!104 = !DILocation(line: 83, column: 91, scope: !92)
!105 = !{null, !23, !4, !19, !4}
!106 = !DISubroutineType(types: !105)
!107 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 119, type: !106, scopeLine: 119, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!108 = !DILocation(line: 119, column: 1, scope: !107)
!109 = !DILocalVariable(name: "slots", arg: 1, scope: !107, file: !13, line: 119, type: !23)
!110 = !DILocalVariable(name: "mask", arg: 2, scope: !107, file: !13, line: 119, type: !4)
!111 = !DILocalVariable(name: "h", arg: 3, scope: !107, file: !13, line: 119, type: !19)
!112 = !DILocalVariable(name: "index", arg: 4, scope: !107, file: !13, line: 119, type: !4)
!113 = !DILocation(line: 120, column: 3, scope: !107)
!114 = !DILocation(line: 120, column: 16, scope: !107)
!115 = !DILocation(line: 120, column: 25, scope: !107)
!116 = !DILocation(line: 120, column: 28, scope: !107)
!117 = !DILocalVariable(name: "word", scope: !107, file: !13, line: 120, type: !19)
!118 = !DILocation(line: 121, column: 3, scope: !107)
!119 = !DILocation(line: 121, column: 16, scope: !107)
!120 = !DILocation(line: 121, column: 27, scope: !107)
!121 = !DILocation(line: 121, column: 30, scope: !107)
!122 = !DILocalVariable(name: "bucket", scope: !107, file: !13, line: 121, type: !4)
!123 = !DILocation(line: 122, column: 3, scope: !107)
!124 = !DILocation(line: 122, column: 40, scope: !107)
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
!135 = !DILocation(line: 122, column: 10, scope: !107)
!136 = !DILocation(line: 122, column: 20, scope: !107)
!137 = !DILocation(line: 122, column: 25, scope: !107)
!138 = !DILocation(line: 122, column: 34, scope: !107)
!139 = !DILocation(line: 122, column: 55, scope: !107)
!140 = !DILocation(line: 123, column: 5, scope: !107)
!141 = !DILocation(line: 123, column: 9, scope: !107)
!142 = !DILocation(line: 123, column: 15, scope: !107)
!143 = !{!"element i32", !45, i64 0}
!144 = !{!143, !143, i64 0}
!145 = !DILocation(line: 123, column: 27, scope: !107)
!146 = !DILocation(line: 123, column: 30, scope: !107)
!147 = !DILocation(line: 124, column: 7, scope: !107)
!148 = !DILocation(line: 124, column: 13, scope: !107)
!149 = !DILocation(line: 124, column: 23, scope: !107)
!150 = !DILocation(line: 125, column: 7, scope: !107)
!151 = !DILocation(line: 127, column: 5, scope: !107)
!152 = !DILocation(line: 127, column: 14, scope: !107)
!153 = !DILocation(line: 127, column: 15, scope: !107)
!154 = !DILocation(line: 127, column: 24, scope: !107)
!155 = !DILocation(line: 127, column: 29, scope: !107)
!156 = !{null, !23}
!157 = !DISubroutineType(types: !156)
!158 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 147, type: !157, scopeLine: 147, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!159 = !DILocation(line: 147, column: 1, scope: !158)
!160 = !DILocalVariable(name: "hashes", arg: 1, scope: !158, file: !13, line: 147, type: !23)
!161 = !DILocation(line: 148, column: 3, scope: !158)
!162 = !DILocation(line: 148, column: 16, scope: !158)
!163 = !DILocation(line: 148, column: 22, scope: !158)
!164 = !DILocalVariable(name: "used", scope: !158, file: !13, line: 148, type: !4)
!165 = !DILocation(line: 149, column: 3, scope: !158)
!166 = !DILocation(line: 149, column: 17, scope: !158)
!167 = !DILocalVariable(name: "to", scope: !158, file: !13, line: 149, type: !4)
!168 = !DILocation(line: 150, column: 3, scope: !158)
!169 = !DILocation(line: 150, column: 24, scope: !158)
!170 = !DILocalVariable(name: "from", scope: !158, file: !13, line: 150, type: !4)
!171 = !DILocation(line: 151, column: 15, scope: !158)
!172 = !DILocation(line: 150, column: 27, scope: !158)
!173 = !DILocation(line: 150, column: 34, scope: !158)
!174 = !DILocation(line: 150, column: 48, scope: !158)
!175 = !DILocation(line: 151, column: 5, scope: !158)
!176 = !DILocation(line: 151, column: 22, scope: !158)
!177 = !DILocalVariable(name: "h", scope: !158, file: !13, line: 151, type: !19)
!178 = !DILocation(line: 152, column: 5, scope: !158)
!179 = !DILocation(line: 152, column: 9, scope: !158)
!180 = !DILocation(line: 152, column: 15, scope: !158)
!181 = !DILocation(line: 152, column: 20, scope: !158)
!182 = !DILocation(line: 152, column: 26, scope: !158)
!183 = !DILocation(line: 152, column: 31, scope: !158)
!184 = !DILocation(line: 152, column: 36, scope: !158)
!185 = !DILocation(line: 152, column: 42, scope: !158)
!186 = !DILocation(line: 153, column: 7, scope: !158)
!187 = !DILocation(line: 153, column: 14, scope: !158)
!188 = !DILocation(line: 153, column: 20, scope: !158)
!189 = !DILocation(line: 154, column: 7, scope: !158)
!190 = !DILocation(line: 150, column: 40, scope: !158)
!191 = !DILocation(line: 157, column: 3, scope: !158)
!192 = !DILocation(line: 157, column: 10, scope: !158)
!193 = !DILocation(line: 157, column: 16, scope: !158)
!194 = !DILocation(line: 157, column: 33, scope: !158)
!195 = !DILocation(line: 157, column: 37, scope: !158)
!196 = !DILocation(line: 158, column: 5, scope: !158)
!197 = !{!23, !23, !4, !4}
!198 = !DISubroutineType(types: !197)
!199 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 169, type: !198, scopeLine: 169, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!200 = !DILocation(line: 169, column: 1, scope: !199)
!201 = !DILocalVariable(name: "slots", arg: 1, scope: !199, file: !13, line: 169, type: !23)
!202 = !DILocalVariable(name: "live", arg: 2, scope: !199, file: !13, line: 169, type: !4)
!203 = !DILocalVariable(name: "used", arg: 3, scope: !199, file: !13, line: 169, type: !4)
!204 = !DILocation(line: 170, column: 3, scope: !199)
!205 = !DILocation(line: 170, column: 13, scope: !199)
!206 = !DILocation(line: 170, column: 19, scope: !199)
!207 = !DILocalVariable(name: "n", scope: !199, file: !13, line: 170, type: !4)
!208 = !DILocation(line: 171, column: 3, scope: !199)
!209 = !DILocation(line: 171, column: 7, scope: !199)
!210 = !DILocation(line: 171, column: 14, scope: !199)
!211 = !DILocation(line: 171, column: 18, scope: !199)
!212 = !DILocation(line: 171, column: 24, scope: !199)
!213 = !DILocation(line: 172, column: 5, scope: !199)
!214 = !DILocation(line: 172, column: 16, scope: !199)
!215 = !DILocation(line: 173, column: 5, scope: !199)
!216 = !DILocation(line: 173, column: 12, scope: !199)
!217 = !DILocation(line: 175, column: 3, scope: !199)
!218 = !DILocation(line: 175, column: 10, scope: !199)
!219 = !DILocation(line: 175, column: 25, scope: !199)
!220 = !DILocation(line: 175, column: 29, scope: !199)
!221 = !{!132, !130, i64 8}
!222 = !{null, !23, !23}
!223 = !DISubroutineType(types: !222)
!224 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 179, type: !223, scopeLine: 179, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!225 = !DILocation(line: 179, column: 1, scope: !224)
!226 = !DILocalVariable(name: "slots", arg: 1, scope: !224, file: !13, line: 179, type: !23)
!227 = !DILocalVariable(name: "hashes", arg: 2, scope: !224, file: !13, line: 179, type: !23)
!228 = !DILocation(line: 180, column: 3, scope: !224)
!229 = !DILocation(line: 180, column: 16, scope: !224)
!230 = !DILocation(line: 180, column: 22, scope: !224)
!231 = !DILocation(line: 180, column: 38, scope: !224)
!232 = !DILocalVariable(name: "mask", scope: !224, file: !13, line: 180, type: !4)
!233 = !DILocation(line: 181, column: 3, scope: !224)
!234 = !DILocation(line: 181, column: 21, scope: !224)
!235 = !DILocalVariable(name: "i", scope: !224, file: !13, line: 181, type: !4)
!236 = !DILocation(line: 181, column: 34, scope: !224)
!237 = !DILocation(line: 181, column: 24, scope: !224)
!238 = !DILocation(line: 181, column: 28, scope: !224)
!239 = !DILocation(line: 181, column: 55, scope: !224)
!240 = !DILocation(line: 182, column: 5, scope: !224)
!241 = !DILocation(line: 182, column: 15, scope: !224)
!242 = !DILocation(line: 182, column: 22, scope: !224)
!243 = !DILocation(line: 182, column: 28, scope: !224)
!244 = !DILocation(line: 182, column: 35, scope: !224)
!245 = !DILocation(line: 182, column: 39, scope: !224)
!246 = !DILocation(line: 181, column: 50, scope: !224)
!247 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 203, type: !157, scopeLine: 203, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!248 = !DILocation(line: 203, column: 1, scope: !247)
!249 = !DILocalVariable(name: "slots", arg: 1, scope: !247, file: !13, line: 203, type: !23)
!250 = !DILocation(line: 204, column: 3, scope: !247)
!251 = !DILocation(line: 204, column: 21, scope: !247)
!252 = !DILocalVariable(name: "i", scope: !247, file: !13, line: 204, type: !4)
!253 = !DILocation(line: 204, column: 34, scope: !247)
!254 = !DILocation(line: 204, column: 24, scope: !247)
!255 = !DILocation(line: 204, column: 28, scope: !247)
!256 = !DILocation(line: 204, column: 54, scope: !247)
!257 = !DILocation(line: 205, column: 5, scope: !247)
!258 = !DILocation(line: 205, column: 11, scope: !247)
!259 = !DILocation(line: 205, column: 16, scope: !247)
!260 = !DILocation(line: 204, column: 49, scope: !247)
!261 = !{null, !23, !4, !4, !19, !4}
!262 = !DISubroutineType(types: !261)
!263 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 221, type: !262, scopeLine: 221, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!264 = !DILocation(line: 221, column: 1, scope: !263)
!265 = !DILocalVariable(name: "slots", arg: 1, scope: !263, file: !13, line: 221, type: !23)
!266 = !DILocalVariable(name: "mask", arg: 2, scope: !263, file: !13, line: 221, type: !4)
!267 = !DILocalVariable(name: "bucket", arg: 3, scope: !263, file: !13, line: 221, type: !4)
!268 = !DILocalVariable(name: "h", arg: 4, scope: !263, file: !13, line: 221, type: !19)
!269 = !DILocalVariable(name: "used", arg: 5, scope: !263, file: !13, line: 221, type: !4)
!270 = !DILocation(line: 222, column: 3, scope: !263)
!271 = !DILocation(line: 222, column: 7, scope: !263)
!272 = !DILocation(line: 222, column: 17, scope: !263)
!273 = !DILocation(line: 222, column: 22, scope: !263)
!274 = !DILocation(line: 222, column: 31, scope: !263)
!275 = !DILocation(line: 222, column: 37, scope: !263)
!276 = !DILocation(line: 222, column: 52, scope: !263)
!277 = !DILocation(line: 223, column: 5, scope: !263)
!278 = !DILocation(line: 223, column: 11, scope: !263)
!279 = !DILocation(line: 223, column: 21, scope: !263)
!280 = !DILocation(line: 223, column: 30, scope: !263)
!281 = !DILocation(line: 223, column: 33, scope: !263)
!282 = !DILocation(line: 223, column: 40, scope: !263)
!283 = !DILocation(line: 224, column: 10, scope: !263)
!284 = !DILocation(line: 225, column: 5, scope: !263)
!285 = !DILocation(line: 225, column: 15, scope: !263)
!286 = !DILocation(line: 225, column: 22, scope: !263)
!287 = !DILocation(line: 225, column: 28, scope: !263)
!288 = !DILocation(line: 225, column: 31, scope: !263)
!289 = !DILocation(line: 225, column: 38, scope: !263)
!290 = !{null, !12}
!291 = !DISubroutineType(types: !290)
!292 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 366, type: !291, scopeLine: 366, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!293 = !DILocation(line: 366, column: 3, scope: !292)
!294 = !DILocalVariable(name: "this", arg: 1, scope: !292, file: !13, line: 366, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!295 = !{!48, !46, i64 16}
!296 = !{!48, !46, i64 20}
!297 = !DILocation(line: 367, column: 5, scope: !292)
!298 = !DILocation(line: 367, column: 18, scope: !292)
!299 = !DILocation(line: 367, column: 33, scope: !292)
!300 = !{!48, !47, i64 8}
!301 = !DILocation(line: 368, column: 5, scope: !292)
!302 = !DILocation(line: 368, column: 22, scope: !292)
!303 = !{!48, !47, i64 24}
!304 = !DILocation(line: 369, column: 5, scope: !292)
!305 = !DILocation(line: 369, column: 24, scope: !292)
!306 = !{!48, !47, i64 32}
!307 = !{!16, !12, !4}
!308 = !DISubroutineType(types: !307)
!309 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 372, type: !308, scopeLine: 372, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!310 = !DILocation(line: 372, column: 3, scope: !309)
!311 = !DILocalVariable(name: "this", arg: 1, scope: !309, file: !13, line: 372, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!312 = !DILocalVariable(name: "key", arg: 2, scope: !309, file: !13, line: 372, type: !4)
!313 = !DILocation(line: 373, column: 5, scope: !309)
!314 = !DILocation(line: 373, column: 12, scope: !309)
!315 = !DILocation(line: 373, column: 23, scope: !309)
!316 = !DILocation(line: 373, column: 35, scope: !309)
!317 = !DILocation(line: 373, column: 46, scope: !309)
!318 = !DILocation(line: 373, column: 64, scope: !309)
!319 = !DILocation(line: 373, column: 80, scope: !309)
!320 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!321 = !{!320, !12, !4}
!322 = !DISubroutineType(types: !321)
!323 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 376, type: !322, scopeLine: 376, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!324 = !DILocation(line: 376, column: 3, scope: !323)
!325 = !DILocalVariable(name: "this", arg: 1, scope: !323, file: !13, line: 376, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!326 = !DILocalVariable(name: "key", arg: 2, scope: !323, file: !13, line: 376, type: !4)
!327 = !DILocation(line: 377, column: 5, scope: !323)
!328 = !DILocation(line: 377, column: 12, scope: !323)
!329 = !DILocation(line: 377, column: 23, scope: !323)
!330 = !DILocation(line: 377, column: 31, scope: !323)
!331 = !{!12, !12, !4}
!332 = !DISubroutineType(types: !331)
!333 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 381, type: !332, scopeLine: 381, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!334 = !DILocation(line: 381, column: 3, scope: !333)
!335 = !DILocalVariable(name: "this", arg: 1, scope: !333, file: !13, line: 381, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!336 = !DILocalVariable(name: "key", arg: 2, scope: !333, file: !13, line: 381, type: !4)
!337 = !DILocation(line: 382, column: 5, scope: !333)
!338 = !DILocation(line: 382, column: 19, scope: !333)
!339 = !DILocation(line: 382, column: 30, scope: !333)
!340 = !DILocalVariable(name: "found", scope: !333, file: !13, line: 382, type: !16)
!341 = !DILocation(line: 383, column: 5, scope: !333)
!342 = !DILocation(line: 383, column: 9, scope: !333)
!343 = !DILocation(line: 383, column: 17, scope: !333)
!344 = !DILocation(line: 383, column: 20, scope: !333)
!345 = !DILocation(line: 384, column: 7, scope: !333)
!346 = !DILocation(line: 384, column: 21, scope: !333)
!347 = !DILocation(line: 384, column: 28, scope: !333)
!348 = !DILocation(line: 386, column: 5, scope: !333)
!349 = !DILocation(line: 386, column: 12, scope: !333)
!350 = !{null, !12, !16, !4}
!351 = !DISubroutineType(types: !350)
!352 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 408, type: !351, scopeLine: 408, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!353 = !DILocation(line: 408, column: 3, scope: !352)
!354 = !DILocalVariable(name: "this", arg: 1, scope: !352, file: !13, line: 408, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!355 = !DILocalVariable(name: "absent", arg: 2, scope: !352, file: !13, line: 408, type: !16)
!356 = !DILocalVariable(name: "key", arg: 3, scope: !352, file: !13, line: 408, type: !4)
!357 = !DILocation(line: 409, column: 5, scope: !352)
!358 = !DILocation(line: 409, column: 20, scope: !352)
!359 = !DILocation(line: 409, column: 21, scope: !352)
!360 = !DILocation(line: 409, column: 25, scope: !352)
!361 = !DILocalVariable(name: "packed", scope: !352, file: !13, line: 409, type: !16)
!362 = !DILocation(line: 410, column: 5, scope: !352)
!363 = !DILocation(line: 410, column: 18, scope: !352)
!364 = !DILocation(line: 410, column: 24, scope: !352)
!365 = !DILocalVariable(name: "bucket", scope: !352, file: !13, line: 410, type: !4)
!366 = !DILocation(line: 411, column: 5, scope: !352)
!367 = !DILocation(line: 411, column: 15, scope: !352)
!368 = !DILocation(line: 411, column: 21, scope: !352)
!369 = !DILocalVariable(name: "h", scope: !352, file: !13, line: 411, type: !19)
!370 = !DILocation(line: 412, column: 5, scope: !352)
!371 = !DILocation(line: 412, column: 9, scope: !352)
!372 = !DILocation(line: 412, column: 15, scope: !352)
!373 = !DILocation(line: 412, column: 41, scope: !352)
!374 = !DILocation(line: 412, column: 52, scope: !352)
!375 = !DILocation(line: 413, column: 7, scope: !352)
!376 = !DILocation(line: 413, column: 11, scope: !352)
!377 = !DILocation(line: 413, column: 24, scope: !352)
!378 = !DILocation(line: 413, column: 35, scope: !352)
!379 = !DILocation(line: 414, column: 9, scope: !352)
!380 = !DILocation(line: 414, column: 15, scope: !352)
!381 = !DILocation(line: 416, column: 7, scope: !352)
!382 = !DILocation(line: 417, column: 7, scope: !352)
!383 = !DILocation(line: 417, column: 16, scope: !352)
!384 = !DILocation(line: 417, column: 17, scope: !352)
!385 = !DILocation(line: 419, column: 5, scope: !352)
!386 = !DILocation(line: 419, column: 25, scope: !352)
!387 = !DILocation(line: 420, column: 5, scope: !352)
!388 = !DILocation(line: 420, column: 27, scope: !352)
!389 = !DILocation(line: 421, column: 5, scope: !352)
!390 = !DILocation(line: 421, column: 17, scope: !352)
!391 = !DILocation(line: 421, column: 29, scope: !352)
!392 = !DILocation(line: 422, column: 5, scope: !352)
!393 = !DILocation(line: 422, column: 17, scope: !352)
!394 = !DILocation(line: 422, column: 29, scope: !352)
!395 = !DILocation(line: 425, column: 5, scope: !352)
!396 = !DILocation(line: 425, column: 18, scope: !352)
!397 = !DILocation(line: 425, column: 24, scope: !352)
!398 = !DILocalVariable(name: "used", scope: !352, file: !13, line: 425, type: !4)
!399 = !DILocation(line: 426, column: 5, scope: !352)
!400 = !DILocation(line: 426, column: 9, scope: !352)
!401 = !DILocation(line: 426, column: 16, scope: !352)
!402 = !DILocation(line: 426, column: 20, scope: !352)
!403 = !DILocation(line: 426, column: 26, scope: !352)
!404 = !DILocation(line: 426, column: 47, scope: !352)
!405 = !DILocation(line: 426, column: 50, scope: !352)
!406 = !DILocation(line: 427, column: 7, scope: !352)
!407 = !DILocation(line: 428, column: 12, scope: !352)
!408 = !DILocation(line: 429, column: 7, scope: !352)
!409 = !DILocation(line: 429, column: 20, scope: !352)
!410 = !DILocation(line: 429, column: 32, scope: !352)
!411 = !DILocation(line: 429, column: 43, scope: !352)
!412 = !DILocation(line: 429, column: 51, scope: !352)
!413 = !DILocation(line: 429, column: 54, scope: !352)
!414 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 433, type: !291, scopeLine: 433, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!415 = !DILocation(line: 433, column: 3, scope: !414)
!416 = !DILocalVariable(name: "this", arg: 1, scope: !414, file: !13, line: 433, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!417 = !DILocation(line: 434, column: 5, scope: !414)
!418 = !DILocation(line: 434, column: 18, scope: !414)
!419 = !DILocation(line: 434, column: 24, scope: !414)
!420 = !DILocalVariable(name: "used", scope: !414, file: !13, line: 434, type: !4)
!421 = !DILocation(line: 435, column: 5, scope: !414)
!422 = !DILocation(line: 435, column: 19, scope: !414)
!423 = !DILocation(line: 435, column: 32, scope: !414)
!424 = !DILocation(line: 435, column: 44, scope: !414)
!425 = !DILocation(line: 435, column: 55, scope: !414)
!426 = !DILocalVariable(name: "slots", scope: !414, file: !13, line: 435, type: !23)
!427 = !DILocation(line: 436, column: 5, scope: !414)
!428 = !DILocation(line: 436, column: 9, scope: !414)
!429 = !DILocation(line: 436, column: 21, scope: !414)
!430 = !DILocation(line: 436, column: 27, scope: !414)
!431 = !DILocation(line: 437, column: 7, scope: !414)
!432 = !DILocation(line: 437, column: 22, scope: !414)
!433 = !DILocation(line: 437, column: 38, scope: !414)
!434 = !DILocation(line: 438, column: 7, scope: !414)
!435 = !DILocation(line: 438, column: 21, scope: !414)
!436 = !DILocation(line: 440, column: 5, scope: !414)
!437 = !DILocation(line: 440, column: 18, scope: !414)
!438 = !DILocation(line: 441, column: 5, scope: !414)
!439 = !DILocation(line: 441, column: 17, scope: !414)
!440 = !DILocation(line: 441, column: 23, scope: !414)
!441 = !DILocation(line: 441, column: 39, scope: !414)
!442 = !DILocation(line: 442, column: 5, scope: !414)
!443 = !DILocation(line: 442, column: 12, scope: !414)
!444 = !DILocation(line: 442, column: 19, scope: !414)
!445 = !{!16, !23, !4, !23, !33, !4}
!446 = !DISubroutineType(types: !445)
!447 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 92, type: !446, scopeLine: 92, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!448 = !DILocation(line: 92, column: 1, scope: !447)
!449 = !DILocalVariable(name: "slots", arg: 1, scope: !447, file: !13, line: 92, type: !23)
!450 = !DILocalVariable(name: "mask", arg: 2, scope: !447, file: !13, line: 92, type: !4)
!451 = !DILocalVariable(name: "hashes", arg: 3, scope: !447, file: !13, line: 92, type: !23)
!452 = !DILocalVariable(name: "keys", arg: 4, scope: !447, file: !13, line: 92, type: !33)
!453 = !DILocalVariable(name: "key", arg: 5, scope: !447, file: !13, line: 92, type: !4)
!454 = !DILocation(line: 93, column: 3, scope: !447)
!455 = !DILocation(line: 93, column: 13, scope: !447)
!456 = !DILocation(line: 93, column: 21, scope: !447)
!457 = !DILocalVariable(name: "h", scope: !447, file: !13, line: 93, type: !19)
!458 = !DILocation(line: 94, column: 3, scope: !447)
!459 = !DILocation(line: 94, column: 23, scope: !447)
!460 = !DILocalVariable(name: "fingerprint", scope: !447, file: !13, line: 94, type: !19)
!461 = !DILocation(line: 95, column: 3, scope: !447)
!462 = !DILocation(line: 95, column: 16, scope: !447)
!463 = !DILocation(line: 95, column: 27, scope: !447)
!464 = !DILocation(line: 95, column: 30, scope: !447)
!465 = !DILocalVariable(name: "bucket", scope: !447, file: !13, line: 95, type: !4)
!466 = !DILocation(line: 98, column: 3, scope: !447)
!467 = !DILocation(line: 98, column: 40, scope: !447)
!468 = !DILocation(line: 105, column: 33, scope: !447)
!469 = !DILocation(line: 105, column: 82, scope: !447)
!470 = !DILocation(line: 98, column: 10, scope: !447)
!471 = !DILocation(line: 98, column: 20, scope: !447)
!472 = !DILocation(line: 98, column: 25, scope: !447)
!473 = !DILocation(line: 98, column: 34, scope: !447)
!474 = !DILocation(line: 98, column: 55, scope: !447)
!475 = !DILocation(line: 99, column: 5, scope: !447)
!476 = !DILocation(line: 99, column: 18, scope: !447)
!477 = !DILocation(line: 99, column: 24, scope: !447)
!478 = !DILocalVariable(name: "word", scope: !447, file: !13, line: 99, type: !19)
!479 = !DILocation(line: 100, column: 5, scope: !447)
!480 = !DILocation(line: 100, column: 9, scope: !447)
!481 = !DILocation(line: 100, column: 18, scope: !447)
!482 = !DILocation(line: 100, column: 21, scope: !447)
!483 = !DILocation(line: 101, column: 7, scope: !447)
!484 = !DILocation(line: 101, column: 14, scope: !447)
!485 = !DILocation(line: 101, column: 23, scope: !447)
!486 = !DILocation(line: 101, column: 31, scope: !447)
!487 = !DILocation(line: 103, column: 5, scope: !447)
!488 = !DILocation(line: 103, column: 9, scope: !447)
!489 = !DILocation(line: 103, column: 25, scope: !447)
!490 = !DILocation(line: 103, column: 38, scope: !447)
!491 = !DILocation(line: 104, column: 7, scope: !447)
!492 = !DILocation(line: 104, column: 18, scope: !447)
!493 = !DILocation(line: 104, column: 24, scope: !447)
!494 = !DILocation(line: 104, column: 31, scope: !447)
!495 = !DILocation(line: 104, column: 43, scope: !447)
!496 = !DILocalVariable(name: "at", scope: !447, file: !13, line: 104, type: !4)
!497 = !DILocation(line: 105, column: 7, scope: !447)
!498 = !DILocation(line: 105, column: 11, scope: !447)
!499 = !DILocation(line: 105, column: 17, scope: !447)
!500 = !DILocation(line: 105, column: 22, scope: !447)
!501 = !DILocation(line: 105, column: 27, scope: !447)
!502 = !DILocation(line: 105, column: 51, scope: !447)
!503 = !DILocation(line: 105, column: 58, scope: !447)
!504 = !DILocation(line: 105, column: 66, scope: !447)
!505 = !DILocation(line: 105, column: 71, scope: !447)
!506 = !DILocation(line: 105, column: 76, scope: !447)
!507 = !DILocation(line: 105, column: 98, scope: !447)
!508 = !DILocation(line: 105, column: 106, scope: !447)
!509 = !DILocation(line: 105, column: 111, scope: !447)
!510 = !DILocation(line: 105, column: 116, scope: !447)
!511 = !DILocation(line: 105, column: 122, scope: !447)
!512 = !DILocation(line: 106, column: 9, scope: !447)
!513 = !DILocation(line: 106, column: 16, scope: !447)
!514 = !DILocation(line: 106, column: 24, scope: !447)
!515 = !DILocation(line: 106, column: 32, scope: !447)
!516 = !DILocation(line: 109, column: 5, scope: !447)
!517 = !DILocation(line: 109, column: 14, scope: !447)
!518 = !DILocation(line: 109, column: 15, scope: !447)
!519 = !DILocation(line: 109, column: 24, scope: !447)
!520 = !DILocation(line: 109, column: 29, scope: !447)
!521 = !DILocation(line: 111, column: 3, scope: !447)
!522 = !DILocation(line: 111, column: 9, scope: !447)
!523 = !{null, !33, !23}
!524 = !DISubroutineType(types: !523)
!525 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 132, type: !524, scopeLine: 132, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!526 = !DILocation(line: 132, column: 1, scope: !525)
!527 = !DILocalVariable(name: "items", arg: 1, scope: !525, file: !13, line: 132, type: !33)
!528 = !DILocalVariable(name: "hashes", arg: 2, scope: !525, file: !13, line: 132, type: !23)
!529 = !DILocation(line: 133, column: 3, scope: !525)
!530 = !DILocation(line: 133, column: 16, scope: !525)
!531 = !DILocation(line: 133, column: 22, scope: !525)
!532 = !DILocalVariable(name: "used", scope: !525, file: !13, line: 133, type: !4)
!533 = !DILocation(line: 134, column: 3, scope: !525)
!534 = !DILocation(line: 134, column: 17, scope: !525)
!535 = !DILocalVariable(name: "to", scope: !525, file: !13, line: 134, type: !4)
!536 = !DILocation(line: 135, column: 3, scope: !525)
!537 = !DILocation(line: 135, column: 24, scope: !525)
!538 = !DILocalVariable(name: "from", scope: !525, file: !13, line: 135, type: !4)
!539 = !DILocation(line: 135, column: 55, scope: !525)
!540 = !DILocation(line: 136, column: 68, scope: !525)
!541 = !DILocation(line: 135, column: 27, scope: !525)
!542 = !DILocation(line: 135, column: 34, scope: !525)
!543 = !DILocation(line: 135, column: 42, scope: !525)
!544 = !DILocation(line: 135, column: 49, scope: !525)
!545 = !DILocation(line: 135, column: 79, scope: !525)
!546 = !DILocation(line: 136, column: 5, scope: !525)
!547 = !DILocation(line: 136, column: 9, scope: !525)
!548 = !DILocation(line: 136, column: 16, scope: !525)
!549 = !DILocation(line: 136, column: 26, scope: !525)
!550 = !DILocation(line: 136, column: 31, scope: !525)
!551 = !DILocation(line: 136, column: 37, scope: !525)
!552 = !DILocation(line: 136, column: 42, scope: !525)
!553 = !DILocation(line: 136, column: 47, scope: !525)
!554 = !DILocation(line: 136, column: 55, scope: !525)
!555 = !DILocation(line: 136, column: 62, scope: !525)
!556 = !DILocation(line: 136, column: 83, scope: !525)
!557 = !DILocation(line: 137, column: 7, scope: !525)
!558 = !DILocation(line: 137, column: 13, scope: !525)
!559 = !DILocation(line: 137, column: 19, scope: !525)
!560 = !DILocation(line: 137, column: 25, scope: !525)
!561 = !DILocation(line: 138, column: 7, scope: !525)
!562 = !DILocation(line: 135, column: 71, scope: !525)
!563 = !DILocation(line: 141, column: 3, scope: !525)
!564 = !DILocation(line: 141, column: 10, scope: !525)
!565 = !DILocation(line: 141, column: 16, scope: !525)
!566 = !DILocation(line: 141, column: 32, scope: !525)
!567 = !DILocation(line: 141, column: 36, scope: !525)
!568 = !DILocation(line: 142, column: 5, scope: !525)
