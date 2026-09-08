%struct.Shape = type { i32 }
%struct.Square = type { i32, i32 }

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define void @Shape.constructor(%struct.Shape* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  ret void
}

define noundef i32 @Shape.area(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  ret i32 0
}

define noundef i32 @Shape.report(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = call i32 @Shape.area(%struct.Shape* %this)
  %1 = mul i32 %0, 10
  %2 = getelementptr inbounds %struct.Shape, %struct.Shape* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %side) #0 {
entry:
  %0 = bitcast %struct.Square* %this to %struct.Shape*
  call void @Shape.constructor(%struct.Shape* %0, i32 %x)
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4
  ret void
}

define noundef i32 @Square.area(%struct.Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = mul i32 %1, %3
  ret i32 %4
}

define noundef i32 @Square.report(%struct.Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = bitcast %struct.Square* %this to %struct.Shape*
  %1 = call i32 @Shape.report(%struct.Shape* %0)
  %2 = call i32 @Square.area(%struct.Square* %this)
  %3 = add i32 %1, %2
  ret i32 %3
}

define noundef i32 @areaOf(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(4) nocapture %s) #1 {
entry:
  %0 = call i32 @Shape.area(%struct.Shape* %s)
  ret i32 %0
}

define noundef i32 @amrit_main() #0 {
entry:
  %sq.addr = alloca %struct.Square*, align 8
  %Square.obj = alloca %struct.Square, align 8
  %s.addr = alloca %struct.Shape*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  call void @Square.constructor(%struct.Square* %Square.obj, i32 1, i32 3)
  store %struct.Square* %Square.obj, %struct.Square** %sq.addr, align 8
  %0 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %1 = call i32 @Square.area(%struct.Square* %0)
  %2 = call i8* @amrit_str_from_i32(i32 %1)
  call void @amrit_print(i8* %2)
  %3 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %4 = bitcast %struct.Square* %3 to %struct.Shape*
  %5 = call i32 @areaOf(%struct.Shape* %4)
  %6 = call i8* @amrit_str_from_i32(i32 %5)
  call void @amrit_print(i8* %6)
  %7 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %8 = bitcast %struct.Square* %7 to %struct.Shape*
  store %struct.Shape* %8, %struct.Shape** %s.addr, align 8
  %9 = load %struct.Shape*, %struct.Shape** %s.addr, align 8
  %10 = call i32 @Shape.area(%struct.Shape* %9)
  %11 = call i8* @amrit_str_from_i32(i32 %10)
  call void @amrit_print(i8* %11)
  %12 = load %struct.Square*, %struct.Square** %sq.addr, align 8
  %13 = call i32 @Square.report(%struct.Square* %12)
  %14 = call i8* @amrit_str_from_i32(i32 %13)
  call void @amrit_print(i8* %14)
  %15 = load %struct.Shape*, %struct.Shape** %s.addr, align 8
  %16 = call i32 @Shape.report(%struct.Shape* %15)
  %17 = call i8* @amrit_str_from_i32(i32 %16)
  call void @amrit_print(i8* %17)
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
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }
