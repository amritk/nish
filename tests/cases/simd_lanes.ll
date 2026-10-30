@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"NaN\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %b.addr = alloca <16 x i8>, align 8
  %h.addr = alloca <8 x i16>, align 8
  %w.addr = alloca <4 x i32>, align 8
  %u.addr = alloca <4 x i32>, align 8
  %f.addr = alloca <4 x float>, align 8
  %d.addr = alloca <2 x double>, align 8
  %zero.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %zero32.addr = alloca float, align 4
  %nan32.addr = alloca float, align 4
  %odd.addr = alloca <4 x float>, align 8
  %wide.addr = alloca <2 x double>, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = insertelement <16 x i8> undef, i8 1, i32 0
  %1 = insertelement <16 x i8> %0, i8 2, i32 1
  %2 = insertelement <16 x i8> %1, i8 3, i32 2
  %3 = insertelement <16 x i8> %2, i8 4, i32 3
  %4 = insertelement <16 x i8> %3, i8 5, i32 4
  %5 = insertelement <16 x i8> %4, i8 6, i32 5
  %6 = insertelement <16 x i8> %5, i8 7, i32 6
  %7 = insertelement <16 x i8> %6, i8 8, i32 7
  %8 = insertelement <16 x i8> %7, i8 9, i32 8
  %9 = insertelement <16 x i8> %8, i8 10, i32 9
  %10 = insertelement <16 x i8> %9, i8 11, i32 10
  %11 = insertelement <16 x i8> %10, i8 12, i32 11
  %12 = insertelement <16 x i8> %11, i8 13, i32 12
  %13 = insertelement <16 x i8> %12, i8 14, i32 13
  %14 = insertelement <16 x i8> %13, i8 15, i32 14
  %15 = insertelement <16 x i8> %14, i8 255, i32 15
  store <16 x i8> %15, <16 x i8>* %b.addr, align 8
  %16 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %17 = extractelement <16 x i8> %16, i32 15
  %18 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %19 = extractelement <16 x i8> %18, i32 0
  %20 = sub i8 %17, %19
  %21 = zext i8 %20 to i64
  %22 = call i8* @nish_str_from_u64(i64 %21)
  call void @nish_print(i8* %22)
  %23 = insertelement <8 x i16> undef, i16 1, i32 0
  %24 = insertelement <8 x i16> %23, i16 2, i32 1
  %25 = insertelement <8 x i16> %24, i16 3, i32 2
  %26 = insertelement <8 x i16> %25, i16 4, i32 3
  %27 = insertelement <8 x i16> %26, i16 5, i32 4
  %28 = insertelement <8 x i16> %27, i16 6, i32 5
  %29 = insertelement <8 x i16> %28, i16 7, i32 6
  %30 = insertelement <8 x i16> %29, i16 8, i32 7
  %31 = insertelement <8 x i16> %30, i16 65535, i32 7
  store <8 x i16> %31, <8 x i16>* %h.addr, align 8
  %32 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %33 = extractelement <8 x i16> %32, i32 7
  %34 = zext i16 %33 to i64
  %35 = call i8* @nish_str_from_u64(i64 %34)
  call void @nish_print(i8* %35)
  %36 = insertelement <4 x i32> undef, i32 -1, i32 0
  %37 = insertelement <4 x i32> %36, i32 2, i32 1
  %38 = insertelement <4 x i32> %37, i32 -3, i32 2
  %39 = insertelement <4 x i32> %38, i32 4, i32 3
  store <4 x i32> %39, <4 x i32>* %w.addr, align 8
  %40 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %41 = extractelement <4 x i32> %40, i32 2
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %43 = insertelement <4 x i32> undef, i32 1, i32 0
  %44 = insertelement <4 x i32> %43, i32 2, i32 1
  %45 = insertelement <4 x i32> %44, i32 3, i32 2
  %46 = insertelement <4 x i32> %45, i32 4000000000, i32 3
  store <4 x i32> %46, <4 x i32>* %u.addr, align 8
  %47 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %48 = extractelement <4 x i32> %47, i32 3
  %49 = zext i32 %48 to i64
  %50 = call i8* @nish_str_from_u64(i64 %49)
  call void @nish_print(i8* %50)
  %51 = insertelement <4 x float> undef, float 0x3FF8000000000000, i32 0
  %52 = insertelement <4 x float> %51, float 0x4004000000000000, i32 1
  %53 = insertelement <4 x float> %52, float 0x400C000000000000, i32 2
  %54 = insertelement <4 x float> %53, float 0x4012000000000000, i32 3
  %55 = insertelement <4 x float> %54, float 0x3FE0000000000000, i32 0
  store <4 x float> %55, <4 x float>* %f.addr, align 8
  %56 = load <4 x float>, <4 x float>* %f.addr, align 8
  %57 = extractelement <4 x float> %56, i32 0
  %58 = load <4 x float>, <4 x float>* %f.addr, align 8
  %59 = extractelement <4 x float> %58, i32 3
  %60 = fadd float %57, %59
  %61 = fpext float %60 to double
  %62 = call i8* @nish_str_from_f64(double %61)
  call void @nish_print(i8* %62)
  %63 = insertelement <2 x double> undef, double 0x3FD0000000000000, i32 0
  %64 = insertelement <2 x double> %63, double 0x3FC0000000000000, i32 1
  store <2 x double> %64, <2 x double>* %d.addr, align 8
  %65 = load <2 x double>, <2 x double>* %d.addr, align 8
  %66 = extractelement <2 x double> %65, i32 1
  %67 = call i8* @nish_str_from_f64(double %66)
  call void @nish_print(i8* %67)
  %68 = insertelement <16 x i8> undef, i8 200, i32 0
  %69 = shufflevector <16 x i8> %68, <16 x i8> undef, <16 x i32> zeroinitializer
  %70 = extractelement <16 x i8> %69, i32 9
  %71 = zext i8 %70 to i64
  %72 = call i8* @nish_str_from_u64(i64 %71)
  call void @nish_print(i8* %72)
  %73 = insertelement <8 x i16> undef, i16 300, i32 0
  %74 = shufflevector <8 x i16> %73, <8 x i16> undef, <8 x i32> zeroinitializer
  %75 = extractelement <8 x i16> %74, i32 5
  %76 = zext i16 %75 to i64
  %77 = call i8* @nish_str_from_u64(i64 %76)
  call void @nish_print(i8* %77)
  %78 = insertelement <4 x i32> undef, i32 -7, i32 0
  %79 = shufflevector <4 x i32> %78, <4 x i32> undef, <4 x i32> zeroinitializer
  %80 = extractelement <4 x i32> %79, i32 3
  %81 = call i8* @nish_str_from_i32(i32 %80)
  call void @nish_print(i8* %81)
  %82 = insertelement <4 x i32> undef, i32 7, i32 0
  %83 = shufflevector <4 x i32> %82, <4 x i32> undef, <4 x i32> zeroinitializer
  %84 = extractelement <4 x i32> %83, i32 0
  %85 = zext i32 %84 to i64
  %86 = call i8* @nish_str_from_u64(i64 %85)
  call void @nish_print(i8* %86)
  %87 = insertelement <4 x float> undef, float 0x4004000000000000, i32 0
  %88 = shufflevector <4 x float> %87, <4 x float> undef, <4 x i32> zeroinitializer
  %89 = extractelement <4 x float> %88, i32 1
  %90 = fpext float %89 to double
  %91 = call i8* @nish_str_from_f64(double %90)
  call void @nish_print(i8* %91)
  %92 = fneg double 0x3FE0000000000000
  %93 = insertelement <2 x double> undef, double %92, i32 0
  %94 = shufflevector <2 x double> %93, <2 x double> undef, <2 x i32> zeroinitializer
  %95 = extractelement <2 x double> %94, i32 0
  %96 = call i8* @nish_str_from_f64(double %95)
  call void @nish_print(i8* %96)
  store double 0x0000000000000000, double* %zero.addr, align 8
  %97 = call double @nish_parse_number(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i32 0)
  store double %97, double* %nan.addr, align 8
  store float 0x0000000000000000, float* %zero32.addr, align 4
  %98 = load double, double* %nan.addr, align 8
  %99 = fptrunc double %98 to float
  store float %99, float* %nan32.addr, align 4
  %100 = load float, float* %nan32.addr, align 4
  %101 = insertelement <4 x float> undef, float %100, i32 0
  %102 = load float, float* %zero32.addr, align 4
  %103 = fneg float %102
  %104 = insertelement <4 x float> %101, float %103, i32 1
  %105 = insertelement <4 x float> %104, float 0x3FB99999A0000000, i32 2
  %106 = insertelement <4 x float> %105, float 0x3FF0000000000000, i32 3
  %107 = load float, float* %zero32.addr, align 4
  %108 = fneg float %107
  %109 = insertelement <4 x float> %106, float %108, i32 3
  store <4 x float> %109, <4 x float>* %odd.addr, align 8
  %110 = load <4 x float>, <4 x float>* %odd.addr, align 8
  %111 = extractelement <4 x float> %110, i32 0
  %112 = bitcast float %111 to i32
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %115 = load <4 x float>, <4 x float>* %odd.addr, align 8
  %116 = extractelement <4 x float> %115, i32 1
  %117 = bitcast float %116 to i32
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %114, i8* %118)
  %120 = call i8* @nish_str_concat(i8* %119, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %121 = load <4 x float>, <4 x float>* %odd.addr, align 8
  %122 = extractelement <4 x float> %121, i32 2
  %123 = bitcast float %122 to i32
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %120, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %127 = load <4 x float>, <4 x float>* %odd.addr, align 8
  %128 = extractelement <4 x float> %127, i32 3
  %129 = bitcast float %128 to i32
  %130 = call i8* @nish_str_from_i32(i32 %129)
  %131 = call i8* @nish_str_concat(i8* %126, i8* %130)
  call void @nish_print(i8* %131)
  %132 = insertelement <2 x double> undef, double 0x3FB999999999999A, i32 0
  %133 = load double, double* %zero.addr, align 8
  %134 = fneg double %133
  %135 = insertelement <2 x double> %132, double %134, i32 1
  %136 = load double, double* %nan.addr, align 8
  %137 = insertelement <2 x double> %135, double %136, i32 0
  store <2 x double> %137, <2 x double>* %wide.addr, align 8
  %138 = load <2 x double>, <2 x double>* %wide.addr, align 8
  %139 = extractelement <2 x double> %138, i32 0
  %140 = bitcast double %139 to i64
  %141 = call i8* @nish_str_from_i64(i64 %140)
  %142 = call i8* @nish_str_concat(i8* %141, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %143 = load <2 x double>, <2 x double>* %wide.addr, align 8
  %144 = extractelement <2 x double> %143, i32 1
  %145 = bitcast double %144 to i64
  %146 = call i8* @nish_str_from_i64(i64 %145)
  %147 = call i8* @nish_str_concat(i8* %142, i8* %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %149 = insertelement <2 x double> undef, double 0x3FB999999999999A, i32 0
  %150 = shufflevector <2 x double> %149, <2 x double> undef, <2 x i32> zeroinitializer
  %151 = extractelement <2 x double> %150, i32 1
  %152 = bitcast double %151 to i64
  %153 = call i8* @nish_str_from_i64(i64 %152)
  %154 = call i8* @nish_str_concat(i8* %148, i8* %153)
  call void @nish_print(i8* %154)
  %155 = load float, float* %nan32.addr, align 4
  %156 = insertelement <4 x float> undef, float %155, i32 0
  %157 = shufflevector <4 x float> %156, <4 x float> undef, <4 x i32> zeroinitializer
  %158 = extractelement <4 x float> %157, i32 2
  %159 = bitcast float %158 to i32
  %160 = call i8* @nish_str_from_i32(i32 %159)
  %161 = call i8* @nish_str_concat(i8* %160, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %162 = load float, float* %zero32.addr, align 4
  %163 = fneg float %162
  %164 = insertelement <4 x float> undef, float %163, i32 0
  %165 = shufflevector <4 x float> %164, <4 x float> undef, <4 x i32> zeroinitializer
  %166 = extractelement <4 x float> %165, i32 0
  %167 = bitcast float %166 to i32
  %168 = call i8* @nish_str_from_i32(i32 %167)
  %169 = call i8* @nish_str_concat(i8* %161, i8* %168)
  call void @nish_print(i8* %169)
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

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
