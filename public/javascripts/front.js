$(function(){

  var $container = $('#container');

  $container.isotope({
    itemSelector : '.articles',
	layoutMode: 'fitRows',
	cellsByRow : {
	    columnWidth : 800,
		rowHeight: 100
	  },
  animationOptions: {
     duration: 0,
     easing: 'none',
     queue: true
   }
  });

  // filter
$('#filter a').click(function(){
  var selector = $(this).attr('data-filter');
  $('#container').isotope({ filter: selector });
	var dingo = [];
	$(selector, '#container').each(function(){
		dingo.push(parseInt($(this).attr('data-score')))
	});
	var score = Math.min.apply(null,dingo);
	alert(score);
	window.location.hash = selector.slice(1);
	//loaded(score, selector);
  return false;    
});

function loaded(score, selector){
	datum = {'score':score,'channel': selector.slice(1)};
	var jqxhr = $.getJSON('./load', datum, function(){})
	    .success(function(data) {
		append= '';
		for (i in data)
		{
			append += '<div class="articles '+data[i][3]+'", data-score="'+data[i][1]+'", data-category="'+data[i][3]+'", id="'+data[i][4]+'"><div class="fit"><h2><a href="'+data[i][2]+'",class="title">'+data[i][0]+'</a></h2></div></div>'
		}
		var $append = $( append )
		$container.isotope('insert', $append);
	})
	    .error(function(jqXHR, textStatus, errorThrown) { alert("error: "+errorThrown); })
};

$(window).load(function(){
hash = window.location.hash.slice(1);
$('#container').isotope({ filter: '.'+hash });
	
});
});
/*
function blum(score, selector){
	url = '/'+selector.slice(1)+'/'+score;
	alert(url);
	var lmnop = $.ajax({ url: url, dataType: "json"})
	    .success(function(data) {
		alert('success');
		append= '';
		for (i in data)
		{
			append += '<div class="articles '+data[i][3]+'", data-score="'+data[i][1]+'", data-category="'+data[i][3]+'", id="'+data[i][4]+'"><div class="fit"><h2><a href="'+data[i][2]+'",class="title">'+data[i][0]+'</a></h2></div></div>'
		}
		var $append = $( append )
		$container.isotope('appended', $append, function(){});
	})
	    .error(function() { alert("error: "+textStatus); })
};
*/



