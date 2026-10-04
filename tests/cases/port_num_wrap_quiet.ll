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
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %n.addr, align 4
  store i32 3, i32* %step.addr, align 4
  %6 = load i32, i32* %step.addr, align 4
  %7 = add nsw i32 %6, 1
  %8 = icmp ult i32 %7, 11
  br i1 %8, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %7, i32* %step.addr, align 4
  store double 0x3FF8000000000000, double* %x.addr, align 8
  %9 = load double, double* %x.addr, align 8
  %10 = fmul double %9, 0x4000000000000000
  store double %10, double* %x.addr, align 8
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %11, i8** %s.addr, align 8
  %12 = load i32, i32* %n.addr, align 4
  %13 = load i32, i32* %step.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %17)
  %18 = load double, double* %x.addr, align 8
  %19 = call i8* @nish_str_from_f64(double %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %s.addr, align 8
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
