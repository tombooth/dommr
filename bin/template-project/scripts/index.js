(function($, Backbone, Models, Views) {

   var App = Backbone.Router.extend({
      routes: {
         '.*': 'index'
      },

      index: function() {
          console.log("Index", arguments);
      }

   });

   window.app = new App();

   Backbone.history.start({ pushState: true });

})(jQuery, Backbone, Models, Views);
