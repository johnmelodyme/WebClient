angular.module("proton.Auth", [
  "proton.Crypto",
  "proton.Models"
])

.constant("MAILBOX_PASSWORD_KEY", "proton:mailbox_pwd")
.constant("OAUTH_KEY", "proton:oauth")

.config(function(
  $provide,
  MAILBOX_PASSWORD_KEY,
  OAUTH_KEY
) {
  $provide.provider("authentication", function AuthenticationProvider(cryptoProvider) {

    // PRIVATE VARIABLES

    var auth = {};
    auth.provider = this;

    var baseURL;

    var randomString = function (size) {
      var string = ""
        , i = 0
        , chars = "0123456789ABCDEF";

      while (i++ < size) {
        string += chars[Math.floor(Math.random() * 16)];
      }
      return string;
    };

    // PRIVATE FUNCTIONS

    auth.saveAuthData = function(data) {
      date = moment(Date.now() + data.expires_in * 1000);

      window.localStorage[OAUTH_KEY+":uid"] = data.uid;
      window.localStorage[OAUTH_KEY+":exp"] = date.toISOString();
      window.localStorage[OAUTH_KEY+":access_token"] = data.access_token;
      window.localStorage[OAUTH_KEY+":refresh_token"] = data.refresh_token;

      auth.data = _.pick(data, "uid", "access_token", "refresh_token");
      auth.data.exp = date;
    };

    auth.savePassword = function(pwd) {
      window.sessionStorage[MAILBOX_PASSWORD_KEY] = auth.mailboxPassword = pwd;
    };

    // CONFIG-TIME API FUNCTIONS

    this.detectAuthenticationState = function() {
      var dt = window.localStorage[OAUTH_KEY+":exp"];
      if (dt) {
        dt = moment(dt);
        if (!dt.isBefore(Date.now())) {
          auth.data = {
            uid: window.localStorage[OAUTH_KEY+":uid"],
            exp: dt,
            access_token: window.localStorage[OAUTH_KEY+":access_token"],
            refresh_token: window.localStorage[OAUTH_KEY+":refresh_token"]
          };

          auth.mailboxPassword = window.sessionStorage[MAILBOX_PASSWORD_KEY];
          if (auth.mailboxPassword) {
            cryptoProvider.setMailboxPassword(auth.mailboxPassword);
          }
        } else {
          _.each(["uid", "exp", "token"], function(key) {
            delete window.localStorage[OAUTH_KEY+":"+key];
          });
        }
      }
    };

    this.setAPIBaseURL = function(newBaseURL) {
      if (!baseURL) {
        baseURL = this.baseURL = newBaseURL;
      }
    };

    this.$get = function($state, $rootScope, $q, $http, $timeout, crypto, $injector) {

      // RUN-TIME PUBLIC FUNCTIONS

      var api = {

        // Whether a user is logged in at all
        isLoggedIn: function() {
          var loggedIn = auth.data && ! _.isUndefined(auth.data.access_token);
          if (loggedIn && api.user === null) {
            auth.fetchUserInfo();
          }
          return loggedIn;
        },

        // Whether the mailbox' password is accessible, or if the user needs to re-enter it
        isLocked: function() {
          return ! api.isLoggedIn() || _.isUndefined(auth.mailboxPassword);
        },

        // Return a state name to be in in case some user authentication step is required.
        // This will null if the logged in and unlocked.
        state: function() {
          if (api.isLoggedIn()) {
            return api.isLocked() ? "login.unlock" : null;
          } else {
            return "login";
          }
        },

        // Redirect to a new authentication state, if required
        redirectIfNecessary: function() {
          var newState = api.state();
          if (newState) {
            $state.go(newState);
          }
        },

        isSecured: function() {
          return api.isLoggedIn() && !api.isLocked();
        },

        // Removes all connection data
        logout: function() {
          _.each(["uid", "exp", "token"], function(key) {
            delete window.localStorage[OAUTH_KEY+":"+key];
          });
          delete window.sessionStorage[MAILBOX_PASSWORD_KEY];

          delete auth.data;
          delete auth.mailboxPassword;

          this.user = null;

          $rootScope.isLoggedIn = false;
          $rootScope.isLocked = true;

          $state.go("login");
        },

        // Returns an async promise that will be successful only if the mailbox password
        // proves correct (we test this by decrypting a small blob)
        unlockWithPassword: function(pwd) {
          var req = $q.defer();
          var self = this;
          if (pwd) {
            $timeout(function() {
              self.user.$promise.then(function (user) {
                if (crypto.setMailboxPassword(user.PublicKey, user.EncPrivateKey, pwd)) {
                  auth.savePassword(pwd);

                  $rootScope.isLoggedIn = true;
                  $rootScope.isLocked = false;

                  req.resolve(200);
                } else {
                  req.reject({message: "We are unable to decrypt your mailbox, most likely, you entered the wrong decryption password. Please try again."});
                }
              });
            }, 1000);
          } else {
            req.reject({message: "Password is required"});
          }

          return req.promise;
        },

        // Returns an async promise that will be successful only if the server responds with
        // authentication information, after we've given it a correct username/password pair.
        loginWithCredentials: function(creds) {
          var q = $q.defer();

          if (!creds.username || !creds.password) {
            q.reject({message: "Username and password are required to login"});
          } else {
            delete $http.defaults.headers.common.Accept;

            $http.post(baseURL + "/auth/auth",
              _.extend(_.pick(creds, "username", "password"), {
                client_id: "demoapp",
                client_secret: "demopass",
                hashedpassword: "",
                grant_type: "password",
                state: randomString(24),
                redirect_uri: "https://protonmail.ch",
                response_type: "token"
              })
            ).then(function(resp) {
              var data = resp.data;
              if ("error" in data) {
                q.reject({message: data.error.message});
              } else {
                auth.saveAuthData(_.pick(data, "access_token", "refresh_token", "uid", "expires_in"));
                auth.fetchUserInfo().then(function() {
                  $rootScope.isLoggedIn = true;
                  $rootScope.isLocked = true;
                  q.resolve(200);
                });
              }
            },
            function (error) {
              console.log(error);
            });
          }

          return q.promise;
        },

        params: function (params) {
          return params;
        }
      };

      auth.fetchUserInfo = function() {
        $http.defaults.headers.common.Accept = "application/vnd.protonmail.v1+json";
        $http.defaults.headers.common.Authorization = "Bearer " + auth.data.access_token;
        $http.defaults.headers.common["x-pm-uid"] = auth.data.uid;

        api.user = $injector.get("User").get({UserID: auth.data.uid});
        return api.user.$promise;
      };

      api.baseURL = baseURL;
      api.user = null;

      return typeof Object.seal !== "undefined" ? Object.seal(api) : api;
    };
  });
})

.config(function(authenticationProvider, $httpProvider) {
  authenticationProvider.detectAuthenticationState();
  $httpProvider.interceptors.push(function ($q) {
    return {
      // Add an interceptor that will change a HTTP 200 success response containing
      // a { "error": <something> } body into a failing response
      response: function (response) {
        if (response.data.error) {
          var q = $q.defer();
          q.reject(response.data);
          return q.promise;
        }

        return response;
      }
    };
  });
})

.run(function($rootScope, authentication) {
  $rootScope.isLoggedIn = authentication.isLoggedIn();
  $rootScope.isLocked = authentication.isLocked();
});
