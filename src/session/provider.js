
var uuid = require('node-uuid'),
    Session = require('./session.js'),
    Script = require('../script.js'),
    memcached = require('memcached');

function SessionProvider(options) {

   options = options || { };
   options.host = options.host || '127.0.0.1';
   options.port = options.port || 11211;
   options.expiry = options.expiry || 900;

   this._memcached_client = new memcached(options.host + ':' + options.port);
   this._expiry = options.expiry;
}


require('util').inherits(SessionProvider, require('events').EventEmitter);


SessionProvider.COOKIE_REGEX = /sessionId=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

SessionProvider.SYNC_REGEX = /session\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//;

SessionProvider._mount_path = null;


SessionProvider.prototype.register = function(dommr, mount_path) {

   this._mount_path = mount_path;

   dommr.on('template:scripts:pre', this._attach_client_session.bind(this));

   dommr.register_intercept(SessionProvider.SYNC_REGEX, this._put_in_session.bind(this));
   dommr.register_pre_exec(this._attach_session.bind(this));
   dommr.register_post_exec(this._detach_session.bind(this));

};


/**
 * Deals with a request coming in from a client using window.session to change a session item
 *
 * @param match the match returned by the RegExp SessionProvider.SYNC_REGEX
 * @param {HttpRequest} request the request made by the client
 * @param {HttpResponse} response the response back to the client
 */
SessionProvider.prototype._put_in_session = function(match, request, response) {

   var id = match[1],
       payload;

   if (request.body) this._set_key_val(id, request.body, function() { response.end(); });
   else {
      request.on('data', function(data) { console.log('data in'); payload = (payload) ? payload + data : data; });
      request.on('end', (function() { 
         payload && this._set_key_val(id, JSON.parse(payload.toString('utf8')), function() { response.end(); });
      }).bind(this));
   }

};

SessionProvider.prototype._set_key_val = function(id, key_val, callback) {
   var session = new Session(id, this._memcached_client, this._expiry);

   console.log('setting', key_val, id);

   session.set(key_val.key, key_val.value);
   session.save(callback);
};


/**
 * Attaches the client session code to the template and ensure it will only
 * run in the client
 *
 * @param {Template} template the dommr tempplate to add the session code to.
 */
SessionProvider.prototype._attach_client_session = function(template) {
   template.add_script(new Script(null, __dirname + '/client-session.js', Script.CLIENT, Script.JAVASCRIPT));
};

/**
 * Attaches the window.session object to the request's window object
 *
 * @param d_request the request object including window/httprequest/httpresponse
 */
SessionProvider.prototype._attach_session = function(d_request, done) {

   var id = d_request.session_id = this._get_id(d_request),
       session = d_request.window.session = new Session(id, this._memcached_client, this._expiry);

   console.log('[' + d_request.id + '] Part of session ' + id);

   session.load(function() { done(); });

};

SessionProvider.prototype._detach_session = function(d_request, done) {

   console.log('detaching session');

   var session = d_request.window.session,
       document = d_request.window.document,
       tag = document.createElement('script'),
       first_script_tag = document.getElementsByTagName('script')[0],
       data;

   tag.type = 'text/javascript';
   tag.charset = 'utf-8';

   data = { __id: d_request.session_id,
            __endpoint: this._mount_path + '/session/' + d_request.session_id + '/',
            __payload: session.all() };

   tag.appendChild(document.createTextNode('window.session = ' + JSON.stringify(data) + ';'));

   first_script_tag.parentNode.insertBefore(tag, first_script_tag);

   console.log('saving');
   session.save(function() { console.log('calling done');done(); });

};

SessionProvider.prototype._get_id = function(d_request) {

   var cookies = d_request.http_request.headers.cookie,
       cookie_match = SessionProvider.COOKIE_REGEX.exec(cookies),
       id;

   if (cookie_match) id = cookie_match[1];
   else {
      id = uuid();

      d_request.http_response.setHeader('Set-Cookie', 'sessionId=' + id + ';path=/; HttpOnly');
   }

   return id;

};

module.exports = SessionProvider;
