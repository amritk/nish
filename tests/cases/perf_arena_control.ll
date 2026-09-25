%struct.Log = type { i8* }
%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @makeList(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !8, !noalias !9
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !8, !noalias !9
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @managed(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %rounds) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %m.addr = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i64 @nish_arena_mark()
  store i64 %2, i64* %m.addr, align 8
  %3 = load i32, i32* %total.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = call %struct.nish_array* @makeList(i32 %4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9
  %8 = trunc i64 %7 to i32
  %9 = add nsw i32 %3, %8
  store i32 %9, i32* %total.addr, align 4
  %10 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %10)
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %13 = load i32, i32* %total.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %14, i8** %15, align 8, !tbaa !14
  %16 = call i8* @nish_alloc_struct(i64 4)
  %17 = bitcast i8* %16 to %struct.Box*
  %18 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %17, i32 %18)
  ret %struct.Box* %17
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @summarise(i32 noundef %rounds) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
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
  %6 = load i32, i32* %total.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call %struct.nish_array* @makeList(i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9
  %11 = trunc i64 %10 to i32
  %12 = add nsw i32 %6, %11
  store i32 %12, i32* %total.addr, align 4
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %14 = load i8*, i8** %13, align 8
  %15 = icmp eq i8* %14, %3
  br i1 %15, label %pass.rewind, label %pass.free

pass.rewind:
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %16, align 8
  br label %pass.done

pass.free:
  %17 = ptrtoint i8* %3 to i64
  %18 = add i64 %17, %5
  call void @nish_arena_release(i64 %18)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = call i8* @nish_alloc_struct(i64 4)
  %22 = bitcast i8* %21 to %struct.Box*
  %23 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %22, i32 %23)
  ret %struct.Box* %22
}

define noundef i32 @nish_main() #0 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %before.addr = alloca i64, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %Log.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !14
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %1 = call i64 @nish_arena_used()
  store i64 %1, i64* %before.addr, align 8
  %2 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %3 = call %struct.Box* @managed(%struct.Log* %2, i32 200)
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  store i32 %5, i32* %a.addr, align 4
  %6 = call %struct.Box* @summarise(i32 200)
  %7 = getelementptr inbounds %struct.Box, %struct.Box* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  store i32 %8, i32* %b.addr, align 4
  %9 = load i32, i32* %a.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %b.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %14 = getelementptr inbounds %struct.Log, %struct.Log* %13, i32 0, i32 0
  %15 = load i8*, i8** %14, align 8, !tbaa !14
  call void @nish_print(i8* %15)
  %16 = call i64 @nish_arena_used()
  %17 = load i64, i64* %before.addr, align 8
  %18 = sub nsw i64 %16, %17
  %19 = call i8* @nish_str_from_i64(i64 %18)
  call void @nish_print(i8* %19)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"ptr", !1, i64 0}
!13 = !{!"Log", !12, i64 0}
!14 = !{!13, !12, i64 0}
