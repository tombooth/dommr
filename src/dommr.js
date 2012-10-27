(function() {

   var fs = require('fs'),
       path = require('path'),
       jsdom = require('jsdom'),
       uuid = require('node-uuid'),
       Template = require('./template.js'),
       Script = require('./script.js'),
       Request = require('./request.js'),
       EventEmitter = require('events').EventEmitter,
       XMLHttpRequest = require('./xmlhttprequest');

   /**
    * Sets options, creates a template from the path
    * @constructor
    * @param {String} path The file path for the template
    * @param {Object} options
    */
   function dommr(path, options) {
      options = options || { };

      this._extension_timeout = options.extension_timeout || 0;
      this._mount_path = options.mount_path || '/__dommr';
      this._mounted_regex = new RegExp(this._mount_path + '/(.+)');

      this._intercepts = [
         { regex: /\/script\/([a-zA-Z0-9]+)/, fn: this._serve_script.bind(this) }
      ];

      this._registered_extensions = [ 'scripts' ];
      this._active_extensions = { };
      this._inactive_extensions = { };

      this._active_requests = { };
      this._pre_exec = [ ];
      this._post_exec = [ ];

      this._template = new Template(path, this._mount_path);
      this._template.on('scripts:pre', this.emit.bind(this, 'template:scripts:pre'));
      this._template.on('scripts:post', this.emit.bind(this, 'template:scripts:post'));

   }

   require('util').inherits(dommr, EventEmitter);


   // TODO: Include these included extensions as properties on the main constructor

   dommr.Session = require('./session/provider.js');

   dommr.Template = require('./template/provider.js');


   dommr.prototype._active_requests = null;

   dommr.prototype._registered_extensions = null;

   dommr.prototype._active_extensions = null;

   dommr.prototype._inactive_extensions = null;

   /**
    *
    * @type {Number} default = 0
    */
   dommr.prototype._extension_timeout = null;

   /**
    *
    * @type {String} default = "/__dommr"
    */
   dommr.prototype._mount_path = null;

   /**
    * A regular expression to match all incoming request urls. All
    * urls must match this expression in order to be handled by
    * the dommr intercepts. Otherwise they are served as usual.
    * @type {RegExp}
    */
   dommr.prototype._mounted_regex = null;

   /**
    *
    * @type {Template}
    */
   dommr.prototype._template = null;

   dommr.prototype._intercepts = null;

   /**
    * Registers an extension
    * // TODO: How/Where is this used?
    * @param {Object} extension
    */
   dommr.prototype.register = function(extension) {

      if (!extension.register) {
         throw new Error('Not a valid dommr extention');
      }

      extension.register(this, this._mount_path);
      extension.on('working', this._extension_working.bind(this, extension));
      extension.on('done', this._extension_done.bind(this, extension));
      extension.on('error', this._extension_error.bind(this, extension));

      this._registered_extensions.push(extension);

      return this;

   };

   /**
    * Registers an intercept, which is a function that is called when
    * the supplied regular expression matches an incoming url.
    *
    * @param {RegExp} regex A regular expression that should match a particular url pattern
    * @param {Function} fn A function to execute if the regular expression matches the url
    */
   dommr.prototype.register_intercept = function(regex, fn) {
      this._intercepts.push({
         regex: regex,
         fn: fn
      });
   };

   /**
    * Initialises dommr by loading the template and returning a "servlet" function
    * to process requests.
    *
    * If the incoming request url matches the mounted regex the function looks over
    * the registered intercepts and runs any that match the incoming url.
    *
    * Otherwise the function calls the process_request method
    * @returns {Function} The dommr middleware "servlet" function
    */
   dommr.prototype.middleware = function() {

      console.log('Dommr: Loading app...');

      this._template.load().watch();

      console.log('Dommr: Done Loading app\n');

      return (function(request, response, next) {
         var url = request.url,
             mounted_path_match = this._mounted_regex.exec(url),
             mounted_path = (mounted_path_match) ? mounted_path_match[1] : null,
             intercepts = this._intercepts,
             match, intercept, served = false;

         if (mounted_path) {

            for (var i = 0, len = intercepts.length; i < len && !served; i++) {
               intercept = intercepts[i];
               match = intercept.regex.exec(request.url);

               if (match) {
                  console.log('Dommr: serving', intercept);
                  served = intercept.fn(match, request, response);
               }
            }

            // return the value of the first matching intercept that could respond
            if (!served) {
               response.end();
            }

         } else {
            this._process_request(request, response);
         }

      }).bind(this);

   };

   /**
    * Processes a request for any url that does not match mounted_regex.
    * @param http_request
    * @param http_response
    */
   dommr.prototype._process_request = function(http_request, http_response) {
      var request_id = uuid(), // Generates a RFC4122 v1 (timestamp-based) UUID.
          that = this,
          data;

      dommr.log(request_id, 'Request starting: ' + http_request.url);

      //make the inactive extensions a copy of the registered extensions
      this._inactive_extensions[request_id] = this._registered_extensions.slice(0);
      this._active_extensions[request_id] = [ ];

      http_request.on('data', function(d) {
         data = (data) ? data + d : d;
      });
      http_request.on('end', function() {

         /*
          * Create the window object and augment global object
          */
         var window = that._template.create_window();

         that._add_timing(request_id, window);
         that._add_script_loading(request_id, window);

         window.console = console;
         // todo: move this into a utility class?
         window.location = that._build_location(http_request, data);
         window.navigator = that._build_navigator(http_request);

         window.history = {
            // don't want to move about history on the server but backbone needs it to exist
            pushState: function() {}
         };

         window.XMLHttpRequest = function() {

            var xmlhttprequest = new XMLHttpRequest(request_id);

            that._inactive_extensions[request_id].push(xmlhttprequest._id);

            xmlhttprequest.once('working', that._extension_working.bind(that));
            xmlhttprequest.once('done', that._extension_done.bind(that));

            return xmlhttprequest;

         };

         // TODO: This should be in its own object so it could have
         // send methods build in as functions which would be tidier.
         var request_obj = that._active_requests[request_id] = new Request(
             request_id,
             http_request,
             http_response,
             window
             );

         that._exec_chain(that._pre_exec, [request_obj], function() {
            dommr.log(request_id, 'Starting execution...');
            that._extension_working('scripts', request_id);
            that._execute_scripts(request_id, window);
         });

      });
   };

   /**
    * Moves an extension out from the inactive list and puts it into the active list
    * @param {Object|String} extension The extension object
    * @param {Number} request_id The id of the request
    */
   dommr.prototype._extension_working = function(extension, request_id) {
      var index = this._inactive_extensions[request_id].indexOf(extension);

      if (index >= 0) {
         dommr.log(request_id, ((extension.substr) ? extension : extension.constructor.name) + ' is working');
         this._inactive_extensions[request_id].splice(index, 1);
      }

      this._active_extensions[request_id].push(extension);
   };

   dommr.prototype._extension_done = function(extension, request_id) {

      var active_extension = this._active_extensions[request_id],
          index = active_extension.indexOf(extension);

      if (index >= 0) {
         active_extension.splice(index, 1);
         this._inactive_extensions[request_id].push(extension);

         dommr.log(request_id, ((extension.substr) ? extension : extension.constructor.name) + ' is done');

         if (!this._active_requests[request_id].scripts_executing && active_extension.length === 0) {
            this._request_complete(request_id);
         }
      }

   };

   dommr.prototype._extension_error = function(extension, id, error) {
      this._request_internal_error(id, error);
   };

   /**
    * An array of functions
    * @type {Function[]}
    */
   dommr.prototype._pre_exec = null;

   /**
    * An array of functions
    * @type {Function[]}
    */
   dommr.prototype._post_exec = null;

   dommr.prototype._exec_chain = function(arr, args, done) {
      var fns_to_go = arr.length;

      if (arr.length === 0) {
         done();
      }

      args.push(function() {
         if (--fns_to_go === 0) {
            done();
         }
      });

      for (var i = 0, l = arr.length; i < l; i++) {
         arr[i].apply(this, args);
      }
   };

   dommr.prototype.register_pre_exec = function(fn) {
      this._pre_exec.push(fn);
   };

   dommr.prototype.register_post_exec = function(fn) {
      this._post_exec.push(fn);
   };

   /**
    *
    * @param {Number} request_id The uuid for the request
    */
   dommr.prototype._request_complete = function(request_id) {
      var request_obj = this._active_requests[request_id],
          window = request_obj.window;

      request_obj.setFetchAndProcessScripts(false);

      // if we have a timeout on the extensions then stop it from
      // executing after the request has been completed
      if (request_obj.timeout_id) {
         clearTimeout(request_obj.timeout_id);
      }

      dommr.log(request_id, 'Finished execution');

      this._exec_chain(this._post_exec, [request_obj], (function() {
         this._serve_html(request_obj, window.document.innerHTML, 200);
         dommr.log(request_id, 'Request completed');
      }).bind(this));

   };


   /**
    * Called when an extension has an error. Sends an error response.
    * @param {Number} id The uuid for the request
    * @param {Error} error The error that was thrown
    */
   dommr.prototype._request_internal_error = function(id, error) {

      var request_obj = this._active_requests[id];

      // if we have a timeout on the extensions then stop it from
      // executing after the request has been completed
      if (request_obj.timeout_id) {
         clearTimeout(request_obj.timeout_id);
      }

      // TODO: _error_template_html is not defined
      this._serve_html(request_obj, this._error_template_html.replace('{{error_message}}', error.toString()), 500);

      dommr.log(id, "Request completed with an error");

   };

   dommr.log = function(id, message) {
      console.log('Dommr: [' + id + '][' + new Date() + ']', message);
   };


   /**
    * Pushes HTML content as the response to a given request
    * then removes the request from the active requests array.
    * @param {Request} request_obj A request object
    * @param {String} html_content The HTML content
    * @param {Number} response_status The HTTP response status
    */
   dommr.prototype._serve_html = function(request_obj, html_content, response_status) {

      request_obj.send_html(html_content, response_status);
      request_obj.window.close();

      dommr.log(request_obj.id, "Request sent. Total time=" + request_obj.get_total_time());

      delete this._active_requests[request_obj.id];
      delete this._active_extensions[request_obj.id];
      delete this._inactive_extensions[request_obj.id];

   };


   /**
    * Pushes a script as the response to a given request
    * @param match
    * @param {HttpRequest} http_request
    * @param {HttpResponse} http_response
    * @return {Boolean} If the template had a script that matches the match
    */
   dommr.prototype._serve_script = function(match, http_request, http_response) {

      var script = this._template.scripts[match[1]];

      if (script && script.source) {
         http_response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
         http_response.end(script.source, 'utf8');
      }

      return !!script;

   };


   /**
    * Executes all the scripts on the template.
    * @param {Number} request_id The request UUID
    * @param window
    */
   dommr.prototype._execute_scripts = function(request_id, window) {
      var scripts = this._template.server_scripts,
          request_obj = this._active_requests[request_id];

      request_obj.setFetchAndProcessScripts(true);

      setTimeout(this._execute_script.bind(this, request_obj, window, scripts, 0), 0);
   };


   /**
    * Executes an array of scripts, one after the other
    * @param {Object} request_obj The request object (see creation in dommr._process_request)
    * @param window
    * @param {Script[]} scripts An array of scripts
    * @param {Number} index The index of the script to run
    */
   dommr.prototype._execute_script = function(request_obj, window, scripts, index) {

      if (index >= scripts.length) {

         request_obj.scripts_executing = false;

         dommr.log(request_obj.id, 'Finished executing inline scripts');

         // as the scripts have finished executing we will given the extensions a timeout
         // (in defined) until they will be aborted and the request completed
         if (this._extension_timeout) {
            console.log('[' + request_obj.id + '] starting extension timeout for ' + this._extension_timeout + 'ms');
            request_obj.timeout_id = setTimeout(this.emit.bind(this, 'request:timeout', request_obj.id), this._extension_timeout);
         }

         this._extension_done('scripts', request_obj.id);

      } else {

         try {

            window.run(scripts[index].source, scripts[index].path);

            setTimeout(this._execute_script.bind(this, request_obj, window, scripts, index + 1), 0);

         } catch(ex) {
            this._request_script_error(request_obj, ex, scripts[index]);
         }
      }
   };

   /**
    * Prints out a stacktrace and context of a script that had an error
    * @param {Request} request_obj The request object
    * @param {Error} error
    * @param {Script} script The script that was being run
    */
   dommr.prototype._request_script_error = function(request_obj, error, script) {
      var line_match = +/:([0-9]+):[0-9]+/.exec(error.stack),
         // TODO: This gets the line number for the first item on the stack, which isn't necessarily the same
         // as that in the script (which might be further down the stack trace)
          line_num = (line_match && line_match.length >= 2) ? line_match[1] : 0,
          lines = script.source.split('\n'),
          context_lines = [];

      // print out the context around a given line
      for (var i = line_num - 3; i <= line_num + 2; i++) {
         if (i >= 0 && i < lines.length) {
            context_lines.push(i + ': ' + lines[i]);
         }
      }

      var error_html = '<h1>Script Error</h1><p>An error occurred on line ' + line_num + ' of ' + script.path + '</p>';
      error_html += '<pre>' + context_lines.join('\n') + '\n\n' + error.stack + '</pre>';

      this._serve_html(request_obj, error_html, 500);
   };


   dommr.prototype._build_location = function(http_request, data) {
      var url = http_request.url,
          location = new String("http://" + http_request.headers.host + url);

      location.hash = '';  // need to address
      location.host = http_request.headers.host;
      location.href = "http://" + http_request.headers.host + url;
      location.pathname = url;
      location.protocol = 'http:';

      if (url.indexOf("?") > -1) {
         location.search = url.substring(url.indexOf("?"));
      } else {
         location.search = "";
      }

      var split_host = http_request.headers.host.split(':');
      location.hostname = split_host[0];
      location.port = split_host[1];

      // extra properties
      location.method = http_request.method.toUpperCase();

      if (http_request.headers['content-type'] == 'application/x-www-form-urlencoded' && data) {
         var params = data.toString('utf8'), match;

         location.form = { };

         while (match = /([a-zA-z0-9]+)=([a-zA-Z0-9]+)/.exec(params)) {
            location.form[match[1]] = match[2];

            params = params.substr(match.index + match[0].length);
         }
      }

      return location;
   };

   /**
    * Builds a simple navigator
    * @param request
    */
   dommr.prototype._build_navigator = function(request) {
      var navigator = { };

      navigator.server = true;
      navigator.userAgent = 'WebKit/1.0';

      return navigator;
   };

   /**
    * Augments the standard window timeout and interval features
    * to hook into the extensions.
    * @param request_id
    * @param window
    */
   dommr.prototype._add_timing = function(request_id, window) {

      var running_timeouts = [ ],
          running_intervals = [ ],
          that = this;

      window.setTimeout = function(fn, timeout) {
         var timeout_id,
             id = 'timeout:' + uuid();

         that._inactive_extensions[request_id].push(id);
         that._extension_working(id, request_id);

         timeout_id = setTimeout(function() {
            fn.apply(window, arguments);
            that._extension_done(id, request_id);
         }, timeout);

         running_timeouts[id] = timeout_id;

         return id;
      };

      window.clearTimeout = function(id) {
         var timeout_id = running_timeouts[id];

         if (timeout_id) {
            clearTimeout(timeout_id);

            that._extension_done(id, request_id);
         }
      };

      window.setInterval = function(fn, interval) {
         var interval_id,
             id = 'interval:' + uuid();

         that._inactive_extensions[request_id].push(id);
         that._extension_working(id, request_id);

         interval_id = setInterval(function() {
            fn.apply(window, arguments);
         }, interval);

         running_intervals[id] = interval_id;

         return id;
      };

      window.clearInterval = function(id) {
         var interval_id = running_intervals[id];

         if (interval_id) {
            clearInterval(interval_id);

            that._extension_done(id, request_id);
         }
      };

   };


   dommr.prototype._add_script_loading = function(request_id, window) {

      var that = this;

      window.document.addEventListener('DOMNodeInserted', function(ev) {
         var elem = ev.target,
             id;

         if (elem.nodeName === 'SCRIPT') {
            id = 'script' + uuid();
            that._inactive_extensions[request_id].push(id);
            that._extension_working(id, request_id);

            elem.addEventListener('load', function(ev) {
               that._extension_done(id, request_id);
            });
         }
      });

   };

   module.exports = dommr;

})();
