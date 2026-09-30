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
  %53 = add i64 %52, 9
  %54 = call i8* @nish_alloc_struct(i64 %53)
  %55 = bitcast i8* %54 to i64*
  store i64 %52, i64* %55, align 8
  %56 = getelementptr inbounds i8, i8* %54, i64 8
  store i8* %56, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %57 = load i64, i64* %join.at, align 8
  %58 = icmp ult i64 %57, %33
  br i1 %58, label %join.part, label %join.end

join.part:
  %59 = load i8*, i8** %join.p, align 8
  %60 = icmp eq i64 %57, 0
  %61 = select i1 %60, i64 0, i64 %35
  %62 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %62, i64 %61, i1 false)
  %63 = getelementptr inbounds i8, i8* %59, i64 %61
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %57
  %68 = load i8*, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = bitcast i8* %68 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = getelementptr inbounds i8, i8* %68, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %63, i64 %70
  store i8* %72, i8** %join.p, align 8
  %73 = add i64 %57, 1
  store i64 %73, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %74 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %74, align 1
  ret i8* %54
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
  %12 = call i8* @bytes(%struct.nish_array* %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %14 = call i32 @nish_net_address(%struct.nish_array* %13, i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i32 443)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = call i8* @bytes(%struct.nish_array* %16)
  call void @nish_print(i8* %17)
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = call i32 @nish_net_address(%struct.nish_array* %18, i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i32 1)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %22 = call i32 @nish_net_address(%struct.nish_array* %21, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*), i32 1)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %25 = call i32 @nish_net_address(%struct.nish_array* %24, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 1)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %28 = call i32 @nish_net_address(%struct.nish_array* %27, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 65536)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
  %30 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i32 0, i32 1)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
  %32 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 4)
  store i32 %32, i32* %fd.addr, align 4
  %33 = load i32, i32* %fd.addr, align 4
  %34 = call i32 @nish_net_local_port(i32 %33)
  store i32 %34, i32* %port.addr, align 4
  %35 = load i32, i32* %fd.addr, align 4
  %36 = icmp sge i32 %35, 0
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load i32, i32* %port.addr, align 4
  %38 = icmp sgt i32 %37, 0
  br label %land.end

land.end:
  %39 = phi i1 [ false, %entry ], [ %38, %land.rhs ]
  %40 = select i1 %39, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %40)
  %41 = load i32, i32* %port.addr, align 4
  %42 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %41, i32 4)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  %44 = load i32, i32* %fd.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %46 = call i32 @nish_tcp_accept(i32 %44, %struct.nish_array* %45)
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  %48 = load i32, i32* %fd.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %50 = call i32 @nish_tcp_accept(i32 %48, %struct.nish_array* %49)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  call void @nish_print(i8* %51)
  %52 = load i32, i32* %fd.addr, align 4
  %53 = call i32 @nish_net_shutdown(i32 %52, i32 3)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = load i32, i32* %fd.addr, align 4
  %56 = call i32 @nish_net_close(i32 %55)
  %57 = call i8* @nish_str_from_i32(i32 %56)
  call void @nish_print(i8* %57)
  %58 = load i32, i32* %fd.addr, align 4
  %59 = call i32 @nish_net_close(i32 %58)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  %61 = load i32, i32* %fd.addr, align 4
  %62 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %63 = add i64 0, 18
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %65 = load i64, i64* %64, align 8
  %66 = icmp ule i64 0, %63
  %67 = icmp ule i64 %63, %65
  %68 = and i1 %66, %67
  br i1 %68, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %63, i64 %65)
  unreachable

net.ok:
  %69 = call i32 @nish_net_read(i32 %61, %struct.nish_array* %62, i64 0, i64 18)
  %70 = call i8* @nish_str_from_i32(i32 %69)
  call void @nish_print(i8* %70)
  %71 = load i32, i32* %fd.addr, align 4
  %72 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %73 = add i64 0, 18
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %75 = load i64, i64* %74, align 8
  %76 = icmp ule i64 0, %73
  %77 = icmp ule i64 %73, %75
  %78 = and i1 %76, %77
  br i1 %78, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %73, i64 %75)
  unreachable

net.ok.1:
  %79 = call i32 @nish_net_write(i32 %71, %struct.nish_array* %72, i64 0, i64 18)
  %80 = call i8* @nish_str_from_i32(i32 %79)
  call void @nish_print(i8* %80)
  %81 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i32 0, i32 4)
  store i32 %81, i32* %both.addr, align 4
  %82 = load i32, i32* %both.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %84 = load i32, i32* %both.addr, align 4
  %85 = call i32 @nish_net_local_port(i32 %84)
  %86 = icmp sgt i32 %85, 0
  br label %land.end.1

land.end.1:
  %87 = phi i1 [ false, %net.ok.1 ], [ %86, %land.rhs.1 ]
  %88 = select i1 %87, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %88)
  %89 = load i32, i32* %both.addr, align 4
  %90 = call i32 @nish_net_close(i32 %89)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %90
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
