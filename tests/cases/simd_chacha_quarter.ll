%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare <4 x i32> @llvm.fshl.v4i32(<4 x i32>, <4 x i32>, <4 x i32>) #2

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca <4 x i32>, align 8
  %b.addr = alloca <4 x i32>, align 8
  %c.addr = alloca <4 x i32>, align 8
  %d.addr = alloca <4 x i32>, align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %lane.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = insertelement <4 x i32> undef, i32 286331153, i32 0
  %1 = insertelement <4 x i32> %0, i32 1, i32 1
  %2 = insertelement <4 x i32> %1, i32 4294967295, i32 2
  %3 = insertelement <4 x i32> %2, i32 1634760805, i32 3
  store <4 x i32> %3, <4 x i32>* %a.addr, align 8
  %4 = insertelement <4 x i32> undef, i32 16909060, i32 0
  %5 = insertelement <4 x i32> %4, i32 2, i32 1
  %6 = insertelement <4 x i32> %5, i32 4294967295, i32 2
  %7 = insertelement <4 x i32> %6, i32 857760878, i32 3
  store <4 x i32> %7, <4 x i32>* %b.addr, align 8
  %8 = insertelement <4 x i32> undef, i32 2609737539, i32 0
  %9 = insertelement <4 x i32> %8, i32 3, i32 1
  %10 = insertelement <4 x i32> %9, i32 4294967295, i32 2
  %11 = insertelement <4 x i32> %10, i32 2036477234, i32 3
  store <4 x i32> %11, <4 x i32>* %c.addr, align 8
  %12 = insertelement <4 x i32> undef, i32 19088743, i32 0
  %13 = insertelement <4 x i32> %12, i32 4, i32 1
  %14 = insertelement <4 x i32> %13, i32 4294967295, i32 2
  %15 = insertelement <4 x i32> %14, i32 1797285236, i32 3
  store <4 x i32> %15, <4 x i32>* %d.addr, align 8
  %16 = load <4 x i32>, <4 x i32>* %a.addr, align 8
  %17 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %18 = add <4 x i32> %16, %17
  store <4 x i32> %18, <4 x i32>* %a.addr, align 8
  %19 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %20 = load <4 x i32>, <4 x i32>* %a.addr, align 8
  %21 = xor <4 x i32> %19, %20
  %22 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %21, <4 x i32> %21, <4 x i32> <i32 16, i32 16, i32 16, i32 16>)
  store <4 x i32> %22, <4 x i32>* %d.addr, align 8
  %23 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %24 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %25 = add <4 x i32> %23, %24
  store <4 x i32> %25, <4 x i32>* %c.addr, align 8
  %26 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %27 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %28 = xor <4 x i32> %26, %27
  %29 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %28, <4 x i32> %28, <4 x i32> <i32 12, i32 12, i32 12, i32 12>)
  store <4 x i32> %29, <4 x i32>* %b.addr, align 8
  %30 = load <4 x i32>, <4 x i32>* %a.addr, align 8
  %31 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %32 = add <4 x i32> %30, %31
  store <4 x i32> %32, <4 x i32>* %a.addr, align 8
  %33 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %34 = load <4 x i32>, <4 x i32>* %a.addr, align 8
  %35 = xor <4 x i32> %33, %34
  %36 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %35, <4 x i32> %35, <4 x i32> <i32 8, i32 8, i32 8, i32 8>)
  store <4 x i32> %36, <4 x i32>* %d.addr, align 8
  %37 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %38 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %39 = add <4 x i32> %37, %38
  store <4 x i32> %39, <4 x i32>* %c.addr, align 8
  %40 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %41 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %42 = xor <4 x i32> %40, %41
  %43 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %42, <4 x i32> %42, <4 x i32> <i32 7, i32 7, i32 7, i32 7>)
  store <4 x i32> %43, <4 x i32>* %b.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = bitcast [16 x i32]* %arr.data to i8*
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %46, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %46 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 0
  store i32 0, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = getelementptr inbounds i32, i32* %48, i64 1
  store i32 0, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = getelementptr inbounds i32, i32* %48, i64 2
  store i32 0, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %52 = getelementptr inbounds i32, i32* %48, i64 3
  store i32 0, i32* %52, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = getelementptr inbounds i32, i32* %48, i64 4
  store i32 0, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = getelementptr inbounds i32, i32* %48, i64 5
  store i32 0, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = getelementptr inbounds i32, i32* %48, i64 6
  store i32 0, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = getelementptr inbounds i32, i32* %48, i64 7
  store i32 0, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = getelementptr inbounds i32, i32* %48, i64 8
  store i32 0, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = getelementptr inbounds i32, i32* %48, i64 9
  store i32 0, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = getelementptr inbounds i32, i32* %48, i64 10
  store i32 0, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %60 = getelementptr inbounds i32, i32* %48, i64 11
  store i32 0, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = getelementptr inbounds i32, i32* %48, i64 12
  store i32 0, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = getelementptr inbounds i32, i32* %48, i64 13
  store i32 0, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = getelementptr inbounds i32, i32* %48, i64 14
  store i32 0, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = getelementptr inbounds i32, i32* %48, i64 15
  store i32 0, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %65 = load <4 x i32>, <4 x i32>* %a.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 0
  %71 = bitcast i32* %70 to <4 x i32>*
  store <4 x i32> %65, <4 x i32>* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %72 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 4
  %78 = bitcast i32* %77 to <4 x i32>*
  store <4 x i32> %72, <4 x i32>* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i32*
  %84 = getelementptr inbounds i32, i32* %83, i64 8
  %85 = bitcast i32* %84 to <4 x i32>*
  store <4 x i32> %79, <4 x i32>* %85, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 12
  %92 = bitcast i32* %91 to <4 x i32>*
  store <4 x i32> %86, <4 x i32>* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 0, i32* %lane.addr, align 4
  %93 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %98 = load i32, i32* %lane.addr, align 4
  %99 = icmp slt i32 %98, 4
  br i1 %99, label %land.rhs, label %land.end

land.rhs:
  %100 = load i32, i32* %lane.addr, align 4
  %101 = add nsw i32 12, %100
  %102 = trunc i64 %95 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end

land.end:
  %104 = phi i1 [ false, %for.cond ], [ %103, %land.rhs ]
  br i1 %104, label %for.body, label %for.end

for.body:
  %105 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %106 = load i8*, i8** %105, align 8
  %107 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %108 = load i64, i64* %107, align 8
  %109 = load i32, i32* %lane.addr, align 4
  %110 = sext i32 %109 to i64
  %111 = bitcast i8* %97 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 %110
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %114 = zext i32 %113 to i64
  %115 = call i8* @nish_str_from_u64(i64 %114)
  %116 = call i8* @nish_str_concat(i8* %115, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %117 = load i32, i32* %lane.addr, align 4
  %118 = add nsw i32 4, %117
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %97 to i32*
  %121 = getelementptr inbounds i32, i32* %120, i64 %119
  %122 = load i32, i32* %121, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = zext i32 %122 to i64
  %124 = call i8* @nish_str_from_u64(i64 %123)
  %125 = call i8* @nish_str_concat(i8* %116, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %127 = load i32, i32* %lane.addr, align 4
  %128 = add nsw i32 8, %127
  %129 = sext i32 %128 to i64
  %130 = bitcast i8* %97 to i32*
  %131 = getelementptr inbounds i32, i32* %130, i64 %129
  %132 = load i32, i32* %131, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %133 = zext i32 %132 to i64
  %134 = call i8* @nish_str_from_u64(i64 %133)
  %135 = call i8* @nish_str_concat(i8* %126, i8* %134)
  %136 = call i8* @nish_str_concat(i8* %135, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %137 = load i32, i32* %lane.addr, align 4
  %138 = add nsw i32 12, %137
  %139 = sext i32 %138 to i64
  %140 = bitcast i8* %97 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 %139
  %142 = load i32, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = zext i32 %142 to i64
  %144 = call i8* @nish_str_from_u64(i64 %143)
  %145 = call i8* @nish_str_concat(i8* %136, i8* %144)
  call void @nish_print(i8* %145)
  %146 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %147 = load i8*, i8** %146, align 8
  %148 = icmp eq i8* %147, %106
  br i1 %148, label %pass.rewind, label %pass.free

pass.rewind:
  %149 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %108, i64* %149, align 8
  br label %pass.done

pass.free:
  %150 = ptrtoint i8* %106 to i64
  %151 = add i64 %150, %108
  call void @nish_arena_release(i64 %151)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %152 = load i32, i32* %lane.addr, align 4
  %153 = add nsw i32 %152, 1
  store i32 %153, i32* %lane.addr, align 4
  br label %for.cond

for.end:
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
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
