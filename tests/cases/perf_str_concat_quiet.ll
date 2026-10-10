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
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @test() #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %lines.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
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
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %lines.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %line.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %20, i8** %part.addr, align 8
  %21 = load i8*, i8** %part.addr, align 8
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %22, i8** %line.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %24 = load i8*, i8** %line.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8**
  %33 = getelementptr inbounds i8*, i8** %32, i64 %26
  store i8* %24, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  br label %forof.inc

forof.inc:
  %36 = load i64, i64* %forof.idx, align 8
  %37 = add i64 %36, 1
  store i64 %37, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %38 = load i32, i32* %i.addr, align 4
  %39 = icmp slt i32 %38, 3
  br i1 %39, label %for.body, label %for.end

for.body:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %41 = load i8*, i8** %40, align 8
  %42 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %43 = load i64, i64* %42, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %piece.addr, align 8
  %44 = load i8*, i8** %piece.addr, align 8
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %45, i8** %piece.addr, align 8
  %46 = load i32, i32* %total.addr, align 4
  %47 = load i8*, i8** %piece.addr, align 8
  %48 = bitcast i8* %47 to i64*
  %49 = load i64, i64* %48, align 8
  %50 = trunc i64 %49 to i32
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %52, i32* %total.addr, align 4
  %54 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %55 = load i8*, i8** %54, align 8
  %56 = icmp eq i8* %55, %41
  br i1 %56, label %pass.rewind, label %pass.free

pass.rewind:
  %57 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %43, i64* %57, align 8
  br label %pass.done

pass.free:
  %58 = ptrtoint i8* %41 to i64
  %59 = add i64 %58, %43
  call void @nish_arena_release(i64 %59)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %60 = load i32, i32* %i.addr, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %head.addr, align 8
  %62 = load i8*, i8** %head.addr, align 8
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  store i8* %63, i8** %head.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %65 = load i64, i64* %forof.idx.1, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = icmp ult i64 %65, %67
  br i1 %68, label %forof.body.1, label %forof.end.1

forof.body.1:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = bitcast i8* %70 to i8**
  %72 = getelementptr inbounds i8*, i8** %71, i64 %65
  %73 = load i8*, i8** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %73, i8** %x.addr, align 8
  %74 = load i32, i32* %seen.addr, align 4
  %75 = load i8*, i8** %x.addr, align 8
  %76 = bitcast i8* %75 to i64*
  %77 = load i64, i64* %76, align 8
  %78 = trunc i64 %77 to i32
  %79 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 %78)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %80, i32* %seen.addr, align 4
  br label %forof.inc.1

forof.inc.1:
  %82 = load i64, i64* %forof.idx.1, align 8
  %83 = add i64 %82, 1
  store i64 %83, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %84 = load i8*, i8** %line.addr, align 8
  %85 = bitcast i8* %84 to i64*
  %86 = load i64, i64* %85, align 8
  %87 = trunc i64 %86 to i32
  %88 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = trunc i64 %90 to i32
  %92 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %87, i32 %91)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %95 = load i32, i32* %total.addr, align 4
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %93, i32 %95)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %99 = load i8*, i8** %head.addr, align 8
  %100 = bitcast i8* %99 to i64*
  %101 = load i64, i64* %100, align 8
  %102 = trunc i64 %101 to i32
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %97, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %106 = load i32, i32* %seen.addr, align 4
  %107 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %104, i32 %106)
  %108 = extractvalue { i32, i1 } %107, 0
  %109 = extractvalue { i32, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %108

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
