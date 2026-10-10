%struct.Point = type { i32, i32 }
%struct.Holder = type { i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"block \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @width(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  store i8* %0, i8** %s.addr, align 8
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define internal noundef nonnull align 8 i8* @label(i32 noundef %n) #1 {
entry:
  %prefix.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %prefix.addr, align 8
  %2 = load i8*, i8** %prefix.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  ret i8* %3
}

define internal noundef i32 @retain(i32 noundef %n) #1 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %3)
  store i8* %4, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i8*, i8** %last.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define internal void @remember(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !8
  ret void
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %a.addr = alloca i64, align 8
  %t.addr = alloca i8*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %last.addr = alloca i8*, align 8
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Point.constructor(%struct.Point* %Point.obj, i32 1, i32 2)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 3
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load i32, i32* %i.addr, align 4
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @label(i32 %15)
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  store i8* %18, i8** %s.addr, align 8
  %19 = load i32, i32* %total.addr, align 4
  %20 = load i8*, i8** %s.addr, align 8
  %21 = bitcast i8* %20 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = trunc i64 %22 to i32
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %27 = load i32, i32* %i.addr, align 4
  %28 = call i32 @width(i32 %27)
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %30, i32* %total.addr, align 4
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %33 = load i8*, i8** %32, align 8
  %34 = icmp eq i8* %33, %12
  br i1 %34, label %pass.rewind, label %pass.free

pass.rewind:
  %35 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %35, align 8
  br label %pass.done

pass.free:
  %36 = ptrtoint i8* %12 to i64
  %37 = add i64 %36, %14
  call void @nish_arena_release(i64 %37)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %40 = call i64 @nish_arena_mark()
  store i64 %40, i64* %a.addr, align 8
  %41 = load i64, i64* %a.addr, align 8
  %42 = load i32, i32* %total.addr, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %43)
  store i8* %44, i8** %t.addr, align 8
  %45 = load i32, i32* %total.addr, align 4
  %46 = load i8*, i8** %t.addr, align 8
  %47 = bitcast i8* %46 to i64*
  %48 = load i64, i64* %47, align 8
  %49 = trunc i64 %48 to i32
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %45, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %51, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %41)
  %53 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %53, align 8, !tbaa !8
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %54 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %55 = load i32, i32* %total.addr, align 4
  call void @remember(%struct.Holder* %54, i32 %55)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = icmp slt i32 %56, 3
  br i1 %57, label %for.body.1, label %for.end.1

for.body.1:
  %58 = load i32, i32* %i.addr.1, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8* %59)
  store i8* %60, i8** %last.addr, align 8
  br label %for.inc.1

for.inc.1:
  %61 = load i32, i32* %i.addr.1, align 4
  %62 = add nsw i32 %61, 1
  store i32 %62, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %63 = load i32, i32* %total.addr, align 4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %66 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %67 = getelementptr inbounds %struct.Holder, %struct.Holder* %66, i32 0, i32 0
  %68 = load i8*, i8** %67, align 8, !tbaa !8
  %69 = call i8* @nish_str_concat(i8* %65, i8* %68)
  %70 = call i8* @nish_str_concat(i8* %69, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %71 = load i8*, i8** %last.addr, align 8
  %72 = call i8* @nish_str_concat(i8* %70, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %74 = call i32 @retain(i32 3)
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %73, i8* %75)
  call void @nish_print(i8* %76)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"ptr", !1, i64 0}
!7 = !{!"Holder", !6, i64 0}
!8 = !{!7, !6, i64 0}
