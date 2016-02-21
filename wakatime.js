define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "tabManager", "preferences", "settings", "save", "ace", "fs", "proc", "info", "http"
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
        var info = imports.info;
        var http = imports.http;

        /***** Initialization *****/

        var plugin = new Plugin("WakaTime", main.consumes);
        var api  = plugin.setAPIKey(options.apikey);
        // var emit = plugin.getEmitter();
        // emit.setMaxListeners(2);

        var pluginVersion = null;
        var c9Version = null;
        var lastFile = null;
        var lastTime = 0;
        var cachedPythonLocation = null;
        var cachedApiKey = null;

        function init() {
            pluginVersion = options.version || '1.0.6';
            c9Version = c9.version.split(' ')[0];
            if (settings.get("user/wakatime/@debug"))
                console.log("Initializing WakaTime v" + pluginVersion);

            setupSettings();

            // get user's c9 email address
            info.getUser(function(err, user) {
                if (err || !user || !user.email) {
                    console.log(err);
                    finishInit();
                } else {
                    getApiKey(function(apiKey) {
                        if (isValidApiKey(apiKey)) {
                            finishInit();
                        } else {
                            createWakaUser(user, finishInit);
                        }
                    });
                }
            });
        }

        function finishInit() {

            // make sure we have a WakaTime api key
            getApiKey(function(apiKey) {

                if (!isValidApiKey(apiKey)) {
                    apiKey = promptForApiKey(apiKey);
                    if (isValidApiKey(apiKey))
                        setApiKey(apiKey);
                }

                setupEventHandlers();

            });
        }

        /***** Methods *****/

        function createWakaUser(user, callback) {
            var url = 'https://wakatime.com/api/v1/users/signup/c9'
            var body = {
                email: user.email,
            };
            if (user.fullname) body.full_name = user.fullname;
            var options = {
                method: 'POST',
                body: body,
                timeout: 30000,
            };
            http.request(url, options, function(err, data, res) {
                if (err) console.log(err);
                if (data && data.data && isValidApiKey(data.data.api_key))
                    setApiKey(data.data.api_key);
                callback && callback();
            });
        }

        function setApiKey(apiKey) {
            if (isValidApiKey(apiKey)) {
                cachedApiKey = apiKey;

                var data = {
                    apiKey: apiKey,
                };
                api.setPersistentData("user", data, function(err) {
                    if (err) console.log(err);
                });
            }
        }

        function getApiKey(callback) {
            if (cachedApiKey) return callback && callback(cachedApiKey);

            api.getPersistentData("user", function(err, data) {
                if (err) console.log(err);
                var apiKey = undefined;
                if (data && data.apiKey) apiKey = data.apiKey;
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

        function setupSettings() {
            settings.on("read", function(e) {
                settings.setDefaults("user/wakatime", [
                    ["debug", false],
                    ["exclude", ""],
                ]);
            });
            prefs.add({
                "WakaTime" : {
                    position: 650,
                    "WakaTime" : {
                        position: 100,
                        "Debug": {
                            type: "checkbox",
                            setting: "user/wakatime/@debug",
                            position: 100,
                        },
                        "Exclude": {
                            type: "textarea-row",
                            setting: "user/wakatime/@exclude",
                            position: 200,
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

        function getCursorPosition(file, isWrite, row, col, callback) {
            if (file) {
                var re = new RegExp('^' + c9.home);
                var relativeFile = file.replace(re, '~');
                fs.readFile(relativeFile, function (err, data) {
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
                    if (callback)
                      callback(file, cursorpos, isWrite);
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
            if (cachedPythonLocation) {
                if (callback)
                    return callback(cachedPythonLocation);
                else
                    return;
            }

            if (locations === undefined) {
                locations = [
                    "pythonw",
                    "python",
                    "/usr/local/bin/python",
                    "/usr/bin/python",
                ];
                for (var i=26; i<40; i++) {
                    locations.push('\\python' + i + '\\pythonw');
                    locations.push('\\Python' + i + '\\pythonw');
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
            return c9.home + "/.c9/lib/wakatime/wakatime/cli.py";
        }

        function obfuscateKey(key) {
            var newKey = "";
            if (key) {
                newKey = key;
                if (key.length > 4)
                    newKey = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX" + key.substring(key.length - 4);
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

        function handleActivity(file, cursorpos, isWrite) {
            if (!file)
                return;
            if (file.indexOf('~') == 0) {
                file = c9.home + file.substring(1);
            }
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
                var debug = settings.get("user/wakatime/@debug");
                getApiKey(function(apiKey) {
                    if (!isValidApiKey(apiKey))
                        return;
                    var userAgent = 'c9/' + c9Version + ' c9-wakatime/' + pluginVersion;
                    var core = coreLocation();
                    var args = [core, '--file', file, '--key', apiKey, '--plugin', userAgent];
                    if (isWrite)
                        args.push('--write');
                    if (debug)
                        args.push('--verbose');
                    if (cursorpos) {
                        args.push('--cursorpos');
                        args.push(cursorpos);
                    }
                    if (debug) {
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
