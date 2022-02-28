/**
* Define the different web services that clients can call.
*/

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('./login');
}

const appRouter = function myFunc(app, passport, config, User, dbConnection) {
  const title1 = config.title1;
  const title2 = config.title2;
  app.get(['/agent'], isLoggedIn, (req, res) => {
    if (req.user && req.user.local && req.user.local.role && req.user.local.role !== 'agent') {
      res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
      return;
    }
    res.render('agent.ejs', { message: '', displayName: req.user.local.displayName });
  });
  
  app.get(['/manager'], isLoggedIn, (req, res) => {
    if (req.user && req.user.local && req.user.local.role && req.user.local.role !== 'manager') {
      res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
      return;
    }
    res.render('manager.ejs', { message: '', displayName: req.user.local.displayName });
  });
    
  app.get(['/customer'], isLoggedIn, (req, res) => {
    if (req.user && req.user.local && req.user.local.role && req.user.local.role !== 'customer') {
      res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
      return;
    }
    res.render('customer.ejs', { message: '', displayName: req.user.local.displayName });
  });

  app.get(['/', '/home', '/index', '/login'], (req, res) => {
    res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
  });

  app.get(['/failed'], (req, res) => {
    res.render('failed.ejs', { message: req.flash('loginMessage') });
  });

  app.post('/login', passport.authenticate('local-login', {
    failureRedirect: '/failed',
    failureFlash: true
  }), async (req, res) => {
    if (!req.user || !req.user.local) {
      res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
      return;
    }

    // get application data: role field from agent_data table in MySQL
    dbConnection.query('SELECT role FROM agent_data WHERE username = ?', req.user.local.id, (err, result) => {
      if (err) {
        // lookup error - just go back to login page
        res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
        return;
      } else {
        // success
        let role = result[0].role;
        let query = {'local.id': req.user.local.id};
        User.findOneAndUpdate(query, {'local.role': role}, {upsert: true}, function(err, doc) {
          if (err) return res.send(500, {error: err});
          if (req.user && req.user.local && req.user.local.role) {
            if (req.user.local.role === 'AD Agent') {
              res.redirect('./agent');
            } else if (req.user.local.role === 'Manager') {
              res.redirect('./manager');
            } else if (req.user.local.role === 'customer') {
              res.redirect('./customer');
            } else {
              res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
            }
          } else {
            res.render('login.ejs', { title1, title2, message: req.flash('loginMessage'), logo_image:config.logo_image });
          }
        });  
      }
    });

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

