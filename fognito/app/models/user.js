const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
const userSchema = mongoose.Schema({

  local: {
    id: String,
    email: String,
    password: String,
    role: String,
    displayName: String
  },
  facebook: {
    id: String,
    token: String,
    name: String,
    email: String,
    phone: String
  },
  twitter: {
    id: String,
    token: String,
    displayName: String,
    username: String,
    phone: String
  },
  google: {
    id: String,
    token: String,
    email: String,
    name: String,
    phone: String
  }
});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function generateHash(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function validPassword(password) {
  return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);

