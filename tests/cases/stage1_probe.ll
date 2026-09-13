@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"stage1 probe \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @doubled(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define noundef i32 @test() #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i32 @doubled(i32 %3)
  %5 = add nsw i32 %2, %4
  store i32 %5, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load i32, i32* %total.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i8* %9)
  call void @nish_print(i8* %10)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
