const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

function auth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Unauthorized' });
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
      // Attach student if exists
      if (payload?.studentId) {
        req.student = await Student.findById(payload.studentId).lean();
      }
      req.user = payload; // keep for compatibility
      return next();
    } catch (e) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

function requireRoles() {
  return (_req, _res, next) => next();
}

function deviceAuth() {
  return (_req, _res, next) => next();
}

module.exports = { auth, requireRoles, deviceAuth };
