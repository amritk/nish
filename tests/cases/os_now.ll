%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare double @nish_date_now() #0
declare double @llvm.floor.f64(double) #2

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_date_now()
  store double %0, double* %t.addr, align 8
  %1 = load double, double* %t.addr, align 8
  %2 = load double, double* %t.addr, align 8
  %3 = call double @llvm.floor.f64(double %2)
  %4 = fcmp oeq double %1, %3
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = load double, double* %t.addr, align 8
  %7 = fcmp ogt double %6, 0x4278BCFE56800000
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %8)
  %9 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = sitofp i64 %11 to double
  %13 = fcmp ogt double %12, 0x3FF0000000000000
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load double, double* %t.addr, align 8
  %15 = call i8* @nish_str_from_f64(double %14)
  call void @nish_print(i8* %15)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }

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
