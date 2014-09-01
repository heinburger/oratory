//be careful with plurals - all the singular words are dealing with one object, and the plurals are dealing with multiple
//database types:
//	item
//	location
//	staged (add a staged deleted?)
//	history
//	deleted
//  lock
//allowable push changes:
//	flag
//	comment

console.log('server running');

//CONFIG -------------------------------------------------------------------------------------
//database
var mongojs = require('mongojs');
var db = mongojs('mongodb://localhost:27017/itemdb', ['itemdb']);
//app engine
var express = require('express'),
    app = express();
//app configuration
app.configure(function(){
    app.use(app.router);
    app.use(express.static(__dirname + '/www'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
//email auth
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
smtpTrans = nodemailer.createTransport(smtpTransport({
	service:'gmail',
 	auth: {
      	user: "colabrobot@gmail.com",
      	pass: "r0b0tp4r4d3" 
  	}
}));
//the following are used for images (but can also be used for a shit-ton of other things)
var fs = require('fs');
var request = require('request');
var url = require('url');
//image manipulation (for thumbnails)
var gm = require('gm').subClass({ imageMagick: true });

//????????????????????????????????????????????????????????????
//make directory for item images:
fs.mkdir('/vagrant/www/images/items/'); //might need to change this because it dont want it to write over the directory
//????????????????????????????????????????????????????????????


//API ---------------------------------------------------------------------------------------



//ITEMS  --------------------------------
app.get('/api/getDatabase', function (req, res) {
	db.itemdb.find('', function (err, docs) {
		if(err){ console.log('(error getting database) '+err);}else { res.send(docs); }
	});
});//end GET database

app.get('/api/getItems', function (req, res) {
	db.itemdb.find({type:'item'},function (err, docs) {
		if(err){ console.log('(error getting items) '+err); }else{ res.send(docs); }
	});
});//end GET items

app.get('/api/getDeletedItems', function (req, res) {
	db.itemdb.find({type:'deleted'},function (err, docs) {
		if(err){ console.log('(error getting deleted items) '+err); }else{ res.send(docs); }
	});
});//end GET deleted items

app.post('/api/getItemHistory', express.json(), function (req, res) {
	db.itemdb.find({type:'history', forUID:req.body.uid},function (err, docs) {
		if(err){ console.log('(error getting item history) '+err); }else{ res.send(docs); }
	});
});//end GET item history

//for an example of this - see "testing calls" bottom of item.js
app.post('/api/getItem', function (req, res) {
	db.itemdb.findOne(req.body, function (err, doc) {
		if(err){ console.log('(error getting item) '+err); }else{ res.send(doc); }
	});
});//end 'GET' (single) item - send the uid and retrieve item (untested - send multiple uid's?)

app.post('/api/saveItem',express.json(), function (req, res) {
	db.itemdb.insert(req.body, function (err, doc) { 
		if(err){ console.log('(error saving item) '+err); }else{ res.send(doc); } 
	});
});//end SAVE single item

app.post('/api/removeItem', express.json(), function (req, res) {
	//insert a deleted type
	db.itemdb.insert({type:'deleted', data:req.body});
	//remove item
	db.itemdb.remove({uid:req.body.uid}, function (err, doc) {
		if(err){ console.log('(error removing item) '+err); }else{ res.send(doc); }
	});
});//end REMOVE single item

app.post('/api/updateItem', express.json(), function (req, res) {
	db.itemdb.find({type:'item', uid:req.body.uid}, function (err, old) {
		db.itemdb.insert({type:'history', forUID:old[0].uid, data:old[0] }, function (err, doc) {});
	});
	db.itemdb.update({uid: req.body.uid}, req.body, function (err, doc) {
		if(err){ console.log('(error updating item) '+err); }else{ res.send(doc); }
	});

});//end UPDATE single item

app.post('/api/pushToItem', express.json(), function (req, res) {
	var pushValue = {};
	pushValue.$set = {};
	pushValue.$set[req.body.push] = req.body.value; 
	db.itemdb.update({uid: req.body.pushToUID}, pushValue, function (err, doc) {
		if(err){ console.log('(error updating item) '+err); }else{ res.send(doc); }
	});

});//end PUSH to single item

app.post('/api/stageItem', express.json(), function (req, res) {
	db.itemdb.insert({type:'staged', key:req.body.actionKey, modifiedItem:req.body.data}, function (err, doc) {
		if(err){ console.log('(error staging item) '+err); }else{ res.send(doc); }
	});
});//end 'STAGE' single item

app.get('/api/unStage/:key/:decision', function (req, res) {
	if (req.params.decision) { //true!
		//find the staged item based on key
		db.itemdb.find({type:'staged', key:req.params.key}, function (err, doc) {
			//for some reason - it is returning an array......
			modifiedItem = doc[0].modifiedItem;
			//slap in the historical item
			db.itemdb.find({type:'item', uid:modifiedItem.uid}, function (err, old) {
				db.itemdb.insert({type:'history', forUID:old[0].uid, data:old[0] }, function (err, doc) {});
			});
			//remove stageLock
			modifiedItem.stageLock = false;
			//update with new item data
			db.itemdb.update({uid:modifiedItem.uid}, modifiedItem);
		});
		//remove the staged item
		db.itemdb.remove({type:'staged', key:req.params.key}, function (err, doc) {});
	} else { //false
		console.log('decided against it...');
	}
});//end 'UNSTAGE' single item


//IMAGES --------------------------------
app.post('/api/saveImage', express.json(), function (req, res) {
	request.get({url: url.parse(req.body.imageURL), encoding: 'binary'}, function (err, response, body) {
		console.log('trying to save the image for item: '+req.body.name);
		var path = '/vagrant/www/images/items/'+req.body.uid+'/';
		fs.mkdir(path);
	    fs.writeFile(path+"itemImage.jpg", body, 'binary', function(err) {
	    	if(err) { console.log(err); }else{ 
	    		//save image thumbnail
	    		console.log("The file was saved!"); 
	    		gm(path+'itemImage.jpg').resize('60','60').gravity('center').write(path+'itemThumb.jpg', function(err) {
	    			if(err) { console.log(err); }else{ console.log("Image thumbnail saved"); }
	    		});//end save image thumb
	    	}//end save image
	    }); 
	});
}); //end SAVE image




//EMAILS --------------------------------
app.post('/api/sendEmail', express.json(), function (req, res){

	console.log('trying to send email to ' + req.body.to);
	smtpTrans.sendMail({
	    from: 'Robot <colabrobot@gmail.com>',
	    to: req.body.to,
	    subject: req.body.subject,
	    text: 'text body',
	    html: req.body.HTMLbody
	}, function (err, doc){
	    if(err){ console.log(err); }else{ 
	    	//email was sent!
	    	res.send(250);
	    	console.log('Message sent: ' + doc.response); }
	});
    
});
	


//DICTIONARIES --------------------------------
//locations:
app.get('/api/getLocations', function (req,res) {
	db.itemdb.find({type:'location'}, function (err, doc) {
		if(err){ console.log(err); }else{ res.send(doc); }
	});
});//end GET locations
app.post('/api/saveLocation', express.json(), function (req, res) {
	db.itemdb.insert(req.body, function (err, doc) {
		if(err){ console.log(err); }else{ res.send(doc); }
	});
});//end SAVE location

//form fields:
//GET form fields....
//app.post('/api/saveField', express.json(), function (req, res) {
//	db.itemdb.insert(req.body);
//});//end SAVE form field




//EXPERIMENTS --------------------------------
app.get('/api/getScopeFunctions', function (req,res) {
	fs.readFile('www/js/item.js', 'utf8', function (err,data) {
		if (err) { console.log(err); }else{
			matches = data.match(/\$scope\.[A-Za-z]+\s\=\sfunction\s\(/g);
			bettermatches = [];
			for (i=0; i <matches.length; i++) { bettermatches[i]=matches[i].match(/\w+\b/g)[1]; }
			res.send(bettermatches);
	    }
	});

});



app.listen(80);
