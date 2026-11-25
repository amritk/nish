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
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait_batch(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #0
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
  %arr.data = alloca [4 x i32], align 8
  %started.addr = alloca i64, align 8
  %waited.addr = alloca i64, align 8
  %toA.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i8], align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [1 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_poll_create()
  store i32 %0, i32* %loop.addr, align 4
  %1 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %1, i32* %a.addr, align 4
  %2 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast [4 x i32]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %7, i64 2
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i32, i32* %7, i64 3
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ready.addr, align 8
  %12 = load i32, i32* %loop.addr, align 4
  %13 = load i32, i32* %a.addr, align 4
  %14 = call i32 @nish_poll_add(i32 %12, i32 %13, i32 1, i32 7)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = call i64 @nish_monotonic_nanos()
  store i64 %16, i64* %started.addr, align 8
  %17 = load i32, i32* %loop.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %19 = call i32 @nish_poll_wait_batch(i32 %17, %struct.nish_array* %18, i32 50, i32 4, i32 2000)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = call i64 @nish_monotonic_nanos()
  %22 = load i64, i64* %started.addr, align 8
  %23 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %21, i64 %22)
  %24 = extractvalue { i64, i1 } %23, 0
  %25 = extractvalue { i64, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = sdiv i64 %24, 1000000
  store i64 %26, i64* %waited.addr, align 8
  %27 = load i64, i64* %waited.addr, align 8
  %28 = icmp sge i64 %27, 50
  br i1 %28, label %land.rhs, label %land.end

land.rhs:
  %29 = load i64, i64* %waited.addr, align 8
  %30 = icmp slt i64 %29, 1500
  br label %land.end

land.end:
  %31 = phi i1 [ false, %ovf.ok ], [ %30, %land.rhs ]
  %32 = select i1 %31, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %32)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %35, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %35, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %toA.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %38 = load i32, i32* %a.addr, align 4
  %39 = call i32 @nish_net_local_port(i32 %38)
  %40 = call i32 @nish_net_address(%struct.nish_array* %37, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %39)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast [3 x i8]* %arr.data.2 to i8*
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %43 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 0
  store i8 1, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %47 = getelementptr inbounds i8, i8* %45, i64 1
  store i8 2, i8* %47, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %48 = getelementptr inbounds i8, i8* %45, i64 2
  store i8 3, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %data.addr, align 8
  %49 = load i32, i32* %b.addr, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %toA.addr, align 8
  %52 = call i32 @nish_udp_send_to(i32 %49, %struct.nish_array* %50, i64 0, i64 3, %struct.nish_array* %51, i32 0, i32 0)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
  %54 = load i32, i32* %loop.addr, align 4
  %55 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %56 = call i32 @nish_poll_wait_batch(i32 %54, %struct.nish_array* %55, i32 -1, i32 1, i32 0)
  %57 = call i8* @nish_str_from_i32(i32 %56)
  call void @nish_print(i8* %57)
  %58 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = icmp ult i64 0, %60
  br i1 %61, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %60)
  unreachable

bounds.ok:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 0
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %69 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = icmp ult i64 1, %71
  br i1 %72, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %71)
  unreachable

bounds.ok.1:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 1
  %77 = load i32, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %68, i8* %78)
  call void @nish_print(i8* %79)
  %80 = call i64 @nish_monotonic_nanos()
  store i64 %80, i64* %started.addr, align 8
  %81 = load i32, i32* %loop.addr, align 4
  %82 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %83 = call i32 @nish_poll_wait_batch(i32 %81, %struct.nish_array* %82, i32 -1, i32 4, i32 2000)
  %84 = call i8* @nish_str_from_i32(i32 %83)
  call void @nish_print(i8* %84)
  %85 = call i64 @nish_monotonic_nanos()
  %86 = load i64, i64* %started.addr, align 8
  %87 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %85, i64 %86)
  %88 = extractvalue { i64, i1 } %87, 0
  %89 = extractvalue { i64, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %90 = sdiv i64 %88, 1000000
  store i64 %90, i64* %waited.addr, align 8
  %91 = load i64, i64* %waited.addr, align 8
  %92 = icmp slt i64 %91, 1500
  %93 = select i1 %92, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %93)
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 1, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 1, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = bitcast [1 x i32]* %arr.data.3 to i8*
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %96, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %96 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 0
  store i32 0, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %none.addr, align 8
  %100 = load i32, i32* %loop.addr, align 4
  %101 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %102 = call i32 @nish_poll_wait_batch(i32 %100, %struct.nish_array* %101, i32 0, i32 1, i32 0)
  %103 = call i8* @nish_str_from_i32(i32 %102)
  call void @nish_print(i8* %103)
  %104 = load i32, i32* %loop.addr, align 4
  %105 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %106 = call i32 @nish_poll_wait_batch(i32 %104, %struct.nish_array* %105, i32 0, i32 -1, i32 0)
  %107 = call i8* @nish_str_from_i32(i32 %106)
  call void @nish_print(i8* %107)
  %108 = load i32, i32* %loop.addr, align 4
  %109 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %110 = call i32 @nish_poll_wait_batch(i32 %108, %struct.nish_array* %109, i32 0, i32 1, i32 -1)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = load i32, i32* %a.addr, align 4
  %113 = call i32 @nish_net_close(i32 %112)
  %114 = load i32, i32* %b.addr, align 4
  %115 = call i32 @nish_net_close(i32 %114)
  %116 = load i32, i32* %loop.addr, align 4
  %117 = call i32 @nish_net_close(i32 %116)
  %118 = call i8* @nish_str_from_i32(i32 %117)
  call void @nish_print(i8* %118)
  %119 = load i32, i32* %loop.addr, align 4
  %120 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %121 = call i32 @nish_poll_wait_batch(i32 %119, %struct.nish_array* %120, i32 0, i32 1, i32 0)
  %122 = call i8* @nish_str_from_i32(i32 %121)
  call void @nish_print(i8* %122)
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
