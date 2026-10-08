%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"2001:db8::1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"localhost\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"127.0.0.1\00.9\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"nowhere\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"::\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_local_port(i32 noundef) #2
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_shutdown(i32 noundef, i32 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 i8* @bytes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %3, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 %10
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = zext i8 %15 to i64
  %17 = call i8* @nish_str_from_u64(i64 %16)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  store i8* %17, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %35 = load i64, i64* %34, align 8
  %36 = sub i64 %33, 1
  %37 = mul i64 %35, %36
  %38 = icmp eq i64 %33, 0
  %39 = select i1 %38, i64 0, i64 %37
  store i64 %39, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %40 = load i64, i64* %join.at, align 8
  %41 = icmp ult i64 %40, %33
  br i1 %41, label %join.sum.body, label %join.copy

join.sum.body:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %40
  %46 = load i8*, i8** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %47 = load i64, i64* %join.total, align 8
  %48 = bitcast i8* %46 to i64*
  %49 = load i64, i64* %48, align 8
  %50 = add i64 %47, %49
  store i64 %50, i64* %join.total, align 8
  %51 = add i64 %40, 1
  store i64 %51, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %52 = load i64, i64* %join.total, align 8
  %53 = icmp ugt i64 %52, 2147483647
  %54 = add i64 %52, 9
  %55 = select i1 %53, i64 4611686018427387904, i64 %54
  %56 = call i8* @nish_alloc_struct(i64 %55)
  %57 = bitcast i8* %56 to i64*
  store i64 %52, i64* %57, align 8
  %58 = getelementptr inbounds i8, i8* %56, i64 8
  store i8* %58, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %59 = load i64, i64* %join.at, align 8
  %60 = icmp ult i64 %59, %33
  br i1 %60, label %join.part, label %join.end

join.part:
  %61 = load i8*, i8** %join.p, align 8
  %62 = icmp eq i64 %59, 0
  %63 = select i1 %62, i64 0, i64 %35
  %64 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %61, i8* %64, i64 %63, i1 false)
  %65 = getelementptr inbounds i8, i8* %61, i64 %63
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i8**
  %69 = getelementptr inbounds i8*, i8** %68, i64 %59
  %70 = load i8*, i8** %69, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %71 = bitcast i8* %70 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = getelementptr inbounds i8, i8* %70, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %65, i8* %73, i64 %72, i1 false)
  %74 = getelementptr inbounds i8, i8* %65, i64 %72
  store i8* %74, i8** %join.p, align 8
  %75 = add i64 %59, 1
  store i64 %75, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %76 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %76, align 1
  ret i8* %56
}

define noundef i32 @nish_main() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %short.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [17 x i8], align 8
  %fd.addr = alloca i32, align 4
  %port.addr = alloca i32, align 4
  %both.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 17, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 17, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [17 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 17, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %short.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i32 @nish_net_address(%struct.nish_array* %8, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 8080)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @bytes(%struct.nish_array* %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = call i32 @nish_net_address(%struct.nish_array* %15, i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i32 443)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @bytes(%struct.nish_array* %18)
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %23 = call i32 @nish_net_address(%struct.nish_array* %22, i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i32 1)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %26 = call i32 @nish_net_address(%struct.nish_array* %25, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*), i32 1)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %29 = call i32 @nish_net_address(%struct.nish_array* %28, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 1)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %32 = call i32 @nish_net_address(%struct.nish_array* %31, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 65536)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i32 0, i32 1)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 4)
  store i32 %36, i32* %fd.addr, align 4
  %37 = load i32, i32* %fd.addr, align 4
  %38 = call i32 @nish_net_local_port(i32 %37)
  store i32 %38, i32* %port.addr, align 4
  %39 = load i32, i32* %fd.addr, align 4
  %40 = icmp sge i32 %39, 0
  br i1 %40, label %land.rhs, label %land.end

land.rhs:
  %41 = load i32, i32* %port.addr, align 4
  %42 = icmp sgt i32 %41, 0
  br label %land.end

land.end:
  %43 = phi i1 [ false, %entry ], [ %42, %land.rhs ]
  %44 = select i1 %43, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %44)
  %45 = load i32, i32* %port.addr, align 4
  %46 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %45, i32 4)
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  %48 = load i32, i32* %fd.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %50 = call i32 @nish_tcp_accept(i32 %48, %struct.nish_array* %49)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  call void @nish_print(i8* %51)
  %52 = load i32, i32* %fd.addr, align 4
  %53 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %54 = call i32 @nish_tcp_accept(i32 %52, %struct.nish_array* %53)
  %55 = call i8* @nish_str_from_i32(i32 %54)
  call void @nish_print(i8* %55)
  %56 = load i32, i32* %fd.addr, align 4
  %57 = call i32 @nish_net_shutdown(i32 %56, i32 3)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = load i32, i32* %fd.addr, align 4
  %60 = call i32 @nish_net_close(i32 %59)
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  %62 = load i32, i32* %fd.addr, align 4
  %63 = call i32 @nish_net_close(i32 %62)
  %64 = call i8* @nish_str_from_i32(i32 %63)
  call void @nish_print(i8* %64)
  %65 = load i32, i32* %fd.addr, align 4
  %66 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %67 = add i64 0, 18
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %69 = load i64, i64* %68, align 8
  %70 = icmp ule i64 0, %67
  %71 = icmp ule i64 %67, %69
  %72 = and i1 %70, %71
  br i1 %72, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %67, i64 %69)
  unreachable

net.ok:
  %73 = call i32 @nish_net_read(i32 %65, %struct.nish_array* %66, i64 0, i64 18)
  %74 = call i8* @nish_str_from_i32(i32 %73)
  call void @nish_print(i8* %74)
  %75 = load i32, i32* %fd.addr, align 4
  %76 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %77 = add i64 0, 18
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %79 = load i64, i64* %78, align 8
  %80 = icmp ule i64 0, %77
  %81 = icmp ule i64 %77, %79
  %82 = and i1 %80, %81
  br i1 %82, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %77, i64 %79)
  unreachable

net.ok.1:
  %83 = call i32 @nish_net_write(i32 %75, %struct.nish_array* %76, i64 0, i64 18)
  %84 = call i8* @nish_str_from_i32(i32 %83)
  call void @nish_print(i8* %84)
  %85 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i32 0, i32 4)
  store i32 %85, i32* %both.addr, align 4
  %86 = load i32, i32* %both.addr, align 4
  %87 = icmp sge i32 %86, 0
  br i1 %87, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %88 = load i32, i32* %both.addr, align 4
  %89 = call i32 @nish_net_local_port(i32 %88)
  %90 = icmp sgt i32 %89, 0
  br label %land.end.1

land.end.1:
  %91 = phi i1 [ false, %net.ok.1 ], [ %90, %land.rhs.1 ]
  %92 = select i1 %91, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %92)
  %93 = load i32, i32* %both.addr, align 4
  %94 = call i32 @nish_net_close(i32 %93)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %94
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
