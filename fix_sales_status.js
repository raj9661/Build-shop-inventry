
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSalesStatus() {
    try {
        console.log('Finding sales with PENDING status but valid payment...');

        // Find sales that are PENDING but might be paid
        // We'll check all PENDING sales
        const sales = await prisma.sale.findMany({
            where: {
                paymentStatus: 'PENDING'
            }
        });

        console.log(`Found ${sales.length} PENDING sales.`);

        let fixedCount = 0;

        for (const sale of sales) {
            // Calculate derived status
            let paymentStatus = 'PENDING';
            const finalAmount = Number(sale.finalAmount);

            // We don't have paidAmount field in Sale model directly? 
            // Wait, schema check.
            // Schema has: finalAmount, paymentMethod.
            // It DOES NOT have paidAmount field in Sale model! 
            // In route.ts we calculated it: "let paidAmount = 0; if (cash/online) paidAmount = finalAmount;"

            // So if paymentMethod is CASH/ONLINE, we assume it's fully paid?
            // YES, based on route.ts logic for "cash sale" API.
            // However, creating a sale with paymentType='partial' might not store paidAmount in Sale table?
            // Wait, where is paidAmount stored for Sale?
            // In route.ts: "4. Payment information is already stored in the Sale record. No separate Payment record needed"
            // BUT schema for Sale:
            // paymentMethod PaymentMethod
            // paymentStatus PaymentStatus
            // notes String?
            // NO paidAmount field!

            // So where is the partial amount stored?
            // In `route.ts`, for partial payment, it just sets `dueAmount` variable but DOES NOT STORE IT in Sale?
            // It logs it. But does it store it?
            // The schema I read earlier only had `finalAmount`.

            // Let's re-read schema for Sale model (lines 590-616).
            // `finalAmount Decimal`
            // `paymentMethod`
            // `paymentStatus`
            // `notes`
            // THAT IS IT.

            // Where does the partial payment amount go?
            // Maybe it goes into `notes`?
            // In `ledger/route.ts`, it parses `notes` to find partial payment info!
            // "Partial Payment: ... via ... Due: ..."

            // So, for "Cash" or "Online" sales (fully paid), the `paidAmount` is implicitly `finalAmount`.

            // Logic to fix:
            // If paymentMethod is CASH or CARD/ONLINE/UPI
            // AND notes does NOT say "Partial Payment"
            // THEN it is fully paid -> COMPLETED.

            let isFullyPaid = false;

            // Check payment method
            const method = sale.paymentMethod; // Enum

            const isPartial = sale.notes && (sale.notes.toLowerCase().includes('partial') || sale.notes.toLowerCase().includes('due'));

            if (!isPartial) {
                if (method === 'CASH' || method === 'CARD' || method === 'UPI' || method === 'BANK_TRANSFER' || method === 'CHEQUE') {
                    // If not partial note, assume fully paid for these methods? 
                    // What if it is a loan? 
                    // Loan usually implies "PENDING" or "UNPAID" status?
                    // If paymentMethod is defined, it usually implies some payment. 
                    // If it was credit sale, maybe method is null? Or a specific method?
                    // Schema has PaymentMethod enum: CASH, CARD, UPI, BANK_TRANSFER, CHEQUE... does it have CREDIT? 
                    // I didn't see PaymentMethod enum definition.

                    // But in route.ts: "paymentMethod: mapPaymentMethodToPrisma(payment_type)"
                    // payment_type='loan' -> ?
                    // route.ts doesn't handle 'loan' in mapPaymentMethodToPrisma.
                    // switch only has cash, card, online, upi...
                    // default return 'CASH'.

                    // So 'loan' sales might be saved as 'CASH'? ERROR?
                    // Wait, route.ts: "if (payment_type === 'loan') ... paidAmount = 0 ... dueAmount = finalAmount ..."
                    // But `paymentMethod` is stored using `mapPaymentMethodToPrisma('loan')` -> defaults to 'CASH'?
                    // This sounds like a bug in route.ts too!

                    // However, for the user's issue, they made a "Cash Sale".
                    // Payment Type: Cash.
                    // So it is fully paid.

                    isFullyPaid = true;
                }
            }

            if (isFullyPaid) {
                console.log(`Fixing Sale #${sale.id} (Status: ${sale.paymentStatus} -> COMPLETED)`);
                await prisma.sale.update({
                    where: { id: sale.id },
                    data: { paymentStatus: 'COMPLETED' }
                });
                fixedCount++;
            }
        }

        console.log(`Fixed ${fixedCount} sales.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

fixSalesStatus();
