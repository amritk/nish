%struct.nish_array = type { i64, i64, i8* }

declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0

define noundef nonnull align 8 i8* @cut(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %0 = sext i32 %start to i64
  %1 = sext i32 %end to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = sub i64 %1, %0
  %6 = call i8* @nish_str_new(i8* %4, i64 %5)
  ret i8* %6
}

attributes #0 = { nounwind willreturn }
