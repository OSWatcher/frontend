module.exports = {
  API_LOCATION: process.env.NODE_ENV === 'production'
    ? 'https://34.65.83.178:5000'
    : 'https://localhost:5000'
};
