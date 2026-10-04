%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"other\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"::1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peer \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" port \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"::\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"tcpListen \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"port \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"echoed \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"udp to \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c", ecn \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c": sent \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" bytes from \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define internal noundef nonnull align 8 i8* @hostOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #0 {
entry:
  %i.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 10
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ult i64 %7, %1
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %1)
  unreachable

bounds.ok:
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %7
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = zext i8 %11 to i32
  %13 = icmp ne i32 %12, 0
  br i1 %13, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*)

if.end:
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 10, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 10, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 10
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = zext i8 %23 to i32
  %25 = icmp eq i32 %24, 255
  br i1 %25, label %land.rhs, label %land.end

land.rhs:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 11, %27
  br i1 %28, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 11, i64 %27)
  unreachable

bounds.ok.2:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 11
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %34 = zext i8 %33 to i32
  %35 = icmp eq i32 %34, 255
  br label %land.end

land.end:
  %36 = phi i1 [ false, %bounds.ok.1 ], [ %35, %bounds.ok.2 ]
  br i1 %36, label %if.then.1, label %if.end.1

if.then.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 12, %38
  br i1 %39, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 12, i64 %38)
  unreachable

bounds.ok.3:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 12
  %44 = load i8, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %45 = zext i8 %44 to i64
  %46 = call i8* @nish_str_from_u64(i64 %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = icmp ult i64 13, %49
  br i1 %50, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 13, i64 %49)
  unreachable

bounds.ok.4:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = bitcast i8* %52 to i8*
  %54 = getelementptr inbounds i8, i8* %53, i64 13
  %55 = load i8, i8* %54, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %56 = zext i8 %55 to i64
  %57 = call i8* @nish_str_from_u64(i64 %56)
  %58 = call i8* @nish_str_concat(i8* %47, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp ult i64 14, %61
  br i1 %62, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 14, i64 %61)
  unreachable

bounds.ok.5:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = bitcast i8* %64 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 14
  %67 = load i8, i8* %66, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = zext i8 %67 to i64
  %69 = call i8* @nish_str_from_u64(i64 %68)
  %70 = call i8* @nish_str_concat(i8* %59, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 15, %73
  br i1 %74, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 15, i64 %73)
  unreachable

bounds.ok.6:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = bitcast i8* %76 to i8*
  %78 = getelementptr inbounds i8, i8* %77, i64 15
  %79 = load i8, i8* %78, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %80 = zext i8 %79 to i64
  %81 = call i8* @nish_str_from_u64(i64 %80)
  %82 = call i8* @nish_str_concat(i8* %71, i8* %81)
  ret i8* %82

if.end.1:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to i8*
  %86 = getelementptr inbounds i8, i8* %85, i64 10
  %87 = load i8, i8* %86, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %88 = zext i8 %87 to i32
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 11, %90
  br i1 %91, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 11, i64 %90)
  unreachable

bounds.ok.7:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = bitcast i8* %93 to i8*
  %95 = getelementptr inbounds i8, i8* %94, i64 11
  %96 = load i8, i8* %95, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %97 = zext i8 %96 to i32
  %98 = add nsw i32 %88, %97
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp ult i64 12, %100
  br i1 %101, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 12, i64 %100)
  unreachable

bounds.ok.8:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %104 = bitcast i8* %103 to i8*
  %105 = getelementptr inbounds i8, i8* %104, i64 12
  %106 = load i8, i8* %105, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %107 = zext i8 %106 to i32
  %108 = add nsw i32 %98, %107
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = icmp ult i64 13, %110
  br i1 %111, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 13, i64 %110)
  unreachable

bounds.ok.9:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = bitcast i8* %113 to i8*
  %115 = getelementptr inbounds i8, i8* %114, i64 13
  %116 = load i8, i8* %115, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %117 = zext i8 %116 to i32
  %118 = add nsw i32 %108, %117
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %120 = load i64, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %121 = icmp ult i64 14, %120
  br i1 %121, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 14, i64 %120)
  unreachable

bounds.ok.10:
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %124 = bitcast i8* %123 to i8*
  %125 = getelementptr inbounds i8, i8* %124, i64 14
  %126 = load i8, i8* %125, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %127 = zext i8 %126 to i32
  %128 = add nsw i32 %118, %127
  store i32 %128, i32* %rest.addr, align 4
  %129 = load i32, i32* %rest.addr, align 4
  %130 = icmp eq i32 %129, 0
  br i1 %130, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = icmp ult i64 15, %132
  br i1 %133, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 15, i64 %132)
  unreachable

bounds.ok.11:
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %135 = load i8*, i8** %134, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %136 = bitcast i8* %135 to i8*
  %137 = getelementptr inbounds i8, i8* %136, i64 15
  %138 = load i8, i8* %137, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %139 = zext i8 %138 to i32
  %140 = icmp eq i32 %139, 1
  br label %land.end.1

land.end.1:
  %141 = phi i1 [ false, %bounds.ok.10 ], [ %140, %bounds.ok.11 ]
  br i1 %141, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %142 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), %cond.false ]
  ret i8* %142
}

define internal noundef i32 @portOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 16, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 16, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %4 to i8*
  %6 = getelementptr inbounds i8, i8* %5, i64 16
  %7 = load i8, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = zext i8 %7 to i32
  %9 = mul nsw i32 %8, 256
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 17, %11
  br i1 %12, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 17, i64 %11)
  unreachable

bounds.ok.1:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 17
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = zext i8 %17 to i32
  %19 = add nsw i32 %9, %18
  ret i32 %19
}

define internal noundef i32 @echoOne(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %peer, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf) #0 {
entry:
  %conn.addr = alloca i32, align 4
  %bytes.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %sent.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_tcp_accept(i32 %fd, %struct.nish_array* %peer)
  store i32 %0, i32* %conn.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %conn.addr, align 4
  %2 = icmp eq i32 %1, -11
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = call i32 @nish_tcp_accept(i32 %fd, %struct.nish_array* %peer)
  store i32 %3, i32* %conn.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %conn.addr, align 4
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %conn.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6

if.end:
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @hostOf(%struct.nish_array* %peer)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*))
  %12 = call i32 @portOf(%struct.nish_array* %peer)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %11, i8* %13)
  call void @nish_print(i8* %14)
  store i32 0, i32* %bytes.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond.1

while.cond.1:
  br i1 true, label %while.body.1, label %while.end.1

while.body.1:
  %17 = load i32, i32* %conn.addr, align 4
  %18 = trunc i64 %16 to i32
  %19 = sext i32 %18 to i64
  %20 = add i64 0, %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %22 = load i64, i64* %21, align 8
  %23 = icmp ule i64 0, %20
  %24 = icmp ule i64 %20, %22
  %25 = and i1 %23, %24
  br i1 %25, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %20, i64 %22)
  unreachable

net.ok:
  %26 = call i32 @nish_net_read(i32 %17, %struct.nish_array* %buf, i64 0, i64 %19)
  store i32 %26, i32* %n.addr, align 4
  %27 = load i32, i32* %n.addr, align 4
  %28 = icmp eq i32 %27, 0
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end.1

if.end.1:
  %29 = load i32, i32* %n.addr, align 4
  %30 = icmp eq i32 %29, -11
  br i1 %30, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.cond.1

if.end.2:
  %31 = load i32, i32* %n.addr, align 4
  %32 = icmp slt i32 %31, 0
  br i1 %32, label %if.then.3, label %if.end.3

if.then.3:
  %33 = load i32, i32* %conn.addr, align 4
  %34 = call i32 @nish_net_close(i32 %33)
  %35 = load i32, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %35

if.end.3:
  store i32 0, i32* %sent.addr, align 4
  br label %while.cond.2

while.cond.2:
  %36 = load i32, i32* %sent.addr, align 4
  %37 = load i32, i32* %n.addr, align 4
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %while.body.2, label %while.end.2

while.body.2:
  %39 = load i32, i32* %conn.addr, align 4
  %40 = load i32, i32* %sent.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %sent.addr, align 4
  %44 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %42, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  %47 = sext i32 %45 to i64
  %48 = add i64 %41, %47
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %50 = load i64, i64* %49, align 8
  %51 = icmp ule i64 %41, %48
  %52 = icmp ule i64 %48, %50
  %53 = and i1 %51, %52
  br i1 %53, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 %41, i64 %48, i64 %50)
  unreachable

net.ok.1:
  %54 = call i32 @nish_net_write(i32 %39, %struct.nish_array* %buf, i64 %41, i64 %47)
  store i32 %54, i32* %w.addr, align 4
  %55 = load i32, i32* %w.addr, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %if.then.4, label %if.else

if.then.4:
  %57 = load i32, i32* %sent.addr, align 4
  %58 = load i32, i32* %w.addr, align 4
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %60, i32* %sent.addr, align 4
  br label %if.end.4

if.else:
  %62 = load i32, i32* %w.addr, align 4
  %63 = icmp ne i32 %62, -11
  br i1 %63, label %if.then.5, label %if.end.5

if.then.5:
  %64 = load i32, i32* %conn.addr, align 4
  %65 = call i32 @nish_net_close(i32 %64)
  %66 = load i32, i32* %w.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %66

if.end.5:
  br label %if.end.4

if.end.4:
  br label %while.cond.2

while.end.2:
  %67 = load i32, i32* %bytes.addr, align 4
  %68 = load i32, i32* %n.addr, align 4
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %67, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %70, i32* %bytes.addr, align 4
  br label %while.cond.1

while.end.1:
  %72 = load i32, i32* %conn.addr, align 4
  %73 = call i32 @nish_net_close(i32 %72)
  %74 = load i32, i32* %bytes.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %74

ovf.fail:
  %ovf.op = phi i32 [ 1, %while.body.2 ], [ 0, %if.then.4 ], [ 0, %while.end.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %fd.addr = alloca i32, align 4
  %peer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [512 x i8], align 8
  %i.addr = alloca i32, align 4
  %u.addr = alloca i32, align 4
  %to.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [18 x i8], align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [2 x i32], align 8
  %host.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x i8*], align 8
  %ecn.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [4 x i32], align 8
  %sent.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i32 0, i32 8)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.6 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %6 = load i32, i32* %fd.addr, align 4
  %7 = call i32 @nish_net_local_port(i32 %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %peer.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 512, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 512, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %16 = bitcast [512 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 512, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %buf.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp slt i32 %18, 2
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %23 = load i64, i64* %22, align 8
  %24 = load i32, i32* %fd.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %27 = call i32 @echoOne(i32 %24, %struct.nish_array* %25, %struct.nish_array* %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [7 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %30)
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %32 = load i8*, i8** %31, align 8
  %33 = icmp eq i8* %32, %21
  br i1 %33, label %pass.rewind, label %pass.free

pass.rewind:
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %23, i64* %34, align 8
  br label %pass.done

pass.free:
  %35 = ptrtoint i8* %21 to i64
  %36 = add i64 %35, %23
  call void @nish_arena_release(i64 %36)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load i32, i32* %fd.addr, align 4
  %40 = call i32 @nish_net_close(i32 %39)
  %41 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i32 0, i32 0)
  store i32 %41, i32* %u.addr, align 4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 18, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 18, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %44 = bitcast [18 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %44, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %44, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %to.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %48 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %48, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %from.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %52 = bitcast [2 x i32]* %arr.data.4 to i8*
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %52, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = bitcast i8* %52 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 0
  store i32 0, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %56 = getelementptr inbounds i32, i32* %54, i64 1
  store i32 0, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %meta.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 2, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 2, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %59 = bitcast [2 x i8*]* %arr.data.5 to i8*
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %61 = bitcast i8* %59 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 0
  store i8* bitcast ({ i64, [10 x i8] }* @.str.10 to i8*), i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %63 = getelementptr inbounds i8*, i8** %61, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %63, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = icmp ult i64 %64, %66
  br i1 %67, label %forof.body, label %forof.end

forof.body:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = bitcast i8* %69 to i8**
  %71 = getelementptr inbounds i8*, i8** %70, i64 %64
  %72 = load i8*, i8** %71, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store i8* %72, i8** %host.addr, align 8
  %73 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %74 = load i8*, i8** %73, align 8
  %75 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %76 = load i64, i64* %75, align 8
  %77 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %78 = load i8*, i8** %host.addr, align 8
  %79 = load i32, i32* %u.addr, align 4
  %80 = call i32 @nish_net_local_port(i32 %79)
  %81 = call i32 @nish_net_address(%struct.nish_array* %77, i8* %78, i32 %80)
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 4, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 4, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %84 = bitcast [4 x i32]* %arr.data.6 to i8*
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %84, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %86 = bitcast i8* %84 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 0
  store i32 1, i32* %87, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %88 = getelementptr inbounds i32, i32* %86, i64 1
  store i32 2, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %89 = getelementptr inbounds i32, i32* %86, i64 2
  store i32 3, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %90 = getelementptr inbounds i32, i32* %86, i64 3
  store i32 0, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %91 = load i64, i64* %forof.idx.1, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = icmp ult i64 %91, %93
  br i1 %94, label %forof.body.1, label %forof.end.1

forof.body.1:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = bitcast i8* %96 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 %91
  %99 = load i32, i32* %98, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %99, i32* %ecn.addr, align 4
  %100 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %101 = load i8*, i8** %100, align 8
  %102 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %103 = load i64, i64* %102, align 8
  %104 = load i32, i32* %u.addr, align 4
  %105 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %106 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %107 = load i32, i32* %ecn.addr, align 4
  %108 = add i64 0, 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %110 = load i64, i64* %109, align 8
  %111 = icmp ule i64 0, %108
  %112 = icmp ule i64 %108, %110
  %113 = and i1 %111, %112
  br i1 %113, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %108, i64 %110)
  unreachable

net.ok:
  %114 = call i32 @nish_udp_send_to(i32 %104, %struct.nish_array* %105, i64 0, i64 8, %struct.nish_array* %106, i32 0, i32 %107)
  store i32 %114, i32* %sent.addr, align 4
  %115 = load i32, i32* %sent.addr, align 4
  %116 = icmp ne i32 %115, 8
  br i1 %116, label %if.then.1, label %if.end.1

if.then.1:
  %117 = load i8*, i8** %host.addr, align 8
  %118 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %120 = load i32, i32* %ecn.addr, align 4
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %119, i8* %121)
  %123 = call i8* @nish_str_concat(i8* %122, i8* bitcast ({ i64, [8 x i8] }* @.str.13 to i8*))
  %124 = load i32, i32* %sent.addr, align 4
  %125 = call i8* @nish_str_from_i32(i32 %124)
  %126 = call i8* @nish_str_concat(i8* %123, i8* %125)
  call void @nish_print(i8* %126)
  %127 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %128 = load i8*, i8** %127, align 8
  %129 = icmp eq i8* %128, %101
  br i1 %129, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %130 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %103, i64* %130, align 8
  br label %pass.done.1

pass.free.1:
  %131 = ptrtoint i8* %101 to i64
  %132 = add i64 %131, %103
  call void @nish_arena_release(i64 %132)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

if.end.1:
  %133 = load i32, i32* %u.addr, align 4
  %134 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = trunc i64 %137 to i32
  %139 = sext i32 %138 to i64
  %140 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %142 = add i64 0, %139
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 0
  %144 = load i64, i64* %143, align 8
  %145 = icmp ule i64 0, %142
  %146 = icmp ule i64 %142, %144
  %147 = and i1 %145, %146
  br i1 %147, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %142, i64 %144)
  unreachable

net.ok.1:
  %148 = call i32 @nish_udp_recv_from(i32 %133, %struct.nish_array* %134, i64 0, i64 %139, %struct.nish_array* %140, %struct.nish_array* %141)
  store i32 %148, i32* %n.addr, align 4
  %149 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  %151 = load i64, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %152 = load i32, i32* %n.addr, align 4
  %153 = icmp eq i32 %152, -11
  br i1 %153, label %while.body, label %while.end

while.body:
  %154 = load i32, i32* %u.addr, align 4
  %155 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %156 = trunc i64 %151 to i32
  %157 = sext i32 %156 to i64
  %158 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %160 = add i64 0, %157
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %162 = load i64, i64* %161, align 8
  %163 = icmp ule i64 0, %160
  %164 = icmp ule i64 %160, %162
  %165 = and i1 %163, %164
  br i1 %165, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %160, i64 %162)
  unreachable

net.ok.2:
  %166 = call i32 @nish_udp_recv_from(i32 %154, %struct.nish_array* %155, i64 0, i64 %157, %struct.nish_array* %158, %struct.nish_array* %159)
  store i32 %166, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %167 = load i8*, i8** %host.addr, align 8
  %168 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %167)
  %169 = call i8* @nish_str_concat(i8* %168, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %170 = load i32, i32* %ecn.addr, align 4
  %171 = call i8* @nish_str_from_i32(i32 %170)
  %172 = call i8* @nish_str_concat(i8* %169, i8* %171)
  %173 = call i8* @nish_str_concat(i8* %172, i8* bitcast ({ i64, [3 x i8] }* @.str.14 to i8*))
  %174 = load i32, i32* %n.addr, align 4
  %175 = call i8* @nish_str_from_i32(i32 %174)
  %176 = call i8* @nish_str_concat(i8* %173, i8* %175)
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [13 x i8] }* @.str.15 to i8*))
  %178 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %179 = call i64 @nish_arena_mark()
  %180 = call i8* @hostOf(%struct.nish_array* %178)
  %181 = call i8* @nish_arena_keep(i64 %179, i8* %180)
  %182 = call i8* @nish_str_concat(i8* %177, i8* %181)
  %183 = call i8* @nish_str_concat(i8* %182, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %184 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 0
  %186 = load i64, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = icmp ult i64 1, %186
  br i1 %187, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %186)
  unreachable

bounds.ok:
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 2
  %189 = load i8*, i8** %188, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %190 = bitcast i8* %189 to i32*
  %191 = getelementptr inbounds i32, i32* %190, i64 1
  %192 = load i32, i32* %191, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %193 = call i8* @nish_str_from_i32(i32 %192)
  %194 = call i8* @nish_str_concat(i8* %183, i8* %193)
  call void @nish_print(i8* %194)
  %195 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %196 = load i8*, i8** %195, align 8
  %197 = icmp eq i8* %196, %101
  br i1 %197, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %198 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %103, i64* %198, align 8
  br label %pass.done.2

pass.free.2:
  %199 = ptrtoint i8* %101 to i64
  %200 = add i64 %199, %103
  call void @nish_arena_release(i64 %200)
  br label %pass.done.2

pass.done.2:
  br label %forof.inc.1

forof.inc.1:
  %201 = load i64, i64* %forof.idx.1, align 8
  %202 = add i64 %201, 1
  store i64 %202, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %203 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %204 = load i8*, i8** %203, align 8
  %205 = icmp eq i8* %204, %74
  br i1 %205, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %206 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %76, i64* %206, align 8
  br label %pass.done.3

pass.free.3:
  %207 = ptrtoint i8* %74 to i64
  %208 = add i64 %207, %76
  call void @nish_arena_release(i64 %208)
  br label %pass.done.3

pass.done.3:
  br label %forof.inc

forof.inc:
  %209 = load i64, i64* %forof.idx, align 8
  %210 = add i64 %209, 1
  store i64 %210, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %211 = load i32, i32* %u.addr, align 4
  %212 = call i32 @nish_net_close(i32 %211)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %212
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
