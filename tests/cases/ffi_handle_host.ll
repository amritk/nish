target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

%struct.View = type { i32 }

declare i32 @hCanvas(i32) #2
declare i32 @hSame(i32) #3

define internal void @View.constructor(%struct.View* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %name) #0 {
entry:
  %0 = call i32 @hCanvas(i32 %name)
  %1 = getelementptr inbounds %struct.View, %struct.View* %this, i32 0, i32 0
  store i32 %0, i32* %1, align 4, !tbaa !4
  ret void
}

define internal noundef zeroext i1 @View.open(%struct.View* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.View, %struct.View* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %c.addr, align 4
  %2 = load i32, i32* %c.addr, align 4
  %3 = icmp ne i32 %2, 0
  ret i1 %3
}

define noundef zeroext i1 @shown(i32 noundef %name) #0 {
entry:
  %v.addr = alloca %struct.View*, align 4
  %View.obj = alloca %struct.View, align 8
  call void @View.constructor(%struct.View* %View.obj, i32 %name)
  store %struct.View* %View.obj, %struct.View** %v.addr, align 4
  %0 = load %struct.View*, %struct.View** %v.addr, align 4
  %1 = load %struct.View*, %struct.View** %v.addr, align 4
  %2 = call i1 @View.open(%struct.View* %1)
  %3 = getelementptr inbounds %struct.View, %struct.View* %0, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %handle.closed, label %handle.close

handle.close:
  %6 = call i32 @hSame(i32 %4)
  br label %handle.closed

handle.closed:
  ret i1 %2
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { "wasm-import-module"="host" "wasm-import-name"="hCanvas" }
attributes #3 = { "wasm-import-module"="host" "wasm-import-name"="hSame" }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"View", !2, i64 0}
!4 = !{!3, !2, i64 0}
