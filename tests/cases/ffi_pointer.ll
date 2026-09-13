declare i8* @calloc(i64, i64)
declare i8* @realloc(i8*, i64)
declare void @free(i8*)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @doubled(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %first.addr = alloca i8*, align 8
  %grown.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @calloc(i64 4, i64 16)
  store i8* %0, i8** %first.addr, align 8
  %1 = load i8*, i8** %first.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %3 = load i8*, i8** %first.addr, align 8
  %4 = call i8* @realloc(i8* %3, i64 256)
  store i8* %4, i8** %grown.addr, align 8
  %5 = load i8*, i8** %grown.addr, align 8
  %6 = icmp eq i8* %5, null
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = load i8*, i8** %first.addr, align 8
  call void @free(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 2

if.end.1:
  %8 = load i8*, i8** %grown.addr, align 8
  call void @free(i8* %8)
  %9 = call i32 @doubled(i32 21)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
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
