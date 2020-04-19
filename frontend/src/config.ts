module.exports = {
  API_LOCATION: process.env.NODE_ENV === 'production'
    ? 'http://34.65.83.178:5000'
    : 'http://localhost:5000'
};
