%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"caf\C3\A9: bar\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

define internal void @printPos(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = add nsw i32 %1, 1
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @storePos(i8* noundef nonnull noalias readonly align 8 nocapture %line, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  %at.addr = alloca i32, align 4
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %at.addr, align 4
  %3 = load i32, i32* %at.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %into, i64 4)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  store i32 %3, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  ret void
}

define internal noundef nonnull align 8 i8* @afterColon(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %0 = bitcast i8* %line to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  %4 = add nsw i32 %3, 1
  %5 = sext i32 %4 to i64
  %6 = call i64 @llvm.smin.i64(i64 %5, i64 %1)
  %7 = call i64 @llvm.smax.i64(i64 %6, i64 0)
  %8 = bitcast i8* %line to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = sext i32 %10 to i64
  %12 = call i64 @llvm.smin.i64(i64 %11, i64 %1)
  %13 = call i64 @llvm.smax.i64(i64 %12, i64 0)
  %14 = call i64 @llvm.smin.i64(i64 %7, i64 %13)
  %15 = call i64 @llvm.smax.i64(i64 %7, i64 %13)
  %16 = sub i64 %15, %14
  %17 = getelementptr inbounds i8, i8* %line, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = call i8* @nish_str_new(i8* %18, i64 %16)
  ret i8* %19
}

define internal noundef nonnull align 8 i8* @afterGap(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %0 = bitcast i8* %line to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  %4 = add nsw i32 %3, 2
  %5 = sext i32 %4 to i64
  %6 = call i64 @llvm.smin.i64(i64 %5, i64 %1)
  %7 = call i64 @llvm.smax.i64(i64 %6, i64 0)
  %8 = bitcast i8* %line to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = sext i32 %10 to i64
  %12 = call i64 @llvm.smin.i64(i64 %11, i64 %1)
  %13 = call i64 @llvm.smax.i64(i64 %12, i64 0)
  %14 = call i64 @llvm.smin.i64(i64 %7, i64 %13)
  %15 = call i64 @llvm.smax.i64(i64 %7, i64 %13)
  %16 = sub i64 %15, %14
  %17 = getelementptr inbounds i8, i8* %line, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = call i8* @nish_str_new(i8* %18, i64 %16)
  ret i8* %19
}

define noundef i32 @nish_main() #1 {
entry:
  %line.addr = alloca i8*, align 8
  %positions.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i8** %line.addr, align 8
  %0 = load i8*, i8** %line.addr, align 8
  call void @printPos(i8* %0)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %positions.addr, align 8
  %4 = load i8*, i8** %line.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %positions.addr, align 8
  call void @storePos(i8* %4, %struct.nish_array* %5)
  %6 = load %struct.nish_array*, %struct.nish_array** %positions.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 0, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = load i8*, i8** %line.addr, align 8
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @afterColon(i8* %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %line.addr, align 8
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @afterGap(i8* %20)
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  call void @nish_print(i8* %23)
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
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
