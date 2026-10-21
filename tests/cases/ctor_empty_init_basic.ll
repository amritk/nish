%struct.Dn = type { double, i32, i1 }
%struct.Bare = type {}

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

define internal void @Dn.constructor(%struct.Dn* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dn, %struct.Dn* %this, i32 0, i32 0
  store double 0x4004000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Dn, %struct.Dn* %this, i32 0, i32 1
  store i32 7, i32* %1, align 4, !tbaa !7
  %2 = getelementptr inbounds %struct.Dn, %struct.Dn* %this, i32 0, i32 2
  store i1 true, i1* %2, align 1, !tbaa !8
  ret void
}

define internal noundef double @Dn.scaled(%struct.Dn* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Dn, %struct.Dn* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !6
  %2 = fmul double %1, 0x4000000000000000
  ret double %2
}

define internal void @Bare.constructor(%struct.Bare* noundef nonnull noalias readonly align 8 nocapture %this) #2 {
entry:
  ret void
}

define internal noundef i32 @Bare.one(%struct.Bare* noundef nonnull readonly align 8 nocapture %this) #2 {
entry:
  ret i32 1
}

define noundef i32 @nish_main() #0 {
entry:
  %d.addr = alloca %struct.Dn*, align 8
  %Dn.obj = alloca %struct.Dn, align 8
  %b.addr = alloca %struct.Bare*, align 8
  %Bare.obj = alloca %struct.Bare, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Dn.constructor(%struct.Dn* %Dn.obj)
  store %struct.Dn* %Dn.obj, %struct.Dn** %d.addr, align 8
  %0 = load %struct.Dn*, %struct.Dn** %d.addr, align 8
  %1 = getelementptr inbounds %struct.Dn, %struct.Dn* %0, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !7
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load %struct.Dn*, %struct.Dn** %d.addr, align 8
  %5 = getelementptr inbounds %struct.Dn, %struct.Dn* %4, i32 0, i32 0
  %6 = load double, double* %5, align 8, !tbaa !6
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.Dn*, %struct.Dn** %d.addr, align 8
  %9 = getelementptr inbounds %struct.Dn, %struct.Dn* %8, i32 0, i32 2
  %10 = load i1, i1* %9, align 1, !tbaa !8
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %11)
  %12 = load %struct.Dn*, %struct.Dn** %d.addr, align 8
  %13 = call double @Dn.scaled(%struct.Dn* %12)
  %14 = call i8* @nish_str_from_f64(double %13)
  call void @nish_print(i8* %14)
  call void @Bare.constructor(%struct.Bare* %Bare.obj)
  store %struct.Bare* %Bare.obj, %struct.Bare** %b.addr, align 8
  %15 = load %struct.Bare*, %struct.Bare** %b.addr, align 8
  %16 = call i32 @Bare.one(%struct.Bare* %15)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"i1", !1, i64 0}
!5 = !{!"Dn", !2, i64 0, !3, i64 8, !4, i64 12}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 8}
!8 = !{!5, !4, i64 12}
