var nodes = [];

const fs = require('fs');
module.exports = function(io) {
    io.on('connection', function(socket) {
    	socket.join('nodes');

	let nodeId = socket.id;
	socket.emit('give_id', nodeId);
	
	// pool all nodes and wait for answers
	nodes.forEach(function(node) {
		node.emit('pool', nodeId, function(nodeChain) {
			//gets called when node sends back his chain
			socket.emit('pool_res_ready', nodeChain);
		});
	});
	socket.on("add_doc", function(file, cb) {
		//save document handler
		let title = file.title;
		let text = file.text;

		let cb_ext = function(file, isEdit) {
			cb(file);
			// send new doc to all nodes and wait for their chains
			
			nodes.forEach(function(node) {
				node.emit('doc_added', {nodeid: nodeId, file: file}, function(nodeChain) {
					//gets called when node sends back his chain
					socket.emit('pool_res_ready', nodeChain);
				});
			});
		};
		saveTxt(text, title, cb_ext); //save doc in local storage
	});
	
	nodes.push(socket); // save socket so it can be pooled later
    })
};




//saves file
function saveTxt(text, title, cb) {
	// check that both args are strings
	if (!isString(text) || !isString(title) || title.indexOf('.') != -1 || title.length > 50 || text.length > 500) {
		return;
	}
	let fname = title + '.txt';
	
	if (fs.existsSync('/docs/' + fname)) {
		cb({text:text, title:fname}, true);
	}

	fs.writeFile('./docs/'+ fname, text, function(err) {
	    if(err) {
		return console.log(err);
	    }
		
	    console.log(fname + ' was saved successfully.');
	    cb({text: text, title: fname});
	}); 
}

function isString(str) {
	return typeof(str) === 'string';
}
