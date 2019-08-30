
class Jsocket0 implements JsocketInterface, JsDataSourceInterface {


    private static _instant: Jsocket0;
    public static instant() {
        if (!this._instant) {
            this._instant = new Jsocket0();
        }
        return this._instant;
    }

    ws: WebSocket;

    wsUrl: string;

    log: JslogInterface;

    conn: JsconnInterface;

    event: JsEventMInterface;

    constructor() {
        this.log = new JsocketLog();
        this.conn = new JsocketConn();
        this.event = new JsocketEvent();
    }

    setWsUrl(host: string, port?: number, upgroup?: boolean): void {

        var protocol = upgroup ? "wss://" : "ws://";

        this.wsUrl = protocol + host;
        if (port !== void 0) {
            this.wsUrl += ":" + port;
        }
    }

    open(url?: string): void {
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

            this.ws.onopen = (evt) => {
                this.wsDidOpen(evt);
            }

            this.ws.onclose = (evt) => {
                this.wsDidClose(evt);
            }

            this.ws.onerror = (evt) => {
                this.wsDidError(evt);
            }

            this.ws.onmessage = (evt) => {
                this.wsDidMessage(evt);
            }
        }

    }

    close(userClose?: boolean): void {
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

    }



    send(taget: any, param: object, callback: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void, always?: boolean, isLoading: boolean = true): void {

        var action = param[this.event.KGroup];
        this.addRecordRequst(action, param);

        var request = JSON.stringify(param);

        if (this.log.showLog && !this.inArray(this.log.requestFilter, action)) {
            console.log(this.log.TAG + " 发送数据", request);
        }


        let assign = param[this.event.KAssign] || null;

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


        if (isLoading) this.startLoading();
    }

    listener(action: string | number, target: any, param: object, callback: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void) {
        this.event.ListenerAor(action, target, callback, true, false);
    }


    /*-------------监听---------------*/

    private wsDidOpen(evt) {

        if (this.log.showLog) {
            console.log(this.log.TAG, "连接成功");
        }

        for (var i = 0; i < this.event.Connected.length; i++) {
            var ev = this.event.Connected[i];
            if (ev.block) {
                ev.block(this)
            }
        }


        //连接打开,自动握手
        if (typeof (this.hsPacket) === "function") {

            this.send("jsocket_handshake", this.hsPacket(), (response: any, flag?: number, msg?: string) => {
                this.wsDidHandshake(response, flag, msg);
            }, true);
        }
    }

    private wsDidError(evt) {
        if (this.log.showLog) {
            console.log(this.log.TAG, "连接错误")
        }

        for (var i = 0; i < this.event.Errored.length; i++) {
            var ev = this.event.Errored[i];
            if (ev.block) {
                ev.block(this)
            }
        }

        this.reConnect();
    }

    private wsDidClose(evt) {
        if (this.log.showLog) {
            console.log(this.log.TAG, "连接关闭")
        }

        for (var i = 0; i < this.event.Closed.length; i++) {
            var ev = this.event.Closed[i];
            if (ev.block) {
                ev.block(this)
            }
        }

        this.reConnect();
    }

    private wsDidHandshake(response: any, flag: number, msg: string) {
        for (var i = 0; i < this.event.Handshaked.length; i++) {
            var jsc = this.event.Handshaked[i];

            jsc.block(response, flag, msg, this);
        }
    }



    private wsDidMessage(evt) {

        var data;
        try {
            data = JSON.parse(evt.data);
        } catch (e) {
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
                    if (jsc.isLoading) this.stopLoading();

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
                    if (jsc.isLoading) this.stopLoading();

                    var flag = data[this.event.KFlag];
                    var msg = data[this.event.KMsg];

                    jsc.block(data, flag, msg, this);
                }
            }

        } else {

            let jsc = this.event.Assign[assign];
            if (jsc.isLoading) this.stopLoading();
            jsc.block(data, flag, msg, this);

            this.event.AssignRemove(assign);

        }

        if (action == 0) this.stopLoading();
    }



    /*------------数据源---------------*/
    hbInterval: number = 10000;

    hbTimer: number;

    hbPacket: () => object;

    setHbPacket(packet: () => object): void {
        this.hbPacket = packet;

        if (this.hbTimer) return;
        this.hbTimer = setInterval(() => {
            this.send(null, this.hbPacket(), null, false, false);
        }, this.hbInterval);
    }

    hsPacket: () => object;


    /**重连 */
    private reConnect() {
        this.close(false);

        //超过连接次数
        //最大连接次数为0 不限制
        if (!this.conn.isReConn) return;
        if (this.conn.userClose) return;
        if (this.conn.currNumber > this.conn.number && this.conn.number > 0) return;

        this.conn.currNumber++;


        switch (this.conn.pattern) {
            case JsocketConn.Pattern_Normal:
                break;
            case JsocketConn.Pattern_Double:
                this.conn.interval *= 2;
                break;
        }

        this.conn.timer = setTimeout(() => {
            this.open();
        }, this.conn.interval)

        if (this.conn.interval > this.conn.intervalMax) {
            this.conn.interval = this.conn.intervalMin;
        }

    }


    private inArray(array: Array<any>, value: any): boolean {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
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

    record = {
        filter: [],
        request: null,
        response: null
    }
    addRecordFilter(action) {
        for (var x in this.record.filter) {
            if (this.record.filter[x] == action) return;
        }

        this.record.filter.push(action);
    }

    addRecordRequst(action, data) {

        for (var x in this.record.filter) {
            if (this.record.filter[x] == action) return;
        }

        this.record.response = null;
        this.record.request = data;

    }

    addRecordResponse(action, data) {
        for (var x in this.record.filter) {
            if (this.record.filter[x] == action) return;
        }

        this.record.response = data;
    }

}




class JsocketLog implements JslogInterface {

    TAG: string = "";

    showLog: boolean = true;

    requestFilter: (string | number)[] = [];

    responseFilter: (string | number)[] = [];

    addRequestFilter(...a) {
        for (var x in a) {
            this.requestFilter.push(a[x]);
        }
    }

    addResponseFilter(...a) {
        for (var x in a) {
            this.responseFilter.push(a[x]);
        }
    }

    addFilter(...a) {
        this.addRequestFilter(...a);
        this.addResponseFilter(...a);
    }

}


class JsocketConn implements JsconnInterface {

    public static Pattern_Normal = 0;
    public static Pattern_Double = 1;

    userClose: boolean = false;

    isReConn: boolean = true;

    pattern: number = JsocketConn.Pattern_Normal;

    setPattern(type: number): void {

        this.pattern = type;
        if (type == 1) {
            this.interval = this.intervalMin;
        }

    }

    number: number = 10;

    currNumber: number = 0;

    interval: number = 10000;

    intervalMax: number = 60000;

    setIntervalMax(num: number): void {

        this.intervalMax = num < this.intervalMin ? this.intervalMin : num;

    }

    intervalMin: number = 1000;

    setIntervalMix(num: number): void {

        if (num < this.intervalMin) {
            num = 2;
        }

        if (num > this.intervalMax) {
            this.intervalMax = num;
        }

        this.intervalMin = num

    }


    timer: number;

}

class JsocketEvent implements JsEventMInterface {

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
    private EventAor(jscm: JscInterface, array: JscInterface[]) {

        if (!jscm.target) return;

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

    }

    compareWhat: boolean = false;

    Connected: JsEventCallback[] = [];

    ConnectAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void {

        var jscm: JsEventCallback = {
            always: true,
            target: target,
            block: callback
        }

        this.EventAor(jscm, this.Connected)


    }
    Handshaked: JscInterface[] = [];

    HandshakeAor(target: any, callback?: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void, always?: boolean): void {

        var jscm: JscInterface = {
            always: always === void 0 ? true : always,
            target: target,
            block: callback
        }

        this.EventAor(jscm, this.Handshaked);
    }

    Errored: JsEventCallback[] = [];

    ErrorAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void {

        var jscm: JsEventCallback = {
            always: true,
            target: target,
            block: callback
        }

        this.EventAor(jscm, this.Errored);
    }

    Closed: JsEventCallback[] = [];

    CloseAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void {

        var jscm: JsEventCallback = {
            always: true,
            target: target,
            block: callback
        }

        this.EventAor(jscm, this.Closed);
    }

    KGroup: string = "action";

    KFlag: string = "flag";

    KMsg: string = "msg";

    KWhat: string = "what";

    KAssign: string = 'cdata';

    Listener: { [key: string]: JscInterface[]; } = {};
    Callback: { [key: string]: JscInterface[]; } = {};
    Assign: { [key: string]: JscInterface } = {};

    AssignAppend(name, target, callback, isLoading?: boolean) {
        var jscm: JscInterface = {
            target: target,
            always: false,
            block: callback,
            isLoading: isLoading
        }

        this.Assign[name] = jscm;

    }

    AssignRemove(name) {
        delete this.Assign[name];
    }

    ListenerAor(action: string | number, target: any, callback?: (response: any, flag?: number, msg?: string) => void, always?: boolean, isLoading?: boolean): void {
        if (!target) return;


        var map = always ? this.Listener : this.Callback;

        var jscList: JscInterface[];

        if (!callback && map[action] === void 0) {
            return;
        }

        if (map[action] === void 0) {
            jscList = [];
            map[action] = jscList;
        } else {
            jscList = map[action];
        }


        var jscm: JscInterface = {
            target: target,
            always: false,
            block: callback,
            isLoading: isLoading
        }
        this.EventAor(jscm, jscList);

    }


    removeAllListener(target?: any) {

        if (target) {

            this.__remove(target, this.Listener);
            this.__remove(target, this.Callback);

            return;
        }


        this.Listener = {}
        this.Callback = {};
    }

    removeAllEvent(target?: any) {

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
    }

    removeAll(target?: any) {
        this.removeAllEvent(target);
        this.removeAllListener(target);
    }


    private __remove(target, map) {
        for (var x in map) {
            let array = map[x];
            var i = array.length;

            while (i--) {
                var jsc = array[i];
                if (jsc.target == target) {
                    array.splice(i, 1);
                }
            }
        }
    }



}

