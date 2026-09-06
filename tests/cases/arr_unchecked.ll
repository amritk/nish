%struct.sts_array = type { i64, i64, i8* }

define noundef i32 @get(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4
  ret i32 %5
}

define void @set(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, i32 noundef %v) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  store i32 %v, i32* %4, align 4
  ret void
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
