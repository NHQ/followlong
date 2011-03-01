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
		for (i in data)
		{
			append += '<div class="articles '+data[i].channel+'", data-score='+data[i].score+', data-category='+data[i].channel+', id='+data[i].furl+'><h2><a href='+data[i].link+', class="title">'+data[i].title+'</a></h2></div>'
		}
		$('#container').append(append);
	})
	    .error(function() { alert("error: "+textStatus); })
	    //.complete(function() { $container.isotope('insert', append)});
});