

var File = require('./file.js');


function Stylesheet(tag, base_path) {

   this.tag = tag;
   this.path = File.resolve(base_path, tag.href);
   this.type = tag.getAttribute('type'); 

   this.load().watch();

}


require('util').inherits(Stylesheet, File);


Stylesheet.ID_REGEX = /([0-9a-f]{40})\.css/;

Stylesheet.CSS = 'text/css';



Stylesheet.prototype.type = null;

Stylesheet.prototype.tag = null;








module.exports = Stylesheet;

