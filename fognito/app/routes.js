const appRouter = function myFunc(app, passport, config, _User) {


  // res.local lets you set some vars for ejs to use without having to pass them into the render. 
  app.use(function (req, res, next) {
    res.locals = {
      title1: config.title1 || "title 1",
      title2: config.title2 || "title 2",
    }
    if (req.user && req.user.local && req.user.local.role) {
      res.locals.site_role = req.user.local.role;
    }
    next()
  })

  const restrict = (role) => {
    return (req, res, next) => {
      if (req.isAuthenticated() && ((req.user && req.user.local && req.user.local.role && req.user.local.role === role) || (role === 'any'))) {
        next()
      } else {
        res.redirect('./');
      }
    };
  };


  app.get(['/', '/home', '/index'], (req, res) => {
    if (!req.isAuthenticated()) {
      res.redirect('./login');
    } else {
      res.render('404.ejs');
    }
  });

  app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('./') // user is already authenticated, send them back home
    } else {
      res.render('login.ejs', { message: req.flash('loginMessage'), logo_image: config.logo_image });
    }
  })


  /* 
   *These are examples of how you can restrict pages by roles 
   * 
   * */
  app.get(['/agent'], restrict('AD Agent'), (req, res) => {
    res.send("only agents can see this")
  });

  app.get(['/manager'], restrict('Manager'), (req, res) => {
    res.send("only managers are allowed here")
  });

  app.get(['/customer'], restrict('customer'), (req, res) => {
    res.send("you must be a customer")
  });

  app.get(['/anyuser'], restrict('any'), (req, res) => {
    res.send("you are authenticated and thats good enough")
  });



  app.get(['/failed'], (req, res) => {
    res.render('failed.ejs', { message: req.flash('loginMessage') });
  });

  app.post('/login', passport.authenticate('local-login', {
    failureRedirect: './login',
    failureFlash: true
  }), (req, res) => {

    var redirect = (req.body.redirect == 'on') ? false : true; //default redirect

    console.log(JSON.stringify(req.user, null, 4));
    if (redirect && req.user && req.user.local && req.user.local.role) {
      switch (req.user.local.role) {
        case 'AD Agent':
          res.redirect('/someuser/ACEDirect/agent');
          break;
        case 'Manager':
          res.redirect('/someuser/ManagementPortal');
          break;
        case 'customer': //no customer role yet, place holder
          res.redirect('/someuser/ACEDirect/call');
          break;
        default:
          res.redirect('./profile'); //send the user somewhere
      }
    } else {
      res.redirect('./profile')
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

  app.get('/profile', restrict('any'), (req, res) => {
    res.render('profile.ejs');
  });

  app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('./login');
  });

  // handle all other routes, this must be the LAST route
  app.get('*', (req, res) => {
    //res.status(404).render('404.ejs'); // setting the status to 404 requires an nginx change. 
    res.render('404.ejs');
  });
};

module.exports = appRouter;

