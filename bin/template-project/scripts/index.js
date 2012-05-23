
(function($, _, Backbone, Models, Views) {

   var App = Backbone.Router.extend({
      routes: {
         '*': 'index'
      },

      index: function() { 
      }

   });

   window.app = new App();

   Backbone.history.start({ pushState: true });

})($, _, Backbone, Models, Views);
