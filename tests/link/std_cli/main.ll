%struct.HelpMenu = type { %struct.Style*, i8*, i32, i32, %struct.nish_array*, i32 }
%struct.Style = type { i1, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"greet\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"1.2.0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"say hello\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"<name> [flags]\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"greet someone\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"--version\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Flags\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--shout\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"in capitals\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--times\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<n>\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"say it n times\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"--a-flag-past-the-column\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<x>\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"two spaces\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Notes\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"one line of prose\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"/etc/greet.conf\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"theme:\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mono:\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"plain:\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"off paints nothing: \00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"mono dim is plain: \00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish.HelpMenu.constructor(%struct.HelpMenu* noundef nonnull noalias align 8 dereferenceable(40) nocapture, %struct.Style* noundef nonnull align 8 dereferenceable(2), i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef) #1
declare void @nish.HelpMenu.header(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.usage(%struct.HelpMenu* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.section(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.row(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.note(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.value(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.HelpMenu.text(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #1
declare void @nish.Style.constructor(%struct.Style* noundef nonnull noalias align 8 dereferenceable(2) nocapture, i1 noundef zeroext, i1 noundef zeroext) #1
declare noundef nonnull align 8 i8* @nish.Style.paint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.heading(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.name(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.flag(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.meta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.dim(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

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

define internal noundef nonnull align 8 i8* @visible(i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %text, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @menu(%struct.Style* noundef nonnull align 8 dereferenceable(2) %style) #0 {
entry:
  %m.addr = alloca %struct.HelpMenu*, align 8
  %HelpMenu.obj = alloca %struct.HelpMenu, align 8
  call void @nish.HelpMenu.constructor(%struct.HelpMenu* %HelpMenu.obj, %struct.Style* %style, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 24, i32 30)
  store %struct.HelpMenu* %HelpMenu.obj, %struct.HelpMenu** %m.addr, align 8
  %0 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.header(%struct.HelpMenu* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %1 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %1, i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*))
  %2 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %2, i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %3 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %3, i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*))
  %4 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %4, i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [12 x i8] }* @.str.11 to i8*))
  %5 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %5, i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [15 x i8] }* @.str.14 to i8*))
  %6 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %6, i8* bitcast ({ i64, [25 x i8] }* @.str.15 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.16 to i8*), i8* bitcast ({ i64, [11 x i8] }* @.str.17 to i8*))
  %7 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %7, i8* bitcast ({ i64, [6 x i8] }* @.str.18 to i8*))
  %8 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.note(%struct.HelpMenu* %8, i8* bitcast ({ i64, [18 x i8] }* @.str.19 to i8*))
  %9 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.value(%struct.HelpMenu* %9, i8* bitcast ({ i64, [16 x i8] }* @.str.20 to i8*))
  %10 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @nish.HelpMenu.text(%struct.HelpMenu* %10)
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  ret i8* %13
}

define noundef i32 @nish_main() #0 {
entry:
  %off.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %mono.addr = alloca %struct.Style*, align 8
  %Style.obj.1 = alloca %struct.Style, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.21 to i8*))
  %0 = call i8* @nish_alloc_struct(i64 2)
  %1 = bitcast i8* %0 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %1, i1 true, i1 true)
  %2 = call i8* @menu(%struct.Style* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @visible(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.22 to i8*))
  %6 = call i8* @nish_alloc_struct(i64 2)
  %7 = bitcast i8* %6 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %7, i1 true, i1 false)
  %8 = call i8* @menu(%struct.Style* %7)
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @visible(i8* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.23 to i8*))
  %12 = call i8* @nish_alloc_struct(i64 2)
  %13 = bitcast i8* %12 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %13, i1 false, i1 true)
  %14 = call i8* @menu(%struct.Style* %13)
  call void @nish_print(i8* %14)
  call void @nish.Style.constructor(%struct.Style* %Style.obj, i1 false, i1 false)
  store %struct.Style* %Style.obj, %struct.Style** %off.addr, align 8
  %15 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @nish.Style.heading(%struct.Style* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = call zeroext i1 @nish_str_eq(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @nish.Style.dim(%struct.Style* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  %24 = call zeroext i1 @nish_str_eq(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  br label %land.end

land.end:
  %25 = phi i1 [ false, %entry ], [ %24, %land.rhs ]
  %26 = select i1 %25, i8* bitcast ({ i64, [5 x i8] }* @.str.27 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.28 to i8*)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.24 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.1, i1 true, i1 false)
  store %struct.Style* %Style.obj.1, %struct.Style** %mono.addr, align 8
  %28 = load %struct.Style*, %struct.Style** %mono.addr, align 8
  %29 = call i64 @nish_arena_mark()
  %30 = call i8* @nish.Style.dim(%struct.Style* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.30 to i8*))
  %31 = call i8* @nish_arena_keep(i64 %29, i8* %30)
  %32 = call zeroext i1 @nish_str_eq(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.30 to i8*))
  %33 = select i1 %32, i8* bitcast ({ i64, [5 x i8] }* @.str.27 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.28 to i8*)
  %34 = call i8* @nish_str_concat(i8* bitcast ({ i64, [20 x i8] }* @.str.29 to i8*), i8* %33)
  call void @nish_print(i8* %34)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
