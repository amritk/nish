@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef double @nish_random() #0

define internal noundef double @roll() #0 {
entry:
  %0 = call double @nish_random()
  ret double %0
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca double, align 8
  %0 = call double @roll()
  store double %0, double* %r.addr, align 8
  %1 = load double, double* %r.addr, align 8
  %2 = fcmp oge double %1, 0x0000000000000000
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = load double, double* %r.addr, align 8
  %4 = fcmp olt double %3, 0x3FF0000000000000
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  %6 = select i1 %5, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %6)
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
