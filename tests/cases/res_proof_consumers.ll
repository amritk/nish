%struct.Cell = type { i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 true, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %4, i32* %7, align 4
  br label %cond.end

cond.end:
  %8 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %ovf.ok ]
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %8, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  %11 = insertvalue { i1, i32, i32 } undef, i1 %10, 0
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %8, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %8, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  %16 = insertvalue { i1, i32, i32 } %11, i32 %15, 1
  %17 = insertvalue { i1, i32, i32 } %16, i32 %13, 2
  ret { i1, i32, i32 } %17

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
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
  %0 = call { i1, i32, i32 } @parse(i32 -2)
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
  store %struct.nish_result.i32.i32* %2, %struct.nish_result.i32.i32** %r.addr, align 8
  %9 = call { i1, i32, i32 } @parse(i32 3)
  %10 = call i8* @nish_alloc_struct(i64 12)
  %11 = bitcast i8* %10 to %struct.nish_result.i32.i32*
  %12 = extractvalue { i1, i32, i32 } %9, 0
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %11, i32 0, i32 0
  store i1 %12, i1* %13, align 1
  %14 = extractvalue { i1, i32, i32 } %9, 1
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %11, i32 0, i32 1
  store i32 %14, i32* %15, align 4
  %16 = extractvalue { i1, i32, i32 } %9, 2
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %11, i32 0, i32 2
  store i32 %16, i32* %17, align 4
  store %struct.nish_result.i32.i32* %11, %struct.nish_result.i32.i32** %q.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %18 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 0
  %20 = load i1, i1* %19, align 1
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load i32, i32* %total.addr, align 4
  %22 = icmp eq i32 %21, 0
  br i1 %22, label %cond.true, label %cond.false

cond.true:
  %23 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  br label %cond.end

cond.false:
  %24 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %q.addr, align 8
  br label %cond.end

cond.end:
  %25 = phi %struct.nish_result.i32.i32* [ %23, %cond.true ], [ %24, %cond.false ]
  store %struct.nish_result.i32.i32* %25, %struct.nish_result.i32.i32** %z.addr, align 8
  %26 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %z.addr, align 8
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %26, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  %29 = load i32, i32* %total.addr, align 4
  %30 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %z.addr, align 8
  %31 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %30, i32 0, i32 1
  %32 = load i32, i32* %31, align 4
  %33 = add nsw i32 %29, %32
  store i32 %33, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  %34 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %35 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %q.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast [2 x %struct.nish_result.i32.i32*]* %arr.data to i8*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %38 to %struct.nish_result.i32.i32**
  %41 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %40, i64 0
  store %struct.nish_result.i32.i32* %34, %struct.nish_result.i32.i32** %41, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %40, i64 1
  store %struct.nish_result.i32.i32* %35, %struct.nish_result.i32.i32** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %arr.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %44 = load i64, i64* %forof.idx, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 %44, %46
  br i1 %47, label %forof.body, label %forof.end

forof.body:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to %struct.nish_result.i32.i32**
  %51 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %50, i64 %44
  %52 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_result.i32.i32* %52, %struct.nish_result.i32.i32** %each.addr, align 8
  %53 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %each.addr, align 8
  %54 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %53, i32 0, i32 0
  %55 = load i1, i1* %54, align 1
  %56 = xor i1 %55, true
  br i1 %56, label %if.then.2, label %if.end.2

if.then.2:
  %57 = load i32, i32* %total.addr, align 4
  %58 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %each.addr, align 8
  %59 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %58, i32 0, i32 2
  %60 = load i32, i32* %59, align 4
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %62, i32* %total.addr, align 4
  br label %if.end.2

if.end.2:
  br label %forof.inc

forof.inc:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = add i64 %64, 1
  store i64 %65, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %if.end

if.end:
  %66 = call { i1, i32, i32 } @parse(i32 4)
  %67 = call i8* @nish_alloc_struct(i64 12)
  %68 = bitcast i8* %67 to %struct.nish_result.i32.i32*
  %69 = extractvalue { i1, i32, i32 } %66, 0
  %70 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %68, i32 0, i32 0
  store i1 %69, i1* %70, align 1
  %71 = extractvalue { i1, i32, i32 } %66, 1
  %72 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %68, i32 0, i32 1
  store i32 %71, i32* %72, align 4
  %73 = extractvalue { i1, i32, i32 } %66, 2
  %74 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %68, i32 0, i32 2
  store i32 %73, i32* %74, align 4
  store %struct.nish_result.i32.i32* %68, %struct.nish_result.i32.i32** %s.addr, align 8
  %75 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %s.addr, align 8
  %76 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %75, i32 0, i32 0
  %77 = load i1, i1* %76, align 1
  %78 = xor i1 %77, true
  br i1 %78, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %79 = call { i1, i32, i32 } @parse(i32 -5)
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
  %100 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %96, i32 %99)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %101, i32* %total.addr, align 4
  br label %if.end.3

if.end.3:
  %103 = call i8* @nish_alloc_struct(i64 4)
  %104 = bitcast i8* %103 to %struct.Cell*
  %105 = getelementptr inbounds %struct.Cell, %struct.Cell* %104, i32 0, i32 0
  store i32 1, i32* %105, align 4, !tbaa !17
  store %struct.Cell* %104, %struct.Cell** %p.addr, align 8
  %106 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %107 = icmp ne %struct.Cell* %106, null
  br i1 %107, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %108 = call i8* @nish_alloc_struct(i64 4)
  %109 = bitcast i8* %108 to %struct.Cell*
  %110 = getelementptr inbounds %struct.Cell, %struct.Cell* %109, i32 0, i32 0
  store i32 1, i32* %110, align 4, !tbaa !17
  store %struct.Cell* %109, %struct.Cell** %p.addr, align 8
  %111 = icmp ne %struct.Cell* %109, null
  %112 = call i1 @g(i1 %111)
  br label %land.end.3

land.end.3:
  %113 = phi i1 [ false, %if.end.3 ], [ %112, %land.rhs.3 ]
  br i1 %113, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %114 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %115 = icmp ne %struct.Cell* %114, null
  br label %land.end.2

land.end.2:
  %116 = phi i1 [ false, %land.end.3 ], [ %115, %land.rhs.2 ]
  br i1 %116, label %if.then.4, label %if.end.4

if.then.4:
  %117 = load i32, i32* %total.addr, align 4
  %118 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %119 = getelementptr inbounds %struct.Cell, %struct.Cell* %118, i32 0, i32 0
  %120 = load i32, i32* %119, align 4, !tbaa !17
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %117, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %122, i32* %total.addr, align 4
  br label %if.end.4

if.end.4:
  %124 = load i32, i32* %total.addr, align 4
  %125 = call i8* @nish_str_from_i32(i32 %124)
  call void @nish_print(i8* %125)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
