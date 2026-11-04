@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare <16 x i8> @llvm.umin.v16i8(<16 x i8>, <16 x i8>) #2
declare <16 x i8> @llvm.umax.v16i8(<16 x i8>, <16 x i8>) #2
declare <4 x i32> @llvm.umin.v4i32(<4 x i32>, <4 x i32>) #2
declare <4 x i32> @llvm.umax.v4i32(<4 x i32>, <4 x i32>) #2
declare <4 x i32> @llvm.smin.v4i32(<4 x i32>, <4 x i32>) #2
declare <4 x i32> @llvm.smax.v4i32(<4 x i32>, <4 x i32>) #2
declare i32 @llvm.vector.reduce.add.v16i32(<16 x i32>) #2
declare i32 @llvm.vector.reduce.add.v8i32(<8 x i32>) #2
declare i32 @llvm.vector.reduce.add.v4i32(<4 x i32>) #2
declare i1 @llvm.vector.reduce.or.v4i1(<4 x i1>) #2
declare i1 @llvm.vector.reduce.and.v4i1(<4 x i1>) #2

define noundef i32 @nish_main() #0 {
entry:
  %b.addr = alloca <16 x i8>, align 8
  %c.addr = alloca <16 x i8>, align 8
  %h.addr = alloca <8 x i16>, align 8
  %i.addr = alloca <4 x i32>, align 8
  %j.addr = alloca <4 x i32>, align 8
  %u.addr = alloca <4 x i32>, align 8
  %w.addr = alloca <4 x i32>, align 8
  %m.addr = alloca <4 x i1>, align 8
  %s.addr = alloca <4 x i32>, align 8
  %bs.addr = alloca <16 x i8>, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = insertelement <16 x i8> undef, i8 250, i32 0
  %1 = insertelement <16 x i8> %0, i8 1, i32 1
  %2 = insertelement <16 x i8> %1, i8 2, i32 2
  %3 = insertelement <16 x i8> %2, i8 3, i32 3
  %4 = insertelement <16 x i8> %3, i8 4, i32 4
  %5 = insertelement <16 x i8> %4, i8 5, i32 5
  %6 = insertelement <16 x i8> %5, i8 6, i32 6
  %7 = insertelement <16 x i8> %6, i8 7, i32 7
  %8 = insertelement <16 x i8> %7, i8 8, i32 8
  %9 = insertelement <16 x i8> %8, i8 9, i32 9
  %10 = insertelement <16 x i8> %9, i8 10, i32 10
  %11 = insertelement <16 x i8> %10, i8 11, i32 11
  %12 = insertelement <16 x i8> %11, i8 12, i32 12
  %13 = insertelement <16 x i8> %12, i8 13, i32 13
  %14 = insertelement <16 x i8> %13, i8 14, i32 14
  %15 = insertelement <16 x i8> %14, i8 255, i32 15
  store <16 x i8> %15, <16 x i8>* %b.addr, align 8
  %16 = insertelement <16 x i8> undef, i8 10, i32 0
  %17 = shufflevector <16 x i8> %16, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %17, <16 x i8>* %c.addr, align 8
  %18 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %19 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %20 = add <16 x i8> %18, %19
  %21 = extractelement <16 x i8> %20, i32 0
  %22 = zext i8 %21 to i64
  %23 = call i8* @nish_str_from_u64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %26 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %27 = sub <16 x i8> %25, %26
  %28 = extractelement <16 x i8> %27, i32 15
  %29 = zext i8 %28 to i64
  %30 = call i8* @nish_str_from_u64(i64 %29)
  %31 = call i8* @nish_str_concat(i8* %24, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %34 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %35 = mul <16 x i8> %33, %34
  %36 = extractelement <16 x i8> %35, i32 15
  %37 = zext i8 %36 to i64
  %38 = call i8* @nish_str_from_u64(i64 %37)
  %39 = call i8* @nish_str_concat(i8* %32, i8* %38)
  call void @nish_print(i8* %39)
  %40 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %41 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %42 = call <16 x i8> @llvm.umin.v16i8(<16 x i8> %40, <16 x i8> %41)
  %43 = extractelement <16 x i8> %42, i32 0
  %44 = zext i8 %43 to i64
  %45 = call i8* @nish_str_from_u64(i64 %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %47 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %48 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %49 = call <16 x i8> @llvm.umax.v16i8(<16 x i8> %47, <16 x i8> %48)
  %50 = extractelement <16 x i8> %49, i32 1
  %51 = zext i8 %50 to i64
  %52 = call i8* @nish_str_from_u64(i64 %51)
  %53 = call i8* @nish_str_concat(i8* %46, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %55 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %56 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %57 = icmp ult <16 x i8> %55, %56
  %58 = bitcast <16 x i1> %57 to i16
  %59 = zext i16 %58 to i32
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %54, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %64 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %65 = icmp uge <16 x i8> %63, %64
  %66 = bitcast <16 x i1> %65 to i16
  %67 = zext i16 %66 to i32
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %62, i8* %68)
  call void @nish_print(i8* %69)
  %70 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %71 = zext <16 x i8> %70 to <16 x i32>
  %72 = call i32 @llvm.vector.reduce.add.v16i32(<16 x i32> %71)
  %73 = call i8* @nish_str_from_i32(i32 %72)
  call void @nish_print(i8* %73)
  %74 = insertelement <8 x i16> undef, i16 65535, i32 0
  %75 = insertelement <8 x i16> %74, i16 2, i32 1
  %76 = insertelement <8 x i16> %75, i16 3, i32 2
  %77 = insertelement <8 x i16> %76, i16 4, i32 3
  %78 = insertelement <8 x i16> %77, i16 5, i32 4
  %79 = insertelement <8 x i16> %78, i16 6, i32 5
  %80 = insertelement <8 x i16> %79, i16 7, i32 6
  %81 = insertelement <8 x i16> %80, i16 40000, i32 7
  store <8 x i16> %81, <8 x i16>* %h.addr, align 8
  %82 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %83 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %84 = add <8 x i16> %82, %83
  %85 = extractelement <8 x i16> %84, i32 0
  %86 = zext i16 %85 to i64
  %87 = call i8* @nish_str_from_u64(i64 %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %89 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %90 = zext <8 x i16> %89 to <8 x i32>
  %91 = call i32 @llvm.vector.reduce.add.v8i32(<8 x i32> %90)
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %88, i8* %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %95 = load <8 x i16>, <8 x i16>* %h.addr, align 8
  %96 = insertelement <8 x i16> undef, i16 1, i32 0
  %97 = insertelement <8 x i16> %96, i16 2, i32 1
  %98 = insertelement <8 x i16> %97, i16 3, i32 2
  %99 = insertelement <8 x i16> %98, i16 4, i32 3
  %100 = insertelement <8 x i16> %99, i16 5, i32 4
  %101 = insertelement <8 x i16> %100, i16 6, i32 5
  %102 = insertelement <8 x i16> %101, i16 7, i32 6
  %103 = insertelement <8 x i16> %102, i16 8, i32 7
  %104 = icmp ugt <8 x i16> %95, %103
  %105 = bitcast <8 x i1> %104 to i8
  %106 = zext i8 %105 to i32
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %94, i8* %107)
  call void @nish_print(i8* %108)
  %109 = insertelement <4 x i32> undef, i32 -5, i32 0
  %110 = insertelement <4 x i32> %109, i32 2147483647, i32 1
  %111 = insertelement <4 x i32> %110, i32 7, i32 2
  %112 = insertelement <4 x i32> %111, i32 -2147483648, i32 3
  store <4 x i32> %112, <4 x i32>* %i.addr, align 8
  %113 = insertelement <4 x i32> undef, i32 3, i32 0
  %114 = insertelement <4 x i32> %113, i32 1, i32 1
  %115 = insertelement <4 x i32> %114, i32 -7, i32 2
  %116 = insertelement <4 x i32> %115, i32 -1, i32 3
  store <4 x i32> %116, <4 x i32>* %j.addr, align 8
  %117 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %118 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %119 = add <4 x i32> %117, %118
  %120 = extractelement <4 x i32> %119, i32 1
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %123 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %124 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %125 = sub <4 x i32> %123, %124
  %126 = extractelement <4 x i32> %125, i32 3
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* %122, i8* %127)
  %129 = call i8* @nish_str_concat(i8* %128, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %130 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %131 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %132 = mul <4 x i32> %130, %131
  %133 = extractelement <4 x i32> %132, i32 3
  %134 = call i8* @nish_str_from_i32(i32 %133)
  %135 = call i8* @nish_str_concat(i8* %129, i8* %134)
  call void @nish_print(i8* %135)
  %136 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %137 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %138 = call <4 x i32> @llvm.smin.v4i32(<4 x i32> %136, <4 x i32> %137)
  %139 = extractelement <4 x i32> %138, i32 0
  %140 = call i8* @nish_str_from_i32(i32 %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %142 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %143 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %144 = call <4 x i32> @llvm.smax.v4i32(<4 x i32> %142, <4 x i32> %143)
  %145 = extractelement <4 x i32> %144, i32 2
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %141, i8* %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %149 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %150 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %151 = icmp slt <4 x i32> %149, %150
  %152 = bitcast <4 x i1> %151 to i4
  %153 = zext i4 %152 to i32
  %154 = call i8* @nish_str_from_i32(i32 %153)
  %155 = call i8* @nish_str_concat(i8* %148, i8* %154)
  %156 = call i8* @nish_str_concat(i8* %155, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %157 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %158 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %159 = icmp sle <4 x i32> %157, %158
  %160 = bitcast <4 x i1> %159 to i4
  %161 = zext i4 %160 to i32
  %162 = call i8* @nish_str_from_i32(i32 %161)
  %163 = call i8* @nish_str_concat(i8* %156, i8* %162)
  %164 = call i8* @nish_str_concat(i8* %163, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %165 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %166 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %167 = icmp ne <4 x i32> %165, %166
  %168 = bitcast <4 x i1> %167 to i4
  %169 = zext i4 %168 to i32
  %170 = call i8* @nish_str_from_i32(i32 %169)
  %171 = call i8* @nish_str_concat(i8* %164, i8* %170)
  call void @nish_print(i8* %171)
  %172 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %173 = call i32 @llvm.vector.reduce.add.v4i32(<4 x i32> %172)
  %174 = call i8* @nish_str_from_i32(i32 %173)
  call void @nish_print(i8* %174)
  %175 = insertelement <4 x i32> undef, i32 4294967295, i32 0
  %176 = insertelement <4 x i32> %175, i32 1, i32 1
  %177 = insertelement <4 x i32> %176, i32 7, i32 2
  %178 = insertelement <4 x i32> %177, i32 2147483648, i32 3
  store <4 x i32> %178, <4 x i32>* %u.addr, align 8
  %179 = insertelement <4 x i32> undef, i32 1, i32 0
  %180 = insertelement <4 x i32> %179, i32 2, i32 1
  %181 = insertelement <4 x i32> %180, i32 7, i32 2
  %182 = insertelement <4 x i32> %181, i32 1, i32 3
  store <4 x i32> %182, <4 x i32>* %w.addr, align 8
  %183 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %184 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %185 = call <4 x i32> @llvm.umin.v4i32(<4 x i32> %183, <4 x i32> %184)
  %186 = extractelement <4 x i32> %185, i32 0
  %187 = zext i32 %186 to i64
  %188 = call i8* @nish_str_from_u64(i64 %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %190 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %191 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %192 = call <4 x i32> @llvm.umax.v4i32(<4 x i32> %190, <4 x i32> %191)
  %193 = extractelement <4 x i32> %192, i32 3
  %194 = zext i32 %193 to i64
  %195 = call i8* @nish_str_from_u64(i64 %194)
  %196 = call i8* @nish_str_concat(i8* %189, i8* %195)
  %197 = call i8* @nish_str_concat(i8* %196, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %198 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %199 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %200 = icmp ult <4 x i32> %198, %199
  %201 = bitcast <4 x i1> %200 to i4
  %202 = zext i4 %201 to i32
  %203 = call i8* @nish_str_from_i32(i32 %202)
  %204 = call i8* @nish_str_concat(i8* %197, i8* %203)
  %205 = call i8* @nish_str_concat(i8* %204, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %206 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %207 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %208 = icmp eq <4 x i32> %206, %207
  %209 = bitcast <4 x i1> %208 to i4
  %210 = zext i4 %209 to i32
  %211 = call i8* @nish_str_from_i32(i32 %210)
  %212 = call i8* @nish_str_concat(i8* %205, i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %214 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %215 = call i32 @llvm.vector.reduce.add.v4i32(<4 x i32> %214)
  %216 = zext i32 %215 to i64
  %217 = call i8* @nish_str_from_u64(i64 %216)
  %218 = call i8* @nish_str_concat(i8* %213, i8* %217)
  call void @nish_print(i8* %218)
  %219 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %220 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %221 = and <4 x i32> %219, %220
  %222 = extractelement <4 x i32> %221, i32 0
  %223 = zext i32 %222 to i64
  %224 = call i8* @nish_str_from_u64(i64 %223)
  %225 = call i8* @nish_str_concat(i8* %224, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %226 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %227 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %228 = or <4 x i32> %226, %227
  %229 = extractelement <4 x i32> %228, i32 1
  %230 = zext i32 %229 to i64
  %231 = call i8* @nish_str_from_u64(i64 %230)
  %232 = call i8* @nish_str_concat(i8* %225, i8* %231)
  %233 = call i8* @nish_str_concat(i8* %232, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %234 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %235 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %236 = xor <4 x i32> %234, %235
  %237 = extractelement <4 x i32> %236, i32 2
  %238 = zext i32 %237 to i64
  %239 = call i8* @nish_str_from_u64(i64 %238)
  %240 = call i8* @nish_str_concat(i8* %233, i8* %239)
  %241 = call i8* @nish_str_concat(i8* %240, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %242 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %243 = xor <4 x i32> %242, <i32 -1, i32 -1, i32 -1, i32 -1>
  %244 = extractelement <4 x i32> %243, i32 0
  %245 = zext i32 %244 to i64
  %246 = call i8* @nish_str_from_u64(i64 %245)
  %247 = call i8* @nish_str_concat(i8* %241, i8* %246)
  call void @nish_print(i8* %247)
  %248 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %249 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %250 = icmp ult <4 x i32> %248, %249
  store <4 x i1> %250, <4 x i1>* %m.addr, align 8
  %251 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %252 = call i1 @llvm.vector.reduce.or.v4i1(<4 x i1> %251)
  %253 = select i1 %252, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %254 = call i8* @nish_str_concat(i8* %253, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %255 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %256 = call i1 @llvm.vector.reduce.and.v4i1(<4 x i1> %255)
  %257 = select i1 %256, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %258 = call i8* @nish_str_concat(i8* %254, i8* %257)
  %259 = call i8* @nish_str_concat(i8* %258, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %260 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %261 = xor <4 x i1> %260, <i1 true, i1 true, i1 true, i1 true>
  %262 = bitcast <4 x i1> %261 to i4
  %263 = zext i4 %262 to i32
  %264 = call i8* @nish_str_from_i32(i32 %263)
  %265 = call i8* @nish_str_concat(i8* %259, i8* %264)
  %266 = call i8* @nish_str_concat(i8* %265, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %267 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %268 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %269 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %270 = icmp eq <4 x i32> %268, %269
  %271 = and <4 x i1> %267, %270
  %272 = bitcast <4 x i1> %271 to i4
  %273 = zext i4 %272 to i32
  %274 = call i8* @nish_str_from_i32(i32 %273)
  %275 = call i8* @nish_str_concat(i8* %266, i8* %274)
  %276 = call i8* @nish_str_concat(i8* %275, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %277 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %278 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %279 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %280 = icmp eq <4 x i32> %278, %279
  %281 = xor <4 x i1> %277, %280
  %282 = bitcast <4 x i1> %281 to i4
  %283 = zext i4 %282 to i32
  %284 = call i8* @nish_str_from_i32(i32 %283)
  %285 = call i8* @nish_str_concat(i8* %276, i8* %284)
  call void @nish_print(i8* %285)
  %286 = load <4 x i1>, <4 x i1>* %m.addr, align 8
  %287 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %288 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %289 = select <4 x i1> %286, <4 x i32> %287, <4 x i32> %288
  %290 = extractelement <4 x i32> %289, i32 1
  %291 = zext i32 %290 to i64
  %292 = call i8* @nish_str_from_u64(i64 %291)
  call void @nish_print(i8* %292)
  %293 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %294 = load <4 x i32>, <4 x i32>* %j.addr, align 8
  %295 = shufflevector <4 x i32> %293, <4 x i32> %294, <4 x i32> <i32 7, i32 0, i32 5, i32 2>
  store <4 x i32> %295, <4 x i32>* %s.addr, align 8
  %296 = load <4 x i32>, <4 x i32>* %s.addr, align 8
  %297 = extractelement <4 x i32> %296, i32 0
  %298 = call i8* @nish_str_from_i32(i32 %297)
  %299 = call i8* @nish_str_concat(i8* %298, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %300 = load <4 x i32>, <4 x i32>* %s.addr, align 8
  %301 = extractelement <4 x i32> %300, i32 1
  %302 = call i8* @nish_str_from_i32(i32 %301)
  %303 = call i8* @nish_str_concat(i8* %299, i8* %302)
  %304 = call i8* @nish_str_concat(i8* %303, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %305 = load <4 x i32>, <4 x i32>* %s.addr, align 8
  %306 = extractelement <4 x i32> %305, i32 2
  %307 = call i8* @nish_str_from_i32(i32 %306)
  %308 = call i8* @nish_str_concat(i8* %304, i8* %307)
  %309 = call i8* @nish_str_concat(i8* %308, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %310 = load <4 x i32>, <4 x i32>* %s.addr, align 8
  %311 = extractelement <4 x i32> %310, i32 3
  %312 = call i8* @nish_str_from_i32(i32 %311)
  %313 = call i8* @nish_str_concat(i8* %309, i8* %312)
  call void @nish_print(i8* %313)
  %314 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %315 = load <16 x i8>, <16 x i8>* %c.addr, align 8
  %316 = shufflevector <16 x i8> %314, <16 x i8> %315, <16 x i32> <i32 15, i32 16, i32 0, i32 31, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1, i32 1>
  store <16 x i8> %316, <16 x i8>* %bs.addr, align 8
  %317 = load <16 x i8>, <16 x i8>* %bs.addr, align 8
  %318 = extractelement <16 x i8> %317, i32 0
  %319 = zext i8 %318 to i64
  %320 = call i8* @nish_str_from_u64(i64 %319)
  %321 = call i8* @nish_str_concat(i8* %320, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %322 = load <16 x i8>, <16 x i8>* %bs.addr, align 8
  %323 = extractelement <16 x i8> %322, i32 1
  %324 = zext i8 %323 to i64
  %325 = call i8* @nish_str_from_u64(i64 %324)
  %326 = call i8* @nish_str_concat(i8* %321, i8* %325)
  %327 = call i8* @nish_str_concat(i8* %326, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %328 = load <16 x i8>, <16 x i8>* %bs.addr, align 8
  %329 = extractelement <16 x i8> %328, i32 2
  %330 = zext i8 %329 to i64
  %331 = call i8* @nish_str_from_u64(i64 %330)
  %332 = call i8* @nish_str_concat(i8* %327, i8* %331)
  %333 = call i8* @nish_str_concat(i8* %332, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %334 = load <16 x i8>, <16 x i8>* %bs.addr, align 8
  %335 = extractelement <16 x i8> %334, i32 3
  %336 = zext i8 %335 to i64
  %337 = call i8* @nish_str_from_u64(i64 %336)
  %338 = call i8* @nish_str_concat(i8* %333, i8* %337)
  call void @nish_print(i8* %338)
  %339 = insertelement <4 x i32> undef, i32 67305985, i32 0
  %340 = insertelement <4 x i32> %339, i32 0, i32 1
  %341 = insertelement <4 x i32> %340, i32 0, i32 2
  %342 = insertelement <4 x i32> %341, i32 0, i32 3
  %343 = bitcast <4 x i32> %342 to <16 x i8>
  %344 = extractelement <16 x i8> %343, i32 2
  %345 = zext i8 %344 to i64
  %346 = call i8* @nish_str_from_u64(i64 %345)
  %347 = call i8* @nish_str_concat(i8* %346, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %348 = load <4 x i32>, <4 x i32>* %i.addr, align 8
  %349 = bitcast <4 x i32> %348 to <4 x i32>
  %350 = extractelement <4 x i32> %349, i32 0
  %351 = zext i32 %350 to i64
  %352 = call i8* @nish_str_from_u64(i64 %351)
  %353 = call i8* @nish_str_concat(i8* %347, i8* %352)
  %354 = call i8* @nish_str_concat(i8* %353, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %355 = load <4 x i32>, <4 x i32>* %u.addr, align 8
  %356 = bitcast <4 x i32> %355 to <4 x i32>
  %357 = extractelement <4 x i32> %356, i32 0
  %358 = call i8* @nish_str_from_i32(i32 %357)
  %359 = call i8* @nish_str_concat(i8* %354, i8* %358)
  call void @nish_print(i8* %359)
  %360 = insertelement <4 x i32> undef, i32 1065353216, i32 0
  %361 = insertelement <4 x i32> %360, i32 0, i32 1
  %362 = insertelement <4 x i32> %361, i32 0, i32 2
  %363 = insertelement <4 x i32> %362, i32 0, i32 3
  %364 = bitcast <4 x i32> %363 to <4 x float>
  %365 = extractelement <4 x float> %364, i32 0
  %366 = fpext float %365 to double
  %367 = call i8* @nish_str_from_f64(double %366)
  %368 = call i8* @nish_str_concat(i8* %367, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %369 = insertelement <4 x float> undef, float 0x3FF0000000000000, i32 0
  %370 = insertelement <4 x float> %369, float 0x0000000000000000, i32 1
  %371 = insertelement <4 x float> %370, float 0x0000000000000000, i32 2
  %372 = insertelement <4 x float> %371, float 0x0000000000000000, i32 3
  %373 = bitcast <4 x float> %372 to <8 x i16>
  %374 = extractelement <8 x i16> %373, i32 1
  %375 = zext i16 %374 to i64
  %376 = call i8* @nish_str_from_u64(i64 %375)
  %377 = call i8* @nish_str_concat(i8* %368, i8* %376)
  call void @nish_print(i8* %377)
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
