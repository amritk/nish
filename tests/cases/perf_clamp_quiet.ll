%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

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
  %45 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 %44)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %46, i32* %total.addr, align 4
  br label %if.end

if.end:
  %48 = load i32, i32* %i.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %i.addr, align 4
  %50 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %51 = load i8*, i8** %50, align 8
  %52 = icmp eq i8* %51, %3
  br i1 %52, label %pass.rewind, label %pass.free

pass.rewind:
  %53 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %53, align 8
  br label %pass.done

pass.free:
  %54 = ptrtoint i8* %3 to i64
  %55 = add i64 %54, %5
  call void @nish_arena_release(i64 %55)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %56 = load i8*, i8** %s.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  store i32 %59, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %60 = load i32, i32* %j.addr, align 4
  %61 = icmp slt i32 %60, 4
  br i1 %61, label %while.body.1, label %while.end.1

while.body.1:
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %63 = load i8*, i8** %62, align 8
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %65 = load i64, i64* %64, align 8
  %66 = load i32, i32* %total.addr, align 4
  %67 = load i8*, i8** %s.addr, align 8
  %68 = bitcast i8* %67 to i64*
  %69 = load i64, i64* %68, align 8
  %70 = load i32, i32* %n.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = call i64 @llvm.smin.i64(i64 0, i64 %71)
  %73 = call i64 @llvm.smax.i64(i64 0, i64 %71)
  %74 = sub i64 %73, %72
  %75 = getelementptr inbounds i8, i8* %67, i64 8
  %76 = getelementptr inbounds i8, i8* %75, i64 %72
  %77 = call i8* @nish_str_new(i8* %76, i64 %74)
  %78 = bitcast i8* %77 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = trunc i64 %79 to i32
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %80)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %82, i32* %total.addr, align 4
  %84 = load i32, i32* %j.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %j.addr, align 4
  %86 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %87 = load i8*, i8** %86, align 8
  %88 = icmp eq i8* %87, %63
  br i1 %88, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %89 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %65, i64* %89, align 8
  br label %pass.done.1

pass.free.1:
  %90 = ptrtoint i8* %63 to i64
  %91 = add i64 %90, %65
  call void @nish_arena_release(i64 %91)
  br label %pass.done.1

pass.done.1:
  br label %while.cond.1

while.end.1:
  %92 = load i32, i32* %total.addr, align 4
  %93 = load i32, i32* %total.addr, align 4
  %94 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %92, i32 %93)
  %95 = extractvalue { i32, i1 } %94, 0
  %96 = extractvalue { i32, i1 } %94, 1
  br i1 %96, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %95, i32* %at.addr, align 4
  %97 = load i32, i32* %total.addr, align 4
  %98 = load i8*, i8** %s.addr, align 8
  %99 = bitcast i8* %98 to i64*
  %100 = load i64, i64* %99, align 8
  %101 = load i32, i32* %at.addr, align 4
  %102 = sext i32 %101 to i64
  %103 = call i64 @llvm.smin.i64(i64 %102, i64 %100)
  %104 = call i64 @llvm.smax.i64(i64 %103, i64 0)
  %105 = load i32, i32* %at.addr, align 4
  %106 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 1)
  %107 = extractvalue { i32, i1 } %106, 0
  %108 = extractvalue { i32, i1 } %106, 1
  br i1 %108, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %109 = sext i32 %107 to i64
  %110 = call i64 @llvm.smin.i64(i64 %109, i64 %100)
  %111 = call i64 @llvm.smax.i64(i64 %110, i64 0)
  %112 = call i64 @llvm.smin.i64(i64 %104, i64 %111)
  %113 = call i64 @llvm.smax.i64(i64 %104, i64 %111)
  %114 = sub i64 %113, %112
  %115 = getelementptr inbounds i8, i8* %98, i64 8
  %116 = getelementptr inbounds i8, i8* %115, i64 %112
  %117 = call i8* @nish_str_new(i8* %116, i64 %114)
  %118 = bitcast i8* %117 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = trunc i64 %119 to i32
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %97, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %122, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond.2

while.cond.2:
  %124 = load i32, i32* %k.addr, align 4
  %125 = icmp slt i32 %124, 2
  br i1 %125, label %while.body.2, label %while.end.2

while.body.2:
  %126 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %127 = load i8*, i8** %126, align 8
  %128 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %129 = load i64, i64* %128, align 8
  %130 = load i32, i32* %total.addr, align 4
  %131 = load i8*, i8** %s.addr, align 8
  %132 = bitcast i8* %131 to i64*
  %133 = load i64, i64* %132, align 8
  %134 = load i32, i32* %k.addr, align 4
  %135 = add nsw i32 %134, 1
  %136 = sext i32 %135 to i64
  %137 = call i64 @llvm.smin.i64(i64 %136, i64 %133)
  %138 = call i64 @llvm.smax.i64(i64 %137, i64 0)
  %139 = load i8*, i8** %s.addr, align 8
  %140 = bitcast i8* %139 to i64*
  %141 = load i64, i64* %140, align 8
  %142 = trunc i64 %141 to i32
  %143 = sext i32 %142 to i64
  %144 = call i64 @llvm.smin.i64(i64 %143, i64 %133)
  %145 = call i64 @llvm.smax.i64(i64 %144, i64 0)
  %146 = call i64 @llvm.smin.i64(i64 %138, i64 %145)
  %147 = call i64 @llvm.smax.i64(i64 %138, i64 %145)
  %148 = sub i64 %147, %146
  %149 = getelementptr inbounds i8, i8* %131, i64 8
  %150 = getelementptr inbounds i8, i8* %149, i64 %146
  %151 = call i8* @nish_str_new(i8* %150, i64 %148)
  %152 = bitcast i8* %151 to i64*
  %153 = load i64, i64* %152, align 8
  %154 = trunc i64 %153 to i32
  %155 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %130, i32 %154)
  %156 = extractvalue { i32, i1 } %155, 0
  %157 = extractvalue { i32, i1 } %155, 1
  br i1 %157, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %156, i32* %total.addr, align 4
  %158 = load i32, i32* %k.addr, align 4
  %159 = add nsw i32 %158, 1
  store i32 %159, i32* %k.addr, align 4
  %160 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %161 = load i8*, i8** %160, align 8
  %162 = icmp eq i8* %161, %127
  br i1 %162, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %163 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %129, i64* %163, align 8
  br label %pass.done.2

pass.free.2:
  %164 = ptrtoint i8* %127 to i64
  %165 = add i64 %164, %129
  call void @nish_arena_release(i64 %165)
  br label %pass.done.2

pass.done.2:
  br label %while.cond.2

while.end.2:
  %166 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %166

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 0, %while.body.1 ], [ 1, %while.end.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %while.body.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
