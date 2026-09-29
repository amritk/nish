%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"tests/cases/os_mtime.missing\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"tests/cases\00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare double @nish_stat_mtime(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %missing.addr = alloca double, align 8
  %dir.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_stat_mtime(i8* bitcast ({ i64, [29 x i8] }* @.str.0 to i8*))
  store double %0, double* %missing.addr, align 8
  %1 = load double, double* %missing.addr, align 8
  %2 = load double, double* %missing.addr, align 8
  %3 = fcmp une double %1, %2
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %4)
  %5 = call double @nish_stat_mtime(i8* bitcast ({ i64, [12 x i8] }* @.str.3 to i8*))
  store double %5, double* %dir.addr, align 8
  %6 = load double, double* %dir.addr, align 8
  %7 = load double, double* %dir.addr, align 8
  %8 = fcmp oeq double %6, %7
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load double, double* %dir.addr, align 8
  %10 = fcmp ogt double %9, 0x0000000000000000
  br label %land.end

land.end:
  %11 = phi i1 [ false, %entry ], [ %10, %land.rhs ]
  %12 = select i1 %11, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = sitofp i64 %15 to double
  %17 = fcmp ogt double %16, 0x3FF0000000000000
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %19 = fptosi double 0x3FF0000000000000 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = call double @nish_stat_mtime(i8* %27)
  %29 = call i8* @nish_str_from_f64(double %28)
  call void @nish_print(i8* %29)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
