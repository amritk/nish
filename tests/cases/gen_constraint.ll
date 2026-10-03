%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }
%struct.Square = type { i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %radius) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %radius)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %radius)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %4, i32* %6, align 4
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %radius, i32* %7, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %side, i32 %side)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %1, i32* %3, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %Circle.obj = alloca %struct.Circle, align 8
  %Square.obj = alloca %struct.Square, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 2)
  %0 = call i32 @areaOf$$Circle(%struct.Circle* %Circle.obj)
  call void @Square.constructor(%struct.Square* %Square.obj, i32 3)
  %1 = call i32 @areaOf$$Square(%struct.Square* %Square.obj)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
