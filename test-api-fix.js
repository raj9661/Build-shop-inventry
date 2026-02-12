// Using built-in fetch (Node.js 18+)

async function testAPIFix() {
  try {
    console.log('🧪 Testing API fixes...\n');

    // Test 1: Test customers API
    console.log('📊 Test 1: Testing customers API...');
    try {
      const response = await fetch('http://localhost:3000/api/customers?shopId=2&limit=100', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Customers API working: Found ${data.data?.customers?.length || 0} customers`);
      } else {
        console.log('❌ Customers API error:', data);
      }
    } catch (error) {
      console.error('❌ Customers API request failed:', error.message);
    }

    // Test 2: Test ledger API
    console.log('\n📊 Test 2: Testing ledger API...');
    try {
      const response = await fetch('http://localhost:3000/api/ledger?customerId=5&limit=200', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Ledger API working: Found ${data.data?.entries?.length || 0} entries`);
        if (data.data?.entries?.length > 0) {
          const firstEntry = data.data.entries[0];
          console.log(`✅ First entry ID type: ${typeof firstEntry.id} (${firstEntry.id})`);
        }
      } else {
        console.log('❌ Ledger API error:', data);
      }
    } catch (error) {
      console.error('❌ Ledger API request failed:', error.message);
    }

    console.log('\n🎯 API Fix Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAPIFix(); 