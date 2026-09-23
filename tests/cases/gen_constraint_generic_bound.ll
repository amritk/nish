%struct.Cell = type { i32, i8* }
%struct.Container$i32 = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"cell\00" }, align 8

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %1, align 8
  ret void
}

define noundef i32 @test() #0 {
entry:
  %Cell.obj = alloca %struct.Cell, align 8
  call void @Cell.constructor(%struct.Cell* %Cell.obj, i32 42)
  %0 = call i32 @valueOf$$Cell(%struct.Cell* %Cell.obj)
  ret i32 %0
}

define internal noundef i32 @valueOf$$Cell(%struct.Cell* noundef nonnull readonly align 8 dereferenceable(16) nocapture %c) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
