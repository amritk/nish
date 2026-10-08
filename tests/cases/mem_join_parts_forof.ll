%struct.Log = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @noteLongest(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %p.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %n)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %9 = load i32, i32* %i.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = mul nsw i32 %9, %10
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %8, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %14, i8** %23, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = trunc i64 %24 to i32
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %forof.body, label %forof.end

forof.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %29
  %37 = load i8*, i8** %36, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %37, i8** %p.addr, align 8
  %38 = load i8*, i8** %p.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  %43 = load i8*, i8** %42, align 8, !tbaa !4
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  %47 = icmp sgt i32 %41, %46
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load i8*, i8** %p.addr, align 8
  %49 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %48, i8** %49, align 8, !tbaa !4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %50 = load i64, i64* %forof.idx, align 8
  %51 = add i64 %50, 1
  store i64 %51, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %52 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %55 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %56 = load i64, i64* %55, align 8
  %57 = sub i64 %54, 1
  %58 = mul i64 %56, %57
  %59 = icmp eq i64 %54, 0
  %60 = select i1 %59, i64 0, i64 %58
  store i64 %60, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %61 = load i64, i64* %join.at, align 8
  %62 = icmp ult i64 %61, %54
  br i1 %62, label %join.sum.body, label %join.copy

join.sum.body:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %65 = bitcast i8* %64 to i8**
  %66 = getelementptr inbounds i8*, i8** %65, i64 %61
  %67 = load i8*, i8** %66, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %68 = load i64, i64* %join.total, align 8
  %69 = bitcast i8* %67 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = add i64 %68, %70
  store i64 %71, i64* %join.total, align 8
  %72 = add i64 %61, 1
  store i64 %72, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %73 = load i64, i64* %join.total, align 8
  %74 = icmp ugt i64 %73, 2147483647
  %75 = add i64 %73, 9
  %76 = select i1 %74, i64 4611686018427387904, i64 %75
  %77 = call i8* @nish_alloc_struct(i64 %76)
  %78 = bitcast i8* %77 to i64*
  store i64 %73, i64* %78, align 8
  %79 = getelementptr inbounds i8, i8* %77, i64 8
  store i8* %79, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %80 = load i64, i64* %join.at, align 8
  %81 = icmp ult i64 %80, %54
  br i1 %81, label %join.part, label %join.end

join.part:
  %82 = load i8*, i8** %join.p, align 8
  %83 = icmp eq i64 %80, 0
  %84 = select i1 %83, i64 0, i64 %56
  %85 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %82, i8* %85, i64 %84, i1 false)
  %86 = getelementptr inbounds i8, i8* %82, i64 %84
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %89 = bitcast i8* %88 to i8**
  %90 = getelementptr inbounds i8*, i8** %89, i64 %80
  %91 = load i8*, i8** %90, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %92 = bitcast i8* %91 to i64*
  %93 = load i64, i64* %92, align 8
  %94 = getelementptr inbounds i8, i8* %91, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %86, i8* %94, i64 %93, i1 false)
  %95 = getelementptr inbounds i8, i8* %86, i64 %93
  store i8* %95, i8** %join.p, align 8
  %96 = add i64 %80, 1
  store i64 %96, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %97 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %97, align 1
  ret i8* %77
}

define internal noundef nonnull align 8 i8* @run(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %calls) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = srem i32 %3, 9
  %5 = add nsw i32 1, %4
  %6 = call i8* @noteLongest(%struct.Log* %log, i32 %5)
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %total.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  ret i8* %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @churn() #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 2000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.5 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %total.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = call i8* @run(%struct.Log* %0, i32 1000)
  store i8* %1, i8** %total.addr, align 8
  %2 = call i32 @churn()
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load i8*, i8** %total.addr, align 8
  call void @nish_print(i8* %4)
  %5 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %5, i32 0, i32 0
  %7 = load i8*, i8** %6, align 8, !tbaa !4
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Log", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
