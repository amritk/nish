%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bb\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ccc\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_arena_release(i64 noundef) #1
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
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !8
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
  %17 = load i8*, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !8
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
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %27 = load i64, i64* %26, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %piece.addr, align 8
  %28 = load i8*, i8** %piece.addr, align 8
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %29, i8** %piece.addr, align 8
  %30 = load i32, i32* %total.addr, align 4
  %31 = load i8*, i8** %piece.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = add nsw i32 %30, %34
  store i32 %35, i32* %total.addr, align 4
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %37 = load i8*, i8** %36, align 8
  %38 = icmp eq i8* %37, %25
  br i1 %38, label %pass.rewind, label %pass.free

pass.rewind:
  %39 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %27, i64* %39, align 8
  br label %pass.done

pass.free:
  %40 = ptrtoint i8* %25 to i64
  %41 = add i64 %40, %27
  call void @nish_arena_release(i64 %41)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %42 = load i32, i32* %i.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %head.addr, align 8
  %44 = load i8*, i8** %head.addr, align 8
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  store i8* %45, i8** %head.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %47 = load i64, i64* %forof.idx.1, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4
  %50 = icmp ult i64 %47, %49
  br i1 %50, label %forof.body.1, label %forof.end.1

forof.body.1:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4
  %53 = bitcast i8* %52 to i8**
  %54 = getelementptr inbounds i8*, i8** %53, i64 %47
  %55 = load i8*, i8** %54, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  store i8* %55, i8** %x.addr, align 8
  %56 = load i32, i32* %seen.addr, align 4
  %57 = load i8*, i8** %x.addr, align 8
  %58 = bitcast i8* %57 to i64*
  %59 = load i64, i64* %58, align 8
  %60 = trunc i64 %59 to i32
  %61 = add nsw i32 %56, %60
  store i32 %61, i32* %seen.addr, align 4
  br label %forof.inc.1

forof.inc.1:
  %62 = load i64, i64* %forof.idx.1, align 8
  %63 = add i64 %62, 1
  store i64 %63, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %64 = load i8*, i8** %line.addr, align 8
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = trunc i64 %66 to i32
  %68 = load i32, i32* %total.addr, align 4
  %69 = add nsw i32 %67, %68
  %70 = load i8*, i8** %head.addr, align 8
  %71 = bitcast i8* %70 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = trunc i64 %72 to i32
  %74 = add nsw i32 %69, %73
  %75 = load i32, i32* %seen.addr, align 4
  %76 = add nsw i32 %74, %75
  ret i32 %76
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element ptr", !6, i64 0}
!8 = !{!7, !7, i64 0}
