const appRouter = function myFunc(app, passport, User, dbConnection, nginx_params) {


  // res.local lets you set some vars for ejs to use without having to pass them into the render. 
  app.use(function (req, res, next) {
    if (req.session && req.session.isLoggedIn) {
      res.locals.user = req.session.user;
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
    dbConnection.query('SELECT * FROM agent_data WHERE username = ?', req.user.local.id, (err, result) => {
      if (err) {
        // lookup error - just go back to login page
        res.render('login.ejs', { message: req.flash('loginMessage') });
        return;
      } else {
        // success
        req.session.isLoggedIn = true;
        req.session.user = {}
        req.session.user.role = result[0].role;
        req.session.user.agent_id = result[0].agent_id;
        req.session.user.firstname = result[0].first_name;
        req.session.user.lastname = result[0].last_name;
        req.session.user.phone = result[0].phone;
        req.session.user.email = result[0].email;

        let redirect = (req.body.redirect == 'on') ? false : true; //default redirect
        if (redirect && result[0].role) {
          switch (result[0].role) {
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
      }
    });
  });

  //app.get('/profile', restrict('any'), (req, res) => {
  app.get('/profile', (req, res) => {
    res.render('profile.ejs');
  });

  app.post('/updateProfile', restrict('any'), (req, res) => {
    let first_name = req.body.firstname;
    let last_name = req.body.lastname;
    let agent_id = req.session.user.agent_id;
    if (first_name && last_name && agent_id) {
      let query = 'UPDATE agent_data SET first_name = ?, last_name = ? WHERE agent_id = ?;'
      let params = [first_name, last_name, agent_id]
      dbConnection.query(query, params, (err, result) => {
        if (err) {
          res.status(500).send("Internal Error")
        } else {
          req.session.user.firstname = first_name;
          req.session.user.lastname = last_name;
          res.status(200).send("Update Success")
        }
      })
    } else {
      res.status(400).send("Missing Parameters")
    }
  });

  app.get('/logout', (req, res) => {
    //req.logout();
    req.session.destroy();
    res.redirect('./login');
  });

  // handle all other routes, this must be the LAST route
  app.get('*', (req, res) => {
    //res.status(404).render('404.ejs'); // setting the status to 404 requires an nginx change. 
    res.render('404.ejs');
  });
};

module.exports = appRouter;

