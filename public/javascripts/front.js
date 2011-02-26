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

$('div.articles').bind('click', function(event){
	$(this).find('div.summary').css('display', 'block');
});

$('admin a', function(event){
	$ajax.({
		type:"POST",
		url:"/delete/item",
		
	})
})

});