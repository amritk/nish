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
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare <4 x i32> @llvm.fshl.v4i32(<4 x i32>, <4 x i32>, <4 x i32>) #3

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
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = add i64 0, 4
  %70 = icmp ult i64 0, %68
  %71 = icmp ule i64 %69, %68
  %72 = and i1 %70, %71
  br i1 %72, label %bounds.ok, label %bounds.fail

bounds.fail:
  %73 = add i64 0, 3
  %74 = select i1 %70, i64 %73, i64 0
  call void @nish_panic_index(i64 %74, i64 %68)
  unreachable

bounds.ok:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 0
  %79 = bitcast i32* %78 to <4 x i32>*
  store <4 x i32> %65, <4 x i32>* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = load <4 x i32>, <4 x i32>* %b.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = add i64 4, 4
  %85 = icmp ult i64 4, %83
  %86 = icmp ule i64 %84, %83
  %87 = and i1 %85, %86
  br i1 %87, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  %88 = add i64 4, 3
  %89 = select i1 %85, i64 %88, i64 4
  call void @nish_panic_index(i64 %89, i64 %83)
  unreachable

bounds.ok.1:
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %92 = bitcast i8* %91 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 4
  %94 = bitcast i32* %93 to <4 x i32>*
  store <4 x i32> %80, <4 x i32>* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = load <4 x i32>, <4 x i32>* %c.addr, align 8
  %96 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = add i64 8, 4
  %100 = icmp ult i64 8, %98
  %101 = icmp ule i64 %99, %98
  %102 = and i1 %100, %101
  br i1 %102, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  %103 = add i64 8, 3
  %104 = select i1 %100, i64 %103, i64 8
  call void @nish_panic_index(i64 %104, i64 %98)
  unreachable

bounds.ok.2:
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %107 = bitcast i8* %106 to i32*
  %108 = getelementptr inbounds i32, i32* %107, i64 8
  %109 = bitcast i32* %108 to <4 x i32>*
  store <4 x i32> %95, <4 x i32>* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %110 = load <4 x i32>, <4 x i32>* %d.addr, align 8
  %111 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = add i64 12, 4
  %115 = icmp ult i64 12, %113
  %116 = icmp ule i64 %114, %113
  %117 = and i1 %115, %116
  br i1 %117, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  %118 = add i64 12, 3
  %119 = select i1 %115, i64 %118, i64 12
  call void @nish_panic_index(i64 %119, i64 %113)
  unreachable

bounds.ok.3:
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i32*
  %123 = getelementptr inbounds i32, i32* %122, i64 12
  %124 = bitcast i32* %123 to <4 x i32>*
  store <4 x i32> %110, <4 x i32>* %124, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 0, i32* %lane.addr, align 4
  %125 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %130 = load i32, i32* %lane.addr, align 4
  %131 = icmp slt i32 %130, 4
  br i1 %131, label %land.rhs, label %land.end

land.rhs:
  %132 = load i32, i32* %lane.addr, align 4
  %133 = add nsw i32 12, %132
  %134 = trunc i64 %127 to i32
  %135 = icmp slt i32 %133, %134
  br label %land.end

land.end:
  %136 = phi i1 [ false, %for.cond ], [ %135, %land.rhs ]
  br i1 %136, label %for.body, label %for.end

for.body:
  %137 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %138 = load i8*, i8** %137, align 8
  %139 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %140 = load i64, i64* %139, align 8
  %141 = load i32, i32* %lane.addr, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %129 to i32*
  %144 = getelementptr inbounds i32, i32* %143, i64 %142
  %145 = load i32, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %146 = zext i32 %145 to i64
  %147 = call i8* @nish_str_from_u64(i64 %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %149 = load i32, i32* %lane.addr, align 4
  %150 = add nsw i32 4, %149
  %151 = sext i32 %150 to i64
  %152 = bitcast i8* %129 to i32*
  %153 = getelementptr inbounds i32, i32* %152, i64 %151
  %154 = load i32, i32* %153, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %155 = zext i32 %154 to i64
  %156 = call i8* @nish_str_from_u64(i64 %155)
  %157 = call i8* @nish_str_concat(i8* %148, i8* %156)
  %158 = call i8* @nish_str_concat(i8* %157, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %159 = load i32, i32* %lane.addr, align 4
  %160 = add nsw i32 8, %159
  %161 = sext i32 %160 to i64
  %162 = bitcast i8* %129 to i32*
  %163 = getelementptr inbounds i32, i32* %162, i64 %161
  %164 = load i32, i32* %163, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %165 = zext i32 %164 to i64
  %166 = call i8* @nish_str_from_u64(i64 %165)
  %167 = call i8* @nish_str_concat(i8* %158, i8* %166)
  %168 = call i8* @nish_str_concat(i8* %167, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %169 = load i32, i32* %lane.addr, align 4
  %170 = add nsw i32 12, %169
  %171 = sext i32 %170 to i64
  %172 = bitcast i8* %129 to i32*
  %173 = getelementptr inbounds i32, i32* %172, i64 %171
  %174 = load i32, i32* %173, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %175 = zext i32 %174 to i64
  %176 = call i8* @nish_str_from_u64(i64 %175)
  %177 = call i8* @nish_str_concat(i8* %168, i8* %176)
  call void @nish_print(i8* %177)
  %178 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %179 = load i8*, i8** %178, align 8
  %180 = icmp eq i8* %179, %138
  br i1 %180, label %pass.rewind, label %pass.free

pass.rewind:
  %181 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %140, i64* %181, align 8
  br label %pass.done

pass.free:
  %182 = ptrtoint i8* %138 to i64
  %183 = add i64 %182, %140
  call void @nish_arena_release(i64 %183)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %184 = load i32, i32* %lane.addr, align 4
  %185 = add nsw i32 %184, 1
  store i32 %185, i32* %lane.addr, align 4
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
