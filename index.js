/// <reference path="type_declarations/node/node.d.ts" />
/// <reference path="type_declarations/async/async.d.ts" />
/// <reference path="type_declarations/request/request.d.ts" />
var path = require('path');
var child_process = require('child_process');
var async = require('async');
var logger = require('loge');
var sqlcmd = require('sqlcmd-pg');
var db = new sqlcmd.Connection({
    host: '127.0.0.1',
    port: '5432',
    user: 'postgres',
    database: 'bcycle',
});
function storeStation(station, callback) {
    db.SelectOne('station')
        .whereEqual({
        title: station.title,
        address: station.address,
    })
        .execute(function (error, existing_station) {
        if (error)
            return callback(error);
        if (existing_station) {
            return callback(null, existing_station);
        }
        db.InsertOne('station')
            .set({
            title: station.title,
            description: station.description,
            address: station.address,
            latitude: station.latitude,
            longitude: station.longitude,
            has_trikes: station.has_trikes,
        })
            .returning('*')
            .execute(callback);
    });
}
function fetchStationStatuses(url, callback) {
    var phantomjs_script = path.join(__dirname, 'fetch.js');
    child_process.execFile('phantomjs', ['--ignore-ssl-errors', 'true', phantomjs_script, url], function (error, stdout, stderr) {
        if (error)
            return callback(error);
        if (stderr) {
            logger.error('phantomjs stderr:', stderr.toString());
        }
        callback(null, JSON.parse(stdout));
    });
}
exports.fetchStationStatuses = fetchStationStatuses;
function storeStationStatuses(station_statuses, callback) {
    async.each(station_statuses, function (station_status, callback) {
        storeStation(station_status, function (error, station) {
            if (error)
                return callback(error);
            db.InsertOne('status')
                .set({
                station_id: station.id,
                bikes: station_status.bikes,
                docks: station_status.docks,
                icon: station_status.icon,
                back: station_status.back,
            })
                .execute(callback);
        });
    }, callback);
}
function watch(url, interval_ms, callback) {
    db.createDatabaseIfNotExists(function (error) {
        if (error)
            return callback(error);
        var migrations_dirpath = path.join(__dirname, 'migrations');
        db.executePatches('_migrations', migrations_dirpath, function (err) {
            if (error)
                return callback(error);
            setInterval(function () {
                logger.info('[%s] Fetching stations-locations', new Date().toISOString());
                fetchStationStatuses(url, function (error, station_statuses) {
                    if (error)
                        return callback(error);
                    storeStationStatuses(station_statuses, function (error) {
                        if (error)
                            return callback(error);
                        logger.info('Done fetching');
                    });
                });
            }, interval_ms);
        });
    });
}
exports.watch = watch;
