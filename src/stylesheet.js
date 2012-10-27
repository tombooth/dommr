(function(File) {

   /**
    * @constructor
    * @param {Element} tag
    * @param {String} base_path
    */
   function Stylesheet(tag, base_path) {

      this.tag = tag;
      this.path = File.is_remote(tag.href) ? tag.href : File.resolve(base_path, tag.href);
      this.type = tag.getAttribute('type');
      this.load().watch();

   }

   require('util').inherits(Stylesheet, File);

   // TODO: Will be used later when we have stylesheet / sass / concatenation support
   Stylesheet.ID_REGEX = /([0-9a-f]{40})\.css/;

   // TODO: Not used?
   Stylesheet.CSS = 'text/css';

   /**
    * The stylesheet element
    * @type {Element}
    */
   Stylesheet.prototype.tag = null;

   /**
    * The type of stylesheet taken from the 'type' attribute
    * on the element
    */
   Stylesheet.prototype.type = null;

   module.exports = Stylesheet;

})(require('./file.js'));

