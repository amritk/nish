declare i32 @abs(i32)
declare i64 @labs(i64)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @pureDouble(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef i32 @callsC(i32 noundef %n) #1 {
entry:
  %0 = call i32 @abs(i32 %n)
  %1 = add nsw i32 %0, 1
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %wide.addr = alloca i64, align 8
  %back.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sub nsw i64 0, 5
  store i64 %0, i64* %wide.addr, align 8
  %1 = load i64, i64* %wide.addr, align 8
  %2 = call i64 @labs(i64 %1)
  store i64 %2, i64* %back.addr, align 8
  %3 = sub nsw i32 0, 7
  %4 = call i32 @callsC(i32 %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @pureDouble(i32 3)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load i64, i64* %back.addr, align 8
  %9 = icmp eq i64 %8, 5
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
