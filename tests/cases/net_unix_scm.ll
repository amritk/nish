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
  %12 = call i32 @nish_recv_fd(i32 %sock, %struct.nish_array* %10, i64 0, i64 8, %struct.nish_array* %11)
  store i32 %12, i32* %n.addr, align 4
  %13 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 0, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = icmp sge i32 %21, 0
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = call i32 @nish_net_close(i32 %28)
  %30 = load i32, i32* %n.addr, align 4
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 1000)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %32

if.end:
  %34 = load i32, i32* %n.addr, align 4
  ret i32 %34

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
  %12 = call i32 @nish_send_fd(i32 %a, i32 %file, %struct.nish_array* %11, i64 0, i64 0)
  ret i32 %12

if.end:
  %13 = icmp eq i32 %k, 1
  br i1 %13, label %if.then.1, label %if.end.1

if.then.1:
  %14 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %15 = call i32 @nish_send_fd(i32 %a, i32 -1, %struct.nish_array* %14, i64 0, i64 1)
  ret i32 %15

if.end.1:
  %16 = icmp eq i32 %k, 2
  br i1 %16, label %if.then.2, label %if.end.2

if.then.2:
  %17 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %18 = call i32 @nish_send_fd(i32 %file, i32 %file, %struct.nish_array* %17, i64 0, i64 1)
  ret i32 %18

if.end.2:
  %19 = icmp eq i32 %k, 3
  br i1 %19, label %if.then.3, label %if.end.3

if.then.3:
  %20 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %21 = call i32 @nish_send_fd(i32 %tcp, i32 %file, %struct.nish_array* %20, i64 0, i64 1)
  ret i32 %21

if.end.3:
  %22 = icmp eq i32 %k, 4
  br i1 %22, label %if.then.4, label %if.end.4

if.then.4:
  %23 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %24 = call i32 @nish_send_fd(i32 1000, i32 %file, %struct.nish_array* %23, i64 0, i64 1)
  ret i32 %24

if.end.4:
  %25 = icmp eq i32 %k, 5
  br i1 %25, label %if.then.5, label %if.end.5

if.then.5:
  %26 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %27 = call i32 @nish_send_fd(i32 %a, i32 1000, %struct.nish_array* %26, i64 0, i64 1)
  ret i32 %27

if.end.5:
  %28 = icmp eq i32 %k, 6
  br i1 %28, label %if.then.6, label %if.end.6

if.then.6:
  %29 = call i32 @widowed()
  store i32 %29, i32* %sock.addr, align 4
  %30 = load i32, i32* %sock.addr, align 4
  %31 = icmp slt i32 %30, 0
  br i1 %31, label %cond.true, label %cond.false

cond.true:
  %32 = load i32, i32* %sock.addr, align 4
  br label %cond.end

cond.false:
  %33 = load i32, i32* %sock.addr, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %35 = add i64 0, 1
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8
  %38 = icmp ule i64 0, %35
  %39 = icmp ule i64 %35, %37
  %40 = and i1 %38, %39
  br i1 %40, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %35, i64 %37)
  unreachable

net.ok:
  %41 = call i32 @nish_send_fd(i32 %33, i32 %file, %struct.nish_array* %34, i64 0, i64 1)
  br label %cond.end

cond.end:
  %42 = phi i32 [ %32, %cond.true ], [ %41, %net.ok ]
  store i32 %42, i32* %answer.addr, align 4
  %43 = load i32, i32* %sock.addr, align 4
  %44 = call i32 @nish_net_close(i32 %43)
  %45 = load i32, i32* %answer.addr, align 4
  ret i32 %45

if.end.6:
  %46 = icmp eq i32 %k, 7
  br i1 %46, label %if.then.7, label %if.end.7

if.then.7:
  %47 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %49 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %47, i64 0, i64 0, %struct.nish_array* %48)
  ret i32 %49

if.end.7:
  %50 = icmp eq i32 %k, 8
  br i1 %50, label %if.then.8, label %if.end.8

if.then.8:
  %51 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %51, i64 0, i64 8, %struct.nish_array* %arr.hdr.2)
  ret i32 %55

if.end.8:
  %56 = icmp eq i32 %k, 9
  br i1 %56, label %if.then.9, label %if.end.9

if.then.9:
  %57 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %59 = call i32 @nish_recv_fd(i32 %file, %struct.nish_array* %57, i64 0, i64 8, %struct.nish_array* %58)
  ret i32 %59

if.end.9:
  %60 = icmp eq i32 %k, 10
  br i1 %60, label %if.then.10, label %if.end.10

if.then.10:
  %61 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %63 = call i32 @nish_recv_fd(i32 %tcp, %struct.nish_array* %61, i64 0, i64 8, %struct.nish_array* %62)
  ret i32 %63

if.end.10:
  %64 = icmp eq i32 %k, 11
  br i1 %64, label %if.then.11, label %if.end.11

if.then.11:
  %65 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %67 = call i32 @nish_recv_fd(i32 1000, %struct.nish_array* %65, i64 0, i64 8, %struct.nish_array* %66)
  ret i32 %67

if.end.11:
  %68 = icmp eq i32 %k, 12
  br i1 %68, label %if.then.12, label %if.end.12

if.then.12:
  %69 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %71 = call i32 @nish_recv_fd(i32 %b, %struct.nish_array* %69, i64 0, i64 8, %struct.nish_array* %70)
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 10)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok

ovf.ok:
  %75 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = icmp ult i64 0, %77
  br i1 %78, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %77)
  unreachable

bounds.ok:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i32*
  %82 = getelementptr inbounds i32, i32* %81, i64 0
  %83 = load i32, i32* %82, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %84 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %73, i32 %83)
  %85 = extractvalue { i32, i1 } %84, 0
  %86 = extractvalue { i32, i1 } %84, 1
  br i1 %86, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %85

if.end.12:
  %87 = icmp eq i32 %k, 13
  br i1 %87, label %if.then.13, label %if.end.13

if.then.13:
  %88 = call i32 @widowed()
  store i32 %88, i32* %sock.addr.1, align 4
  %89 = load i32, i32* %sock.addr.1, align 4
  %90 = icmp slt i32 %89, 0
  br i1 %90, label %cond.true.1, label %cond.false.1

cond.true.1:
  %91 = load i32, i32* %sock.addr.1, align 4
  br label %cond.end.1

cond.false.1:
  %92 = load i32, i32* %sock.addr.1, align 4
  %93 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %94 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %95 = add i64 0, 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %97 = load i64, i64* %96, align 8
  %98 = icmp ule i64 0, %95
  %99 = icmp ule i64 %95, %97
  %100 = and i1 %98, %99
  br i1 %100, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %95, i64 %97)
  unreachable

net.ok.1:
  %101 = call i32 @nish_recv_fd(i32 %92, %struct.nish_array* %93, i64 0, i64 8, %struct.nish_array* %94)
  %102 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %101, i32 10)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %105 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ult i64 0, %107
  br i1 %108, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %107)
  unreachable

bounds.ok.1:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 0
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %114 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 %113)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.1

cond.end.1:
  %117 = phi i32 [ %91, %cond.true.1 ], [ %115, %ovf.ok.3 ]
  store i32 %117, i32* %answer.addr.1, align 4
  %118 = load i32, i32* %sock.addr.1, align 4
  %119 = call i32 @nish_net_close(i32 %118)
  %120 = load i32, i32* %answer.addr.1, align 4
  ret i32 %120

if.end.13:
  %121 = icmp eq i32 %k, 14
  br i1 %121, label %if.then.14, label %if.end.14

if.then.14:
  %122 = call i32 @sentOver(i32 0)
  store i32 %122, i32* %sock.addr.2, align 4
  %123 = load i32, i32* %sock.addr.2, align 4
  %124 = icmp slt i32 %123, 0
  br i1 %124, label %cond.true.2, label %cond.false.2

cond.true.2:
  %125 = load i32, i32* %sock.addr.2, align 4
  br label %cond.end.2

cond.false.2:
  %126 = load i32, i32* %sock.addr.2, align 4
  %127 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %128 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %129 = add i64 0, 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %131 = load i64, i64* %130, align 8
  %132 = icmp ule i64 0, %129
  %133 = icmp ule i64 %129, %131
  %134 = and i1 %132, %133
  br i1 %134, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %129, i64 %131)
  unreachable

net.ok.2:
  %135 = call i32 @nish_recv_fd(i32 %126, %struct.nish_array* %127, i64 0, i64 8, %struct.nish_array* %128)
  %136 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %135, i32 10)
  %137 = extractvalue { i32, i1 } %136, 0
  %138 = extractvalue { i32, i1 } %136, 1
  br i1 %138, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %139 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = icmp ult i64 0, %141
  br i1 %142, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %141)
  unreachable

bounds.ok.2:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = bitcast i8* %144 to i32*
  %146 = getelementptr inbounds i32, i32* %145, i64 0
  %147 = load i32, i32* %146, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %148 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %137, i32 %147)
  %149 = extractvalue { i32, i1 } %148, 0
  %150 = extractvalue { i32, i1 } %148, 1
  br i1 %150, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  br label %cond.end.2

cond.end.2:
  %151 = phi i32 [ %125, %cond.true.2 ], [ %149, %ovf.ok.5 ]
  store i32 %151, i32* %answer.addr.2, align 4
  %152 = load i32, i32* %sock.addr.2, align 4
  %153 = call i32 @nish_net_close(i32 %152)
  %154 = load i32, i32* %answer.addr.2, align 4
  ret i32 %154

if.end.14:
  %155 = icmp eq i32 %k, 15
  br i1 %155, label %if.then.15, label %if.end.15

if.then.15:
  %156 = call i32 @sentOver(i32 %file)
  store i32 %156, i32* %sock.addr.3, align 4
  %157 = load i32, i32* %sock.addr.3, align 4
  %158 = icmp slt i32 %157, 0
  br i1 %158, label %cond.true.3, label %cond.false.3

cond.true.3:
  %159 = load i32, i32* %sock.addr.3, align 4
  br label %cond.end.3

cond.false.3:
  %160 = load i32, i32* %sock.addr.3, align 4
  %161 = call i32 @drain(i32 %160)
  br label %cond.end.3

cond.end.3:
  %162 = phi i32 [ %159, %cond.true.3 ], [ %161, %cond.false.3 ]
  store i32 %162, i32* %answer.addr.3, align 4
  %163 = load i32, i32* %sock.addr.3, align 4
  %164 = call i32 @nish_net_close(i32 %163)
  %165 = load i32, i32* %answer.addr.3, align 4
  ret i32 %165

if.end.15:
  %166 = icmp eq i32 %k, 16
  br i1 %166, label %if.then.16, label %if.end.16

if.then.16:
  %167 = call i32 @sentOver(i32 %file)
  store i32 %167, i32* %sock.addr.4, align 4
  %168 = load i32, i32* %sock.addr.4, align 4
  %169 = call i32 @nish_net_close(i32 %168)
  %170 = load i32, i32* %sock.addr.4, align 4
  %171 = icmp slt i32 %170, 0
  br i1 %171, label %cond.true.4, label %cond.false.4

cond.true.4:
  %172 = load i32, i32* %sock.addr.4, align 4
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %173 = phi i32 [ %172, %cond.true.4 ], [ 0, %cond.false.4 ]
  ret i32 %173

if.end.16:
  %174 = icmp eq i32 %k, 17
  br i1 %174, label %if.then.17, label %if.end.17

if.then.17:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %177 = bitcast [2 x i32]* %arr.data.2 to i8*
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %177, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %179 = bitcast i8* %177 to i32*
  %180 = getelementptr inbounds i32, i32* %179, i64 0
  store i32 0, i32* %180, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %181 = getelementptr inbounds i32, i32* %179, i64 1
  store i32 0, i32* %181, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %182 = call i32 @nish_peer_credentials(i32 %a, %struct.nish_array* %arr.hdr.3)
  ret i32 %182

if.end.17:
  %183 = icmp eq i32 %k, 18
  br i1 %183, label %if.then.18, label %if.end.18

if.then.18:
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %186 = bitcast [3 x i32]* %arr.data.3 to i8*
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %186, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %188 = bitcast i8* %186 to i32*
  %189 = getelementptr inbounds i32, i32* %188, i64 0
  store i32 0, i32* %189, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %190 = getelementptr inbounds i32, i32* %188, i64 1
  store i32 0, i32* %190, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %191 = getelementptr inbounds i32, i32* %188, i64 2
  store i32 0, i32* %191, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %192 = call i32 @nish_peer_credentials(i32 %file, %struct.nish_array* %arr.hdr.4)
  ret i32 %192

if.end.18:
  %193 = icmp eq i32 %k, 19
  br i1 %193, label %if.then.19, label %if.end.19

if.then.19:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 3, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 3, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %196 = bitcast [3 x i32]* %arr.data.4 to i8*
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %196, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %198 = bitcast i8* %196 to i32*
  %199 = getelementptr inbounds i32, i32* %198, i64 0
  store i32 0, i32* %199, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %200 = getelementptr inbounds i32, i32* %198, i64 1
  store i32 0, i32* %200, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %201 = getelementptr inbounds i32, i32* %198, i64 2
  store i32 0, i32* %201, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %202 = call i32 @nish_peer_credentials(i32 %tcp, %struct.nish_array* %arr.hdr.5)
  ret i32 %202

if.end.19:
  %203 = icmp eq i32 %k, 20
  br i1 %203, label %if.then.20, label %if.end.20

if.then.20:
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 3, i64* %204, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 3, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %206 = bitcast [3 x i32]* %arr.data.5 to i8*
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %206, i8** %207, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %208 = bitcast i8* %206 to i32*
  %209 = getelementptr inbounds i32, i32* %208, i64 0
  store i32 0, i32* %209, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %210 = getelementptr inbounds i32, i32* %208, i64 1
  store i32 0, i32* %210, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %211 = getelementptr inbounds i32, i32* %208, i64 2
  store i32 0, i32* %211, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %212 = call i32 @nish_peer_credentials(i32 1000, %struct.nish_array* %arr.hdr.6)
  ret i32 %212

if.end.20:
  %213 = icmp eq i32 %k, 21
  br i1 %213, label %if.then.21, label %if.end.21

if.then.21:
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 3, i64* %214, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 3, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %216 = bitcast [3 x i32]* %arr.data.6 to i8*
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %216, i8** %217, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %218 = bitcast i8* %216 to i32*
  %219 = getelementptr inbounds i32, i32* %218, i64 0
  store i32 0, i32* %219, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %220 = getelementptr inbounds i32, i32* %218, i64 1
  store i32 0, i32* %220, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %221 = getelementptr inbounds i32, i32* %218, i64 2
  store i32 0, i32* %221, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %222 = call i32 @nish_peer_credentials(i32 %a, %struct.nish_array* %arr.hdr.7)
  ret i32 %222

if.end.21:
  %223 = icmp eq i32 %k, 22
  br i1 %223, label %if.then.22, label %if.end.22

if.then.22:
  %224 = call i32 @widowed()
  store i32 %224, i32* %sock.addr.5, align 4
  %225 = load i32, i32* %sock.addr.5, align 4
  %226 = icmp slt i32 %225, 0
  br i1 %226, label %cond.true.5, label %cond.false.5

cond.true.5:
  %227 = load i32, i32* %sock.addr.5, align 4
  br label %cond.end.5

cond.false.5:
  %228 = load i32, i32* %sock.addr.5, align 4
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 3, i64* %229, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 3, i64* %230, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %231 = bitcast [3 x i32]* %arr.data.7 to i8*
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %231, i8** %232, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %233 = bitcast i8* %231 to i32*
  %234 = getelementptr inbounds i32, i32* %233, i64 0
  store i32 0, i32* %234, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %235 = getelementptr inbounds i32, i32* %233, i64 1
  store i32 0, i32* %235, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %236 = getelementptr inbounds i32, i32* %233, i64 2
  store i32 0, i32* %236, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %237 = call i32 @nish_peer_credentials(i32 %228, %struct.nish_array* %arr.hdr.8)
  br label %cond.end.5

cond.end.5:
  %238 = phi i32 [ %227, %cond.true.5 ], [ %237, %cond.false.5 ]
  store i32 %238, i32* %answer.addr.4, align 4
  %239 = load i32, i32* %sock.addr.5, align 4
  %240 = call i32 @nish_net_close(i32 %239)
  %241 = load i32, i32* %answer.addr.4, align 4
  ret i32 %241

if.end.22:
  %242 = icmp eq i32 %k, 23
  br i1 %242, label %if.then.23, label %if.end.23

if.then.23:
  %243 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %244 = call i32 @nish_send_fd(i32 %a, i32 %file, %struct.nish_array* %243, i64 0, i64 1)
  %245 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %244, i32 10)
  %246 = extractvalue { i32, i1 } %245, 0
  %247 = extractvalue { i32, i1 } %245, 1
  br i1 %247, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %248 = call i32 @drain(i32 %b)
  %249 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %246, i32 %248)
  %250 = extractvalue { i32, i1 } %249, 0
  %251 = extractvalue { i32, i1 } %249, 1
  br i1 %251, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i32 %250

if.end.23:
  %252 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %253 = call i32 @nish_send_fd(i32 %a, i32 %a, %struct.nish_array* %252, i64 0, i64 1)
  %254 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %253, i32 10000)
  %255 = extractvalue { i32, i1 } %254, 0
  %256 = extractvalue { i32, i1 } %254, 1
  br i1 %256, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %257 = call i32 @drain(i32 %b)
  %258 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %255, i32 %257)
  %259 = extractvalue { i32, i1 } %258, 0
  %260 = extractvalue { i32, i1 } %258, 1
  br i1 %260, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  ret i32 %259

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then.12 ], [ 0, %bounds.ok ], [ 2, %net.ok.1 ], [ 0, %bounds.ok.1 ], [ 2, %net.ok.2 ], [ 0, %bounds.ok.2 ], [ 2, %if.then.23 ], [ 0, %ovf.ok.6 ], [ 2, %if.end.23 ], [ 0, %ovf.ok.8 ]
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
