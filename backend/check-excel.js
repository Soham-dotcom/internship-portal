const xlsx = require('xlsx');
const path = require('path');

const filePath = 'c:\\Users\\soham\\Downloads\\indian_names_gmail.xlsx';

console.log('📄 Reading Excel file:', filePath);

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log('📋 Sheet name:', sheetName);
  
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log('\n📊 Total rows:', data.length);
  
  if (data.length > 0) {
    console.log('\n🔑 Column names found:');
    Object.keys(data[0]).forEach((key, idx) => {
      console.log(`  ${idx + 1}. "${key}"`);
    });
    
    console.log('\n📝 First 3 rows of data:');
    data.slice(0, 3).forEach((row, idx) => {
      console.log(`\nRow ${idx + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  "${key}": "${value}"`);
      });
    });
  } else {
    console.log('❌ No data found in Excel file');
  }
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
}
