%struct.Depth = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noundef i32 @walk(i32 noundef %n, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = bitcast i8* %text to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3

if.end:
  %4 = sub nsw i32 %n, 1
  %5 = call i8* @nish_str_from_i32(i32 %n)
  %6 = call i8* @nish_str_concat(i8* %text, i8* %5)
  %7 = call i32 @walk(i32 %4, i8* %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef i32 @watch(i32 noundef %n, i32 noundef %acc) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %bump.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %acc

if.end:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %1)
  store i8* %2, i8** %label.addr, align 8
  %3 = call i64 @nish_arena_used()
  store i64 %3, i64* %bump.addr, align 8
  %4 = sub nsw i32 %n, 1
  %5 = load i8*, i8** %label.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = add nsw i32 %acc, %8
  %10 = call i32 @watch(i32 %4, i32 %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

define internal noundef i32 @after(i32 noundef %n) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %1)
  store i8* %2, i8** %label.addr, align 8
  %3 = sub nsw i32 %n, 1
  %4 = call i32 @after(i32 %3)
  %5 = load i8*, i8** %label.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = add nsw i32 %4, %8
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9
}

define internal void @Depth.constructor(%struct.Depth* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %base) #0 {
entry:
  %0 = getelementptr inbounds %struct.Depth, %struct.Depth* %this, i32 0, i32 0
  store i32 %base, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Depth.down(%struct.Depth* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %n, i32 noundef %acc) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.Depth, %struct.Depth* %this, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = add nsw i32 %acc, %2
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3

if.end:
  %4 = call i8* @nish_str_from_i32(i32 %n)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %4)
  store i8* %5, i8** %label.addr, align 8
  %6 = sub nsw i32 %n, 1
  %7 = load i8*, i8** %label.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = add nsw i32 %acc, %10
  %12 = call i32 @Depth.down(%struct.Depth* %this, i32 %6, i32 %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12
}

define noundef i32 @nish_main() #0 {
entry:
  %depth.addr = alloca %struct.Depth*, align 8
  %Depth.obj = alloca %struct.Depth, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @walk(i32 3, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @watch(i32 3, i32 0)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i32 @after(i32 3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @Depth.constructor(%struct.Depth* %Depth.obj, i32 100)
  store %struct.Depth* %Depth.obj, %struct.Depth** %depth.addr, align 8
  %6 = load %struct.Depth*, %struct.Depth** %depth.addr, align 8
  %7 = call i32 @Depth.down(%struct.Depth* %6, i32 3, i32 0)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Depth", !2, i64 0}
!4 = !{!3, !2, i64 0}
