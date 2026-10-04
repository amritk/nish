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
declare noundef i32 @nish_net_shutdown(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_modify(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_remove(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
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
  %76 = add i64 0, 3
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %78 = load i64, i64* %77, align 8
  %79 = icmp ule i64 0, %76
  %80 = icmp ule i64 %76, %78
  %81 = and i1 %79, %80
  br i1 %81, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %76, i64 %78)
  unreachable

net.ok:
  %82 = call i32 @nish_udp_send_to(i32 %73, %struct.nish_array* %74, i64 0, i64 3, %struct.nish_array* %75, i32 0, i32 0)
  %83 = call i8* @nish_str_from_i32(i32 %82)
  call void @nish_print(i8* %83)
  %84 = load i32, i32* %loop.addr, align 4
  %85 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %86 = call i32 @nish_poll_wait(i32 %84, %struct.nish_array* %85, i32 -1)
  %87 = call i8* @nish_str_from_i32(i32 %86)
  call void @nish_print(i8* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 0, %90
  br i1 %91, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %90)
  unreachable

bounds.ok:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 0
  %96 = load i32, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %99 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp ult i64 1, %101
  br i1 %102, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %101)
  unreachable

bounds.ok.1:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to i32*
  %106 = getelementptr inbounds i32, i32* %105, i64 1
  %107 = load i32, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %98, i8* %108)
  call void @nish_print(i8* %109)
  %110 = load i32, i32* %loop.addr, align 4
  %111 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %112 = call i32 @nish_poll_wait(i32 %110, %struct.nish_array* %111, i32 0)
  %113 = call i8* @nish_str_from_i32(i32 %112)
  call void @nish_print(i8* %113)
  %114 = load i32, i32* %loop.addr, align 4
  %115 = load i32, i32* %b.addr, align 4
  %116 = call i32 @nish_poll_add(i32 %114, i32 %115, i32 2, i32 8)
  %117 = call i8* @nish_str_from_i32(i32 %116)
  call void @nish_print(i8* %117)
  %118 = load i32, i32* %loop.addr, align 4
  %119 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %120 = call i32 @nish_poll_wait(i32 %118, %struct.nish_array* %119, i32 0)
  %121 = call i8* @nish_str_from_i32(i32 %120)
  call void @nish_print(i8* %121)
  %122 = load i32, i32* %loop.addr, align 4
  %123 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %124 = call i32 @nish_poll_wait(i32 %122, %struct.nish_array* %123, i32 0)
  %125 = call i8* @nish_str_from_i32(i32 %124)
  call void @nish_print(i8* %125)
  %126 = load i32, i32* %loop.addr, align 4
  %127 = load i32, i32* %a.addr, align 4
  %128 = call i32 @nish_poll_modify(i32 %126, i32 %127, i32 3, i32 9)
  %129 = call i8* @nish_str_from_i32(i32 %128)
  call void @nish_print(i8* %129)
  %130 = load i32, i32* %loop.addr, align 4
  %131 = load i32, i32* %b.addr, align 4
  %132 = call i32 @nish_poll_remove(i32 %130, i32 %131)
  %133 = call i8* @nish_str_from_i32(i32 %132)
  call void @nish_print(i8* %133)
  %134 = load i32, i32* %loop.addr, align 4
  %135 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %136 = call i32 @nish_poll_wait(i32 %134, %struct.nish_array* %135, i32 0)
  %137 = call i8* @nish_str_from_i32(i32 %136)
  call void @nish_print(i8* %137)
  %138 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %138, i64 0, i32 0
  %140 = load i64, i64* %139, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = icmp ult i64 0, %140
  br i1 %141, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %140)
  unreachable

bounds.ok.2:
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %138, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %144 = bitcast i8* %143 to i32*
  %145 = getelementptr inbounds i32, i32* %144, i64 0
  %146 = load i32, i32* %145, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %147 = call i8* @nish_str_from_i32(i32 %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %149 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  %151 = load i64, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %152 = icmp ult i64 1, %151
  br i1 %152, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %151)
  unreachable

bounds.ok.3:
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  %154 = load i8*, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %155 = bitcast i8* %154 to i32*
  %156 = getelementptr inbounds i32, i32* %155, i64 1
  %157 = load i32, i32* %156, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %158 = call i8* @nish_str_from_i32(i32 %157)
  %159 = call i8* @nish_str_concat(i8* %148, i8* %158)
  call void @nish_print(i8* %159)
  %160 = load i32, i32* %a.addr, align 4
  %161 = call i32 @nish_net_shutdown(i32 %160, i32 2)
  %162 = load i32, i32* %loop.addr, align 4
  %163 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %164 = call i32 @nish_poll_wait(i32 %162, %struct.nish_array* %163, i32 0)
  %165 = call i8* @nish_str_from_i32(i32 %164)
  call void @nish_print(i8* %165)
  %166 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %166, i64 0, i32 0
  %168 = load i64, i64* %167, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %169 = icmp ult i64 0, %168
  br i1 %169, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %168)
  unreachable

bounds.ok.4:
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %166, i64 0, i32 2
  %171 = load i8*, i8** %170, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %172 = bitcast i8* %171 to i32*
  %173 = getelementptr inbounds i32, i32* %172, i64 0
  %174 = load i32, i32* %173, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %175 = call i8* @nish_str_from_i32(i32 %174)
  %176 = call i8* @nish_str_concat(i8* %175, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %177 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %177, i64 0, i32 0
  %179 = load i64, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = icmp ult i64 1, %179
  br i1 %180, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %179)
  unreachable

bounds.ok.5:
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %177, i64 0, i32 2
  %182 = load i8*, i8** %181, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %183 = bitcast i8* %182 to i32*
  %184 = getelementptr inbounds i32, i32* %183, i64 1
  %185 = load i32, i32* %184, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %186 = call i8* @nish_str_from_i32(i32 %185)
  %187 = call i8* @nish_str_concat(i8* %176, i8* %186)
  call void @nish_print(i8* %187)
  %188 = load i32, i32* %loop.addr, align 4
  %189 = load i32, i32* %b.addr, align 4
  %190 = call i32 @nish_poll_add(i32 %188, i32 %189, i32 4, i32 1)
  %191 = call i8* @nish_str_from_i32(i32 %190)
  call void @nish_print(i8* %191)
  %192 = load i32, i32* %loop.addr, align 4
  %193 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %194 = call i32 @nish_poll_wait(i32 %192, %struct.nish_array* %193, i32 0)
  %195 = call i8* @nish_str_from_i32(i32 %194)
  call void @nish_print(i8* %195)
  %196 = load i32, i32* %loop.addr, align 4
  %197 = load i32, i32* %a.addr, align 4
  %198 = call i32 @nish_poll_add(i32 %196, i32 %197, i32 1, i32 1)
  %199 = call i8* @nish_str_from_i32(i32 %198)
  call void @nish_print(i8* %199)
  %200 = load i32, i32* %loop.addr, align 4
  %201 = load i32, i32* %b.addr, align 4
  %202 = call i32 @nish_poll_remove(i32 %200, i32 %201)
  %203 = call i8* @nish_str_from_i32(i32 %202)
  call void @nish_print(i8* %203)
  %204 = load i32, i32* %loop.addr, align 4
  %205 = load i32, i32* %b.addr, align 4
  %206 = call i32 @nish_poll_modify(i32 %204, i32 %205, i32 1, i32 1)
  %207 = call i8* @nish_str_from_i32(i32 %206)
  call void @nish_print(i8* %207)
  %208 = load i32, i32* %a.addr, align 4
  %209 = call i32 @nish_net_close(i32 %208)
  %210 = load i32, i32* %b.addr, align 4
  %211 = call i32 @nish_net_close(i32 %210)
  %212 = load i32, i32* %loop.addr, align 4
  %213 = call i32 @nish_net_close(i32 %212)
  %214 = call i8* @nish_str_from_i32(i32 %213)
  call void @nish_print(i8* %214)
  %215 = load i32, i32* %loop.addr, align 4
  %216 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %217 = call i32 @nish_poll_wait(i32 %215, %struct.nish_array* %216, i32 0)
  %218 = call i8* @nish_str_from_i32(i32 %217)
  call void @nish_print(i8* %218)
  %219 = load i32, i32* %loop.addr, align 4
  %220 = call i32 @nish_poll_add(i32 %219, i32 0, i32 1, i32 1)
  %221 = call i8* @nish_str_from_i32(i32 %220)
  call void @nish_print(i8* %221)
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
