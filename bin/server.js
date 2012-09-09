(function(express, fs, dommr) {

   /**
    * Starts an express server with the given path and port number, using
    * dommr to handle requests.
    * @param {String} path
    * @param {Number} port
    */
   function start(path, port) {
      var server = express.createServer(),
          stat = fs.lstatSync(path);

      if (stat.isDirectory()) {

         server.use('/scripts', express.static(path + '/scripts'));
         server.use('/css', express.static(path + '/css'));
         server.use('/img', express.static(path + '/img'));
         server.use(express.favicon(path + '/favicon.ico'));

         path += '/index.html';
      }

      server.use(new dommr(path).middleware());

      server.listen(port);
   }

   module.exports = {
      start: start
   };

})(require('express'), fs = require('fs'), require('../src/dommr.js'));


