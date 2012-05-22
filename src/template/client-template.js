
window.template = function(id, data) {
   return window.template.store[id](data);
};

window.template.escape = function(string) {
   return (''+string).replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#x27;')
                     .replace(/\//g,'&#x2F;');
};

window.template.store = {
   {{templates}}
};

