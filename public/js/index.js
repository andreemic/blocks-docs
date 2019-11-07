var docs = [];
let localChain;
let myid;
$(document).ready(function(){

	 $.get("/get_docs", function(data, status){
		 data.files.forEach(showFile); 
	 });

	$("#send_button").click(function(){
		var title = $.trim($("#title_input").val());
		var text = $.trim($("#doc_input").val());
		if (title != "" && text != "") {
			let file = {};
			file.title = title;
			file.text = text;
			socket.emit('add_doc', file, function(file) {
				if (isFileNew(file)) {
					// falls die Datei neu ist, sich einen Block zufügen
					localChain.addBlockFromDoc({file:file, nodeid:myid});
					showChain(localChain);
				}	
				showFile(file);
				poolChain();
			});
			$('#title_input').val('');
			$('#doc_input').val('');
		}
	});
	
	var socket = io();

	let pool_results = []; //array holding Blockchains from peers
	socket.on('give_id', function(id) {
		myid = id;
		$('#my_id').text(`Deine Id: ${myid}`);
		localChain = new Blockchain(myid);
    		
		showChain(localChain);
		checkFiles();
		
		console.log("Warte auf antworten von anderen Nodes...");
		poolChain(); 
	});

	function showStatus(msg) {
		$('#status').text(msg);
		$('#status').addClass('visible');
	}
	function hideStatus() {
		$('#status').removeClass('visible');
	}
	// waits 3 secs and compares chains from pool_results to choose a new chain
	function poolChain() {
		showStatus("Frage andere Nodes nach ihren Chains...");
		let timeout_interval = setInterval(function() {
			hideStatus();
			console.log("Vergleiche die Chains von anderen Nodes...");
			//after 3 sec of receiving pool results from nodes set Timeout and decide for a chain
			if (pool_results.length > 0) {		
				for (let i = 0; i < pool_results.length; i++) {
					let nodeChain = new Blockchain();
					nodeChain.fillChainFromArray(pool_results[i].chain);
					if ((nodeChain.chain.length > localChain.chain.length && 
						nodeChain.checkValid(i)) || (localChain.chain.length === 1)) { // wenn die fremde Chain laenger als meine und legitim oder meine nur 1 block lang ist 
        					localChain = nodeChain; //Uebernehme die Chain
						showChain(localChain);
						checkFiles();
					} 
				}
				console.log("Pooling Phase zu ende, habe eine Chain festlegen können.");
				pool_results = [];
			} else {
				console.log("Pooling Phase zu ende, habe keine Nodes zum austauschen gefunden. Bleibe bei meiner Chain\n\n");
			}
			clearInterval(timeout_interval);
		}, 3000); 	
	}

	socket.on('doc_added', function(doc, cb) {
		if (isFileNew(doc.file)) {
			localChain.addBlockFromDoc(doc);
			showChain(localChain);
			cb(packageChain(localChain, myid));
		
			poolChain();
		}
		showFile(doc.file);
		checkFiles();
	});

	socket.on('pool_res_ready', function(res) {
		//if node is alone, this is not called and he keeps his genesis block
		console.log(res.nodeid + " hat seine Chain gesendet.");
		pool_results.push(res);
	});
	socket.on('pool', function(pooling_node_id, cb) {
		cb(packageChain(localChain, myid));
	});


});

// creates an object to broadcast to other nodes
// *chain - Blockchain
// *id - string
function packageChain(chain, id) {
	return {
			chain: chain.chain,
			nodeid: id
		};
}

class Block {
    constructor(timestamp, data, creatorid, index, prevHash, hash) {
	this.timestamp = timestamp;
	this.data = data;
	this.creator = creatorid;
	if (typeof(index) === 'undefined') {
		this.index = 0;
		this.prevHash = "0";
		this.hash = this.calculateHash();
	} else {
		this.index = index;
		this.prevHash = prevHash;
		this.hash = hash;
	}
    }

    calculateHash() {
        return sha256(this.index + this.prevHash + this.timestamp + this.data + this.creator).toString();
    }
    prettyTimestamp() {
	    return new Date(this.timestamp).toTimeString().split(' ')[0];
    }
}
class Blockchain{
    constructor(userid) {
        this.chain = [this.createGenesis(userid)];
    }


    createGenesis(userid) {
        return new Block(currTime(), "0", userid)
    }

    latestBlock() {
        return this.chain[this.chain.length - 1]
    }

    //gets array of blocks (received from other nodes) and fills them into the chain as instances of class Block
    fillChainFromArray(arr) {
	for (let i = 0; i < arr.length; i++) {
		let b = arr[i];
		this.chain[i] = new Block(b.timestamp, b.data, b.creator, b.index, b.prevHash, b.hash);
	}
    }

    addBlockFromDoc(doc) { 
	    let newBlock = new Block(currTime(), sha256(doc.file.text).substr(0,8), doc.nodeid);
	    this.addBlock(newBlock);
    }

    addBlock(newBlock){
        newBlock.prevHash = this.latestBlock().hash;
        newBlock.hash = newBlock.calculateHash();
        newBlock.index = this.chain.length;
	this.chain.push(newBlock);
    }

    checkValid() {
        for(let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.prevHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }

    blockContaining(file) {
	for (let i = 1; i < this.chain.length; i++) {
		if (this.chain[i].data == hashFile(file, false)) {
			return i;
		}
	}
	return -1;
    }
}



function showChain(chain) { 
	let block_con = $('#blocks_con');
	block_con.empty();
	chain.chain.forEach(function(block) {
		var block_el = $('<div></div>', {
			"class" : "block",
			"id": block.index
		});
		block_el.append(`<span class='timestamp'>${block.prettyTimestamp()}</span>`);
		block_el.append(`<span class='index'>${block.index}</span>`);
	
		var doc_entry_con = $("<li></li>");
		var doc_entry = $(`<h1>doc_fingerprint:</h1><span>0x${block.data}</span>`);
		doc_entry_con.append(doc_entry);
		block_el.append(doc_entry_con);
		
		var prevHash_entry_con = $("<li></li>");
		var prevHash_entry = $(`<h1>prev_hash:</h1><span>${block.prevHash}</span>`);
		prevHash_entry_con.append(prevHash_entry);
		block_el.append(prevHash_entry_con);

		var hash_entry_con = $("<li></li>");
		var hash_entry = $(`<h1>hash:</h1><span>${block.hash}</span>`);
		hash_entry_con.append(hash_entry);
		block_el.append(hash_entry_con);

		block_el.append(`<span class="creator">created by <span>${block.creator}</span></span>`);
		
		block_con.append(block_el);
	});
}



function currTime() {
	return new Date().getTime()
}

function isFileNew(file) {
	for (let i = 0; i < docs.length; i++) {
		if (docs[i].title == file.title) {
			return false;
		}
	}
	return true;
}
function fileCardId(file) {
	return '#' + file.title.replace('.', '\\.');
}

//returns hash of File (shortened to 8 chars)
//*pretty - whether to add '0x' or not
function hashFile(file, pretty) {
	return (pretty ? '0x' : '') + sha256(file.text).substring(0,8);
}

function updateDocsArr(file) {
	for (let i = 0; i < docs.length; i++) {
		if (docs[i].title == file.title) {
			docs[i].text = file.text;
		}
	}
}
// Displayed dokument falls es neu ist
// updated dokument falls es schon existiert (+ updated docs array)
function showFile(file) {
	let card;
	if (!isFileNew(file)){
		// file ist eine neue version eines Dokuments
		card = $(fileCardId(file));
		let docText = card.find('p');
		docText.text(file.text);
		
		let docHash = card.find("span")
		docHash.text(hashFile(file, true));
		
		updateDocsArr(file);
		return;
	} else {
		// file ist ein neues Dokument 
		card = $('<div></div>').addClass('doc-con').attr('id', file.title);

		let title = $('<h1></h1>').text(file.title);
		let text = $("<p></p>").text(file.text);
		let hash = $("<span></span>").attr('related_to_block', -1).text(hashFile(file, true)).click(scrollToBlock);

		card.append(title);
		card.append(text);
		card.append(hash);

		$('#docs_con').append(card);	
		docs.push(file);
	}
}

function checkFiles() {
	docs.forEach(function(file) { 
		let fileCard = $(fileCardId(file));
		let blockIdx = localChain.blockContaining(file); // enthaelt den Index von dem Block auf der localChain in dem der Hash der Fingerprint der Datei zu finden ist

		let fileForged = blockIdx == -1;
		if (fileForged && !fileCard.hasClass('forged')) {
			fileCard.addClass('forged');
		} else if (!fileForged && fileCard.hasClass('forged')) {
			fileCard.removeClass('forged'); 
		}	
		fileCard.find('span').attr('related_to_block', blockIdx); // speichere Block in dem der Fingerprint der Datei ist zur visualisation
	});
}

function scrollToBlock() {
	idx = parseInt($(this).attr('related_to_block'));
	if (idx == -1) return; // Datei ist nicht verfaelscht, es gibt keinen Block mit dem Fingerprint
	let blocks_con = $('#blocks_con');
	let block_w = blocks_con.children(":first").outerWidth();

	blocks_con.animate({
		scrollLeft: block_w * (idx - 1)
	});
	
	let relatedBlock = $(`#${idx}`);
	relatedBlock.addClass('highlight');
	setTimeout(function(){
		relatedBlock.removeClass('highlight');
	}, 1000);
}
