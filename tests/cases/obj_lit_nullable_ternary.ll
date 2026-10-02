%struct.Box = type { i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define void @nish_main() #0 {
entry:
  %some.addr = alloca i1, align 1
  %z.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i1 true, i1* %some.addr, align 1
  %0 = load i1, i1* %some.addr, align 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0
  store i32 7, i32* %1, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi %struct.Box* [ %Box.obj, %cond.true ], [ null, %cond.false ]
  store %struct.Box* %2, %struct.Box** %z.addr, align 8
  %3 = load %struct.Box*, %struct.Box** %z.addr, align 8
  %4 = icmp ne %struct.Box* %3, null
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.Box*, %struct.Box** %z.addr, align 8
  %6 = getelementptr inbounds %struct.Box, %struct.Box* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
