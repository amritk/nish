%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

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
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  store i32 %6, i32* %a.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %b.addr, align 4
  %9 = load i32, i32* %a.addr, align 4
  %10 = icmp sge i32 %9, 0
  br i1 %10, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %11 = load i32, i32* %a.addr, align 4
  %12 = load i8*, i8** %s.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = icmp sle i32 %11, %15
  br label %land.end.2

land.end.2:
  %17 = phi i1 [ false, %while.body ], [ %16, %land.rhs.2 ]
  br i1 %17, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %18 = load i32, i32* %b.addr, align 4
  %19 = icmp sge i32 %18, 0
  br label %land.end.1

land.end.1:
  %20 = phi i1 [ false, %land.end.2 ], [ %19, %land.rhs.1 ]
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %b.addr, align 4
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = icmp sle i32 %21, %25
  br label %land.end

land.end:
  %27 = phi i1 [ false, %land.end.1 ], [ %26, %land.rhs ]
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load i32, i32* %total.addr, align 4
  %29 = load i8*, i8** %s.addr, align 8
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = load i32, i32* %a.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %b.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = call i64 @llvm.smin.i64(i64 %33, i64 %35)
  %37 = call i64 @llvm.smax.i64(i64 %33, i64 %35)
  %38 = sub i64 %37, %36
  %39 = getelementptr inbounds i8, i8* %29, i64 8
  %40 = getelementptr inbounds i8, i8* %39, i64 %36
  %41 = call i8* @nish_str_new(i8* %40, i64 %38)
  %42 = bitcast i8* %41 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = trunc i64 %43 to i32
  %45 = add nsw i32 %28, %44
  store i32 %45, i32* %total.addr, align 4
  br label %if.end

if.end:
  %46 = load i32, i32* %i.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %i.addr, align 4
  %48 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %49 = load i8*, i8** %48, align 8
  %50 = icmp eq i8* %49, %3
  br i1 %50, label %pass.rewind, label %pass.free

pass.rewind:
  %51 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %51, align 8
  br label %pass.done

pass.free:
  %52 = ptrtoint i8* %3 to i64
  %53 = add i64 %52, %5
  call void @nish_arena_release(i64 %53)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %54 = load i8*, i8** %s.addr, align 8
  %55 = bitcast i8* %54 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = trunc i64 %56 to i32
  store i32 %57, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %58 = load i32, i32* %j.addr, align 4
  %59 = icmp slt i32 %58, 4
  br i1 %59, label %while.body.1, label %while.end.1

while.body.1:
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %61 = load i8*, i8** %60, align 8
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %63 = load i64, i64* %62, align 8
  %64 = load i32, i32* %total.addr, align 4
  %65 = load i8*, i8** %s.addr, align 8
  %66 = bitcast i8* %65 to i64*
  %67 = load i64, i64* %66, align 8
  %68 = load i32, i32* %n.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = call i64 @llvm.smin.i64(i64 0, i64 %69)
  %71 = call i64 @llvm.smax.i64(i64 0, i64 %69)
  %72 = sub i64 %71, %70
  %73 = getelementptr inbounds i8, i8* %65, i64 8
  %74 = getelementptr inbounds i8, i8* %73, i64 %70
  %75 = call i8* @nish_str_new(i8* %74, i64 %72)
  %76 = bitcast i8* %75 to i64*
  %77 = load i64, i64* %76, align 8
  %78 = trunc i64 %77 to i32
  %79 = add nsw i32 %64, %78
  store i32 %79, i32* %total.addr, align 4
  %80 = load i32, i32* %j.addr, align 4
  %81 = add nsw i32 %80, 1
  store i32 %81, i32* %j.addr, align 4
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %83 = load i8*, i8** %82, align 8
  %84 = icmp eq i8* %83, %61
  br i1 %84, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %85 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %63, i64* %85, align 8
  br label %pass.done.1

pass.free.1:
  %86 = ptrtoint i8* %61 to i64
  %87 = add i64 %86, %63
  call void @nish_arena_release(i64 %87)
  br label %pass.done.1

pass.done.1:
  br label %while.cond.1

while.end.1:
  %88 = load i32, i32* %total.addr, align 4
  %89 = load i32, i32* %total.addr, align 4
  %90 = sub nsw i32 %88, %89
  store i32 %90, i32* %at.addr, align 4
  %91 = load i32, i32* %total.addr, align 4
  %92 = load i8*, i8** %s.addr, align 8
  %93 = bitcast i8* %92 to i64*
  %94 = load i64, i64* %93, align 8
  %95 = load i32, i32* %at.addr, align 4
  %96 = sext i32 %95 to i64
  %97 = call i64 @llvm.smin.i64(i64 %96, i64 %94)
  %98 = call i64 @llvm.smax.i64(i64 %97, i64 0)
  %99 = load i32, i32* %at.addr, align 4
  %100 = add nsw i32 %99, 1
  %101 = sext i32 %100 to i64
  %102 = call i64 @llvm.smin.i64(i64 %101, i64 %94)
  %103 = call i64 @llvm.smax.i64(i64 %102, i64 0)
  %104 = call i64 @llvm.smin.i64(i64 %98, i64 %103)
  %105 = call i64 @llvm.smax.i64(i64 %98, i64 %103)
  %106 = sub i64 %105, %104
  %107 = getelementptr inbounds i8, i8* %92, i64 8
  %108 = getelementptr inbounds i8, i8* %107, i64 %104
  %109 = call i8* @nish_str_new(i8* %108, i64 %106)
  %110 = bitcast i8* %109 to i64*
  %111 = load i64, i64* %110, align 8
  %112 = trunc i64 %111 to i32
  %113 = add nsw i32 %91, %112
  store i32 %113, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond.2

while.cond.2:
  %114 = load i32, i32* %k.addr, align 4
  %115 = icmp slt i32 %114, 2
  br i1 %115, label %while.body.2, label %while.end.2

while.body.2:
  %116 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %117 = load i8*, i8** %116, align 8
  %118 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %119 = load i64, i64* %118, align 8
  %120 = load i32, i32* %total.addr, align 4
  %121 = load i8*, i8** %s.addr, align 8
  %122 = bitcast i8* %121 to i64*
  %123 = load i64, i64* %122, align 8
  %124 = load i32, i32* %k.addr, align 4
  %125 = add nsw i32 %124, 1
  %126 = sext i32 %125 to i64
  %127 = call i64 @llvm.smin.i64(i64 %126, i64 %123)
  %128 = call i64 @llvm.smax.i64(i64 %127, i64 0)
  %129 = load i8*, i8** %s.addr, align 8
  %130 = bitcast i8* %129 to i64*
  %131 = load i64, i64* %130, align 8
  %132 = trunc i64 %131 to i32
  %133 = sext i32 %132 to i64
  %134 = call i64 @llvm.smin.i64(i64 %133, i64 %123)
  %135 = call i64 @llvm.smax.i64(i64 %134, i64 0)
  %136 = call i64 @llvm.smin.i64(i64 %128, i64 %135)
  %137 = call i64 @llvm.smax.i64(i64 %128, i64 %135)
  %138 = sub i64 %137, %136
  %139 = getelementptr inbounds i8, i8* %121, i64 8
  %140 = getelementptr inbounds i8, i8* %139, i64 %136
  %141 = call i8* @nish_str_new(i8* %140, i64 %138)
  %142 = bitcast i8* %141 to i64*
  %143 = load i64, i64* %142, align 8
  %144 = trunc i64 %143 to i32
  %145 = add nsw i32 %120, %144
  store i32 %145, i32* %total.addr, align 4
  %146 = load i32, i32* %k.addr, align 4
  %147 = add nsw i32 %146, 1
  store i32 %147, i32* %k.addr, align 4
  %148 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %149 = load i8*, i8** %148, align 8
  %150 = icmp eq i8* %149, %117
  br i1 %150, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %151 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %119, i64* %151, align 8
  br label %pass.done.2

pass.free.2:
  %152 = ptrtoint i8* %117 to i64
  %153 = add i64 %152, %119
  call void @nish_arena_release(i64 %153)
  br label %pass.done.2

pass.done.2:
  br label %while.cond.2

while.end.2:
  %154 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %154
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
