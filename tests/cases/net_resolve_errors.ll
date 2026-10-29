%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"nish-test.invalid\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [254 x i8] } { i64 253, [254 x i8] c"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.invalid\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [255 x i8] } { i64 254, [255 x i8] c"caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.invalid\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"localhost\00.invalid\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"localhost\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef i32 @nish_net_resolve(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %short.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [17 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 17, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 17, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [17 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 17, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %short.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i32 @nish_net_resolve(%struct.nish_array* %8, i8* bitcast ({ i64, [18 x i8] }* @.str.0 to i8*), i32 80, i32 0)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %12 = call i32 @nish_net_resolve(%struct.nish_array* %11, i8* bitcast ({ i64, [254 x i8] }* @.str.1 to i8*), i32 80, i32 0)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = call i32 @nish_net_resolve(%struct.nish_array* %14, i8* bitcast ({ i64, [255 x i8] }* @.str.2 to i8*), i32 80, i32 0)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = call i32 @nish_net_resolve(%struct.nish_array* %17, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 80, i32 0)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %21 = call i32 @nish_net_resolve(%struct.nish_array* %20, i8* bitcast ({ i64, [19 x i8] }* @.str.4 to i8*), i32 80, i32 0)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %24 = call i32 @nish_net_resolve(%struct.nish_array* %23, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 80, i32 5)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = call i32 @nish_net_resolve(%struct.nish_array* %26, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 80, i32 -1)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %30 = call i32 @nish_net_resolve(%struct.nish_array* %29, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 65536, i32 0)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
  %32 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %33 = call i32 @nish_net_resolve(%struct.nish_array* %32, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 -1, i32 0)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %36 = call i32 @nish_net_resolve(%struct.nish_array* %35, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 80, i32 0)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = icmp ult i64 0, %40
  br i1 %41, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %40)
  unreachable

bounds.ok:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 0
  %46 = load i8, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = zext i8 %46 to i64
  %48 = call i8* @nish_str_from_u64(i64 %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %50 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 10, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 10, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i8*
  %57 = getelementptr inbounds i8, i8* %56, i64 10
  %58 = load i8, i8* %57, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = zext i8 %58 to i64
  %60 = call i8* @nish_str_from_u64(i64 %59)
  %61 = call i8* @nish_str_concat(i8* %49, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %63 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ult i64 17, %65
  br i1 %66, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 17, i64 %65)
  unreachable

bounds.ok.2:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 17
  %71 = load i8, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %72 = zext i8 %71 to i64
  %73 = call i8* @nish_str_from_u64(i64 %72)
  %74 = call i8* @nish_str_concat(i8* %62, i8* %73)
  call void @nish_print(i8* %74)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
