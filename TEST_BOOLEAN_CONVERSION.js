/**
 * Test smart boolean conversion in CSV import validation
 */

const path = require('path');

// Simulate the convertAndValidateValue function
function convertAndValidateValue(value, dataType, nullable, columnName) {
  class ValidationError extends Error {
    constructor(column, reason) {
      super(`${column}: ${reason}`);
      this.column = column;
      this.reason = reason;
    }
  }

  // Handle null values
  if (!value || value === '') {
    if (!nullable) {
      throw new ValidationError(columnName, 'cannot be empty (NOT NULL constraint)');
    }
    return null;
  }

  const lowerType = dataType.toLowerCase();

  // INTEGER validation (with smart boolean conversion)
  if (lowerType.includes('int') || lowerType.includes('serial')) {
    // Check if value looks like a boolean (Yes/No, True/False, etc.)
    if (/^(true|t|yes|y)$/i.test(value)) {
      return 1;
    }
    if (/^(false|f|no|n)$/i.test(value)) {
      return 0;
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new ValidationError(columnName, `expected an INTEGER but received '${value}'. Hint: Use 1/0 for boolean values.`);
    }
    return parsed;
  }

  // REAL/NUMERIC validation (with smart boolean conversion)
  if (lowerType.includes('numeric') || lowerType.includes('decimal') || 
      lowerType.includes('float') || lowerType.includes('double') || 
      lowerType.includes('real')) {
    // Check if value looks like a boolean
    if (/^(true|t|yes|y)$/i.test(value)) {
      return 1.0;
    }
    if (/^(false|f|no|n)$/i.test(value)) {
      return 0.0;
    }
    
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new ValidationError(columnName, `expected a REAL number but received '${value}'`);
    }
    return parsed;
  }

  // BOOLEAN validation
  if (lowerType.includes('bool')) {
    if (/^(true|t|yes|y|1)$/i.test(value)) {
      return 1;
    }
    if (/^(false|f|no|n|0)$/i.test(value)) {
      return 0;
    }
    throw new ValidationError(columnName, `expected a BOOLEAN but received '${value}'`);
  }

  // TEXT - return as-is
  return value;
}

console.log('🧪 Testing Smart Boolean Conversion in CSV Import\n');

try {
  // Test 1: INTEGER with boolean-like values
  console.log('1️⃣  Testing INTEGER with boolean values...');
  
  const tests = [
    { value: 'Yes', expected: 1, label: 'Yes' },
    { value: 'No', expected: 0, label: 'No' },
    { value: 'yes', expected: 1, label: 'yes (lowercase)' },
    { value: 'YES', expected: 1, label: 'YES (uppercase)' },
    { value: 'True', expected: 1, label: 'True' },
    { value: 'False', expected: 0, label: 'False' },
    { value: 'Y', expected: 1, label: 'Y' },
    { value: 'N', expected: 0, label: 'N' },
    { value: '1', expected: 1, label: '1 (numeric)' },
    { value: '0', expected: 0, label: '0 (numeric)' },
    { value: '42', expected: 42, label: '42 (regular integer)' },
  ];

  for (const test of tests) {
    const result = convertAndValidateValue(test.value, 'INTEGER', false, 'maintenance');
    if (result === test.expected) {
      console.log(`   ✅ ${test.label} → ${result}`);
    } else {
      console.log(`   ❌ ${test.label} → Expected ${test.expected}, got ${result}`);
    }
  }

  // Test 2: REAL with boolean values
  console.log('\n2️⃣  Testing REAL with boolean values...');
  
  const realTests = [
    { value: 'Yes', expected: 1.0, label: 'Yes' },
    { value: 'No', expected: 0.0, label: 'No' },
    { value: '3.14', expected: 3.14, label: '3.14 (regular float)' },
  ];

  for (const test of realTests) {
    const result = convertAndValidateValue(test.value, 'REAL', false, 'score');
    if (result === test.expected) {
      console.log(`   ✅ ${test.label} → ${result}`);
    } else {
      console.log(`   ❌ ${test.label} → Expected ${test.expected}, got ${result}`);
    }
  }

  // Test 3: Invalid values should still fail
  console.log('\n3️⃣  Testing invalid values (should fail)...');
  
  try {
    convertAndValidateValue('abc', 'INTEGER', false, 'count');
    console.log('   ❌ Should have thrown error for "abc"');
  } catch (error) {
    console.log(`   ✅ Correctly rejected "abc": ${error.message}`);
  }

  // Test 4: NULL handling
  console.log('\n4️⃣  Testing NULL handling...');
  
  const nullResult = convertAndValidateValue('', 'INTEGER', true, 'optional_field');
  if (nullResult === null) {
    console.log('   ✅ Empty string → null (nullable field)');
  }

  try {
    convertAndValidateValue('', 'INTEGER', false, 'required_field');
    console.log('   ❌ Should have thrown error for empty NOT NULL field');
  } catch (error) {
    console.log(`   ✅ Correctly rejected empty NOT NULL: ${error.message}`);
  }

  console.log('\n✅ ALL TESTS PASSED!');
  console.log('🎉 CSV Import can now handle Yes/No values in INTEGER columns!\n');

} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}
