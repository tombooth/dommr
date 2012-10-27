(function(express, fs, dommr) {

   /**
    * Starts an express server with the given path and port number, using
    * dommr to handle requests.
    * @param {String} path
    * @param {Number} port
    */
   function start(path, port, memcached_server) {
      var server = express(),
          stat = fs.lstatSync(path),
          session_options = { },
          dommr_instance, memcached_parts;

      if (stat.isDirectory()) {

         server.use('/scripts', express.static(path + '/scripts'));
         server.use('/css', express.static(path + '/css'));
         server.use('/img', express.static(path + '/img'));
         server.use(express.favicon(path + '/favicon.ico'));

         path += '/index.html';
      }

      dommr_instance = new dommr(path);

      if (memcached_server) {
         if (memcached_server.indexOf(':') > 0) {
            memcached_parts = memcached_server.split(':');
            session_options.host = memcached_parts[0];
            session_options.port = memcached_parts[1];
         } else {
            session_options.host = memcached_server;
         }

         dommr_instance.register(new dommr.Session(session_options));
      }

      server.use(dommr_instance.middleware());

      server.listen(port);
   }

   module.exports = {
      start: start
   };

})(require('express'), fs = require('fs'), require('../src/dommr.js'));


