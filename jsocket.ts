class Jsocket {

    private static _instance: Jsocket = null;
    public static get instance() {
        if (!this._instance) {
            this._instance = new Jsocket();
        }
        return this._instance;
    }


    /**
     * Jsocket 控制台,日志接口定义
     * */
    public log = {
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
        log: (data: any) => {
            if (!this.log.showLog) return;
            console.log(this.log.TAG, data);
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
        addRequest: function (...a) {
            for (var x in a) {
                this.requestFilter.push(a[x]);
            }
        },
        /**
         * 添加回复日志过滤action
         * @param a
         */
        addResponse: function (...a) {
            for (var x in a) {
                this.responseFilter.push(a[x]);
            }
        },
        /**
         * 同时添加请求,回复action
         * @param a
         */
        addFilter: function (...a) {
            this.addRequest(...a);
            this.addResponse(...a);
        }
    }

    /**
    * websocket 对象
    * */
    private ws: WebSocket = null;

    /**
     * websocket 连接地址
     * */
    public url = "";

    /**
     * 设置连接地址
     * @param host  域名
     * @param port  端口
     * @param upgroup 协议
     */
    public setUrl(host: string, port: string | number, secret = false) {
        let protocol = secret ? "wss://" : "ws://";
        this.url = protocol + host;
        if (port !== void 0) {
            this.url += ":" + port;
        }
    }

    /**
     * 打开websocket 连接
     * @param url
     */
    public open(url?: string) {

        if (url !== void 0) this.url = url;

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

    }

    /**
     * 关闭websocket连接
     * */
    public close(outer = true) {
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


    }

    /**websocket 连接成功回调*/
    private wsDidOpen = (evt) => {
        this.log.log('连接成功');

        this.conn.reset();

        for (var x in this.event.connect) {
            let jsc = this.event.connect[x];
            if (typeof (jsc.block) === 'function') {
                jsc.block(this);
            }
        }
    }
    /**连接关闭回调*/
    private wsDidClose = (evt) => {
        this.log.log('连接关闭');
        for (var x in this.event.close) {
            let jsc = this.event.close[x];
            if (typeof (jsc.block) === 'function') {
                jsc.block(this);
            }
        }

        this.conn.reconnect();
    }
    /**连接错误回调*/
    private wsDidError = (evt) => {
        this.log.log('连接错误');
        for (var x in this.event.error) {
            let jsc = this.event.error[x];
            if (typeof (jsc.block) === 'function') {
                jsc.block(this);
            }
        }

        this.conn.reconnect();
    }
    /**连接收到消息回调*/
    private wsDidMessage = (evt) => {
        var data;
        try {
            data = JSON.parse(evt.data);
        } catch (e) {
            this.log.log("收到不是json的数据:" + evt.data);
            this.stopLoading();
            return;
        }

        let action = data[this.event.Kaction];
        if (!this.inArray(this.log.responseFilter, action)) {
            this.log.log('收到消息 ' + evt.data);
        }

        if (action == 0) this.stopLoading();

        this.record.addRecordResponse(action, data);

        var flag = data[this.event.Kflag];
        var msg = data[this.event.Kmsg];

        let assign = data[this.event.Kwhat];
        if (assign) {
            let jsc = this.event.assign[assign];
            if (!jsc) return;
            if (jsc.loading) this.stopLoading();
            jsc.block(data, flag, msg, this);
            return;
        }

        let events = this.event.callback[action];
        if (events) {
            for (var i = 0; i < events.length; i++) {
                let jsc = events[i];
                if (jsc.loading) this.stopLoading();
                jsc.block(data, flag, msg, this);
                events.splice(i, 1);
                break;
            }
        }

        let list = this.event.listener[action];

        if (list) {
            for (var x in list) {
                let jsc = list[x];
                jsc.block(data, flag, msg, this);
            }
        }

    }
    /**
     * 发送请求
     * @param taget ==null 表示不添加回调
     * @param param 请求的参数
     * @param callback  回调
     * @param isLoading 是否显示loading 默认 true
     */
    public send(target: any, param: any, callback: Function, loading = true) {

        let action = param[this.event.Kaction];
        this.record.addRecordRequst(action, param);

        let request = JSON.stringify(param);

        if (!this.inArray(this.log.requestFilter, action)) {
            this.log.log("发送数据 " + request);
        }

        let assign = param[this.event.Kwhat] || null;

        if (assign) {
            this.addAssign(assign, target, callback, loading);
        } else {
            this.addCallback(action, target, callback, loading);
        }

        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            this.ws.send(request);
        }

        loading && this.startLoading();

    }

    /**
     * 报文缓存配置
     * 记住最后一次请求和回复的报文
     */
    public record = {
        response: null,
        request: null,
        filter: [],
        /**
         * 添加过滤器,被添加到过滤器中的action不会被记录
         * @param action
         */
        addRecordFilter: function (action) {
            for (var x in this.filter) {
                if (this.filter[x] == action) return;
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
                if (this.filter[x] == action) return;
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
            for (var x in this.filter) {
                if (this.filter[x] == action) return;
            }

            this.response = data;
        }
    }

    /**
     * 事件管理
     * */
    public event = {
        Kaction: "action",
        Kflag: "flag",
        Kmsg: "msg",
        Kwhat: "cdata",
        //连接成功回调列表
        connect: <Array<{ target: any, block: Function }>>[],
        //连接关闭回调列表
        close: <Array<{ target: any, block: Function }>>[],
        //连接错误回调列表
        error: <Array<{ target: any, block: Function }>>[],
        //监听回调列表
        listener: <{ [k: string]: Array<{ target: any, block: Function }> }>{},
        //回调列表
        callback: <{ [k: string]: Array<{ target: any, block: Function, loading: boolean }> }>{},
        //指定回调列表
        assign: <{ [k: string]: { target: any, block: Function, loading: boolean } }>{},
    }

    /**移除所有回调事件,所有监听事件 */
    public removeAll(target?: any) {

        this.removeConnect(target);
        this.removeClose(target);
        this.removeError(target);
        this.removeAllListener(target);
        this.removeAllCallback(target);
        this.removeAssign(target);

    }

    /**
     * 添加actio 监听
     * @param action
     * @param target
     * @param callback
     */
    public addListener(action: string | number, target: any, callback: Function) {
        if (!target || typeof (callback) !== 'function') return;

        let list = this.event.listener[action] || [];
        this.event.listener[action] = list;

        let i = list.length;

        while (i--) {
            let jsc = list[i];

            if (callback == jsc.block) return;
        }

        list.push({ target: target, block: callback })

    }

    /**
     * 移除指定action的监听
     * @param action
     * @param target
     * @param callback
     */
    public removeListener(action: string | number, target?: any, callback?: Function) {
        if (this.event.listener[action] === void 0) return;

        if (!target && !callback) {
            this.event.listener[action] = [];
            return;
        }

        let list = this.event.listener[action];
        let i = list.length;

        while (i--) {

            let jsc = list[i];

            if (callback && jsc.block == callback) {
                list.splice(i, 1);
                break;
            }

            if (!callback && jsc.target == target) {
                list.splice(i, 1);
            }

        }
    }
    /**
     * 移除所有监听,当taget|callback false 时移除所有监听
     * @param target
     * @param callback
     */
    public removeAllListener(target?: any, callback?: Function) {
        if (!target && !callback) {
            this.event.listener = {};
            return;
        }

        for (var x in this.event.listener) {

            this.removeListener(x, target, callback);
        }

    }


    /**
     * 添加回调
     * @param action
     * @param target
     * @param callback
     * @param loading
     */
    public addCallback(action: string | number, target: any, callback: Function, loading: boolean) {
        if (!target || typeof (callback) === void 0) return;

        let list = this.event.callback[action] || [];
        this.event.callback[action] = list;

        let i = list.length;

        while (i--) {
            let jsc = list[i];

            if (callback == jsc.block) return;
        }

        list.push({ target: target, block: callback, loading: loading })
    }

    /**
     * 移除指定的回调
     * @param action
     * @param target
     * @param callback
     */
    public removeCallback(action: string | number, target?: any, callback?: Function) {
        if (this.event.callback[action] === void 0) return;


        if (!target && !callback) {
            this.event.callback[action] = [];
            return;
        }

        let list = this.event.callback[action];
        let i = list.length;

        while (i--) {

            let jsc = list[i];

            if (callback && jsc.block == callback) {
                list.splice(i, 1);
                break;
            }

            if (!callback && jsc.target == target) {
                list.splice(i, 1);
            }

        }
    }
    /**
     * 移除所有回调,当taget|callback false 时移除所有回调
     * @param target
     * @param callback
     */
    public removeAllCallback(target?: any, callback?: Function) {

        if (!target && !callback) {
            this.event.callback = {};
            return;
        }

        for (var x in this.event.callback) {
            this.removeCallback(x, target, callback);
        }

    }

    /**
     * 添加指定的回调
     * @param what
     * @param targt
     * @param callback
     * @param loading
     */
    public addAssign(what: any, targt: any, callback: Function, loading: boolean) {
        if (!what) return;
        this.event.assign[what] = {
            target: targt,
            block: callback,
            loading: loading
        }
    }

    /**
     * 移除指定的回调
     * @param what
     * @param target
     * @param callback
     */
    public removeAssign(what: any, target?: any, callback?: Function) {

        if (what) delete this.event.assign[what];

        for (var x in this.event.assign) {
            let jsc = this.event.assign[x];

            if (callback && callback == jsc.block) {
                delete this.event.assign[x];
                break;
            }

            if (!callback && jsc.target == target) {
                delete this.event.assign[x];
            }
        }

    }

    /**移除所有指定的回调 */
    public removeAllAssign() {
        this.event.assign = {};
    }

    /**
     * 添加连接成功的监听
     * @param target
     * @param callback
     */
    public addConnect(target: any, callback: Function) {
        if (!target || typeof (callback) !== 'function') return;

        let i = this.event.connect.length;
        while (i--) {

            let jsc = this.event.connect[i];

            if (callback == jsc.block) return;
        }

        this.event.connect.push({ target: target, block: callback });

        if (this.ws && this.ws.readyState == WebSocket.OPEN) {
            callback(this);
        }
    }
    /**
     * 移除连接成功的监听
     * @param target
     * @param callback
     */
    public removeConnect(target?: any, callback?: Function) {

        if (!target && !callback) {
            this.event.connect = [];
            return;
        }

        let i = this.event.connect.length;

        while (i--) {

            let jsc = this.event.connect[i];

            if (callback && jsc.block == callback) {
                this.event.connect.splice(i, 1);
                break;
            }

            if (!callback && jsc.target == target) {
                this.event.connect.splice(i, 1);
            }

        }
    }

    /**
     * 添加连接关闭的监听
     * @param target
     * @param callback
     */
    public addClose(target: any, callback: Function) {
        if (!target || typeof (callback) !== 'function') return;
        let i = this.event.close.length;
        while (i--) {

            let jsc = this.event.close[i];

            if (callback == jsc.block) return;
        }

        this.event.close.push({ target: target, block: callback });
    }
    /**
     * 移除连接关闭的监听
     * @param target
     * @param callback
     */
    public removeClose(target: any, callback?: Function) {

        if (!target && !callback) {
            this.event.close = [];
            return;
        }

        let i = this.event.close.length;

        while (i--) {

            let jsc = this.event.close[i];

            if (callback && jsc.block == callback) {
                this.event.close.splice(i, 1);
                break;
            }

            if (!callback && jsc.target == target) {
                this.event.close.splice(i, 1);
            }
        }
    }
    /**
     * 添加连接错误的监听
     * @param target
     * @param callback
     */
    public addError(target: any, callback: Function) {
        if (!target || typeof (callback) !== 'function') return;
        let i = this.event.error.length;
        while (i--) {

            let jsc = this.event.error[i];

            if (callback == jsc.block) return;
        }

        this.event.error.push({ target: target, block: callback });

    }
    /**
     * 移除连接错误的监听
     * @param target
     * @param callback
     */
    public removeError(target: any, callback?: Function) {

        if (!target && !callback) {
            this.event.error = [];
            return;
        }

        let i = this.event.error.length;

        while (i--) {

            let jsc = this.event.error[i];

            if (callback && jsc.block == callback) {
                this.event.error.splice(i, 1);
                break;
            }

            if (!callback && jsc.target == target) {
                this.event.error.splice(i, 1);
            }
        }
    }

    /**心跳配置*/
    public heartbeat = {
        /**心跳定时器*/
        timer: 0,
        /**心跳间隔时间*/
        interval: 10000,
        /**心跳数据源*/
        block: null,
        /**开始心跳*/
        start: (block?: Function) => {
            this.heartbeat.block = block;
            if (this.heartbeat.timer) return;
            if (typeof (this.heartbeat.block) !== 'function') return;
            this.heartbeat.timer = setInterval(() => {
                this.send(null, this.heartbeat.block(this), null, false);
            }, this.heartbeat.interval)
        },
        /**停止心跳*/
        stop: () => {
            clearInterval(this.heartbeat.timer);
        }
    }

    /*重连相关*/
    private conn = {
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
        setIntervalMin: function (num){
            if (num < this.intervalMin) num = 2;
            if (num > this.intervalMax) {
                this.intervalMax = num;
            }
            this.intervalMin = num;
        },
        /**开始重连*/
        reconnect: () => {
            if (!this.conn.reConn) return;
            if (this.conn.userClose) return;
            if (this.conn.number > this.conn.maxNumber && this.conn.maxNumber > 0) return;

            this.conn.number++;
            switch (this.conn.pattern) {
                case 1:
                    this.conn.interval *= 2;
                    break;
            }

            this.conn.timer = setTimeout(() => {
                this.open();
            }, this.conn.interval);

            if (this.conn.interval > this.conn.intervalMax) {
                this.conn.interval = this.conn.intervalMin;
            }

        },
        /**重置重连参数 */
        reset: function () {
            this.number = 0;
        },
        /**停止重连 */
        stop: function () {
            if (this.userClose) clearTimeout(this.timer);
        }
    }


    private loadingTimer;
    private startLoading() {
        clearTimeout(this.loadingTimer);
        if (document.querySelector(".jsocket_loading")) return;

        let div = document.createElement("div");
        div.classList.add("jsocket_loading");
        div.style.position = "fixed";
        div.style.width = div.style.height = "100%";
        div.style.background = 'url(jsframe/Ajax/images/loading.gif) no-repeat 50% 50%';
        div.style.backgroundSize = "30px";

        document.body.appendChild(div);

        return div;
    }

    private stopLoading() {
        this.loadingTimer = setTimeout(() => {
            let div = document.querySelector(".jsocket_loading");
            if (div) div.remove();
        }, 500)
    }

    private inArray(array: Array<any>, value: any): boolean {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }
}

