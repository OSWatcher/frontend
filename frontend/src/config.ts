module.exports = {
  API_LOCATION: process.env.NODE_ENV === 'production'
    ? 'https://oswatcherdb.ladro.download:5000'
    : 'https://localhost:5000'
};
