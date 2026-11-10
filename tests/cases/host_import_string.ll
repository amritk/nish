target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"hello \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8

declare i32 @measure(i8*, i32, i32) #1
declare void @say(i8*, i32) #2
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3

define noundef i32 @greet(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8* %0)
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds i8, i8* %1, i64 8
  call void @say(i8* %5, i32 %4)
  %6 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*) to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i64 8
  %10 = call i32 @measure(i8* %9, i32 %8, i32 %n)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

define noundef nonnull align 8 i8* @label(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %0)
  ret i8* %1
}

attributes #0 = { nounwind }
attributes #1 = { "wasm-import-module"="host" "wasm-import-name"="measure" }
attributes #2 = { "wasm-import-module"="host" "wasm-import-name"="say" }
attributes #3 = { nounwind willreturn }
