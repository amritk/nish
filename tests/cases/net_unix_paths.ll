%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"build/test/\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"nup-plain.sock\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"listen \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" mode \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [90 x i8] } { i64 89, [90 x i8] c"`modeOf`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"connect \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"live default \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"live stale \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"after close mode \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"dead connect \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"dead default \00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"dead stale \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"nup-shared.sock\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"mode 0660 \00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"nup-regular.sock\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"keep\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"regular stale \00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"nup-missing.sock\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"missing connect \00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"107 bytes \00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"108 bytes \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i32 @modeOf(i8*)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_unix_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_listen_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_connect(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal noundef nonnull align 8 i8* @fresh(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %path.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8* %name)
  store i8* %0, i8** %path.addr, align 8
  %1 = load i8*, i8** %path.addr, align 8
  %2 = call i32 @nish_unlink(i8* %1)
  %3 = load i8*, i8** %path.addr, align 8
  ret i8* %3
}

define internal noundef nonnull align 8 i8* @longPath(i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8*], align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %6 = bitcast i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*) to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %n
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %29 = load i64, i64* %28, align 8
  %30 = sub i64 %27, 1
  %31 = mul i64 %29, %30
  %32 = icmp eq i64 %27, 0
  %33 = select i1 %32, i64 0, i64 %31
  store i64 %33, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %34 = load i64, i64* %join.at, align 8
  %35 = icmp ult i64 %34, %27
  br i1 %35, label %join.sum.body, label %join.copy

join.sum.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %34
  %40 = load i8*, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = load i64, i64* %join.total, align 8
  %42 = bitcast i8* %40 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = add i64 %41, %43
  store i64 %44, i64* %join.total, align 8
  %45 = add i64 %34, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %46 = load i64, i64* %join.total, align 8
  %47 = icmp ugt i64 %46, 2147483647
  %48 = add i64 %46, 9
  %49 = select i1 %47, i64 4611686018427387904, i64 %48
  %50 = call i8* @nish_alloc_struct(i64 %49)
  %51 = bitcast i8* %50 to i64*
  store i64 %46, i64* %51, align 8
  %52 = getelementptr inbounds i8, i8* %50, i64 8
  store i8* %52, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %27
  br i1 %54, label %join.part, label %join.end

join.part:
  %55 = load i8*, i8** %join.p, align 8
  %56 = icmp eq i64 %53, 0
  %57 = select i1 %56, i64 0, i64 %29
  %58 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %58, i64 %57, i1 false)
  %59 = getelementptr inbounds i8, i8* %55, i64 %57
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i8**
  %63 = getelementptr inbounds i8*, i8** %62, i64 %53
  %64 = load i8*, i8** %63, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = getelementptr inbounds i8, i8* %64, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %67, i64 %66, i1 false)
  %68 = getelementptr inbounds i8, i8* %59, i64 %66
  store i8* %68, i8** %join.p, align 8
  %69 = add i64 %53, 1
  store i64 %69, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %70 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %70, align 1
  ret i8* %50
}

define noundef i32 @run() #0 {
entry:
  %plain.addr = alloca i8*, align 8
  %listener.addr = alloca i32, align 4
  %client.addr = alloca i32, align 4
  %again.addr = alloca i32, align 4
  %shared.addr = alloca i8*, align 8
  %group.addr = alloca i32, align 4
  %peer.addr = alloca i32, align 4
  %regular.addr = alloca i8*, align 8
  %missing.addr = alloca i8*, align 8
  %fits.addr = alloca i8*, align 8
  %edge.addr = alloca i32, align 4
  %long.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @fresh(i8* bitcast ({ i64, [15 x i8] }* @.str.3 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %plain.addr, align 8
  %3 = load i8*, i8** %plain.addr, align 8
  %4 = call i32 @nish_unix_listen(i8* %3, i32 4, i32 0)
  store i32 %4, i32* %listener.addr, align 4
  %5 = load i32, i32* %listener.addr, align 4
  %6 = icmp sge i32 %5, 0
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %10 = load i8*, i8** %plain.addr, align 8
  %11 = call i64 @nish_str_index_of(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %12 = icmp sge i64 %11, 0
  br i1 %12, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok:
  %13 = getelementptr inbounds i8, i8* %10, i64 8
  %14 = call i32 @modeOf(i8* %13)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %9, i8* %15)
  call void @nish_print(i8* %16)
  %17 = load i8*, i8** %plain.addr, align 8
  %18 = call i32 @nish_unix_connect(i8* %17)
  store i32 %18, i32* %client.addr, align 4
  %19 = load i32, i32* %client.addr, align 4
  %20 = icmp sge i32 %19, 0
  %21 = select i1 %20, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), i8* %21)
  call void @nish_print(i8* %22)
  %23 = load i8*, i8** %plain.addr, align 8
  %24 = call i32 @nish_unix_listen(i8* %23, i32 4, i32 0)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.11 to i8*), i8* %25)
  call void @nish_print(i8* %26)
  %27 = load i8*, i8** %plain.addr, align 8
  %28 = call i32 @nish_unix_listen(i8* %27, i32 4, i32 1)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.12 to i8*), i8* %29)
  call void @nish_print(i8* %30)
  %31 = load i32, i32* %client.addr, align 4
  %32 = call i32 @nish_net_close(i32 %31)
  %33 = load i32, i32* %listener.addr, align 4
  %34 = call i32 @nish_net_close(i32 %33)
  %35 = load i8*, i8** %plain.addr, align 8
  %36 = call i64 @nish_str_index_of(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %37 = icmp sge i64 %36, 0
  br i1 %37, label %ffi.nul.1, label %ffi.ok.1

ffi.nul.1:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.1:
  %38 = getelementptr inbounds i8, i8* %35, i64 8
  %39 = call i32 @modeOf(i8* %38)
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.13 to i8*), i8* %40)
  call void @nish_print(i8* %41)
  %42 = load i8*, i8** %plain.addr, align 8
  %43 = call i32 @nish_unix_connect(i8* %42)
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.14 to i8*), i8* %44)
  call void @nish_print(i8* %45)
  %46 = load i8*, i8** %plain.addr, align 8
  %47 = call i32 @nish_unix_listen(i8* %46, i32 4, i32 0)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.15 to i8*), i8* %48)
  call void @nish_print(i8* %49)
  %50 = load i8*, i8** %plain.addr, align 8
  %51 = call i32 @nish_unix_listen(i8* %50, i32 4, i32 1)
  store i32 %51, i32* %again.addr, align 4
  %52 = load i32, i32* %again.addr, align 4
  %53 = icmp sge i32 %52, 0
  %54 = select i1 %53, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %55 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.16 to i8*), i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %57 = load i8*, i8** %plain.addr, align 8
  %58 = call i64 @nish_str_index_of(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %59 = icmp sge i64 %58, 0
  br i1 %59, label %ffi.nul.2, label %ffi.ok.2

ffi.nul.2:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.2:
  %60 = getelementptr inbounds i8, i8* %57, i64 8
  %61 = call i32 @modeOf(i8* %60)
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %56, i8* %62)
  call void @nish_print(i8* %63)
  %64 = load i32, i32* %again.addr, align 4
  %65 = call i32 @nish_net_close(i32 %64)
  %66 = load i8*, i8** %plain.addr, align 8
  %67 = call i32 @nish_unlink(i8* %66)
  %68 = call i64 @nish_arena_mark()
  %69 = call i8* @fresh(i8* bitcast ({ i64, [16 x i8] }* @.str.17 to i8*))
  %70 = call i8* @nish_arena_keep(i64 %68, i8* %69)
  store i8* %70, i8** %shared.addr, align 8
  %71 = load i8*, i8** %shared.addr, align 8
  %72 = call i32 @nish_unix_listen_mode(i8* %71, i32 4, i32 0, i32 432)
  store i32 %72, i32* %group.addr, align 4
  %73 = load i32, i32* %group.addr, align 4
  %74 = icmp sge i32 %73, 0
  %75 = select i1 %74, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %76 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.18 to i8*), i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %78 = load i8*, i8** %shared.addr, align 8
  %79 = call i64 @nish_str_index_of(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %80 = icmp sge i64 %79, 0
  br i1 %80, label %ffi.nul.3, label %ffi.ok.3

ffi.nul.3:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.3:
  %81 = getelementptr inbounds i8, i8* %78, i64 8
  %82 = call i32 @modeOf(i8* %81)
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %77, i8* %83)
  call void @nish_print(i8* %84)
  %85 = load i8*, i8** %shared.addr, align 8
  %86 = call i32 @nish_unix_connect(i8* %85)
  store i32 %86, i32* %peer.addr, align 4
  %87 = load i32, i32* %peer.addr, align 4
  %88 = icmp sge i32 %87, 0
  %89 = select i1 %88, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %90 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), i8* %89)
  call void @nish_print(i8* %90)
  %91 = load i32, i32* %peer.addr, align 4
  %92 = call i32 @nish_net_close(i32 %91)
  %93 = load i32, i32* %group.addr, align 4
  %94 = call i32 @nish_net_close(i32 %93)
  %95 = load i8*, i8** %shared.addr, align 8
  %96 = call i32 @nish_unlink(i8* %95)
  %97 = call i64 @nish_arena_mark()
  %98 = call i8* @fresh(i8* bitcast ({ i64, [17 x i8] }* @.str.19 to i8*))
  %99 = call i8* @nish_arena_keep(i64 %97, i8* %98)
  store i8* %99, i8** %regular.addr, align 8
  %100 = load i8*, i8** %regular.addr, align 8
  call void @nish_write_file(i8* %100, i8* bitcast ({ i64, [5 x i8] }* @.str.20 to i8*))
  %101 = load i8*, i8** %regular.addr, align 8
  %102 = call i32 @nish_unix_listen(i8* %101, i32 4, i32 1)
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.21 to i8*), i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %106 = load i8*, i8** %regular.addr, align 8
  %107 = call i64 @nish_str_index_of(i8* %106, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %108 = icmp sge i64 %107, 0
  br i1 %108, label %ffi.nul.4, label %ffi.ok.4

ffi.nul.4:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.4:
  %109 = getelementptr inbounds i8, i8* %106, i64 8
  %110 = call i32 @modeOf(i8* %109)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %105, i8* %111)
  call void @nish_print(i8* %112)
  %113 = load i8*, i8** %regular.addr, align 8
  %114 = call i32 @nish_unlink(i8* %113)
  %115 = call i64 @nish_arena_mark()
  %116 = call i8* @fresh(i8* bitcast ({ i64, [17 x i8] }* @.str.22 to i8*))
  %117 = call i8* @nish_arena_keep(i64 %115, i8* %116)
  store i8* %117, i8** %missing.addr, align 8
  %118 = load i8*, i8** %missing.addr, align 8
  %119 = call i32 @nish_unix_connect(i8* %118)
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.23 to i8*), i8* %120)
  call void @nish_print(i8* %121)
  %122 = call i64 @nish_arena_mark()
  %123 = call i8* @longPath(i32 107)
  %124 = call i8* @nish_arena_keep(i64 %122, i8* %123)
  store i8* %124, i8** %fits.addr, align 8
  %125 = load i8*, i8** %fits.addr, align 8
  %126 = call i32 @nish_unlink(i8* %125)
  %127 = load i8*, i8** %fits.addr, align 8
  %128 = call i32 @nish_unix_listen(i8* %127, i32 4, i32 0)
  store i32 %128, i32* %edge.addr, align 4
  %129 = load i32, i32* %edge.addr, align 4
  %130 = icmp sge i32 %129, 0
  %131 = select i1 %130, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %132 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.24 to i8*), i8* %131)
  %133 = call i8* @nish_str_concat(i8* %132, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %134 = load i8*, i8** %fits.addr, align 8
  %135 = call i64 @nish_str_index_of(i8* %134, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %136 = icmp sge i64 %135, 0
  br i1 %136, label %ffi.nul.5, label %ffi.ok.5

ffi.nul.5:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.5:
  %137 = getelementptr inbounds i8, i8* %134, i64 8
  %138 = call i32 @modeOf(i8* %137)
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %133, i8* %139)
  call void @nish_print(i8* %140)
  %141 = load i32, i32* %edge.addr, align 4
  %142 = call i32 @nish_net_close(i32 %141)
  %143 = load i8*, i8** %fits.addr, align 8
  %144 = call i32 @nish_unlink(i8* %143)
  %145 = call i64 @nish_arena_mark()
  %146 = call i8* @longPath(i32 108)
  %147 = call i8* @nish_arena_keep(i64 %145, i8* %146)
  store i8* %147, i8** %long.addr, align 8
  %148 = load i8*, i8** %long.addr, align 8
  %149 = call i32 @nish_unix_listen(i8* %148, i32 4, i32 0)
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.25 to i8*), i8* %150)
  %152 = call i8* @nish_str_concat(i8* %151, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %153 = load i8*, i8** %long.addr, align 8
  %154 = call i64 @nish_str_index_of(i8* %153, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %155 = icmp sge i64 %154, 0
  br i1 %155, label %ffi.nul.6, label %ffi.ok.6

ffi.nul.6:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.6:
  %156 = getelementptr inbounds i8, i8* %153, i64 8
  %157 = call i32 @modeOf(i8* %156)
  %158 = call i8* @nish_str_from_i32(i32 %157)
  %159 = call i8* @nish_str_concat(i8* %152, i8* %158)
  call void @nish_print(i8* %159)
  %160 = load i8*, i8** %long.addr, align 8
  %161 = call i32 @nish_unix_listen_mode(i8* %160, i32 4, i32 0, i32 384)
  %162 = call i8* @nish_str_from_i32(i32 %161)
  %163 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.25 to i8*), i8* %162)
  %164 = call i8* @nish_str_concat(i8* %163, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %165 = load i8*, i8** %long.addr, align 8
  %166 = call i64 @nish_str_index_of(i8* %165, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %167 = icmp sge i64 %166, 0
  br i1 %167, label %ffi.nul.7, label %ffi.ok.7

ffi.nul.7:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.7:
  %168 = getelementptr inbounds i8, i8* %165, i64 8
  %169 = call i32 @modeOf(i8* %168)
  %170 = call i8* @nish_str_from_i32(i32 %169)
  %171 = call i8* @nish_str_concat(i8* %164, i8* %170)
  call void @nish_print(i8* %171)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
