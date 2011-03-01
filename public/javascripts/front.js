$(function(){

  var $container = $('#container');

  $container.isotope({
    itemSelector : '.articles',
  animationOptions: {
     duration: 750,
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

});


$(window).load(function(){
	var jqxhr = $.ajax({ url: "./frontpage", dataType: "json"})
	    .success(function(data) {
		var append;
		for (item in data)
		{
			append += '<div class="articles '+data[item].channel+'", data-score='+item.score+', data-category='+item.channel+', id='+item.furl+'><h2><a href='+item.link+', class="title">'+item.title+'</a></h2></div>'
		}
		$('#container').append(append);
	})
	    .error(function() { alert("error: "+textStatus); })
	    //.complete(function() { $container.isotope('insert', append)});
});