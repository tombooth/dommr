
var path = require('path'),
    fs = require('fs'),
    jsdom = require('jsdom'),
    Script = require('./script.js'),
    Stylesheet = require('./stylesheet.js');



function Template(file_path, mount_path) {

   this.path = file_path;
   this._base_path = path.dirname(file_path);
   this._mount_path = mount_path;

}


require('util').inherits(Template, require('./file.js'));


Template.prototype.stylesheets = null;

Template.prototype.scripts = null;

Template.prototype.server_scripts = null;

Template.prototype.client_scripts = null;


Template.prototype._base_path = null;

Template.prototype._mount_path = null;

Template.prototype._window = null;


Template.prototype.add_script = function(script) {

   this.scripts[script.id] = script;

   (script.target == Script.SERVER || script.target == Script.BOTH) && this.server_scripts.push(script);
   
   if (script.target == Script.CLIENT || script.target == Script.BOTH) {
      if (!script.tag) this._add_script_tag(script); 
      this.client_scripts.push(script);
   }

};

Template.prototype.create_window = function() {

   var fresh_document = jsdom.jsdom(this.source/*''*/, null, {
      features: {
         FetchExternalResources: false,
         ProcessExternalResources: false,
         MutationEvents: '2.0',
         QuerySelector: true
      }
   });

   /*var elem = fresh_document.importNode(this._window.document.body, true);
   fresh_document._childNodes = [ elem ];
   fresh_document._modified();*/

   return fresh_document.parentWindow;

};


Template.prototype._add_script_tag = function(script) {
   var document = this._window.document,
       tag = script.tag = document.createElement('script'),
       last_tag, first_tag;

   tag.type = 'text/javascript';
   tag.charset = 'utf-8';
   tag.src = this._mount_path + '/script/' + script.id + '.js';

   if (this.client_scripts.length > 0) {
      last_tag = this.client_scripts[this.client_scripts.length - 1].tag;

      if (last_tag.nextSibling) {
         last_tag.parentNode.insertBefore(tag, last_tag.nextSibling);
      } else {
         last_tag.parentNode.appendChild(tag);
      }
   } else if (first_tag = document.getElementsByTagName('script')[0]) {
      first_tag.parentNode.insertBefore(tag, first_tag);
   } else {
      document.body.appendChild(tag);
   } 

   this.source = document.innerHTML;

};

Template.prototype._process_source = function() {

   var document = jsdom.jsdom(this.source, null, {
          features: {
             FetchExternalResources: false,
             ProcessExternalResources: false,
             MutationEvents: false,
             QuerySelector: true
          }
       }), script_tags, link_tags, stylesheet, scripts = [ ];
   
   this._window = document.createWindow();
   this.stylesheets = { };
   this.scripts = { };
   this.client_scripts = [ ];
   this.server_scripts = [ ];

   script_tags = document.getElementsByTagName('script');

   this.emit('scripts:pre', this);

   for (var i = 0, len = script_tags.length; i < len; i++) {
      this.add_script(Script.create_from_tag(script_tags[i], this._base_path));
   }

   this.emit('scripts:post', this);

   link_tags = document.getElementsByTagName('link');

   for (i = 0, len = link_tags.length; i < len; i++) {
      if (link_tags.rel = 'stylesheet') {
         stylesheet = new Stylesheet(link_tags[i], this._base_path);

         this.stylesheets[stylesheet.id] = stylesheet;
      }
   }

   this.source = document.innerHTML;

};



module.exports = Template;

