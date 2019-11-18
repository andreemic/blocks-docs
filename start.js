var series = require('async').series;
var exec = require('child_process').exec;

series([
 exec('npm run start'),
]); 

