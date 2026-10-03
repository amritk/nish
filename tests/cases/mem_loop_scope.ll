%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"grows\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %length) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %length, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @build(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = srem i32 %n, 7
  %7 = add nsw i32 64, %6
  %8 = icmp slt i32 %5, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @summarise(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call %struct.nish_array* @build(i32 %6)
  store %struct.nish_array* %7, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %total.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = trunc i64 %11 to i32
  %13 = add nsw i32 %8, %12
  store i32 %13, i32* %total.addr, align 4
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %15 = load i8*, i8** %14, align 8
  %16 = icmp eq i8* %15, %3
  br i1 %16, label %pass.rewind, label %pass.free

pass.rewind:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %17, align 8
  br label %pass.done

pass.free:
  %18 = ptrtoint i8* %3 to i64
  %19 = add i64 %18, %5
  call void @nish_arena_release(i64 %19)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = call i8* @nish_alloc_struct(i64 4)
  %23 = bitcast i8* %22 to %struct.Box*
  %24 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %23, i32 %24)
  ret %struct.Box* %23
}

define internal noundef nonnull align 8 i8* @grows(i32 noundef %rounds) #1 {
entry:
  %grown.addr = alloca i64, align 8
  %total.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %box.addr = alloca %struct.Box*, align 8
  store i64 0, i64* %grown.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call i64 @nish_arena_used()
  store i64 %2, i64* %before.addr, align 8
  %3 = call %struct.Box* @summarise(i32 %rounds)
  store %struct.Box* %3, %struct.Box** %box.addr, align 8
  %4 = call i64 @nish_arena_used()
  %5 = load i64, i64* %before.addr, align 8
  %6 = sub nsw i64 %4, %5
  store i64 %6, i64* %grown.addr, align 8
  %7 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !4
  store i32 %9, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %1)
  %10 = load i32, i32* %total.addr, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load i64, i64* %grown.addr, align 8
  %14 = call i8* @nish_str_from_i64(i64 %13)
  %15 = call i8* @nish_str_concat(i8* %12, i8* %14)
  ret i8* %15
}

define void @nish_main() #1 {
entry:
  %one.addr = alloca i8*, align 8
  %many.addr = alloca i8*, align 8
  %g1.addr = alloca i8*, align 8
  %g2.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @grows(i32 1)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %one.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @grows(i32 4000)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %many.addr, align 8
  %6 = load i8*, i8** %one.addr, align 8
  call void @nish_print(i8* %6)
  %7 = load i8*, i8** %many.addr, align 8
  call void @nish_print(i8* %7)
  %8 = load i8*, i8** %one.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = load i8*, i8** %one.addr, align 8
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = trunc i64 %12 to i32
  %14 = add nsw i32 %13, 1
  %15 = sext i32 %14 to i64
  %16 = call i64 @llvm.smin.i64(i64 %15, i64 %10)
  %17 = call i64 @llvm.smax.i64(i64 %16, i64 0)
  %18 = load i8*, i8** %one.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = sext i32 %21 to i64
  %23 = call i64 @llvm.smin.i64(i64 %22, i64 %10)
  %24 = call i64 @llvm.smax.i64(i64 %23, i64 0)
  %25 = call i64 @llvm.smin.i64(i64 %17, i64 %24)
  %26 = call i64 @llvm.smax.i64(i64 %17, i64 %24)
  %27 = sub i64 %26, %25
  %28 = getelementptr inbounds i8, i8* %8, i64 8
  %29 = getelementptr inbounds i8, i8* %28, i64 %25
  %30 = call i8* @nish_str_new(i8* %29, i64 %27)
  store i8* %30, i8** %g1.addr, align 8
  %31 = load i8*, i8** %many.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = load i8*, i8** %many.addr, align 8
  %35 = call i64 @nish_str_index_of(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = trunc i64 %35 to i32
  %37 = add nsw i32 %36, 1
  %38 = sext i32 %37 to i64
  %39 = call i64 @llvm.smin.i64(i64 %38, i64 %33)
  %40 = call i64 @llvm.smax.i64(i64 %39, i64 0)
  %41 = load i8*, i8** %many.addr, align 8
  %42 = bitcast i8* %41 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = trunc i64 %43 to i32
  %45 = sext i32 %44 to i64
  %46 = call i64 @llvm.smin.i64(i64 %45, i64 %33)
  %47 = call i64 @llvm.smax.i64(i64 %46, i64 0)
  %48 = call i64 @llvm.smin.i64(i64 %40, i64 %47)
  %49 = call i64 @llvm.smax.i64(i64 %40, i64 %47)
  %50 = sub i64 %49, %48
  %51 = getelementptr inbounds i8, i8* %31, i64 8
  %52 = getelementptr inbounds i8, i8* %51, i64 %48
  %53 = call i8* @nish_str_new(i8* %52, i64 %50)
  store i8* %53, i8** %g2.addr, align 8
  %54 = load i8*, i8** %g1.addr, align 8
  %55 = load i8*, i8** %g2.addr, align 8
  %56 = call zeroext i1 @nish_str_eq(i8* %54, i8* %55)
  br i1 %56, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %57 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %57)
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
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
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
