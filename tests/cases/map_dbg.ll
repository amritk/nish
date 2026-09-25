%struct.Set$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"Map: a probe ran out of buckets\00" }, align 8
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #2 !dbg !201 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
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
  store i32 0, i32* %i.addr, align 4, !dbg !215
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !217, metadata !DIExpression()), !dbg !215
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !215
  %6 = load i8*, i8** %5, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !215
  br label %for.cond, !dbg !215

for.cond:
  %7 = load i32, i32* %i.addr, align 4, !dbg !219
  %8 = load i32, i32* %n.addr, align 4, !dbg !220
  %9 = icmp slt i32 %7, %8, !dbg !219
  br i1 %9, label %for.body, label %for.end, !dbg !215

for.body:
  %10 = load i32, i32* %i.addr, align 4, !dbg !222
  %11 = sext i32 %10 to i64, !dbg !218
  %12 = bitcast i8* %6 to i32*, !dbg !218
  %13 = getelementptr inbounds i32, i32* %12, i64 %11, !dbg !218
  store i32 0, i32* %13, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !218
  br label %for.inc, !dbg !215

for.inc:
  %14 = load i32, i32* %i.addr, align 4, !dbg !224
  %15 = add nsw i32 %14, 1, !dbg !224
  store i32 %15, i32* %i.addr, align 4, !dbg !224
  br label %for.cond, !dbg !215

for.end:
  ret %struct.nish_array* %slots, !dbg !225

if.end:
  %16 = load i32, i32* %n.addr, align 4, !dbg !229
  %17 = mul nsw i32 %16, 2, !dbg !229
  %18 = sext i32 %17 to i64, !dbg !228
  %19 = call i8* @nish_alloc_struct(i64 24), !dbg !228
  %20 = bitcast i8* %19 to %struct.nish_array*, !dbg !228
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0, !dbg !228
  store i64 %18, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !228
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1, !dbg !228
  store i64 %18, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !228
  %23 = mul i64 %18, 4, !dbg !228
  %24 = call i8* @nish_alloc_struct(i64 %23), !dbg !228
  call void @llvm.memset.p0i8.i64(i8* align 8 %24, i8 0, i64 %23, i1 false), !alias.scope !129, !noalias !128, !dbg !228
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2, !dbg !228
  store i8* %24, i8** %25, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !228
  ret %struct.nish_array* %20, !dbg !227
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 !dbg !234 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !236, metadata !DIExpression()), !dbg !235
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !237, metadata !DIExpression()), !dbg !235
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !240
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !240
  %2 = trunc i64 %1 to i32, !dbg !240
  %3 = sub nsw i32 %2, 1, !dbg !239
  store i32 %3, i32* %mask.addr, align 4, !dbg !238
  call void @llvm.dbg.declare(metadata i32* %mask.addr, metadata !242, metadata !DIExpression()), !dbg !238
  store i32 0, i32* %i.addr, align 4, !dbg !243
  call void @llvm.dbg.declare(metadata i32* %i.addr, metadata !245, metadata !DIExpression()), !dbg !243
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !243
  %5 = load i64, i64* %4, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !243
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !243
  %7 = load i8*, i8** %6, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !243
  br label %for.cond, !dbg !243

for.cond:
  %8 = load i32, i32* %i.addr, align 4, !dbg !247
  %9 = trunc i64 %5 to i32, !dbg !246
  %10 = icmp slt i32 %8, %9, !dbg !247
  br i1 %10, label %for.body, label %for.end, !dbg !243

for.body:
  %11 = load i32, i32* %mask.addr, align 4, !dbg !252
  %12 = load i32, i32* %i.addr, align 4, !dbg !254
  %13 = sext i32 %12 to i64, !dbg !253
  %14 = bitcast i8* %7 to i32*, !dbg !253
  %15 = getelementptr inbounds i32, i32* %14, i64 %13, !dbg !253
  %16 = load i32, i32* %15, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !253
  %17 = load i32, i32* %i.addr, align 4, !dbg !255
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %11, i32 %16, i32 %17), !dbg !250
  br label %for.inc, !dbg !243

for.inc:
  %18 = load i32, i32* %i.addr, align 4, !dbg !256
  %19 = add nsw i32 %18, 1, !dbg !256
  store i32 %19, i32* %i.addr, align 4, !dbg !256
  br label %for.cond, !dbg !243

for.end:
  ret void, !dbg !235
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #2 !dbg !259 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !261, metadata !DIExpression()), !dbg !260
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !260
  store i32 0, i32* %0, align 4, !tbaa !49, !dbg !260
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !260
  store i32 7, i32* %1, align 4, !tbaa !262, !dbg !260
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !260
  store i32 0, i32* %2, align 4, !tbaa !263, !dbg !260
  %3 = sext i32 8 to i64, !dbg !265
  %4 = call i8* @nish_alloc_struct(i64 24), !dbg !265
  %5 = bitcast i8* %4 to %struct.nish_array*, !dbg !265
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0, !dbg !265
  store i64 %3, i64* %6, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !265
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1, !dbg !265
  store i64 %3, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !265
  %8 = mul i64 %3, 4, !dbg !265
  %9 = call i8* @nish_alloc_struct(i64 %8), !dbg !265
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !129, !noalias !128, !dbg !265
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2, !dbg !265
  store i8* %9, i8** %10, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !265
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !264
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !267, !dbg !264
  %12 = call i8* @nish_alloc_struct(i64 24), !dbg !269
  %13 = bitcast i8* %12 to %struct.nish_array*, !dbg !269
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0, !dbg !269
  store i64 0, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !269
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1, !dbg !269
  store i64 0, i64* %15, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !269
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2, !dbg !269
  store i8* null, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !269
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !268
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !270, !dbg !268
  %18 = call i8* @nish_alloc_struct(i64 24), !dbg !272
  %19 = bitcast i8* %18 to %struct.nish_array*, !dbg !272
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0, !dbg !272
  store i64 0, i64* %20, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !272
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1, !dbg !272
  store i64 0, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !272
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2, !dbg !272
  store i8* null, i8** %22, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !272
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !271
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !273, !dbg !271
  ret void, !dbg !260
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !276 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !278, metadata !DIExpression()), !dbg !277
  call void @llvm.dbg.value(metadata i32 %key, metadata !279, metadata !DIExpression()), !dbg !277
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !282
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !267, !dbg !282
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !283
  %3 = load i32, i32* %2, align 4, !tbaa !262, !dbg !283
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !284
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !273, !dbg !284
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !285
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !270, !dbg !285
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key), !dbg !281
  ret i64 %8, !dbg !280
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i32 noundef %key) #0 !dbg !290 {
entry:
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !292, metadata !DIExpression()), !dbg !291
  call void @llvm.dbg.value(metadata i32 %key, metadata !293, metadata !DIExpression()), !dbg !291
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !295
  %1 = icmp sge i64 %0, 0, !dbg !295
  ret i1 %1, !dbg !294
}

define internal noundef nonnull align 8 dereferenceable(40) %struct.Set$i32* @nish.Set$i32.add(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) %this, i32 noundef %key) #0 !dbg !300 {
entry:
  %found.addr = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !302, metadata !DIExpression()), !dbg !301
  call void @llvm.dbg.value(metadata i32 %key, metadata !303, metadata !DIExpression()), !dbg !301
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key), !dbg !305
  store i64 %0, i64* %found.addr, align 8, !dbg !304
  call void @llvm.dbg.declare(metadata i64* %found.addr, metadata !307, metadata !DIExpression()), !dbg !304
  %1 = load i64, i64* %found.addr, align 8, !dbg !309
  %2 = icmp slt i64 %1, 0, !dbg !309
  br i1 %2, label %if.then, label %if.end, !dbg !308

if.then:
  %3 = load i64, i64* %found.addr, align 8, !dbg !313
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %this, i64 %3, i32 %key), !dbg !312
  br label %if.end, !dbg !308

if.end:
  ret %struct.Set$i32* %this, !dbg !315
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 !dbg !319 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !321, metadata !DIExpression()), !dbg !320
  call void @llvm.dbg.value(metadata i64 %absent, metadata !322, metadata !DIExpression()), !dbg !320
  call void @llvm.dbg.value(metadata i32 %key, metadata !323, metadata !DIExpression()), !dbg !320
  %0 = sub nsw i64 0, 1, !dbg !325
  %1 = sub nsw i64 %0, %absent, !dbg !325
  store i64 %1, i64* %packed.addr, align 8, !dbg !324
  call void @llvm.dbg.declare(metadata i64* %packed.addr, metadata !328, metadata !DIExpression()), !dbg !324
  %2 = load i64, i64* %packed.addr, align 8, !dbg !331
  %3 = ashr i64 %2, 32, !dbg !331
  %4 = trunc i64 %3 to i32, !dbg !330
  store i32 %4, i32* %bucket.addr, align 4, !dbg !329
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !332, metadata !DIExpression()), !dbg !329
  %5 = load i64, i64* %packed.addr, align 8, !dbg !335
  %6 = trunc i64 %5 to i32, !dbg !334
  store i32 %6, i32* %h.addr, align 4, !dbg !333
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !336, metadata !DIExpression()), !dbg !333
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !339
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !270, !dbg !339
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !339
  %10 = load i64, i64* %9, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !339
  %11 = trunc i64 %10 to i32, !dbg !339
  %12 = icmp sge i32 %11, 16777215, !dbg !338
  br i1 %12, label %if.then, label %if.end, !dbg !337

if.then:
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !343
  %14 = load i32, i32* %13, align 4, !tbaa !263, !dbg !343
  %15 = icmp sge i32 %14, 16777215, !dbg !343
  br i1 %15, label %if.then.1, label %if.end.1, !dbg !342

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true), !dbg !346
  call void @nish_exit(i32 1), !dbg !346
  unreachable, !dbg !346

if.end.1:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !348
  %16 = sub nsw i32 0, 1, !dbg !350
  store i32 %16, i32* %bucket.addr, align 4, !dbg !349
  br label %if.end, !dbg !337

if.end:
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !352
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !270, !dbg !352
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0, !dbg !352
  %20 = load i64, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !352
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1, !dbg !352
  %22 = load i64, i64* %21, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !352
  %23 = icmp eq i64 %20, %22, !dbg !352
  br i1 %23, label %push.grow, label %push.store, !dbg !352

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4), !dbg !352
  br label %push.store, !dbg !352

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2, !dbg !352
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !352
  %26 = bitcast i8* %25 to i32*, !dbg !352
  %27 = getelementptr inbounds i32, i32* %26, i64 %20, !dbg !352
  store i32 %key, i32* %27, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !352
  %28 = add i64 %20, 1, !dbg !352
  store i64 %28, i64* %19, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !352
  %29 = trunc i64 %28 to i32, !dbg !352
  %30 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !354
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !273, !dbg !354
  %32 = load i32, i32* %h.addr, align 4, !dbg !355
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0, !dbg !354
  %34 = load i64, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !354
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1, !dbg !354
  %36 = load i64, i64* %35, align 8, !alias.scope !128, !noalias !129, !tbaa !231, !dbg !354
  %37 = icmp eq i64 %34, %36, !dbg !354
  br i1 %37, label %push.grow.1, label %push.store.1, !dbg !354

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4), !dbg !354
  br label %push.store.1, !dbg !354

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2, !dbg !354
  %39 = load i8*, i8** %38, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !354
  %40 = bitcast i8* %39 to i32*, !dbg !354
  %41 = getelementptr inbounds i32, i32* %40, i64 %34, !dbg !354
  store i32 %32, i32* %41, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !354
  %42 = add i64 %34, 1, !dbg !354
  store i64 %42, i64* %33, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !354
  %43 = trunc i64 %42 to i32, !dbg !354
  %44 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !357
  %45 = load i32, i32* %44, align 4, !tbaa !263, !dbg !357
  %46 = add nsw i32 %45, 1, !dbg !357
  %47 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !356
  store i32 %46, i32* %47, align 4, !tbaa !263, !dbg !356
  %48 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !360
  %49 = load i32, i32* %48, align 4, !tbaa !49, !dbg !360
  %50 = add nsw i32 %49, 1, !dbg !360
  %51 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0, !dbg !359
  store i32 %50, i32* %51, align 4, !tbaa !49, !dbg !359
  %52 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !364
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !270, !dbg !364
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0, !dbg !364
  %55 = load i64, i64* %54, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !364
  %56 = trunc i64 %55 to i32, !dbg !364
  store i32 %56, i32* %used.addr, align 4, !dbg !362
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !365, metadata !DIExpression()), !dbg !362
  %57 = load i32, i32* %bucket.addr, align 4, !dbg !367
  %58 = icmp sge i32 %57, 0, !dbg !367
  br i1 %58, label %land.rhs, label %land.end, !dbg !367

land.rhs:
  %59 = load i32, i32* %bucket.addr, align 4, !dbg !369
  %60 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !371
  %61 = load %struct.nish_array*, %struct.nish_array** %60, align 8, !tbaa !267, !dbg !371
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0, !dbg !371
  %63 = load i64, i64* %62, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !371
  %64 = trunc i64 %63 to i32, !dbg !371
  %65 = icmp slt i32 %59, %64, !dbg !369
  br label %land.end, !dbg !367

land.end:
  %66 = phi i1 [ false, %push.store.1 ], [ %65, %land.rhs ], !dbg !367
  br i1 %66, label %if.then.2, label %if.else, !dbg !366

if.then.2:
  %67 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !373
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !267, !dbg !373
  %69 = load i32, i32* %bucket.addr, align 4, !dbg !374
  %70 = sext i32 %69 to i64, !dbg !373
  %71 = load i32, i32* %h.addr, align 4, !dbg !376
  %72 = load i32, i32* %used.addr, align 4, !dbg !377
  %73 = sub nsw i32 %72, 1, !dbg !377
  %74 = call i32 @nish.slotWord(i32 %71, i32 %73), !dbg !375
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0, !dbg !373
  %76 = load i64, i64* %75, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !373
  %77 = icmp ult i64 %70, %76, !dbg !373
  br i1 %77, label %bounds.ok, label %bounds.fail, !dbg !373

bounds.fail:
  call void @nish_panic_index(i64 %70, i64 %76), !dbg !373
  unreachable, !dbg !373

bounds.ok:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2, !dbg !373
  %79 = load i8*, i8** %78, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !373
  %80 = bitcast i8* %79 to i32*, !dbg !373
  %81 = getelementptr inbounds i32, i32* %80, i64 %70, !dbg !373
  store i32 %74, i32* %81, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !373
  br label %if.end.2, !dbg !366

if.else:
  %82 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !381
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8, !tbaa !267, !dbg !381
  %84 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !382
  %85 = load i32, i32* %84, align 4, !tbaa !262, !dbg !382
  %86 = load i32, i32* %h.addr, align 4, !dbg !383
  %87 = load i32, i32* %used.addr, align 4, !dbg !384
  %88 = sub nsw i32 %87, 1, !dbg !384
  call void @nish.fileEntry(%struct.nish_array* %83, i32 %85, i32 %86, i32 %88), !dbg !380
  br label %if.end.2, !dbg !366

if.end.2:
  %89 = load i32, i32* %used.addr, align 4, !dbg !387
  %90 = mul nsw i32 %89, 4, !dbg !387
  %91 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !390
  %92 = load %struct.nish_array*, %struct.nish_array** %91, align 8, !tbaa !267, !dbg !390
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0, !dbg !390
  %94 = load i64, i64* %93, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !390
  %95 = trunc i64 %94 to i32, !dbg !390
  %96 = mul nsw i32 %95, 3, !dbg !389
  %97 = icmp sgt i32 %90, %96, !dbg !387
  br i1 %97, label %if.then.3, label %if.end.3, !dbg !386

if.then.3:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this), !dbg !393
  br label %if.end.3, !dbg !386

if.end.3:
  ret void, !dbg !320
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(40) nocapture %this) #0 !dbg !394 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  call void @llvm.dbg.value(metadata %struct.Set$i32* %this, metadata !396, metadata !DIExpression()), !dbg !395
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !399
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !270, !dbg !399
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0, !dbg !399
  %3 = load i64, i64* %2, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !399
  %4 = trunc i64 %3 to i32, !dbg !399
  store i32 %4, i32* %used.addr, align 4, !dbg !397
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !400, metadata !DIExpression()), !dbg !397
  %5 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !403
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !267, !dbg !403
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !404
  %8 = load i32, i32* %7, align 4, !tbaa !263, !dbg !404
  %9 = load i32, i32* %used.addr, align 4, !dbg !405
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9), !dbg !402
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8, !dbg !401
  call void @llvm.dbg.declare(metadata %struct.nish_array** %slots.addr, metadata !406, metadata !DIExpression()), !dbg !401
  %11 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3, !dbg !408
  %12 = load i32, i32* %11, align 4, !tbaa !263, !dbg !408
  %13 = load i32, i32* %used.addr, align 4, !dbg !409
  %14 = icmp slt i32 %12, %13, !dbg !408
  br i1 %14, label %if.then, label %if.end, !dbg !407

if.then:
  %15 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4, !dbg !412
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !270, !dbg !412
  %17 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !413
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !273, !dbg !413
  call void @nish.compactEntries$i32(%struct.nish_array* %16, %struct.nish_array* %18), !dbg !411
  %19 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !415
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !273, !dbg !415
  %21 = call i32 @nish.compactHashes(%struct.nish_array* %20), !dbg !414
  br label %if.end, !dbg !407

if.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !417
  %23 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1, !dbg !416
  store %struct.nish_array* %22, %struct.nish_array** %23, align 8, !tbaa !267, !dbg !416
  %24 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !420
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0, !dbg !420
  %26 = load i64, i64* %25, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !420
  %27 = trunc i64 %26 to i32, !dbg !420
  %28 = sub nsw i32 %27, 1, !dbg !419
  %29 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2, !dbg !418
  store i32 %28, i32* %29, align 4, !tbaa !262, !dbg !418
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8, !dbg !423
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5, !dbg !424
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !273, !dbg !424
  call void @nish.refile(%struct.nish_array* %30, %struct.nish_array* %32), !dbg !422
  ret void, !dbg !395
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 !dbg !427 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %slots, metadata !429, metadata !DIExpression()), !dbg !428
  call void @llvm.dbg.value(metadata i32 %mask, metadata !430, metadata !DIExpression()), !dbg !428
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !431, metadata !DIExpression()), !dbg !428
  call void @llvm.dbg.value(metadata %struct.nish_array* %keys, metadata !432, metadata !DIExpression()), !dbg !428
  call void @llvm.dbg.value(metadata i32 %key, metadata !433, metadata !DIExpression()), !dbg !428
  %0 = lshr i32 %key, 16, !dbg !435
  %1 = xor i32 %key, %0, !dbg !435
  %2 = mul i32 %1, -2048144789, !dbg !435
  %3 = lshr i32 %2, 13, !dbg !435
  %4 = xor i32 %2, %3, !dbg !435
  %5 = mul i32 %4, -1028477387, !dbg !435
  %6 = lshr i32 %5, 16, !dbg !435
  %7 = xor i32 %5, %6, !dbg !435
  %8 = icmp eq i32 %7, 0, !dbg !435
  %9 = select i1 %8, i32 1, i32 %7, !dbg !435
  store i32 %9, i32* %h.addr, align 4, !dbg !434
  call void @llvm.dbg.declare(metadata i32* %h.addr, metadata !437, metadata !DIExpression()), !dbg !434
  %10 = load i32, i32* %h.addr, align 4, !dbg !439
  %11 = lshr i32 %10, 24, !dbg !439
  store i32 %11, i32* %fingerprint.addr, align 4, !dbg !438
  call void @llvm.dbg.declare(metadata i32* %fingerprint.addr, metadata !440, metadata !DIExpression()), !dbg !438
  %12 = load i32, i32* %h.addr, align 4, !dbg !443
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask), !dbg !442
  store i32 %13, i32* %bucket.addr, align 4, !dbg !441
  call void @llvm.dbg.declare(metadata i32* %bucket.addr, metadata !445, metadata !DIExpression()), !dbg !441
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0, !dbg !446
  %15 = load i64, i64* %14, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !446
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2, !dbg !446
  %17 = load i8*, i8** %16, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !446
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !446
  %19 = load i64, i64* %18, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !446
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !446
  %21 = load i8*, i8** %20, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !446
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0, !dbg !446
  %23 = load i64, i64* %22, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !446
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2, !dbg !446
  %25 = load i8*, i8** %24, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !446
  br label %while.cond, !dbg !446

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4, !dbg !450
  %27 = icmp sge i32 %26, 0, !dbg !450
  br i1 %27, label %land.rhs, label %land.end, !dbg !450

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4, !dbg !452
  %29 = trunc i64 %15 to i32, !dbg !447
  %30 = icmp slt i32 %28, %29, !dbg !452
  br label %land.end, !dbg !450

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ], !dbg !450
  br i1 %31, label %while.body, label %while.end, !dbg !446

while.body:
  %32 = load i32, i32* %bucket.addr, align 4, !dbg !457
  %33 = sext i32 %32 to i64, !dbg !456
  %34 = bitcast i8* %17 to i32*, !dbg !456
  %35 = getelementptr inbounds i32, i32* %34, i64 %33, !dbg !456
  %36 = load i32, i32* %35, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !456
  store i32 %36, i32* %word.addr, align 4, !dbg !455
  call void @llvm.dbg.declare(metadata i32* %word.addr, metadata !458, metadata !DIExpression()), !dbg !455
  %37 = load i32, i32* %word.addr, align 4, !dbg !460
  %38 = icmp eq i32 %37, 0, !dbg !460
  br i1 %38, label %if.then, label %if.end, !dbg !459

if.then:
  %39 = load i32, i32* %bucket.addr, align 4, !dbg !465
  %40 = load i32, i32* %h.addr, align 4, !dbg !466
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40), !dbg !464
  ret i64 %41, !dbg !463

if.end:
  %42 = load i32, i32* %word.addr, align 4, !dbg !468
  %43 = lshr i32 %42, 24, !dbg !468
  %44 = load i32, i32* %fingerprint.addr, align 4, !dbg !469
  %45 = icmp eq i32 %43, %44, !dbg !468
  br i1 %45, label %if.then.1, label %if.end.1, !dbg !467

if.then.1:
  %46 = load i32, i32* %word.addr, align 4, !dbg !473
  %47 = and i32 %46, 16777215, !dbg !473
  %48 = sub nsw i32 %47, 1, !dbg !472
  store i32 %48, i32* %at.addr, align 4, !dbg !471
  call void @llvm.dbg.declare(metadata i32* %at.addr, metadata !476, metadata !DIExpression()), !dbg !471
  %49 = load i32, i32* %at.addr, align 4, !dbg !478
  %50 = icmp sge i32 %49, 0, !dbg !478
  br i1 %50, label %land.rhs.4, label %land.end.4, !dbg !478

land.rhs.4:
  %51 = load i32, i32* %at.addr, align 4, !dbg !480
  %52 = trunc i64 %19 to i32, !dbg !448
  %53 = icmp slt i32 %51, %52, !dbg !480
  br label %land.end.4, !dbg !478

land.end.4:
  %54 = phi i1 [ false, %if.then.1 ], [ %53, %land.rhs.4 ], !dbg !478
  br i1 %54, label %land.rhs.3, label %land.end.3, !dbg !478

land.rhs.3:
  %55 = load i32, i32* %at.addr, align 4, !dbg !483
  %56 = sext i32 %55 to i64, !dbg !482
  %57 = bitcast i8* %21 to i32*, !dbg !482
  %58 = getelementptr inbounds i32, i32* %57, i64 %56, !dbg !482
  %59 = load i32, i32* %58, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !482
  %60 = load i32, i32* %h.addr, align 4, !dbg !484
  %61 = icmp eq i32 %59, %60, !dbg !482
  br label %land.end.3, !dbg !478

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %land.rhs.3 ], !dbg !478
  br i1 %62, label %land.rhs.2, label %land.end.2, !dbg !478

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4, !dbg !485
  %64 = trunc i64 %23 to i32, !dbg !449
  %65 = icmp slt i32 %63, %64, !dbg !485
  br label %land.end.2, !dbg !478

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ], !dbg !478
  br i1 %66, label %land.rhs.1, label %land.end.1, !dbg !478

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4, !dbg !489
  %68 = sext i32 %67 to i64, !dbg !488
  %69 = bitcast i8* %25 to i32*, !dbg !488
  %70 = getelementptr inbounds i32, i32* %69, i64 %68, !dbg !488
  %71 = load i32, i32* %70, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !488
  %72 = icmp eq i32 %71, %key, !dbg !487
  br label %land.end.1, !dbg !478

land.end.1:
  %73 = phi i1 [ false, %land.end.2 ], [ %72, %land.rhs.1 ], !dbg !478
  br i1 %73, label %if.then.2, label %if.end.2, !dbg !477

if.then.2:
  %74 = load i32, i32* %bucket.addr, align 4, !dbg !494
  %75 = load i32, i32* %at.addr, align 4, !dbg !495
  %76 = tail call i64 @nish.foundAt(i32 %74, i32 %75), !dbg !493
  ret i64 %76, !dbg !492

if.end.2:
  br label %if.end.1, !dbg !467

if.end.1:
  %77 = load i32, i32* %bucket.addr, align 4, !dbg !498
  %78 = add nsw i32 %77, 1, !dbg !498
  %79 = and i32 %78, %mask, !dbg !497
  store i32 %79, i32* %bucket.addr, align 4, !dbg !496
  br label %while.cond, !dbg !446

while.end:
  call void @nish_write(i8* bitcast ({ i64, [32 x i8] }* @.str.4 to i8*), i32 2, i1 true), !dbg !501
  call void @nish_exit(i32 1), !dbg !501
  unreachable, !dbg !501
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 !dbg !505 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.nish_array* %items, metadata !507, metadata !DIExpression()), !dbg !506
  call void @llvm.dbg.value(metadata %struct.nish_array* %hashes, metadata !508, metadata !DIExpression()), !dbg !506
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !511
  %1 = load i64, i64* %0, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !511
  %2 = trunc i64 %1 to i32, !dbg !511
  store i32 %2, i32* %used.addr, align 4, !dbg !509
  call void @llvm.dbg.declare(metadata i32* %used.addr, metadata !512, metadata !DIExpression()), !dbg !509
  store i32 0, i32* %to.addr, align 4, !dbg !513
  call void @llvm.dbg.declare(metadata i32* %to.addr, metadata !515, metadata !DIExpression()), !dbg !513
  store i32 0, i32* %from.addr, align 4, !dbg !516
  call void @llvm.dbg.declare(metadata i32* %from.addr, metadata !518, metadata !DIExpression()), !dbg !516
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0, !dbg !516
  %4 = load i64, i64* %3, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !516
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2, !dbg !516
  %6 = load i8*, i8** %5, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !516
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !516
  %8 = load i64, i64* %7, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !516
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !516
  %10 = load i8*, i8** %9, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !516
  br label %for.cond, !dbg !516

for.cond:
  %11 = load i32, i32* %from.addr, align 4, !dbg !521
  %12 = load i32, i32* %used.addr, align 4, !dbg !522
  %13 = icmp slt i32 %11, %12, !dbg !521
  br i1 %13, label %land.rhs, label %land.end, !dbg !521

land.rhs:
  %14 = load i32, i32* %from.addr, align 4, !dbg !523
  %15 = trunc i64 %4 to i32, !dbg !519
  %16 = icmp slt i32 %14, %15, !dbg !523
  br label %land.end, !dbg !521

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ], !dbg !521
  br i1 %17, label %for.body, label %for.end, !dbg !516

for.body:
  %18 = load i32, i32* %from.addr, align 4, !dbg !528
  %19 = sext i32 %18 to i64, !dbg !527
  %20 = bitcast i8* %6 to i32*, !dbg !527
  %21 = getelementptr inbounds i32, i32* %20, i64 %19, !dbg !527
  %22 = load i32, i32* %21, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !527
  %23 = icmp ne i32 %22, 0, !dbg !527
  br i1 %23, label %land.rhs.3, label %land.end.3, !dbg !527

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4, !dbg !530
  %25 = icmp sge i32 %24, 0, !dbg !530
  br label %land.end.3, !dbg !527

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ], !dbg !527
  br i1 %26, label %land.rhs.2, label %land.end.2, !dbg !527

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4, !dbg !532
  %28 = load i32, i32* %used.addr, align 4, !dbg !533
  %29 = icmp slt i32 %27, %28, !dbg !532
  br label %land.end.2, !dbg !527

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ], !dbg !527
  br i1 %30, label %land.rhs.1, label %land.end.1, !dbg !527

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4, !dbg !534
  %32 = trunc i64 %8 to i32, !dbg !520
  %33 = icmp slt i32 %31, %32, !dbg !534
  br label %land.end.1, !dbg !527

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ], !dbg !527
  br i1 %34, label %if.then, label %if.end, !dbg !526

if.then:
  %35 = load i32, i32* %to.addr, align 4, !dbg !538
  %36 = sext i32 %35 to i64, !dbg !537
  %37 = load i32, i32* %from.addr, align 4, !dbg !540
  %38 = sext i32 %37 to i64, !dbg !539
  %39 = bitcast i8* %10 to i32*, !dbg !539
  %40 = getelementptr inbounds i32, i32* %39, i64 %38, !dbg !539
  %41 = load i32, i32* %40, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !539
  %42 = bitcast i8* %10 to i32*, !dbg !537
  %43 = getelementptr inbounds i32, i32* %42, i64 %36, !dbg !537
  store i32 %41, i32* %43, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !537
  %44 = load i32, i32* %to.addr, align 4, !dbg !541
  %45 = add nsw i32 %44, 1, !dbg !541
  store i32 %45, i32* %to.addr, align 4, !dbg !541
  br label %if.end, !dbg !526

if.end:
  br label %for.inc, !dbg !516

for.inc:
  %46 = load i32, i32* %from.addr, align 4, !dbg !542
  %47 = add nsw i32 %46, 1, !dbg !542
  store i32 %47, i32* %from.addr, align 4, !dbg !542
  br label %for.cond, !dbg !516

for.end:
  br label %while.cond, !dbg !543

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !545
  %49 = load i64, i64* %48, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !545
  %50 = trunc i64 %49 to i32, !dbg !545
  %51 = load i32, i32* %to.addr, align 4, !dbg !546
  %52 = icmp sgt i32 %50, %51, !dbg !544
  br i1 %52, label %while.body, label %while.end, !dbg !543

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0, !dbg !548
  %54 = load i64, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !548
  %55 = icmp eq i64 %54, 0, !dbg !548
  br i1 %55, label %pop.empty, label %pop.ok, !dbg !548

pop.empty:
  call void @nish_panic_index(i64 0, i64 0), !dbg !548
  unreachable, !dbg !548

pop.ok:
  %56 = sub i64 %54, 1, !dbg !548
  store i64 %56, i64* %53, align 8, !alias.scope !128, !noalias !129, !tbaa !133, !dbg !548
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2, !dbg !548
  %58 = load i8*, i8** %57, align 8, !alias.scope !128, !noalias !129, !tbaa !134, !dbg !548
  %59 = bitcast i8* %58 to i32*, !dbg !548
  %60 = getelementptr inbounds i32, i32* %59, i64 %56, !dbg !548
  %61 = load i32, i32* %60, align 4, !alias.scope !129, !noalias !128, !tbaa !144, !dbg !548
  br label %while.cond, !dbg !543

while.end:
  ret void, !dbg !506
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
!11 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Set<i32>", file: !13, line: 332, size: 320, align: 64, elements: !36)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !11, size: 64)
!13 = !DIFile(filename: "std/collections.ts", directory: ".")
!14 = !DIDerivedType(tag: DW_TAG_member, name: "size", scope: !11, file: !13, line: 334, baseType: !4, size: 32, offset: 0)
!15 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "u32[]", file: !1, size: 192, align: 64, elements: !22)
!16 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!17 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !15, baseType: !16, size: 64, offset: 0)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !15, baseType: !16, size: 64, offset: 64)
!19 = !DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !19, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !15, baseType: !20, size: 64, offset: 128)
!22 = !{!17, !18, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !15, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "slots", scope: !11, file: !13, line: 335, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "mask", scope: !11, file: !13, line: 336, baseType: !4, size: 32, offset: 128)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "live", scope: !11, file: !13, line: 337, baseType: !4, size: 32, offset: 160)
!27 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !32)
!28 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !27, baseType: !16, size: 64, offset: 0)
!29 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !27, baseType: !16, size: 64, offset: 64)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !27, baseType: !30, size: 64, offset: 128)
!32 = !{!28, !29, !31}
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !27, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "entryKeys", scope: !11, file: !13, line: 338, baseType: !33, size: 64, offset: 192)
!35 = !DIDerivedType(tag: DW_TAG_member, name: "entryHashes", scope: !11, file: !13, line: 339, baseType: !23, size: 64, offset: 256)
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
!216 = !DILocation(line: 172, column: 23, scope: !201)
!217 = !DILocalVariable(name: "i", scope: !201, file: !13, line: 172, type: !4)
!218 = !DILocation(line: 173, column: 7, scope: !201)
!219 = !DILocation(line: 172, column: 26, scope: !201)
!220 = !DILocation(line: 172, column: 30, scope: !201)
!221 = !DILocation(line: 172, column: 38, scope: !201)
!222 = !DILocation(line: 173, column: 13, scope: !201)
!223 = !DILocation(line: 173, column: 18, scope: !201)
!224 = !DILocation(line: 172, column: 33, scope: !201)
!225 = !DILocation(line: 175, column: 5, scope: !201)
!226 = !DILocation(line: 175, column: 12, scope: !201)
!227 = !DILocation(line: 177, column: 3, scope: !201)
!228 = !DILocation(line: 177, column: 10, scope: !201)
!229 = !DILocation(line: 177, column: 25, scope: !201)
!230 = !DILocation(line: 177, column: 29, scope: !201)
!231 = !{!132, !130, i64 8}
!232 = !{null, !23, !23}
!233 = !DISubroutineType(types: !232)
!234 = distinct !DISubprogram(name: "refile", linkageName: "nish.refile", scope: !13, file: !13, line: 181, type: !233, scopeLine: 181, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!235 = !DILocation(line: 181, column: 1, scope: !234)
!236 = !DILocalVariable(name: "slots", arg: 1, scope: !234, file: !13, line: 181, type: !23)
!237 = !DILocalVariable(name: "hashes", arg: 2, scope: !234, file: !13, line: 181, type: !23)
!238 = !DILocation(line: 182, column: 3, scope: !234)
!239 = !DILocation(line: 182, column: 16, scope: !234)
!240 = !DILocation(line: 182, column: 22, scope: !234)
!241 = !DILocation(line: 182, column: 38, scope: !234)
!242 = !DILocalVariable(name: "mask", scope: !234, file: !13, line: 182, type: !4)
!243 = !DILocation(line: 183, column: 3, scope: !234)
!244 = !DILocation(line: 183, column: 21, scope: !234)
!245 = !DILocalVariable(name: "i", scope: !234, file: !13, line: 183, type: !4)
!246 = !DILocation(line: 183, column: 34, scope: !234)
!247 = !DILocation(line: 183, column: 24, scope: !234)
!248 = !DILocation(line: 183, column: 28, scope: !234)
!249 = !DILocation(line: 183, column: 55, scope: !234)
!250 = !DILocation(line: 184, column: 5, scope: !234)
!251 = !DILocation(line: 184, column: 15, scope: !234)
!252 = !DILocation(line: 184, column: 22, scope: !234)
!253 = !DILocation(line: 184, column: 28, scope: !234)
!254 = !DILocation(line: 184, column: 35, scope: !234)
!255 = !DILocation(line: 184, column: 39, scope: !234)
!256 = !DILocation(line: 183, column: 50, scope: !234)
!257 = !{null, !12}
!258 = !DISubroutineType(types: !257)
!259 = distinct !DISubprogram(name: "Set<i32>.constructor", linkageName: "nish.Set$i32.constructor", scope: !13, file: !13, line: 341, type: !258, scopeLine: 341, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!260 = !DILocation(line: 341, column: 3, scope: !259)
!261 = !DILocalVariable(name: "this", arg: 1, scope: !259, file: !13, line: 341, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!262 = !{!48, !46, i64 16}
!263 = !{!48, !46, i64 20}
!264 = !DILocation(line: 342, column: 5, scope: !259)
!265 = !DILocation(line: 342, column: 18, scope: !259)
!266 = !DILocation(line: 342, column: 33, scope: !259)
!267 = !{!48, !47, i64 8}
!268 = !DILocation(line: 343, column: 5, scope: !259)
!269 = !DILocation(line: 343, column: 22, scope: !259)
!270 = !{!48, !47, i64 24}
!271 = !DILocation(line: 344, column: 5, scope: !259)
!272 = !DILocation(line: 344, column: 24, scope: !259)
!273 = !{!48, !47, i64 32}
!274 = !{!16, !12, !4}
!275 = !DISubroutineType(types: !274)
!276 = distinct !DISubprogram(name: "Set<i32>.probe", linkageName: "nish.Set$i32.probe", scope: !13, file: !13, line: 347, type: !275, scopeLine: 347, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!277 = !DILocation(line: 347, column: 3, scope: !276)
!278 = !DILocalVariable(name: "this", arg: 1, scope: !276, file: !13, line: 347, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!279 = !DILocalVariable(name: "key", arg: 2, scope: !276, file: !13, line: 347, type: !4)
!280 = !DILocation(line: 348, column: 5, scope: !276)
!281 = !DILocation(line: 348, column: 12, scope: !276)
!282 = !DILocation(line: 348, column: 23, scope: !276)
!283 = !DILocation(line: 348, column: 35, scope: !276)
!284 = !DILocation(line: 348, column: 46, scope: !276)
!285 = !DILocation(line: 348, column: 64, scope: !276)
!286 = !DILocation(line: 348, column: 80, scope: !276)
!287 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!288 = !{!287, !12, !4}
!289 = !DISubroutineType(types: !288)
!290 = distinct !DISubprogram(name: "Set<i32>.has", linkageName: "nish.Set$i32.has", scope: !13, file: !13, line: 351, type: !289, scopeLine: 351, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!291 = !DILocation(line: 351, column: 3, scope: !290)
!292 = !DILocalVariable(name: "this", arg: 1, scope: !290, file: !13, line: 351, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!293 = !DILocalVariable(name: "key", arg: 2, scope: !290, file: !13, line: 351, type: !4)
!294 = !DILocation(line: 352, column: 5, scope: !290)
!295 = !DILocation(line: 352, column: 12, scope: !290)
!296 = !DILocation(line: 352, column: 23, scope: !290)
!297 = !DILocation(line: 352, column: 31, scope: !290)
!298 = !{!12, !12, !4}
!299 = !DISubroutineType(types: !298)
!300 = distinct !DISubprogram(name: "Set<i32>.add", linkageName: "nish.Set$i32.add", scope: !13, file: !13, line: 356, type: !299, scopeLine: 356, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!301 = !DILocation(line: 356, column: 3, scope: !300)
!302 = !DILocalVariable(name: "this", arg: 1, scope: !300, file: !13, line: 356, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!303 = !DILocalVariable(name: "key", arg: 2, scope: !300, file: !13, line: 356, type: !4)
!304 = !DILocation(line: 357, column: 5, scope: !300)
!305 = !DILocation(line: 357, column: 19, scope: !300)
!306 = !DILocation(line: 357, column: 30, scope: !300)
!307 = !DILocalVariable(name: "found", scope: !300, file: !13, line: 357, type: !16)
!308 = !DILocation(line: 358, column: 5, scope: !300)
!309 = !DILocation(line: 358, column: 9, scope: !300)
!310 = !DILocation(line: 358, column: 17, scope: !300)
!311 = !DILocation(line: 358, column: 20, scope: !300)
!312 = !DILocation(line: 359, column: 7, scope: !300)
!313 = !DILocation(line: 359, column: 21, scope: !300)
!314 = !DILocation(line: 359, column: 28, scope: !300)
!315 = !DILocation(line: 361, column: 5, scope: !300)
!316 = !DILocation(line: 361, column: 12, scope: !300)
!317 = !{null, !12, !16, !4}
!318 = !DISubroutineType(types: !317)
!319 = distinct !DISubprogram(name: "Set<i32>.insertAt", linkageName: "nish.Set$i32.insertAt", scope: !13, file: !13, line: 397, type: !318, scopeLine: 397, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!320 = !DILocation(line: 397, column: 3, scope: !319)
!321 = !DILocalVariable(name: "this", arg: 1, scope: !319, file: !13, line: 397, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!322 = !DILocalVariable(name: "absent", arg: 2, scope: !319, file: !13, line: 397, type: !16)
!323 = !DILocalVariable(name: "key", arg: 3, scope: !319, file: !13, line: 397, type: !4)
!324 = !DILocation(line: 398, column: 5, scope: !319)
!325 = !DILocation(line: 398, column: 20, scope: !319)
!326 = !DILocation(line: 398, column: 21, scope: !319)
!327 = !DILocation(line: 398, column: 25, scope: !319)
!328 = !DILocalVariable(name: "packed", scope: !319, file: !13, line: 398, type: !16)
!329 = !DILocation(line: 399, column: 5, scope: !319)
!330 = !DILocation(line: 399, column: 18, scope: !319)
!331 = !DILocation(line: 399, column: 24, scope: !319)
!332 = !DILocalVariable(name: "bucket", scope: !319, file: !13, line: 399, type: !4)
!333 = !DILocation(line: 400, column: 5, scope: !319)
!334 = !DILocation(line: 400, column: 15, scope: !319)
!335 = !DILocation(line: 400, column: 21, scope: !319)
!336 = !DILocalVariable(name: "h", scope: !319, file: !13, line: 400, type: !19)
!337 = !DILocation(line: 401, column: 5, scope: !319)
!338 = !DILocation(line: 401, column: 9, scope: !319)
!339 = !DILocation(line: 401, column: 15, scope: !319)
!340 = !DILocation(line: 401, column: 41, scope: !319)
!341 = !DILocation(line: 401, column: 52, scope: !319)
!342 = !DILocation(line: 402, column: 7, scope: !319)
!343 = !DILocation(line: 402, column: 11, scope: !319)
!344 = !DILocation(line: 402, column: 24, scope: !319)
!345 = !DILocation(line: 402, column: 35, scope: !319)
!346 = !DILocation(line: 403, column: 9, scope: !319)
!347 = !DILocation(line: 403, column: 15, scope: !319)
!348 = !DILocation(line: 405, column: 7, scope: !319)
!349 = !DILocation(line: 406, column: 7, scope: !319)
!350 = !DILocation(line: 406, column: 16, scope: !319)
!351 = !DILocation(line: 406, column: 17, scope: !319)
!352 = !DILocation(line: 408, column: 5, scope: !319)
!353 = !DILocation(line: 408, column: 25, scope: !319)
!354 = !DILocation(line: 409, column: 5, scope: !319)
!355 = !DILocation(line: 409, column: 27, scope: !319)
!356 = !DILocation(line: 410, column: 5, scope: !319)
!357 = !DILocation(line: 410, column: 17, scope: !319)
!358 = !DILocation(line: 410, column: 29, scope: !319)
!359 = !DILocation(line: 411, column: 5, scope: !319)
!360 = !DILocation(line: 411, column: 17, scope: !319)
!361 = !DILocation(line: 411, column: 29, scope: !319)
!362 = !DILocation(line: 412, column: 5, scope: !319)
!363 = !DILocation(line: 412, column: 18, scope: !319)
!364 = !DILocation(line: 412, column: 24, scope: !319)
!365 = !DILocalVariable(name: "used", scope: !319, file: !13, line: 412, type: !4)
!366 = !DILocation(line: 413, column: 5, scope: !319)
!367 = !DILocation(line: 413, column: 9, scope: !319)
!368 = !DILocation(line: 413, column: 19, scope: !319)
!369 = !DILocation(line: 413, column: 24, scope: !319)
!370 = !DILocation(line: 413, column: 33, scope: !319)
!371 = !DILocation(line: 413, column: 39, scope: !319)
!372 = !DILocation(line: 413, column: 59, scope: !319)
!373 = !DILocation(line: 414, column: 7, scope: !319)
!374 = !DILocation(line: 414, column: 18, scope: !319)
!375 = !DILocation(line: 414, column: 28, scope: !319)
!376 = !DILocation(line: 414, column: 37, scope: !319)
!377 = !DILocation(line: 414, column: 40, scope: !319)
!378 = !DILocation(line: 414, column: 47, scope: !319)
!379 = !DILocation(line: 415, column: 12, scope: !319)
!380 = !DILocation(line: 416, column: 7, scope: !319)
!381 = !DILocation(line: 416, column: 17, scope: !319)
!382 = !DILocation(line: 416, column: 29, scope: !319)
!383 = !DILocation(line: 416, column: 40, scope: !319)
!384 = !DILocation(line: 416, column: 43, scope: !319)
!385 = !DILocation(line: 416, column: 50, scope: !319)
!386 = !DILocation(line: 418, column: 5, scope: !319)
!387 = !DILocation(line: 418, column: 9, scope: !319)
!388 = !DILocation(line: 418, column: 16, scope: !319)
!389 = !DILocation(line: 418, column: 20, scope: !319)
!390 = !DILocation(line: 418, column: 26, scope: !319)
!391 = !DILocation(line: 418, column: 47, scope: !319)
!392 = !DILocation(line: 418, column: 50, scope: !319)
!393 = !DILocation(line: 419, column: 7, scope: !319)
!394 = distinct !DISubprogram(name: "Set<i32>.rebuild", linkageName: "nish.Set$i32.rebuild", scope: !13, file: !13, line: 423, type: !258, scopeLine: 423, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!395 = !DILocation(line: 423, column: 3, scope: !394)
!396 = !DILocalVariable(name: "this", arg: 1, scope: !394, file: !13, line: 423, type: !12, flags: DIFlagArtificial | DIFlagObjectPointer)
!397 = !DILocation(line: 424, column: 5, scope: !394)
!398 = !DILocation(line: 424, column: 18, scope: !394)
!399 = !DILocation(line: 424, column: 24, scope: !394)
!400 = !DILocalVariable(name: "used", scope: !394, file: !13, line: 424, type: !4)
!401 = !DILocation(line: 425, column: 5, scope: !394)
!402 = !DILocation(line: 425, column: 19, scope: !394)
!403 = !DILocation(line: 425, column: 32, scope: !394)
!404 = !DILocation(line: 425, column: 44, scope: !394)
!405 = !DILocation(line: 425, column: 55, scope: !394)
!406 = !DILocalVariable(name: "slots", scope: !394, file: !13, line: 425, type: !23)
!407 = !DILocation(line: 426, column: 5, scope: !394)
!408 = !DILocation(line: 426, column: 9, scope: !394)
!409 = !DILocation(line: 426, column: 21, scope: !394)
!410 = !DILocation(line: 426, column: 27, scope: !394)
!411 = !DILocation(line: 427, column: 7, scope: !394)
!412 = !DILocation(line: 427, column: 22, scope: !394)
!413 = !DILocation(line: 427, column: 38, scope: !394)
!414 = !DILocation(line: 428, column: 7, scope: !394)
!415 = !DILocation(line: 428, column: 21, scope: !394)
!416 = !DILocation(line: 430, column: 5, scope: !394)
!417 = !DILocation(line: 430, column: 18, scope: !394)
!418 = !DILocation(line: 431, column: 5, scope: !394)
!419 = !DILocation(line: 431, column: 17, scope: !394)
!420 = !DILocation(line: 431, column: 23, scope: !394)
!421 = !DILocation(line: 431, column: 39, scope: !394)
!422 = !DILocation(line: 432, column: 5, scope: !394)
!423 = !DILocation(line: 432, column: 12, scope: !394)
!424 = !DILocation(line: 432, column: 19, scope: !394)
!425 = !{!16, !23, !4, !23, !33, !4}
!426 = !DISubroutineType(types: !425)
!427 = distinct !DISubprogram(name: "probeTable<i32>", linkageName: "nish.probeTable$i32", scope: !13, file: !13, line: 91, type: !426, scopeLine: 91, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!428 = !DILocation(line: 91, column: 1, scope: !427)
!429 = !DILocalVariable(name: "slots", arg: 1, scope: !427, file: !13, line: 91, type: !23)
!430 = !DILocalVariable(name: "mask", arg: 2, scope: !427, file: !13, line: 91, type: !4)
!431 = !DILocalVariable(name: "hashes", arg: 3, scope: !427, file: !13, line: 91, type: !23)
!432 = !DILocalVariable(name: "keys", arg: 4, scope: !427, file: !13, line: 91, type: !33)
!433 = !DILocalVariable(name: "key", arg: 5, scope: !427, file: !13, line: 91, type: !4)
!434 = !DILocation(line: 92, column: 3, scope: !427)
!435 = !DILocation(line: 92, column: 13, scope: !427)
!436 = !DILocation(line: 92, column: 21, scope: !427)
!437 = !DILocalVariable(name: "h", scope: !427, file: !13, line: 92, type: !19)
!438 = !DILocation(line: 93, column: 3, scope: !427)
!439 = !DILocation(line: 93, column: 23, scope: !427)
!440 = !DILocalVariable(name: "fingerprint", scope: !427, file: !13, line: 93, type: !19)
!441 = !DILocation(line: 94, column: 3, scope: !427)
!442 = !DILocation(line: 94, column: 16, scope: !427)
!443 = !DILocation(line: 94, column: 27, scope: !427)
!444 = !DILocation(line: 94, column: 30, scope: !427)
!445 = !DILocalVariable(name: "bucket", scope: !427, file: !13, line: 94, type: !4)
!446 = !DILocation(line: 97, column: 3, scope: !427)
!447 = !DILocation(line: 97, column: 40, scope: !427)
!448 = !DILocation(line: 104, column: 33, scope: !427)
!449 = !DILocation(line: 104, column: 82, scope: !427)
!450 = !DILocation(line: 97, column: 10, scope: !427)
!451 = !DILocation(line: 97, column: 20, scope: !427)
!452 = !DILocation(line: 97, column: 25, scope: !427)
!453 = !DILocation(line: 97, column: 34, scope: !427)
!454 = !DILocation(line: 97, column: 55, scope: !427)
!455 = !DILocation(line: 98, column: 5, scope: !427)
!456 = !DILocation(line: 98, column: 18, scope: !427)
!457 = !DILocation(line: 98, column: 24, scope: !427)
!458 = !DILocalVariable(name: "word", scope: !427, file: !13, line: 98, type: !19)
!459 = !DILocation(line: 99, column: 5, scope: !427)
!460 = !DILocation(line: 99, column: 9, scope: !427)
!461 = !DILocation(line: 99, column: 18, scope: !427)
!462 = !DILocation(line: 99, column: 21, scope: !427)
!463 = !DILocation(line: 100, column: 7, scope: !427)
!464 = !DILocation(line: 100, column: 14, scope: !427)
!465 = !DILocation(line: 100, column: 23, scope: !427)
!466 = !DILocation(line: 100, column: 31, scope: !427)
!467 = !DILocation(line: 102, column: 5, scope: !427)
!468 = !DILocation(line: 102, column: 9, scope: !427)
!469 = !DILocation(line: 102, column: 25, scope: !427)
!470 = !DILocation(line: 102, column: 38, scope: !427)
!471 = !DILocation(line: 103, column: 7, scope: !427)
!472 = !DILocation(line: 103, column: 18, scope: !427)
!473 = !DILocation(line: 103, column: 24, scope: !427)
!474 = !DILocation(line: 103, column: 31, scope: !427)
!475 = !DILocation(line: 103, column: 43, scope: !427)
!476 = !DILocalVariable(name: "at", scope: !427, file: !13, line: 103, type: !4)
!477 = !DILocation(line: 104, column: 7, scope: !427)
!478 = !DILocation(line: 104, column: 11, scope: !427)
!479 = !DILocation(line: 104, column: 17, scope: !427)
!480 = !DILocation(line: 104, column: 22, scope: !427)
!481 = !DILocation(line: 104, column: 27, scope: !427)
!482 = !DILocation(line: 104, column: 51, scope: !427)
!483 = !DILocation(line: 104, column: 58, scope: !427)
!484 = !DILocation(line: 104, column: 66, scope: !427)
!485 = !DILocation(line: 104, column: 71, scope: !427)
!486 = !DILocation(line: 104, column: 76, scope: !427)
!487 = !DILocation(line: 104, column: 98, scope: !427)
!488 = !DILocation(line: 104, column: 106, scope: !427)
!489 = !DILocation(line: 104, column: 111, scope: !427)
!490 = !DILocation(line: 104, column: 116, scope: !427)
!491 = !DILocation(line: 104, column: 122, scope: !427)
!492 = !DILocation(line: 105, column: 9, scope: !427)
!493 = !DILocation(line: 105, column: 16, scope: !427)
!494 = !DILocation(line: 105, column: 24, scope: !427)
!495 = !DILocation(line: 105, column: 32, scope: !427)
!496 = !DILocation(line: 108, column: 5, scope: !427)
!497 = !DILocation(line: 108, column: 14, scope: !427)
!498 = !DILocation(line: 108, column: 15, scope: !427)
!499 = !DILocation(line: 108, column: 24, scope: !427)
!500 = !DILocation(line: 108, column: 29, scope: !427)
!501 = !DILocation(line: 110, column: 3, scope: !427)
!502 = !DILocation(line: 110, column: 9, scope: !427)
!503 = !{null, !33, !23}
!504 = !DISubroutineType(types: !503)
!505 = distinct !DISubprogram(name: "compactEntries<i32>", linkageName: "nish.compactEntries$i32", scope: !13, file: !13, line: 131, type: !504, scopeLine: 131, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!506 = !DILocation(line: 131, column: 1, scope: !505)
!507 = !DILocalVariable(name: "items", arg: 1, scope: !505, file: !13, line: 131, type: !33)
!508 = !DILocalVariable(name: "hashes", arg: 2, scope: !505, file: !13, line: 131, type: !23)
!509 = !DILocation(line: 132, column: 3, scope: !505)
!510 = !DILocation(line: 132, column: 16, scope: !505)
!511 = !DILocation(line: 132, column: 22, scope: !505)
!512 = !DILocalVariable(name: "used", scope: !505, file: !13, line: 132, type: !4)
!513 = !DILocation(line: 133, column: 3, scope: !505)
!514 = !DILocation(line: 133, column: 17, scope: !505)
!515 = !DILocalVariable(name: "to", scope: !505, file: !13, line: 133, type: !4)
!516 = !DILocation(line: 134, column: 3, scope: !505)
!517 = !DILocation(line: 134, column: 24, scope: !505)
!518 = !DILocalVariable(name: "from", scope: !505, file: !13, line: 134, type: !4)
!519 = !DILocation(line: 134, column: 55, scope: !505)
!520 = !DILocation(line: 135, column: 68, scope: !505)
!521 = !DILocation(line: 134, column: 27, scope: !505)
!522 = !DILocation(line: 134, column: 34, scope: !505)
!523 = !DILocation(line: 134, column: 42, scope: !505)
!524 = !DILocation(line: 134, column: 49, scope: !505)
!525 = !DILocation(line: 134, column: 79, scope: !505)
!526 = !DILocation(line: 135, column: 5, scope: !505)
!527 = !DILocation(line: 135, column: 9, scope: !505)
!528 = !DILocation(line: 135, column: 16, scope: !505)
!529 = !DILocation(line: 135, column: 26, scope: !505)
!530 = !DILocation(line: 135, column: 31, scope: !505)
!531 = !DILocation(line: 135, column: 37, scope: !505)
!532 = !DILocation(line: 135, column: 42, scope: !505)
!533 = !DILocation(line: 135, column: 47, scope: !505)
!534 = !DILocation(line: 135, column: 55, scope: !505)
!535 = !DILocation(line: 135, column: 62, scope: !505)
!536 = !DILocation(line: 135, column: 83, scope: !505)
!537 = !DILocation(line: 136, column: 7, scope: !505)
!538 = !DILocation(line: 136, column: 13, scope: !505)
!539 = !DILocation(line: 136, column: 19, scope: !505)
!540 = !DILocation(line: 136, column: 25, scope: !505)
!541 = !DILocation(line: 137, column: 7, scope: !505)
!542 = !DILocation(line: 134, column: 71, scope: !505)
!543 = !DILocation(line: 140, column: 3, scope: !505)
!544 = !DILocation(line: 140, column: 10, scope: !505)
!545 = !DILocation(line: 140, column: 16, scope: !505)
!546 = !DILocation(line: 140, column: 32, scope: !505)
!547 = !DILocation(line: 140, column: 36, scope: !505)
!548 = !DILocation(line: 141, column: 5, scope: !505)
