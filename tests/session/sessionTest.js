
var Test = module.exports,
    sinon = require('sinon'),
    Session = require('../../src/session/session.js');


Test.setUp = function(done) {
   this.fake_memcached_client = sinon.mock(require('memcached'));


   done();
};


Test['Get calls to redis if no value in internal hash'] = function(test) {

   var session = new Session(fake_memcached_client, 1);

   this.session.get('test_key', (function(value) {

      test.assert(this.session._hash.get.calledOnce);
      test.done();

   }).bind(this));

   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();

};

Test['If key in internal hash get doesnt call redis'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Set updates redis hash as well as internal hash'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Setting multiple key value pairs at the same time works'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Setting a value to null deletes the key'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Deleting a key should remove it from the redis and internal hash'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['When a session is created it updates its last used time'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['When a value is set the last used time should be updated'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Session.alive() should return true if last used time is inside expiry'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

Test['Session.alive() should return false if last used time is outside expiry'] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};
