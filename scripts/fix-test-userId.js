#!/usr/bin/env node

// Fix test files to include testUserId in all storage calls
import fs from 'fs';
import path from 'path';

const testFilesPath = [
  'apps/web/src/test/TodayScreen.test.tsx',
  'apps/web/src/test/TodayScreen.dragdrop.test.tsx',
  'apps/web/src/test/DailyReviewScreen.test.tsx',
  'apps/web/src/test/InboxScreen.test.tsx',
  'apps/web/src/test/storage.test.ts',
];

const patterns = [
  // saveTask patterns
  {
    regex: /(?<!testUserId, )storage\.saveTask\(/g,
    replacement: 'storage.saveTask(testUserId, ',
    condition: (line) => !line.includes('testUserId,'),
  },
  // saveDayPlan patterns
  {
    regex: /(?<!testUserId, )storage\.saveDayPlan\(/g,
    replacement: 'storage.saveDayPlan(testUserId, ',
    condition: (line) => !line.includes('testUserId,'),
  },
  // getDayPlan patterns
  {
    regex: /storage\.getDayPlan\(([^,)]+)\)/g,
    replacement: 'storage.getDayPlan(testUserId, $1)',
    condition: (line) => !line.includes('testUserId,'),
  },
  // getTask patterns
  {
    regex: /storage\.getTask\(([^,)]+)\)/g,
    replacement: 'storage.getTask(testUserId, $1)',
    condition: (line) => !line.includes('testUserId,'),
  },
  // listTasks patterns
  {
    regex: /storage\.listTasks\(/g,
    replacement: 'storage.listTasks(testUserId, ',
    condition: (line) => !line.includes('testUserId,'),
  },
  // saveDailyReview patterns
  {
    regex: /(?<!testUserId, )storage\.saveDailyReview\(/g,
    replacement: 'storage.saveDailyReview(testUserId, ',
    condition: (line) => !line.includes('testUserId,'),
  },
  // getDailyReview patterns
  {
    regex: /storage\.getDailyReview\(([^,)]+)\)/g,
    replacement: 'storage.getDailyReview(testUserId, $1)',
    condition: (line) => !line.includes('testUserId,'),
  },
];

testFilesPath.forEach((filePath) => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping non-existent file: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  patterns.forEach(({ regex, replacement, condition }) => {
    const lines = content.split('\n');
    const updatedLines = lines.map((line) => {
      if (condition(line) && regex.test(line)) {
        modified = true;
        return line.replace(regex, replacement);
      }
      return line;
    });
    content = updatedLines.join('\n');
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✓ Fixed: ${filePath}`);
  } else {
    console.log(`- No changes needed: ${filePath}`);
  }
});

console.log('\nDone! All test files have been updated.');
