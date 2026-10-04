%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"caf\C3\A9: bar\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal void @printPos(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @storePos(i8* noundef nonnull noalias readonly align 8 nocapture %line, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  %at.addr = alloca i32, align 4
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %at.addr, align 4
  %5 = load i32, i32* %at.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %into, i64 4)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  store i32 %5, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @afterColon(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %0 = bitcast i8* %line to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = sext i32 %5 to i64
  %8 = call i64 @llvm.smin.i64(i64 %7, i64 %1)
  %9 = call i64 @llvm.smax.i64(i64 %8, i64 0)
  %10 = bitcast i8* %line to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = sext i32 %12 to i64
  %14 = call i64 @llvm.smin.i64(i64 %13, i64 %1)
  %15 = call i64 @llvm.smax.i64(i64 %14, i64 0)
  %16 = call i64 @llvm.smin.i64(i64 %9, i64 %15)
  %17 = call i64 @llvm.smax.i64(i64 %9, i64 %15)
  %18 = sub i64 %17, %16
  %19 = getelementptr inbounds i8, i8* %line, i64 8
  %20 = getelementptr inbounds i8, i8* %19, i64 %16
  %21 = call i8* @nish_str_new(i8* %20, i64 %18)
  ret i8* %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @afterGap(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %0 = bitcast i8* %line to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = sext i32 %5 to i64
  %8 = call i64 @llvm.smin.i64(i64 %7, i64 %1)
  %9 = call i64 @llvm.smax.i64(i64 %8, i64 0)
  %10 = bitcast i8* %line to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = sext i32 %12 to i64
  %14 = call i64 @llvm.smin.i64(i64 %13, i64 %1)
  %15 = call i64 @llvm.smax.i64(i64 %14, i64 0)
  %16 = call i64 @llvm.smin.i64(i64 %9, i64 %15)
  %17 = call i64 @llvm.smax.i64(i64 %9, i64 %15)
  %18 = sub i64 %17, %16
  %19 = getelementptr inbounds i8, i8* %line, i64 8
  %20 = getelementptr inbounds i8, i8* %19, i64 %16
  %21 = call i8* @nish_str_new(i8* %20, i64 %18)
  ret i8* %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
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
