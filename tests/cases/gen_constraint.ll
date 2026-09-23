%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }
%struct.Square = type { i32 }

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %radius) #0 {
entry:
  %0 = mul nsw i32 3, %radius
  %1 = mul nsw i32 %0, %radius
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %1, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %radius, i32* %3, align 4
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = mul nsw i32 %side, %side
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %0, i32* %1, align 4
  ret void
}

define noundef i32 @test() #0 {
entry:
  %Circle.obj = alloca %struct.Circle, align 8
  %Square.obj = alloca %struct.Square, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 2)
  %0 = call i32 @areaOf$$Circle(%struct.Circle* %Circle.obj)
  call void @Square.constructor(%struct.Square* %Square.obj, i32 3)
  %1 = call i32 @areaOf$$Square(%struct.Square* %Square.obj)
  %2 = add nsw i32 %0, %1
  ret i32 %2
}

define internal noundef i32 @areaOf$$Circle(%struct.Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %shape) #1 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %shape, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define internal noundef i32 @areaOf$$Square(%struct.Square* noundef nonnull readonly align 8 dereferenceable(4) nocapture %shape) #1 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %shape, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
