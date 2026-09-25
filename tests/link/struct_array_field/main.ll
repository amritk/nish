%struct.Bag = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }

declare void @Bag.constructor(%struct.Bag* noundef nonnull noalias align 8 dereferenceable(8) nocapture) #0
declare noundef i32 @Bag.add(%struct.Bag* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #0
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %bag.addr = alloca %struct.Bag*, align 8
  %Bag.obj = alloca %struct.Bag, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Bag.constructor(%struct.Bag* %Bag.obj)
  store %struct.Bag* %Bag.obj, %struct.Bag** %bag.addr, align 8
  %0 = load %struct.Bag*, %struct.Bag** %bag.addr, align 8
  %1 = call i32 @Bag.add(%struct.Bag* %0, i32 7)
  %2 = load %struct.Bag*, %struct.Bag** %bag.addr, align 8
  %3 = call i32 @Bag.add(%struct.Bag* %2, i32 8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
