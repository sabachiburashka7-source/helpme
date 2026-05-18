module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
  });
};
