%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"value out of range: expected integer<-128, 127>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noundef i8 @getByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8 %8
}

define internal noundef i32 @offset(i32 noundef %x) #1 {
entry:
  %0 = add nsw i32 %x, 128
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %n.addr = alloca i32, align 4
  %narrow.addr = alloca i32, align 4
  %hex.addr = alloca i32, align 4
  %bin.addr = alloca i32, align 4
  %dec.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 10, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 20, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 30, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 40, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  store i32 2, i32* %n.addr, align 4
  store i32 3, i32* %narrow.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  %11 = call i8 @getByte(%struct.nish_array* %9, i32 %10)
  %12 = zext i8 %11 to i64
  %13 = call i8* @nish_str_from_u64(i64 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %16 = load i32, i32* %narrow.addr, align 4
  %17 = call i8 @getByte(%struct.nish_array* %15, i32 %16)
  %18 = zext i8 %17 to i64
  %19 = call i8* @nish_str_from_u64(i64 %18)
  %20 = call i8* @nish_str_concat(i8* %14, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %23 = call i8 @getByte(%struct.nish_array* %22, i32 0)
  %24 = zext i8 %23 to i64
  %25 = call i8* @nish_str_from_u64(i64 %24)
  %26 = call i8* @nish_str_concat(i8* %21, i8* %25)
  call void @nish_print(i8* %26)
  %27 = sub nsw i32 0, 128
  %28 = call i32 @offset(i32 %27)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load i32, i32* %n.addr, align 4
  %32 = sub nsw i32 %31, 5
  %33 = sub i32 %32, -128
  %34 = icmp ult i32 %33, 256
  br i1 %34, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [48 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %35 = call i32 @offset(i32 %32)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %30, i8* %36)
  call void @nish_print(i8* %37)
  store i32 200, i32* %hex.addr, align 4
  %38 = load i32, i32* %hex.addr, align 4
  %39 = call i32 @echo$rng.p0.p255(i32 %38)
  store i32 %39, i32* %bin.addr, align 4
  %40 = load i32, i32* %bin.addr, align 4
  %41 = call i32 @echo$rng.p0.p255(i32 %40)
  store i32 %41, i32* %dec.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %43 = load i32, i32* %dec.addr, align 4
  %44 = sub nsw i32 %43, 197
  %45 = icmp ult i32 %44, 256
  br i1 %45, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  %46 = call i8 @getByte(%struct.nish_array* %42, i32 %44)
  %47 = zext i8 %46 to i64
  %48 = call i8* @nish_str_from_u64(i64 %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @echo$rng.p0.p255(i32 noundef %x) #1 {
entry:
  ret i32 %x
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
