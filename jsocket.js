var Jsocket = /** @class */ (function () {
    function Jsocket() {
        var _this = this;
        /**
         * Jsocket 控制台,日志接口定义
         * */
        this.log = {
            /**
            * 是否 显示日志
            * */
            showLog: true,
            /**
             * 服务器标签
             * 日志输出时,在前面显示
             * */
            TAG: "",
            /**
             * 打印日志
             */
            log: function (data) {
                if (!_this.log.showLog)
                    return;
                console.log(_this.log.TAG, data);
            },
            /**
             * 如果showLog == true
             * 回复时, 这些action 值不输出
             * */
            responseFilter: [],
            /**
             * 如果showLog == true
             * 请求时 这些action 值不输出
             * */
            requestFilter: [],
            /**
             * 添加请求日志过滤action
             * @param a
             */
            addRequest: function () {
                var a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    a[_i] = arguments[_i];
                }
                for (var x in a) {
                    this.requestFilter.push(a[x]);
                }
            },
            /**
             * 添加回复日志过滤action
             * @param a
             */
            addResponse: function () {
                var a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    a[_i] = arguments[_i];
                }
                for (var x in a) {
                    this.responseFilter.push(a[x]);
                }
            },
            /**
             * 同时添加请求,回复action
             * @param a
             */
            addFilter: function () {
                var a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    a[_i] = arguments[_i];
                }
                this.addRequest.apply(this, a);
                this.addResponse.apply(this, a);
            }
        };
        /**
        * websocket 对象
        * */
        this.ws = null;
        /**
         * websocket 连接地址
         * */
        this.url = "";
        /**websocket 连接成功回调*/
        this.wsDidOpen = function (evt) {
            _this.log.log('连接成功');
            _this.conn.reset();
            for (var x in _this.event.connect) {
                var jsc = _this.event.connect[x];
                if (typeof (jsc.block) === 'function') {
                    jsc.block(_this);
                }
            }
        };
        /**连接关闭回调*/
        this.wsDidClose = function (evt) {
            _this.log.log('连接关闭');
            for (var x in _this.event.close) {
                var jsc = _this.event.close[x];
                if (typeof (jsc.block) === 'function') {
                    jsc.block(_this);
                }
            }
            _this.conn.reconnect();
        };
        /**连接错误回调*/
        this.wsDidError = function (evt) {
            _this.log.log('连接错误');
            for (var x in _this.event.error) {
                var jsc = _this.event.error[x];
                if (typeof (jsc.block) === 'function') {
                    jsc.block(_this);
                }
            }
            _this.conn.reconnect();
        };
        /**连接收到消息回调*/
        this.wsDidMessage = function (evt) {
            var data;
            try {
                data = JSON.parse(evt.data);
            }
            catch (e) {
                _this.log.log("收到不是json的数据:" + evt.data);
                _this.stopLoading();
                return;
            }
            var action = data[_this.event.Kaction];
            if (!_this.inArray(_this.log.responseFilter, action)) {
                _this.log.log('收到消息 ' + evt.data);
            }
            if (action == 0)
                _this.stopLoading();
            _this.record.addRecordResponse(action, data);
            var flag = data[_this.event.Kflag];
            var msg = data[_this.event.Kmsg];
            var assign = data[_this.event.Kwhat];
            if (assign) {
                var jsc = _this.event.assign[assign];
                if (!jsc)
                    return;
                if (jsc.loading)
                    _this.stopLoading();
                jsc.block(data, flag, msg, _this);
                return;
            }
            var events = _this.event.callback[action];
            if (events) {
                for (var i = 0; i < events.length; i++) {
                    var jsc = events[i];
                    if (jsc.loading)
                        _this.stopLoading();
                    jsc.block(data, flag, msg, _this);
                    events.splice(i, 1);
                    break;
                }
            }
            var list = _this.event.listener[action];
            if (list) {
                for (var x in list) {
                    var jsc = list[x];
                    jsc.block(data, flag, msg, _this);
                }
            }
        };
        /**
         * 报文缓存配置
         * 记住最后一次请求和回复的报文
         */
        this.record = {
            response: null,
            request: null,
            filter: [],
            /**
             * 添加过滤器,被添加到过滤器中的action不会被记录
             * @param action
             */
            addRecordFilter: function (action) {
                for (var x in this.filter) {
                    if (this.filter[x] == action)
                        return;
                }
                this.filter.push(action);
            },
            /**
             * 保存请求记录
             * @param action
             * @param data
             */
            addRecordRequst: function (action, data) {
                for (var x in this.filter) {
                    if (this.filter[x] == action)
                        return;
                }
                this.response = null;
                this.request = data;
            },
            /**
             * 保存回复记录
             * @param action
             * @param data
             */
            addRecordResponse: function (action, data) {
                for (var x in this.record.filter) {
                    if (this.record.filter[x] == action)
                        return;
                }
                this.record.response = data;
            }
        };
        /**
         * 事件管理
         * */
        this.event = {
            Kaction: "action",
            Kflag: "flag",
            Kmsg: "msg",
            Kwhat: "cdata",
            //连接成功回调列表
            connect: [],
            //连接关闭回调列表
            close: [],
            //连接错误回调列表
            error: [],
            //监听回调列表
            listener: {},
            //回调列表
            callback: {},
            //指定回调列表
            assign: {},
        };
        /**心跳配置*/
        this.heartbeat = {
            /**心跳定时器*/
            timer: 0,
            /**心跳间隔时间*/
            interval: 10000,
            /**心跳数据源*/
            block: null,
            /**开始心跳*/
            start: function (block) {
                _this.heartbeat.block = block;
                if (_this.heartbeat.timer)
                    return;
                if (typeof (_this.heartbeat.block) !== 'function')
                    return;
                _this.heartbeat.timer = setInterval(function () {
                    _this.send(null, _this.heartbeat.block(_this), null, false);
                }, _this.heartbeat.interval);
            },
            /**停止心跳*/
            stop: function () {
                clearInterval(_this.heartbeat.timer);
            }
        };
        /*重连相关*/
        this.conn = {
            /**是否重连*/
            reConn: true,
            /**记录是否为用户主动关闭的连接,如果为用户关闭的不重连*/
            userClose: false,
            /**当前重连次数,连接成功是重置该值*/
            number: 0,
            /**最大重连次数,==0时,无限重连*/
            maxNumber: 10,
            /**重连间隔时间*/
            interval: 10000,
            /*最大的重连间隔时间*/
            intervalMax: 60000,
            /*最小重连时间*/
            intervalMin: 1000,
            /**重连模式,==1是,每次重连的间隔时间时上一次的2倍*/
            pattern: 0,
            /**重连定时器*/
            timer: 0,
            /*设置最大重连时间*/
            setIntervalMax: function (num) {
                this.intervalMax = num < this.intervalMin ? this.intervalMin : num;
            },
            /**
             * 设置重连模式
             * @param pattern
             */
            setPattern: function (pattern) {
                this.pattern = pattern;
                if (pattern == 1) {
                    this.interval = this.intervalMin;
                }
            },
            /**设置最新重连时间*/
            setIntervalMin: function (num) {
                if (num < this.intervalMin)
                    num = 2;
                if (num > this.intervalMax) {
                    this.intervalMax = num;
                }
                this.intervalMin = num;
            },
            /**开始重连*/
            reconnect: function () {
                if (!_this.conn.reConn)
                    return;
                if (_this.conn.userClose)
                    return;
                if (_this.conn.number > _this.conn.maxNumber && _this.conn.maxNumber > 0)
                    return;
                _this.conn.number++;
                switch (_this.conn.pattern) {
                    case 1:
                        _this.conn.interval *= 2;
                        break;
                }
                _this.conn.timer = setTimeout(function () {
                    _this.open();
                }, _this.conn.interval);
                if (_this.conn.interval > _this.conn.intervalMax) {
                    _this.conn.interval = _this.conn.intervalMin;
                }
            },
            /**重置重连参数 */
            reset: function () {
                this.number = 0;
            },
            /**停止重连 */
            stop: function () {
                if (this.userClose)
                    clearTimeout(this.timer);
            }
        };
    }
    Object.defineProperty(Jsocket, "instance", {
        get: function () {
            if (!this._instance) {
                this._instance = new Jsocket();
            }
            return this._instance;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * 设置连接地址
     * @param host  域名
     * @param port  端口
     * @param upgroup 协议
     */
    Jsocket.prototype.setUrl = function (host, port, secret) {
        if (secret === void 0) { secret = false; }
        var protocol = secret ? "wss://" : "ws://";
        this.url = protocol + host;
        if (port !== void 0) {
            this.url += ":" + port;
        }
    };
    /**
     * 打开websocket 连接
     * @param url
     */
    Jsocket.prototype.open = function (url) {
        if (url !== void 0)
            this.url = url;
        this.log.log(this.url);
        if (this.url.length == 0) {
            this.log.log("websocket url 错误");
            return;
        }
        this.close(false);
        this.ws = new WebSocket(this.url);
        this.ws.onopen = this.wsDidOpen;
        this.ws.onclose = this.wsDidClose;
        this.ws.onerror = this.wsDidError;
        this.ws.onmessage = this.wsDidMessage;
    };
    /**
     * 关闭websocket连接
     * */
    Jsocket.prototype.close = function (outer) {
        if (outer === void 0) { outer = true; }
        this.conn.userClose = outer;
        this.conn.stop();
        this.heartbeat.stop();
        if (this.ws) {
            this.ws.readyState == WebSocket.OPEN && this.ws.close();
            this.ws.onclose = null;
            this.ws.onopen = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws = null;
        }
    };
    /**
     * 发送请求
     * @param taget ==null 表示不添加回调
     * @param param 请求的参数
     * @param callback  回调
     * @param isLoading 是否显示loading 默认 true
     */
    Jsocket.prototype.send = function (target, param, callback, loading) {
        if (loading === void 0) { loading = true; }
        var action = param[this.event.Kaction];
        this.record.addRecordRequst(action, param);
        var request = JSON.stringify(param);
        if (!this.inArray(this.log.requestFilter, action)) {
            this.log.log("发送数据 " + request);
        }
        var assign = param[this.event.Kwhat] || null;
        if (assign) {
            this.addAssign(assign, target, callback, loading);
        }
        else {
            this.addCallback(action, target, callback, loading);
        }
        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            this.ws.send(request);
        }
        loading && this.startLoading();
    };
    /**移除所有回调事件,所有监听事件 */
    Jsocket.prototype.removeAll = function (target) {
        this.removeConnect(target);
        this.removeClose(target);
        this.removeError(target);
        this.removeAllListener(target);
        this.removeAllCallback(target);
        this.removeAssign(target);
    };
    /**
     * 添加actio 监听
     * @param action
     * @param target
     * @param callback
     */
    Jsocket.prototype.addListener = function (action, target, callback) {
        if (!target || typeof (callback) !== 'function')
            return;
        var list = this.event.listener[action] || [];
        this.event.listener[action] = list;
        var i = list.length;
        while (i--) {
            var jsc = list[i];
            if (callback == jsc.block)
                return;
        }
        list.push({ target: target, block: callback });
    };
    /**
     * 移除指定action的监听
     * @param action
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeListener = function (action, target, callback) {
        if (this.event.listener[action] === void 0)
            return;
        if (!target && !callback) {
            this.event.listener[action] = [];
            return;
        }
        var list = this.event.listener[action];
        var i = list.length;
        while (i--) {
            var jsc = list[i];
            if (callback && jsc.block == callback) {
                list.splice(i, 1);
                break;
            }
            if (!callback && jsc.target == target) {
                list.splice(i, 1);
            }
        }
    };
    /**
     * 移除所有监听,当taget|callback false 时移除所有监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeAllListener = function (target, callback) {
        if (!target && !callback) {
            this.event.listener = {};
            return;
        }
        for (var x in this.event.listener) {
            this.removeListener(x, target, callback);
        }
    };
    /**
     * 添加回调
     * @param action
     * @param target
     * @param callback
     * @param loading
     */
    Jsocket.prototype.addCallback = function (action, target, callback, loading) {
        if (!target || typeof (callback) === void 0)
            return;
        var list = this.event.callback[action] || [];
        this.event.callback[action] = list;
        var i = list.length;
        while (i--) {
            var jsc = list[i];
            if (callback == jsc.block)
                return;
        }
        list.push({ target: target, block: callback, loading: loading });
    };
    /**
     * 移除指定的回调
     * @param action
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeCallback = function (action, target, callback) {
        if (this.event.callback[action] === void 0)
            return;
        if (!target && !callback) {
            this.event.callback[action] = [];
            return;
        }
        var list = this.event.callback[action];
        var i = list.length;
        while (i--) {
            var jsc = list[i];
            if (callback && jsc.block == callback) {
                list.splice(i, 1);
                break;
            }
            if (!callback && jsc.target == target) {
                list.splice(i, 1);
            }
        }
    };
    /**
     * 移除所有回调,当taget|callback false 时移除所有回调
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeAllCallback = function (target, callback) {
        if (!target && !callback) {
            this.event.callback = {};
            return;
        }
        for (var x in this.event.callback) {
            this.removeCallback(x, target, callback);
        }
    };
    /**
     * 添加指定的回调
     * @param what
     * @param targt
     * @param callback
     * @param loading
     */
    Jsocket.prototype.addAssign = function (what, targt, callback, loading) {
        if (!what)
            return;
        this.event.assign[what] = {
            target: targt,
            block: callback,
            loading: loading
        };
    };
    /**
     * 移除指定的回调
     * @param what
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeAssign = function (what, target, callback) {
        if (what)
            delete this.event.assign[what];
        for (var x in this.event.assign) {
            var jsc = this.event.assign[x];
            if (callback && callback == jsc.block) {
                delete this.event.assign[x];
                break;
            }
            if (!callback && jsc.target == target) {
                delete this.event.assign[x];
            }
        }
    };
    /**移除所有指定的回调 */
    Jsocket.prototype.removeAllAssign = function () {
        this.event.assign = {};
    };
    /**
     * 添加连接成功的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.addConnect = function (target, callback) {
        if (!target || typeof (callback) !== 'function')
            return;
        var i = this.event.connect.length;
        while (i--) {
            var jsc = this.event.connect[i];
            if (callback == jsc.block)
                return;
        }
        this.event.connect.push({ target: target, block: callback });
        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            callback(this);
        }
    };
    /**
     * 移除连接成功的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeConnect = function (target, callback) {
        if (!target && !callback) {
            this.event.connect = [];
            return;
        }
        var i = this.event.connect.length;
        while (i--) {
            var jsc = this.event.connect[i];
            if (callback && jsc.block == callback) {
                this.event.connect.splice(i, 1);
                break;
            }
            if (!callback && jsc.target == target) {
                this.event.connect.splice(i, 1);
            }
        }
    };
    /**
     * 添加连接关闭的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.addClose = function (target, callback) {
        if (!target || typeof (callback) !== 'function')
            return;
        var i = this.event.close.length;
        while (i--) {
            var jsc = this.event.close[i];
            if (callback == jsc.block)
                return;
        }
        this.event.close.push({ target: target, block: callback });
    };
    /**
     * 移除连接关闭的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeClose = function (target, callback) {
        if (!target && !callback) {
            this.event.close = [];
            return;
        }
        var i = this.event.close.length;
        while (i--) {
            var jsc = this.event.close[i];
            if (callback && jsc.block == callback) {
                this.event.close.splice(i, 1);
                break;
            }
            if (!callback && jsc.target == target) {
                this.event.close.splice(i, 1);
            }
        }
    };
    /**
     * 添加连接错误的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.addError = function (target, callback) {
        if (!target || typeof (callback) !== 'function')
            return;
        var i = this.event.error.length;
        while (i--) {
            var jsc = this.event.error[i];
            if (callback == jsc.block)
                return;
        }
        this.event.error.push({ target: target, block: callback });
    };
    /**
     * 移除连接错误的监听
     * @param target
     * @param callback
     */
    Jsocket.prototype.removeError = function (target, callback) {
        if (!target && !callback) {
            this.event.error = [];
            return;
        }
        var i = this.event.error.length;
        while (i--) {
            var jsc = this.event.error[i];
            if (callback && jsc.block == callback) {
                this.event.error.splice(i, 1);
                break;
            }
            if (!callback && jsc.target == target) {
                this.event.error.splice(i, 1);
            }
        }
    };
    Jsocket.prototype.startLoading = function () {
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
    Jsocket.prototype.stopLoading = function () {
        this.loadingTimer = setTimeout(function () {
            var div = document.querySelector(".jsocket_loading");
            if (div)
                div.remove();
        }, 500);
    };
    Jsocket.prototype.inArray = function (array, value) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    };
    Jsocket._instance = null;
    return Jsocket;
}());
//# sourceMappingURL=Jsocket.js.map