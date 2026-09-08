%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }
%struct.Counter = type { i32, i32 }

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

define noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #2 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %Pair.obj = alloca %struct.Pair, align 8
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i32 %b, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 1
  store i32 %a, i32* %1, align 4
  store %struct.Pair* %Pair.obj, %struct.Pair** %p.addr, align 8
  %2 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = mul i32 %4, 10
  %6 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %5, %8
  ret i32 %9
}

define noundef i32 @count(i32 noundef %n) #2 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 1
  store i32 3, i32* %1, align 4
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %2, i32 0, i32 0
  store i32 %n, i32* %3, align 4
  %4 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %8 = getelementptr inbounds %struct.Counter, %struct.Counter* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = add i32 %6, %9
  store i32 %10, i32* %5, align 4
  %11 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %12 = getelementptr inbounds %struct.Counter, %struct.Counter* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4
  ret i32 %13
}

define noundef i32 @nearest() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %alias.addr = alloca %struct.Point*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  call void @Point.constructor(%struct.Point* %Point.obj.1, i32 10, i32 20)
  store %struct.Point* %Point.obj.1, %struct.Point** %q.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  store %struct.Point* %0, %struct.Point** %alias.addr, align 8
  %1 = load %struct.Point*, %struct.Point** %alias.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %3 = call i32 @sumX(%struct.Point* %1, %struct.Point* %2)
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = call i32 @Point.manhattan(%struct.Point* %4)
  %6 = add i32 %3, %5
  call void @Point.constructor(%struct.Point* %Point.obj.2, i32 1, i32 1)
  %7 = call i32 @Point.manhattan(%struct.Point* %Point.obj.2)
  %8 = add i32 %6, %7
  ret i32 %8
}

define noundef i32 @amrit_main() #0 {
entry:
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i32 @swapped(i32 1, i32 2)
  %1 = call i8* @amrit_str_from_i32(i32 %0)
  call void @amrit_print(i8* %1)
  %2 = call i32 @count(i32 4)
  %3 = call i8* @amrit_str_from_i32(i32 %2)
  call void @amrit_print(i8* %3)
  %4 = call i32 @nearest()
  %5 = call i8* @amrit_str_from_i32(i32 %4)
  call void @amrit_print(i8* %5)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind }
