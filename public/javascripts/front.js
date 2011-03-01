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
     duration: 333,
     easing: 'linear',
     queue: false
   }
  });

  // filter
$('#filter a').click(function(){
  var selector = $(this).attr('data-filter');
  $('#container').isotope({ filter: selector });
  return false;
	alert('go');

});

$(document).ready(function(){
	var jqxhr = $.ajax({ url: "./frontpage", dataType: "json"})
	    .success(function(data) {
		append= '';
		for (i in data)
		{
			append += '<div class="articles '+data[i][3]+'", data-score="'+data[i][1]+'", data-category="'+data[i][3]+'", id="'+data[i][4]+'"><div class="fit"><h2><a href="'+data[i][2]+'",class="title">'+data[i][0]+'</a></h2></div></div>'
		}
		var $append = $( append )
		$container.isotope({insert: $append, animationOptions: {
	     duration: 0,
	     easing: 'linear',
	     queue: false
	   }});
	})
	    .error(function() { alert("error: "+textStatus); })
});
