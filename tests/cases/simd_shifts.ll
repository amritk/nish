@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare <16 x i8> @llvm.fshl.v16i8(<16 x i8>, <16 x i8>, <16 x i8>) #2
declare <16 x i8> @llvm.fshr.v16i8(<16 x i8>, <16 x i8>, <16 x i8>) #2
declare <8 x i16> @llvm.fshl.v8i16(<8 x i16>, <8 x i16>, <8 x i16>) #2
declare <8 x i16> @llvm.fshr.v8i16(<8 x i16>, <8 x i16>, <8 x i16>) #2
declare <4 x i32> @llvm.fshl.v4i32(<4 x i32>, <4 x i32>, <4 x i32>) #2
declare <4 x i32> @llvm.fshr.v4i32(<4 x i32>, <4 x i32>, <4 x i32>) #2

define noundef i32 @nish_main() #0 {
entry:
  %u.addr = alloca <4 x i32>, align 8
  %i.addr = alloca <4 x i32>, align 8
  %h.addr = alloca <8 x i16>, align 8
  %b.addr = alloca <16 x i8>, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = insertelement <4 x i32> undef, i32 1, i32 0
  %1 = insertelement <4 x i32> %0, i32 2147483649, i32 1
  %2 = insertelement <4 x i32> %1, i32 3735928559, i32 2
  %3 = insertelement <4 x i32> %2, i32 305419896, i32 3
  store <4 x i32> %3, <4 x i32>* %u.addr, align 8
  %4 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %5 = shl <4 x i32> %4, <i32 4, i32 4, i32 4, i32 4>
  %6 = extractelement <4 x i32> %5, i32 1
  %7 = zext i32 %6 to i64
  %8 = call i8* @nish_str_from_u64(i64 %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %11 = lshr <4 x i32> %10, <i32 4, i32 4, i32 4, i32 4>
  %12 = extractelement <4 x i32> %11, i32 1
  %13 = zext i32 %12 to i64
  %14 = call i8* @nish_str_from_u64(i64 %13)
  %15 = call i8* @nish_str_concat(i8* %9, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %18 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %17, <4 x i32> %17, <4 x i32> <i32 4, i32 4, i32 4, i32 4>)
  %19 = extractelement <4 x i32> %18, i32 1
  %20 = zext i32 %19 to i64
  %21 = call i8* @nish_str_from_u64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %16, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %24 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %25 = call <4 x i32> @llvm.fshr.v4i32(<4 x i32> %24, <4 x i32> %24, <4 x i32> <i32 4, i32 4, i32 4, i32 4>)
  %26 = extractelement <4 x i32> %25, i32 1
  %27 = zext i32 %26 to i64
  %28 = call i8* @nish_str_from_u64(i64 %27)
  %29 = call i8* @nish_str_concat(i8* %23, i8* %28)
  call void @nish_print(i8* %29)
  %30 = insertelement <4 x i32> undef, i32 -16, i32 0
  %31 = insertelement <4 x i32> %30, i32 16, i32 1
  %32 = insertelement <4 x i32> %31, i32 -1, i32 2
  %33 = insertelement <4 x i32> %32, i32 1073741824, i32 3
  store <4 x i32> %33, <4 x i32>* %i.addr, align 8
  %34 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %35 = ashr <4 x i32> %34, <i32 2, i32 2, i32 2, i32 2>
  %36 = extractelement <4 x i32> %35, i32 0
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %40 = ashr <4 x i32> %39, <i32 31, i32 31, i32 31, i32 31>
  %41 = extractelement <4 x i32> %40, i32 2
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %38, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %46 = shl <4 x i32> %45, <i32 1, i32 1, i32 1, i32 1>
  %47 = extractelement <4 x i32> %46, i32 3
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %44, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %51 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %52 = call <4 x i32> @llvm.fshl.v4i32(<4 x i32> %51, <4 x i32> %51, <4 x i32> <i32 1, i32 1, i32 1, i32 1>)
  %53 = extractelement <4 x i32> %52, i32 0
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %50, i8* %54)
  call void @nish_print(i8* %55)
  %56 = insertelement <8 x i16> undef, i16 1, i32 0
  %57 = insertelement <8 x i16> %56, i16 32769, i32 1
  %58 = insertelement <8 x i16> %57, i16 3, i32 2
  %59 = insertelement <8 x i16> %58, i16 4, i32 3
  %60 = insertelement <8 x i16> %59, i16 5, i32 4
  %61 = insertelement <8 x i16> %60, i16 6, i32 5
  %62 = insertelement <8 x i16> %61, i16 7, i32 6
  %63 = insertelement <8 x i16> %62, i16 65535, i32 7
  store <8 x i16> %63, <8 x i16>* %h.addr, align 8
  %64 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %65 = call <8 x i16> @llvm.fshl.v8i16(<8 x i16> %64, <8 x i16> %64, <8 x i16> <i16 1, i16 1, i16 1, i16 1, i16 1, i16 1, i16 1, i16 1>)
  %66 = extractelement <8 x i16> %65, i32 1
  %67 = zext i16 %66 to i64
  %68 = call i8* @nish_str_from_u64(i64 %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %70 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %71 = lshr <8 x i16> %70, <i16 15, i16 15, i16 15, i16 15, i16 15, i16 15, i16 15, i16 15>
  %72 = extractelement <8 x i16> %71, i32 7
  %73 = zext i16 %72 to i64
  %74 = call i8* @nish_str_from_u64(i64 %73)
  %75 = call i8* @nish_str_concat(i8* %69, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %77 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %78 = shl <8 x i16> %77, <i16 15, i16 15, i16 15, i16 15, i16 15, i16 15, i16 15, i16 15>
  %79 = extractelement <8 x i16> %78, i32 0
  %80 = zext i16 %79 to i64
  %81 = call i8* @nish_str_from_u64(i64 %80)
  %82 = call i8* @nish_str_concat(i8* %76, i8* %81)
  %83 = call i8* @nish_str_concat(i8* %82, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %84 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %85 = call <8 x i16> @llvm.fshr.v8i16(<8 x i16> %84, <8 x i16> %84, <8 x i16> <i16 3, i16 3, i16 3, i16 3, i16 3, i16 3, i16 3, i16 3>)
  %86 = extractelement <8 x i16> %85, i32 7
  %87 = zext i16 %86 to i64
  %88 = call i8* @nish_str_from_u64(i64 %87)
  %89 = call i8* @nish_str_concat(i8* %83, i8* %88)
  call void @nish_print(i8* %89)
  %90 = insertelement <16 x i8> undef, i8 1, i32 0
  %91 = insertelement <16 x i8> %90, i8 129, i32 1
  %92 = insertelement <16 x i8> %91, i8 3, i32 2
  %93 = insertelement <16 x i8> %92, i8 4, i32 3
  %94 = insertelement <16 x i8> %93, i8 5, i32 4
  %95 = insertelement <16 x i8> %94, i8 6, i32 5
  %96 = insertelement <16 x i8> %95, i8 7, i32 6
  %97 = insertelement <16 x i8> %96, i8 8, i32 7
  %98 = insertelement <16 x i8> %97, i8 9, i32 8
  %99 = insertelement <16 x i8> %98, i8 10, i32 9
  %100 = insertelement <16 x i8> %99, i8 11, i32 10
  %101 = insertelement <16 x i8> %100, i8 12, i32 11
  %102 = insertelement <16 x i8> %101, i8 13, i32 12
  %103 = insertelement <16 x i8> %102, i8 14, i32 13
  %104 = insertelement <16 x i8> %103, i8 15, i32 14
  %105 = insertelement <16 x i8> %104, i8 255, i32 15
  store <16 x i8> %105, <16 x i8>* %b.addr, align 8
  %106 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %107 = call <16 x i8> @llvm.fshl.v16i8(<16 x i8> %106, <16 x i8> %106, <16 x i8> <i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7>)
  %108 = extractelement <16 x i8> %107, i32 1
  %109 = zext i8 %108 to i64
  %110 = call i8* @nish_str_from_u64(i64 %109)
  %111 = call i8* @nish_str_concat(i8* %110, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %112 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %113 = lshr <16 x i8> %112, <i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7, i8 7>
  %114 = extractelement <16 x i8> %113, i32 15
  %115 = zext i8 %114 to i64
  %116 = call i8* @nish_str_from_u64(i64 %115)
  %117 = call i8* @nish_str_concat(i8* %111, i8* %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %119 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %120 = shl <16 x i8> %119, <i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0, i8 0>
  %121 = extractelement <16 x i8> %120, i32 2
  %122 = zext i8 %121 to i64
  %123 = call i8* @nish_str_from_u64(i64 %122)
  %124 = call i8* @nish_str_concat(i8* %118, i8* %123)
  %125 = call i8* @nish_str_concat(i8* %124, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %126 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %127 = call <16 x i8> @llvm.fshr.v16i8(<16 x i8> %126, <16 x i8> %126, <16 x i8> <i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1, i8 1>)
  %128 = extractelement <16 x i8> %127, i32 0
  %129 = zext i8 %128 to i64
  %130 = call i8* @nish_str_from_u64(i64 %129)
  %131 = call i8* @nish_str_concat(i8* %125, i8* %130)
  call void @nish_print(i8* %131)
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

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
