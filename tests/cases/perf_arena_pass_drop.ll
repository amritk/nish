%struct.Point = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @lastLabel(i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %label.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %label.addr, align 8
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i8*, i8** %label.addr, align 8
  ret i8* %7
}

define void @nish_main() #1 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  %at.addr = alloca %struct.Point*, align 8
  %j.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %3)
  store i8* %4, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond.1

for.cond.1:
  %7 = load i32, i32* %round.addr, align 4
  %8 = icmp slt i32 %7, 3
  br i1 %8, label %for.body.1, label %for.end.1

for.body.1:
  %9 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %10 = load i8*, i8** %9, align 8
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %12 = load i64, i64* %11, align 8
  store %struct.Point* null, %struct.Point** %at.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %13 = load i32, i32* %j.addr, align 4
  %14 = icmp slt i32 %13, 10
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = bitcast i8* %15 to %struct.Point*
  %17 = load i32, i32* %j.addr, align 4
  call void @Point.constructor(%struct.Point* %16, i32 %17)
  store %struct.Point* %16, %struct.Point** %at.addr, align 8
  %18 = load i32, i32* %j.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %20 = load %struct.Point*, %struct.Point** %at.addr, align 8
  %21 = icmp ne %struct.Point* %20, null
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %total.addr, align 4
  %23 = load %struct.Point*, %struct.Point** %at.addr, align 8
  %24 = getelementptr inbounds %struct.Point, %struct.Point* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4, !tbaa !4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %total.addr, align 4
  br label %if.end

if.end:
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %30 = load i8*, i8** %29, align 8
  %31 = icmp eq i8* %30, %10
  br i1 %31, label %pass.rewind, label %pass.free

pass.rewind:
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %12, i64* %32, align 8
  br label %pass.done

pass.free:
  %33 = ptrtoint i8* %10 to i64
  %34 = add i64 %33, %12
  call void @nish_arena_release(i64 %34)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %35 = load i32, i32* %round.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %round.addr, align 4
  br label %for.cond.1

for.end.1:
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 2, i64* %39, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 2, i64* %40, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %41 = call i8* @nish_alloc_struct(i64 8)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %43 = bitcast i8* %41 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 0
  store i32 0, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %45 = getelementptr inbounds i32, i32* %43, i64 1
  store i32 0, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %38, %struct.nish_array** %row.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.2

for.cond.2:
  %46 = load i32, i32* %i.addr.1, align 4
  %47 = icmp slt i32 %46, 4
  br i1 %47, label %for.body.2, label %for.end.2

for.body.2:
  %48 = load i32, i32* %i.addr.1, align 4
  %49 = load i32, i32* %i.addr.1, align 4
  %50 = call i8* @nish_alloc_struct(i64 24)
  %51 = bitcast i8* %50 to %struct.nish_array*
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  store i64 2, i64* %52, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  store i64 2, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %54 = call i8* @nish_alloc_struct(i64 8)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  store i8* %54, i8** %55, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %56 = bitcast i8* %54 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 0
  store i32 %48, i32* %57, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %58 = getelementptr inbounds i32, i32* %56, i64 1
  store i32 %49, i32* %58, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %51, %struct.nish_array** %row.addr, align 8
  br label %for.inc.2

for.inc.2:
  %59 = load i32, i32* %i.addr.1, align 4
  %60 = add nsw i32 %59, 1
  store i32 %60, i32* %i.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %61 = load i8*, i8** %last.addr, align 8
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %63 = load i32, i32* %total.addr, align 4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %62, i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %67 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %70 = icmp ult i64 1, %69
  br i1 %70, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %69)
  unreachable

bounds.ok:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %73 = bitcast i8* %72 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 1
  %75 = load i32, i32* %74, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %66, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %79 = call i64 @nish_arena_mark()
  %80 = call i8* @lastLabel(i32 5)
  %81 = call i8* @nish_arena_keep(i64 %79, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %78, i8* %81)
  call void @nish_print(i8* %82)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0}
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
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
