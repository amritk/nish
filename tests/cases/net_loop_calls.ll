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
  %47 = sub nsw i64 %45, %46
  %48 = sdiv i64 %47, 1000000
  store i64 %48, i64* %waited.addr, align 8
  %49 = load i64, i64* %waited.addr, align 8
  %50 = icmp sge i64 %49, 50
  br i1 %50, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %51 = load i64, i64* %waited.addr, align 8
  %52 = icmp slt i64 %51, 5000
  br label %land.end.2

land.end.2:
  %53 = phi i1 [ false, %land.end ], [ %52, %land.rhs.2 ]
  %54 = select i1 %53, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %54)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %57, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %57, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %toA.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %60 = load i32, i32* %a.addr, align 4
  %61 = call i32 @nish_net_local_port(i32 %60)
  %62 = call i32 @nish_net_address(%struct.nish_array* %59, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %61)
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = bitcast [3 x i8]* %arr.data.4 to i8*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %65 to i8*
  %68 = getelementptr inbounds i8, i8* %67, i64 0
  store i8 1, i8* %68, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = getelementptr inbounds i8, i8* %67, i64 1
  store i8 2, i8* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %70 = getelementptr inbounds i8, i8* %67, i64 2
  store i8 3, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %data.addr, align 8
  %71 = load i32, i32* %b.addr, align 4
  %72 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %74 = add i64 0, 3
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %76 = load i64, i64* %75, align 8
  %77 = icmp ule i64 0, %74
  %78 = icmp ule i64 %74, %76
  %79 = and i1 %77, %78
  br i1 %79, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %74, i64 %76)
  unreachable

net.ok:
  %80 = call i32 @nish_udp_send_to(i32 %71, %struct.nish_array* %72, i64 0, i64 3, %struct.nish_array* %73, i32 0, i32 0)
  %81 = call i8* @nish_str_from_i32(i32 %80)
  call void @nish_print(i8* %81)
  %82 = load i32, i32* %loop.addr, align 4
  %83 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %84 = call i32 @nish_poll_wait(i32 %82, %struct.nish_array* %83, i32 -1)
  %85 = call i8* @nish_str_from_i32(i32 %84)
  call void @nish_print(i8* %85)
  %86 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = icmp ult i64 0, %88
  br i1 %89, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %88)
  unreachable

bounds.ok:
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %92 = bitcast i8* %91 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 0
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = call i8* @nish_str_from_i32(i32 %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %97 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = icmp ult i64 1, %99
  br i1 %100, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %99)
  unreachable

bounds.ok.1:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 1
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %96, i8* %106)
  call void @nish_print(i8* %107)
  %108 = load i32, i32* %loop.addr, align 4
  %109 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %110 = call i32 @nish_poll_wait(i32 %108, %struct.nish_array* %109, i32 0)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = load i32, i32* %loop.addr, align 4
  %113 = load i32, i32* %b.addr, align 4
  %114 = call i32 @nish_poll_add(i32 %112, i32 %113, i32 2, i32 8)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  call void @nish_print(i8* %115)
  %116 = load i32, i32* %loop.addr, align 4
  %117 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %118 = call i32 @nish_poll_wait(i32 %116, %struct.nish_array* %117, i32 0)
  %119 = call i8* @nish_str_from_i32(i32 %118)
  call void @nish_print(i8* %119)
  %120 = load i32, i32* %loop.addr, align 4
  %121 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %122 = call i32 @nish_poll_wait(i32 %120, %struct.nish_array* %121, i32 0)
  %123 = call i8* @nish_str_from_i32(i32 %122)
  call void @nish_print(i8* %123)
  %124 = load i32, i32* %loop.addr, align 4
  %125 = load i32, i32* %a.addr, align 4
  %126 = call i32 @nish_poll_modify(i32 %124, i32 %125, i32 3, i32 9)
  %127 = call i8* @nish_str_from_i32(i32 %126)
  call void @nish_print(i8* %127)
  %128 = load i32, i32* %loop.addr, align 4
  %129 = load i32, i32* %b.addr, align 4
  %130 = call i32 @nish_poll_remove(i32 %128, i32 %129)
  %131 = call i8* @nish_str_from_i32(i32 %130)
  call void @nish_print(i8* %131)
  %132 = load i32, i32* %loop.addr, align 4
  %133 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %134 = call i32 @nish_poll_wait(i32 %132, %struct.nish_array* %133, i32 0)
  %135 = call i8* @nish_str_from_i32(i32 %134)
  call void @nish_print(i8* %135)
  %136 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = icmp ult i64 0, %138
  br i1 %139, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %138)
  unreachable

bounds.ok.2:
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %142 = bitcast i8* %141 to i32*
  %143 = getelementptr inbounds i32, i32* %142, i64 0
  %144 = load i32, i32* %143, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %145 = call i8* @nish_str_from_i32(i32 %144)
  %146 = call i8* @nish_str_concat(i8* %145, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %147 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 0
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = icmp ult i64 1, %149
  br i1 %150, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %149)
  unreachable

bounds.ok.3:
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %153 = bitcast i8* %152 to i32*
  %154 = getelementptr inbounds i32, i32* %153, i64 1
  %155 = load i32, i32* %154, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %156 = call i8* @nish_str_from_i32(i32 %155)
  %157 = call i8* @nish_str_concat(i8* %146, i8* %156)
  call void @nish_print(i8* %157)
  %158 = load i32, i32* %a.addr, align 4
  %159 = call i32 @nish_net_shutdown(i32 %158, i32 2)
  %160 = load i32, i32* %loop.addr, align 4
  %161 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %162 = call i32 @nish_poll_wait(i32 %160, %struct.nish_array* %161, i32 0)
  %163 = call i8* @nish_str_from_i32(i32 %162)
  call void @nish_print(i8* %163)
  %164 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 0
  %166 = load i64, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %167 = icmp ult i64 0, %166
  br i1 %167, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %166)
  unreachable

bounds.ok.4:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %170 = bitcast i8* %169 to i32*
  %171 = getelementptr inbounds i32, i32* %170, i64 0
  %172 = load i32, i32* %171, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %173 = call i8* @nish_str_from_i32(i32 %172)
  %174 = call i8* @nish_str_concat(i8* %173, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %175 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = icmp ult i64 1, %177
  br i1 %178, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %177)
  unreachable

bounds.ok.5:
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %181 = bitcast i8* %180 to i32*
  %182 = getelementptr inbounds i32, i32* %181, i64 1
  %183 = load i32, i32* %182, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %184 = call i8* @nish_str_from_i32(i32 %183)
  %185 = call i8* @nish_str_concat(i8* %174, i8* %184)
  call void @nish_print(i8* %185)
  %186 = load i32, i32* %loop.addr, align 4
  %187 = load i32, i32* %b.addr, align 4
  %188 = call i32 @nish_poll_add(i32 %186, i32 %187, i32 4, i32 1)
  %189 = call i8* @nish_str_from_i32(i32 %188)
  call void @nish_print(i8* %189)
  %190 = load i32, i32* %loop.addr, align 4
  %191 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %192 = call i32 @nish_poll_wait(i32 %190, %struct.nish_array* %191, i32 0)
  %193 = call i8* @nish_str_from_i32(i32 %192)
  call void @nish_print(i8* %193)
  %194 = load i32, i32* %loop.addr, align 4
  %195 = load i32, i32* %a.addr, align 4
  %196 = call i32 @nish_poll_add(i32 %194, i32 %195, i32 1, i32 1)
  %197 = call i8* @nish_str_from_i32(i32 %196)
  call void @nish_print(i8* %197)
  %198 = load i32, i32* %loop.addr, align 4
  %199 = load i32, i32* %b.addr, align 4
  %200 = call i32 @nish_poll_remove(i32 %198, i32 %199)
  %201 = call i8* @nish_str_from_i32(i32 %200)
  call void @nish_print(i8* %201)
  %202 = load i32, i32* %loop.addr, align 4
  %203 = load i32, i32* %b.addr, align 4
  %204 = call i32 @nish_poll_modify(i32 %202, i32 %203, i32 1, i32 1)
  %205 = call i8* @nish_str_from_i32(i32 %204)
  call void @nish_print(i8* %205)
  %206 = load i32, i32* %a.addr, align 4
  %207 = call i32 @nish_net_close(i32 %206)
  %208 = load i32, i32* %b.addr, align 4
  %209 = call i32 @nish_net_close(i32 %208)
  %210 = load i32, i32* %loop.addr, align 4
  %211 = call i32 @nish_net_close(i32 %210)
  %212 = call i8* @nish_str_from_i32(i32 %211)
  call void @nish_print(i8* %212)
  %213 = load i32, i32* %loop.addr, align 4
  %214 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %215 = call i32 @nish_poll_wait(i32 %213, %struct.nish_array* %214, i32 0)
  %216 = call i8* @nish_str_from_i32(i32 %215)
  call void @nish_print(i8* %216)
  %217 = load i32, i32* %loop.addr, align 4
  %218 = call i32 @nish_poll_add(i32 %217, i32 0, i32 1, i32 1)
  %219 = call i8* @nish_str_from_i32(i32 %218)
  call void @nish_print(i8* %219)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
