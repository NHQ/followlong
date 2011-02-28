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
		$('#container').html(JSON.stringify(data)).css('color', 'green')
	})
	    .error(function() { alert("error: "+textStatus); })
	    .complete(function() { alert("complete"); });
});