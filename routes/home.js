module.exports = function (router) {
  const homeRoute = router.route('/');
  homeRoute.get(function (req, res) {
    res.json({ message: 'Llama.io API is alive', data: { time: new Date().toISOString() } });
  });
  return router;
}
