jQuery(document).ready(function ($) {

    // variable
    'use strict';
    var Demo_options, $object, bt1, bt2, bt3, bt4, bt5, bt6, bt7, bt8, bt9;

    // object
    Demo_options = (function () {

        // constructor
        Demo_options = function Demo_options(a, b, c, d, e, f, g, h, i, j, k, l) {
            this.separator = a;
            this.ripple_effect = b;
            this.search_bar_hide = c;
            this.top_fixed = d;
            this.full_width = e;
            this.right_to_left = f;
            this.trigger = g;
            this.sticky_header = h;
            this.drop_down_effect_in_speed = i;
            this.drop_down_effect_out_speed = j;
            this.drop_down_effect_in_delay = k;
            this.drop_down_effect_out_delay = l;
        };

        // classes
        // options change
        Demo_options.prototype.options_change = function () {
            // menu options initialize
            $('.mash-menu').mashableMenu({
                separator                      : this.separator, //true,
                ripple_effect                  : this.ripple_effect, // true,
                search_bar_hide                : this.search_bar_hide, // false,
                top_fixed                      : this.top_fixed, // false,
                full_width                     : this.full_width, // false,
                right_to_left                  : this.right_to_left, // false,
                trigger                        : this.trigger, // 'click',
                /* DROP DOWN */
                drop_down_effect_in_speed      : this.drop_down_effect_in_speed, // 200,
                drop_down_effect_out_speed     : this.drop_down_effect_out_speed, // 200,
                drop_down_effect_in_delay      : this.drop_down_effect_in_delay, // 200,
                drop_down_effect_out_delay     : this.drop_down_effect_out_delay, // 200,
                /* STICKY HEADER */
                sticky_header                  : this.sticky_header, // false,
                /* INTERNAL LINKS */
                internal_links_enable          : true,
                internal_links_toggle_drop_down: true
            });
        };

        // color change
        Demo_options.prototype.menu_color_change = function (selector, color_name) {
            // variable
            var mashMenu = '.mash-menu';
            // click function
            $(selector).click(function () {
                // add active class
                $(this).siblings().removeClass('active');
                $(this).addClass('active');

                // data color change
                $(mashMenu).attr('data-color', color_name);
                // logo change according to color
                if (
                    $(mashMenu).attr('data-color') === 'cyan' ||
                    $(mashMenu).attr('data-color') === 'light-green' ||
                    $(mashMenu).attr('data-color') === 'lime' ||
                    $(mashMenu).attr('data-color') === 'yellow' ||
                    $(mashMenu).attr('data-color') === 'amber' ||
                    $(mashMenu).attr('data-color') === 'orange'
                ) {
                    $('.mash-brand').find('img').attr('src', 'images/logo-2.png');
                } else {
                    $('.mash-brand').find('img').attr('src', 'images/logo.png');
                }
            });
        };

        // return
        return Demo_options;
    }());

    // call object
    $object = new Demo_options();

    // call classes
    $object.options_change();

    //--------------------------------------- separator show or hide
    bt1 = false;
    $('#bt1').prop('checked', false).click(function () {
        if (bt1 === true) {
            $object.separator = true;
            $object.options_change();
            bt1 = false;
        } else {
            $object.separator = false;
            $object.options_change();
            bt1 = true;
        }
    });

    //--------------------------------------- ripple effect on or off
    bt2 = false;
    $('#bt2').prop('checked', false).click(function () {
        if (bt2 === true) {
            $('.mash-menu').removeClass('hideRippleEffect');
            $object.options_change();
            bt2 = false;
        } else {
            $('.mash-menu').addClass('hideRippleEffect');
            $object.options_change();
            bt2 = true;
        }
        console.log($object);
    });

    //----------------------------------------- search bar show or hide
    bt3 = false;
    $('#bt3').prop('checked', false).click(function () {
        if (bt3 === true) {
            $object.search_bar_hide = false;
            $object.options_change();
            bt3 = false;
        } else {
            $object.search_bar_hide = true;
            $object.options_change();
            bt3 = true;
        }
    });

    //----------------------------------------------- top fixed
    bt4 = false;
    $('#bt4').prop('checked', false).attr('disabled', false).click(function () {
        if (bt4 === true) {
            $object.top_fixed = false;
            $object.options_change();
            bt4 = false;
        } else {
            $object.top_fixed = true;
            $object.options_change();
            bt4 = true;
        }
    });

    //------------------------------------------------ full width
    bt5 = false;
    $('#bt5').prop('checked', false).click(function () {
        if (bt5 === true) {
            $object.full_width = false;
            $object.options_change();
            bt5 = false;
        } else {
            $object.full_width = true;
            $object.options_change();
            bt5 = true;
        }
    });

    //------------------------------------------------ right to left
    bt6 = false;
    $('#bt6').prop('checked', false).click(function () {
        if (bt6 === true) {
            $object.right_to_left = false;
            $object.options_change();
            bt6 = false;
        } else {
            $object.right_to_left = true;
            $object.options_change();
            bt6 = true;
        }
    });

    //------------------------------------------------ trigger click or hover
    bt7 = false;
    $('#bt7').prop('checked', false).click(function () {
        if (bt7 === true) {
            $object.trigger = 'hover';
            $object.options_change();
            bt7 = false;
        } else {
            $object.trigger = 'click';
            $object.options_change();
            bt7 = true;
        }
    });

    //--------------------------------------------------------- sticky header
    bt8 = false;
    $('#bt8').prop('checked', false).click(function () {
        if (bt8 === true) {
            $object.sticky_header = false;
            $object.options_change();
            $('body').css('height', '');
            $('#bt4').attr('disabled', false);
            bt8 = false;
        } else {
            $object.sticky_header = true;
            $object.options_change();
            $('body').css('height', '2000px');
            $('#bt4').attr('disabled', true);
            bt8 = true;
        }
    });

    //------------------------------------------------------------ image logo
    bt9 = true;
    $('#bt9').prop('checked', false).click(function () {
        if (bt9 === true) {
            $('.mash-brand').addClass('show');
            bt9 = false;
        } else {
            $('.mash-brand').removeClass('show');
            bt9 = true;
        }
    });

    // colors change
    $object.menu_color_change('#color-1', 'red');
    $object.menu_color_change('#color-2', 'pink');
    $object.menu_color_change('#color-3', 'purple');
    $object.menu_color_change('#color-4', 'deep-purple');
    $object.menu_color_change('#color-5', 'indigo');
    $object.menu_color_change('#color-6', 'cyan');
    $object.menu_color_change('#color-7', 'teal');
    $object.menu_color_change('#color-8', 'green');
    $object.menu_color_change('#color-9', 'light-green');
    $object.menu_color_change('#color-10', 'lime');
    $object.menu_color_change('#color-11', 'yellow');
    $object.menu_color_change('#color-12', 'amber');
    $object.menu_color_change('#color-13', 'orange');
    $object.menu_color_change('#color-14', 'deep-orange');
    $object.menu_color_change('#color-15', 'brown');
    $object.menu_color_change('#color-16', 'grey');
    $object.menu_color_change('#color-17', 'blue-grey');
    $object.menu_color_change('#color-18', 'black-gradient');
    $object.menu_color_change('#color-19', 'default');


    //------------------------------------------------------------------- range 1
    $('.range-1').change(function (get_value) {
        get_value = $(this).val();
        $('#r1').text(get_value);
        $object.drop_down_effect_in_speed = parseInt(get_value);
        $object.options_change();
    });

    //------------------------------------------------------------------- range 2
    $('.range-2').change(function (get_value) {
        get_value = $(this).val();
        $('#r2').text(get_value);
        $object.drop_down_effect_out_speed = parseInt(get_value);
        $object.options_change();
    });

    //------------------------------------------------------------------- range 3
    $('.range-3').change(function (get_value) {
        get_value = $(this).val();
        $('#r3').text(get_value);
        $object.drop_down_effect_in_delay = parseInt(get_value);
        $object.options_change();
    });

    //------------------------------------------------------------------- range 4
    $('.range-4').change(function (get_value) {
        get_value = $(this).val();
        $('#r4').text(get_value);
        $object.drop_down_effect_out_delay = parseInt(get_value);
        $object.options_change();
    });


});