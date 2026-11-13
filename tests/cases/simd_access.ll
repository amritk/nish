%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %b.addr = alloca <16 x i8>, align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %w.addr = alloca <4 x i32>, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 20
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = mul nsw i32 %6, 3
  %8 = trunc i32 %7 to i8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 1)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %10
  store i8 %8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = add i64 2, 16
  %26 = icmp ult i64 2, %24
  %27 = icmp ule i64 %25, %24
  %28 = and i1 %26, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  %29 = add i64 2, 15
  %30 = select i1 %26, i64 %29, i64 2
  call void @nish_panic_index(i64 %30, i64 %24)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 2
  %35 = bitcast i8* %34 to <16 x i8>*
  %36 = load <16 x i8>, <16 x i8>* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store <16 x i8> %36, <16 x i8>* %b.addr, align 8
  %37 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %38 = extractelement <16 x i8> %37, i32 0
  %39 = zext i8 %38 to i64
  %40 = call i8* @nish_str_from_u64(i64 %39)
  call void @nish_print(i8* %40)
  %41 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %42 = extractelement <16 x i8> %41, i32 15
  %43 = zext i8 %42 to i64
  %44 = call i8* @nish_str_from_u64(i64 %43)
  call void @nish_print(i8* %44)
  %45 = insertelement <16 x i8> undef, i8 1, i32 0
  %46 = insertelement <16 x i8> %45, i8 2, i32 1
  %47 = insertelement <16 x i8> %46, i8 3, i32 2
  %48 = insertelement <16 x i8> %47, i8 4, i32 3
  %49 = insertelement <16 x i8> %48, i8 5, i32 4
  %50 = insertelement <16 x i8> %49, i8 6, i32 5
  %51 = insertelement <16 x i8> %50, i8 7, i32 6
  %52 = insertelement <16 x i8> %51, i8 8, i32 7
  %53 = insertelement <16 x i8> %52, i8 9, i32 8
  %54 = insertelement <16 x i8> %53, i8 10, i32 9
  %55 = insertelement <16 x i8> %54, i8 11, i32 10
  %56 = insertelement <16 x i8> %55, i8 12, i32 11
  %57 = insertelement <16 x i8> %56, i8 13, i32 12
  %58 = insertelement <16 x i8> %57, i8 14, i32 13
  %59 = insertelement <16 x i8> %58, i8 15, i32 14
  %60 = insertelement <16 x i8> %59, i8 255, i32 15
  %61 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = add i64 4, 16
  %65 = icmp ult i64 4, %63
  %66 = icmp ule i64 %64, %63
  %67 = and i1 %65, %66
  br i1 %67, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  %68 = add i64 4, 15
  %69 = select i1 %65, i64 %68, i64 4
  call void @nish_panic_index(i64 %69, i64 %63)
  unreachable

bounds.ok.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i8*
  %73 = getelementptr inbounds i8, i8* %72, i64 4
  %74 = bitcast i8* %73 to <16 x i8>*
  store <16 x i8> %60, <16 x i8>* %74, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = bitcast i8* %77 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 3
  %80 = load i8, i8* %79, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = zext i8 %80 to i64
  %82 = call i8* @nish_str_from_u64(i64 %81)
  call void @nish_print(i8* %82)
  %83 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = bitcast i8* %85 to i8*
  %87 = getelementptr inbounds i8, i8* %86, i64 4
  %88 = load i8, i8* %87, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %89 = zext i8 %88 to i64
  %90 = call i8* @nish_str_from_u64(i64 %89)
  call void @nish_print(i8* %90)
  %91 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %93 to i8*
  %95 = getelementptr inbounds i8, i8* %94, i64 19
  %96 = load i8, i8* %95, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = zext i8 %96 to i64
  %98 = call i8* @nish_str_from_u64(i64 %97)
  call void @nish_print(i8* %98)
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = bitcast [6 x i32]* %arr.data to i8*
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %101, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %101 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 0
  store i32 1, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %105 = getelementptr inbounds i32, i32* %103, i64 1
  store i32 2, i32* %105, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %106 = getelementptr inbounds i32, i32* %103, i64 2
  store i32 3, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %107 = getelementptr inbounds i32, i32* %103, i64 3
  store i32 4, i32* %107, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %108 = getelementptr inbounds i32, i32* %103, i64 4
  store i32 5, i32* %108, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %109 = getelementptr inbounds i32, i32* %103, i64 5
  store i32 6, i32* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  %110 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to i32*
  %114 = getelementptr inbounds i32, i32* %113, i64 2
  %115 = bitcast i32* %114 to <4 x i32>*
  %116 = load <4 x i32>, <4 x i32>* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = insertelement <4 x i32> %116, i32 100, i32 3
  store <4 x i32> %117, <4 x i32>* %w.addr, align 8
  %118 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i32*
  %123 = getelementptr inbounds i32, i32* %122, i64 0
  %124 = bitcast i32* %123 to <4 x i32>*
  store <4 x i32> %118, <4 x i32>* %124, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %125 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %128 = bitcast i8* %127 to i32*
  %129 = getelementptr inbounds i32, i32* %128, i64 0
  %130 = load i32, i32* %129, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %131 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %134 = bitcast i8* %133 to i32*
  %135 = getelementptr inbounds i32, i32* %134, i64 3
  %136 = load i32, i32* %135, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %137 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %130, i32 %136)
  %138 = extractvalue { i32, i1 } %137, 0
  %139 = extractvalue { i32, i1 } %137, 1
  br i1 %139, label %ovf.fail, label %ovf.ok

ovf.ok:
  %140 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %143 = bitcast i8* %142 to i32*
  %144 = getelementptr inbounds i32, i32* %143, i64 5
  %145 = load i32, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %146 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %138, i32 %145)
  %147 = extractvalue { i32, i1 } %146, 0
  %148 = extractvalue { i32, i1 } %146, 1
  br i1 %148, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %149 = call i8* @nish_str_from_i32(i32 %147)
  call void @nish_print(i8* %149)
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %152 = bitcast [2 x double]* %arr.data.1 to i8*
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %152, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %154 = bitcast i8* %152 to double*
  %155 = getelementptr inbounds double, double* %154, i64 0
  store double 0x3FE0000000000000, double* %155, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %156 = getelementptr inbounds double, double* %154, i64 1
  store double 0x3FF8000000000000, double* %156, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %xs.addr, align 8
  %157 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %159 = load i8*, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %160 = bitcast i8* %159 to double*
  %161 = getelementptr inbounds double, double* %160, i64 0
  %162 = bitcast double* %161 to <2 x double>*
  %163 = load <2 x double>, <2 x double>* %162, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %164 = extractelement <2 x double> %163, i32 1
  %165 = call i8* @nish_str_from_f64(double %164)
  call void @nish_print(i8* %165)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
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

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element double", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
