// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: 20,        // Suitable for db.t3.micro + small/medium traffic
  queueLimit: 0,
  enableKeepAlive: true,

  // AWS RDS MySQL SSL Configuration (Best practice)
  ssl: {
    rejectUnauthorized: true     // Enforces proper certificate validation
    // mysql2 will use system's trusted certificates + AWS RDS CA by default in most environments
  }
});

// Test connection on startup (very useful in production)
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to AWS RDS MySQL');
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   Host: ${process.env.DB_HOST}`);
    connection.release();
  } catch (err) {
    console.error('❌ Failed to connect to AWS RDS MySQL');
    console.error(`   Error Code: ${err.code}`);
    console.error(`   Message: ${err.message}`);
    
    if (err.code === 'HANDSHAKE_SSL_ERROR' || err.message.includes('certificate')) {
      console.error('\n💡 SSL Issue Tip:');
      console.error('   - Make sure your RDS Security Group allows inbound traffic from your app on port 3306');
      console.error('   - Consider setting ssl: { rejectUnauthorized: false } temporarily for debugging (not recommended in prod)');
    }
  }
}

// Run test on startup
testConnection();

module.exports = pool;