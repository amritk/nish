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
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_div(i1 noundef zeroext) #4
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  %6 = icmp eq i32 7, 0
  %7 = icmp eq i32 %n, -2147483648
  %8 = icmp eq i32 7, -1
  %9 = and i1 %7, %8
  %10 = or i1 %6, %9
  br i1 %10, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %6)
  unreachable

div.ok:
  %11 = srem i32 %n, 7
  %12 = add nsw i32 64, %11
  %13 = icmp slt i32 %5, %12
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %15 = load i32, i32* %i.addr, align 4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 4)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  store i32 %15, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = trunc i64 %25 to i32
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %29
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
  %m.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %box.addr = alloca %struct.Box*, align 8
  %grown.addr = alloca i64, align 8
  %total.addr = alloca i32, align 4
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i64 @nish_arena_used()
  store i64 %1, i64* %before.addr, align 8
  %2 = call %struct.Box* @summarise(i32 %rounds)
  store %struct.Box* %2, %struct.Box** %box.addr, align 8
  %3 = call i64 @nish_arena_used()
  %4 = load i64, i64* %before.addr, align 8
  %5 = sub nsw i64 %3, %4
  store i64 %5, i64* %grown.addr, align 8
  %6 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %7 = getelementptr inbounds %struct.Box, %struct.Box* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  store i32 %8, i32* %total.addr, align 4
  %9 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %9)
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
  %0 = call i8* @grows(i32 1)
  store i8* %0, i8** %one.addr, align 8
  %1 = call i8* @grows(i32 4000)
  store i8* %1, i8** %many.addr, align 8
  %2 = load i8*, i8** %one.addr, align 8
  call void @nish_print(i8* %2)
  %3 = load i8*, i8** %many.addr, align 8
  call void @nish_print(i8* %3)
  %4 = load i8*, i8** %one.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = load i8*, i8** %one.addr, align 8
  %8 = call i64 @nish_str_index_of(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = trunc i64 %8 to i32
  %10 = add nsw i32 %9, 1
  %11 = sext i32 %10 to i64
  %12 = call i64 @llvm.smin.i64(i64 %11, i64 %6)
  %13 = call i64 @llvm.smax.i64(i64 %12, i64 0)
  %14 = load i8*, i8** %one.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = sext i32 %17 to i64
  %19 = call i64 @llvm.smin.i64(i64 %18, i64 %6)
  %20 = call i64 @llvm.smax.i64(i64 %19, i64 0)
  %21 = call i64 @llvm.smin.i64(i64 %13, i64 %20)
  %22 = call i64 @llvm.smax.i64(i64 %13, i64 %20)
  %23 = sub i64 %22, %21
  %24 = getelementptr inbounds i8, i8* %4, i64 8
  %25 = getelementptr inbounds i8, i8* %24, i64 %21
  %26 = call i8* @nish_str_new(i8* %25, i64 %23)
  store i8* %26, i8** %g1.addr, align 8
  %27 = load i8*, i8** %many.addr, align 8
  %28 = bitcast i8* %27 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = load i8*, i8** %many.addr, align 8
  %31 = call i64 @nish_str_index_of(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = trunc i64 %31 to i32
  %33 = add nsw i32 %32, 1
  %34 = sext i32 %33 to i64
  %35 = call i64 @llvm.smin.i64(i64 %34, i64 %29)
  %36 = call i64 @llvm.smax.i64(i64 %35, i64 0)
  %37 = load i8*, i8** %many.addr, align 8
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  %41 = sext i32 %40 to i64
  %42 = call i64 @llvm.smin.i64(i64 %41, i64 %29)
  %43 = call i64 @llvm.smax.i64(i64 %42, i64 0)
  %44 = call i64 @llvm.smin.i64(i64 %36, i64 %43)
  %45 = call i64 @llvm.smax.i64(i64 %36, i64 %43)
  %46 = sub i64 %45, %44
  %47 = getelementptr inbounds i8, i8* %27, i64 8
  %48 = getelementptr inbounds i8, i8* %47, i64 %44
  %49 = call i8* @nish_str_new(i8* %48, i64 %46)
  store i8* %49, i8** %g2.addr, align 8
  %50 = load i8*, i8** %g1.addr, align 8
  %51 = load i8*, i8** %g2.addr, align 8
  %52 = call zeroext i1 @nish_str_eq(i8* %50, i8* %51)
  br i1 %52, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %53 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %53)
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
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
