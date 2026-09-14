%struct.Container$i32 = type { i32 }
%struct.Box$i32 = type { i32, i32 }

define internal noundef i32 @valueOf(%struct.Container$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Container$i32, %struct.Container$i32* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @test() #1 {
entry:
  %b.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 41)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %b.addr, align 8
  %0 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %1 = bitcast %struct.Box$i32* %0 to %struct.Container$i32*
  %2 = call i32 @valueOf(%struct.Container$i32* %1)
  %3 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %4 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4
  %6 = add nsw i32 %2, %5
  ret i32 %6
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 1
  store i32 1, i32* %1, align 4
  ret void
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
