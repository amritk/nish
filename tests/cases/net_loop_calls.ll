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
declare void @nish_panic_div(i1 noundef zeroext) #2
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
  %50 = icmp eq i64 1000000, 0
  %51 = icmp eq i64 %48, -9223372036854775808
  %52 = icmp eq i64 1000000, -1
  %53 = and i1 %51, %52
  %54 = or i1 %50, %53
  br i1 %54, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %50)
  unreachable

div.ok:
  %55 = sdiv i64 %48, 1000000
  store i64 %55, i64* %waited.addr, align 8
  %56 = load i64, i64* %waited.addr, align 8
  %57 = icmp sge i64 %56, 50
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load i64, i64* %waited.addr, align 8
  %59 = icmp slt i64 %58, 5000
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %div.ok ], [ %59, %land.rhs.2 ]
  %61 = select i1 %60, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %61)
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %64 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %64, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %64, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %toA.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %67 = load i32, i32* %a.addr, align 4
  %68 = call i32 @nish_net_local_port(i32 %67)
  %69 = call i32 @nish_net_address(%struct.nish_array* %66, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %68)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast [3 x i8]* %arr.data.4 to i8*
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %72, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %72 to i8*
  %75 = getelementptr inbounds i8, i8* %74, i64 0
  store i8 1, i8* %75, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %76 = getelementptr inbounds i8, i8* %74, i64 1
  store i8 2, i8* %76, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %77 = getelementptr inbounds i8, i8* %74, i64 2
  store i8 3, i8* %77, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %data.addr, align 8
  %78 = load i32, i32* %b.addr, align 4
  %79 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %81 = add i64 0, 3
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %83 = load i64, i64* %82, align 8
  %84 = icmp ule i64 0, %81
  %85 = icmp ule i64 %81, %83
  %86 = and i1 %84, %85
  br i1 %86, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %81, i64 %83)
  unreachable

net.ok:
  %87 = call i32 @nish_udp_send_to(i32 %78, %struct.nish_array* %79, i64 0, i64 3, %struct.nish_array* %80, i32 0, i32 0)
  %88 = call i8* @nish_str_from_i32(i32 %87)
  call void @nish_print(i8* %88)
  %89 = load i32, i32* %loop.addr, align 4
  %90 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %91 = call i32 @nish_poll_wait(i32 %89, %struct.nish_array* %90, i32 -1)
  %92 = call i8* @nish_str_from_i32(i32 %91)
  call void @nish_print(i8* %92)
  %93 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 0, %95
  br i1 %96, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %95)
  unreachable

bounds.ok:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 0
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %104 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = icmp ult i64 1, %106
  br i1 %107, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %106)
  unreachable

bounds.ok.1:
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %110 = bitcast i8* %109 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 1
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %103, i8* %113)
  call void @nish_print(i8* %114)
  %115 = load i32, i32* %loop.addr, align 4
  %116 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %117 = call i32 @nish_poll_wait(i32 %115, %struct.nish_array* %116, i32 0)
  %118 = call i8* @nish_str_from_i32(i32 %117)
  call void @nish_print(i8* %118)
  %119 = load i32, i32* %loop.addr, align 4
  %120 = load i32, i32* %b.addr, align 4
  %121 = call i32 @nish_poll_add(i32 %119, i32 %120, i32 2, i32 8)
  %122 = call i8* @nish_str_from_i32(i32 %121)
  call void @nish_print(i8* %122)
  %123 = load i32, i32* %loop.addr, align 4
  %124 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %125 = call i32 @nish_poll_wait(i32 %123, %struct.nish_array* %124, i32 0)
  %126 = call i8* @nish_str_from_i32(i32 %125)
  call void @nish_print(i8* %126)
  %127 = load i32, i32* %loop.addr, align 4
  %128 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %129 = call i32 @nish_poll_wait(i32 %127, %struct.nish_array* %128, i32 0)
  %130 = call i8* @nish_str_from_i32(i32 %129)
  call void @nish_print(i8* %130)
  %131 = load i32, i32* %loop.addr, align 4
  %132 = load i32, i32* %a.addr, align 4
  %133 = call i32 @nish_poll_modify(i32 %131, i32 %132, i32 3, i32 9)
  %134 = call i8* @nish_str_from_i32(i32 %133)
  call void @nish_print(i8* %134)
  %135 = load i32, i32* %loop.addr, align 4
  %136 = load i32, i32* %b.addr, align 4
  %137 = call i32 @nish_poll_remove(i32 %135, i32 %136)
  %138 = call i8* @nish_str_from_i32(i32 %137)
  call void @nish_print(i8* %138)
  %139 = load i32, i32* %loop.addr, align 4
  %140 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %141 = call i32 @nish_poll_wait(i32 %139, %struct.nish_array* %140, i32 0)
  %142 = call i8* @nish_str_from_i32(i32 %141)
  call void @nish_print(i8* %142)
  %143 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 0
  %145 = load i64, i64* %144, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = icmp ult i64 0, %145
  br i1 %146, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %145)
  unreachable

bounds.ok.2:
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 0
  %151 = load i32, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %154 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = icmp ult i64 1, %156
  br i1 %157, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %156)
  unreachable

bounds.ok.3:
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %159 = load i8*, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %160 = bitcast i8* %159 to i32*
  %161 = getelementptr inbounds i32, i32* %160, i64 1
  %162 = load i32, i32* %161, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = call i8* @nish_str_from_i32(i32 %162)
  %164 = call i8* @nish_str_concat(i8* %153, i8* %163)
  call void @nish_print(i8* %164)
  %165 = load i32, i32* %a.addr, align 4
  %166 = call i32 @nish_net_shutdown(i32 %165, i32 2)
  %167 = load i32, i32* %loop.addr, align 4
  %168 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %169 = call i32 @nish_poll_wait(i32 %167, %struct.nish_array* %168, i32 0)
  %170 = call i8* @nish_str_from_i32(i32 %169)
  call void @nish_print(i8* %170)
  %171 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 0
  %173 = load i64, i64* %172, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %174 = icmp ult i64 0, %173
  br i1 %174, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %173)
  unreachable

bounds.ok.4:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 2
  %176 = load i8*, i8** %175, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %177 = bitcast i8* %176 to i32*
  %178 = getelementptr inbounds i32, i32* %177, i64 0
  %179 = load i32, i32* %178, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %180 = call i8* @nish_str_from_i32(i32 %179)
  %181 = call i8* @nish_str_concat(i8* %180, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %182 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 0
  %184 = load i64, i64* %183, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = icmp ult i64 1, %184
  br i1 %185, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %184)
  unreachable

bounds.ok.5:
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 2
  %187 = load i8*, i8** %186, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %188 = bitcast i8* %187 to i32*
  %189 = getelementptr inbounds i32, i32* %188, i64 1
  %190 = load i32, i32* %189, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %191 = call i8* @nish_str_from_i32(i32 %190)
  %192 = call i8* @nish_str_concat(i8* %181, i8* %191)
  call void @nish_print(i8* %192)
  %193 = load i32, i32* %loop.addr, align 4
  %194 = load i32, i32* %b.addr, align 4
  %195 = call i32 @nish_poll_add(i32 %193, i32 %194, i32 4, i32 1)
  %196 = call i8* @nish_str_from_i32(i32 %195)
  call void @nish_print(i8* %196)
  %197 = load i32, i32* %loop.addr, align 4
  %198 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %199 = call i32 @nish_poll_wait(i32 %197, %struct.nish_array* %198, i32 0)
  %200 = call i8* @nish_str_from_i32(i32 %199)
  call void @nish_print(i8* %200)
  %201 = load i32, i32* %loop.addr, align 4
  %202 = load i32, i32* %a.addr, align 4
  %203 = call i32 @nish_poll_add(i32 %201, i32 %202, i32 1, i32 1)
  %204 = call i8* @nish_str_from_i32(i32 %203)
  call void @nish_print(i8* %204)
  %205 = load i32, i32* %loop.addr, align 4
  %206 = load i32, i32* %b.addr, align 4
  %207 = call i32 @nish_poll_remove(i32 %205, i32 %206)
  %208 = call i8* @nish_str_from_i32(i32 %207)
  call void @nish_print(i8* %208)
  %209 = load i32, i32* %loop.addr, align 4
  %210 = load i32, i32* %b.addr, align 4
  %211 = call i32 @nish_poll_modify(i32 %209, i32 %210, i32 1, i32 1)
  %212 = call i8* @nish_str_from_i32(i32 %211)
  call void @nish_print(i8* %212)
  %213 = load i32, i32* %a.addr, align 4
  %214 = call i32 @nish_net_close(i32 %213)
  %215 = load i32, i32* %b.addr, align 4
  %216 = call i32 @nish_net_close(i32 %215)
  %217 = load i32, i32* %loop.addr, align 4
  %218 = call i32 @nish_net_close(i32 %217)
  %219 = call i8* @nish_str_from_i32(i32 %218)
  call void @nish_print(i8* %219)
  %220 = load i32, i32* %loop.addr, align 4
  %221 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %222 = call i32 @nish_poll_wait(i32 %220, %struct.nish_array* %221, i32 0)
  %223 = call i8* @nish_str_from_i32(i32 %222)
  call void @nish_print(i8* %223)
  %224 = load i32, i32* %loop.addr, align 4
  %225 = call i32 @nish_poll_add(i32 %224, i32 0, i32 1, i32 1)
  %226 = call i8* @nish_str_from_i32(i32 %225)
  call void @nish_print(i8* %226)
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
