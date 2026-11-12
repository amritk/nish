%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"localhost\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"::\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @receive(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, i32 noundef %off, i32 noundef %len, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %off to i64
  %1 = sext i32 %len to i64
  %2 = add i64 %0, %1
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %4 = load i64, i64* %3, align 8
  %5 = icmp ule i64 %0, %2
  %6 = icmp ule i64 %2, %4
  %7 = and i1 %5, %6
  br i1 %7, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %0, i64 %2, i64 %4)
  unreachable

net.ok:
  %8 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 %0, i64 %1, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %8, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp eq i32 %9, -11
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = sext i32 %off to i64
  %12 = sext i32 %len to i64
  %13 = add i64 %11, %12
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %15 = load i64, i64* %14, align 8
  %16 = icmp ule i64 %11, %13
  %17 = icmp ule i64 %13, %15
  %18 = and i1 %16, %17
  br i1 %18, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 %11, i64 %13, i64 %15)
  unreachable

net.ok.1:
  %19 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 %11, i64 %12, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %19, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %20 = load i32, i32* %n.addr, align 4
  ret i32 %20
}

define internal noundef i32 @send$(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %data, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %to) #0 {
entry:
  %0 = add i64 0, 3
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %data, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ule i64 0, %0
  %4 = icmp ule i64 %0, %2
  %5 = and i1 %3, %4
  br i1 %5, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %0, i64 %2)
  unreachable

net.ok:
  %6 = call i32 @nish_udp_send_to(i32 %fd, %struct.nish_array* %data, i64 0, i64 3, %struct.nish_array* %to, i32 0, i32 0)
  ret i32 %6
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %toB.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i8], align 8
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [3 x i8], align 8
  %port.addr = alloca i32, align 4
  %short.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [17 x i8], align 8
  %one.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [1 x i32], align 8
  %shared.addr = alloca i32, align 4
  %again.addr = alloca i32, align 4
  %both.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %0, i32* %a.addr, align 4
  %1 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %1, i32* %b.addr, align 4
  %2 = load i32, i32* %a.addr, align 4
  %3 = icmp sge i32 %2, 0
  br i1 %3, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %4 = load i32, i32* %b.addr, align 4
  %5 = icmp sge i32 %4, 0
  br label %land.end.1

land.end.1:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs.1 ]
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %b.addr, align 4
  %8 = call i32 @nish_net_local_port(i32 %7)
  %9 = icmp sgt i32 %8, 0
  br label %land.end

land.end:
  %10 = phi i1 [ false, %land.end.1 ], [ %9, %land.rhs ]
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %toB.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %17 = load i32, i32* %b.addr, align 4
  %18 = call i32 @nish_net_local_port(i32 %17)
  %19 = call i32 @nish_net_address(%struct.nish_array* %16, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %18)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast [2 x i32]* %arr.data.2 to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %26 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  store i32 7, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = getelementptr inbounds i32, i32* %28, i64 1
  store i32 7, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast [8 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %buf.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast [3 x i8]* %arr.data.4 to i8*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %37 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 0
  store i8 10, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %41 = getelementptr inbounds i8, i8* %39, i64 1
  store i8 20, i8* %41, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = getelementptr inbounds i8, i8* %39, i64 2
  store i8 30, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %data.addr, align 8
  %43 = load i32, i32* %b.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %45 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %47 = add i64 0, 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %49 = load i64, i64* %48, align 8
  %50 = icmp ule i64 0, %47
  %51 = icmp ule i64 %47, %49
  %52 = and i1 %50, %51
  br i1 %52, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %47, i64 %49)
  unreachable

net.ok:
  %53 = call i32 @nish_udp_recv_from(i32 %43, %struct.nish_array* %44, i64 0, i64 8, %struct.nish_array* %45, %struct.nish_array* %46)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = load i32, i32* %a.addr, align 4
  %56 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %58 = call i32 @send$(i32 %55, %struct.nish_array* %56, %struct.nish_array* %57)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  call void @nish_print(i8* %59)
  %60 = load i32, i32* %b.addr, align 4
  %61 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %64 = call i32 @receive(i32 %60, %struct.nish_array* %61, i32 2, i32 6, %struct.nish_array* %62, %struct.nish_array* %63)
  %65 = call i8* @nish_str_from_i32(i32 %64)
  call void @nish_print(i8* %65)
  %66 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = icmp ult i64 2, %68
  br i1 %69, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %68)
  unreachable

bounds.ok:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i8*
  %73 = getelementptr inbounds i8, i8* %72, i64 2
  %74 = load i8, i8* %73, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %75 = zext i8 %74 to i64
  %76 = call i8* @nish_str_from_u64(i64 %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %78 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = icmp ult i64 3, %80
  br i1 %81, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %80)
  unreachable

bounds.ok.1:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %84 = bitcast i8* %83 to i8*
  %85 = getelementptr inbounds i8, i8* %84, i64 3
  %86 = load i8, i8* %85, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %87 = zext i8 %86 to i64
  %88 = call i8* @nish_str_from_u64(i64 %87)
  %89 = call i8* @nish_str_concat(i8* %77, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %91 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = icmp ult i64 4, %93
  br i1 %94, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 4, i64 %93)
  unreachable

bounds.ok.2:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %96 to i8*
  %98 = getelementptr inbounds i8, i8* %97, i64 4
  %99 = load i8, i8* %98, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %100 = zext i8 %99 to i64
  %101 = call i8* @nish_str_from_u64(i64 %100)
  %102 = call i8* @nish_str_concat(i8* %90, i8* %101)
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %104 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = icmp ult i64 0, %106
  br i1 %107, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %106)
  unreachable

bounds.ok.3:
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %110 = bitcast i8* %109 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 0
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %103, i8* %113)
  %115 = call i8* @nish_str_concat(i8* %114, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %116 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 0
  %118 = load i64, i64* %117, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = icmp ult i64 1, %118
  br i1 %119, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %118)
  unreachable

bounds.ok.4:
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i32*
  %123 = getelementptr inbounds i32, i32* %122, i64 1
  %124 = load i32, i32* %123, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %125 = call i8* @nish_str_from_i32(i32 %124)
  %126 = call i8* @nish_str_concat(i8* %115, i8* %125)
  call void @nish_print(i8* %126)
  %127 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = icmp ult i64 16, %129
  br i1 %130, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 16, i64 %129)
  unreachable

bounds.ok.5:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %133 = bitcast i8* %132 to i8*
  %134 = getelementptr inbounds i8, i8* %133, i64 16
  %135 = load i8, i8* %134, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %136 = zext i8 %135 to i32
  %137 = shl i32 %136, 8
  %138 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %138, i64 0, i32 0
  %140 = load i64, i64* %139, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = icmp ult i64 17, %140
  br i1 %141, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 17, i64 %140)
  unreachable

bounds.ok.6:
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %138, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %144 = bitcast i8* %143 to i8*
  %145 = getelementptr inbounds i8, i8* %144, i64 17
  %146 = load i8, i8* %145, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %147 = zext i8 %146 to i32
  %148 = or i32 %137, %147
  store i32 %148, i32* %port.addr, align 4
  %149 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = bitcast i8* %151 to i8*
  %153 = getelementptr inbounds i8, i8* %152, i64 10
  %154 = load i8, i8* %153, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %155 = zext i8 %154 to i64
  %156 = call i8* @nish_str_from_u64(i64 %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %158 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %161 = bitcast i8* %160 to i8*
  %162 = getelementptr inbounds i8, i8* %161, i64 11
  %163 = load i8, i8* %162, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %164 = zext i8 %163 to i64
  %165 = call i8* @nish_str_from_u64(i64 %164)
  %166 = call i8* @nish_str_concat(i8* %157, i8* %165)
  %167 = call i8* @nish_str_concat(i8* %166, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %168 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %171 = bitcast i8* %170 to i8*
  %172 = getelementptr inbounds i8, i8* %171, i64 12
  %173 = load i8, i8* %172, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %174 = zext i8 %173 to i64
  %175 = call i8* @nish_str_from_u64(i64 %174)
  %176 = call i8* @nish_str_concat(i8* %167, i8* %175)
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %178 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %181 = bitcast i8* %180 to i8*
  %182 = getelementptr inbounds i8, i8* %181, i64 15
  %183 = load i8, i8* %182, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %184 = zext i8 %183 to i64
  %185 = call i8* @nish_str_from_u64(i64 %184)
  %186 = call i8* @nish_str_concat(i8* %177, i8* %185)
  %187 = call i8* @nish_str_concat(i8* %186, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %188 = load i32, i32* %port.addr, align 4
  %189 = load i32, i32* %a.addr, align 4
  %190 = call i32 @nish_net_local_port(i32 %189)
  %191 = icmp eq i32 %188, %190
  %192 = select i1 %191, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %193 = call i8* @nish_str_concat(i8* %187, i8* %192)
  call void @nish_print(i8* %193)
  %194 = load i32, i32* %a.addr, align 4
  %195 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %196 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %197 = call i32 @send$(i32 %194, %struct.nish_array* %195, %struct.nish_array* %196)
  %198 = call i8* @nish_str_from_i32(i32 %197)
  call void @nish_print(i8* %198)
  %199 = load i32, i32* %b.addr, align 4
  %200 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %201 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %202 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %203 = call i32 @receive(i32 %199, %struct.nish_array* %200, i32 0, i32 2, %struct.nish_array* %201, %struct.nish_array* %202)
  %204 = call i8* @nish_str_from_i32(i32 %203)
  call void @nish_print(i8* %204)
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 17, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 17, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %207 = bitcast [17 x i8]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %207, i8 0, i64 17, i1 false), !alias.scope !4, !noalias !3
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %207, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %short.addr, align 8
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 1, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 1, i64* %210, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %211 = bitcast [1 x i32]* %arr.data.6 to i8*
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %211, i8** %212, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %213 = bitcast i8* %211 to i32*
  %214 = getelementptr inbounds i32, i32* %213, i64 0
  store i32 0, i32* %214, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %one.addr, align 8
  %215 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4)
  %216 = call i8* @nish_str_from_i32(i32 %215)
  call void @nish_print(i8* %216)
  %217 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 8)
  %218 = call i8* @nish_str_from_i32(i32 %217)
  call void @nish_print(i8* %218)
  %219 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*), i32 0, i32 0)
  %220 = call i8* @nish_str_from_i32(i32 %219)
  call void @nish_print(i8* %220)
  %221 = load i32, i32* %a.addr, align 4
  %222 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %223 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %224 = add i64 0, 3
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 0
  %226 = load i64, i64* %225, align 8
  %227 = icmp ule i64 0, %224
  %228 = icmp ule i64 %224, %226
  %229 = and i1 %227, %228
  br i1 %229, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %224, i64 %226)
  unreachable

net.ok.1:
  %230 = call i32 @nish_udp_send_to(i32 %221, %struct.nish_array* %222, i64 0, i64 3, %struct.nish_array* %223, i32 0, i32 0)
  %231 = call i8* @nish_str_from_i32(i32 %230)
  call void @nish_print(i8* %231)
  %232 = load i32, i32* %a.addr, align 4
  %233 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %234 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %235 = add i64 0, 3
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 0
  %237 = load i64, i64* %236, align 8
  %238 = icmp ule i64 0, %235
  %239 = icmp ule i64 %235, %237
  %240 = and i1 %238, %239
  br i1 %240, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %235, i64 %237)
  unreachable

net.ok.2:
  %241 = call i32 @nish_udp_send_to(i32 %232, %struct.nish_array* %233, i64 0, i64 3, %struct.nish_array* %234, i32 65536, i32 0)
  %242 = call i8* @nish_str_from_i32(i32 %241)
  call void @nish_print(i8* %242)
  %243 = load i32, i32* %a.addr, align 4
  %244 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %245 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %246 = add i64 0, 3
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %244, i64 0, i32 0
  %248 = load i64, i64* %247, align 8
  %249 = icmp ule i64 0, %246
  %250 = icmp ule i64 %246, %248
  %251 = and i1 %249, %250
  br i1 %251, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %246, i64 %248)
  unreachable

net.ok.3:
  %252 = call i32 @nish_udp_send_to(i32 %243, %struct.nish_array* %244, i64 0, i64 3, %struct.nish_array* %245, i32 0, i32 4)
  %253 = call i8* @nish_str_from_i32(i32 %252)
  call void @nish_print(i8* %253)
  %254 = load i32, i32* %b.addr, align 4
  %255 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %256 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %257 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %258 = add i64 0, 8
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 0
  %260 = load i64, i64* %259, align 8
  %261 = icmp ule i64 0, %258
  %262 = icmp ule i64 %258, %260
  %263 = and i1 %261, %262
  br i1 %263, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %258, i64 %260)
  unreachable

net.ok.4:
  %264 = call i32 @nish_udp_recv_from(i32 %254, %struct.nish_array* %255, i64 0, i64 8, %struct.nish_array* %256, %struct.nish_array* %257)
  %265 = call i8* @nish_str_from_i32(i32 %264)
  call void @nish_print(i8* %265)
  %266 = load i32, i32* %b.addr, align 4
  %267 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %268 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %269 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %270 = add i64 0, 8
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 0
  %272 = load i64, i64* %271, align 8
  %273 = icmp ule i64 0, %270
  %274 = icmp ule i64 %270, %272
  %275 = and i1 %273, %274
  br i1 %275, label %net.ok.5, label %net.fail.5

net.fail.5:
  call void @nish_panic_slice(i64 0, i64 %270, i64 %272)
  unreachable

net.ok.5:
  %276 = call i32 @nish_udp_recv_from(i32 %266, %struct.nish_array* %267, i64 0, i64 8, %struct.nish_array* %268, %struct.nish_array* %269)
  %277 = call i8* @nish_str_from_i32(i32 %276)
  call void @nish_print(i8* %277)
  %278 = load i32, i32* %b.addr, align 4
  %279 = call i32 @nish_net_local_port(i32 %278)
  %280 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %279, i32 0)
  %281 = call i8* @nish_str_from_i32(i32 %280)
  call void @nish_print(i8* %281)
  %282 = load i32, i32* %b.addr, align 4
  %283 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %284 = call i32 @nish_tcp_accept(i32 %282, %struct.nish_array* %283)
  %285 = call i8* @nish_str_from_i32(i32 %284)
  call void @nish_print(i8* %285)
  %286 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 1)
  store i32 %286, i32* %shared.addr, align 4
  %287 = load i32, i32* %shared.addr, align 4
  %288 = call i32 @nish_net_local_port(i32 %287)
  %289 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %288, i32 1)
  store i32 %289, i32* %again.addr, align 4
  %290 = load i32, i32* %shared.addr, align 4
  %291 = icmp sge i32 %290, 0
  br i1 %291, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %292 = load i32, i32* %again.addr, align 4
  %293 = icmp sge i32 %292, 0
  br label %land.end.2

land.end.2:
  %294 = phi i1 [ false, %net.ok.5 ], [ %293, %land.rhs.2 ]
  %295 = select i1 %294, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %295)
  %296 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i32 0, i32 0)
  store i32 %296, i32* %both.addr, align 4
  %297 = load i32, i32* %both.addr, align 4
  %298 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %299 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %300 = call i32 @send$(i32 %297, %struct.nish_array* %298, %struct.nish_array* %299)
  %301 = call i8* @nish_str_from_i32(i32 %300)
  call void @nish_print(i8* %301)
  %302 = load i32, i32* %b.addr, align 4
  %303 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %304 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %305 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %306 = call i32 @receive(i32 %302, %struct.nish_array* %303, i32 0, i32 8, %struct.nish_array* %304, %struct.nish_array* %305)
  %307 = call i8* @nish_str_from_i32(i32 %306)
  call void @nish_print(i8* %307)
  %308 = load i32, i32* %a.addr, align 4
  %309 = call i32 @nish_net_close(i32 %308)
  %310 = load i32, i32* %b.addr, align 4
  %311 = call i32 @nish_net_close(i32 %310)
  %312 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %309, i32 %311)
  %313 = extractvalue { i32, i1 } %312, 0
  %314 = extractvalue { i32, i1 } %312, 1
  br i1 %314, label %ovf.fail, label %ovf.ok

ovf.ok:
  %315 = load i32, i32* %shared.addr, align 4
  %316 = call i32 @nish_net_close(i32 %315)
  %317 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %313, i32 %316)
  %318 = extractvalue { i32, i1 } %317, 0
  %319 = extractvalue { i32, i1 } %317, 1
  br i1 %319, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %320 = load i32, i32* %again.addr, align 4
  %321 = call i32 @nish_net_close(i32 %320)
  %322 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %318, i32 %321)
  %323 = extractvalue { i32, i1 } %322, 0
  %324 = extractvalue { i32, i1 } %322, 1
  br i1 %324, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %325 = load i32, i32* %both.addr, align 4
  %326 = call i32 @nish_net_close(i32 %325)
  %327 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %323, i32 %326)
  %328 = extractvalue { i32, i1 } %327, 0
  %329 = extractvalue { i32, i1 } %327, 1
  br i1 %329, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %330 = call i8* @nish_str_from_i32(i32 %328)
  call void @nish_print(i8* %330)
  %331 = load i32, i32* %a.addr, align 4
  %332 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %333 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %334 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %335 = add i64 0, 8
  %336 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %332, i64 0, i32 0
  %337 = load i64, i64* %336, align 8
  %338 = icmp ule i64 0, %335
  %339 = icmp ule i64 %335, %337
  %340 = and i1 %338, %339
  br i1 %340, label %net.ok.6, label %net.fail.6

net.fail.6:
  call void @nish_panic_slice(i64 0, i64 %335, i64 %337)
  unreachable

net.ok.6:
  %341 = call i32 @nish_udp_recv_from(i32 %331, %struct.nish_array* %332, i64 0, i64 8, %struct.nish_array* %333, %struct.nish_array* %334)
  %342 = call i8* @nish_str_from_i32(i32 %341)
  call void @nish_print(i8* %342)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
