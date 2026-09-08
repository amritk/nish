%struct.Point = type { i32, i32 }

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @sumX(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %q) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %q, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @amrit_main() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  call void @Point.constructor(%struct.Point* %Point.obj.1, i32 10, i32 20)
  store %struct.Point* %Point.obj.1, %struct.Point** %q.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = call i32 @Point.manhattan(%struct.Point* %0)
  %2 = call i8* @amrit_str_from_i32(i32 %1)
  call void @amrit_print(i8* %2)
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %5 = call i32 @sumX(%struct.Point* %3, %struct.Point* %4)
  %6 = call i8* @amrit_str_from_i32(i32 %5)
  call void @amrit_print(i8* %6)
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %8 = getelementptr inbounds %struct.Point, %struct.Point* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = call i8* @amrit_str_from_i32(i32 %9)
  call void @amrit_print(i8* %10)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
