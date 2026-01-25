// test-connection.js - Simple connection test
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('🔄 Testing MongoDB connection...');
        console.log('📋 Connection string:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            family: 4
        });
        
        console.log('✅ MongoDB connection successful!');
        
        const result = await mongoose.connection.db.admin().ping();
        console.log('🏓 Database ping successful:', result);
        
        console.log('🗂️ Database name:', mongoose.connection.name);
        console.log('🔗 Connection state:', mongoose.connection.readyState);
        
        await mongoose.connection.close();
        console.log('🔌 Connection closed successfully');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        
        if (error.message.includes('ENOTFOUND')) {
            console.log('💡 Check your internet connection');
        } else if (error.message.includes('authentication failed')) {
            console.log('💡 Check your username and password');
        } else if (error.message.includes('ServerSelectionTimeoutError')) {
            console.log('💡 Check if your IP is whitelisted in MongoDB Atlas');
        }
    }
}

testConnection();
