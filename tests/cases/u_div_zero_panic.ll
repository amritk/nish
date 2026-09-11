@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %big.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %n.addr, align 4
  store i32 4000000000, i32* %big.addr, align 4
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %0 = load i32, i32* %big.addr, align 4
  %1 = load i32, i32* %n.addr, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %3 = udiv i32 %0, %1
  %4 = zext i32 %3 to i64
  %5 = call i8* @nish_str_from_u64(i64 %4)
  call void @nish_print(i8* %5)
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
attributes #2 = { nounwind noreturn cold }
