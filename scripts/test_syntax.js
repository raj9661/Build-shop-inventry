// Syntax test script
try {
    console.log('🚀 Attempting to import UltraFastDashboard...');
    // We can't use @/ aliases in pure node without a loader, 
    // but we can try to require it if we use ts-node or similar.
    // Actually, I'll just check if tsc can compile it.
    console.log('Use tsc to check the file...');
} catch (e) {
    console.error('❌ Import failed:', e);
}
