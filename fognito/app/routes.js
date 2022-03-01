const appRouter = function myFunc(app, passport, User, dbConnection, nginx_params) {


  // res.local lets you set some vars for ejs to use without having to pass them into the render. 
  app.use(function (req, res, next) {
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
      res.render('login.ejs', { message: req.flash('loginMessage') });
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
  }), async (req, res) => {
    if (!req.user || !req.user.local) {
      res.render('login.ejs', { message: req.flash('loginMessage') });
      return;
    }

    // get application data: role field from agent_data table in MySQL
    dbConnection.query('SELECT role FROM agent_data WHERE username = ?', req.user.local.id, (err, result) => {
      if (err) {
        // lookup error - just go back to login page
        res.render('login.ejs', { message: req.flash('loginMessage') });
        return;
      } else {
        // success
        let role = result[0].role;
        let query = {'local.id': req.user.local.id};
        User.findOneAndUpdate(query, {'local.role': role}, {upsert: true}, function(err, doc) {
          if (err) return res.send(500, {error: err});
          if (req.user && req.user.local && req.user.local.role) {
            var redirect = (req.body.redirect == 'on') ? false : true; //default redirect

            console.log(JSON.stringify(req.user, null, 4));
            if (redirect && req.user && req.user.local && req.user.local.role) {
              switch (req.user.local.role) {
                case 'AD Agent':
                  //nginx_params
                  res.redirect(`${nginx_params.ad_path}${nginx_params.agent_route}`);
                  break;
                case 'Manager':
                  res.redirect(`${nginx_params.mp_path}`);
                  break;
                case 'customer': //no customer role yet, place holder
                  res.redirect(`${nginx_params.ad_path}${consumer_route}`);
                  break;
                default:
                  res.redirect('./profile'); //send the user somewhere
              }
            } else {
              res.redirect('./profile')
            }
          } else {
            res.render('login.ejs', { message: req.flash('loginMessage') });
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

