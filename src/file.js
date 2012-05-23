var path = require('path'),
    fs = require('fs'),
    crypto = require('crypto'),
    util = require('util');

/**
 * Provides I/O functions for different types of files that dommr interacts with
 * e.g. templates, stylesheets and scripts
 * @param {String} path
 */
function File(path) {
   this.path = path;
}

util.inherits(File, require('events').EventEmitter);


/**
 *  A custom resolve function which should match path.resolve for all cases apart from
 * where rel_path starts with a / then it has a . added before it and then passed to path.resolve.
 * This is done so that we can use absolute paths in our template html for scripts and
 * stylesheets but have them resolve relative to the templates directory
 */
File.resolve = function(base_path, rel_path) {
   return path.resolve(base_path, ((rel_path.charAt(0) === '/') ? '.' : '') + rel_path);
};

/**
 * Holds the path of the file
 * @type {String}
 */
File.prototype.path = null;

/**
 * The contents of the file, when loaded
 * @type {}
 */
File.prototype.source = null;

/**
 * A hash of the source of this file
 * @type {Number}
 */
File.prototype.id = null;

/**
 * Will check that a path has been provided and
 * that it exists before reading the file
 * @return This, for chaining
 */
File.prototype.load = function() {

   this.check_exists();
   this._read();

   return this;

};

/**
 * Checks the file exists and throws errors if the path is not set, or the file
 * does not exist.
 */
File.prototype.check_exists = function() {
   if (!this.path) {
      throw Error("A path is needed in order to load a file");
   } else if (!path.existsSync(this.path)) {
      throw new Error(this.path + ' does not exist');
   }
};

/**
 * Generate an unique id for this file. Can only be generated once the source is set.
 * @return The id
 */
File.prototype.generate_id = function() {

   if (!this.source && !typeof source === 'string') {
      throw new Error("Cannot generate an id without any source");
   } else {
      var hash = crypto.createHash('sha1');
      return this.id = hash.update(this.source).digest('hex');
   }

};

/**
 * After validating the files existence it will watch the file and update this object
 * any time the file is modified
 * @return This, for chaining
 */
File.prototype.watch = function() {

   this.check_exists();
   fs.watchFile(this.path, { interval: 100 }, this._file_modified.bind(this));

   return this;
};

/**
 * Stops watching the file
 * @return This, for chaining
 */
File.prototype.unwatch = function() {

   fs.unwatchFile(this.path);

   return this;
};

/**
 * Handler for the file being modified
 * @param curr
 * @param prev
 */
File.prototype._file_modified = function(curr, prev) {

   if (curr.mtime.getTime() > prev.mtime.getTime()) {
      if (curr.size === 0) {
         this._changed = true;
      } else {
         this._read();
      }
   } else if (this._changed && curr.size > 0) {
      this._changed = false;
      this._read();
   }

};

/**
 * Reads the file and generates a hash for the content
 */
File.prototype._read = function() {

   this.source = fs.readFileSync(this.path, 'utf8');
   this.generate_id();

   console.log(this.constructor.name + ' loaded from ' + this.path);

   this._process_source();

};

/**
 * inheriting objects can provide there own _process_source which will be run
 * every time the file is read into the object
 * @abstract
 */
File.prototype._process_source = function() {};

module.exports = File;
