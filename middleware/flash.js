/**
 * flash message: read from the session once, then cleared.
 */

const flash = (req, res, next) => {
  res.locals.flash = null;
  if (req.session?.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  }
  next();
};

module.exports = flash;
