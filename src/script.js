(function(File) {

   /**
    * Script objects are used to manage scripts which are loaded from a template
    * or added by extensions so that they can be executed for each request.
    * If you provide a path and no source then the Script object will attempt
    * to load the source from the file at path.
    * @param {String} source The contents of the file
    * @param {String} path The path of the file
    * @param target
    * @param type Either Script.JAVASCRIPT or Script.COFFEESCRIPT
    * @param tag
    */
   function Script(source, path, target, type, tag) {

      this.source = source;
      this.path = path;
      this.target = target;
      this.type = type;
      this.tag = tag;

      if (path && !source) {
         this.load().watch();
      } else {
         this._process_source();
         this.generate_id();
      }

   }

   require('util').inherits(Script, File);

   // Identifiers to show whether the code should be run on the client,
   // server or on both sides
   Script.CLIENT = 'client';
   Script.SERVER = 'server';
   Script.BOTH = 'both';

   // Identifiers to indicate the type of script that has been loaded
   Script.JAVASCRIPT = 'text/javascript';
   Script.COFFEESCRIPT = 'text/coffeescript';


   /**
    * If the script isn't javascript then we need to convert it.
    *
    * If there is a tag related to this script item then we need to either replace
    * the TextNode of the tag with the new source or generate an id and switch the
    * src attr of the tag to point to this generated source
    */
   Script.prototype._process_source = function() {

      var compile, output;

      switch (this.type) {
         case Script.JAVASCRIPT:
            return;
         case Script.COFFEESCRIPT:
            compile = require('coffee-script').compile;
            break;
      }

      if (compile) {
         this.source = compile(this.source);
         this.type = Script.JAVASCRIPT;

         if (this.tag) {
            this.tag.setAttribute('type', Script.JAVASCRIPT);
            if (this.tag.src) {
               // TODO: What if dommr.mount_path is different?
               this.tag.src = '/__dommr/script/' + this.id + '.js';
            } else {
               this.tag.childNodes[0].nodeValue = this.source;
            }
         }
      }

   };


   /**
    * Inside of dommr we want to create script objects from a script element
    * plucked from a jsdom document.
    *
    * If the script tag has a path then the function will load and watch the script, in the case
    * of an inline script we will be able to load the source straight out of the
    * child TextNode of the script element and we will generate an id for the script
    * @static
    * @param {Element} tag A script element
    * @param {String} base_path A path for resolving relative urls in the src attribute
    */
   Script.create_from_tag = function(tag, base_path) {

      var script_target,
          source, path, target, type;

      if (tag.src) {
         path = File.resolve(base_path, tag.src);
      } else {
         console.log('Loading inline script');
         source = tag.childNodes[0].nodeValue;
      }

      script_target = tag.getAttribute('data-target');
      target = (!script_target &&
          script_target !== Script.CLIENT &&
          script_target !== Script.SERVER) ? Script.BOTH : script_target;
      type = tag.getAttribute('type');

      return new Script(source, path, target, type, tag);

   };

   module.exports = Script;

})(require('./file.js'));

