@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"l\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8

declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %steps.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %ahead.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %pairs.addr = alloca i32, align 4
  %j.addr.1 = alloca i32, align 4
  %rest.addr = alloca i8*, align 8
  %at.addr = alloca i32, align 4
  %rounds.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %other.addr = alloca i8*, align 8
  %codes.addr = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  store i32 0, i32* %steps.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = load i8*, i8** %word.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %0, %4
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %steps.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %steps.addr, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %12 = load i32, i32* %k.addr, align 4
  %13 = load i8*, i8** %word.addr, align 8
  %14 = call i64 @nish_str_index_of(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %12, %15
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %k.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %d.addr, align 4
  br label %do.body

do.body:
  %19 = load i32, i32* %d.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %d.addr, align 4
  br label %do.cond

do.cond:
  %23 = load i32, i32* %d.addr, align 4
  %24 = load i8*, i8** %word.addr, align 8
  %25 = bitcast i8* %24 to i64*
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = icmp sge i32 %23, %27
  %29 = xor i1 %28, true
  br i1 %29, label %do.body, label %do.end

do.end:
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %30 = load i32, i32* %i.addr.1, align 4
  %31 = load i8*, i8** %word.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = icmp slt i32 %30, %34
  br i1 %35, label %for.body.1, label %for.end.1

for.body.1:
  %36 = load i8*, i8** %word.addr, align 8
  %37 = load i32, i32* %i.addr.1, align 4
  %38 = sext i32 %37 to i64
  %39 = getelementptr inbounds i8, i8* %36, i64 8
  %40 = getelementptr inbounds i8, i8* %39, i64 %38
  %41 = load i8, i8* %40, align 1
  %42 = zext i8 %41 to i32
  %43 = icmp eq i32 %42, 108
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %sum.addr, align 4
  %45 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 1)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %46, i32* %sum.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %48 = load i32, i32* %i.addr.1, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %ahead.addr, align 4
  br label %while.cond.1

while.cond.1:
  %50 = load i32, i32* %ahead.addr, align 4
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 1)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %54 = load i8*, i8** %word.addr, align 8
  %55 = bitcast i8* %54 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = trunc i64 %56 to i32
  %58 = icmp slt i32 %52, %57
  br i1 %58, label %while.body.1, label %while.end.1

while.body.1:
  %59 = load i8*, i8** %word.addr, align 8
  %60 = load i32, i32* %ahead.addr, align 4
  %61 = add nsw i32 %60, 1
  %62 = sext i32 %61 to i64
  %63 = getelementptr inbounds i8, i8* %59, i64 8
  %64 = getelementptr inbounds i8, i8* %63, i64 %62
  %65 = load i8, i8* %64, align 1
  %66 = zext i8 %65 to i32
  %67 = icmp eq i32 %66, 108
  br i1 %67, label %if.then.1, label %if.end.1

if.then.1:
  %68 = load i32, i32* %sum.addr, align 4
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 1)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %70, i32* %sum.addr, align 4
  br label %if.end.1

if.end.1:
  %72 = load i32, i32* %ahead.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %ahead.addr, align 4
  br label %while.cond.1

while.end.1:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.2

for.cond.2:
  %74 = load i32, i32* %j.addr, align 4
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 2)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %78 = load i8*, i8** %word.addr, align 8
  %79 = bitcast i8* %78 to i64*
  %80 = load i64, i64* %79, align 8
  %81 = trunc i64 %80 to i32
  %82 = icmp sle i32 %76, %81
  br i1 %82, label %for.body.2, label %for.end.2

for.body.2:
  %83 = load i8*, i8** %word.addr, align 8
  %84 = load i32, i32* %j.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = getelementptr inbounds i8, i8* %83, i64 8
  %87 = getelementptr inbounds i8, i8* %86, i64 %85
  %88 = load i8, i8* %87, align 1
  %89 = zext i8 %88 to i32
  %90 = icmp eq i32 %89, 104
  br i1 %90, label %if.then.2, label %if.end.2

if.then.2:
  %91 = load i32, i32* %sum.addr, align 4
  %92 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 1)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %93, i32* %sum.addr, align 4
  br label %if.end.2

if.end.2:
  br label %for.inc.2

for.inc.2:
  %95 = load i32, i32* %j.addr, align 4
  %96 = add nsw i32 %95, 1
  store i32 %96, i32* %j.addr, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %pairs.addr, align 4
  store i32 0, i32* %j.addr.1, align 4
  br label %for.cond.3

for.cond.3:
  %97 = load i32, i32* %j.addr.1, align 4
  %98 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %97, i32 1)
  %99 = extractvalue { i32, i1 } %98, 0
  %100 = extractvalue { i32, i1 } %98, 1
  br i1 %100, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %101 = load i8*, i8** %word.addr, align 8
  %102 = bitcast i8* %101 to i64*
  %103 = load i64, i64* %102, align 8
  %104 = trunc i64 %103 to i32
  %105 = icmp slt i32 %99, %104
  br i1 %105, label %for.body.3, label %for.end.3

for.body.3:
  %106 = load i32, i32* %pairs.addr, align 4
  %107 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %106, i32 1)
  %108 = extractvalue { i32, i1 } %107, 0
  %109 = extractvalue { i32, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i32 %108, i32* %pairs.addr, align 4
  br label %for.inc.3

for.inc.3:
  %110 = load i32, i32* %j.addr.1, align 4
  %111 = add nsw i32 %110, 1
  store i32 %111, i32* %j.addr.1, align 4
  br label %for.cond.3

for.end.3:
  %112 = load i8*, i8** %word.addr, align 8
  store i8* %112, i8** %rest.addr, align 8
  br label %while.cond.2

while.cond.2:
  %113 = load i8*, i8** %rest.addr, align 8
  %114 = call i64 @nish_str_index_of(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %115 = trunc i64 %114 to i32
  %116 = load i8*, i8** %rest.addr, align 8
  %117 = bitcast i8* %116 to i64*
  %118 = load i64, i64* %117, align 8
  %119 = trunc i64 %118 to i32
  %120 = icmp slt i32 %115, %119
  br i1 %120, label %land.rhs, label %land.end

land.rhs:
  %121 = load i8*, i8** %rest.addr, align 8
  %122 = call i64 @nish_str_index_of(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %123 = trunc i64 %122 to i32
  %124 = icmp sge i32 %123, 0
  br label %land.end

land.end:
  %125 = phi i1 [ false, %while.cond.2 ], [ %124, %land.rhs ]
  br i1 %125, label %while.body.2, label %while.end.2

while.body.2:
  %126 = load i8*, i8** %rest.addr, align 8
  %127 = bitcast i8* %126 to i64*
  %128 = load i64, i64* %127, align 8
  %129 = load i8*, i8** %rest.addr, align 8
  %130 = call i64 @nish_str_index_of(i8* %129, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %131 = trunc i64 %130 to i32
  %132 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %131, i32 1)
  %133 = extractvalue { i32, i1 } %132, 0
  %134 = extractvalue { i32, i1 } %132, 1
  br i1 %134, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %135 = sext i32 %133 to i64
  %136 = call i64 @llvm.smin.i64(i64 %135, i64 %128)
  %137 = call i64 @llvm.smax.i64(i64 %136, i64 0)
  %138 = load i8*, i8** %rest.addr, align 8
  %139 = bitcast i8* %138 to i64*
  %140 = load i64, i64* %139, align 8
  %141 = trunc i64 %140 to i32
  %142 = sext i32 %141 to i64
  %143 = call i64 @llvm.smin.i64(i64 %142, i64 %128)
  %144 = call i64 @llvm.smax.i64(i64 %143, i64 0)
  %145 = call i64 @llvm.smin.i64(i64 %137, i64 %144)
  %146 = call i64 @llvm.smax.i64(i64 %137, i64 %144)
  %147 = sub i64 %146, %145
  %148 = getelementptr inbounds i8, i8* %126, i64 8
  %149 = getelementptr inbounds i8, i8* %148, i64 %145
  %150 = call i8* @nish_str_new(i8* %149, i64 %147)
  store i8* %150, i8** %rest.addr, align 8
  br label %while.cond.2

while.end.2:
  %151 = load i8*, i8** %word.addr, align 8
  %152 = call i64 @nish_str_index_of(i8* %151, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %153 = trunc i64 %152 to i32
  store i32 %153, i32* %at.addr, align 4
  store i32 0, i32* %rounds.addr, align 4
  br label %while.cond.3

while.cond.3:
  %154 = load i32, i32* %at.addr, align 4
  %155 = load i8*, i8** %word.addr, align 8
  %156 = bitcast i8* %155 to i64*
  %157 = load i64, i64* %156, align 8
  %158 = trunc i64 %157 to i32
  %159 = icmp slt i32 %154, %158
  br i1 %159, label %while.body.3, label %while.end.3

while.body.3:
  %160 = load i32, i32* %rounds.addr, align 4
  %161 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %160, i32 1)
  %162 = extractvalue { i32, i1 } %161, 0
  %163 = extractvalue { i32, i1 } %161, 1
  br i1 %163, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  store i32 %162, i32* %rounds.addr, align 4
  %164 = load i32, i32* %at.addr, align 4
  %165 = load i32, i32* %rounds.addr, align 4
  %166 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %164, i32 %165)
  %167 = extractvalue { i32, i1 } %166, 0
  %168 = extractvalue { i32, i1 } %166, 1
  br i1 %168, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  store i32 %167, i32* %at.addr, align 4
  br label %while.cond.3

while.end.3:
  store i32 0, i32* %m.addr, align 4
  br label %while.cond.4

while.cond.4:
  %169 = load i32, i32* %m.addr, align 4
  %170 = load i8*, i8** %word.addr, align 8
  %171 = bitcast i8* %170 to i64*
  %172 = load i64, i64* %171, align 8
  %173 = trunc i64 %172 to i32
  %174 = icmp slt i32 %169, %173
  br i1 %174, label %while.body.4, label %while.end.4

while.body.4:
  %175 = load i32, i32* %m.addr, align 4
  %176 = load i32, i32* %rounds.addr, align 4
  %177 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %175, i32 %176)
  %178 = extractvalue { i32, i1 } %177, 0
  %179 = extractvalue { i32, i1 } %177, 1
  br i1 %179, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  store i32 %178, i32* %m.addr, align 4
  br label %while.cond.4

while.end.4:
  store i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8** %other.addr, align 8
  store i32 0, i32* %codes.addr, align 4
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.4

for.cond.4:
  %180 = load i32, i32* %i.addr.2, align 4
  %181 = load i8*, i8** %word.addr, align 8
  %182 = bitcast i8* %181 to i64*
  %183 = load i64, i64* %182, align 8
  %184 = trunc i64 %183 to i32
  %185 = icmp slt i32 %180, %184
  br i1 %185, label %for.body.4, label %for.end.4

for.body.4:
  %186 = load i32, i32* %codes.addr, align 4
  %187 = load i8*, i8** %other.addr, align 8
  %188 = load i32, i32* %i.addr.2, align 4
  %189 = sext i32 %188 to i64
  %190 = bitcast i8* %187 to i64*
  %191 = load i64, i64* %190, align 8
  %192 = icmp ult i64 %189, %191
  br i1 %192, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %189, i64 %191)
  unreachable

bounds.ok:
  %193 = getelementptr inbounds i8, i8* %187, i64 8
  %194 = getelementptr inbounds i8, i8* %193, i64 %189
  %195 = load i8, i8* %194, align 1
  %196 = zext i8 %195 to i32
  %197 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %186, i32 %196)
  %198 = extractvalue { i32, i1 } %197, 0
  %199 = extractvalue { i32, i1 } %197, 1
  br i1 %199, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  store i32 %198, i32* %codes.addr, align 4
  br label %for.inc.4

for.inc.4:
  %200 = load i32, i32* %i.addr.2, align 4
  %201 = add nsw i32 %200, 1
  store i32 %201, i32* %i.addr.2, align 4
  br label %for.cond.4

for.end.4:
  %202 = load i32, i32* %steps.addr, align 4
  %203 = load i32, i32* %k.addr, align 4
  %204 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %202, i32 %203)
  %205 = extractvalue { i32, i1 } %204, 0
  %206 = extractvalue { i32, i1 } %204, 1
  br i1 %206, label %ovf.fail, label %ovf.ok.14

ovf.ok.14:
  %207 = load i32, i32* %d.addr, align 4
  %208 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %205, i32 %207)
  %209 = extractvalue { i32, i1 } %208, 0
  %210 = extractvalue { i32, i1 } %208, 1
  br i1 %210, label %ovf.fail, label %ovf.ok.15

ovf.ok.15:
  %211 = call i8* @nish_str_from_i32(i32 %209)
  call void @nish_print(i8* %211)
  %212 = load i32, i32* %sum.addr, align 4
  %213 = call i8* @nish_str_from_i32(i32 %212)
  call void @nish_print(i8* %213)
  %214 = load i32, i32* %pairs.addr, align 4
  %215 = load i32, i32* %rounds.addr, align 4
  %216 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %214, i32 %215)
  %217 = extractvalue { i32, i1 } %216, 0
  %218 = extractvalue { i32, i1 } %216, 1
  br i1 %218, label %ovf.fail, label %ovf.ok.16

ovf.ok.16:
  %219 = call i8* @nish_str_from_i32(i32 %217)
  call void @nish_print(i8* %219)
  %220 = load i8*, i8** %rest.addr, align 8
  call void @nish_print(i8* %220)
  %221 = load i32, i32* %codes.addr, align 4
  %222 = call i8* @nish_str_from_i32(i32 %221)
  call void @nish_print(i8* %222)
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
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
