target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define noundef double @remF64(double noundef %x, double noundef %y) #0 {
entry:
  %0 = call double @nish.fmodF64(double %x, double %y)
  ret double %0
}

define noundef float @remF32(float noundef %x, float noundef %y) #0 {
entry:
  %r.addr = alloca float, align 4
  store float %x, float* %r.addr, align 4
  %0 = load float, float* %r.addr, align 4
  %1 = fpext float %0 to double
  %2 = fpext float %y to double
  %3 = call double @nish.fmodF64(double %1, double %2)
  %4 = fptrunc double %3 to float
  store float %4, float* %r.addr, align 4
  %5 = load float, float* %r.addr, align 4
  ret float %5
}

define noundef i32 @remI32(i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = icmp eq i32 %y, 0
  %1 = icmp eq i32 %x, -2147483648
  %2 = icmp eq i32 %y, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %x, %y
  ret i32 %5
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #1 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef double @nish.fmodF64(double noundef %x, double noundef %y) #0 {
entry:
  %ux.addr = alloca i64, align 8
  %uy.addr = alloca i64, align 8
  %ex.addr = alloca i32, align 4
  %ey.addr = alloca i32, align 4
  %sign.addr = alloca i64, align 8
  %mant.addr = alloca i64, align 8
  %implicit.addr = alloca i64, align 8
  %i.addr = alloca i64, align 8
  %i.addr.1 = alloca i64, align 8
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
  br i1 %67, label %if.then.2, label %if.else

if.then.2:
  %68 = load i64, i64* %ux.addr, align 8
  %69 = sext i32 12 to i64
  %70 = and i64 %69, 63
  %71 = shl i64 %68, %70
  store i64 %71, i64* %i.addr, align 8
  br label %while.cond

while.cond:
  %72 = load i64, i64* %i.addr, align 8
  %73 = sext i32 63 to i64
  %74 = and i64 %73, 63
  %75 = lshr i64 %72, %74
  %76 = sext i32 0 to i64
  %77 = icmp eq i64 %75, %76
  br i1 %77, label %while.body, label %while.end

while.body:
  %78 = load i32, i32* %ex.addr, align 4
  %79 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %78, i32 1)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %80, i32* %ex.addr, align 4
  %82 = load i64, i64* %i.addr, align 8
  %83 = sext i32 1 to i64
  %84 = and i64 %83, 63
  %85 = shl i64 %82, %84
  store i64 %85, i64* %i.addr, align 8
  br label %while.cond

while.end:
  %86 = load i64, i64* %ux.addr, align 8
  %87 = load i32, i32* %ex.addr, align 4
  %88 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %91 = sext i32 %89 to i64
  %92 = and i64 %91, 63
  %93 = shl i64 %86, %92
  store i64 %93, i64* %ux.addr, align 8
  br label %if.end.2

if.else:
  %94 = load i64, i64* %ux.addr, align 8
  %95 = load i64, i64* %mant.addr, align 8
  %96 = and i64 %94, %95
  %97 = load i64, i64* %implicit.addr, align 8
  %98 = or i64 %96, %97
  store i64 %98, i64* %ux.addr, align 8
  br label %if.end.2

if.end.2:
  %99 = load i32, i32* %ey.addr, align 4
  %100 = icmp eq i32 %99, 0
  br i1 %100, label %if.then.3, label %if.else.1

if.then.3:
  %101 = load i64, i64* %uy.addr, align 8
  %102 = sext i32 12 to i64
  %103 = and i64 %102, 63
  %104 = shl i64 %101, %103
  store i64 %104, i64* %i.addr.1, align 8
  br label %while.cond.1

while.cond.1:
  %105 = load i64, i64* %i.addr.1, align 8
  %106 = sext i32 63 to i64
  %107 = and i64 %106, 63
  %108 = lshr i64 %105, %107
  %109 = sext i32 0 to i64
  %110 = icmp eq i64 %108, %109
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %ey.addr, align 4
  %112 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %111, i32 1)
  %113 = extractvalue { i32, i1 } %112, 0
  %114 = extractvalue { i32, i1 } %112, 1
  br i1 %114, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %113, i32* %ey.addr, align 4
  %115 = load i64, i64* %i.addr.1, align 8
  %116 = sext i32 1 to i64
  %117 = and i64 %116, 63
  %118 = shl i64 %115, %117
  store i64 %118, i64* %i.addr.1, align 8
  br label %while.cond.1

while.end.1:
  %119 = load i64, i64* %uy.addr, align 8
  %120 = load i32, i32* %ey.addr, align 4
  %121 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %124 = sext i32 %122 to i64
  %125 = and i64 %124, 63
  %126 = shl i64 %119, %125
  store i64 %126, i64* %uy.addr, align 8
  br label %if.end.3

if.else.1:
  %127 = load i64, i64* %uy.addr, align 8
  %128 = load i64, i64* %mant.addr, align 8
  %129 = and i64 %127, %128
  %130 = load i64, i64* %implicit.addr, align 8
  %131 = or i64 %129, %130
  store i64 %131, i64* %uy.addr, align 8
  br label %if.end.3

if.end.3:
  br label %while.cond.2

while.cond.2:
  %132 = load i32, i32* %ex.addr, align 4
  %133 = load i32, i32* %ey.addr, align 4
  %134 = icmp sgt i32 %132, %133
  br i1 %134, label %while.body.2, label %while.end.2

while.body.2:
  %135 = load i64, i64* %ux.addr, align 8
  %136 = load i64, i64* %uy.addr, align 8
  %137 = icmp uge i64 %135, %136
  br i1 %137, label %if.then.4, label %if.end.4

if.then.4:
  %138 = load i64, i64* %ux.addr, align 8
  %139 = load i64, i64* %uy.addr, align 8
  %140 = icmp eq i64 %138, %139
  br i1 %140, label %if.then.5, label %if.end.5

if.then.5:
  %141 = fmul double 0x0000000000000000, %x
  ret double %141

if.end.5:
  %142 = load i64, i64* %ux.addr, align 8
  %143 = load i64, i64* %uy.addr, align 8
  %144 = sub i64 %142, %143
  store i64 %144, i64* %ux.addr, align 8
  br label %if.end.4

if.end.4:
  %145 = load i64, i64* %ux.addr, align 8
  %146 = sext i32 1 to i64
  %147 = and i64 %146, 63
  %148 = shl i64 %145, %147
  store i64 %148, i64* %ux.addr, align 8
  %149 = load i32, i32* %ex.addr, align 4
  %150 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %149, i32 1)
  %151 = extractvalue { i32, i1 } %150, 0
  %152 = extractvalue { i32, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %151, i32* %ex.addr, align 4
  br label %while.cond.2

while.end.2:
  %153 = load i64, i64* %ux.addr, align 8
  %154 = load i64, i64* %uy.addr, align 8
  %155 = icmp uge i64 %153, %154
  br i1 %155, label %if.then.6, label %if.end.6

if.then.6:
  %156 = load i64, i64* %ux.addr, align 8
  %157 = load i64, i64* %uy.addr, align 8
  %158 = icmp eq i64 %156, %157
  br i1 %158, label %if.then.7, label %if.end.7

if.then.7:
  %159 = fmul double 0x0000000000000000, %x
  ret double %159

if.end.7:
  %160 = load i64, i64* %ux.addr, align 8
  %161 = load i64, i64* %uy.addr, align 8
  %162 = sub i64 %160, %161
  store i64 %162, i64* %ux.addr, align 8
  br label %if.end.6

if.end.6:
  br label %while.cond.3

while.cond.3:
  %163 = load i64, i64* %ux.addr, align 8
  %164 = sext i32 52 to i64
  %165 = and i64 %164, 63
  %166 = lshr i64 %163, %165
  %167 = sext i32 0 to i64
  %168 = icmp eq i64 %166, %167
  br i1 %168, label %while.body.3, label %while.end.3

while.body.3:
  %169 = load i64, i64* %ux.addr, align 8
  %170 = sext i32 1 to i64
  %171 = and i64 %170, 63
  %172 = shl i64 %169, %171
  store i64 %172, i64* %ux.addr, align 8
  %173 = load i32, i32* %ex.addr, align 4
  %174 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %173, i32 1)
  %175 = extractvalue { i32, i1 } %174, 0
  %176 = extractvalue { i32, i1 } %174, 1
  br i1 %176, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %175, i32* %ex.addr, align 4
  br label %while.cond.3

while.end.3:
  %177 = load i32, i32* %ex.addr, align 4
  %178 = icmp sgt i32 %177, 0
  br i1 %178, label %if.then.8, label %if.else.2

if.then.8:
  %179 = load i64, i64* %ux.addr, align 8
  %180 = load i64, i64* %implicit.addr, align 8
  %181 = sub i64 %179, %180
  %182 = load i32, i32* %ex.addr, align 4
  %183 = sext i32 %182 to i64
  %184 = sext i32 52 to i64
  %185 = and i64 %184, 63
  %186 = shl i64 %183, %185
  %187 = or i64 %181, %186
  store i64 %187, i64* %ux.addr, align 8
  br label %if.end.8

if.else.2:
  %188 = load i64, i64* %ux.addr, align 8
  %189 = load i32, i32* %ex.addr, align 4
  %190 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %189)
  %191 = extractvalue { i32, i1 } %190, 0
  %192 = extractvalue { i32, i1 } %190, 1
  br i1 %192, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %193 = sext i32 %191 to i64
  %194 = and i64 %193, 63
  %195 = lshr i64 %188, %194
  store i64 %195, i64* %ux.addr, align 8
  br label %if.end.8

if.end.8:
  %196 = load i64, i64* %ux.addr, align 8
  %197 = load i64, i64* %sign.addr, align 8
  %198 = or i64 %196, %197
  %199 = bitcast i64 %198 to double
  ret double %199

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
