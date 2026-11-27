%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish_net_local_port(i32 noundef) #0
declare noundef i32 @nish_tcp_listen_flags(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #2
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #2
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #2
declare noundef i32 @nish_poll_create() #0
declare noundef i32 @nish_net_ring_state() #0
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_send_fd(i32 noundef, i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #2

define noundef i32 @state() #0 {
entry:
  %0 = call i32 @nish_net_ring_state()
  ret i32 %0
}

define noundef i32 @ringBit() #1 {
entry:
  ret i32 8
}

define noundef i32 @wideBit() #1 {
entry:
  ret i32 16
}

define noundef i32 @listenWith(i32 noundef %flags) #2 {
entry:
  %fd.addr = alloca i32, align 4
  %0 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 %flags)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  ret i32 %3

if.end:
  %4 = load i32, i32* %fd.addr, align 4
  %5 = call i32 @nish_net_close(i32 %4)
  ret i32 0
}

define noundef i32 @emptyAccept() #2 {
entry:
  %fd.addr = alloca i32, align 4
  %peer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %got.addr = alloca i32, align 4
  %0 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 8)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %peer.addr, align 8
  %8 = load i32, i32* %fd.addr, align 4
  %9 = call i32 @nish_net_local_port(i32 %8)
  %10 = icmp sgt i32 %9, 0
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %fd.addr, align 4
  %12 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %13 = call i32 @nish_tcp_accept(i32 %11, %struct.nish_array* %12)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %14 = phi i32 [ %13, %cond.true ], [ -1, %cond.false ]
  store i32 %14, i32* %got.addr, align 4
  %15 = load i32, i32* %fd.addr, align 4
  %16 = call i32 @nish_net_close(i32 %15)
  %17 = load i32, i32* %got.addr, align 4
  ret i32 %17
}

define noundef i32 @readOf(i32 noundef %h) #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = call i32 @nish_net_read(i32 %h, %struct.nish_array* %4, i64 0, i64 8)
  ret i32 %5
}

define noundef i32 @writeOf(i32 noundef %h) #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %7 = call i32 @nish_net_write(i32 %h, %struct.nish_array* %6, i64 0, i64 1)
  ret i32 %7
}

define noundef i32 @closeOf(i32 noundef %h) #2 {
entry:
  %0 = call i32 @nish_net_close(i32 %h)
  ret i32 %0
}

define noundef i32 @pollOf(i32 noundef %h) #2 {
entry:
  %loop.addr = alloca i32, align 4
  %got.addr = alloca i32, align 4
  %0 = call i32 @nish_poll_create()
  store i32 %0, i32* %loop.addr, align 4
  %1 = load i32, i32* %loop.addr, align 4
  %2 = call i32 @nish_poll_add(i32 %1, i32 %h, i32 1, i32 0)
  store i32 %2, i32* %got.addr, align 4
  %3 = load i32, i32* %loop.addr, align 4
  %4 = call i32 @nish_net_close(i32 %3)
  %5 = load i32, i32* %got.addr, align 4
  ret i32 %5
}

define noundef i32 @sendOf(i32 noundef %h) #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %7 = call i32 @nish_send_fd(i32 %h, i32 0, %struct.nish_array* %6, i64 0, i64 1)
  ret i32 %7
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
