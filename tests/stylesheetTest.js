
var Test = module.exports,
    path = require('path'),
    fs = require('fs'),
    sinon = require('sinon'),
    Stylesheet = require('../src/stylesheet.js'),
    TEST_BASE_PATH = '/test/path';


Test.setUp = function(cb) {
   sinon.stub(path, 'existsSync');
   sinon.stub(fs, 'readFileSync');
   sinon.stub(fs, 'watchFile');
   sinon.stub(fs, 'unwatchFile');

   cb();
};

Test.tearDown = function(cb) {
   path.existsSync.restore();
   fs.readFileSync.restore();
   fs.watchFile.restore();
   fs.unwatchFile.restore();

   cb();
};

Test["Path and type extracted from tag"] = function(test) {
   var tag = {
          href: '/blah.css',
          type: 'text/css',
          getAttribute: function(attr) { return (attr === 'type') ? this.type : null; }
       }, 
       stylesheet;

   path.existsSync.returns(true);
   fs.readFileSync.returns(' ');

   stylesheet = new Stylesheet(tag, TEST_BASE_PATH);

   test.equal(stylesheet.path, TEST_BASE_PATH + tag.href);
   test.equal(stylesheet.type, tag.type);

   test.done();
};

Test["Loads and watches file"] = function(test) {
   test.ok(false, 'NEEDS TO BE FILLED IN');

   test.done();
};

