
History
-------


3.0.2 (2016-04-28)
++++++++++++++++++

- Remove use of depreciated persistent data api.


3.0.1 (2016-04-16)
++++++++++++++++++

- Prompt user for email before creating new WakaTime account.
- Store api key in user settings when persistent settings unavailable.


3.0.0 (2016-03-29)
++++++++++++++++++

- Stop auto-creating new users based on c9 email.
- Allow configuring api key from user preferences.


2.0.3 (2016-03-07)
++++++++++++++++++

- Now sending cursor position for all heartbeats using ace api, which is more
  efficient than looping through each char in file to find cursor position.
- Watching for activity in files using :attr:`input` events instead of
  :attr:`change` events for better performance.


2.0.2 (2016-02-20)
++++++++++++++++++

- Use default packagePath when publishing.


2.0.0 (2016-02-20)
++++++++++++++++++

- Publish package without packagePath.


1.0.7 (2016-02-20)
++++++++++++++++++

- Use correct path to wakatime python resource in plugin.


1.0.6 (2016-02-20)
++++++++++++++++++

- Fix install.js script downloading wakatime python tar.gz resource.


1.0.5 (2016-02-20)
++++++++++++++++++

- Use CORS POST request instead of jsonp for better security.


1.0.4 (2016-02-19)
++++++++++++++++++

- Store wakatime apikey in persistent storage.
- Auto create new wakatime account and populate api key for fresh users.


1.0.2 (2016-02-19)
++++++++++++++++++

- Hard code version until options.version is available.

  
1.0.0 (2016-02-08)
++++++++++++++++++

- Birth.
