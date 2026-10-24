%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_tcp_listen_flags(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_tcp_connect(%struct.nish_array* noundef nonnull align 8 nocapture readonly) #1
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0

define noundef i32 @accepted(i32 noundef %flags) #0 {
entry:
  %listener.addr = alloca i32, align 4
  %addr.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %client.addr = alloca i32, align 4
  %loop.addr = alloca i32, align 4
  %ready.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %peer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [18 x i8], align 8
  %conn.addr = alloca i32, align 4
  %0 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 %flags)
  store i32 %0, i32* %listener.addr, align 4
  %1 = load i32, i32* %listener.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %listener.addr, align 4
  ret i32 %3

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %addr.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %9 = load i32, i32* %listener.addr, align 4
  %10 = call i32 @nish_net_local_port(i32 %9)
  %11 = call i32 @nish_net_address(%struct.nish_array* %8, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %10)
  %12 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %13 = call i32 @nish_tcp_connect(%struct.nish_array* %12)
  store i32 %13, i32* %client.addr, align 4
  %14 = call i32 @nish_poll_create()
  store i32 %14, i32* %loop.addr, align 4
  %15 = load i32, i32* %loop.addr, align 4
  %16 = load i32, i32* %listener.addr, align 4
  %17 = call i32 @nish_poll_add(i32 %15, i32 %16, i32 1, i32 0)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = mul i64 2, 4
  %21 = bitcast [2 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ready.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 18, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 18, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast [18 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %25, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %peer.addr, align 8
  %27 = load i32, i32* %loop.addr, align 4
  %28 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %29 = call i32 @nish_poll_wait(i32 %27, %struct.nish_array* %28, i32 2000)
  %30 = icmp eq i32 %29, 1
  br i1 %30, label %cond.true, label %cond.false

cond.true:
  %31 = load i32, i32* %listener.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %33 = call i32 @nish_tcp_accept(i32 %31, %struct.nish_array* %32)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %34 = phi i32 [ %33, %cond.true ], [ -110, %cond.false ]
  store i32 %34, i32* %conn.addr, align 4
  %35 = load i32, i32* %loop.addr, align 4
  %36 = call i32 @nish_net_close(i32 %35)
  %37 = load i32, i32* %client.addr, align 4
  %38 = call i32 @nish_net_close(i32 %37)
  %39 = load i32, i32* %listener.addr, align 4
  %40 = call i32 @nish_net_close(i32 %39)
  %41 = load i32, i32* %conn.addr, align 4
  ret i32 %41
}

define noundef i32 @opened(i32 noundef %flags) #0 {
entry:
  %fd.addr = alloca i32, align 4
  %0 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 %flags)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i32 @nish_net_close(i32 %3)
  ret i32 0

if.end:
  %5 = load i32, i32* %fd.addr, align 4
  ret i32 %5
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!13, !14, !15, !16, !17}
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
!13 = !{i32 8, !"cf-protection-branch", i32 1}
!14 = !{i32 8, !"cf-protection-return", i32 1}
!15 = !{i32 8, !"branch-target-enforcement", i32 1}
!16 = !{i32 8, !"sign-return-address", i32 1}
!17 = !{i32 4, !"probe-stack", !"inline-asm"}
