c9-wakatime
===========

Metrics, insights, and time tracking automatically generated from your programming activity.


Installation
------------

1. Go to your Cloud9 Preferences and enable all 3 <code>Experimental SDK</code> toggles.
![Enable Plugins in Preferences](https://wakatime.com/static/img/ScreenShots/c9-enable-plugins-in-preferences.png)

2. Open your Init Script from Cloud9 -> Open Your Init Script.
![Open Init Script](https://wakatime.com/static/img/ScreenShots/c9-open-init-script.png)

3. Paste this in your Init Script:

```javascript
var url = "https://cdn.rawgit.com/wakatime/c9-wakatime/master"
var pathConfig = {};
pathConfig["plugins/wakatime"] = url
require.config({paths: pathConfig})

require(["plugins/wakatime/wakatime", "plugins/wakatime/install"], function(plugin, install) {
    plugin({}, services, function(e, r) {
        r.wakatime.name = "wakatime";
        console.log(e, r)
        services.installer.createSession("wakatime", install.version, install)
    })
})
```

4. Restart Cloud9.

5. Enter your [api key](https://wakatime.com/settings#apikey), then click `OK`.

6. Use Cloud9 and your coding activity will be displayed on your [WakaTime dashboard](https://wakatime.com).


Note: Currently the Cloud9 plugin api is offline, so the wakatime plugin only works when running Cloud9 in Debug Mode.


Screen Shots
------------

![Project Overview](https://wakatime.com/static/img/ScreenShots/Screen-Shot-2016-03-21.png)


Troubleshooting
---------------

For general troubleshooting information, see [wakatime/wakatime#troubleshooting](https://github.com/wakatime/wakatime#troubleshooting).
