@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare i64 @llvm.smin.i64(i64, i64) #2
declare i64 @llvm.smax.i64(i64, i64) #2

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  store i32 %2, i32* %a.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %b.addr, align 4
  %5 = load i32, i32* %a.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %7 = load i32, i32* %a.addr, align 4
  %8 = load i8*, i8** %s.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = icmp sle i32 %7, %11
  br label %land.end.2

land.end.2:
  %13 = phi i1 [ false, %while.body ], [ %12, %land.rhs.2 ]
  br i1 %13, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %14 = load i32, i32* %b.addr, align 4
  %15 = icmp sge i32 %14, 0
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %b.addr, align 4
  %18 = load i8*, i8** %s.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = icmp sle i32 %17, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %land.end.1 ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = load i32, i32* %total.addr, align 4
  %25 = load i8*, i8** %s.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = load i32, i32* %a.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = load i32, i32* %b.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = call i64 @llvm.smin.i64(i64 %29, i64 %31)
  %33 = call i64 @llvm.smax.i64(i64 %29, i64 %31)
  %34 = sub i64 %33, %32
  %35 = getelementptr inbounds i8, i8* %25, i64 8
  %36 = getelementptr inbounds i8, i8* %35, i64 %32
  %37 = call i8* @nish_str_new(i8* %36, i64 %34)
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  %41 = add nsw i32 %24, %40
  store i32 %41, i32* %total.addr, align 4
  br label %if.end

if.end:
  %42 = load i32, i32* %i.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %44 = load i8*, i8** %s.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  store i32 %47, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, 4
  br i1 %49, label %while.body.1, label %while.end.1

while.body.1:
  %50 = load i32, i32* %total.addr, align 4
  %51 = load i8*, i8** %s.addr, align 8
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = load i32, i32* %n.addr, align 4
  %55 = sext i32 %54 to i64
  %56 = call i64 @llvm.smin.i64(i64 0, i64 %55)
  %57 = call i64 @llvm.smax.i64(i64 0, i64 %55)
  %58 = sub i64 %57, %56
  %59 = getelementptr inbounds i8, i8* %51, i64 8
  %60 = getelementptr inbounds i8, i8* %59, i64 %56
  %61 = call i8* @nish_str_new(i8* %60, i64 %58)
  %62 = bitcast i8* %61 to i64*
  %63 = load i64, i64* %62, align 8
  %64 = trunc i64 %63 to i32
  %65 = add nsw i32 %50, %64
  store i32 %65, i32* %total.addr, align 4
  %66 = load i32, i32* %j.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %68 = load i32, i32* %total.addr, align 4
  %69 = load i32, i32* %total.addr, align 4
  %70 = sub nsw i32 %68, %69
  store i32 %70, i32* %at.addr, align 4
  %71 = load i32, i32* %total.addr, align 4
  %72 = load i8*, i8** %s.addr, align 8
  %73 = bitcast i8* %72 to i64*
  %74 = load i64, i64* %73, align 8
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = call i64 @llvm.smin.i64(i64 %76, i64 %74)
  %78 = call i64 @llvm.smax.i64(i64 %77, i64 0)
  %79 = load i32, i32* %at.addr, align 4
  %80 = add nsw i32 %79, 1
  %81 = sext i32 %80 to i64
  %82 = call i64 @llvm.smin.i64(i64 %81, i64 %74)
  %83 = call i64 @llvm.smax.i64(i64 %82, i64 0)
  %84 = call i64 @llvm.smin.i64(i64 %78, i64 %83)
  %85 = call i64 @llvm.smax.i64(i64 %78, i64 %83)
  %86 = sub i64 %85, %84
  %87 = getelementptr inbounds i8, i8* %72, i64 8
  %88 = getelementptr inbounds i8, i8* %87, i64 %84
  %89 = call i8* @nish_str_new(i8* %88, i64 %86)
  %90 = bitcast i8* %89 to i64*
  %91 = load i64, i64* %90, align 8
  %92 = trunc i64 %91 to i32
  %93 = add nsw i32 %71, %92
  store i32 %93, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond.2

while.cond.2:
  %94 = load i32, i32* %k.addr, align 4
  %95 = icmp slt i32 %94, 2
  br i1 %95, label %while.body.2, label %while.end.2

while.body.2:
  %96 = load i32, i32* %total.addr, align 4
  %97 = load i8*, i8** %s.addr, align 8
  %98 = bitcast i8* %97 to i64*
  %99 = load i64, i64* %98, align 8
  %100 = load i32, i32* %k.addr, align 4
  %101 = add nsw i32 %100, 1
  %102 = sext i32 %101 to i64
  %103 = call i64 @llvm.smin.i64(i64 %102, i64 %99)
  %104 = call i64 @llvm.smax.i64(i64 %103, i64 0)
  %105 = load i8*, i8** %s.addr, align 8
  %106 = bitcast i8* %105 to i64*
  %107 = load i64, i64* %106, align 8
  %108 = trunc i64 %107 to i32
  %109 = sext i32 %108 to i64
  %110 = call i64 @llvm.smin.i64(i64 %109, i64 %99)
  %111 = call i64 @llvm.smax.i64(i64 %110, i64 0)
  %112 = call i64 @llvm.smin.i64(i64 %104, i64 %111)
  %113 = call i64 @llvm.smax.i64(i64 %104, i64 %111)
  %114 = sub i64 %113, %112
  %115 = getelementptr inbounds i8, i8* %97, i64 8
  %116 = getelementptr inbounds i8, i8* %115, i64 %112
  %117 = call i8* @nish_str_new(i8* %116, i64 %114)
  %118 = bitcast i8* %117 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = trunc i64 %119 to i32
  %121 = add nsw i32 %96, %120
  store i32 %121, i32* %total.addr, align 4
  %122 = load i32, i32* %k.addr, align 4
  %123 = add nsw i32 %122, 1
  store i32 %123, i32* %k.addr, align 4
  br label %while.cond.2

while.end.2:
  %124 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %124
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
