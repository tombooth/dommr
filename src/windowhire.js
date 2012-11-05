

var jsdom = require('jsdom'),
    uuid = require('node-uuid'),
    XMLHttpRequest = require('./xmlhttprequest.js');

function reduce_call(scope) {
   var args = [].slice.call(arguments, 1);

   return function(memo, fn) {
      return fn.apply(scope, [ memo ].concat(args));
   };
}





function WindowHire(template) {
   this._template = template;
   this._available_windows = [ ];
}


WindowHire.prototype.rent = function(request, data) {

   var window;

   if (this._available_windows.length === 0) {
      window = this._create();
   } else {
      window = this._available_windows.shift();
   }

   window = [ this._add_location ].reduce(reduce_call(this, request, data), window);

   return window;

};

WindowHire.prototype.return = function(window) {

   window.document.innerHTML = this._template.source;
   window.un();

   this._available_windows.push(window);

};


WindowHire.prototype._create = function() {

   var document, window, static_scripts, script;

   document = jsdom.jsdom(this._template.source, null, {

      features: {
         FetchExternalResources: false,
         ProcessExternalResources: false,
         MutationEvents: '2.0',
         QuerySelector: true
      }

   });

   window = document.createWindow();

   window = [ this._add_eventing,
              this._add_console,
              this._add_history,
              this._add_timing,
              this._add_navigator,
              this._add_script_loading,
              this._add_xmlhttprequest ].reduce(reduce_call(this), window);
        
   // add static scripts to the window
   static_scripts = this._template.server_scripts.filter(function(s) { return s.is_static; });

   for (i = 0, len = static_scripts.length; i < len; i++) {
      
      script = static_scripts[i];
      console.log('adding ' + script.path);
      window.run(script.source, script.path);

   }

   return window;

};


WindowHire.prototype._add_eventing = function(window) {

   var name_to_callbacks = { };

   window.on = function(name, callback) {
      var callbacks_for_name = name_to_callbacks[name];

      if (! callbacks_for_name) {
         callbacks_for_name = name_to_callbacks[name] = [ ];
      }

      callbacks_for_name.push(callback);
   };

   window.fire = function(name) {
      var args = [].slice.call(arguments, 1),
          callbacks_for_name = name_to_callbacks[name];

      if (callbacks_for_name) {
         callbacks_for_name.forEach(function (cb) { cb.apply(this, args); });
      }
   }

   window.un = function() {
      name_to_callbacks = { };
   }

   return window;

};

WindowHire.prototype._add_history = function(window) {

   window.history = {
      // don't want to move about history on the server but backbone needs it to exist
      pushState: function() {}
   };

   return window;

};

WindowHire.prototype._add_timing = function(window) {

   var running_timeouts = { },
       running_intervals = { },
       that = this;

   window.setTimeout = function(fn, timeout) {
      var timeout_id,
          id = 'timeout:' + uuid();

      window.fire('working');

      timeout_id = setTimeout(function() {
         fn.apply(window, arguments);
         window.fire('done');
      }, timeout);

      running_timeouts[id] = timeout_id;

      return id;
   };

   window.clearTimeout = function(id) {
      var timeout_id = running_timeouts[id];

      if (timeout_id) {
         clearTimeout(timeout_id);

         window.fire('done');
      }
   };

   window.setInterval = function(fn, interval) {
      var interval_id,
          id = 'interval:' + uuid();

      window.fire('working');

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

         window.fire('done');
      }
   };

   return window;

};

WindowHire.prototype._add_navigator = function(window, request) {

   var navigator = { };

   navigator.server = true;
   navigator.userAgent = 'WebKit/1.0';

   window.navigator = navigator;

   return window;

};

WindowHire.prototype._add_script_loading = function(window) {

   var that = this;

   window.document.addEventListener('DOMNodeInserted', function(ev) {
      var elem = ev.target,
          id;

      if (elem.nodeName === 'SCRIPT' && elem.ownerDocument.implementaton.hasFeature('ProcessExternalResources')) {
         id = 'script' + uuid();
         window.fire('working');

         elem.addEventListener('load', function(ev) {
            window.fire('done');
         });
      }
   });

   return window;

};

WindowHire.prototype._add_xmlhttprequest = function(window) {

   // TODO: All wrong

   window.XMLHttpRequest = function() {

      var xmlhttprequest = new XMLHttpRequest();

      xmlhttprequest.once('working', window.fire.bind(window, 'working'));
      xmlhttprequest.once('done', window.fire.bind(window, 'done'));

      return xmlhttprequest;

   };

   return window;

};

WindowHire.prototype._add_location = function(window, request, data) {

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
   location.method = request.method.toUpperCase();

   if (request.headers['content-type'] == 'application/x-www-form-urlencoded' && data) {
      var params = data.toString('utf8'), match;

      location.form = { };

      while (match = /([a-zA-z0-9%\.]+)=([a-zA-Z0-9%\.]+)/.exec(params)) {
         location.form[match[1]] = decodeURIComponent(match[2]);

         params = params.substr(match.index + match[0].length);
      }
   }

   window.location = location;

   return window;

};

WindowHire.prototype._add_console = function(window) {

   window.console = console;

   return window;

};




module.exports = WindowHire;


