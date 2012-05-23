
var express = require('express'),
    fs = require('fs'),
    dommr = require('../src/dommr.js');



function start(path, port) {
   var server = express.createServer(),
       stat = fs.lstatSync(path);

   if (stat.isDirectory()) { 
      server.use('/scripts', express.static(path + '/scripts'));
      server.use('/css', express.static(path + '/css'));
      server.use('/images', express.static(path + '/images'));

      server.use(express.favicon(path + '/images/favicon.ico'));

      path += '/index.html';
   }

   server.use(new dommr(path).
                     middleware());

   server.listen(port);
}



module.exports = {
   start: start
};
