%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }

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
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @reset$$Circle(%struct.Circle* noundef nonnull align 8 dereferenceable(8) nocapture %shape) #1 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %shape, i32 0, i32 0
  store i32 0, i32* %0, align 4
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
