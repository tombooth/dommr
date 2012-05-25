(function() {

   /**
    * @constructor
    * @param {Number} request_id The id of the request
    * @param {HttpRequest} http_request
    * @param {HttpResponse} http_response
    * @param {window} window The window
    */
   function Request(request_id, http_request, http_response, window) {
      this.id = request_id;
      this.http_request = http_request;
      this.http_response = http_response;
      this.window = window;
      this.scripts_executing = true;
   }

   /**
    * @type {Number}
    */
   Request.prototype.id = null;

   /**
    * @type {HttpRequest}
    */
   Request.prototype.http_request = null;

   /**
    * @type {HttpResponse}
    */
   Request.prototype.http_response = null;

   /**
    *
    */
   Request.prototype.window = null;

   /**
    * @type {Boolean}
    */
   Request.prototype.scripts_executing = null;

   Request.prototype.timeout_id = null;

   Request.prototype.send_html = function(html_content) {
      var response = this.http_response;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Content-Length', html_content.length);
      // TODO: Also change the status code when used by request_internal_error?
      response.end(html_content, 'utf8');
   };

   Request.prototype.setFetchAndProcessScripts = function(shouldFetch) {
      var implementation = this.window.document.implementation;
      if (shouldFetch) {
         implementation.addFeature('FetchExternalResources', 'script');
         implementation.addFeature('ProcessExternalResources', 'script');
      } else {
         implementation.removeFeature('FetchExternalResources');
         implementation.removeFeature('ProcessExternalResources');
      }
   };

   module.exports = Request;

})();