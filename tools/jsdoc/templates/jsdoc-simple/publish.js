/** Called automatically by JsDoc Toolkit. */
function publish(symbolSet) {
	publish.conf = {  // trailing slash expected for dirs
		ext:         ".html",
		outDir:      JSDOC.opt.d || SYS.pwd+"../out/jsdoc/",
		templatesDir: JSDOC.opt.t || SYS.pwd+"../templates/jsdoc/",
		symbolsDir:  "page/",
		srcDir:      "page/src/"
	};
	
	// is source output is suppressed, just display the links to the source file
	if (JSDOC.opt.s && defined(Link) && Link.prototype._makeSrcLink) {
		Link.prototype._makeSrcLink = function(srcFilePath) {
			return "&lt;"+srcFilePath+"&gt;";
		}
	}
	
	// create the folders and subfolders to hold the output
	IO.mkPath((publish.conf.outDir+"page/src").split("/"));
		
	// used to allow Link to check the details of things being linked to
	Link.symbolSet = symbolSet;

	// create the required templates
	try {
		var classTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"class.tmpl");
		var classesTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"allclasses.tmpl");
	}
	catch(e) {
		print("Couldn't create the required templates: "+e);
		quit();
	}
	
	// some utility filters
	function hasNoParent($) {return ($.memberOf == "")}
	function isaFile($) {return ($.is("FILE"))}
	function isaNamespace($) {return $.isNamespace && !$.isBuiltin()}
	function isaClass($) {return $.is("CONSTRUCTOR")}
	
	// get an array version of the symbolset, useful for filtering
	var symbols = symbolSet.toArray();
	
	// create the hilited source code files
	var files = JSDOC.opt.srcFiles;
 	for (var i = 0, l = files.length; i < l; i++) {
 		var file = files[i];
 		var srcDir = publish.conf.outDir + "page/src/";
		makeSrcFile(file, srcDir);
 	}
 	
 	var aliasSort = makeSortby('alias');
 	
 	// get a list of all the classes in the symbolset
 	var classes = symbols.filter(isaClass).sort(aliasSort);
 	
 	var namespaces = symbols.filter(isaNamespace).sort(aliasSort).reverse();
 	var nav = [];
 	var list = [];
 	for (var i = 0; i < classes.length; i++) list.push(classes[i]);
 	for (var i = 0; i < namespaces.length; i++) {
 	  var filtered = list.filter(makeFilterFor(namespaces[i].alias));//.sort(aliasSort).reverse();
 	  for (var j = 0; j < filtered.length; j++) {
 	    nav.unshift(filtered[j]);
 	    list = array_remove(list, filtered[j]);
 	  }
 	  nav.unshift(namespaces[i]);
 	}
 	// any remaining non-namespaced classes
 	if (list.length > 0) {
 	  list.reverse();
 	  for (var i = 0; i < list.length; i++) {
 	    nav.unshift(list[i]);
 	  }
 	}
	
	
	// create a class index, displayed in the left-hand column of every class page
	Link.base = "../";
 	publish.classesIndex = classesTemplate.process(nav); // kept in memory
	
	// create each of the class pages
	for (var i = 0, l = classes.length; i < l; i++) {
		var symbol = classes[i];
		
		symbol.events = symbol.getEvents();   // 1 order matters
		symbol.methods = symbol.getMethods(); // 2
		
		var output = "";
		output = classTemplate.process(symbol);
		
		IO.saveFile(publish.conf.outDir+"page/", symbol.alias+publish.conf.ext, output);
	}
	
	// regenerate the index with different relative links, used in the index pages
	Link.base = "";
	publish.classesIndex = classesTemplate.process(nav);
	
	// create the class index page
	try {
		var classesindexTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"index.tmpl");
	}
	catch(e) { print(e.message); quit(); }
	
	var classesIndex = classesindexTemplate.process(classes);
	IO.saveFile(publish.conf.outDir, "index"+publish.conf.ext, classesIndex);
	classesindexTemplate = classesIndex = classes = null;
	
	// copy over default.css
	IO.saveFile(publish.conf.outDir, "default.css", include("default.css"));
}


/** Just the first sentence (up to a full stop). Should not break on dotted variable names. */
function summarize(desc) {
	if (typeof desc != "undefined")
		return desc.match(/([\w\W]+?\.)[^a-z0-9_$]/i)? RegExp.$1 : desc;
}

/** Make a symbol sorter by some attribute. */
function makeSortby(attribute) {
	return function(a, b) {
		if (a[attribute] != undefined && b[attribute] != undefined) {
			a = a[attribute].toLowerCase();
			b = b[attribute].toLowerCase();
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		}
	}
}

function makeFilterFor(ns) {
  var name = ns;
  return function(cl) {
    return new RegExp('^'+name).test(cl.alias);
  }
}

/** Pull in the contents of an external file at the given path. */
function include(path) {
	var path = publish.conf.templatesDir+path;
	return IO.readFile(path);
}

/** Turn a raw source file into a code-hilited page in the docs. */
function makeSrcFile(path, srcDir, name) {
	if (JSDOC.opt.s) return;
	
	if (!name) {
		name = path.replace(/\.\.?[\\\/]/g, "").replace(/[\\\/]/g, "_");
		name = name.replace(/\:/g, "_");
	}
	
	var src = {path: path, name:name, charset: IO.encoding, hilited: ""};
	
	if (defined(JSDOC.PluginManager)) {
		JSDOC.PluginManager.run("onPublishSrc", src);
	}

	if (src.hilited) {
		IO.saveFile(srcDir, name+publish.conf.ext, src.hilited);
	}
}

/** Build output for displaying function parameters. */
function makeSignature(params) {
	if (!params) return "()";
	var signature = "("
	+
	params.filter(
		function($) {
			return $.name.indexOf(".") == -1; // don't show config params in signature
		}
	).map(
		function($) {
			return $.name;
		}
	).join(", ")
	+
	")";
	return signature;
}

/** Find symbol {@link ...} strings in text and turn into html links */
function resolveLinks(str, from) {
	str = str.replace(/\{@link ([^} ]+) ?\}/gi,
		function(match, symbolName) {
			return new Link().toSymbol(symbolName);
		}
	);
	
	return str;
}

function array_remove(arr, item) {
  var left = [];
  for (var x = 0; x < arr.length; x++) {
    if (arr[x] != item) left.push(arr[x]);
  }
  return left;
}
