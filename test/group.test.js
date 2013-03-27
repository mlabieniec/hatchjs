var Group, Page, app, compound;
var should = require('should');

describe.only('Group', function() {

    before(function (done) {
        app = getApp();
        compound = app.compound;
        compound.on('ready', function() {
            Group = compound.models.Group;
            Page = compound.models.Page;
            Group.destroyAll(function() {
                Page.destroyAll(function() {
                    compound.seed(done);
                });
            });
        });
    });

    it('should create clone', function(done) {
        Group.findOne({where:{url: 'example.com'}}, function(e, g) {
            g.clone({
                url: 'example.com/1602',
                name: 'Example 1602'
            }, function(e, clone) {
                should.not.exist(e);
                should.exist(clone);
                clone.url.should.equal('example.com/1602');
                clone.homepage.url.should.equal('example.com/1602');
                g.subgroups.map(function(x) {
                    return x.path;
                }).should.include(clone.path);
                done();
            });
        });
    });
});