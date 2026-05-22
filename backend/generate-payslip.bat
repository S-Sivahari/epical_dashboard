@echo off
REM Payslip Generation Script (Windows Batch)
REM Usage: payslip.bat <excel_path> <emp_id>
REM Example: payslip.bat "D:/path/to/master.xlsx" "E-1001"

setlocal enabledelayedexpansion

if "%1"=="" (
  echo Usage: payslip.bat ^<excel_path^> ^<emp_id^>
  echo Example: payslip.bat "D:/path/to/master.xlsx" "E-1001"
  echo.
  echo Arguments:
  echo   excel_path - Full path to master Excel file
  echo   emp_id - Employee ID (optional, omit to generate all)
  exit /b 1
)

set EXCEL_PATH=%1
set EMP_ID=%2
set API_URL=http://localhost:3000/api/payslips

if "!EMP_ID!"=="" (
  echo Generating payslips for ALL employees...
  curl -X POST !API_URL!/generate-all ^
    -H "Content-Type: application/json" ^
    -d "{\"excelPath\": \"!EXCEL_PATH!\"}"
) else (
  echo Generating payslip for employee: !EMP_ID!
  curl -X POST !API_URL!/generate ^
    -H "Content-Type: application/json" ^
    -d "{\"excelPath\": \"!EXCEL_PATH!\", \"empId\": \"!EMP_ID!\"}"
)

echo.
echo Done!
pause
