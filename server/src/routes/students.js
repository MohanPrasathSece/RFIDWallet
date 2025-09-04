const express = require('express');
const Student = require('../models/Student');
const router = express.Router();

// Find a student by roll number or RFID
router.get('/find', async (req, res) => {
  try {
    const { rollNo, rfid_uid } = req.query;
    if (!rollNo && !rfid_uid) {
      return res.status(400).json({ message: 'Please provide a roll number or RFID UID.' });
    }

    const query = {};
    if (rollNo) query.rollNo = rollNo;
    if (rfid_uid) query.rfid_uid = rfid_uid;

    const student = await Student.findOne(query);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json(student);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
