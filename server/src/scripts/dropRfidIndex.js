require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');

const dropIndex = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'students' }).toArray();
    if (collections.length === 0) {
      console.log('`students` collection not found.');
      return;
    }

    const studentCollection = db.collection('students');
    const indexes = await studentCollection.indexes();
    const indexExists = indexes.some(index => index.name === 'RFIDNumber_1');

    if (indexExists) {
      console.log('Dropping index `RFIDNumber_1`...');
      await studentCollection.dropIndex('RFIDNumber_1');
      console.log('Index `RFIDNumber_1` dropped successfully.');
    } else {
      console.log('Index `RFIDNumber_1` not found.');
    }

  } catch (error) {
    console.error('An error occurred:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

dropIndex();
