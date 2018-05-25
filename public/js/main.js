$(document).ready(function() {
	var $formatText = $('#formatText');
	var $jsonText = $('#jsonText');
	var $show = $('#show');
	var $typeFileName = $('#typeFileName');
	var $fileName = $('#fileName');
	var $submit = $('#submit');
	var $formatUrl = $('#formatUrl');
	var $jsonUrl = $('#jsonUrl');
	var $reset = $('#reset');
	var $jsonFile = $('#jsonFile');
	var $formatFile = $('#formatFile');
	var formatType = 0;

	$formatFile.on('click', function() {
		var files = document.getElementById('jsonFile').files;

		if (!files.length || !files[0].name) {
			alert('请选择文件');
			return;
		}

		var reader = new FileReader();
        reader.readAsText(files[0], 'UTF-8');
        reader.onload = function (e) {
            var res = this.result;

            $fileName.text(files[0].name);
            format(res, $show, 0);
        };
	});

	$typeFileName.on('blur', function() {
		formatType === 2 && $fileName.text(this.value);
	});

	$formatText.on('click', function() {
		$fileName.text($typeFileName.val());
		format($jsonText.val(), $show, 2);
	});
	
	$submit.on('click', function() {
		var fileName = $fileName.text();

		if (!fileName) {
			alert( '请输入文件名' );
			return;
		}
		
		$.ajax({
            method: 'POST',
            url: location.href + 'updateSD',
			data: {
                SDName: $fileName.text(),
                jsonStr: $show.text()
			},
            success: function(res) {
                console.log( res );
            },
            error: function(err) {
                alert(err);
            }
		});
	});

	$formatUrl.on('click', function() {

		if (!$jsonUrl.val()) {
			alert('请输入URL');
			return;
		}

		$.ajax({
			type: 'GET',
			url: $jsonUrl.val(),
			dataType: 'jsonp',
			success: function(res) {
				$fileName.text($jsonUrl.val());
				format(res, $show, 1);
			},
			error: function(err) {
				alert(err);
			}
		});
	});

	$reset.on('click', function() {
		window.location.reload();
	});
});

function format(jsonFile, container, type) {
	try {
		var input = eval('(' + (typeof jsonFile === 'string' ? jsonFile : JSON.stringify(jsonFile)) + ')');

		formatType = type;
	} catch (error) {
		return alert('JSON格式错误');
	}

	var options = {
		collapsed: false,
		withQuotes: false
	};
	container.jsonViewer(input, options);
}