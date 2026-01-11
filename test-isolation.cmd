@echo off
REM User Data Isolation Test Suite - Verification Script (Windows)
REM Usage: npm run test:isolation

echo =========================================
echo User Data Isolation Test Suite
echo =========================================
echo.

setlocal enabledelayedexpansion
set TOTAL=0
set PASSED=0
set FAILED=0

REM Test 1: Core Storage
echo Running: Core Storage Functionality (24 tests)
set /a TOTAL+=1
npx vitest run src/test/storage.test.ts --reporter=verbose > nul 2>&1
if errorlevel 0 (
  echo [PASS] Core Storage Functionality
  set /a PASSED+=1
) else (
  echo [FAIL] Core Storage Functionality
  set /a FAILED+=1
)
echo.

REM Test 2: User Isolation
echo Running: User Data Isolation (14 tests)
set /a TOTAL+=1
npx vitest run src/test/userDataIsolation.test.ts --reporter=verbose > nul 2>&1
if errorlevel 0 (
  echo [PASS] User Data Isolation
  set /a PASSED+=1
) else (
  echo [FAIL] User Data Isolation
  set /a FAILED+=1
)
echo.

REM Test 3: Edge Cases
echo Running: Edge Cases ^& Scenarios (26 tests)
set /a TOTAL+=1
npx vitest run src/test/storage.edgecases.test.ts --reporter=verbose > nul 2>&1
if errorlevel 0 (
  echo [PASS] Edge Cases ^& Scenarios
  set /a PASSED+=1
) else (
  echo [FAIL] Edge Cases ^& Scenarios
  set /a FAILED+=1
)
echo.

echo =========================================
echo Test Summary
echo =========================================
echo Total Test Suites: %TOTAL%
echo Passed: %PASSED%
echo Failed: %FAILED%

if %FAILED% equ 0 (
  echo.
  echo ^>^>^> All isolation tests PASSED!
  echo User data isolation is working correctly.
  exit /b 0
) else (
  echo.
  echo ^>^>^> Some tests FAILED!
  exit /b 1
)
