const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';
const JWT_SECRET_B64 = "bmF0aXZlLWJ1aWxkaW5nLW1hdGVyaWFscy1pbnZlbnRvcnktc3lzdGVtLWp3dC1zZWNyZXQta2V5LTIwMjQ=";

async function runHealthCheck() {
    try {
        console.log('🚀 Checking Dashboard API Health...');

        let secret = JWT_SECRET_B64;
        if (secret.match(/^[A-Za-z0-9+/]+=*$/)) {
            secret = Buffer.from(secret, 'base64').toString('utf-8');
        }

        const user = await prisma.user.findFirst({ where: { role: 'SUPER_DUPER_ADMIN', isActive: true } });
        const shop = await prisma.shop.findFirst({ where: { isActive: true } });

        if (!user || !shop) {
            console.error('❌ Missing user/shop');
            return;
        }

        const token = jwt.sign(
            { userId: user.id.toString(), email: user.email, role: user.role, shopId: shop.id.toString() },
            secret,
            { expiresIn: '1h' }
        );

        const res = await fetch(`${API_URL}/dashboard/ultra-fast?shopId=${shop.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            console.log('✅ Dashboard API is UP (Status: 200)');
            const data = await res.json();
            console.log('✅ Data received');
        } else {
            console.error(`❌ Dashboard API Down: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(text.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Health check failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runHealthCheck();
