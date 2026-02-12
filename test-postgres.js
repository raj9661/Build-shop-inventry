const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'inventory_user',
  password: 'inventory_password',
  database: 'inventory_db',
});

async function testPostgres() {
  try {
    console.log('🔍 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL!');

    // Test a simple query
    const res = await client.query('SELECT NOW() as now');
    console.log('✅ Query test passed. Server time:', res.rows[0].now);

    // Test table creation
    await client.query('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)');
    console.log('✅ Table creation test passed.');

    // Test insert
    await client.query('INSERT INTO test_table (name) VALUES ($1)', ['Test User']);
    console.log('✅ Insert test passed.');

    // Test select
    const { rows } = await client.query('SELECT * FROM test_table');
    console.log('✅ Select test passed. Rows:', rows);

    // Test cleanup
    await client.query('DROP TABLE IF EXISTS test_table');
    console.log('✅ Cleanup test table.');

    console.log('\n🎉 All PostgreSQL tests passed! Your PostgreSQL setup is working perfectly.');
  } catch (err) {
    console.error('❌ PostgreSQL test failed:', err.message);
  } finally {
    await client.end();
    console.log('🔌 PostgreSQL connection closed.');
  }
}

testPostgres(); 