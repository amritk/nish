@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"quiet\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"other\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"quiet32\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"other32\00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i32 @llvm.ctlz.i32(i32, i1) #1

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %y.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %zero.addr, align 8
  %1 = load double, double* %zero.addr, align 8
  %2 = fdiv double %0, %1
  store double %2, double* %nan.addr, align 8
  store double 0x401E000000000000, double* %x.addr, align 8
  store double 0x4000000000000000, double* %y.addr, align 8
  %3 = load double, double* %x.addr, align 8
  %4 = load double, double* %y.addr, align 8
  %5 = call double @nish.fmodF64(double %3, double %4)
  store double %5, double* %r.addr, align 8
  %6 = load double, double* %r.addr, align 8
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_print(i8* %7)
  %8 = load double, double* %nan.addr, align 8
  %9 = call i64 @nish.quietBitsF64(double %8)
  %10 = sext i32 32760 to i64
  %11 = sext i32 48 to i64
  %12 = and i64 %11, 63
  %13 = shl i64 %10, %12
  %14 = icmp eq i64 %9, %13
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), %cond.false ]
  call void @nish_print(i8* %15)
  %16 = load double, double* %nan.addr, align 8
  %17 = fptrunc double %16 to float
  %18 = call i32 @nish.quietBitsF32(float %17)
  %19 = icmp eq i32 %18, 2143289344
  br i1 %19, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %20 = phi i8* [ bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), %cond.true.1 ], [ bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), %cond.false.1 ]
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #1 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef i32 @nish.clz64(i64 noundef %v) #1 {
entry:
  %h.addr = alloca i32, align 4
  %0 = sext i32 32 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %v, %1
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %h.addr, align 4
  %4 = load i32, i32* %h.addr, align 4
  %5 = icmp ne i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %h.addr, align 4
  %7 = call i32 @llvm.ctlz.i32(i32 %6, i1 false)
  ret i32 %7

if.end:
  %8 = trunc i64 %v to i32
  %9 = call i32 @llvm.ctlz.i32(i32 %8, i1 false)
  %10 = add nsw i32 %9, 32
  ret i32 %10
}

define internal noundef double @nish.fmodF64(double noundef %x, double noundef %y) #2 {
entry:
  %ux.addr = alloca i64, align 8
  %uy.addr = alloca i64, align 8
  %ex.addr = alloca i32, align 4
  %ey.addr = alloca i32, align 4
  %sign.addr = alloca i64, align 8
  %mant.addr = alloca i64, align 8
  %implicit.addr = alloca i64, align 8
  %lzx.addr = alloca i32, align 4
  %lzy.addr = alloca i32, align 4
  %steps.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %up.addr = alloca i32, align 4
  %e.addr = alloca double, align 8
  %0 = bitcast double %x to i64
  store i64 %0, i64* %ux.addr, align 8
  %1 = bitcast double %y to i64
  store i64 %1, i64* %uy.addr, align 8
  %2 = load i64, i64* %ux.addr, align 8
  %3 = sext i32 52 to i64
  %4 = and i64 %3, 63
  %5 = lshr i64 %2, %4
  %6 = sext i32 2047 to i64
  %7 = and i64 %5, %6
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %ex.addr, align 4
  %9 = load i64, i64* %uy.addr, align 8
  %10 = sext i32 52 to i64
  %11 = and i64 %10, 63
  %12 = lshr i64 %9, %11
  %13 = sext i32 2047 to i64
  %14 = and i64 %12, %13
  %15 = trunc i64 %14 to i32
  store i32 %15, i32* %ey.addr, align 4
  %16 = load i64, i64* %ux.addr, align 8
  %17 = sext i32 1 to i64
  %18 = sext i32 63 to i64
  %19 = and i64 %18, 63
  %20 = shl i64 %17, %19
  %21 = and i64 %16, %20
  store i64 %21, i64* %sign.addr, align 8
  %22 = load i64, i64* %uy.addr, align 8
  %23 = sext i32 1 to i64
  %24 = and i64 %23, 63
  %25 = shl i64 %22, %24
  %26 = sext i32 0 to i64
  %27 = icmp eq i64 %25, %26
  br i1 %27, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %28 = call i1 @nish.isNan(double %y)
  br label %lor.end.1

lor.end.1:
  %29 = phi i1 [ true, %entry ], [ %28, %lor.rhs.1 ]
  br i1 %29, label %lor.end, label %lor.rhs

lor.rhs:
  %30 = load i32, i32* %ex.addr, align 4
  %31 = icmp eq i32 %30, 2047
  br label %lor.end

lor.end:
  %32 = phi i1 [ true, %lor.end.1 ], [ %31, %lor.rhs ]
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = fmul double %x, %y
  %34 = fmul double %x, %y
  %35 = fdiv double %33, %34
  ret double %35

if.end:
  %36 = load i64, i64* %ux.addr, align 8
  %37 = sext i32 1 to i64
  %38 = and i64 %37, 63
  %39 = shl i64 %36, %38
  %40 = load i64, i64* %uy.addr, align 8
  %41 = sext i32 1 to i64
  %42 = and i64 %41, 63
  %43 = shl i64 %40, %42
  %44 = icmp ule i64 %39, %43
  br i1 %44, label %if.then.1, label %if.end.1

if.then.1:
  %45 = load i64, i64* %ux.addr, align 8
  %46 = sext i32 1 to i64
  %47 = and i64 %46, 63
  %48 = shl i64 %45, %47
  %49 = load i64, i64* %uy.addr, align 8
  %50 = sext i32 1 to i64
  %51 = and i64 %50, 63
  %52 = shl i64 %49, %51
  %53 = icmp eq i64 %48, %52
  br i1 %53, label %cond.true, label %cond.false

cond.true:
  %54 = fmul double 0x0000000000000000, %x
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %55 = phi double [ %54, %cond.true ], [ %x, %cond.false ]
  ret double %55

if.end.1:
  %56 = sext i32 1 to i64
  %57 = sext i32 52 to i64
  %58 = and i64 %57, 63
  %59 = shl i64 %56, %58
  %60 = sext i32 1 to i64
  %61 = sub i64 %59, %60
  store i64 %61, i64* %mant.addr, align 8
  %62 = sext i32 1 to i64
  %63 = sext i32 52 to i64
  %64 = and i64 %63, 63
  %65 = shl i64 %62, %64
  store i64 %65, i64* %implicit.addr, align 8
  %66 = load i32, i32* %ex.addr, align 4
  %67 = icmp eq i32 %66, 0
  br i1 %67, label %cond.true.1, label %cond.false.1

cond.true.1:
  %68 = load i64, i64* %ux.addr, align 8
  %69 = sext i32 12 to i64
  %70 = and i64 %69, 63
  %71 = shl i64 %68, %70
  %72 = call i32 @nish.clz64(i64 %71)
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %73 = phi i32 [ %72, %cond.true.1 ], [ 0, %cond.false.1 ]
  store i32 %73, i32* %lzx.addr, align 4
  %74 = load i32, i32* %ey.addr, align 4
  %75 = icmp eq i32 %74, 0
  br i1 %75, label %cond.true.2, label %cond.false.2

cond.true.2:
  %76 = load i64, i64* %uy.addr, align 8
  %77 = sext i32 12 to i64
  %78 = and i64 %77, 63
  %79 = shl i64 %76, %78
  %80 = call i32 @nish.clz64(i64 %79)
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %81 = phi i32 [ %80, %cond.true.2 ], [ 0, %cond.false.2 ]
  store i32 %81, i32* %lzy.addr, align 4
  %82 = load i32, i32* %ex.addr, align 4
  %83 = icmp eq i32 %82, 0
  br i1 %83, label %cond.true.3, label %cond.false.3

cond.true.3:
  %84 = load i64, i64* %ux.addr, align 8
  %85 = load i32, i32* %lzx.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = and i64 %86, 63
  %88 = shl i64 %84, %87
  %89 = sext i32 1 to i64
  %90 = and i64 %89, 63
  %91 = shl i64 %88, %90
  br label %cond.end.3

cond.false.3:
  %92 = load i64, i64* %ux.addr, align 8
  %93 = load i64, i64* %mant.addr, align 8
  %94 = and i64 %92, %93
  %95 = load i64, i64* %implicit.addr, align 8
  %96 = or i64 %94, %95
  br label %cond.end.3

cond.end.3:
  %97 = phi i64 [ %91, %cond.true.3 ], [ %96, %cond.false.3 ]
  store i64 %97, i64* %ux.addr, align 8
  %98 = load i32, i32* %ey.addr, align 4
  %99 = icmp eq i32 %98, 0
  br i1 %99, label %cond.true.4, label %cond.false.4

cond.true.4:
  %100 = load i64, i64* %uy.addr, align 8
  %101 = load i32, i32* %lzy.addr, align 4
  %102 = sext i32 %101 to i64
  %103 = and i64 %102, 63
  %104 = shl i64 %100, %103
  %105 = sext i32 1 to i64
  %106 = and i64 %105, 63
  %107 = shl i64 %104, %106
  br label %cond.end.4

cond.false.4:
  %108 = load i64, i64* %uy.addr, align 8
  %109 = load i64, i64* %mant.addr, align 8
  %110 = and i64 %108, %109
  %111 = load i64, i64* %implicit.addr, align 8
  %112 = or i64 %110, %111
  br label %cond.end.4

cond.end.4:
  %113 = phi i64 [ %107, %cond.true.4 ], [ %112, %cond.false.4 ]
  store i64 %113, i64* %uy.addr, align 8
  %114 = load i32, i32* %ex.addr, align 4
  %115 = sitofp i32 %114 to double
  %116 = load i32, i32* %lzx.addr, align 4
  %117 = sitofp i32 %116 to double
  %118 = fsub double %115, %117
  %119 = load i32, i32* %ey.addr, align 4
  %120 = sitofp i32 %119 to double
  %121 = load i32, i32* %lzy.addr, align 4
  %122 = sitofp i32 %121 to double
  %123 = fsub double %120, %122
  %124 = fsub double %118, %123
  %125 = call i32 @llvm.fptosi.sat.i32.f64(double %124)
  store i32 %125, i32* %steps.addr, align 4
  store i32 0, i32* %step.addr, align 4
  br label %while.cond

while.cond:
  %126 = load i32, i32* %step.addr, align 4
  %127 = load i32, i32* %steps.addr, align 4
  %128 = icmp slt i32 %126, %127
  br i1 %128, label %while.body, label %while.end

while.body:
  %129 = load i64, i64* %ux.addr, align 8
  %130 = load i64, i64* %uy.addr, align 8
  %131 = icmp uge i64 %129, %130
  br i1 %131, label %cond.true.5, label %cond.false.5

cond.true.5:
  %132 = load i64, i64* %ux.addr, align 8
  %133 = load i64, i64* %uy.addr, align 8
  %134 = sub i64 %132, %133
  br label %cond.end.5

cond.false.5:
  %135 = load i64, i64* %ux.addr, align 8
  br label %cond.end.5

cond.end.5:
  %136 = phi i64 [ %134, %cond.true.5 ], [ %135, %cond.false.5 ]
  %137 = sext i32 1 to i64
  %138 = and i64 %137, 63
  %139 = shl i64 %136, %138
  store i64 %139, i64* %ux.addr, align 8
  %140 = load i32, i32* %step.addr, align 4
  %141 = add nsw i32 %140, 1
  store i32 %141, i32* %step.addr, align 4
  br label %while.cond

while.end:
  %142 = load i64, i64* %ux.addr, align 8
  %143 = load i64, i64* %uy.addr, align 8
  %144 = icmp uge i64 %142, %143
  br i1 %144, label %if.then.2, label %if.end.2

if.then.2:
  %145 = load i64, i64* %ux.addr, align 8
  %146 = load i64, i64* %uy.addr, align 8
  %147 = sub i64 %145, %146
  store i64 %147, i64* %ux.addr, align 8
  br label %if.end.2

if.end.2:
  %148 = load i64, i64* %ux.addr, align 8
  %149 = sext i32 0 to i64
  %150 = icmp eq i64 %148, %149
  br i1 %150, label %if.then.3, label %if.end.3

if.then.3:
  %151 = fmul double 0x0000000000000000, %x
  ret double %151

if.end.3:
  store i32 0, i32* %up.addr, align 4
  br label %while.cond.1

while.cond.1:
  %152 = load i32, i32* %up.addr, align 4
  %153 = icmp slt i32 %152, 53
  br i1 %153, label %land.rhs, label %land.end

land.rhs:
  %154 = load i64, i64* %ux.addr, align 8
  %155 = sext i32 52 to i64
  %156 = and i64 %155, 63
  %157 = lshr i64 %154, %156
  %158 = sext i32 0 to i64
  %159 = icmp eq i64 %157, %158
  br label %land.end

land.end:
  %160 = phi i1 [ false, %while.cond.1 ], [ %159, %land.rhs ]
  br i1 %160, label %while.body.1, label %while.end.1

while.body.1:
  %161 = load i64, i64* %ux.addr, align 8
  %162 = sext i32 1 to i64
  %163 = and i64 %162, 63
  %164 = shl i64 %161, %163
  store i64 %164, i64* %ux.addr, align 8
  %165 = load i32, i32* %up.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %up.addr, align 4
  br label %while.cond.1

while.end.1:
  %167 = load i32, i32* %ey.addr, align 4
  %168 = sitofp i32 %167 to double
  %169 = load i32, i32* %lzy.addr, align 4
  %170 = sitofp i32 %169 to double
  %171 = fsub double %168, %170
  %172 = load i32, i32* %up.addr, align 4
  %173 = sitofp i32 %172 to double
  %174 = fsub double %171, %173
  store double %174, double* %e.addr, align 8
  %175 = load double, double* %e.addr, align 8
  %176 = fcmp ogt double %175, 0x0000000000000000
  br i1 %176, label %if.then.4, label %if.else

if.then.4:
  %177 = load i64, i64* %ux.addr, align 8
  %178 = load i64, i64* %implicit.addr, align 8
  %179 = sub i64 %177, %178
  %180 = load double, double* %e.addr, align 8
  %181 = call i32 @llvm.fptosi.sat.i32.f64(double %180)
  %182 = sext i32 %181 to i64
  %183 = sext i32 52 to i64
  %184 = and i64 %183, 63
  %185 = shl i64 %182, %184
  %186 = or i64 %179, %185
  store i64 %186, i64* %ux.addr, align 8
  br label %if.end.4

if.else:
  %187 = load i64, i64* %ux.addr, align 8
  %188 = load double, double* %e.addr, align 8
  %189 = fsub double 0x3FF0000000000000, %188
  %190 = call i32 @llvm.fptosi.sat.i32.f64(double %189)
  %191 = sext i32 %190 to i64
  %192 = and i64 %191, 63
  %193 = lshr i64 %187, %192
  store i64 %193, i64* %ux.addr, align 8
  br label %if.end.4

if.end.4:
  %194 = load i64, i64* %ux.addr, align 8
  %195 = load i64, i64* %sign.addr, align 8
  %196 = or i64 %194, %195
  %197 = bitcast i64 %196 to double
  ret double %197
}

define internal noundef i64 @nish.quietBitsF64(double noundef %x) #1 {
entry:
  %0 = fcmp une double %x, %x
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = sext i32 32760 to i64
  %2 = sext i32 48 to i64
  %3 = and i64 %2, 63
  %4 = shl i64 %1, %3
  br label %cond.end

cond.false:
  %5 = bitcast double %x to i64
  br label %cond.end

cond.end:
  %6 = phi i64 [ %4, %cond.true ], [ %5, %cond.false ]
  ret i64 %6
}

define internal noundef i32 @nish.quietBitsF32(float noundef %x) #1 {
entry:
  %0 = fcmp une float %x, %x
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = bitcast float %x to i32
  br label %cond.end

cond.end:
  %2 = phi i32 [ 2143289344, %cond.true ], [ %1, %cond.false ]
  ret i32 %2
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
