var fs = require('fs'),
    path = require('path'),
    jsdom = require('jsdom'),
    uuid = require('node-uuid'),
    Template = require('./template.js'),
    Script = require('./script.js'),
    XMLHttpRequest = require('./xmlhttprequest');



function dommr(path, options) {
   options = options || { };

   this._extension_timeout = options.extension_timeout || 0;
   this._mount_path = options.mount_path || '/__dommr';

   this._mounted_regex = new RegExp(this._mount_path + '/(.+)');
   this._template = new Template(path, this._mount_path);
   this._intercepts = [ { regex: /\/script\/([a-zA-Z0-9]+)/, fn: this._serve_script.bind(this) } ];
   this._registered_extensions = [ 'scripts' ];
   this._active_extensions = { };
   this._inactive_extensions = { };
   this._active_requests = { };
   this._pre_exec = [ ];
   this._post_exec = [ ];

   this._template.on('scripts:pre', this.emit.bind(this, 'template:scripts:pre'));
   this._template.on('scripts:post', this.emit.bind(this, 'template:scripts:post'));
}


require('util').inherits(dommr, require('events').EventEmitter);


// Include the included extensions as properties on the
// main constructor

dommr.Session = require('./session/provider.js');

dommr.Template = require('./template/provider.js');


dommr.prototype._active_requests = null;

dommr.prototype._registered_extensions = null;

dommr.prototype._active_extensions = null;

dommr.prototype._inactive_extensions = null;

dommr.prototype._extension_timeout = null;

dommr.prototype._mount_path = null;

dommr.prototype._mounted_regex = null;

dommr.prototype._template = null;

dommr.prototype._intercepts = null;



dommr.prototype.register = function(extension) {

   if (!extension.register) throw new Error('Not a valid dommr extention');

   extension.register(this, this._mount_path);
   extension.on('working', this._extension_working.bind(this, extension));
   extension.on('done', this._extension_done.bind(this, extension));
   extension.on('error', this._extension_error.bind(this, extension));

   this._registered_extensions.push(extension);

   return this;

};

dommr.prototype.register_intercept = function(regex, fn) {
   this._intercepts.push({ regex: regex, fn: fn });
};

dommr.prototype.middleware = function() {

   console.log('Loading app...');

   this._template.load().watch();

   console.log('Done.\n');

   return (function(req, res, next) {
      var url = req.url,
          mounted_path_match = this._mounted_regex.exec(url),
          mounted_path = (mounted_path_match) ? mounted_path_match[1] : null,
          intercepts = this._intercepts,
          match, intercept, served = false;

      if (mounted_path) {
         for (var i = 0, len = intercepts.length; i < len && !served; i++) {
            intercept = intercepts[i];
            match = intercept.regex.exec(req.url);

            if (match) {
               console.log('serving', intercept);
               served = intercept.fn(match, req, res);
            }
         }

         if (!served) res.end();

      } else {
         this._process_request(req, res);
      }

   }).bind(this);

};





dommr.prototype._extension_working = function(extension, id) {
   var index = this._inactive_extensions[id].indexOf(extension);

   if (index >= 0) {
      console.log('[' + id + '] ' + ((extension.substr) ? extension : extension.constructor.name) + ' is working');
      this._inactive_extensions[id].splice(index, 1);
   }

   this._active_extensions[id].push(extension);
};

dommr.prototype._extension_done = function(extension, id) {
   var index = this._active_extensions[id].indexOf(extension);

   if (index >= 0) {
      this._active_extensions[id].splice(index, 1);
   } 

   index = this._active_extensions[id].indexOf(extension);

   if (index < 0) {
      console.log('[' + id + '] ' + ((extension.substr) ? extension : extension.constructor.name) + ' is done');
      this._inactive_extensions[id].push(extension);
   }

   if (!this._active_requests[id].scripts_executing && 
         this._active_extensions[id].length === 0) this._request_complete(id);
};

dommr.prototype._extension_error = function(extension, id, error) {
   this._request_internal_error(id, error);
};








dommr.prototype._process_request = function(request, response) {
   var id = uuid(), 
       that = this,
       data;

   console.log('[' + id +'] request starting: ' + request.url);
   
   this._inactive_extensions[id] = this._registered_extensions.slice(0);
   this._active_extensions[id] = [ ];

   request.on('data', function(d) { data = (data) ? data + d : d; });
   request.on('end', function() {

      /*
       * Create the window object and augment global object
       */
      var window = that._template.create_window();

      that._add_timing(id, window);
      that._add_script_loading(id, window);

      window.console = console;
      window.location = that._build_location(request, data);
      window.navigator = that._build_navigator(request);
      window.history = { pushState: function() { } };

      window.XMLHttpRequest = function() {

         var xmlhttprequest = new XMLHttpRequest();

         xmlhttprequest.once('working', that._extension_working.bind(that, xmlhttprequest, id));
         xmlhttprequest.once('done', that._extension_done.bind(that, xmlhttprequest, id));

         return xmlhttprequest;

      };

      var d_request = that._active_requests[id] = {
         id: id,
         request: request,
         response: response,
         window: window,
         scripts_executing: true
      };

      that._exec_chain(that._pre_exec, [d_request], function() {
         console.log('[' + id + '] starting execution...');

         that._extension_working('scripts', id);
         that._execute_scripts(id, window);
      });

   });
};

dommr.prototype._pre_exec = null;
dommr.prototype._post_exec = null;

dommr.prototype._exec_chain = function(arr, args, done) {
   var fns_to_go = arr.length;

   if (arr.length === 0) done();

   args.push(function() {
      if (--fns_to_go === 0) done();
   });

   for (var i = 0, l = arr.length; i < l; i++) {
      arr[i].apply(this, args);
   }
};

dommr.prototype.register_pre_exec = function(fn) { this._pre_exec.push(fn); }; 
dommr.prototype.register_post_exec = function(fn) { this._post_exec.push(fn); }; 






dommr.prototype._request_complete = function(id) {
   var request = this._active_requests[id],
       window = request.window;

   window.document.implementation.removeFeature('FetchExternalResources');
   window.document.implementation.removeFeature('ProcessExternalResources');

   // if we have a timeout on the extensions then stop it from
   // executing after the request has been completed
   if (request.timeout_id) clearTimeout(request.timeout_id);

   console.log('[' + id + '] finished execution');

   this._exec_chain(this._post_exec, [request], (function() {
      this._request_send(id, window.document.innerHTML);

      console.log('[' + id + '] request completed');
   }).bind(this));
   
};



dommr.prototype._request_internal_error = function(id, error) {

   // if we have a timeout on the extensions then stop it from
   // executing after the request has been completed
   if (request.timeout_id) clearTimeout(request.timeout_id);

   this._request_send(id, this._error_template_html.replace('{{error_message}}', error.toString()));

   console.log('[' + id + '] request completed with an error');

};


dommr.prototype._request_script_error = function(id, exception, script) {
   console.log(exception);
   var line_match = +/:([0-9]+):[0-9]+/.exec(exception.stack),
       line_num = (line_match && line_match.length >= 2) ? line_match[1] : 0,
       lines = script.source.split('\n'),
       context_lines = [];

   for (var i = line_num - 3; i <= line_num + 2; i++) {
      if (i < 0 || i > lines.length) continue;
      else {
         context_lines.push(i + ': ' + lines[i]);
      }
   }

   this._request_send(id, '<pre>' + context_lines.join('\n') + '\n\n' + exception.stack + '</pre>');
};


dommr.prototype._request_send = function(id, content) {
   var request = this._active_requests[id],
       response = request.response;

   response.setHeader('Content-Type', 'text/html; charset=utf-8');
   response.setHeader('Content-Length', content.length);
   response.end(content, 'utf8');

   request.window.close();

   console.log('[' + id + '] request sent');

   delete this._active_requests[id];
   delete this._active_extensions[id];
   delete this._inactive_extensions[id];
};






dommr.prototype._execute_scripts = function(id, window) {
   var scripts = this._template.server_scripts;

   window.document.implementation.addFeature('FetchExternalResources', 'script');
   window.document.implementation.addFeature('ProcessExternalResources', 'script');

   setTimeout(this._execute_script.bind(this, id, window, scripts, 0), 0);
};


dommr.prototype._execute_script = function(id, window, scripts, index) {

   if (index >= scripts.length) { 

      this._active_requests[id].scripts_executing = false;

      console.log('[' + id + '] finished executing inline scripts');

      // as the scripts have finished executing we will given the extensions a timeout
      // (in defined) until they will be aborted and the request completed
      if (this._extension_timeout) {
         console.log('[' + id + '] starting extension timeout for ' + this._extension_timeout + 'ms');

         this._active_requests[id].timeout_id = 
            setTimeout(this.emit.bind(this, 'request:timeout', id), this._extension_timeout);
      }
      
      this._extension_done('scripts', id);

   } else {

      try {

         window.run(scripts[index].source, scripts[index].path);

         setTimeout(this._execute_script.bind(this, id, window, scripts, index + 1), 0);

      } catch(ex) {
         this._request_script_error(id, ex, scripts[index]);
      }
   }
};

dommr.prototype._serve_script = function(match, req, res) {

   var script = this._template.scripts[match[1]];

   if (script && script.source) {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.end(script.source, 'utf8');
   }

   return !!script;

};
   



dommr.prototype._build_location = function(request, data) {
   var url = request.url,
       location = new String("http://" + request.headers.host + url);

   location.hash = '';  // need to address
   location.host = request.headers.host;
   location.href = "http://" + request.headers.host + url;
   location.pathname = url;
   location.protocol = 'http:';

   if (url.indexOf("?") > -1) {
      location.search = url.substring(url.indexOf("?"));
   } else {
      location.search = "";
   }

   var split_host = request.headers.host.split(':');
   location.hostname = split_host[0];
   location.port = split_host[1];

   // extra properties
   // 
   location.method = request.method.toUpperCase();

   if (request.headers['content-type'] == 'application/x-www-form-urlencoded' && data) {
      var params = data.toString('utf8'), match;

      location.form = { };

      while (match = /([a-zA-z0-9]+)=([a-zA-Z0-9]+)/.exec(params)) {
         location.form[match[1]] = match[2];

         params = params.substr(match.index + match[0].length);
      }
   }

   return location;
};

dommr.prototype._build_navigator = function(request) {
   var navigator = { };

   navigator.server = true;
   navigator.userAgent = 'WebKit/1.0';

   return navigator;
};

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
      var timeout_id,
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
         id = elem.__load_id = 'script' + uuid();
         that._inactive_extensions[request_id].push(id);
         that._extension_working(id, request_id);

         elem.addEventListener('load', function(ev) {
            that._extension_done(ev.target.__load_id, request_id);
         });
      }
   });

};




















module.exports = dommr;




