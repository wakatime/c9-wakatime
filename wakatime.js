define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "tabManager", "preferences", "settings", "save", "ace", "fs", "proc"
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
        var fs = imports.fs;
        var proc = imports.proc;

        /***** Initialization *****/

        var plugin = new Plugin("WakaTime", main.consumes);
        // var emit = plugin.getEmitter();
        // emit.setMaxListeners(2);

        var c9Version = null;
        var lastFile = null;
        var lastTime = 0;
        var cachedPythonLocation = null;

        function init() {
            console.log("Initializing WakaTime v" + options.version);
            c9Version = c9.version.split(' ')[0];

            var apiKey = settings.get("user/wakatime/@apikey");
            if (!isValidApiKey(apiKey)) {
                apiKey = promptForApiKey();
                settings.set("user/wakatime/@apikey", apiKey);
            }

            setupSettings();
            setupEventHandlers();
        }

        /***** Methods *****/

        function promptForApiKey() {
            var key = window.prompt("[WakaTime] Enter your wakatime.com api key:", settings.get("user/wakatime/@apikey"));
            return key;
        }

        function isValidApiKey(key) {
            if (!key) return false;
            var re = new RegExp('^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$', 'i');
            return re.test(key);
        }

        function setupSettings() {
            settings.on("read", function(e) {
                settings.setDefaults("user/wakatime", [
                    ["apikey", ""],
                    ["exclude", ""],
                ]);
            });
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
                        "Exclude": {
                            type: "textarea-row",
                            setting: "user/wakatime/@exclude",
                            width: 600,
                            height: 100,
                            fixedFont: true,
                            rowheight: 250,
                            position: 200,
                        }
                    }
                }
            }, plugin);
        }

        function setupEventHandlers() {

            save.on("afterSave", function(e) {
                handleActivity(e.path, null, true);
            });

            tabManager.on("focus", function(e) {
                handleActivity(e.tab.path);
            });

            ace.on("create", function(e) {
                if (!lastFile)
                    lastFile = e.editor.activeDocument.tab.path;
                e.editor.ace.on("change", function(e) {
                    getCursorPosition(lastFile, false, e.start.row, e.start.column, handleActivity);
                });
            }, plugin);
        }

        function downloadCLI() {
            // TODO: download and unzip https://github.com/wakatime/wakatime/archive/master.zip
        }

        function getCursorPosition(file, isWrite, row, col, callback) {
            if (file) {
              fs.readFile(file, function (err, data) {
                  var cursorpos = null;
                  if (!err) {
                      cursorpos = 0;
                      var lines = data.split(/\n/);
                      for (var i=0; i<lines.length; i++) {
                          if (i == row) {
                              cursorpos += col;
                              break;
                          }
                          cursorpos += lines[i].length + 1;
                      }
                  }
                  callback(file, cursorpos, isWrite)
              });
            }
        }

        function enoughTimePassed(time) {
            return lastTime + 120000 < time;
        }

        function fileIsIgnored(file) {
            var patterns = settings.get("user/wakatime/@exclude").split(/\n/);
            var ignore = false;
            for (var i=0; i<patterns.length; i++) {
                if (patterns[i].trim()) {
                    var re = new RegExp(patterns[i], "gi");
                    if (re.test(file)) {
                        console.log("matched " + patterns[i] + " on " + file);
                        ignore = true;
                        break;
                    }
                }
            }
            return ignore;
        }

        function pythonLocation(callback, locations) {
            if (cachedPythonLocation)
                return callback(cachedPythonLocation);

            if (locations === undefined) {
                locations = [
                    "pythonw",
                    "python",
                    "/usr/local/bin/python",
                    "/usr/bin/python",
                    "\\python38\\pythonw",
                    "\\Python38\\pythonw",
                    "\\python37\\pythonw",
                    "\\Python37\\pythonw",
                    "\\python36\\pythonw",
                    "\\Python36\\pythonw",
                    "\\python35\\pythonw",
                    "\\Python35\\pythonw",
                    "\\python34\\pythonw",
                    "\\Python34\\pythonw",
                    "\\python33\\pythonw",
                    "\\Python33\\pythonw",
                    "\\python32\\pythonw",
                    "\\Python32\\pythonw",
                    "\\python31\\pythonw",
                    "\\Python31\\pythonw",
                    "\\python30\\pythonw",
                    "\\Python30\\pythonw",
                    "\\python27\\pythonw",
                    "\\Python27\\pythonw",
                    "\\python26\\pythonw",
                    "\\Python26\\pythonw",
                    "\\python38\\python",
                    "\\Python38\\python",
                    "\\python37\\python",
                    "\\Python37\\python",
                    "\\python36\\python",
                    "\\Python36\\python",
                    "\\python35\\python",
                    "\\Python35\\python",
                    "\\python34\\python",
                    "\\Python34\\python",
                    "\\python33\\python",
                    "\\Python33\\python",
                    "\\python32\\python",
                    "\\Python32\\python",
                    "\\python31\\python",
                    "\\Python31\\python",
                    "\\python30\\python",
                    "\\Python30\\python",
                    "\\python27\\python",
                    "\\Python27\\python",
                    "\\python26\\python",
                    "\\Python26\\python",
                ];
            }

            if (locations.length == 0) {
              callback(null);
              return;
            }

            var args = ['--version'];
            var location = locations[0];

            proc.execFile(location, {args:args}, function(error, stdout, stderr) {
              if (!error) {
                cachedPythonLocation = location;
                callback(location);
              } else {
                locations.splice(0, 1);
                pythonLocation(callback, locations);
              }
            });

        }

        function cliLocation() {
            return 'wakatime-master/wakatime/cli.py';
        }

        function handleActivity(file, cursorpos, isWrite) {
            if (!file)
                return;
            var time = Date.now();
            if (isWrite || enoughTimePassed(time) || lastFile != file) {
                if (fileIsIgnored(file))
                    return;
                sendHeartbeat(file, time, cursorpos, isWrite);
            }
        }

        function sendHeartbeat(file, time, cursorpos, isWrite) {
            pythonLocation(function(python) {
                if (!python)
                    return;
                var apiKey = settings.get("user/wakatime/@apikey");
                var userAgent = 'c9/' + c9Version + ' c9-wakatime/' + options.version;
                var args = [cliLocation(), '--file', file, '--key', apiKey, '--plugin', userAgent];
                if (isWrite)
                    args.push('--write');
                if (cursorpos) {
                    args.push('--cursorpos');
                    args.push(cursorpos);
                }
                proc.execFile(python, {args:args}, function(error, stdout, stderr) {
                    if (error) {
                        if (stderr && stderr != '')
                            console.warn(stderr);
                        if (stdout && stdout != '')
                            console.warn(stdout);
                        if (error.code == 102)
                            console.warn('Warning: api error (102); Check your ~/.wakatime.log file for more details.');
                        else if (error.code == 103)
                            console.warn('Warning: config parsing error (103); Check your ~/.wakatime.log file for more details.');
                        else
                            console.warn(error);
                    }
                });
                lastTime = time;
                lastFile = file;
            });
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
