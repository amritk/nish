@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3

define internal noundef i32 @digit(i32 noundef %d) #0 {
entry:
  ret i32 %d
}

define internal noundef i32 @pass(i32 noundef %v) #1 {
entry:
  %0 = icmp ult i32 %v, 10
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = tail call i32 @digit(i32 %v)
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %up.addr = alloca i32, align 4
  %down.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4, i32* %up.addr, align 4
  store i32 -3, i32* %down.addr, align 4
  %0 = load i32, i32* %up.addr, align 4
  %1 = call i32 @pass(i32 %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i32, i32* %down.addr, align 4
  %4 = call i32 @pass(i32 %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
attributes #3 = { noreturn nounwind }
