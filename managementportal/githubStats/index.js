// const express = require('express');
// const mysql = require('mysql');
// const https = require('https');
// const github = require('octonode');
const request = require('request');

request('http://www.google.com', (error, response, body) => {
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the HTML for the Google homepage.
});
