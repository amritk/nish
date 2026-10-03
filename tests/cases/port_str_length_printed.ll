%struct.Label = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" is \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"l\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"long\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal void @Label.constructor(%struct.Label* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Label, %struct.Label* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @describe(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %0 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = bitcast i8* %name to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %0, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  ret i8* %6
}

define internal noundef i32 @room(i8* noundef nonnull noalias readonly align 8 nocapture %name, i32 noundef %column) #2 {
entry:
  %0 = bitcast i8* %name to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %column, %2
  ret i32 %3
}

define noundef i32 @nish_main() #1 {
entry:
  %name.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %label.addr = alloca %struct.Label*, align 8
  %Label.obj = alloca %struct.Label, align 8
  %widths.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8** %name.addr, align 8
  %0 = load i8*, i8** %name.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load i8*, i8** %name.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %n.addr, align 4
  call void @Label.constructor(%struct.Label* %Label.obj)
  store %struct.Label* %Label.obj, %struct.Label** %label.addr, align 8
  %9 = load %struct.Label*, %struct.Label** %label.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  %11 = getelementptr inbounds %struct.Label, %struct.Label* %9, i32 0, i32 0
  store i32 %10, i32* %11, align 4, !tbaa !4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %widths.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %widths.addr, align 8
  %16 = load i8*, i8** %name.addr, align 8
  %17 = call i64 @nish_str_index_of(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %18 = trunc i64 %17 to i32
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  store i32 %18, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = trunc i64 %28 to i32
  %30 = load i8*, i8** %name.addr, align 8
  %31 = call i64 @nish_arena_mark()
  %32 = call i8* @describe(i8* %30)
  %33 = call i8* @nish_arena_keep(i64 %31, i8* %32)
  call void @nish_print(i8* %33)
  %34 = load i8*, i8** %name.addr, align 8
  %35 = call i32 @room(i8* %34, i32 10)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
  %37 = load i8*, i8** %name.addr, align 8
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  %41 = icmp sgt i32 %40, 5
  br i1 %41, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*))
  br label %if.end

if.end:
  %42 = load %struct.Label*, %struct.Label** %label.addr, align 8
  %43 = getelementptr inbounds %struct.Label, %struct.Label* %42, i32 0, i32 0
  %44 = load i32, i32* %43, align 4, !tbaa !4
  %45 = load %struct.nish_array*, %struct.nish_array** %widths.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %48 = icmp ult i64 0, %47
  br i1 %48, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %47)
  unreachable

bounds.ok:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %51 = bitcast i8* %50 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 0
  %53 = load i32, i32* %52, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %54 = add nsw i32 %44, %53
  %55 = call i8* @nish_str_from_i32(i32 %54)
  call void @nish_print(i8* %55)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Label", !2, i64 0}
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
