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
  %48 = icmp eq i64 1000000, 0
  %49 = icmp eq i64 %47, -9223372036854775808
  %50 = icmp eq i64 1000000, -1
  %51 = and i1 %49, %50
  %52 = or i1 %48, %51
  br i1 %52, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %48)
  unreachable

div.ok:
  %53 = sdiv i64 %47, 1000000
  store i64 %53, i64* %waited.addr, align 8
  %54 = load i64, i64* %waited.addr, align 8
  %55 = icmp sge i64 %54, 50
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i64, i64* %waited.addr, align 8
  %57 = icmp slt i64 %56, 5000
  br label %land.end.2

land.end.2:
  %58 = phi i1 [ false, %div.ok ], [ %57, %land.rhs.2 ]
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %59)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %62 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %62, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %62, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %toA.addr, align 8
  %64 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %65 = load i32, i32* %a.addr, align 4
  %66 = call i32 @nish_net_local_port(i32 %65)
  %67 = call i32 @nish_net_address(%struct.nish_array* %64, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %66)
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = bitcast [3 x i8]* %arr.data.4 to i8*
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %70 to i8*
  %73 = getelementptr inbounds i8, i8* %72, i64 0
  store i8 1, i8* %73, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %74 = getelementptr inbounds i8, i8* %72, i64 1
  store i8 2, i8* %74, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %75 = getelementptr inbounds i8, i8* %72, i64 2
  store i8 3, i8* %75, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %data.addr, align 8
  %76 = load i32, i32* %b.addr, align 4
  %77 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %79 = add i64 0, 3
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %81 = load i64, i64* %80, align 8
  %82 = icmp ule i64 0, %79
  %83 = icmp ule i64 %79, %81
  %84 = and i1 %82, %83
  br i1 %84, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %79, i64 %81)
  unreachable

net.ok:
  %85 = call i32 @nish_udp_send_to(i32 %76, %struct.nish_array* %77, i64 0, i64 3, %struct.nish_array* %78, i32 0, i32 0)
  %86 = call i8* @nish_str_from_i32(i32 %85)
  call void @nish_print(i8* %86)
  %87 = load i32, i32* %loop.addr, align 4
  %88 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %89 = call i32 @nish_poll_wait(i32 %87, %struct.nish_array* %88, i32 -1)
  %90 = call i8* @nish_str_from_i32(i32 %89)
  call void @nish_print(i8* %90)
  %91 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = icmp ult i64 0, %93
  br i1 %94, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %93)
  unreachable

bounds.ok:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %96 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 0
  %99 = load i32, i32* %98, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %100 = call i8* @nish_str_from_i32(i32 %99)
  %101 = call i8* @nish_str_concat(i8* %100, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %102 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  %104 = load i64, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = icmp ult i64 1, %104
  br i1 %105, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %104)
  unreachable

bounds.ok.1:
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  %107 = load i8*, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %108 = bitcast i8* %107 to i32*
  %109 = getelementptr inbounds i32, i32* %108, i64 1
  %110 = load i32, i32* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %101, i8* %111)
  call void @nish_print(i8* %112)
  %113 = load i32, i32* %loop.addr, align 4
  %114 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %115 = call i32 @nish_poll_wait(i32 %113, %struct.nish_array* %114, i32 0)
  %116 = call i8* @nish_str_from_i32(i32 %115)
  call void @nish_print(i8* %116)
  %117 = load i32, i32* %loop.addr, align 4
  %118 = load i32, i32* %b.addr, align 4
  %119 = call i32 @nish_poll_add(i32 %117, i32 %118, i32 2, i32 8)
  %120 = call i8* @nish_str_from_i32(i32 %119)
  call void @nish_print(i8* %120)
  %121 = load i32, i32* %loop.addr, align 4
  %122 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %123 = call i32 @nish_poll_wait(i32 %121, %struct.nish_array* %122, i32 0)
  %124 = call i8* @nish_str_from_i32(i32 %123)
  call void @nish_print(i8* %124)
  %125 = load i32, i32* %loop.addr, align 4
  %126 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %127 = call i32 @nish_poll_wait(i32 %125, %struct.nish_array* %126, i32 0)
  %128 = call i8* @nish_str_from_i32(i32 %127)
  call void @nish_print(i8* %128)
  %129 = load i32, i32* %loop.addr, align 4
  %130 = load i32, i32* %a.addr, align 4
  %131 = call i32 @nish_poll_modify(i32 %129, i32 %130, i32 3, i32 9)
  %132 = call i8* @nish_str_from_i32(i32 %131)
  call void @nish_print(i8* %132)
  %133 = load i32, i32* %loop.addr, align 4
  %134 = load i32, i32* %b.addr, align 4
  %135 = call i32 @nish_poll_remove(i32 %133, i32 %134)
  %136 = call i8* @nish_str_from_i32(i32 %135)
  call void @nish_print(i8* %136)
  %137 = load i32, i32* %loop.addr, align 4
  %138 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %139 = call i32 @nish_poll_wait(i32 %137, %struct.nish_array* %138, i32 0)
  %140 = call i8* @nish_str_from_i32(i32 %139)
  call void @nish_print(i8* %140)
  %141 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = icmp ult i64 0, %143
  br i1 %144, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %143)
  unreachable

bounds.ok.2:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %147 = bitcast i8* %146 to i32*
  %148 = getelementptr inbounds i32, i32* %147, i64 0
  %149 = load i32, i32* %148, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %152 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 0
  %154 = load i64, i64* %153, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %155 = icmp ult i64 1, %154
  br i1 %155, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %154)
  unreachable

bounds.ok.3:
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %158 = bitcast i8* %157 to i32*
  %159 = getelementptr inbounds i32, i32* %158, i64 1
  %160 = load i32, i32* %159, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* %151, i8* %161)
  call void @nish_print(i8* %162)
  %163 = load i32, i32* %a.addr, align 4
  %164 = call i32 @nish_net_shutdown(i32 %163, i32 2)
  %165 = load i32, i32* %loop.addr, align 4
  %166 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %167 = call i32 @nish_poll_wait(i32 %165, %struct.nish_array* %166, i32 0)
  %168 = call i8* @nish_str_from_i32(i32 %167)
  call void @nish_print(i8* %168)
  %169 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 0
  %171 = load i64, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = icmp ult i64 0, %171
  br i1 %172, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %171)
  unreachable

bounds.ok.4:
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %175 = bitcast i8* %174 to i32*
  %176 = getelementptr inbounds i32, i32* %175, i64 0
  %177 = load i32, i32* %176, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %178 = call i8* @nish_str_from_i32(i32 %177)
  %179 = call i8* @nish_str_concat(i8* %178, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %180 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 0
  %182 = load i64, i64* %181, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %183 = icmp ult i64 1, %182
  br i1 %183, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %182)
  unreachable

bounds.ok.5:
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 2
  %185 = load i8*, i8** %184, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %186 = bitcast i8* %185 to i32*
  %187 = getelementptr inbounds i32, i32* %186, i64 1
  %188 = load i32, i32* %187, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %189 = call i8* @nish_str_from_i32(i32 %188)
  %190 = call i8* @nish_str_concat(i8* %179, i8* %189)
  call void @nish_print(i8* %190)
  %191 = load i32, i32* %loop.addr, align 4
  %192 = load i32, i32* %b.addr, align 4
  %193 = call i32 @nish_poll_add(i32 %191, i32 %192, i32 4, i32 1)
  %194 = call i8* @nish_str_from_i32(i32 %193)
  call void @nish_print(i8* %194)
  %195 = load i32, i32* %loop.addr, align 4
  %196 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %197 = call i32 @nish_poll_wait(i32 %195, %struct.nish_array* %196, i32 0)
  %198 = call i8* @nish_str_from_i32(i32 %197)
  call void @nish_print(i8* %198)
  %199 = load i32, i32* %loop.addr, align 4
  %200 = load i32, i32* %a.addr, align 4
  %201 = call i32 @nish_poll_add(i32 %199, i32 %200, i32 1, i32 1)
  %202 = call i8* @nish_str_from_i32(i32 %201)
  call void @nish_print(i8* %202)
  %203 = load i32, i32* %loop.addr, align 4
  %204 = load i32, i32* %b.addr, align 4
  %205 = call i32 @nish_poll_remove(i32 %203, i32 %204)
  %206 = call i8* @nish_str_from_i32(i32 %205)
  call void @nish_print(i8* %206)
  %207 = load i32, i32* %loop.addr, align 4
  %208 = load i32, i32* %b.addr, align 4
  %209 = call i32 @nish_poll_modify(i32 %207, i32 %208, i32 1, i32 1)
  %210 = call i8* @nish_str_from_i32(i32 %209)
  call void @nish_print(i8* %210)
  %211 = load i32, i32* %a.addr, align 4
  %212 = call i32 @nish_net_close(i32 %211)
  %213 = load i32, i32* %b.addr, align 4
  %214 = call i32 @nish_net_close(i32 %213)
  %215 = load i32, i32* %loop.addr, align 4
  %216 = call i32 @nish_net_close(i32 %215)
  %217 = call i8* @nish_str_from_i32(i32 %216)
  call void @nish_print(i8* %217)
  %218 = load i32, i32* %loop.addr, align 4
  %219 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %220 = call i32 @nish_poll_wait(i32 %218, %struct.nish_array* %219, i32 0)
  %221 = call i8* @nish_str_from_i32(i32 %220)
  call void @nish_print(i8* %221)
  %222 = load i32, i32* %loop.addr, align 4
  %223 = call i32 @nish_poll_add(i32 %222, i32 0, i32 1, i32 1)
  %224 = call i8* @nish_str_from_i32(i32 %223)
  call void @nish_print(i8* %224)
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
