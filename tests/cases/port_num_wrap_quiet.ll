@.str.0 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 10>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare void @nish_exit(i32 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %x.addr = alloca double, align 8
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 40, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = add nsw i32 %0, 2
  store i32 %1, i32* %n.addr, align 4
  %2 = load i32, i32* %n.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %n.addr, align 4
  store i32 3, i32* %step.addr, align 4
  %4 = load i32, i32* %step.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = icmp ult i32 %5, 11
  br i1 %6, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %5, i32* %step.addr, align 4
  store double 0x3FF8000000000000, double* %x.addr, align 8
  %7 = load double, double* %x.addr, align 8
  %8 = fmul double %7, 0x4000000000000000
  store double %8, double* %x.addr, align 8
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %9, i8** %s.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  %11 = load i32, i32* %step.addr, align 4
  %12 = add nsw i32 %10, %11
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load double, double* %x.addr, align 8
  %15 = call i8* @nish_str_from_f64(double %14)
  call void @nish_print(i8* %15)
  %16 = load i8*, i8** %s.addr, align 8
  call void @nish_print(i8* %16)
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
