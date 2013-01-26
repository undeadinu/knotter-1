/**
 * Knot HttpServer
 *
 * @author Patrice FERLET
 * @licence GPLv3
 *
 */

var http = require('http');
var mime = require('mime');
var fs   = require('fs');
var url  = require('url');
var _ = require('underscore');
var sessions = require('sessions');
var handler = require('./handler.js');

/**
 * Server is HTTP Server
 *
 * @params options (port, handlers, statics...)
 * @todo manage https
 */
var Server = function (options) {
    this.port = options['port'] || 8000;
    this.handlers = [];
    this.sessionHandler = new sessions();

    if (options['handlers']) {
        for (var i = 0; i < options.handlers.length; i++) {
            this.addHandler(options.handlers[i]);
        }
    }
    if (options['statics']) {
        for (i in options.statics) {
            this._serveStatic(options.statics[i]);
        }
    }
    handler.init(options);
};

/**
 * Add handler to serve static files
 *
 * @params directory
 */
Server.prototype._serveStatic = function (dir){
    this.addHandler(new handler.Handler({
        route: '/'+dir+'/.*',
        get: function (){
            var u = url.parse(this.request.url, false);
            var filename = u.pathname.slice(1);

            try {
                fs.realpathSync(filename);   
                var mimetype = mime.lookup(filename);
                var self = this;
                fs.readFile(filename, function (err, data){
                    if (err) {
                        console.log(err);
                        self.response.writeHead(500);
                        self.response.end("Error 500" + err);
                        return;
                    }

                    self.response.writeHead(200, {
                        'Content-Type' : mimetype,
                        'Content-Length' : data.length
                    });

                    self.response.end(data);
                });
            }
            catch(e){
                console.log(e);
                this.response.writeHead(404, "Not found");
                this.response.end();
                return;
            }


        }
    }));
};

/**
 * Add Handler in server registry
 *
 */
Server.prototype.addHandler = function (handler){
    handler.__reg = new RegExp(handler.route);
    this.handlers.push(handler);
};


/**
 * Called on each request to get handler mapped to
 * the called route
 *
 * @params request
 * @params result
 * @todo manage postdata for each request excepting GET
 */
Server.prototype.handle = function (req, res) {
    for (i in this.handlers) {
        var params = null;
        if ((params = req.url.match(this.handlers[i].__reg))) {
            var method = req.method.toLowerCase();
            // to not interact on same request/result while
            // working on simulatneous connections
            var handler = _.clone(this.handlers[i]);
            if (handler[method]) {
                handler.response = res;
                handler.request = req;
                handler.params = params;
                this.sessionHandler.httpRequest(req, res, function (err, session){
                    handler.sessions = session;
                    handler[method]();
                });
                return;
            }
        }
    }
    res.writeHead(404, "Not found");
    res.end();
    return;
};


/**
 * Start to serve http
 *
 * @todo set listening address
 */
Server.prototype.serve = function () {
    var self = this;
    this.server = http.createServer(function (req, res){
        self.handle(req, res);
    });
    this.server.listen(this.port, "0.0.0.0");
    console.log("Server listening on "+this.port);
};


module.exports = {
        Server: Server
};
