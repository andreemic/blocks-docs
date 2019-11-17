var docs = [];
let localChain;
let myid;

const SEND_CHAIN = 0;
const PICK_CHAIN = 1;
$(document).ready(function(){
		let manual_box = $('#manual_cbox');
		let manual_popup_con = $('#manual_popup_con');
		let manual_popup = $('#manual_popup');
	
		let someone_in_manual;

		// report to server if someone enters manual mode
		manual_box.change(function() {
			socket.emit('client_manual_mode', this.checked);
		});

		$('#pool_btn').click(function() {
			socket.emit('pool_req');
			poolChain();
		});
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
							poolChain();
						}	
						showFile(file);
					});
					$('#title_input').val('');
					$('#doc_input').val('');
				}
			});
			
			var socket = io();

			let pool_results = [];  // array holding Chain Candidates from other nodes 
						// nodeid - str, chain - Blockchain, lastBlockHash - str, votes - int
			let num_discrete_res = 0; // holds number of discrete submissions from other nodes for display purposes
			
		socket.on('give_id', function(id) {
			myid = id;
			$('#my_id').text(`Deine Id: ${myid}`);
			localChain = new Blockchain(myid);
		
			showChain(localChain);
			checkFiles();
			
			socket.emit('pool_req', null, function(pool_started) {
				if (pool_started) {
					poolChain();
				} else {
					throw "server side pooling error";
				}
			});
		});

		function showStatus(msg, ms) {
			$('#status').text(msg);
			$('#status').addClass('visible');
			if (ms) {
				setTimeout(function() { hideStatus();}, ms);
			}
		}
		function hideStatus() {
			$('#status').removeClass('visible');
		}
		

		// res_list - list of candidates with chains and the quantity of submissions for each (used with interaction type PICK_CHAIN)
		// asking_node_id - id of node asking for your chain (used with interaction type SEND_CHAIN)
		// interaction_type - 	SEND_CHAIN: function returns chain to send to a different node
		// 			PICK_CHAIN: function returns one of the chains in res_list 
		async function manualInteraction(res_list, asking_node_id, interaction_type){
			let c;
			
			// To-Do: 
			//  (*) make wrapper function to not have multiple 'close and empty pop up' duplicates for every onClick
			//  ( ) make timeout on asking node wait for answer from other nodes so there's no hassle in manual mode on SEND_CHAIN
			//  ( ) highlight algo-picked chain
			let resolve_with = function(res, val) {
				manual_popup_con.removeClass('visible');
				manual_popup.empty();
				res(val);
			}
				

			var popupClosed = new Promise(function(resolve, reject) {
				//on close popup resolve(c);
				if (interaction_type === PICK_CHAIN) {
					// create UI element for every chain
					res_list.forEach(function(candidate) {
						let ui_el = $('<div></div>').html(`<span class='votes'><b>Votes: </b>${candidate.votes}</span>
											<span class='creator'><b>Creator: </b>${candidate.nodeid}`);
						ui_el.attr('chain_id', candidate.lastBlockHash);
						ui_el.addClass('chain_el');
						let chain_con = $('<div></div>');
						chain_con.addClass('chain-con');
						let chain_l = candidate.chain.chain.length;
						if (chain_l > 1) {
							chain_con.append($('<p class="three-dots">...</p>'));
							chain_con.append(candidate.chain.chain[chain_l - 2].asHTML());
						}
						chain_con.append(candidate.chain.chain[chain_l - 1].asHTML());
						
						ui_el.append(chain_con);

						ui_el.click(function () {
							resolve_with(resolve, candidate);
						}); // resolve with chosen candidate
						manual_popup.append(ui_el);
					});
					manual_popup.append($('<div class="chain_el">Keep own Chain</div>').click(function() { 
						resolve_with(resolve, null);
					}));
				} else if (interaction_type === SEND_CHAIN) {
					manual_popup.append($('<div class="chain_el">Send own chain</div>').click(function () {
						resolve_with(resolve, null);
					}));
					manual_popup.append($('<div class="chain_el">Send chain w/out last block</div>').click(function() {
						let wrong_chain = Object.assign(Object.create(Object.getPrototypeOf(localChain)), localChain);
						wrong_chain.chain.pop();
						resolve_with(resolve, wrong_chain);
					}));
				}
				manual_popup_con.addClass('visible');
			});

			return popupClosed;
		}

		// waits 3 secs and compares chains from pool_results to choose a new chain
		async function poolChain() {
			showStatus("Frage andere Nodes nach ihren Chains...");
			let time_out = (someone_in_manual ? 10000 : 3000);
			setTimeout(async function() {
				hideStatus();
				console.log("Vergleiche die Chains von anderen Nodes...");
				//after 3 sec of receiving pool results from nodes set Timeout and decide for a chain
				if (pool_results.length > 0) {
					// Die Chain mit den meisten votes zaehlt
					let winningCandidate;
					if (manual_box[0].checked) {
						winningCandidate= await manualInteraction(pool_results, null, PICK_CHAIN);
					} else {
						winningCandidate = pool_results[0];
						for (let i = 1; i < pool_results.length; i++) {
							if (pool_results[i].votes > winningCandidate.votes) {
								winningCandidate = pool_results[i];
							}
						}
						
					}
					
					if (winningCandidate == null) {
						return;
					}


					localChain = winningCandidate.chain; //Uebernehme die Chain
					showChain(localChain);
					checkFiles();
					showStatus(`Pooling Phase zu ende, habe eine Chain festlegen können. (von ${winningCandidate.nodeid})`, 5000);
					
					pool_results = [];
				} else {
					showStatus("Pooling Phase zu ende, habe keine Nodes zum austauschen gefunden. Bleibe bei meiner Chain\n\n", 5000);
				}
				num_discrete_res = 0;
			}, 3000); 	
	}

	socket.on('doc_added', function(doc, cb) {
		if (isFileNew(doc.file)) {
			localChain.addBlockFromDoc(doc);
			showChain(localChain);
			cb(packageChain(localChain, myid));
			
			socket.emit('pool_req');
			poolChain();
		}
		showFile(doc.file);
		checkFiles();
	});
	
	socket.on('pool_res_ready', function(res) {
		// Akzeptiert antworten von anderen Nodes (Antwort in res argi)
		// Ihre Chains werden in pool_results gespeichert und ausgewertet in pool
		other_node_in_manual = res.someone_in_manual;
		let node_answer = res.node_chain;
		if (node_answer.chain.length < 1 ) {
			return;
		}
		num_discrete_res++;
		showStatus(`Frage andere Nodes nach ihren Chains... (${num_discrete_res} Chains bekommen)`);
		node_answer.votes = 1;
		node_answer.lastBlockHash = node_answer.chain[node_answer.chain.length-1].hash;
			
		// die Fremde Chain zur Instanz der Klasse Blockchain parsen
		let parsedChain = new Blockchain();
		parsedChain.fillChainFromArray(node_answer.chain);
		node_answer.chain = parsedChain;

		if (!node_answer.chain.checkValid()) {
			return; // malicious Chain
		}

		let chainIdx = -1; // index von neuen chain in pool_results (-1 falls noch keiner die geschickt hat)
		for (let i = 0; i < pool_results.length; i++) {
			if (pool_results[i].lastBlockHash === node_answer.lastBlockHash) {
				chainIdx = i;
			}
		}

		if (chainIdx === -1) {
			pool_results.push(node_answer);
		} else {
			pool_results[chainIdx].votes++;
		}
	});
	socket.on('pool', async function(pooling_node_id, cb) {
		let chain_to_send;
		if (manual_box[0].checked) {
			chain_to_send = await manualInteraction(null, pooling_node_id, SEND_CHAIN);
			if (chain_to_send == null) {
				chain_to_send = localChain;
			}
		} else {
			chain_to_send = localChain;
		}
		cb(packageChain(chain_to_send, myid));
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
		return sha256(this.index + this.prevHash + this.data + this.creator).toString();
	}
	prettyTimestamp() {
		return new Date(this.timestamp).toTimeString().split(' ')[0];
	}
	asHTML() {
		var block_el = $('<div></div>', {
			"class" : "block",
			"id": this.index
		});
		block_el.append(`<span class='timestamp'>${this.prettyTimestamp()}</span>`);
		block_el.append(`<span class='index'>${this.index}</span>`);
	
		var doc_entry_con = $("<li></li>");
		var doc_entry = $(`<h1>doc_fingerprint:</h1><span>0x${this.data}</span>`);
		doc_entry_con.append(doc_entry);
		block_el.append(doc_entry_con);
		
		var prevHash_entry_con = $("<li></li>");
		var prevHash_entry = $(`<h1>prev_hash:</h1><span>${this.prevHash}</span>`);
		prevHash_entry_con.append(prevHash_entry);
		block_el.append(prevHash_entry_con);

		var hash_entry_con = $("<li></li>");
		var hash_entry = $(`<h1>hash:</h1><span>${this.hash}</span>`);
		hash_entry_con.append(hash_entry);
		block_el.append(hash_entry_con);

		block_el.append(`<span class="creator">created by <span>${this.creator}</span></span>`);
		return block_el;
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
        newBlock.index = this.chain.length;
        newBlock.hash = newBlock.calculateHash();
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
		block_con.append(block.asHTML());
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
	return '#' + file.title.replace('.', '\\.').replace(' ', '\\ ');
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
