@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3

define internal noundef i32 @digit(i32 noundef %n) #0 {
entry:
  %0 = icmp ult i32 %n, 10
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  ret i32 %n
}

define internal noundef i32 @guarded(i32 noundef %n) #1 {
entry:
  %0 = icmp sge i32 %n, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %n, 9
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 %n

if.end:
  ret i32 0
}

define internal noundef i32 @bump(i32 noundef %d) #0 {
entry:
  %e.addr = alloca i32, align 4
  store i32 %d, i32* %e.addr, align 4
  %0 = load i32, i32* %e.addr, align 4
  %1 = add nsw i32 %0, 1
  %2 = icmp ult i32 %1, 10
  br i1 %2, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %1, i32* %e.addr, align 4
  %3 = load i32, i32* %e.addr, align 4
  ret i32 %3
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @digit(i32 7)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @guarded(i32 12)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i32 @bump(i32 3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @fromHost(i32 noundef %d) #0 {
entry:
  %0 = icmp ult i32 %d, 10
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = add nsw i32 %d, 1
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
