$(function(){

  var $container = $('#container');

  $container.isotope({
    itemSelector : '.articles',
    getSortData : {
      symbol : function( $elem ) {
        return $elem.attr('data-category');
      }
	  score : function( $elem ) {
		return $elem.attr('data-score')
	  }
    },
  });

  // sorting
  $('#sort a').click(function(){
    // get href attribute, minus the #
    var $this = $(this),
        sortName = $this.attr('href').slice(1),
        //asc = $this.parents('.sort').hasClass('asc');
    $container.isotope({ 
      sortBy : symbol,
      //sortAscending : asc
    });
    return false;
  });


});