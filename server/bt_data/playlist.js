/*

	Create playlist object with a project config, a playlist DB already pre-configured, and a Video closure, for comparisons.

*/
module.exports = function(config,playlistdb,Video){

	var playlist = {};
	playlist.db = playlistdb;
	playlist.name = "Playlist";
	playlist._first = null;
	playlist._active = null;
	playlist._last = null;
	playlist._length = 0;
	playlist._lookup = {};

	// Linked List Object

	playlist.add = function(after,video,callback){

		if(!(video instanceof Video)) { playlist.trigger('error',"must add a Video object"); return; }
		if(after && !(after instanceof Video)) { playlist.trigger('error',"must use Video object or null for placement"); return; }
		//console.log("Adding video",video.data.tit,video.data._id);

		// Do we even have a playlist
		if(!playlist._first){

			// Setup first
			playlist._first = {
				prev:null,
				video:video,
				next:null
			};
			playlist._first.prev = playlist._first;
			playlist._first.next = playlist._first;

			// Copy ref to last
			playlist._last = playlist._first;

			// And active.
			playlist._active = playlist._first;

			// Adjust length
			playlist._length++;

			// Hook up the random-access helper
			playlist._lookup[video._id] = playlist._first;

			// Done!
			if(callback)callback();
			return;
		} 

		// If "After" is null or undef, then add to end.
		var insertAfter = playlist._last;
		if(after){
			insertAfter = playlist._lookup[after._id];
			//console.log("inserting after",after._id);
		}

		// General Entry
		var entry = {
			prev:null,
			video:video,
			next:null
		}

		entry.next = insertAfter.next; 		// My next is his next
		entry.prev = insertAfter;			// My prev is him.

		insertAfter.next.prev = entry;		// His next's previous is me.
		insertAfter.next = entry;			// His next is me.

		// Check for end of list
		if(insertAfter == playlist._last){
			playlist._last = entry; // If we just inserted ourselves "after" the last element, the new element is the last one.
		}

		// Hook up the random-access helper
		playlist._lookup[video._id] = entry;

		// Adjust length
		playlist._length++;

		if(callback)callback();

	}

	playlist.save = function(callback){

		console.log("called Save");
		var flat = [];
		var elem = playlist._first;
		for(var i=0;i<playlist._length;i++){
			elem.video.save();
			flat[i] = (elem.video.data._id);
			//console.log(elem);
			elem = elem.next;
		}
		//console.log(flat);
		playlist.db.update({ name: playlist.name }, { name: playlist.name, videos: flat }, { upsert: true }, function (err, numReplaced, upsert) {
			if(err) console.log(err);
			if(callback) callback(err, numReplaced, upsert);
		});

	}

	playlist.load = function(callback){

		playlist.db.findOne({ name: playlist.name }, function (err, doc) {
			if(err) {
				console.log(err);
				return;
			}

			if(!doc || doc.length == 0) return;

			var toadd = doc.videos;
			var last = null;
			var done = function(){
				console.log("Playlist now",playlist._length,"Videos Long");
				if(callback)callback();
			}
			var deque = function(){
				var videoid = toadd.shift();
				var vid = new Video(videoid,function(){		// Init the video
					playlist.add(last,vid,function(){	// Add to playlist
						if(toadd.length > 0){		// Check queue
							last = vid; // remember last one for placing.
							deque();
						} else {
							done();
						}
					});
					
				});
			}
			deque();

		})
	}

	playlist.trigger = function(event,message){
		console.log(event,message);
	}

	//playlist.load(db);
	return playlist;

};
