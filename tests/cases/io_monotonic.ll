@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"monotonic: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"advances: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_monotonic_nanos() #1

define noundef i32 @nish_main() #0 {
entry:
  %first.addr = alloca i64, align 8
  %later.addr = alloca i64, align 8
  %spins.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_monotonic_nanos()
  store i64 %0, i64* %first.addr, align 8
  %1 = call i64 @nish_monotonic_nanos()
  store i64 %1, i64* %later.addr, align 8
  store i32 0, i32* %spins.addr, align 4
  br label %while.cond

while.cond:
  %2 = load i64, i64* %later.addr, align 8
  %3 = load i64, i64* %first.addr, align 8
  %4 = icmp eq i64 %2, %3
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %spins.addr, align 4
  %6 = icmp slt i32 %5, 10000000
  br label %land.end

land.end:
  %7 = phi i1 [ false, %while.cond ], [ %6, %land.rhs ]
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = call i64 @nish_monotonic_nanos()
  store i64 %8, i64* %later.addr, align 8
  %9 = load i32, i32* %spins.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %spins.addr, align 4
  br label %while.cond

while.end:
  %11 = load i64, i64* %later.addr, align 8
  %12 = load i64, i64* %first.addr, align 8
  %13 = icmp sge i64 %11, %12
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8* %14)
  call void @nish_print(i8* %15)
  %16 = load i64, i64* %later.addr, align 8
  %17 = load i64, i64* %first.addr, align 8
  %18 = icmp sgt i64 %16, %17
  %19 = select i1 %18, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.3 to i8*), i8* %19)
  call void @nish_print(i8* %20)
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
