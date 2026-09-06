@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abd\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8

declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef zeroext i1 @same(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call zeroext i1 @sts_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

define noundef zeroext i1 @differ(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call zeroext i1 @sts_str_eq(i8* %a, i8* %b)
  %1 = xor i1 %0, true
  ret i1 %1
}

define noundef i32 @test() #1 {
entry:
  %0 = call i1 @same(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %1)
  %2 = call i1 @same(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %3)
  %4 = call i1 @differ(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %5)
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
