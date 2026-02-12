const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';
const JWT_SECRET_B64 = "bmF0aXZlLWJ1aWxkaW5nLW1hdGVyaWFscy1pbnZlbnRvcnktc3lzdGVtLWp3dC1zZWNyZXQta2V5LTIwMjQ=";

async function runVerification() {
    try {
        console.log('🚀 Starting Mixed Sale Grouping Verification...');

        // 1. Setup Token
        let secret = JWT_SECRET_B64;
        if (secret.match(/^[A-Za-z0-9+/]+=*$/)) {
            secret = Buffer.from(secret, 'base64').toString('utf-8');
        }

        const user = await prisma.user.findFirst({ where: { role: 'SUPER_DUPER_ADMIN', isActive: true } });
        const shop = await prisma.shop.findFirst({ where: { isActive: true } });
        const product = await prisma.product.findFirst({ where: { isActive: true, stockQuantity: { gt: 10 } } });
        const tmtProduct = await prisma.tmtProduct.findFirst({ where: { isActive: true } });

        if (!user || !shop || !product || !tmtProduct) {
            console.error('❌ Missing prerequisite data');
            return;
        }

        const token = jwt.sign(
            { userId: user.id.toString(), email: user.email, role: user.role, shopId: shop.id.toString() },
            secret,
            { expiresIn: '1h', issuer: 'building-materials-inventory', audience: 'building-materials-users' }
        );

        // 2. Define Test Customer Data
        const testPhone = "9988776655";
        const testName = `Mixed Grouping Test`;

        // Clean up previous test (Optional, but good for clarity)
        // We rely on phone number grouping, so previous sales might merge if within 1 min?
        // Script runs fast, previous run was > 1 min ago.

        // 3. Create Regular Sale
        console.log('🛒 Creating Regular Sale...');
        const regPayload = {
            shopId: shop.id.toString(),
            customerInfo: { name: testName, phone: testPhone },
            saleDate: new Date().toISOString(),
            totalAmount: 100,
            finalAmount: 100,
            items: [{
                productId: Number(product.id),
                name: product.name,
                stockType: 'normal',
                unit: 'kg',
                quantity: 1,
                price: 100,
                price_per_unit: 100
            }],
            payment_type: 'cash',
            paid_amount: 100
        };

        const regRes = await fetch(`${API_URL}/sales/cash-sale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(regPayload)
        });
        if (!regRes.ok) {
            const body = await regRes.text();
            console.error(`❌ Regular Sale Failed: ${regRes.status} ${regRes.statusText}`);
            console.error(`Response Body: ${body.substring(0, 1000)}`);
            throw new Error(`Regular Sale Failed: ${regRes.status}`);
        }
        console.log('✅ Regular Sale Created');

        // 4. Create TMT Sale
        console.log('🏗️ Creating TMT Sale...');
        const tmtPayload = {
            shopId: shop.id.toString(),
            saleDate: new Date().toISOString(),
            customerName: testName,
            customerPhone: testPhone,
            paymentMethod: "CASH",
            paidAmount: 200,
            items: [{
                productId: Number(tmtProduct.id),
                soldQuantity: 1,
                unitType: "piece",
                pricePerUnit: 200
            }]
        };

        const tmtRes = await fetch(`${API_URL}/tmt/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(tmtPayload)
        });
        if (!tmtRes.ok) throw new Error(JSON.stringify(await tmtRes.json()));
        console.log('✅ TMT Sale Created');

        // 5. Check Dashboard
        console.log('📊 Checking Dashboard Grouping...');
        // Force clear cache to see new data immediately
        const dashRes = await fetch(`${API_URL}/dashboard/ultra-fast?shopId=${shop.id}&clearCache=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!dashRes.ok) throw new Error(JSON.stringify(await dashRes.json()));
        const dashData = await dashRes.json();

        if (!dashData.success || !dashData.data || !dashData.data.sales) {
            throw new Error('Invalid dashboard response structure');
        }

        const sales = dashData.data.sales;

        // Find sales for this phone
        const mySales = sales.filter(s => s.customerPhone === testPhone && new Date(s.createdAt).getTime() > Date.now() - 60000);

        console.log(`🔍 Found ${mySales.length} entry(ies) for phone ${testPhone} in last minute`);

        if (mySales.length === 1) {
            const sale = mySales[0];
            console.log('✅ SUCCESS: Sales are grouped!');
            console.log('   Total Amount:', sale.final_amount);
            console.log('   Items Count:', sale.items.length);

            // Verify items length >= 2
            if (sale.items.length >= 2) {
                console.log('✅ Item count correct (>=2)');
            } else {
                console.error('❌ Item count incorrect (expected >=2)');
            }

            // Verify total amount = 100 + 200 = 300
            if (Math.abs(sale.final_amount - 300) < 0.1) {
                console.log('✅ Total amount correct (300)');
            } else {
                console.error(`❌ Total amount incorrect (expected 300, got ${sale.final_amount})`);
            }

        } else {
            console.error(`❌ FAILURE: Sales are NOT grouped! Found ${mySales.length} entries.`);
            mySales.forEach(s => console.log(`   - Sale ID: ${s.id}, Amount: ${s.final_amount}, Created: ${s.createdAt}`));
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runVerification();
