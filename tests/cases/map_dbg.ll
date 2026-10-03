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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
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
  %0 = sext i32 -1 to i64, !dbg !97
  %1 = sext i32 %bucket to i64, !dbg !101
  %2 = shl i64 %1, 32, !dbg !101
  %3 = zext i32 %h to i64, !dbg !103
  %4 = or i64 %2, %3, !dbg !100
  %5 = sub nsw i64 %0, %4, !dbg !97
  ret i64 %5, !dbg !94
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

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !224 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
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
  %11 = load i32, i32* %i.addr, align 4, !dbg !242
  %12 = sext i32 %11 to i64, !dbg !241
  %13 = bitcast i8* %7 to i32*, !dbg !241
  %14 = getelementptr inbounds i32, i32* %13, i64 %12, !dbg !241
  %15 = load i32, i32* %14, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !241
  store i32 %15, i32* %h.addr, align 4, !dbg !240
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !243, metadata !DIExpression()), !dbg !240
  %16 = load i32, i32* %h.addr, align 4, !dbg !245
  %17 = icmp ne i32 %16, 0, !dbg !245
  br i1 %17, label %if.then, label %if.end, !dbg !244

if.then:
  %18 = load i32, i32* %mask.addr, align 4, !dbg !250
  %19 = load i32, i32* %h.addr, align 4, !dbg !251
  %20 = load i32, i32* %i.addr, align 4, !dbg !252
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20), !dbg !248
  br label %if.end, !dbg !244

if.end:
  br label %for.inc, !dbg !233

for.inc:
  %21 = load i32, i32* %i.addr, align 4, !dbg !253
  %22 = add nsw i32 %21, 1, !dbg !253
  store i32 %22, i32* %i.addr, align 4, !dbg !253
  br label %for.cond, !dbg !233

for.end:
  ret void, !dbg !225
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 !dbg !254 {
entry:
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !256, metadata !DIExpression()), !dbg !255
  store i32 0, i32* %i.addr, align 4, !dbg !257
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !259, metadata !DIExpression()), !dbg !257
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !257
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !257
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !257
  %3 = load i8*, i8** %2, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !257
  br label %for.cond, !dbg !257

for.cond:
  %4 = load i32, i32* %i.addr, align 4, !dbg !261
  %5 = trunc i64 %1 to i32, !dbg !260
  %6 = icmp slt i32 %4, %5, !dbg !261
  br i1 %6, label %for.body, label %for.end, !dbg !257

for.body:
  %7 = load i32, i32* %i.addr, align 4, !dbg !265
  %8 = sext i32 %7 to i64, !dbg !264
  %9 = bitcast i8* %3 to i32*, !dbg !264
  %10 = getelementptr inbounds i32, i32* %9, i64 %8, !dbg !264
  store i32 0, i32* %10, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !264
  br label %for.inc, !dbg !257

for.inc:
  %11 = load i32, i32* %i.addr, align 4, !dbg !267
  %12 = add nsw i32 %11, 1, !dbg !267
  store i32 %12, i32* %i.addr, align 4, !dbg !267
  br label %for.cond, !dbg !257

for.end:
  ret void, !dbg !255
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 !dbg !270 {
entry:
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !272, metadata !DIExpression()), !dbg !271
  call void @llvm.dbg.value(metadata i32 %mask, metadata !273, metadata !DIExpression()), !dbg !271
  call void @llvm.dbg.value(metadata i32 %bucket, metadata !274, metadata !DIExpression()), !dbg !271
  call void @llvm.dbg.value(metadata i32 %h, metadata !275, metadata !DIExpression()), !dbg !271
  call void @llvm.dbg.value(metadata i32 %used, metadata !276, metadata !DIExpression()), !dbg !271
  %0 = icmp sge i32 %bucket, 0, !dbg !278
  br i1 %0, label %land.rhs, label %land.end, !dbg !278

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !282
  %2 = load i64, i64* %1, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !282
  %3 = trunc i64 %2 to i32, !dbg !282
  %4 = icmp slt i32 %bucket, %3, !dbg !280
  br label %land.end, !dbg !278

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ], !dbg !278
  br i1 %5, label %if.then, label %if.else, !dbg !277

if.then:
  %6 = sext i32 %bucket to i64, !dbg !284
  %7 = sub nsw i32 %used, 1, !dbg !288
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7), !dbg !286
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !284
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !284
  %11 = bitcast i8* %10 to i32*, !dbg !284
  %12 = getelementptr inbounds i32, i32* %11, i64 %6, !dbg !284
  store i32 %8, i32* %12, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !284
  br label %if.end, !dbg !277

if.else:
  %13 = sub nsw i32 %used, 1, !dbg !295
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13), !dbg !291
  br label %if.end, !dbg !277

if.end:
  ret void, !dbg !271
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 !dbg !299 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !301, metadata !DIExpression()), !dbg !300
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !300
  store i32 0, i32* %0, align 4, !tbaa !50, !dbg !300
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !300
  store i32 7, i32* %1, align 4, !tbaa !302, !dbg !300
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !300
  store i32 0, i32* %2, align 4, !tbaa !303, !dbg !300
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !300
  store i32 0, i32* %3, align 4, !tbaa !304, !dbg !300
  %4 = sext i32 8 to i64, !dbg !306
  %5 = call i8* @nish_alloc_struct(i64 24), !dbg !306
  %6 = bitcast i8* %5 to %struct.nish_array*, !dbg !306
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0, !dbg !306
  store i64 %4, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !306
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1, !dbg !306
  store i64 %4, i64* %8, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !306
  %9 = mul i64 %4, 4, !dbg !306
  %10 = call i8* @nish_alloc_struct(i64 %9), !dbg !306
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !129, !noalias !128, !dbg !306
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2, !dbg !306
  store i8* %10, i8** %11, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !306
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !305
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !308, !dbg !305
  %13 = call i8* @nish_alloc_struct(i64 24), !dbg !310
  %14 = bitcast i8* %13 to %struct.nish_array*, !dbg !310
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0, !dbg !310
  store i64 0, i64* %15, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !310
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1, !dbg !310
  store i64 0, i64* %16, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !310
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2, !dbg !310
  store i8* null, i8** %17, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !310
  %18 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !309
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !311, !dbg !309
  %19 = call i8* @nish_alloc_struct(i64 24), !dbg !313
  %20 = bitcast i8* %19 to %struct.nish_array*, !dbg !313
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !313
  store i64 0, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !313
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !313
  store i64 0, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !313
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !313
  store i8* null, i8** %23, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !313
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !312
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !314, !dbg !312
  ret void, !dbg !300
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !317 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !319, metadata !DIExpression()), !dbg !318
  call void @llvm.dbg.value(metadata i32 %key, metadata !320, metadata !DIExpression()), !dbg !318
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !323
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !308, !dbg !323
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !324
  %3 = load i32, i32* %2, align 4, !tbaa !302, !dbg !324
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !325
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !314, !dbg !325
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !326
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !311, !dbg !326
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !322
  ret i64 %8, !dbg !321
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 !dbg !331 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !333, metadata !DIExpression()), !dbg !332
  call void @llvm.dbg.value(metadata i32 %key, metadata !334, metadata !DIExpression()), !dbg !332
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !336
  %1 = icmp sge i64 %0, 0, !dbg !336
  ret i1 %1, !dbg !335
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) %this, i32 noundef %key) #0 !dbg !341 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !343, metadata !DIExpression()), !dbg !342
  call void @llvm.dbg.value(metadata i32 %key, metadata !344, metadata !DIExpression()), !dbg !342
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !346
  store i64 %0, i64* %found.addr, align 8, !dbg !345
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !348, metadata !DIExpression()), !dbg !345
  %1 = load i64, i64* %found.addr, align 8, !dbg !350
  %2 = icmp slt i64 %1, 0, !dbg !350
  br i1 %2, label %if.then, label %if.end, !dbg !349

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !354
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !353
  br label %if.end, !dbg !349

if.end:
  ret %struct.Set$i32* %this, !dbg !356
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !360 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !362, metadata !DIExpression()), !dbg !361
  call void @llvm.dbg.value(metadata i64 %absent, metadata !363, metadata !DIExpression()), !dbg !361
  call void @llvm.dbg.value(metadata i32 %key, metadata !364, metadata !DIExpression()), !dbg !361
  %0 = sub nsw i64 -1, %absent, !dbg !366
  store i64 %0, i64* %packed.addr, align 8, !dbg !365
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !368, metadata !DIExpression()), !dbg !365
  %1 = load i64, i64* %packed.addr, align 8, !dbg !371
  %2 = ashr i64 %1, 32, !dbg !371
  %3 = trunc i64 %2 to i32, !dbg !370
  store i32 %3, i32* %bucket.addr, align 4, !dbg !369
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !372, metadata !DIExpression()), !dbg !369
  %4 = load i64, i64* %packed.addr, align 8, !dbg !375
  %5 = trunc i64 %4 to i32, !dbg !374
  store i32 %5, i32* %h.addr, align 4, !dbg !373
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !376, metadata !DIExpression()), !dbg !373
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !379
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !311, !dbg !379
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0, !dbg !379
  %9 = load i64, i64* %8, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !379
  %10 = trunc i64 %9 to i32, !dbg !379
  %11 = icmp sge i32 %10, 16777215, !dbg !378
  br i1 %11, label %if.then, label %if.end, !dbg !377

if.then:
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !383
  %13 = load i32, i32* %12, align 4, !tbaa !303, !dbg !383
  %14 = icmp sge i32 %13, 16777215, !dbg !383
  br i1 %14, label %lor.end, label %lor.rhs, !dbg !383

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !385
  %16 = load i32, i32* %15, align 4, !tbaa !304, !dbg !385
  %17 = icmp sgt i32 %16, 0, !dbg !385
  br label %lor.end, !dbg !383

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ], !dbg !383
  br i1 %18, label %if.then.1, label %if.end.1, !dbg !382

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !388
  call void @nish_exit(i32 1), !dbg !388
  unreachable, !dbg !388

if.end.1:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !390
  store i32 -1, i32* %bucket.addr, align 4, !dbg !391
  br label %if.end, !dbg !377

if.end:
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !393
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !311, !dbg !393
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !393
  %22 = load i64, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !393
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !393
  %24 = load i64, i64* %23, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !393
  %25 = icmp eq i64 %22, %24, !dbg !393
  br i1 %25, label %push.grow, label %push.store, !dbg !393

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4), !dbg !393
  br label %push.store, !dbg !393

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !393
  %27 = load i8*, i8** %26, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !393
  %28 = bitcast i8* %27 to i32*, !dbg !393
  %29 = getelementptr inbounds i32, i32* %28, i64 %22, !dbg !393
  store i32 %key, i32* %29, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !393
  %30 = add i64 %22, 1, !dbg !393
  store i64 %30, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !393
  %31 = trunc i64 %30 to i32, !dbg !393
  %32 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !395
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !314, !dbg !395
  %34 = load i32, i32* %h.addr, align 4, !dbg !396
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0, !dbg !395
  %36 = load i64, i64* %35, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !395
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1, !dbg !395
  %38 = load i64, i64* %37, align 8, !alias.scope !128, !noalias !129, !tbaa !221, !dbg !395
  %39 = icmp eq i64 %36, %38, !dbg !395
  br i1 %39, label %push.grow.1, label %push.store.1, !dbg !395

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4), !dbg !395
  br label %push.store.1, !dbg !395

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2, !dbg !395
  %41 = load i8*, i8** %40, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !395
  %42 = bitcast i8* %41 to i32*, !dbg !395
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !395
  store i32 %34, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !395
  %44 = add i64 %36, 1, !dbg !395
  store i64 %44, i64* %35, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !395
  %45 = trunc i64 %44 to i32, !dbg !395
  %46 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !398
  %47 = load i32, i32* %46, align 4, !tbaa !303, !dbg !398
  %48 = add nsw i32 %47, 1, !dbg !398
  %49 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !397
  store i32 %48, i32* %49, align 4, !tbaa !303, !dbg !397
  %50 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !401
  %51 = load i32, i32* %50, align 4, !tbaa !50, !dbg !401
  %52 = add nsw i32 %51, 1, !dbg !401
  %53 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !400
  store i32 %52, i32* %53, align 4, !tbaa !50, !dbg !400
  %54 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !405
  %55 = load %struct.nish_array*, %struct.nish_array** %54, align 8, !tbaa !311, !dbg !405
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0, !dbg !405
  %57 = load i64, i64* %56, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !405
  %58 = trunc i64 %57 to i32, !dbg !405
  store i32 %58, i32* %used.addr, align 4, !dbg !403
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !406, metadata !DIExpression()), !dbg !403
  %59 = load i32, i32* %used.addr, align 4, !dbg !408
  %60 = mul nsw i32 %59, 4, !dbg !408
  %61 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !411
  %62 = load %struct.nish_array*, %struct.nish_array** %61, align 8, !tbaa !308, !dbg !411
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0, !dbg !411
  %64 = load i64, i64* %63, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !411
  %65 = trunc i64 %64 to i32, !dbg !411
  %66 = mul nsw i32 %65, 3, !dbg !410
  %67 = icmp sgt i32 %60, %66, !dbg !408
  br i1 %67, label %if.then.2, label %if.else, !dbg !407

if.then.2:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !414
  br label %if.end.2, !dbg !407

if.else:
  %68 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !417
  %69 = load %struct.nish_array*, %struct.nish_array** %68, align 8, !tbaa !308, !dbg !417
  %70 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !418
  %71 = load i32, i32* %70, align 4, !tbaa !302, !dbg !418
  %72 = load i32, i32* %bucket.addr, align 4, !dbg !419
  %73 = load i32, i32* %h.addr, align 4, !dbg !420
  %74 = load i32, i32* %used.addr, align 4, !dbg !421
  call void @nish.fileAppended(%struct.nish_array* %69, i32 %71, i32 %72, i32 %73, i32 %74), !dbg !416
  br label %if.end.2, !dbg !407

if.end.2:
  ret void, !dbg !361
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 !dbg !422 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !424, metadata !DIExpression()), !dbg !423
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !427
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !311, !dbg !427
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !427
  %3 = load i64, i64* %2, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !427
  %4 = trunc i64 %3 to i32, !dbg !427
  store i32 %4, i32* %used.addr, align 4, !dbg !425
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !428, metadata !DIExpression()), !dbg !425
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6, !dbg !430
  %6 = load i32, i32* %5, align 4, !tbaa !304, !dbg !430
  %7 = icmp sgt i32 %6, 0, !dbg !430
  store i1 %7, i1* %walking.addr, align 1, !dbg !429
  call void @llvm.dbg.declare(metadata i1* %walking.addr, metadata !432, metadata !DIExpression()), !dbg !429
  %8 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !435
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !308, !dbg !435
  %10 = load i1, i1* %walking.addr, align 1, !dbg !436
  br i1 %10, label %cond.true, label %cond.false, !dbg !436

cond.true:
  %11 = load i32, i32* %used.addr, align 4, !dbg !437
  br label %cond.end, !dbg !436

cond.false:
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !438
  %13 = load i32, i32* %12, align 4, !tbaa !303, !dbg !438
  br label %cond.end, !dbg !436

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ], !dbg !436
  %15 = load i32, i32* %used.addr, align 4, !dbg !439
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15), !dbg !434
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8, !dbg !433
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !440, metadata !DIExpression()), !dbg !433
  %17 = load i1, i1* %walking.addr, align 1, !dbg !443
  %18 = xor i1 %17, true, !dbg !442
  br i1 %18, label %land.rhs, label %land.end, !dbg !442

land.rhs:
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !444
  %20 = load i32, i32* %19, align 4, !tbaa !303, !dbg !444
  %21 = load i32, i32* %used.addr, align 4, !dbg !445
  %22 = icmp slt i32 %20, %21, !dbg !444
  br label %land.end, !dbg !442

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ], !dbg !442
  br i1 %23, label %if.then, label %if.end, !dbg !441

if.then:
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !448
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !311, !dbg !448
  %26 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !449
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !314, !dbg !449
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27), !dbg !447
  %28 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !451
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !314, !dbg !451
  call void @nish.compactHashes(%struct.nish_array* %29), !dbg !450
  br label %if.end, !dbg !441

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !453
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !452
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !308, !dbg !452
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !456
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0, !dbg !456
  %34 = load i64, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !456
  %35 = trunc i64 %34 to i32, !dbg !456
  %36 = sub nsw i32 %35, 1, !dbg !455
  %37 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !454
  store i32 %36, i32* %37, align 4, !tbaa !302, !dbg !454
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !459
  %39 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !460
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !314, !dbg !460
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40), !dbg !458
  ret void, !dbg !423
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !463 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !465, metadata !DIExpression()), !dbg !464
  call void @llvm.dbg.value(metadata i32 %mask, metadata !466, metadata !DIExpression()), !dbg !464
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !467, metadata !DIExpression()), !dbg !464
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !468, metadata !DIExpression()), !dbg !464
  call void @llvm.dbg.value(metadata i32 %key, metadata !469, metadata !DIExpression()), !dbg !464
  %0 = lshr i32 %key, 16, !dbg !471
  %1 = xor i32 %key, %0, !dbg !471
  %2 = mul i32 %1, -2048144789, !dbg !471
  %3 = lshr i32 %2, 13, !dbg !471
  %4 = xor i32 %2, %3, !dbg !471
  %5 = mul i32 %4, -1028477387, !dbg !471
  %6 = lshr i32 %5, 16, !dbg !471
  %7 = xor i32 %5, %6, !dbg !471
  %8 = icmp eq i32 %7, 0, !dbg !471
  %9 = select i1 %8, i32 1, i32 %7, !dbg !471
  store i32 %9, i32* %h.addr, align 4, !dbg !470
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !473, metadata !DIExpression()), !dbg !470
  %10 = load i32, i32* %h.addr, align 4, !dbg !475
  %11 = lshr i32 %10, 24, !dbg !475
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !474
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !476, metadata !DIExpression()), !dbg !474
  %12 = load i32, i32* %h.addr, align 4, !dbg !479
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !478
  store i32 %13, i32* %bucket.addr, align 4, !dbg !477
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !481, metadata !DIExpression()), !dbg !477
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !482
  %15 = load i64, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !482
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !482
  %17 = load i8*, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !482
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !482
  %19 = load i64, i64* %18, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !482
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !482
  %21 = load i8*, i8** %20, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !482
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !482
  %23 = load i64, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !482
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !482
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !482
  br label %while.cond, !dbg !482

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !486
  %27 = icmp sge i32 %26, 0, !dbg !486
  br i1 %27, label %land.rhs, label %land.end, !dbg !486

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !488
  %29 = trunc i64 %15 to i32, !dbg !483
  %30 = icmp slt i32 %28, %29, !dbg !488
  br label %land.end, !dbg !486

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !486
  br i1 %31, label %while.body, label %while.end, !dbg !482

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !493
  %33 = sext i32 %32 to i64, !dbg !492
  %34 = bitcast i8* %17 to i32*, !dbg !492
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !492
  %36 = load i32, i32* %35, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !492
  store i32 %36, i32* %word.addr, align 4, !dbg !491
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !494, metadata !DIExpression()), !dbg !491
  %37 = load i32, i32* %word.addr, align 4, !dbg !496
  %38 = icmp eq i32 %37, 0, !dbg !496
  br i1 %38, label %if.then, label %if.end, !dbg !495

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !501
  %40 = load i32, i32* %h.addr, align 4, !dbg !502
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !500
  ret i64 %41, !dbg !499

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !504
  %43 = lshr i32 %42, 24, !dbg !504
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !505
  %45 = icmp eq i32 %43, %44, !dbg !504
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !503

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !509
  %47 = and i32 %46, 16777215, !dbg !509
  %48 = sub nsw i32 %47, 1, !dbg !508
  store i32 %48, i32* %at.addr, align 4, !dbg !507
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !512, metadata !DIExpression()), !dbg !507
  %49 = load i32, i32* %at.addr, align 4, !dbg !514
  %50 = icmp sge i32 %49, 0, !dbg !514
  br i1 %50, label %land.rhs.4, label %land.end.4, !dbg !514

land.rhs.4:
  %51 = load i32, i32* %at.addr, align 4, !dbg !516
  %52 = trunc i64 %19 to i32, !dbg !484
  %53 = icmp slt i32 %51, %52, !dbg !516
  br label %land.end.4, !dbg !514

land.end.4:
  %54 = phi i1 [ false, %if.then.1 ], [ %53, %land.rhs.4 ], !dbg !514
  br i1 %54, label %land.rhs.3, label %land.end.3, !dbg !514

land.rhs.3:
  %55 = load i32, i32* %at.addr, align 4, !dbg !519
  %56 = sext i32 %55 to i64, !dbg !518
  %57 = bitcast i8* %21 to i32*, !dbg !518
  %58 = getelementptr inbounds i32, i32* %57, i64 %56, !dbg !518
  %59 = load i32, i32* %58, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !518
  %60 = load i32, i32* %h.addr, align 4, !dbg !520
  %61 = icmp eq i32 %59, %60, !dbg !518
  br label %land.end.3, !dbg !514

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %land.rhs.3 ], !dbg !514
  br i1 %62, label %land.rhs.2, label %land.end.2, !dbg !514

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4, !dbg !521
  %64 = trunc i64 %23 to i32, !dbg !485
  %65 = icmp slt i32 %63, %64, !dbg !521
  br label %land.end.2, !dbg !514

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ], !dbg !514
  br i1 %66, label %land.rhs.1, label %land.end.1, !dbg !514

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4, !dbg !525
  %68 = sext i32 %67 to i64, !dbg !524
  %69 = bitcast i8* %25 to i32*, !dbg !524
  %70 = getelementptr inbounds i32, i32* %69, i64 %68, !dbg !524
  %71 = load i32, i32* %70, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !524
  %72 = icmp eq i32 %71, %key, !dbg !523
  br label %land.end.1, !dbg !514

land.end.1:
  %73 = phi i1 [ false, %land.end.2 ], [ %72, %land.rhs.1 ], !dbg !514
  br i1 %73, label %if.then.2, label %if.end.2, !dbg !513

if.then.2:
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !530
  %75 = load i32, i32* %at.addr, align 4, !dbg !531
  %76 = tail call i64 @nish.foundAt(i32 %74, i32 %75), !dbg !529
  ret i64 %76, !dbg !528

if.end.2:
  br label %if.end.1, !dbg !503

if.end.1:
  %77 = load i32, i32* %bucket.addr, align 4, !dbg !534
  %78 = add nsw i32 %77, 1, !dbg !534
  %79 = and i32 %78, %mask, !dbg !533
  store i32 %79, i32* %bucket.addr, align 4, !dbg !532
  br label %while.cond, !dbg !482

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !537
  call void @nish_exit(i32 1), !dbg !537
  unreachable, !dbg !537
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !541 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !543, metadata !DIExpression()), !dbg !542
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !544, metadata !DIExpression()), !dbg !542
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !547
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !547
  %2 = trunc i64 %1 to i32, !dbg !547
  store i32 %2, i32* %used.addr, align 4, !dbg !545
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !548, metadata !DIExpression()), !dbg !545
  store i32 0, i32* %to.addr, align 4, !dbg !549
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !551, metadata !DIExpression()), !dbg !549
  store i32 0, i32* %from.addr, align 4, !dbg !552
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !554, metadata !DIExpression()), !dbg !552
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !552
  %4 = load i64, i64* %3, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !552
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !552
  %6 = load i8*, i8** %5, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !552
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !552
  %8 = load i64, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !552
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !552
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !552
  br label %for.cond, !dbg !552

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !557
  %12 = load i32, i32* %used.addr, align 4, !dbg !558
  %13 = icmp slt i32 %11, %12, !dbg !557
  br i1 %13, label %land.rhs, label %land.end, !dbg !557

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !559
  %15 = trunc i64 %4 to i32, !dbg !555
  %16 = icmp slt i32 %14, %15, !dbg !559
  br label %land.end, !dbg !557

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !557
  br i1 %17, label %for.body, label %for.end, !dbg !552

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !564
  %19 = sext i32 %18 to i64, !dbg !563
  %20 = bitcast i8* %6 to i32*, !dbg !563
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !563
  %22 = load i32, i32* %21, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !563
  %23 = icmp ne i32 %22, 0, !dbg !563
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !563

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !566
  %25 = icmp sge i32 %24, 0, !dbg !566
  br label %land.end.3, !dbg !563

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !563
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !563

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !568
  %28 = load i32, i32* %used.addr, align 4, !dbg !569
  %29 = icmp slt i32 %27, %28, !dbg !568
  br label %land.end.2, !dbg !563

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !563
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !563

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !570
  %32 = trunc i64 %8 to i32, !dbg !556
  %33 = icmp slt i32 %31, %32, !dbg !570
  br label %land.end.1, !dbg !563

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !563
  br i1 %34, label %if.then, label %if.end, !dbg !562

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !574
  %36 = sext i32 %35 to i64, !dbg !573
  %37 = load i32, i32* %from.addr, align 4, !dbg !576
  %38 = sext i32 %37 to i64, !dbg !575
  %39 = bitcast i8* %10 to i32*, !dbg !575
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !575
  %41 = load i32, i32* %40, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !575
  %42 = bitcast i8* %10 to i32*, !dbg !573
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !573
  store i32 %41, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !573
  %44 = load i32, i32* %to.addr, align 4, !dbg !577
  %45 = add nsw i32 %44, 1, !dbg !577
  store i32 %45, i32* %to.addr, align 4, !dbg !577
  br label %if.end, !dbg !562

if.end:
  br label %for.inc, !dbg !552

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !578
  %47 = add nsw i32 %46, 1, !dbg !578
  store i32 %47, i32* %from.addr, align 4, !dbg !578
  br label %for.cond, !dbg !552

for.end:
  br label %while.cond, !dbg !579

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !581
  %49 = load i64, i64* %48, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !581
  %50 = trunc i64 %49 to i32, !dbg !581
  %51 = load i32, i32* %to.addr, align 4, !dbg !582
  %52 = icmp sgt i32 %50, %51, !dbg !580
  br i1 %52, label %while.body, label %while.end, !dbg !579

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !584
  %54 = load i64, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !584
  %55 = icmp eq i64 %54, 0, !dbg !584
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !584

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !584
  unreachable, !dbg !584

pop.ok:
  %56 = sub i64 %54, 1, !dbg !584
  store i64 %56, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !584
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !584
  %58 = load i8*, i8** %57, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !584
  %59 = bitcast i8* %58 to i32*, !dbg !584
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !584
  %61 = load i32, i32* %60, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !584
  br label %while.cond, !dbg !579

while.end:
  ret void, !dbg !542
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 467, size: 384, align: 64, elements: !37)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 469, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 470, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 471, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 472, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 473, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 474, baseType: !23, size: 64, offset: 256)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "walks", scope: !11, file: !13, line: 476, baseType: !4, size: 32, offset: 320)
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
!99 = !DILocation(line: 87, column: 60, scope: !93)
!100 = !DILocation(line: 87, column: 61, scope: !93)
!101 = !DILocation(line: 87, column: 62, scope: !93)
!102 = !DILocation(line: 87, column: 68, scope: !93)
!103 = !DILocation(line: 87, column: 85, scope: !93)
!104 = !DILocation(line: 87, column: 91, scope: !93)
!105 = !{null, !23, !4, !19, !4}
!106 = !DISubroutineType(types: !105)
!107 = distinct !DISubprogram(name: "fileEntry", linkageName: "nish.fileEntry", scope: !13, file: !13, line: 129, type: !106, scopeLine: 129, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!108 = !DILocation(line: 129, column: 1, scope: !107)
!109 = !DILocalVariable(name: "slots", arg: 1, scope: !107, file: !13, line: 129, type: !23)
!110 = !DILocalVariable(name: "mask", arg: 2, scope: !107, file: !13, line: 129, type: !4)
!111 = !DILocalVariable(name: "h", arg: 3, scope: !107, file: !13, line: 129, type: !19)
!112 = !DILocalVariable(name: "index", arg: 4, scope: !107, file: !13, line: 129, type: !4)
!113 = !DILocation(line: 130, column: 3, scope: !107)
!114 = !DILocation(line: 130, column: 16, scope: !107)
!115 = !DILocation(line: 130, column: 25, scope: !107)
!116 = !DILocation(line: 130, column: 28, scope: !107)
!117 = !DILocalVariable(name: "word", scope: !107, file: !13, line: 130, type: !19)
!118 = !DILocation(line: 131, column: 3, scope: !107)
!119 = !DILocation(line: 131, column: 16, scope: !107)
!120 = !DILocation(line: 131, column: 27, scope: !107)
!121 = !DILocation(line: 131, column: 30, scope: !107)
!122 = !DILocalVariable(name: "bucket", scope: !107, file: !13, line: 131, type: !4)
!123 = !DILocation(line: 132, column: 3, scope: !107)
!124 = !DILocation(line: 132, column: 40, scope: !107)
!125 = !{!"nish array"}
!126 = !{!"header", !125}
!127 = !{!"elements", !125}
!128 = !{!126}
!129 = !{!127}
!130 = !{!"header i64", !46, i64 0}
!131 = !{!"header ptr", !46, i64 0}
!132 = !{!"array header", !130, i64 0, !130, i64 8, !131, i64 16}
!133 = !{!132, !130, i64 0}
!134 = !{!132, !131, i64 16}
!135 = !DILocation(line: 132, column: 10, scope: !107)
!136 = !DILocation(line: 132, column: 20, scope: !107)
!137 = !DILocation(line: 132, column: 25, scope: !107)
!138 = !DILocation(line: 132, column: 34, scope: !107)
!139 = !DILocation(line: 132, column: 55, scope: !107)
!140 = !DILocation(line: 133, column: 5, scope: !107)
!141 = !DILocation(line: 133, column: 9, scope: !107)
!142 = !DILocation(line: 133, column: 15, scope: !107)
!143 = !{!"element i32", !46, i64 0}
!144 = !{!143, !143, i64 0}
!145 = !DILocation(line: 133, column: 27, scope: !107)
!146 = !DILocation(line: 133, column: 30, scope: !107)
!147 = !DILocation(line: 134, column: 7, scope: !107)
!148 = !DILocation(line: 134, column: 13, scope: !107)
!149 = !DILocation(line: 134, column: 23, scope: !107)
!150 = !DILocation(line: 135, column: 7, scope: !107)
!151 = !DILocation(line: 137, column: 5, scope: !107)
!152 = !DILocation(line: 137, column: 14, scope: !107)
!153 = !DILocation(line: 137, column: 15, scope: !107)
!154 = !DILocation(line: 137, column: 24, scope: !107)
!155 = !DILocation(line: 137, column: 29, scope: !107)
!156 = !{null, !23}
!157 = !DISubroutineType(types: !156)
!158 = distinct !DISubprogram(name: "compactHashes", linkageName: "nish.compactHashes", scope: !13, file: !13, line: 157, type: !157, scopeLine: 157, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!159 = !DILocation(line: 157, column: 1, scope: !158)
!160 = !DILocalVariable(name: "hashes", arg: 1, scope: !158, file: !13, line: 157, type: !23)
!161 = !DILocation(line: 158, column: 3, scope: !158)
!162 = !DILocation(line: 158, column: 16, scope: !158)
!163 = !DILocation(line: 158, column: 22, scope: !158)
!164 = !DILocalVariable(name: "used", scope: !158, file: !13, line: 158, type: !4)
!165 = !DILocation(line: 159, column: 3, scope: !158)
!166 = !DILocation(line: 159, column: 17, scope: !158)
!167 = !DILocalVariable(name: "to", scope: !158, file: !13, line: 159, type: !4)
!168 = !DILocation(line: 160, column: 3, scope: !158)
!169 = !DILocation(line: 160, column: 24, scope: !158)
!170 = !DILocalVariable(name: "from", scope: !158, file: !13, line: 160, type: !4)
!171 = !DILocation(line: 161, column: 15, scope: !158)
!172 = !DILocation(line: 160, column: 27, scope: !158)
!173 = !DILocation(line: 160, column: 34, scope: !158)
!174 = !DILocation(line: 160, column: 48, scope: !158)
!175 = !DILocation(line: 161, column: 5, scope: !158)
!176 = !DILocation(line: 161, column: 22, scope: !158)
!177 = !DILocalVariable(name: "h", scope: !158, file: !13, line: 161, type: !19)
!178 = !DILocation(line: 162, column: 5, scope: !158)
!179 = !DILocation(line: 162, column: 9, scope: !158)
!180 = !DILocation(line: 162, column: 15, scope: !158)
!181 = !DILocation(line: 162, column: 20, scope: !158)
!182 = !DILocation(line: 162, column: 26, scope: !158)
!183 = !DILocation(line: 162, column: 31, scope: !158)
!184 = !DILocation(line: 162, column: 36, scope: !158)
!185 = !DILocation(line: 162, column: 42, scope: !158)
!186 = !DILocation(line: 163, column: 7, scope: !158)
!187 = !DILocation(line: 163, column: 14, scope: !158)
!188 = !DILocation(line: 163, column: 20, scope: !158)
!189 = !DILocation(line: 164, column: 7, scope: !158)
!190 = !DILocation(line: 160, column: 40, scope: !158)
!191 = !DILocation(line: 167, column: 3, scope: !158)
!192 = !DILocation(line: 167, column: 10, scope: !158)
!193 = !DILocation(line: 167, column: 16, scope: !158)
!194 = !DILocation(line: 167, column: 33, scope: !158)
!195 = !DILocation(line: 167, column: 37, scope: !158)
!196 = !DILocation(line: 168, column: 5, scope: !158)
!197 = !{!23, !23, !4, !4}
!198 = !DISubroutineType(types: !197)
!199 = distinct !DISubprogram(name: "rebuiltSlots", linkageName: "nish.rebuiltSlots", scope: !13, file: !13, line: 179, type: !198, scopeLine: 179, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!200 = !DILocation(line: 179, column: 1, scope: !199)
!201 = !DILocalVariable(name: "slots", arg: 1, scope: !199, file: !13, line: 179, type: !23)
!202 = !DILocalVariable(name: "live", arg: 2, scope: !199, file: !13, line: 179, type: !4)
!203 = !DILocalVariable(name: "used", arg: 3, scope: !199, file: !13, line: 179, type: !4)
!204 = !DILocation(line: 180, column: 3, scope: !199)
!205 = !DILocation(line: 180, column: 13, scope: !199)
!206 = !DILocation(line: 180, column: 19, scope: !199)
!207 = !DILocalVariable(name: "n", scope: !199, file: !13, line: 180, type: !4)
!208 = !DILocation(line: 181, column: 3, scope: !199)
!209 = !DILocation(line: 181, column: 7, scope: !199)
!210 = !DILocation(line: 181, column: 14, scope: !199)
!211 = !DILocation(line: 181, column: 18, scope: !199)
!212 = !DILocation(line: 181, column: 24, scope: !199)
!213 = !DILocation(line: 182, column: 5, scope: !199)
!214 = !DILocation(line: 182, column: 16, scope: !199)
!215 = !DILocation(line: 183, column: 5, scope: !199)
!216 = !DILocation(line: 183, column: 12, scope: !199)
!217 = !DILocation(line: 185, column: 3, scope: !199)
!218 = !DILocation(line: 185, column: 10, scope: !199)
!219 = !DILocation(line: 185, column: 25, scope: !199)
!220 = !DILocation(line: 185, column: 29, scope: !199)
!221 = !{!132, !130, i64 8}
!222 = !{null, !23, !23}
!223 = !DISubroutineType(types: !222)
!224 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 193, type: !223, scopeLine: 193, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!225 = !DILocation(line: 193, column: 1, scope: !224)
!226 = !DILocalVariable(name: "slots", arg: 1, scope: !224, file: !13, line: 193, type: !23)
!227 = !DILocalVariable(name: "hashes", arg: 2, scope: !224, file: !13, line: 193, type: !23)
!228 = !DILocation(line: 194, column: 3, scope: !224)
!229 = !DILocation(line: 194, column: 16, scope: !224)
!230 = !DILocation(line: 194, column: 22, scope: !224)
!231 = !DILocation(line: 194, column: 38, scope: !224)
!232 = !DILocalVariable(name: "mask", scope: !224, file: !13, line: 194, type: !4)
!233 = !DILocation(line: 195, column: 3, scope: !224)
!234 = !DILocation(line: 195, column: 21, scope: !224)
!235 = !DILocalVariable(name: "i", scope: !224, file: !13, line: 195, type: !4)
!236 = !DILocation(line: 195, column: 34, scope: !224)
!237 = !DILocation(line: 195, column: 24, scope: !224)
!238 = !DILocation(line: 195, column: 28, scope: !224)
!239 = !DILocation(line: 195, column: 55, scope: !224)
!240 = !DILocation(line: 196, column: 5, scope: !224)
!241 = !DILocation(line: 196, column: 15, scope: !224)
!242 = !DILocation(line: 196, column: 22, scope: !224)
!243 = !DILocalVariable(name: "h", scope: !224, file: !13, line: 196, type: !19)
!244 = !DILocation(line: 197, column: 5, scope: !224)
!245 = !DILocation(line: 197, column: 9, scope: !224)
!246 = !DILocation(line: 197, column: 15, scope: !224)
!247 = !DILocation(line: 197, column: 18, scope: !224)
!248 = !DILocation(line: 198, column: 7, scope: !224)
!249 = !DILocation(line: 198, column: 17, scope: !224)
!250 = !DILocation(line: 198, column: 24, scope: !224)
!251 = !DILocation(line: 198, column: 30, scope: !224)
!252 = !DILocation(line: 198, column: 33, scope: !224)
!253 = !DILocation(line: 195, column: 50, scope: !224)
!254 = distinct !DISubprogram(name: "clearSlots", linkageName: "nish.clearSlots", scope: !13, file: !13, line: 224, type: !157, scopeLine: 224, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!255 = !DILocation(line: 224, column: 1, scope: !254)
!256 = !DILocalVariable(name: "slots", arg: 1, scope: !254, file: !13, line: 224, type: !23)
!257 = !DILocation(line: 225, column: 3, scope: !254)
!258 = !DILocation(line: 225, column: 21, scope: !254)
!259 = !DILocalVariable(name: "i", scope: !254, file: !13, line: 225, type: !4)
!260 = !DILocation(line: 225, column: 34, scope: !254)
!261 = !DILocation(line: 225, column: 24, scope: !254)
!262 = !DILocation(line: 225, column: 28, scope: !254)
!263 = !DILocation(line: 225, column: 54, scope: !254)
!264 = !DILocation(line: 226, column: 5, scope: !254)
!265 = !DILocation(line: 226, column: 11, scope: !254)
!266 = !DILocation(line: 226, column: 16, scope: !254)
!267 = !DILocation(line: 225, column: 49, scope: !254)
!268 = !{null, !23, !4, !4, !19, !4}
!269 = !DISubroutineType(types: !268)
!270 = distinct !DISubprogram(name: "fileAppended", linkageName: "nish.fileAppended", scope: !13, file: !13, line: 258, type: !269, scopeLine: 258, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!271 = !DILocation(line: 258, column: 1, scope: !270)
!272 = !DILocalVariable(name: "slots", arg: 1, scope: !270, file: !13, line: 258, type: !23)
!273 = !DILocalVariable(name: "mask", arg: 2, scope: !270, file: !13, line: 258, type: !4)
!274 = !DILocalVariable(name: "bucket", arg: 3, scope: !270, file: !13, line: 258, type: !4)
!275 = !DILocalVariable(name: "h", arg: 4, scope: !270, file: !13, line: 258, type: !19)
!276 = !DILocalVariable(name: "used", arg: 5, scope: !270, file: !13, line: 258, type: !4)
!277 = !DILocation(line: 259, column: 3, scope: !270)
!278 = !DILocation(line: 259, column: 7, scope: !270)
!279 = !DILocation(line: 259, column: 17, scope: !270)
!280 = !DILocation(line: 259, column: 22, scope: !270)
!281 = !DILocation(line: 259, column: 31, scope: !270)
!282 = !DILocation(line: 259, column: 37, scope: !270)
!283 = !DILocation(line: 259, column: 52, scope: !270)
!284 = !DILocation(line: 260, column: 5, scope: !270)
!285 = !DILocation(line: 260, column: 11, scope: !270)
!286 = !DILocation(line: 260, column: 21, scope: !270)
!287 = !DILocation(line: 260, column: 30, scope: !270)
!288 = !DILocation(line: 260, column: 33, scope: !270)
!289 = !DILocation(line: 260, column: 40, scope: !270)
!290 = !DILocation(line: 261, column: 10, scope: !270)
!291 = !DILocation(line: 262, column: 5, scope: !270)
!292 = !DILocation(line: 262, column: 15, scope: !270)
!293 = !DILocation(line: 262, column: 22, scope: !270)
!294 = !DILocation(line: 262, column: 28, scope: !270)
!295 = !DILocation(line: 262, column: 31, scope: !270)
!296 = !DILocation(line: 262, column: 38, scope: !270)
!297 = !{null, !12}
!298 = !DISubroutineType(types: !297)
!299 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 478, type: !298, scopeLine: 478, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!300 = !DILocation(line: 478, column: 3, scope: !299)
!301 = !DILocalVariable(name: "this", arg: 1, scope: !299, file: !13, line: 478, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!302 = !{!49, !47, i64 16}
!303 = !{!49, !47, i64 20}
!304 = !{!49, !47, i64 40}
!305 = !DILocation(line: 479, column: 5, scope: !299)
!306 = !DILocation(line: 479, column: 18, scope: !299)
!307 = !DILocation(line: 479, column: 33, scope: !299)
!308 = !{!49, !48, i64 8}
!309 = !DILocation(line: 480, column: 5, scope: !299)
!310 = !DILocation(line: 480, column: 22, scope: !299)
!311 = !{!49, !48, i64 24}
!312 = !DILocation(line: 481, column: 5, scope: !299)
!313 = !DILocation(line: 481, column: 24, scope: !299)
!314 = !{!49, !48, i64 32}
!315 = !{!16, !12, !4}
!316 = !DISubroutineType(types: !315)
!317 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 484, type: !316, scopeLine: 484, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!318 = !DILocation(line: 484, column: 3, scope: !317)
!319 = !DILocalVariable(name: "this", arg: 1, scope: !317, file: !13, line: 484, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!320 = !DILocalVariable(name: "key", arg: 2, scope: !317, file: !13, line: 484, type: !4)
!321 = !DILocation(line: 485, column: 5, scope: !317)
!322 = !DILocation(line: 485, column: 12, scope: !317)
!323 = !DILocation(line: 485, column: 23, scope: !317)
!324 = !DILocation(line: 485, column: 35, scope: !317)
!325 = !DILocation(line: 485, column: 46, scope: !317)
!326 = !DILocation(line: 485, column: 64, scope: !317)
!327 = !DILocation(line: 485, column: 80, scope: !317)
!328 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!329 = !{!328, !12, !4}
!330 = !DISubroutineType(types: !329)
!331 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 488, type: !330, scopeLine: 488, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!332 = !DILocation(line: 488, column: 3, scope: !331)
!333 = !DILocalVariable(name: "this", arg: 1, scope: !331, file: !13, line: 488, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!334 = !DILocalVariable(name: "key", arg: 2, scope: !331, file: !13, line: 488, type: !4)
!335 = !DILocation(line: 489, column: 5, scope: !331)
!336 = !DILocation(line: 489, column: 12, scope: !331)
!337 = !DILocation(line: 489, column: 23, scope: !331)
!338 = !DILocation(line: 489, column: 31, scope: !331)
!339 = !{!12, !12, !4}
!340 = !DISubroutineType(types: !339)
!341 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 493, type: !340, scopeLine: 493, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!342 = !DILocation(line: 493, column: 3, scope: !341)
!343 = !DILocalVariable(name: "this", arg: 1, scope: !341, file: !13, line: 493, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!344 = !DILocalVariable(name: "key", arg: 2, scope: !341, file: !13, line: 493, type: !4)
!345 = !DILocation(line: 494, column: 5, scope: !341)
!346 = !DILocation(line: 494, column: 19, scope: !341)
!347 = !DILocation(line: 494, column: 30, scope: !341)
!348 = !DILocalVariable(name: "found", scope: !341, file: !13, line: 494, type: !16)
!349 = !DILocation(line: 495, column: 5, scope: !341)
!350 = !DILocation(line: 495, column: 9, scope: !341)
!351 = !DILocation(line: 495, column: 17, scope: !341)
!352 = !DILocation(line: 495, column: 20, scope: !341)
!353 = !DILocation(line: 496, column: 7, scope: !341)
!354 = !DILocation(line: 496, column: 21, scope: !341)
!355 = !DILocation(line: 496, column: 28, scope: !341)
!356 = !DILocation(line: 498, column: 5, scope: !341)
!357 = !DILocation(line: 498, column: 12, scope: !341)
!358 = !{null, !12, !16, !4}
!359 = !DISubroutineType(types: !358)
!360 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 544, type: !359, scopeLine: 544, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!361 = !DILocation(line: 544, column: 3, scope: !360)
!362 = !DILocalVariable(name: "this", arg: 1, scope: !360, file: !13, line: 544, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!363 = !DILocalVariable(name: "absent", arg: 2, scope: !360, file: !13, line: 544, type: !16)
!364 = !DILocalVariable(name: "key", arg: 3, scope: !360, file: !13, line: 544, type: !4)
!365 = !DILocation(line: 545, column: 5, scope: !360)
!366 = !DILocation(line: 545, column: 20, scope: !360)
!367 = !DILocation(line: 545, column: 25, scope: !360)
!368 = !DILocalVariable(name: "packed", scope: !360, file: !13, line: 545, type: !16)
!369 = !DILocation(line: 546, column: 5, scope: !360)
!370 = !DILocation(line: 546, column: 18, scope: !360)
!371 = !DILocation(line: 546, column: 24, scope: !360)
!372 = !DILocalVariable(name: "bucket", scope: !360, file: !13, line: 546, type: !4)
!373 = !DILocation(line: 547, column: 5, scope: !360)
!374 = !DILocation(line: 547, column: 15, scope: !360)
!375 = !DILocation(line: 547, column: 21, scope: !360)
!376 = !DILocalVariable(name: "h", scope: !360, file: !13, line: 547, type: !19)
!377 = !DILocation(line: 548, column: 5, scope: !360)
!378 = !DILocation(line: 548, column: 9, scope: !360)
!379 = !DILocation(line: 548, column: 15, scope: !360)
!380 = !DILocation(line: 548, column: 41, scope: !360)
!381 = !DILocation(line: 548, column: 52, scope: !360)
!382 = !DILocation(line: 549, column: 7, scope: !360)
!383 = !DILocation(line: 549, column: 11, scope: !360)
!384 = !DILocation(line: 549, column: 24, scope: !360)
!385 = !DILocation(line: 549, column: 37, scope: !360)
!386 = !DILocation(line: 549, column: 50, scope: !360)
!387 = !DILocation(line: 549, column: 53, scope: !360)
!388 = !DILocation(line: 550, column: 9, scope: !360)
!389 = !DILocation(line: 550, column: 15, scope: !360)
!390 = !DILocation(line: 552, column: 7, scope: !360)
!391 = !DILocation(line: 553, column: 7, scope: !360)
!392 = !DILocation(line: 553, column: 16, scope: !360)
!393 = !DILocation(line: 555, column: 5, scope: !360)
!394 = !DILocation(line: 555, column: 25, scope: !360)
!395 = !DILocation(line: 556, column: 5, scope: !360)
!396 = !DILocation(line: 556, column: 27, scope: !360)
!397 = !DILocation(line: 557, column: 5, scope: !360)
!398 = !DILocation(line: 557, column: 17, scope: !360)
!399 = !DILocation(line: 557, column: 29, scope: !360)
!400 = !DILocation(line: 558, column: 5, scope: !360)
!401 = !DILocation(line: 558, column: 17, scope: !360)
!402 = !DILocation(line: 558, column: 29, scope: !360)
!403 = !DILocation(line: 561, column: 5, scope: !360)
!404 = !DILocation(line: 561, column: 18, scope: !360)
!405 = !DILocation(line: 561, column: 24, scope: !360)
!406 = !DILocalVariable(name: "used", scope: !360, file: !13, line: 561, type: !4)
!407 = !DILocation(line: 562, column: 5, scope: !360)
!408 = !DILocation(line: 562, column: 9, scope: !360)
!409 = !DILocation(line: 562, column: 16, scope: !360)
!410 = !DILocation(line: 562, column: 20, scope: !360)
!411 = !DILocation(line: 562, column: 26, scope: !360)
!412 = !DILocation(line: 562, column: 47, scope: !360)
!413 = !DILocation(line: 562, column: 50, scope: !360)
!414 = !DILocation(line: 563, column: 7, scope: !360)
!415 = !DILocation(line: 564, column: 12, scope: !360)
!416 = !DILocation(line: 565, column: 7, scope: !360)
!417 = !DILocation(line: 565, column: 20, scope: !360)
!418 = !DILocation(line: 565, column: 32, scope: !360)
!419 = !DILocation(line: 565, column: 43, scope: !360)
!420 = !DILocation(line: 565, column: 51, scope: !360)
!421 = !DILocation(line: 565, column: 54, scope: !360)
!422 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 569, type: !298, scopeLine: 569, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!423 = !DILocation(line: 569, column: 3, scope: !422)
!424 = !DILocalVariable(name: "this", arg: 1, scope: !422, file: !13, line: 569, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!425 = !DILocation(line: 570, column: 5, scope: !422)
!426 = !DILocation(line: 570, column: 18, scope: !422)
!427 = !DILocation(line: 570, column: 24, scope: !422)
!428 = !DILocalVariable(name: "used", scope: !422, file: !13, line: 570, type: !4)
!429 = !DILocation(line: 571, column: 5, scope: !422)
!430 = !DILocation(line: 571, column: 21, scope: !422)
!431 = !DILocation(line: 571, column: 34, scope: !422)
!432 = !DILocalVariable(name: "walking", scope: !422, file: !13, line: 571, type: !328)
!433 = !DILocation(line: 572, column: 5, scope: !422)
!434 = !DILocation(line: 572, column: 19, scope: !422)
!435 = !DILocation(line: 572, column: 32, scope: !422)
!436 = !DILocation(line: 572, column: 44, scope: !422)
!437 = !DILocation(line: 572, column: 54, scope: !422)
!438 = !DILocation(line: 572, column: 61, scope: !422)
!439 = !DILocation(line: 572, column: 72, scope: !422)
!440 = !DILocalVariable(name: "slots", scope: !422, file: !13, line: 572, type: !23)
!441 = !DILocation(line: 573, column: 5, scope: !422)
!442 = !DILocation(line: 573, column: 9, scope: !422)
!443 = !DILocation(line: 573, column: 10, scope: !422)
!444 = !DILocation(line: 573, column: 21, scope: !422)
!445 = !DILocation(line: 573, column: 33, scope: !422)
!446 = !DILocation(line: 573, column: 39, scope: !422)
!447 = !DILocation(line: 574, column: 7, scope: !422)
!448 = !DILocation(line: 574, column: 22, scope: !422)
!449 = !DILocation(line: 574, column: 38, scope: !422)
!450 = !DILocation(line: 575, column: 7, scope: !422)
!451 = !DILocation(line: 575, column: 21, scope: !422)
!452 = !DILocation(line: 577, column: 5, scope: !422)
!453 = !DILocation(line: 577, column: 18, scope: !422)
!454 = !DILocation(line: 578, column: 5, scope: !422)
!455 = !DILocation(line: 578, column: 17, scope: !422)
!456 = !DILocation(line: 578, column: 23, scope: !422)
!457 = !DILocation(line: 578, column: 39, scope: !422)
!458 = !DILocation(line: 579, column: 5, scope: !422)
!459 = !DILocation(line: 579, column: 12, scope: !422)
!460 = !DILocation(line: 579, column: 19, scope: !422)
!461 = !{!16, !23, !4, !23, !33, !4}
!462 = !DISubroutineType(types: !461)
!463 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 96, type: !462, scopeLine: 96, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!464 = !DILocation(line: 96, column: 1, scope: !463)
!465 = !DILocalVariable(name: "slots", arg: 1, scope: !463, file: !13, line: 96, type: !23)
!466 = !DILocalVariable(name: "mask", arg: 2, scope: !463, file: !13, line: 96, type: !4)
!467 = !DILocalVariable(name: "hashes", arg: 3, scope: !463, file: !13, line: 96, type: !23)
!468 = !DILocalVariable(name: "keys", arg: 4, scope: !463, file: !13, line: 96, type: !33)
!469 = !DILocalVariable(name: "key", arg: 5, scope: !463, file: !13, line: 96, type: !4)
!470 = !DILocation(line: 97, column: 3, scope: !463)
!471 = !DILocation(line: 97, column: 13, scope: !463)
!472 = !DILocation(line: 97, column: 21, scope: !463)
!473 = !DILocalVariable(name: "h", scope: !463, file: !13, line: 97, type: !19)
!474 = !DILocation(line: 98, column: 3, scope: !463)
!475 = !DILocation(line: 98, column: 23, scope: !463)
!476 = !DILocalVariable(name: "fingerprint", scope: !463, file: !13, line: 98, type: !19)
!477 = !DILocation(line: 99, column: 3, scope: !463)
!478 = !DILocation(line: 99, column: 16, scope: !463)
!479 = !DILocation(line: 99, column: 27, scope: !463)
!480 = !DILocation(line: 99, column: 30, scope: !463)
!481 = !DILocalVariable(name: "bucket", scope: !463, file: !13, line: 99, type: !4)
!482 = !DILocation(line: 102, column: 3, scope: !463)
!483 = !DILocation(line: 102, column: 40, scope: !463)
!484 = !DILocation(line: 111, column: 20, scope: !463)
!485 = !DILocation(line: 113, column: 20, scope: !463)
!486 = !DILocation(line: 102, column: 10, scope: !463)
!487 = !DILocation(line: 102, column: 20, scope: !463)
!488 = !DILocation(line: 102, column: 25, scope: !463)
!489 = !DILocation(line: 102, column: 34, scope: !463)
!490 = !DILocation(line: 102, column: 55, scope: !463)
!491 = !DILocation(line: 103, column: 5, scope: !463)
!492 = !DILocation(line: 103, column: 18, scope: !463)
!493 = !DILocation(line: 103, column: 24, scope: !463)
!494 = !DILocalVariable(name: "word", scope: !463, file: !13, line: 103, type: !19)
!495 = !DILocation(line: 104, column: 5, scope: !463)
!496 = !DILocation(line: 104, column: 9, scope: !463)
!497 = !DILocation(line: 104, column: 18, scope: !463)
!498 = !DILocation(line: 104, column: 21, scope: !463)
!499 = !DILocation(line: 105, column: 7, scope: !463)
!500 = !DILocation(line: 105, column: 14, scope: !463)
!501 = !DILocation(line: 105, column: 23, scope: !463)
!502 = !DILocation(line: 105, column: 31, scope: !463)
!503 = !DILocation(line: 107, column: 5, scope: !463)
!504 = !DILocation(line: 107, column: 9, scope: !463)
!505 = !DILocation(line: 107, column: 25, scope: !463)
!506 = !DILocation(line: 107, column: 38, scope: !463)
!507 = !DILocation(line: 108, column: 7, scope: !463)
!508 = !DILocation(line: 108, column: 18, scope: !463)
!509 = !DILocation(line: 108, column: 24, scope: !463)
!510 = !DILocation(line: 108, column: 31, scope: !463)
!511 = !DILocation(line: 108, column: 43, scope: !463)
!512 = !DILocalVariable(name: "at", scope: !463, file: !13, line: 108, type: !4)
!513 = !DILocation(line: 109, column: 7, scope: !463)
!514 = !DILocation(line: 110, column: 9, scope: !463)
!515 = !DILocation(line: 110, column: 15, scope: !463)
!516 = !DILocation(line: 111, column: 9, scope: !463)
!517 = !DILocation(line: 111, column: 14, scope: !463)
!518 = !DILocation(line: 112, column: 9, scope: !463)
!519 = !DILocation(line: 112, column: 16, scope: !463)
!520 = !DILocation(line: 112, column: 24, scope: !463)
!521 = !DILocation(line: 113, column: 9, scope: !463)
!522 = !DILocation(line: 113, column: 14, scope: !463)
!523 = !DILocation(line: 114, column: 9, scope: !463)
!524 = !DILocation(line: 114, column: 17, scope: !463)
!525 = !DILocation(line: 114, column: 22, scope: !463)
!526 = !DILocation(line: 114, column: 27, scope: !463)
!527 = !DILocation(line: 115, column: 9, scope: !463)
!528 = !DILocation(line: 116, column: 9, scope: !463)
!529 = !DILocation(line: 116, column: 16, scope: !463)
!530 = !DILocation(line: 116, column: 24, scope: !463)
!531 = !DILocation(line: 116, column: 32, scope: !463)
!532 = !DILocation(line: 119, column: 5, scope: !463)
!533 = !DILocation(line: 119, column: 14, scope: !463)
!534 = !DILocation(line: 119, column: 15, scope: !463)
!535 = !DILocation(line: 119, column: 24, scope: !463)
!536 = !DILocation(line: 119, column: 29, scope: !463)
!537 = !DILocation(line: 121, column: 3, scope: !463)
!538 = !DILocation(line: 121, column: 9, scope: !463)
!539 = !{null, !33, !23}
!540 = !DISubroutineType(types: !539)
!541 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 142, type: !540, scopeLine: 142, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!542 = !DILocation(line: 142, column: 1, scope: !541)
!543 = !DILocalVariable(name: "items", arg: 1, scope: !541, file: !13, line: 142, type: !33)
!544 = !DILocalVariable(name: "hashes", arg: 2, scope: !541, file: !13, line: 142, type: !23)
!545 = !DILocation(line: 143, column: 3, scope: !541)
!546 = !DILocation(line: 143, column: 16, scope: !541)
!547 = !DILocation(line: 143, column: 22, scope: !541)
!548 = !DILocalVariable(name: "used", scope: !541, file: !13, line: 143, type: !4)
!549 = !DILocation(line: 144, column: 3, scope: !541)
!550 = !DILocation(line: 144, column: 17, scope: !541)
!551 = !DILocalVariable(name: "to", scope: !541, file: !13, line: 144, type: !4)
!552 = !DILocation(line: 145, column: 3, scope: !541)
!553 = !DILocation(line: 145, column: 24, scope: !541)
!554 = !DILocalVariable(name: "from", scope: !541, file: !13, line: 145, type: !4)
!555 = !DILocation(line: 145, column: 55, scope: !541)
!556 = !DILocation(line: 146, column: 68, scope: !541)
!557 = !DILocation(line: 145, column: 27, scope: !541)
!558 = !DILocation(line: 145, column: 34, scope: !541)
!559 = !DILocation(line: 145, column: 42, scope: !541)
!560 = !DILocation(line: 145, column: 49, scope: !541)
!561 = !DILocation(line: 145, column: 79, scope: !541)
!562 = !DILocation(line: 146, column: 5, scope: !541)
!563 = !DILocation(line: 146, column: 9, scope: !541)
!564 = !DILocation(line: 146, column: 16, scope: !541)
!565 = !DILocation(line: 146, column: 26, scope: !541)
!566 = !DILocation(line: 146, column: 31, scope: !541)
!567 = !DILocation(line: 146, column: 37, scope: !541)
!568 = !DILocation(line: 146, column: 42, scope: !541)
!569 = !DILocation(line: 146, column: 47, scope: !541)
!570 = !DILocation(line: 146, column: 55, scope: !541)
!571 = !DILocation(line: 146, column: 62, scope: !541)
!572 = !DILocation(line: 146, column: 83, scope: !541)
!573 = !DILocation(line: 147, column: 7, scope: !541)
!574 = !DILocation(line: 147, column: 13, scope: !541)
!575 = !DILocation(line: 147, column: 19, scope: !541)
!576 = !DILocation(line: 147, column: 25, scope: !541)
!577 = !DILocation(line: 148, column: 7, scope: !541)
!578 = !DILocation(line: 145, column: 71, scope: !541)
!579 = !DILocation(line: 151, column: 3, scope: !541)
!580 = !DILocation(line: 151, column: 10, scope: !541)
!581 = !DILocation(line: 151, column: 16, scope: !541)
!582 = !DILocation(line: 151, column: 32, scope: !541)
!583 = !DILocation(line: 151, column: 36, scope: !541)
!584 = !DILocation(line: 152, column: 5, scope: !541)
