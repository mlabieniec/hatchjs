module.exports = SessionController;

function SessionController() {
}

SessionController.prototype.create = function(c) {
    var compound = c.compound;
    var login = c.body.email.toLowerCase();
    var pass = c.body.pass;
    var User = c.User;

    User.findOne({where: { email: login }}, function (err, user) {
        if (user || err) return searchDone(err, user);
        User.findOne({where: { username: login }}, searchDone);
    });

    function searchDone(err, user) {
        //only ever show one error message - we don't want to confirm whether an email address or username is in the db
        var error = 'User not found or incorrect password';

        var message = false;
        if (user && !err) {
            // if the user has an import password, change their password and allow them to login
            if (User.verifyPassword('_import_', user.password)) {
                user.password = c.body.password;
                user.save(function() {
                    c.req.session.userId = user.id;
                    c.send({user: user, message: message});
                });

                return;
            }

            // standard password verification
            if (User.verifyPassword(c.body.password, user.password)) {
                compound.hatch.hooks.hook(c, 'User.beforeLogin', { user: user }, function() {
                    c.req.session.userId = user.id;

                    compound.hatch.hooks.hook(c, 'User.afterLogin', { user: user }, function() {
                        if (c.params.format === 'json') {
                            if (message) {
                                user = null;
                            } else {
                                user = user.toObject();
                                delete user.password;
                            }

                            c.send({user: user, message: message});
                        } else {
                            c.redirect(c.pathTo.root());
                        }
                    });
                });
            } else {
                c.send({ message: error });
            }
        } else {
            c.send({ message: error });
        }
    }
};

SessionController.prototype.destroy = function(c) {
    delete c.req.session.userId;
    c.redirect(c.pathTo.root());
};
