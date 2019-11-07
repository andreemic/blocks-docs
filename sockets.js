var nodes = [];


// startet Pool und schickt 'pool_res_ready' events an den initiator
function startPool(starterSocket) {
	nodes.forEach(function(node) {
		node.emit('pool', starterSocket.id, function(nodeChain) {
			//gets called when node sends back his chain
			starterSocket.emit('pool_res_ready', nodeChain);
		});
	});
}
const fs = require('fs');
const path = require('path');
function clearDocs() {
	fs.readdir('./docs', (err, files) => {
	  if (err) throw err;

	  for (const file of files) {
	    fs.unlink(path.join('./docs', file), err => {
	      if (err) throw err;
	    });
	  }
	});
}
module.exports = function(io) {
	io.on('connection', function(socket) {
    	socket.join('nodes');

	let nodeId = socket.id;
	socket.emit('give_id', nodeId);
	
	startPool(socket);

	// pool all nodes and wait for answers
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
    	socket.on('pool_req', function() {
		startPool(socket);
	});


	socket.on('disconnect', function() {
		nodes.splice(nodes.indexOf(socket), 1);
		if (nodes.length == 0) {
			console.log("No one connected :( clearing docs");
			clearDocs();
		}
	});
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
