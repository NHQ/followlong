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
});

$(document).ready(function(){
		$.get('/frontpage', function(data){
			var $append;
			for (d in data)
			{
				append += '<div class="articles "+'d.channel+', data-category='+d.channel+', data-score='+d.score+', id='+d.furl+'><h2><a href='d.link+', class="title">'+d.title+'</a></h2></div>'
			}
		});
			alert($append);
			$('#container').isotope('insert', $append)	
	})
	
})


});