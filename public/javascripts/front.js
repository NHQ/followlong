$(function(){

  var $container = $('#container');

  $container.isotope({
    itemSelector : '.articles',
  });

  // filter
$('#filter a').click(function(){
  var selector = $(this).attr('data-filter');
  $('#container').isotope({ filter: selector });
  return false;
});


});