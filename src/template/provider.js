var fs = require('fs'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter,
    Script = require('../script.js');


/**
 * @constructor
 * @param dir
 * @param options
 */
function TemplateProvider(dir, options) {

   options = options || { };
   this._ext = options.extension || this._ext;
   this._namespace = options.namespace || this._namespace;
   this._namespace_separator = options.namespace_separator || this._namespace_separator;
   this._settings = options.settings || this._settings;

   this._templates = { };
   this._client_script = fs.readFileSync(__dirname + '/client-template.js', 'utf8');

   console.log('Loading templates...');

   var parse_dir = this._parse_template_directory.bind(this, dir, this._namespace);
   parse_dir();
   fs.watchFile(dir, { interval: 100 }, parse_dir);

   console.log('Done.\n');
}


require('util').inherits(TemplateProvider, EventEmitter);


TemplateProvider.prototype._templates = null;

TemplateProvider.prototype._client_script = null;

TemplateProvider.prototype._ext = '.html';

TemplateProvider.prototype._namespace = '';

TemplateProvider.prototype._namespace_separator = ':';

TemplateProvider.prototype._settings = {
   evaluate    : /<%([\s\S]+?)%>/g,
   interpolate : /<%=([\s\S]+?)%>/g,
   escape      : /<%-([\s\S]+?)%>/g
};


TemplateProvider.prototype.register = function(dommr) {

   dommr.on('template:scripts:pre', this._include_templates.bind(this));

   dommr.register_pre_exec(this._attach_templates.bind(this));

};

/**
 * Called periodically to check the template directory
 * @param dir The directory to check
 * @param {String} [namespace=':']
 */
TemplateProvider.prototype._parse_template_directory = function(dir, namespace) {

   var files = fs.readdirSync(dir),
       file, stat, filename, template;

   for (var i = 0, len = files.length; i < len; i++) {
      file = dir + '/' + files[i];
      stat = fs.lstatSync(file);
      filename = path.basename(file, this._ext);

      if (stat.isDirectory()) {
         this._parse_template_directory(file, namespace + filename + this._namespace_separator);
      } else if (path.extname(file) === this._ext) {
         console.log('Template ' + namespace + filename + ' loaded from ' + file);

         template = fs.readFileSync(file).toString('utf8');
         this._templates[namespace + filename] = this._build_template_function(template);
      }
   }

};

TemplateProvider.prototype._unescape = function(code) {
   return code.replace(/\\\\/g, '\\').replace(/\\'/g, "'");
};

TemplateProvider.prototype._build_template_function = function(str) {
   // TODO: There must be another way to do this?
   var c = this._settings,
       unescape = this._unescape,
       no_match = /.^/,
       source = 'var __p=[],print=function(){__p.push.apply(__p,arguments);};' +
           'with(obj||{}){__p.push(\'' +
           str.replace(/\\/g, '\\\\')
               .replace(/'/g, "\\'")
               .replace(c.escape || no_match, function(match, code) {
              return "',window.template.escape(" + unescape(code) + "),'";
           })
               .replace(c.interpolate || no_match, function(match, code) {
              return "'," + unescape(code) + ",'";
           })
               .replace(c.evaluate || no_match, function(match, code) {
              return "');" + unescape(code).replace(/[\r\n\t]/g, ' ') + ";__p.push('";
           })
               .replace(/\r/g, '\\r')
               .replace(/\n/g, '\\n')
               .replace(/\t/g, '\\t')
           + "');}return __p.join('');";

   return new Function('obj', source);
};

TemplateProvider.prototype._attach_templates = function(request, done) {

   request.window.template = (function(templates, id, data) {

      return templates[id](data);

   }).bind(null, this._templates);

   request.window.template.escape = function(string) {
      return ('' + string).replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
   };

   done();

};

TemplateProvider.prototype._include_templates = function(template) {
   var templates = this._templates,
       templates_source = Object.keys(templates).map(function(t) {
          return '"' + t + '": ' + templates[t].toString()
       }),
       out = this._client_script.replace(/{{templates}}/, templates_source.join(',\n'));

   template.add_script(new Script(out, null, Script.CLIENT, Script.JAVASCRIPT));
};


module.exports = TemplateProvider;
