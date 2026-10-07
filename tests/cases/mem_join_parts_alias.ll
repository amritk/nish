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
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal noundef nonnull align 8 i8* @noteFirst(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %n) #1 {
entry:
  %mine.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %mine.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %mine.addr, align 8
  store %struct.nish_array* %3, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %7 = call i8* @nish_str_from_i32(i32 %n)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %10 = load i32, i32* %i.addr, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %18 = icmp eq i64 %15, %17
  br i1 %18, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 %15
  store i8* %13, i8** %22, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %23 = add i64 %15, 1
  store i64 %23, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = trunc i64 %23 to i32
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load %struct.nish_array*, %struct.nish_array** %mine.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %33 = bitcast i8* %32 to i8**
  %34 = getelementptr inbounds i8*, i8** %33, i64 0
  %35 = load i8*, i8** %34, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %36 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %35, i8** %36, align 8, !tbaa !4
  %37 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %41 = load i64, i64* %40, align 8
  %42 = sub i64 %39, 1
  %43 = mul i64 %41, %42
  %44 = icmp eq i64 %39, 0
  %45 = select i1 %44, i64 0, i64 %43
  store i64 %45, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %46 = load i64, i64* %join.at, align 8
  %47 = icmp ult i64 %46, %39
  br i1 %47, label %join.sum.body, label %join.copy

join.sum.body:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 %46
  %52 = load i8*, i8** %51, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %53 = load i64, i64* %join.total, align 8
  %54 = bitcast i8* %52 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = add i64 %53, %55
  store i64 %56, i64* %join.total, align 8
  %57 = add i64 %46, 1
  store i64 %57, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %58 = load i64, i64* %join.total, align 8
  %59 = icmp ugt i64 %58, 2147483647
  %60 = add i64 %58, 9
  %61 = select i1 %59, i64 4611686018427387904, i64 %60
  %62 = call i8* @nish_alloc_struct(i64 %61)
  %63 = bitcast i8* %62 to i64*
  store i64 %58, i64* %63, align 8
  %64 = getelementptr inbounds i8, i8* %62, i64 8
  store i8* %64, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %65 = load i64, i64* %join.at, align 8
  %66 = icmp ult i64 %65, %39
  br i1 %66, label %join.part, label %join.end

join.part:
  %67 = load i8*, i8** %join.p, align 8
  %68 = icmp eq i64 %65, 0
  %69 = select i1 %68, i64 0, i64 %41
  %70 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %70, i64 %69, i1 false)
  %71 = getelementptr inbounds i8, i8* %67, i64 %69
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %74 = bitcast i8* %73 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %65
  %76 = load i8*, i8** %75, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %77 = bitcast i8* %76 to i64*
  %78 = load i64, i64* %77, align 8
  %79 = getelementptr inbounds i8, i8* %76, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %71, i8* %79, i64 %78, i1 false)
  %80 = getelementptr inbounds i8, i8* %71, i64 %78
  store i8* %80, i8** %join.p, align 8
  %81 = add i64 %65, 1
  store i64 %81, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %82 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %82, align 1
  ret i8* %62
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
  %6 = call i8* @noteFirst(%struct.Log* %log, i32 %5)
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
