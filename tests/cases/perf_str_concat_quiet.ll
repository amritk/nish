%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bb\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ccc\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @test() #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %line.addr = alloca i8*, align 8
  %part.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %piece.addr = alloca i8*, align 8
  %head.addr = alloca i8*, align 8
  %seen.addr = alloca i32, align 4
  %x.addr = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %line.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  %17 = load i8*, i8** %16, align 8, !alias.scope !4, !noalias !3
  store i8* %17, i8** %part.addr, align 8
  %18 = load i8*, i8** %part.addr, align 8
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %19, i8** %line.addr, align 8
  br label %forof.inc

forof.inc:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = add i64 %20, 1
  store i64 %21, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = icmp slt i32 %22, 3
  br i1 %23, label %for.body, label %for.end

for.body:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %piece.addr, align 8
  %24 = load i8*, i8** %piece.addr, align 8
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %25, i8** %piece.addr, align 8
  %26 = load i32, i32* %total.addr, align 4
  %27 = load i8*, i8** %piece.addr, align 8
  %28 = bitcast i8* %27 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = trunc i64 %29 to i32
  %31 = add nsw i32 %26, %30
  store i32 %31, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %head.addr, align 8
  %34 = load i8*, i8** %head.addr, align 8
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  store i8* %35, i8** %head.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %37 = load i64, i64* %forof.idx.1, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4
  %40 = icmp ult i64 %37, %39
  br i1 %40, label %forof.body.1, label %forof.end.1

forof.body.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4
  %43 = bitcast i8* %42 to i8**
  %44 = getelementptr inbounds i8*, i8** %43, i64 %37
  %45 = load i8*, i8** %44, align 8, !alias.scope !4, !noalias !3
  store i8* %45, i8** %x.addr, align 8
  %46 = load i32, i32* %seen.addr, align 4
  %47 = load i8*, i8** %x.addr, align 8
  %48 = bitcast i8* %47 to i64*
  %49 = load i64, i64* %48, align 8
  %50 = trunc i64 %49 to i32
  %51 = add nsw i32 %46, %50
  store i32 %51, i32* %seen.addr, align 4
  br label %forof.inc.1

forof.inc.1:
  %52 = load i64, i64* %forof.idx.1, align 8
  %53 = add i64 %52, 1
  store i64 %53, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %54 = load i8*, i8** %line.addr, align 8
  %55 = bitcast i8* %54 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = trunc i64 %56 to i32
  %58 = load i32, i32* %total.addr, align 4
  %59 = add nsw i32 %57, %58
  %60 = load i8*, i8** %head.addr, align 8
  %61 = bitcast i8* %60 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = trunc i64 %62 to i32
  %64 = add nsw i32 %59, %63
  %65 = load i32, i32* %seen.addr, align 4
  %66 = add nsw i32 %64, %65
  ret i32 %66
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
