%struct.Address = type { i8* }
%struct.Customer = type { i8*, %struct.Address* }
%struct.Order = type { i32, %struct.Customer*, %struct.Order* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"hi \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unknown\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"nobody\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"paris\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Address.constructor(%struct.Address* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %city) #0 {
entry:
  %0 = getelementptr inbounds %struct.Address, %struct.Address* %this, i32 0, i32 0
  store i8* %city, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Customer.constructor(%struct.Customer* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Customer, %struct.Customer* %this, i32 0, i32 1
  store %struct.Address* null, %struct.Address** %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Customer, %struct.Customer* %this, i32 0, i32 0
  store i8* %name, i8** %1, align 8, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 i8* @Customer.greeting(%struct.Customer* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Customer, %struct.Customer* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !7
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* %1)
  ret i8* %2
}

define internal void @Order.constructor(%struct.Order* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Order, %struct.Order* %this, i32 0, i32 1
  store %struct.Customer* null, %struct.Customer** %0, align 8, !tbaa !10
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %this, i32 0, i32 2
  store %struct.Order* null, %struct.Order** %1, align 8, !tbaa !11
  %2 = getelementptr inbounds %struct.Order, %struct.Order* %this, i32 0, i32 0
  store i32 %id, i32* %2, align 4, !tbaa !12
  ret void
}

define internal noundef nonnull align 8 i8* @city(%struct.Order* noundef readonly align 8 nocapture %o) #2 {
entry:
  %0 = icmp eq %struct.Order* %o, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %o, i32 0, i32 1
  %2 = load %struct.Customer*, %struct.Customer** %1, align 8, !tbaa !10
  %3 = icmp eq %struct.Customer* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = getelementptr inbounds %struct.Customer, %struct.Customer* %2, i32 0, i32 1
  %5 = load %struct.Address*, %struct.Address** %4, align 8, !tbaa !6
  %6 = icmp eq %struct.Address* %5, null
  br i1 %6, label %nullish.default, label %chain.next.2

chain.next.2:
  %7 = getelementptr inbounds %struct.Address, %struct.Address* %5, i32 0, i32 0
  %8 = load i8*, i8** %7, align 8, !tbaa !4
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %9 = phi i8* [ %8, %chain.next.2 ], [ bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), %nullish.default ]
  ret i8* %9
}

define internal noundef i32 @nextId(%struct.Order* noundef readonly align 8 nocapture %o) #2 {
entry:
  %0 = icmp eq %struct.Order* %o, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %o, i32 0, i32 2
  %2 = load %struct.Order*, %struct.Order** %1, align 8, !tbaa !11
  %3 = icmp eq %struct.Order* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = getelementptr inbounds %struct.Order, %struct.Order* %2, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !12
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %6 = phi i32 [ %5, %chain.next.1 ], [ -1, %nullish.default ]
  ret i32 %6
}

define internal noundef nonnull align 8 i8* @greet(%struct.Order* noundef readonly align 8 nocapture %o) #1 {
entry:
  %0 = icmp eq %struct.Order* %o, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %o, i32 0, i32 1
  %2 = load %struct.Customer*, %struct.Customer** %1, align 8, !tbaa !10
  %3 = icmp eq %struct.Customer* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @Customer.greeting(%struct.Customer* %2)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %7 = phi i8* [ %6, %chain.next.1 ], [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %nullish.default ]
  ret i8* %7
}

define internal noundef i32 @nameLength(%struct.Order* noundef readonly align 8 nocapture %o) #2 {
entry:
  %0 = icmp eq %struct.Order* %o, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %o, i32 0, i32 1
  %2 = load %struct.Customer*, %struct.Customer** %1, align 8, !tbaa !10
  %3 = icmp eq %struct.Customer* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = getelementptr inbounds %struct.Customer, %struct.Customer* %2, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !7
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %9 = phi i32 [ %8, %chain.next.1 ], [ 0, %nullish.default ]
  ret i32 %9
}

define internal noundef align 8 %struct.Order* @nextOrNull(%struct.Order* noundef readonly align 8 nocapture %o) #2 {
entry:
  %0 = icmp eq %struct.Order* %o, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Order, %struct.Order* %o, i32 0, i32 2
  %2 = load %struct.Order*, %struct.Order** %1, align 8, !tbaa !11
  %3 = icmp ne %struct.Order* %2, null
  br i1 %3, label %nullish.end, label %nullish.default

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi %struct.Order* [ %2, %chain.next ], [ null, %nullish.default ]
  ret %struct.Order* %4
}

define noundef i32 @nish_main() #1 {
entry:
  %a.addr = alloca %struct.Order*, align 8
  %Order.obj = alloca %struct.Order, align 8
  %b.addr = alloca %struct.Order*, align 8
  %c.addr = alloca %struct.Customer*, align 8
  %n.addr = alloca %struct.Order*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Order.constructor(%struct.Order* %Order.obj, i32 1)
  store %struct.Order* %Order.obj, %struct.Order** %a.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Order*
  call void @Order.constructor(%struct.Order* %1, i32 2)
  store %struct.Order* %1, %struct.Order** %b.addr, align 8
  %2 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %3 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %4 = getelementptr inbounds %struct.Order, %struct.Order* %2, i32 0, i32 2
  store %struct.Order* %3, %struct.Order** %4, align 8, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.Customer*
  call void @Customer.constructor(%struct.Customer* %6, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  store %struct.Customer* %6, %struct.Customer** %c.addr, align 8
  %7 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %8 = load %struct.Customer*, %struct.Customer** %c.addr, align 8
  %9 = getelementptr inbounds %struct.Order, %struct.Order* %7, i32 0, i32 1
  store %struct.Customer* %8, %struct.Customer** %9, align 8, !tbaa !10
  %10 = load %struct.Customer*, %struct.Customer** %c.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Address*
  call void @Address.constructor(%struct.Address* %12, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  %13 = getelementptr inbounds %struct.Customer, %struct.Customer* %10, i32 0, i32 1
  store %struct.Address* %12, %struct.Address** %13, align 8, !tbaa !6
  %14 = call i8* @city(%struct.Order* null)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %16 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %17 = call i8* @city(%struct.Order* %16)
  %18 = call i8* @nish_str_concat(i8* %15, i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %20 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %21 = call i8* @city(%struct.Order* %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  call void @nish_print(i8* %22)
  %23 = call i32 @nextId(%struct.Order* null)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %26 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %27 = call i32 @nextId(%struct.Order* %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %25, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %31 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %32 = call i32 @nextId(%struct.Order* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %30, i8* %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %36 = call i64 @nish_arena_mark()
  %37 = call i8* @greet(%struct.Order* %35)
  %38 = call i8* @nish_arena_keep(i64 %36, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %40 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %41 = call i64 @nish_arena_mark()
  %42 = call i8* @greet(%struct.Order* %40)
  %43 = call i8* @nish_arena_keep(i64 %41, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %46 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %47 = call i32 @nameLength(%struct.Order* %46)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %45, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %51 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %52 = call i32 @nameLength(%struct.Order* %51)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %50, i8* %53)
  call void @nish_print(i8* %54)
  %55 = load %struct.Order*, %struct.Order** %a.addr, align 8
  %56 = call %struct.Order* @nextOrNull(%struct.Order* %55)
  store %struct.Order* %56, %struct.Order** %n.addr, align 8
  %57 = load %struct.Order*, %struct.Order** %n.addr, align 8
  %58 = icmp eq %struct.Order* %57, null
  br i1 %58, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %59 = load %struct.Order*, %struct.Order** %n.addr, align 8
  %60 = getelementptr inbounds %struct.Order, %struct.Order* %59, i32 0, i32 0
  %61 = load i32, i32* %60, align 4, !tbaa !12
  %62 = call i8* @nish_str_from_i32(i32 %61)
  br label %cond.end

cond.end:
  %63 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), %cond.true ], [ %62, %cond.false ]
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %65 = load %struct.Order*, %struct.Order** %b.addr, align 8
  %66 = call %struct.Order* @nextOrNull(%struct.Order* %65)
  %67 = icmp eq %struct.Order* %66, null
  %68 = select i1 %67, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)
  %69 = call i8* @nish_str_concat(i8* %64, i8* %68)
  call void @nish_print(i8* %69)
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
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Address", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Customer", !2, i64 0, !2, i64 8}
!6 = !{!5, !2, i64 8}
!7 = !{!5, !2, i64 0}
!8 = !{!"i32", !1, i64 0}
!9 = !{!"Order", !8, i64 0, !2, i64 8, !2, i64 16}
!10 = !{!9, !2, i64 8}
!11 = !{!9, !2, i64 16}
!12 = !{!9, !8, i64 0}
