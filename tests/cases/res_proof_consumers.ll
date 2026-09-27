%struct.Cell = type { i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal { i1, i32, i32 } @parse(i32 noundef %n) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 false, i1* %1, align 1
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %n, i32* %2, align 4
  br label %cond.end

cond.false:
  %3 = sub nsw i32 0, %n
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 true, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %3, i32* %5, align 4
  br label %cond.end

cond.end:
  %6 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %cond.false ]
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  %9 = insertvalue { i1, i32, i32 } undef, i1 %8, 0
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %6, i32 0, i32 2
  %11 = load i32, i32* %10, align 4
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %6, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = insertvalue { i1, i32, i32 } %9, i32 %13, 1
  %15 = insertvalue { i1, i32, i32 } %14, i32 %11, 2
  ret { i1, i32, i32 } %15
}

define internal noundef zeroext i1 @g(i1 noundef zeroext %b) #1 {
entry:
  ret i1 %b
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.i32*, align 8
  %q.addr = alloca %struct.nish_result.i32.i32*, align 8
  %total.addr = alloca i32, align 4
  %z.addr = alloca %struct.nish_result.i32.i32*, align 8
  %arr.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.nish_result.i32.i32*], align 8
  %each.addr = alloca %struct.nish_result.i32.i32*, align 8
  %forof.idx = alloca i64, align 8
  %s.addr = alloca %struct.nish_result.i32.i32*, align 8
  %p.addr = alloca %struct.Cell*, align 8
  %0 = sub nsw i32 0, 2
  %1 = call { i1, i32, i32 } @parse(i32 %0)
  %2 = call i8* @nish_alloc_struct(i64 12)
  %3 = bitcast i8* %2 to %struct.nish_result.i32.i32*
  %4 = extractvalue { i1, i32, i32 } %1, 0
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %3, i32 0, i32 0
  store i1 %4, i1* %5, align 1
  %6 = extractvalue { i1, i32, i32 } %1, 1
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %3, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  %8 = extractvalue { i1, i32, i32 } %1, 2
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %3, i32 0, i32 2
  store i32 %8, i32* %9, align 4
  store %struct.nish_result.i32.i32* %3, %struct.nish_result.i32.i32** %r.addr, align 8
  %10 = call { i1, i32, i32 } @parse(i32 3)
  %11 = call i8* @nish_alloc_struct(i64 12)
  %12 = bitcast i8* %11 to %struct.nish_result.i32.i32*
  %13 = extractvalue { i1, i32, i32 } %10, 0
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %12, i32 0, i32 0
  store i1 %13, i1* %14, align 1
  %15 = extractvalue { i1, i32, i32 } %10, 1
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %12, i32 0, i32 1
  store i32 %15, i32* %16, align 4
  %17 = extractvalue { i1, i32, i32 } %10, 2
  %18 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %12, i32 0, i32 2
  store i32 %17, i32* %18, align 4
  store %struct.nish_result.i32.i32* %12, %struct.nish_result.i32.i32** %q.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %19 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %19, i32 0, i32 0
  %21 = load i1, i1* %20, align 1
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %total.addr, align 4
  %23 = icmp eq i32 %22, 0
  br i1 %23, label %cond.true, label %cond.false

cond.true:
  %24 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  br label %cond.end

cond.false:
  %25 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %q.addr, align 8
  br label %cond.end

cond.end:
  %26 = phi %struct.nish_result.i32.i32* [ %24, %cond.true ], [ %25, %cond.false ]
  store %struct.nish_result.i32.i32* %26, %struct.nish_result.i32.i32** %z.addr, align 8
  %27 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %z.addr, align 8
  %28 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %27, i32 0, i32 0
  %29 = load i1, i1* %28, align 1
  br i1 %29, label %if.then.1, label %if.end.1

if.then.1:
  %30 = load i32, i32* %total.addr, align 4
  %31 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %z.addr, align 8
  %32 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %31, i32 0, i32 1
  %33 = load i32, i32* %32, align 4
  %34 = add nsw i32 %30, %33
  store i32 %34, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  %35 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %36 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %q.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast [2 x %struct.nish_result.i32.i32*]* %arr.data to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %39 to %struct.nish_result.i32.i32**
  %42 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %41, i64 0
  store %struct.nish_result.i32.i32* %35, %struct.nish_result.i32.i32** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %41, i64 1
  store %struct.nish_result.i32.i32* %36, %struct.nish_result.i32.i32** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %arr.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %45 = load i64, i64* %forof.idx, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp ult i64 %45, %47
  br i1 %48, label %forof.body, label %forof.end

forof.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to %struct.nish_result.i32.i32**
  %52 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %51, i64 %45
  %53 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_result.i32.i32* %53, %struct.nish_result.i32.i32** %each.addr, align 8
  %54 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %each.addr, align 8
  %55 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %54, i32 0, i32 0
  %56 = load i1, i1* %55, align 1
  %57 = xor i1 %56, true
  br i1 %57, label %if.then.2, label %if.end.2

if.then.2:
  %58 = load i32, i32* %total.addr, align 4
  %59 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %each.addr, align 8
  %60 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %59, i32 0, i32 2
  %61 = load i32, i32* %60, align 4
  %62 = add nsw i32 %58, %61
  store i32 %62, i32* %total.addr, align 4
  br label %if.end.2

if.end.2:
  br label %forof.inc

forof.inc:
  %63 = load i64, i64* %forof.idx, align 8
  %64 = add i64 %63, 1
  store i64 %64, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %if.end

if.end:
  %65 = call { i1, i32, i32 } @parse(i32 4)
  %66 = call i8* @nish_alloc_struct(i64 12)
  %67 = bitcast i8* %66 to %struct.nish_result.i32.i32*
  %68 = extractvalue { i1, i32, i32 } %65, 0
  %69 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %67, i32 0, i32 0
  store i1 %68, i1* %69, align 1
  %70 = extractvalue { i1, i32, i32 } %65, 1
  %71 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %67, i32 0, i32 1
  store i32 %70, i32* %71, align 4
  %72 = extractvalue { i1, i32, i32 } %65, 2
  %73 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %67, i32 0, i32 2
  store i32 %72, i32* %73, align 4
  store %struct.nish_result.i32.i32* %67, %struct.nish_result.i32.i32** %s.addr, align 8
  %74 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %s.addr, align 8
  %75 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %74, i32 0, i32 0
  %76 = load i1, i1* %75, align 1
  %77 = xor i1 %76, true
  br i1 %77, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %78 = sub nsw i32 0, 5
  %79 = call { i1, i32, i32 } @parse(i32 %78)
  %80 = call i8* @nish_alloc_struct(i64 12)
  %81 = bitcast i8* %80 to %struct.nish_result.i32.i32*
  %82 = extractvalue { i1, i32, i32 } %79, 0
  %83 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %81, i32 0, i32 0
  store i1 %82, i1* %83, align 1
  %84 = extractvalue { i1, i32, i32 } %79, 1
  %85 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %81, i32 0, i32 1
  store i32 %84, i32* %85, align 4
  %86 = extractvalue { i1, i32, i32 } %79, 2
  %87 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %81, i32 0, i32 2
  store i32 %86, i32* %87, align 4
  store %struct.nish_result.i32.i32* %81, %struct.nish_result.i32.i32** %s.addr, align 8
  %88 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %81, i32 0, i32 0
  %89 = load i1, i1* %88, align 1
  %90 = call i1 @g(i1 %89)
  br label %land.end.1

land.end.1:
  %91 = phi i1 [ false, %if.end ], [ %90, %land.rhs.1 ]
  br i1 %91, label %land.rhs, label %land.end

land.rhs:
  %92 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %s.addr, align 8
  %93 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %92, i32 0, i32 0
  %94 = load i1, i1* %93, align 1
  br label %land.end

land.end:
  %95 = phi i1 [ false, %land.end.1 ], [ %94, %land.rhs ]
  br i1 %95, label %if.then.3, label %if.end.3

if.then.3:
  %96 = load i32, i32* %total.addr, align 4
  %97 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %s.addr, align 8
  %98 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %97, i32 0, i32 1
  %99 = load i32, i32* %98, align 4
  %100 = add nsw i32 %96, %99
  store i32 %100, i32* %total.addr, align 4
  br label %if.end.3

if.end.3:
  %101 = call i8* @nish_alloc_struct(i64 4)
  %102 = bitcast i8* %101 to %struct.Cell*
  %103 = getelementptr inbounds %struct.Cell, %struct.Cell* %102, i32 0, i32 0
  store i32 1, i32* %103, align 4, !tbaa !17
  store %struct.Cell* %102, %struct.Cell** %p.addr, align 8
  %104 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %105 = icmp ne %struct.Cell* %104, null
  br i1 %105, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %106 = call i8* @nish_alloc_struct(i64 4)
  %107 = bitcast i8* %106 to %struct.Cell*
  %108 = getelementptr inbounds %struct.Cell, %struct.Cell* %107, i32 0, i32 0
  store i32 1, i32* %108, align 4, !tbaa !17
  store %struct.Cell* %107, %struct.Cell** %p.addr, align 8
  %109 = icmp ne %struct.Cell* %107, null
  %110 = call i1 @g(i1 %109)
  br label %land.end.3

land.end.3:
  %111 = phi i1 [ false, %if.end.3 ], [ %110, %land.rhs.3 ]
  br i1 %111, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %112 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %113 = icmp ne %struct.Cell* %112, null
  br label %land.end.2

land.end.2:
  %114 = phi i1 [ false, %land.end.3 ], [ %113, %land.rhs.2 ]
  br i1 %114, label %if.then.4, label %if.end.4

if.then.4:
  %115 = load i32, i32* %total.addr, align 4
  %116 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %117 = getelementptr inbounds %struct.Cell, %struct.Cell* %116, i32 0, i32 0
  %118 = load i32, i32* %117, align 4, !tbaa !17
  %119 = add nsw i32 %115, %118
  store i32 %119, i32* %total.addr, align 4
  br label %if.end.4

if.end.4:
  %120 = load i32, i32* %total.addr, align 4
  %121 = call i8* @nish_str_from_i32(i32 %120)
  call void @nish_print(i8* %121)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Cell", !15, i64 0}
!17 = !{!16, !15, i64 0}
