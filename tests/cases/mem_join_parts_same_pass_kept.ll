%struct.Log = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
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

define internal noundef nonnull align 8 i8* @quoteKeep(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i8* noundef nonnull noalias readonly align 8 %word, i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %7
  store i8* %word, i8** %14, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = trunc i64 %15 to i32
  %17 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  store i8* %19, i8** %28, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %30 = trunc i64 %29 to i32
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 0
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %42 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %41, i8** %42, align 8, !tbaa !4
  %43 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %46 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*) to i64*
  %47 = load i64, i64* %46, align 8
  %48 = sub i64 %45, 1
  %49 = mul i64 %47, %48
  %50 = icmp eq i64 %45, 0
  %51 = select i1 %50, i64 0, i64 %49
  store i64 %51, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %52 = load i64, i64* %join.at, align 8
  %53 = icmp ult i64 %52, %45
  br i1 %53, label %join.sum.body, label %join.copy

join.sum.body:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %56 = bitcast i8* %55 to i8**
  %57 = getelementptr inbounds i8*, i8** %56, i64 %52
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %59 = load i64, i64* %join.total, align 8
  %60 = bitcast i8* %58 to i64*
  %61 = load i64, i64* %60, align 8
  %62 = add i64 %59, %61
  store i64 %62, i64* %join.total, align 8
  %63 = add i64 %52, 1
  store i64 %63, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %64 = load i64, i64* %join.total, align 8
  %65 = icmp ugt i64 %64, 2147483647
  %66 = add i64 %64, 9
  %67 = select i1 %65, i64 4611686018427387904, i64 %66
  %68 = call i8* @nish_alloc_struct(i64 %67)
  %69 = bitcast i8* %68 to i64*
  store i64 %64, i64* %69, align 8
  %70 = getelementptr inbounds i8, i8* %68, i64 8
  store i8* %70, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %71 = load i64, i64* %join.at, align 8
  %72 = icmp ult i64 %71, %45
  br i1 %72, label %join.part, label %join.end

join.part:
  %73 = load i8*, i8** %join.p, align 8
  %74 = icmp eq i64 %71, 0
  %75 = select i1 %74, i64 0, i64 %47
  %76 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %73, i8* %76, i64 %75, i1 false)
  %77 = getelementptr inbounds i8, i8* %73, i64 %75
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %80 = bitcast i8* %79 to i8**
  %81 = getelementptr inbounds i8*, i8** %80, i64 %71
  %82 = load i8*, i8** %81, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %83 = bitcast i8* %82 to i64*
  %84 = load i64, i64* %83, align 8
  %85 = getelementptr inbounds i8, i8* %82, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %77, i8* %85, i64 %84, i1 false)
  %86 = getelementptr inbounds i8, i8* %77, i64 %84
  store i8* %86, i8** %join.p, align 8
  %87 = add i64 %71, 1
  store i64 %87, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %88 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %88, align 1
  ret i8* %68
}

define internal noundef nonnull align 8 i8* @run(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %calls) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %word.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %3)
  store i8* %4, i8** %word.addr, align 8
  %5 = load i32, i32* %total.addr, align 4
  %6 = load i8*, i8** %word.addr, align 8
  %7 = load i32, i32* %i.addr, align 4
  %8 = srem i32 %7, 9
  %9 = add nsw i32 1, %8
  %10 = call i8* @quoteKeep(%struct.Log* %log, i8* %6, i32 %9)
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %total.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  ret i8* %20

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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.3 to i8*), i8* %8)
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
