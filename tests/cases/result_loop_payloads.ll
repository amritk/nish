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
  %n.addr = alloca i32, align 4
  %err.addr = alloca %struct.nish_result.i32.i32*, align 8
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = call { i1, i32, i32 } @pick(i32 0, i32 0)
  %1 = call i8* @nish_alloc_struct(i64 12)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.i32*
  %3 = extractvalue { i1, i32, i32 } %0, 0
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %2, i32 0, i32 0
  store i1 %3, i1* %4, align 1
  %5 = extractvalue { i1, i32, i32 } %0, 1
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %2, i32 0, i32 1
  store i32 %5, i32* %6, align 4
  %7 = extractvalue { i1, i32, i32 } %0, 2
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %2, i32 0, i32 2
  store i32 %7, i32* %8, align 4
  store %struct.nish_result.i32.i32* %2, %struct.nish_result.i32.i32** %ok.addr, align 8
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %9 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %9, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp slt i32 %12, 3
  br label %land.end

land.end:
  %14 = phi i1 [ false, %while.cond ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %n.addr, align 4
  %16 = call { i1, i32, i32 } @pick(i32 %15, i32 1)
  %17 = call i8* @nish_alloc_struct(i64 12)
  %18 = bitcast i8* %17 to %struct.nish_result.i32.i32*
  %19 = extractvalue { i1, i32, i32 } %16, 0
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 0
  store i1 %19, i1* %20, align 1
  %21 = extractvalue { i1, i32, i32 } %16, 1
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 1
  store i32 %21, i32* %22, align 4
  %23 = extractvalue { i1, i32, i32 } %16, 2
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 2
  store i32 %23, i32* %24, align 4
  store %struct.nish_result.i32.i32* %18, %struct.nish_result.i32.i32** %ok.addr, align 8
  %25 = load i32, i32* %n.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %27 = load i32, i32* %n.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i8* %28)
  call void @nish_print(i8* %29)
  %30 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %31 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %30, i32 0, i32 0
  %32 = load i1, i1* %31, align 1
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %ok.addr, align 8
  %34 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %33, i32 0, i32 1
  %35 = load i32, i32* %34, align 4
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8* %36)
  call void @nish_print(i8* %37)
  br label %if.end

if.end:
  %38 = call { i1, i32, i32 } @pick(i32 0, i32 0)
  %39 = call i8* @nish_alloc_struct(i64 12)
  %40 = bitcast i8* %39 to %struct.nish_result.i32.i32*
  %41 = extractvalue { i1, i32, i32 } %38, 0
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %40, i32 0, i32 0
  store i1 %41, i1* %42, align 1
  %43 = extractvalue { i1, i32, i32 } %38, 1
  %44 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %40, i32 0, i32 1
  store i32 %43, i32* %44, align 4
  %45 = extractvalue { i1, i32, i32 } %38, 2
  %46 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %40, i32 0, i32 2
  store i32 %45, i32* %46, align 4
  store %struct.nish_result.i32.i32* %40, %struct.nish_result.i32.i32** %err.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %47 = load i32, i32* %i.addr, align 4
  %48 = icmp slt i32 %47, 3
  br i1 %48, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %49 = load i32, i32* %j.addr, align 4
  %50 = icmp slt i32 %49, 3
  br i1 %50, label %for.body.1, label %for.end.1

for.body.1:
  %51 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %52 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %51, i32 0, i32 0
  %53 = load i1, i1* %52, align 1
  br i1 %53, label %lor.end, label %lor.rhs

lor.rhs:
  %54 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %55 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %54, i32 0, i32 0
  %56 = load i1, i1* %55, align 1
  %57 = xor i1 %56, true
  br label %lor.end

lor.end:
  %58 = phi i1 [ true, %for.body.1 ], [ %57, %lor.rhs ]
  br i1 %58, label %if.then.1, label %if.end.1

if.then.1:
  %59 = load i32, i32* %i.addr, align 4
  %60 = load i32, i32* %j.addr, align 4
  %61 = call { i1, i32, i32 } @pick(i32 %59, i32 %60)
  %62 = call i8* @nish_alloc_struct(i64 12)
  %63 = bitcast i8* %62 to %struct.nish_result.i32.i32*
  %64 = extractvalue { i1, i32, i32 } %61, 0
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %63, i32 0, i32 0
  store i1 %64, i1* %65, align 1
  %66 = extractvalue { i1, i32, i32 } %61, 1
  %67 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %63, i32 0, i32 1
  store i32 %66, i32* %67, align 4
  %68 = extractvalue { i1, i32, i32 } %61, 2
  %69 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %63, i32 0, i32 2
  store i32 %68, i32* %69, align 4
  store %struct.nish_result.i32.i32* %63, %struct.nish_result.i32.i32** %err.addr, align 8
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %70 = load i32, i32* %j.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %72 = load i32, i32* %i.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %74 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %75 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %74, i32 0, i32 0
  %76 = load i1, i1* %75, align 1
  %77 = xor i1 %76, true
  %78 = select i1 %77, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %79 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i8* %78)
  call void @nish_print(i8* %79)
  %80 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %81 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %80, i32 0, i32 0
  %82 = load i1, i1* %81, align 1
  %83 = xor i1 %82, true
  br i1 %83, label %if.then.2, label %if.end.2

if.then.2:
  %84 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %err.addr, align 8
  %85 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %84, i32 0, i32 2
  %86 = load i32, i32* %85, align 4
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  br label %if.end.2

if.end.2:
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
