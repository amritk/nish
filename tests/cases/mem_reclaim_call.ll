@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare noundef nonnull align 8 i8* @amrit_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define noundef nonnull align 8 i8* @piece(i32 noundef %i) #0 {
entry:
  %0 = call i8* @amrit_str_from_i32(i32 %i)
  %1 = call i8* @amrit_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  ret i8* %1
}

define noundef nonnull align 8 i8* @join(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i8*, i8** %s.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i64 @amrit_arena_mark()
  %5 = call i8* @piece(i32 %3)
  %6 = call i8* @amrit_arena_keep(i64 %4, i8* %5)
  %7 = call i8* @amrit_str_concat(i8* %2, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i8*, i8** %s.addr, align 8
  ret i8* %10
}

define noundef i32 @amrit_main() #0 {
entry:
  %0 = call i64 @amrit_arena_mark()
  %1 = call i8* @join(i32 4)
  %2 = call i8* @amrit_arena_keep(i64 %0, i8* %1)
  call void @amrit_print(i8* %2)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
