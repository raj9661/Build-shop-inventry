// Test script to manually cancel a TMT sale
const saleIdToCancel = 4; // Change this to the ID you want to test
const isTmtSale = true;

async function testCancelTmtSale() {
    try {
        // First, get a valid access token from localStorage (you'll need to paste this)
        const accessToken = 'YOUR_ACCESS_TOKEN_HERE'; // Replace with actual token from browser localStorage

        console.log(`Attempting to cancel TMT Sale ID: ${saleIdToCancel}`);
        console.log(`isTmtSale flag: ${isTmtSale}\n`);

        const response = await fetch('http://localhost:3000/api/sales', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                saleId: saleIdToCancel,
                action: 'cancel',
                reason: 'Test cancellation via script',
                isTmtSale: isTmtSale
            })
        });

        const data = await response.json();

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('✅ Cancellation successful!');
        } else {
            console.log('❌ Cancellation failed:', data.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Note: This requires node-fetch for Node.js
// Run with: npm install node-fetch@2 && node test-cancel-tmt.js
console.log('⚠️  This script requires a valid access token from your browser.');
console.log('    1. Open browser Dev Tools (F12)');
console.log('    2. Go to Console tab');
console.log('    3. Type: localStorage.getItem("accessToken")');
console.log('    4. Copy the token and paste it in this script\n');

// testCancelTmtSale();
