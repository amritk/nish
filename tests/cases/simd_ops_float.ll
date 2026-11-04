@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"NaN\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare <4 x float> @llvm.fabs.v4f32(<4 x float>) #2
declare <4 x float> @llvm.sqrt.v4f32(<4 x float>) #2
declare <4 x float> @llvm.minimum.v4f32(<4 x float>, <4 x float>) #2
declare <4 x float> @llvm.maximum.v4f32(<4 x float>, <4 x float>) #2
declare float @llvm.vector.reduce.fadd.v4f32(float, <4 x float>) #2
declare <2 x double> @llvm.sqrt.v2f64(<2 x double>) #2
declare double @llvm.vector.reduce.fadd.v2f64(double, <2 x double>) #2
declare i1 @llvm.vector.reduce.or.v4i1(<4 x i1>) #2
declare i1 @llvm.vector.reduce.and.v4i1(<4 x i1>) #2

define internal noundef nonnull align 8 i8* @bits4(<4 x float> noundef %v) #0 {
entry:
  %0 = extractelement <4 x float> %v, i32 0
  %1 = bitcast float %0 to i32
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = extractelement <4 x float> %v, i32 1
  %5 = bitcast float %4 to i32
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = extractelement <4 x float> %v, i32 2
  %10 = bitcast float %9 to i32
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = extractelement <4 x float> %v, i32 3
  %15 = bitcast float %14 to i32
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  ret i8* %17
}

define internal noundef nonnull align 8 i8* @bits2(<2 x double> noundef %v) #0 {
entry:
  %0 = extractelement <2 x double> %v, i32 0
  %1 = bitcast double %0 to i64
  %2 = call i8* @nish_str_from_i64(i64 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = extractelement <2 x double> %v, i32 1
  %5 = bitcast double %4 to i64
  %6 = call i8* @nish_str_from_i64(i64 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  ret i8* %7
}

define noundef i32 @nish_main() #0 {
entry:
  %zero32.addr = alloca float, align 4
  %nan32.addr = alloca float, align 4
  %tiny.addr = alloca float, align 4
  %a.addr = alloca <4 x float>, align 8
  %b.addr = alloca <4 x float>, align 8
  %m.addr = alloca <4 x float>, align 8
  %c.addr = alloca <2 x double>, align 8
  %d.addr = alloca <2 x double>, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store float 0x0000000000000000, float* %zero32.addr, align 4
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i32 0)
  %1 = fptrunc double %0 to float
  store float %1, float* %nan32.addr, align 4
  store float 0x36A0000000000000, float* %tiny.addr, align 4
  %2 = insertelement <4 x float> undef, float 0x3FB99999A0000000, i32 0
  %3 = insertelement <4 x float> %2, float 0x3FF8000000000000, i32 1
  %4 = fneg float 0x4002000000000000
  %5 = insertelement <4 x float> %3, float %4, i32 2
  %6 = insertelement <4 x float> %5, float 0x4008000000000000, i32 3
  store <4 x float> %6, <4 x float>* %a.addr, align 8
  %7 = insertelement <4 x float> undef, float 0x3FC99999A0000000, i32 0
  %8 = fneg float 0x3FE0000000000000
  %9 = insertelement <4 x float> %7, float %8, i32 1
  %10 = insertelement <4 x float> %9, float 0x4010000000000000, i32 2
  %11 = insertelement <4 x float> %10, float 0x0000000000000000, i32 3
  store <4 x float> %11, <4 x float>* %b.addr, align 8
  %12 = load <4 x float>, <4 x float>* %a.addr, align 8
  %13 = load <4 x float>, <4 x float>* %b.addr, align 8
  %14 = fadd <4 x float> %12, %13
  %15 = call i64 @nish_arena_mark()
  %16 = call i8* @bits4(<4 x float> %14)
  %17 = call i8* @nish_arena_keep(i64 %15, i8* %16)
  call void @nish_print(i8* %17)
  %18 = load <4 x float>, <4 x float>* %a.addr, align 8
  %19 = load <4 x float>, <4 x float>* %b.addr, align 8
  %20 = fsub <4 x float> %18, %19
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @bits4(<4 x float> %20)
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  call void @nish_print(i8* %23)
  %24 = load <4 x float>, <4 x float>* %a.addr, align 8
  %25 = load <4 x float>, <4 x float>* %b.addr, align 8
  %26 = fmul <4 x float> %24, %25
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @bits4(<4 x float> %26)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  call void @nish_print(i8* %29)
  %30 = load <4 x float>, <4 x float>* %a.addr, align 8
  %31 = load <4 x float>, <4 x float>* %b.addr, align 8
  %32 = fdiv <4 x float> %30, %31
  %33 = call i64 @nish_arena_mark()
  %34 = call i8* @bits4(<4 x float> %32)
  %35 = call i8* @nish_arena_keep(i64 %33, i8* %34)
  call void @nish_print(i8* %35)
  %36 = insertelement <4 x float> undef, float 0x0000000000000000, i32 0
  %37 = load float, float* %zero32.addr, align 4
  %38 = fneg float %37
  %39 = insertelement <4 x float> %36, float %38, i32 1
  %40 = insertelement <4 x float> %39, float 0x3FF0000000000000, i32 2
  %41 = fneg float 0x4000000000000000
  %42 = insertelement <4 x float> %40, float %41, i32 3
  %43 = fneg <4 x float> %42
  %44 = call i64 @nish_arena_mark()
  %45 = call i8* @bits4(<4 x float> %43)
  %46 = call i8* @nish_arena_keep(i64 %44, i8* %45)
  call void @nish_print(i8* %46)
  %47 = load float, float* %zero32.addr, align 4
  %48 = fneg float %47
  %49 = insertelement <4 x float> undef, float %48, i32 0
  %50 = fneg float 0x3FF8000000000000
  %51 = insertelement <4 x float> %49, float %50, i32 1
  %52 = insertelement <4 x float> %51, float 0x4000000000000000, i32 2
  %53 = fneg float 0x4008000000000000
  %54 = insertelement <4 x float> %52, float %53, i32 3
  %55 = call <4 x float> @llvm.fabs.v4f32(<4 x float> %54)
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @bits4(<4 x float> %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  call void @nish_print(i8* %58)
  %59 = insertelement <4 x float> undef, float 0x4010000000000000, i32 0
  %60 = insertelement <4 x float> %59, float 0x4000000000000000, i32 1
  %61 = insertelement <4 x float> %60, float 0x0000000000000000, i32 2
  %62 = load float, float* %zero32.addr, align 4
  %63 = fneg float %62
  %64 = insertelement <4 x float> %61, float %63, i32 3
  %65 = call <4 x float> @llvm.sqrt.v4f32(<4 x float> %64)
  %66 = call i64 @nish_arena_mark()
  %67 = call i8* @bits4(<4 x float> %65)
  %68 = call i8* @nish_arena_keep(i64 %66, i8* %67)
  call void @nish_print(i8* %68)
  %69 = load float, float* %zero32.addr, align 4
  %70 = fneg float %69
  %71 = insertelement <4 x float> undef, float %70, i32 0
  %72 = insertelement <4 x float> %71, float 0x3FF0000000000000, i32 1
  %73 = insertelement <4 x float> %72, float 0x4000000000000000, i32 2
  %74 = load float, float* %tiny.addr, align 4
  %75 = insertelement <4 x float> %73, float %74, i32 3
  %76 = insertelement <4 x float> undef, float 0x0000000000000000, i32 0
  %77 = fneg float 0x3FF0000000000000
  %78 = insertelement <4 x float> %76, float %77, i32 1
  %79 = insertelement <4 x float> %78, float 0x4000000000000000, i32 2
  %80 = insertelement <4 x float> %79, float 0x0000000000000000, i32 3
  %81 = call <4 x float> @llvm.minimum.v4f32(<4 x float> %75, <4 x float> %80)
  %82 = call i64 @nish_arena_mark()
  %83 = call i8* @bits4(<4 x float> %81)
  %84 = call i8* @nish_arena_keep(i64 %82, i8* %83)
  call void @nish_print(i8* %84)
  %85 = load float, float* %zero32.addr, align 4
  %86 = fneg float %85
  %87 = insertelement <4 x float> undef, float %86, i32 0
  %88 = insertelement <4 x float> %87, float 0x3FF0000000000000, i32 1
  %89 = insertelement <4 x float> %88, float 0x4000000000000000, i32 2
  %90 = load float, float* %tiny.addr, align 4
  %91 = insertelement <4 x float> %89, float %90, i32 3
  %92 = insertelement <4 x float> undef, float 0x0000000000000000, i32 0
  %93 = fneg float 0x3FF0000000000000
  %94 = insertelement <4 x float> %92, float %93, i32 1
  %95 = insertelement <4 x float> %94, float 0x4000000000000000, i32 2
  %96 = insertelement <4 x float> %95, float 0x0000000000000000, i32 3
  %97 = call <4 x float> @llvm.maximum.v4f32(<4 x float> %91, <4 x float> %96)
  %98 = call i64 @nish_arena_mark()
  %99 = call i8* @bits4(<4 x float> %97)
  %100 = call i8* @nish_arena_keep(i64 %98, i8* %99)
  call void @nish_print(i8* %100)
  %101 = load float, float* %nan32.addr, align 4
  %102 = insertelement <4 x float> undef, float %101, i32 0
  %103 = insertelement <4 x float> %102, float 0x3FF0000000000000, i32 1
  %104 = insertelement <4 x float> %103, float 0x4000000000000000, i32 2
  %105 = insertelement <4 x float> %104, float 0x4008000000000000, i32 3
  %106 = insertelement <4 x float> undef, float 0x0000000000000000, i32 0
  %107 = shufflevector <4 x float> %106, <4 x float> undef, <4 x i32> zeroinitializer
  %108 = call <4 x float> @llvm.minimum.v4f32(<4 x float> %105, <4 x float> %107)
  store <4 x float> %108, <4 x float>* %m.addr, align 8
  %109 = load <4 x float>, <4 x float>* %m.addr, align 8
  %110 = extractelement <4 x float> %109, i32 0
  %111 = load <4 x float>, <4 x float>* %m.addr, align 8
  %112 = extractelement <4 x float> %111, i32 0
  %113 = fcmp une float %110, %112
  %114 = select i1 %113, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %114)
  %115 = insertelement <4 x float> undef, float 0x3FB99999A0000000, i32 0
  %116 = insertelement <4 x float> %115, float 0x3FC99999A0000000, i32 1
  %117 = insertelement <4 x float> %116, float 0x3FD3333340000000, i32 2
  %118 = insertelement <4 x float> %117, float 0x416312D000000000, i32 3
  %119 = call float @llvm.vector.reduce.fadd.v4f32(float -0.000000e+00, <4 x float> %118)
  %120 = bitcast float %119 to i32
  %121 = call i8* @nish_str_from_i32(i32 %120)
  call void @nish_print(i8* %121)
  %122 = load float, float* %zero32.addr, align 4
  %123 = fneg float %122
  %124 = insertelement <4 x float> undef, float %123, i32 0
  %125 = shufflevector <4 x float> %124, <4 x float> undef, <4 x i32> zeroinitializer
  %126 = call float @llvm.vector.reduce.fadd.v4f32(float -0.000000e+00, <4 x float> %125)
  %127 = bitcast float %126 to i32
  %128 = call i8* @nish_str_from_i32(i32 %127)
  call void @nish_print(i8* %128)
  %129 = load <4 x float>, <4 x float>* %a.addr, align 8
  %130 = load <4 x float>, <4 x float>* %b.addr, align 8
  %131 = fcmp olt <4 x float> %129, %130
  %132 = bitcast <4 x i1> %131 to i4
  %133 = zext i4 %132 to i32
  %134 = call i8* @nish_str_from_i32(i32 %133)
  call void @nish_print(i8* %134)
  %135 = load <4 x float>, <4 x float>* %a.addr, align 8
  %136 = load <4 x float>, <4 x float>* %a.addr, align 8
  %137 = fcmp ole <4 x float> %135, %136
  %138 = bitcast <4 x i1> %137 to i4
  %139 = zext i4 %138 to i32
  %140 = call i8* @nish_str_from_i32(i32 %139)
  call void @nish_print(i8* %140)
  %141 = load <4 x float>, <4 x float>* %a.addr, align 8
  %142 = load <4 x float>, <4 x float>* %b.addr, align 8
  %143 = fcmp ogt <4 x float> %141, %142
  %144 = bitcast <4 x i1> %143 to i4
  %145 = zext i4 %144 to i32
  %146 = call i8* @nish_str_from_i32(i32 %145)
  call void @nish_print(i8* %146)
  %147 = load <4 x float>, <4 x float>* %a.addr, align 8
  %148 = load <4 x float>, <4 x float>* %b.addr, align 8
  %149 = fcmp oge <4 x float> %147, %148
  %150 = bitcast <4 x i1> %149 to i4
  %151 = zext i4 %150 to i32
  %152 = call i8* @nish_str_from_i32(i32 %151)
  call void @nish_print(i8* %152)
  %153 = load float, float* %nan32.addr, align 4
  %154 = insertelement <4 x float> undef, float %153, i32 0
  %155 = load float, float* %zero32.addr, align 4
  %156 = fneg float %155
  %157 = insertelement <4 x float> %154, float %156, i32 1
  %158 = insertelement <4 x float> %157, float 0x3FF0000000000000, i32 2
  %159 = insertelement <4 x float> %158, float 0x4000000000000000, i32 3
  %160 = load float, float* %nan32.addr, align 4
  %161 = insertelement <4 x float> undef, float %160, i32 0
  %162 = insertelement <4 x float> %161, float 0x0000000000000000, i32 1
  %163 = insertelement <4 x float> %162, float 0x3FF0000000000000, i32 2
  %164 = insertelement <4 x float> %163, float 0x4008000000000000, i32 3
  %165 = fcmp oeq <4 x float> %159, %164
  %166 = bitcast <4 x i1> %165 to i4
  %167 = zext i4 %166 to i32
  %168 = call i8* @nish_str_from_i32(i32 %167)
  call void @nish_print(i8* %168)
  %169 = load float, float* %nan32.addr, align 4
  %170 = insertelement <4 x float> undef, float %169, i32 0
  %171 = load float, float* %zero32.addr, align 4
  %172 = fneg float %171
  %173 = insertelement <4 x float> %170, float %172, i32 1
  %174 = insertelement <4 x float> %173, float 0x3FF0000000000000, i32 2
  %175 = insertelement <4 x float> %174, float 0x4000000000000000, i32 3
  %176 = load float, float* %nan32.addr, align 4
  %177 = insertelement <4 x float> undef, float %176, i32 0
  %178 = insertelement <4 x float> %177, float 0x0000000000000000, i32 1
  %179 = insertelement <4 x float> %178, float 0x3FF0000000000000, i32 2
  %180 = insertelement <4 x float> %179, float 0x4008000000000000, i32 3
  %181 = fcmp une <4 x float> %175, %180
  %182 = bitcast <4 x i1> %181 to i4
  %183 = zext i4 %182 to i32
  %184 = call i8* @nish_str_from_i32(i32 %183)
  call void @nish_print(i8* %184)
  %185 = load <4 x float>, <4 x float>* %a.addr, align 8
  %186 = load <4 x float>, <4 x float>* %b.addr, align 8
  %187 = fcmp olt <4 x float> %185, %186
  %188 = call i1 @llvm.vector.reduce.or.v4i1(<4 x i1> %187)
  %189 = select i1 %188, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %190 = call i8* @nish_str_concat(i8* %189, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %191 = load <4 x float>, <4 x float>* %a.addr, align 8
  %192 = load <4 x float>, <4 x float>* %b.addr, align 8
  %193 = fcmp olt <4 x float> %191, %192
  %194 = call i1 @llvm.vector.reduce.and.v4i1(<4 x i1> %193)
  %195 = select i1 %194, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %196 = call i8* @nish_str_concat(i8* %190, i8* %195)
  %197 = call i8* @nish_str_concat(i8* %196, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %198 = load <4 x float>, <4 x float>* %a.addr, align 8
  %199 = load <4 x float>, <4 x float>* %a.addr, align 8
  %200 = fcmp oeq <4 x float> %198, %199
  %201 = call i1 @llvm.vector.reduce.and.v4i1(<4 x i1> %200)
  %202 = select i1 %201, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %203 = call i8* @nish_str_concat(i8* %197, i8* %202)
  call void @nish_print(i8* %203)
  %204 = load <4 x float>, <4 x float>* %a.addr, align 8
  %205 = load <4 x float>, <4 x float>* %b.addr, align 8
  %206 = fcmp olt <4 x float> %204, %205
  %207 = load <4 x float>, <4 x float>* %a.addr, align 8
  %208 = load <4 x float>, <4 x float>* %b.addr, align 8
  %209 = select <4 x i1> %206, <4 x float> %207, <4 x float> %208
  %210 = call i64 @nish_arena_mark()
  %211 = call i8* @bits4(<4 x float> %209)
  %212 = call i8* @nish_arena_keep(i64 %210, i8* %211)
  call void @nish_print(i8* %212)
  %213 = insertelement <2 x double> undef, double 0x3FB999999999999A, i32 0
  %214 = fneg double 0x7FE1CCF385EBC8A0
  %215 = insertelement <2 x double> %213, double %214, i32 1
  store <2 x double> %215, <2 x double>* %c.addr, align 8
  %216 = insertelement <2 x double> undef, double 0x3FC999999999999A, i32 0
  %217 = insertelement <2 x double> %216, double 0x4024000000000000, i32 1
  store <2 x double> %217, <2 x double>* %d.addr, align 8
  %218 = load <2 x double>, <2 x double>* %c.addr, align 8
  %219 = load <2 x double>, <2 x double>* %d.addr, align 8
  %220 = fadd <2 x double> %218, %219
  %221 = call i64 @nish_arena_mark()
  %222 = call i8* @bits2(<2 x double> %220)
  %223 = call i8* @nish_arena_keep(i64 %221, i8* %222)
  call void @nish_print(i8* %223)
  %224 = load <2 x double>, <2 x double>* %c.addr, align 8
  %225 = load <2 x double>, <2 x double>* %d.addr, align 8
  %226 = fmul <2 x double> %224, %225
  %227 = call i64 @nish_arena_mark()
  %228 = call i8* @bits2(<2 x double> %226)
  %229 = call i8* @nish_arena_keep(i64 %227, i8* %228)
  call void @nish_print(i8* %229)
  %230 = load <2 x double>, <2 x double>* %c.addr, align 8
  %231 = insertelement <2 x double> undef, double 0x0000000000000000, i32 0
  %232 = insertelement <2 x double> %231, double 0x4008000000000000, i32 1
  %233 = fdiv <2 x double> %230, %232
  %234 = call i64 @nish_arena_mark()
  %235 = call i8* @bits2(<2 x double> %233)
  %236 = call i8* @nish_arena_keep(i64 %234, i8* %235)
  call void @nish_print(i8* %236)
  %237 = insertelement <2 x double> undef, double 0x4000000000000000, i32 0
  %238 = insertelement <2 x double> %237, double 0x3FD0000000000000, i32 1
  %239 = call <2 x double> @llvm.sqrt.v2f64(<2 x double> %238)
  %240 = call i64 @nish_arena_mark()
  %241 = call i8* @bits2(<2 x double> %239)
  %242 = call i8* @nish_arena_keep(i64 %240, i8* %241)
  call void @nish_print(i8* %242)
  %243 = load <2 x double>, <2 x double>* %c.addr, align 8
  %244 = call double @llvm.vector.reduce.fadd.v2f64(double -0.000000e+00, <2 x double> %243)
  %245 = bitcast double %244 to i64
  %246 = call i8* @nish_str_from_i64(i64 %245)
  call void @nish_print(i8* %246)
  %247 = load <2 x double>, <2 x double>* %c.addr, align 8
  %248 = load <2 x double>, <2 x double>* %d.addr, align 8
  %249 = fcmp olt <2 x double> %247, %248
  %250 = bitcast <2 x i1> %249 to i2
  %251 = zext i2 %250 to i32
  %252 = call i8* @nish_str_from_i32(i32 %251)
  call void @nish_print(i8* %252)
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
