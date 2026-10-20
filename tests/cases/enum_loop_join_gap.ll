%struct.H = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3

define internal noundef i32 @keep(i32 noundef %k) #0 {
entry:
  ret i32 %k
}

define internal noundef zeroext i1 @pathLoop(%struct.H* noundef nonnull align 8 dereferenceable(4) nocapture %h, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 1, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 2, i32* %4, align 4, !tbaa !4
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %7 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  %9 = icmp eq i32 %8, 1
  ret i1 %9
}

define internal noundef zeroext i1 @argumentStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  %2 = call i32 @keep(i32 2)
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %5 = load i32, i32* %j.addr, align 4
  %6 = icmp eq i32 %5, 1
  ret i1 %6
}

define internal noundef zeroext i1 @initializerStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  store i32 2, i32* %t.addr, align 4
  %2 = load i32, i32* %t.addr, align 4
  %3 = call i32 @keep(i32 %2)
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 1
  ret i1 %7
}

define internal noundef zeroext i1 @chainStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  store i32 2, i32* %k.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %k.addr, align 4
  %5 = call i32 @keep(i32 %4)
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 1
  ret i1 %7
}

define internal noundef zeroext i1 @forUpdateStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  store i32 1, i32* %j.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %for.inc

for.inc:
  store i32 2, i32* %j.addr, align 4
  br label %for.cond

for.end:
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp eq i32 %4, 1
  ret i1 %5
}

define internal noundef zeroext i1 @wideLoop(i32 noundef %n) #2 {
entry:
  %w.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %w.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %w.addr, align 4
  store i32 2, i32* %w.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %w.addr, align 4
  %5 = icmp eq i32 %4, 1
  ret i1 %5
}

define void @nish_main() #1 {
entry:
  %h.addr = alloca %struct.H*, align 8
  %H.obj = alloca %struct.H, align 8
  %0 = getelementptr inbounds %struct.H, %struct.H* %H.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store %struct.H* %H.obj, %struct.H** %h.addr, align 8
  %1 = load %struct.H*, %struct.H** %h.addr, align 8
  %2 = call i1 @pathLoop(%struct.H* %1, i32 2)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i1 @argumentStore(i32 2)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = call i1 @initializerStore(i32 2)
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %7)
  %8 = call i1 @chainStore(i32 2)
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %9)
  %10 = call i1 @forUpdateStore(i32 2)
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %11)
  %12 = call i1 @wideLoop(i32 2)
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %13)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind readnone }
attributes #3 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
