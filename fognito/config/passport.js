/* eslint-disable no-shadow */
const LocalStrategy = require('passport-local').Strategy;

// load up the user model
const User = require('../app/models/user');

// expose this function to our app using module.exports
module.exports = function myfunc(passport) {
  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // passport needs ability to serialize and unserialize users out of session

  // used to serialize the user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // used to deserialize the user
  passport.deserializeUser((id, done) => {
    // Only return these. Others like callHistory are not needed here.
    User.findById(id, 'local.id local.email local.password local.displayName local.role local.phone local.language', (err, user) => {
      done(err, user);
    });
  });

  // =========================================================================
  // LOCAL SIGNUP ============================================================
  // =========================================================================
  // we are using named strategies since we have one for login and one for signup
  // by default, if there was no name, it would just be called 'local'

  passport.use('local-signup', new LocalStrategy(
    {
      // by default, local strategy uses username and password, keep the same strategy
      usernameField: 'id',
      passwordField: 'password',
      passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    ((req, id, password, done) => {
      // asynchronous
      // User.findOne wont fire unless data is sent back
      process.nextTick(() => {
        // find a user whose id is the same as the forms id
        // we are checking to see if the user trying to login already exists
        User.findOne({ 'local.id': id }, (err, user) => {
          // if there are any errors, return the error
          if (err) return done(err);

          // check to see if theres already a user with that id
          if (user) {
            return done(null, false, req.flash('signupMessage', 'That username is already taken.'));
          }
          // if there is no user with that username
          // create the user
          const newUser = new User();

          // set the user's local credentials
          newUser.local.id = id;
          newUser.local.email = '';
          newUser.local.password = newUser.generateHash(password);
          newUser.local.displayName = id;
          newUser.local.role = 'customer'; // customer role by default
          newUser.local.phone = ''; // customer role by default

          // save the user
          return newUser.save((err) => {
            if (err) throw err;
            return done(null, newUser);
          });
        });
      });
    })
  ));

  // we are using named strategies since we have one for login and one for signup
  // by default, if there was no name, it would just be called 'local'

  passport.use('local-login', new LocalStrategy(
    {
      // by default, local strategy uses username and password, we will use the same strategy
      usernameField: 'id',
      passwordField: 'password',
      passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    ((req, id, password, done) => { // callback with id and password from our form
      // find a user whose id is the same as the forms id
      // we are checking to see if the user trying to login already exists
      User.findOne({ 'local.id': id }, (err, user) => {
        // if there are any errors, return the error before anything else
        if (err) return done(err);

        // if no user is found, return the message
        if (!user) return done(null, false, req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash

        // if the user is found but the password is wrong
        if (!user.validPassword(password)) return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata

        // all is well, return successful user
        return done(null, user);
      });
    })
  ));
};

