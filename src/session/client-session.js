(function(payload) {

   window.session.load = function(obj) {
      var keys = Object.keys(obj),
          len = keys.length,
          key;

      for (var i = 0; i < len, key = keys[i]; i++) {
         window.session.set(key, obj[key], true);
      }
   };

   window.session.get = function(key) {
      return window.sessionStorage.getItem(key);
   };

   window.session.set = function(key, val, not_saved) {

      if (typeof key === 'object') {
         not_saved = val;

         for (k in key) {
            if (key[k] === null) window.sessionStorage.removeItem(k);
            else window.sessionStorage.setItem(k, key[k]);
            
            if (!window.navigator.server && !not_saved) _set_server(k, key[k]);
         }
      } else {
         if (val === null) window.sessionStorage.removeItem(key);
         else window.sessionStorage.setItem(key, val);

         if (!window.navigator.server && !not_saved) _set_server(key, val);
      }

   };

   function _set_server(key, val) {

      var xhr = new XMLHttpRequest();

      xhr.open('PUT', window.session.__endpoint);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ key: key, value: val}));

   }


   window.session.load(payload);

})(window.session.__payload);
