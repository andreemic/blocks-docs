$(document).ready(function(){
	$("#send_button").click(function(){
		var title = $.trim($("#title_input").val());
		var text = $.trim($("#doc_input").val());
		if (title != "" && text != "") {
			let data = {file:{}};
			data.file.title = title;
			data.file.text = text;
			
			$.post('/save', data)
				.done(function(data) {
					console.log(saved);
				});
		}

	});

});
