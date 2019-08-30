var Jsocket0 = /** @class */ (function () {
    function Jsocket0() {
        /*------------数据源---------------*/
        this.hbInterval = 10000;
        this.record = {
            filter: [],
            request: null,
            response: null
        };
        this.log = new JsocketLog();
        this.conn = new JsocketConn();
        this.event = new JsocketEvent();
    }
    Jsocket0.instant = function () {
        if (!this._instant) {
            this._instant = new Jsocket0();
        }
        return this._instant;
    };
    Jsocket0.prototype.setWsUrl = function (host, port, upgroup) {
        var protocol = upgroup ? "wss://" : "ws://";
        this.wsUrl = protocol + host;
        if (port !== void 0) {
            this.wsUrl += ":" + port;
        }
    };
    Jsocket0.prototype.open = function (url) {
        var _this = this;
        this.conn.userClose = false;
        this.wsUrl = url === void 0 ? this.wsUrl : url;
        if (this.log.showLog) {
            console.log(this.log.TAG, this.wsUrl);
        }
        if (this.wsUrl.length == 0) {
            console.error(this.log.TAG, "websocket url 错误");
            return;
        }
        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            this.ws.close();
        }
        this.ws = new WebSocket(this.wsUrl);
        if (this.ws) {
            this.ws.onopen = function (evt) {
                _this.wsDidOpen(evt);
            };
            this.ws.onclose = function (evt) {
                _this.wsDidClose(evt);
            };
            this.ws.onerror = function (evt) {
                _this.wsDidError(evt);
            };
            this.ws.onmessage = function (evt) {
                _this.wsDidMessage(evt);
            };
        }
    };
    Jsocket0.prototype.close = function (userClose) {
        userClose = userClose === void 0 ? true : userClose;
        if (userClose) {
            this.conn.userClose = true;
        }
        clearInterval(this.hbTimer);
        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            this.ws.close();
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onopen = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws = null;
        }
    };
    Jsocket0.prototype.send = function (taget, param, callback, always, isLoading) {
        if (isLoading === void 0) { isLoading = true; }
        var action = param[this.event.KGroup];
        this.addRecordRequst(action, param);
        var request = JSON.stringify(param);
        if (this.log.showLog && !this.inArray(this.log.requestFilter, action)) {
            console.log(this.log.TAG + " 发送数据", request);
        }
        var assign = param[this.event.KAssign] || null;
        //如果,taget==null,false... 表示不添加回调
        if (!assign && taget) {
            this.event.ListenerAor(action, taget, callback, always, isLoading);
        }
        if (assign) {
            this.event.AssignAppend(assign, taget, callback, isLoading);
        }
        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            this.ws.send(request);
        }
        if (isLoading)
            this.startLoading();
    };
    Jsocket0.prototype.listener = function (action, target, param, callback) {
        this.event.ListenerAor(action, target, callback, true, false);
    };
    /*-------------监听---------------*/
    Jsocket0.prototype.wsDidOpen = function (evt) {
        var _this = this;
        if (this.log.showLog) {
            console.log(this.log.TAG, "连接成功");
        }
        for (var i = 0; i < this.event.Connected.length; i++) {
            var ev = this.event.Connected[i];
            if (ev.block) {
                ev.block(this);
            }
        }
        //连接打开,自动握手
        if (typeof (this.hsPacket) === "function") {
            this.send("jsocket_handshake", this.hsPacket(), function (response, flag, msg) {
                _this.wsDidHandshake(response, flag, msg);
            }, true);
        }
    };
    Jsocket0.prototype.wsDidError = function (evt) {
        if (this.log.showLog) {
            console.log(this.log.TAG, "连接错误");
        }
        for (var i = 0; i < this.event.Errored.length; i++) {
            var ev = this.event.Errored[i];
            if (ev.block) {
                ev.block(this);
            }
        }
        this.reConnect();
    };
    Jsocket0.prototype.wsDidClose = function (evt) {
        if (this.log.showLog) {
            console.log(this.log.TAG, "连接关闭");
        }
        for (var i = 0; i < this.event.Closed.length; i++) {
            var ev = this.event.Closed[i];
            if (ev.block) {
                ev.block(this);
            }
        }
        this.reConnect();
    };
    Jsocket0.prototype.wsDidHandshake = function (response, flag, msg) {
        for (var i = 0; i < this.event.Handshaked.length; i++) {
            var jsc = this.event.Handshaked[i];
            jsc.block(response, flag, msg, this);
        }
    };
    Jsocket0.prototype.wsDidMessage = function (evt) {
        var data;
        try {
            data = JSON.parse(evt.data);
        }
        catch (e) {
            console.log(this.log.TAG, "收到不是json的数据:" + evt.data);
            this.stopLoading();
            return;
        }
        var action = data[this.event.KGroup];
        if (this.log.showLog && !this.inArray(this.log.responseFilter, action)) {
            console.log(this.log.TAG + " 收到消息", evt.data);
        }
        this.addRecordResponse(action, data);
        var assign = data[this.event.KAssign];
        if (!assign) {
            /* callback 监听,开始执行回调时,一个请求回复只执行一次
             * 而且肯定删除
             * 如果 想要同时监听,设置 always==true
             */
            var eventModel = this.event.Callback[action];
            if (eventModel) {
                for (var i = 0; i < eventModel.length; i++) {
                    var jsc = eventModel[i];
                    if (jsc.isLoading)
                        this.stopLoading();
                    var flag = data[this.event.KFlag];
                    var msg = data[this.event.KMsg];
                    jsc.block(data, flag, msg, this);
                    eventModel.splice(i, 1);
                    break;
                }
            }
            //回调 但不移除
            eventModel = this.event.Listener[action];
            if (eventModel) {
                for (var i = 0; i < eventModel.length; i++) {
                    var jsc = eventModel[i];
                    if (jsc.isLoading)
                        this.stopLoading();
                    var flag = data[this.event.KFlag];
                    var msg = data[this.event.KMsg];
                    jsc.block(data, flag, msg, this);
                }
            }
        }
        else {
            var jsc_1 = this.event.Assign[assign];
            if (jsc_1.isLoading)
                this.stopLoading();
            jsc_1.block(data, flag, msg, this);
            this.event.AssignRemove(assign);
        }
        if (action == 0)
            this.stopLoading();
    };
    Jsocket0.prototype.setHbPacket = function (packet) {
        var _this = this;
        this.hbPacket = packet;
        if (this.hbTimer)
            return;
        this.hbTimer = setInterval(function () {
            _this.send(null, _this.hbPacket(), null, false, false);
        }, this.hbInterval);
    };
    /**重连 */
    Jsocket0.prototype.reConnect = function () {
        var _this = this;
        this.close(false);
        //超过连接次数
        //最大连接次数为0 不限制
        if (!this.conn.isReConn)
            return;
        if (this.conn.userClose)
            return;
        if (this.conn.currNumber > this.conn.number && this.conn.number > 0)
            return;
        this.conn.currNumber++;
        switch (this.conn.pattern) {
            case JsocketConn.Pattern_Normal:
                break;
            case JsocketConn.Pattern_Double:
                this.conn.interval *= 2;
                break;
        }
        this.conn.timer = setTimeout(function () {
            _this.open();
        }, this.conn.interval);
        if (this.conn.interval > this.conn.intervalMax) {
            this.conn.interval = this.conn.intervalMin;
        }
    };
    Jsocket0.prototype.inArray = function (array, value) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    };
    Jsocket0.prototype.startLoading = function () {
        clearTimeout(this.loadingTimer);
        if (document.querySelector(".jsocket_loading"))
            return;
        var div = document.createElement("div");
        div.classList.add("jsocket_loading");
        div.style.position = "fixed";
        div.style.width = div.style.height = "100%";
        div.style.background = 'url(jsframe/Ajax/images/loading.gif) no-repeat 50% 50%';
        div.style.backgroundSize = "30px";
        document.body.appendChild(div);
        return div;
    };
    Jsocket0.prototype.stopLoading = function () {
        this.loadingTimer = setTimeout(function () {
            var div = document.querySelector(".jsocket_loading");
            if (div)
                div.remove();
        }, 500);
    };
    Jsocket0.prototype.addRecordFilter = function (action) {
        for (var x in this.record.filter) {
            if (this.record.filter[x] == action)
                return;
        }
        this.record.filter.push(action);
    };
    Jsocket0.prototype.addRecordRequst = function (action, data) {
        for (var x in this.record.filter) {
            if (this.record.filter[x] == action)
                return;
        }
        this.record.response = null;
        this.record.request = data;
    };
    Jsocket0.prototype.addRecordResponse = function (action, data) {
        for (var x in this.record.filter) {
            if (this.record.filter[x] == action)
                return;
        }
        this.record.response = data;
    };
    return Jsocket0;
}());
var JsocketLog = /** @class */ (function () {
    function JsocketLog() {
        this.TAG = "";
        this.showLog = true;
        this.requestFilter = [];
        this.responseFilter = [];
    }
    JsocketLog.prototype.addRequestFilter = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        for (var x in a) {
            this.requestFilter.push(a[x]);
        }
    };
    JsocketLog.prototype.addResponseFilter = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        for (var x in a) {
            this.responseFilter.push(a[x]);
        }
    };
    JsocketLog.prototype.addFilter = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        this.addRequestFilter.apply(this, a);
        this.addResponseFilter.apply(this, a);
    };
    return JsocketLog;
}());
var JsocketConn = /** @class */ (function () {
    function JsocketConn() {
        this.userClose = false;
        this.isReConn = true;
        this.pattern = JsocketConn.Pattern_Normal;
        this.number = 10;
        this.currNumber = 0;
        this.interval = 10000;
        this.intervalMax = 60000;
        this.intervalMin = 1000;
    }
    JsocketConn.prototype.setPattern = function (type) {
        this.pattern = type;
        if (type == 1) {
            this.interval = this.intervalMin;
        }
    };
    JsocketConn.prototype.setIntervalMax = function (num) {
        this.intervalMax = num < this.intervalMin ? this.intervalMin : num;
    };
    JsocketConn.prototype.setIntervalMix = function (num) {
        if (num < this.intervalMin) {
            num = 2;
        }
        if (num > this.intervalMax) {
            this.intervalMax = num;
        }
        this.intervalMin = num;
    };
    JsocketConn.Pattern_Normal = 0;
    JsocketConn.Pattern_Double = 1;
    return JsocketConn;
}());
var JsocketEvent = /** @class */ (function () {
    function JsocketEvent() {
        this.compareWhat = false;
        this.Connected = [];
        this.Handshaked = [];
        this.Errored = [];
        this.Closed = [];
        this.KGroup = "action";
        this.KFlag = "flag";
        this.KMsg = "msg";
        this.KWhat = "what";
        this.KAssign = 'cdata';
        this.Listener = {};
        this.Callback = {};
        this.Assign = {};
    }
    /**
     * 添加事件
     * 当 jscm.block判断为false时
     * 移除所有 jscm.taget的监听
     *
     * 同一个 target 允许添加多个回调,但是callback必须不同
     * 否则 替换
     *
     * @param jscm 回调模型
     * @param array 回调容器
     */
    JsocketEvent.prototype.EventAor = function (jscm, array) {
        if (!jscm.target)
            return;
        if (!jscm.block) {
            var i = array.length;
            while (i--) {
                var jsc = array[i];
                if (jsc.target == jscm.target) {
                    array.splice(i, 1);
                }
            }
            return;
        }
        for (var i = 0; i < array.length; i++) {
            var jsc = array[i];
            if (jsc.target == jscm.target && jsc.block == jscm.block) {
                //array.splice(i, 1, jscm);
                return;
            }
        }
        array.push(jscm);
    };
    JsocketEvent.prototype.ConnectAor = function (target, callback) {
        var jscm = {
            always: true,
            target: target,
            block: callback
        };
        this.EventAor(jscm, this.Connected);
    };
    JsocketEvent.prototype.HandshakeAor = function (target, callback, always) {
        var jscm = {
            always: always === void 0 ? true : always,
            target: target,
            block: callback
        };
        this.EventAor(jscm, this.Handshaked);
    };
    JsocketEvent.prototype.ErrorAor = function (target, callback) {
        var jscm = {
            always: true,
            target: target,
            block: callback
        };
        this.EventAor(jscm, this.Errored);
    };
    JsocketEvent.prototype.CloseAor = function (target, callback) {
        var jscm = {
            always: true,
            target: target,
            block: callback
        };
        this.EventAor(jscm, this.Closed);
    };
    JsocketEvent.prototype.AssignAppend = function (name, target, callback, isLoading) {
        var jscm = {
            target: target,
            always: false,
            block: callback,
            isLoading: isLoading
        };
        this.Assign[name] = jscm;
    };
    JsocketEvent.prototype.AssignRemove = function (name) {
        delete this.Assign[name];
    };
    JsocketEvent.prototype.ListenerAor = function (action, target, callback, always, isLoading) {
        if (!target)
            return;
        var map = always ? this.Listener : this.Callback;
        var jscList;
        if (!callback && map[action] === void 0) {
            return;
        }
        if (map[action] === void 0) {
            jscList = [];
            map[action] = jscList;
        }
        else {
            jscList = map[action];
        }
        var jscm = {
            target: target,
            always: false,
            block: callback,
            isLoading: isLoading
        };
        this.EventAor(jscm, jscList);
    };
    JsocketEvent.prototype.removeAllListener = function (target) {
        if (target) {
            this.__remove(target, this.Listener);
            this.__remove(target, this.Callback);
            return;
        }
        this.Listener = {};
        this.Callback = {};
    };
    JsocketEvent.prototype.removeAllEvent = function (target) {
        if (target) {
            this.__remove(target, this.Connected);
            this.__remove(target, this.Closed);
            this.__remove(target, this.Errored);
            this.__remove(target, this.Handshaked);
            return;
        }
        this.Connected = [];
        this.Closed = [];
        this.Errored = [];
        this.Handshaked = [];
    };
    JsocketEvent.prototype.removeAll = function (target) {
        this.removeAllEvent(target);
        this.removeAllListener(target);
    };
    JsocketEvent.prototype.__remove = function (target, map) {
        for (var x in map) {
            var array = map[x];
            var i = array.length;
            while (i--) {
                var jsc = array[i];
                if (jsc.target == target) {
                    array.splice(i, 1);
                }
            }
        }
    };
    return JsocketEvent;
}());
//# sourceMappingURL=jsocket0.js.map