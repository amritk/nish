@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"read \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"NISH_SCOPE_PROBE\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"unset\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"ZZZZZZZZ\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"filled \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"value: \00" }, align 8

declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noundef align 8 i8* @fromEnv(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %name)
  store i8* %0, i8** %label.addr, align 8
  %1 = load i8*, i8** %label.addr, align 8
  call void @nish_print(i8* %1)
  %2 = call i8* @nish_getenv(i8* %name)
  ret i8* %2
}

define noundef i32 @nish_main() #0 {
entry:
  %value.addr = alloca i8*, align 8
  %filler.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @fromEnv(i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*))
  store i8* %0, i8** %value.addr, align 8
  %1 = load i8*, i8** %value.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  ret i32 1

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %filler.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 40
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i8*, i8** %filler.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*))
  store i8* %6, i8** %filler.addr, align 8
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i8*, i8** %filler.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8* %13)
  call void @nish_print(i8* %14)
  %15 = load i8*, i8** %value.addr, align 8
  %16 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8* %15)
  call void @nish_print(i8* %16)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
