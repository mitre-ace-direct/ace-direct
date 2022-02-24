const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');

const videoStatusEnum = ['Unread', 'Read', 'In Progress', 'Closed'];

// define the schema for our user model
const userSchema = mongoose.Schema({

  local: {
    id: String,
    email: String,
    password: String,
    role: String,
    displayName: String,
    phone: String,
    language: String,

    username: String,
    displayFirstName: String,
    displayLastName: String,
    preferredName: String,

    secondaryPhone: String,
    secondaryPhoneType: String,

    profilePicture: String,
    profilePictureFilePath: String,
    profilePictureOriginalName: String,
    profilePictureMimeType: String,

    asteriskExtension: String,
    localUri: String,
    isVrs: Boolean,
    isCts: Boolean,
    vrsUri: String,
    ctsUri: String,
    requireCA: Boolean,
    blockedNumbers: [String],
    defaultCallOptions: {
      closedCaptions: Boolean,
      audio: Boolean,
      video: Boolean
    },
    callHistory:
      [{
        number: String,
        date: Date,
        duration: Number,
        callDirection: String
      }],
    contacts:
      [{
        firstName: String,
        lastName: String,
        phonenumber: Number,
        favorite: Boolean
      }],
    address:
    {
      address1: String,
      address2: String,
      city: String,
      state: String,
      zip: String
    },
    emergencyAddress:
    {
      address1: String,
      address2: String,
      city: String,
      state: String,
      zip: String
    },
    videomail:
      [{
        id: String,
        status: {
          type: String,
          enum: videoStatusEnum
        },
        duration: Number,
        phonenumber: String,
        date: Date // UnixEpic
      }],
    preferredLanguage: String,
    fontSize: String,
    fontColors: String
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

