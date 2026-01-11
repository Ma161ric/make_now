import fs from 'fs';
import path from 'path';

const testFiles = [
  'apps/web/src/test/TodayScreen.test.tsx',
  'apps/web/src/test/TodayScreen.dragdrop.test.tsx',
  'apps/web/src/test/DailyReviewScreen.test.tsx',
  'apps/web/src/test/InboxScreen.test.tsx',
];

const patterns = [
  { regex: /storage\.saveDayPlan\(dayPlan\)/g, replacement: 'storage.saveDayPlan(testUserId, dayPlan)' },
  { regex: /storage\.saveTask\(task1\)/g, replacement: 'storage.saveTask(testUserId, task1)' },
  { regex: /storage\.saveTask\(task2\)/g, replacement: 'storage.saveTask(testUserId, task2)' },
  { regex: /storage\.saveTask\(task3\)/g, replacement: 'storage.saveTask(testUserId, task3)' },
  { regex: /storage\.saveTask\(task\)/g, replacement: 'storage.saveTask(testUserId, task)' },
  { regex: /storage\.getDayPlan\(today\)/g, replacement: 'storage.getDayPlan(testUserId, today)' },
  { regex: /storage\.getTask\(/g, replacement: 'storage.getTask(testUserId, ' },
  { regex: /storage\.listTasks\(/g, replacement: 'storage.listTasks(testUserId, ' },
  { regex: /storage\.updateTaskStatus\(/g, replacement: 'storage.updateTaskStatus(testUserId, ' },
  { regex: /storage\.saveDailyReview\(/g, replacement: 'storage.saveDailyReview(testUserId, ' },
  { regex: /storage\.getDailyReview\(today\)/g, replacement: 'storage.getDailyReview(testUserId, today)' },
  { regex: /storage\.addNote\(/g, replacement: 'storage.addNote(testUserId, ' },
  { regex: /storage\.listNotes\(\)/g, replacement: 'storage.listNotes(testUserId)' },
  { regex: /storage\.getNote\(/g, replacement: 'storage.getNote(testUserId, ' },
  { regex: /storage\.getExtraction\(/g, replacement: 'storage.getExtraction(testUserId, ' },
  { regex: /storage\.saveReviewedItems\(/g, replacement: 'storage.saveReviewedItems(testUserId, ' },
  { regex: /storage\.getReviewedItems\(/g, replacement: 'storage.getReviewedItems(testUserId, ' },
  { regex: /storage\.listAllReviewedItems\(\)/g, replacement: 'storage.listAllReviewedItems(testUserId)' },
];

testFiles.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping non-existent: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  patterns.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed: ${filePath}`);
  } else {
    console.log(`- No changes: ${filePath}`);
  }
});

console.log('\n✅ Done!');
