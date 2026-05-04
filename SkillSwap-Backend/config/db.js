const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
mongoose.set('strictQuery', true);

const connectToDB = () => {
    mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('Connected to MongoDB successfully');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1); // Exit process if database connection fails
    });

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
    });

    mongoose.connection.on('error', (error) => {
        console.error('MongoDB error:', error);
    });

    // Handle process termination
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed due to app termination');
        process.exit(0);
    });
};

module.exports = connectToDB;