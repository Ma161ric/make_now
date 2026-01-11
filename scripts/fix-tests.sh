#!/usr/bin/env bash
# Fix script to add testUserId to all remaining storage calls in test files

echo "🔧 Fixing test files to include userId parameter..."

# Function to fix a file
fix_test_file() {
  local file=$1
  local temp_file="${file}.tmp"
  
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    return
  fi
  
  echo "📝 Processing: $file"
  
  # Use sed to replace patterns
  sed -E \
    -e "s/storage\.saveTask\(([^t])/storage.saveTask(testUserId, \1/g" \
    -e "s/storage\.saveDayPlan\(([^t])/storage.saveDayPlan(testUserId, \1/g" \
    -e "s/storage\.getDayPlan\(today\)/storage.getDayPlan(testUserId, today)/g" \
    -e "s/storage\.getTask\((['\"])/storage.getTask(testUserId, \1/g" \
    -e "s/storage\.listTasks\(/storage.listTasks(testUserId, /g" \
    -e "s/storage\.updateTaskStatus\(/storage.updateTaskStatus(testUserId, /g" \
    -e "s/storage\.saveDailyReview\(([^t])/storage.saveDailyReview(testUserId, \1/g" \
    -e "s/storage\.getDailyReview\(today\)/storage.getDailyReview(testUserId, today)/g" \
    "$file" > "$temp_file"
  
  if diff -q "$file" "$temp_file" > /dev/null; then
    echo "  ✓ No changes needed"
    rm "$temp_file"
  else
    mv "$temp_file" "$file"
    echo "  ✓ Fixed!"
  fi
}

# List of test files
test_files=(
  "apps/web/src/test/TodayScreen.test.tsx"
  "apps/web/src/test/TodayScreen.dragdrop.test.tsx"
  "apps/web/src/test/DailyReviewScreen.test.tsx"
  "apps/web/src/test/InboxScreen.test.tsx"
)

# Fix each file
for file in "${test_files[@]}"; do
  fix_test_file "$file"
done

echo ""
echo "✅ Done! Now run: npm run test"
