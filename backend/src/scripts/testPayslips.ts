// Test Payslip Generation
// Run with: npx ts-node backend/src/scripts/testPayslips.ts

import { readMasterExcel, buildPayslip, savePayslipAsDocx } from '../services/payslipGenerator'
import { existsSync } from 'fs'
import { join } from 'path'

async function testPayslips() {
  console.log('🧪 Testing Payslip Generation System\n')

  // Configuration
  const excelPath = process.argv[2] || 'D:/EPICAL LAYOUTS/project_code/payslip_master.xlsx'
  const outputDir = './test-payslips'

  // =========================================================================
  // TEST 1: Check Excel file exists
  // =========================================================================
  console.log('📋 TEST 1: Checking Excel file...')
  if (!existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`)
    console.log(`\n💡 Tip: Update the path or run with argument:`)
    console.log(`   npx ts-node backend/src/scripts/testPayslips.ts "D:/path/to/file.xlsx"`)
    process.exit(1)
  }
  console.log(`✓ Excel file found: ${excelPath}\n`)

  // =========================================================================
  // TEST 2: Read master data
  // =========================================================================
  console.log('📖 TEST 2: Reading master data from Excel...')
  try {
    const { company, structure, employees } = readMasterExcel(excelPath)

    console.log(`✓ Company: ${company['Company Name']}`)
    console.log(`✓ Salary structure components: ${Object.keys(structure).length}`)
    console.log(`✓ Total employees: ${employees.length}`)

    if (employees.length === 0) {
      console.error('❌ No employees found in Excel file!')
      process.exit(1)
    }
    console.log()

    // =========================================================================
    // TEST 3: Generate payslip for first employee
    // =========================================================================
    const firstEmp = employees[0]
    console.log(`🎯 TEST 3: Generating payslip for ${firstEmp['Name']} (${firstEmp['Emp ID']})...`)

    const doc = buildPayslip(company, structure, firstEmp)
    const fileName = `test-${firstEmp['Emp ID']}.docx`
    const filePath = join(outputDir, fileName)

    await savePayslipAsDocx(doc, filePath)
    console.log(`✓ Generated: ${filePath}\n`)

    // =========================================================================
    // TEST 4: Generate payslips for all employees
    // =========================================================================
    console.log(`⚡ TEST 4: Generating payslips for all ${employees.length} employees...`)
    let success = 0
    let failed = 0

    for (const emp of employees) {
      try {
        const doc = buildPayslip(company, structure, emp)
        const fileName = `payslip-${emp['Emp ID']}.docx`
        const filePath = join(outputDir, fileName)
        await savePayslipAsDocx(doc, filePath)
        success++
        console.log(`  ✓ ${emp['Name']} (${emp['Emp ID']})`)
      } catch (error: any) {
        failed++
        console.log(`  ✗ ${emp['Name']} (${emp['Emp ID']}): ${error.message}`)
      }
    }
    console.log()

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('📊 TEST SUMMARY')
    console.log('═'.repeat(50))
    console.log(`Total employees: ${employees.length}`)
    console.log(`✓ Success: ${success}`)
    console.log(`✗ Failed: ${failed}`)
    console.log(`Output directory: ${outputDir}`)
    console.log()

    if (failed === 0) {
      console.log('🎉 All tests passed!')
    } else {
      console.log(`⚠️  ${failed} payslip(s) failed to generate`)
    }

    // =========================================================================
    // NEXT STEPS
    // =========================================================================
    console.log('\n📝 Next Steps:')
    console.log('1. Start backend: npm run dev')
    console.log('2. Test API endpoint:')
    console.log(
      `   curl -X POST http://localhost:3000/api/payslips/generate -H "Content-Type: application/json" -d '{"excelPath": "${excelPath}", "empId": "${firstEmp['Emp ID']}"}'`
    )
    console.log('3. Check test-payslips/ directory for generated files')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run tests
testPayslips()
