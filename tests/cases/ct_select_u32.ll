%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %ONES.addr = alloca i32, align 4
  %TOP.addr = alloca i32, align 4
  %values.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i32], align 8
  %a.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %b.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %half.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4294967295, i32* %ONES.addr, align 4
  store i32 2147483648, i32* %TOP.addr, align 4
  %0 = load i32, i32* %TOP.addr, align 4
  %1 = load i32, i32* %ONES.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast [5 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 %0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 %1, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 2863311530, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %values.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %forof.body, label %forof.end

forof.body:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %13
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %21, i32* %a.addr, align 4
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %23 = load i8*, i8** %22, align 8
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %25 = load i64, i64* %24, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %27 = load i64, i64* %forof.idx.1, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %forof.body.1, label %forof.end.1

forof.body.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %35, i32* %b.addr, align 4
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %37 = load i8*, i8** %36, align 8
  %38 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %39 = load i64, i64* %38, align 8
  %40 = load i32, i32* %a.addr, align 4
  %41 = zext i32 %40 to i64
  %42 = call i8* @nish_str_from_u64(i64 %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = load i32, i32* %b.addr, align 4
  %45 = zext i32 %44 to i64
  %46 = call i8* @nish_str_from_u64(i64 %45)
  %47 = call i8* @nish_str_concat(i8* %43, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %49 = load i32, i32* %ONES.addr, align 4
  %50 = load i32, i32* %a.addr, align 4
  %51 = load i32, i32* %b.addr, align 4
  %52 = call i32 asm "", "=r,0"(i32 %49) readnone nounwind
  %53 = and i32 %50, %52
  %54 = xor i32 %52, -1
  %55 = and i32 %51, %54
  %56 = or i32 %53, %55
  %57 = zext i32 %56 to i64
  %58 = call i8* @nish_str_from_u64(i64 %57)
  %59 = call i8* @nish_str_concat(i8* %48, i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %61 = load i32, i32* %a.addr, align 4
  %62 = load i32, i32* %b.addr, align 4
  %63 = call i32 asm "", "=r,0"(i32 0) readnone nounwind
  %64 = and i32 %61, %63
  %65 = xor i32 %63, -1
  %66 = and i32 %62, %65
  %67 = or i32 %64, %66
  %68 = zext i32 %67 to i64
  %69 = call i8* @nish_str_from_u64(i64 %68)
  %70 = call i8* @nish_str_concat(i8* %60, i8* %69)
  call void @nish_print(i8* %70)
  %71 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %72 = load i8*, i8** %71, align 8
  %73 = icmp eq i8* %72, %37
  br i1 %73, label %pass.rewind, label %pass.free

pass.rewind:
  %74 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %39, i64* %74, align 8
  br label %pass.done

pass.free:
  %75 = ptrtoint i8* %37 to i64
  %76 = add i64 %75, %39
  call void @nish_arena_release(i64 %76)
  br label %pass.done

pass.done:
  br label %forof.inc.1

forof.inc.1:
  %77 = load i64, i64* %forof.idx.1, align 8
  %78 = add i64 %77, 1
  store i64 %78, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %79 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %80 = load i8*, i8** %79, align 8
  %81 = icmp eq i8* %80, %23
  br i1 %81, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %25, i64* %82, align 8
  br label %pass.done.1

pass.free.1:
  %83 = ptrtoint i8* %23 to i64
  %84 = add i64 %83, %25
  call void @nish_arena_release(i64 %84)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc

forof.inc:
  %85 = load i64, i64* %forof.idx, align 8
  %86 = add i64 %85, 1
  store i64 %86, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 4042322160, i32* %half.addr, align 4
  %87 = load i32, i32* %half.addr, align 4
  %88 = call i32 asm "", "=r,0"(i32 %87) readnone nounwind
  %89 = and i32 305419896, %88
  %90 = xor i32 %88, -1
  %91 = and i32 2596069104, %90
  %92 = or i32 %89, %91
  %93 = zext i32 %92 to i64
  %94 = call i8* @nish_str_from_u64(i64 %93)
  call void @nish_print(i8* %94)
  %95 = load i32, i32* %TOP.addr, align 4
  %96 = load i32, i32* %ONES.addr, align 4
  %97 = call i32 asm "", "=r,0"(i32 %95) readnone nounwind
  %98 = and i32 %96, %97
  %99 = xor i32 %97, -1
  %100 = and i32 0, %99
  %101 = or i32 %98, %100
  %102 = zext i32 %101 to i64
  %103 = call i8* @nish_str_from_u64(i64 %102)
  call void @nish_print(i8* %103)
  %104 = load i32, i32* %ONES.addr, align 4
  %105 = call i32 asm "", "=r,0"(i32 1) readnone nounwind
  %106 = and i32 0, %105
  %107 = xor i32 %105, -1
  %108 = and i32 %104, %107
  %109 = or i32 %106, %108
  %110 = zext i32 %109 to i64
  %111 = call i8* @nish_str_from_u64(i64 %110)
  call void @nish_print(i8* %111)
  %112 = load i32, i32* %ONES.addr, align 4
  %113 = load i32, i32* %TOP.addr, align 4
  %114 = call i32 asm "", "=r,0"(i32 %112) readnone nounwind
  %115 = and i32 7, %114
  %116 = xor i32 %114, -1
  %117 = and i32 %113, %116
  %118 = or i32 %115, %117
  %119 = zext i32 %118 to i64
  %120 = call i8* @nish_str_from_u64(i64 %119)
  call void @nish_print(i8* %120)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
