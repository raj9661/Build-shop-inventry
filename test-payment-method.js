const testPaymentMethod = async () => {
  try {
    // First, get a valid token (you'll need to replace this with a real token)
    const token = 'your-token-here'; // Replace with actual token
    
    // Test data
    const testData = {
      customerId: 1, // Replace with actual customer ID
      date: new Date().toISOString().split('T')[0],
      amount: 1000,
      type: 'credit',
      paymentMethod: 'CASH',
      purpose: 'payment',
      description: 'Test payment entry'
    };

    console.log('Testing payment method API...');
    console.log('Request data:', testData);

    // Test POST request
    const postResponse = await fetch('http://localhost:3000/api/ledger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testData)
    });

    const postResult = await postResponse.json();
    console.log('POST Response:', postResult);

    if (postResult.success) {
      // Test GET request to verify the payment method was saved
      const getResponse = await fetch(`http://localhost:3000/api/ledger?customerId=${testData.customerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const getResult = await getResponse.json();
      console.log('GET Response:', getResult);

      if (getResult.success && getResult.data.entries.length > 0) {
        const latestEntry = getResult.data.entries[0]; // Most recent entry
        console.log('Latest entry payment mode:', latestEntry.paymentMode);
        console.log('Test completed successfully!');
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Uncomment the line below to run the test
// testPaymentMethod(); 