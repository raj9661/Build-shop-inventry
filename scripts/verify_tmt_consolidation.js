const entries = [
    { id: 101, type: 'sale_payment', amount: 2520, saleId: 33, isTmt: true }, // Purchase
    { id: 102, type: 'sale_payment', amount: -2520, saleId: 33, isTmt: true }, // Payment
    { id: 103, type: 'debit', amount: 2520, saleId: 33, isTmt: true } // Duplicate Purchase (Manual Debit)
];

const completedSaleKeys = new Set(['tmt-33']); // Assume sale is completed
const seenSaleIds = new Set();
const keptEntries = [];
const skippedEntries = [];

console.log('--- VERIFY CONSOLIDATION LOGIC ---');

entries.forEach(entry => {
    const amount = Number(entry.amount);
    const isNegative = amount < 0;
    const saleKey = `tmt-${entry.saleId}`;
    const isCompleted = completedSaleKeys.has(saleKey);

    let keep = false;

    if (entry.type === 'debit') {
        if (entry.isTmt && entry.saleId) {
            if (isCompleted) {
                if (seenSaleIds.has(saleKey)) {
                    console.log(`Skipping duplicate debit ${entry.id}`);
                } else {
                    seenSaleIds.add(saleKey);
                    keep = true;
                }
            }
        }
    } else if (entry.type === 'sale_payment') {
        if (isCompleted) {
            // NEW LOGIC HERE
            if (entry.isTmt && isNegative) {
                console.log(`Consolidating TMT payment ${entry.id}`);
                // keep = false; // Implicit
            } else if (!isNegative) {
                if (seenSaleIds.has(saleKey)) {
                    console.log(`Skipping duplicate purchase ${entry.id}`);
                } else {
                    seenSaleIds.add(saleKey);
                    keep = true;
                }
            } else {
                keep = true; // Regular payments (not TMT) would go here
            }
        }
    }

    if (keep) keptEntries.push(entry);
    else skippedEntries.push(entry);
});

console.log('\nResults:');
console.log(`Kept: ${keptEntries.length} entries`);
keptEntries.forEach(e => console.log(`- ${e.type} (${e.amount})`));
console.log(`Skipped: ${skippedEntries.length} entries`);
skippedEntries.forEach(e => console.log(`- ${e.type} (${e.amount})`));
