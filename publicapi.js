"use strict";
var request = require("request");
var PublicAPI = (function () {
    function PublicAPI(ApiKey) {
        this.ApiKey = ApiKey;
    }
    Object.defineProperty(PublicAPI.prototype, "request", {
        get: function () {
            return request.defaults({
                headers: {
                    'ApiKey': this.ApiKey,
                    'Accept': '*/*',
                    'Accept-Language': 'en;q=1',
                    'User-Agent': 'B-cycle Now/1.0.2 (iPhone; iOS 8.1; Scale/2.00)',
                },
                gzip: true,
                json: true,
            });
        },
        enumerable: true,
        configurable: true
    });
    PublicAPI.prototype.listPrograms = function (callback) {
        this.request.get({
            url: 'https://publicapi.bcycle.com/api/1.0/ListPrograms',
        }, function (error, response, body) {
            if (error)
                return callback(error);
            if (response.statusCode != 200) {
                return callback(new Error("PublicAPI error: " + response.statusCode + ": " + body));
            }
            callback(null, body);
        });
    };
    /**
    Fetch all Kiosks for the given program.
    `id` should be B-cycle's internal "ProgramId" identifier.
    */
    PublicAPI.prototype.listProgramKiosks = function (id, callback) {
        this.request.get({
            url: "https://publicapi.bcycle.com/api/1.0/ListProgramKiosks/" + id,
        }, function (error, response, body) {
            if (error)
                return callback(error);
            if (response.statusCode != 200) {
                return callback(new Error("PublicAPI error: " + response.statusCode + ": " + body));
            }
            callback(null, body);
        });
    };
    return PublicAPI;
}());
exports.PublicAPI = PublicAPI;
