%struct.Log = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"build/mem_return_array_readdir\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/alpha_first_entry\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #0
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @listOf(i8* noundef nonnull noalias readonly align 8 nocapture %d) #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish_readdir(i8* %d)
  store %struct.nish_array* %0, %struct.nish_array** %names.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  ret %struct.nish_array* %4

if.end:
  %8 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  ret %struct.nish_array* %8
}

define internal noundef nonnull align 8 i8* @firstOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %names) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @pick(i8* noundef nonnull noalias readonly align 8 nocapture %d) #1 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish_readdir(i8* %d)
  store %struct.nish_array* %0, %struct.nish_array** %names.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  %3 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %4 = call i8* @firstOf(%struct.nish_array* %3)
  ret i8* %4
}

define internal noundef nonnull align 8 i8* @named(i8* noundef nonnull noalias readonly align 8 nocapture %d) #1 {
entry:
  %name.addr = alloca i8*, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %name.addr, align 8
  %0 = call %struct.nish_array* @nish_readdir(i8* %d)
  store %struct.nish_array* %0, %struct.nish_array** %names.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %2 = icmp ne %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 0
  %11 = load i8*, i8** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %11, i8** %name.addr, align 8
  br label %if.end

if.end:
  %12 = load i8*, i8** %name.addr, align 8
  ret i8* %12
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %keep.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %names.addr = alloca %struct.nish_array*, align 8
  %picked.addr = alloca i8*, align 8
  %assigned.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %1 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [19 x i8] }* @.str.3 to i8*))
  call void @nish_write_file(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %keep.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = call %struct.nish_array* @listOf(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = icmp ult i64 0, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 0
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %13, i8** %keep.addr, align 8
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %16 = load i32, i32* %i.addr.1, align 4
  %17 = icmp slt i32 %16, 3
  br i1 %17, label %for.body.1, label %for.end.1

for.body.1:
  %18 = call %struct.nish_array* @nish_readdir(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  store %struct.nish_array* %18, %struct.nish_array** %names.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %20 = icmp ne %struct.nish_array* %19, null
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 0
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %31 = getelementptr inbounds %struct.Log, %struct.Log* %21, i32 0, i32 0
  store i8* %30, i8** %31, align 8, !tbaa !4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %34 = call i8* @pick(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  store i8* %34, i8** %picked.addr, align 8
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @named(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  store i8* %37, i8** %assigned.addr, align 8
  %38 = call i32 @churn()
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = load i8*, i8** %keep.addr, align 8
  call void @nish_print(i8* %40)
  %41 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %42 = getelementptr inbounds %struct.Log, %struct.Log* %41, i32 0, i32 0
  %43 = load i8*, i8** %42, align 8, !tbaa !4
  call void @nish_print(i8* %43)
  %44 = load i8*, i8** %picked.addr, align 8
  call void @nish_print(i8* %44)
  %45 = load i8*, i8** %assigned.addr, align 8
  call void @nish_print(i8* %45)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
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
