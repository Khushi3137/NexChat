module.exports = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
