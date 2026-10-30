%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-live.sock\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-dead.sock\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-file.sock\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"keep\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/test/nuf-missing.sock\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"@nish-net-unix-fds\00\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-mode.sock\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/nuf-nowhere/x.sock\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_unix_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_listen_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_connect(i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef i32 @nish_unix_socket_pair(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #1

define noundef i32 @setUp() #0 {
entry:
  %live.addr = alloca i32, align 4
  %dead.addr = alloca i32, align 4
  %0 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*))
  %1 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*))
  call void @nish_write_file(i8* bitcast ({ i64, [25 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %2 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*), i32 4, i32 0)
  store i32 %2, i32* %live.addr, align 4
  %3 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*), i32 4, i32 0)
  store i32 %3, i32* %dead.addr, align 4
  %4 = load i32, i32* %dead.addr, align 4
  %5 = call i32 @nish_net_close(i32 %4)
  %6 = load i32, i32* %dead.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  %8 = load i32, i32* %live.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i32 [ %8, %cond.true ], [ -1, %cond.false ]
  ret i32 %9
}

define noundef i32 @attempt(i32 noundef %k) #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*), i32 4, i32 0)
  ret i32 %1

if.end:
  %2 = icmp eq i32 %k, 1
  br i1 %2, label %if.then.1, label %if.end.1

if.then.1:
  %3 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*), i32 4, i32 1)
  ret i32 %3

if.end.1:
  %4 = icmp eq i32 %k, 2
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  %5 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*), i32 4, i32 0)
  ret i32 %5

if.end.2:
  %6 = icmp eq i32 %k, 3
  br i1 %6, label %if.then.3, label %if.end.3

if.then.3:
  %7 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.2 to i8*), i32 4, i32 1)
  ret i32 %7

if.end.3:
  %8 = icmp eq i32 %k, 4
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  %9 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*))
  ret i32 %9

if.end.4:
  %10 = icmp eq i32 %k, 5
  br i1 %10, label %if.then.5, label %if.end.5

if.then.5:
  %11 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*))
  ret i32 %11

if.end.5:
  %12 = icmp eq i32 %k, 6
  br i1 %12, label %if.then.6, label %if.end.6

if.then.6:
  %13 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [20 x i8] }* @.str.5 to i8*), i32 4, i32 0)
  ret i32 %13

if.end.6:
  %14 = icmp eq i32 %k, 7
  br i1 %14, label %if.then.7, label %if.end.7

if.then.7:
  %15 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [25 x i8] }* @.str.6 to i8*), i32 4, i32 0, i32 512)
  ret i32 %15

if.end.7:
  %16 = icmp eq i32 %k, 8
  br i1 %16, label %if.then.8, label %if.end.8

if.then.8:
  %17 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [30 x i8] }* @.str.7 to i8*), i32 4, i32 0)
  ret i32 %17

if.end.8:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = mul i64 2, 4
  %21 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = call i32 @nish_unix_socket_pair(i32 3, %struct.nish_array* %arr.hdr)
  ret i32 %23
}

define noundef i32 @tearDown(i32 noundef %live) #0 {
entry:
  %0 = call i32 @nish_net_close(i32 %live)
  %1 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*))
  %2 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*))
  %3 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.2 to i8*))
  ret i32 %3
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
