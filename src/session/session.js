





/**
 * This is the server side implmentation of the window.session object.
 * It is used by domesetique when a request is made as well as when
 * a session update request comes in from the client.
 *
 * @constructor
 * @param {String} id the id for the session
 * @param {memcached} client memcached client used for persisting the session store
 * @param {Number} expiry session expiry time in seconds until 30 days worth
 *                        and then will be interpretted as a timestamp
 */
function Session(id, client, expiry) {

   this._id = id;
   this._client = client;
   this._expiry = expiry;
   this._data = { };

}


require('util').inherits(Session, require('events').EventEmitter);


Session.prototype.get = function(key) {
   return this._data[key];
};

Session.prototype.set = function(key, value) {

   if (typeof key === 'object') {
   } else if (!value) {
   } else {
   }

   this._data[key] = value;
};

Session.prototype.del = function(key) {
   delete this._data[key];
};

Session.prototype.all = function() {
   return this._data;
};


Session.prototype.load = function(callback) {

   this._client.get(this._id, (function(err, session_data) {
      this._data = session_data || { };

      if (callback) callback();
   }).bind(this));

};

Session.prototype.save = function(callback) {

   this._client.set(this._id, this._data, this._expiry, function() {
      if (callback) callback();
   });

};


module.exports = Session;
