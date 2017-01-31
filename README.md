c9-wakatime
===========

Metrics, insights, and time tracking automatically generated from your programming activity.


Installation
------------

1. Go to your Cloud9 Preferences and enable all 3 <code>Experimental SDK</code> toggles.
![Enable Plugins in Preferences](https://wakatime.com/static/img/ScreenShots/c9-enable-plugins-in-preferences.png)

2. Open a Terminal from Window -> New Terminal.
![Open Terminal](https://wakatime.com/static/img/ScreenShots/c9-open-terminal.png)

3. Run these terminal commands:

```
git clone https://github.com/wakatime/c9-wakatime.git
cd c9-wakatime
c9 install .
echo "export WAKATIME_HOME='~/workspace/'" >> ~/.profile
touch ~/workspace/.wakatime.cfg
```

4. Restart Cloud9 in Debug Mode (add `?debug=2` to the url)

5. Enter your [api key](https://wakatime.com/settings#apikey), then click `OK`.

6. Use Cloud9 like you normally do and your time will automatically be tracked for you.

7. Visit https://wakatime.com to see your logged time.


Note: Currently the Cloud9 plugin api is offline, so the wakatime plugin only works when running Cloud9 in Debug Mode.


Screen Shots
------------

![Project Overview](https://wakatime.com/static/img/ScreenShots/Screen-Shot-2016-03-21.png)


Upgrading
---------

1. Open a Terminal from Window -> New Terminal.

2. Run `c9 remove wakatime`

3. Run `c9 install wakatime --force`


Troubleshooting
---------------

For general troubleshooting information, see [wakatime/wakatime#troubleshooting](https://github.com/wakatime/wakatime#troubleshooting).
