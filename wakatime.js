define(function(require, exports, module) {
  main.consumes = [
    "Plugin", "c9", "tabManager", "preferences", "settings", "save", "ace", "proc", "info", "http", "dialog.confirm", "notification.bubble"
  ];
  main.provides = ["wakatime"];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var c9 = imports.c9;
    var settings = imports.settings;
    var prefs = imports.preferences;
    var tabManager = imports.tabManager;
    var ace = imports.ace;
    var save = imports.save;
    var proc = imports.proc;
    var info = imports.info;
    var http = imports.http;
    var confirm = imports['dialog.confirm'];
    var bubble = imports['notification.bubble'];

    var path = require('path');

    /***** Initialization *****/

    var plugin = new Plugin("WakaTime", main.consumes);
    var api  = plugin.setAPIKey(options.apikey);
    // var emit = plugin.getEmitter();
    // emit.setMaxListeners(2);

    var pluginVersion = null;
    var c9Version = null;
    var lastFile = null;
    var lastWrite = null;
    var lastTime = 0;
    var cachedPythonLocation = null;
    var cachedApiKey = null;

    function init() {
      pluginVersion = options.version || '3.0.1';
      c9Version = c9.version.split(' ')[0];
      if (settings.get('user/wakatime/@debug'))
        console.log('Initializing WakaTime v' + pluginVersion);

      getWakaApiKey(function(apiKey) {

        setupSettings(apiKey);

        if (isValidApiKey(apiKey)) {
          finishInit();
        } else {

          confirm.show("Do you already have a WakaTime account?",
            "Do you already have an account at https://wakatime.com?",
            "",
            function () {

              var apiKey = promptForApiKey(apiKey);
              if (isValidApiKey(apiKey)) {
                setWakaApiKey(apiKey);
                finishInit();
                bubble.popup("WakaTime plugin installed and ready!", true);
              } else {
                bubble.popup("Error: Invalid WakaTime API Key!", true);
              }

            }, function() {

              // get user's c9 email address
              info.getUser(function(err, user) {
                var defaultEmail = '';
                if (err || !user || !user.email) {
                  console.warn(err);
                } else {
                  defaultEmail = user.email;
                }

                var email = window.prompt("[WakaTime] Your email address:", defaultEmail);
                if (email) {
                  createWakaUser(user.email, function(err) {
                    if (err) {
                      console.warn(err);
                      bubble.popup("Could not create WakaTime account: " + err, true);
                    } else {
                      bubble.popup("WakaTime plugin installed and ready!", true);
                      finishInit();
                    }
                  });
                } else {
                  bubble.popup("Error: WakaTime plugin needs an email address or api key!", true);
                }
              });

            }, {
              yes: 'Yes, I have a WakaTime account',
              no: 'No',
            });
        }

      });

    }

    function finishInit() {
      setupEventHandlers();
    }

    /***** Methods *****/

    function createWakaUser(email, callback) {
      var url = 'https://wakatime.com/api/v1/users/signup/c9'
      var body = {
        email: email,
      };
      var options = {
        method: 'POST',
        body: body,
        timeout: 30000,
      };
      http.request(url, options, function(err, data, res) {
        if (data && data.data && isValidApiKey(data.data.api_key))
          setWakaApiKey(data.data.api_key);
        if (err && data && data.errors && data.errors.email)
          err = data.errors.email[0];
        callback && callback(err);
      });
    }

    function setWakaApiKey(apiKey, skipNonPersistent) {
      if (isValidApiKey(apiKey)) {
        cachedApiKey = apiKey;

        if (!skipNonPersistent)
          settings.set("user/wakatime/@apikey", apiKey);

        var data = {
          apiKey: apiKey,
        };
        api.setPersistentData("user", data, function(err) {
          if (err) console.log(err);
        });
      }
    }

    function getWakaApiKey(callback) {
      if (cachedApiKey) return callback && callback(cachedApiKey);

      api.getPersistentData("user", function(err, data) {
        if (err) console.warn(err);
        var apiKey = undefined;
        if (data && data.apiKey) apiKey = data.apiKey;
        if (!isValidApiKey(apiKey))
          apiKey = settings.get("user/wakatime/@apikey");
        callback && callback(apiKey);
      });
    }

    function promptForApiKey(defaultKey) {
      var key = window.prompt("[WakaTime] Enter your wakatime.com api key:", defaultKey);
      return key;
    }

    function isValidApiKey(key) {
      if (!key) return false;
      var re = new RegExp('^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$', 'i');
      return re.test(key);
    }

    function setupSettings(defaultApiKey) {
      settings.on("read", function(e) {
        settings.setDefaults("user/wakatime", [
          ["apikey", ""],
          ["debug", false],
          ["exclude", ""],
        ]);
      });

      if (isValidApiKey(defaultApiKey))
        settings.set("user/wakatime/@apikey", defaultApiKey);

      settings.on("user/wakatime/@apikey", function(value) {
        setWakaApiKey(value, true);
      }, plugin);

      prefs.add({
        "WakaTime" : {
          position: 650,
          "WakaTime" : {
            position: 100,
            "API Key": {
              type: "textbox",
              setting: "user/wakatime/@apikey",
              position: 100,
              width: 242,
            },
            "Debug": {
              type: "checkbox",
              setting: "user/wakatime/@debug",
              position: 200,
            },
            "Exclude": {
              type: "textarea-row",
              setting: "user/wakatime/@exclude",
              position: 300,
              width: 600,
              height: 100,
              fixedFont: true,
              rowheight: 250,
            },
          }
        }
      }, plugin);
    }

    function setupEventHandlers() {

      save.on('afterSave', function(e) {
        handleActivity(true);
      });

      tabManager.on('focus', function(e) {
        handleActivity();
      });

      ace.on('create', function(createEvent) {
        createEvent.editor.ace.on('input', function(e) {
          handleActivity();
        });
      }, plugin);
    }

    function enoughTimePassed(time) {
      return lastTime + 120000 < time;
    }

    function fileIsIgnored(file) {
      var patterns = settings.get('user/wakatime/@exclude').split(/\n/);
      var ignore = false;
      for (var i=0; i<patterns.length; i++) {
        if (patterns[i].trim()) {
          var re = new RegExp(patterns[i], 'gi');
          if (re.test(file)) {
            // console.log("matched " + patterns[i] + " on " + file);
            ignore = true;
            break;
          }
        }
      }
      return ignore;
    }

    function pythonLocation(callback, locations) {
      if (cachedPythonLocation) {
        if (callback)
          return callback(cachedPythonLocation);
        else
          return;
      }

      if (locations === undefined) {
        locations = [
          'pythonw',
          'python',
          '/usr/local/bin/python',
          '/usr/bin/python',
        ];
        for (var i=26; i<40; i++) {
          locations.push(path.join('python' + i, 'pythonw'));
          locations.push(path.join('Python' + i, 'pythonw'));
        }
      }

      if (locations.length == 0) {
        if (callback)
          callback(null);
        return;
      }

      var args = ['--version'];
      var location = locations[0];

      proc.execFile(location, {args:args}, function(error, stdout, stderr) {
        if (!error) {
          cachedPythonLocation = location;
          if (callback)
            callback(location);
        } else {
          locations.splice(0, 1);
          pythonLocation(callback, locations);
        }
      });

    }

    function coreLocation() {
      return path.join(c9.home, '.c9/lib/wakatime/wakatime/cli.py');
    }

    function obfuscateKey(key) {
      var newKey = '';
      if (key) {
        newKey = key;
        if (key.length > 4)
          newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
      }
      return newKey;
    }

    function obfuscateKeyFromArguments(args) {
      var newCmds = [];
      var lastCmd = "";
      for (var i = 0; i<args.length; i++) {
        if (lastCmd == "--key")
          newCmds.push(obfuscateKey(args[i]));
        else
          newCmds.push(args[i]);
        lastCmd = args[i];
      }
      return newCmds;
    }

    function handleActivity(isWrite) {
      var tab = tabManager.focussedTab;
      if (!tab) return;

      var file = tab.path;
      if (!file)
        return;

      if (file.indexOf('~') == 0) {
        file = path.join(c9.home, file.substring(1));
      } else if (file.indexOf(c9.home, 0) != 0) {
        file = path.join(c9.workspaceDir, file);
      }

      var time = Date.now();
      if (isWrite && lastWrite != isWrite || enoughTimePassed(time) || lastFile != file) {
        if (fileIsIgnored(file))
          return;

        var cursorpos = getCursorPosition(tab);
        sendHeartbeat(file, time, isWrite, cursorpos);
      }
    }

    function getCursorPosition(tab) {
      try {
        if (!tab) return null;
        var aceSession = tab.document.getSession().session;
        if (!aceSession) return null;
        var aceDoc = aceSession.doc;
        if (!aceDoc) return null;
        var selection = aceSession.getSelection();
        if (!selection) return null;
        var anchor = selection.anchor;
        if (!anchor) return null;
        var row = anchor.row;
        var col = anchor.column;
        var cursorpos = aceDoc.positionToIndex({ row: row, column: col });
        if (cursorpos !== undefined && cursorpos != null) return cursorpos;
        return null;
      } catch(err) {
        console.log(err);
        cursorpos = null;
      }
    }

    function sendHeartbeat(file, time, isWrite, cursorpos) {
      pythonLocation(function(python) {
        if (!python)
          return;
        var debug = settings.get("user/wakatime/@debug");
        getWakaApiKey(function(apiKey) {
          var core = coreLocation();
          var userAgent = 'c9/' + c9Version + ' c9-wakatime/' + pluginVersion;
          var args = [core, '--file', file, '--plugin', userAgent];
          if (isWrite)
            args.push('--write');
          if (isValidApiKey(apiKey)) {
            args.push('--key');
            args.push(apiKey);
          }
          if (cursorpos != null) {
            args.push('--cursorpos');
            args.push(cursorpos);
          }
          if (debug) {
            args.push('--verbose');
            var clone = args.slice(0);
            clone.unshift(python);
            console.log('Sending heartbeat: ' + obfuscateKeyFromArguments(clone).join(' '));
          }
          proc.execFile(python, {args:args}, function(error, stdout, stderr) {
            if (error) {
              if (stderr && stderr != '')
                console.warn(stderr);
              if (stdout && stdout != '')
                console.warn(stdout);

              var msg = error.message;
              var status = 'Error'
              var title = 'Unknown Error (' + error.code + '); Check your Dev Console and ~/.wakatime.log for more info.'
              if (error.code == 102) {
                msg = null;
                status = null;
                title = 'WakaTime Offline, coding activity will sync when online.';
              } else if (error.code == 103) {
                msg = 'An error occured while parsing ~/.wakatime.cfg. Check ~/.wakatime.log for more info.';
                status = 'Error';
                title = msg;
              } else if (error.code == 104) {
                msg = 'Invalid API Key. Make sure your API Key is correct!';
                status = 'Error';
                title = msg;
              }

              console.warn(msg);
              setStatusBarText(status);
              setStatusBarTitle(title);
            }
          });
          lastTime = time;
          lastFile = file;
          lastWrite = !!isWrite;
        });
      });
    }

    function setStatusBarText(text) {
      // TODO: update status bar text
      return;
    }

    function setStatusBarTitle(text) {
      // TODO: update status bar onhover title
      return;
    }

    /***** Lifecycle *****/

    plugin.on("load", function() {
      init();
    });
    plugin.on("unload", function() {
    });

    /***** Register and define API *****/
    plugin.freezePublicAPI({
      _events: [
      ],
    });

    register(null, {
      "wakatime": plugin
    });
  }
});
