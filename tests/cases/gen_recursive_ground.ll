@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @countDown$str(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @countDown$str(i8* noundef nonnull noalias readonly align 8 nocapture %x, i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @countDown$i32(i32 1, i32 %1)
  ret i32 %2
}

define internal noundef i32 @countDown$i32(i32 noundef %x, i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @countDown$i32(i32 1, i32 %1)
  ret i32 %2
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
