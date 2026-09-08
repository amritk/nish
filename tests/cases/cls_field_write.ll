%struct.Counter = type { i32, i32 }

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i32 %step, i32* %1, align 4
  ret void
}

define void @bump(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %4, i32* %5, align 4
  ret void
}

define noundef i32 @bumpTwice(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  call void @bump(%struct.Counter* %c)
  call void @bump(%struct.Counter* %c)
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @amrit_main() #0 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 5)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %0 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %0, i32 0, i32 1
  store i32 7, i32* %1, align 4
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %3 = call i32 @bumpTwice(%struct.Counter* %2)
  %4 = call i8* @amrit_str_from_i32(i32 %3)
  call void @amrit_print(i8* %4)
  %5 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %5, i32 0, i32 0
  store i32 100, i32* %6, align 4
  %7 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %8 = getelementptr inbounds %struct.Counter, %struct.Counter* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = call i8* @amrit_str_from_i32(i32 %9)
  call void @amrit_print(i8* %10)
  call void @amrit_arena_release(i64 %arena.mark)
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
