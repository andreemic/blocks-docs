var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
	var logger = require('morgan');


	const fs = require('fs');
	var dir = __dirname + '/docs';
	if (!fs.existsSync(dir)) {
	    fs.mkdirSync(dir);
	}

	function getDocs() {
		var docs_arr = [];

		files = fs.readdirSync('./docs/');
		files.forEach(fname => {
			let txt = fs.readFileSync('./docs/' + fname, 'utf-8'); 
			let doc = {};
			doc.title = fname;
			doc.text = txt;

			docs_arr.push(doc);
		});
		return docs_arr;
	}

	function isString(str) {
		return typeof(str) === 'string';
	}


	var app = express();


	app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

//get documents handler
app.get('/get_docs', function(req, res) {
	res.send({
		files: getDocs()
	}); 
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.json(res.locals);
});

module.exports = app;
