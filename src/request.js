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
      this.start = new Date();
   }

   /**
    * The time when the request was created.
    * @type {Date}
    */
   Request.prototype.start = null;

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

   /**
    * Sends html content to the client
    * @param {String} html_content The content to send as HTML
    * @param {Number} [status_code=200] The HTTP status code
    */
   Request.prototype.send_html = function(html_content, status_code) {
      var response = this.http_response, headers;

      headers = {
         'Content-Type': 'text/html; charset=utf-8',
         'Content-Length': html_content.length
      };

      response.send(html_content, status_code || 200);
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

   /**
    * @return {Number} The amount of time in millis it has been since the request was created
    */
   Request.prototype.get_total_time = function() {
      return (+ new Date()) - this.start;
   };

   module.exports = Request;

})();