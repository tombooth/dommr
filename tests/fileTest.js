
var Test = module.exports,
    sinon = require('sinon'),
    path = require('path'),
    fs = require('fs'),
    crypto = require('crypto'),
    File = require('../src/file.js'),
    TEST_FILE_PATH = '/test/path',
    TEST_FILE_CONTENTS = 'test file',
    TEST_FILE_HASH = crypto.createHash('sha1').update(TEST_FILE_CONTENTS).digest('hex');


Test.setUp = function(cb) {
   sinon.stub(fs, 'existsSync');
   sinon.stub(fs, 'readFileSync');
   sinon.stub(fs, 'watchFile');
   sinon.stub(fs, 'unwatchFile');

   this.file = new File(TEST_FILE_PATH);

   cb();
};

Test.tearDown = function(cb) {
   fs.existsSync.restore();
   fs.readFileSync.restore();
   fs.watchFile.restore();
   fs.unwatchFile.restore();

   cb();
};


Test['Loading of file'] = function(test) {
   fs.existsSync.returns(true);
   fs.readFileSync.returns(TEST_FILE_CONTENTS);
   
   this.file.load();

   test.ok(fs.existsSync.calledOnce);
   test.equal(fs.existsSync.getCall(0).args[0], TEST_FILE_PATH);
   test.ok(fs.readFileSync.calledOnce);
   test.equal(fs.readFileSync.getCall(0).args[0], TEST_FILE_PATH);
   test.equal(this.file.path, TEST_FILE_PATH, "Should have stored the path");
   test.equal(this.file.source, TEST_FILE_CONTENTS, "Should have loaded the right contents into source");

   test.done();
};

Test['Existance checks'] = function(test) {
   fs.existsSync.returns(false);

   test.throws(function() {
      this.file.load();
   }, Error, "Loading a non-existant file should have caused an error");

   test.throws(function() {
      this.file.watch();
   }, Error, "Trying to watch a non-existant file should throw up");

   test.done();
};

Test['Remote checks'] = function(test) {
   this.file.path = '/foo/bar.js'
   test.equal(this.file.check_remote(), false);

   this.file.path = 'foo/bar.js'
   test.equal(this.file.check_remote(), false);

   this.file.path = 'http://foo/bar.js'
   test.equal(this.file.check_remote(), true);

   this.file.path = 'https://foo/bar.js'
   test.equal(this.file.check_remote(), true);

   test.done();
};


Test['Watching life cycle'] = function(test) {
   fs.existsSync.returns(true);

   this.file.watch();

   test.ok(fs.watchFile.calledOnce);
   test.equal(fs.watchFile.getCall(0).args[0], TEST_FILE_PATH, "Correct file should be watched");
   
   this.file.unwatch();

   test.ok(fs.unwatchFile.calledOnce);
   test.strictEqual(fs.unwatchFile.getCall(0).args[0], 
                    fs.watchFile.getCall(0).args[0], "Same file as was watched should be 'unwatched'");

   test.done();
};

Test['Doesnt watch file when it is remote'] = function(test) {

   this.file.path = 'http://foo/bar.js'
   this.file.watch();

   test.ok(!fs.watchFile.called);
   
   test.done();
};

Test['When watching a file, it is only reloaded when it has been modified'] = function(test) {

   var curr, prev, timesReadCalled = 0;

   sinon.stub(this.file, '_read');

   curr = { mtime: new Date(100) };
   prev = { mtime: new Date(100) };
   this.file._file_modified(curr, prev);

   test.equal(this.file._read.callCount, 0, "Read shouldn't have been called as the file has not changed");

   curr = { mtime: new Date(90) };
   prev = { mtime: new Date(100) };
   this.file._file_modified(curr, prev);

   test.equal(this.file._read.callCount, 0, "Read shouldn't have been called, mtimes fucked up");

   curr = { mtime: new Date(100) };
   prev = { mtime: new Date(90) };
   this.file._file_modified(curr, prev);

   test.equal(this.file._read.callCount, 1, "Read should have been called");

   test.done();

};

Test['Resolve function'] = function(test) {
   var base_path = '/some/path';

   test.equal(File.resolve(base_path, '/asdf.html'), '/some/path/asdf.html');
   test.equal(File.resolve(base_path, './asdf.html'), '/some/path/asdf.html');
   test.equal(File.resolve(base_path, 'asdf.html'), '/some/path/asdf.html');

   test.done();
};

Test['_process_source called by read'] = function(test) {
   fs.existsSync.returns(true);
   fs.readFileSync.returns(TEST_FILE_CONTENTS);

   sinon.stub(this.file, '_process_source');

   this.file.load();

   test.ok(this.file._process_source.calledOnce, "Process source should have been called");

   test.done();
};

Test['Generating a id'] = function(test) {

   this.file.source = TEST_FILE_CONTENTS;
   this.file.generate_id();

   test.equal(this.file.id, TEST_FILE_HASH, "Generated id should match hash");

   test.done();
};

Test['Generating an id with no source should throw up'] = function(test) {

   test.throws((function() {
      this.file.generate_id();
   }).bind(this));

   test.done();

};

Test['Loading a file generates a sha1 id'] = function(test) {

   fs.existsSync.returns(true);
   fs.readFileSync.returns(TEST_FILE_CONTENTS);

   this.file.load();

   test.equal(this.file.id, TEST_FILE_HASH, "File id should be the sha1 hash of the file contents");

   test.done();

};




