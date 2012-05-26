(function() {

   /**
    * @constructor
    */
   function ExtensionManager(registered) {
      this.registered = registered;
      this.active = {};
      this.inactive = {};
   }

   /**
    * @private
    * @type {Object}
    */
   ExtensionManager.prototype.active = null;

   /**
    * @private
    * @type {Object}
    */
   ExtensionManager.prototype.inactive = null;

   /**
    * @private
    * @type {Array}
    */
   ExtensionManager.prototype.registered = null;

   /**
    * Registers an extension
    * @param extension
    */
   ExtensionManager.prototype.register = function(extension) {
      this.registered.push(extension);
   };

   ExtensionManager.prototype.prepare_for_request = function(request_id) {
      // put a copy of the registered array into the inactive bin for this request id
      this.inactive[request_id] = this.registered.slice(0);
      this.active[request_id] = [];
   };

   /**
    * Removes the given extension from the inactive list for a given request_id
    * and pushes it onto the active list. Returns a boolean to indicate if that extension
    * existed or not.
    * @param {Number} request_id
    * @param {Object|String} extension The extension
    * @return {Boolean} Whether the extension was in the inactive list or not.
    */
   ExtensionManager.prototype.activate_extension = function(request_id, extension) {
      var index = this.inactive[request_id].indexOf(extension);

      if (index >= 0) {
         this.inactive[request_id].splice(index, 1);
         this.active[request_id].push(extension);
         return true;
      } else {
         return false;
      }

   };
   

   /**
    * Removes the given extension from the active list and pushes it back onto the inactive list.
    * @param {Number} request_id
    * @param {Object|String} extension The extension
    * @return {Boolean} Whether the extension is no longer on the active list
    */
   ExtensionManager.prototype.finish_active = function(request_id, extension) {
      var index = this.active[request_id].indexOf(extension);
      if (index >= 0) {
         this.active[request_id].splice(index, 1);
      }

      // TODO: Is this right? Checking for it again after splicing it. Will this ever *not* return -1?
      index = this.active[request_id].indexOf(extension);

      if (index < 0) {
         this.inactive[request_id].push(extension);
         return true;
      } else {
         return false;
      }

   };

   /**
    * Removes all active / inactive extension arrays for a given request
    * @param request_id
    */
   ExtensionManager.prototype.remove_all = function(request_id) {
      delete this.active[request_id];
      delete this.inactive[request_id];
   };

   module.exports = ExtensionManager;

})();