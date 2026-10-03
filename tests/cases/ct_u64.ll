%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2

define internal noundef i64 @ones() #0 {
entry:
  %0 = sext i32 0 to i64
  %1 = sext i32 1 to i64
  %2 = sub i64 %0, %1
  ret i64 %2
}

define internal noundef i64 @top() #0 {
entry:
  %0 = sext i32 1 to i64
  %1 = sext i32 63 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  ret i64 %3
}

define noundef i32 @nish_main() #1 {
entry:
  %values.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i64], align 8
  %a.addr = alloca i64, align 8
  %forof.idx = alloca i64, align 8
  %b.addr = alloca i64, align 8
  %forof.idx.1 = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 0 to i64
  %1 = sext i32 1 to i64
  %2 = call i64 @top()
  %3 = call i64 @ones()
  %4 = call i64 @top()
  %5 = sext i32 1 to i64
  %6 = sub i64 %4, %5
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast [5 x i64]* %arr.data to i8*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %9 to i64*
  %12 = getelementptr inbounds i64, i64* %11, i64 0
  store i64 %0, i64* %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i64, i64* %11, i64 1
  store i64 %1, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i64, i64* %11, i64 2
  store i64 %2, i64* %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i64, i64* %11, i64 3
  store i64 %3, i64* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i64, i64* %11, i64 4
  store i64 %6, i64* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %values.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %18 = load i64, i64* %forof.idx, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %forof.body, label %forof.end

forof.body:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i64*
  %25 = getelementptr inbounds i64, i64* %24, i64 %18
  %26 = load i64, i64* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %26, i64* %a.addr, align 8
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %32 = load i64, i64* %forof.idx.1, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ult i64 %32, %34
  br i1 %35, label %forof.body.1, label %forof.end.1

forof.body.1:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i64*
  %39 = getelementptr inbounds i64, i64* %38, i64 %32
  %40 = load i64, i64* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %40, i64* %b.addr, align 8
  %41 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %42 = load i8*, i8** %41, align 8
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %44 = load i64, i64* %43, align 8
  %45 = load i64, i64* %a.addr, align 8
  %46 = call i8* @nish_str_from_u64(i64 %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = load i64, i64* %b.addr, align 8
  %49 = call i8* @nish_str_from_u64(i64 %48)
  %50 = call i8* @nish_str_concat(i8* %47, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %52 = load i64, i64* %a.addr, align 8
  %53 = load i64, i64* %b.addr, align 8
  %54 = xor i64 %52, %53
  %55 = sub i64 0, %54
  %56 = or i64 %54, %55
  %57 = lshr i64 %56, 63
  %58 = sub i64 %57, 1
  %59 = call i64 asm "", "=r,0"(i64 %58) readnone nounwind
  %60 = call i8* @nish_str_from_u64(i64 %59)
  %61 = call i8* @nish_str_concat(i8* %51, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = call i64 @ones()
  %64 = load i64, i64* %a.addr, align 8
  %65 = load i64, i64* %b.addr, align 8
  %66 = call i64 asm "", "=r,0"(i64 %63) readnone nounwind
  %67 = and i64 %64, %66
  %68 = xor i64 %66, -1
  %69 = and i64 %65, %68
  %70 = or i64 %67, %69
  %71 = call i8* @nish_str_from_u64(i64 %70)
  %72 = call i8* @nish_str_concat(i8* %62, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %74 = load i64, i64* %a.addr, align 8
  %75 = load i64, i64* %b.addr, align 8
  %76 = call i64 asm "", "=r,0"(i64 0) readnone nounwind
  %77 = and i64 %74, %76
  %78 = xor i64 %76, -1
  %79 = and i64 %75, %78
  %80 = or i64 %77, %79
  %81 = call i8* @nish_str_from_u64(i64 %80)
  %82 = call i8* @nish_str_concat(i8* %73, i8* %81)
  %83 = call i8* @nish_str_concat(i8* %82, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %84 = load i64, i64* %a.addr, align 8
  %85 = load i64, i64* %b.addr, align 8
  %86 = xor i64 %84, %85
  %87 = sub i64 0, %86
  %88 = or i64 %86, %87
  %89 = lshr i64 %88, 63
  %90 = sub i64 %89, 1
  %91 = call i64 asm "", "=r,0"(i64 %90) readnone nounwind
  %92 = load i64, i64* %a.addr, align 8
  %93 = call i64 asm "", "=r,0"(i64 %91) readnone nounwind
  %94 = and i64 %92, %93
  %95 = xor i64 %93, -1
  %96 = and i64 7, %95
  %97 = or i64 %94, %96
  %98 = call i8* @nish_str_from_u64(i64 %97)
  %99 = call i8* @nish_str_concat(i8* %83, i8* %98)
  call void @nish_print(i8* %99)
  %100 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %101 = load i8*, i8** %100, align 8
  %102 = icmp eq i8* %101, %42
  br i1 %102, label %pass.rewind, label %pass.free

pass.rewind:
  %103 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %44, i64* %103, align 8
  br label %pass.done

pass.free:
  %104 = ptrtoint i8* %42 to i64
  %105 = add i64 %104, %44
  call void @nish_arena_release(i64 %105)
  br label %pass.done

pass.done:
  br label %forof.inc.1

forof.inc.1:
  %106 = load i64, i64* %forof.idx.1, align 8
  %107 = add i64 %106, 1
  store i64 %107, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %108 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %109 = load i8*, i8** %108, align 8
  %110 = icmp eq i8* %109, %28
  br i1 %110, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %111 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %30, i64* %111, align 8
  br label %pass.done.1

pass.free.1:
  %112 = ptrtoint i8* %28 to i64
  %113 = add i64 %112, %30
  call void @nish_arena_release(i64 %113)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc

forof.inc:
  %114 = load i64, i64* %forof.idx, align 8
  %115 = add i64 %114, 1
  store i64 %115, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %116 = call i64 @top()
  %117 = sext i32 1 to i64
  %118 = sub i64 %116, %117
  %119 = call i64 @ones()
  %120 = call i64 asm "", "=r,0"(i64 %118) readnone nounwind
  %121 = and i64 %119, %120
  %122 = xor i64 %120, -1
  %123 = and i64 0, %122
  %124 = or i64 %121, %123
  %125 = call i8* @nish_str_from_u64(i64 %124)
  call void @nish_print(i8* %125)
  %126 = call i64 @ones()
  %127 = call i64 @ones()
  %128 = sub i64 %126, %127
  %129 = xor i64 0, %128
  %130 = sub i64 0, %129
  %131 = or i64 %129, %130
  %132 = lshr i64 %131, 63
  %133 = sub i64 %132, 1
  %134 = call i64 asm "", "=r,0"(i64 %133) readnone nounwind
  %135 = call i8* @nish_str_from_u64(i64 %134)
  call void @nish_print(i8* %135)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

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
!13 = !{!"element i64", !6, i64 0}
!14 = !{!13, !13, i64 0}
