
(function(Backbone, $) {
    
	"use strict";
	
	var _sync = Backbone.sync;
	Backbone.sync = function(method, model, options) {
		var options = options || { };
		
		options.dataType = 'jsonp';
		
		return _sync.call(Backbone, method, model, options);
	};
   
   var Commit = Backbone.Model.extend({ });
   
   var Commits = Backbone.Collection.extend({
       
      model: Commit,
      
      initialize: function(options) {
         this.repo = options.repo;
      },
      
      url: function() {
         return 'https://api.github.com/repos/' + this.repo.get('owner').login + '/' + this.repo.get('name') + '/commits';
      },
      
      parse: function(raw) {
         return raw.data;
      }
      
   }, {
       
      get: function(repo, callback) {
          var commits = new Commits({ repo: repo });
      
          commits.fetch({
             success: function(commits) {
                callback && callback(commits);
             },
             error: function() {
                callback && callback();
             }
          });
      }
      
   });
   
   var Repo = Backbone.Model.extend({
   });
    
   var Repos = Backbone.Collection.extend({
      
      model: Repo,
      
      initialize: function(options) {
         this.username = options.username;
      },
      
      url: function() {
         return 'https://api.github.com/users/' + this.username + '/repos';
      },
      
      parse: function(raw) {
         return raw.data;
      }
      
   });
   
   Repos.get = function(user, callback) {
      var repos = new Repos({ username: user.get('username') });
      
      repos.fetch({
         success: function(repos) {
            callback && callback(repos);
         },
         error: function() {
            callback && callback();
         }
      });
   };
	
	var User = Backbone.Model.extend({
		
		initialize: function(options) {
			
		},
		
		url: function() {
			return 'https://api.github.com/users/' + this.get('username');
		},
		
		parse: function(raw) {
			return raw.data;
		}
		
	});
   
   User.get = function(username, callback) {
      var user = new User({ username: username });
		
		user.fetch({ 
			success: function(user) { 
            callback && callback(user);
			},
         error: function() {
            callback && callback();
         } 
		});
   };
	
	var MainRouter = Backbone.Router.extend({
		
		routes: {
			'': 'index',
			':username': 'user',
			':username/': 'user'
		},
		
		index: function() {
			console.log('index');
		},
		
		user: function(username) {
         User.get(username, function(user) {
            if (!user) throw new Error('Failed to get user' + username);
            else {
               $('.name').text(user.get('name'));
               Repos.get(user, function(repos) {
                  if (!repos) throw new Error('Failed to get repos');
                  else {
                     $('.repos').empty();
                     repos.each(function(repo) {
                        var elem = $('<li><h2><a href="' + repo.get('html_url') + '">' + repo.get('name') + '</a>' + (repo.get('fork') ? '<span class="forked">Forked</span>' : '') + '</h2><p>' + repo.get('description') + '</p><h3>Commits</h3><ul class="commits"></ul></li>');
                        $('.repos').append(elem);
                        
                        Commits.get(repo, function(commits) {
                            if (!commits) throw new Error('Failed to get commits for ' + repo.get('name'));
                            else {
                                var commits_elem = elem.find('.commits');
                                
                                commits.first(3).forEach(function(commit) {
                                    commits_elem.append('<li><span class="date">' + new Date(commit.get('commit').committer.date).toDateString() + '</span><pre class="message">' + commit.get('commit').message + '</pre></li>');
                                });
                            }
                        });
                     });
                  }
               });
            }
         });
		}
		
	});
	
	new MainRouter();
	
	Backbone.history.start((window.navigator.server) ? { pushState: true } : undefined);
	
})(window.Backbone, window.jQuery);