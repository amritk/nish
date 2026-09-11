@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define internal noundef i64 @bitsOf(double noundef %x) #0 {
entry:
  %0 = bitcast double %x to i64
  ret i64 %0
}

define internal noundef double @valueOf(i64 noundef %b) #0 {
entry:
  %0 = bitcast i64 %b to double
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @bitsOf(double 0x0000000000000000)
  %1 = call i8* @nish_str_from_i64(i64 %0)
  call void @nish_print(i8* %1)
  %2 = call i64 @bitsOf(double 0x3FF0000000000000)
  %3 = call i8* @nish_str_from_i64(i64 %2)
  call void @nish_print(i8* %3)
  %4 = fneg double 0x4000000000000000
  %5 = call i64 @bitsOf(double %4)
  %6 = call i8* @nish_str_from_i64(i64 %5)
  call void @nish_print(i8* %6)
  %7 = call i64 @bitsOf(double 0x400921FB54442D18)
  %8 = call double @valueOf(i64 %7)
  %9 = call i8* @nish_str_from_f64(double %8)
  call void @nish_print(i8* %9)
  %10 = fneg double 0x3FE0000000000000
  %11 = call i64 @bitsOf(double %10)
  %12 = call double @valueOf(i64 %11)
  %13 = fneg double 0x3FE0000000000000
  %14 = fcmp oeq double %12, %13
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %15)
  %16 = fneg double 0x0000000000000000
  %17 = call i64 @bitsOf(double %16)
  %18 = icmp slt i64 %17, 0
  %19 = select i1 %18, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
