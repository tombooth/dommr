var path = require('path'),
    fs = require('fs'),
    jsdom = require('jsdom'),
    Script = require('./script.js'),
    File = require('./file.js'),
    Stylesheet = require('./stylesheet.js');

/**
 * @constructor
 * @param {String} file_path
 * @param mount_path
 */
function Template(file_path, mount_path) {
   this.path = file_path;
   this._base_path = path.dirname(file_path);
   this._mount_path = mount_path;
}

require('util').inherits(Template, File);

Template.prototype._base_path = null;

Template.prototype._mount_path = null;

/**
 * The file path
 * @type {String}
 */
Template.prototype.path = null;

/**
 * A map of all the stylesheets
 * @type {Object}
 */
Template.prototype.stylesheets = null;

/**
 * A map of all the scripts
 * @param {Object}
 */
Template.prototype.scripts = null;

/**
 * A list of scripts that run only on the server
 * @param script
 */
Template.prototype.server_scripts = null;

/**
 * A list of scripts that run only on the client
 * @param script
 */
Template.prototype.client_scripts = null;

Template.prototype._window = null;

/**
 * Registers a script on the template
 * @param {Script} script
 */
Template.prototype.add_script = function(script) {

   this.scripts[script.id] = script;

   if (script.target == Script.SERVER || script.target == Script.BOTH) {
      this.server_scripts.push(script);
   }

   if (script.target == Script.CLIENT || script.target == Script.BOTH) {
      if (!script.tag) {
         this._add_script_tag(script);
      }
      this.client_scripts.push(script);
   }

};

/**
 * Creates a document from the source
 */
Template.prototype.create_document = function() {
   return jsdom.jsdom(this.source/*''*/, null, {
      features: {
         FetchExternalResources: false,
         ProcessExternalResources: false,
         MutationEvents: '2.0',
         QuerySelector: true
      }
   });
};

/**
 * Creates a document and window from the source
 * Used by dommr.process_request
 */
Template.prototype.create_window = function() {
   return this.create_document().createWindow();
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

/**
 * Given an object mapping ids to files (such as this.stylesheet/script)
 * unwatches all the files mapped
 * @private
 * @param [Object] file_object Object with a id->file mapping
 */
Template.prototype._unwatch_all = function(file_object) {

   if (file_object) {
      Object.keys(file_object).forEach(function(id) { file_object[id].unwatch(); });
   }

};

/**
 * Called when the file is ready. Loads all the scripts and style sheets
 * and stores them as instances.
 */
Template.prototype._process_source = function() {

   var document = this.create_document(),
       script_tags, link_tags, stylesheet, scripts = [ ];

   // if scripts and style sheets have already been loaded then unwatch all the files
   this._unwatch_all(this.stylesheets);
   this._unwatch_all(this.scripts);

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

   for (i = 0,len = link_tags.length; i < len; i++) {
      // TODO: move to Stylesheet.js
      if (link_tags.rel = 'stylesheet') {
         stylesheet = new Stylesheet(link_tags[i], this._base_path);
         this.stylesheets[stylesheet.id] = stylesheet;
      }
   }

   // extensions may have manipulated the source so update it
   this.source = document.innerHTML;

};


module.exports = Template;

