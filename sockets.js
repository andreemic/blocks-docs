var nodes = [];

function someNodeInManual() {
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].in_manual) {
			return true;
		}
	}
	return false;
}

// sends result back to asking client
function sendResult(starterSocket, chain, some_node_in_manual) {	
	//gets called when node sends back his chain
	let response = {node_chain: chain, someone_in_manual: some_node_in_manual};
	starterSocket.emit('pool_res_ready', response);
}

// startet Pool und schickt 'pool_res_ready' events an den initiator
function startPool(starterSocket) {
	let some_node_in_manual = someNodeInManual();
	nodes.forEach(function(node) {
		if (starterSocket != node) {
			node.emit('pool', starterSocket.id, function(nodeChain) {
				sendResult(starterSocket, nodeChain, some_node_in_manual);
			});
		}
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

	let nodeId = socket.id;
	socket.emit('give_id', nodeId);
	socket.in_manual = false;
	

	// pool all nodes and wait for answers
	socket.on("add_doc", function(file, cb) {
		//save document handler
		let title = file.title;
		let text = file.text;

		let some_node_in_manual = someNodeInManual();
		
		let cb_ext = function(file, isEdit) {
			cb(file);
			// send new doc to all nodes and wait for their chains
			
			nodes.forEach(function(node) {
				node.emit('doc_added', {nodeid: nodeId, file: file}, function(nodeChain) {
				sendResult(socket, nodeChain, some_node_in_manual);
				});
			});
		};
		saveTxt(text, title, cb_ext); //save doc in local storage
	});
	
	nodes.push(socket); // save socket so it can be pooled later
    	socket.on('pool_req', function(data, cb) {
		if (cb) {
			cb(true);
		}
		startPool(socket);
	});
	
	socket.on('client_manual_mode', function(in_manual) {
		socket.in_manual = in_manual;
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
