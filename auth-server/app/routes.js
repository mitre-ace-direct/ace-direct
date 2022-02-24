/**
* Define the different web services that clients can call.
*/

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('./login');
}

const appRouter = function myFunc(app, passport, _User) {
  app.get(['/customer', '/client'], isLoggedIn, (req, res) => {
    if (req.user && req.user.local && req.user.local.role && req.user.local.role !== 'customer') {
      res.render('login.ejs', { message: req.flash('loginMessage') });
      return;
    }
    res.render('customer.ejs', { displayName: req.user.local.displayName });
  });

  app.get(['/agent', '/ca'], isLoggedIn, (req, res) => {
    if (req.user && req.user.local && req.user.local.role && req.user.local.role !== 'agent') {
      res.render('login.ejs', { message: req.flash('loginMessage') });
      return;
    }
    res.render('agent.ejs', { displayName: req.user.local.displayName });
  });

  app.get(['/foo'], (req, res) => {
    res.status(200).send('bar');
  });

  app.get(['/', '/home', '/index', '/login'], (req, res) => {
    res.render('login.ejs', { message: req.flash('loginMessage') });
  });

  app.get(['/failed'], (req, res) => {
    res.render('failed.ejs', { message: req.flash('loginMessage') });
  });

  app.get('/user', (req, res) => {
    res.json({
      displayName: req.user.local.displayName,
      phone: req.user.local.phone,
      extension: req.user.local
    });
  });

  app.post('/login', passport.authenticate('local-login', {
    failureRedirect: '/failed',
    failureFlash: true
  }), (req, res) => {
    console.log(JSON.stringify(req.user, null, 4));
    if (req.user && req.user.local && req.user.local.role) {
      if (req.user.local.role === 'agent') {
        res.redirect('./agent');
      } else if (req.user.local.role === 'customer') {
        res.redirect('./customer');
      } else {
        res.render('login.ejs', { message: req.flash('loginMessage') });
      }
    } else {
      res.render('login.ejs', { message: req.flash('loginMessage') });
    }
  });

  app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('./login');
  });

  // handle all other routes, this must be the LAST route
  app.get('*', (req, res) => {
    res.status(404).send('<pre>Page not found.</pre>');
  });
};

module.exports = appRouter;

