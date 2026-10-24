%struct.Named = type { i8* }
%struct.Person = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"fallback\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define internal void @Person.constructor(%struct.Person* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Person, %struct.Person* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8
  ret void
}

define internal noundef align 8 i8* @firstOf(i8* noundef noalias readonly align 8 %a, i8* noundef noalias readonly align 8 %b) #1 {
entry:
  %0 = icmp ne i8* %a, null
  %1 = select i1 %0, i8* %a, i8* %b
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @nameOf(%struct.Named* noundef readonly align 8 nocapture %n, %struct.Person* noundef nonnull readonly align 8 dereferenceable(8) nocapture %fallback) #2 {
entry:
  %0 = icmp ne %struct.Named* %n, null
  %1 = bitcast %struct.Person* %fallback to %struct.Named*
  %2 = select i1 %0, %struct.Named* %n, %struct.Named* %1
  %3 = getelementptr inbounds %struct.Named, %struct.Named* %2, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8
  ret i8* %4
}

define noundef i32 @nish_main() #3 {
entry:
  %x.addr = alloca i8*, align 8
  %y.addr = alloca i8*, align 8
  %Person.obj = alloca %struct.Person, align 8
  %Person.obj.1 = alloca %struct.Person, align 8
  %Person.obj.2 = alloca %struct.Person, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @firstOf(i8* null, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %x.addr, align 8
  %1 = call i8* @firstOf(i8* null, i8* null)
  store i8* %1, i8** %y.addr, align 8
  %2 = load i8*, i8** %x.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %4 = load i8*, i8** %x.addr, align 8
  br label %cond.end

cond.end:
  %5 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true ], [ %4, %cond.false ]
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %7 = load i8*, i8** %y.addr, align 8
  %8 = icmp eq i8* %7, null
  br i1 %8, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %9 = load i8*, i8** %y.addr, align 8
  br label %cond.end.1

cond.end.1:
  %10 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true.1 ], [ %9, %cond.false.1 ]
  %11 = call i8* @nish_str_concat(i8* %6, i8* %10)
  call void @nish_print(i8* %11)
  call void @Person.constructor(%struct.Person* %Person.obj, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  %12 = call i8* @nameOf(%struct.Named* null, %struct.Person* %Person.obj)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  call void @Person.constructor(%struct.Person* %Person.obj.1, i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*))
  %14 = bitcast %struct.Person* %Person.obj.1 to %struct.Named*
  call void @Person.constructor(%struct.Person* %Person.obj.2, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  %15 = call i8* @nameOf(%struct.Named* %14, %struct.Person* %Person.obj.2)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  call void @nish_print(i8* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
