%struct.H = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store i32 %k, i32* %1, align 4, !tbaa !4
  ret void
}

define internal noundef zeroext i1 @early(i32 noundef %k, i1 noundef zeroext %c) #1 {
entry:
  %j.addr = alloca i32, align 4
  store i32 %k, i32* %j.addr, align 4
  %0 = load i32, i32* %j.addr, align 4
  switch i32 %0, label %sw.default [
    i32 0, label %sw.case
  ]

sw.case:
  br i1 %c, label %if.then, label %if.end

if.then:
  store i32 1, i32* %j.addr, align 4
  br label %sw.end

if.end:
  store i32 2, i32* %j.addr, align 4
  br label %sw.end

sw.default:
  store i32 0, i32* %j.addr, align 4
  br label %sw.end

sw.end:
  %1 = load i32, i32* %j.addr, align 4
  %2 = icmp eq i32 %1, 0
  ret i1 %2
}

define internal noundef zeroext i1 @unmatched(i32 noundef %k) #1 {
entry:
  %j.addr = alloca i32, align 4
  store i32 %k, i32* %j.addr, align 4
  %0 = load i32, i32* %j.addr, align 4
  switch i32 %0, label %sw.end [
    i32 0, label %sw.case
  ]

sw.case:
  store i32 1, i32* %j.addr, align 4
  br label %sw.end

sw.end:
  %1 = load i32, i32* %j.addr, align 4
  %2 = icmp eq i32 %1, 2
  ret i1 %2
}

define internal noundef zeroext i1 @nested(i32 noundef %k, i32 noundef %x) #1 {
entry:
  %j.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  switch i32 %x, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  switch i32 %k, label %sw.default.1 [
    i32 0, label %sw.case.1
  ]

sw.case.1:
  store i32 1, i32* %j.addr, align 4
  br label %sw.end.1

sw.default.1:
  store i32 2, i32* %j.addr, align 4
  br label %sw.end.1

sw.end.1:
  br label %sw.end

sw.default:
  br label %sw.end

sw.end:
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp eq i32 %0, 0
  ret i1 %1
}

define internal noundef zeroext i1 @path(%struct.H* noundef nonnull align 8 dereferenceable(4) nocapture %h, i32 noundef %x) #0 {
entry:
  switch i32 %x, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  br label %sw.end

sw.default:
  %1 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 2, i32* %1, align 4, !tbaa !4
  br label %sw.end

sw.end:
  %2 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = icmp eq i32 %3, 2
  ret i1 %4
}

define internal noundef zeroext i1 @returned(i32 noundef %k, i32 noundef %x) #1 {
entry:
  %j.addr = alloca i32, align 4
  store i32 %k, i32* %j.addr, align 4
  switch i32 %x, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  ret i1 true

sw.default:
  store i32 2, i32* %j.addr, align 4
  br label %sw.end

sw.end:
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp eq i32 %0, 2
  ret i1 %1
}

define internal noundef zeroext i1 @looped(i32 noundef %k, i32 noundef %x, i1 noundef zeroext %c) #2 {
entry:
  %j.addr = alloca i32, align 4
  store i32 %k, i32* %j.addr, align 4
  switch i32 %x, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  br label %while.cond

while.cond:
  br i1 %c, label %while.body, label %while.end

while.body:
  store i32 0, i32* %j.addr, align 4
  br label %while.end

while.end:
  store i32 1, i32* %j.addr, align 4
  br label %sw.end

sw.default:
  store i32 2, i32* %j.addr, align 4
  br label %sw.end

sw.end:
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp eq i32 %0, 1
  ret i1 %1
}

define void @nish_main() #3 {
entry:
  %H.obj = alloca %struct.H, align 8
  %0 = call i1 @early(i32 0, i1 true)
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %1)
  %2 = call i1 @early(i32 1, i1 false)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i1 @unmatched(i32 2)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = call i1 @nested(i32 0, i32 1)
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %7)
  %8 = call i1 @nested(i32 0, i32 2)
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %9)
  call void @H.constructor(%struct.H* %H.obj, i32 1)
  %10 = call i1 @path(%struct.H* %H.obj, i32 2)
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %11)
  %12 = call i1 @returned(i32 0, i32 1)
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %13)
  %14 = call i1 @looped(i32 0, i32 1, i1 true)
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %15)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readnone }
attributes #3 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
