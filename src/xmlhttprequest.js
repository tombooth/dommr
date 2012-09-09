
/**
 * A heavily modified version of:
 *
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: include("XMLHttpRequest.js") and use XMLHttpRequest per W3C specs.
 *
 * @todo SSL Support
 * @author Dan DeFelippi <dan@driverdan.com>
 * @contributor David Ellis <d.f.ellis@ieee.org>
 * @license MIT
 */

var Url = require('url'),
    http = require('http'),
    https = require('https'),
    events = require('events'),
    util = require('util'),
    zlib = require('zlib');




function XMLHttpRequest() {
   // Current state
   this.readyState = XMLHttpRequest.UNSENT;

   // default ready state change handler in case one is not set or is set late
   this.onreadystatechange = null;

   // Result & response
   this.response = null;
   this.responseText = "";
   this.responseXML = "";
   this.status = null;
   this.statusText = null;

   this.url = '';
}


util.inherits(XMLHttpRequest, events.EventEmitter);


XMLHttpRequest.UNSENT = 0;
XMLHttpRequest.OPENED = 1;
XMLHttpRequest.HEADERS_RECEIVED = 2;
XMLHttpRequest.LOADING = 3;
XMLHttpRequest.DONE = 4;

XMLHttpRequest.default_headers = {
   "User-Agent": "node.js",
   "Accept": "*/*",
};



      
/**
 * Open the connection. Currently supports local server requests.
 *
 * @param string method Connection method (eg GET, POST)
 * @param string url URL for the connection.
 * @param boolean async Asynchronous connection. Default is true.
 * @param string user Username for basic authentication (optional)
 * @param string password Password for basic authentication (optional)
 */
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
   settings = {
      "method": method,
      "url": url,
      "async": async || null,
      "user": user || null,
      "password": password || null
   };

   this.url = url;
   
   this.abort();

   this._set_state(XMLHttpRequest.OPENED);
};

/**
 * Sets a header for the request.
 *
 * @param string header Header name
 * @param string value Header value
 */
XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
   this.headers[header] = value;
};

/**
 * Gets a header from the server response.
 *
 * @param string header Name of header to get.
 * @return string Text of the header or null if it doesn't exist.
 */
XMLHttpRequest.prototype.getResponseHeader = function(header) {
   if (this.readyState > XMLHttpRequest.OPENED && this.response.headers[header]) {
      return header + ": " + this.response.headers[header];
   }
   
   return null;
};

/**
 * Gets all the response headers.
 *
 * @return string 
 */
XMLHttpRequest.prototype.getAllResponseHeaders = function() {
   if (this.readyState < XMLHttpRequest.HEADERS_RECEIVED) {
      throw "INVALID_STATE_ERR: Headers have not been received.";
   }
   var result = "";
   
   for (var i in this.response.headers) {
      result += i + ": " + this.response.headers[i] + "\r\n";
   }
   return result.substr(0, result.length - 2);
};

/**
 * Sends the request to the server.
 *
 * @param string data Optional data to send as request body.
 */
XMLHttpRequest.prototype.send = function(data) {
   if (this.readyState != XMLHttpRequest.OPENED) {
      throw "INVALID_STATE_ERR: connection must be opened before send() is called";
   }
   
   var ssl = false;
   var url = Url.parse(settings.url);
   
   // Determine the server
   switch (url.protocol) {
      case 'https:':
         ssl = true;
         // SSL & non-SSL both need host, no break here.
      case 'http:':
         var host = url.hostname;
         break;
      
      case undefined:
      case '':
         var host = "localhost";
         break;
      
      default:
         throw "Protocol not supported.";
   }

   // Default to port 80. If accessing localhost on another port be sure
   // to use http://localhost:port/path
   var port = url.port || (ssl ? 443 : 80);
   // Add query string if one is used
   var uri = url.pathname + (url.search ? url.search : '');
   
   // Set the Host header or the server may reject the request
   this.setRequestHeader("Host", host);

   // Set Basic Auth if necessary
   if (settings.user) {
      if (typeof settings.password == "undefined") {
         settings.password = "";
      }
      var authBuf = new Buffer(settings.user + ":" + settings.password);
      this.headers["Authorization"] = "Basic " + authBuf.toString("base64");
   }
   
   // Set content length header
   if (settings.method == "GET" || settings.method == "HEAD") {
      data = null;
   } else if (data) {
      this.setRequestHeader("Content-Length", Buffer.byteLength(data));
      
      if (!this.headers["Content-Type"]) {
         this.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
      }
   }

   var options = {
      host: host,
      port: port,
      path: uri,
      method: settings.method,
      headers: this.headers
   };

   if(!settings.hasOwnProperty("async") || settings.async) { //Normal async path
      // Use the proper protocol
      var doRequest = ssl ? https.request : http.request;

      var req = doRequest(options, (function(response) {
         var stream;

         this._set_state(XMLHttpRequest.HEADERS_RECEIVED);
         this.status = response.statusCode;
         this.response = response;
         
         switch (response.headers['content-encoding']) {
            case 'gzip':
              stream = response.pipe(zlib.createGunzip());
              break;
            case 'deflate':
              stream = response.pipe(zlib.createInflate());
              break;
            default:
              stream = response;
              break;
         }

         stream.on('data', (function(chunk) {
            // Make sure there's some data
            if (chunk) {
               this.responseText += chunk.toString('utf8');;
            }

            this._set_state(XMLHttpRequest.LOADING);
         }).bind(this));
         
         stream.on('end', (function() {
            this._set_state(XMLHttpRequest.DONE);
         }).bind(this));
         
         stream.on('error', (function(error) {
            this.handleError(error);
         }).bind(this));
      }).bind(this)).on('error', (function(error) {
         this.handleError(error);
      }).bind(this));
      
      // Node 0.4 and later won't accept empty data. Make sure it's needed.
      if (data) {
         req.write(data);
      }

      req.end();
   } else {
      console.error("Cannot run a synchronos xhr on the server");
   }
};

XMLHttpRequest.prototype.handleError = function(error) {
   this.status = 503;
   this.statusText = error;
   this.responseText = error.stack;
   this._set_state(this.DONE);
};

/**
 * Aborts a request.
 */
XMLHttpRequest.prototype.abort = function() {
   this.headers = {  };
   this.readyState = this.UNSENT;
   this.responseText = "";
   this.responseXML = "";
   this.response = null;
};


XMLHttpRequest.prototype._set_state = function(state) {
   this.readyState = state;
   if (typeof this.onreadystatechange === "function") {
      this.onreadystatechange();
   }
   this._report(this, state);
};


XMLHttpRequest.prototype._report = function(xhr, state) {
   switch (state) {
      case 1: // xhr opened
         console.log('+ ' + xhr.url);

         this.emit('working');

         break;

      case 4: // xhr done
         console.log('- ' + xhr.url);

         this.emit('done');

         break;
   }
}

XMLHttpRequest.prototype.withCredentials = true;


module.exports = XMLHttpRequest;
