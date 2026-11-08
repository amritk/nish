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
  %copy.addr = alloca i32, align 4
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
  store i32 %92, i32* %copy.addr, align 4
  %93 = load i32, i32* %total.addr, align 4
  %94 = load i32, i32* %copy.addr, align 4
  %95 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %93, i32 %94)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %96, i32* %at.addr, align 4
  %98 = load i32, i32* %total.addr, align 4
  %99 = load i8*, i8** %s.addr, align 8
  %100 = bitcast i8* %99 to i64*
  %101 = load i64, i64* %100, align 8
  %102 = load i32, i32* %at.addr, align 4
  %103 = sext i32 %102 to i64
  %104 = call i64 @llvm.smin.i64(i64 %103, i64 %101)
  %105 = call i64 @llvm.smax.i64(i64 %104, i64 0)
  %106 = load i32, i32* %at.addr, align 4
  %107 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %106, i32 1)
  %108 = extractvalue { i32, i1 } %107, 0
  %109 = extractvalue { i32, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %110 = sext i32 %108 to i64
  %111 = call i64 @llvm.smin.i64(i64 %110, i64 %101)
  %112 = call i64 @llvm.smax.i64(i64 %111, i64 0)
  %113 = call i64 @llvm.smin.i64(i64 %105, i64 %112)
  %114 = call i64 @llvm.smax.i64(i64 %105, i64 %112)
  %115 = sub i64 %114, %113
  %116 = getelementptr inbounds i8, i8* %99, i64 8
  %117 = getelementptr inbounds i8, i8* %116, i64 %113
  %118 = call i8* @nish_str_new(i8* %117, i64 %115)
  %119 = bitcast i8* %118 to i64*
  %120 = load i64, i64* %119, align 8
  %121 = trunc i64 %120 to i32
  %122 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %98, i32 %121)
  %123 = extractvalue { i32, i1 } %122, 0
  %124 = extractvalue { i32, i1 } %122, 1
  br i1 %124, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %123, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond.2

while.cond.2:
  %125 = load i32, i32* %k.addr, align 4
  %126 = icmp slt i32 %125, 2
  br i1 %126, label %while.body.2, label %while.end.2

while.body.2:
  %127 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %128 = load i8*, i8** %127, align 8
  %129 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %130 = load i64, i64* %129, align 8
  %131 = load i32, i32* %total.addr, align 4
  %132 = load i8*, i8** %s.addr, align 8
  %133 = bitcast i8* %132 to i64*
  %134 = load i64, i64* %133, align 8
  %135 = load i32, i32* %k.addr, align 4
  %136 = add nsw i32 %135, 1
  %137 = sext i32 %136 to i64
  %138 = call i64 @llvm.smin.i64(i64 %137, i64 %134)
  %139 = call i64 @llvm.smax.i64(i64 %138, i64 0)
  %140 = load i8*, i8** %s.addr, align 8
  %141 = bitcast i8* %140 to i64*
  %142 = load i64, i64* %141, align 8
  %143 = trunc i64 %142 to i32
  %144 = sext i32 %143 to i64
  %145 = call i64 @llvm.smin.i64(i64 %144, i64 %134)
  %146 = call i64 @llvm.smax.i64(i64 %145, i64 0)
  %147 = call i64 @llvm.smin.i64(i64 %139, i64 %146)
  %148 = call i64 @llvm.smax.i64(i64 %139, i64 %146)
  %149 = sub i64 %148, %147
  %150 = getelementptr inbounds i8, i8* %132, i64 8
  %151 = getelementptr inbounds i8, i8* %150, i64 %147
  %152 = call i8* @nish_str_new(i8* %151, i64 %149)
  %153 = bitcast i8* %152 to i64*
  %154 = load i64, i64* %153, align 8
  %155 = trunc i64 %154 to i32
  %156 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %131, i32 %155)
  %157 = extractvalue { i32, i1 } %156, 0
  %158 = extractvalue { i32, i1 } %156, 1
  br i1 %158, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %157, i32* %total.addr, align 4
  %159 = load i32, i32* %k.addr, align 4
  %160 = add nsw i32 %159, 1
  store i32 %160, i32* %k.addr, align 4
  %161 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %162 = load i8*, i8** %161, align 8
  %163 = icmp eq i8* %162, %128
  br i1 %163, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %164 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %130, i64* %164, align 8
  br label %pass.done.2

pass.free.2:
  %165 = ptrtoint i8* %128 to i64
  %166 = add i64 %165, %130
  call void @nish_arena_release(i64 %166)
  br label %pass.done.2

pass.done.2:
  br label %while.cond.2

while.end.2:
  %167 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %167

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 0, %while.body.1 ], [ 1, %while.end.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %while.body.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
