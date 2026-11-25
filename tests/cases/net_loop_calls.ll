%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare i64 @nish_monotonic_nanos() #1
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_net_shutdown(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_tcp_connect(%struct.nish_array* noundef nonnull align 8 nocapture readonly) #1
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_modify(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_remove(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3

define noundef i32 @nish_main() #0 {
entry:
  %loop.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %ready.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [1 x i32], align 8
  %started.addr = alloca i64, align 8
  %waited.addr = alloca i64, align 8
  %toA.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [18 x i8], align 8
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [3 x i8], align 8
  %listener.addr = alloca i32, align 4
  %toL.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [18 x i8], align 8
  %c.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_poll_create()
  store i32 %0, i32* %loop.addr, align 4
  %1 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %1, i32* %a.addr, align 4
  %2 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %2, i32* %b.addr, align 4
  %3 = load i32, i32* %loop.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %5 = load i32, i32* %a.addr, align 4
  %6 = icmp sge i32 %5, 0
  br label %land.end.1

land.end.1:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs.1 ]
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %b.addr, align 4
  %9 = icmp sge i32 %8, 0
  br label %land.end

land.end:
  %10 = phi i1 [ false, %land.end.1 ], [ %9, %land.rhs ]
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast [6 x i32]* %arr.data to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 0, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 0, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i32, i32* %16, i64 3
  store i32 0, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i32, i32* %16, i64 4
  store i32 0, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i32, i32* %16, i64 5
  store i32 0, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ready.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast [2 x i32]* %arr.data.1 to i8*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %25 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 0
  store i32 0, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = getelementptr inbounds i32, i32* %27, i64 1
  store i32 0, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pair.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast [1 x i32]* %arr.data.2 to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 0, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %none.addr, align 8
  %36 = load i32, i32* %loop.addr, align 4
  %37 = load i32, i32* %a.addr, align 4
  %38 = call i32 @nish_poll_add(i32 %36, i32 %37, i32 1, i32 7)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = call i64 @nish_monotonic_nanos()
  store i64 %40, i64* %started.addr, align 8
  %41 = load i32, i32* %loop.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %43 = call i32 @nish_poll_wait(i32 %41, %struct.nish_array* %42, i32 50)
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  %45 = call i64 @nish_monotonic_nanos()
  %46 = load i64, i64* %started.addr, align 8
  %47 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %45, i64 %46)
  %48 = extractvalue { i64, i1 } %47, 0
  %49 = extractvalue { i64, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  %50 = sdiv i64 %48, 1000000
  store i64 %50, i64* %waited.addr, align 8
  %51 = load i64, i64* %waited.addr, align 8
  %52 = icmp sge i64 %51, 50
  br i1 %52, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %53 = load i64, i64* %waited.addr, align 8
  %54 = icmp slt i64 %53, 5000
  br label %land.end.2

land.end.2:
  %55 = phi i1 [ false, %ovf.ok ], [ %54, %land.rhs.2 ]
  %56 = select i1 %55, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %56)
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %59, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %toA.addr, align 8
  %61 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %62 = load i32, i32* %a.addr, align 4
  %63 = call i32 @nish_net_local_port(i32 %62)
  %64 = call i32 @nish_net_address(%struct.nish_array* %61, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %63)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast [3 x i8]* %arr.data.4 to i8*
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %67, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %67 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 0
  store i8 1, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %71 = getelementptr inbounds i8, i8* %69, i64 1
  store i8 2, i8* %71, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %72 = getelementptr inbounds i8, i8* %69, i64 2
  store i8 3, i8* %72, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %data.addr, align 8
  %73 = load i32, i32* %b.addr, align 4
  %74 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %76 = call i32 @nish_udp_send_to(i32 %73, %struct.nish_array* %74, i64 0, i64 3, %struct.nish_array* %75, i32 0, i32 0)
  %77 = call i8* @nish_str_from_i32(i32 %76)
  call void @nish_print(i8* %77)
  %78 = load i32, i32* %loop.addr, align 4
  %79 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %80 = call i32 @nish_poll_wait(i32 %78, %struct.nish_array* %79, i32 -1)
  %81 = call i8* @nish_str_from_i32(i32 %80)
  call void @nish_print(i8* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = icmp ult i64 0, %84
  br i1 %85, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %84)
  unreachable

bounds.ok:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 0
  %90 = load i32, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %91 = call i8* @nish_str_from_i32(i32 %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %93 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 1, %95
  br i1 %96, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %95)
  unreachable

bounds.ok.1:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 1
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %92, i8* %102)
  call void @nish_print(i8* %103)
  %104 = load i32, i32* %loop.addr, align 4
  %105 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %106 = call i32 @nish_poll_wait(i32 %104, %struct.nish_array* %105, i32 0)
  %107 = call i8* @nish_str_from_i32(i32 %106)
  call void @nish_print(i8* %107)
  %108 = load i32, i32* %loop.addr, align 4
  %109 = load i32, i32* %b.addr, align 4
  %110 = call i32 @nish_poll_add(i32 %108, i32 %109, i32 2, i32 8)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = load i32, i32* %loop.addr, align 4
  %113 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %114 = call i32 @nish_poll_wait(i32 %112, %struct.nish_array* %113, i32 0)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  call void @nish_print(i8* %115)
  %116 = load i32, i32* %loop.addr, align 4
  %117 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %118 = call i32 @nish_poll_wait(i32 %116, %struct.nish_array* %117, i32 0)
  %119 = call i8* @nish_str_from_i32(i32 %118)
  call void @nish_print(i8* %119)
  %120 = load i32, i32* %loop.addr, align 4
  %121 = load i32, i32* %a.addr, align 4
  %122 = call i32 @nish_poll_modify(i32 %120, i32 %121, i32 3, i32 9)
  %123 = call i8* @nish_str_from_i32(i32 %122)
  call void @nish_print(i8* %123)
  %124 = load i32, i32* %loop.addr, align 4
  %125 = load i32, i32* %b.addr, align 4
  %126 = call i32 @nish_poll_remove(i32 %124, i32 %125)
  %127 = call i8* @nish_str_from_i32(i32 %126)
  call void @nish_print(i8* %127)
  %128 = load i32, i32* %loop.addr, align 4
  %129 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %130 = call i32 @nish_poll_wait(i32 %128, %struct.nish_array* %129, i32 0)
  %131 = call i8* @nish_str_from_i32(i32 %130)
  call void @nish_print(i8* %131)
  %132 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = icmp ult i64 0, %134
  br i1 %135, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %134)
  unreachable

bounds.ok.2:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 0
  %140 = load i32, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %141, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %143 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 0
  %145 = load i64, i64* %144, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = icmp ult i64 1, %145
  br i1 %146, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %145)
  unreachable

bounds.ok.3:
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 1
  %151 = load i32, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %142, i8* %152)
  call void @nish_print(i8* %153)
  %154 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 1)
  store i32 %154, i32* %listener.addr, align 4
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 18, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 18, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %157 = bitcast [18 x i8]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %157, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %157, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %toL.addr, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %toL.addr, align 8
  %160 = load i32, i32* %listener.addr, align 4
  %161 = call i32 @nish_net_local_port(i32 %160)
  %162 = call i32 @nish_net_address(%struct.nish_array* %159, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %161)
  %163 = load %struct.nish_array*, %struct.nish_array** %toL.addr, align 8
  %164 = call i32 @nish_tcp_connect(%struct.nish_array* %163)
  store i32 %164, i32* %c.addr, align 4
  %165 = load i32, i32* %loop.addr, align 4
  %166 = load i32, i32* %a.addr, align 4
  %167 = call i32 @nish_poll_remove(i32 %165, i32 %166)
  %168 = call i8* @nish_str_from_i32(i32 %167)
  call void @nish_print(i8* %168)
  %169 = load i32, i32* %loop.addr, align 4
  %170 = load i32, i32* %c.addr, align 4
  %171 = call i32 @nish_poll_add(i32 %169, i32 %170, i32 3, i32 9)
  %172 = call i8* @nish_str_from_i32(i32 %171)
  call void @nish_print(i8* %172)
  %173 = load i32, i32* %c.addr, align 4
  %174 = call i32 @nish_net_shutdown(i32 %173, i32 2)
  %175 = load i32, i32* %loop.addr, align 4
  %176 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %177 = call i32 @nish_poll_wait(i32 %175, %struct.nish_array* %176, i32 0)
  %178 = call i8* @nish_str_from_i32(i32 %177)
  call void @nish_print(i8* %178)
  %179 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 0
  %181 = load i64, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %182 = icmp ult i64 0, %181
  br i1 %182, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %181)
  unreachable

bounds.ok.4:
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 2
  %184 = load i8*, i8** %183, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %185 = bitcast i8* %184 to i32*
  %186 = getelementptr inbounds i32, i32* %185, i64 0
  %187 = load i32, i32* %186, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %188 = call i8* @nish_str_from_i32(i32 %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %190 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  %192 = load i64, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = icmp ult i64 1, %192
  br i1 %193, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %192)
  unreachable

bounds.ok.5:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = bitcast i8* %195 to i32*
  %197 = getelementptr inbounds i32, i32* %196, i64 1
  %198 = load i32, i32* %197, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %199 = call i8* @nish_str_from_i32(i32 %198)
  %200 = call i8* @nish_str_concat(i8* %189, i8* %199)
  call void @nish_print(i8* %200)
  %201 = load i32, i32* %loop.addr, align 4
  %202 = load i32, i32* %b.addr, align 4
  %203 = call i32 @nish_poll_add(i32 %201, i32 %202, i32 4, i32 1)
  %204 = call i8* @nish_str_from_i32(i32 %203)
  call void @nish_print(i8* %204)
  %205 = load i32, i32* %loop.addr, align 4
  %206 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %207 = call i32 @nish_poll_wait(i32 %205, %struct.nish_array* %206, i32 0)
  %208 = call i8* @nish_str_from_i32(i32 %207)
  call void @nish_print(i8* %208)
  %209 = load i32, i32* %loop.addr, align 4
  %210 = load i32, i32* %c.addr, align 4
  %211 = call i32 @nish_poll_add(i32 %209, i32 %210, i32 1, i32 1)
  %212 = call i8* @nish_str_from_i32(i32 %211)
  call void @nish_print(i8* %212)
  %213 = load i32, i32* %loop.addr, align 4
  %214 = load i32, i32* %b.addr, align 4
  %215 = call i32 @nish_poll_remove(i32 %213, i32 %214)
  %216 = call i8* @nish_str_from_i32(i32 %215)
  call void @nish_print(i8* %216)
  %217 = load i32, i32* %loop.addr, align 4
  %218 = load i32, i32* %b.addr, align 4
  %219 = call i32 @nish_poll_modify(i32 %217, i32 %218, i32 1, i32 1)
  %220 = call i8* @nish_str_from_i32(i32 %219)
  call void @nish_print(i8* %220)
  %221 = load i32, i32* %a.addr, align 4
  %222 = call i32 @nish_net_close(i32 %221)
  %223 = load i32, i32* %b.addr, align 4
  %224 = call i32 @nish_net_close(i32 %223)
  %225 = load i32, i32* %c.addr, align 4
  %226 = call i32 @nish_net_close(i32 %225)
  %227 = load i32, i32* %listener.addr, align 4
  %228 = call i32 @nish_net_close(i32 %227)
  %229 = load i32, i32* %loop.addr, align 4
  %230 = call i32 @nish_net_close(i32 %229)
  %231 = call i8* @nish_str_from_i32(i32 %230)
  call void @nish_print(i8* %231)
  %232 = load i32, i32* %loop.addr, align 4
  %233 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %234 = call i32 @nish_poll_wait(i32 %232, %struct.nish_array* %233, i32 0)
  %235 = call i8* @nish_str_from_i32(i32 %234)
  call void @nish_print(i8* %235)
  %236 = load i32, i32* %loop.addr, align 4
  %237 = call i32 @nish_poll_add(i32 %236, i32 0, i32 1, i32 1)
  %238 = call i8* @nish_str_from_i32(i32 %237)
  call void @nish_print(i8* %238)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
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
