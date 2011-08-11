$(function(){

  var $container = $('#console');

  $container.isotope({
    getSortData:{
      number : function ( $elem ) {
    return parseInt( $elem.attr('data-score'));
  },
    
    },
    itemSelector : '.articles',
	layoutMode: 'fitRows',
	cellsByRow : {
	    columnWidth : 800,
		rowHeight: 100
	  },
  animationOptions: {
     duration: 333,
     easing: 'linear',
     queue: false
   }
  });
  $('#console').isotope({ sortBy : 'number', sortAscending : false });
                     $('.channel a').live('click', function(e){
                        e.preventDefault();
                        var selector = $(this).attr('data-filter');
                        console.log($(this).attr('data-filter'));
                        $('#console').isotope({ filter: selector });   
                      });
})
/*
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



