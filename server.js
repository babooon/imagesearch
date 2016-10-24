var request = require('request');
var express = require('express');
var mongo = require('mongodb').MongoClient;
var app = express();
var url = require('url');
var api_key = process.env.GCSE_APIKEY;
var mongo_url = process.env.MONGOLAB_URI; 


app.use('/api/imagesearch', function(req, res, next){
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    var reqObj = url.parse(req.url, true);
    var query = decodeURI(reqObj.pathname).substring(1);
    if (reqObj.query != null && reqObj.query.offset != undefined && reqObj.query.offset >= 1)
        var offset = reqObj.query.offset;
    else
        var offset = 1;
     
    request('https://www.googleapis.com/customsearch/v1?key='+api_key+'&cx=017251592877870172887:ww56gjgz_cs&alt=json&num=10&start='+offset*10+'&q='+query, function (error, response, body) {
        if (!error && response.statusCode == 200){
            
            var obj = JSON.parse(response.body);
            var out = [];
            
            try{                                        //read response and send results
                for (var i=0; i<obj.items.length; i++){
                    try{
                        out[i] = {
                            img_url: obj.items[i].pagemap.cse_image[0].src,
                            page_url: obj.items[i].link,
                            alt_text: obj.items[i].title
                        };
                    }
                    catch(err){ out[i] = {error: err.toString()}; }
                }
                res.end(JSON.stringify(out));
            }
            catch(err){
                if (err instanceof TypeError)
                    res.end(JSON.stringify(out));
                else{ 
                    res.end(JSON.stringify(err.toString())); console.log(err);
                }
            }
            
            try{                    //save latest query in mongodb
                var latest = {
                    query: query,
                    date: new Date().toString()
                };
                
                mongo.connect(mongo_url, function(err, db) {
                    if (err) throw err;
                    var imagesearch= db.collection('imagesearch');
                    imagesearch.insertOne(latest, function(err, data) {
                        if (err) throw err;
                        db.close();
                    });
                    console.log("MONGO added query: "+JSON.stringify(latest));
                });
            }
            catch(err){console.log(err);}

        }else{
            res.end(body);
            if (response.statusCode == 403) error = "100 requests/day... thx google, far less than any other service >.>";
            console.log(response.statusCode+" - "+error);
        }
    });
});

app.use('/api/latest/imagesearch', function(req, res, next){
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    try{                                                    //print latest 10 queries from mongodb
        mongo.connect(mongo_url, function(err, db) {
            if (err) throw err;
            var imagesearch= db.collection('imagesearch');
            
            imagesearch.find({},{_id: 0}).sort({_id:-1}).limit(10)  //everything, in "natural order"(which is newest->oldest)
                .toArray(function(err, documents) {
                    if (err) throw err;
                    if (documents.length == 0)
                        throw "Error: No data to display.";
                    else
                        res.end(JSON.stringify(documents));
                });
        });
    }
    catch(err){res.end(JSON.stringify(err.toString())); console.log(err)} 
});

app.use('/', function(req, res, next){
    res.end("Nothing to see here!\nimagesearch usage:\n\thttps://"+req.hostname+
    "/api/imagesearch/<your query>?offset=<result pageNr>\tget img_url, alt_tag & page_url for 10 images\n\thttps://"+req.hostname+
    "/api/latest/imagesearch/\t\t\t\t\tget latest 10 queries");
});
 
app.listen(process.env.PORT || 8080);