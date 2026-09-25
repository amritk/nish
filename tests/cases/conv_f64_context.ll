%struct.Config = type { double, { %struct.nish_array, [3 x double] } }
%struct.Point = type { double, double }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @Config.constructor(%struct.Config* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Config, %struct.Config* %this, i32 0, i32 0
  store double 0x3FD0000000000000, double* %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Config, %struct.Config* %this, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.Config, %struct.Config* %this, i32 0, i32 1, i32 1, i64 0
  %3 = bitcast double* %2 to i8*
  %4 = bitcast i8* %3 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FE0000000000000, double* %5, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x3FF8000000000000, double* %6, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %7 = getelementptr inbounds double, double* %4, i64 2
  store double 0x4004000000000000, double* %7, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  ret void
}

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, double noundef %x, double noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store double %x, double* %0, align 8, !tbaa !17
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store double %y, double* %1, align 8, !tbaa !18
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x double], align 8
  %c.addr = alloca %struct.Config*, align 8
  %Config.obj = alloca %struct.Config, align 8
  %Point.obj = alloca %struct.Point, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %2 = bitcast [2 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !20
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FE0000000000000, double* %5, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x3FF8000000000000, double* %6, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.Config, %struct.Config* %Config.obj, i32 0, i32 1, i32 0
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %10 = getelementptr inbounds %struct.Config, %struct.Config* %Config.obj, i32 0, i32 1, i32 1, i64 0
  %11 = bitcast double* %10 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !20
  call void @Config.constructor(%struct.Config* %Config.obj)
  store %struct.Config* %Config.obj, %struct.Config** %c.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !20
  %16 = bitcast i8* %15 to double*
  %17 = getelementptr inbounds double, double* %16, i64 0
  %18 = load double, double* %17, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %19 = load %struct.Config*, %struct.Config** %c.addr, align 8
  %20 = getelementptr inbounds %struct.Config, %struct.Config* %19, i32 0, i32 0
  %21 = load double, double* %20, align 8, !tbaa !4
  %22 = fadd double %18, %21
  %23 = load %struct.Config*, %struct.Config** %c.addr, align 8
  %24 = getelementptr inbounds %struct.Config, %struct.Config* %23, i32 0, i32 1, i32 0
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %27 = icmp ult i64 2, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.Config, %struct.Config* %23, i32 0, i32 1, i32 1, i64 0
  %29 = bitcast double* %28 to i8*
  %30 = bitcast i8* %29 to double*
  %31 = getelementptr inbounds double, double* %30, i64 2
  %32 = load double, double* %31, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %33 = fadd double %22, %32
  %34 = call i8* @nish_str_from_f64(double %33)
  call void @nish_print(i8* %34)
  call void @Point.constructor(%struct.Point* %Point.obj, double 0x3FF8000000000000, double 0x4002000000000000)
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  %36 = load double, double* %35, align 8, !tbaa !17
  %37 = call i8* @nish_str_from_f64(double %36)
  call void @nish_print(i8* %37)
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
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"Config", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element double", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!"Point", !2, i64 0, !2, i64 8}
!17 = !{!16, !2, i64 0}
!18 = !{!16, !2, i64 8}
!19 = !{!14, !12, i64 8}
!20 = !{!14, !13, i64 16}
