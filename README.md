# `bcycle`

Install [bcycle](https://www.npmjs.com/package/bcycle): `npm install -g bcycle`

Add a `BCYCLE_API_KEY` variable to your environment.

Run `bcycle initialize` once to create the database in a PostgreSQL instance on localhost and fetch the list of programs.

Then run `bcycle loop` to start the watch loop.


## Storage format

Storing statuses for 39 programs at 30 second intervals fills up a database pretty quickly.

For storage purposes, here's the format:

    bcycle_program_id bcycle_kiosk_id fetched docks_available bikes_available

* `bcycle_program_id` integer in the 3 to 93 range
* `bcycle_kiosk_id` integer in the 1646 to 3625 range
  - Caution: kiosks in different programs may share the same ID
* `fetched` timestamp in ISO-8601 format; specifically, something like `2016-12-10T22:15:49Z`
* `bikes_available` integer in the 0 to dozens (?) range
* `docks_available` integer in the 0 to dozens (?) range


## License

Copyright 2015 Christopher Brown. [MIT Licensed](http://chbrown.github.io/licenses/MIT/#2015).
