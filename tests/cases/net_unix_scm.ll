%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"build/test/nus-peer-\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c".sock\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_unix_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_unix_connect(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_unix_accept(i32 noundef) #0
declare noundef i32 @nish_unix_socket_pair(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #2
declare noundef i32 @nish_send_fd(i32 noundef, i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_recv_fd(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_peer_credentials(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noundef nonnull align 8 i8* @pathOf(i32 noundef %pid) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %pid)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.0 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  ret i8* %2
}

define internal noundef i32 @widowed() #0 {
entry:
  %fds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %made.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 2, 4
  %3 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fds.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %6 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %5)
  store i32 %6, i32* %made.addr, align 4
  %7 = load i32, i32* %made.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load i32, i32* %made.addr, align 4
  ret i32 %9

if.end:
  %10 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 1, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 1
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i32 @nish_net_close(i32 %18)
  %20 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %25
}

define internal noundef i32 @drain(i32 noundef %sock) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %fd.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [1 x i32]* %arr.data.1 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 7, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fd.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %12 = add i64 0, 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ule i64 0, %12
  %16 = icmp ule i64 %12, %14
  %17 = and i1 %15, %16
  br i1 %17, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %12, i64 %14)
  unreachable

net.ok:
  %18 = call i32 @nish_recv_fd(i32 %sock, %struct.nish_array* %10, i64 0, i64 8, %struct.nish_array* %11)
  store i32 %18, i32* %n.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 0, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = icmp sge i32 %27, 0
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = call i32 @nish_net_close(i32 %34)
  %36 = load i32, i32* %n.addr, align 4
  %37 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %36, i32 1000)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %38

if.end:
  %40 = load i32, i32* %n.addr, align 4
  ret i32 %40

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @sentOver(i32 noundef %send) #0 {
entry:
  %fds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %made.addr = alloca i32, align 4
  %answer.addr = alloca i32, align 4
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 2, 4
  %3 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fds.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %6 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %5)
  store i32 %6, i32* %made.addr, align 4
  %7 = load i32, i32* %made.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load i32, i32* %made.addr, align 4
  ret i32 %9

if.end:
  %10 = icmp eq i32 %send, 0
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 0, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast [2 x i8]* %arr.data.1 to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %22 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 0
  store i8 1, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = getelementptr inbounds i8, i8* %24, i64 1
  store i8 2, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = add i64 0, 2
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %29 = load i64, i64* %28, align 8
  %30 = icmp ule i64 0, %27
  %31 = icmp ule i64 %27, %29
  %32 = and i1 %30, %31
  br i1 %32, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %27, i64 %29)
  unreachable

net.ok:
  %33 = call i32 @nish_net_write(i32 %19, %struct.nish_array* %arr.hdr.1, i64 0, i64 2)
  br label %cond.end

cond.false:
  %34 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp ult i64 0, %36
  br i1 %37, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %36)
  unreachable

bounds.ok.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 0
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = bitcast [2 x i8]* %arr.data.2 to i8*
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %45, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %45 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 0
  store i8 1, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %49 = getelementptr inbounds i8, i8* %47, i64 1
  store i8 2, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %50 = add i64 0, 2
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  %52 = load i64, i64* %51, align 8
  %53 = icmp ule i64 0, %50
  %54 = icmp ule i64 %50, %52
  %55 = and i1 %53, %54
  br i1 %55, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %50, i64 %52)
  unreachable

net.ok.1:
  %56 = call i32 @nish_send_fd(i32 %42, i32 %send, %struct.nish_array* %arr.hdr.2, i64 0, i64 2)
  br label %cond.end

cond.end:
  %57 = phi i32 [ %33, %net.ok ], [ %56, %net.ok.1 ]
  store i32 %57, i32* %answer.addr, align 4
  %58 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = icmp ult i64 0, %60
  br i1 %61, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %60)
  unreachable

bounds.ok.2:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 0
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = call i32 @nish_net_close(i32 %66)
  %68 = load i32, i32* %answer.addr, align 4
  %69 = icmp slt i32 %68, 0
  br i1 %69, label %if.then.1, label %if.end.1

if.then.1:
  %70 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = icmp ult i64 1, %72
  br i1 %73, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %72)
  unreachable

bounds.ok.3:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 1
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = call i32 @nish_net_close(i32 %78)
  %80 = load i32, i32* %answer.addr, align 4
  ret i32 %80

if.end.1:
  %81 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp ult i64 1, %83
  br i1 %84, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %83)
  unreachable

bounds.ok.4:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 1
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %89
}

define noundef i32 @attempts() #1 {
entry:
  ret i32 25
}

define noundef i32 @attempt(i32 noundef %k, i32 noundef %file, i32 noundef %tcp, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %fd.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %sock.addr = alloca i32, align 4
  %answer.addr = alloca i32, align 4
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %sock.addr.1 = alloca i32, align 4
  %answer.addr.1 = alloca i32, align 4
  %sock.addr.2 = alloca i32, align 4
  %answer.addr.2 = alloca i32, align 4
  %sock.addr.3 = alloca i32, align 4
  %answer.addr.3 = alloca i32, align 4
  %sock.addr.4 = alloca i32, align 4
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x i32], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [3 x i32], align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [3 x i32], align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [3 x i32], align 8
  %sock.addr.5 = alloca i32, align 4
  %answer.addr.4 = alloca i32, align 4
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [3 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [1 x i32]* %arr.data.1 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 7, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fd.addr, align 8
  %10 = icmp eq i32 %k, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %12 = add i64 0, 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ule i64 0, %12
  %16 = icmp ule i64 %12, %14
  %17 = and i1 %15, %16
  br i1 %17, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %12, i64 %14)
  unreachable

net.ok:
  %18 = call i32 @nish_send_fd(i32 %a, i32 %file, %struct.nish_array* %11, i64 0, i64 0)
  ret i32 %18

if.end:
  %19 = icmp eq i32 %k, 1
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %21 = add i64 0, 1
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8
  %24 = icmp ule i64 0, %21
  %25 = icmp ule i64 %21, %23
  %26 = and i1 %24, %25
  br i1 %26, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %21, i64 %23)
  unreachable

net.ok.1:
  %27 = call i32 @nish_send_fd(i32 %a, i32 -1, %struct.nish_array* %20, i64 0, i64 1)
  ret i32 %27

if.end.1:
  %28 = icmp eq i32 %k, 2
  br i1 %28, label %if.then.2, label %if.end.2

if.then.2:
  %29 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %30 = add i64 0, 1
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %32 = load i64, i64* %31, align 8
  %33 = icmp ule i64 0, %30
  %34 = icmp ule i64 %30, %32
  %35 = and i1 %33, %34
  br i1 %35, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %30, i64 %32)
  unreachable

net.ok.2:
  %36 = call i32 @nish_send_fd(i32 %file, i32 %file, %struct.nish_array* %29, i64 0, i64 1)
  ret i32 %36

if.end.2:
  %37 = icmp eq i32 %k, 3
  br i1 %37, label %if.then.3, label %if.end.3

if.then.3:
  %38 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %39 = add i64 0, 1
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %41 = load i64, i64* %40, align 8
  %42 = icmp ule i64 0, %39
  %43 = icmp ule i64 %39, %41
  %44 = and i1 %42, %43
  br i1 %44, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %39, i64 %41)
  unreachable

net.ok.3:
  %45 = call i32 @nish_send_fd(i32 %tcp, i32 %file, %struct.nish_array* %38, i64 0, i64 1)
  ret i32 %45

if.end.3:
  %46 = icmp eq i32 %k, 4
  br i1 %46, label %if.then.4, label %if.end.4

if.then.4:
  %47 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %48 = add i64 0, 1
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8
  %51 = icmp ule i64 0, %48
  %52 = icmp ule i64 %48, %50
  %53 = and i1 %51, %52
  br i1 %53, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %48, i64 %50)
  unreachable

net.ok.4:
  %54 = call i32 @nish_send_fd(i32 1000, i32 %file, %struct.nish_array* %47, i64 0, i64 1)
  ret i32 %54

if.end.4:
  %55 = icmp eq i32 %k, 5
  br i1 %55, label %if.then.5, label %if.end.5

if.then.5:
  %56 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %57 = add i64 0, 1
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %59 = load i64, i64* %58, align 8
  %60 = icmp ule i64 0, %57
  %61 = icmp ule i64 %57, %59
  %62 = and i1 %60, %61
  br i1 %62, label %net.ok.5, label %net.fail.5

net.fail.5:
  call void @nish_panic_slice(i64 0, i64 %57, i64 %59)
  unreachable

net.ok.5:
  %63 = call i32 @nish_send_fd(i32 %a, i32 1000, %struct.nish_array* %56, i64 0, i64 1)
  ret i32 %63

if.end.5:
  %64 = icmp eq i32 %k, 6
  br i1 %64, label %if.then.6, label %if.end.6

if.then.6:
  %65 = call i32 @widowed()
  store i32 %65, i32* %sock.addr, align 4
  %66 = load i32, i32* %sock.addr, align 4
  %67 = icmp slt i32 %66, 0
  br i1 %67, label %cond.true, label %cond.false

cond.true:
  %68 = load i32, i32* %sock.addr, align 4
  br label %cond.end

cond.false:
  %69 = load i32, i32* %sock.addr, align 4
  %70 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %71 = add i64 0, 1
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %73 = load i64, i64* %72, align 8
  %74 = icmp ule i64 0, %71
  %75 = icmp ule i64 %71, %73
  %76 = and i1 %74, %75
  br i1 %76, label %net.ok.6, label %net.fail.6

net.fail.6:
  call void @nish_panic_slice(i64 0, i64 %71, i64 %73)
  unreachable

net.ok.6:
  %77 = call i32 @nish_send_fd(i32 %69, i32 %file, %struct.nish_array* %70, i64 0, i64 1)
  br label %cond.end

cond.end:
  %78 = phi i32 [ %68, %cond.true ], [ %77, %net.ok.6 ]
  store i32 %78, i32* %answer.addr, align 4
  %79 = load i32, i32* %sock.addr, align 4
  %80 = call i32 @nish_net_close(i32 %79)
  %81 = load i32, i32* %answer.addr, align 4
  ret i32 %81

if.end.6:
  %82 = icmp eq i32 %k, 7
  br i1 %82, label %if.then.7, label %if.end.7

if.then.7:
  %83 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %84 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %85 = add i64 0, 0
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %87 = load i64, i64* %86, align 8
  %88 = icmp ule i64 0, %85
  %89 = icmp ule i64 %85, %87
  %90 = and i1 %88, %89
  br i1 %90, label %net.ok.7, label %net.fail.7

net.fail.7:
  call void @nish_panic_slice(i64 0, i64 %85, i64 %87)
  unreachable

net.ok.7:
  %91 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %83, i64 0, i64 0, %struct.nish_array* %84)
  ret i32 %91

if.end.7:
  %92 = icmp eq i32 %k, 8
  br i1 %92, label %if.then.8, label %if.end.8

if.then.8:
  %93 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = add i64 0, 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %99 = load i64, i64* %98, align 8
  %100 = icmp ule i64 0, %97
  %101 = icmp ule i64 %97, %99
  %102 = and i1 %100, %101
  br i1 %102, label %net.ok.8, label %net.fail.8

net.fail.8:
  call void @nish_panic_slice(i64 0, i64 %97, i64 %99)
  unreachable

net.ok.8:
  %103 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %93, i64 0, i64 8, %struct.nish_array* %arr.hdr.2)
  ret i32 %103

if.end.8:
  %104 = icmp eq i32 %k, 9
  br i1 %104, label %if.then.9, label %if.end.9

if.then.9:
  %105 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %106 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %107 = add i64 0, 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %109 = load i64, i64* %108, align 8
  %110 = icmp ule i64 0, %107
  %111 = icmp ule i64 %107, %109
  %112 = and i1 %110, %111
  br i1 %112, label %net.ok.9, label %net.fail.9

net.fail.9:
  call void @nish_panic_slice(i64 0, i64 %107, i64 %109)
  unreachable

net.ok.9:
  %113 = call i32 @nish_recv_fd(i32 %file, %struct.nish_array* %105, i64 0, i64 8, %struct.nish_array* %106)
  ret i32 %113

if.end.9:
  %114 = icmp eq i32 %k, 10
  br i1 %114, label %if.then.10, label %if.end.10

if.then.10:
  %115 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %117 = add i64 0, 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %119 = load i64, i64* %118, align 8
  %120 = icmp ule i64 0, %117
  %121 = icmp ule i64 %117, %119
  %122 = and i1 %120, %121
  br i1 %122, label %net.ok.10, label %net.fail.10

net.fail.10:
  call void @nish_panic_slice(i64 0, i64 %117, i64 %119)
  unreachable

net.ok.10:
  %123 = call i32 @nish_recv_fd(i32 %tcp, %struct.nish_array* %115, i64 0, i64 8, %struct.nish_array* %116)
  ret i32 %123

if.end.10:
  %124 = icmp eq i32 %k, 11
  br i1 %124, label %if.then.11, label %if.end.11

if.then.11:
  %125 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %126 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %127 = add i64 0, 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %129 = load i64, i64* %128, align 8
  %130 = icmp ule i64 0, %127
  %131 = icmp ule i64 %127, %129
  %132 = and i1 %130, %131
  br i1 %132, label %net.ok.11, label %net.fail.11

net.fail.11:
  call void @nish_panic_slice(i64 0, i64 %127, i64 %129)
  unreachable

net.ok.11:
  %133 = call i32 @nish_recv_fd(i32 1000, %struct.nish_array* %125, i64 0, i64 8, %struct.nish_array* %126)
  ret i32 %133

if.end.11:
  %134 = icmp eq i32 %k, 12
  br i1 %134, label %if.then.12, label %if.end.12

if.then.12:
  %135 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %136 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %137 = add i64 0, 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %139 = load i64, i64* %138, align 8
  %140 = icmp ule i64 0, %137
  %141 = icmp ule i64 %137, %139
  %142 = and i1 %140, %141
  br i1 %142, label %net.ok.12, label %net.fail.12

net.fail.12:
  call void @nish_panic_slice(i64 0, i64 %137, i64 %139)
  unreachable

net.ok.12:
  %143 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %135, i64 0, i64 8, %struct.nish_array* %136)
  %144 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %143, i32 10)
  %145 = extractvalue { i32, i1 } %144, 0
  %146 = extractvalue { i32, i1 } %144, 1
  br i1 %146, label %ovf.fail, label %ovf.ok

ovf.ok:
  %147 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 0
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = icmp ult i64 0, %149
  br i1 %150, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %149)
  unreachable

bounds.ok:
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %153 = bitcast i8* %152 to i32*
  %154 = getelementptr inbounds i32, i32* %153, i64 0
  %155 = load i32, i32* %154, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %156 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %145, i32 %155)
  %157 = extractvalue { i32, i1 } %156, 0
  %158 = extractvalue { i32, i1 } %156, 1
  br i1 %158, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %157

if.end.12:
  %159 = icmp eq i32 %k, 13
  br i1 %159, label %if.then.13, label %if.end.13

if.then.13:
  %160 = call i32 @widowed()
  store i32 %160, i32* %sock.addr.1, align 4
  %161 = load i32, i32* %sock.addr.1, align 4
  %162 = icmp slt i32 %161, 0
  br i1 %162, label %cond.true.1, label %cond.false.1

cond.true.1:
  %163 = load i32, i32* %sock.addr.1, align 4
  br label %cond.end.1

cond.false.1:
  %164 = load i32, i32* %sock.addr.1, align 4
  %165 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %166 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %167 = add i64 0, 8
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 0
  %169 = load i64, i64* %168, align 8
  %170 = icmp ule i64 0, %167
  %171 = icmp ule i64 %167, %169
  %172 = and i1 %170, %171
  br i1 %172, label %net.ok.13, label %net.fail.13

net.fail.13:
  call void @nish_panic_slice(i64 0, i64 %167, i64 %169)
  unreachable

net.ok.13:
  %173 = call i32 @nish_recv_fd(i32 %164, %struct.nish_array* %165, i64 0, i64 8, %struct.nish_array* %166)
  %174 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %173, i32 10)
  %175 = extractvalue { i32, i1 } %174, 0
  %176 = extractvalue { i32, i1 } %174, 1
  br i1 %176, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %177 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %177, i64 0, i32 0
  %179 = load i64, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = icmp ult i64 0, %179
  br i1 %180, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %179)
  unreachable

bounds.ok.1:
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %177, i64 0, i32 2
  %182 = load i8*, i8** %181, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %183 = bitcast i8* %182 to i32*
  %184 = getelementptr inbounds i32, i32* %183, i64 0
  %185 = load i32, i32* %184, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %186 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %175, i32 %185)
  %187 = extractvalue { i32, i1 } %186, 0
  %188 = extractvalue { i32, i1 } %186, 1
  br i1 %188, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.1

cond.end.1:
  %189 = phi i32 [ %163, %cond.true.1 ], [ %187, %ovf.ok.3 ]
  store i32 %189, i32* %answer.addr.1, align 4
  %190 = load i32, i32* %sock.addr.1, align 4
  %191 = call i32 @nish_net_close(i32 %190)
  %192 = load i32, i32* %answer.addr.1, align 4
  ret i32 %192

if.end.13:
  %193 = icmp eq i32 %k, 14
  br i1 %193, label %if.then.14, label %if.end.14

if.then.14:
  %194 = call i32 @sentOver(i32 0)
  store i32 %194, i32* %sock.addr.2, align 4
  %195 = load i32, i32* %sock.addr.2, align 4
  %196 = icmp slt i32 %195, 0
  br i1 %196, label %cond.true.2, label %cond.false.2

cond.true.2:
  %197 = load i32, i32* %sock.addr.2, align 4
  br label %cond.end.2

cond.false.2:
  %198 = load i32, i32* %sock.addr.2, align 4
  %199 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %200 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %201 = add i64 0, 8
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %199, i64 0, i32 0
  %203 = load i64, i64* %202, align 8
  %204 = icmp ule i64 0, %201
  %205 = icmp ule i64 %201, %203
  %206 = and i1 %204, %205
  br i1 %206, label %net.ok.14, label %net.fail.14

net.fail.14:
  call void @nish_panic_slice(i64 0, i64 %201, i64 %203)
  unreachable

net.ok.14:
  %207 = call i32 @nish_recv_fd(i32 %198, %struct.nish_array* %199, i64 0, i64 8, %struct.nish_array* %200)
  %208 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %207, i32 10)
  %209 = extractvalue { i32, i1 } %208, 0
  %210 = extractvalue { i32, i1 } %208, 1
  br i1 %210, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %211 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 0
  %213 = load i64, i64* %212, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %214 = icmp ult i64 0, %213
  br i1 %214, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %213)
  unreachable

bounds.ok.2:
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 2
  %216 = load i8*, i8** %215, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %217 = bitcast i8* %216 to i32*
  %218 = getelementptr inbounds i32, i32* %217, i64 0
  %219 = load i32, i32* %218, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %220 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %209, i32 %219)
  %221 = extractvalue { i32, i1 } %220, 0
  %222 = extractvalue { i32, i1 } %220, 1
  br i1 %222, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  br label %cond.end.2

cond.end.2:
  %223 = phi i32 [ %197, %cond.true.2 ], [ %221, %ovf.ok.5 ]
  store i32 %223, i32* %answer.addr.2, align 4
  %224 = load i32, i32* %sock.addr.2, align 4
  %225 = call i32 @nish_net_close(i32 %224)
  %226 = load i32, i32* %answer.addr.2, align 4
  ret i32 %226

if.end.14:
  %227 = icmp eq i32 %k, 15
  br i1 %227, label %if.then.15, label %if.end.15

if.then.15:
  %228 = call i32 @sentOver(i32 %file)
  store i32 %228, i32* %sock.addr.3, align 4
  %229 = load i32, i32* %sock.addr.3, align 4
  %230 = icmp slt i32 %229, 0
  br i1 %230, label %cond.true.3, label %cond.false.3

cond.true.3:
  %231 = load i32, i32* %sock.addr.3, align 4
  br label %cond.end.3

cond.false.3:
  %232 = load i32, i32* %sock.addr.3, align 4
  %233 = call i32 @drain(i32 %232)
  br label %cond.end.3

cond.end.3:
  %234 = phi i32 [ %231, %cond.true.3 ], [ %233, %cond.false.3 ]
  store i32 %234, i32* %answer.addr.3, align 4
  %235 = load i32, i32* %sock.addr.3, align 4
  %236 = call i32 @nish_net_close(i32 %235)
  %237 = load i32, i32* %answer.addr.3, align 4
  ret i32 %237

if.end.15:
  %238 = icmp eq i32 %k, 16
  br i1 %238, label %if.then.16, label %if.end.16

if.then.16:
  %239 = call i32 @sentOver(i32 %file)
  store i32 %239, i32* %sock.addr.4, align 4
  %240 = load i32, i32* %sock.addr.4, align 4
  %241 = call i32 @nish_net_close(i32 %240)
  %242 = load i32, i32* %sock.addr.4, align 4
  %243 = icmp slt i32 %242, 0
  br i1 %243, label %cond.true.4, label %cond.false.4

cond.true.4:
  %244 = load i32, i32* %sock.addr.4, align 4
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %245 = phi i32 [ %244, %cond.true.4 ], [ 0, %cond.false.4 ]
  ret i32 %245

if.end.16:
  %246 = icmp eq i32 %k, 17
  br i1 %246, label %if.then.17, label %if.end.17

if.then.17:
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %247, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %248, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %249 = bitcast [2 x i32]* %arr.data.2 to i8*
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %249, i8** %250, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %251 = bitcast i8* %249 to i32*
  %252 = getelementptr inbounds i32, i32* %251, i64 0
  store i32 0, i32* %252, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %253 = getelementptr inbounds i32, i32* %251, i64 1
  store i32 0, i32* %253, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %254 = call i32 @nish_peer_credentials(i32 %a, %struct.nish_array* %arr.hdr.3)
  ret i32 %254

if.end.17:
  %255 = icmp eq i32 %k, 18
  br i1 %255, label %if.then.18, label %if.end.18

if.then.18:
  %256 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %256, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %257 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %257, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %258 = bitcast [3 x i32]* %arr.data.3 to i8*
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %258, i8** %259, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %260 = bitcast i8* %258 to i32*
  %261 = getelementptr inbounds i32, i32* %260, i64 0
  store i32 0, i32* %261, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %262 = getelementptr inbounds i32, i32* %260, i64 1
  store i32 0, i32* %262, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %263 = getelementptr inbounds i32, i32* %260, i64 2
  store i32 0, i32* %263, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %264 = call i32 @nish_peer_credentials(i32 %file, %struct.nish_array* %arr.hdr.4)
  ret i32 %264

if.end.18:
  %265 = icmp eq i32 %k, 19
  br i1 %265, label %if.then.19, label %if.end.19

if.then.19:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 3, i64* %266, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %267 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 3, i64* %267, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %268 = bitcast [3 x i32]* %arr.data.4 to i8*
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %268, i8** %269, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %270 = bitcast i8* %268 to i32*
  %271 = getelementptr inbounds i32, i32* %270, i64 0
  store i32 0, i32* %271, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %272 = getelementptr inbounds i32, i32* %270, i64 1
  store i32 0, i32* %272, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %273 = getelementptr inbounds i32, i32* %270, i64 2
  store i32 0, i32* %273, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %274 = call i32 @nish_peer_credentials(i32 %tcp, %struct.nish_array* %arr.hdr.5)
  ret i32 %274

if.end.19:
  %275 = icmp eq i32 %k, 20
  br i1 %275, label %if.then.20, label %if.end.20

if.then.20:
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 3, i64* %276, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %277 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 3, i64* %277, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %278 = bitcast [3 x i32]* %arr.data.5 to i8*
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %278, i8** %279, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %280 = bitcast i8* %278 to i32*
  %281 = getelementptr inbounds i32, i32* %280, i64 0
  store i32 0, i32* %281, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %282 = getelementptr inbounds i32, i32* %280, i64 1
  store i32 0, i32* %282, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %283 = getelementptr inbounds i32, i32* %280, i64 2
  store i32 0, i32* %283, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %284 = call i32 @nish_peer_credentials(i32 1000, %struct.nish_array* %arr.hdr.6)
  ret i32 %284

if.end.20:
  %285 = icmp eq i32 %k, 21
  br i1 %285, label %if.then.21, label %if.end.21

if.then.21:
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 3, i64* %286, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %287 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 3, i64* %287, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %288 = bitcast [3 x i32]* %arr.data.6 to i8*
  %289 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %288, i8** %289, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %290 = bitcast i8* %288 to i32*
  %291 = getelementptr inbounds i32, i32* %290, i64 0
  store i32 0, i32* %291, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %292 = getelementptr inbounds i32, i32* %290, i64 1
  store i32 0, i32* %292, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %293 = getelementptr inbounds i32, i32* %290, i64 2
  store i32 0, i32* %293, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %294 = call i32 @nish_peer_credentials(i32 %a, %struct.nish_array* %arr.hdr.7)
  ret i32 %294

if.end.21:
  %295 = icmp eq i32 %k, 22
  br i1 %295, label %if.then.22, label %if.end.22

if.then.22:
  %296 = call i32 @widowed()
  store i32 %296, i32* %sock.addr.5, align 4
  %297 = load i32, i32* %sock.addr.5, align 4
  %298 = icmp slt i32 %297, 0
  br i1 %298, label %cond.true.5, label %cond.false.5

cond.true.5:
  %299 = load i32, i32* %sock.addr.5, align 4
  br label %cond.end.5

cond.false.5:
  %300 = load i32, i32* %sock.addr.5, align 4
  %301 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 3, i64* %301, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %302 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 3, i64* %302, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %303 = bitcast [3 x i32]* %arr.data.7 to i8*
  %304 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %303, i8** %304, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %305 = bitcast i8* %303 to i32*
  %306 = getelementptr inbounds i32, i32* %305, i64 0
  store i32 0, i32* %306, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %307 = getelementptr inbounds i32, i32* %305, i64 1
  store i32 0, i32* %307, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %308 = getelementptr inbounds i32, i32* %305, i64 2
  store i32 0, i32* %308, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %309 = call i32 @nish_peer_credentials(i32 %300, %struct.nish_array* %arr.hdr.8)
  br label %cond.end.5

cond.end.5:
  %310 = phi i32 [ %299, %cond.true.5 ], [ %309, %cond.false.5 ]
  store i32 %310, i32* %answer.addr.4, align 4
  %311 = load i32, i32* %sock.addr.5, align 4
  %312 = call i32 @nish_net_close(i32 %311)
  %313 = load i32, i32* %answer.addr.4, align 4
  ret i32 %313

if.end.22:
  %314 = icmp eq i32 %k, 23
  br i1 %314, label %if.then.23, label %if.end.23

if.then.23:
  %315 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %316 = add i64 0, 1
  %317 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %315, i64 0, i32 0
  %318 = load i64, i64* %317, align 8
  %319 = icmp ule i64 0, %316
  %320 = icmp ule i64 %316, %318
  %321 = and i1 %319, %320
  br i1 %321, label %net.ok.15, label %net.fail.15

net.fail.15:
  call void @nish_panic_slice(i64 0, i64 %316, i64 %318)
  unreachable

net.ok.15:
  %322 = call i32 @nish_send_fd(i32 %a, i32 %file, %struct.nish_array* %315, i64 0, i64 1)
  %323 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %322, i32 10)
  %324 = extractvalue { i32, i1 } %323, 0
  %325 = extractvalue { i32, i1 } %323, 1
  br i1 %325, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %326 = call i32 @drain(i32 %b)
  %327 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %324, i32 %326)
  %328 = extractvalue { i32, i1 } %327, 0
  %329 = extractvalue { i32, i1 } %327, 1
  br i1 %329, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i32 %328

if.end.23:
  %330 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %331 = add i64 0, 1
  %332 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %330, i64 0, i32 0
  %333 = load i64, i64* %332, align 8
  %334 = icmp ule i64 0, %331
  %335 = icmp ule i64 %331, %333
  %336 = and i1 %334, %335
  br i1 %336, label %net.ok.16, label %net.fail.16

net.fail.16:
  call void @nish_panic_slice(i64 0, i64 %331, i64 %333)
  unreachable

net.ok.16:
  %337 = call i32 @nish_send_fd(i32 %a, i32 %a, %struct.nish_array* %330, i64 0, i64 1)
  %338 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %337, i32 10000)
  %339 = extractvalue { i32, i1 } %338, 0
  %340 = extractvalue { i32, i1 } %338, 1
  br i1 %340, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %341 = call i32 @drain(i32 %b)
  %342 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %339, i32 %341)
  %343 = extractvalue { i32, i1 } %342, 0
  %344 = extractvalue { i32, i1 } %342, 1
  br i1 %344, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  ret i32 %343

ovf.fail:
  %ovf.op = phi i32 [ 2, %net.ok.12 ], [ 0, %bounds.ok ], [ 2, %net.ok.13 ], [ 0, %bounds.ok.1 ], [ 2, %net.ok.14 ], [ 0, %bounds.ok.2 ], [ 2, %net.ok.15 ], [ 0, %ovf.ok.6 ], [ 2, %net.ok.16 ], [ 0, %ovf.ok.8 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @carry(i32 noundef %a, i32 noundef %b, i32 noundef %fd) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %sent.addr = alloca i32, align 4
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %n.addr = alloca i32, align 4
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [4 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 7, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast [1 x i8]* %arr.data.1 to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %8 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 0
  store i8 42, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = add i64 0, 1
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ule i64 0, %12
  %16 = icmp ule i64 %12, %14
  %17 = and i1 %15, %16
  br i1 %17, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %12, i64 %14)
  unreachable

net.ok:
  %18 = call i32 @nish_send_fd(i32 %a, i32 %fd, %struct.nish_array* %arr.hdr.1, i64 0, i64 1)
  store i32 %18, i32* %sent.addr, align 4
  %19 = load i32, i32* %sent.addr, align 4
  %20 = icmp ne i32 %19, 1
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load i32, i32* %sent.addr, align 4
  %22 = icmp slt i32 %21, 0
  br i1 %22, label %cond.true, label %cond.false

cond.true:
  %23 = load i32, i32* %sent.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %24 = phi i32 [ %23, %cond.true ], [ -1000, %cond.false ]
  ret i32 %24

if.end:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 4, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 4, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast [4 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %27, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %30 = add i64 0, 4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  %32 = load i64, i64* %31, align 8
  %33 = icmp ule i64 0, %30
  %34 = icmp ule i64 %30, %32
  %35 = and i1 %33, %34
  br i1 %35, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %30, i64 %32)
  unreachable

net.ok.1:
  %36 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %arr.hdr.2, i64 0, i64 4, %struct.nish_array* %29)
  store i32 %36, i32* %n.addr, align 4
  %37 = load i32, i32* %n.addr, align 4
  %38 = icmp eq i32 %37, 1
  br i1 %38, label %cond.true.1, label %cond.false.1

cond.true.1:
  %39 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 0, %41
  br i1 %42, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %41)
  unreachable

bounds.ok:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %cond.end.1

cond.false.1:
  %48 = load i32, i32* %n.addr, align 4
  %49 = icmp slt i32 %48, 0
  br i1 %49, label %cond.true.2, label %cond.false.2

cond.true.2:
  %50 = load i32, i32* %n.addr, align 4
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %51 = phi i32 [ %50, %cond.true.2 ], [ -1000, %cond.false.2 ]
  br label %cond.end.1

cond.end.1:
  %52 = phi i32 [ %47, %bounds.ok ], [ %51, %cond.end.2 ]
  ret i32 %52
}

define noundef i32 @gather(i32 noundef %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %kept) #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = add i64 0, 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %arr.hdr, i64 0, i64 8, %struct.nish_array* %kept)
  ret i32 %10
}

define noundef i32 @peer(i32 noundef %fd, i32 noundef %k) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %answer.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 0, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i32 @nish_peer_credentials(i32 %fd, %struct.nish_array* %8)
  store i32 %9, i32* %answer.addr, align 4
  %10 = load i32, i32* %answer.addr, align 4
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %answer.addr, align 4
  br label %cond.end

cond.false:
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %14 = sext i32 %k to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %cond.end

cond.end:
  %23 = phi i32 [ %12, %cond.true ], [ %22, %bounds.ok ]
  ret i32 %23
}

define noundef i32 @connected(i32 noundef %k, i32 noundef %listener, i32 noundef %pid) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @pathOf(i32 %pid)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i32 @nish_unlink(i8* %3)
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @pathOf(i32 %pid)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  %8 = call i32 @nish_unix_listen(i8* %7, i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %8

if.end:
  %9 = icmp eq i32 %k, 1
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @pathOf(i32 %pid)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = call i32 @nish_unix_connect(i8* %12)
  br label %cond.end

cond.false:
  %14 = call i32 @nish_unix_accept(i32 %listener)
  br label %cond.end

cond.end:
  %15 = phi i32 [ %13, %cond.true ], [ %14, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %15
}

define noundef i32 @release(i32 noundef %pid) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @pathOf(i32 %pid)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i32 @nish_unlink(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
