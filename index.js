var AWS = require('aws-sdk');
var async = require('async');
var util = require('util');
var fs = require("fs");
var s3 = new AWS.S3();
var path = require('path');

var gm = require('gm').subClass({
    imageMagick: true
});


exports.handler = function (event, context, callback) {
  // console.log("%j", event)
  var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  var fileBucket = event.Records[0].s3.bucket.name;
  var s3srcparams = {Bucket: fileBucket, Key: srcKey};
  var fileName = path.basename(srcKey);

  var _800px = {
      width: 800,
      dstnKey: srcKey,
      destinationPath: "large"
  };
  var _500px = {
      width: 500,
      dstnKey: srcKey,
      destinationPath: "medium"
  };
  var _200px = {
      width: 200,
      dstnKey: srcKey,
      destinationPath: "small"
  };
  var _45px = {
      width: 45,
      dstnKey: srcKey,
      destinationPath: "thumbnail"
  };
  var _sizesArray = [_800px, _500px, _200px, _45px];

  async.forEachOf(_sizesArray, function(value, key, callback) {
    async.waterfall([
        function download(next) {
          var t = process.hrtime();
          s3.getObject(s3srcparams, next);
          t = process.hrtime(t);
          console.log("MONITORING|%d|1|count|mattlambda.images.count|#demo:matt, imagefcn:download", Math.floor(Date.now()/1000));
          console.log("MONITORING|%d|%d|gauge|mattlambda.images.exectime|#demo:matt, imagefcn:download", Math.floor(Date.now()/1000), (t[1]/1000000));
        },

        function convert(response, next) {
          console.log("start convert");
          var t = process.hrtime();
          gm(response.Body).antialias(true).density(300).toBuffer('JPG', function(err, buffer) {
            if (err) {
              next(err);
            } else {
              t = process.hrtime(t);
              console.log("MONITORING|%d|%d|gauge|mattlambda.images.exectime|#demo:matt, imagefcn:convert", Math.floor(Date.now()/1000), (t[1]/1000000));
              console.log("MONITORING|%d|1|count|mattlambda.images.count|#demo:matt, imagefcn:convert", Math.floor(Date.now()/1000));
              next(null, buffer);
            }
          });
        },

        function processing(response, next) {
          var t = process.hrtime();
          gm(response).size(function(err, size){
            var scalingFactor = Math.min(_sizesArray[key].width / size.width, _sizesArray[key].width/size.height);
            var width = scalingFactor*size.width;
            var height = scalingFactor*size.height;
            var index = key;

            this.resize(width, height).toBuffer('JPG', function(err, buffer) {
              if(err) {
                next(err);
              } else {
                t = process.hrtime(t);
                console.log("MONITORING|%d|1|count|mattlambda.images.count|#demo:matt, imagefcn:processing", Math.floor(Date.now()/1000));
                console.log("MONITORING|%d|%d|gauge|mattlambda.images.exectime|#demo:matt, imagefcn:processing", Math.floor(Date.now()/1000), (t[1]/1000000));
                next(null, buffer, key);
              }
            });
          });
        },

        function upload(data, index, next) {
          var t = process.hrtime();
          var s3dstparams = {Bucket: fileBucket, Key: "lambda-images-out/" + _sizesArray[index].destinationPath + "/" + fileName.slice(0, -4) + ".jpg", Body: data, ContentType: 'JPG'};
          t = process.hrtime(t);
          console.log("MONITORING|%d|1|count|mattlambda.images.exectime|#demo:matt, imagefcn:upload", Math.floor(Date.now()/1000));
          console.log("MONITORING|%d|%d|gauge|mattlambda.images.count|#demo:matt, imagefcn:upload", Math.floor(Date.now()/1000), (t[1]/1000000));
          s3.putObject(s3dstparams, next);
        }
      ], function(err, result) {
        if (err) {
          console.log(err);
        }
        callback();
      });
  }, function(err) {
    if (err) {
      console.error('unable to resize');
    } else {
      console.log('resized');
    }
  });

};