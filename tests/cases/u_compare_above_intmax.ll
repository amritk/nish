@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i32, align 4
  %small.addr = alloca i32, align 4
  %arena.mark = call i64 @amrit_arena_mark()
  store i32 4000000000, i32* %big.addr, align 4
  store i32 7, i32* %small.addr, align 4
  %0 = load i32, i32* %big.addr, align 4
  %1 = load i32, i32* %small.addr, align 4
  %2 = icmp ugt i32 %0, %1
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %4 = call i8* @amrit_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %5 = load i32, i32* %big.addr, align 4
  %6 = load i32, i32* %small.addr, align 4
  %7 = icmp ult i32 %5, %6
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %9 = call i8* @amrit_str_concat(i8* %4, i8* %8)
  %10 = call i8* @amrit_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %11 = load i32, i32* %big.addr, align 4
  %12 = load i32, i32* %big.addr, align 4
  %13 = icmp uge i32 %11, %12
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %15 = call i8* @amrit_str_concat(i8* %10, i8* %14)
  %16 = call i8* @amrit_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %17 = load i32, i32* %small.addr, align 4
  %18 = load i32, i32* %big.addr, align 4
  %19 = icmp ule i32 %17, %18
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %21 = call i8* @amrit_str_concat(i8* %16, i8* %20)
  call void @amrit_print(i8* %21)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
