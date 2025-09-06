const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

function auth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      
      // Enhanced debugging for auth header
      console.log('[Auth] Request details:', {
        path: req.path,
        method: req.method,
        hasAuthHeader: Boolean(req.headers.authorization),
        authHeaderLength: req.headers.authorization ? req.headers.authorization.length : 0,
        startsWithBearer: req.headers.authorization ? req.headers.authorization.startsWith('Bearer ') : false,
        tokenExtracted: Boolean(token),
        tokenLength: token ? token.length : 0,
        jwtSecret: process.env.JWT_SECRET ? `${process.env.JWT_SECRET.slice(0, 3)}...${process.env.JWT_SECRET.slice(-3)}` : 'using default "dev"',
      });
      
      if (!token) {
        console.warn('[Auth] Missing or malformed Authorization header', {
          hasAuthHeader: Boolean(req.headers.authorization),
          headerStartsWithBearer: req.headers.authorization ? req.headers.authorization.startsWith('Bearer ') : false,
          path: req.path,
          method: req.method,
        });
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
      console.log('[Auth] Token verified successfully:', {
        studentId: payload?.studentId,
        exp: payload?.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiry',
        iat: payload?.iat ? new Date(payload.iat * 1000).toISOString() : 'no issued time',
      });
      
      // Attach student if exists
      if (payload?.studentId) {
        req.student = await Student.findById(payload.studentId).lean();
        console.log('[Auth] Student attached:', {
          studentId: req.student?._id,
          studentName: req.student?.name,
          studentEmail: req.student?.email,
        });
      }
      req.user = payload; // keep for compatibility
      return next();
    } catch (e) {
      console.error('[Auth] Token verification failed:', {
        name: e?.name,
        message: e?.message,
        path: req.path,
        method: req.method,
        tokenLength: req.headers.authorization ? req.headers.authorization.length : 0,
        jwtSecret: process.env.JWT_SECRET ? `${process.env.JWT_SECRET.slice(0, 3)}...${process.env.JWT_SECRET.slice(-3)}` : 'using default "dev"',
      });
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
