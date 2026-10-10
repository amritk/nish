%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bb\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ccc\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef nonnull align 8 i8* @label(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %0)
  ret i8* %1
}

define void @nish_main() #0 {
entry:
  %total.addr = alloca i32, align 4
  %lastIndex.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %widest.addr = alloca i32, align 4
  %row.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %a.addr = alloca i64, align 8
  %line.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 -1, i32* %lastIndex.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @label(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %s.addr, align 8
  %10 = load i32, i32* %total.addr, align 4
  %11 = load i8*, i8** %s.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %total.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  store i32 %18, i32* %lastIndex.addr, align 4
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
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast [3 x i8*]* %arr.data to i8*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %29 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = getelementptr inbounds i8*, i8** %31, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = getelementptr inbounds i8*, i8** %31, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %widest.addr, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %36 = load i64, i64* %forof.idx, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 %36, %38
  br i1 %39, label %forof.body, label %forof.end

forof.body:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %44, i8** %row.addr, align 8
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %46 = load i8*, i8** %45, align 8
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %48 = load i64, i64* %47, align 8
  %49 = call i64 @nish_arena_mark()
  store i64 %49, i64* %a.addr, align 8
  %50 = load i64, i64* %a.addr, align 8
  %51 = load i8*, i8** %row.addr, align 8
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  %53 = load i8*, i8** %row.addr, align 8
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = trunc i64 %55 to i32
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %52, i8* %57)
  store i8* %58, i8** %line.addr, align 8
  %59 = load i8*, i8** %line.addr, align 8
  %60 = bitcast i8* %59 to i64*
  %61 = load i64, i64* %60, align 8
  %62 = trunc i64 %61 to i32
  %63 = load i32, i32* %widest.addr, align 4
  %64 = icmp sgt i32 %62, %63
  br i1 %64, label %if.then, label %if.end

if.then:
  %65 = load i8*, i8** %line.addr, align 8
  %66 = bitcast i8* %65 to i64*
  %67 = load i64, i64* %66, align 8
  %68 = trunc i64 %67 to i32
  store i32 %68, i32* %widest.addr, align 4
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %50)
  %69 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %70 = load i8*, i8** %69, align 8
  %71 = icmp eq i8* %70, %46
  br i1 %71, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %72 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %48, i64* %72, align 8
  br label %pass.done.1

pass.free.1:
  %73 = ptrtoint i8* %46 to i64
  %74 = add i64 %73, %48
  call void @nish_arena_release(i64 %74)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc

forof.inc:
  %75 = load i64, i64* %forof.idx, align 8
  %76 = add i64 %75, 1
  store i64 %76, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %77 = load i32, i32* %total.addr, align 4
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %80 = load i32, i32* %lastIndex.addr, align 4
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @label(i32 %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = call i8* @nish_str_concat(i8* %79, i8* %83)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %86 = load i32, i32* %widest.addr, align 4
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %85, i8* %87)
  call void @nish_print(i8* %88)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
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
