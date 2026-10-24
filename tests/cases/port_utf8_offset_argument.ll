%struct.Ruler = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"l\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
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

define internal void @Ruler.constructor(%struct.Ruler* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %width) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Ruler, %struct.Ruler* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !15
  %6 = getelementptr inbounds %struct.Ruler, %struct.Ruler* %this, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 %width, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  ret void
}

define internal void @Ruler.show(%struct.Ruler* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @shout(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @relay(i32 noundef %n) #0 {
entry:
  call void @shout(i32 %n)
  ret void
}

define internal noundef nonnull align 8 i8* @tail(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %from) #0 {
entry:
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = call i64 @llvm.smin.i64(i64 %2, i64 %1)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = bitcast i8* %text to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = sext i32 %7 to i64
  %9 = call i64 @llvm.smin.i64(i64 %8, i64 %1)
  %10 = call i64 @llvm.smax.i64(i64 %9, i64 0)
  %11 = call i64 @llvm.smin.i64(i64 %4, i64 %10)
  %12 = call i64 @llvm.smax.i64(i64 %4, i64 %10)
  %13 = sub i64 %12, %11
  %14 = getelementptr inbounds i8, i8* %text, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %11
  %16 = call i8* @nish_str_new(i8* %15, i64 %13)
  ret i8* %16
}

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %ruler.addr = alloca %struct.Ruler*, align 8
  %Ruler.obj = alloca %struct.Ruler, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = call i64 @nish_str_index_of(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %2 = trunc i64 %1 to i32
  call void @shout(i32 %2)
  %3 = load i8*, i8** %word.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  call void @relay(i32 %6)
  %7 = load i8*, i8** %word.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  call void @Ruler.constructor(%struct.Ruler* %Ruler.obj, i32 %10)
  store %struct.Ruler* %Ruler.obj, %struct.Ruler** %ruler.addr, align 8
  %11 = load %struct.Ruler*, %struct.Ruler** %ruler.addr, align 8
  %12 = load i8*, i8** %word.addr, align 8
  %13 = call i64 @nish_str_index_of(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %14 = trunc i64 %13 to i32
  call void @Ruler.show(%struct.Ruler* %11, i32 %14)
  %15 = load %struct.Ruler*, %struct.Ruler** %ruler.addr, align 8
  %16 = getelementptr inbounds %struct.Ruler, %struct.Ruler* %15, i32 0, i32 0
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !15
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = load i8*, i8** %word.addr, align 8
  %23 = load i8*, i8** %word.addr, align 8
  %24 = call i64 @nish_str_index_of(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %25 = trunc i64 %24 to i32
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @tail(i8* %22, i32 %25)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  call void @nish_print(i8* %28)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
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
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Ruler", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
