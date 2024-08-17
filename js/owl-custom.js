$(document).ready(function () {
    $("#owl-example").owlCarousel({
        items: 3,
        lazyLoad: true,
        navigation: true,
        autoPlay: true,
        autoPlay: true,
		 navigationText: [
      "<i class='fa fa-angle-left fs5'></i>",
      "<i class='fa fa-angle-right fs5'></i>"
      ]
    });
	
	$("#owl-example-1").owlCarousel({
        items: 3,
        lazyLoad: true,
        navigation: true,
        autoPlay: true,
        autoPlay: true,
		 navigationText: [
      "<i class='fa fa-angle-left fs5'></i>",
      "<i class='fa fa-angle-right fs5'></i>"
      ]
    });
	
	$("#owl-example-2").owlCarousel({
        items: 3,
        lazyLoad: true,
        navigation: true,
        autoPlay: true,
        autoPlay: true,
		 navigationText: [
      "<i class='fa fa-angle-left fs5'></i>",
      "<i class='fa fa-angle-right fs5'></i>"
      ]
    });

	 $("#quick-past1").owlCarousel({
        items: 2,
        navigation: true,
        autoPlay: true
    });

	$("#quick-past2").owlCarousel({
        items: 2,
        navigation: true
    });

	$("#quick-past3").owlCarousel({
        items: 2,
        navigation: true,
        autoPlay: true
    });

	$("#quick-past4").owlCarousel({
        items: 2,
        navigation: true,
        autoPlay: true
    });



});
