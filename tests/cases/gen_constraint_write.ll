%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }

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

define noundef i32 @test() #0 {
entry:
  %c.addr = alloca %struct.Circle*, align 8
  %Circle.obj = alloca %struct.Circle, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 2)
  store %struct.Circle* %Circle.obj, %struct.Circle** %c.addr, align 8
  %0 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  call void @reset$$Circle(%struct.Circle* %0)
  %1 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = add nsw i32 %3, %6
  ret i32 %7
}

define internal void @reset$$Circle(%struct.Circle* noundef nonnull align 8 dereferenceable(8) nocapture %shape) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %shape, i32 0, i32 0
  store i32 0, i32* %0, align 4
  ret void
}

attributes #0 = { nounwind willreturn }
