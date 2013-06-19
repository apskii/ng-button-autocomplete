//ReSharper disable UseOfImplicitGlobalInFunctionScope

/*
The Enviance.SDK requires jQuery 1.8.3 (/Packages/Libs/jquery.1.8.3.min.js) and JSON2 (/Packages/Libs/json2.js).
To resolve a conflict with jQuery versions use <noConflict> instruction (http://api.jquery.com/jQuery.noConflict/).
*/

//
//References check
//

if (typeof jQuery == "undefined") {
	var message = "jQuery library is required to run Enviance.SDK javascript library";
	alert(message); throw new Error(message);
}

if (window.JSON == null || window.JSON.stringify == null || window.JSON.parse == null) {
	var message = "json2.js  library is required to run Enviance.SDK javascript library";
	alert(message); throw new Error(message);
}

envianceRegisterNamespace = function(ns) {
	var nsParts = ns.split(".");
	var root = window;

	for (var i = 0; i < nsParts.length; i++) {
		if (typeof root[nsParts[i]] == "undefined")
			root[nsParts[i]] = new Object();

		root = root[nsParts[i]];
	}
};

envianceRegisterNamespace("envianceSdk");
envianceSdk = (function(envianceSdk) {
	// ReSharper disable InconsistentNaming
	var _private = envianceSdk._private = envianceSdk._private || { };
	var _seal = envianceSdk._seal = envianceSdk._seal || function() {
		delete envianceSdk._private;
		delete envianceSdk._seal;
		delete envianceSdk._unseal;
	};
	var _unseal = envianceSdk._unseal = envianceSdk._unseal || function() {
		envianceSdk._private = _private;
		envianceSdk._seal = _seal;
		envianceSdk._unseal = _unseal;
	};
	// ReSharper restore InconsistentNaming

	/*
	Private declarations
	*/

	_private._RequestContext = function(type, url, data, headers, onsuccess, onerror) {
		this.type = type;
		this.url = url;
		this.data = data;
		this.headers = headers;
		this.onsuccess = onsuccess;
		this.onerror = onerror;
	};

	_private._CrossDomainSupport = function() {
		this.rpcSocket = null;
	};
	_private._CrossDomainSupport.prototype = {
		rpcSocket: null,
		isRequired: function(url) {
			return this.isAllowed() && this.isCrossDomainUrl(url);
		},
		isAllowed: function() {
			if (_private._crossDomainWorkaround == "always") {
				return true;
			} else if (_private._crossDomainWorkaround == "off") {
				return false;
			} else if (_private._crossDomainWorkaround == "ifneeded") {
				return !jQuery.support.cors || jQuery.browser.mozilla || jQuery.browser.opera ||
					(jQuery.browser.webkit && navigator.userAgent.indexOf("Chrome") == -1);
			} else {
				throw new Error("Illegal settings: unknown _private._crossDomainWorkaround value.");
			}
		},
		isCrossDomainUrl: function(url) {
			if (url[0] == "/" || url[0] == ".") {
				return false;
			}
			var reUri = /^((http.?:)\/\/([^:\/\s]+)(:\d+)*)/; // returns groups for protocol (2), domain (3) and port (4)

			var m = url.toLowerCase().match(reUri);
			var proto = m[2], domain = m[3], port = m[4] || "";
			if ((proto == "http:" && port == ":80") || (proto == "https:" && port == ":443")) {
				port = "";
			}
			var location = proto + "//" + domain + port + "/";
			return document.location.href.indexOf(location) == -1;
		},
		ajax: function(options, callback, onerror) {
			this._createOrGetSocket(function(socket) {
				socket.xhrrequest(options, callback, onerror);
			}, onerror);
		},
		_createOrGetSocket: function(callback, onerror) {
			if (this.rpcSocket != null) {
				callback(this.rpcSocket);
				return;
			}

			var self = this;

			//load easyXDM.js
			if (typeof easyXDM == "undefined") {
				jQuery.ajax({
					url: _private._buildUrl("crossdomain/easyXDM.js"),
					dataType: "script",
					cache: true,
					success: function(data, textStatus) {
						if (typeof easyXDM == "undefined") {
							var msg = "Failed to setup crossdomain support. Failed to execute easyXDM.js. Status=" + textStatus;
							_private._processError(msg, 1250, msg, onerror);
						}
						self._createSocket(callback, onerror);
					},
					error: function(jqXhr, textStatus) {
						var msg = "Failed to setup crossdomain support. Failed to load easyXDM.js. Status=" + textStatus;
						_private._processError(msg, textStatus, msg, onerror);
					}
				});
			} else {
				this._createSocket(callback, onerror);
			}
		},
		_createSocket: function(callback) {
			//setup easyXDM socket
			envianceSdk.rpcSocket = new easyXDM.Rpc({
					swf: _private._buildUrl("crossdomain/easyxdm.swf"),
					remote: _private._buildUrl("crossdomain/crossdomain.htm")
				}, {
					remote: {
						xhrrequest: { } //interface
					},
					serializer: {
						stringify: function(object) {
							return JSON.stringify(object);
						},
						parse: function(json) {
							return JSON.parse(json);
						}
					}
				});
			callback(envianceSdk.rpcSocket);
		}
	};

	//used by default
	_private._SimpleVariablesManager = function() {
		this.SESSION_KEY = "envianceSdk.sessionId";
		this.SYSTEM_KEY = "envianceSdk.systemId";
		this.USER_KEY = "envianceSdk.userId";
		this.vars = new Object();
	};

	_private._SimpleVariablesManager.prototype = {
		readSessionId: function() {
			return this.vars[this.SESSION_KEY];
		},
		writeSessionId: function(sessionId) {
			this.vars[this.SESSION_KEY] = sessionId;
		},
		readSystemId: function() {
			return this.vars[this.SYSTEM_KEY];
		},
		writeSystemId: function(systemId) {
			this.vars[this.SYSTEM_KEY] = systemId;
		},
		readUserId: function() {
			return this.vars[this.USER_KEY];
		},
		writeUserId: function(userId) {
			this.vars[this.USER_KEY] = userId;
		}
	};

	//useful in standalone mode
	_private._CookieVariablesManager = function() {
		this.SESSION_KEY = "envianceSdk.sessionId";
		this.SYSTEM_KEY = "envianceSdk.systemId";
	};

	_private._CookieVariablesManager.prototype = {
		readSessionId: function() {
			return this.getCookieValue(this.SESSION_KEY);
		},
		writeSessionId: function(sessionId) {
			this.saveCookieValue(this.SESSION_KEY, sessionId, false, true);
		},
		readSystemId: function() {
			return this.getCookieValue(this.SYSTEM_KEY);
		},
		writeSystemId: function(systemId) {
			this.saveCookieValue(this.SYSTEM_KEY, systemId, false);
		},
		saveCookieValue: function(key, value, persistent, secure) {
			if (value != null) {
				var cookieVal = key + "=" + escape(value);
				if (persistent == true) {
					var time = new Date();
					time.setFullYear(time.getFullYear() + 10);
					cookieVal += ";expires=" + time.toUTCString();

				}
				document.cookie = cookieVal + ";path=/;" + ((secure == true) ? "secure;" : "");
			} else {
				document.cookie = key + "=;path=/;expires=Fri, 31 Dec 1950 23:59:59 GMT;" + ((secure == true) ? "secure;" : "");
			}
		},
		getCookieValue: function(name) {
			var search = name + "=";
			if (document.cookie.length > 0) { // if there are any cookies
				var offset = document.cookie.indexOf(search);
				while (offset != -1) {
					if (offset > 0) {
						var ch = document.cookie.charAt(offset - 1);
						if (ch != ";" && ch != " ") {
							offset = document.cookie.indexOf(search, offset + 1);
							continue;
						}
					}
					offset += search.length;
					// set index of beginning of value
					var end = document.cookie.indexOf(";", offset);
					// set index of end of cookie value
					if (end == -1)
						end = document.cookie.length;
					return unescape(document.cookie.substring(offset, end));
				}
			}
			return null;
		}
	};

	//Detect additional error status: "heavyload", "requestlimit", "unauthorized"
	_private._GenericErrorHandler = function() {
	};
	_private._GenericErrorHandler.prototype = {
		detectStatus: function(xhr, status) {
			var isDisconnected = false;
			var text = "";
			if (xhr != null) {
				try {
					if (xhr.status == 12029 || xhr.status == 12007) {
						isDisconnected = true;
					}
					if (xhr.responseText != null) {
						text = xhr.responseText;
					}
				} catch(communicationError) {
					isDisconnected = true;
				}
			}
			if (isDisconnected) {
				return "timeout";
			}
			if (text.indexOf("heavy load") != -1 || text.indexOf("Timeout expired") != -1) {
				return "heavyload";
			}
			if (xhr.status == 401) {
				return "unauthorized";
			}
			if (xhr.status == 503) {
				return "requestlimit";
			}
			return status;
		},
		handle: function(xhr, status, message, onsuccess, onerror, context) {
			if (_private._resubmitConfirmationOnError) {
				if (status == "timeout") {
					if (confirm("An error occurred attempting to connect to the Enviance servers. This may be due to a scheduled period of downtime. " +
						"Would you like to try your operation again?")) {
						this._resubmitAfterError(context, onsuccess, onerror);
						return true;
					}
				}
				if (status == "requestlimit") {
					var error = JSON.parse(xhr.responseText);
					//response.getResponseHeader("Retry-After") will not work here becouse of CORS. Need direct server-side support to ahve it inside error json.
					if (confirm("You have reached the request limits for this system. Would you like to try your operation again?")) {
						this._resubmitAfterError(context, onsuccess, onerror);
						return true;
					}
				} else if (status == "heavyload") {
					if (confirm("Our servers are experiencing an unusually heavy load. Would you like to try your operation again?")) {
						this._resubmitAfterError(context, onsuccess, onerror);
						return true;
					}
				}
			}
			if (_private._refreshPageOnUnauthorized) {
				if (status == "unauthorized") {
					location.reload(true);
					return true;
				}
			}
			return false;
		},
		_resubmitAfterError: function(context, onsuccess, onerror) {
			jQuery.ajax({
				type: "POST",
				url: context.url,
				data: context.data,
				contentType: "application/json; charset=UTF-8",
				crossdomain: false,
				async: true,
				dataType: "json",
				beforeSend: function(xhr, form, options) {
					context = _private._createContext(xhr, form, options, form.success, form.error);
					return _private._beforeSend(xhr, context);
				},
				success: function(response) {
					if (onsuccess != null) {
						onsuccess(response);
					}
				},
				error: function(xhr, status, message) {
					_private._processError(xhr, status, message, onsuccess, onerror, context);
				}
			});
		}
	};

	_private._buildUrl = function(url) {
		if (_private._baseAddress == null) {
			throw new Error("_baseAddress is not set. Can not build URL.");
		}
		if (url.charAt(0) != "/") {
			url = "/" + url;
		}
		var base = _private._baseAddress;
		if (base.charAt(base.length - 1) == "/") {
			base = base.substr(0, base.length - 1);
		}
		return base + url;
	};

	_private._buildWebAppUrl = function(url) {
		if (_private._webAppVirtualPath == null) {
			throw new Error("_webAppVirtualPath is not set. Can not build URL.");
		}
		if (url.charAt(0) != "/") {
			url = "/" + url;
		}
		var base = _private._webAppVirtualPath;
		if (base.charAt(base.length - 1) == "/") {
			base = base.substr(0, base.length - 1);
		}
		return base + url;
	};

	_private._createContext = function(xhr, form, options, onsuccess, onerror) {
		return new _private._RequestContext(form.type, form.url, form.data, { }, onsuccess, onerror);
	};

	_private._beforeSend = function(xhr, context, denySystemId) {
		if (xhr == null || context == null) {
			throw new Error("Argument Exception");
		}
		var headers = _private._buildRequestHeaders(denySystemId);
		if (_private._crossDomain.isRequired(context.url)) {
			//crossdomain request host - try to use EasyXDM lib
			_private._crossDomain.ajax({
					type: context.type,
					url: context.url,
					data: context.data,
					headers: headers
				}, function(response) {
					if (context.onsuccess != null) {
						context.onsuccess(response.result, response.status, response.xhr);
					}
				}, function(response) {
					if (context.onerror != null) {
						context.onerror(response.message.response, response.message.status, response.message.message);
					}
				});
			xhr.success = function() {
			};
			xhr.error = function() {
			};
			return false; //stops native ajax request
		} else {
			for (var header in headers) {
				xhr.setRequestHeader(header, headers[header]);
			}
			return true;
		}
	};

	_private._buildRequestHeaders = function(denySystemId) {
		var headers = new Object();

		var sessionId = envianceSdk.getSessionId();
		if (sessionId != null) {
			headers["Authorization"] = "Enviance " + sessionId;
		}

		var systemId = envianceSdk.getSystemId();
		if (systemId != null && denySystemId !== true) {
			headers["EnvApi-SystemId"] = systemId;
		}

		var packageId = _private._packageId;
		if (packageId != null) {
			headers["EnvApi-PackageId"] = packageId;
		}

		return headers;
	};

	_private._cleanupForSerialization = function(obj) {
		return _private._preProcess(obj);
	};

	_private._preProcess = function(obj, copyObj) {
		var c = copyObj || { };
		for (var i in obj) {
			if (typeof obj[i] === 'function') {
				continue;
			}
			if (obj[i] != null && typeof obj[i] === 'object') {
				if (obj[i] instanceof Date) {
					c[i] = envianceSdk.IsoDate.toLocalString(obj[i]);
				} else {
					c[i] = (obj[i].constructor === Array) ? [] : { };
					_private._preProcess(obj[i], c[i]);
				}
			} else {
				c[i] = obj[i];
			}
		}
		return c;
	};

	_private._processResult = function(response, xhr) {
		var resultResponse = { metadata: _private._buildMetadata(xhr) };

		var isDateString = function(value) {
			return value != null && typeof value === "string" && envianceSdk.IsoDate.exactMatch(value);
		};

		// Check for primitive value in the response
		if (typeof response !== "object") {
			if (isDateString(response)) {
				resultResponse.result = envianceSdk.IsoDate.parse(response);
			} else {
				resultResponse.result = response;
			}
		} else {
			var traverse = function(obj, callback) {
				if (obj == null) {
					return;
				}

				for (var propName in obj) {
					callback(obj, propName);

					var propValue = obj[propName];
					if (typeof propValue === "object") {
						traverse(propValue, callback);
					}
				}
			};

			traverse(response, function(obj, propName) {
				var value = obj[propName];
				if (isDateString(value)) {
					obj[propName] = envianceSdk.IsoDate.parse(value);
				}
			});

			resultResponse.result = response;
		}

		return resultResponse;
	};

	_private._processError = function(xhr, status, message, onsuccess, onerror, context) {
		status = _private._errorHandler.detectStatus(xhr, status, message);
		if (_private._errorHandler.handle(xhr, status, message, onsuccess, onerror, context)) {
			return;
		}

		if (onerror != null) {
			var errorResponse = { metadata: _private._buildMetadata(xhr) };
			try {
				errorResponse.error = JSON.parse(xhr.responseText);
			} catch(e) {
				errorResponse.error = xhr.responseText;
			}
			onerror(errorResponse, status, message, context);
		}
	};

	//TODO: need remove  this  workaround
	if (typeof(envianceSdk.packages) != "undefined") {
		envianceSdk.packages._processError = _private._processError;
	}

	_private._buildMetadata = function(xhr) {
		var metadata = { statusCode: xhr.status };

		var setMetadataProperty = function(propName, value) {
			if (value) {
				metadata[propName] = value;
			}
		};

		if (xhr.getResponseHeader != null) {
			setMetadataProperty('version', xhr.getResponseHeader('EnvApi-Version'));
			setMetadataProperty('remainingCalls', parseInt(xhr.getResponseHeader('EnvApi-Remaining-Calls')));
			setMetadataProperty('remainingInterval', parseInt(xhr.getResponseHeader('EnvApi-Remaining-Interval')));
			setMetadataProperty('warnings', xhr.getResponseHeader('EnvApi-Warnings'));
			setMetadataProperty('location', xhr.getResponseHeader('Location'));
		} else {
			setMetadataProperty('version', xhr.headers['EnvApi-Version']);
			setMetadataProperty('remainingCalls', parseInt(xhr.headers['EnvApi-Remaining-Calls']));
			setMetadataProperty('remainingInterval', parseInt(xhr.headers['EnvApi-Remaining-Interval']));
			setMetadataProperty('warnings', xhr.headers['EnvApi-Warnings']);
			setMetadataProperty('location', xhr.headers['Location']);
		}

		return metadata;
	};

	//
	// Cross Form processing
	//
	_private._crossFormSubmit = function(fileinputs, url, data, onsuccess, onerror) {
		var container = document.getElementById('cross_form_container');

		if (container == null) {
			container = document.createElement('DIV');
			container.id = 'cross_form_container';
			container.style.display = 'none';
			document.body.appendChild(container);
		}
		container.innerHTML = '<iframe src="#" id="cross_form_iframe" name="cross_form_iframe" ></iframe>'
			+ '<form id="cross_form" name="cross_form" action = "' + url + '" method="post" enctype="multipart/form-data" target="cross_form_iframe">'
			+ '<input id="cross_form_data" name="cross_form_data" value="" type="hidden" />'
			+ '<input id="Authorization" name="Authorization" type="hidden" />'
			+ '<input id="EnvApi-SystemId" name="EnvApi-SystemId" type="hidden" />'
			+ '</form>';

		var isSuccess = false;

		jQuery('#cross_form_iframe').load(function() {
			setTimeout(iframeLoaded, 500);
		});

		function iframeLoaded() {
			if (isSuccess == false) {
				if (window.removeEventListener) {
					window.removeEventListener("message", callback);
				} else {
					window.detachEvent("onmessage", callback);
				}

				if (onerror != null) {
					onerror({ metadata: { statusCode: 400 }, error: { errorNumber: 0, message: "Unexpected error on uploading." } });
				}
			}
		}

		var form = container.getElementsByTagName('form')[0];

		container.getElementsByTagName('input')[0].value = JSON.stringify(data);

		var sessionId = envianceSdk.getSessionId();
		if (sessionId) {
			container.getElementsByTagName('input')[1].value = 'Enviance ' + sessionId;
		}
		var systemId = envianceSdk.getSystemId();
		if (systemId) {
			container.getElementsByTagName('input')[2].value = systemId;
		}

		if (fileinputs != null) {
			for (var i = 0, l = fileinputs.length; i < l; i++) {
				var fileinput = fileinputs[i];
				fileinput.parentNode.replaceChild(fileinput.cloneNode(false), fileinput);
				form.appendChild(fileinput);
			}
		}

		function callback(event) {
			var identityKey = 'CROSSFORM_RESULT_IDENTITY_KEY';
			if (event.data.indexOf(identityKey) != 0) {
				return;
			}

			if (window.removeEventListener) {
				window.removeEventListener("message", callback);
			} else {
				window.detachEvent("onmessage", callback);
			}

			if (typeof(event.data) == 'undefined') {
				isSuccess = false;
				return;
			}

			var result = JSON.parse(event.data.substring(identityKey.length));
			isSuccess = true;

			if (result.metadata.statusCode == 200) {
				if (onsuccess != null) {
					onsuccess(result);
				}
			} else {
				if (onerror != null) {
					onerror(result);
				}
			}
		}

		if (window.addEventListener) {
			window.addEventListener("message", callback, false);
		} else {
			window.attachEvent("onmessage", callback);
		}

		form.submit();
	};

	/*
	Main properties
	*/
	_private._baseAddress = null;
	_private._webAppVirtualPath = null;
	_private._variables = new _private._SimpleVariablesManager();
	_private._crossDomain = new _private._CrossDomainSupport();
	_private._crossDomainWorkaround = "ifneeded"; //Values: "always","ifneeded","off"
	_private._resubmitConfirmationOnError = true;
	_private._refreshPageOnUnauthorized = false;
	_private._errorHandler = new _private._GenericErrorHandler();
	_private._packageId = null;

	/*
	Public declarations
	*/

	/*
	ISO Date formatting/parsing implementation
	*/
	envianceSdk.IsoDate = {
		_expression: new RegExp("^" +
			"(\\d{4}|[\+\-]\\d{6})" + // four-digit year capture or sign + 6-digit extended year
			"-(\\d{2})" + // month capture
			"-(\\d{2})" + // day capture
			"(?:" + // capture hours:minutes:seconds.milliseconds
			"T(\\d{2})" + // hours capture
			":(\\d{2})" + // minutes capture
			"(?:" + // optional :seconds.milliseconds
			":(\\d{2})" + // seconds capture
			"(?:\\.(\\d{3}))?" + // milliseconds capture
			")?" +
			"(?:" + // capture UTC offset component
			"Z|" + // UTC capture
			"(?:" + // offset specifier +/-hours:minutes
			"([-+])" + // sign capture
			"(\\d{2})" + // hours offset capture
			":?(\\d{2})" + // minutes offset capture
			")" +
			")?)?" +
			"$"),
		match: function(string) {
			// accept minimum: "2012-01-01"
			return string != null && string.length > 9 && this._expression.exec(string) != null;
		},
		exactMatch: function(string) {
			// accept minimum: "2012-01-01T10:01"
			return string != null && string.length > 15 && this._expression.exec(string) != null;
		},
		parse: function(string) {
			var match = this._expression.exec(string);
			if (match) {
				match.shift(); // kill match[0], the full match
				// parse months, days, hours, minutes, seconds, and milliseconds
				for (var i = 1; i < 7; i++) {
					// provide default values if necessary
					match[i] = +(match[i] || (i < 3 ? 1 : 0));
					// match[1] is the month. Months are 0-11 in JavaScript
					// `Date` objects, but 1-12 in ISO notation, so we
					// decrement.
					if (i == 1) {
						match[i]--;
					}
				}

				// parse the UTC offset component
				var minuteOffset = +match.pop(), hourOffset = +match.pop(), sign = match.pop();

				// compute the explicit time zone offset if specified
				var isUtc = string.indexOf("Z") > 0;
				var isTzSpecified = sign || isUtc;
				var offset = 0;
				if (sign) {
					// detect invalid offsets and return early
					if (hourOffset > 23 || minuteOffset > 59) {
						return NaN;
					}

					// express the provided time zone offset in minutes. The offset is
					// negative for time zones west of UTC; positive otherwise.
					offset = (hourOffset * 60 + minuteOffset) * 6e4 * (sign == "+" ? -1 : 1);
				}

				if (isTzSpecified) {
					var utc = new Date();
					utc.setUTCFullYear(match[0]);
					utc.setUTCMonth(match[1], match[2]);
					utc.setUTCHours(match[3], match[4], match[5], 0);
					return new Date(utc.getTime() + offset);
				} else {
					var date = new Date();
					date.setFullYear(match[0]);
					date.setMonth(match[1], match[2]);
					date.setHours(match[3], match[4], match[5], 0);
					return date;
				}
			}
			return NaN;
		},
		toLocalString: function(date) {
			if (date == null || isNaN(date)) {
				return null;
			}
			var month = date.getMonth() + 1,
			    day = date.getDate(),
			    year = date.getFullYear(),
			    hours = date.getHours(),
			    minutes = date.getMinutes(),
			    seconds = date.getSeconds();

			if (year < 1000) {
				year = ('0000' + year);
				year = year.substr(year.length - 4, 4);
			}
			if (month < 10) {
				month = '0' + month;
			}
			if (day < 10) {
				day = '0' + day;
			}
			if (hours < 10) {
				hours = '0' + hours;
			}
			if (minutes < 10) {
				minutes = '0' + minutes;
			}
			if (seconds < 10) {
				seconds = '0' + seconds;
			}
			return '' + year + '-' + month + '-' + day + 'T' +
				hours + ':' + minutes + ':' + seconds;
		},
		toUTCString: function(date) {
			if (date == null || isNaN(date)) {
				return null;
			}
			var month = date.getUTCMonth() + 1,
			    day = date.getUTCDate(),
			    year = date.getUTCFullYear(),
			    hours = date.getUTCHours(),
			    minutes = date.getUTCMinutes(),
			    seconds = date.getUTCSeconds();

			if (year < 1000) {
				year = ('0000' + year);
				year = year.substr(year.length - 4, 4);
			}
			if (month < 10) {
				month = '0' + month;
			}
			if (day < 10) {
				day = '0' + day;
			}
			if (hours < 10) {
				hours = '0' + hours;
			}
			if (minutes < 10) {
				minutes = '0' + minutes;
			}
			if (seconds < 10) {
				seconds = '0' + seconds;
			}
			return '' + year + '-' + month + '-' + day + 'T' +
				hours + ':' + minutes + ':' + seconds + "Z";
		}
	};

	envianceSdk.configure = function(options) {
		if (options.baseAddress != null) {
			_private._baseAddress = options.baseAddress;
		}
		if (options.webAppVirtualPath != null) {
			_private._webAppVirtualPath = options.webAppVirtualPath;
		}
		if (options.variables != null) {
			if (options.variables == "simple") {
				_private._variables = new _private._SimpleVariablesManager();
			}
			if (options.variables == "cookies") {
				_private._variables = new _private._CookieVariablesManager();
			}
		}
		if (options.sessionId !== undefined) {
			envianceSdk.setSessionId(options.sessionId);
			if (options.sessionId == null) {
				envianceSdk.setSystemId(null);
			}
		}
		if (options.systemId !== undefined) {
			envianceSdk.setSystemId(options.systemId);
		}
		if (options.userId !== undefined) {
			envianceSdk.setUserId(options.userId);
		}
		if (options.crossDomainWorkaround != null) {
			_private._crossDomainWorkaround = options.crossDomainWorkaround;
		}
		if (options.packageId !== undefined) {
			_private._packageId = options.packageId;
		}
		if (options.resubmitConfirmationOnError != null) {
			_private._resubmitConfirmationOnError = options.resubmitConfirmationOnError;
		}
		if (options.refreshPageOnUnauthorized != null) {
			_private._refreshPageOnUnauthorized = options.refreshPageOnUnauthorized;
		}
	};

	envianceSdk.setCrossDomainWorkaround = function(value) {
		_private._crossDomainWorkaround = value;
	};

	envianceSdk.getSessionId = function() {
		return _private._variables.readSessionId();
	};

	envianceSdk.setSessionId = function(sessionId) {
		_private._variables.writeSessionId(sessionId);
	};

	envianceSdk.getSystemId = function() {
		return _private._variables.readSystemId();
	};

	envianceSdk.setSystemId = function(systemId) {
		_private._variables.writeSystemId(systemId);
	};

	envianceSdk.getUserId = function() {
		return _private._variables.readUserId();
	};

	envianceSdk.setUserId = function(userId) {
		_private._variables.writeUserId(userId);
	};


	return envianceSdk;
}(envianceSdk || { }));// <autogenerated>
//	This file is auto-generated.
// </autogenerated>

//Enviance.RestServices.Async.ICommandService
if (typeof envianceSdk == "undefined") {
	envianceSdk = { };
}

envianceSdk = (function(envianceSdk) {
	// ReSharper disable InconsistentNaming
	var _private = envianceSdk._private = envianceSdk._private || {};
	// ReSharper restore InconsistentNaming

	_private._ajax = function(ajaxOptions, onsuccess, onerror) {
		var context = null;
		var defaultOptions = {
			contentType: "application/json; charset=UTF-8",
			crossdomain: false,
			async: true,
			cache: false,
			dataType: "json",
			beforeSend: function(xhr, form, opts) {
				context = _private._createContext(xhr, form, opts, form.success, form.error);
				return _private._beforeSend(xhr, context);
			},
			success: function(response, textStatus, xhr) {
				if (onsuccess != null) {
					onsuccess(_private._processResult(response, xhr));
				}
			},
			error: function(response, status, message) {
				_private._processError(response, status, message, onsuccess, onerror, context);
			}
		};
		var options = {};
		jQuery.extend(options, defaultOptions, ajaxOptions);
		jQuery.ajax(options);
	};

	envianceRegisterNamespace("envianceSdk.command");
	envianceSdk.command.deleteCommand = function(id, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/CommandService.svc/commands/' + encodeURIComponent(id) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.command.getCommand = function(id, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/CommandService.svc/commands/' + encodeURIComponent(id) + '')
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Compliance.IComplianceService
	envianceRegisterNamespace("envianceSdk.compliance");

	envianceSdk.compliance.createLocation = function(objectCreationInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/ComplianceService.svc/locations'),
			data: JSON.stringify(_private._preProcess({ "objectCreationInformation": objectCreationInformation })),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};
	envianceSdk.compliance.copyLocation = function(objectCreationInformation, copyFrom, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/ComplianceService.svc/locations'),
			data: JSON.stringify(_private._preProcess({
				"objectCreationInformation": objectCreationInformation,
				"copyFrom": copyFrom
			})),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};
	envianceSdk.compliance.deleteLocation = function(locationIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/ComplianceService.svc/locations/' + encodeURIComponent(locationIdOrPath) + ''),
			data: {},
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};
	envianceSdk.compliance.getLocation = function(locationIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/ComplianceService.svc/locations/' + encodeURIComponent(locationIdOrPath) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.compliance.updateLocation = function(objectUpdateInformation, locationIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/ComplianceService.svc/locations/' + encodeURIComponent(locationIdOrPath) + ''),
			data: JSON.stringify(_private._preProcess({ "objectUpdateInformation": objectUpdateInformation })),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Data.IDataService
	envianceRegisterNamespace("envianceSdk.data");

	envianceSdk.data.deleteNumericData = function(numericDataRanges, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DataService.svc/numericdata/deletedatacommands'),
			data: JSON.stringify(_private._preProcess({ "numericDataRanges": numericDataRanges })),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};
	envianceSdk.data.enterNumericData = function(numericDataPoints, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DataService.svc/numericdata/enterdatacommands'),
			data: JSON.stringify(_private._preProcess({ "numericDataPoints": numericDataPoints })),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Documents.IDocumentService 
	envianceRegisterNamespace("envianceSdk.documents");

	envianceSdk.documents.createDocument = function(documentCreationInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DocumentService.svc/documents'),
			data: JSON.stringify(_private._preProcess({ "documentCreationInformation": documentCreationInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.documents.copyDocument = function(documentCreationInformation, copyFrom, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DocumentService.svc/documents'),
			data: JSON.stringify(_private._preProcess({
				"documentCreationInformation": documentCreationInformation,
				"copyFrom": copyFrom
			}))
		}, onsuccess, onerror);
	};
	envianceSdk.documents.getDocument = function(idOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/DocumentService.svc/documents/' + encodeURIComponent(idOrPath) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.documents.updateDocument = function(idOrPath, documentUpdateInformation, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/DocumentService.svc/documents/' + encodeURIComponent(idOrPath) + ''),
			data: JSON.stringify(_private._preProcess({ "documentUpdateInformation": documentUpdateInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.documents.deleteDocument = function(idOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/DocumentService.svc/documents/' + encodeURIComponent(idOrPath) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.documents.createDocumentFolder = function(documentFolderCreationInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DocumentService.svc/folders'),
			data: JSON.stringify(_private._preProcess({ "documentFolderCreationInformation": documentFolderCreationInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.documents.copyDocumentFolder = function(documentFolderCreationInformation, copyFrom, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/DocumentService.svc/folders'),
			data: JSON.stringify(_private._preProcess({
				"documentFolderCreationInformation": documentFolderCreationInformation,
				"copyFrom": copyFrom
			}))
		}, onsuccess, onerror);
	};
	envianceSdk.documents.getDocumentFolder = function(idOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/DocumentService.svc/folders/' + encodeURIComponent(idOrPath) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.documents.updateDocumentFolder = function(idOrPath, documentFolderUpdateInformation, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/DocumentService.svc/folders/' + encodeURIComponent(idOrPath) + ''),
			data: JSON.stringify(_private._preProcess({ "documentFolderUpdateInformation": documentFolderUpdateInformation }))
		}, onsuccess, onerror);
	};

	envianceSdk.documents.deleteDocumentFolder = function(idOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/DocumentService.svc/folders/' + encodeURIComponent(idOrPath) + ''),
			data: {}
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Eql.IEqlService 
	envianceRegisterNamespace("envianceSdk.eql");

	envianceSdk.eql.execute = function(eql, page, pageSize, onsuccess, onerror) {
		envianceSdk.eql.executeWithFormat(eql, page, pageSize, "json", onsuccess, onerror);
	};
	envianceSdk.eql.executeWithFormat = function(eql, page, pageSize, format, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/EqlService.svc/eql'),
			data: JSON.stringify(_private._preProcess({ eql: eql, page: page, pageSize: pageSize, format: format })),
			success: function(response, textStatus, xhr) {
				if (onsuccess != null) {
					onsuccess(format === "json" ? _private._processResult(response, xhr) : xhr.responseText);
				}
			}
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Events.IEventService 
	envianceRegisterNamespace("envianceSdk.event");

	envianceSdk.event.createEvent = function(eventCreationInformation, eventlogIdOrTag, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/EventService.svc/eventlogs/' + encodeURIComponent(eventlogIdOrTag) + '/events'),
			data: JSON.stringify(_private._preProcess({ "eventCreationInformation": eventCreationInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.event.deleteEvent = function(eventlogIdOrTag, eventIdOrTag, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/EventService.svc/eventlogs/' + encodeURIComponent(eventlogIdOrTag) + '/events/' + encodeURIComponent(eventIdOrTag) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.event.getEvent = function(eventlogIdOrTag, eventIdOrTag, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/EventService.svc/eventlogs/' + encodeURIComponent(eventlogIdOrTag) + '/events/' + encodeURIComponent(eventIdOrTag) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.event.updateEvent = function(eventUpdateInformation, eventlogIdOrTag, eventIdOrTag, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/EventService.svc/eventlogs/' + encodeURIComponent(eventlogIdOrTag) + '/events/' + encodeURIComponent(eventIdOrTag) + ''),
			data: JSON.stringify(_private._preProcess({ "eventUpdateInformation": eventUpdateInformation }))
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Packages.IPackageService 
	envianceRegisterNamespace("envianceSdk.package");

	envianceSdk.package.createPackage = function(packageCreateInfo, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/PackageService.svc/packages'),
			data: JSON.stringify(_private._preProcess(packageCreateInfo))
		}, onsuccess, onerror);
	};
	envianceSdk.package.createPackageItem = function(packageItemCreationInformation, copyFrom, packageIdOrName, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/items'),
			data: JSON.stringify(_private._preProcess({ "packageItemCreationInformation": packageItemCreationInformation, "copyFrom": copyFrom }))
		}, onsuccess, onerror);
	};
	envianceSdk.package.deletePackage = function(packageIdOrName, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.package.deletePackageItem = function(packageIdOrName, itemIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/items/' + encodeURIComponent(itemIdOrPath) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.package.getPackage = function(packageIdOrName, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.package.getPackageItem = function(packageIdOrName, itemIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/items/' + encodeURIComponent(itemIdOrPath) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.package.updatePackage = function(packageUpdateInfo, packageIdOrName, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + ''),
			data: JSON.stringify(_private._preProcess({ "packageUpdateInfo": packageUpdateInfo }))
		}, onsuccess, onerror);
	};
	envianceSdk.package.updatePackageItem = function(packageItemUpdateInformation, packageIdOrName, itemIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/items/' + encodeURIComponent(itemIdOrPath) + ''),
			data: JSON.stringify(_private._preProcess({ "packageItemUpdateInformation": packageItemUpdateInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.package.getPackageAppData = function(packageIdOrName, key, onsuccess, onerror) {
		_private._checkPackageAppDataKey(key);
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/data/' + encodeURIComponent(key))
		}, onsuccess, onerror);
	};
	envianceSdk.package.savePackageAppData = function(packageIdOrName, key, value, onsuccess, onerror) {
		_private._checkPackageAppDataKey(key);
		if (typeof (value) != "string") {
			throw new Error("The argument <value> is not a string.");
		}
		_private._ajax({
			type: "PUT",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/data/' + encodeURIComponent(key)),
			data: JSON.stringify(_private._preProcess({ "value": value }))
		}, onsuccess, onerror);
	};
	envianceSdk.package.deletePackageAppData = function(packageIdOrName, key, onsuccess, onerror) {
		_private._checkPackageAppDataKey(key);
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/PackageService.svc/packages/' + encodeURIComponent(packageIdOrName) + '/data/' + encodeURIComponent(key)),
			data: {}
		}, onsuccess, onerror);
	};
	_private._checkPackageAppDataKey = function(key) {
		if (typeof (key) != "string" || key == "") {
			throw new Error("The key <" + key + "> argument is not a string or is empty.");
		}
		if (key.length > 100) {
			throw new Error("The key <" + key + "> argument cannot be greater than 100 characters.");
		}
		if (key.charAt(0) == "/") {
			throw new Error("The key <" + key + "> argument cannot start with a character '/'");
		}
	};

	//Enviance.RestServices.Security.IAuthenticationService 
	envianceRegisterNamespace("envianceSdk.authentication");

	envianceSdk.authentication.authenticate = function(userName, password, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/AuthenticationService.svc/sessions'),
			data: JSON.stringify(_private._preProcess({ userName: userName, password: password })),
			success: function(response, textStatus, xhr) {
				envianceSdk.setSessionId(response);
				envianceSdk.setSystemId(null);
				if (onsuccess != null) {
					onsuccess(_private._processResult(response, xhr));
				}
			}
		}, onsuccess, onerror);
	};
	envianceSdk.authentication.endCurrentSession = function(onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/AuthenticationService.svc/currentsession'),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.authentication.getCurrentSessionInfo = function(onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/AuthenticationService.svc/currentsession')
		}, onsuccess, onerror);
	};

	//Enviance.RestServices.Tasks.ITaskService 
	envianceRegisterNamespace("envianceSdk.tasks");

	envianceSdk.tasks.createTask = function(taskCreationInformation, copyPropertiesFrom, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/TaskService.svc/tasks'),
			data: JSON.stringify(_private._preProcess({ "taskCreationInformation": taskCreationInformation, "copyPropertiesFrom": copyPropertiesFrom }))
		}, onsuccess, onerror);
	};
	envianceSdk.tasks.deleteTask = function(id, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/TaskService.svc/tasks/' + encodeURIComponent(id) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.tasks.getTask = function(id, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/TaskService.svc/tasks/' + encodeURIComponent(id) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.tasks.updateTask = function(id, taskUpdateInformation, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/TaskService.svc/tasks/' + encodeURIComponent(id) + ''),
			data: JSON.stringify(_private._preProcess({ "taskUpdateInformation": taskUpdateInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.tasks.getTaskOccurrence = function(id, dueDate, objectIdOrPath, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/TaskService.svc/tasks/' + encodeURIComponent(id) + '/occurrences/' + encodeURIComponent(envianceSdk.IsoDate.toLocalString(dueDate)) + (objectIdOrPath == null ? '' : '/' + encodeURIComponent(objectIdOrPath)))
		}, onsuccess, onerror);
	};
	envianceSdk.tasks.completeTaskOccurrence = function(id, dueDate, taskOccurrenceInfos, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/TaskService.svc/tasks/' + encodeURIComponent(id) + '/occurrences/' + encodeURIComponent(envianceSdk.IsoDate.toLocalString(dueDate))),
			data: JSON.stringify(_private._preProcess({ "taskCompleteDismissInformation": taskOccurrenceInfos }))
		}, onsuccess, onerror);
	};
	//Enviance.RestServices.Workflows.IWorkflowService 
	envianceRegisterNamespace("envianceSdk.workflow");

	envianceSdk.workflow.createWorkflow = function(workflowCreationInformation, workflowStepUpdateInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows'),
			data: JSON.stringify(_private._preProcess({ "workflowCreationInformation": workflowCreationInformation, "workflowStepUpdateInformation": workflowStepUpdateInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.getWorkflow = function(idOrUniqueId, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.updateWorkflow = function(workflowUpdateInformation, idOrUniqueId, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + ''),
			data: JSON.stringify(_private._preProcess({ "workflowUpdateInformation": workflowUpdateInformation }))
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.deleteWorkflow = function(idOrUniqueId, onsuccess, onerror) {
		_private._ajax({
			type: "DELETE",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + ''),
			data: {}
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.generateUniqueIDs = function(workflowTypeIdOrName, count, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflowtypes/' + encodeURIComponent(workflowTypeIdOrName) + '/uniqueIds?count=' + encodeURIComponent(count) + '')
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.initiateChildWorkflow = function(idOrUniqueId, childWorkflowInitiationInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + '/children'),
			data: JSON.stringify(_private._preProcess(childWorkflowInitiationInformation))
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.getWorkflowStep = function(idOrUniqueId, idOrName, onsuccess, onerror) {
		_private._ajax({
			type: "GET",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + '/steps') + '/' + encodeURIComponent(idOrName) + ''
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.getWorkflowCurrentStep = function(idOrUniqueId, onsuccess, onerror) {
		envianceSdk.workflow.getWorkflowStep(idOrUniqueId, "currentstep", onsuccess, onerror);
	};
	envianceSdk.workflow.updateWorkflowStep = function(workflowStepInformation, idOrUniqueId, idOrName, onsuccess, onerror) {
		_private._ajax({
			type: "PATCH",
			url: _private._buildUrl('ver2/WorkflowService.svc/workflows/' + encodeURIComponent(idOrUniqueId) + '/steps') + '/' + encodeURIComponent(idOrName) + '',
			data: JSON.stringify(_private._preProcess(workflowStepInformation))
		}, onsuccess, onerror);
	};
	envianceSdk.workflow.updateWorkflowCurrentStep = function(workflowStepInformation, idOrUniqueId, onsuccess, onerror) {
		envianceSdk.workflow.updateWorkflowStep(workflowStepInformation, idOrUniqueId, "currentstep", onsuccess, onerror);
	};

	//Enviance.RestServices.Ver2.Reports.IReportService 
	envianceRegisterNamespace("envianceSdk.report");

	envianceSdk.report.execute = function(reportExecutionInformation, onsuccess, onerror) {
		_private._ajax({
			type: "POST",
			url: _private._buildUrl('ver2/ReportService.svc/reports/executereportcommands'),
			data: JSON.stringify(_private._preProcess(reportExecutionInformation)),
			success: function(response, textStatus, xhr) {
				if (onsuccess) {
					_private._runCommandPolling(_private._processResult(response, xhr), onsuccess, onerror);
				}
			}
		}, onsuccess, onerror);
	};

	return envianceSdk;
} (envianceSdk || {}));

/*
 Helper objects
*/

envianceSdk = (function(envianceSdk) {
	// ReSharper disable InconsistentNaming
	var _private = envianceSdk._private = envianceSdk._private || { };
	// ReSharper restore InconsistentNaming

	envianceRegisterNamespace("envianceSdk.common");
	envianceRegisterNamespace("envianceSdk.customFields");

	/* for envianceSdk.workflow.createWorkflow function */
	envianceSdk.workflow.CreationInformation = function(workflowTypeName, name, uniqueId, dueDate, objects, documents, comment, calendars) {
		if (workflowTypeName) {
			this.workflowTypeName = workflowTypeName;
		}
		if (name) {
			this.name = name;
		}
		if (uniqueId) {
			this.uniqueId = uniqueId;
		}
		if (dueDate) {
			this.dueDate = dueDate;
		}
		if (objects) {
			this.objects = objects;
		}
		if (documents) {
			this.documents = documents;
		}
		if (comment) {
			this.comment = comment;
		}
		if (calendars) {
			this.calendars = calendars;
		}

		this.addTagAssociatedObject = function(tag) {
			this.objects = this.objects || [];
			this.objects.push(new envianceSdk.common.TagAssociatedObject(tag));
			return this;
		};

		this.addTagAssociatedObject = function(tag) {
			this.objects = this.objects || [];
			this.objects.push(new envianceSdk.common.TagAssociatedObject(tag));
			return this;
		};

		this.addPathAssociatedObject = function(path) {
			this.objects = this.objects || [];
			this.objects.push(path);
			return this;
		};

		this.addIdAssociatedObject = function(id) {
			this.objects = this.objects || [];
			this.objects.push(id);
			return this;
		};
	};

	envianceSdk.common.TagAssociatedObject = function(tag) {
		if (tag) {
			this.tag = tag;
		}
	};

	/* for envianceSdk.workflow.updateWorkflowStep function */
	envianceSdk.workflow.StepInformation = function(comment, fields, transition) {
		if (comment) {
			this.comment = comment;
		}
		if (fields) {
			this.fields = fields;
		}
		if (transition) {
			this.transition = transition;
		}

		this.transition = function(stepActionName, dueDate, assignTo) {
			this.transition = new envianceSdk.workflow.Transition(stepActionName, dueDate, assignTo);
			return this.transition;
		};

		this.addScalarFieldValue = function(name, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.ScalarFieldValue(name, value));
			return this;
		};

		this.addDateFieldValue = function(name, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.DateFieldValue(name, value));
			return this;
		};

		this.addTimeFieldValue = function(name, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.TimeFieldValue(name, value));
			return this;
		};

		this.addUrlFieldValue = function(name, label, url) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.UrlFieldValue(name, label, url));
			return this;
		};

		this.addLinkedFieldValues = function(name, values) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.LinkedFieldValues(name, values));
			return this;
		};

		this.addMultiFieldValues = function(name, values) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.MultiFieldValues(name, values));
			return this;
		};
	};

	/* for envianceSdk.workflow.initiateChildWorkflow function */
	envianceSdk.workflow.ChildWorkflowInitiationInformation = function(stepIdOrName, initiatorIdOrName, workflowCreationInformation, workflowStepUpdateInformation) {
		if (stepIdOrName) {
			this.stepIdOrName = stepIdOrName;
		}
		if (initiatorIdOrName) {
			this.initiatorIdOrName = initiatorIdOrName;
		}
		if (workflowCreationInformation) {
			this.workflowCreationInformation = workflowCreationInformation;
		}
		if (workflowStepUpdateInformation) {
			this.workflowStepUpdateInformation = workflowStepUpdateInformation;
		}
	};

	envianceSdk.workflow.Transition = function(stepActionName, dueDate, assignTo) {
		if (stepActionName) {
			this.stepActionName = stepActionName;
		}
		if (dueDate) {
			this.dueDate = dueDate;
		}
		if (assignTo) {
			this.assignTo = assignTo;
		}

		this.addUserAssignee = function(userName) {
			this.assignTo = this.assignTo || [];
			this.assignTo.push(new envianceSdk.common.UserAssignee(userName));
			return this;
		};

		this.addGroupAssignee = function(groupName) {
			this.assignTo = this.assignTo || [];
			this.assignTo.push(new envianceSdk.common.GroupAssignee(groupName));
			return this;
		};
	};

	/* for envianceSdk.compliance.createLocation function */
	envianceSdk.compliance.CreationInformation = function(name, type, parentPath, activeDate, inactiveDate, fieldTemplate, fieldValues, documents, timeZone, address, geoLocation) {
		if (name) {
			this.name = name;
		}
		if (type) {
			this.type = type;
		}
		if (parentPath || parentPath == "") {
			this.parentPath = parentPath;
		}
		if (activeDate) {
			this.activeDate = activeDate;
		}
		if (inactiveDate) {
			this.inactiveDate = inactiveDate;
		}
		if (fieldTemplate) {
			this.fieldTemplate = fieldTemplate;
		}
		if (fieldValues) {
			this.fieldValues = fieldValues;
		}
		if (documents) {
			this.documents = documents;
		}
		if (timeZone) {
			this.timeZone = new envianceSdk.common.TimeZone(timeZone);
		}
		if (address) {
			this.address = address;
		}
		if (geoLocation) {
			this.geoLocation = geoLocation;
		}

		this.addActiveDate = function(activeDateValue) {
			this.activeDate = activeDateValue;
			return this;
		};
		this.addInactiveDate = function(inactiveDateValue) {
			this.inactiveDate = inactiveDateValue;
			return this;
		};
		this.addFieldTemplate = function(fieldTemplateValue) {
			this.fieldTemplate = fieldTemplateValue;
			return this;
		};

		this.addScalarFieldValue = function(fieldName, value) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.ScalarFieldValue(fieldName, value));
			return this;
		};

		this.addDateFieldValue = function(fieldName, value) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.DateFieldValue(fieldName, value));
			return this;
		};

		this.addTimeFieldValue = function(fieldName, value) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.TimeFieldValue(fieldName, value));
			return this;
		};

		this.addUrlFieldValue = function(fieldName, label, url) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.UrlFieldValue(fieldName, label, url));
			return this;
		};

		this.addLinkedFieldValues = function(fieldName, values) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.LinkedFieldValues(fieldName, values));
			return this;
		};

		this.addMultiFieldValues = function(fieldName, values) {
			this.fieldValues = this.fieldValues || [];
			this.fieldValues.push(new envianceSdk.customFields.MultiFieldValues(fieldName, values));
			return this;
		};

		this.addAddress = function(addressValue) {
			this.address = addressValue;
			return this;
		};
		this.addGeoLocation = function(geoLocationValue) {
			this.geoLocation = geoLocationValue;
			return this;
		};
	};

	envianceSdk.compliance.Address = function(street1, city, stateOrProvince, country, postalCode) {
		if (street1) {
			this.street1 = street1;
		}
		if (city) {
			this.city = city;
		}
		if (stateOrProvince) {
			this.stateOrProvince = stateOrProvince;
		}
		if (country) {
			this.country = country;
		}
		if (postalCode) {
			this.postalCode = postalCode;
		}

		this.addStreet2 = function(street2) {
			this.street2 = street2;
			return this;
		};

		this.addStreet3 = function(street3) {
			this.street3 = street3;
			return this;
		};

		this.addCountyOrRegion = function(countyOrRegion) {
			this.countyOrRegion = countyOrRegion;
			return this;
		};
	};

	envianceSdk.compliance.GeoLocation = function(latitude, longitude) {
		if (latitude) {
			this.latitude = latitude;
		}
		if (longitude) {
			this.longitude = longitude;
		}
	};

	envianceSdk.common.AddTimeZone = function(timeZoneValue) {
		this.timeZone = new envianceSdk.common.TimeZone(timeZoneValue);
		return this;
	};

	envianceSdk.common.AddDocument = function(path) {
		this.documents = this.documents || [];
		this.documents.push(path);
		return this;
	};


	envianceSdk.common.GroupAssignee = function(groupName) {
		if (groupName) {
			this.groupName = groupName;
		} else {
			throw new Error("Argument value is not valid: groupName.");
		}
	};

	envianceSdk.common.UserAssignee = function(userName) {
		if (userName) {
			this.userName = userName;
		} else {
			throw new Error("Argument value is not valid: userName.");
		}
	};

	envianceSdk.common.TimeZone = function(name) {
		if (name) {
			this.name = name;
		} else {
			throw new Error("Argument value is not valid: name.");
		}
	};

	envianceSdk.customFields.DateFieldValue = function(name, value) {
		if (value != null && !(value instanceof Date)) {
			if (envianceSdk.IsoDate.match(value)) {
				value = envianceSdk.IsoDate.parse(value);
			} else {
				value = new Date(value);
			}
		}
		this.name = name;
		this.values = [value];
	};

	envianceSdk.customFields.TimeFieldValue = function(name, value) {
		var today = new Date(),
		    dd = today.getDate(),
		    mm = today.getMonth() + 1,
		    yyyy = today.getFullYear();
		if (dd < 10) {
			dd = '0' + dd;
		}
		if (mm < 10) {
			mm = '0' + mm;
		}

		if (value instanceof Date) {
			value = value.getHours() + ':' + value.getMinutes();
		}
		var date = new Date(mm + '/' + dd + '/' + yyyy + ' ' + value);
		if (isNaN(date)) {
			throw Error("Invalid date");
		}

		this.name = name;
		this.values = [date];
	};

	envianceSdk.customFields.ScalarFieldValue = function(name, value) {
		this.name = name;
		this.values = [value];
	};

	envianceSdk.customFields.UrlFieldValue = function(name, label, url) {
		this.name = name;
		this.urlItems = [{ label: label, url: url }];
	};

	envianceSdk.customFields.LinkedFieldValues = function(name, values) {
		this.name = name;
		this.values = values;
	};

	envianceSdk.customFields.MultiFieldValues = function(name, values) {
		this.name = name;
		this.values = values;
	};

	envianceRegisterNamespace("envianceSdk.compliance");

	envianceSdk.compliance.selectComplianceObjects = function(page, pageSize, onsuccess, onerror, nameFilter) {
		var eql = "SELECT " +
			"co.ID, co.Name, co.Type, co.Path, co.WarningNotificationInbox, co.WarningNotificationEmail, " +
			"co.TemplateName, co.CreatedOn, co.ActiveDate, co.InactiveDate, co.ResponsibleUser " +
			"FROM ComplianceObject co";
		if (nameFilter != null) {
			eql = eql + " WHERE co.Name LIKE '%" + nameFilter + "%'" +
				" ORDER BY co.Name"; // TODO: Encode this somehow!
		}
		return envianceSdk.eql.execute(eql, page, pageSize, onsuccess, onerror);
	};

	envianceRegisterNamespace("envianceSdk.utilities");
	envianceRegisterNamespace("envianceSdk.utilities.uri");

	/*Returns a query string to execute the QuickLink*/
	envianceSdk.utilities.uri.toQuickLink = function(id) {
		var systemId = envianceSdk.getSystemId();
		return _private._buildWebAppUrl("/Go.aspx?Id=" + id + (systemId != null
			? ("&systemId=" + systemId)
			: ""));
	};

	/*Returns a query string to download a document from document manager, given its ID.*/
	envianceSdk.utilities.uri.toDocumentDownload = function(idOrPath) {
		return _private._buildUrl("/ver2/DocumentService.svc/documents/" + encodeURIComponent(idOrPath) + "?content");
	};

	/*Switches a page*/
	envianceSdk.utilities.uri.gotoUrl = function(pagePath) {
		window.location.assign(pagePath);
	};

	envianceRegisterNamespace("envianceSdk.documents");

	envianceSdk.documents.DocumentInfo = function(name, description, folderIdOrPath, content, fileName) {
		if (name) {
			this.name = name;
		}
		if (description) {
			this.description = description;
		}
		if (folderIdOrPath) {
			this.folder = folderIdOrPath;
		}
		if (content) {
			this.content = content;
		}
		if (fileName) {
			this.fileName = fileName;
		}

		this.addTagAssociatedObject = function(tag) {
			this.objects = this.objects || [];
			this.objects.push(new envianceSdk.common.TagAssociatedObject(tag));
			return this;
		};

		this.addPathAssociatedObject = function(path) {
			this.objects = this.objects || [];
			this.objects.push(path);
			return this;
		};

		this.addIdAssociatedObject = function(id) {
			this.objects = this.objects || [];
			this.objects.push(id);
			return this;
		};

		this.addTask = function(id) {
			this.tasks = this.tasks || [];
			this.tasks.push(id);
			return this;
		};

		this.addWorkflow = function(idOrUniqueId) {
			this.workflows = this.workflows || [];
			this.workflows.push(idOrUniqueId);
			return this;
		};

		this.addContentUrl = function(contentUrl) {
			this.contentUrl = contentUrl;
			return this;
		};
	};

	envianceSdk.documents.DocumentFolderInfo = function(name, description, parentFolder) {
		if (name) {
			this.name = name;
		}
		if (description) {
			this.description = description;
		}
		if (parentFolder) {
			this.parentFolder = parentFolder;
		}
	};

	envianceSdk.common.configureFileInput = function(fileObjectId, onloaded) {
		if (typeof FileReader !== "function" && typeof swfobject == "undefined") {
			jQuery.ajax({
				url: _private._buildUrl("FileUpload/swfobject.js"),
				dataType: "script",
				async: true,
				cache: true,
				success: function(response) {
					if (typeof swfobject == "undefined") {
						var msg = "Failed to setup file upload control. Failed to load swfobject.js." + status;
						_private._processError(msg, 1250, msg, onerror);
					}
					swfobject.embedSWF(_private._buildUrl("FileUpload/FileToDataURI.swf"), fileObjectId, "80px", "23px", "10", "FileUpload/expressInstall.swf", { }, { allowScriptAccess: "always" }, { });

					envianceSdk.common.getFileInputResult = function(filename, content) {
						if (onloaded) {
							onloaded(fileObjectId, filename, content);
						}
					};
				},
				error: function(response, status, message) {
					var msg = "Failed to setup file upload control. Failed to load swfobject.js. Status=" + status;
					_private._processError(msg, status, msg, onerror);
				}
			});
		} else {
			$('#' + fileObjectId).replaceWith('<input type="file" id="' + fileObjectId + '" value="Load a file" />');
			$('#' + fileObjectId).on('change', function(e) {
				var files = e.target.files, file;

				if (!files || files.length == 0) return;
				file = files[0];

				var fileReader = new FileReader();
				fileReader.onload = function(e) {
					if (onloaded) {
						onloaded(fileObjectId, file.name, e.target.result.split(",")[1]);
					}
				};
				fileReader.readAsDataURL(file);
			});
		}
	};

	envianceSdk.documents.DocumentUploadInfo = function(inputId, folderIdOrPath, fileName, documentName, comment, description) {
		this.inputId = inputId;
		this.folderIdOrPath = folderIdOrPath;
		this.fileName = fileName;
		this.documentName = documentName;
		this.comment = comment;
		this.description = description;
	};

	envianceSdk.documents.uploadDocument = function(fileinput, folderId, onsuccess, onerror) {
		envianceSdk.documents.uploadDocuments([fileinput], folderId, onsuccess, onerror);
	};

	envianceSdk.documents.uploadDocuments = function(fileinputs, folderId, onsuccess, onerror) {

		var validationResults = envianceSdk.documents.validateUploadDocuments(fileinputs, folderId);
		if (validationResults.length > 0) {
			var errorMessage = '';
			for (var i = 0; i < validationResults.length; i++) {
				errorMessage += validationResults[i].inputId + ':' + validationResults[i].message + '\n';
			}
			throw new Error(errorMessage);
		}

		var container = document.getElementById('document_upload_container');
		var url = _private._buildUrl('ver2/DocumentService.svc/');

		if (container == null) {
			container = document.createElement('DIV');
			container.id = 'document_upload_container';
			container.style.display = 'none';
			document.body.appendChild(container);
		}
		container.innerHTML = '<iframe src="javascript: false" id="document_upload_iframe" name="document_upload_iframe" ></iframe>'
			+ '<form id="document_upload_form" name="document_upload_form" action = "' + url + '" method="post" enctype="multipart/form-data" target="document_upload_iframe">'
			+ '<input id="document_upload_data" name="document_upload_data" value="" type="hidden" />'
			+ '<input id="Authorization" name="Authorization" type="hidden" />'
			+ '<input id="EnvApi-SystemId" name="EnvApi-SystemId" type="hidden" />'
			+ '</form>';

		var isSuccess = false;

		jQuery('#document_upload_iframe').load(function() {
			setTimeout(iframeLoaded, 500);
		});

		function iframeLoaded() {
			if (isSuccess == false) {
				if (window.removeEventListener) {
					window.removeEventListener("message", callback);
				} else {
					window.detachEvent("onmessage", callback);
				}

				if (onerror != null) {
					onerror({ metadata: { statusCode: 400 }, error: { errorNumber: 0, message: "Unexpected error on document uploading. A possible cause is exceeding the maximum size." } });
				}
			}
		}

		var form = container.getElementsByTagName('form')[0];

		var data = _private._getUploadData(fileinputs, folderId);
		container.getElementsByTagName('input')[0].value = JSON.stringify(data);

		var sessionId = envianceSdk.getSessionId();
		if (sessionId) {
			container.getElementsByTagName('input')[1].value = 'Enviance ' + sessionId;
		}
		var systemId = envianceSdk.getSystemId();
		if (systemId) {
			container.getElementsByTagName('input')[2].value = systemId;
		}

		for (var j = 0, l = fileinputs.length; j < l; j++) {
			var fileinput = fileinputs[j];
			fileinput.parentNode.replaceChild(fileinput.cloneNode(false), fileinput);
			form.appendChild(fileinput);
		}

		function callback(event) {
			var identityKey = 'CROSSFORM_RESULT_IDENTITY_KEY';
			if (event.data.indexOf(identityKey) != 0) {
				return;
			}

			if (window.removeEventListener) {
				window.removeEventListener("message", callback);
			} else {
				window.detachEvent("onmessage", callback);
			}

			if (typeof(event.data) == 'undefined') {
				isSuccess = false;
				return;
			}

			var result = JSON.parse(event.data.substring(identityKey.length));
			isSuccess = true;

			if (result.metadata.statusCode == 200) {
				if (onsuccess != null) {
					onsuccess(result);
				}
			} else {
				if (onerror != null) {
					onerror(result);
				}
			}
		}

		if (window.addEventListener) {
			window.addEventListener("message", callback, false);
		} else {
			window.attachEvent("onmessage", callback);
		}

		form.submit();
	};

	envianceSdk.documents.validateUploadDocuments = function(fileinputs, folderId) {
		var result = [];
		var messages = {
			MSG_NOT_SELECTED: "* File is not specified.",
			MSG_LONG_VALUE: "* Document name cannot be greater than 50 characters.",
			MSG_NOT_EMPTY_VALUE: "* Document name cannot be empty.",
			MSG_ILLEGAL_CHARACTERS: "* Document name must not contain the following characters: \\\/:*?'<>|\"",
			MSG_UNIQUE_VALUE: "* A document with the same name already exists in this directory."
		};

		for (var ii = 0; ii < fileinputs.length; ii++) {
			if (fileinputs[ii].value == '') {
				result.push({ inputId: fileinputs[ii].id, message: messages.MSG_NOT_SELECTED });
			}
		}

		var serviceData = _private._getUploadData(fileinputs, folderId);

		function isUniqueValue(arr, inputId, documentName, folderIdOrPath) {
			for (var j = 0, k = arr.length; j < k; j++) {
				var obj = arr[j];
				if (obj.inputId.toLowerCase() != inputId.toLowerCase()
					&& obj.documentName.toLowerCase() == documentName.toLowerCase()
					&& obj.folderIdOrPath.toLowerCase() == folderIdOrPath.toLowerCase()) {
					return false;
				}
			}
			return true;
		}

		for (var i = 0, l = serviceData.length; i < l; i++) {
			var data = serviceData[i];
			var name = data.documentName;
			if (name.toString().length > 50) {
				result.push({ inputId: data.inputId, message: messages.MSG_LONG_VALUE });
				continue;
			}
			if (name == null || name == '' || name.match(/^\s+$/)) {
				result.push({ inputId: data.inputId, message: messages.MSG_NOT_EMPTY_VALUE });
				continue;
			}
			if (name.search(/[\*\<\>\|\?\:\\\/\'\"]/) > -1) {
				result.push({ inputId: data.inputId, message: messages.MSG_ILLEGAL_CHARACTERS });
				continue;
			}
			if (!isUniqueValue(serviceData, data.inputId, name, data.folderIdOrPath)) {
				result.push({ inputId: data.inputId, message: messages.MSG_UNIQUE_VALUE });
				continue;
			}
		}
		return result;
	};

	_private._getUploadData = function(inputs, folderId) {
		var result = [];
		for (var i = 0, l = inputs.length; i < l; i++) {
			var fileinput = inputs[i];
			var fullName = fileinput.value;

			var defaultName = fullName.substr(fullName.lastIndexOf('\\') + 1, fullName.length);
			result.push(
				new envianceSdk.documents.DocumentUploadInfo(
					fileinput.id,
					_private._getAttrValue(fileinput, 'data-document-folderid', folderId),
					fullName,
					_private._getAttrValue(fileinput, 'data-document-name', defaultName),
					_private._getAttrValue(fileinput, 'data-document-comment', ''),
					_private._getAttrValue(fileinput, 'data-document-description', '')
				)
			);
		}
		return result;
	};

	_private._getAttrValue = function(fileinput, attr, defaultValue) {
		var value = fileinput.getAttribute(attr);
		if (value != null) {
			var input = document.getElementById(value);
			return input == null ? value : input.value;
		}
		return defaultValue;
	};

	envianceRegisterNamespace("envianceSdk.packages");

	envianceSdk.packages.PackageUploadInfo = function(name, displayPage) {
		this.name = name;
		this.displayPage = displayPage;
	};

	envianceSdk.packages.uploadPackage = function(fileinput, packageUploadInfo, onsuccess, onerror) {
		var url = _private._buildUrl('ver2/PackageService.svc/');

		_private._crossFormSubmit([fileinput], url, packageUploadInfo, onsuccess, onerror);
	};

	envianceSdk.packages.downloadPackage = function(idOrName, onsuccess, onerror) {
		var url = _private._buildUrl('ver2/PackageService.svc/packages/' + idOrName + '/content');

		_private._crossFormSubmit(null, url, null, onsuccess, onerror);
	};

	envianceRegisterNamespace("envianceSdk.tasks");

	envianceSdk.tasks.TaskInfo = function(name, description, dueDate, timeZone, assignor, assignees, calendars, objects, documents) {
		if (name) {
			this.name = name;
		}
		if (description) {
			this.description = description;
		}
		if (dueDate) {
			this.dueDate = dueDate;
		}
		if (timeZone) {
			this.timeZone = new envianceSdk.common.TimeZone(timeZone);
		}
		if (assignor) {
			this.assignor = assignor;
		}
		if (assignees) {
			this.assignees = assignees;
		}
		if (calendars) {
			this.calendars = calendars;
		}
		if (objects) {
			this.objects = objects;
		}
		if (documents) {
			this.documents = documents;
		}

		this.addUserAssignee = function(userName) {
			this.assignees = this.assignees || [];
			this.assignees.push(new envianceSdk.common.UserAssignee(userName));
			return this;
		};

		this.addGroupAssignee = function(groupName) {
			this.assignees = this.assignees || [];
			this.assignees.push(new envianceSdk.common.GroupAssignee(groupName));
			return this;
		};

		this.addTagAssociatedObject = function(tag) {
			this.objects = this.objects || [];
			this.objects.push(new envianceSdk.common.TagAssociatedObject(tag));
			return this;
		};

		this.addPathAssociatedObject = function(path) {
			this.objects = this.objects || [];
			this.objects.push(path);
			return this;
		};

		this.addIdAssociatedObject = function(id) {
			this.objects = this.objects || [];
			this.objects.push(id);
			return this;
		};
	};

	envianceSdk.tasks.TaskOccurrenceInfo = function(statusChangeDate, object, dismissed, percentComplete, hoursToComplete, costToComplete, comment) {
		if (statusChangeDate) {
			this.statusChangeDate = statusChangeDate;
		}
		if (object) {
			this.object = object;
		}
		if (dismissed) {
			this.dismissed = dismissed;
		}
		if (percentComplete) {
			this.percentComplete = percentComplete;
		}
		if (hoursToComplete) {
			this.hoursToComplete = hoursToComplete;
		}
		if (costToComplete) {
			this.costToComplete = costToComplete;
		}
		if (comment) {
			this.comment = comment;
		}
	};

	envianceRegisterNamespace("envianceSdk.event");

	envianceSdk.event.EventInfo = function(name, beginDate, endDate, state, complianceType, acceptAsDeviation, requirement, fields, documents) {
		if (name) {
			this.name = name;
		}
		if (beginDate) {
			this.beginDate = beginDate;
		}
		if (endDate) {
			this.endDate = endDate;
		}
		if (state) {
			this.state = state;
		}
		if (complianceType) {
			this.complianceType = complianceType;
		}
		if (acceptAsDeviation != null) {
			this.acceptAsDeviation = acceptAsDeviation;
		}
		if (requirement) {
			this.requirement = requirement;
		}
		if (fields) {
			this.fields = fields;
		}
		if (documents) {
			this.documents = documents;
		}

		this.addScalarFieldValue = function(fieldName, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.ScalarFieldValue(fieldName, value));
			return this;
		};

		this.addDateFieldValue = function(fieldName, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.DateFieldValue(fieldName, value));
			return this;
		};

		this.addTimeFieldValue = function(fieldName, value) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.TimeFieldValue(fieldName, value));
			return this;
		};

		this.addUrlFieldValue = function(fieldName, label, url) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.UrlFieldValue(fieldName, label, url));
			return this;
		};

		this.addLinkedFieldValues = function(fieldName, values) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.LinkedFieldValues(fieldName, values));
			return this;
		};

		this.addMultiFieldValues = function(fieldName, values) {
			this.fields = this.fields || [];
			this.fields.push(new envianceSdk.customFields.MultiFieldValues(fieldName, values));
			return this;
		};
	};

	envianceSdk.data.NumericDataPoint = function(parameter, completeDate, value, qualityData) {
		if (parameter) {
			this.parameter = parameter;
		}
		if (completeDate) {
			this.completeDate = completeDate;
		}
		if (value) {
			this.value = value;
		}
		if (qualityData) {
			this.qualityData = qualityData;
		}

		this.addScalarFieldValue = function(name, val) {
			this.qualityData = this.qualityData || [];
			this.qualityData.push(new envianceSdk.customFields.ScalarFieldValue(name, val));
			return this;
		};

		this.addLinkedFieldValues = function(name, values) {
			this.qualityData = this.qualityData || [];
			this.qualityData.push(new envianceSdk.customFields.LinkedFieldValues(name, values));
			return this;
		};

	};

	envianceSdk.data.NumericDataRange = function(parameter, beginDate, endDate) {
		if (parameter) {
			this.parameter = parameter;
		}
		if (beginDate) {
			this.beginDate = beginDate;
		}
		if (endDate) {
			this.endDate = endDate;
		}
	};

	_private._runCommandPolling = function(commandInfoResult, onsuccess, onerror) {
		if (commandInfoResult.result.status == "Succeeded") {
			onsuccess(commandInfoResult);
			return;
		}
		if (commandInfoResult.result.status == "Failed") {
			onerror({ metadata: { statusCode: 500 }, error: { errorNumber: 0, message: commandInfoResult.result.errorInfo.error } });
			return;
		}
		var timeout = 1000 * 60 * 5;
		var startTime = new Date();
		var interval = 1000;

		var commandFunc = function() {
			envianceSdk.command.getCommand(commandInfoResult.result.id,
				function(commandInfo) {
					if (commandInfo.result.status == "Succeeded") {
						onsuccess(commandInfo);
						return;
					}
					if (commandInfo.result.status == "Failed") {
						onerror({ metadata: { statusCode: 500 }, error: { errorNumber: 0, message: commandInfo.result.errorInfo.error } });
						return;
					}
					if ((new Date() - startTime) > timeout) {
						onerror({ metadata: { statusCode: 400 }, error: { errorNumber: 0, message: "The Command Polling timeout is exceeded." } });
						return;
					}
					interval += (interval * 0.1);
					window.setTimeout(commandFunc, interval);
				},
				function(errorResponse) {
					onerror(errorResponse);
				});
		};
		window.setTimeout(commandFunc, interval);
	};

	envianceSdk.workflow.CreationInformation.prototype.addDocument = envianceSdk.common.AddDocument;
	envianceSdk.compliance.CreationInformation.prototype.addDocument = envianceSdk.common.AddDocument;
	envianceSdk.tasks.TaskInfo.prototype.addDocument = envianceSdk.common.AddDocument;
	envianceSdk.event.EventInfo.prototype.addDocument = envianceSdk.common.AddDocument;

	envianceSdk.compliance.CreationInformation.prototype.addTimeZone = envianceSdk.common.AddTimeZone;
	envianceSdk.tasks.TaskInfo.prototype.addTimeZone = envianceSdk.common.AddTimeZone;

	envianceRegisterNamespace("envianceSdk.report");

	envianceSdk.report.ReportInfo = function(report, format, from, to) {
		if (report) {
			this.report = report;
		}
		if (format) {
			this.format = format;
		}
		if (from) {
			this.from = from;
		}
		if (to) {
			this.to = to;
		}

		this.addParameters = function(objects, filterBy) {
			this.parameters = new envianceSdk.report.Parameters(objects, filterBy);
			return this.parameters;
		};
	};

	envianceSdk.report.Parameters = function(objects, filterBy) {
		if (objects) {
			this.objects = objects;
		}
		if (filterBy) {
			this.filterBy = filterBy;
		}

		this.addPathAssociatedObject = function(path) {
			this.objects = this.objects || [];
			this.objects.push(path);
			return this;
		};

		this.addIdAssociatedObject = function(id) {
			this.objects = this.objects || [];
			this.objects.push(id);
			return this;
		};

		this.addFilterBy = function(value) {
			this.filterBy = value;
			return this;
		};
	};

	return envianceSdk;
}(envianceSdk || { }));

envianceSdk._seal();
