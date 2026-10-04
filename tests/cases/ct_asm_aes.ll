%struct.nish_array = type { i64, i64, i8* }

define internal noundef i64 @aesLanes(i64 noundef %pattern) #0 {
entry:
  %two.addr = alloca i64, align 8
  %0 = sext i32 16 to i64
  %1 = and i64 %0, 63
  %2 = shl i64 %pattern, %1
  %3 = or i64 %pattern, %2
  store i64 %3, i64* %two.addr, align 8
  %4 = load i64, i64* %two.addr, align 8
  %5 = load i64, i64* %two.addr, align 8
  %6 = sext i32 32 to i64
  %7 = and i64 %6, 63
  %8 = shl i64 %5, %7
  %9 = or i64 %4, %8
  ret i64 %9
}

define internal void @aesSbox(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %q) #1 {
entry:
  %x0.addr = alloca i64, align 8
  %x1.addr = alloca i64, align 8
  %x2.addr = alloca i64, align 8
  %x3.addr = alloca i64, align 8
  %x4.addr = alloca i64, align 8
  %x5.addr = alloca i64, align 8
  %x6.addr = alloca i64, align 8
  %x7.addr = alloca i64, align 8
  %y14.addr = alloca i64, align 8
  %y13.addr = alloca i64, align 8
  %y9.addr = alloca i64, align 8
  %y8.addr = alloca i64, align 8
  %t0.addr = alloca i64, align 8
  %y1.addr = alloca i64, align 8
  %y4.addr = alloca i64, align 8
  %y12.addr = alloca i64, align 8
  %y2.addr = alloca i64, align 8
  %y5.addr = alloca i64, align 8
  %y3.addr = alloca i64, align 8
  %t1.addr = alloca i64, align 8
  %y15.addr = alloca i64, align 8
  %y20.addr = alloca i64, align 8
  %y6.addr = alloca i64, align 8
  %y10.addr = alloca i64, align 8
  %y11.addr = alloca i64, align 8
  %y7.addr = alloca i64, align 8
  %y17.addr = alloca i64, align 8
  %y19.addr = alloca i64, align 8
  %y16.addr = alloca i64, align 8
  %y21.addr = alloca i64, align 8
  %y18.addr = alloca i64, align 8
  %t2.addr = alloca i64, align 8
  %t3.addr = alloca i64, align 8
  %t4.addr = alloca i64, align 8
  %t5.addr = alloca i64, align 8
  %t6.addr = alloca i64, align 8
  %t7.addr = alloca i64, align 8
  %t8.addr = alloca i64, align 8
  %t9.addr = alloca i64, align 8
  %t10.addr = alloca i64, align 8
  %t11.addr = alloca i64, align 8
  %t12.addr = alloca i64, align 8
  %t13.addr = alloca i64, align 8
  %t14.addr = alloca i64, align 8
  %t15.addr = alloca i64, align 8
  %t16.addr = alloca i64, align 8
  %t17.addr = alloca i64, align 8
  %t18.addr = alloca i64, align 8
  %t19.addr = alloca i64, align 8
  %t20.addr = alloca i64, align 8
  %t21.addr = alloca i64, align 8
  %t22.addr = alloca i64, align 8
  %t23.addr = alloca i64, align 8
  %t24.addr = alloca i64, align 8
  %t25.addr = alloca i64, align 8
  %t26.addr = alloca i64, align 8
  %t27.addr = alloca i64, align 8
  %t28.addr = alloca i64, align 8
  %t29.addr = alloca i64, align 8
  %t30.addr = alloca i64, align 8
  %t31.addr = alloca i64, align 8
  %t32.addr = alloca i64, align 8
  %t33.addr = alloca i64, align 8
  %t34.addr = alloca i64, align 8
  %t35.addr = alloca i64, align 8
  %t36.addr = alloca i64, align 8
  %t37.addr = alloca i64, align 8
  %t38.addr = alloca i64, align 8
  %t39.addr = alloca i64, align 8
  %t40.addr = alloca i64, align 8
  %t41.addr = alloca i64, align 8
  %t42.addr = alloca i64, align 8
  %t43.addr = alloca i64, align 8
  %t44.addr = alloca i64, align 8
  %t45.addr = alloca i64, align 8
  %z0.addr = alloca i64, align 8
  %z1.addr = alloca i64, align 8
  %z2.addr = alloca i64, align 8
  %z3.addr = alloca i64, align 8
  %z4.addr = alloca i64, align 8
  %z5.addr = alloca i64, align 8
  %z6.addr = alloca i64, align 8
  %z7.addr = alloca i64, align 8
  %z8.addr = alloca i64, align 8
  %z9.addr = alloca i64, align 8
  %z10.addr = alloca i64, align 8
  %z11.addr = alloca i64, align 8
  %z12.addr = alloca i64, align 8
  %z13.addr = alloca i64, align 8
  %z14.addr = alloca i64, align 8
  %z15.addr = alloca i64, align 8
  %z16.addr = alloca i64, align 8
  %z17.addr = alloca i64, align 8
  %t46.addr = alloca i64, align 8
  %t47.addr = alloca i64, align 8
  %t48.addr = alloca i64, align 8
  %t49.addr = alloca i64, align 8
  %t50.addr = alloca i64, align 8
  %t51.addr = alloca i64, align 8
  %t52.addr = alloca i64, align 8
  %t53.addr = alloca i64, align 8
  %t54.addr = alloca i64, align 8
  %t55.addr = alloca i64, align 8
  %t56.addr = alloca i64, align 8
  %t57.addr = alloca i64, align 8
  %t58.addr = alloca i64, align 8
  %t59.addr = alloca i64, align 8
  %t60.addr = alloca i64, align 8
  %t61.addr = alloca i64, align 8
  %t62.addr = alloca i64, align 8
  %t63.addr = alloca i64, align 8
  %t64.addr = alloca i64, align 8
  %t65.addr = alloca i64, align 8
  %t66.addr = alloca i64, align 8
  %s0.addr = alloca i64, align 8
  %s6.addr = alloca i64, align 8
  %s7.addr = alloca i64, align 8
  %t67.addr = alloca i64, align 8
  %s3.addr = alloca i64, align 8
  %s4.addr = alloca i64, align 8
  %s5.addr = alloca i64, align 8
  %s1.addr = alloca i64, align 8
  %s2.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 7
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %4, i64* %x0.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i64*
  %8 = getelementptr inbounds i64, i64* %7, i64 6
  %9 = load i64, i64* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %9, i64* %x1.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i64*
  %13 = getelementptr inbounds i64, i64* %12, i64 5
  %14 = load i64, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %14, i64* %x2.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 4
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %19, i64* %x3.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i64*
  %23 = getelementptr inbounds i64, i64* %22, i64 3
  %24 = load i64, i64* %23, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %24, i64* %x4.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to i64*
  %28 = getelementptr inbounds i64, i64* %27, i64 2
  %29 = load i64, i64* %28, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %29, i64* %x5.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i64*
  %33 = getelementptr inbounds i64, i64* %32, i64 1
  %34 = load i64, i64* %33, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %34, i64* %x6.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* %36 to i64*
  %38 = getelementptr inbounds i64, i64* %37, i64 0
  %39 = load i64, i64* %38, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %39, i64* %x7.addr, align 8
  %40 = load i64, i64* %x3.addr, align 8
  %41 = load i64, i64* %x5.addr, align 8
  %42 = xor i64 %40, %41
  store i64 %42, i64* %y14.addr, align 8
  %43 = load i64, i64* %x0.addr, align 8
  %44 = load i64, i64* %x6.addr, align 8
  %45 = xor i64 %43, %44
  store i64 %45, i64* %y13.addr, align 8
  %46 = load i64, i64* %x0.addr, align 8
  %47 = load i64, i64* %x3.addr, align 8
  %48 = xor i64 %46, %47
  store i64 %48, i64* %y9.addr, align 8
  %49 = load i64, i64* %x0.addr, align 8
  %50 = load i64, i64* %x5.addr, align 8
  %51 = xor i64 %49, %50
  store i64 %51, i64* %y8.addr, align 8
  %52 = load i64, i64* %x1.addr, align 8
  %53 = load i64, i64* %x2.addr, align 8
  %54 = xor i64 %52, %53
  store i64 %54, i64* %t0.addr, align 8
  %55 = load i64, i64* %t0.addr, align 8
  %56 = load i64, i64* %x7.addr, align 8
  %57 = xor i64 %55, %56
  store i64 %57, i64* %y1.addr, align 8
  %58 = load i64, i64* %y1.addr, align 8
  %59 = load i64, i64* %x3.addr, align 8
  %60 = xor i64 %58, %59
  store i64 %60, i64* %y4.addr, align 8
  %61 = load i64, i64* %y13.addr, align 8
  %62 = load i64, i64* %y14.addr, align 8
  %63 = xor i64 %61, %62
  store i64 %63, i64* %y12.addr, align 8
  %64 = load i64, i64* %y1.addr, align 8
  %65 = load i64, i64* %x0.addr, align 8
  %66 = xor i64 %64, %65
  store i64 %66, i64* %y2.addr, align 8
  %67 = load i64, i64* %y1.addr, align 8
  %68 = load i64, i64* %x6.addr, align 8
  %69 = xor i64 %67, %68
  store i64 %69, i64* %y5.addr, align 8
  %70 = load i64, i64* %y5.addr, align 8
  %71 = load i64, i64* %y8.addr, align 8
  %72 = xor i64 %70, %71
  store i64 %72, i64* %y3.addr, align 8
  %73 = load i64, i64* %x4.addr, align 8
  %74 = load i64, i64* %y12.addr, align 8
  %75 = xor i64 %73, %74
  store i64 %75, i64* %t1.addr, align 8
  %76 = load i64, i64* %t1.addr, align 8
  %77 = load i64, i64* %x5.addr, align 8
  %78 = xor i64 %76, %77
  store i64 %78, i64* %y15.addr, align 8
  %79 = load i64, i64* %t1.addr, align 8
  %80 = load i64, i64* %x1.addr, align 8
  %81 = xor i64 %79, %80
  store i64 %81, i64* %y20.addr, align 8
  %82 = load i64, i64* %y15.addr, align 8
  %83 = load i64, i64* %x7.addr, align 8
  %84 = xor i64 %82, %83
  store i64 %84, i64* %y6.addr, align 8
  %85 = load i64, i64* %y15.addr, align 8
  %86 = load i64, i64* %t0.addr, align 8
  %87 = xor i64 %85, %86
  store i64 %87, i64* %y10.addr, align 8
  %88 = load i64, i64* %y20.addr, align 8
  %89 = load i64, i64* %y9.addr, align 8
  %90 = xor i64 %88, %89
  store i64 %90, i64* %y11.addr, align 8
  %91 = load i64, i64* %x7.addr, align 8
  %92 = load i64, i64* %y11.addr, align 8
  %93 = xor i64 %91, %92
  store i64 %93, i64* %y7.addr, align 8
  %94 = load i64, i64* %y10.addr, align 8
  %95 = load i64, i64* %y11.addr, align 8
  %96 = xor i64 %94, %95
  store i64 %96, i64* %y17.addr, align 8
  %97 = load i64, i64* %y10.addr, align 8
  %98 = load i64, i64* %y8.addr, align 8
  %99 = xor i64 %97, %98
  store i64 %99, i64* %y19.addr, align 8
  %100 = load i64, i64* %t0.addr, align 8
  %101 = load i64, i64* %y11.addr, align 8
  %102 = xor i64 %100, %101
  store i64 %102, i64* %y16.addr, align 8
  %103 = load i64, i64* %y13.addr, align 8
  %104 = load i64, i64* %y16.addr, align 8
  %105 = xor i64 %103, %104
  store i64 %105, i64* %y21.addr, align 8
  %106 = load i64, i64* %x0.addr, align 8
  %107 = load i64, i64* %y16.addr, align 8
  %108 = xor i64 %106, %107
  store i64 %108, i64* %y18.addr, align 8
  %109 = load i64, i64* %y12.addr, align 8
  %110 = load i64, i64* %y15.addr, align 8
  %111 = and i64 %109, %110
  store i64 %111, i64* %t2.addr, align 8
  %112 = load i64, i64* %y3.addr, align 8
  %113 = load i64, i64* %y6.addr, align 8
  %114 = and i64 %112, %113
  store i64 %114, i64* %t3.addr, align 8
  %115 = load i64, i64* %t3.addr, align 8
  %116 = load i64, i64* %t2.addr, align 8
  %117 = xor i64 %115, %116
  store i64 %117, i64* %t4.addr, align 8
  %118 = load i64, i64* %y4.addr, align 8
  %119 = load i64, i64* %x7.addr, align 8
  %120 = and i64 %118, %119
  store i64 %120, i64* %t5.addr, align 8
  %121 = load i64, i64* %t5.addr, align 8
  %122 = load i64, i64* %t2.addr, align 8
  %123 = xor i64 %121, %122
  store i64 %123, i64* %t6.addr, align 8
  %124 = load i64, i64* %y13.addr, align 8
  %125 = load i64, i64* %y16.addr, align 8
  %126 = and i64 %124, %125
  store i64 %126, i64* %t7.addr, align 8
  %127 = load i64, i64* %y5.addr, align 8
  %128 = load i64, i64* %y1.addr, align 8
  %129 = and i64 %127, %128
  store i64 %129, i64* %t8.addr, align 8
  %130 = load i64, i64* %t8.addr, align 8
  %131 = load i64, i64* %t7.addr, align 8
  %132 = xor i64 %130, %131
  store i64 %132, i64* %t9.addr, align 8
  %133 = load i64, i64* %y2.addr, align 8
  %134 = load i64, i64* %y7.addr, align 8
  %135 = and i64 %133, %134
  store i64 %135, i64* %t10.addr, align 8
  %136 = load i64, i64* %t10.addr, align 8
  %137 = load i64, i64* %t7.addr, align 8
  %138 = xor i64 %136, %137
  store i64 %138, i64* %t11.addr, align 8
  %139 = load i64, i64* %y9.addr, align 8
  %140 = load i64, i64* %y11.addr, align 8
  %141 = and i64 %139, %140
  store i64 %141, i64* %t12.addr, align 8
  %142 = load i64, i64* %y14.addr, align 8
  %143 = load i64, i64* %y17.addr, align 8
  %144 = and i64 %142, %143
  store i64 %144, i64* %t13.addr, align 8
  %145 = load i64, i64* %t13.addr, align 8
  %146 = load i64, i64* %t12.addr, align 8
  %147 = xor i64 %145, %146
  store i64 %147, i64* %t14.addr, align 8
  %148 = load i64, i64* %y8.addr, align 8
  %149 = load i64, i64* %y10.addr, align 8
  %150 = and i64 %148, %149
  store i64 %150, i64* %t15.addr, align 8
  %151 = load i64, i64* %t15.addr, align 8
  %152 = load i64, i64* %t12.addr, align 8
  %153 = xor i64 %151, %152
  store i64 %153, i64* %t16.addr, align 8
  %154 = load i64, i64* %t4.addr, align 8
  %155 = load i64, i64* %t14.addr, align 8
  %156 = xor i64 %154, %155
  store i64 %156, i64* %t17.addr, align 8
  %157 = load i64, i64* %t6.addr, align 8
  %158 = load i64, i64* %t16.addr, align 8
  %159 = xor i64 %157, %158
  store i64 %159, i64* %t18.addr, align 8
  %160 = load i64, i64* %t9.addr, align 8
  %161 = load i64, i64* %t14.addr, align 8
  %162 = xor i64 %160, %161
  store i64 %162, i64* %t19.addr, align 8
  %163 = load i64, i64* %t11.addr, align 8
  %164 = load i64, i64* %t16.addr, align 8
  %165 = xor i64 %163, %164
  store i64 %165, i64* %t20.addr, align 8
  %166 = load i64, i64* %t17.addr, align 8
  %167 = load i64, i64* %y20.addr, align 8
  %168 = xor i64 %166, %167
  store i64 %168, i64* %t21.addr, align 8
  %169 = load i64, i64* %t18.addr, align 8
  %170 = load i64, i64* %y19.addr, align 8
  %171 = xor i64 %169, %170
  store i64 %171, i64* %t22.addr, align 8
  %172 = load i64, i64* %t19.addr, align 8
  %173 = load i64, i64* %y21.addr, align 8
  %174 = xor i64 %172, %173
  store i64 %174, i64* %t23.addr, align 8
  %175 = load i64, i64* %t20.addr, align 8
  %176 = load i64, i64* %y18.addr, align 8
  %177 = xor i64 %175, %176
  store i64 %177, i64* %t24.addr, align 8
  %178 = load i64, i64* %t21.addr, align 8
  %179 = load i64, i64* %t22.addr, align 8
  %180 = xor i64 %178, %179
  store i64 %180, i64* %t25.addr, align 8
  %181 = load i64, i64* %t21.addr, align 8
  %182 = load i64, i64* %t23.addr, align 8
  %183 = and i64 %181, %182
  store i64 %183, i64* %t26.addr, align 8
  %184 = load i64, i64* %t24.addr, align 8
  %185 = load i64, i64* %t26.addr, align 8
  %186 = xor i64 %184, %185
  store i64 %186, i64* %t27.addr, align 8
  %187 = load i64, i64* %t25.addr, align 8
  %188 = load i64, i64* %t27.addr, align 8
  %189 = and i64 %187, %188
  store i64 %189, i64* %t28.addr, align 8
  %190 = load i64, i64* %t28.addr, align 8
  %191 = load i64, i64* %t22.addr, align 8
  %192 = xor i64 %190, %191
  store i64 %192, i64* %t29.addr, align 8
  %193 = load i64, i64* %t23.addr, align 8
  %194 = load i64, i64* %t24.addr, align 8
  %195 = xor i64 %193, %194
  store i64 %195, i64* %t30.addr, align 8
  %196 = load i64, i64* %t22.addr, align 8
  %197 = load i64, i64* %t26.addr, align 8
  %198 = xor i64 %196, %197
  store i64 %198, i64* %t31.addr, align 8
  %199 = load i64, i64* %t31.addr, align 8
  %200 = load i64, i64* %t30.addr, align 8
  %201 = and i64 %199, %200
  store i64 %201, i64* %t32.addr, align 8
  %202 = load i64, i64* %t32.addr, align 8
  %203 = load i64, i64* %t24.addr, align 8
  %204 = xor i64 %202, %203
  store i64 %204, i64* %t33.addr, align 8
  %205 = load i64, i64* %t23.addr, align 8
  %206 = load i64, i64* %t33.addr, align 8
  %207 = xor i64 %205, %206
  store i64 %207, i64* %t34.addr, align 8
  %208 = load i64, i64* %t27.addr, align 8
  %209 = load i64, i64* %t33.addr, align 8
  %210 = xor i64 %208, %209
  store i64 %210, i64* %t35.addr, align 8
  %211 = load i64, i64* %t24.addr, align 8
  %212 = load i64, i64* %t35.addr, align 8
  %213 = and i64 %211, %212
  store i64 %213, i64* %t36.addr, align 8
  %214 = load i64, i64* %t36.addr, align 8
  %215 = load i64, i64* %t34.addr, align 8
  %216 = xor i64 %214, %215
  store i64 %216, i64* %t37.addr, align 8
  %217 = load i64, i64* %t27.addr, align 8
  %218 = load i64, i64* %t36.addr, align 8
  %219 = xor i64 %217, %218
  store i64 %219, i64* %t38.addr, align 8
  %220 = load i64, i64* %t29.addr, align 8
  %221 = load i64, i64* %t38.addr, align 8
  %222 = and i64 %220, %221
  store i64 %222, i64* %t39.addr, align 8
  %223 = load i64, i64* %t25.addr, align 8
  %224 = load i64, i64* %t39.addr, align 8
  %225 = xor i64 %223, %224
  store i64 %225, i64* %t40.addr, align 8
  %226 = load i64, i64* %t40.addr, align 8
  %227 = load i64, i64* %t37.addr, align 8
  %228 = xor i64 %226, %227
  store i64 %228, i64* %t41.addr, align 8
  %229 = load i64, i64* %t29.addr, align 8
  %230 = load i64, i64* %t33.addr, align 8
  %231 = xor i64 %229, %230
  store i64 %231, i64* %t42.addr, align 8
  %232 = load i64, i64* %t29.addr, align 8
  %233 = load i64, i64* %t40.addr, align 8
  %234 = xor i64 %232, %233
  store i64 %234, i64* %t43.addr, align 8
  %235 = load i64, i64* %t33.addr, align 8
  %236 = load i64, i64* %t37.addr, align 8
  %237 = xor i64 %235, %236
  store i64 %237, i64* %t44.addr, align 8
  %238 = load i64, i64* %t42.addr, align 8
  %239 = load i64, i64* %t41.addr, align 8
  %240 = xor i64 %238, %239
  store i64 %240, i64* %t45.addr, align 8
  %241 = load i64, i64* %t44.addr, align 8
  %242 = load i64, i64* %y15.addr, align 8
  %243 = and i64 %241, %242
  store i64 %243, i64* %z0.addr, align 8
  %244 = load i64, i64* %t37.addr, align 8
  %245 = load i64, i64* %y6.addr, align 8
  %246 = and i64 %244, %245
  store i64 %246, i64* %z1.addr, align 8
  %247 = load i64, i64* %t33.addr, align 8
  %248 = load i64, i64* %x7.addr, align 8
  %249 = and i64 %247, %248
  store i64 %249, i64* %z2.addr, align 8
  %250 = load i64, i64* %t43.addr, align 8
  %251 = load i64, i64* %y16.addr, align 8
  %252 = and i64 %250, %251
  store i64 %252, i64* %z3.addr, align 8
  %253 = load i64, i64* %t40.addr, align 8
  %254 = load i64, i64* %y1.addr, align 8
  %255 = and i64 %253, %254
  store i64 %255, i64* %z4.addr, align 8
  %256 = load i64, i64* %t29.addr, align 8
  %257 = load i64, i64* %y7.addr, align 8
  %258 = and i64 %256, %257
  store i64 %258, i64* %z5.addr, align 8
  %259 = load i64, i64* %t42.addr, align 8
  %260 = load i64, i64* %y11.addr, align 8
  %261 = and i64 %259, %260
  store i64 %261, i64* %z6.addr, align 8
  %262 = load i64, i64* %t45.addr, align 8
  %263 = load i64, i64* %y17.addr, align 8
  %264 = and i64 %262, %263
  store i64 %264, i64* %z7.addr, align 8
  %265 = load i64, i64* %t41.addr, align 8
  %266 = load i64, i64* %y10.addr, align 8
  %267 = and i64 %265, %266
  store i64 %267, i64* %z8.addr, align 8
  %268 = load i64, i64* %t44.addr, align 8
  %269 = load i64, i64* %y12.addr, align 8
  %270 = and i64 %268, %269
  store i64 %270, i64* %z9.addr, align 8
  %271 = load i64, i64* %t37.addr, align 8
  %272 = load i64, i64* %y3.addr, align 8
  %273 = and i64 %271, %272
  store i64 %273, i64* %z10.addr, align 8
  %274 = load i64, i64* %t33.addr, align 8
  %275 = load i64, i64* %y4.addr, align 8
  %276 = and i64 %274, %275
  store i64 %276, i64* %z11.addr, align 8
  %277 = load i64, i64* %t43.addr, align 8
  %278 = load i64, i64* %y13.addr, align 8
  %279 = and i64 %277, %278
  store i64 %279, i64* %z12.addr, align 8
  %280 = load i64, i64* %t40.addr, align 8
  %281 = load i64, i64* %y5.addr, align 8
  %282 = and i64 %280, %281
  store i64 %282, i64* %z13.addr, align 8
  %283 = load i64, i64* %t29.addr, align 8
  %284 = load i64, i64* %y2.addr, align 8
  %285 = and i64 %283, %284
  store i64 %285, i64* %z14.addr, align 8
  %286 = load i64, i64* %t42.addr, align 8
  %287 = load i64, i64* %y9.addr, align 8
  %288 = and i64 %286, %287
  store i64 %288, i64* %z15.addr, align 8
  %289 = load i64, i64* %t45.addr, align 8
  %290 = load i64, i64* %y14.addr, align 8
  %291 = and i64 %289, %290
  store i64 %291, i64* %z16.addr, align 8
  %292 = load i64, i64* %t41.addr, align 8
  %293 = load i64, i64* %y8.addr, align 8
  %294 = and i64 %292, %293
  store i64 %294, i64* %z17.addr, align 8
  %295 = load i64, i64* %z15.addr, align 8
  %296 = load i64, i64* %z16.addr, align 8
  %297 = xor i64 %295, %296
  store i64 %297, i64* %t46.addr, align 8
  %298 = load i64, i64* %z10.addr, align 8
  %299 = load i64, i64* %z11.addr, align 8
  %300 = xor i64 %298, %299
  store i64 %300, i64* %t47.addr, align 8
  %301 = load i64, i64* %z5.addr, align 8
  %302 = load i64, i64* %z13.addr, align 8
  %303 = xor i64 %301, %302
  store i64 %303, i64* %t48.addr, align 8
  %304 = load i64, i64* %z9.addr, align 8
  %305 = load i64, i64* %z10.addr, align 8
  %306 = xor i64 %304, %305
  store i64 %306, i64* %t49.addr, align 8
  %307 = load i64, i64* %z2.addr, align 8
  %308 = load i64, i64* %z12.addr, align 8
  %309 = xor i64 %307, %308
  store i64 %309, i64* %t50.addr, align 8
  %310 = load i64, i64* %z2.addr, align 8
  %311 = load i64, i64* %z5.addr, align 8
  %312 = xor i64 %310, %311
  store i64 %312, i64* %t51.addr, align 8
  %313 = load i64, i64* %z7.addr, align 8
  %314 = load i64, i64* %z8.addr, align 8
  %315 = xor i64 %313, %314
  store i64 %315, i64* %t52.addr, align 8
  %316 = load i64, i64* %z0.addr, align 8
  %317 = load i64, i64* %z3.addr, align 8
  %318 = xor i64 %316, %317
  store i64 %318, i64* %t53.addr, align 8
  %319 = load i64, i64* %z6.addr, align 8
  %320 = load i64, i64* %z7.addr, align 8
  %321 = xor i64 %319, %320
  store i64 %321, i64* %t54.addr, align 8
  %322 = load i64, i64* %z16.addr, align 8
  %323 = load i64, i64* %z17.addr, align 8
  %324 = xor i64 %322, %323
  store i64 %324, i64* %t55.addr, align 8
  %325 = load i64, i64* %z12.addr, align 8
  %326 = load i64, i64* %t48.addr, align 8
  %327 = xor i64 %325, %326
  store i64 %327, i64* %t56.addr, align 8
  %328 = load i64, i64* %t50.addr, align 8
  %329 = load i64, i64* %t53.addr, align 8
  %330 = xor i64 %328, %329
  store i64 %330, i64* %t57.addr, align 8
  %331 = load i64, i64* %z4.addr, align 8
  %332 = load i64, i64* %t46.addr, align 8
  %333 = xor i64 %331, %332
  store i64 %333, i64* %t58.addr, align 8
  %334 = load i64, i64* %z3.addr, align 8
  %335 = load i64, i64* %t54.addr, align 8
  %336 = xor i64 %334, %335
  store i64 %336, i64* %t59.addr, align 8
  %337 = load i64, i64* %t46.addr, align 8
  %338 = load i64, i64* %t57.addr, align 8
  %339 = xor i64 %337, %338
  store i64 %339, i64* %t60.addr, align 8
  %340 = load i64, i64* %z14.addr, align 8
  %341 = load i64, i64* %t57.addr, align 8
  %342 = xor i64 %340, %341
  store i64 %342, i64* %t61.addr, align 8
  %343 = load i64, i64* %t52.addr, align 8
  %344 = load i64, i64* %t58.addr, align 8
  %345 = xor i64 %343, %344
  store i64 %345, i64* %t62.addr, align 8
  %346 = load i64, i64* %t49.addr, align 8
  %347 = load i64, i64* %t58.addr, align 8
  %348 = xor i64 %346, %347
  store i64 %348, i64* %t63.addr, align 8
  %349 = load i64, i64* %z4.addr, align 8
  %350 = load i64, i64* %t59.addr, align 8
  %351 = xor i64 %349, %350
  store i64 %351, i64* %t64.addr, align 8
  %352 = load i64, i64* %t61.addr, align 8
  %353 = load i64, i64* %t62.addr, align 8
  %354 = xor i64 %352, %353
  store i64 %354, i64* %t65.addr, align 8
  %355 = load i64, i64* %z1.addr, align 8
  %356 = load i64, i64* %t63.addr, align 8
  %357 = xor i64 %355, %356
  store i64 %357, i64* %t66.addr, align 8
  %358 = load i64, i64* %t59.addr, align 8
  %359 = load i64, i64* %t63.addr, align 8
  %360 = xor i64 %358, %359
  store i64 %360, i64* %s0.addr, align 8
  %361 = load i64, i64* %t56.addr, align 8
  %362 = load i64, i64* %t62.addr, align 8
  %363 = xor i64 %362, -1
  %364 = xor i64 %361, %363
  store i64 %364, i64* %s6.addr, align 8
  %365 = load i64, i64* %t48.addr, align 8
  %366 = load i64, i64* %t60.addr, align 8
  %367 = xor i64 %366, -1
  %368 = xor i64 %365, %367
  store i64 %368, i64* %s7.addr, align 8
  %369 = load i64, i64* %t64.addr, align 8
  %370 = load i64, i64* %t65.addr, align 8
  %371 = xor i64 %369, %370
  store i64 %371, i64* %t67.addr, align 8
  %372 = load i64, i64* %t53.addr, align 8
  %373 = load i64, i64* %t66.addr, align 8
  %374 = xor i64 %372, %373
  store i64 %374, i64* %s3.addr, align 8
  %375 = load i64, i64* %t51.addr, align 8
  %376 = load i64, i64* %t66.addr, align 8
  %377 = xor i64 %375, %376
  store i64 %377, i64* %s4.addr, align 8
  %378 = load i64, i64* %t47.addr, align 8
  %379 = load i64, i64* %t65.addr, align 8
  %380 = xor i64 %378, %379
  store i64 %380, i64* %s5.addr, align 8
  %381 = load i64, i64* %t64.addr, align 8
  %382 = load i64, i64* %s3.addr, align 8
  %383 = xor i64 %382, -1
  %384 = xor i64 %381, %383
  store i64 %384, i64* %s1.addr, align 8
  %385 = load i64, i64* %t55.addr, align 8
  %386 = load i64, i64* %t67.addr, align 8
  %387 = xor i64 %386, -1
  %388 = xor i64 %385, %387
  store i64 %388, i64* %s2.addr, align 8
  %389 = load i64, i64* %s0.addr, align 8
  %390 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %391 = load i8*, i8** %390, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %392 = bitcast i8* %391 to i64*
  %393 = getelementptr inbounds i64, i64* %392, i64 7
  store i64 %389, i64* %393, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %394 = load i64, i64* %s1.addr, align 8
  %395 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %396 = load i8*, i8** %395, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %397 = bitcast i8* %396 to i64*
  %398 = getelementptr inbounds i64, i64* %397, i64 6
  store i64 %394, i64* %398, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %399 = load i64, i64* %s2.addr, align 8
  %400 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %401 = load i8*, i8** %400, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %402 = bitcast i8* %401 to i64*
  %403 = getelementptr inbounds i64, i64* %402, i64 5
  store i64 %399, i64* %403, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %404 = load i64, i64* %s3.addr, align 8
  %405 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %406 = load i8*, i8** %405, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %407 = bitcast i8* %406 to i64*
  %408 = getelementptr inbounds i64, i64* %407, i64 4
  store i64 %404, i64* %408, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %409 = load i64, i64* %s4.addr, align 8
  %410 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %411 = load i8*, i8** %410, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %412 = bitcast i8* %411 to i64*
  %413 = getelementptr inbounds i64, i64* %412, i64 3
  store i64 %409, i64* %413, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %414 = load i64, i64* %s5.addr, align 8
  %415 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %416 = load i8*, i8** %415, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %417 = bitcast i8* %416 to i64*
  %418 = getelementptr inbounds i64, i64* %417, i64 2
  store i64 %414, i64* %418, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %419 = load i64, i64* %s6.addr, align 8
  %420 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %421 = load i8*, i8** %420, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %422 = bitcast i8* %421 to i64*
  %423 = getelementptr inbounds i64, i64* %422, i64 1
  store i64 %419, i64* %423, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %424 = load i64, i64* %s7.addr, align 8
  %425 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %426 = load i8*, i8** %425, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %427 = bitcast i8* %426 to i64*
  %428 = getelementptr inbounds i64, i64* %427, i64 0
  store i64 %424, i64* %428, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal noundef i64 @aesShiftPlane(i64 noundef %x) #0 {
entry:
  %0 = sext i32 15 to i64
  %1 = call i64 @aesLanes(i64 %0)
  %2 = and i64 %x, %1
  %3 = sext i32 1 to i64
  %4 = and i64 %3, 63
  %5 = lshr i64 %x, %4
  %6 = sext i32 112 to i64
  %7 = call i64 @aesLanes(i64 %6)
  %8 = and i64 %5, %7
  %9 = or i64 %2, %8
  %10 = sext i32 3 to i64
  %11 = and i64 %10, 63
  %12 = shl i64 %x, %11
  %13 = sext i32 128 to i64
  %14 = call i64 @aesLanes(i64 %13)
  %15 = and i64 %12, %14
  %16 = or i64 %9, %15
  %17 = sext i32 2 to i64
  %18 = and i64 %17, 63
  %19 = lshr i64 %x, %18
  %20 = sext i32 768 to i64
  %21 = call i64 @aesLanes(i64 %20)
  %22 = and i64 %19, %21
  %23 = or i64 %16, %22
  %24 = sext i32 2 to i64
  %25 = and i64 %24, 63
  %26 = shl i64 %x, %25
  %27 = sext i32 3072 to i64
  %28 = call i64 @aesLanes(i64 %27)
  %29 = and i64 %26, %28
  %30 = or i64 %23, %29
  %31 = sext i32 3 to i64
  %32 = and i64 %31, 63
  %33 = lshr i64 %x, %32
  %34 = sext i32 4096 to i64
  %35 = call i64 @aesLanes(i64 %34)
  %36 = and i64 %33, %35
  %37 = or i64 %30, %36
  %38 = sext i32 1 to i64
  %39 = and i64 %38, 63
  %40 = shl i64 %x, %39
  %41 = sext i32 57344 to i64
  %42 = call i64 @aesLanes(i64 %41)
  %43 = and i64 %40, %42
  %44 = or i64 %37, %43
  ret i64 %44
}

define internal void @aesShiftRows(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %q) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 0
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = call i64 @aesShiftPlane(i64 %4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 0
  store i64 %5, i64* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i64*
  %13 = getelementptr inbounds i64, i64* %12, i64 1
  %14 = load i64, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %15 = call i64 @aesShiftPlane(i64 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to i64*
  %19 = getelementptr inbounds i64, i64* %18, i64 1
  store i64 %15, i64* %19, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i64*
  %23 = getelementptr inbounds i64, i64* %22, i64 2
  %24 = load i64, i64* %23, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %25 = call i64 @aesShiftPlane(i64 %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = bitcast i8* %27 to i64*
  %29 = getelementptr inbounds i64, i64* %28, i64 2
  store i64 %25, i64* %29, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i64*
  %33 = getelementptr inbounds i64, i64* %32, i64 3
  %34 = load i64, i64* %33, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %35 = call i64 @aesShiftPlane(i64 %34)
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = bitcast i8* %37 to i64*
  %39 = getelementptr inbounds i64, i64* %38, i64 3
  store i64 %35, i64* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* %41 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 4
  %44 = load i64, i64* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %45 = call i64 @aesShiftPlane(i64 %44)
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = bitcast i8* %47 to i64*
  %49 = getelementptr inbounds i64, i64* %48, i64 4
  store i64 %45, i64* %49, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = bitcast i8* %51 to i64*
  %53 = getelementptr inbounds i64, i64* %52, i64 5
  %54 = load i64, i64* %53, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %55 = call i64 @aesShiftPlane(i64 %54)
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = bitcast i8* %57 to i64*
  %59 = getelementptr inbounds i64, i64* %58, i64 5
  store i64 %55, i64* %59, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = bitcast i8* %61 to i64*
  %63 = getelementptr inbounds i64, i64* %62, i64 6
  %64 = load i64, i64* %63, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %65 = call i64 @aesShiftPlane(i64 %64)
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = bitcast i8* %67 to i64*
  %69 = getelementptr inbounds i64, i64* %68, i64 6
  store i64 %65, i64* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = bitcast i8* %71 to i64*
  %73 = getelementptr inbounds i64, i64* %72, i64 7
  %74 = load i64, i64* %73, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %75 = call i64 @aesShiftPlane(i64 %74)
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = bitcast i8* %77 to i64*
  %79 = getelementptr inbounds i64, i64* %78, i64 7
  store i64 %75, i64* %79, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal noundef i64 @aesNextRow(i64 noundef %x) #0 {
entry:
  %0 = sext i32 4 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %x, %1
  %3 = sext i32 4095 to i64
  %4 = call i64 @aesLanes(i64 %3)
  %5 = and i64 %2, %4
  %6 = sext i32 12 to i64
  %7 = and i64 %6, 63
  %8 = shl i64 %x, %7
  %9 = sext i32 61440 to i64
  %10 = call i64 @aesLanes(i64 %9)
  %11 = and i64 %8, %10
  %12 = or i64 %5, %11
  ret i64 %12
}

define internal noundef i64 @aesRowAfterNext(i64 noundef %x) #0 {
entry:
  %0 = sext i32 8 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %x, %1
  %3 = sext i32 255 to i64
  %4 = call i64 @aesLanes(i64 %3)
  %5 = and i64 %2, %4
  %6 = sext i32 8 to i64
  %7 = and i64 %6, 63
  %8 = shl i64 %x, %7
  %9 = sext i32 65280 to i64
  %10 = call i64 @aesLanes(i64 %9)
  %11 = and i64 %8, %10
  %12 = or i64 %5, %11
  ret i64 %12
}

define internal void @aesMixColumns(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %q) #1 {
entry:
  %n0.addr = alloca i64, align 8
  %n1.addr = alloca i64, align 8
  %n2.addr = alloca i64, align 8
  %n3.addr = alloca i64, align 8
  %n4.addr = alloca i64, align 8
  %n5.addr = alloca i64, align 8
  %n6.addr = alloca i64, align 8
  %n7.addr = alloca i64, align 8
  %t0.addr = alloca i64, align 8
  %t1.addr = alloca i64, align 8
  %t2.addr = alloca i64, align 8
  %t3.addr = alloca i64, align 8
  %t4.addr = alloca i64, align 8
  %t5.addr = alloca i64, align 8
  %t6.addr = alloca i64, align 8
  %t7.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 0
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = call i64 @aesNextRow(i64 %4)
  store i64 %5, i64* %n0.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 1
  %10 = load i64, i64* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %11 = call i64 @aesNextRow(i64 %10)
  store i64 %11, i64* %n1.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i64*
  %15 = getelementptr inbounds i64, i64* %14, i64 2
  %16 = load i64, i64* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %17 = call i64 @aesNextRow(i64 %16)
  store i64 %17, i64* %n2.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = bitcast i8* %19 to i64*
  %21 = getelementptr inbounds i64, i64* %20, i64 3
  %22 = load i64, i64* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %23 = call i64 @aesNextRow(i64 %22)
  store i64 %23, i64* %n3.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i64*
  %27 = getelementptr inbounds i64, i64* %26, i64 4
  %28 = load i64, i64* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %29 = call i64 @aesNextRow(i64 %28)
  store i64 %29, i64* %n4.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i64*
  %33 = getelementptr inbounds i64, i64* %32, i64 5
  %34 = load i64, i64* %33, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %35 = call i64 @aesNextRow(i64 %34)
  store i64 %35, i64* %n5.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = bitcast i8* %37 to i64*
  %39 = getelementptr inbounds i64, i64* %38, i64 6
  %40 = load i64, i64* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %41 = call i64 @aesNextRow(i64 %40)
  store i64 %41, i64* %n6.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = bitcast i8* %43 to i64*
  %45 = getelementptr inbounds i64, i64* %44, i64 7
  %46 = load i64, i64* %45, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %47 = call i64 @aesNextRow(i64 %46)
  store i64 %47, i64* %n7.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = bitcast i8* %49 to i64*
  %51 = getelementptr inbounds i64, i64* %50, i64 0
  %52 = load i64, i64* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %53 = load i64, i64* %n0.addr, align 8
  %54 = xor i64 %52, %53
  store i64 %54, i64* %t0.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = bitcast i8* %56 to i64*
  %58 = getelementptr inbounds i64, i64* %57, i64 1
  %59 = load i64, i64* %58, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %60 = load i64, i64* %n1.addr, align 8
  %61 = xor i64 %59, %60
  store i64 %61, i64* %t1.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = bitcast i8* %63 to i64*
  %65 = getelementptr inbounds i64, i64* %64, i64 2
  %66 = load i64, i64* %65, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %67 = load i64, i64* %n2.addr, align 8
  %68 = xor i64 %66, %67
  store i64 %68, i64* %t2.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = bitcast i8* %70 to i64*
  %72 = getelementptr inbounds i64, i64* %71, i64 3
  %73 = load i64, i64* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %74 = load i64, i64* %n3.addr, align 8
  %75 = xor i64 %73, %74
  store i64 %75, i64* %t3.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = bitcast i8* %77 to i64*
  %79 = getelementptr inbounds i64, i64* %78, i64 4
  %80 = load i64, i64* %79, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %81 = load i64, i64* %n4.addr, align 8
  %82 = xor i64 %80, %81
  store i64 %82, i64* %t4.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = bitcast i8* %84 to i64*
  %86 = getelementptr inbounds i64, i64* %85, i64 5
  %87 = load i64, i64* %86, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %88 = load i64, i64* %n5.addr, align 8
  %89 = xor i64 %87, %88
  store i64 %89, i64* %t5.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = bitcast i8* %91 to i64*
  %93 = getelementptr inbounds i64, i64* %92, i64 6
  %94 = load i64, i64* %93, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %95 = load i64, i64* %n6.addr, align 8
  %96 = xor i64 %94, %95
  store i64 %96, i64* %t6.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = bitcast i8* %98 to i64*
  %100 = getelementptr inbounds i64, i64* %99, i64 7
  %101 = load i64, i64* %100, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %102 = load i64, i64* %n7.addr, align 8
  %103 = xor i64 %101, %102
  store i64 %103, i64* %t7.addr, align 8
  %104 = load i64, i64* %t7.addr, align 8
  %105 = load i64, i64* %n0.addr, align 8
  %106 = xor i64 %104, %105
  %107 = load i64, i64* %t0.addr, align 8
  %108 = call i64 @aesRowAfterNext(i64 %107)
  %109 = xor i64 %106, %108
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = bitcast i8* %111 to i64*
  %113 = getelementptr inbounds i64, i64* %112, i64 0
  store i64 %109, i64* %113, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %114 = load i64, i64* %t0.addr, align 8
  %115 = load i64, i64* %t7.addr, align 8
  %116 = xor i64 %114, %115
  %117 = load i64, i64* %n1.addr, align 8
  %118 = xor i64 %116, %117
  %119 = load i64, i64* %t1.addr, align 8
  %120 = call i64 @aesRowAfterNext(i64 %119)
  %121 = xor i64 %118, %120
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = bitcast i8* %123 to i64*
  %125 = getelementptr inbounds i64, i64* %124, i64 1
  store i64 %121, i64* %125, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %126 = load i64, i64* %t1.addr, align 8
  %127 = load i64, i64* %n2.addr, align 8
  %128 = xor i64 %126, %127
  %129 = load i64, i64* %t2.addr, align 8
  %130 = call i64 @aesRowAfterNext(i64 %129)
  %131 = xor i64 %128, %130
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = bitcast i8* %133 to i64*
  %135 = getelementptr inbounds i64, i64* %134, i64 2
  store i64 %131, i64* %135, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %136 = load i64, i64* %t2.addr, align 8
  %137 = load i64, i64* %t7.addr, align 8
  %138 = xor i64 %136, %137
  %139 = load i64, i64* %n3.addr, align 8
  %140 = xor i64 %138, %139
  %141 = load i64, i64* %t3.addr, align 8
  %142 = call i64 @aesRowAfterNext(i64 %141)
  %143 = xor i64 %140, %142
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = bitcast i8* %145 to i64*
  %147 = getelementptr inbounds i64, i64* %146, i64 3
  store i64 %143, i64* %147, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %148 = load i64, i64* %t3.addr, align 8
  %149 = load i64, i64* %t7.addr, align 8
  %150 = xor i64 %148, %149
  %151 = load i64, i64* %n4.addr, align 8
  %152 = xor i64 %150, %151
  %153 = load i64, i64* %t4.addr, align 8
  %154 = call i64 @aesRowAfterNext(i64 %153)
  %155 = xor i64 %152, %154
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %158 = bitcast i8* %157 to i64*
  %159 = getelementptr inbounds i64, i64* %158, i64 4
  store i64 %155, i64* %159, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %160 = load i64, i64* %t4.addr, align 8
  %161 = load i64, i64* %n5.addr, align 8
  %162 = xor i64 %160, %161
  %163 = load i64, i64* %t5.addr, align 8
  %164 = call i64 @aesRowAfterNext(i64 %163)
  %165 = xor i64 %162, %164
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %167 = load i8*, i8** %166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %168 = bitcast i8* %167 to i64*
  %169 = getelementptr inbounds i64, i64* %168, i64 5
  store i64 %165, i64* %169, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %170 = load i64, i64* %t5.addr, align 8
  %171 = load i64, i64* %n6.addr, align 8
  %172 = xor i64 %170, %171
  %173 = load i64, i64* %t6.addr, align 8
  %174 = call i64 @aesRowAfterNext(i64 %173)
  %175 = xor i64 %172, %174
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %177 = load i8*, i8** %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = bitcast i8* %177 to i64*
  %179 = getelementptr inbounds i64, i64* %178, i64 6
  store i64 %175, i64* %179, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %180 = load i64, i64* %t6.addr, align 8
  %181 = load i64, i64* %n7.addr, align 8
  %182 = xor i64 %180, %181
  %183 = load i64, i64* %t7.addr, align 8
  %184 = call i64 @aesRowAfterNext(i64 %183)
  %185 = xor i64 %182, %184
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %187 = load i8*, i8** %186, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %188 = bitcast i8* %187 to i64*
  %189 = getelementptr inbounds i64, i64* %188, i64 7
  store i64 %185, i64* %189, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal void @aesAddRoundKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %q, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rk, i32 noundef %at) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 0
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = sext i32 %at to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %5
  %10 = load i64, i64* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %11 = xor i64 %4, %10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i64*
  %15 = getelementptr inbounds i64, i64* %14, i64 0
  store i64 %11, i64* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to i64*
  %19 = getelementptr inbounds i64, i64* %18, i64 1
  %20 = load i64, i64* %19, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %21 = add i32 %at, 1
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* %24 to i64*
  %26 = getelementptr inbounds i64, i64* %25, i64 %22
  %27 = load i64, i64* %26, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %28 = xor i64 %20, %27
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i64*
  %32 = getelementptr inbounds i64, i64* %31, i64 1
  store i64 %28, i64* %32, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = bitcast i8* %34 to i64*
  %36 = getelementptr inbounds i64, i64* %35, i64 2
  %37 = load i64, i64* %36, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %38 = add i32 %at, 2
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* %41 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 %39
  %44 = load i64, i64* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %45 = xor i64 %37, %44
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = bitcast i8* %47 to i64*
  %49 = getelementptr inbounds i64, i64* %48, i64 2
  store i64 %45, i64* %49, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = bitcast i8* %51 to i64*
  %53 = getelementptr inbounds i64, i64* %52, i64 3
  %54 = load i64, i64* %53, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %55 = add i32 %at, 3
  %56 = sext i32 %55 to i64
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = bitcast i8* %58 to i64*
  %60 = getelementptr inbounds i64, i64* %59, i64 %56
  %61 = load i64, i64* %60, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %62 = xor i64 %54, %61
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = bitcast i8* %64 to i64*
  %66 = getelementptr inbounds i64, i64* %65, i64 3
  store i64 %62, i64* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = bitcast i8* %68 to i64*
  %70 = getelementptr inbounds i64, i64* %69, i64 4
  %71 = load i64, i64* %70, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %72 = add i32 %at, 4
  %73 = sext i32 %72 to i64
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = bitcast i8* %75 to i64*
  %77 = getelementptr inbounds i64, i64* %76, i64 %73
  %78 = load i64, i64* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %79 = xor i64 %71, %78
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = bitcast i8* %81 to i64*
  %83 = getelementptr inbounds i64, i64* %82, i64 4
  store i64 %79, i64* %83, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = bitcast i8* %85 to i64*
  %87 = getelementptr inbounds i64, i64* %86, i64 5
  %88 = load i64, i64* %87, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %89 = add i32 %at, 5
  %90 = sext i32 %89 to i64
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = bitcast i8* %92 to i64*
  %94 = getelementptr inbounds i64, i64* %93, i64 %90
  %95 = load i64, i64* %94, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %96 = xor i64 %88, %95
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = bitcast i8* %98 to i64*
  %100 = getelementptr inbounds i64, i64* %99, i64 5
  store i64 %96, i64* %100, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* %102 to i64*
  %104 = getelementptr inbounds i64, i64* %103, i64 6
  %105 = load i64, i64* %104, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %106 = add i32 %at, 6
  %107 = sext i32 %106 to i64
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = bitcast i8* %109 to i64*
  %111 = getelementptr inbounds i64, i64* %110, i64 %107
  %112 = load i64, i64* %111, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %113 = xor i64 %105, %112
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = bitcast i8* %115 to i64*
  %117 = getelementptr inbounds i64, i64* %116, i64 6
  store i64 %113, i64* %117, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = bitcast i8* %119 to i64*
  %121 = getelementptr inbounds i64, i64* %120, i64 7
  %122 = load i64, i64* %121, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %123 = add i32 %at, 7
  %124 = sext i32 %123 to i64
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rk, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = bitcast i8* %126 to i64*
  %128 = getelementptr inbounds i64, i64* %127, i64 %124
  %129 = load i64, i64* %128, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %130 = xor i64 %122, %129
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %q, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = bitcast i8* %132 to i64*
  %134 = getelementptr inbounds i64, i64* %133, i64 7
  store i64 %130, i64* %134, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @aesBitslicedRound(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %q, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rk, i32 noundef %at) #1 {
entry:
  call void @aesSbox(%struct.nish_array* %q)
  call void @aesShiftRows(%struct.nish_array* %q)
  call void @aesMixColumns(%struct.nish_array* %q)
  call void @aesAddRoundKey(%struct.nish_array* %q, %struct.nish_array* %rk, i32 %at)
  ret void
}

define internal noundef i64 @ghashMul32(i64 noundef %x, i64 noundef %y) #0 {
entry:
  %m0.addr = alloca i64, align 8
  %m1.addr = alloca i64, align 8
  %m2.addr = alloca i64, align 8
  %m3.addr = alloca i64, align 8
  %x0.addr = alloca i64, align 8
  %x1.addr = alloca i64, align 8
  %x2.addr = alloca i64, align 8
  %x3.addr = alloca i64, align 8
  %y0.addr = alloca i64, align 8
  %y1.addr = alloca i64, align 8
  %y2.addr = alloca i64, align 8
  %y3.addr = alloca i64, align 8
  %z0.addr = alloca i64, align 8
  %z1.addr = alloca i64, align 8
  %z2.addr = alloca i64, align 8
  %z3.addr = alloca i64, align 8
  %w0.addr = alloca i64, align 8
  %0 = sext i32 286331153 to i64
  store i64 %0, i64* %m0.addr, align 8
  %1 = sext i32 572662306 to i64
  store i64 %1, i64* %m1.addr, align 8
  %2 = sext i32 1145324612 to i64
  store i64 %2, i64* %m2.addr, align 8
  %3 = load i64, i64* %m2.addr, align 8
  %4 = sext i32 1 to i64
  %5 = and i64 %4, 63
  %6 = shl i64 %3, %5
  store i64 %6, i64* %m3.addr, align 8
  %7 = load i64, i64* %m0.addr, align 8
  %8 = and i64 %x, %7
  store i64 %8, i64* %x0.addr, align 8
  %9 = load i64, i64* %m1.addr, align 8
  %10 = and i64 %x, %9
  store i64 %10, i64* %x1.addr, align 8
  %11 = load i64, i64* %m2.addr, align 8
  %12 = and i64 %x, %11
  store i64 %12, i64* %x2.addr, align 8
  %13 = load i64, i64* %m3.addr, align 8
  %14 = and i64 %x, %13
  store i64 %14, i64* %x3.addr, align 8
  %15 = load i64, i64* %m0.addr, align 8
  %16 = and i64 %y, %15
  store i64 %16, i64* %y0.addr, align 8
  %17 = load i64, i64* %m1.addr, align 8
  %18 = and i64 %y, %17
  store i64 %18, i64* %y1.addr, align 8
  %19 = load i64, i64* %m2.addr, align 8
  %20 = and i64 %y, %19
  store i64 %20, i64* %y2.addr, align 8
  %21 = load i64, i64* %m3.addr, align 8
  %22 = and i64 %y, %21
  store i64 %22, i64* %y3.addr, align 8
  %23 = load i64, i64* %x0.addr, align 8
  %24 = load i64, i64* %y0.addr, align 8
  %25 = mul i64 %23, %24
  %26 = load i64, i64* %x1.addr, align 8
  %27 = load i64, i64* %y3.addr, align 8
  %28 = mul i64 %26, %27
  %29 = xor i64 %25, %28
  %30 = load i64, i64* %x2.addr, align 8
  %31 = load i64, i64* %y2.addr, align 8
  %32 = mul i64 %30, %31
  %33 = xor i64 %29, %32
  %34 = load i64, i64* %x3.addr, align 8
  %35 = load i64, i64* %y1.addr, align 8
  %36 = mul i64 %34, %35
  %37 = xor i64 %33, %36
  store i64 %37, i64* %z0.addr, align 8
  %38 = load i64, i64* %x0.addr, align 8
  %39 = load i64, i64* %y1.addr, align 8
  %40 = mul i64 %38, %39
  %41 = load i64, i64* %x1.addr, align 8
  %42 = load i64, i64* %y0.addr, align 8
  %43 = mul i64 %41, %42
  %44 = xor i64 %40, %43
  %45 = load i64, i64* %x2.addr, align 8
  %46 = load i64, i64* %y3.addr, align 8
  %47 = mul i64 %45, %46
  %48 = xor i64 %44, %47
  %49 = load i64, i64* %x3.addr, align 8
  %50 = load i64, i64* %y2.addr, align 8
  %51 = mul i64 %49, %50
  %52 = xor i64 %48, %51
  store i64 %52, i64* %z1.addr, align 8
  %53 = load i64, i64* %x0.addr, align 8
  %54 = load i64, i64* %y2.addr, align 8
  %55 = mul i64 %53, %54
  %56 = load i64, i64* %x1.addr, align 8
  %57 = load i64, i64* %y1.addr, align 8
  %58 = mul i64 %56, %57
  %59 = xor i64 %55, %58
  %60 = load i64, i64* %x2.addr, align 8
  %61 = load i64, i64* %y0.addr, align 8
  %62 = mul i64 %60, %61
  %63 = xor i64 %59, %62
  %64 = load i64, i64* %x3.addr, align 8
  %65 = load i64, i64* %y3.addr, align 8
  %66 = mul i64 %64, %65
  %67 = xor i64 %63, %66
  store i64 %67, i64* %z2.addr, align 8
  %68 = load i64, i64* %x0.addr, align 8
  %69 = load i64, i64* %y3.addr, align 8
  %70 = mul i64 %68, %69
  %71 = load i64, i64* %x1.addr, align 8
  %72 = load i64, i64* %y2.addr, align 8
  %73 = mul i64 %71, %72
  %74 = xor i64 %70, %73
  %75 = load i64, i64* %x2.addr, align 8
  %76 = load i64, i64* %y1.addr, align 8
  %77 = mul i64 %75, %76
  %78 = xor i64 %74, %77
  %79 = load i64, i64* %x3.addr, align 8
  %80 = load i64, i64* %y0.addr, align 8
  %81 = mul i64 %79, %80
  %82 = xor i64 %78, %81
  store i64 %82, i64* %z3.addr, align 8
  %83 = load i64, i64* %m0.addr, align 8
  %84 = load i64, i64* %m0.addr, align 8
  %85 = sext i32 32 to i64
  %86 = and i64 %85, 63
  %87 = shl i64 %84, %86
  %88 = or i64 %83, %87
  store i64 %88, i64* %w0.addr, align 8
  %89 = load i64, i64* %z0.addr, align 8
  %90 = load i64, i64* %w0.addr, align 8
  %91 = and i64 %89, %90
  %92 = load i64, i64* %z1.addr, align 8
  %93 = load i64, i64* %w0.addr, align 8
  %94 = sext i32 1 to i64
  %95 = and i64 %94, 63
  %96 = shl i64 %93, %95
  %97 = and i64 %92, %96
  %98 = or i64 %91, %97
  %99 = load i64, i64* %z2.addr, align 8
  %100 = load i64, i64* %w0.addr, align 8
  %101 = sext i32 2 to i64
  %102 = and i64 %101, 63
  %103 = shl i64 %100, %102
  %104 = and i64 %99, %103
  %105 = or i64 %98, %104
  %106 = load i64, i64* %z3.addr, align 8
  %107 = load i64, i64* %w0.addr, align 8
  %108 = sext i32 3 to i64
  %109 = and i64 %108, 63
  %110 = shl i64 %107, %109
  %111 = and i64 %106, %110
  %112 = or i64 %105, %111
  ret i64 %112
}

define void @ghashMultiply(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %y, i64 noundef %hHi, i64 noundef %hLo) #1 {
entry:
  %low32.addr = alloca i64, align 8
  %thirtyTwo.addr = alloca i64, align 8
  %a1.addr = alloca i64, align 8
  %a0.addr = alloca i64, align 8
  %a2.addr = alloca i64, align 8
  %b2.addr = alloca i64, align 8
  %l0.addr = alloca i64, align 8
  %l1.addr = alloca i64, align 8
  %l2.addr = alloca i64, align 8
  %lHi.addr = alloca i64, align 8
  %lLo.addr = alloca i64, align 8
  %h0.addr = alloca i64, align 8
  %h1.addr = alloca i64, align 8
  %h2.addr = alloca i64, align 8
  %hiHi.addr = alloca i64, align 8
  %hiLo.addr = alloca i64, align 8
  %m0.addr = alloca i64, align 8
  %m1.addr = alloca i64, align 8
  %m2.addr = alloca i64, align 8
  %mHi.addr = alloca i64, align 8
  %mLo.addr = alloca i64, align 8
  %r3.addr = alloca i64, align 8
  %r2.addr = alloca i64, align 8
  %r1.addr = alloca i64, align 8
  %r0.addr = alloca i64, align 8
  %one.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %p3.addr = alloca i64, align 8
  %p2.addr = alloca i64, align 8
  %p1.addr = alloca i64, align 8
  %p0.addr = alloca i64, align 8
  %d1.addr = alloca i64, align 8
  %0 = sext i32 1 to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = sext i32 1 to i64
  %5 = sub i64 %3, %4
  store i64 %5, i64* %low32.addr, align 8
  %6 = sext i32 32 to i64
  store i64 %6, i64* %thirtyTwo.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %y, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = bitcast i8* %8 to i64*
  %10 = getelementptr inbounds i64, i64* %9, i64 0
  %11 = load i64, i64* %10, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %11, i64* %a1.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %y, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i64*
  %15 = getelementptr inbounds i64, i64* %14, i64 1
  %16 = load i64, i64* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 %16, i64* %a0.addr, align 8
  %17 = load i64, i64* %a1.addr, align 8
  %18 = load i64, i64* %a0.addr, align 8
  %19 = xor i64 %17, %18
  store i64 %19, i64* %a2.addr, align 8
  %20 = xor i64 %hHi, %hLo
  store i64 %20, i64* %b2.addr, align 8
  %21 = load i64, i64* %a0.addr, align 8
  %22 = load i64, i64* %low32.addr, align 8
  %23 = and i64 %21, %22
  %24 = load i64, i64* %low32.addr, align 8
  %25 = and i64 %hLo, %24
  %26 = call i64 @ghashMul32(i64 %23, i64 %25)
  store i64 %26, i64* %l0.addr, align 8
  %27 = load i64, i64* %a0.addr, align 8
  %28 = load i64, i64* %thirtyTwo.addr, align 8
  %29 = and i64 %28, 63
  %30 = lshr i64 %27, %29
  %31 = load i64, i64* %thirtyTwo.addr, align 8
  %32 = and i64 %31, 63
  %33 = lshr i64 %hLo, %32
  %34 = call i64 @ghashMul32(i64 %30, i64 %33)
  store i64 %34, i64* %l1.addr, align 8
  %35 = load i64, i64* %a0.addr, align 8
  %36 = load i64, i64* %a0.addr, align 8
  %37 = load i64, i64* %thirtyTwo.addr, align 8
  %38 = and i64 %37, 63
  %39 = lshr i64 %36, %38
  %40 = xor i64 %35, %39
  %41 = load i64, i64* %low32.addr, align 8
  %42 = and i64 %40, %41
  %43 = load i64, i64* %thirtyTwo.addr, align 8
  %44 = and i64 %43, 63
  %45 = lshr i64 %hLo, %44
  %46 = xor i64 %hLo, %45
  %47 = load i64, i64* %low32.addr, align 8
  %48 = and i64 %46, %47
  %49 = call i64 @ghashMul32(i64 %42, i64 %48)
  %50 = load i64, i64* %l0.addr, align 8
  %51 = xor i64 %49, %50
  %52 = load i64, i64* %l1.addr, align 8
  %53 = xor i64 %51, %52
  store i64 %53, i64* %l2.addr, align 8
  %54 = load i64, i64* %l1.addr, align 8
  %55 = load i64, i64* %l2.addr, align 8
  %56 = load i64, i64* %thirtyTwo.addr, align 8
  %57 = and i64 %56, 63
  %58 = lshr i64 %55, %57
  %59 = xor i64 %54, %58
  store i64 %59, i64* %lHi.addr, align 8
  %60 = load i64, i64* %l0.addr, align 8
  %61 = load i64, i64* %l2.addr, align 8
  %62 = load i64, i64* %thirtyTwo.addr, align 8
  %63 = and i64 %62, 63
  %64 = shl i64 %61, %63
  %65 = xor i64 %60, %64
  store i64 %65, i64* %lLo.addr, align 8
  %66 = load i64, i64* %a1.addr, align 8
  %67 = load i64, i64* %low32.addr, align 8
  %68 = and i64 %66, %67
  %69 = load i64, i64* %low32.addr, align 8
  %70 = and i64 %hHi, %69
  %71 = call i64 @ghashMul32(i64 %68, i64 %70)
  store i64 %71, i64* %h0.addr, align 8
  %72 = load i64, i64* %a1.addr, align 8
  %73 = load i64, i64* %thirtyTwo.addr, align 8
  %74 = and i64 %73, 63
  %75 = lshr i64 %72, %74
  %76 = load i64, i64* %thirtyTwo.addr, align 8
  %77 = and i64 %76, 63
  %78 = lshr i64 %hHi, %77
  %79 = call i64 @ghashMul32(i64 %75, i64 %78)
  store i64 %79, i64* %h1.addr, align 8
  %80 = load i64, i64* %a1.addr, align 8
  %81 = load i64, i64* %a1.addr, align 8
  %82 = load i64, i64* %thirtyTwo.addr, align 8
  %83 = and i64 %82, 63
  %84 = lshr i64 %81, %83
  %85 = xor i64 %80, %84
  %86 = load i64, i64* %low32.addr, align 8
  %87 = and i64 %85, %86
  %88 = load i64, i64* %thirtyTwo.addr, align 8
  %89 = and i64 %88, 63
  %90 = lshr i64 %hHi, %89
  %91 = xor i64 %hHi, %90
  %92 = load i64, i64* %low32.addr, align 8
  %93 = and i64 %91, %92
  %94 = call i64 @ghashMul32(i64 %87, i64 %93)
  %95 = load i64, i64* %h0.addr, align 8
  %96 = xor i64 %94, %95
  %97 = load i64, i64* %h1.addr, align 8
  %98 = xor i64 %96, %97
  store i64 %98, i64* %h2.addr, align 8
  %99 = load i64, i64* %h1.addr, align 8
  %100 = load i64, i64* %h2.addr, align 8
  %101 = load i64, i64* %thirtyTwo.addr, align 8
  %102 = and i64 %101, 63
  %103 = lshr i64 %100, %102
  %104 = xor i64 %99, %103
  store i64 %104, i64* %hiHi.addr, align 8
  %105 = load i64, i64* %h0.addr, align 8
  %106 = load i64, i64* %h2.addr, align 8
  %107 = load i64, i64* %thirtyTwo.addr, align 8
  %108 = and i64 %107, 63
  %109 = shl i64 %106, %108
  %110 = xor i64 %105, %109
  store i64 %110, i64* %hiLo.addr, align 8
  %111 = load i64, i64* %a2.addr, align 8
  %112 = load i64, i64* %low32.addr, align 8
  %113 = and i64 %111, %112
  %114 = load i64, i64* %b2.addr, align 8
  %115 = load i64, i64* %low32.addr, align 8
  %116 = and i64 %114, %115
  %117 = call i64 @ghashMul32(i64 %113, i64 %116)
  store i64 %117, i64* %m0.addr, align 8
  %118 = load i64, i64* %a2.addr, align 8
  %119 = load i64, i64* %thirtyTwo.addr, align 8
  %120 = and i64 %119, 63
  %121 = lshr i64 %118, %120
  %122 = load i64, i64* %b2.addr, align 8
  %123 = load i64, i64* %thirtyTwo.addr, align 8
  %124 = and i64 %123, 63
  %125 = lshr i64 %122, %124
  %126 = call i64 @ghashMul32(i64 %121, i64 %125)
  store i64 %126, i64* %m1.addr, align 8
  %127 = load i64, i64* %a2.addr, align 8
  %128 = load i64, i64* %a2.addr, align 8
  %129 = load i64, i64* %thirtyTwo.addr, align 8
  %130 = and i64 %129, 63
  %131 = lshr i64 %128, %130
  %132 = xor i64 %127, %131
  %133 = load i64, i64* %low32.addr, align 8
  %134 = and i64 %132, %133
  %135 = load i64, i64* %b2.addr, align 8
  %136 = load i64, i64* %b2.addr, align 8
  %137 = load i64, i64* %thirtyTwo.addr, align 8
  %138 = and i64 %137, 63
  %139 = lshr i64 %136, %138
  %140 = xor i64 %135, %139
  %141 = load i64, i64* %low32.addr, align 8
  %142 = and i64 %140, %141
  %143 = call i64 @ghashMul32(i64 %134, i64 %142)
  %144 = load i64, i64* %m0.addr, align 8
  %145 = xor i64 %143, %144
  %146 = load i64, i64* %m1.addr, align 8
  %147 = xor i64 %145, %146
  store i64 %147, i64* %m2.addr, align 8
  %148 = load i64, i64* %m1.addr, align 8
  %149 = load i64, i64* %m2.addr, align 8
  %150 = load i64, i64* %thirtyTwo.addr, align 8
  %151 = and i64 %150, 63
  %152 = lshr i64 %149, %151
  %153 = xor i64 %148, %152
  %154 = load i64, i64* %lHi.addr, align 8
  %155 = xor i64 %153, %154
  %156 = load i64, i64* %hiHi.addr, align 8
  %157 = xor i64 %155, %156
  store i64 %157, i64* %mHi.addr, align 8
  %158 = load i64, i64* %m0.addr, align 8
  %159 = load i64, i64* %m2.addr, align 8
  %160 = load i64, i64* %thirtyTwo.addr, align 8
  %161 = and i64 %160, 63
  %162 = shl i64 %159, %161
  %163 = xor i64 %158, %162
  %164 = load i64, i64* %lLo.addr, align 8
  %165 = xor i64 %163, %164
  %166 = load i64, i64* %hiLo.addr, align 8
  %167 = xor i64 %165, %166
  store i64 %167, i64* %mLo.addr, align 8
  %168 = load i64, i64* %hiHi.addr, align 8
  store i64 %168, i64* %r3.addr, align 8
  %169 = load i64, i64* %hiLo.addr, align 8
  %170 = load i64, i64* %mHi.addr, align 8
  %171 = xor i64 %169, %170
  store i64 %171, i64* %r2.addr, align 8
  %172 = load i64, i64* %lHi.addr, align 8
  %173 = load i64, i64* %mLo.addr, align 8
  %174 = xor i64 %172, %173
  store i64 %174, i64* %r1.addr, align 8
  %175 = load i64, i64* %lLo.addr, align 8
  store i64 %175, i64* %r0.addr, align 8
  %176 = sext i32 1 to i64
  store i64 %176, i64* %one.addr, align 8
  %177 = sext i32 63 to i64
  store i64 %177, i64* %top.addr, align 8
  %178 = load i64, i64* %r3.addr, align 8
  %179 = load i64, i64* %one.addr, align 8
  %180 = and i64 %179, 63
  %181 = shl i64 %178, %180
  %182 = load i64, i64* %r2.addr, align 8
  %183 = load i64, i64* %top.addr, align 8
  %184 = and i64 %183, 63
  %185 = lshr i64 %182, %184
  %186 = or i64 %181, %185
  store i64 %186, i64* %p3.addr, align 8
  %187 = load i64, i64* %r2.addr, align 8
  %188 = load i64, i64* %one.addr, align 8
  %189 = and i64 %188, 63
  %190 = shl i64 %187, %189
  %191 = load i64, i64* %r1.addr, align 8
  %192 = load i64, i64* %top.addr, align 8
  %193 = and i64 %192, 63
  %194 = lshr i64 %191, %193
  %195 = or i64 %190, %194
  store i64 %195, i64* %p2.addr, align 8
  %196 = load i64, i64* %r1.addr, align 8
  %197 = load i64, i64* %one.addr, align 8
  %198 = and i64 %197, 63
  %199 = shl i64 %196, %198
  %200 = load i64, i64* %r0.addr, align 8
  %201 = load i64, i64* %top.addr, align 8
  %202 = and i64 %201, 63
  %203 = lshr i64 %200, %202
  %204 = or i64 %199, %203
  store i64 %204, i64* %p1.addr, align 8
  %205 = load i64, i64* %r0.addr, align 8
  %206 = load i64, i64* %one.addr, align 8
  %207 = and i64 %206, 63
  %208 = shl i64 %205, %207
  store i64 %208, i64* %p0.addr, align 8
  %209 = load i64, i64* %p1.addr, align 8
  %210 = load i64, i64* %p0.addr, align 8
  %211 = sext i32 63 to i64
  %212 = and i64 %211, 63
  %213 = shl i64 %210, %212
  %214 = xor i64 %209, %213
  %215 = load i64, i64* %p0.addr, align 8
  %216 = sext i32 62 to i64
  %217 = and i64 %216, 63
  %218 = shl i64 %215, %217
  %219 = xor i64 %214, %218
  %220 = load i64, i64* %p0.addr, align 8
  %221 = sext i32 57 to i64
  %222 = and i64 %221, 63
  %223 = shl i64 %220, %222
  %224 = xor i64 %219, %223
  store i64 %224, i64* %d1.addr, align 8
  %225 = load i64, i64* %p3.addr, align 8
  %226 = load i64, i64* %d1.addr, align 8
  %227 = xor i64 %225, %226
  %228 = load i64, i64* %d1.addr, align 8
  %229 = load i64, i64* %one.addr, align 8
  %230 = and i64 %229, 63
  %231 = lshr i64 %228, %230
  %232 = xor i64 %227, %231
  %233 = load i64, i64* %d1.addr, align 8
  %234 = sext i32 2 to i64
  %235 = and i64 %234, 63
  %236 = lshr i64 %233, %235
  %237 = xor i64 %232, %236
  %238 = load i64, i64* %d1.addr, align 8
  %239 = sext i32 7 to i64
  %240 = and i64 %239, 63
  %241 = lshr i64 %238, %240
  %242 = xor i64 %237, %241
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %y, i64 0, i32 2
  %244 = load i8*, i8** %243, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %245 = bitcast i8* %244 to i64*
  %246 = getelementptr inbounds i64, i64* %245, i64 0
  store i64 %242, i64* %246, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %247 = load i64, i64* %p2.addr, align 8
  %248 = load i64, i64* %p0.addr, align 8
  %249 = xor i64 %247, %248
  %250 = load i64, i64* %p0.addr, align 8
  %251 = load i64, i64* %one.addr, align 8
  %252 = and i64 %251, 63
  %253 = lshr i64 %250, %252
  %254 = xor i64 %249, %253
  %255 = load i64, i64* %d1.addr, align 8
  %256 = load i64, i64* %top.addr, align 8
  %257 = and i64 %256, 63
  %258 = shl i64 %255, %257
  %259 = xor i64 %254, %258
  %260 = load i64, i64* %p0.addr, align 8
  %261 = sext i32 2 to i64
  %262 = and i64 %261, 63
  %263 = lshr i64 %260, %262
  %264 = xor i64 %259, %263
  %265 = load i64, i64* %d1.addr, align 8
  %266 = sext i32 62 to i64
  %267 = and i64 %266, 63
  %268 = shl i64 %265, %267
  %269 = xor i64 %264, %268
  %270 = load i64, i64* %p0.addr, align 8
  %271 = sext i32 7 to i64
  %272 = and i64 %271, 63
  %273 = lshr i64 %270, %272
  %274 = xor i64 %269, %273
  %275 = load i64, i64* %d1.addr, align 8
  %276 = sext i32 57 to i64
  %277 = and i64 %276, 63
  %278 = shl i64 %275, %277
  %279 = xor i64 %274, %278
  %280 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %y, i64 0, i32 2
  %281 = load i8*, i8** %280, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %282 = bitcast i8* %281 to i64*
  %283 = getelementptr inbounds i64, i64* %282, i64 1
  store i64 %279, i64* %283, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define noundef i64 @aesGcmTagMask(i64 noundef %tagHi, i64 noundef %tagLo, i64 noundef %gotHi, i64 noundef %gotLo) #0 {
entry:
  %0 = xor i64 %tagHi, %gotHi
  %1 = xor i64 %tagLo, %gotLo
  %2 = or i64 %0, %1
  %3 = sext i32 0 to i64
  %4 = xor i64 %2, %3
  %5 = sub i64 0, %4
  %6 = or i64 %4, %5
  %7 = lshr i64 %6, 63
  %8 = sub i64 %7, 1
  %9 = call i64 asm "", "=r,0"(i64 %8) readnone nounwind
  ret i64 %9
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }

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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i64", !6, i64 0}
!12 = !{!11, !11, i64 0}
