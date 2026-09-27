%struct.Flags = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 15>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #2

define internal void @Flags.set(%struct.Flags* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Flags, %struct.Flags* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = and i32 %n, 31
  %3 = shl i32 1, %2
  %4 = or i32 %1, %3
  %5 = icmp ult i32 %4, 256
  br i1 %5, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %4, i32* %0, align 4
  %6 = getelementptr inbounds %struct.Flags, %struct.Flags* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = and i32 %n, 31
  %9 = shl i32 %7, %8
  %10 = icmp ult i32 %9, 256
  br i1 %10, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  store i32 %9, i32* %6, align 4
  %11 = getelementptr inbounds %struct.Flags, %struct.Flags* %this, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = and i32 %n, 31
  %14 = ashr i32 %12, %13
  %15 = icmp ult i32 %14, 256
  br i1 %15, label %rng.ok.2, label %rng.fail.2

rng.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.2:
  store i32 %14, i32* %11, align 4
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %mask.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %f.addr = alloca %struct.Flags*, align 8
  %Flags.obj = alloca %struct.Flags, align 8
  %cells.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 255, i32* %mask.addr, align 4
  store i32 2, i32* %n.addr, align 4
  %0 = load i32, i32* %mask.addr, align 4
  %1 = and i32 %0, 60
  %2 = icmp ult i32 %1, 256
  br i1 %2, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %1, i32* %mask.addr, align 4
  %3 = load i32, i32* %mask.addr, align 4
  %4 = xor i32 %3, 12
  %5 = icmp ult i32 %4, 256
  br i1 %5, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  store i32 %4, i32* %mask.addr, align 4
  %6 = load i32, i32* %mask.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = and i32 %7, 31
  %9 = ashr i32 %6, %8
  %10 = icmp ult i32 %9, 256
  br i1 %10, label %rng.ok.2, label %rng.fail.2

rng.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.2:
  store i32 %9, i32* %mask.addr, align 4
  %11 = load i32, i32* %mask.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = and i32 %12, 31
  %14 = shl i32 %11, %13
  %15 = icmp ult i32 %14, 256
  br i1 %15, label %rng.ok.3, label %rng.fail.3

rng.fail.3:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.3:
  store i32 %14, i32* %mask.addr, align 4
  %16 = load i32, i32* %mask.addr, align 4
  %17 = load i32, i32* %n.addr, align 4
  %18 = and i32 %17, 31
  %19 = lshr i32 %16, %18
  %20 = icmp ult i32 %19, 256
  br i1 %20, label %rng.ok.4, label %rng.fail.4

rng.fail.4:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.4:
  store i32 %19, i32* %mask.addr, align 4
  %21 = getelementptr inbounds %struct.Flags, %struct.Flags* %Flags.obj, i32 0, i32 0
  store i32 0, i32* %21, align 4, !tbaa !4
  store %struct.Flags* %Flags.obj, %struct.Flags** %f.addr, align 8
  %22 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %23 = load i32, i32* %n.addr, align 4
  call void @Flags.set(%struct.Flags* %22, i32 %23)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %26 = bitcast [2 x i32]* %arr.data to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %28 = bitcast i8* %26 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  store i32 7, i32* %29, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %30 = getelementptr inbounds i32, i32* %28, i64 1
  store i32 8, i32* %30, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %cells.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  %36 = load i32, i32* %35, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %37 = or i32 %36, 8
  %38 = icmp ult i32 %37, 16
  br i1 %38, label %rng.ok.5, label %rng.fail.5

rng.fail.5:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.5:
  store i32 %37, i32* %35, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %39 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 1
  %44 = load i32, i32* %43, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %45 = load i32, i32* %n.addr, align 4
  %46 = and i32 %45, 31
  %47 = ashr i32 %44, %46
  %48 = icmp ult i32 %47, 16
  br i1 %48, label %rng.ok.6, label %rng.fail.6

rng.fail.6:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.6:
  store i32 %47, i32* %43, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %49 = load i32, i32* %mask.addr, align 4
  %50 = call i8* @nish_str_from_i32(i32 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %52 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %53 = getelementptr inbounds %struct.Flags, %struct.Flags* %52, i32 0, i32 0
  %54 = load i32, i32* %53, align 4, !tbaa !4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %51, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %58 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  %63 = load i32, i32* %62, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %57, i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %67 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 1
  %72 = load i32, i32* %71, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %66, i8* %73)
  call void @nish_print(i8* %74)
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
attributes #2 = { noreturn nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Flags", !2, i64 0}
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
