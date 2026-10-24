%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"id-\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"-end\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [89 x i8] } { i64 88, [89 x i8] c"`remember`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"xxxxxxxxxxxxxxxx\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`isNull`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i32 @remember(i8*)
declare i32 @isNull(i8*)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noundef nonnull align 8 i8* @digits(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 1000)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 7)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i8* @nish_str_from_i32(i32 %4)
  ret i8* %6

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @handOver(i32 noundef %n) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @digits(i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  store i8* %4, i8** %label.addr, align 8
  %5 = load i8*, i8** %label.addr, align 8
  %6 = call i64 @nish_str_index_of(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %7 = icmp sge i64 %6, 0
  br i1 %7, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [89 x i8] }* @.str.3 to i8*))
  unreachable

ffi.ok:
  %8 = getelementptr inbounds i8, i8* %5, i64 8
  %9 = call i32 @remember(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9
}

define internal noundef i32 @churn(i32 noundef %n) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %noise.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @digits(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.4 to i8*), i8* %9)
  store i8* %10, i8** %noise.addr, align 8
  %11 = load i32, i32* %total.addr, align 4
  %12 = load i8*, i8** %noise.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %total.addr, align 4
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %20 = load i8*, i8** %19, align 8
  %21 = icmp eq i8* %20, %3
  br i1 %21, label %pass.rewind, label %pass.free

pass.rewind:
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %22, align 8
  br label %pass.done

pass.free:
  %23 = ptrtoint i8* %3 to i64
  %24 = add i64 %23, %5
  call void @nish_arena_release(i64 %24)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %27

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef align 8 i8* @maybe(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 100
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @digits(i32 %n)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i8* [ %3, %cond.true ], [ null, %cond.false ]
  ret i8* %4
}

define noundef i32 @run(i32 noundef %n) #0 {
entry:
  %read.addr = alloca i32, align 4
  %absent.addr = alloca i32, align 4
  %present.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @handOver(i32 %n)
  store i32 %0, i32* %read.addr, align 4
  %1 = call i8* @maybe(i32 %n)
  %2 = icmp eq i8* %1, null
  br i1 %2, label %ffi.join, label %ffi.some

ffi.some:
  %3 = call i64 @nish_str_index_of(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %4 = icmp sge i64 %3, 0
  br i1 %4, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %5 = getelementptr inbounds i8, i8* %1, i64 8
  br label %ffi.join

ffi.join:
  %6 = phi i8* [ null, %entry ], [ %5, %ffi.ok ]
  %7 = call i32 @isNull(i8* %6)
  store i32 %7, i32* %absent.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 10)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i8* @maybe(i32 %9)
  %12 = icmp eq i8* %11, null
  br i1 %12, label %ffi.join.1, label %ffi.some.1

ffi.some.1:
  %13 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %14 = icmp sge i64 %13, 0
  br i1 %14, label %ffi.nul.1, label %ffi.ok.1

ffi.nul.1:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok.1:
  %15 = getelementptr inbounds i8, i8* %11, i64 8
  br label %ffi.join.1

ffi.join.1:
  %16 = phi i8* [ null, %ovf.ok ], [ %15, %ffi.ok.1 ]
  %17 = call i32 @isNull(i8* %16)
  store i32 %17, i32* %present.addr, align 4
  %18 = load i32, i32* %read.addr, align 4
  %19 = call i32 @churn(i32 64)
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = load i32, i32* %absent.addr, align 4
  %24 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %23, i32 1000)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %30 = load i32, i32* %present.addr, align 4
  %31 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %30, i32 100)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 %32)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %35

ovf.fail:
  %ovf.op = phi i32 [ 2, %ffi.join ], [ 0, %ffi.join.1 ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 2, %ovf.ok.3 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
