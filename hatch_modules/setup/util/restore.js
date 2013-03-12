//
// Hatch.js is a CMS and social website building framework built in Node.js 
// Copyright (C) 2013 Inventures Software Ltd
// 
// This file is part of Hatch.js
// 
// Hatch.js is free software: you can redistribute it and/or modify it under the terms of the
// GNU General Public License as published by the Free Software Foundation, version 3
// 
// Hatch.js is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// 
// See the GNU General Public License for more details. You should have received a copy of the GNU
// General Public License along with Hatch.js. If not, see <http://www.gnu.org/licenses/>.
// 
// Authors: Marcus Greenwood, Anatoliy Chakkaev and others
//

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var unzip = require('unzip');
var async = require('async');
var streamBuffers = require('stream-buffers');

//runs a restore from the specified data
exports.run = function(c, path, domain, done) {
    //disable hooks
    c.api.hooks.enabled = false;

    //trim the domain to remove all slashes
    domain = domain.replace('http://', '').replace('https://', '').split('/')[0];

    //if we have a zip, unzip and import the data within
    if(path.split('.').pop() === 'zip') {
        fs.createReadStream(path)
            .pipe(unzip.Parse())
            .on('entry', function (entry) {
                var writableStream = new streamBuffers.WritableStreamBuffer();
                writableStream.on('close', function () {
                    runImport(writableStream.getContentsAsString('utf8'));
                });
                entry.pipe(writableStream);             
        });
    } 
    else {
        runImport(entry.path);
    }

    //imports json data
    function runImport(data) {
        if(data.indexOf('{') == -1) data = fs.readFileSync(path);
        data = JSON.parse(data);

        //sort the model data
        var firstModels = ['Group', 'Page', 'User'];
        data = _.sortBy(data, function(modelData) { return firstModels.indexOf(modelData.model) > -1 ? (-10 + firstModels.indexOf(modelData.model)) : 1 });

        //import each model, one by one
        async.forEachSeries(data, function(modelData, next) {
            var model = c.api.db.models[modelData.model];
            var i = 1;
            var j = 1;

            console.log('start: ' + modelData.model);

            //set the database index for this model
            c.api.db.client.set('id:' + (c.api.app.config.database.prefix ? (c.api.app.config.database.prefix + '/') : '') + modelData.model, modelData.id);


            if(!modelData.data || modelData.data.length == 0) {
                console.log('done ' + modelData.model + ' with no data');

                return next();
            }

            //import all of the data
            async.forEachSeries(modelData.data, function(entity, next) {
                fixDomain(entity);
                
                //abandon entity import if it takes more than 1000 ms
                var timeout = setTimeout(function() { abandon(entity); }, 1000);

                console.log('import: ' + entity.id + ' = ' + (i++) + '/' + modelData.count);

                //create the data in the database
                model.create(entity, function(err, entity) {
                    //never error
                    if(err) console.log(err);

                    console.log('created: ' + entity.id + ' = ' + (j++) + '/' + modelData.count);
                    clearTimeout(timeout);

                    next();
                });

                //abandons import and progresses to the next entity
                var abandon = function(entity) {
                    console.log('failed to import ' + entity.id);
                    console.log(entity);
                    return next();
                };

            }, function(results) {
                console.log('done: ' + modelData.model);
                next();
            });

        }, function(results) {
            console.log('ALL DONE');

            //update the group cached urls
            var Group = c.api.db.models.Group;
            var Page = c.api.db.models.Page;

            Group.all({}, function(err, groups) {
                groups.forEach(function(group) {
                    Page.updateGroup(group.id);
                });

                //re-enable hooks
                c.api.hooks.enabled = true;

                //we're all done here - callback
                done();
            });
        });
    }

    //fixes the domain for each entity
    function fixDomain(entity) {
        Object.keys(entity).forEach(function(key) {
            if(key === 'url' || key.indexOf('Url') > -1) {
                var val = entity[key];
                if(!val) return;

                //if we have a slash, replace everything before it
                if(val.indexOf('/') > -1) {
                    val = domain + val.substring(val.indexOf('/'));
                } 
                //otherwise replace the entire thing - it is just the domain
                else if(val.indexOf(':') > -1) {
                    val = domain;
                }

                entity[key] = val;
            }
        });
    }
};