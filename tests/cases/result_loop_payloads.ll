%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"after while: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ok \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"after for: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"err \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal { i1, i32, i32 } @pick(i32 noundef %i, i32 noundef %j) #0 {
entry:
  %0 = icmp slt i32 %j, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = mul nsw i32 %i, 10
  %2 = add nsw i32 %1, %j
  %3 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %2, 1
  ret { i1, i32, i32 } %3

if.end:
  %4 = sub nsw i32 0, %i
  %5 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %4, 2
  ret { i1, i32, i32 } %5
}

define noundef i32 @nish_main() #1 {
entry:
  %ok.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %n.addr = alloca i32, align 4
  %err.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32, i32 } @pick(i32 0, i32 0)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %ok.addr, align 8
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %7 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %10, 3
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %n.addr, align 4
  %14 = call { i1, i32, i32 } @pick(i32 %13, i32 1)
  %15 = call i8* @nish_alloc_struct(i64 12)
  %16 = bitcast i8* %15 to %struct.nish_result.i32.i32*
  %17 = extractvalue { i1, i32, i32 } %14, 0
  %18 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %16, i32 0, i32 0
  store i1 %17, i1* %18, align 1
  %19 = extractvalue { i1, i32, i32 } %14, 1
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %16, i32 0, i32 1
  store i32 %19, i32* %20, align 4
  %21 = extractvalue { i1, i32, i32 } %14, 2
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %16, i32 0, i32 2
  store i32 %21, i32* %22, align 4
  store %struct.nish_result.i32.i32* %16, %struct.nish_result.i32.i32** %ok.addr, align 8
  %23 = load i32, i32* %n.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %28, i32 0, i32 0
  %30 = load i1, i1* %29, align 1
  br i1 %30, label %if.then, label %if.end

if.then:
  %31 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %32 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %31, i32 0, i32 1
  %33 = load i32, i32* %32, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8* %34)
  call void @nish_print(i8* %35)
  br label %if.end

if.end:
  %36 = call { i1, i32, i32 } @pick(i32 0, i32 0)
  %37 = extractvalue { i1, i32, i32 } %36, 0
  %38 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %37, i1* %38, align 1
  %39 = extractvalue { i1, i32, i32 } %36, 1
  %40 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %39, i32* %40, align 4
  %41 = extractvalue { i1, i32, i32 } %36, 2
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %41, i32* %42, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %err.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %43 = load i32, i32* %i.addr, align 4
  %44 = icmp slt i32 %43, 3
  br i1 %44, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %45 = load i32, i32* %j.addr, align 4
  %46 = icmp slt i32 %45, 3
  br i1 %46, label %for.body.1, label %for.end.1

for.body.1:
  %47 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %48 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %47, i32 0, i32 0
  %49 = load i1, i1* %48, align 1
  br i1 %49, label %lor.end, label %lor.rhs

lor.rhs:
  %50 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %51 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %50, i32 0, i32 0
  %52 = load i1, i1* %51, align 1
  %53 = xor i1 %52, true
  br label %lor.end

lor.end:
  %54 = phi i1 [ true, %for.body.1 ], [ %53, %lor.rhs ]
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  %55 = load i32, i32* %i.addr, align 4
  %56 = load i32, i32* %j.addr, align 4
  %57 = call { i1, i32, i32 } @pick(i32 %55, i32 %56)
  %58 = call i8* @nish_alloc_struct(i64 12)
  %59 = bitcast i8* %58 to %struct.nish_result.i32.i32*
  %60 = extractvalue { i1, i32, i32 } %57, 0
  %61 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %59, i32 0, i32 0
  store i1 %60, i1* %61, align 1
  %62 = extractvalue { i1, i32, i32 } %57, 1
  %63 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %59, i32 0, i32 1
  store i32 %62, i32* %63, align 4
  %64 = extractvalue { i1, i32, i32 } %57, 2
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %59, i32 0, i32 2
  store i32 %64, i32* %65, align 4
  store %struct.nish_result.i32.i32* %59, %struct.nish_result.i32.i32** %err.addr, align 8
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %66 = load i32, i32* %j.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %68 = load i32, i32* %i.addr, align 4
  %69 = add nsw i32 %68, 1
  store i32 %69, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %70 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %71 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %70, i32 0, i32 0
  %72 = load i1, i1* %71, align 1
  %73 = xor i1 %72, true
  %74 = select i1 %73, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %75 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i8* %74)
  call void @nish_print(i8* %75)
  %76 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %77 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %76, i32 0, i32 0
  %78 = load i1, i1* %77, align 1
  %79 = xor i1 %78, true
  br i1 %79, label %if.then.2, label %if.end.2

if.then.2:
  %80 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %81 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %80, i32 0, i32 2
  %82 = load i32, i32* %81, align 4
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %83)
  call void @nish_print(i8* %84)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
