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
  %47 = call i32 @nish_udp_recv_from(i32 %43, %struct.nish_array* %44, i64 0, i64 8, %struct.nish_array* %45, %struct.nish_array* %46)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
  %49 = load i32, i32* %a.addr, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %52 = call i32 @send$(i32 %49, %struct.nish_array* %50, %struct.nish_array* %51)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
  %54 = load i32, i32* %b.addr, align 4
  %55 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %58 = call i32 @receive(i32 %54, %struct.nish_array* %55, i32 2, i32 6, %struct.nish_array* %56, %struct.nish_array* %57)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  call void @nish_print(i8* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = icmp ult i64 2, %62
  br i1 %63, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %62)
  unreachable

bounds.ok:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8*
  %67 = getelementptr inbounds i8, i8* %66, i64 2
  %68 = load i8, i8* %67, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = zext i8 %68 to i64
  %70 = call i8* @nish_str_from_u64(i64 %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %72 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 3, %74
  br i1 %75, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %74)
  unreachable

bounds.ok.1:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = bitcast i8* %77 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 3
  %80 = load i8, i8* %79, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %81 = zext i8 %80 to i64
  %82 = call i8* @nish_str_from_u64(i64 %81)
  %83 = call i8* @nish_str_concat(i8* %71, i8* %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %85 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 4, %87
  br i1 %88, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 4, i64 %87)
  unreachable

bounds.ok.2:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8*
  %92 = getelementptr inbounds i8, i8* %91, i64 4
  %93 = load i8, i8* %92, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %94 = zext i8 %93 to i64
  %95 = call i8* @nish_str_from_u64(i64 %94)
  %96 = call i8* @nish_str_concat(i8* %84, i8* %95)
  %97 = call i8* @nish_str_concat(i8* %96, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %98 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp ult i64 0, %100
  br i1 %101, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %100)
  unreachable

bounds.ok.3:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %104 = bitcast i8* %103 to i32*
  %105 = getelementptr inbounds i32, i32* %104, i64 0
  %106 = load i32, i32* %105, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %97, i8* %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %110 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  %112 = load i64, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = icmp ult i64 1, %112
  br i1 %113, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %112)
  unreachable

bounds.ok.4:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = bitcast i8* %115 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 1
  %118 = load i32, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %119 = call i8* @nish_str_from_i32(i32 %118)
  %120 = call i8* @nish_str_concat(i8* %109, i8* %119)
  call void @nish_print(i8* %120)
  %121 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = icmp ult i64 16, %123
  br i1 %124, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 16, i64 %123)
  unreachable

bounds.ok.5:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %127 = bitcast i8* %126 to i8*
  %128 = getelementptr inbounds i8, i8* %127, i64 16
  %129 = load i8, i8* %128, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %130 = zext i8 %129 to i32
  %131 = shl i32 %130, 8
  %132 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = icmp ult i64 17, %134
  br i1 %135, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 17, i64 %134)
  unreachable

bounds.ok.6:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = bitcast i8* %137 to i8*
  %139 = getelementptr inbounds i8, i8* %138, i64 17
  %140 = load i8, i8* %139, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %141 = zext i8 %140 to i32
  %142 = or i32 %131, %141
  store i32 %142, i32* %port.addr, align 4
  %143 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %146 = bitcast i8* %145 to i8*
  %147 = getelementptr inbounds i8, i8* %146, i64 10
  %148 = load i8, i8* %147, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %149 = zext i8 %148 to i64
  %150 = call i8* @nish_str_from_u64(i64 %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %152 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 2
  %154 = load i8*, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %155 = bitcast i8* %154 to i8*
  %156 = getelementptr inbounds i8, i8* %155, i64 11
  %157 = load i8, i8* %156, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %158 = zext i8 %157 to i64
  %159 = call i8* @nish_str_from_u64(i64 %158)
  %160 = call i8* @nish_str_concat(i8* %151, i8* %159)
  %161 = call i8* @nish_str_concat(i8* %160, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %162 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 2
  %164 = load i8*, i8** %163, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %165 = bitcast i8* %164 to i8*
  %166 = getelementptr inbounds i8, i8* %165, i64 12
  %167 = load i8, i8* %166, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %168 = zext i8 %167 to i64
  %169 = call i8* @nish_str_from_u64(i64 %168)
  %170 = call i8* @nish_str_concat(i8* %161, i8* %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %172 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %175 = bitcast i8* %174 to i8*
  %176 = getelementptr inbounds i8, i8* %175, i64 15
  %177 = load i8, i8* %176, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %178 = zext i8 %177 to i64
  %179 = call i8* @nish_str_from_u64(i64 %178)
  %180 = call i8* @nish_str_concat(i8* %171, i8* %179)
  %181 = call i8* @nish_str_concat(i8* %180, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %182 = load i32, i32* %port.addr, align 4
  %183 = load i32, i32* %a.addr, align 4
  %184 = call i32 @nish_net_local_port(i32 %183)
  %185 = icmp eq i32 %182, %184
  %186 = select i1 %185, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %187 = call i8* @nish_str_concat(i8* %181, i8* %186)
  call void @nish_print(i8* %187)
  %188 = load i32, i32* %a.addr, align 4
  %189 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %190 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %191 = call i32 @send$(i32 %188, %struct.nish_array* %189, %struct.nish_array* %190)
  %192 = call i8* @nish_str_from_i32(i32 %191)
  call void @nish_print(i8* %192)
  %193 = load i32, i32* %b.addr, align 4
  %194 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %195 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %196 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %197 = call i32 @receive(i32 %193, %struct.nish_array* %194, i32 0, i32 2, %struct.nish_array* %195, %struct.nish_array* %196)
  %198 = call i8* @nish_str_from_i32(i32 %197)
  call void @nish_print(i8* %198)
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 17, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 17, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %201 = bitcast [17 x i8]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %201, i8 0, i64 17, i1 false), !alias.scope !4, !noalias !3
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %201, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %short.addr, align 8
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 1, i64* %203, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 1, i64* %204, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %205 = bitcast [1 x i32]* %arr.data.6 to i8*
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %205, i8** %206, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %207 = bitcast i8* %205 to i32*
  %208 = getelementptr inbounds i32, i32* %207, i64 0
  store i32 0, i32* %208, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %one.addr, align 8
  %209 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4)
  %210 = call i8* @nish_str_from_i32(i32 %209)
  call void @nish_print(i8* %210)
  %211 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 8)
  %212 = call i8* @nish_str_from_i32(i32 %211)
  call void @nish_print(i8* %212)
  %213 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*), i32 0, i32 0)
  %214 = call i8* @nish_str_from_i32(i32 %213)
  call void @nish_print(i8* %214)
  %215 = load i32, i32* %a.addr, align 4
  %216 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %217 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %218 = add i64 0, 3
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %220 = load i64, i64* %219, align 8
  %221 = icmp ule i64 0, %218
  %222 = icmp ule i64 %218, %220
  %223 = and i1 %221, %222
  br i1 %223, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %218, i64 %220)
  unreachable

net.ok:
  %224 = call i32 @nish_udp_send_to(i32 %215, %struct.nish_array* %216, i64 0, i64 3, %struct.nish_array* %217, i32 0, i32 0)
  %225 = call i8* @nish_str_from_i32(i32 %224)
  call void @nish_print(i8* %225)
  %226 = load i32, i32* %a.addr, align 4
  %227 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %228 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %229 = add i64 0, 3
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 0
  %231 = load i64, i64* %230, align 8
  %232 = icmp ule i64 0, %229
  %233 = icmp ule i64 %229, %231
  %234 = and i1 %232, %233
  br i1 %234, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %229, i64 %231)
  unreachable

net.ok.1:
  %235 = call i32 @nish_udp_send_to(i32 %226, %struct.nish_array* %227, i64 0, i64 3, %struct.nish_array* %228, i32 65536, i32 0)
  %236 = call i8* @nish_str_from_i32(i32 %235)
  call void @nish_print(i8* %236)
  %237 = load i32, i32* %a.addr, align 4
  %238 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %239 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %240 = add i64 0, 3
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %238, i64 0, i32 0
  %242 = load i64, i64* %241, align 8
  %243 = icmp ule i64 0, %240
  %244 = icmp ule i64 %240, %242
  %245 = and i1 %243, %244
  br i1 %245, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %240, i64 %242)
  unreachable

net.ok.2:
  %246 = call i32 @nish_udp_send_to(i32 %237, %struct.nish_array* %238, i64 0, i64 3, %struct.nish_array* %239, i32 0, i32 4)
  %247 = call i8* @nish_str_from_i32(i32 %246)
  call void @nish_print(i8* %247)
  %248 = load i32, i32* %b.addr, align 4
  %249 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %250 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %251 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %252 = add i64 0, 8
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %249, i64 0, i32 0
  %254 = load i64, i64* %253, align 8
  %255 = icmp ule i64 0, %252
  %256 = icmp ule i64 %252, %254
  %257 = and i1 %255, %256
  br i1 %257, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %252, i64 %254)
  unreachable

net.ok.3:
  %258 = call i32 @nish_udp_recv_from(i32 %248, %struct.nish_array* %249, i64 0, i64 8, %struct.nish_array* %250, %struct.nish_array* %251)
  %259 = call i8* @nish_str_from_i32(i32 %258)
  call void @nish_print(i8* %259)
  %260 = load i32, i32* %b.addr, align 4
  %261 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %262 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %263 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %264 = add i64 0, 8
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 0
  %266 = load i64, i64* %265, align 8
  %267 = icmp ule i64 0, %264
  %268 = icmp ule i64 %264, %266
  %269 = and i1 %267, %268
  br i1 %269, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %264, i64 %266)
  unreachable

net.ok.4:
  %270 = call i32 @nish_udp_recv_from(i32 %260, %struct.nish_array* %261, i64 0, i64 8, %struct.nish_array* %262, %struct.nish_array* %263)
  %271 = call i8* @nish_str_from_i32(i32 %270)
  call void @nish_print(i8* %271)
  %272 = load i32, i32* %b.addr, align 4
  %273 = call i32 @nish_net_local_port(i32 %272)
  %274 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %273, i32 0)
  %275 = call i8* @nish_str_from_i32(i32 %274)
  call void @nish_print(i8* %275)
  %276 = load i32, i32* %b.addr, align 4
  %277 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %278 = call i32 @nish_tcp_accept(i32 %276, %struct.nish_array* %277)
  %279 = call i8* @nish_str_from_i32(i32 %278)
  call void @nish_print(i8* %279)
  %280 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 1)
  store i32 %280, i32* %shared.addr, align 4
  %281 = load i32, i32* %shared.addr, align 4
  %282 = call i32 @nish_net_local_port(i32 %281)
  %283 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %282, i32 1)
  store i32 %283, i32* %again.addr, align 4
  %284 = load i32, i32* %shared.addr, align 4
  %285 = icmp sge i32 %284, 0
  br i1 %285, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %286 = load i32, i32* %again.addr, align 4
  %287 = icmp sge i32 %286, 0
  br label %land.end.2

land.end.2:
  %288 = phi i1 [ false, %net.ok.4 ], [ %287, %land.rhs.2 ]
  %289 = select i1 %288, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %289)
  %290 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i32 0, i32 0)
  store i32 %290, i32* %both.addr, align 4
  %291 = load i32, i32* %both.addr, align 4
  %292 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %293 = load %struct.nish_array*, %struct.nish_array** %toB.addr, align 8
  %294 = call i32 @send$(i32 %291, %struct.nish_array* %292, %struct.nish_array* %293)
  %295 = call i8* @nish_str_from_i32(i32 %294)
  call void @nish_print(i8* %295)
  %296 = load i32, i32* %b.addr, align 4
  %297 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %298 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %299 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %300 = call i32 @receive(i32 %296, %struct.nish_array* %297, i32 0, i32 8, %struct.nish_array* %298, %struct.nish_array* %299)
  %301 = call i8* @nish_str_from_i32(i32 %300)
  call void @nish_print(i8* %301)
  %302 = load i32, i32* %a.addr, align 4
  %303 = call i32 @nish_net_close(i32 %302)
  %304 = load i32, i32* %b.addr, align 4
  %305 = call i32 @nish_net_close(i32 %304)
  %306 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %303, i32 %305)
  %307 = extractvalue { i32, i1 } %306, 0
  %308 = extractvalue { i32, i1 } %306, 1
  br i1 %308, label %ovf.fail, label %ovf.ok

ovf.ok:
  %309 = load i32, i32* %shared.addr, align 4
  %310 = call i32 @nish_net_close(i32 %309)
  %311 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %307, i32 %310)
  %312 = extractvalue { i32, i1 } %311, 0
  %313 = extractvalue { i32, i1 } %311, 1
  br i1 %313, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %314 = load i32, i32* %again.addr, align 4
  %315 = call i32 @nish_net_close(i32 %314)
  %316 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %312, i32 %315)
  %317 = extractvalue { i32, i1 } %316, 0
  %318 = extractvalue { i32, i1 } %316, 1
  br i1 %318, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %319 = load i32, i32* %both.addr, align 4
  %320 = call i32 @nish_net_close(i32 %319)
  %321 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %317, i32 %320)
  %322 = extractvalue { i32, i1 } %321, 0
  %323 = extractvalue { i32, i1 } %321, 1
  br i1 %323, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %324 = call i8* @nish_str_from_i32(i32 %322)
  call void @nish_print(i8* %324)
  %325 = load i32, i32* %a.addr, align 4
  %326 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %327 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %328 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %329 = add i64 0, 8
  %330 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %326, i64 0, i32 0
  %331 = load i64, i64* %330, align 8
  %332 = icmp ule i64 0, %329
  %333 = icmp ule i64 %329, %331
  %334 = and i1 %332, %333
  br i1 %334, label %net.ok.5, label %net.fail.5

net.fail.5:
  call void @nish_panic_slice(i64 0, i64 %329, i64 %331)
  unreachable

net.ok.5:
  %335 = call i32 @nish_udp_recv_from(i32 %325, %struct.nish_array* %326, i64 0, i64 8, %struct.nish_array* %327, %struct.nish_array* %328)
  %336 = call i8* @nish_str_from_i32(i32 %335)
  call void @nish_print(i8* %336)
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
