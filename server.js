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
    var offset = 1;
    if (reqObj.query != null && reqObj.query.offset != undefined && reqObj.query.offset >= 1)
        offset = reqObj.query.offset;
     
    request('https://www.googleapis.com/customsearch/v1?key='+api_key+'&cx=017251592877870172887:ww56gjgz_cs&alt=json&num=10&searchType=image&start='+offset*10+'&q='+query, function(error, response, body){
        if (error || response.statusCode !== 200){
            res.end(body);
            console.log(response.statusCode+" - "+error);
        }else{
            var obj = JSON.parse(response.body);
            var out = [];
                
            for (var i=0; i<obj.items.length; i++){
                try{
                    out[i] = {
                        img_url: obj.items[i].link,
                        page_url: obj.items[i].image.contextLink,
                        alt_text: obj.items[i].snippet
                    };
                }catch(err){ out[i] = {error: err.toString()}; }
            }
            res.end(JSON.stringify(out));
        
            var latest = {
                query: query,
                date: new Date().toString()
            };
                
            mongo.connect(mongo_url, function(err, db) {
                if (err) return console.log(err);
                    var imagesearch= db.collection('imagesearch');
                    imagesearch.insertOne(latest, function(err, data) {
                        if (err) return console.log(err);
                        db.close();
                    });
                    console.log("MONGO added query: "+JSON.stringify(latest));
            });
        }
    });
});

app.use('/api/latest/imagesearch', function(req, res, next){
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });

        mongo.connect(mongo_url, function(err, db) {
            if (err) return console.log(err);
            var imagesearch= db.collection('imagesearch');
            
            imagesearch.find({},{_id: 0}).sort({_id:-1}).limit(10)
                .toArray(function(err, documents) {
                    if (err)return console.log(err);
                    if (documents.length == 0) documents[0] = JSON.stringify({error: "No data to display."});
                    res.end(JSON.stringify(documents));
                });
        });
});

app.use('/', function(req, res, next){
    res.end("Nothing to see here!\nimagesearch usage:\n\thttps://"+req.hostname+
    "/api/imagesearch/<your query>?offset=<result pageNr>\tget img_url, alt_tag & page_url for 10 images\n\thttps://"+req.hostname+
    "/api/latest/imagesearch/\t\t\t\tget latest 10 queries");
});
 
app.listen(process.env.PORT || 8080);